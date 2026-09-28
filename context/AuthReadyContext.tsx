/**
 * context/AuthReadyContext.tsx — Auth Readiness Gate
 *
 * Wraps Firebase anonymous auth initialization (Tier 1 + Tier 3A)
 * and exposes an `authReady` flag. Screens that query Firestore
 * should wait for `authReady === true` before firing queries.
 *
 * PERFORMANCE FIX: Auth initializes in the background. The UI renders
 * immediately with `authReady: false`. Screens show skeleton/placeholder
 * content while auth completes, then hydrate when `authReady` flips.
 * This eliminates the 2–8s cold start on TestFlight/cellular where the
 * anonymous signIn pays the full TLS + HTTP/2 setup cost.
 */

import React, { createContext, useContext, useEffect, useState } from 'react';
import { initAppSecurity, subscribeToAccountLabel, getCurrentUid } from '../utils/auth';
import { logSession } from '../utils/analytics';
import { flushFeedbackQueue, incrementFeedbackSessionCount } from '../utils/feedback';
import { initMonitoring } from '../utils/monitoring';
import { initAppCheck } from '../utils/appCheck';

type AuthReadyContextType = {
    authReady: boolean;
    /** Signed-in account's display label ("@username" or an email), or null if anonymous. */
    accountLabel: string | null;
};

const AuthReadyContext = createContext<AuthReadyContextType>({ authReady: false, accountLabel: null });

export function AuthReadyProvider({ children }: { children: React.ReactNode }) {
    const [authReady, setAuthReady] = useState(false);
    const [accountLabel, setAccountLabel] = useState<string | null>(null);

    useEffect(() => {
        // 🔒 TIER 3B: App Check must be initialized BEFORE the first Firestore /
        // Functions call, otherwise that call goes out with no attestation header
        // and will be rejected once enforcement is switched on in the console.
        // initAppCheck() never rejects — it degrades to unattested requests — so
        // chaining auth off it cannot strand the UI.
        //
        // 🔒 TIER 1 + TIER 3A: Anonymous auth + session bootstrap
        // UI renders immediately — screens show placeholders until authReady flips.
        initAppCheck()
            .then(() => initAppSecurity())
            .then(() => {
                setAuthReady(true);
                // Fire-and-forget: these are side effects that must NOT block
                // the UI thread. Run them in parallel, don't await.
                const uid = getCurrentUid();
                Promise.all([
                    logSession(),
                    incrementFeedbackSessionCount(),
                    flushFeedbackQueue(),
                    // Bootstrap Crashlytics + Analytics with the anonymous uid.
                    // Must run after auth so the uid is available.
                    uid ? initMonitoring(uid) : Promise.resolve(),
                ]).catch(() => {
                    // Best-effort — never block the UI for analytics/feedback
                });
            })
            .catch(() => {
                // Even if auth fails, mark ready so the UI isn't stuck forever.
                // Firestore queries will fail with permission-denied, which the
                // map screen already handles with a retry button.
                setAuthReady(true);
            });
    }, []);

    useEffect(() => {
        // Reactive, not a one-time read: screens must never freeze on a stale
        // "anonymous" label if they mount before the persisted session finishes
        // restoring, or miss a sign-in/sign-out that happens while off-screen.
        return subscribeToAccountLabel(setAccountLabel);
    }, []);

    // CRITICAL: Children render immediately — not gated behind authReady.
    // Individual screens handle the loading state themselves.
    return (
        <AuthReadyContext.Provider value={{ authReady, accountLabel }}>
            {children}
        </AuthReadyContext.Provider>
    );
}

export function useAuthReady(): AuthReadyContextType {
    return useContext(AuthReadyContext);
}
