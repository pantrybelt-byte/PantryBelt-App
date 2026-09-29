/**
 * utils/appCheck.ts — Firebase App Check (JS SDK)
 *
 * Uses the Firebase JS SDK (firebase/app-check) with CustomProvider.
 * Safe to call more than once — memoized. Never throws: App Check must never
 * be the reason the app fails to start.
 */

import { Platform } from 'react-native';
import { getApps } from 'firebase/app';
import { initializeAppCheck, CustomProvider } from 'firebase/app-check';

let _initPromise: Promise<void> | null = null;

const FALLBACK_TTL_MS = 30 * 60 * 1000; // 30 minutes

export function initAppCheck(): Promise<void> {
    if (_initPromise) return _initPromise;

    _initPromise = (async () => {
        try {
            const jsApp = getApps()[0];
            if (!jsApp) {
                if (__DEV__) {
                    console.warn('[AppCheck] JS SDK app not initialized; skipping.');
                }
                return;
            }

            const debugToken = process.env.EXPO_PUBLIC_APP_CHECK_DEBUG_TOKEN;
            if (debugToken) {
                const provider = new CustomProvider({
                    getToken: async () => ({
                        token: debugToken,
                        expireTimeMillis: Date.now() + FALLBACK_TTL_MS,
                    }),
                });

                initializeAppCheck(jsApp, {
                    provider,
                    isTokenAutoRefreshEnabled: true,
                });

                if (__DEV__) {
                    console.log(`[AppCheck] initialized (${Platform.OS}, debug provider)`);
                }
            } else if (__DEV__) {
                console.log(`[AppCheck] running without attestation token (${Platform.OS})`);
            }
        } catch (err) {
            if (__DEV__) {
                console.warn('[AppCheck] JS SDK App Check failed:', err);
            }
        }
    })();

    return _initPromise;
}
