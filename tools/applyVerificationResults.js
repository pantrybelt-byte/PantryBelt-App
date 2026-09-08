/**
 * tools/applyVerificationResults.js
 *
 * Applies web-verification results (tools/.tmp/verify/result-*.json, shape defined in
 * tools/.tmp/verify/INSTRUCTIONS.md) to the live `agencies` collection.
 *
 * Per-id effect by verdict:
 *   active    -> verified: true; website filled in ONLY if the doc's website is currently empty
 *   uncertain -> verified: false (left in the app, just not marked confirmed)
 *   closed    -> verified: false, status: 'inactive' (removed from the map's active query,
 *                NOT deleted — closed verdicts need a human before permanent removal)
 *
 * dataIssue notes are not written to Firestore (not part of the app schema) — they're
 * collected into a local review file instead: tools/.tmp/verify/applied-data-issues.md
 *
 * Usage:
 *   node tools/applyVerificationResults.js           # apply all result-*.json files found
 *   node tools/applyVerificationResults.js --dry-run # report what would change, write nothing
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();

const VERIFY_DIR = path.join(__dirname, '.tmp', 'verify');
const DRY_RUN = process.argv.includes('--dry-run');

async function main() {
  const files = fs
    .readdirSync(VERIFY_DIR)
    .filter((f) => /^result-.*\.json$/.test(f))
    .sort();

  if (files.length === 0) {
    console.log('No result-*.json files found in', VERIFY_DIR);
    return;
  }

  let active = 0, uncertain = 0, closed = 0, websitesFilled = 0, skippedMissing = 0;
  const dataIssues = [];
  const closedFlagged = [];

  for (const file of files) {
    const { batch, results } = JSON.parse(fs.readFileSync(path.join(VERIFY_DIR, file), 'utf8'));

    for (const r of results) {
      const ref = db.collection('agencies').doc(r.id);
      const snap = await ref.get();
      if (!snap.exists) {
        console.warn(`  [batch ${batch}] skip ${r.id} (${r.name}) — no longer in Firestore`);
        skippedMissing++;
        continue;
      }
      const current = snap.data();
      const update = {};

      if (r.verdict === 'active') {
        active++;
        update.verified = true;
        if (r.website && !current.website) {
          update.website = r.website;
          websitesFilled++;
        }
      } else if (r.verdict === 'uncertain') {
        uncertain++;
        update.verified = false;
      } else if (r.verdict === 'closed') {
        closed++;
        update.verified = false;
        update.status = 'inactive';
        closedFlagged.push(`- **${r.name}** (${r.id}) — ${r.evidence}`);
      } else {
        console.warn(`  [batch ${batch}] unknown verdict "${r.verdict}" for ${r.id}, skipping`);
        continue;
      }

      if (r.dataIssue) {
        dataIssues.push(`- **${r.name}** (${r.id}, batch ${batch}): ${r.dataIssue}`);
      }

      if (!DRY_RUN) {
        await ref.update(update);
      }
    }
    console.log(`applied batch ${batch} (${results.length} rows)`);
  }

  console.log('\n--- Summary ---');
  console.log({ active, uncertain, closed, websitesFilled, skippedMissing, dryRun: DRY_RUN });

  if (closedFlagged.length) {
    console.log(`\n${closedFlagged.length} pantr${closedFlagged.length === 1 ? 'y' : 'ies'} set to status:'inactive' (NOT deleted) — review before permanent removal:`);
    closedFlagged.forEach((l) => console.log(l));
  }

  if (dataIssues.length && !DRY_RUN) {
    const reportPath = path.join(VERIFY_DIR, 'applied-data-issues.md');
    const existing = fs.existsSync(reportPath) ? fs.readFileSync(reportPath, 'utf8') : '# Data issues surfaced during verification\n\n';
    fs.writeFileSync(reportPath, existing + dataIssues.join('\n') + '\n');
    console.log(`\n${dataIssues.length} data-quality notes appended to ${reportPath}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('ERROR', e);
    process.exit(1);
  });
