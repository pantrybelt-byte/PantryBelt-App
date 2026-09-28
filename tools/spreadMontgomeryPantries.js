/**
 * tools/spreadMontgomeryPantries.js — One-off fix: the geocoding API key was
 * rejected (REQUEST_DENIED) when addMontgomeryPantries.js ran, so all 29 new
 * docs landed on the exact same Montgomery center coordinate. This jitters
 * them within Montgomery's rough city bounds so they're visually distinct on
 * the map rather than stacked. Targets only docs from that batch
 * (createdBy == 'ai_research_batch_2026-08-10').
 *
 * ⚠️  DEPRECATED — DO NOT RUN
 * This script was a temporary workaround that assigned RANDOM, ARTIFICIAL
 * coordinates to 29 pantries. Those coordinates have no relationship to the
 * pantries' real physical addresses and place pins on grass, parking lots, and
 * random roads across Montgomery.
 *
 * The correct fix is to re-geocode these pantries properly using the verified
 * address in each Firestore document via tools/fix_pantry_coordinates_dry_run.js
 * after human review of pantry-coordinate-audit.md.
 */

// DEPRECATION GUARD — this script exits immediately so it cannot be run.
console.error(
  '\n❌  spreadMontgomeryPantries.js is DEPRECATED and must not be run.\n' +
  '    It would assign random, artificial coordinates to real pantry locations.\n' +
  '    Use tools/fix_pantry_coordinates_dry_run.js + human review instead.\n' +
  '    See pantry-coordinate-audit.md for the correct verified coordinates.\n'
);
process.exit(1);

// ─── Legacy code below (will never execute) ───────────────────────────────
const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || require('path').join(require('os').homedir(), '.config/accessbelt/serviceAccountKey.json');
const serviceAccount = require(serviceAccountPath);

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
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

const CENTER = { lat: 32.3668, lng: -86.2999 };
const SPREAD_DEG = 0.035; // ~2.4 miles — keeps pins within metro Montgomery

async function run() {
    const snap = await db.collection('resources')
        .where('createdBy', '==', 'ai_research_batch_2026-08-10')
        .get();

    console.log(`Found ${snap.size} docs to spread.\n`);
    let count = 0;
    for (const d of snap.docs) {
        const lat = CENTER.lat + (Math.random() - 0.5) * 2 * SPREAD_DEG;
        const lng = CENTER.lng + (Math.random() - 0.5) * 2 * SPREAD_DEG;
        const geohash = encodeGeohash(lat, lng);
        await d.ref.update({
            coordinates: { lat, lng },
            geohash,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        count++;
        console.log(`✅ ${count}/${snap.size} — ${d.data().name} (${lat.toFixed(4)}, ${lng.toFixed(4)})`);
    }
    console.log(`\n🎉 Done. ${count} docs spread across Montgomery.`);
    process.exit(0);
}

run().catch(err => { console.error('❌ Failed:', err); process.exit(1); });
