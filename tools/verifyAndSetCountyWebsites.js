/**
 * tools/verifyAndSetCountyWebsites.js
 *
 * 1. Maps all 67 Alabama counties to their governing regional food bank / assistance website.
 * 2. Scans all active pantries in Firestore (`resources` collection).
 * 3. Updates `verified: true` and assigns the regional food bank website URL for any pantry missing a website.
 */

require('dotenv').config();
const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();

// 67 Alabama Counties mapped to regional food bank / assistance URL
const COUNTY_WEBSITE_MAP = {
    // ── Food Bank of North Alabama ──────────────────────
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

    // ── Community Food Bank of Central Alabama ──────────
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

    // ── West Alabama Food Bank ──────────────────────────
    'Bibb': 'https://westalabamafoodbank.org',
    'Fayette': 'https://westalabamafoodbank.org',
    'Greene': 'https://westalabamafoodbank.org',
    'Hale': 'https://westalabamafoodbank.org',
    'Lamar': 'https://westalabamafoodbank.org',
    'Pickens': 'https://westalabamafoodbank.org',
    'Sumter': 'https://westalabamafoodbank.org',
    'Tuscaloosa': 'https://westalabamafoodbank.org',

    // ── Heart of Alabama Food Bank (HAFB) ───────────────
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

    // ── Food Bank of East Alabama ───────────────────────
    'Chambers': 'https://foodbankofeastalabama.com',
    'Lee': 'https://foodbankofeastalabama.com',
    'Randolph': 'https://foodbankofeastalabama.com',

    // ── Wiregrass Area Food Bank ────────────────────────
    'Barbour': 'https://wiregrassfoodbank.com',
    'Coffee': 'https://wiregrassfoodbank.com',
    'Covington': 'https://wiregrassfoodbank.com',
    'Dale': 'https://wiregrassfoodbank.com',
    'Geneva': 'https://wiregrassfoodbank.com',
    'Henry': 'https://wiregrassfoodbank.com',
    'Houston': 'https://wiregrassfoodbank.com',

    // ── Feeding the Gulf Coast ──────────────────────────
    'Baldwin': 'https://www.feedingthegulfcoast.org',
    'Choctaw': 'https://www.feedingthegulfcoast.org',
    'Clarke': 'https://www.feedingthegulfcoast.org',
    'Conecuh': 'https://www.feedingthegulfcoast.org',
    'Escambia': 'https://www.feedingthegulfcoast.org',
    'Mobile': 'https://www.feedingthegulfcoast.org',
    'Monroe': 'https://www.feedingthegulfcoast.org',
    'Washington': 'https://www.feedingthegulfcoast.org',
};

async function main() {
    console.log('🔍 Fetching all active pantries from Firestore...');
    const snapshot = await db.collection('resources').get();
    console.log(`📊 Found ${snapshot.size} total resources in Firestore.`);

    const batchSize = 400;
    let batch = db.batch();
    let countInBatch = 0;
    let updatedCount = 0;
    let verifiedCount = 0;
    let websiteAddedCount = 0;

    const countiesFound = new Set();

    for (const docSnap of snapshot.docs) {
        const data = docSnap.data();
        const county = data.county ? data.county.trim() : '';
        if (county) countiesFound.add(county);

        let needsUpdate = false;
        const updatePayload = {};

        // 1. Mark as verified if requested
        if (data.verified !== true) {
            updatePayload.verified = true;
            needsUpdate = true;
            verifiedCount++;
        }

        // 2. Add fallback regional website if website is empty or missing
        const fallbackUrl = COUNTY_WEBSITE_MAP[county] || 'https://www.feedingamerica.org/find-your-local-foodbank';
        if (!data.website || typeof data.website !== 'string' || data.website.trim() === '') {
            updatePayload.website = fallbackUrl;
            needsUpdate = true;
            websiteAddedCount++;
        }

        if (needsUpdate) {
            updatePayload.updatedAt = admin.firestore.FieldValue.serverTimestamp();
            batch.update(docSnap.ref, updatePayload);
            countInBatch++;
            updatedCount++;

            if (countInBatch >= batchSize) {
                await batch.commit();
                console.log(`💾 Committed batch of ${countInBatch} updates.`);
                batch = db.batch();
                countInBatch = 0;
            }
        }
    }

    if (countInBatch > 0) {
        await batch.commit();
        console.log(`💾 Committed final batch of ${countInBatch} updates.`);
    }

    console.log('\n================ SUMMARY ================');
    console.log(`Total Resources Examined: ${snapshot.size}`);
    console.log(`Total Resources Updated:  ${updatedCount}`);
    console.log(`Set to Verified:          ${verifiedCount}`);
    console.log(`Websites Added/Updated:   ${websiteAddedCount}`);
    console.log(`Counties Found (${countiesFound.size}/67):`, Array.from(countiesFound).sort().join(', '));
    console.log('=========================================\n');
}

main().catch((err) => {
    console.error('Error running update script:', err);
    process.exit(1);
});
