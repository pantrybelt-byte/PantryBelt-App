import { getApps, initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

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
export const auth = getAuth(app);
