/**
 * utils/userProfile.ts — Optional demographic profile (age, family size, zip)
 *
 * Keyed by the anonymous Firebase uid (see utils/auth.ts), same upsert
 * convention as _app_sessions/{uid}. Unlike the fire-and-forget analytics
 * writes, save/get here surface success/failure since this is a
 * user-initiated action that needs UI feedback.
 */

import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { getCurrentUid } from './auth';

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
};

export async function saveUserProfile(input: UserProfileInput): Promise<{ ok: boolean; error?: string }> {
    const uid = getCurrentUid();
    if (!uid) return { ok: false, error: 'Not signed in yet — try again in a moment.' };

    try {
        await setDoc(doc(db, 'user_profiles', uid), { ...input, updatedAt: serverTimestamp() }, { merge: true });
        return { ok: true };
    } catch {
        return { ok: false, error: 'Could not save — check your connection.' };
    }
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
