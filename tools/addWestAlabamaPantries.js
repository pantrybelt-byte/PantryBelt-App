/**
 * tools/addWestAlabamaPantries.js — Adds pantries from nine West Alabama
 * Food Bank (WAFB) county datasets (PDF exports, 2026-08-17) to the live
 * `resources` collection: Hale, Bibb, Tuscaloosa, Pickens, Fayette, Lamar,
 * Marion, Sumter (Greene contributes nothing — see below). Uses the Admin
 * SDK (serviceAccountKey.json), so it bypasses Firestore rules entirely —
 * run with care.
 *
 * Coordinates come directly from the source dataset (no geocoding needed
 * — unlike the East Alabama FBEA batch, these show no duplicate/corrupted
 * coordinate pattern).
 *
 * "Greene County.pdf" turned out to be byte-for-byte the same 3 rows as
 * "Sumter County.pdf" — every row in the "Greene" file is explicitly
 * tagged County=Sumter and lists the identical agencies/addresses/phones/
 * coordinates. There are zero actual Greene County rows in this dataset;
 * the file appears to be a duplicate export under the wrong name. The
 * Sumter trio is written once, not twice.
 *
 * No overlaps found against existing Firestore resources in any of these
 * counties — the existing entries there are all generic county-level
 * stubs (e.g. "Sumter County DHR") that don't match any row here by name.
 */
require('dotenv').config();
const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

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

function normalizePhone(raw) {
    if (!raw) return '';
    const first = raw.split(';')[0].trim();
    const digits = first.replace(/\D/g, '');
    if (digits.length !== 10) return first;
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

// name, street, city, county, zip, phone, lat, lng
const NEW_PANTRIES = [
    // ── Hale County (2) ─────────────────────────────────────────────────
    ['Greater Mircale House of Prayer', '36267 Alabama HWY 69 South', 'Moundville', 'Hale', '35474', '334-507-3990', 33.0038037, -87.6169279],
    ['Moundville Baptist Church', '150 5th AVE', 'Moundville', 'Hale', '35474', '205-371-6370', 32.9998951, -87.6272781],

    // ── Bibb County (4) ─────────────────────────────────────────────────
    ['Cahaba Medical Care', '195 Hospital Dr', 'Centreville', 'Bibb', '35042', '205-926-2992', 32.9471937, -87.1488654],
    ['West Blocton First Baptist Church', '1249 Main St', 'West Blocton', 'Bibb', '35184', '205-572-8280', 33.1175278, -87.113737],
    ['New Life Assembly of God-Woodstock Hope Center', '27039 Highway 5', 'Woodstock', 'Bibb', '35188', '205-292-6998', 33.1910169, -87.1525412],
    ['River of Life', '10325 US-82', 'Centreville', 'Bibb', '35042', '205-928-0401', 32.9684264, -87.172086],

    // ── Tuscaloosa County (28) ──────────────────────────────────────────
    ['Christian Community Church', '5600 18th AVE', 'Tuscaloosa', 'Tuscaloosa', '35405', '205-248-4400', 33.1575821, -87.5598065],
    ['Coaling Baptist Church', '11209 Hagler Coaling Rd', 'Coaling', 'Tuscaloosa', '35453', '205-556-2775', 33.1577827, -87.3407088],
    ['First Community Church Outreach', '2700 18th ST', 'Tuscaloosa', 'Tuscaloosa', '35401', '205-765-5307', 33.1968821, -87.5694974],
    ['Grace Presbyterian Church-Table of Grace', '201 Hargrove Road', 'Tuscaloosa', 'Tuscaloosa', '35401', '205-469-7811', 33.1895468, -87.5382912],
    ['Hope City Church', '3800 University Blvd', 'Tuscaloosa', 'Tuscaloosa', '35404', '', 33.2037314, -87.4876963],
    ['Catholic Social Services of West Alabama', '608 James I Harrison Jr Pkwy E', 'Tuscaloosa', 'Tuscaloosa', '35405', '205-759-1268', 33.1769765, -87.5295398],
    ['Canterbury Chapel', '812 5th AVE', 'Tuscaloosa', 'Tuscaloosa', '35404', '205-345-9590', 33.1974862, -87.5301898],
    ['Grace Church', '2112 Hargrove Rd E', 'Tuscaloosa', 'Tuscaloosa', '35405', '', 33.1823301, -87.5088612],
    ['Bama Cares Student Pantry', '751 Campus Dr', 'Tuscaloosa', 'Tuscaloosa', '35407', '205-348-2461', 33.2145156, -87.545665],
    ['Coker UMC', '14992 Hwy 140', 'Coker', 'Tuscaloosa', '35452', '205-799-2722', 33.2456415, -87.6856182],
    ['Wings of Grace', '3101 Alabama Ave NE', 'Tuscaloosa', 'Tuscaloosa', '35404', '205-616-2792', 33.2389882, -87.4951698],
    ['Temporary Emergency Services', '1705 15th St', 'Tuscaloosa', 'Tuscaloosa', '35401', '205-758-5535', 33.1992355, -87.5593698],
    ['Tracy Dent Foundation', '15591 Thomas Chapel Rd', 'Tuscaloosa', 'Tuscaloosa', '35404', '205-246-5655', 33.1450268, -87.3306017],
    ['Salvation Army-Center of Hope', '2902 Greensboro Ave', 'Tuscaloosa', 'Tuscaloosa', '35405', '205-632-3691', 33.1847948, -87.5566741],
    ['St. Paul AME Church-Kindness Kitchen', '7901 Old Greensboro Rd', 'Tuscaloosa', 'Tuscaloosa', '35405', '205-861-0555', 33.1356378, -87.5507929],
    ['St. Mark AME-Center of Hope', '2715 18th St', 'Tuscaloosa', 'Tuscaloosa', '35401', '205-886-2320', 33.1963746, -87.5706959],
    ['Tuscaloosa Church of God-Real Hope', '4115 5th Ave', 'Tuscaloosa', 'Tuscaloosa', '35405', '', 33.1684938, -87.541219],
    ['University Church of Christ-Harvest Hands', '1200 Julia Tutwiler Dr.', 'Tuscaloosa', 'Tuscaloosa', '35405', '205-394-7536', 33.2140586, -87.5222113],
    ['New Heights Community Resource Center', '3834 21st Street', 'Tuscaloosa', 'Tuscaloosa', '35401', '205-759-3534', 33.194102, -87.5867139],
    ['New Dimensions Worship Center', '2200 Main Ave', 'Northport', 'Tuscaloosa', '35473', '205-333-3230', 33.2308386, -87.5839905],
    ['Bailey Tabernacle CME Church', '1117 23rd Ave', 'Tuscaloosa', 'Tuscaloosa', '35401', '205-799-4795', 33.2039776, -87.5638292],
    ['Lakewood Baptist Church', '14468 HWY 43N', 'Northport', 'Tuscaloosa', '35475', '205-333-0414', 33.229007, -87.5772293],
    ['Wallace Chapel Iglesia del Nazareno', '11391 Tingle Tangle Rd', 'Vance', 'Tuscaloosa', '35490', '334-301-2515', 33.1500234, -87.2562568],
    ['Pleasant Grove Baptist Association-Christian Ministry Center of Brookwood', '16914 Hwy 216', 'Brookwood', 'Tuscaloosa', '35444', '205-999-3870', 33.2756591, -87.2935841],
    ['Saint Mark Church Food Pantry', '1421 McFarland Blvd', 'Northport', 'Tuscaloosa', '35473', '205-339-5990', 33.2364116, -87.5718768],
    ['Maranatha SDA- I Care Food Bank', '2614 Herman Ave', 'Tuscaloosa', 'Tuscaloosa', '35401', '973-600-7459', 33.1883317, -87.5843695],
    ['United for the Homeless', '9310 AL-69', 'Northport', 'Tuscaloosa', '35473', '205-361-2837', 33.27985, -87.570094],
    ['Saint Vincent De Paul', '733 James Harrison Jr PKWY E', 'Tuscaloosa', 'Tuscaloosa', '35476', '205-561-0282', 33.2300079, -87.5939487],

    // ── Pickens County (4) ──────────────────────────────────────────────
    ['Forest UMC Food Pantry', '111 County Rd 89', 'Ethesville', 'Pickens', '35461', '', 33.4560483, -88.2277651],
    ['Cornerstone Methodist Church of Gordo', '210 N Main St', 'Gordo', 'Pickens', '35466', '205-364-7489', 33.3210623, -87.9029975],
    ['Cole Evangelistic Ministries', '12 3rd Ave NW Suite A', 'Aliceville', 'Pickens', '35442', '205-463-6433', 33.1295547, -88.15243],
    ['Reform Methodist Church', '807 3rd St NE', 'Reform', 'Pickens', '35481', '205-242-9701', 33.3874309, -88.009379],

    // ── Fayette County (2) ──────────────────────────────────────────────
    ['Christian Center of Concern-Fayette', '316 2nd AVE NE', 'Fayette', 'Fayette', '35555', '', 33.6877317, -87.8285265],
    ['New Hope Baptist Church', '2078 New Hope Rd', 'Berry', 'Fayette', '35546', '205-242-4746', 33.5374133, -87.6864268],

    // ── Lamar County (3) ────────────────────────────────────────────────
    ['Kennedy Church of God', '119 Porter St', 'Kennedy', 'Lamar', '35574', '', 33.5875752, -87.9707321],
    ['Grace Methodist Food Pantry', '3885 7th St', 'Vernon', 'Lamar', '35592', '205-712-1763', 33.7487064, -88.120914],
    ['Matt Miller Food Pantry', '131 Wood St', 'Millport', 'Lamar', '35576', '205-712-3327', 33.5623671, -88.0818311],

    // ── Marion County (6) ───────────────────────────────────────────────
    ['Brilliant Food Pantry', '210 Carlee St', 'Brilliant', 'Marion', '35548', '205-495-4456', 34.0247712, -87.7564611],
    ['Bethel Apostolic Holiness', '188 Iris Lane', 'Winfield', 'Marion', '35594', '205-717-6532', 33.9208754, -87.7885193],
    ['Fulton Bridge Baptist Church', '3090 County Rd 55', 'Hamilton', 'Marion', '35570', '205-921-3669', 34.0879798, -88.0115219],
    ['Hines Baptist Church', '10726 AL 241', 'Bear Creek', 'Marion', '35543', '205-486-2767', 34.2715531, -87.7221291],
    ['Community Pantry of Hamilton', '195 1st Ave SE', 'Hamilton', 'Marion', '35570', '205-412-2455', 34.1413197, -87.9869116],
    ['Winfield First Methodist Church', '835 Bankhead Hwy', 'Winfield', 'Marion', '35594', '205-487-2405', 33.9326712, -87.80414],

    // ── Sumter County (3) — written once despite duplicate Greene file ──
    ['Children of the Village Network', '', 'Bellamy', 'Sumter', '36901', '205-657-3173', 32.4490002, -88.1331964],
    ['IV Vets', '302 Longshore Dr', 'York', 'Sumter', '36925', '205-609-7193', 32.5016858, -88.2835412],
    ['Miller Hill Missionary Baptist Church', '344 Miller Hill Rd.', 'Epes', 'Sumter', '35460', '205-499-9798', 32.7295907, -88.1126539],
];

async function run() {
    console.log(`Adding ${NEW_PANTRIES.length} West Alabama pantries to resources/\n`);
    let count = 0;
    for (const [name, street, city, county, zip, phone, lat, lng] of NEW_PANTRIES) {
        const geohash = encodeGeohash(lat, lng);
        await db.collection('resources').add({
            orgId: 'org_pantry_belt',
            name,
            locationType: 'stationary_pantry',
            status: 'active',
            county,
            coordinates: { lat, lng },
            geohash,
            address: { street, city, county, state: 'AL', zip },
            hours: 'Call for hours',
            phone: normalizePhone(phone),
            website: '',
            eligibilityNotes: 'Open to all',
            docsRequired: ['Call ahead'],
            serviceRadiusMiles: null,
            capacity: null,
            tags: [],
            verified: false,
            createdBy: 'ai_import_west_alabama_2026-08-17',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        count++;
        console.log(`${count}/${NEW_PANTRIES.length} — [${county}] ${name}`);
    }
    console.log(`\nDone. ${count} new West Alabama pantries added.`);
    process.exit(0);
}

run().catch(err => { console.error('Failed:', err); process.exit(1); });
