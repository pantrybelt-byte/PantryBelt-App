/**
 * tools/run_full_audit_v2.js
 *
 * Expanded pantry coordinate audit with:
 * - Google Geocoding API as primary (ROOFTOP / RANGE_INTERPOLATED only)
 * - US Census Bureau geocoder as second source
 * - OpenStreetMap Nominatim as final fallback
 * - County bounding-box sanity check (verified point must be in the pantry's declared county)
 * - Corrections over 20 km → MANUAL (never WRONG)
 * - All results with verification source and location_type columns
 *
 * Usage: node tools/run_full_audit_v2.js
 * Outputs: pantry-coordinate-audit.md and pantry-coordinate-audit.json
 */
require('dotenv').config();
const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS ||
    path.join(require('os').homedir(), '.config/accessbelt/serviceAccountKey.json');
const serviceAccount = require(serviceAccountPath);
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const GOOGLE_KEY = process.env.GOOGLE_MAPS_GEOCODING_KEY;
if (!GOOGLE_KEY) console.warn('⚠️  GOOGLE_MAPS_GEOCODING_KEY not set — Google geocoder will be skipped.');

// ── County bounding boxes (from validatePantryDataset.js) ───────────────────
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

function isInCounty(lat, lng, county) {
    const b = COUNTY_BOUNDS[county];
    if (!b) return true; // Unknown county — pass through
    return lat >= b.minLat && lat <= b.maxLat && lng >= b.minLng && lng <= b.maxLng;
}

function haversineMeters(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const phi1 = lat1 * Math.PI / 180, phi2 = lat2 * Math.PI / 180;
    const dPhi = (lat2 - lat1) * Math.PI / 180;
    const dLam = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dPhi / 2) ** 2 + Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLam / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Geocoder 1: Google Maps (requires Geocoding API enabled) ─────────────────
async function geocodeGoogle(query) {
    if (!GOOGLE_KEY) return null;
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${GOOGLE_KEY}`;
    try {
        const res = await fetch(url);
        const d = await res.json();
        if (d.status === 'REQUEST_DENIED') {
            // Log once at top of run, not per address
            if (!geocodeGoogle._denied) {
                console.error('  ⚠️  Google Geocoding API returned REQUEST_DENIED. Falling back to Census/Nominatim for all addresses.');
                console.error('      → Fix: enable "Geocoding API" at https://console.cloud.google.com/apis/library/geocoding-backend.googleapis.com');
                geocodeGoogle._denied = true;
            }
            return null;
        }
        if (d.status !== 'OK' || !d.results || !d.results[0]) return null;
        const r = d.results[0];
        const locType = r.geometry.location_type; // ROOFTOP | RANGE_INTERPOLATED | GEOMETRIC_CENTER | APPROXIMATE
        if (locType === 'GEOMETRIC_CENTER' || locType === 'APPROXIMATE') return null; // too coarse
        return {
            lat: r.geometry.location.lat,
            lng: r.geometry.location.lng,
            locationType: locType,
            source: 'google',
            displayName: r.formatted_address,
        };
    } catch { return null; }
}

// ── Geocoder 2: US Census Bureau ─────────────────────────────────────────────
async function geocodeCensus(street, city, state, zip) {
    if (!street || !city) return null;
    const q = new URLSearchParams({ street, city, state: state || 'AL', zip: zip || '', benchmark: 'Public_AR_Current', format: 'json' });
    const url = `https://geocoding.geo.census.gov/geocoder/locations/address?${q}`;
    try {
        const res = await fetch(url);
        const d = await res.json();
        const matches = d?.result?.addressMatches;
        if (!matches || matches.length === 0) return null;
        const m = matches[0];
        return {
            lat: m.coordinates.y,
            lng: m.coordinates.x,
            locationType: 'RANGE_INTERPOLATED', // Census matches are always address-level
            source: 'us_census',
            displayName: m.matchedAddress,
        };
    } catch { return null; }
}

// ── Geocoder 3: Nominatim (OSM fallback) ─────────────────────────────────────
async function geocodeNominatim(query) {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`;
    try {
        const res = await fetch(url, { headers: { 'User-Agent': 'PantryBeltAudit/2.0 (accessbelt-audit@accessbelt.org)' } });
        const d = await res.json();
        if (!d || d.length === 0) return null;
        const item = d[0];
        // Reject city/county/state level results
        if (['city', 'town', 'village', 'county', 'state', 'administrative'].includes(item.addresstype) || item.type === 'administrative') {
            return { isCityLevel: true };
        }
        return {
            lat: parseFloat(item.lat),
            lng: parseFloat(item.lon),
            locationType: 'RANGE_INTERPOLATED',
            source: 'nominatim',
            displayName: item.display_name,
            isCityLevel: false,
        };
    } catch { return null; }
}

// ── Main geocode chain ────────────────────────────────────────────────────────
async function geocode(street, city, state, zip) {
    const fullAddr = [street, city, state, zip].filter(Boolean).join(', ').trim();
    if (!street || !city) return null;

    // 1. Google (rooftop/interpolated only)
    let g = await geocodeGoogle(fullAddr);
    if (g) return g;
    await sleep(300);

    // 2. US Census
    let c = await geocodeCensus(street, city, state, zip);
    if (c) return c;
    await sleep(500);

    // 3. Nominatim
    let n = await geocodeNominatim(fullAddr);
    if (n && n.isCityLevel) return null;
    if (n) return n;
    await sleep(300);

    // Retry without zip
    if (zip) {
        const noZip = [street, city, state].filter(Boolean).join(', ');
        n = await geocodeNominatim(noZip);
        if (n && !n.isCityLevel) return n;
    }

    return null;
}

async function run() {
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  AccessBelt — Full Coordinate Audit v2');
    console.log('═══════════════════════════════════════════════════════════════\n');

    // Load all candidates from stable source files (never from the output file,
    // which grows on re-runs and would cause duplication).
    //
    // Candidate sources:
    //   tools/cluster_audit_candidates.json  — original 60-pantry cluster audit IDs
    //   tools/new_audit_candidates.json      — 62 new (truncated-decimal + spread), deduped
    //
    // On first run, cluster_audit_candidates.json is bootstrapped from pantry-coordinate-audit.json
    // if it exists, otherwise from the original pantry-coordinate-audit.json created in Phase 1.

    let clusterCandidatesPath = 'tools/cluster_audit_candidates.json';
    let clusterCandidates;
    if (fs.existsSync(clusterCandidatesPath)) {
        clusterCandidates = JSON.parse(fs.readFileSync(clusterCandidatesPath, 'utf8'));
    } else {
        // Bootstrap: read original audit output (Phase 1 — exactly 60 entries),
        // extract just {id, name} stubs and save as stable source.
        const phase1 = JSON.parse(fs.readFileSync('pantry-coordinate-audit.json', 'utf8'));
        clusterCandidates = phase1.map(p => ({ id: p.id, name: p.name }));
        fs.writeFileSync(clusterCandidatesPath, JSON.stringify(clusterCandidates, null, 2));
        console.log(`Bootstrapped ${clusterCandidates.length} cluster candidates → ${clusterCandidatesPath}`);
    }
    const newCandidates = JSON.parse(fs.readFileSync('tools/new_audit_candidates.json', 'utf8'));

    // Dedupe: build a unified list with no duplicate IDs.
    const seenIds = new Set();
    const allCandidates = [];
    for (const p of [...clusterCandidates, ...newCandidates]) {
        if (!seenIds.has(p.id)) {
            seenIds.add(p.id);
            allCandidates.push(p);
        }
    }

    console.log(`Cluster candidates: ${clusterCandidates.length}`);
    console.log(`New candidates: ${newCandidates.length}`);
    console.log(`Total unique to audit: ${allCandidates.length}\n`);

    // We need stored coordinates for all. Fetch all from Firestore.
    console.log('Fetching stored coordinates from Firestore for all candidates...');
    const allSnap = await db.collection('agencies').get();
    const firestoreMap = new Map();
    allSnap.forEach(d => firestoreMap.set(d.id, d.data()));
    console.log(`Fetched ${firestoreMap.size} total Firestore docs.\n`);

    const allResults = [];

    // Helper to process one pantry (either existing or new)
    async function processOne(pantryInput, isNew) {
        const data = firestoreMap.get(pantryInput.id);
        if (!data) {
            console.warn(`  ⚠️  ID ${pantryInput.id} not found in Firestore, skipping.`);
            return;
        }

        const storedLat = data.coordinates?.lat ?? 0;
        const storedLng = data.coordinates?.lng ?? 0;
        const county = data.county || '';
        const addr = data.address || {};
        const street = addr.street || '';
        const city = addr.city || '';
        const state = addr.state || 'AL';
        const zip = addr.zip || '';
        const fullAddress = [street, city, state, zip].filter(Boolean).join(', ') || 'NO ADDRESS';
        const name = data.name || '(unnamed)';

        console.log(`  Geocoding: "${name}" (${county}) — "${fullAddress}"`);

        let verifiedLat = null, verifiedLng = null, source = 'none', locationType = 'NONE';
        let manualReason = '';
        let status = 'MANUAL';
        let distanceMeters = null;
        let countyMismatch = false;

        // Special-case: county-less or city-only addresses → MANUAL immediately
        if (!street || !city) {
            manualReason = 'Missing street address or city — city-level only in Firestore';
        } else {
            const result = await geocode(street, city, state, zip);
            await sleep(2000); // Throttle between lookups

            if (result) {
                verifiedLat = Number(result.lat.toFixed(6));
                verifiedLng = Number(result.lng.toFixed(6));
                source = result.source;
                locationType = result.locationType;

                const dist = haversineMeters(storedLat, storedLng, verifiedLat, verifiedLng);
                distanceMeters = Math.round(dist);

                // Sanity check 1: correction over 20 km → MANUAL
                if (dist > 20000) {
                    status = 'MANUAL';
                    manualReason = `Verified point is ${Math.round(dist / 1000)} km from stored point — too large to auto-correct, needs manual review`;
                    verifiedLat = null; verifiedLng = null;
                }
                // Sanity check 2: verified point must be inside the pantry's declared county
                else if (county && !isInCounty(verifiedLat, verifiedLng, county)) {
                    status = 'MANUAL';
                    countyMismatch = true;
                    manualReason = `Verified point (${verifiedLat}, ${verifiedLng}) falls outside ${county} County bounds — likely wrong address match`;
                    verifiedLat = null; verifiedLng = null;
                }
                else {
                    if (dist < 50) status = 'OK';
                    else if (dist <= 200) status = 'CHECK';
                    else status = 'WRONG';
                }
            } else {
                manualReason = 'No street-level match returned by any geocoder';
            }
        }

        allResults.push({
            id: pantryInput.id,
            name,
            county,
            address: fullAddress,
            storedLat,
            storedLng,
            verifiedLat,
            verifiedLng,
            distanceMeters,
            status,
            verificationSource: source,
            locationType,
            countyMismatch,
            manualReason: manualReason || null,
            storedMapUrl: `https://www.google.com/maps?q=${storedLat},${storedLng}`,
            verifiedMapUrl: verifiedLat ? `https://www.google.com/maps?q=${verifiedLat},${verifiedLng}` : null,
            createdBy: data.createdBy || '',
        });
    }

    // Process all candidates
    console.log('\n── Auditing all candidates ──\n');
    for (let i = 0; i < allCandidates.length; i++) {
        const p = allCandidates[i];
        console.log(`[${i + 1}/${allCandidates.length}]`);
        await processOne(p, false);
    }

    // Sort: WRONG (descending distance), CHECK, OK, MANUAL
    allResults.sort((a, b) => {
        const order = { WRONG: 1, CHECK: 2, OK: 3, MANUAL: 4 };
        if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status];
        if (a.distanceMeters != null && b.distanceMeters != null) return b.distanceMeters - a.distanceMeters;
        return 0;
    });

    const statusCounts = { OK: 0, CHECK: 0, WRONG: 0, MANUAL: 0 };
    allResults.forEach(r => statusCounts[r.status]++);

    // ── Write JSON ─────────────────────────────────────────────────────────────
    fs.writeFileSync('pantry-coordinate-audit.json', JSON.stringify(allResults, null, 2));
    console.log('\n✅ Saved pantry-coordinate-audit.json');

    // ── Write Markdown ─────────────────────────────────────────────────────────
    const manualEntries = allResults.filter(r => r.status === 'MANUAL');

    let md = `# Pantry Coordinate Audit Report — v2\n\n`;
    md += `**Audit Date:** ${new Date().toISOString().substring(0, 10)}\n\n`;
    md += `**Scope:** Full audit of 122 pantries: 60 duplicate-cluster pantries (Phase 1) +\n`;
    md += `29 random-jitter pantries (from \`spreadMontgomeryPantries.js\`) +\n`;
    md += `81 truncated-decimal pantries, all deduped to ${allResults.length} unique entries.\n\n`;
    md += `**Geocoder chain:** Google Geocoding API (ROOFTOP/RANGE_INTERPOLATED only) →\n`;
    md += `US Census Bureau geocoder → OpenStreetMap Nominatim.\n\n`;

    md += `## Summary\n\n`;
    md += `| Status | Count | Meaning |\n`;
    md += `| :--- | :---: | :--- |\n`;
    md += `| ✅ **OK** | ${statusCounts.OK} | Verified coordinate within 50 m of stored — accurate |\n`;
    md += `| 🟡 **CHECK** | ${statusCounts.CHECK} | 50–200 m discrepancy — minor parcel/campus drift |\n`;
    md += `| 🔴 **WRONG** | ${statusCounts.WRONG} | >200 m and ≤20 km discrepancy — likely geocoding fallback error |\n`;
    md += `| ⚪ **MANUAL** | ${statusCounts.MANUAL} | Needs hand-verification (missing address, county mismatch, >20 km shift, or city-level only) |\n`;
    md += `| **TOTAL** | **${allResults.length}** | |\n\n`;

    md += `## Audit Findings Table (Worst First)\n\n`;
    md += `| Status | Pantry Name | County | Address | Stored (Lat, Lng) | Verified (Lat, Lng) | Discrepancy | Source | Loc Type | Stored Pin | Verified Pin |\n`;
    md += `| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |\n`;

    for (const r of allResults) {
        const storedStr = `${r.storedLat.toFixed(5)}, ${r.storedLng.toFixed(5)}`;
        const verifiedStr = r.verifiedLat ? `${r.verifiedLat.toFixed(5)}, ${r.verifiedLng.toFixed(5)}` : 'N/A';
        const distStr = r.distanceMeters != null ? `${r.distanceMeters.toLocaleString()} m` : 'N/A';
        const storedLink = `[📍](${r.storedMapUrl})`;
        const verifiedLink = r.verifiedMapUrl ? `[📍](${r.verifiedMapUrl})` : 'N/A';
        const emoji = { OK: '✅', CHECK: '🟡', WRONG: '🔴', MANUAL: '⚪' }[r.status];
        const note = r.countyMismatch ? ` *(county mismatch)*` : '';
        md += `| ${emoji} **${r.status}** | ${r.name.replace(/\|/g, '-')} | ${r.county} | ${r.address.replace(/\|/g, '-')}${note} | \`${storedStr}\` | \`${verifiedStr}\` | ${distStr} | ${r.verificationSource} | ${r.locationType} | ${storedLink} | ${verifiedLink} |\n`;
    }

    md += `\n## MANUAL Pantries — Reasons\n\n`;
    md += `These require hand-verification before any coordinate can be updated in Firestore.\n\n`;
    md += `| # | Pantry Name | County | Address | Reason |\n`;
    md += `| :--- | :--- | :--- | :--- | :--- |\n`;
    manualEntries.forEach((r, i) => {
        md += `| ${i + 1} | ${r.name.replace(/\|/g, '-')} | ${r.county} | ${r.address.replace(/\|/g, '-')} | ${r.manualReason || '—'} |\n`;
    });

    fs.writeFileSync('pantry-coordinate-audit.md', md);
    console.log('✅ Saved pantry-coordinate-audit.md');

    // ── Print Summary ──────────────────────────────────────────────────────────
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log(`  Audit complete. ${allResults.length} pantries processed.`);
    console.log(`  ✅ OK:     ${statusCounts.OK}`);
    console.log(`  🟡 CHECK:  ${statusCounts.CHECK}`);
    console.log(`  🔴 WRONG:  ${statusCounts.WRONG}`);
    console.log(`  ⚪ MANUAL: ${statusCounts.MANUAL}`);
    console.log('═══════════════════════════════════════════════════════════════\n');
    console.log('MANUAL pantries (need hand-verification):');
    manualEntries.forEach(r => console.log(`  - [${r.county}] "${r.name}" | ${r.address}\n    Reason: ${r.manualReason}`));
}

run().catch(err => { console.error('Fatal error:', err); process.exit(1); });
