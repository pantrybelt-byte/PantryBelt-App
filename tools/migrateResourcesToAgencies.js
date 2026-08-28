/**
 * tools/migrateResourcesToAgencies.js
 *
 * 1. Copies all documents from Firestore `resources` collection to `agencies` collection.
 * 2. Marks pantries with `verified: true` and populates regional food bank URLs for empty websites.
 */

require('dotenv').config();
const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

const serviceAccountPath = path.resolve(__dirname, '../serviceAccountKey.json');

if (!fs.existsSync(serviceAccountPath)) {
    console.error(`❌ Service account key file not found at ${serviceAccountPath}`);
    process.exit(1);
}

const serviceAccount = require(serviceAccountPath);

if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();

// 67 Alabama Counties mapped to regional food bank / assistance URL
const COUNTY_WEBSITE_MAP = {
    // Food Bank of North Alabama
    'Colbert': 'https://www.foodbanknorthal.org',
    'Cullman': 'https://www.foodbanknorthal.org',
    'DeKalb': 'https://www.foodbanknorthal.org',
    'Franklin': 'https://www.foodbanknorthal.org',
    'Jackson': 'https://www.foodbanknorthal.org',
    'Lauderdale': 'https://www.foodbanknorthal.org',
    'Lawrence': 'https://www.foodbanknorthal.org',
    'Limestone': 'https://www.foodbanknorthal.org',
    'Madison': 'https://www.foodbanknorthal.org',
    'Marshall': 'https://www.foodbanknorthal.org',
    'Morgan': 'https://www.foodbanknorthal.org',

    // Community Food Bank of Central Alabama
    'Blount': 'https://www.foodbankonline.org',
    'Calhoun': 'https://www.foodbankonline.org',
    'Cherokee': 'https://www.foodbankonline.org',
    'Clay': 'https://www.foodbankonline.org',
    'Cleburne': 'https://www.foodbankonline.org',
    'Etowah': 'https://www.foodbankonline.org',
    'Jefferson': 'https://www.foodbankonline.org',
    'Shelby': 'https://www.foodbankonline.org',
    'St. Clair': 'https://www.foodbankonline.org',
    'Talladega': 'https://www.foodbankonline.org',
    'Walker': 'https://www.foodbankonline.org',
    'Winston': 'https://www.foodbankonline.org',

    // West Alabama Food Bank
    'Bibb': 'https://westalabamafoodbank.org',
    'Fayette': 'https://westalabamafoodbank.org',
    'Greene': 'https://westalabamafoodbank.org',
    'Hale': 'https://westalabamafoodbank.org',
    'Lamar': 'https://westalabamafoodbank.org',
    'Pickens': 'https://westalabamafoodbank.org',
    'Sumter': 'https://westalabamafoodbank.org',
    'Tuscaloosa': 'https://westalabamafoodbank.org',

    // Heart of Alabama Food Bank (HAFB)
    'Autauga': 'https://hafb.org',
    'Bullock': 'https://hafb.org',
    'Butler': 'https://hafb.org',
    'Chilton': 'https://hafb.org',
    'Coosa': 'https://hafb.org',
    'Dallas': 'https://hafb.org',
    'Elmore': 'https://hafb.org',
    'Lowndes': 'https://hafb.org',
    'Macon': 'https://hafb.org',
    'Marengo': 'https://hafb.org',
    'Montgomery': 'https://hafb.org',
    'Perry': 'https://hafb.org',
    'Pike': 'https://hafb.org',
    'Russell': 'https://hafb.org',
    'Tallapoosa': 'https://hafb.org',
    'Wilcox': 'https://hafb.org',

    // Food Bank of East Alabama
    'Chambers': 'https://foodbankofeastalabama.com',
    'Lee': 'https://foodbankofeastalabama.com',
    'Randolph': 'https://foodbankofeastalabama.com',

    // Wiregrass Area Food Bank
    'Barbour': 'https://wiregrassfoodbank.com',
    'Coffee': 'https://wiregrassfoodbank.com',
    'Covington': 'https://wiregrassfoodbank.com',
    'Dale': 'https://wiregrassfoodbank.com',
    'Geneva': 'https://wiregrassfoodbank.com',
    'Henry': 'https://wiregrassfoodbank.com',
    'Houston': 'https://wiregrassfoodbank.com',

    // Feeding the Gulf Coast
    'Baldwin': 'https://www.feedingthegulfcoast.org',
    'Choctaw': 'https://www.feedingthegulfcoast.org',
    'Clarke': 'https://www.feedingthegulfcoast.org',
    'Conecuh': 'https://www.feedingthegulfcoast.org',
    'Escambia': 'https://www.feedingthegulfcoast.org',
    'Mobile': 'https://www.feedingthegulfcoast.org',
    'Monroe': 'https://www.feedingthegulfcoast.org',
    'Washington': 'https://www.feedingthegulfcoast.org',
};

async function migrate() {
    console.log('🚀 Starting migration from resources -> agencies...');
    const snapshot = await db.collection('resources').get();
    console.log(`📊 Found ${snapshot.size} resources documents to migrate.`);

    let batch = db.batch();
    let countInBatch = 0;
    let totalMigrated = 0;
    let totalVerified = 0;

    for (const docSnap of snapshot.docs) {
        const data = docSnap.data();
        const docId = docSnap.id;
        const county = data.county ? data.county.trim() : '';

        // Prepare updated data payload for agencies collection
        const agencyData = {
            ...data,
            verified: true, // Mark verified so map displays red pinpoints
            website: (data.website && data.website.trim().length > 0)
                ? data.website
                : (COUNTY_WEBSITE_MAP[county] || 'https://www.feedingamerica.org/find-your-local-foodbank'),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        };

        const agencyRef = db.collection('agencies').doc(docId);
        batch.set(agencyRef, agencyData, { merge: true });

        countInBatch++;
        totalMigrated++;
        totalVerified++;

        if (countInBatch >= 400) {
            console.log(`💾 Committing batch of ${countInBatch} documents (total migrated: ${totalMigrated})...`);
            await batch.commit();
            batch = db.batch();
            countInBatch = 0;
        }
    }

    if (countInBatch > 0) {
        console.log(`💾 Committing final batch of ${countInBatch} documents...`);
        await batch.commit();
    }

    console.log(`\n✅ Migration complete!`);
    console.log(` Total agencies written to Firestore: ${totalMigrated}`);
    console.log(` Total agencies marked verified: ${totalVerified}`);
}

migrate().catch(err => {
    console.error('❌ Migration failed:', err);
    process.exit(1);
});
