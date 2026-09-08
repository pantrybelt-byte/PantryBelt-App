/**
 * tools/validatePantryDataset.js
 *
 * Audits the AccessBelt `agencies` collection against all 67 Alabama counties.
 *
 * 1. Coverage report  — counties with pantries vs. empty counties
 * 2. Coordinate audit — verifies each pantry's lat/lng falls within
 *                        the bounding box of its claimed county
 * 3. Data quality     — flags missing coords, unknown counties, status anomalies
 *
 * Run:  node tools/validatePantryDataset.js
 * Output: console report + tools/pantry-audit-report.json
 */

const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

// ── Firebase Admin Init ─────────────────────────────────────────────────────
const serviceAccountPath = path.resolve(__dirname, '../serviceAccountKey.json');
if (!fs.existsSync(serviceAccountPath)) {
    console.error(`❌ Service account key not found at ${serviceAccountPath}`);
    process.exit(1);
}
const serviceAccount = require(serviceAccountPath);
if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();

// ── Master list: all 67 Alabama counties ────────────────────────────────────
const ALABAMA_COUNTIES = [
    'Autauga', 'Baldwin', 'Barbour', 'Bibb', 'Blount', 'Bullock', 'Butler',
    'Calhoun', 'Chambers', 'Cherokee', 'Chilton', 'Choctaw', 'Clarke', 'Clay',
    'Cleburne', 'Coffee', 'Colbert', 'Conecuh', 'Coosa', 'Covington',
    'Crenshaw', 'Cullman', 'Dale', 'Dallas', 'DeKalb', 'Elmore', 'Escambia',
    'Etowah', 'Fayette', 'Franklin', 'Geneva', 'Greene', 'Hale', 'Henry',
    'Houston', 'Jackson', 'Jefferson', 'Lamar', 'Lauderdale', 'Lawrence',
    'Lee', 'Limestone', 'Lowndes', 'Macon', 'Madison', 'Marengo', 'Marion',
    'Marshall', 'Mobile', 'Monroe', 'Montgomery', 'Morgan', 'Perry',
    'Pickens', 'Pike', 'Randolph', 'Russell', 'St. Clair', 'Shelby',
    'Sumter', 'Talladega', 'Tallapoosa', 'Tuscaloosa', 'Walker',
    'Washington', 'Wilcox', 'Winston',
];

// ── Alabama county bounding boxes (approximate, from US Census TIGER data) ──
// Format: { minLat, maxLat, minLng, maxLng }
// Padded by ~0.05° (~3.5 mi) to account for geocoding imprecision
const COUNTY_BOUNDS = {
    'Autauga':    { minLat: 32.34, maxLat: 32.71, minLng: -86.92, maxLng: -86.41 },
    'Baldwin':    { minLat: 30.22, maxLat: 31.08, minLng: -88.06, maxLng: -87.52 },
    'Barbour':    { minLat: 31.52, maxLat: 32.05, minLng: -85.79, maxLng: -85.05 },
    'Bibb':       { minLat: 32.82, maxLat: 33.22, minLng: -87.37, maxLng: -86.88 },
    'Blount':     { minLat: 33.74, maxLat: 34.13, minLng: -86.96, maxLng: -86.37 },
    'Bullock':    { minLat: 31.95, maxLat: 32.37, minLng: -85.99, maxLng: -85.50 },
    'Butler':     { minLat: 31.52, maxLat: 31.93, minLng: -86.96, maxLng: -86.40 },
    'Calhoun':    { minLat: 33.50, maxLat: 33.93, minLng: -86.10, maxLng: -85.55 },
    'Chambers':   { minLat: 32.75, maxLat: 33.15, minLng: -85.65, maxLng: -85.10 },
    'Cherokee':   { minLat: 33.93, maxLat: 34.42, minLng: -86.00, maxLng: -85.45 },
    'Chilton':    { minLat: 32.70, maxLat: 33.06, minLng: -87.00, maxLng: -86.42 },
    'Choctaw':    { minLat: 31.77, maxLat: 32.23, minLng: -88.52, maxLng: -87.97 },
    'Clarke':     { minLat: 31.34, maxLat: 31.86, minLng: -88.20, maxLng: -87.52 },
    'Clay':       { minLat: 33.12, maxLat: 33.52, minLng: -86.13, maxLng: -85.63 },
    'Cleburne':   { minLat: 33.50, maxLat: 33.93, minLng: -85.63, maxLng: -85.20 },
    'Coffee':     { minLat: 31.12, maxLat: 31.55, minLng: -86.25, maxLng: -85.65 },
    'Colbert':    { minLat: 34.55, maxLat: 34.92, minLng: -88.10, maxLng: -87.52 },
    'Conecuh':    { minLat: 31.15, maxLat: 31.62, minLng: -87.22, maxLng: -86.65 },
    'Coosa':      { minLat: 32.75, maxLat: 33.18, minLng: -86.22, maxLng: -85.72 },
    'Covington':  { minLat: 30.97, maxLat: 31.50, minLng: -86.77, maxLng: -86.15 },
    'Crenshaw':   { minLat: 31.62, maxLat: 31.97, minLng: -86.40, maxLng: -85.85 },
    'Cullman':    { minLat: 33.89, maxLat: 34.37, minLng: -87.15, maxLng: -86.57 },
    'Dale':       { minLat: 31.15, maxLat: 31.58, minLng: -85.85, maxLng: -85.35 },
    'Dallas':     { minLat: 32.05, maxLat: 32.56, minLng: -87.42, maxLng: -86.82 },
    'DeKalb':     { minLat: 34.32, maxLat: 34.73, minLng: -86.10, maxLng: -85.55 },
    'Elmore':     { minLat: 32.35, maxLat: 32.70, minLng: -86.35, maxLng: -85.85 },
    'Escambia':   { minLat: 30.97, maxLat: 31.38, minLng: -87.47, maxLng: -86.85 },
    'Etowah':     { minLat: 33.90, maxLat: 34.28, minLng: -86.35, maxLng: -85.85 },
    'Fayette':    { minLat: 33.55, maxLat: 33.95, minLng: -87.95, maxLng: -87.43 },
    'Franklin':   { minLat: 34.32, maxLat: 34.72, minLng: -88.17, maxLng: -87.63 },
    'Geneva':     { minLat: 30.98, maxLat: 31.42, minLng: -86.20, maxLng: -85.60 },
    'Greene':     { minLat: 32.50, maxLat: 32.95, minLng: -88.17, maxLng: -87.65 },
    'Hale':       { minLat: 32.50, maxLat: 32.95, minLng: -87.77, maxLng: -87.22 },
    'Henry':      { minLat: 31.25, maxLat: 31.62, minLng: -85.53, maxLng: -85.05 },
    'Houston':    { minLat: 31.00, maxLat: 31.40, minLng: -85.60, maxLng: -85.10 },
    'Jackson':    { minLat: 34.55, maxLat: 35.00, minLng: -86.40, maxLng: -85.80 },
    'Jefferson':  { minLat: 33.38, maxLat: 33.80, minLng: -87.22, maxLng: -86.57 },
    'Lamar':      { minLat: 33.55, maxLat: 33.95, minLng: -88.35, maxLng: -87.85 },
    'Lauderdale': { minLat: 34.65, maxLat: 35.00, minLng: -87.80, maxLng: -87.20 },
    'Lawrence':   { minLat: 34.37, maxLat: 34.72, minLng: -87.55, maxLng: -86.95 },
    'Lee':        { minLat: 32.45, maxLat: 32.80, minLng: -85.55, maxLng: -85.10 },
    'Limestone':  { minLat: 34.62, maxLat: 35.00, minLng: -87.25, maxLng: -86.75 },
    'Lowndes':    { minLat: 31.95, maxLat: 32.42, minLng: -86.80, maxLng: -86.22 },
    'Macon':      { minLat: 32.18, maxLat: 32.55, minLng: -86.00, maxLng: -85.47 },
    'Madison':    { minLat: 34.53, maxLat: 34.92, minLng: -86.82, maxLng: -86.30 },
    'Marengo':    { minLat: 31.98, maxLat: 32.50, minLng: -88.12, maxLng: -87.47 },
    'Marion':     { minLat: 33.95, maxLat: 34.37, minLng: -88.20, maxLng: -87.63 },
    'Marshall':   { minLat: 34.08, maxLat: 34.57, minLng: -86.60, maxLng: -86.10 },
    'Mobile':     { minLat: 30.22, maxLat: 31.02, minLng: -88.43, maxLng: -87.92 },
    'Monroe':     { minLat: 31.33, maxLat: 31.82, minLng: -87.60, maxLng: -87.00 },
    'Montgomery': { minLat: 32.10, maxLat: 32.58, minLng: -86.50, maxLng: -85.95 },
    'Morgan':     { minLat: 34.28, maxLat: 34.62, minLng: -87.10, maxLng: -86.55 },
    'Perry':      { minLat: 32.30, maxLat: 32.73, minLng: -87.52, maxLng: -87.05 },
    'Pickens':    { minLat: 33.02, maxLat: 33.47, minLng: -88.35, maxLng: -87.83 },
    'Pike':       { minLat: 31.60, maxLat: 32.00, minLng: -86.08, maxLng: -85.55 },
    'Randolph':   { minLat: 33.10, maxLat: 33.52, minLng: -85.65, maxLng: -85.18 },
    'Russell':    { minLat: 32.08, maxLat: 32.55, minLng: -85.48, maxLng: -84.98 },
    'St. Clair':  { minLat: 33.52, maxLat: 33.90, minLng: -86.57, maxLng: -86.10 },
    'Shelby':     { minLat: 33.10, maxLat: 33.50, minLng: -86.95, maxLng: -86.48 },
    'Sumter':     { minLat: 32.33, maxLat: 32.85, minLng: -88.47, maxLng: -87.95 },
    'Talladega':  { minLat: 33.10, maxLat: 33.57, minLng: -86.35, maxLng: -85.78 },
    'Tallapoosa': { minLat: 32.55, maxLat: 33.08, minLng: -86.00, maxLng: -85.43 },
    'Tuscaloosa': { minLat: 33.00, maxLat: 33.55, minLng: -87.87, maxLng: -87.18 },
    'Walker':     { minLat: 33.68, maxLat: 34.10, minLng: -87.45, maxLng: -86.95 },
    'Washington': { minLat: 31.05, maxLat: 31.60, minLng: -88.42, maxLng: -87.95 },
    'Wilcox':     { minLat: 31.73, maxLat: 32.22, minLng: -87.48, maxLng: -86.88 },
    'Winston':    { minLat: 33.95, maxLat: 34.32, minLng: -87.55, maxLng: -87.15 },
};

// ── Helpers ─────────────────────────────────────────────────────────────────

function isWithinBounds(lat, lng, bounds) {
    return (
        lat >= bounds.minLat && lat <= bounds.maxLat &&
        lng >= bounds.minLng && lng <= bounds.maxLng
    );
}

function normalizeCounty(raw) {
    if (!raw || typeof raw !== 'string') return null;
    const trimmed = raw.trim();
    // Exact match first
    if (ALABAMA_COUNTIES.includes(trimmed)) return trimmed;
    // Case-insensitive match
    const lower = trimmed.toLowerCase();
    const match = ALABAMA_COUNTIES.find(c => c.toLowerCase() === lower);
    if (match) return match;
    // Fuzzy: try removing "County" suffix
    const stripped = lower.replace(/\s*county\s*$/i, '').trim();
    return ALABAMA_COUNTIES.find(c => c.toLowerCase() === stripped) || null;
}

// ── Main Audit ──────────────────────────────────────────────────────────────

async function audit() {
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('  AccessBelt — 67-County Pantry Dataset Validation');
    console.log('═══════════════════════════════════════════════════════════════\n');

    // 1. Fetch all agencies
    console.log('⏳ Fetching all documents from agencies collection...');
    const snapshot = await db.collection('agencies').get();
    const totalDocs = snapshot.size;
    console.log(`   Found ${totalDocs} total documents.\n`);

    // Accumulators
    const coverageMap = {};       // county → [{ id, name, status, lat, lng }]
    const unknownCounties = [];   // docs with unrecognized county
    const missingCoords = [];     // docs with no/zero coordinates
    const outOfBounds = [];       // docs where coords don't match county bounds
    const statusAnomalies = [];   // docs with unexpected status values
    const duplicateNames = {};    // name → [docIds] to detect duplicates
    const countyMismatch = [];    // docs where top-level county ≠ address.county

    for (const doc of snapshot.docs) {
        const data = doc.data();
        const docId = doc.id;
        const rawCounty = data.county;
        const normalizedCounty = normalizeCounty(rawCounty);
        const lat = data.coordinates?.lat ?? null;
        const lng = data.coordinates?.lng ?? null;
        const status = data.status;
        const name = data.name || '(unnamed)';

        // Track duplicates
        const nameKey = name.toLowerCase().trim();
        if (!duplicateNames[nameKey]) duplicateNames[nameKey] = [];
        duplicateNames[nameKey].push(docId);

        // County validation
        if (!normalizedCounty) {
            unknownCounties.push({ docId, name, rawCounty, lat, lng });
        } else {
            if (!coverageMap[normalizedCounty]) coverageMap[normalizedCounty] = [];
            coverageMap[normalizedCounty].push({ docId, name, status, lat, lng });
        }

        // Address county cross-check
        const addrCounty = data.address?.county;
        if (addrCounty && normalizedCounty && normalizeCounty(addrCounty) !== normalizedCounty) {
            countyMismatch.push({ docId, name, topLevel: rawCounty, addressCounty: addrCounty });
        }

        // Coordinate validation
        if (lat === null || lng === null || (lat === 0 && lng === 0)) {
            missingCoords.push({ docId, name, county: rawCounty, lat, lng });
        } else if (normalizedCounty && COUNTY_BOUNDS[normalizedCounty]) {
            if (!isWithinBounds(lat, lng, COUNTY_BOUNDS[normalizedCounty])) {
                outOfBounds.push({
                    docId,
                    name,
                    county: normalizedCounty,
                    lat,
                    lng,
                    expected: COUNTY_BOUNDS[normalizedCounty],
                });
            }
        }

        // Status validation
        const validStatuses = ['active', 'unopened', 'inactive', 'closed', 'pending'];
        if (status && !validStatuses.includes(status)) {
            statusAnomalies.push({ docId, name, status });
        }
    }

    // Find actual duplicates (same name, multiple docs)
    const duplicates = Object.entries(duplicateNames)
        .filter(([_, ids]) => ids.length > 1)
        .map(([name, ids]) => ({ name, count: ids.length, docIds: ids }));

    // ── Coverage Report ─────────────────────────────────────────────────────
    const coveredCounties = ALABAMA_COUNTIES.filter(c => coverageMap[c] && coverageMap[c].length > 0);
    const emptyCounties = ALABAMA_COUNTIES.filter(c => !coverageMap[c] || coverageMap[c].length === 0);
    const activeByCounty = {};
    for (const county of coveredCounties) {
        activeByCounty[county] = coverageMap[county].filter(p => p.status === 'active').length;
    }

    console.log('───────────────────────────────────────────────────────────────');
    console.log('  COVERAGE REPORT');
    console.log('───────────────────────────────────────────────────────────────');
    console.log(`  Total agencies:          ${totalDocs}`);
    console.log(`  Counties with pantries:  ${coveredCounties.length} / 67`);
    console.log(`  Counties with NO pantries: ${emptyCounties.length}`);
    console.log(`  Coverage rate:           ${((coveredCounties.length / 67) * 100).toFixed(1)}%`);
    console.log();

    if (emptyCounties.length > 0) {
        console.log('  ⚠️  Empty counties (no agencies found):');
        emptyCounties.forEach(c => console.log(`      • ${c}`));
        console.log();
    }

    // Top counties by count
    const sortedCounties = coveredCounties
        .map(c => ({ county: c, total: coverageMap[c].length, active: activeByCounty[c] || 0 }))
        .sort((a, b) => b.total - a.total);

    console.log('  Top 10 counties by pantry count:');
    sortedCounties.slice(0, 10).forEach((c, i) => {
        console.log(`      ${String(i + 1).padStart(2)}. ${c.county.padEnd(15)} ${String(c.total).padStart(4)} total  (${c.active} active)`);
    });
    console.log();

    // Bottom 10 (with at least 1)
    console.log('  Bottom 10 covered counties:');
    sortedCounties.slice(-10).reverse().forEach((c, i) => {
        console.log(`      ${String(i + 1).padStart(2)}. ${c.county.padEnd(15)} ${String(c.total).padStart(4)} total  (${c.active} active)`);
    });
    console.log();

    // ── Coordinate Audit ────────────────────────────────────────────────────
    console.log('───────────────────────────────────────────────────────────────');
    console.log('  COORDINATE AUDIT');
    console.log('───────────────────────────────────────────────────────────────');
    const coordChecked = totalDocs - missingCoords.length;
    console.log(`  Pantries with valid coords:    ${coordChecked}`);
    console.log(`  Pantries missing/zero coords:  ${missingCoords.length}`);
    console.log(`  Out-of-bounds (coord ≠ county): ${outOfBounds.length}`);
    console.log();

    if (outOfBounds.length > 0) {
        console.log('  🔴 Out-of-bounds pantries:');
        outOfBounds.forEach(p => {
            console.log(`      • [${p.docId}] "${p.name}" — claims ${p.county} but coords (${p.lat}, ${p.lng}) are outside bounds`);
            console.log(`        Expected: lat ${p.expected.minLat}–${p.expected.maxLat}, lng ${p.expected.minLng}–${p.expected.maxLng}`);
        });
        console.log();
    }

    if (missingCoords.length > 0) {
        console.log('  🟡 Missing/zero coordinates:');
        missingCoords.slice(0, 20).forEach(p => {
            console.log(`      • [${p.docId}] "${p.name}" (${p.county || 'no county'}) — lat: ${p.lat}, lng: ${p.lng}`);
        });
        if (missingCoords.length > 20) console.log(`      ... and ${missingCoords.length - 20} more`);
        console.log();
    }

    // ── Data Quality ────────────────────────────────────────────────────────
    console.log('───────────────────────────────────────────────────────────────');
    console.log('  DATA QUALITY');
    console.log('───────────────────────────────────────────────────────────────');
    console.log(`  Unknown counties:        ${unknownCounties.length}`);
    console.log(`  County field mismatches: ${countyMismatch.length}`);
    console.log(`  Status anomalies:        ${statusAnomalies.length}`);
    console.log(`  Duplicate names:         ${duplicates.length} groups (${duplicates.reduce((s, d) => s + d.count, 0)} docs)`);
    console.log();

    if (unknownCounties.length > 0) {
        console.log('  🔴 Unknown counties (not in 67-county list):');
        unknownCounties.forEach(p => {
            console.log(`      • [${p.docId}] "${p.name}" — county: "${p.rawCounty}"`);
        });
        console.log();
    }

    if (countyMismatch.length > 0) {
        console.log('  🟡 County field mismatch (top-level ≠ address.county):');
        countyMismatch.slice(0, 10).forEach(p => {
            console.log(`      • [${p.docId}] "${p.name}" — top: "${p.topLevel}", addr: "${p.addressCounty}"`);
        });
        if (countyMismatch.length > 10) console.log(`      ... and ${countyMismatch.length - 10} more`);
        console.log();
    }

    if (duplicates.length > 0) {
        console.log('  🟡 Potential duplicates (same name, multiple docs):');
        duplicates.slice(0, 10).forEach(d => {
            console.log(`      • "${d.name}" — ${d.count} docs: ${d.docIds.join(', ')}`);
        });
        if (duplicates.length > 10) console.log(`      ... and ${duplicates.length - 10} more`);
        console.log();
    }

    // ── JSON Report ─────────────────────────────────────────────────────────
    const report = {
        timestamp: new Date().toISOString(),
        totalAgencies: totalDocs,
        coverage: {
            coveredCounties: coveredCounties.length,
            emptyCounties: emptyCounties.length,
            coverageRate: `${((coveredCounties.length / 67) * 100).toFixed(1)}%`,
            empty: emptyCounties,
            byCounty: sortedCounties,
        },
        coordinates: {
            checked: coordChecked,
            missingOrZero: missingCoords.length,
            outOfBounds: outOfBounds.length,
            outOfBoundsDetails: outOfBounds,
            missingDetails: missingCoords,
        },
        dataQuality: {
            unknownCounties,
            countyMismatches: countyMismatch,
            statusAnomalies,
            duplicateNames: duplicates,
        },
    };

    const reportPath = path.resolve(__dirname, 'pantry-audit-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log('───────────────────────────────────────────────────────────────');
    console.log(`  ✅ Full JSON report written to: ${reportPath}`);
    console.log('═══════════════════════════════════════════════════════════════\n');
}

audit().catch(err => {
    console.error('\n❌ Audit failed:', err.message);
    process.exit(1);
});
