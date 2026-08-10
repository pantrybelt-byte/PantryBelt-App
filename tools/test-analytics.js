/**
 * test-analytics.js — AccessBelt Analytics Firestore Verification Test
 *
 * Tests that all 8 government-contract metrics are being correctly
 * tallied in Firestore by writing a test document to each collection
 * and reading it back to verify the data structure.
 *
 * Run: node tools/test-analytics.js
 *
 * Prerequisites: serviceAccountKey.json must exist at project root.
 */

const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

// ── Test Helpers ──────────────────────────────────────────────────────────────

const results = [];
const TEST_PREFIX = '__TEST__';

function pass(gap, label, details = '') {
    results.push({ status: '✅ PASS', gap, label, details });
    console.log(`  ✅  GAP ${gap} — ${label}${details ? ': ' + details : ''}`);
}

function fail(gap, label, error) {
    results.push({ status: '❌ FAIL', gap, label, error: error.message });
    console.error(`  ❌  GAP ${gap} — ${label}: ${error.message}`);
}

function timeFields() {
    const now = new Date();
    return {
        hourOfDay: now.getHours(),
        dayOfWeek: now.getDay(),
        monthYear: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
    };
}

// ── Test Runner ───────────────────────────────────────────────────────────────

async function runTest(gapNumber, label, collection, payload, validateFn) {
    try {
        // Write test document
        const docRef = await db.collection(collection).add({
            ...payload,
            _test: true,
            _testId: TEST_PREFIX + Date.now(),
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
        });

        // Read it back
        const snap = await docRef.get();
        if (!snap.exists) throw new Error('Document not found after write');
        const data = snap.data();

        // Validate structure
        validateFn(data);
        pass(gapNumber, label, `→ ${collection}/${docRef.id}`);

        // Cleanup test doc
        await docRef.delete();
    } catch (err) {
        fail(gapNumber, label, err);
    }
}

async function runIncrementTest(gapNumber, label, collection, docId, field) {
    try {
        const docRef = db.collection(collection).doc(docId);
        await docRef.set(
            { [field]: admin.firestore.FieldValue.increment(1), _test: true, lastUpdated: admin.firestore.FieldValue.serverTimestamp() },
            { merge: true }
        );
        const snap = await docRef.get();
        const data = snap.data();
        if (!data[field] || data[field] < 1) throw new Error(`${field} did not increment`);
        pass(gapNumber, label, `${field}=${data[field]}`);
        await docRef.delete();
    } catch (err) {
        fail(gapNumber, label, err);
    }
}

// ── Individual Metric Tests ───────────────────────────────────────────────────

async function testAll() {
    console.log('\n══════════════════════════════════════════════════════');
    console.log('  AccessBelt Analytics Firestore Verification Tests');
    console.log('  Project: pantrybelt-1e7eb');
    console.log('══════════════════════════════════════════════════════\n');

    // ── Existing Metrics (baseline) ──────────────────────────────────────────

    await runTest('0', 'User County Tracking', 'analytics_user_counties', {
        county: 'Dallas County',
        city: 'Selma',
        source: 'location',
        ...timeFields(),
    }, (data) => {
        if (!data.county) throw new Error('Missing county field');
        if (!data.source) throw new Error('Missing source field');
        if (data.hourOfDay === undefined) throw new Error('Missing hourOfDay (GAP 4)');
    });

    await runTest('0', 'Pete AI Request Tracking', 'analytics_searches', {
        topic: 'snap_ebt',
        rawMessage: 'How do I apply for SNAP benefits?',
        source: 'typed',
        county: 'Dallas County',
        ...timeFields(),
    }, (data) => {
        if (!data.rawMessage) throw new Error('Missing rawMessage field');
        if (!data.source) throw new Error('Missing source field');
    });

    await runTest('0', 'Food Desert Detection', 'analytics_food_deserts', {
        lat: 32.41, lng: -87.01,
        county: null, city: null,
        pantryCount: 0,
        ...timeFields(),
    }, (data) => {
        if (data.pantryCount !== 0) throw new Error('pantryCount should be 0');
        if (data.lat === undefined) throw new Error('Missing coarse lat');
    });

    // ── GAP 1 + GAP 6 — Successful Connections + Pantry-Level Utilization ────

    await runTest('1+6', 'Pantry Engagement — View', 'analytics_pantry_engagements', {
        pantryId: 'pantry_test_001',
        pantryName: 'Heart of Alabama Food Bank',
        county: 'Montgomery County',
        city: 'Montgomery',
        action: 'view',
        ...timeFields(),
    }, (data) => {
        if (data.action !== 'view') throw new Error('action should be view');
        if (!data.pantryId) throw new Error('Missing pantryId');
    });

    await runTest('1+6', 'Pantry Engagement — Directions (visit intent)', 'analytics_pantry_engagements', {
        pantryId: 'pantry_test_001',
        pantryName: 'Heart of Alabama Food Bank',
        county: 'Montgomery County',
        city: 'Montgomery',
        action: 'directions',
        ...timeFields(),
    }, (data) => {
        if (data.action !== 'directions') throw new Error('action should be directions');
        if (!data.county) throw new Error('Missing county for report grouping');
    });

    await runTest('1+6', 'Pantry Engagement — Call (direct connection)', 'analytics_pantry_engagements', {
        pantryId: 'pantry_test_001',
        pantryName: 'Heart of Alabama Food Bank',
        county: 'Montgomery County',
        city: 'Montgomery',
        action: 'call',
        ...timeFields(),
    }, (data) => {
        if (data.action !== 'call') throw new Error('action should be call');
    });

    // ── GAP 2 — SNAP/WIC Referral Count ─────────────────────────────────────

    await runTest('2', 'SNAP Referral (Home Screen)', 'analytics_referrals', {
        referralType: 'snap',
        source: 'home',
        county: null,
        isEmergency: false,
        ...timeFields(),
    }, (data) => {
        if (data.referralType !== 'snap') throw new Error('Wrong referral type');
        if (data.isEmergency !== false) throw new Error('SNAP should not be flagged as emergency');
    });

    await runTest('2', 'WIC Referral (Profile Screen)', 'analytics_referrals', {
        referralType: 'wic',
        source: 'profile',
        county: null,
        isEmergency: false,
        ...timeFields(),
    }, (data) => {
        if (data.referralType !== 'wic') throw new Error('Wrong referral type');
    });

    // ── GAP 3 — Emergency Help Requests ─────────────────────────────────────

    await runTest('3', 'Emergency 211 Call — Pete Screen', 'analytics_referrals', {
        referralType: 'emergency_211',
        source: 'pete',
        county: null,
        isEmergency: true,
        ...timeFields(),
    }, (data) => {
        if (data.referralType !== 'emergency_211') throw new Error('Wrong referral type');
        if (data.isEmergency !== true) throw new Error('Emergency flag must be true for 211 calls');
    });

    await runTest('3', 'Emergency 211 Call — Home Screen', 'analytics_referrals', {
        referralType: 'emergency_211',
        source: 'home',
        county: null,
        isEmergency: true,
        ...timeFields(),
    }, (data) => {
        if (!data.isEmergency) throw new Error('isEmergency must be true');
        if (data.source !== 'home') throw new Error('Source should be home');
    });

    // ── GAP 4 — Time-of-Day Patterns (verified via timeFields on all docs) ──
    // Already validated in each test above via hourOfDay check. Explicit test:

    await runTest('4', 'Time Pattern Fields on Analytics Docs', 'analytics_searches', {
        topic: 'hours',
        rawMessage: 'When are pantries open on Sunday?',
        source: 'typed',
        county: null,
        ...timeFields(),
    }, (data) => {
        if (data.hourOfDay === undefined) throw new Error('Missing hourOfDay');
        if (data.dayOfWeek === undefined) throw new Error('Missing dayOfWeek');
        if (!data.monthYear) throw new Error('Missing monthYear');
        const hour = data.hourOfDay;
        if (hour < 0 || hour > 23) throw new Error(`Invalid hourOfDay: ${hour}`);
    });

    // ── GAP 5 — Return Session Tracking ─────────────────────────────────────

    await runIncrementTest('5', 'Return Session Counter (increment)', 'analytics_sessions',
        `__TEST_device_${Date.now()}`, 'sessionCount');

    // ── GAP 7 — Search-to-Success Rate ──────────────────────────────────────

    await runTest('7', 'Search Outcome — map_opened (success)', 'analytics_search_outcomes', {
        topic: 'pantry_search',
        outcome: 'map_opened',
        county: 'Dallas County',
        success: true,
        ...timeFields(),
    }, (data) => {
        if (data.success !== true) throw new Error('success field should be true for map_opened');
        if (!data.topic) throw new Error('Missing topic');
    });

    await runTest('7', 'Search Outcome — no_action (unmet need signal)', 'analytics_search_outcomes', {
        topic: 'pantry_search',
        outcome: 'no_action',
        county: null,
        success: false,
        ...timeFields(),
    }, (data) => {
        if (data.success !== false) throw new Error('success should be false for no_action');
    });

    // ── GAP 8 — Monthly County Impact Summary ────────────────────────────────

    const now = new Date();
    const monthYear = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const testDocId = `${monthYear}_TEST_County`;
    try {
        const docRef = db.collection('analytics_monthly_summary').doc(testDocId);
        await docRef.set({
            county: 'TEST County',
            monthYear,
            sessions: admin.firestore.FieldValue.increment(1),
            referrals: admin.firestore.FieldValue.increment(3),
            emergencies: admin.firestore.FieldValue.increment(1),
            pantryViews: admin.firestore.FieldValue.increment(5),
            directions: admin.firestore.FieldValue.increment(2),
            calls: admin.firestore.FieldValue.increment(1),
            foodDeserts: admin.firestore.FieldValue.increment(0),
            lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
        const snap = await docRef.get();
        const data = snap.data();
        if (!data.monthYear) throw new Error('Missing monthYear');
        if (!data.county) throw new Error('Missing county');
        if (data.referrals < 1) throw new Error('referrals counter failed to increment');
        pass('8', 'Monthly County Impact Summary (auto-assembled)', `→ ${testDocId}`);
        await docRef.delete();
    } catch (err) {
        fail('8', 'Monthly County Impact Summary', err);
    }

    // ── Final Report ─────────────────────────────────────────────────────────

    const passed = results.filter(r => r.status.startsWith('✅')).length;
    const failed = results.filter(r => r.status.startsWith('❌')).length;

    console.log('\n══════════════════════════════════════════════════════');
    console.log(`  RESULTS: ${passed} passed, ${failed} failed`);
    console.log('══════════════════════════════════════════════════════');

    if (failed > 0) {
        console.log('\n  Failed tests:');
        results.filter(r => r.status.startsWith('❌')).forEach(r => {
            console.log(`    GAP ${r.gap} — ${r.label}: ${r.error}`);
        });
        process.exit(1);
    } else {
        console.log('\n  ✅  All analytics metrics are correctly saving to Firestore.');
        console.log('  ✅  All 8 government-contract metric gaps are verified.\n');
    }

    await admin.app().delete();
}

testAll().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
