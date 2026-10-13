/**
 * Unit tests for config/emulatorGuard.ts — the production-safety guard for
 * emulator mode. Pure logic, no emulator needed: `npm run test:guard`.
 */
const { test } = require('node:test');
const assert = require('node:assert');
const { resolveEmulatorSettings, PRODUCTION_PROJECT_ID } = require('../config/emulatorGuard.ts');

test('flag off returns null in dev and in release', () => {
  assert.strictEqual(resolveEmulatorSettings({}, true), null);
  assert.strictEqual(resolveEmulatorSettings({ USE_EMULATORS: 'false' }, false), null);
});

test('flag on in a release build throws', () => {
  assert.throws(() => resolveEmulatorSettings({ USE_EMULATORS: 'true' }, false), /non-development/);
});

test('flag on in dev defaults to demo project and loopback', () => {
  const s = resolveEmulatorSettings({ USE_EMULATORS: 'true' }, true);
  assert.strictEqual(s.projectId, 'demo-accessbelt');
  assert.strictEqual(s.host, '127.0.0.1');
});

test('production project id is rejected', () => {
  assert.throws(
    () => resolveEmulatorSettings({ USE_EMULATORS: 'true', PROJECT_ID: PRODUCTION_PROJECT_ID }, true),
    /demo-/
  );
});

test('non-demo project id is rejected', () => {
  assert.throws(() => resolveEmulatorSettings({ USE_EMULATORS: 'true', PROJECT_ID: 'my-staging' }, true), /demo-/);
});

test('public hosts are rejected, private ones allowed', () => {
  for (const host of ['firestore.googleapis.com', '8.8.8.8', '127.0.0.1.evil.com']) {
    assert.throws(() => resolveEmulatorSettings({ USE_EMULATORS: 'true', EMULATOR_HOST: host }, true), /private/);
  }
  for (const host of ['localhost', '10.0.2.2', '192.168.1.20', '172.20.0.5']) {
    assert.strictEqual(resolveEmulatorSettings({ USE_EMULATORS: 'true', EMULATOR_HOST: host }, true).host, host);
  }
});
