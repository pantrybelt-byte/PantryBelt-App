// updatePantries.js
// Run with: node updatePantries.js
// Make sure to: npm install firebase-admin csv-parser

const admin = require("firebase-admin");
const fs = require("fs");
const csv = require("csv-parser");
const path = require("path");

// 🔧 REPLACE with your service account key path
const serviceAccount = require("./serviceAccountKey.json");

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
        updateData.latitude = parseFloat(lat);
        updateData.longitude = parseFloat(lng);
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
