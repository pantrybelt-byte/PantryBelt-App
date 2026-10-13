// Security-rules tests for firestore.rules ((default)) and
// firestore.operator.rules (accessbelt-operator). Each rules file is loaded
// into its own demo project so the two never mix.
import { test, before, after } from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  initializeTestEnvironment, assertSucceeds, assertFails,
} from '@firebase/rules-unit-testing';
import {
  doc, getDoc, setDoc, updateDoc, addDoc, collection, serverTimestamp, Timestamp,
} from 'firebase/firestore';

const root = (p) => fileURLToPath(new URL(`../../${p}`, import.meta.url));
const [host, port] = (process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080').split(':');

let shared;   // firestore.rules
let operator; // firestore.operator.rules

const ORG = 'org_a';
const staffA = { role: 'org_staff', orgId: ORG, counties: ['Dallas'], email: 'a@x.org', email_verified: true };
const staffB = { role: 'org_staff', orgId: 'org_b', counties: ['Dallas'], email: 'b@x.org', email_verified: true };
const newcomer = { email: 'new@x.org', email_verified: true };
const unverified = { email: 'nv@x.org', email_verified: false };

const agency = {
  orgId: ORG, name: 'Selma Pantry', status: 'active', county: 'Dallas',
  coordinates: { lat: 32.4, lng: -87.0 }, geohash: 'djd', verified: false,
};

before(async () => {
  shared = await initializeTestEnvironment({
    projectId: 'demo-rules-shared',
    firestore: { host, port: Number(port), rules: readFileSync(root('firestore.rules'), 'utf8') },
  });
  operator = await initializeTestEnvironment({
    projectId: 'demo-rules-operator',
    firestore: { host, port: Number(port), rules: readFileSync(root('firestore.operator.rules'), 'utf8') },
  });
  await shared.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'agencies/p1'), agency);
    await setDoc(doc(db, 'resources/r1'), { ...agency });
    await setDoc(doc(db, 'broadcasts/b1'), { county: 'Dallas', priority: 'urgent', title: 'Closed', message: 'Storm' });
  });
  await operator.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'pantryClaims/c1'), { claimantUid: 'newcomer', status: 'pending' });
  });
});

after(async () => {
  await shared?.cleanup();
  await operator?.cleanup();
});

// ── (default) ──────────────────────────────────────────────────────────────

test('anyone can read an active agency, including liveStatus', async () => {
  const db = shared.unauthenticatedContext().firestore();
  await assertSucceeds(getDoc(doc(db, 'agencies/p1')));
});

test('an operator can edit their pantry but not its liveStatus', async () => {
  const db = shared.authenticatedContext('a', staffA).firestore();
  await assertSucceeds(updateDoc(doc(db, 'agencies/p1'), { phone: '3345550100' }));
  await assertFails(updateDoc(doc(db, 'agencies/p1'), { liveStatus: { state: 'open' } }));
});

test('an operator cannot mark their own pantry verified or grant portal access', async () => {
  const db = shared.authenticatedContext('a', staffA).firestore();
  await assertFails(updateDoc(doc(db, 'agencies/p1'), { verified: true }));
  await assertFails(updateDoc(doc(db, 'agencies/p1'), { operatorPortalAccess: true }));
});

test('the retired resources collection rejects every client write', async () => {
  const db = shared.authenticatedContext('a', staffA).firestore();
  await assertFails(updateDoc(doc(db, 'resources/r1'), { phone: '3345550100' }));
  await assertFails(setDoc(doc(db, 'resources/new'), agency));
});

test('public broadcasts are readable by anyone and writable by no client', async () => {
  await assertSucceeds(getDoc(doc(shared.unauthenticatedContext().firestore(), 'broadcasts/b1')));
  const db = shared.authenticatedContext('a', staffA).firestore();
  await assertFails(setDoc(doc(db, 'broadcasts/b2'), { county: 'Dallas' }));
});

test('waitlist requires sms_consent and a phone only with opt-in', async () => {
  const db = shared.unauthenticatedContext().firestore();
  const base = { name: 'Ann', email: 'ann@example.com', created_at: serverTimestamp() };
  await assertSucceeds(addDoc(collection(db, 'waitlist'), { ...base, sms_consent: false }));
  await assertSucceeds(addDoc(collection(db, 'waitlist'), { ...base, sms_consent: true, phone_sms: '+13345550100' }));
  await assertFails(addDoc(collection(db, 'waitlist'), base));
  await assertFails(addDoc(collection(db, 'waitlist'), { ...base, sms_consent: false, phone_sms: '+13345550100' }));
});

// ── accessbelt-operator ────────────────────────────────────────────────────

const status = (uid, overrides = {}) => ({
  orgId: ORG, pantryId: 'p1', state: 'open', isOpen: true, note: 'Walk-ins welcome',
  waitMinutes: 10, updatedBy: uid, updatedAt: serverTimestamp(), ...overrides,
});

test('staff can set a valid live status for their org', async () => {
  const db = operator.authenticatedContext('a', staffA).firestore();
  await assertSucceeds(setDoc(doc(db, 'liveStatus/p1'), status('a')));
  await assertSucceeds(setDoc(doc(db, 'liveStatus/p1'), status('a', { state: 'emergency_closed', isOpen: false, waitMinutes: null })));
});

test('live status rejects bad states, mismatched isOpen, long notes and spoofed authors', async () => {
  const db = operator.authenticatedContext('a', staffA).firestore();
  await assertFails(setDoc(doc(db, 'liveStatus/p1'), status('a', { state: 'busy' })));
  await assertFails(setDoc(doc(db, 'liveStatus/p1'), status('a', { state: 'closed', isOpen: true })));
  await assertFails(setDoc(doc(db, 'liveStatus/p1'), status('a', { note: 'x'.repeat(281) })));
  await assertFails(setDoc(doc(db, 'liveStatus/p1'), status('a', { waitMinutes: 900 })));
  await assertFails(setDoc(doc(db, 'liveStatus/p1'), status('someone-else')));
  await assertFails(setDoc(doc(db, 'liveStatus/p1'), status('a', { pantryId: 'p2' })));
  await assertFails(setDoc(doc(db, 'liveStatus/p1'), status('a', { capacity: 50 })));
});

test('staff cannot write live status under another org', async () => {
  const db = operator.authenticatedContext('b', staffB).firestore();
  await assertFails(setDoc(doc(db, 'liveStatus/p1'), status('b')));
});

test('inventory no longer exists', async () => {
  const db = operator.authenticatedContext('a', staffA).firestore();
  await assertFails(addDoc(collection(db, 'inventory'), { orgId: ORG, pantryId: 'p1', name: 'Rice', quantity: 4, minThreshold: 1 }));
});

test('events can be created by staff (previously denied by the catch-all)', async () => {
  const db = operator.authenticatedContext('a', staffA).firestore();
  await assertSucceeds(addDoc(collection(db, 'events'), { orgId: ORG, pantryId: 'p1', title: 'Saturday drive-thru' }));
});

test('broadcasts cannot claim delivery and no longer need a radius', async () => {
  const db = operator.authenticatedContext('a', staffA).firestore();
  const b = {
    orgId: ORG, pantryId: 'p1', title: 'Closing early', message: 'Storm warning', priority: 'urgent',
    sentToApp: false, viewsCount: 0, expiresAt: Timestamp.fromMillis(Date.now() + 3_600_000),
  };
  await assertSucceeds(addDoc(collection(db, 'broadcasts'), b));
  await assertFails(addDoc(collection(db, 'broadcasts'), { ...b, sentToApp: true }));
});

const claim = (uid, email, overrides = {}) => ({
  claimantUid: uid, claimantEmail: email, pantryId: 'p1', pantryName: 'Selma Pantry', county: 'Dallas',
  contactName: 'Ruth Jones', contactPhone: '(334) 555-0100', roleAtPantry: 'Coordinator', message: '',
  status: 'pending', createdAt: serverTimestamp(), ...overrides,
});

test('a verified newcomer with no claims can submit a pantry claim', async () => {
  const db = operator.authenticatedContext('newcomer', newcomer).firestore();
  await assertSucceeds(addDoc(collection(db, 'pantryClaims'), claim('newcomer', 'new@x.org')));
});

test('pantry claims reject unverified email, spoofed identity, preset approval and extra fields', async () => {
  await assertFails(addDoc(collection(operator.authenticatedContext('nv', unverified).firestore(), 'pantryClaims'),
    claim('nv', 'nv@x.org')));
  const db = operator.authenticatedContext('newcomer', newcomer).firestore();
  await assertFails(addDoc(collection(db, 'pantryClaims'), claim('someone-else', 'new@x.org')));
  await assertFails(addDoc(collection(db, 'pantryClaims'), claim('newcomer', 'ceo@x.org')));
  await assertFails(addDoc(collection(db, 'pantryClaims'), claim('newcomer', 'new@x.org', { status: 'approved' })));
  await assertFails(addDoc(collection(db, 'pantryClaims'), claim('newcomer', 'new@x.org', { role: 'state_admin' })));
});

test('claimants read only their own claims and can never edit them', async () => {
  const mine = operator.authenticatedContext('newcomer', newcomer).firestore();
  await assertSucceeds(getDoc(doc(mine, 'pantryClaims/c1')));
  await assertFails(updateDoc(doc(mine, 'pantryClaims/c1'), { status: 'approved' }));
  await assertFails(getDoc(doc(operator.authenticatedContext('b', staffB).firestore(), 'pantryClaims/c1')));
  await assertSucceeds(getDoc(doc(operator.authenticatedContext('admin', { role: 'state_admin', orgId: 'x', counties: [] }).firestore(), 'pantryClaims/c1')));
});

test('new pantry submissions validate the address', async () => {
  const db = operator.authenticatedContext('newcomer', newcomer).firestore();
  const s = {
    submitterUid: 'newcomer', submitterEmail: 'new@x.org', orgName: 'Grace Church', pantryName: 'Grace Pantry',
    street: '12 Main St', city: 'Selma', county: 'Dallas', zip: '36701', phone: '334-555-0100', website: '',
    hoursText: 'Saturdays 9 to noon', contactName: 'Ruth Jones', message: '', status: 'pending', createdAt: serverTimestamp(),
  };
  await assertSucceeds(addDoc(collection(db, 'newPantrySubmissions'), s));
  await assertFails(addDoc(collection(db, 'newPantrySubmissions'), { ...s, zip: '3670' }));
  await assertFails(addDoc(collection(db, 'newPantrySubmissions'), { ...s, hoursText: '' }));
});
