/**
 * tools/clearGenericRegionalWebsites.js
 *
 * The 2026-08-25 resources->agencies migration filled every pantry's *empty*
 * `website` field with its regional food bank's generic homepage "so the map
 * renders red pinpoints" (see claude.md maintenance log). That left 833 of
 * 883 active agencies pointing at one of 7 umbrella food-bank homepages
 * instead of a pantry-specific site -- "Visit Website" for any of them opens
 * a generic regional homepage with no information about that location.
 *
 * This resets `website` back to '' for docs whose current value is an exact
 * match on one of those 7 known generic URLs. map.tsx already hides the
 * "Visit Website" button entirely when website === '', so affected pantries
 * simply show no website button instead of a misleading generic link --
 * same posture as the 2026-09-01 `verified` field correction.
 *
 * Usage:
 *   node tools/clearGenericRegionalWebsites.js           # apply
 *   node tools/clearGenericRegionalWebsites.js --dry-run # report only
 */

require('dotenv').config();
const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();

const DRY_RUN = process.argv.includes('--dry-run');

// Exact-match generic regional food-bank homepages identified via a live
// Firestore audit (49 distinct website values across 883 active docs; these
// 7 alone account for 833 of them).
const GENERIC_URLS = new Set([
  'https://www.foodbankonline.org',
  'https://www.foodbanknorthal.org',
  'https://www.feedingthegulfcoast.org',
  'https://hafb.org',
  'https://wiregrassfoodbank.com',
  'https://westalabamafoodbank.org',
  'https://foodbankofeastalabama.com',
]);

async function main() {
  const snapshot = await db.collection('agencies').where('status', '==', 'active').get();

  let cleared = 0;
  const byUrl = {};

  for (const doc of snapshot.docs) {
    const website = (doc.data().website || '').trim();
    if (!GENERIC_URLS.has(website)) continue;

    byUrl[website] = (byUrl[website] || 0) + 1;
    cleared++;

    if (!DRY_RUN) {
      await doc.ref.update({ website: '' });
    }
  }

  console.log(DRY_RUN ? 'DRY RUN — no writes made.' : 'Applied.');
  console.log('Cleared website on', cleared, 'docs:');
  for (const [url, count] of Object.entries(byUrl).sort((a, b) => b[1] - a[1])) {
    console.log(' ', count, url);
  }
}

main().catch(err => {
  console.error('Failed:', err);
  process.exit(1);
});
