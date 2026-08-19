/**
 * tools/addBlackBeltHAFBPantries.js — Adds pantries from nine HAFB county
 * datasets (PDF exports, 2026-08-17) to the live `resources` collection:
 * Lowndes, Elmore, Autauga, Chilton, Coosa, Bullock, Pike, Crenshaw, Butler.
 * Uses the Admin SDK (serviceAccountKey.json), so it bypasses Firestore
 * rules entirely — run with care.
 *
 * Coordinates come directly from the source dataset (no geocoding needed).
 *
 * Source-data fixes applied before insert — three rows had their "County"
 * column filled with a city name instead of the actual county (confirmed
 * against both the row's own city and each file's own census-county
 * summary row):
 *  - "Holy Assembly of Jesus" (Elmore County.pdf): County read "Wetumpka"
 *    (the county seat) → corrected to Elmore.
 *  - "Trinity Episcopal Church" (Chilton County.pdf): County read "Clanton"
 *    → corrected to Chilton.
 *  - "Faith Walk Ministries" (Crenshaw County.pdf): County read "Lowndes"
 *    → corrected to Crenshaw (Luverne is the Crenshaw county seat).
 *
 * No name/phone overlaps found against existing Firestore resources in any
 * of these 9 counties — all 37 rows are new.
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
    const digits = raw.replace(/\D/g, '');
    if (digits.length !== 10) return raw;
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

// name, street, city, county, zip, phone, lat, lng
const NEW_PANTRIES = [
    // ── Lowndes County (3) ──────────────────────────────────────────────
    ["Jonathan's House of Prayer (JHOP)", '60 Curve Dr.', 'Hayneville', 'Lowndes', '36040', '(334) 221-7215', 32.1840315, -86.5802533],
    ['Friendship Missionary Baptist Church-Hayneville', '1882 State Highway 97 South', 'Hayneville', 'Lowndes', '36040', '(334) 312-3019', 32.1579047, -86.5500519],
    ['Mt. Olive Missionary Baptist Church - Burkeville', '1716 Frederick Douglass Road', 'Burkville', 'Lowndes', '36752', '(334) 300-2793', 32.2564759, -86.5363821],

    // ── Elmore County (7) — county-column fix noted above (row 1) ───────
    ['Holy Assembly of Jesus', '417 Gossom Pass', 'Wetumpka', 'Elmore', '36092', '(205) 283-7948', 32.5516175, -86.2550703],
    ['Mt. Zion Chapel AME Zion', '2493 Crenshaw Road', 'Wetumpka', 'Elmore', '36092', '(334) 324-3682', 32.5966206, -86.2753322],
    ['Jackson Chapel AME Zion Church', '4885 Coosada Road', 'Coosada', 'Elmore', '36020', '(334) 322-5239', 32.4944423, -86.3477958],
    ['Iglesia del Nazareno Monantial de Vida', '3251 Browns Rd.', 'Millbrook', 'Elmore', '36054', '(786) 616-5046', 32.5070973, -86.3808617],
    ['Courts of Praise', '4717 Coosada Parkway', 'Elmore', 'Elmore', '36025', '(334) 799-7590', 32.5198146, -86.3242131],
    ['Lake Elam Missionary Baptist Church', '4060 Gober Rd.', 'Millbrook', 'Elmore', '36054', '(334) 221-3226', 32.476136, -86.3553222],
    ['Elmore County Food Pantry', '515 W. Boundary St.', 'Wetumpka', 'Elmore', '36092', '(334) 567-3232', 32.5412476, -86.2238731],

    // ── Autauga County (8) ──────────────────────────────────────────────
    ['Prattville Church of Christ', '344 E. Main Street', 'Prattville', 'Autauga', '36067', '(334) 365-4201', 32.4589516, -86.4656096],
    ['Autauga Interfaith Care Center (AICC)', '163 W. Third St.', 'Prattville', 'Autauga', '36067', '(334) 365-4050', 32.46128, -86.4747355],
    ['Safe Harbor Outreach Center', '820 Selma Highway', 'Prattville', 'Autauga', '36067', '334-365-4108', 32.441775, -86.470549],
    ['Spring Hill A.M.E. Zion Church (Prattville)', '303 County Rd. 4 East', 'Prattville', 'Autauga', '36067', '(205) 217-1334', 32.4314654, -86.4693292],
    ['Petra Ministries, Inc.', '122 Tichnor Ave.', 'Prattville', 'Autauga', '36067', '(334) 590-0086', 32.460761, -86.4732192],
    ['Wadsworth Baptist Church', '2780 Hwy 143', 'Deatsville', 'Autauga', '36022', '(334) 569-2851', 32.6741637, -86.4496261],
    ['Old Kingston Outreach Ministry', '963 County Road 40 W', 'Prattville', 'Autauga', '36067', '(334) 568-8342', 32.5237101, -86.68043],
    ['Autaugaville Food Pantry (Autaugaville UMC)', '2416 Dutch Bend St.', 'Autaugaville', 'Autauga', '36003', '(334) 300-2314', 32.4359274, -86.6557862],

    // ── Chilton County (7) — county-column fix noted above (row 5) ──────
    ['United Prison Ministries International', '890 County Road 93', 'Verbena', 'Chilton', '36091', '(562) 322-8271', 32.7993755, -86.4609922],
    ['Mt. Pisgah United Methodist Church', '2930 County Road 49', 'Clanton', 'Chilton', '35045', '(205) 688-6248', 32.7878552, -86.6258679],
    ['Clanton Seventh Day Adventist Church', '401 18th St N', 'Clanton', 'Chilton', '35045', '(334) 201-9118', 32.8387662, -86.6510787],
    ['Maplesville Baptist Church', '9391 AL HWY 22', 'Maplesville', 'Chilton', '35040', '(334) 410-0681', 32.7886695, -86.8716481],
    ['Trinity Episcopal Church', '503 Second Ave South', 'Clanton', 'Chilton', '35045', '(205) 217-6955', 32.8377213, -86.6282288],
    ['First UMC - Clanton (Chilton Bread of Life FP)', '1111 Lay Dam Road', 'Clanton', 'Chilton', '35045', '(205) 389-2141', 32.8579776, -86.6226781],
    ['Triumph Church of Chilton County', '5066 Co. Rd. 49', 'Clanton', 'Chilton', '35045', '(205) 217-0448', 32.7636322, -86.6274157],

    // ── Coosa County (2) ────────────────────────────────────────────────
    ['Rockford Baptist Church', '9575 AL Hwy. 231', 'Rockford', 'Coosa', '35136', '(256) 496-2548', 32.8895681, -86.2196936],
    ['Community Life Center of Coosa County, Inc.', '188 County Road 30', 'Kellyton', 'Coosa', '35089', '(256) 935-0016', 32.8562177, -86.1226001],

    // ── Bullock County (1) ──────────────────────────────────────────────
    ['St. John AME Church- Union Springs', '533 County Road 30', 'Union Springs', 'Bullock', '36089', '(334) 421-3222', 32.1530868, -85.6443828],

    // ── Pike County (2) ─────────────────────────────────────────────────
    ['Vine Church', '450 US Highway 231', 'Troy', 'Pike', '36079', '(304) 457-9941', 31.8306505, -85.9939218],
    ['White Water Baptist Church', '4671 County Road 3319', 'Troy', 'Pike', '36079', '(334) 344-2137', 31.6886748, -85.8738305],

    // ── Crenshaw County (1) — county-column fix noted above ─────────────
    ['Faith Walk Ministries', '153 Jeffcoat Street', 'Luverne', 'Crenshaw', '36049', '(334) 492-4541', 31.7192451, -86.2681433],

    // ── Butler County (6) ───────────────────────────────────────────────
    ['Long Creek Missionary Baptist Church', '3665 Shows Road', 'Georgiana', 'Butler', '36033', '(334) 549-4805', 31.6236606, -86.8248272],
    ['Bethlehem Missionary Baptist Church - Greenville', '748 Bethlehem Rd.', 'Greenville', 'Butler', '36037', '(334) 437-1166', 31.7599129, -86.453252],
    ['Old Elam Baptist Church', '958 Pettibone Rd', 'Greenville', 'Butler', '36037', '(334) 368-0569', 31.7657972, -86.6780371],
    ["Southside Bapt. Ch. - Greenville - Shepherd's Table", '211 King St', 'Greenville', 'Butler', '36037', '(334) 525-0085', 31.8268881, -86.6300283],
    ['Joseph Ministries', '112 Adams Street', 'Greenville', 'Butler', '36037', '(334) 437-3611', 31.8284355, -86.6230327],
    ['Walnut Street Church of Christ', '306 Walnut Street', 'Greenville', 'Butler', '36037', '(334) 382-3001', 31.8285349, -86.6207871],
];

async function run() {
    console.log(`Adding ${NEW_PANTRIES.length} Black Belt HAFB pantries to resources/\n`);
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
            createdBy: 'ai_import_blackbelt_hafb_2026-08-17',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        count++;
        console.log(`${count}/${NEW_PANTRIES.length} — [${county}] ${name}`);
    }
    console.log(`\nDone. ${count} new Black Belt HAFB pantries added.`);
    process.exit(0);
}

run().catch(err => { console.error('Failed:', err); process.exit(1); });
