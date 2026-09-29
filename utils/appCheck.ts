/**
 * utils/appCheck.ts — Firebase App Check (Phase 2)
 *
 * WHY THIS FILE IS NOT A ONE-LINER
 * ─────────────────────────────────
 * This app runs two Firebase SDKs side by side:
 *   • @react-native-firebase/*  — native modules (Analytics, Crashlytics, App Check)
 *   • firebase (JS SDK v12)     — Auth, Firestore, Functions
 *
 * App Attest (iOS) and Play Integrity (Android) are *native* attestation APIs,
 * so only the RNFirebase module can mint those tokens. But every call we
 * actually want to protect — Firestore reads, `askPete`, `encryptUserField` —
 * goes out through the JS SDK, which knows nothing about the native module and
 * will happily send requests with no App Check header at all.
 *
 * So we do it in two stages:
 *   1. Configure + initialize App Check on the NATIVE side. This is what
 *      actually talks to Apple/Google and proves the binary is genuine.
 *   2. Register a JS SDK `CustomProvider` whose getToken() simply forwards the
 *      native token. The JS SDK then attaches `X-Firebase-AppCheck` to every
 *      Firestore/Functions/Auth request.
 *
 * Without stage 2, enabling enforcement in the console would reject 100% of
 * this app's traffic while the console still showed "verified" requests from
 * the native SDK's own calls. That failure mode is worth the extra 40 lines.
 *
 * DEBUG TOKENS (simulator / emulator)
 * ───────────────────────────────────
 * In __DEV__ we use the `debug` provider. On first launch the native SDK prints
 * a debug token to the device log, e.g.:
 *
 *   iOS (Xcode console):  "Firebase App Check Debug Token: 123e4567-..."
 *   Android (adb logcat): "DebugAppCheckProvider: Enter this debug secret ..."
 *
 * Copy it into Firebase Console → App Check → Apps → ⋮ → Manage debug tokens.
 * Deliberately NOT read from an env var: any EXPO_PUBLIC_* value is inlined
 * into every bundle including production, and a registered debug token bypasses
 * attestation for anyone holding it. Read it from the log instead.
 *
 * ROLLOUT
 * ───────
 * Enforcement is a CONSOLE setting, not a code setting. This file only makes
 * the app *send* tokens. Ship this, watch Firebase Console → App Check for a
 * full release cycle until the "verified" share of traffic plateaus, and only
 * then flip each API (Firestore, Cloud Functions, Authentication) to Enforced.
 * Flipping early locks out every user still on an older build.
 */

import { Platform } from 'react-native';

let _initPromise: Promise<void> | null = null;

/** Fallback token lifetime when the native result omits an expiry. */
const FALLBACK_TTL_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Initialize App Check natively, then bridge the native token into the JS SDK.
 *
 * Safe to call more than once — memoized. Never throws: App Check must never
 * be the reason the app fails to start. If attestation is unavailable (Expo Go,
 * a simulator without a registered debug token, a Play-Integrity-less device),
 * requests simply go out unattested, which is exactly the pre-App-Check
 * behaviour and is still fine while enforcement is in monitor-only mode.
 */
import Constants, { ExecutionEnvironment } from 'expo-constants';

export function initAppCheck(): Promise<void> {
    if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) {
        return Promise.resolve();
    }
    if (_initPromise) return _initPromise;

    _initPromise = (async () => {
        // ── Stage 1: native attestation ──────────────────────────────────────
        let nativeAppCheck: any = null;
        try {
            const rnAppCheckMod = require('@react-native-firebase/app-check');
            const rnAppMod = require('@react-native-firebase/app');

            const provider = rnAppCheckMod
                .firebase.appCheck()
                .newReactNativeFirebaseAppCheckProvider();

            provider.configure({
                apple: {
                    // appAttestWithDeviceCheckFallback: App Attest on iOS 14+,
                    // DeviceCheck below that. Plain 'appAttest' hard-fails on iOS 13.
                    provider: __DEV__ ? 'debug' : 'appAttestWithDeviceCheckFallback',
                },
                android: {
                    provider: __DEV__ ? 'debug' : 'playIntegrity',
                },
                // 'other' covers web/unknown platforms; we do not ship those,
                // but the provider map requires the key to be present.
                web: { provider: 'debug' },
            });

            nativeAppCheck = rnAppCheckMod.initializeAppCheck(rnAppMod.getApp(), {
                provider,
                isTokenAutoRefreshEnabled: true,
            });
        } catch (err) {
            // Native module unavailable (Expo Go, web, prebuild not run).
            if (__DEV__) {
                console.warn('[AppCheck] native App Check unavailable:', err);
            }
            return;
        }

        // ── Stage 2: bridge into the JS SDK ──────────────────────────────────
        try {
            const { getApps } = require('firebase/app');
            const { initializeAppCheck, CustomProvider } = require('firebase/app-check');
            const rnAppCheckMod = require('@react-native-firebase/app-check');

            const jsApp = getApps()[0];
            if (!jsApp) {
                console.warn('[AppCheck] JS SDK app not initialized; skipping bridge.');
                return;
            }

            const bridgeProvider = new CustomProvider({
                getToken: async () => {
                    const result = await rnAppCheckMod.getToken(nativeAppCheck, /* forceRefresh */ false);
                    return {
                        token: result.token,
                        // RNFirebase returns expireTimeMillis on most platforms; when it
                        // doesn't, give the JS SDK a conservative window so it re-asks the
                        // native side rather than caching a token past its real lifetime.
                        expireTimeMillis:
                            typeof result.expireTimeMillis === 'number'
                                ? result.expireTimeMillis
                                : Date.now() + FALLBACK_TTL_MS,
                    };
                },
            });

            initializeAppCheck(jsApp, {
                provider: bridgeProvider,
                isTokenAutoRefreshEnabled: true,
            });

            if (__DEV__) {
                console.log(`[AppCheck] initialized (${Platform.OS}, debug provider)`);
            }
        } catch (err) {
            if (__DEV__) {
                console.warn('[AppCheck] JS SDK bridge failed:', err);
            }
        }
    })();

    return _initPromise;
}
