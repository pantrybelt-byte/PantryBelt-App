/**
 * utils/pantries.ts — Shared live Firestore pantry lookup
 *
 * Used by both the Map tab and Pete so pantry-search answers always reflect
 * the current `agencies` collection instead of a hardcoded list that drifts
 * out of date as pantries open, close, or move.
 */

import { collection, getDocs, limit, query, where } from 'firebase/firestore';
import { db } from '../config/firebase';

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
};

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
        return {
            id: d.id,
            name: r.name ?? '',
            county: r.county ?? county,
            city: addr.city ?? '',
            phone: r.phone ?? '',
            hours: formatHours(r.hours),
            address: [addr.street, addr.city, addr.state, addr.zip].filter(Boolean).join(', '),
            website: r.website ?? '',
            verified: r.verified ?? false,
        };
    });
}
