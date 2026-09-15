/**
 * utils/pantries.ts — Shared live Firestore pantry lookup
 *
 * Used by both the Map tab and Pete so pantry-search answers always reflect
 * the current `agencies` collection instead of a hardcoded list that drifts
 * out of date as pantries open, close, or move.
 */

import { collection, getDocs, limit, query, where } from 'firebase/firestore';
import { db } from '../config/firebase';
import { computeMapEligible, sanitizeWebsite } from './mapEligibility';

export const ALABAMA_COUNTIES = [
    'Autauga', 'Baldwin', 'Barbour', 'Bibb', 'Blount', 'Bullock', 'Butler',
    'Calhoun', 'Chambers', 'Cherokee', 'Chilton', 'Choctaw', 'Clarke', 'Clay',
    'Cleburne', 'Coffee', 'Colbert', 'Conecuh', 'Coosa', 'Covington',
    'Crenshaw', 'Cullman', 'Dale', 'Dallas', 'DeKalb', 'Elmore', 'Escambia',
    'Etowah', 'Fayette', 'Franklin', 'Geneva', 'Greene', 'Hale', 'Henry',
    'Houston', 'Jackson', 'Jefferson', 'Lamar', 'Lauderdale', 'Lawrence',
    'Lee', 'Limestone', 'Lowndes', 'Macon', 'Madison', 'Marengo', 'Marion',
    'Marshall', 'Mobile', 'Monroe', 'Montgomery', 'Morgan', 'Perry',
    'Pickens', 'Pike', 'Randolph', 'Russell', 'St. Clair', 'Shelby',
    'Sumter', 'Talladega', 'Tallapoosa', 'Tuscaloosa', 'Walker',
    'Washington', 'Wilcox', 'Winston',
] as const;

export type AlabamaCounty = (typeof ALABAMA_COUNTIES)[number];

export type CountyTierType = 'urban' | 'micropolitan' | 'rural';

export interface CountyTierConfig {
    tier: CountyTierType;
    nearbyRadiusMiles: number;
    desertThresholdMiles: number;
}

// Urban counties (Metropolitan core centers): Jefferson, Madison, Mobile, Montgomery, Shelby, Tuscaloosa
export const URBAN_COUNTIES = new Set<string>([
    'Jefferson', 'Madison', 'Mobile', 'Montgomery', 'Shelby', 'Tuscaloosa',
]);

// Micropolitan / Suburban counties
export const MICROPOLITAN_COUNTIES = new Set<string>([
    'Baldwin', 'Calhoun', 'Cullman', 'Dale', 'DeKalb', 'Elmore',
    'Etowah', 'Houston', 'Lauderdale', 'Lee', 'Limestone', 'Marshall',
    'Morgan', 'Russell', 'St. Clair', 'Talladega',
]);

export function getCountyTierConfig(county?: string | null): CountyTierConfig {
    if (!county) {
        return { tier: 'rural', nearbyRadiusMiles: 25, desertThresholdMiles: 15 };
    }
    if (URBAN_COUNTIES.has(county)) {
        return { tier: 'urban', nearbyRadiusMiles: 5, desertThresholdMiles: 3 };
    }
    if (MICROPOLITAN_COUNTIES.has(county)) {
        return { tier: 'micropolitan', nearbyRadiusMiles: 15, desertThresholdMiles: 10 };
    }
    return { tier: 'rural', nearbyRadiusMiles: 25, desertThresholdMiles: 15 };
}

export type DesertSeverity = 'none' | 'moderate' | 'severe' | 'critical';

export interface AdaptiveFoodDesertResult {
    isDesert: boolean;
    severity: DesertSeverity;
    closestPantry: PantryResult | null;
    closestDistanceMiles: number | null;
    pantriesInRadius: number;
    searchRadiusMiles: number;
    countyTier: CountyTierType;
    detectedCounty: string | null;
}

/**
 * Adaptive food desert evaluator:
 * Dynamically adjusts proximity thresholds depending on whether the user is in
 * an Urban (5 mi radius, 3 mi desert threshold), Micropolitan (15 mi radius, 10 mi desert threshold),
 * or Rural Black Belt county (25 mi radius, 15 mi desert threshold).
 */
export function evaluateAdaptiveFoodDesert<T extends { lat: number; lng: number; county?: string; city?: string; name?: string; mapEligible?: boolean }>(
    pantries: T[],
    userLat: number,
    userLng: number,
    preferredCounty?: string | null
): AdaptiveFoodDesertResult {
    const validPantries = pantries.filter(
        p => p.mapEligible !== false && p.lat !== 0 && p.lng !== 0 && !isNaN(p.lat) && !isNaN(p.lng)
    );

    let closest: T | null = null;
    let closestDist: number | null = null;

    for (const p of validPantries) {
        const d = distanceMiles(userLat, userLng, p.lat, p.lng);
        if (closestDist === null || d < closestDist) {
            closestDist = d;
            closest = p;
        }
    }

    const county = preferredCounty || closest?.county || null;
    const tierConfig = getCountyTierConfig(county);

    const pantriesInRadius = validPantries.filter(
        p => distanceMiles(userLat, userLng, p.lat, p.lng) <= tierConfig.nearbyRadiusMiles
    ).length;

    const isDesert = pantriesInRadius === 0 || (closestDist !== null && closestDist > tierConfig.desertThresholdMiles);

    let severity: DesertSeverity = 'none';
    if (isDesert) {
        if (closestDist === null || closestDist > tierConfig.desertThresholdMiles * 2.5) {
            severity = 'critical';
        } else if (closestDist > tierConfig.desertThresholdMiles * 1.5) {
            severity = 'severe';
        } else {
            severity = 'moderate';
        }
    }

    return {
        isDesert,
        severity,
        closestPantry: closest as PantryResult | null,
        closestDistanceMiles: closestDist,
        pantriesInRadius,
        searchRadiusMiles: tierConfig.nearbyRadiusMiles,
        countyTier: tierConfig.tier,
        detectedCounty: county,
    };
}

/** Matches free-text (e.g. a Pete chat message) against a known AL county name. */
export function extractCounty(text: string): string | null {
    const t = text.toLowerCase();
    for (const county of ALABAMA_COUNTIES) {
        if (t.includes(county.toLowerCase())) return county;
    }
    return null;
}

export type PantryResult = {
    id: string;
    name: string;
    county: string;
    city: string;
    phone: string;
    hours: string;
    address: string;
    website: string;
    verified: boolean;
    lat: number;
    lng: number;
    // Computed client-side at read time (utils/mapEligibility.ts) — never
    // written to Firestore. false when this doc's coordinates collide with
    // another doc's to 5 decimals, or fall outside its named county.
    mapEligible: boolean;
};

/** Great-circle distance in miles between two lat/lng points (haversine). */
export function distanceMiles(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 3958.8; // Earth radius in miles
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatHours(hours: Record<string, any> | string | null | undefined): string {
    if (!hours) return '';
    if (typeof hours === 'string') return hours;
    const labels: [string, string][] = [
        ['monday', 'Mon'], ['tuesday', 'Tue'], ['wednesday', 'Wed'],
        ['thursday', 'Thu'], ['friday', 'Fri'], ['saturday', 'Sat'], ['sunday', 'Sun'],
    ];
    const lines = labels
        .filter(([key]) => hours[key] && !hours[key].closed)
        .map(([key, abbr]) => `${abbr} ${hours[key].open}–${hours[key].close}`);
    return lines.length > 0 ? lines.join('  ·  ') : (hours.notes ?? '');
}

/**
 * Live query against `agencies` for active pantries in one Alabama county.
 * Returns [] (not an error) when the county has no active pantries — callers
 * must say so explicitly rather than falling back to invented results.
 */
export async function fetchPantriesByCounty(county: string, max = 8): Promise<PantryResult[]> {
    const q = query(
        collection(db, 'agencies'),
        where('status', '==', 'active'),
        where('county', '==', county),
        limit(max),
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => {
        const r = d.data();
        const addr = r.address ?? {};
        const coords = r.coordinates ?? {};
        return {
            id: d.id,
            name: r.name ?? '',
            county: r.county ?? county,
            city: addr.city ?? '',
            phone: r.phone ?? '',
            hours: formatHours(r.hours),
            address: [addr.street, addr.city, addr.state, addr.zip].filter(Boolean).join(', '),
            website: sanitizeWebsite(d.id, r.website ?? ''),
            verified: r.verified ?? false,
            lat: typeof coords.lat === 'number' ? coords.lat : 0,
            lng: typeof coords.lng === 'number' ? coords.lng : 0,
            mapEligible: computeMapEligible(d.id),
        };
    });
}

/**
 * Live query across every active `agencies` doc, sorted by distance from
 * (lat, lng) and capped to the nearest `max`. Coordinates are only ever used
 * in-memory for this sort — never persisted (claude.md §6.5: no precise
 * end-user location storage, county-level only). Fetches the full active
 * collection client-side, same pattern map.tsx already uses at this dataset
 * size — no geohash range query needed.
 */
export async function fetchNearestPantries(lat: number, lng: number, max = 8): Promise<PantryResult[]> {
    const q = query(collection(db, 'agencies'), where('status', '==', 'active'));
    const snapshot = await getDocs(q);
    const results: PantryResult[] = snapshot.docs.map(d => {
        const r = d.data();
        const addr = r.address ?? {};
        const coords = r.coordinates ?? {};
        return {
            id: d.id,
            name: r.name ?? '',
            county: r.county ?? '',
            city: addr.city ?? '',
            phone: r.phone ?? '',
            hours: formatHours(r.hours),
            address: [addr.street, addr.city, addr.state, addr.zip].filter(Boolean).join(', '),
            website: sanitizeWebsite(d.id, r.website ?? ''),
            verified: r.verified ?? false,
            lat: typeof coords.lat === 'number' ? coords.lat : 0,
            lng: typeof coords.lng === 'number' ? coords.lng : 0,
            mapEligible: computeMapEligible(d.id),
        };
    }).filter(p => p.lat !== 0 && p.lng !== 0 && !isNaN(p.lat) && !isNaN(p.lng));

    results.sort((a, b) => distanceMiles(lat, lng, a.lat, a.lng) - distanceMiles(lat, lng, b.lat, b.lng));
    return results.slice(0, max);
}
