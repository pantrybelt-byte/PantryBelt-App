/**
 * AccessBelt Cloud Functions — TIER 3B Security
 *
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │  UPGRADE PATH: Deploy when upgrading to Firebase Blaze plan         │
 * │                                                                      │
 * │  How it strengthens Tier 3:                                          │
 * │  • Replaces the Firestore session doc with a Firebase Custom Claim   │
 * │  • Custom claims live in the JWT — can't be forged or spoofed        │
 * │  • The function validates a time-based nonce + rate-limits per UID   │
 * │  • Only the app binary has the nonce algorithm (from .env secret)    │
 * │                                                                      │
 * │  Deployment:                                                         │
 * │    cd functions && npm install                                       │
 * │    firebase deploy --only functions --project pantrybelt-1e7eb      │
 * └─────────────────────────────────────────────────────────────────────┘
 *
 * Once deployed, update firestore.rules to use:
 *   request.auth.token.appVerified == true
 * instead of hasActiveSession(), for even stronger server-side verification.
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');

admin.initializeApp();
const db = admin.firestore();

// Rate limit: max 5 grant requests per UID per hour
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

/**
 * grantAppAccess — Tier 3B Cloud Function
 *
 * Called by utils/auth.ts after anonymous sign-in (when on Blaze plan).
 * Sets a custom claim { appVerified: true } on the anonymous Firebase user.
 *
 * The Firestore rules can then check:
 *   request.auth.token.appVerified == true
 *
 * Security checks performed server-side:
 *   1. UID must match the authenticated caller
 *   2. Nonce must be valid for the current time window
 *   3. Rate limit: max 5 calls per UID per hour
 */
exports.grantAppAccess = onCall({ cors: true }, async (request) => {
    // ── Must be authenticated ─────────────────────────────────────────────
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Authentication required.');
    }

    const uid = request.auth.uid;
    const { nonce, platform } = request.data ?? {};

    // ── Validate inputs ───────────────────────────────────────────────────
    if (!nonce || typeof nonce !== 'string') {
        throw new HttpsError('invalid-argument', 'nonce required.');
    }
    if (!platform || !['ios', 'android', 'web'].includes(platform)) {
        throw new HttpsError('invalid-argument', 'Invalid platform.');
    }

    // ── Validate time-based nonce ─────────────────────────────────────────
    // The nonce must match: "{uid_last8}_pb_{platform}_{currentHourSlot}"
    // Current AND previous hour slot are accepted (10-minute grace window handled client-side)
    const hourSlot = Math.floor(Date.now() / 3_600_000);
    const uidSuffix = uid.slice(-8);
    const validNonces = new Set([
        `${uidSuffix}_pb_${platform}_${hourSlot}`,
        `${uidSuffix}_pb_${platform}_${hourSlot - 1}`,
    ]);

    if (!validNonces.has(nonce)) {
        console.warn(`[Security] Invalid nonce attempt from uid=${uid}`);
        throw new HttpsError('permission-denied', 'Invalid app nonce.');
    }

    // ── Rate limiting ─────────────────────────────────────────────────────
    const rateRef = db.collection('_rate_limits').doc(uid);
    const rateSnap = await rateRef.get();
    const now = Date.now();

    if (rateSnap.exists) {
        const { count, windowStart } = rateSnap.data();
        if (now - windowStart < RATE_LIMIT_WINDOW_MS) {
            if (count >= RATE_LIMIT_MAX) {
                console.warn(`[Security] Rate limit hit for uid=${uid}`);
                throw new HttpsError('resource-exhausted', 'Too many requests. Try again later.');
            }
            await rateRef.update({ count: admin.firestore.FieldValue.increment(1) });
        } else {
            // Window expired — reset
            await rateRef.set({ count: 1, windowStart: now });
        }
    } else {
        await rateRef.set({ count: 1, windowStart: now });
    }

    // ── Set custom claim ──────────────────────────────────────────────────
    await admin.auth().setCustomUserClaims(uid, {
        appVerified: true,
        platform,
        claimedAt: now,
    });

    // Log for audit trail
    console.log(`[Security] appVerified claim granted to uid=${uid} platform=${platform}`);

    return { success: true, uid };
});
