/**
 * analytics.ts — AccessBelt Centralized Analytics
 *
 * All 8 government-contract metrics are tracked here.
 * Every function is fire-and-forget — never throws, never blocks the UI.
 *
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │  GAP  │ COLLECTION                    │ KEY CONCERN (Agency)            │
 * ├─────────────────────────────────────────────────────────────────────────┤
 * │   1   │ analytics_pantry_engagements  │ Successful Connections (USDA)   │
 * │   2   │ analytics_referrals           │ SNAP/WIC Referral Count (FNS)   │
 * │   3   │ analytics_referrals (type=211)│ Emergency Help Requests (CDC)   │
 * │   4   │ ALL collections (time fields) │ Time-of-Day Patterns (USDA/Co.) │
 * │   5   │ analytics_sessions            │ Return Sessions / Impact (All)  │
 * │   6   │ analytics_pantry_engagements  │ Pantry-Level Utilization (Co.)  │
 * │   7   │ analytics_search_outcomes     │ Search-to-Success Rate (HRSA)   │
 * │   8   │ analytics_monthly_summary     │ Monthly County Report (All)     │
 * └─────────────────────────────────────────────────────────────────────────┘
 *
 * Existing collections (already live):
 *   analytics_user_counties  — user county per session
 *   analytics_searches       — Pete AI queries (enriched)
 *   analytics_food_deserts   — zero-pantry location events
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { addDoc, collection, doc, increment, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { sanitizePII } from './gemini';

// ─── Shared: Time Fields ──────────────────────────────────────────────────────
// GAP 4 — Time-of-Day / Day-of-Week Patterns (USDA / County Governments)
// Added to EVERY analytics write so time-based queries work across all reports.
function timeFields() {
    const now = new Date();
    return {
        hourOfDay: now.getHours(),       // 0–23
        dayOfWeek: now.getDay(),         // 0=Sun … 6=Sat
        monthYear: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
    };
}

// ─── Shared: Anonymous Device ID ─────────────────────────────────────────────
// GAP 5 — used by logSession to detect return users (no personal data stored)
async function getDeviceId(): Promise<string> {
    const KEY = '@accessbelt_device_id';
    let id = await AsyncStorage.getItem(KEY);
    if (!id) {
        id = `anon_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
        await AsyncStorage.setItem(KEY, id);
    }
    return id;
}

// ─────────────────────────────────────────────────────────────────────────────
// GAP 5 — Return Session / Sustained Impact  (All Agencies)
// Collection: analytics_sessions
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Log one anonymous app session. Uses a stable device ID stored in
 * AsyncStorage so return visits can be counted without collecting any PII.
 * Called once from _layout.tsx on every app launch.
 */
export async function logSession(): Promise<void> {
    try {
        const deviceId = await getDeviceId();
        // Upsert a doc keyed by device ID — increments sessionCount each visit
        await setDoc(
            doc(db, 'analytics_sessions', deviceId),
            {
                sessionCount: increment(1),
                lastSeen: serverTimestamp(),
                ...timeFields(),
            },
            { merge: true }
        );
    } catch (err) {
        console.warn('[Analytics] logSession failed:', err);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// EXISTING — User County (enriched with time fields)
// Collection: analytics_user_counties
// ─────────────────────────────────────────────────────────────────────────────
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
            ...timeFields(),
        });
    } catch (err) {
        console.warn('[Analytics] logUserCounty failed:', err);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// EXISTING — Pete AI Requests (enriched with time fields)
// Collection: analytics_searches
// ─────────────────────────────────────────────────────────────────────────────
export async function logPeteRequest(
    topic: string,
    rawMessage: string,
    source: 'chip' | 'typed',
    county: string | null = null
): Promise<void> {
    try {
        // Sanitize before storage, not just before sending to Gemini — this is
        // our own database, and users in crisis sometimes type phone numbers,
        // addresses, or SSNs directly into the chat.
        await addDoc(collection(db, 'analytics_searches'), {
            topic,
            rawMessage: sanitizePII(rawMessage).substring(0, 300),
            source,
            county: county ?? null,
            timestamp: serverTimestamp(),
            ...timeFields(),
        });
    } catch (err) {
        console.warn('[Analytics] logPeteRequest failed:', err);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// EXISTING — Food Desert Detection (enriched with time fields)
// Collection: analytics_food_deserts
// ─────────────────────────────────────────────────────────────────────────────
export async function logFoodDesert(
    lat: number,
    lng: number,
    county: string | null,
    city: string | null,
    pantryCount: number
): Promise<void> {
    try {
        const coarseLat = Math.round(lat * 100) / 100;
        const coarseLng = Math.round(lng * 100) / 100;
        await addDoc(collection(db, 'analytics_food_deserts'), {
            lat: coarseLat,
            lng: coarseLng,
            county: county ?? null,
            city: city ?? null,
            pantryCount,
            timestamp: serverTimestamp(),
            ...timeFields(),
        });
    } catch (err) {
        console.warn('[Analytics] logFoodDesert failed:', err);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// GAP 1 + GAP 6 — Successful Connections + Pantry-Level Utilization
//                  (USDA, County Governments, DHR, Feeding America)
// Collection: analytics_pantry_engagements
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Log user interactions with a specific pantry.
 *
 * action types:
 *   'view'       — user opened the pantry detail modal (awareness)
 *   'directions' — user tapped "Directions" (likely visit intent)
 *   'call'       — user tapped to call the pantry (direct contact = strong signal)
 *   'website'    — user tapped "Visit Website"
 */
export async function logPantryEngagement(
    pantryId: string,
    pantryName: string,
    county: string,
    city: string,
    action: 'view' | 'directions' | 'call' | 'website'
): Promise<void> {
    try {
        await addDoc(collection(db, 'analytics_pantry_engagements'), {
            pantryId,
            pantryName,
            county,
            city,
            action,
            timestamp: serverTimestamp(),
            ...timeFields(),
        });
    } catch (err) {
        console.warn('[Analytics] logPantryEngagement failed:', err);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// GAP 2 + GAP 3 — SNAP/WIC Referral Count + Emergency Help Requests
//                  (USDA FNS, Alabama DHR, HRSA, CDC, County Emergency Mgmt)
// Collection: analytics_referrals
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Log when a user taps a government benefit or emergency link.
 *
 * referralType:
 *   'snap'          — SNAP/EBT application link tapped
 *   'wic'           — WIC program link tapped
 *   'emergency_211' — 211 emergency hotline called from app (GAP 3)
 *   'food_bank'     — Feeding America food bank finder link
 *   'school_meals'  — Free school meals benefit link
 *   'myplate'       — USDA nutrition guide
 *
 * source: which screen triggered the referral
 */
export async function logReferral(
    referralType: 'snap' | 'wic' | 'emergency_211' | 'food_bank' | 'school_meals' | 'myplate',
    source: 'home' | 'profile' | 'pete' | 'map',
    county: string | null = null
): Promise<void> {
    try {
        await addDoc(collection(db, 'analytics_referrals'), {
            referralType,
            source,
            county: county ?? null,
            // Flag emergency separately for CDC / emergency management reports
            isEmergency: referralType === 'emergency_211',
            timestamp: serverTimestamp(),
            ...timeFields(),
        });
    } catch (err) {
        console.warn('[Analytics] logReferral failed:', err);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// GAP 7 — Search-to-Success Rate  (USDA, HRSA)
// Collection: analytics_search_outcomes
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Log when a Pete search leads to a successful action — the user found
 * what they needed and followed through (opened map, called pantry, etc.).
 *
 * outcome:
 *   'map_opened'     — user navigated to the map after a Pete pantry search
 *   'pantry_viewed'  — user viewed a specific pantry after searching
 *   'no_action'      — session ended without any follow-up (unmet need signal)
 */
export async function logSearchOutcome(
    topic: string,
    outcome: 'map_opened' | 'pantry_viewed' | 'no_action',
    county: string | null = null
): Promise<void> {
    try {
        await addDoc(collection(db, 'analytics_search_outcomes'), {
            topic,
            outcome,
            county: county ?? null,
            success: outcome !== 'no_action',
            timestamp: serverTimestamp(),
            ...timeFields(),
        });
    } catch (err) {
        console.warn('[Analytics] logSearchOutcome failed:', err);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// GAP 8 — Monthly County Impact Summary  (All Agencies — Contract Deliverable)
// Collection: analytics_monthly_summary
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Upsert a monthly county summary doc — increments counters atomically.
 * Doc ID format: "YYYY-MM_CountyName" (e.g. "2026-07_Dallas County")
 *
 * Called by each other logX() function with its county + metric type so
 * the summary self-assembles from real usage with no separate Cloud Function needed.
 */
export async function updateMonthlySummary(
    county: string,
    field: 'sessions' | 'searches' | 'referrals' | 'emergencies' |
           'pantryViews' | 'directions' | 'calls' | 'foodDeserts'
): Promise<void> {
    if (!county) return;
    try {
        const monthYear = (() => {
            const n = new Date();
            return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`;
        })();
        const docId = `${monthYear}_${county.replace(/\s+/g, '_')}`;
        await setDoc(
            doc(db, 'analytics_monthly_summary', docId),
            {
                county,
                monthYear,
                [field]: increment(1),
                lastUpdated: serverTimestamp(),
            },
            { merge: true }
        );
    } catch (err) {
        console.warn('[Analytics] updateMonthlySummary failed:', err);
    }
}
