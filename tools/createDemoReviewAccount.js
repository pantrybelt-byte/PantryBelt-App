/**
 * tools/createDemoReviewAccount.js
 *
 * Creates (or resets) a stable username/PIN account for Apple App Review's
 * "App Review Information → Sign-in required" credentials. The app has no
 * email verification or 2FA step, so an Admin SDK-created account behaves
 * identically to one created through the normal in-app sign-up form — there
 * is nothing to bypass.
 *
 * Uses the same synthetic-email convention as utils/auth.ts's username/PIN
 * accounts ("{username}@accessbelt.local") so it signs in through the
 * regular "Use a username instead" path on app/(auth)/signin.tsx.
 *
 * Usage:
 *   node tools/createDemoReviewAccount.js
 *
 * Prints the username + PIN once to stdout. Nothing is written to a file —
 * copy them straight into App Store Connect and store them securely there.
 */

require('dotenv').config();
const crypto = require('crypto');
const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}

const USERNAME = 'applereview';
const IDENTIFIER = `${USERNAME}@accessbelt.local`;

function randomPin() {
  // 6 digits, uniformly distributed (rejection sampling avoids modulo bias).
  const max = 1_000_000;
  const limit = Math.floor(0xFFFFFFFF / max) * max;
  let n;
  do {
    n = crypto.randomBytes(4).readUInt32BE(0);
  } while (n >= limit);
  return String(n % max).padStart(6, '0');
}

async function main() {
  const pin = randomPin();
  const auth = admin.auth();

  let uid;
  try {
    const existing = await auth.getUserByEmail(IDENTIFIER);
    await auth.updateUser(existing.uid, { password: pin });
    uid = existing.uid;
    console.log(`Existing demo review account found — password reset.`);
  } catch (err) {
    if (err.code !== 'auth/user-not-found') throw err;
    const created = await auth.createUser({ email: IDENTIFIER, password: pin });
    uid = created.uid;
    console.log(`Created new demo review account.`);
  }

  console.log('\n──────────────────────────────────────────');
  console.log(' App Store Connect → App Review Information');
  console.log('──────────────────────────────────────────');
  console.log(` Sign-in required: Yes`);
  console.log(` Username: ${USERNAME}`);
  console.log(` PIN:      ${pin}`);
  console.log(` (uid: ${uid})`);
  console.log('──────────────────────────────────────────');
  console.log(' Sign in via: Profile → Account → Sign In / Create Account');
  console.log(' → Sign In → "Use a username instead"\n');
}

main().catch(err => {
  console.error('Failed to create/reset demo review account:', err);
  process.exit(1);
});
