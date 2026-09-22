import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import * as admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

if (admin.apps.length === 0) {
  admin.initializeApp();
}
const db = admin.firestore();

// Cloud Function secret for Gemini API key
const geminiApiKey = defineSecret("GEMINI_API_KEY");

const MODEL = "gemini-3.8-flash";
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
const API_TIMEOUT_MS = 10_000;

const PETE_SYSTEM_PROMPT =
  "You are Pete, a warm and knowledgeable food assistance helper serving Alabama's Black Belt " +
  "communities — including Dallas, Wilcox, Perry, Hale, Marengo, Lowndes, Autauga, Elmore, and " +
  "neighboring counties.\n\n" +
  "Your job: help community members find food pantries, understand SNAP/EBT and WIC benefits, school " +
  "meal programs, and get simple recipe ideas using pantry staples.\n\n" +
  "Guidelines:\n" +
  "- Be warm, clear, and non-judgmental. Many users are in difficult situations.\n" +
  "- Keep answers practical and concise — short paragraphs or simple lists.\n" +
  "- For urgent food needs, always mention: call 211 (free, 24/7).\n" +
  "- Stay focused on food assistance and community resources. Politely redirect off-topic questions.\n" +
  "- Never invent a specific pantry name, address, phone number, or hours — you do not have live " +
  "database access in this conversation. Direct pantry-lookup questions to the Map tab or 211, " +
  "and if you don't have a specific detail, say so plainly rather than guessing.\n" +
  "- Never ask for or repeat sensitive personal data (SSN, financial account numbers, health status). " +
  "Basic contact/location info a user offers to find local resources is fine.";

const PII_PATTERNS: ReadonlyArray<readonly [RegExp, string]> = [
  [/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g, "[email]"],
  [/(\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g, "[phone]"],
  [/\b\d{3}[-\s]\d{2}[-\s]\d{4}\b/g, "[ssn]"],
  [/\b\d{4}[\s\-]?\d{4}[\s\-]?\d{4}[\s\-]?\d{4}\b/g, "[card]"],
  [/\b\d+\s+[A-Za-z0-9\s]+(?:Street|St|Avenue|Ave|Boulevard|Blvd|Drive|Dr|Road|Rd|Lane|Ln|Way|Court|Ct|Circle|Place|Pl|Parkway|Pkwy)\.?\b/gi, "[address]"],
  [/\b\d{5}(?:-\d{4})?\b/g, "[zip]"],
];

function sanitizePII(text: string): string {
  return PII_PATTERNS.reduce((s, [pattern, replacement]) => s.replace(pattern, replacement), text);
}

export type GeminiTurn = { role: "user" | "model"; text: string };

export const askPete = onCall(
  {
    region: "us-central1",
    secrets: [geminiApiKey],
    cors: true,
  },
  async (request) => {
    // 1. Authentication check (anonymous users are fine)
    if (!request.auth || !request.auth.uid) {
      throw new HttpsError("unauthenticated", "Authentication is required to speak with Pete.");
    }
    const uid = request.auth.uid;

    // 2. Input validation & capping
    const data = request.data;
    if (!data || typeof data.userPrompt !== "string") {
      throw new HttpsError("invalid-argument", "userPrompt must be a string.");
    }
    const userPrompt = data.userPrompt.trim();
    if (!userPrompt) {
      throw new HttpsError("invalid-argument", "userPrompt cannot be empty.");
    }
    if (userPrompt.length > 1000) {
      throw new HttpsError("invalid-argument", "Message too long. Please keep your message under 1,000 characters.");
    }

    const rawHistory: unknown = data.history;
    const history: GeminiTurn[] = Array.isArray(rawHistory)
      ? rawHistory
          .filter((t): t is GeminiTurn => t && (t.role === "user" || t.role === "model") && typeof t.text === "string")
          .slice(-10)
      : [];

    // 3. Rate limiting per UID: max 30 messages per day in Firestore
    const today = new Date().toISOString().slice(0, 10);
    const rateLimitDocRef = db.collection("pete_rate_limits").doc(`${uid}_${today}`);

    await db.runTransaction(async (transaction) => {
      const docSnap = await transaction.get(rateLimitDocRef);
      const currentCount = docSnap.exists ? (docSnap.data()?.count ?? 0) : 0;
      if (currentCount >= 30) {
        throw new HttpsError(
          "resource-exhausted",
          "You've reached your limit of 30 messages with Pete today. Pete will be ready to help again tomorrow!"
        );
      }
      transaction.set(
        rateLimitDocRef,
        {
          uid,
          date: today,
          count: currentCount + 1,
          lastMessageAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    });

    // 4. Sanitize inputs
    const cleanPrompt = sanitizePII(userPrompt);
    const contents = [
      ...history.map((t) => ({ role: t.role, parts: [{ text: sanitizePII(t.text) }] })),
      { role: "user", parts: [{ text: cleanPrompt }] },
    ];

    // 5. Query Gemini API
    const apiKey = geminiApiKey.value();
    if (!apiKey) {
      throw new HttpsError("internal", "Pete assistant is temporarily unconfigured.");
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

    try {
      const response = await fetch(ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: PETE_SYSTEM_PROMPT }] },
          contents,
          generationConfig: {
            maxOutputTokens: 512,
            temperature: 0.7,
          },
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errText = await response.text();
        console.error("Gemini API call failed with status", response.status, errText);
        throw new HttpsError("unavailable", "Pete is having trouble connecting right now. Please try again in a moment.");
      }

      const json = await response.json();
      const reply = json.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!reply || typeof reply !== "string") {
        throw new HttpsError("unavailable", "Pete could not generate a response. Please try again.");
      }

      return { text: reply.trim() };
    } catch (err: unknown) {
      clearTimeout(timeoutId);
      if (err instanceof HttpsError) {
        throw err;
      }
      const isAbort = (err as Error)?.name === "AbortError";
      if (isAbort) {
        throw new HttpsError("deadline-exceeded", "Pete took too long to answer. Please try again.");
      }
      console.error("Unexpected error contacting Gemini:", err);
      throw new HttpsError("internal", "Pete is temporarily unavailable. Please try again later.");
    }
  }
);
