/**
 * analytics.ts
 *
 * Centralized, silent analytics helpers for PantryBelt.
 * All functions are fire-and-forget — they never throw or block the UI.
 *
 * Firestore collections used:
 *   analytics_user_counties/{docId}   — one doc per session; county the user is in
 *   analytics_searches/{docId}        — one doc per Pete query (enriched)
 *   analytics_food_deserts/{docId}    — one doc when user location has no pantries nearby
 */

import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';

// ─── 0. Session Counter ───────────────────────────────────────────────────────
/**
 * Log one anonymous app launch to analytics_sessions.
 * Called once from _layout.tsx on mount — no user data, timestamp only.
 */
export async function logUserSession(): Promise<void> {
    try {
        await addDoc(collection(db, 'analytics_sessions'), {
            timestamp: serverTimestamp(),
        });
    } catch {
        // Silent
    }
}

// ─── 1. User County ───────────────────────────────────────────────────────────
/**
 * Log the county the user is browsing from.
 * Called from the map screen after pantries are loaded (county inferred from
 * the nearest pantry cluster) or when the user taps a county filter chip.
 *
 * @param county  - County name (e.g. "Dallas County")
 * @param city    - City name if known (e.g. "Selma"), otherwise null
 * @param source  - How county was determined: 'location' | 'filter_tap' | 'inferred'
 */
export async function logUserCounty(
    county: string,
    city: string | null,
    source: 'location' | 'filter_tap' | 'inferred'
): Promise<void> {
    try {
        await addDoc(collection(db, 'analytics_user_counties'), {
            county,
            city: city ?? null,
            source,
            timestamp: serverTimestamp(),
        });
    } catch {
        // Silent — analytics must never crash the app
    }
}

// ─── 2. Pete AI Requests ──────────────────────────────────────────────────────
/**
 * Log a user query sent to Pantry Pete.
 * Enriches the existing analytics_searches collection with the raw message
 * and whether it came from a quick-chip tap or manual typing.
 *
 * @param topic       - Detected topic bucket (e.g. 'snap_ebt', 'recipes')
 * @param rawMessage  - The actual text the user sent
 * @param source      - 'chip' if quick button tapped, 'typed' if manually entered
 * @param county      - County context if known, otherwise null
 */
export async function logPeteRequest(
    topic: string,
    rawMessage: string,
    source: 'chip' | 'typed',
    county: string | null = null
): Promise<void> {
    try {
        await addDoc(collection(db, 'analytics_searches'), {
            topic,
            rawMessage: rawMessage.substring(0, 300), // cap at 300 chars — no PII risk
            source,
            county: county ?? null,
            timestamp: serverTimestamp(),
        });
    } catch {
        // Silent
    }
}

// ─── 3. Food Desert Detection ─────────────────────────────────────────────────
/**
 * Log when a user's current location area has no food pantries nearby.
 * Only called when pantry count within ~30 miles resolves to 0.
 *
 * Coordinates are rounded to 2 decimal places (~1.1 km precision)
 * to protect user privacy, consistent with the app's "no personal info" promise.
 *
 * @param lat         - User latitude (will be coarsened before saving)
 * @param lng         - User longitude (will be coarsened before saving)
 * @param county      - County name if determinable, otherwise null
 * @param city        - City name if determinable, otherwise null
 * @param pantryCount - Number of pantries found (0 for desert events)
 */
export async function logFoodDesert(
    lat: number,
    lng: number,
    county: string | null,
    city: string | null,
    pantryCount: number
): Promise<void> {
    try {
        // Coarsen to 2 decimal places (~1.1 km grid) to anonymize location
        const coarseLat = Math.round(lat * 100) / 100;
        const coarseLng = Math.round(lng * 100) / 100;

        await addDoc(collection(db, 'analytics_food_deserts'), {
            lat: coarseLat,
            lng: coarseLng,
            county: county ?? null,
            city: city ?? null,
            pantryCount,
            timestamp: serverTimestamp(),
        });
    } catch {
        // Silent
    }
}
