/**
 * tools/verifyMapEligibility.js
 *
 * READ-ONLY. Touches no Firestore, no network — reads two local files only:
 *   - tools/unverified-audit-report.json (the source of truth, from
 *     tools/auditUnverifiedAgencies.js)
 *   - utils/mapEligibility.ts (the frozen hardcoded snapshot)
 *
 * utils/mapEligibility.ts's ID lists do not update themselves (see the header
 * comment in that file). This script recomputes what the "ineligible" union
 * SHOULD be from a fresh audit report and diffs it both directions against
 * what's actually hardcoded, so drift is a loud failure instead of a silent
 * one. Run it after every `node tools/auditUnverifiedAgencies.js` and before
 * trusting mapEligibility.ts, especially before/after a data import.
 *
 * Run:  node tools/verifyMapEligibility.js
 * Exit: 0 if the hardcoded lists exactly match the audit report; 1 otherwise.
 */

const fs = require('fs');
const path = require('path');

const REPORT_PATH = path.resolve(__dirname, 'unverified-audit-report.json');
const SOURCE_PATH = path.resolve(__dirname, '../utils/mapEligibility.ts');
const EXPECTED_UNION_SIZE = 115; // last known-good total, per the 2026-09-12 audit

function extractIdArray(src, constName) {
  const m = src.match(new RegExp(`${constName}:\\s*string\\[\\]\\s*=\\s*\\[([\\s\\S]*?)\\];`));
  if (!m) {
    console.error(`❌ Could not find "${constName}" in ${SOURCE_PATH} — has the file structure changed?`);
    process.exit(1);
  }
  return [...m[1].matchAll(/'([^']+)'/g)].map(x => x[1]);
}

function main() {
  if (!fs.existsSync(REPORT_PATH)) {
    console.error(`❌ ${REPORT_PATH} not found. Run "node tools/auditUnverifiedAgencies.js" first.`);
    process.exit(1);
  }

  const report = JSON.parse(fs.readFileSync(REPORT_PATH, 'utf8'));
  const src = fs.readFileSync(SOURCE_PATH, 'utf8');

  // ── Recompute what SHOULD be ineligible, from the audit report ──────────
  const computed = new Set();
  for (const doc of report.flagged || []) {
    const checks = (doc.checksFailed || []).join(' ');
    if (/placeholder_coords_repeated|coords_outside_county/.test(checks)) {
      computed.add(doc.id);
    }
  }

  // ── What's actually hardcoded in mapEligibility.ts ───────────────────────
  const coordDuplicateIds = extractIdArray(src, 'COORD_DUPLICATE_IDS');
  const coordOutOfCountyIds = extractIdArray(src, 'COORD_OUT_OF_COUNTY_IDS');
  const hardcoded = new Set([...coordDuplicateIds, ...coordOutOfCountyIds]);

  console.log('─'.repeat(70));
  console.log('  mapEligibility.ts verification');
  console.log('─'.repeat(70));
  console.log(`  Audit report:            ${REPORT_PATH}`);
  console.log(`  Report generated at:     ${report.generatedAt || '(unknown)'}`);
  console.log(`  Hardcoded source:        ${SOURCE_PATH}`);
  console.log();
  console.log(`  Computed union (from report):  ${computed.size}`);
  console.log(`  Hardcoded union (in file):     ${hardcoded.size}`);
  console.log(`  Expected (last known-good):    ${EXPECTED_UNION_SIZE}`);
  console.log();

  const missingFromFile = [...computed].filter(id => !hardcoded.has(id));   // in report, not in file
  const staleInFile = [...hardcoded].filter(id => !computed.has(id));       // in file, not (any longer) in report

  let ok = true;

  if (missingFromFile.length > 0) {
    ok = false;
    console.log(`  🔴 ${missingFromFile.length} doc(s) the report flags but mapEligibility.ts is MISSING (pins would render at a known-bad location):`);
    missingFromFile.forEach(id => console.log(`      • ${id}`));
    console.log();
  }

  if (staleInFile.length > 0) {
    ok = false;
    console.log(`  🟡 ${staleInFile.length} doc(s) hardcoded in mapEligibility.ts but the report no longer flags (stale — likely already fixed, pin is being hidden for no reason):`);
    staleInFile.forEach(id => console.log(`      • ${id}`));
    console.log();
  }

  if (hardcoded.size !== EXPECTED_UNION_SIZE) {
    console.log(`  ⚠️  Hardcoded union size (${hardcoded.size}) does not match the expected last-known-good count (${EXPECTED_UNION_SIZE}).`);
    console.log(`      Update EXPECTED_UNION_SIZE in this script once a new snapshot is intentionally regenerated.`);
    console.log();
  }

  if (ok) {
    console.log('  ✅ mapEligibility.ts exactly matches the current audit report. No drift.');
    console.log('─'.repeat(70));
    process.exit(0);
  } else {
    console.log('  ❌ mapEligibility.ts has drifted from the audit report. Regenerate its two');
    console.log('     ID arrays from tools/unverified-audit-report.json before shipping.');
    console.log('─'.repeat(70));
    process.exit(1);
  }
}

main();
