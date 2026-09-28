const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || path.join(require('os').homedir(), '.config/accessbelt/serviceAccountKey.json');
const serviceAccount = require(serviceAccountPath);
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function run() {
  const snap = await db.collection('agencies').get();
  console.log(`Total agency documents in Firestore: ${snap.size}`);

  const stats = {
    total: snap.size,
    active: 0,
    inactive: 0,
    otherStatus: 0,
    hasCoordinatesObject: 0,
    hasFlatLat: 0,
    hasFlatLatitude: 0,
    stringCoords: 0,
    swappedLatLong: 0,
    missingNegativeLng: 0,
    truncatedDecimals: 0, // < 5 decimal places
    zeroCoords: 0,
    nullCoords: 0,
    outOfAlabama: 0,
    duplicateCoordGroups: 0,
    duplicateCoordPantries: 0,
  };

  const coordMap = new Map();
  const pantries = [];
  const bugList = [];

  snap.forEach(d => {
    const data = d.data();
    const id = d.id;
    const name = data.name || '(unnamed)';
    const status = data.status || 'unknown';
    if (status === 'active') stats.active++;
    else if (status === 'inactive') stats.inactive++;
    else stats.otherStatus++;

    const coords = data.coordinates;
    let lat = null;
    let lng = null;

    if (coords && typeof coords === 'object') {
      stats.hasCoordinatesObject++;
      lat = coords.lat;
      lng = coords.lng;
    }
    if (data.lat !== undefined) stats.hasFlatLat++;
    if (data.latitude !== undefined) stats.hasFlatLatitude++;

    let isString = false;
    if (typeof lat === 'string' || typeof lng === 'string') {
      stats.stringCoords++;
      isString = true;
      bugList.push({ id, name, type: 'STRING_COORDINATES', lat, lng });
      lat = parseFloat(lat);
      lng = parseFloat(lng);
    }

    if (lat === null || lng === null || isNaN(lat) || isNaN(lng)) {
      stats.nullCoords++;
      bugList.push({ id, name, type: 'NULL_COORDINATES', lat, lng });
    } else if (lat === 0 && lng === 0) {
      stats.zeroCoords++;
      bugList.push({ id, name, type: 'ZERO_COORDINATES', lat, lng });
    } else {
      if (lat < 0 && lng > 0) {
        stats.swappedLatLong++;
        bugList.push({ id, name, type: 'SWAPPED_LAT_LNG', lat, lng });
      } else if (lng > 0 && lat > 0) {
        stats.missingNegativeLng++;
        bugList.push({ id, name, type: 'MISSING_NEGATIVE_LNG', lat, lng });
      }

      if (lat < 30.0 || lat > 35.2 || lng > -84.7 || lng < -88.7) {
        stats.outOfAlabama++;
        bugList.push({ id, name, type: 'OUT_OF_ALABAMA_BOUNDS', lat, lng });
      }

      const latDecimals = (lat.toString().split('.')[1] || '').length;
      const lngDecimals = (lng.toString().split('.')[1] || '').length;
      if (latDecimals < 5 || lngDecimals < 5) {
        stats.truncatedDecimals++;
        bugList.push({ id, name, type: 'TRUNCATED_DECIMALS', lat, lng, latDecimals, lngDecimals });
      }

      const key = `${lat.toFixed(5)},${lng.toFixed(5)}`;
      if (!coordMap.has(key)) coordMap.set(key, []);
      coordMap.get(key).push({ id, name, county: data.county, address: data.address, createdBy: data.createdBy });
    }

    pantries.push({
      id,
      name,
      status,
      county: data.county,
      lat,
      lng,
      address: data.address,
      createdBy: data.createdBy,
      source: data.source || data.createdBy || 'unknown',
    });
  });

  const duplicateDetails = [];
  for (const [key, list] of coordMap.entries()) {
    if (list.length > 1) {
      stats.duplicateCoordGroups++;
      stats.duplicateCoordPantries += list.length;
      duplicateDetails.push({ key, count: list.length, pantries: list });
    }
  }

  console.log('=== AUDIT SUMMARY ===');
  console.log(JSON.stringify(stats, null, 2));

  console.log('\n=== TOP DUPLICATE COORDINATE CLUSTERS ===');
  duplicateDetails.sort((a,b) => b.count - a.count).slice(0, 15).forEach(d => {
    console.log(`\nCluster: ${d.key} (${d.count} pantries):`);
    d.pantries.slice(0, 5).forEach(p => {
      console.log(`  - [${p.county}] "${p.name}" | Addr: ${p.address ? [p.address.street, p.address.city].filter(Boolean).join(', ') : 'NONE'} | CreatedBy: ${p.createdBy || 'N/A'}`);
    });
  });

  console.log(`\nTotal bug instances found: ${bugList.length}`);
  const bugTypes = {};
  bugList.forEach(b => bugTypes[b.type] = (bugTypes[b.type] || 0) + 1);
  console.log('Bug breakdown:', bugTypes);

  // Write out intermediate Phase 1 audit report
  fs.writeFileSync('tools/phase1_audit.json', JSON.stringify({ stats, bugTypes, bugList, duplicateDetails }, null, 2));
  console.log('\nSaved full details to tools/phase1_audit.json');
}

run().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
