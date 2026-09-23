/**
 * tools/clearBetaReset.js
 *
 * Beta launch reset — wipes all pre-beta session/analytics/feedback data
 * so that only clean beta-era data is recorded going forward.
 *
 * KEEPS: agencies, waitlist, android_testers, organizations, users
 * DELETES: everything else
 *
 * Admin SDK — bypasses Firestore rules. Run once before beta launch.
 * Usage: node tools/clearBetaReset.js
 *        node tools/clearBetaReset.js --dry-run   (preview only, no deletes)
 */

'use strict';

const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const DRY_RUN = process.argv.includes('--dry-run');

const svcKey = require('/Users/Thad/.config/accessbelt/serviceAccountKey.json');
initializeApp({ credential: cert(svcKey) });
const db = getFirestore();

// Collections to keep intact — everything else is deleted.
const KEEP = new Set([
  'agencies',
  'waitlist',
  'android_testers',
  'organizations',
  'users',
]);

const BATCH_SIZE = 400; // Firestore max batch write = 500

async function deleteCollection(colId) {
  let totalDeleted = 0;
  let lastDoc = null;

  while (true) {
    let q = db.collection(colId).limit(BATCH_SIZE);
    if (lastDoc) q = q.startAfter(lastDoc);

    const snap = await q.get();
    if (snap.empty) break;

    const batch = db.batch();
    snap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();

    totalDeleted += snap.docs.length;
    lastDoc = snap.docs[snap.docs.length - 1];
    process.stdout.write(`\r  deleted ${totalDeleted} docs from ${colId}...`);
  }

  return totalDeleted;
}

async function main() {
  console.log(DRY_RUN ? '\n🔍 DRY RUN — no data will be deleted\n' : '\n🔥 BETA RESET — deleting pre-beta data\n');

  const cols = await db.listCollections();

  const toDelete = cols.filter(c => !KEEP.has(c.id));
  const toKeep   = cols.filter(c =>  KEEP.has(c.id));

  console.log('KEEPING:');
  for (const col of toKeep) {
    const snap = await db.collection(col.id).count().get();
    console.log(`  ✅  ${col.id} (${snap.data().count} docs)`);
  }

  console.log('\nDELETING:');
  for (const col of toDelete) {
    const snap = await db.collection(col.id).count().get();
    const count = snap.data().count;

    if (DRY_RUN) {
      console.log(`  🗑️  ${col.id} (${count} docs) — skipped (dry run)`);
      continue;
    }

    process.stdout.write(`  🗑️  ${col.id} (${count} docs)...`);
    const deleted = await deleteCollection(col.id);
    console.log(`\r  🗑️  ${col.id} — deleted ${deleted} docs          `);
  }

  console.log('\n✅  Done.');
  if (DRY_RUN) console.log('Run without --dry-run to execute the actual deletes.');
}

main().catch(err => {
  console.error('\n❌  Error:', err.message);
  process.exit(1);
});
