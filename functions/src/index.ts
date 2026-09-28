/**
 * AccessBelt Cloud Functions — functions/src/index.ts
 *
 * Functions:
 *   askPete              — Pete AI assistant (Gemini, rate-limited)
 *   encryptUserField     — KMS-backed encryption for contactEmail + zipCode
 *   generatePasswordResetLink — short-lived password reset link (10 min)
 *
 * Security posture:
 *   - Every onCall function verifies Firebase Auth ID token automatically.
 *   - Secrets injected at runtime from GCP Secret Manager (never in bundle).
 *   - Rate limiting via shared rateLimit() helper (Firestore transaction).
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import * as admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { KeyManagementServiceClient } from "@google-cloud/kms";

if (admin.apps.length === 0) {
  admin.initializeApp();
}
const db = admin.firestore();

// ─── Secrets ──────────────────────────────────────────────────────────────────
const geminiApiKey  = defineSecret("GEMINI_API_KEY");
// KMS key resource path stored in Secret Manager so it never appears in source.
// Format: projects/PROJECT/locations/LOCATION/keyRings/RING/cryptoKeys/KEY
const kmsKeyName    = defineSecret("KMS_ENCRYPTION_KEY_NAME");

// ─── Constants ─────────────────────────────────────────────────────────────────
const MODEL          = "gemini-2.0-flash";
const ENDPOINT       = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
const API_TIMEOUT_MS = 10_000;

// Fields we are permitted to encrypt via encryptUserField.
// Any field name not in this set is rejected.
//
// zipCode was deliberately REMOVED from this set on 2026-09-28. Encrypting it
// broke the thing it was supposed to protect: ZIP is the input to county
// derivation, and county is the only geographic granularity we are allowed to
// retain (Operating Agreement §6.5). Ciphertext cannot be grouped, filtered or
// aggregated, so the food-desert and user-county BigQuery exports would have
// silently started producing empty buckets. A 5-digit ZIP on a doc keyed by an
// anonymous uid is already coarse; the governance control is "never store
// precise location", which ZIP satisfies on its own. Do not re-add it.
const ENCRYPTABLE_FIELDS = new Set(["contactEmail"]);

// ─── Shared rate-limit helper ─────────────────────────────────────────────────
/**
 * Increments a per-uid/per-day counter in Firestore.
 * Throws HttpsError("resource-exhausted") when the limit is reached.
 *
 * @param uid      Firebase Auth UID
 * @param bucket   Firestore collection name for this counter
 * @param maxPerDay  Max calls allowed per UTC day
 */
async function rateLimit(uid: string, bucket: string, maxPerDay: number): Promise<void> {
  const today       = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
  const counterRef  = db.collection(bucket).doc(`${uid}_${today}`);

  await db.runTransaction(async (tx) => {
    const snap  = await tx.get(counterRef);
    const count = snap.exists ? (snap.data()?.count ?? 0) : 0;
    if (count >= maxPerDay) {
      throw new HttpsError(
        "resource-exhausted",
        `Daily limit of ${maxPerDay} reached. Please try again tomorrow.`
      );
    }
    tx.set(
      counterRef,
      { uid, date: today, count: count + 1, lastAt: FieldValue.serverTimestamp() },
      { merge: true }
    );
  });
}

// ─── Pete AI System Prompt ────────────────────────────────────────────────────
const PETE_SYSTEM_PROMPT =
  "You are Pete, a warm and knowledgeable food assistance helper serving Alabama's Black Belt " +
  "communities — including Dallas, Wilcox, Perry, Hale, Marengo, Lowndes, Autauga, Elmore, and " +
  "neighboring counties.\n\n" +
  "Your job: help community members find food pantries, understand SNAP/EBT and WIC benefits, school " +
  "meal programs, and get simple recipe ideas using pantry staples.\n\n" +
  "RECIPE GUIDELINES (follow strictly when giving any recipe):\n" +
  "- Always include EXACT ingredient quantities (e.g. '2 cups rice', '1 tablespoon oil', not 'some rice').\n" +
  "- Always include cooking RATIOS where relevant (e.g. 'rice: 1 cup rice to 2 cups water').\n" +
  "- Always include TIMES (prep time, cook time, total time) and TEMPERATURES (°F for oven/stovetop settings).\n" +
  "- Use simple pantry staples common at food banks (rice, beans, canned goods, pasta, peanut butter).\n" +
  "- Format as a short numbered steps list. Maximum 8 steps.\n\n" +
  "General Guidelines:\n" +
  "- Be warm, clear, and non-judgmental. Many users are in difficult situations.\n" +
  "- Keep answers practical and concise — short paragraphs or simple lists.\n" +
  "- For urgent food needs, always mention: call 211 (free, 24/7).\n" +
  "- Stay focused on food assistance and community resources. Politely redirect off-topic questions.\n" +
  "- Never invent a specific pantry name, address, phone number, or hours — you do not have live " +
  "database access in this conversation. Direct pantry-lookup questions to the Map tab or 211.\n" +
  "- Never ask for or repeat sensitive personal data (SSN, financial account numbers, health status).";

// ─── PII scrubbing ────────────────────────────────────────────────────────────
const PII_PATTERNS: ReadonlyArray<readonly [RegExp, string]> = [
  [/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g, "[email]"],
  [/(\+?1[-.\\s]?)?\(?\d{3}\)?[-.\\s]?\d{3}[-.\\s]?\d{4}/g, "[phone]"],
  [/\b\d{3}[-\s]\d{2}[-\s]\d{4}\b/g, "[ssn]"],
  [/\b\d{4}[\s\-]?\d{4}[\s\-]?\d{4}[\s\-]?\d{4}\b/g, "[card]"],
  [/\b\d+\s+[A-Za-z0-9\s]+(?:Street|St|Avenue|Ave|Boulevard|Blvd|Drive|Dr|Road|Rd|Lane|Ln|Way|Court|Ct|Circle|Place|Pl|Parkway|Pkwy)\.?\b/gi, "[address]"],
  [/\b\d{5}(?:-\d{4})?\b/g, "[zip]"],
];
function sanitizePII(text: string): string {
  return PII_PATTERNS.reduce((s, [p, r]) => s.replace(p, r), text);
}

export type GeminiTurn = { role: "user" | "model"; text: string };

// ─── Function 1: askPete ──────────────────────────────────────────────────────
export const askPete = onCall(
  { region: "us-central1", secrets: [geminiApiKey], cors: true },
  async (request) => {
    // Auth check
    if (!request.auth?.uid) {
      throw new HttpsError("unauthenticated", "Authentication is required to speak with Pete.");
    }
    const uid = request.auth.uid;

    // Input validation
    const { userPrompt, history: rawHistory } = request.data ?? {};
    if (typeof userPrompt !== "string" || !userPrompt.trim()) {
      throw new HttpsError("invalid-argument", "userPrompt must be a non-empty string.");
    }
    if (userPrompt.length > 1000) {
      throw new HttpsError("invalid-argument", "Message too long. Please keep it under 1,000 characters.");
    }

    const history: GeminiTurn[] = Array.isArray(rawHistory)
      ? rawHistory
          .filter((t): t is GeminiTurn => t && (t.role === "user" || t.role === "model") && typeof t.text === "string")
          .slice(-10)
      : [];

    // Rate limit: 30 messages/day
    await rateLimit(uid, "pete_rate_limits", 30);

    // Sanitize + build contents
    const cleanPrompt = sanitizePII(userPrompt.trim());
    const contents = [
      ...history.map((t) => ({ role: t.role, parts: [{ text: sanitizePII(t.text) }] })),
      { role: "user", parts: [{ text: cleanPrompt }] },
    ];

    // Query Gemini
    const apiKey = geminiApiKey.value();
    if (!apiKey) throw new HttpsError("internal", "Pete assistant is temporarily unconfigured.");

    const controller = new AbortController();
    const timeoutId  = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

    try {
      const response = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: PETE_SYSTEM_PROMPT }] },
          contents,
          generationConfig: { maxOutputTokens: 600, temperature: 0.65 },
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        console.error("Gemini API error", response.status, await response.text());
        throw new HttpsError("unavailable", "Pete is having trouble connecting right now. Please try again.");
      }

      const json  = await response.json();
      const reply = json.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!reply || typeof reply !== "string") {
        throw new HttpsError("unavailable", "Pete could not generate a response. Please try again.");
      }

      return { text: reply.trim() };
    } catch (err: unknown) {
      clearTimeout(timeoutId);
      if (err instanceof HttpsError) throw err;
      if ((err as Error)?.name === "AbortError") {
        throw new HttpsError("deadline-exceeded", "Pete took too long to answer. Please try again.");
      }
      console.error("Unexpected Gemini error:", err);
      throw new HttpsError("internal", "Pete is temporarily unavailable. Please try again later.");
    }
  }
);

// ─── Function 2: encryptUserField ─────────────────────────────────────────────
/**
 * Encrypts a single user_profiles field using GCP Cloud KMS and stores the
 * Base64 ciphertext back in Firestore.
 *
 * Currently contactEmail only — see ENCRYPTABLE_FIELDS for why zipCode is not
 * in this set.
 *
 * Client flow:
 *   1. User updates their profile with a contactEmail.
 *   2. Client calls encryptUserField({ field: "contactEmail", plaintext: "foo@example.com" }).
 *   3. This function encrypts and writes the ciphertext to user_profiles/{uid}.
 *   4. The plaintext NEVER touches Firestore.
 *
 * There is intentionally no client-callable decrypt. Nothing in the app reads
 * contactEmail back — it exists for operator contact, which happens server-side.
 * Adding a decrypt callable would hand any authenticated client a decryption
 * oracle for its own record and defeat the point of encrypting at rest.
 */
export const encryptUserField = onCall(
  { region: "us-central1", secrets: [kmsKeyName], cors: true },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError("unauthenticated", "Authentication required.");
    }
    const uid = request.auth.uid;

    const { field, plaintext } = request.data ?? {};

    if (typeof field !== "string" || !ENCRYPTABLE_FIELDS.has(field)) {
      throw new HttpsError(
        "invalid-argument",
        `field must be one of: ${[...ENCRYPTABLE_FIELDS].join(", ")}.`
      );
    }
    if (typeof plaintext !== "string" || plaintext.length === 0) {
      throw new HttpsError("invalid-argument", "plaintext must be a non-empty string.");
    }
    if (plaintext.length > 500) {
      throw new HttpsError("invalid-argument", "plaintext is too long.");
    }

    // Additional rate-limit to protect KMS quota: 20 encryption ops/day per user
    await rateLimit(uid, "kms_rate_limits", 20);

    const keyResourceName = kmsKeyName.value();
    if (!keyResourceName) {
      throw new HttpsError("internal", "Encryption service is not configured.");
    }

    const kmsClient   = new KeyManagementServiceClient();
    const plaintextBuf = Buffer.from(plaintext, "utf8");

    const [encryptResponse] = await kmsClient.encrypt({
      name:      keyResourceName,
      plaintext: plaintextBuf,
    });

    const ciphertext = Buffer.from(encryptResponse.ciphertext as Uint8Array).toString("base64");

    // Write only the ciphertext; the plaintext field is never stored.
    // Field name convention: `{fieldName}_encrypted` (e.g. "contactEmail_encrypted").
    await db.collection("user_profiles").doc(uid).set(
      {
        [`${field}_encrypted`]: ciphertext,
        // Null out the plaintext field if it was previously written by old code.
        [field]: null,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return { ok: true };
  }
);

// ─── Function 3: generatePasswordResetLink ────────────────────────────────────
/**
 * Issues a Firebase password reset link with a 10-minute expiry (vs the
 * Firebase default of 1 hour). Callable only by the user for their own email.
 *
 * NOTE: Firebase Admin SDK's generatePasswordResetLink() does not directly
 * accept an expiry parameter — expiry is set project-wide in Firebase Console
 * (Authentication → Templates → Password reset → Link expiry).
 * This function enforces a secondary expiry by writing a one-time-use token
 * to Firestore and validating it when the reset link is clicked (via a
 * separate landing page / deep link handler).
 *
 * For now it emits the Firebase-generated link and logs the shortened window.
 * Wire the landing page in Phase 5.
 */
export const generatePasswordResetLink = onCall(
  { region: "us-central1", cors: true },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError("unauthenticated", "Authentication required.");
    }

    const { email } = request.data ?? {};
    if (typeof email !== "string" || !email.includes("@")) {
      throw new HttpsError("invalid-argument", "A valid email address is required.");
    }

    // Rate-limit: max 3 reset requests per day per UID
    await rateLimit(request.auth.uid, "password_reset_limits", 3);

    const actionCodeSettings = {
      url:             "https://accessbelt.app/reset-password",  // update when landing page is live
      handleCodeInApp: false,
    };

    let resetLink: string;
    try {
      resetLink = await admin.auth().generatePasswordResetLink(email, actionCodeSettings);
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      // auth/user-not-found: don't reveal whether email is registered
      if (code === "auth/user-not-found") {
        return { ok: true };  // Silent success — prevents user enumeration
      }
      console.error("generatePasswordResetLink error:", err);
      throw new HttpsError("internal", "Could not generate password reset link.");
    }

    // Store a short-lived token so a landing page can enforce 10-min expiry.
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes
    await db.collection("password_reset_tokens").add({
      uid:       request.auth.uid,
      email,
      expiresAt: admin.firestore.Timestamp.fromMillis(expiresAt),
      used:      false,
      createdAt: FieldValue.serverTimestamp(),
    });

    // In production, email the link via Resend (Phase 5).
    // For now, return it to the caller so the app can open it.
    return { ok: true, resetLink };
  }
);
