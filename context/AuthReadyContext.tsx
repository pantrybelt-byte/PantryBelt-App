/**
 * context/AuthReadyContext.tsx — Auth Readiness Gate
 *
 * Wraps Firebase anonymous auth initialization (Tier 1 + Tier 3A)
 * and exposes an `authReady` flag. Screens that query Firestore
 * should wait for `authReady === true` before firing queries.
 *
 * This eliminates the race condition where fetchPantries() could
 * run before anonymous auth completes, causing Firestore security
 * rules to reject the read.
 */

import React, { createContext, useContext, useEffect, useState } from 'react';
import { initAppSecurity, subscribeToAccountLabel } from '../utils/auth';
import { logSession } from '../utils/analytics';
import { flushFeedbackQueue, incrementFeedbackSessionCount } from '../utils/feedback';

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
        // 🔒 TIER 1 + TIER 3A: Anonymous auth + session bootstrap
        // Must complete before any Firestore queries are attempted.
        initAppSecurity()
            .then(() => {
                setAuthReady(true);
                // GAP 5: Log the session AFTER auth is confirmed
                logSession();
                // Local session count for the feedback auto-prompt, and retry
                // any feedback that failed to submit while offline last time.
                incrementFeedbackSessionCount();
                flushFeedbackQueue();
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

    return (
        <AuthReadyContext.Provider value={{ authReady, accountLabel }}>
            {children}
        </AuthReadyContext.Provider>
    );
}

export function useAuthReady(): AuthReadyContextType {
    return useContext(AuthReadyContext);
}
