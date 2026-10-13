/**
 * utils/liveStatus.ts — Live pantry status from the Operator Portal.
 *
 * Pantries using the portal report one of four states in Shift Mode. The
 * syncLiveStatus Cloud Function copies the latest one onto
 * agencies/{id}.liveStatus with an expiresAt (the end of today's posted
 * hours, else 6 hours later). After that the app falls back to the posted
 * schedule, so an old "Open now" never outlives the shift it described.
 */
import { collection, getDocs, query, Timestamp, where } from 'firebase/firestore';
import { db } from '../config/firebase';
import { COLORS } from '../theme/tokens';

export type LiveState = 'open' | 'closed' | 'closing_early' | 'emergency_closed';

export interface LiveStatus {
    state: LiveState;
    isOpen: boolean;
    note: string;
    waitMinutes: number | null;
    updatedAt: Date | null;
    expiresAt: Date;
}

const STATES: LiveState[] = ['open', 'closed', 'closing_early', 'emergency_closed'];

export const LIVE_STATUS_LABEL: Record<LiveState, string> = {
    open: 'Open now',
    closing_early: 'Closing early',
    closed: 'Closed today',
    emergency_closed: 'Closed: emergency',
};

/** Dot color only; the label is always set in the body text color for contrast. */
export const LIVE_STATUS_COLOR: Record<LiveState, string> = {
    open: COLORS.success,
    closing_early: COLORS.warning,
    closed: COLORS.danger,
    emergency_closed: COLORS.danger,
};

function toDate(value: unknown): Date | null {
    if (value instanceof Timestamp) return value.toDate();
    if (value && typeof (value as { toDate?: unknown }).toDate === 'function') {
        return (value as { toDate: () => Date }).toDate();
    }
    return null;
}

/** Firestore liveStatus map -> LiveStatus, or null if missing, malformed or expired. */
export function parseLiveStatus(raw: unknown, now: Date = new Date()): LiveStatus | null {
    if (!raw || typeof raw !== 'object') return null;
    const r = raw as Record<string, unknown>;
    if (!STATES.includes(r.state as LiveState)) return null;
    const expiresAt = toDate(r.expiresAt);
    if (!expiresAt || expiresAt.getTime() <= now.getTime()) return null;
    const state = r.state as LiveState;
    return {
        state,
        isOpen: state === 'open' || state === 'closing_early',
        note: typeof r.note === 'string' ? r.note : '',
        waitMinutes: typeof r.waitMinutes === 'number' ? r.waitMinutes : null,
        updatedAt: toDate(r.updatedAt),
        expiresAt,
    };
}

/** "Wait about 20 min · Updated 9:42 AM" — only the parts that exist. */
export function describeLiveStatus(status: LiveStatus): string {
    const parts: string[] = [];
    if (status.isOpen && status.waitMinutes !== null) {
        parts.push(status.waitMinutes === 0 ? 'No wait' : `Wait about ${status.waitMinutes} min`);
    }
    if (status.updatedAt) {
        parts.push(`Updated ${status.updatedAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`);
    }
    return parts.join('  ·  ');
}

/**
 * Current live statuses for every active pantry that has one. Cheap to call
 * on screen focus: it returns only the handful of pantries with a status
 * that hasn't expired, not all 884.
 */
export async function fetchActiveLiveStatuses(): Promise<Map<string, LiveStatus>> {
    const now = new Date();
    const snapshot = await getDocs(query(
        collection(db, 'agencies'),
        where('status', '==', 'active'),
        where('liveStatus.expiresAt', '>', Timestamp.fromDate(now)),
    ));
    const result = new Map<string, LiveStatus>();
    snapshot.forEach((d) => {
        const status = parseLiveStatus(d.data().liveStatus, now);
        if (status) result.set(d.id, status);
    });
    return result;
}
