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
 * a cold start never flashes the offline view before the probe resolves.
 */

import { useEffect, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';

/** True only when we are confident there is no usable connection. */
export function useIsOffline(): boolean {
    const [offline, setOffline] = useState(false);

    useEffect(() => {
        const unsubscribe = NetInfo.addEventListener(state => {
            const connected = state.isConnected === true;
            // null === "still probing"; don't call that offline.
            const reachable = state.isInternetReachable !== false;
            setOffline(!(connected && reachable));
        });
        return unsubscribe;
    }, []);

    return offline;
}
