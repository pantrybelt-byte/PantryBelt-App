/**
 * utils/userProfile.ts — Optional demographic profile (age, family size, zip)
 *
 * Keyed by the anonymous Firebase uid (see utils/auth.ts), same upsert
 * convention as _app_sessions/{uid}. Unlike the fire-and-forget analytics
 * writes, save/get here surface success/failure since this is a
 * user-initiated action that needs UI feedback.
 *
 * SECURITY: contactEmail is the one identity-linked field here, and it is never
 * written to Firestore as plaintext — saveUserProfile() routes it through the
 * encryptUserField Cloud Function, which encrypts it with a GCP Cloud KMS key
 * and stores only the ciphertext (`contactEmail_encrypted`). It is write-only
 * from the client's point of view: there is no decrypt callable, so
 * getUserProfile() will always return contactEmail as null. Screens must treat
 * an empty contactEmail as "already saved", not as "never set".
 *
 * zipCode is stored PLAINTEXT on purpose. It is the input to county derivation,
 * and county is the only geographic granularity we retain (OA §6.5). Encrypting
 * it would break the food-desert and user-county analytics it exists to feed.
 * See the ENCRYPTABLE_FIELDS comment in functions/src/index.ts.
 */

import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../config/firebase';
import { getCurrentUid } from './auth';
import { recordError } from './monitoring';

export const RACE_OPTIONS = [
    { value: 'american_indian_alaska_native', label: 'American Indian / Alaska Native' },
    { value: 'asian', label: 'Asian' },
    { value: 'black_african_american', label: 'Black / African American' },
    { value: 'native_hawaiian_pacific_islander', label: 'Native Hawaiian / Pacific Islander' },
    { value: 'white', label: 'White' },
    { value: 'hispanic_latino', label: 'Hispanic / Latino' },
    { value: 'two_or_more', label: 'Two or more races' },
    { value: 'other', label: 'Other' },
    { value: 'prefer_not_to_say', label: 'Prefer not to say' },
] as const;

export type RaceValue = typeof RACE_OPTIONS[number]['value'];

export type UserProfileInput = {
    age: number; // 13-120
    familySize: number; // 1-20
    zipCode: string; // 5-digit, kept as a string to preserve leading zeros
    race?: RaceValue | null;
    contactEmail?: string | null; // optional, not a login credential
    pushToken?: string | null;
    newsletter?: boolean; // Profile -> Newsletter toggle opt-in
};

// Fields routed through the encryptUserField Cloud Function (KMS-encrypted at rest).
// They are NEVER written to Firestore as plaintext by the client.
// Must stay in sync with ENCRYPTABLE_FIELDS in functions/src/index.ts — the
// function rejects anything not in its own allowlist.
type EncryptedField = 'contactEmail';

const encryptUserFieldFn = httpsCallable<
    { field: string; plaintext: string },
    { ok: boolean }
>(functions, 'encryptUserField');

/**
 * Encrypt a single sensitive field via the Cloud Function.
 * Returns silently on success; throws on error.
 */
async function encryptField(field: EncryptedField, value: string): Promise<void> {
    const result = await encryptUserFieldFn({ field, plaintext: value });
    if (!result.data?.ok) {
        throw new Error(`encryptUserField returned non-ok for field "${field}"`);
    }
}

export async function saveUserProfile(input: UserProfileInput): Promise<{ ok: boolean; error?: string }> {
    const uid = getCurrentUid();
    if (!uid) return { ok: false, error: 'Not signed in yet — try again in a moment.' };

    // Strip contactEmail from the direct write — it goes through KMS instead.
    // Everything else, zipCode included, is written plaintext.
    const { contactEmail, ...plainFields } = input;

    // Step 1: the plaintext document. If this fails nothing has been written,
    // so the caller can safely retry the whole save.
    try {
        await setDoc(
            doc(db, 'user_profiles', uid),
            { ...plainFields, updatedAt: serverTimestamp() },
            { merge: true }
        );
    } catch (err) {
        recordError(err, 'saveUserProfile:plaintext');
        return { ok: false, error: 'Could not save — check your connection.' };
    }

    // Step 2: the encrypted field, if the user supplied one. This is a separate
    // round trip through a Cloud Function, so it can fail on its own after
    // step 1 already committed. Reporting that as a flat failure would be a lie
    // the user acts on by re-entering everything — the demographics ARE saved.
    // Report the partial state precisely instead.
    if (contactEmail) {
        try {
            await encryptField('contactEmail', contactEmail);
        } catch (err) {
            recordError(err, 'saveUserProfile:encrypt');
            return {
                ok: false,
                error: 'Your profile was saved, but we could not store your email securely. Please try adding it again.',
            };
        }
    }

    return { ok: true };
}

export async function updatePushToken(pushToken: string | null): Promise<{ ok: boolean }> {
    const uid = getCurrentUid();
    if (!uid) return { ok: false };

    try {
        await setDoc(doc(db, 'user_profiles', uid), { pushToken, updatedAt: serverTimestamp() }, { merge: true });
        return { ok: true };
    } catch {
        return { ok: false };
    }
}

export async function updateNewsletterOptIn(newsletter: boolean): Promise<{ ok: boolean }> {
    const uid = getCurrentUid();
    if (!uid) return { ok: false };

    try {
        await setDoc(doc(db, 'user_profiles', uid), { newsletter, updatedAt: serverTimestamp() }, { merge: true });
        return { ok: true };
    } catch {
        return { ok: false };
    }
}

export async function getUserProfile(): Promise<UserProfileInput | null> {
    const uid = getCurrentUid();
    if (!uid) return null;

    try {
        const snap = await getDoc(doc(db, 'user_profiles', uid));
        return snap.exists() ? (snap.data() as UserProfileInput) : null;
    } catch {
        return null;
    }
}
