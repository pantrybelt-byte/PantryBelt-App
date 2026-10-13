const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
    centralToUtc, parseClockTime, computeExpiry, toPublicLiveStatus, toPublicBroadcast, sameDoc, encodeGeohash,
} = require('../lib/liveStatus');

test('centralToUtc handles daylight and standard time', () => {
    // 2026-10-13 is CDT (UTC-5); 2026-12-15 is CST (UTC-6).
    assert.equal(centralToUtc(2026, 10, 13, 17, 0).toISOString(), '2026-10-13T22:00:00.000Z');
    assert.equal(centralToUtc(2026, 12, 15, 17, 0).toISOString(), '2026-12-15T23:00:00.000Z');
});

test('parseClockTime reads 24h and 12h formats', () => {
    assert.deepEqual(parseClockTime('17:00'), { hour: 17, minute: 0 });
    assert.deepEqual(parseClockTime('5:30 PM'), { hour: 17, minute: 30 });
    assert.deepEqual(parseClockTime('5pm'), { hour: 17, minute: 0 });
    assert.deepEqual(parseClockTime('12:00 a.m.'), { hour: 0, minute: 0 });
    assert.deepEqual(parseClockTime('12 pm'), { hour: 12, minute: 0 });
    assert.equal(parseClockTime('Call for hours'), null);
    assert.equal(parseClockTime('25:00'), null);
    assert.equal(parseClockTime(undefined), null);
});

// Tuesday 2026-10-13, 10:00 CDT.
const tuesdayMorning = new Date('2026-10-13T15:00:00Z');
const sixHoursLater = new Date(tuesdayMorning.getTime() + 6 * 3_600_000);

test('computeExpiry uses today\'s posted closing time when it is still ahead', () => {
    const hours = { tuesday: { open: '09:00', close: '14:00', closed: false } };
    assert.equal(computeExpiry(hours, tuesdayMorning).toISOString(), '2026-10-13T19:00:00.000Z');
});

test('computeExpiry falls back to 6 hours without usable hours', () => {
    assert.deepEqual(computeExpiry('Tue 10:00am–12:00pm', tuesdayMorning), sixHoursLater);
    assert.deepEqual(computeExpiry(null, tuesdayMorning), sixHoursLater);
    assert.deepEqual(computeExpiry({ monday: { open: '09:00', close: '14:00' } }, tuesdayMorning), sixHoursLater);
    assert.deepEqual(computeExpiry({ tuesday: { open: '09:00', close: '14:00', closed: true } }, tuesdayMorning), sixHoursLater);
    assert.deepEqual(computeExpiry({ tuesday: { open: '09:00', close: 'noon' } }, tuesdayMorning), sixHoursLater);
});

test('computeExpiry falls back to 6 hours once today\'s close has passed', () => {
    const hours = { tuesday: { open: '07:00', close: '09:00', closed: false } };
    assert.deepEqual(computeExpiry(hours, tuesdayMorning), sixHoursLater);
});

test('toPublicLiveStatus derives isOpen and drops unknown states', () => {
    const exp = { toMillis: () => 1 };
    assert.deepEqual(
        toPublicLiveStatus({ state: 'closing_early', note: 'Weather', waitMinutes: 15, updatedAt: 'T' }, exp),
        { state: 'closing_early', isOpen: true, note: 'Weather', waitMinutes: 15, updatedAt: 'T', expiresAt: exp },
    );
    assert.equal(toPublicLiveStatus({ state: 'emergency_closed', note: '' }, exp).isOpen, false);
    assert.equal(toPublicLiveStatus({ state: 'emergency_closed', note: '' }, exp).waitMinutes, null);
    assert.equal(toPublicLiveStatus({ state: 'busy' }, exp), null);
    assert.equal(toPublicLiveStatus({ isOpen: true }, exp), null);
});

test('toPublicBroadcast carries county from the agency and no operator identity', () => {
    const doc = toPublicBroadcast(
        { orgId: 'org_1', operatorId: 'u1', title: 'Closed today', message: 'Storm', priority: 'urgent', expiresAt: 'E', createdAt: 'C', radiusMiles: 15 },
        { name: 'Selma Pantry', county: 'Dallas' },
        'p1',
    );
    assert.deepEqual(doc, {
        pantryId: 'p1', pantryName: 'Selma Pantry', county: 'Dallas', title: 'Closed today', message: 'Storm',
        language: 'English', priority: 'urgent', createdAt: 'C', expiresAt: 'E',
    });
});

test('sameDoc compares timestamps by value', () => {
    const t = (ms) => ({ toMillis: () => ms });
    assert.equal(sameDoc({ a: 1, t: t(5) }, { a: 1, t: t(5) }), true);
    assert.equal(sameDoc({ a: 1, t: t(5) }, { a: 1, t: t(6) }), false);
    assert.equal(sameDoc({ a: 1 }, { a: 1, b: 2 }), false);
});

test('encodeGeohash matches the reference value and the portal implementation', () => {
    // Reference example from the geohash spec.
    assert.equal(encodeGeohash(42.6, -5.6, 5), 'ezs42');
    // Same output as Operator-Portal/src/lib/geohash.ts for Montgomery, AL.
    assert.equal(encodeGeohash(32.3777, -86.3006), 'djf8hnjvf');
});
