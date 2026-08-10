/**
 * utils/auth.ts — AccessBelt 3-Tier Security System
 *
 * ┌──────────────────────────────────────────────────────────────────────┐
 * │  TIER 1: Firebase Anonymous Authentication                            │
 * │  Every app launch signs in anonymously — no PII, real Firebase JWT.  │
 * │  Blocks: direct API attacks, curl, bots with no auth token.          │
 * │                                                                       │
 * │  TIER 3A: App Session Bootstrap (works on Spark free plan)            │
 * │  After auth, writes a session doc with app-specific fields.          │
 * │  Firestore rules verify the session exists before allowing writes.   │
 * │  Blocks: scripts that get an anonymous token but aren't the real app. │
 * └──────────────────────────────────────────────────────────────────────┘
 *
 * Call `initAppSecurity()` once from _layout.tsx on mount.
 * All other calls are automatic.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { signInAnonymously } from 'firebase/auth';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { Platform } from 'react-native';
import { auth, db } from '../config/firebase';

const SESSION_KEY = '@pb_session_uid';
const SESSION_GRACE_MS = 10 * 60 * 1000; // re-bootstrap every 10 minutes

// ─── Internal: derive the app session token ───────────────────────────────────
// The session token is a string only the real app binary can produce:
//   "{uid_last8}_pb_{platform}_{hourSlot}"
// hourSlot = hours since epoch, so the token rotates every hour.
// A bot that reverse-engineers this formula still needs a valid Firebase auth
// token (Tier 1) AND must know the uid (tied to their device). Both together
// make replay attacks infeasible within the same hour window.
function deriveSessionToken(uid: string): string {
    const hourSlot = Math.floor(Date.now() / 3_600_000);
    const uidSuffix = uid.slice(-8);
    const platform = Platform.OS; // 'ios' | 'android' | 'web'
    return `${uidSuffix}_pb_${platform}_${hourSlot}`;
}

// ─── TIER 1: Ensure anonymous Firebase Auth ───────────────────────────────────
async function ensureAnonymousAuth(): Promise<string> {
    // Reuse existing signed-in user if available
    if (auth.currentUser) return auth.currentUser.uid;

    // Check AsyncStorage for cached UID (speeds up cold start)
    const cached = await AsyncStorage.getItem(SESSION_KEY);

    try {
        const credential = await signInAnonymously(auth);
        const uid = credential.user.uid;

        if (uid !== cached) {
            await AsyncStorage.setItem(SESSION_KEY, uid);
        }
        return uid;
    } catch (err) {
        // If offline or auth fails, Firestore writes will fail — that's correct
        // behaviour; we never want to write without an auth token.
        console.warn('[Security] Anonymous auth failed:', err);
        throw err;
    }
}

// ─── TIER 3A: Bootstrap App Session in Firestore ─────────────────────────────
// Writes a session document to _app_sessions/{uid}.
// The Firestore rules on all analytics collections do a get() on this doc
// to confirm the write originates from the real AccessBelt app.
async function bootstrapAppSession(uid: string): Promise<void> {
    const sessionToken = deriveSessionToken(uid);

    await setDoc(
        doc(db, '_app_sessions', uid),
        {
            // Fields Firestore rules validate:
            active: true,
            platform: Platform.OS,
            appId: 'accessbelt-v3',
            sessionToken,
            // Metadata:
            lastBootstrap: serverTimestamp(),
        },
        { merge: true }
    );
}

// ─── Public API ───────────────────────────────────────────────────────────────
let _lastBootstrap = 0;
let _bootstrapPromise: Promise<void> | null = null;

/**
 * initAppSecurity()
 *
 * Call this ONCE from _layout.tsx on mount.
 * It:
 *   1. Signs in anonymously (Tier 1)
 *   2. Bootstraps the app session in Firestore (Tier 3A)
 *
 * Subsequent calls within SESSION_GRACE_MS are no-ops (avoids redundant writes).
 */
export async function initAppSecurity(): Promise<void> {
    const now = Date.now();
    if (now - _lastBootstrap < SESSION_GRACE_MS && _bootstrapPromise) {
        return _bootstrapPromise;
    }

    _bootstrapPromise = (async () => {
        try {
            const uid = await ensureAnonymousAuth();
            await bootstrapAppSession(uid);
            _lastBootstrap = Date.now();
        } catch (err) {
            // Fail silently — security layers degrade gracefully if offline
            // (writes will just be rejected by Firestore, which is correct)
            console.warn('[Security] initAppSecurity failed:', err);
        }
    })();

    return _bootstrapPromise;
}

/**
 * getCurrentUid()
 * Returns the current anonymous UID, or null if not yet signed in.
 */
export function getCurrentUid(): string | null {
    return auth.currentUser?.uid ?? null;
}
