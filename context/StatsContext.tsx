/**
 * context/StatsContext.tsx — Shared Pantry Stats Cache
 *
 * Fetches pantry/county counts ONCE on app launch and shares them across
 * all screens. Eliminates the duplicate full-collection scan where both
 * home.tsx and profile.tsx independently queried all 880+ agencies.
 *
 * Performance impact: reduces 2 × 880-doc reads to 1 on every cold start.
 */

import React, { createContext, useContext, useEffect, useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuthReady } from './AuthReadyContext';

type StatsContextType = {
    pantryCount: string;
    countyCount: string;
};

const StatsContext = createContext<StatsContextType>({
    pantryCount: '—',
    countyCount: '—',
});

export function StatsProvider({ children }: { children: React.ReactNode }) {
    const { authReady } = useAuthReady();
    const [pantryCount, setPantryCount] = useState('—');
    const [countyCount, setCountyCount] = useState('—');

    useEffect(() => {
        if (!authReady) return;

        (async () => {
            try {
                const q = query(collection(db, 'agencies'), where('status', '==', 'active'));
                const snapshot = await getDocs(q);
                const counties = new Set<string>();
                snapshot.docs.forEach(d => {
                    const county = d.data().county;
                    if (county) counties.add(county);
                });
                setPantryCount(String(snapshot.size > 0 ? snapshot.size : '880+'));
                setCountyCount(String(counties.size > 0 ? counties.size : '67'));
            } catch {
                setPantryCount('880+');
                setCountyCount('67');
            }
        })();
    }, [authReady]);

    return (
        <StatsContext.Provider value={{ pantryCount, countyCount }}>
            {children}
        </StatsContext.Provider>
    );
}

export function useStats(): StatsContextType {
    return useContext(StatsContext);
}
