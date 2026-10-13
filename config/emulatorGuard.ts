/**
 * Emulator-mode guard for the mobile app.
 *
 * `EXPO_PUBLIC_USE_EMULATORS=true` points Auth, Firestore and Functions at the
 * local Firebase Emulator Suite. EXPO_PUBLIC_* values are inlined into every
 * bundle, so this must be impossible to leave on by accident:
 *
 *   - it only works in a development bundle (`isDev`); a release build with the
 *     flag set throws instead of silently shipping with a dead backend;
 *   - the project id is forced to the emulator-only `demo-` namespace and the
 *     production id is rejected outright, so no code path can address production
 *     data while the flag is on;
 *   - the emulator host must be loopback or a private-network address.
 *
 * Pure function, no SDK imports, so it can be unit-tested with node:test.
 */

export const PRODUCTION_PROJECT_ID = 'pantrybelt-1e7eb';
export const EMULATOR_PROJECT_ID = 'demo-accessbelt';

export const EMULATOR_PORTS = { auth: 9099, firestore: 8080, functions: 5001 } as const;

const ALLOWED_HOST =
  /^(localhost|127\.0\.0\.1|10\.0\.2\.2|192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})$/;

export interface EmulatorSettings {
  host: string;
  projectId: string;
  ports: { auth: number; firestore: number; functions: number };
}

function parsePort(raw: string | undefined, fallback: number, name: string): number {
  if (raw === undefined || raw === '') return fallback;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1024 || n > 65535) {
    throw new Error(`Emulator ${name} port "${raw}" is not a valid port. Refusing to start.`);
  }
  return n;
}

/** Returns settings when emulator mode is on, `null` when off. Throws if unsafe. */
export function resolveEmulatorSettings(
  env: {
    USE_EMULATORS?: string;
    EMULATOR_HOST?: string;
    PROJECT_ID?: string;
    AUTH_PORT?: string;
    FIRESTORE_PORT?: string;
  },
  isDev: boolean
): EmulatorSettings | null {
  if (env.USE_EMULATORS !== 'true') return null;

  if (!isDev) {
    throw new Error(
      'EXPO_PUBLIC_USE_EMULATORS is set in a non-development build. Refusing to start.'
    );
  }

  const projectId = env.PROJECT_ID ?? EMULATOR_PROJECT_ID;
  if (projectId === PRODUCTION_PROJECT_ID || !projectId.startsWith('demo-')) {
    throw new Error(
      `Emulator mode requires a "demo-" project id; got "${projectId}". Refusing to start.`
    );
  }

  const host = env.EMULATOR_HOST ?? '127.0.0.1';
  if (!ALLOWED_HOST.test(host)) {
    throw new Error(
      `Emulator host "${host}" is not loopback or a private address. Refusing to start.`
    );
  }

  return {
    host,
    projectId,
    ports: {
      auth: parsePort(env.AUTH_PORT, EMULATOR_PORTS.auth, 'auth'),
      firestore: parsePort(env.FIRESTORE_PORT, EMULATOR_PORTS.firestore, 'firestore'),
      functions: EMULATOR_PORTS.functions,
    },
  };
}
