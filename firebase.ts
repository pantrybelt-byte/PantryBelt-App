import { getApps, initializeApp } from 'firebase/app';
// @ts-ignore — getReactNativePersistence is exported from Firebase's RN-specific
// bundle (dist/rn/index.js), resolved by Metro at runtime. TS types only cover
// the main entry point which doesn't include it.
import { getReactNativePersistence, initializeAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
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

export const db = getFirestore(app);

// ── TIER 1: Auth instance for Anonymous Authentication ──
// Uses AsyncStorage persistence so auth state survives app restarts.
export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(ReactNativeAsyncStorage),
});


