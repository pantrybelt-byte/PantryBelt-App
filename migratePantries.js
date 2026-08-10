/**
 * AccessBelt — Pantries → Resources Migration
 * Reads all 39 documents from the legacy `pantries` collection in (default)
 * and writes them into the `resources` collection in BOTH databases:
 *   • (default)            — so the live app map works immediately
 *   • pantrybelt-statewide — to keep the new database in sync
 *
 * Run: GOOGLE_APPLICATION_CREDENTIALS=./serviceAccountKey.json node migratePantries.js
 */

const admin = require('firebase-admin');
const { getFirestore } = require('firebase-admin/firestore');

admin.initializeApp();

const sourceDb = getFirestore();                                  // (default)
const targetDb = getFirestore(admin.app(), 'pantrybelt-statewide');

// ── Minimal geohash encoder (base32, precision 9) ────────────────────────────
// Avoids needing geofire-common as a dependency.
const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';
function geohashForLocation(lat, lng, precision = 9) {
  let minLat = -90, maxLat = 90, minLng = -180, maxLng = 180;
  let hash = '', bits = 0, bitsTotal = 0, hashValue = 0;
  let isEven = true;
  while (hash.length < precision) {
    if (isEven) {
      const mid = (minLng + maxLng) / 2;
      if (lng > mid) { hashValue = (hashValue << 1) + 1; minLng = mid; }
      else           { hashValue = (hashValue << 1);     maxLng = mid; }
    } else {
      const mid = (minLat + maxLat) / 2;
      if (lat > mid) { hashValue = (hashValue << 1) + 1; minLat = mid; }
      else           { hashValue = (hashValue << 1);     maxLat = mid; }
    }
    isEven = !isEven;
    if (++bits === 5) {
      hash += BASE32[hashValue];
      bits = 0; hashValue = 0;
    }
    bitsTotal++;
  }
  return hash;
}

// ── Field transformer: pantry → resource ─────────────────────────────────────
function toResource(id, pantry) {
  const lat = typeof pantry.lat === 'number' ? pantry.lat : 0;
  const lng = typeof pantry.lng === 'number' ? pantry.lng : 0;
  const now  = admin.firestore.Timestamp.now();

  return {
    id,
    orgId:            'org_pantry_belt',        // default owner until orgs are provisioned
    name:             pantry.name             ?? '',
    locationType:     'stationary_pantry',
    status:           'active',
    county:           pantry.county           ?? '',
    coordinates:      { lat, lng },
    geohash:          lat && lng ? geohashForLocation(lat, lng) : '',
    address: {
      street: pantry.address ?? '',
      city:   pantry.city   ?? '',
      county: pantry.county ?? '',
      state:  'AL',
      zip:    '',
    },
    hours:            pantry.hours            ?? '',
    phone:            pantry.phone            ?? '',
    website:          pantry.website          ?? '',
    eligibilityNotes: pantry.eligibility      ?? '',
    docsRequired:     pantry.docs
                        ? pantry.docs.split(',').map(s => s.trim()).filter(Boolean)
                        : [],
    serviceRadiusMiles: null,
    capacity:           null,
    tags:               [],
    verified:           pantry.verified       ?? false,
    createdBy:          'migration_script',
    createdAt:          now,
    updatedAt:          now,
  };
}

// ── Runner ───────────────────────────────────────────────────────────────────
async function migrate() {
  console.log('\nAccessBelt — Migrating pantries → resources\n');

  const snapshot = await sourceDb.collection('pantries').get();
  console.log(`Found ${snapshot.size} pantries in (default).pantries\n`);

  // Build both batches in parallel (Firestore batch limit = 500)
  const defaultBatch   = sourceDb.batch();
  const statewideBatch = targetDb.batch();
  let count = 0;

  for (const doc of snapshot.docs) {
    const resource = toResource(doc.id, doc.data());

    defaultBatch.set(
      sourceDb.collection('resources').doc(doc.id),
      resource
    );
    statewideBatch.set(
      targetDb.collection('resources').doc(doc.id),
      resource
    );
    count++;
    process.stdout.write(`  Queued [${count}/${snapshot.size}] ${resource.name}\n`);
  }

  console.log('\nCommitting to (default)...');
  await defaultBatch.commit();
  console.log('✅ (default).resources — done');

  console.log('Committing to pantrybelt-statewide...');
  await statewideBatch.commit();
  console.log('✅ pantrybelt-statewide.resources — done');

  console.log(`\n🎉 Migration complete — ${count} pantries now live in both databases.`);
  console.log('   Reload the app map to see all locations.\n');
  process.exit(0);
}

migrate().catch(err => {
  console.error('\n❌ Migration failed:', err.message);
  process.exit(1);
});
