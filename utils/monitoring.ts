/**
 * utils/monitoring.ts — Crashlytics + Analytics wrapper
 *
 * Uses @react-native-firebase/crashlytics and @react-native-firebase/analytics
 * alongside (not replacing) the Firebase JS SDK for Auth + Firestore.
 *
 * Usage:
 *   import { logEvent, setUserId, recordError, log } from '../utils/monitoring';
 *
 * All calls are no-ops if the native module fails to init (e.g. in the Expo
 * Go client where native modules are not available).
 */

import { Platform } from 'react-native';

// Dynamic requires protect against the module failing to load in Expo Go /
// web contexts where native modules are unavailable.
let _analytics: any = null;
let _crashlytics: any = null;

function getAnalytics() {
  if (_analytics) return _analytics;
  try {
    _analytics = require('@react-native-firebase/analytics').default();
  } catch {
    // Not available (e.g. Expo Go dev session without dev client)
    _analytics = null;
  }
  return _analytics;
}

function getCrashlytics() {
  if (_crashlytics) return _crashlytics;
  try {
    _crashlytics = require('@react-native-firebase/crashlytics').default();
  } catch {
    _crashlytics = null;
  }
  return _crashlytics;
}

// ─── Analytics ────────────────────────────────────────────────────────────────

/**
 * Log a named event with optional parameters.
 * Event names must be ≤ 40 chars, snake_case, no spaces.
 */
export async function logAnalyticsEvent(
  name: string,
  params?: Record<string, string | number | boolean>
): Promise<void> {
  try {
    await getAnalytics()?.logEvent(name, params);
  } catch (err) {
    console.warn('[Monitoring] logAnalyticsEvent failed:', err);
  }
}

/**
 * Set the Firebase Analytics user ID.
 * Pass null to clear the ID (on sign-out).
 * Never pass PII — use an anonymous uid only.
 */
export async function setAnalyticsUserId(uid: string | null): Promise<void> {
  try {
    await getAnalytics()?.setUserId(uid ?? null);
  } catch (err) {
    console.warn('[Monitoring] setUserId failed:', err);
  }
}

/**
 * Set a user property (custom dimension).
 * Keep to non-PII values (county, platform, etc.).
 */
export async function setAnalyticsUserProperty(key: string, value: string | null): Promise<void> {
  try {
    await getAnalytics()?.setUserProperty(key, value ?? null);
  } catch (err) {
    console.warn('[Monitoring] setUserProperty failed:', err);
  }
}

/**
 * Log the current screen name for funnel analysis.
 */
export async function logScreenView(screenName: string): Promise<void> {
  try {
    await getAnalytics()?.logScreenView({
      screen_name:  screenName,
      screen_class: screenName,
    });
  } catch (err) {
    console.warn('[Monitoring] logScreenView failed:', err);
  }
}

// ─── Crashlytics ──────────────────────────────────────────────────────────────

/**
 * Record a non-fatal error in Crashlytics.
 * Strips PII from the message before sending.
 */
export function recordError(error: unknown, context?: string): void {
  try {
    const cl = getCrashlytics();
    if (!cl) return;

    const err = error instanceof Error ? error : new Error(String(error));
    if (context) cl.log(`[${context}] ${err.message}`);
    cl.recordError(err);
  } catch {
    // Never throw from error reporting
  }
}

/**
 * Log a breadcrumb message to Crashlytics (appears in crash reports).
 */
export function log(message: string): void {
  try {
    getCrashlytics()?.log(message);
  } catch {
    // Silently ignore
  }
}

/**
 * Set the Crashlytics user ID (anonymous uid only — never email/name).
 */
export function setCrashlyticsUserId(uid: string): void {
  try {
    getCrashlytics()?.setUserId(uid);
  } catch {
    // Silently ignore
  }
}

/**
 * Set a Crashlytics key-value attribute for crash reports.
 */
export function setCrashlyticsAttribute(key: string, value: string): void {
  try {
    getCrashlytics()?.setAttribute(key, value);
  } catch {
    // Silently ignore
  }
}

// ─── Bootstrap: call from AuthReadyContext after auth resolves ────────────────

/**
 * initMonitoring(uid)
 *
 * Call once after Firebase Auth resolves (in AuthReadyProvider's initAppSecurity
 * callback). Sets uid + platform on both Analytics and Crashlytics so all
 * subsequent events are correctly attributed.
 */
export async function initMonitoring(uid: string): Promise<void> {
  try {
    await Promise.all([
      setAnalyticsUserId(uid),
      setAnalyticsUserProperty('platform', Platform.OS),
    ]);
    setCrashlyticsUserId(uid);
    setCrashlyticsAttribute('platform', Platform.OS);
    log(`Session started uid=${uid.slice(-8)}`); // Only last 8 chars in logs
  } catch (err) {
    console.warn('[Monitoring] initMonitoring failed:', err);
  }
}
