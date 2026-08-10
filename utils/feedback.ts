/**
 * utils/feedback.ts — In-app feedback + bug report submission
 *
 * Writes to the `feedback` Firestore collection. Never throws and never
 * blocks the UI: a failed write is queued in AsyncStorage and retried on
 * the next app launch or next submission attempt.
 *
 * Also owns the "auto-prompt after 3rd session" gating so the rating
 * modal only ever surfaces once per session and respects a 7-day snooze.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { Platform } from 'react-native';
import { db } from '../config/firebase';

export type FeedbackCategory = 'Bug' | 'Pantry info wrong' | 'Feature request' | 'Other';

export type FeedbackInput = {
    rating: number; // 1-5
    category: FeedbackCategory;
    message: string;
    email: string | null;
    screenName: string;
};

type QueuedFeedback = FeedbackInput & {
    appVersion: string | null;
    buildNumber: string | null;
    platform: string;
    osVersion: string | null;
    deviceModel: string | null;
};

const QUEUE_KEY = '@pb_feedback_queue';
const SESSION_COUNT_KEY = '@pb_feedback_session_count';
const SNOOZE_UNTIL_KEY = '@pb_feedback_snooze_until';
const SUBMITTED_KEY = '@pb_feedback_submitted';
const SNOOZE_DAYS = 7;
const PROMPT_AFTER_SESSION = 3;

// Guards against showing the auto-prompt twice in one app launch.
let hasPromptedThisSession = false;

function deviceContext() {
    return {
        appVersion: Constants.expoConfig?.version ?? null,
        buildNumber:
            Platform.OS === 'ios'
                ? (Constants.expoConfig?.ios?.buildNumber ?? null)
                : (Constants.expoConfig?.android?.versionCode != null
                    ? String(Constants.expoConfig.android.versionCode)
                    : null),
        platform: Platform.OS,
        osVersion: Device.osVersion ?? null,
        deviceModel: Device.modelName ?? null,
    };
}

async function writeFeedback(payload: QueuedFeedback): Promise<void> {
    await addDoc(collection(db, 'feedback'), {
        rating: payload.rating,
        category: payload.category,
        message: payload.message,
        email: payload.email,
        appVersion: payload.appVersion,
        buildNumber: payload.buildNumber,
        platform: payload.platform,
        osVersion: payload.osVersion,
        deviceModel: payload.deviceModel,
        screenName: payload.screenName,
        createdAt: serverTimestamp(),
        status: 'new',
    });
}

async function readQueue(): Promise<QueuedFeedback[]> {
    try {
        const raw = await AsyncStorage.getItem(QUEUE_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
}

async function writeQueue(queue: QueuedFeedback[]): Promise<void> {
    try {
        await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    } catch {
        // Best-effort — if AsyncStorage itself is unavailable, the
        // submission is lost, but the UI is never blocked on it.
    }
}

/**
 * Submit feedback. Never throws. Returns whether the write went through
 * immediately or was queued for retry (e.g. offline).
 */
export async function submitFeedback(input: FeedbackInput): Promise<{ queued: boolean }> {
    // Best-effort: clear out anything from a previous offline session first.
    await flushFeedbackQueue();

    const payload: QueuedFeedback = { ...input, ...deviceContext() };

    try {
        await writeFeedback(payload);
        await AsyncStorage.setItem(SUBMITTED_KEY, 'true');
        return { queued: false };
    } catch (err) {
        console.warn('[Feedback] submit failed, queuing for retry:', err);
        const queue = await readQueue();
        queue.push(payload);
        await writeQueue(queue);
        await AsyncStorage.setItem(SUBMITTED_KEY, 'true');
        return { queued: true };
    }
}

/** Retries any queued feedback submissions. Safe to call anytime. */
export async function flushFeedbackQueue(): Promise<void> {
    const queue = await readQueue();
    if (queue.length === 0) return;

    const remaining: QueuedFeedback[] = [];
    for (const item of queue) {
        try {
            await writeFeedback(item);
        } catch {
            remaining.push(item);
        }
    }
    await writeQueue(remaining);
}

// ─── Auto-prompt gating ─────────────────────────────────────────────────────

/** Call once per app launch (after auth is ready) to bump the local session count. */
export async function incrementFeedbackSessionCount(): Promise<void> {
    try {
        const raw = await AsyncStorage.getItem(SESSION_COUNT_KEY);
        const count = raw ? parseInt(raw, 10) || 0 : 0;
        await AsyncStorage.setItem(SESSION_COUNT_KEY, String(count + 1));
    } catch {
        // Non-fatal — worst case the auto-prompt never fires this launch.
    }
}

/** Whether the auto rating-prompt should show right now. */
export async function shouldShowFeedbackPrompt(): Promise<boolean> {
    if (hasPromptedThisSession) return false;
    try {
        const [countRaw, snoozeRaw, submitted] = await Promise.all([
            AsyncStorage.getItem(SESSION_COUNT_KEY),
            AsyncStorage.getItem(SNOOZE_UNTIL_KEY),
            AsyncStorage.getItem(SUBMITTED_KEY),
        ]);
        const count = countRaw ? parseInt(countRaw, 10) || 0 : 0;
        if (count < PROMPT_AFTER_SESSION) return false;
        if (submitted === 'true') return false;
        if (snoozeRaw && Date.now() < parseInt(snoozeRaw, 10)) return false;
        return true;
    } catch {
        return false;
    }
}

/** Mark the auto-prompt as shown for this session (prevents a second showing). */
export function markFeedbackPromptShown(): void {
    hasPromptedThisSession = true;
}

/** "Not now" — snooze the auto-prompt for 7 days. */
export async function snoozeFeedbackPrompt(): Promise<void> {
    const until = Date.now() + SNOOZE_DAYS * 24 * 60 * 60 * 1000;
    try {
        await AsyncStorage.setItem(SNOOZE_UNTIL_KEY, String(until));
    } catch {
        // Non-fatal.
    }
}
