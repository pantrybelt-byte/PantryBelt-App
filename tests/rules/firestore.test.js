/**
 * tests/rules/firestore.test.js — Firestore security rules tests
 *
 * Run: npm run test:rules        (starts the emulator for you)
 *      npm run test:rules:ci     (same, used by .github/workflows/firebase-deploy.yml)
 *
 * These tests exist primarily to defend ONE property: adding email
 * verification in Phase 2 must not lock anonymous users out of the app.
 * That is the majority of AccessBelt's users and a governance commitment,
 * and it is the kind of regression that passes code review and only shows up
 * as a support ticket. Assert it, don't assume it.
 *
 * Uses node:test (Node 20 built-in) — no test-runner dependency.
 */

const { test, before, after, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} = require('@firebase/rules-unit-testing');
const {
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  serverTimestamp,
} = require('firebase/firestore');

let testEnv;

const PROJECT_ID = 'pantrybelt-rules-test';

// A valid _app_sessions doc — Tier 3A. Every gated write needs one to exist,
// so most tests seed it first via withSecurityRulesDisabled.
const SESSION_DOC = {
  active: true,
  appId: 'accessbelt-v3',
  platform: 'ios',
  sessionToken: 'test-session-token-000',
};

const VALID_PROFILE = {
  age: 34,
  familySize: 3,
  zipCode: '36104',
  race: 'black_african_american',
};

/** Seed a session doc for `uid`, bypassing rules. */
async function seedSession(uid) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), '_app_sessions', uid), SESSION_DOC);
  });
}

/** An anonymous app user: no email, sign_in_provider === 'anonymous'. */
function anonUser(uid) {
  return testEnv.authenticatedContext(uid, {
    firebase: { sign_in_provider: 'anonymous' },
  });
}

/** A signed-up user who has NOT clicked the verification link. */
function unverifiedUser(uid) {
  return testEnv.authenticatedContext(uid, {
    email: 'someone@example.com',
    email_verified: false,
    firebase: { sign_in_provider: 'password' },
  });
}

/** A signed-up user who HAS verified their email. */
function verifiedUser(uid) {
  return testEnv.authenticatedContext(uid, {
    email: 'someone@example.com',
    email_verified: true,
    firebase: { sign_in_provider: 'password' },
  });
}

/** An operator with role claims. `verified` toggles email_verified. */
function operator(uid, role, orgId, counties, verified) {
  return testEnv.authenticatedContext(uid, {
    email: 'operator@example.org',
    email_verified: verified,
    firebase: { sign_in_provider: 'password' },
    role,
    orgId,
    counties,
  });
}

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: fs.readFileSync(path.resolve(__dirname, '../../firestore.rules'), 'utf8'),
      host: '127.0.0.1',
      // 8085, not the 8080 in firebase.json — see firebase.test.json for why.
      port: Number(process.env.FIRESTORE_EMULATOR_PORT || 8085),
    },
  });
});

after(async () => {
  if (testEnv) await testEnv.cleanup();
});

// ───────────────────────────────────────────────────────────────────────────
describe('anonymous users are never gated by email verification', () => {
  test('anonymous user can write its own _app_sessions doc', async () => {
    const uid = 'anon-1';
    const db = anonUser(uid).firestore();
    await assertSucceeds(setDoc(doc(db, '_app_sessions', uid), SESSION_DOC));
  });

  test('anonymous user can create its own user_profiles doc', async () => {
    const uid = 'anon-2';
    await seedSession(uid);
    const db = anonUser(uid).firestore();
    await assertSucceeds(
      setDoc(doc(db, 'user_profiles', uid), { ...VALID_PROFILE, updatedAt: serverTimestamp() })
    );
  });

  test('anonymous user can update its own user_profiles doc', async () => {
    const uid = 'anon-3';
    await seedSession(uid);
    const db = anonUser(uid).firestore();
    await assertSucceeds(setDoc(doc(db, 'user_profiles', uid), VALID_PROFILE));
    await assertSucceeds(setDoc(doc(db, 'user_profiles', uid), { ...VALID_PROFILE, familySize: 4 }));
  });

  test('anonymous user can read its own user_profiles doc', async () => {
    const uid = 'anon-4';
    await seedSession(uid);
    const db = anonUser(uid).firestore();
    await assertSucceeds(getDoc(doc(db, 'user_profiles', uid)));
  });

  test('anonymous user can delete its own profile (App Store 5.1.1(v))', async () => {
    const uid = 'anon-5';
    await seedSession(uid);
    const db = anonUser(uid).firestore();
    await assertSucceeds(setDoc(doc(db, 'user_profiles', uid), VALID_PROFILE));
    await assertSucceeds(deleteDoc(doc(db, 'user_profiles', uid)));
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe('account holders must verify their email before writing', () => {
  test('UNVERIFIED account holder cannot write its profile', async () => {
    const uid = 'unverified-1';
    await seedSession(uid);
    const db = unverifiedUser(uid).firestore();
    await assertFails(setDoc(doc(db, 'user_profiles', uid), VALID_PROFILE));
  });

  test('VERIFIED account holder can write its profile', async () => {
    const uid = 'verified-1';
    await seedSession(uid);
    const db = verifiedUser(uid).firestore();
    await assertSucceeds(setDoc(doc(db, 'user_profiles', uid), VALID_PROFILE));
  });

  test('UNVERIFIED account holder can still READ (reads are never gated)', async () => {
    const uid = 'unverified-2';
    await seedSession(uid);
    const db = unverifiedUser(uid).firestore();
    await assertSucceeds(getDoc(doc(db, 'user_profiles', uid)));
  });

  test('UNVERIFIED account holder can still DELETE its own data', async () => {
    const uid = 'unverified-3';
    await seedSession(uid);
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'user_profiles', uid), VALID_PROFILE);
    });
    const db = unverifiedUser(uid).firestore();
    await assertSucceeds(deleteDoc(doc(db, 'user_profiles', uid)));
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe('cross-user isolation', () => {
  test('a user cannot read another user profile', async () => {
    await seedSession('victim');
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'user_profiles', 'victim'), VALID_PROFILE);
    });
    await seedSession('attacker');
    const db = anonUser('attacker').firestore();
    await assertFails(getDoc(doc(db, 'user_profiles', 'victim')));
  });

  test('a user cannot write another user profile', async () => {
    await seedSession('attacker-2');
    const db = anonUser('attacker-2').firestore();
    await assertFails(setDoc(doc(db, 'user_profiles', 'victim-2'), VALID_PROFILE));
  });

  test('a user cannot write another user session doc', async () => {
    const db = anonUser('attacker-3').firestore();
    await assertFails(setDoc(doc(db, '_app_sessions', 'someone-else'), SESSION_DOC));
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe('operator writes require a verified email', () => {
  const AGENCY = {
    orgId: 'org-1',
    name: 'Test Pantry',
    county: 'Montgomery',
    status: 'active',
    coordinates: { lat: 32.3, lng: -86.3 },
    geohash: 'djfq',
  };

  test('VERIFIED org_staff can create an agency in its own county', async () => {
    const db = operator('op-1', 'org_staff', 'org-1', ['Montgomery'], true).firestore();
    await assertSucceeds(setDoc(doc(db, 'agencies', 'agency-ok'), AGENCY));
  });

  test('UNVERIFIED org_staff cannot create an agency', async () => {
    const db = operator('op-2', 'org_staff', 'org-1', ['Montgomery'], false).firestore();
    await assertFails(setDoc(doc(db, 'agencies', 'agency-blocked'), AGENCY));
  });

  test('verified operator cannot write outside its authorized counties', async () => {
    const db = operator('op-3', 'org_staff', 'org-1', ['Dallas'], true).firestore();
    await assertFails(setDoc(doc(db, 'agencies', 'agency-wrong-county'), AGENCY));
  });

  test('verified operator cannot write for another org', async () => {
    const db = operator('op-4', 'org_staff', 'org-2', ['Montgomery'], true).firestore();
    await assertFails(setDoc(doc(db, 'agencies', 'agency-wrong-org'), AGENCY));
  });

  test('anonymous user cannot create an agency', async () => {
    const db = anonUser('anon-agency').firestore();
    await assertFails(setDoc(doc(db, 'agencies', 'agency-anon'), AGENCY));
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe('analytics require an active app session (Tier 3A)', () => {
  test('profile write is denied without a session doc', async () => {
    // No seedSession() — this is the whole point of the test.
    const db = anonUser('no-session').firestore();
    await assertFails(setDoc(doc(db, 'user_profiles', 'no-session'), VALID_PROFILE));
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe('profile schema validation', () => {
  test('rejects an out-of-range age', async () => {
    const uid = 'bad-age';
    await seedSession(uid);
    const db = anonUser(uid).firestore();
    await assertFails(setDoc(doc(db, 'user_profiles', uid), { ...VALID_PROFILE, age: 7 }));
  });

  test('rejects a malformed zip code', async () => {
    const uid = 'bad-zip';
    await seedSession(uid);
    const db = anonUser(uid).firestore();
    await assertFails(setDoc(doc(db, 'user_profiles', uid), { ...VALID_PROFILE, zipCode: 'ABCDE' }));
  });

  test('accepts a plaintext zipCode — it is deliberately NOT encrypted', async () => {
    const uid = 'plain-zip';
    await seedSession(uid);
    const db = anonUser(uid).firestore();
    await assertSucceeds(setDoc(doc(db, 'user_profiles', uid), { ...VALID_PROFILE, zipCode: '36701' }));
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe('function-owned collections are closed to all clients', () => {
  for (const coll of ['password_reset_tokens', 'kms_rate_limits', 'pete_rate_limits']) {
    test(`${coll} is not readable or writable by a client`, async () => {
      const db = verifiedUser('anyone').firestore();
      await assertFails(getDoc(doc(db, coll, 'x')));
      await assertFails(setDoc(doc(db, coll, 'x'), { count: 0 }));
    });
  }
});

// ───────────────────────────────────────────────────────────────────────────
describe('Operator Portal self-service update (Phase 5)', () => {
  const AGENCY_ID = 'portal-agency-1';
  const OPERATOR_UID = 'operator-portal-uid';
  const WRONG_UID = 'wrong-uid';

  // Seed a full agency doc with operatorPortalAccess + operatorUid before each test.
  const AGENCY_DOC = {
    orgId: 'org-portal',
    name: 'Portal Test Pantry',
    county: 'Dallas',
    status: 'active',
    verified: false,
    coordinates: { lat: 32.407, lng: -87.021 },
    geohash: 'djfq1234',
    phone: '(334) 555-0000',
    website: '',
    eligibility: '',
    hours: 'Mon-Fri 9am-3pm',
    operatorPortalAccess: true,
    operatorUid: OPERATOR_UID,
  };

  /** A verified email/password user acting as a portal operator. */
  function portalOperator(uid) {
    return testEnv.authenticatedContext(uid, {
      email: 'operator@pantry.org',
      email_verified: true,
      firebase: { sign_in_provider: 'password' },
    });
  }

  /** Same user but with email_verified: false. */
  function unverifiedPortalOperator(uid) {
    return testEnv.authenticatedContext(uid, {
      email: 'operator@pantry.org',
      email_verified: false,
      firebase: { sign_in_provider: 'password' },
    });
  }

  async function seedAgency() {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'agencies', AGENCY_ID), AGENCY_DOC);
    });
  }

  test('DENIED: unverified operator cannot update via portal path', async () => {
    await seedAgency();
    const db = unverifiedPortalOperator(OPERATOR_UID).firestore();
    await assertFails(updateDoc(doc(db, 'agencies', AGENCY_ID), {
      phone: '(334) 555-9999',
      updatedAt: serverTimestamp(),
      lastOperatorEdit: serverTimestamp(),
    }));
  });

  test('DENIED: wrong uid cannot update even with valid fields', async () => {
    await seedAgency();
    const db = portalOperator(WRONG_UID).firestore();
    await assertFails(updateDoc(doc(db, 'agencies', AGENCY_ID), {
      phone: '(334) 555-9999',
      updatedAt: serverTimestamp(),
      lastOperatorEdit: serverTimestamp(),
    }));
  });

  test('DENIED: operator cannot change coordinates', async () => {
    await seedAgency();
    const db = portalOperator(OPERATOR_UID).firestore();
    await assertFails(updateDoc(doc(db, 'agencies', AGENCY_ID), {
      coordinates: { lat: 99.0, lng: -99.0 },
      updatedAt: serverTimestamp(),
      lastOperatorEdit: serverTimestamp(),
    }));
  });

  test('DENIED: operator cannot change status', async () => {
    await seedAgency();
    const db = portalOperator(OPERATOR_UID).firestore();
    await assertFails(updateDoc(doc(db, 'agencies', AGENCY_ID), {
      status: 'inactive',
      updatedAt: serverTimestamp(),
      lastOperatorEdit: serverTimestamp(),
    }));
  });

  test('DENIED: operator cannot change verified flag', async () => {
    await seedAgency();
    const db = portalOperator(OPERATOR_UID).firestore();
    await assertFails(updateDoc(doc(db, 'agencies', AGENCY_ID), {
      verified: true,
      updatedAt: serverTimestamp(),
      lastOperatorEdit: serverTimestamp(),
    }));
  });

  test('ALLOWED: exact payload PantryAdmin sends with structuredHours and timestamps', async () => {
    await seedAgency();
    const db = portalOperator(OPERATOR_UID).firestore();
    await assertSucceeds(updateDoc(doc(db, 'agencies', AGENCY_ID), {
      phone: '(334) 555-1234',
      website: 'https://mypantry.org',
      eligibility: 'All Dallas County residents',
      hours: 'Mon-Sat 8am-4pm',
      structuredHours: {
        monday: { open: '09:00', close: '15:00', closed: false },
        tuesday: { open: '09:00', close: '15:00', closed: false },
      },
      updatedAt: serverTimestamp(),
      lastOperatorEdit: serverTimestamp(),
    }));
  });

  test('DENIED: operator cannot update when operatorPortalAccess is false', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'agencies', AGENCY_ID), {
        ...AGENCY_DOC,
        operatorPortalAccess: false,
      });
    });
    const db = portalOperator(OPERATOR_UID).firestore();
    await assertFails(updateDoc(doc(db, 'agencies', AGENCY_ID), {
      phone: '(334) 555-1234',
      updatedAt: serverTimestamp(),
      lastOperatorEdit: serverTimestamp(),
    }));
  });

  test('DENIED: operator cannot change operatorUid or operatorPortalAccess', async () => {
    await seedAgency();
    const db = portalOperator(OPERATOR_UID).firestore();
    await assertFails(updateDoc(doc(db, 'agencies', AGENCY_ID), {
      operatorUid: 'new-uid',
      updatedAt: serverTimestamp(),
      lastOperatorEdit: serverTimestamp(),
    }));
    await assertFails(updateDoc(doc(db, 'agencies', AGENCY_ID), {
      operatorPortalAccess: false,
      updatedAt: serverTimestamp(),
      lastOperatorEdit: serverTimestamp(),
    }));
  });

  test('DENIED: wrong-typed phone or website is rejected', async () => {
    await seedAgency();
    const db = portalOperator(OPERATOR_UID).firestore();
    await assertFails(updateDoc(doc(db, 'agencies', AGENCY_ID), {
      phone: 1234567890,
      updatedAt: serverTimestamp(),
      lastOperatorEdit: serverTimestamp(),
    }));
    await assertFails(updateDoc(doc(db, 'agencies', AGENCY_ID), {
      website: true,
      updatedAt: serverTimestamp(),
      lastOperatorEdit: serverTimestamp(),
    }));
  });

  test('DENIED: unauthenticated user cannot update agency', async () => {
    await seedAgency();
    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(updateDoc(doc(db, 'agencies', AGENCY_ID), {
      phone: '(334) 555-1234',
      updatedAt: serverTimestamp(),
      lastOperatorEdit: serverTimestamp(),
    }));
  });

  test('ALLOWED: operator list query by operatorUid on active agencies', async () => {
    await seedAgency();
    const db = portalOperator(OPERATOR_UID).firestore();
    const q = query(
      collection(db, 'agencies'),
      where('operatorUid', '==', OPERATOR_UID),
      where('operatorPortalAccess', '==', true),
      where('status', '==', 'active')
    );
    const result = await assertSucceeds(getDocs(q));
    assert.ok(result.size > 0, 'Query should return at least 1 agency');
  });
});
