/**
 * tools/seedEmulator.js — load FAKE data into the local Firebase Emulator Suite.
 *
 * Usage (emulators must already be running: `npm run emulators`):
 *   npm run seed:emulator
 *
 * Safety: refuses to run unless FIRESTORE_EMULATOR_HOST and
 * FIREBASE_AUTH_EMULATOR_HOST are set AND the project id starts with "demo-".
 * With those set, the Admin SDK talks only to the emulators. Nothing here is
 * real pantry data; names are obviously fake and the people are fictional.
 */
const admin = require('firebase-admin');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');

const PROJECT_ID = process.env.GCLOUD_PROJECT || 'demo-accessbelt';

function refuse(msg) {
  console.error(`seedEmulator: refusing to run — ${msg}`);
  process.exit(1);
}
if (!PROJECT_ID.startsWith('demo-')) refuse(`project id "${PROJECT_ID}" is not a demo- project`);
if (!process.env.FIRESTORE_EMULATOR_HOST) refuse('FIRESTORE_EMULATOR_HOST is not set');
if (!process.env.FIREBASE_AUTH_EMULATOR_HOST) refuse('FIREBASE_AUTH_EMULATOR_HOST is not set');
for (const h of [process.env.FIRESTORE_EMULATOR_HOST, process.env.FIREBASE_AUTH_EMULATOR_HOST]) {
  if (!/^(127\.0\.0\.1|localhost|\[::1\]):\d+$/.test(h)) refuse(`emulator host "${h}" is not loopback`);
}

admin.initializeApp({ projectId: PROJECT_ID });
const auth = admin.auth();
const db = getFirestore(); // (default)
const operatorDb = getFirestore('accessbelt-operator');

const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';
function geohash(lat, lng, precision = 9) {
  let [latMin, latMax, lngMin, lngMax] = [-90, 90, -180, 180];
  let hash = '', bits = 0, bitCount = 0, even = true;
  while (hash.length < precision) {
    if (even) {
      const mid = (lngMin + lngMax) / 2;
      if (lng >= mid) { bits = (bits << 1) + 1; lngMin = mid; } else { bits <<= 1; lngMax = mid; }
    } else {
      const mid = (latMin + latMax) / 2;
      if (lat >= mid) { bits = (bits << 1) + 1; latMin = mid; } else { bits <<= 1; latMax = mid; }
    }
    even = !even;
    if (++bitCount === 5) { hash += BASE32[bits]; bits = 0; bitCount = 0; }
  }
  return hash;
}

const ORG_ID = 'org-demo-1';
const PASSWORD = 'emulator-only-pw'; // emulator only; never a real credential

const USERS = [
  {
    uid: 'op-demo-admin', email: 'org.admin@example.test',
    claims: { role: 'org_admin', orgId: ORG_ID, counties: ['Montgomery'], pantryId: 'agency-demo-1' },
  },
  {
    uid: 'op-demo-staff', email: 'org.staff@example.test',
    claims: { role: 'org_staff', orgId: ORG_ID, counties: ['Montgomery'], pantryId: 'agency-demo-1' },
  },
  {
    uid: 'state-demo-admin', email: 'state.admin@example.test',
    claims: { role: 'state_admin', orgId: 'org-state', counties: [] },
  },
];

const AGENCIES = [
  { id: 'agency-demo-1', name: 'Demo Pantry One', lat: 32.3668, lng: -86.3, operator: 'op-demo-admin' },
  { id: 'agency-demo-2', name: 'Demo Pantry Two', lat: 32.38, lng: -86.32, operator: null },
  { id: 'agency-demo-3', name: 'Demo Pantry Three', lat: 32.35, lng: -86.27, operator: null },
];

async function main() {
  for (const u of USERS) {
    try { await auth.deleteUser(u.uid); } catch { /* not present */ }
    await auth.createUser({ uid: u.uid, email: u.email, password: PASSWORD, emailVerified: true });
    await auth.setCustomUserClaims(u.uid, u.claims);
  }

  for (const a of AGENCIES) {
    const doc = {
      orgId: ORG_ID,
      name: a.name,
      locationType: 'pantry',
      status: 'active',
      county: 'Montgomery',
      coordinates: { lat: a.lat, lng: a.lng },
      geohash: geohash(a.lat, a.lng),
      address: { street: '1 Example St', city: 'Montgomery', county: 'Montgomery', state: 'AL', zip: '36104' },
      hours: 'Mon 9am-12pm',
      phone: '',
      website: '',
      socialMedia: null,
      eligibilityNotes: '',
      docsRequired: [],
      verified: false,
      operatorPortalAccess: a.operator !== null,
      miniProfile: null,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };
    if (a.operator) doc.operatorUid = a.operator;
    await db.collection('agencies').doc(a.id).set(doc);
  }

  await db.collection('organizations').doc(ORG_ID).set({
    name: 'Demo Org', jurisdictionCounties: ['Montgomery'], updatedAt: Timestamp.now(),
  });

  // Operator DB is left empty on purpose; portal code creates its own docs.
  await operatorDb.collection('_seed_marker').doc('seeded').set({ at: Timestamp.now() });

  console.log(`Seeded ${USERS.length} users, ${AGENCIES.length} agencies into ${PROJECT_ID}.`);
  console.log(`Sign in with e.g. org.admin@example.test / ${PASSWORD}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
