/**
 * utils/broadcasts.ts — Urgent pantry alerts for the map banner.
 *
 * Operators draft broadcasts in the portal; the syncBroadcast Cloud Function
 * publishes them to (default)/broadcasts with the pantry's county. The app
 * asks only for its own county, the one map.tsx already inferred, so the
 * user's location never leaves the phone (Operating Agreement §6.5).
 * Only 'urgent' broadcasts become the banner.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { collection, getDocs, query, Timestamp, where } from 'firebase/firestore';
import { db } from '../config/firebase';

export interface UrgentBroadcast {
    id: string;
    pantryId: string;
    pantryName: string;
    county: string;
    title: string;
    message: string;
    createdAt: Date | null;
    expiresAt: Date;
}

const DISMISSED_KEY = 'accessbelt_dismissed_broadcasts';
const MAX_DISMISSED = 50;

async function getDismissed(): Promise<string[]> {
    try {
        const raw = await AsyncStorage.getItem(DISMISSED_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed.filter((v) => typeof v === 'string') : [];
    } catch {
        return [];
    }
}

/** Remembers a dismissal on this device so the banner doesn't come back. */
export async function dismissBroadcast(id: string): Promise<void> {
    try {
        const dismissed = await getDismissed();
        const next = [id, ...dismissed.filter((d) => d !== id)].slice(0, MAX_DISMISSED);
        await AsyncStorage.setItem(DISMISSED_KEY, JSON.stringify(next));
    } catch {
        // Non-fatal: the banner may simply reappear on the next visit.
    }
}

/** The newest unexpired, undismissed urgent broadcast in `county`, or null. */
export async function fetchUrgentBroadcast(county: string): Promise<UrgentBroadcast | null> {
    const now = new Date();
    const [snapshot, dismissed] = await Promise.all([
        getDocs(query(
            collection(db, 'broadcasts'),
            where('county', '==', county),
            where('priority', '==', 'urgent'),
            where('expiresAt', '>', Timestamp.fromDate(now)),
        )),
        getDismissed(),
    ]);

    const items: UrgentBroadcast[] = snapshot.docs
        .filter((d) => !dismissed.includes(d.id))
        .map((d) => {
            const r = d.data();
            return {
                id: d.id,
                pantryId: String(r.pantryId ?? ''),
                pantryName: String(r.pantryName ?? ''),
                county: String(r.county ?? ''),
                title: String(r.title ?? ''),
                message: String(r.message ?? ''),
                createdAt: r.createdAt instanceof Timestamp ? r.createdAt.toDate() : null,
                expiresAt: (r.expiresAt as Timestamp).toDate(),
            };
        });

    items.sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0));
    return items[0] ?? null;
}

export interface PantryAlert {
    id: string;
    title: string;
    message: string;
    priority: 'urgent' | 'important';
}

/** Current urgent and important alerts for one pantry, newest first, for its detail sheet. */
export async function fetchPantryAlerts(pantryId: string): Promise<PantryAlert[]> {
    const snapshot = await getDocs(query(
        collection(db, 'broadcasts'),
        where('pantryId', '==', pantryId),
        where('expiresAt', '>', Timestamp.fromDate(new Date())),
    ));
    return snapshot.docs
        .map((d) => ({ id: d.id, ...d.data() } as Record<string, unknown> & { id: string }))
        .filter((r) => r.priority === 'urgent' || r.priority === 'important')
        .sort((a, b) => ((b.createdAt as Timestamp | undefined)?.toMillis() ?? 0) - ((a.createdAt as Timestamp | undefined)?.toMillis() ?? 0))
        .map((r) => ({
            id: r.id,
            title: String(r.title ?? ''),
            message: String(r.message ?? ''),
            priority: r.priority as PantryAlert['priority'],
        }));
}
