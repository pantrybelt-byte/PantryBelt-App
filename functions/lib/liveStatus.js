/**
 * Pure helpers for live status and broadcasts. No Firebase imports, so they
 * can be unit-tested with `node --test` (functions/test/).
 */

const TIME_ZONE = 'America/Chicago';
const FALLBACK_HOURS = 6;
const STATES = ['open', 'closed', 'closing_early', 'emergency_closed'];

/** Wall-clock parts of `date` in Alabama's time zone. */
function centralParts(date) {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: TIME_ZONE,
        weekday: 'long', year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
    }).formatToParts(date);
    const get = (type) => parts.find((p) => p.type === type).value;
    return {
        weekday: get('weekday').toLowerCase(),
        year: Number(get('year')),
        month: Number(get('month')),
        day: Number(get('day')),
        hour: Number(get('hour')),
        minute: Number(get('minute')),
        second: Number(get('second')),
    };
}

/** The UTC instant at which Central wall-clock time reads y-m-d h:m. */
function centralToUtc(year, month, day, hour, minute) {
    const guess = Date.UTC(year, month - 1, day, hour, minute);
    // Offset of Central from UTC at that moment (DST-aware), in ms.
    const p = centralParts(new Date(guess));
    const asIfUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
    return new Date(guess - (asIfUtc - guess));
}

/**
 * "17:00", "5:00 PM", "5pm", "5:30 p.m." -> { hour, minute } (24h), or null.
 */
function parseClockTime(value) {
    if (typeof value !== 'string') return null;
    const m = value.trim().toLowerCase().match(/^(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)?$/);
    if (!m) return null;
    let hour = Number(m[1]);
    const minute = m[2] ? Number(m[2]) : 0;
    const meridiem = m[3] ? m[3][0] : null;
    if (minute > 59) return null;
    if (meridiem) {
        if (hour < 1 || hour > 12) return null;
        if (meridiem === 'p' && hour !== 12) hour += 12;
        if (meridiem === 'a' && hour === 12) hour = 0;
    } else if (hour > 23) {
        return null;
    }
    return { hour, minute };
}

/**
 * When a live status stops applying and the app falls back to the posted
 * schedule: today's posted closing time if the pantry has structured hours
 * and that time is still ahead, otherwise FALLBACK_HOURS after `now`.
 */
function computeExpiry(hours, now = new Date()) {
    const fallback = new Date(now.getTime() + FALLBACK_HOURS * 3_600_000);
    if (!hours || typeof hours !== 'object') return fallback;

    const today = centralParts(now);
    const entry = hours[today.weekday];
    if (!entry || typeof entry !== 'object' || entry.closed) return fallback;

    const close = parseClockTime(entry.close);
    if (!close) return fallback;

    const closesAt = centralToUtc(today.year, today.month, today.day, close.hour, close.minute);
    return closesAt.getTime() > now.getTime() ? closesAt : fallback;
}

/** Operator liveStatus doc -> the public subset copied onto agencies. */
function toPublicLiveStatus(source, expiresAt) {
    if (!source || !STATES.includes(source.state)) return null;
    return {
        state: source.state,
        isOpen: source.state === 'open' || source.state === 'closing_early',
        note: typeof source.note === 'string' ? source.note.slice(0, 280) : '',
        waitMinutes: Number.isInteger(source.waitMinutes) ? source.waitMinutes : null,
        updatedAt: source.updatedAt ?? null,
        expiresAt,
    };
}

/** Operator broadcast + its agency -> the public (default)/broadcasts doc. */
function toPublicBroadcast(source, agency, pantryId) {
    const doc = {
        pantryId,
        pantryName: agency.name ?? '',
        county: agency.county ?? '',
        title: source.title,
        message: source.message,
        language: source.language ?? 'English',
        priority: source.priority,
        createdAt: source.createdAt ?? null,
        expiresAt: source.expiresAt,
    };
    if (typeof source.spanishMessage === 'string' && source.spanishMessage.length > 0) {
        doc.spanishMessage = source.spanishMessage;
    }
    return doc;
}

/** Shallow equality that compares Firestore Timestamps by value. */
function sameDoc(a, b) {
    if (!a || !b) return false;
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const key of keys) {
        const x = a[key];
        const y = b[key];
        if (x && y && typeof x.toMillis === 'function' && typeof y.toMillis === 'function') {
            if (x.toMillis() !== y.toMillis()) return false;
        } else if (x !== y) {
            return false;
        }
    }
    return true;
}

// ── Geohash (precision 9), same algorithm as the portal's encodeGeohash ──
const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';
function encodeGeohash(lat, lng, precision = 9) {
    let latRange = [-90, 90];
    let lngRange = [-180, 180];
    let hash = '';
    let bit = 0;
    let ch = 0;
    let even = true;
    while (hash.length < precision) {
        const range = even ? lngRange : latRange;
        const value = even ? lng : lat;
        const mid = (range[0] + range[1]) / 2;
        if (value >= mid) {
            ch |= 1 << (4 - bit);
            range[0] = mid;
        } else {
            range[1] = mid;
        }
        even = !even;
        if (bit < 4) {
            bit++;
        } else {
            hash += BASE32[ch];
            bit = 0;
            ch = 0;
        }
    }
    return hash;
}

module.exports = {
    STATES,
    centralParts,
    centralToUtc,
    parseClockTime,
    computeExpiry,
    toPublicLiveStatus,
    toPublicBroadcast,
    sameDoc,
    encodeGeohash,
};
