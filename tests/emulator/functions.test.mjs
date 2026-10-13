// End-to-end tests for functions/index.js against the Auth, Firestore and
// Functions emulators: the two sync triggers and the claim/grant callables.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { initializeApp as initAdmin, deleteApp as deleteAdmin } from 'firebase-admin/app';
import { getFirestore, Timestamp, FieldValue } from 'firebase-admin/firestore';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { getFunctions, connectFunctionsEmulator, httpsCallable } from 'firebase/functions';

const PROJECT = 'demo-accessbelt';
const adminApp = initAdmin({ projectId: PROJECT }, 'admin');
const db = getFirestore(adminApp);
const opDb = getFirestore(adminApp, 'accessbelt-operator');
const adminAuth = getAdminAuth(adminApp);

const clientApp = initializeApp({ projectId: PROJECT, apiKey: 'demo-key', authDomain: 'localhost' }, 'client');
const clientAuth = getAuth(clientApp);
connectAuthEmulator(clientAuth, `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST ?? '127.0.0.1:9099'}`, { disableWarnings: true });
const fns = getFunctions(clientApp, 'us-central1');
connectFunctionsEmulator(fns, '127.0.0.1', 5001);

/** Polls until `check` returns a truthy value or the timeout passes. */
async function eventually(check, timeoutMs = 15_000) {
  const end = Date.now() + timeoutMs;
  let last;
  while (Date.now() < end) {
    last = await check();
    if (last) return last;
    await new Promise((r) => setTimeout(r, 250));
  }
  return last;
}

async function makeUser(uid, claims) {
  await adminAuth.createUser({ uid, email: `${uid}@example.org`, password: 'secret-pass', emailVerified: true });
  if (claims) await adminAuth.setCustomUserClaims(uid, claims);
}

async function callAs(uid, name, data) {
  await signInWithEmailAndPassword(clientAuth, `${uid}@example.org`, 'secret-pass');
  try {
    return (await httpsCallable(fns, name)(data)).data;
  } finally {
    await signOut(clientAuth);
  }
}

before(async () => {
  await db.doc('agencies/p1').set({
    orgId: 'org_a', name: 'Selma Pantry', status: 'active', county: 'Dallas',
    hours: { monday: { open: '00:00', close: '23:59', closed: false } },
  });
  await db.doc('agencies/p2').set({ orgId: 'org_b', name: 'Other Pantry', status: 'active', county: 'Perry' });
  await db.doc('agencies/p3').set({ orgId: 'org_pantry_belt', name: 'Unclaimed Pantry', status: 'active', county: 'Wilcox' });

  await makeUser('admin', { role: 'state_admin', orgId: 'org_state', counties: ['Dallas'] });
  await makeUser('orgadmin', { role: 'org_admin', orgId: 'org_a', counties: ['Dallas'] });
  await makeUser('claimant');
  await makeUser('volunteer');
  await makeUser('stranger');
});

after(async () => {
  await deleteApp(clientApp);
  await deleteAdmin(adminApp);
});

test('syncLiveStatus copies a valid status onto the owning agency with an expiry', async () => {
  await opDb.doc('liveStatus/p1').set({
    orgId: 'org_a', pantryId: 'p1', state: 'closing_early', isOpen: true, note: 'Closing at 2 for weather',
    waitMinutes: 20, updatedBy: 'u1', updatedAt: FieldValue.serverTimestamp(),
  });
  const live = await eventually(async () => (await db.doc('agencies/p1').get()).data().liveStatus);
  assert.ok(live, 'liveStatus was not copied');
  assert.equal(live.state, 'closing_early');
  assert.equal(live.isOpen, true);
  assert.equal(live.note, 'Closing at 2 for weather');
  assert.equal(live.waitMinutes, 20);
  assert.ok(live.expiresAt.toMillis() > Date.now(), 'expiresAt should be in the future');
  assert.ok(live.expiresAt.toMillis() <= Date.now() + 6 * 3_600_000 + 60_000, 'expiresAt should be at most 6 hours out');
});

test('syncLiveStatus ignores a status written under an org that does not own the pantry', async () => {
  await opDb.doc('liveStatus/p2').set({
    orgId: 'org_a', pantryId: 'p2', state: 'emergency_closed', isOpen: false, note: 'hijack',
    updatedBy: 'u1', updatedAt: FieldValue.serverTimestamp(),
  });
  await new Promise((r) => setTimeout(r, 3_000));
  assert.equal((await db.doc('agencies/p2').get()).data().liveStatus, undefined);
});

test('syncBroadcast publishes to (default)/broadcasts by county and marks sentToApp', async () => {
  const ref = opDb.collection('broadcasts').doc('b1');
  await ref.set({
    orgId: 'org_a', pantryId: 'p1', operatorId: 'u1', title: 'Closed today', message: 'Storm damage',
    priority: 'urgent', language: 'English', sentToApp: false, viewsCount: 0,
    createdAt: FieldValue.serverTimestamp(), expiresAt: Timestamp.fromMillis(Date.now() + 3_600_000),
  });
  const pub = await eventually(async () => (await db.doc('broadcasts/b1').get()).data());
  assert.ok(pub, 'broadcast was not published');
  assert.equal(pub.county, 'Dallas');
  assert.equal(pub.pantryName, 'Selma Pantry');
  assert.equal(pub.orgId, undefined);
  assert.equal(pub.operatorId, undefined);
  assert.ok(await eventually(async () => (await ref.get()).data().sentToApp === true), 'sentToApp not set');

  await ref.delete();
  assert.ok(await eventually(async () => !(await db.doc('broadcasts/b1').get()).exists), 'public copy not removed');
});

test('only a state admin can review a claim', async () => {
  await opDb.doc('pantryClaims/c-deny').set({ claimantUid: 'claimant', pantryId: 'p3', status: 'pending' });
  await assert.rejects(callAs('stranger', 'reviewPantryClaim', { claimId: 'c-deny', decision: 'approve' }),
    /permission-denied|Only a state administrator/);
});

test('approving a claim on an unclaimed pantry creates its org and makes the claimant org_admin', async () => {
  await opDb.doc('pantryClaims/c1').set({
    claimantUid: 'claimant', claimantEmail: 'claimant@example.org', pantryId: 'p3', pantryName: 'Unclaimed Pantry',
    county: 'Wilcox', contactName: 'Ruth Jones', contactPhone: '334-555-0100', roleAtPantry: 'Coordinator',
    message: '', status: 'pending', createdAt: FieldValue.serverTimestamp(),
  });
  const result = await callAs('admin', 'reviewPantryClaim', { claimId: 'c1', decision: 'approve' });
  assert.equal(result.status, 'approved');
  assert.equal(result.orgId, 'org_p3');

  const agency = (await db.doc('agencies/p3').get()).data();
  assert.equal(agency.orgId, 'org_p3');
  assert.equal(agency.operatorPortalAccess, true);

  const claims = (await adminAuth.getUser('claimant')).customClaims;
  assert.deepEqual(
    { role: claims.role, orgId: claims.orgId, counties: claims.counties, pantryId: claims.pantryId },
    { role: 'org_admin', orgId: 'org_p3', counties: ['Wilcox'], pantryId: 'p3' },
  );
  assert.equal((await opDb.doc('pantryClaims/c1').get()).data().status, 'approved');
  assert.equal((await db.doc('users/claimant').get()).data().orgId, 'org_p3');
  await assert.rejects(callAs('admin', 'reviewPantryClaim', { claimId: 'c1', decision: 'approve' }), /already approved/);
});

test('an org admin can add staff to their own org but cannot grant admin or other orgs', async () => {
  const ok = await callAs('orgadmin', 'grantOperatorAccess',
    { uid: 'volunteer', role: 'org_staff', orgId: 'org_a', counties: ['Dallas'], pantryId: 'p1' });
  assert.equal(ok.success, true);
  assert.equal((await adminAuth.getUser('volunteer')).customClaims.role, 'org_staff');

  await assert.rejects(callAs('orgadmin', 'grantOperatorAccess',
    { uid: 'volunteer', role: 'org_admin', orgId: 'org_a', counties: ['Dallas'], pantryId: 'p1' }), /permission-denied|Not allowed/);
  await assert.rejects(callAs('orgadmin', 'grantOperatorAccess',
    { uid: 'volunteer', role: 'org_staff', orgId: 'org_b', counties: ['Perry'], pantryId: 'p2' }), /permission-denied|Not allowed/);
});
