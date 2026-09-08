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

import {
    createUserWithEmailAndPassword,
    deleteUser,
    EmailAuthProvider,
    linkWithCredential,
    onAuthStateChanged,
    signInAnonymously,
    signInWithEmailAndPassword,
    signOut as firebaseSignOut,
} from 'firebase/auth';
import { deleteDoc, doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { Platform } from 'react-native';
import { auth, db } from '../config/firebase';

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

// Firebase's AsyncStorage-backed persistence (see firebase.ts) rehydrates a
// previously signed-in user asynchronously — auth.currentUser can read as
// null for a moment after JS startup even when a real account session is
// persisted on disk. Reading it too early would make ensureAnonymousAuth()
// below wrongly believe no one is signed in and call signInAnonymously(),
// silently orphaning the real account. Wait for Firebase's first
// onAuthStateChanged callback (fires once persisted state is resolved,
// with either a user or null) before trusting auth.currentUser.
let _authReadyPromise: Promise<void> | null = null;
function waitForAuthReady(): Promise<void> {
    if (!_authReadyPromise) {
        _authReadyPromise = new Promise(resolve => {
            const unsubscribe = onAuthStateChanged(auth, () => {
                unsubscribe();
                resolve();
            });
        });
    }
    return _authReadyPromise;
}

// ─── TIER 1: Ensure anonymous Firebase Auth ───────────────────────────────────
async function ensureAnonymousAuth(): Promise<string> {
    await waitForAuthReady();

    // Reuse existing signed-in user if available. This is the authoritative
    // check — Firebase's own AsyncStorage-backed persistence (firebase.ts)
    // already restores the real session; no separate manual cache needed.
    if (auth.currentUser) return auth.currentUser.uid;

    try {
        const credential = await signInAnonymously(auth);
        return credential.user.uid;
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

/**
 * reestablishSession()
 *
 * initAppSecurity()'s grace-period memoization is time-based, not uid-based.
 * After a sign-in/sign-up/sign-out swaps auth.currentUser to a different uid,
 * nothing would otherwise re-bootstrap _app_sessions/{newUid} until the old
 * grace period naturally expires — leaving Firestore rules' hasActiveSession()
 * failing for the new uid in the meantime. Force an immediate re-bootstrap.
 */
export async function reestablishSession(): Promise<void> {
    _lastBootstrap = 0;
    _bootstrapPromise = null;
    await initAppSecurity();
}

/**
 * waitForInitialAuthBootstrap()
 *
 * Guards against a race between the app-launch anonymous sign-in
 * (initAppSecurity(), kicked off from AuthReadyProvider on mount) and a real
 * sign-up/sign-in submitted before it resolves. AuthReadyProvider renders
 * children immediately without gating on authReady, and the anonymous
 * signInAnonymously() call can take 2-8s on TestFlight/cellular — if a real
 * auth call reads auth.currentUser during that window it's still null, so
 * linkOrCreate() falls into createUserWithEmailAndPassword() instead of
 * linking. If the earlier signInAnonymously() call then resolves afterward,
 * it flips auth.currentUser back to a fresh anonymous session, silently
 * orphaning the just-created real account. Awaiting the same in-flight
 * bootstrap promise before touching auth.currentUser closes the race.
 */
export async function waitForInitialAuthBootstrap(): Promise<void> {
    if (_bootstrapPromise) await _bootstrapPromise;
}

type IdentifierKind = 'email' | 'username';

function friendlyAuthError(err: unknown, kind: IdentifierKind): string {
    const code = (err as { code?: string })?.code;
    switch (code) {
        case 'auth/email-already-in-use':
            return kind === 'username' ? 'That username is taken.' : 'An account already exists with that email.';
        case 'auth/invalid-email':
            return kind === 'username' ? 'Usernames can only use letters, numbers, and underscores.' : 'Enter a valid email address.';
        case 'auth/weak-password':
            return kind === 'username' ? 'PIN must be exactly 6 digits.' : 'Password must be at least 6 characters.';
        case 'auth/wrong-password':
        case 'auth/user-not-found':
        case 'auth/invalid-credential':
            return kind === 'username' ? 'Incorrect username or PIN.' : 'Incorrect email or password.';
        case 'auth/operation-not-allowed':
            return 'Sign-in isn\'t enabled yet — contact support.';
        default:
            return 'Something went wrong. Please try again.';
    }
}

// ─── Identifier-agnostic core: both email and username accounts are backed by
// Firebase's email/password provider. A username account uses a synthetic
// "{username}@accessbelt.local" address so Firebase's real password hashing,
// rate-limiting, and uniqueness checks apply exactly as they do for email
// accounts — no separate/less-secure verification path.
const USERNAME_DOMAIN = '@accessbelt.local';

export function isValidUsername(username: string): boolean {
    return /^[a-z0-9_]{3,20}$/i.test(username.trim());
}

export function isValidPin(pin: string): boolean {
    return /^\d{6}$/.test(pin);
}

function usernameToIdentifier(username: string): string {
    return `${username.trim().toLowerCase()}${USERNAME_DOMAIN}`;
}

async function linkOrCreate(identifier: string, secret: string, kind: IdentifierKind): Promise<{ ok: boolean; error?: string }> {
    await waitForInitialAuthBootstrap();
    try {
        if (auth.currentUser?.isAnonymous) {
            await linkWithCredential(auth.currentUser, EmailAuthProvider.credential(identifier, secret));
        } else {
            await createUserWithEmailAndPassword(auth, identifier, secret);
        }
        await reestablishSession();
        return { ok: true };
    } catch (err) {
        return { ok: false, error: friendlyAuthError(err, kind) };
    }
}

async function signInWithIdentifier(identifier: string, secret: string, kind: IdentifierKind): Promise<{ ok: boolean; error?: string }> {
    await waitForInitialAuthBootstrap();
    try {
        await signInWithEmailAndPassword(auth, identifier, secret);
        await reestablishSession();
        return { ok: true };
    } catch (err) {
        return { ok: false, error: friendlyAuthError(err, kind) };
    }
}

/**
 * signUpWithEmail() / signInWithEmail()
 * Links the current anonymous identity to a real email/password credential
 * when possible, preserving the uid (and every Firestore doc keyed by it —
 * user_profiles, _app_sessions) instead of starting a fresh account.
 */
export async function signUpWithEmail(email: string, password: string): Promise<{ ok: boolean; error?: string }> {
    return linkOrCreate(email, password, 'email');
}

export async function signInWithEmail(email: string, password: string): Promise<{ ok: boolean; error?: string }> {
    return signInWithIdentifier(email, password, 'email');
}

/**
 * signUpWithUsername() / signInWithUsername()
 * Same linking behavior as the email path, for people who'd rather not use
 * an email address — a username + 6-digit PIN, stored as a synthetic email
 * under the hood so it's still protected by Firebase's real auth security.
 */
export async function signUpWithUsername(username: string, pin: string): Promise<{ ok: boolean; error?: string }> {
    if (!isValidUsername(username)) {
        return { ok: false, error: 'Username must be 3-20 letters, numbers, or underscores.' };
    }
    if (!isValidPin(pin)) {
        return { ok: false, error: 'PIN must be exactly 6 digits.' };
    }
    return linkOrCreate(usernameToIdentifier(username), pin, 'username');
}

export async function signInWithUsername(username: string, pin: string): Promise<{ ok: boolean; error?: string }> {
    if (!isValidUsername(username) || !isValidPin(pin)) {
        return { ok: false, error: 'Incorrect username or PIN.' };
    }
    return signInWithIdentifier(usernameToIdentifier(username), pin, 'username');
}

/**
 * getAccountLabel()
 * UI-facing display value for the signed-in account, or null if anonymous.
 * Username accounts are stored as a synthetic email — surface them as
 * "@username" rather than leaking the "@accessbelt.local" implementation detail.
 */
export function getAccountLabel(): string | null {
    if (!auth.currentUser || auth.currentUser.isAnonymous) return null;
    const email = auth.currentUser.email;
    if (!email) return null;
    return email.endsWith(USERNAME_DOMAIN) ? '@' + email.slice(0, -USERNAME_DOMAIN.length) : email;
}

/**
 * subscribeToAccountLabel()
 * Reactive counterpart to getAccountLabel() — screens that display account
 * status should use this (via AuthReadyContext) instead of re-deriving the
 * label on focus. A focus-only read can go stale or read too early: if a
 * screen mounts before Firebase's persisted session has finished restoring,
 * a one-time getAccountLabel() call freezes on "anonymous" until the next
 * focus event, even after the real session resolves moments later. This
 * subscribes to every auth state transition so the UI can never drift from
 * the SDK's actual state. Returns the unsubscribe function.
 */
export function subscribeToAccountLabel(callback: (label: string | null) => void): () => void {
    return onAuthStateChanged(auth, () => callback(getAccountLabel()));
}

/**
 * deleteAccount()
 * Permanently deletes the signed-in real account — required by App Store
 * Guideline 5.1.1(v) (apps that support account creation must offer in-app
 * account deletion). Removes the user_profiles/{uid} demographic doc first
 * (once the auth record is gone there's no token left that can delete it),
 * then the Firebase Auth record, then re-establishes a fresh anonymous
 * identity so the app is never left without a signed-in user.
 */
export async function deleteAccount(): Promise<{ ok: boolean; error?: string }> {
    const user = auth.currentUser;
    if (!user || user.isAnonymous) {
        return { ok: false, error: 'No account to delete.' };
    }

    // Best-effort: the profile doc may not exist, or the rules deploy may lag —
    // never let this block the auth-record deletion itself.
    try {
        await deleteDoc(doc(db, 'user_profiles', user.uid));
    } catch (err) {
        console.warn('[Security] Profile doc cleanup failed during account deletion:', err);
    }

    try {
        await deleteUser(user);
    } catch (err) {
        const code = (err as { code?: string })?.code;
        if (code === 'auth/requires-recent-login') {
            return {
                ok: false,
                error: 'For security, please sign out, sign back in, and then delete your account.',
            };
        }
        return { ok: false, error: 'Could not delete your account. Check your connection and try again.' };
    }

    await reestablishSession();
    return { ok: true };
}

/**
 * signOutUser()
 * Signs out of the real account and immediately re-establishes a fresh
 * anonymous identity — Firestore rules require isAuthed() everywhere, so
 * the app must never be left without some signed-in user.
 */
export async function signOutUser(): Promise<void> {
    try {
        await firebaseSignOut(auth);
    } catch (err) {
        console.warn('[Security] Sign out failed:', err);
        throw err;
    }
    await reestablishSession();
}
