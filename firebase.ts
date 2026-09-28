import { getApps, initializeApp } from 'firebase/app';
import { getAuth, initializeAuth } from 'firebase/auth';
// @ts-ignore — getReactNativePersistence is present at runtime in firebase v12
// but missing from its .d.ts. Known upstream issue; see firebase/firebase-js-sdk#8598.
import { getReactNativePersistence } from 'firebase/auth';
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';

if (!process.env.EXPO_PUBLIC_FIREBASE_API_KEY) {
  console.warn(
    '\n⚠️  WARNING: EXPO_PUBLIC_FIREBASE_API_KEY is not defined in the environment. ' +
    'Firebase Auth and Firestore calls will fail with an opaque auth/invalid-api-key error. ' +
    'Make sure to set this in your EAS Secrets/Variables or local .env file!\n'
  );
}

export const firebaseConfig = {
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
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager(),
    }),
  });
} catch (err: any) {
  // "already started" = Fast Refresh or HMR — reuse existing instance
  _db = getFirestore(app);
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
