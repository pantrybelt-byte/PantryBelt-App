/**
 * utils/network.ts — connectivity state
 *
 * Thin wrapper over @react-native-community/netinfo so screens can react to
 * going offline without each one importing and debouncing NetInfo itself.
 *
 * WHY `isInternetReachable` AND NOT JUST `isConnected`
 * ───────────────────────────────────────────────────
 * `isConnected` is true the moment the device joins a network, including the
 * captive-portal wifi in a clinic waiting room or a cell connection with no
 * usable backhaul — both common in the Black Belt counties this app serves.
 * Treating those as "online" is how you get a map that spins forever instead
 * of falling back to the cached list. `isInternetReachable` is the stricter
 * signal, but it starts as `null` (unknown) while NetInfo probes, so we treat
 * only an explicit `false` as offline and let `null` ride as online. That way
 * a cold start never flashes the offline view before the probe resolves —
 * and a failure has to persist (see delays below) before it counts.
 */

import { useEffect, useRef, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';

// The offline view is only for users who are genuinely offline, so a signal
// has to persist before we switch to it. Coming back online is immediate.
// - No network at all (airplane mode, no bars): short delay to ride out
//   wifi↔cellular hand-offs.
// - Connected but the reachability probe fails: that probe can fail for a
//   moment on slow cellular even while the app works fine, so require a
//   sustained failure before calling it offline.
const NO_NETWORK_DELAY_MS = 1500;
const UNREACHABLE_DELAY_MS = 8000;

/** True only when we are confident there is no usable connection. */
export function useIsOffline(): boolean {
    const [offline, setOffline] = useState(false);
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        const clear = () => {
            if (timer.current) clearTimeout(timer.current);
            timer.current = null;
        };
        const unsubscribe = NetInfo.addEventListener(state => {
            const noNetwork = state.isConnected === false;
            // null === "still probing"; don't call that offline.
            const unreachable = state.isConnected === true && state.isInternetReachable === false;

            if (!noNetwork && !unreachable) {
                clear();
                setOffline(false);
                return;
            }
            // Already counting down toward offline — let it finish.
            if (timer.current) return;
            timer.current = setTimeout(() => {
                timer.current = null;
                setOffline(true);
            }, noNetwork ? NO_NETWORK_DELAY_MS : UNREACHABLE_DELAY_MS);
        });
        return () => {
            clear();
            unsubscribe();
        };
    }, []);

    return offline;
}
