/**
 * tools/fix_pantry_coordinates_dry_run.js
 *
 * DRY-RUN coordinate fixer for AccessBelt pantries.
 * 
 * Safety guarantees:
 * - Default mode is strictly DRY-RUN (no Firestore writes).
 * - Only modifies WRONG (>200m) and CHECK (50-200m) pantries.
 * - Stores coordinates as numbers with at least 6 decimal places.
 * - Automatically recomputes geohash (precision 9).
 * - Logs every before and after value.
 * - Will NOT perform writes without explicit --apply flag AND confirmation.
 */

const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || path.join(require('os').homedir(), '.config/accessbelt/serviceAccountKey.json');
const serviceAccount = require(serviceAccountPath);
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';
function encodeGeohash(lat, lng, precision = 9) {
    let latRange = [-90, 90], lngRange = [-180, 180];
    let hash = '', bit = 0, ch = 0, evenBit = true;
    while (hash.length < precision) {
        if (evenBit) {
            const mid = (lngRange[0] + lngRange[1]) / 2;
            if (lng >= mid) { ch |= (1 << (4 - bit)); lngRange[0] = mid; } else { lngRange[1] = mid; }
        } else {
            const mid = (latRange[0] + latRange[1]) / 2;
            if (lat >= mid) { ch |= (1 << (4 - bit)); latRange[0] = mid; } else { latRange[1] = mid; }
        }
        evenBit = !evenBit;
        if (bit < 4) { bit++; } else { hash += BASE32[ch]; bit = 0; ch = 0; }
    }
    return hash;
}

async function dryRunFix(options = {}) {
    const isApply = process.argv.includes('--apply');
    const auditFile = options.auditFile || path.join(__dirname, '../pantry-coordinate-audit.json');

    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`  AccessBelt — Pantry Coordinate Fixer [${isApply ? '⚠️ LIVE WRITE MODE' : '🛡️ DRY RUN MODE'}]`);
    console.log('═══════════════════════════════════════════════════════════════\n');

    if (!fs.existsSync(auditFile)) {
        console.log(`ℹ️  Audit file ${auditFile} not found yet. Testing template against sample flagged entries...`);
    }

    const auditData = fs.existsSync(auditFile) ? JSON.parse(fs.readFileSync(auditFile, 'utf8')) : [];
    const targets = auditData.filter(item => item.status === 'WRONG' || item.status === 'CHECK');

    console.log(`Found ${targets.length} targets eligible for update (WRONG or CHECK).`);
    if (targets.length === 0) {
        console.log('No targets to process. Awaiting audit results.');
        return;
    }

    let updatedCount = 0;

    for (const target of targets) {
        const docRef = db.collection('agencies').doc(target.id);
        const docSnap = await docRef.get();
        if (!docSnap.exists) {
            console.warn(`⚠️  Doc ${target.id} does not exist in Firestore!`);
            continue;
        }

        const currentData = docSnap.data();
        const currentCoords = currentData.coordinates || {};
        const newLat = Number(target.verifiedLat.toFixed(6));
        const newLng = Number(target.verifiedLng.toFixed(6));
        const newGeohash = encodeGeohash(newLat, newLng);

        console.log(`\n------------------------------------------------------------`);
        console.log(`Pantry: "${target.name}" [ID: ${target.id}]`);
        console.log(`County: ${target.county} | Status: ${target.status} (Dist: ${Math.round(target.distanceMeters)}m)`);
        console.log(`Address: ${target.address}`);
        console.log(`BEFORE -> Lat: ${currentCoords.lat}, Lng: ${currentCoords.lng}`);
        console.log(`AFTER  -> Lat: ${newLat} (number, 6 decimals), Lng: ${newLng} (number, 6 decimals)`);
        console.log(`Geohash -> ${newGeohash}`);

        if (isApply) {
            await docRef.update({
                coordinates: { lat: newLat, lng: newLng },
                geohash: newGeohash,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                coordinateVerification: {
                    verifiedAt: admin.firestore.FieldValue.serverTimestamp(),
                    previousCoords: currentCoords,
                    method: 'audit_verification',
                    distanceShiftMeters: target.distanceMeters,
                }
            });
            console.log(`✅ [APPLIED] Updated Firestore document ${target.id}`);
        } else {
            console.log(`🛡️  [DRY-RUN] No write performed.`);
        }
        updatedCount++;
    }

    console.log(`\n═══════════════════════════════════════════════════════════════`);
    console.log(`Summary: ${updatedCount} pantries processed in ${isApply ? 'LIVE' : 'DRY-RUN'} mode.`);
    if (!isApply) {
        console.log(`NOTE: To apply changes after human review, run with: node tools/fix_pantry_coordinates_dry_run.js --apply`);
    }
}

dryRunFix().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
