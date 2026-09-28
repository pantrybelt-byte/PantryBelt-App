#!/usr/bin/env node
/**
 * tools/migrateFamiliesToUsersReached.js — Phase 5 field rename migration
 *
 *   node tools/migrateFamiliesToUsersReached.js            # dry run (default)
 *   node tools/migrateFamiliesToUsersReached.js --write     # apply
 *
 * Renames the Operator Portal's impact metrics on the shared `(default)`
 * database, to match the portal rename in Operator-Portal@phase5-schema-rename:
 *
 *   familiesReached       -> usersReached
 *   totalFamiliesReached  -> totalUsersReached
 *   capacityPercentage    -> inventoryCapacityPercentage
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THIS CURRENTLY AFFECTS ZERO DOCUMENTS — AND THAT IS THE EXPECTED RESULT
 * ─────────────────────────────────────────────────────────────────────────────
 * As of 2026-09-28 none of these three fields exists on any document in
 * `agencies` (884 docs) or `resources` (0 docs). They live only in the portal's
 * TypeScript types and src/data/mockData.ts, because the portal has never run
 * against real Firestore — it ships with VITE_USE_FIREBASE unset.
 *
 * So this script is not a no-op by mistake. It exists because the portal is one
 * env var away from writing these fields for real, and at that point the old
 * names could reappear from any operator still on a cached bundle. Running it
 * then is what makes the rename safe. It is idempotent: re-running it after a
 * clean run finds nothing and changes nothing.
 *
 * WHY IT TARGETS `agencies` AND NOT `resources`
 * The consumer app renamed `resources` -> `agencies` on 2026-08-25. The portal
 * was never updated and still pointed at `resources`, which is empty; that bug
 * is fixed in the same branch as this script. The live data is in `agencies`.
 *
 * Uses the Admin SDK, so it bypasses security rules. Requires
 * GOOGLE_APPLICATION_CREDENTIALS (see .env.example).
 */

const admin = require('firebase-admin');

const WRITE = process.argv.includes('--write');
const COLLECTION = 'agencies';
const BATCH_LIMIT = 400;

const RENAMES = [
    ['familiesReached', 'usersReached'],
    ['totalFamiliesReached', 'totalUsersReached'],
    ['capacityPercentage', 'inventoryCapacityPercentage'],
];

async function main() {
    if (admin.apps.length === 0) {
        admin.initializeApp({ projectId: 'pantrybelt-1e7eb' });
    }
    const db = admin.firestore();

    console.log(`\nField rename migration on \`${COLLECTION}\``);
    console.log(`Mode: ${WRITE ? 'WRITE' : 'DRY RUN (no writes)'}`);
    for (const [from, to] of RENAMES) console.log(`  ${from}  ->  ${to}`);
    console.log('');

    const snap = await db.collection(COLLECTION).get();
    console.log(`Scanned ${snap.size} documents.\n`);

    const pending = [];
    const perField = Object.fromEntries(RENAMES.map(([from]) => [from, 0]));
    let conflicts = 0;

    snap.forEach(doc => {
        const data = doc.data();
        const update = {};
        let touched = false;

        for (const [from, to] of RENAMES) {
            if (!(from in data)) continue;
            perField[from]++;

            // If the new field already holds a value, do NOT clobber it. A
            // half-migrated doc means someone ran a partial migration or an
            // operator wrote through a new bundle; silently overwriting the new
            // value with the stale one would lose real data.
            if (to in data && data[to] !== null && data[to] !== data[from]) {
                console.warn(
                    `  ! ${doc.id}: both ${from}=${data[from]} and ${to}=${data[to]} present — skipped, needs a human`
                );
                conflicts++;
                continue;
            }

            update[to] = data[from];
            update[from] = admin.firestore.FieldValue.delete();
            touched = true;
        }

        if (touched) pending.push({ id: doc.id, update });
    });

    console.log('─── Findings ──────────────────────────────────');
    for (const [from, count] of Object.entries(perField)) {
        console.log(`  ${from.padEnd(22)} present on ${count} doc(s)`);
    }
    console.log(`  documents to update:   ${pending.length}`);
    console.log(`  conflicts (skipped):   ${conflicts}`);

    if (pending.length === 0) {
        console.log('\nNothing to migrate. If the portal has not yet run against real');
        console.log('Firestore, this is the expected result — see the header comment.');
        return;
    }

    if (!WRITE) {
        console.log('\nDry run — no writes. Re-run with --write to apply.');
        return;
    }

    let written = 0;
    for (let i = 0; i < pending.length; i += BATCH_LIMIT) {
        const batch = db.batch();
        for (const { id, update } of pending.slice(i, i + BATCH_LIMIT)) {
            batch.update(db.collection(COLLECTION).doc(id), update);
            written++;
        }
        await batch.commit();
        console.log(`  committed ${Math.min(i + BATCH_LIMIT, pending.length)}/${pending.length}`);
    }
    console.log(`\nMigrated ${written} document(s).`);
    if (conflicts) {
        console.log(`${conflicts} document(s) had conflicting values and were left untouched.`);
    }
}

main()
    .then(() => process.exit(0))
    .catch(err => {
        console.error('\nMigration failed:', err.message);
        process.exit(1);
    });
