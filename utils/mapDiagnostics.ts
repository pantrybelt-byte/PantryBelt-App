/**
 * utils/mapDiagnostics.ts
 *
 * Lightweight in-memory store for map state diagnostics,
 * readable by the Profile screen diagnostics footer.
 */

export type MapDiagnostics = {
    ready: boolean;
    loaded: boolean;
    provider: 'google' | 'default';
    visited: boolean;
    size?: string;
};

let diagnostics: MapDiagnostics = {
    ready: false,
    loaded: false,
    provider: 'default',
    visited: false,
};

const listeners = new Set<(diag: MapDiagnostics) => void>();

export function updateMapDiagnostics(update: Partial<MapDiagnostics>) {
    diagnostics = { ...diagnostics, ...update, visited: true };
    listeners.forEach(fn => fn(diagnostics));
}

export function getMapDiagnostics(): MapDiagnostics {
    return diagnostics;
}

export function subscribeMapDiagnostics(fn: (diag: MapDiagnostics) => void) {
    listeners.add(fn);
    return () => {
        listeners.delete(fn);
    };
}
