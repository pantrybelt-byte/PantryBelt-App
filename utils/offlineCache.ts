/**
 * utils/offlineCache.ts — Offline Pantry List helpers
 *
 * WHERE THE CACHE IS ACTUALLY ENABLED
 * ───────────────────────────────────
 * Firestore's persistent cache is configured in firebase.ts, in the same
 * initializeFirestore() call that creates the `db` singleton, because the JS
 * SDK requires localCache to be set at construction time. Once it is on,
 * getDocs() transparently serves from disk when offline — no call site changes.
 *
 * This file previously also exported initFirestoreOfflineCache(), which called
 * initializeFirestore() a second time. That could never succeed: firebase.ts
 * runs at import time, so by the time any screen called it the instance was
 * already started and the call threw "Firestore has already been started",
 * which the helper then swallowed. It was dead code that read like a safety
 * net, so it is gone. Do not re-add a second initializeFirestore() call.
 *
 * What remains are the pure helpers for the offline pantry list UI:
 *   - sortByCounty()     — alphabetical county grouping
 *   - sortByProximity()  — nearest-first when GPS is available
 *   - filterByCounty()   — single-county filter
 *
 * PRIVACY: sortByProximity() takes coordinates as arguments and computes
 * distance on-device. It must stay that way — precise user coordinates are
 * never persisted or transmitted (Operating Agreement §6.5); only county-level
 * geography leaves the device.
 */

// ─── Pantry sort/filter helpers ───────────────────────────────────────────────

export type OfflinePantry = {
    id: string;
    name: string;
    county: string;
    city: string;
    lat: number;
    lng: number;
    phone: string;
    address: string;
    hours: string;
};

/** Haversine distance in miles between two lat/lng pairs */
function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 3958.8; // Earth radius in miles
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Sort pantries alphabetically by county, then by name within each county */
export function sortByCounty(pantries: OfflinePantry[]): OfflinePantry[] {
    return [...pantries].sort((a, b) => {
        const county = a.county.localeCompare(b.county);
        return county !== 0 ? county : a.name.localeCompare(b.name);
    });
}

/**
 * Sort pantries by distance from a user location.
 * Falls back to county sort if no location is provided.
 */
export function sortByProximity(
    pantries: OfflinePantry[],
    userLat: number | null,
    userLng: number | null
): OfflinePantry[] {
    if (userLat === null || userLng === null) return sortByCounty(pantries);
    return [...pantries].sort(
        (a, b) =>
            haversine(userLat, userLng, a.lat, a.lng) -
            haversine(userLat, userLng, b.lat, b.lng)
    );
}

/** Filter to a single county (case-insensitive). Pass null for "All". */
export function filterByCounty<T extends { county: string }>(
    pantries: T[],
    county: string | null
): T[] {
    if (!county || county === 'All') return pantries;
    return pantries.filter(
        p => p.county.toLowerCase() === county.toLowerCase()
    );
}
