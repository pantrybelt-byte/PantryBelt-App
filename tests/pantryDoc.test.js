/**
 * Unit tests for utils/pantryDoc.ts — the agencies doc -> map Pantry mapper
 * shared by the list fetch and the single-pantry live listener. `npm run test:guard`.
 */
const { test } = require('node:test');
const assert = require('node:assert');
const { describeLiveStatus, docToPantry, formatHours, isLiveStatusFresh, LIVE_STATUS_MAX_AGE_MS } = require('../utils/pantryDoc.ts');

const helpers = { sanitizeWebsite: (_id, u) => u, computeMapEligible: () => true };
const BASE = {
  name: 'Demo', county: 'Montgomery',
  coordinates: { lat: 32.3, lng: -86.3 },
  address: { street: '1 Main St', city: 'Montgomery', state: 'AL', zip: '36104' },
};

test('maps core fields like the list fetch always did', () => {
  const p = docToPantry('a1', { ...BASE, phone: '555', eligibilityNotes: 'All', docsRequired: ['ID', 'Proof'], hours: 'Mon 9-12' }, helpers);
  assert.strictEqual(p.address, '1 Main St, Montgomery, AL, 36104');
  assert.strictEqual(p.eligibility, 'All');
  assert.strictEqual(p.docs, 'ID, Proof');
  assert.strictEqual(p.hours, 'Mon 9-12');
  assert.strictEqual(p.liveStatus, null);
});

test('legacy weekday-map hours still format', () => {
  assert.strictEqual(
    formatHours({ monday: { open: '09:00', close: '15:00', closed: false }, tuesday: { closed: true } }),
    'Mon 09:00–15:00'
  );
});

test('liveStatus parses and reports freshness', () => {
  const now = Date.now();
  const p = docToPantry('a1', { ...BASE, liveStatus: { isOpen: false, note: 'Back at 2', updatedAt: { toMillis: () => now - 1000 } } }, helpers);
  assert.deepStrictEqual({ isOpen: p.liveStatus.isOpen, note: p.liveStatus.note }, { isOpen: false, note: 'Back at 2' });
  assert.ok(isLiveStatusFresh(p.liveStatus, now));
  assert.ok(!isLiveStatusFresh(p.liveStatus, now + LIVE_STATUS_MAX_AGE_MS + 5000), 'stale after 12h');
});

test('liveStatus with no timestamp or bad shape is never shown', () => {
  assert.strictEqual(isLiveStatusFresh(docToPantry('a', { ...BASE, liveStatus: { isOpen: true, note: '' } }, helpers).liveStatus, Date.now()), false);
  assert.strictEqual(docToPantry('a', { ...BASE, liveStatus: { isOpen: 'yes' } }, helpers).liveStatus, null);
  assert.strictEqual(isLiveStatusFresh(null, Date.now()), false);
});

test('green-tier inputs come from the doc', () => {
  const p = docToPantry('a', { ...BASE, verified: true, operatorPortalAccess: true, miniProfile: { description: 'x' } }, helpers);
  assert.ok(p.verified && p.operatorPortalAccess && p.hasMiniProfile);
  const q = docToPantry('a', { ...BASE, miniProfile: null }, helpers);
  assert.strictEqual(q.hasMiniProfile, false);
});

test('4-state status: wait time, expiry, and fallback for the original {isOpen, note} shape', () => {
  const now = Date.now();
  const ms = (offset) => ({ toMillis: () => now + offset });
  const p = docToPantry('a', { ...BASE, liveStatus: {
    state: 'closing_early', isOpen: true, note: 'Closing at 2', waitMinutes: 20, updatedAt: ms(-1000), expiresAt: ms(3_600_000),
  } }, helpers).liveStatus;
  assert.strictEqual(p.state, 'closing_early');
  assert.strictEqual(p.isOpen, true);
  assert.strictEqual(p.waitMinutes, 20);
  assert.ok(isLiveStatusFresh(p, now));
  assert.ok(!isLiveStatusFresh(p, now + 3_600_001), 'expires at expiresAt even inside 12h');

  const legacy = docToPantry('a', { ...BASE, liveStatus: { isOpen: false, note: '', updatedAt: ms(-1000) } }, helpers).liveStatus;
  assert.strictEqual(legacy.state, 'closed');
  assert.strictEqual(legacy.waitMinutes, null);
  assert.strictEqual(legacy.expiresAtMs, null);
  assert.ok(isLiveStatusFresh(legacy, now));

  const unknown = docToPantry('a', { ...BASE, liveStatus: { state: 'busy', isOpen: true, note: '', updatedAt: ms(0) } }, helpers).liveStatus;
  assert.strictEqual(unknown.state, 'open');
});

test('describeLiveStatus shows wait only while open', () => {
  const base = { note: '', updatedAtMs: null, expiresAtMs: null };
  assert.strictEqual(describeLiveStatus({ ...base, state: 'open', isOpen: true, waitMinutes: 0 }), 'No wait');
  assert.strictEqual(describeLiveStatus({ ...base, state: 'open', isOpen: true, waitMinutes: 15 }), 'Wait about 15 min');
  assert.strictEqual(describeLiveStatus({ ...base, state: 'closed', isOpen: false, waitMinutes: 15 }), '');
});
