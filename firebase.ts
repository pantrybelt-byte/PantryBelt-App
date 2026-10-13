import { getApps, initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, initializeAuth } from 'firebase/auth';
// @ts-ignore — getReactNativePersistence is present at runtime in firebase v12
// but missing from its .d.ts. Known upstream issue; see firebase/firebase-js-sdk#8598.
import { getReactNativePersistence } from 'firebase/auth';
import {
  connectFirestoreEmulator,
  getFirestore,
  initializeFirestore,
  memoryLocalCache,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore';
import { connectFunctionsEmulator, getFunctions } from 'firebase/functions';
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';
import { resolveEmulatorSettings } from './config/emulatorGuard';

// Emulator mode (dev only, see config/emulatorGuard.ts). Off unless
// EXPO_PUBLIC_USE_EMULATORS=true; throws rather than risk touching production.
const emulator = resolveEmulatorSettings(
  {
    USE_EMULATORS: process.env.EXPO_PUBLIC_USE_EMULATORS,
    EMULATOR_HOST: process.env.EXPO_PUBLIC_EMULATOR_HOST,
  },
  __DEV__
);

if (!emulator && !process.env.EXPO_PUBLIC_FIREBASE_API_KEY) {
  console.warn(
    '\n⚠️  WARNING: EXPO_PUBLIC_FIREBASE_API_KEY is not defined in the environment. ' +
    'Firebase Auth and Firestore calls will fail with an opaque auth/invalid-api-key error. ' +
    'Make sure to set this in your EAS Secrets/Variables or local .env file!\n'
  );
}

export const firebaseConfig = emulator
  ? {
      // Throwaway values: the emulators accept anything, and the real key is
      // deliberately not sent anywhere while emulator mode is on.
      apiKey: 'demo-emulator-key',
      authDomain: `${emulator.projectId}.firebaseapp.com`,
      projectId: emulator.projectId,
      appId: '1:0:web:demo',
    }
  : {
      apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
      authDomain: 'pantrybelt-1e7eb.firebaseapp.com',
      projectId: 'pantrybelt-1e7eb',
      storageBucket: 'pantrybelt-1e7eb.firebasestorage.app',
      messagingSenderId: '886799477362',
      appId: '1:886799477362:web:bd790a7b927be4153a30eb',
    };

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

// ── Firestore with persistent offline cache ────────────────────────────────
// initializeFirestore() must be called BEFORE getFirestore() on a new app
// instance. We call it with persistentLocalCache so all getDocs/onSnapshot
// calls are automatically served from the local cache when offline.
// On Fast Refresh / HMR the app is already initialized, so we catch the
// "already initialized" error and fall back to getFirestore().
let _db;
try {
  _db = initializeFirestore(app, {
    // Emulator data is wiped between runs, so a persistent cache would serve
    // stale docs; use memory in that mode.
    localCache: emulator
      ? memoryLocalCache()
      : persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  });
} catch (err: any) {
  // "already started" = Fast Refresh or HMR — reuse existing instance
  _db = getFirestore(app);
}
if (emulator) {
  try {
    connectFirestoreEmulator(_db, emulator.host, emulator.ports.firestore);
  } catch {
    // Already connected (Fast Refresh) — safe to ignore.
  }
}
export const db = _db;

// ── Auth instance with AsyncStorage persistence ────────────────────────────
// Initialize with AsyncStorage persistence first; only fall back to getAuth
// if initializeAuth throws auth/already-initialized (e.g. during Fast Refresh / HMR).
let authInstance;
try {
  authInstance = initializeAuth(app, {
    persistence: getReactNativePersistence(ReactNativeAsyncStorage),
  });
} catch (error: any) {
  if (error?.code === 'auth/already-initialized') {
    authInstance = getAuth(app);
  } else {
    throw error;
  }
}

export const functions = getFunctions(app, 'us-central1');
export const auth = authInstance;

if (emulator) {
  try {
    connectAuthEmulator(authInstance, `http://${emulator.host}:${emulator.ports.auth}`, {
      disableWarnings: true,
    });
    connectFunctionsEmulator(functions, emulator.host, emulator.ports.functions);
  } catch {
    // Already connected (Fast Refresh) — safe to ignore.
  }
}
