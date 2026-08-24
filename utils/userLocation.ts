/**
 * utils/userLocation.ts — Shared county context for analytics
 *
 * map.tsx is the only screen that ever learns the user's county (via GPS or
 * city-filter tap). Home/Pete/Profile fire referral & emergency analytics but
 * had no way to know the county, so every SNAP/WIC/211 referral was logged
 * with county: null and bucketed into a single 'statewide' monthly-summary
 * doc — making two of the eight government-contract metrics impossible to
 * break out per county. This persists the last-known county so any screen
 * can attach it to its analytics writes.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const COUNTY_KEY = '@pb_last_known_county';
const PENDING_SEARCH_KEY = '@pb_pending_search_outcome';
const PENDING_WINDOW_MS = 30 * 60 * 1000; // 30 minutes

export async function setLastKnownCounty(county: string | null | undefined): Promise<void> {
    if (!county) return;
    try {
        await AsyncStorage.setItem(COUNTY_KEY, county);
    } catch {
        // Silent — county attribution is best-effort
    }
}

/** Returns the last county we inferred for this device, or null if unknown. */
export async function getLastKnownCounty(): Promise<string | null> {
    try {
        return await AsyncStorage.getItem(COUNTY_KEY);
    } catch {
        return null;
    }
}

type PendingSearch = { topic: string; ts: number };

/**
 * Marks a Pete search as awaiting an outcome (GAP 7 — Search-to-Success Rate).
 * Cleared by consumePendingSearchOutcome() once the user follows through.
 */
export async function setPendingSearchOutcome(topic: string): Promise<void> {
    try {
        const payload: PendingSearch = { topic, ts: Date.now() };
        await AsyncStorage.setItem(PENDING_SEARCH_KEY, JSON.stringify(payload));
    } catch {
        // Silent
    }
}

/** Peeks the pending search topic without clearing it (expires after 30 min). */
export async function getPendingSearchOutcome(): Promise<string | null> {
    try {
        const raw = await AsyncStorage.getItem(PENDING_SEARCH_KEY);
        if (!raw) return null;
        const { topic, ts }: PendingSearch = JSON.parse(raw);
        if (Date.now() - ts > PENDING_WINDOW_MS) {
            await AsyncStorage.removeItem(PENDING_SEARCH_KEY);
            return null;
        }
        return topic;
    } catch {
        return null;
    }
}

export async function clearPendingSearchOutcome(): Promise<void> {
    try {
        await AsyncStorage.removeItem(PENDING_SEARCH_KEY);
    } catch {
        // Silent
    }
}
