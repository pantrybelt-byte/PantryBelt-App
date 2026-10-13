/**
 * utils/pantryDoc.ts — `agencies/{id}` document → the map screen's flat `Pantry`.
 *
 * Pure (no Firebase/React imports) so it can be unit-tested with node:test and
 * shared by the full-list fetch and the single-pantry live listener in
 * app/(tabs)/map.tsx, which must produce identical results.
 */

/** ADR-005's four Shift Mode states. */
export type LiveState = 'open' | 'closed' | 'closing_early' | 'emergency_closed';

export type LiveStatus = {
    /** Derived from isOpen when the portal wrote the original {isOpen, note} shape. */
    state: LiveState;
    isOpen: boolean;
    note: string;
    /** Minutes a family should expect to wait, or null when not reported. */
    waitMinutes: number | null;
    /** ms since epoch, or null when the server timestamp is still pending. */
    updatedAtMs: number | null;
    /** When the portal says the status stops applying (end of posted hours), or null. */
    expiresAtMs: number | null;
};

export const LIVE_STATUS_LABEL: Record<LiveState, string> = {
    open: 'Open now',
    closing_early: 'Closing early',
    closed: 'Closed today',
    emergency_closed: 'Closed: emergency',
};

const LIVE_STATES: LiveState[] = ['open', 'closed', 'closing_early', 'emergency_closed'];

export type Pantry = {
    id: string;
    name: string;
    city: string;
    county: string;
    lat: number;
    lng: number;
    phone: string;
    address: string;
    hours: string;
    eligibility: string;
    docs: string;
    website: string;
    verified: boolean;
    socialMedia: string[];
    operatorPortalAccess: boolean;
    hasMiniProfile: boolean;
    // Computed client-side at read time (utils/mapEligibility.ts) — never
    // written to Firestore. false when this doc's coordinates collide with
    // another doc's to 5 decimals, or fall outside its named county.
    mapEligible: boolean;
    // Operator-set open/closed state (Operator Portal → agencies.liveStatus).
    // Only shown while fresh — see isLiveStatusFresh().
    liveStatus: LiveStatus | null;
};

/** A "Open now" flag nobody has touched in half a day is more likely forgotten than true. */
export const LIVE_STATUS_MAX_AGE_MS = 12 * 60 * 60 * 1000;

/**
 * Whether to show a status at all. A status the portal gave an expiresAt
 * (end of that day's posted hours) applies until then; one without falls
 * back to the 12-hour rule. Either way it never outlives 12 hours.
 */
export function isLiveStatusFresh(ls: LiveStatus | null, nowMs: number): boolean {
    if (ls === null || ls.updatedAtMs === null) return false;
    const age = nowMs - ls.updatedAtMs;
    if (age < 0 || age >= LIVE_STATUS_MAX_AGE_MS) return false;
    return ls.expiresAtMs === null || nowMs < ls.expiresAtMs;
}

/** "Wait about 20 min  ·  Updated 9:42 AM" — only the parts that exist. */
export function describeLiveStatus(ls: LiveStatus): string {
    const parts: string[] = [];
    if (ls.isOpen && ls.waitMinutes !== null) {
        parts.push(ls.waitMinutes === 0 ? 'No wait' : `Wait about ${ls.waitMinutes} min`);
    }
    if (ls.updatedAtMs !== null) {
        parts.push(`Updated ${new Date(ls.updatedAtMs).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`);
    }
    return parts.join('  ·  ');
}

export function formatHours(hours: Record<string, any> | string | null | undefined): string {
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

function toMs(ts: any): number | null {
    return ts && typeof ts.toMillis === 'function' ? ts.toMillis()
        : typeof ts === 'number' ? ts
        : null;
}

function parseLiveStatus(raw: any): LiveStatus | null {
    if (!raw || typeof raw !== 'object' || typeof raw.isOpen !== 'boolean') return null;
    const state: LiveState = LIVE_STATES.includes(raw.state) ? raw.state : raw.isOpen ? 'open' : 'closed';
    return {
        state,
        isOpen: state === 'open' || state === 'closing_early',
        note: typeof raw.note === 'string' ? raw.note : '',
        waitMinutes: typeof raw.waitMinutes === 'number' ? raw.waitMinutes : null,
        updatedAtMs: toMs(raw.updatedAt),
        expiresAtMs: toMs(raw.expiresAt),
    };
}

export function docToPantry(
    id: string,
    r: Record<string, any>,
    helpers: { sanitizeWebsite: (id: string, url: string) => string; computeMapEligible: (id: string) => boolean },
): Pantry {
    const coords = r.coordinates ?? {};
    const addr = r.address ?? {};
    return {
        id,
        name:        r.name        ?? '',
        county:      r.county      ?? '',
        city:        addr.city     ?? '',
        lat:         typeof coords.lat === 'number' ? coords.lat : 0,
        lng:         typeof coords.lng === 'number' ? coords.lng : 0,
        phone:       r.phone       ?? '',
        website:     helpers.sanitizeWebsite(id, r.website ?? ''),
        address:     [addr.street, addr.city, addr.state, addr.zip].filter(Boolean).join(', '),
        eligibility: r.eligibilityNotes ?? '',
        docs:        Array.isArray(r.docsRequired) ? r.docsRequired.join(', ') : '',
        hours:       formatHours(r.hours),
        verified:    r.verified    ?? false,
        socialMedia: Array.isArray(r.socialMedia) ? r.socialMedia : [],
        operatorPortalAccess: r.operatorPortalAccess ?? false,
        hasMiniProfile: r.miniProfile != null,
        mapEligible: helpers.computeMapEligible(id),
        liveStatus:  parseLiveStatus(r.liveStatus),
    };
}
