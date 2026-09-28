// updatePantries.js
// Run with: node updatePantries.js
// Make sure to: npm install firebase-admin csv-parser

const admin = require("firebase-admin");
const fs = require("fs");
const csv = require("csv-parser");
const path = require("path");

const os = require("os");
const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || path.join(os.homedir(), ".config/accessbelt/serviceAccountKey.json");
const serviceAccount = require(serviceAccountPath);

// 🔧 REPLACE with your Firestore collection name for pantries
const COLLECTION_NAME = "pantries";

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function updatePantries() {
  const updates = [];

  await new Promise((resolve, reject) => {
    fs.createReadStream(path.join(__dirname, "pantries.csv"))
      .pipe(csv())
      .on("data", (row) => updates.push(row))
      .on("end", resolve)
      .on("error", reject);
  });

  console.log(`\n📋 Found ${updates.length} pantries to update...\n`);

  let success = 0;
  let failed = 0;

  for (const pantry of updates) {
    try {
      const { id, lat, lng, website } = pantry;

      if (!id) {
        console.warn(`⚠️  Skipping row — missing document ID`);
        failed++;
        continue;
      }

      const updateData = {};

      if (lat && lng) {
        const parsedLat = parseFloat(lat);
        const parsedLng = parseFloat(lng);

        // ── Alabama bounds guard ──────────────────────────────────────────────
        // BUG FIX: was writing flat `latitude`/`longitude` that map.tsx never reads.
        // map.tsx and utils/pantries.ts both read r.coordinates.lat / r.coordinates.lng.
        if (parsedLat < 30.1 || parsedLat > 35.1 || parsedLng < -88.6 || parsedLng > -84.8) {
          console.error(`❌ Skipping ${id} — coordinate (${parsedLat}, ${parsedLng}) is outside Alabama bounds.`);
          failed++;
          continue;
        }
        // ── Precision guard ──────────────────────────────────────────────────
        const latDec = (parsedLat.toString().split('.')[1] || '').length;
        const lngDec = (parsedLng.toString().split('.')[1] || '').length;
        if (latDec < 5 || lngDec < 5) {
          console.warn(`⚠️  ${id} — coordinates have fewer than 5 decimal places (${latDec}/${lngDec}). Writing anyway but flag for manual review.`);
        }
        // Write to the nested field that map.tsx / pantries.ts actually reads.
        updateData['coordinates.lat'] = parsedLat;
        updateData['coordinates.lng'] = parsedLng;
      }

      if (website && website.trim() !== "") {
        updateData.website = website.trim();
      }

      updateData.updatedAt = admin.firestore.FieldValue.serverTimestamp();

      await db.collection(COLLECTION_NAME).doc(id).update(updateData);

      console.log(`✅ Updated: ${id}`);
      success++;

    } catch (err) {
      console.error(`❌ Failed: ${pantry.id} — ${err.message}`);
      failed++;
    }
  }

  console.log(`\n🎉 Done!`);
  console.log(`✅ Successfully updated: ${success}`);
  console.log(`❌ Failed: ${failed}`);
  process.exit(0);
}

updatePantries().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
