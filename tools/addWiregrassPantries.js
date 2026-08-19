/**
 * tools/addWiregrassPantries.js — Adds pantries from the Feeding Alabama
 * Agency Listing (Wiregrass region) to the live `resources` collection:
 * Coffee, Geneva, Dale, Houston, Henry, Barbour counties. Uses the Admin
 * SDK (serviceAccountKey.json), so it bypasses Firestore rules entirely —
 * run with care.
 *
 * Only Barbour County's 3-row "FBEA" table came with coordinates; every
 * other row (the "Wiregrass" tables, 62 rows) is geocoded via the free US
 * Census Bureau geocoder, falling back to the county-seat center on a
 * miss. Phone numbers in the Wiregrass tables are 7-digit local numbers
 * with no area code — the 334 Wiregrass-region area code is prepended;
 * numbers already carrying a (different, as-given) area code are left as
 * printed rather than guessed at.
 *
 * Corrections/exclusions before writing:
 *  - "Helping Hands Dothan" appears in the Dale County PDF but its own
 *    County column reads "Houston" and its address is in Dothan (Houston
 *    County's seat) — filed under Houston, not Dale.
 *  - Dropped 3 Barbour rows matching pantries already live in Firestore:
 *    "White Oak UMC" (exact phone match), "Eufaula Church of God In
 *    Christ" (exact name match), and "Bakerhill Community Outreach"
 *    (near-identical name to "Bakerhill Community Outreach Center";
 *    Bakerhill is an unincorporated community adjoining Eufaula).
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

const COUNTY_FALLBACK = {
    Coffee:  { lat: 31.3238, lng: -85.8552 }, // Enterprise
    Geneva:  { lat: 31.0396, lng: -85.8558 }, // Geneva
    Dale:    { lat: 31.4574, lng: -85.6497 }, // Ozark
    Houston: { lat: 31.2232, lng: -85.3905 }, // Dothan
    Henry:   { lat: 31.5674, lng: -85.2513 }, // Abbeville
    Barbour: { lat: 31.8912, lng: -85.1355 }, // Eufaula
};

async function geocode(address, county) {
    const encoded = encodeURIComponent(address);
    const url = `https://geocoding.geo.census.gov/geocoder/locations/onelineaddress?address=${encoded}&benchmark=Public_AR_Current&format=json`;
    const res = await fetch(url);
    const data = await res.json();
    const match = data.result?.addressMatches?.[0];
    if (match) {
        return { lat: match.coordinates.y, lng: match.coordinates.x };
    }
    console.warn(`   ⚠️  No Census geocode match for "${address}" — falling back to ${county} county seat`);
    return COUNTY_FALLBACK[county];
}

function normalizePhone(raw) {
    if (!raw) return '';
    const first = raw.split(',')[0].trim();
    const digits = first.replace(/\D/g, '');
    if (digits.length === 7) return `(334) ${first}`;
    if (digits.length !== 10) return first;
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

// name, street, city, county, zip, phone
const NEW_PANTRIES = [
    // ── Coffee County (8) ───────────────────────────────────────────────
    ['Wiregrass Inner Faith Help Center', '405 Janice Street', 'Enterprise', 'Coffee', '36330', '447-1948'],
    ['Wiregrass Elba Church of Christ', '715 N. Troy Highway', 'Elba', 'Coffee', '36323', '897-2057'],
    ['Wiregass Community Worship', '151 Eastgate /383 Geneva Highway', 'Enterprise', 'Coffee', '36331', '500-0885'],
    ['Beth-El Faith Church', '3180 Rucker Blvd. E.', 'Enterprise', 'Coffee', '36330', '475-7757'],
    ['Johns Chapel AME Church', '605 Geneva Highway', 'Enterprise', 'Coffee', '36331', '393-2661'],
    ['Coffee County Community Church', '130 Vester Cole', 'New Brockton', 'Coffee', '36351', '475-3525'],
    ['Christian Mission Center', '231 Geneva Highway', 'Enterprise', 'Coffee', '36330', '393-2607'],
    ['The Grace Place/Salem Baptist', '5730 Shellfield Road', 'Enterprise', 'Coffee', '36330', '347-5214'],

    // ── Geneva County (6) ───────────────────────────────────────────────
    ['First United Methodist Church - Slocomb', '102 N. Dalton', 'Slocomb', 'Geneva', '36375', '886-2897'],
    ['Jehovah New Covenant Of Jesus', '600 W. Main Street', 'Hartford', 'Geneva', '36344', '333-8858'],
    ['Geneva County Community Church', '2497 N. State Highway 85', 'Geneva', 'Geneva', '36340', '791-7663'],
    ['The Crossing Geneva', '617 S. Commerce Street', 'Geneva', 'Geneva', '36340', '360-4478'],
    ['Shiloh Baptist Church', '873 Shiloh Road', 'Hartford', 'Geneva', '36344', '588-3540'],
    ['The Hartford Food Pantry', '310 Avenue H', 'Hartford', 'Geneva', '36344', '587-9095'],

    // ── Dale County (12 — "Helping Hands Dothan" moved to Houston) ──────
    ['Shiloh 7th Day Adventist', '199 Willa Street', 'Ozark', 'Dale', '36361', '774-6713'],
    ['Mary Hill Family Services Center', '204 Katherine Avenue', 'Ozark', 'Dale', '36360', '350-3668'],
    ['Daleville Heights COC', '660 Willow Oaks Drive', 'Ozark', 'Dale', '36360', '464-0415'],
    ['Ozark Baptist Church', '282 S. Union Avenue', 'Ozark', 'Dale', '36360', '774-9381'],
    ['Ridgecrest Baptist Church', '1971 Deese Road', 'Ozark', 'Dale', '36360', '774-5610'],
    ['Ewell Bible BC', '64 Susie Street', 'Ozark', 'Dale', '36360', '774-4127'],
    ['Mt. Zion Assembly of God', '1078 County Road 112', 'Midland City', 'Dale', '36350', '983-3963'],
    ['Winds of Change', '1615 E. Andrews Avenue', 'Ozark', 'Dale', '36360', '379-0964'],
    ['Word of Truth Family Church', '5474 Highway 231 S.', 'Ozark', 'Dale', '36352', '655-7770'],
    ['Dale Co. Rescue Mission', '891 N. Highway 231', 'Ozark', 'Dale', '36360', '774-6553'],
    ['Daleville Christian Fellowship', '1 Martin Luther King, Jr. Circle', 'Daleville', 'Dale', '36322', '598-6279'],
    ['St. John Catholic Church', '475 Camilla Street', 'Ozark', 'Dale', '36360', '774-6826'],

    // ── Houston County (26 — includes "Helping Hands Dothan" from Dale) ─
    ['Catholic Social Services', '577 West Main Street', 'Dothan', 'Houston', '36301', '793-3601'],
    ['Living Hope Community Center', '309 N. Lena Street', 'Dothan', 'Houston', '36303', '671-2376'],
    ['Hines Chapel A.M.E. Church', '912 Dellwood Avenue', 'Dothan', 'Houston', '36303', '744-9306'],
    ['Greater Dothan Baptist Church', '2041 Mimosa Drive', 'Dothan', 'Houston', '36303', '699-0066'],
    ['Triune Christian Family', '209 Blackshear Street', 'Dothan', 'Houston', '36303', '828-4541'],
    ['Covenant United Methodist Church', '3610 West Main Street', 'Dothan', 'Houston', '36305', '793-4440'],
    ['Good News Ministry Inc', '208 W. Newton Street', 'Dothan', 'Houston', '36303', '405-9844'],
    ['Mercy Outreach Mission', '310 Church Street', 'Ashford', 'Houston', '36312', '890-3402'],
    ['Bread Of Life Ministries', '213 W. Crawford Street', 'Dothan', 'Houston', '36301', '470-6055'],
    ['Episcopal Church of the Nativity', '148 N. Foster Street', 'Dothan', 'Houston', '36301', '792-8742'],
    ['Dothan Community Church', '4390 Westgate Parkway', 'Dothan', 'Houston', '36303', '794-9464'],
    ['First Missionary BC', '311 W. Church Street', 'Columbia', 'Houston', '36319', '258-3861'],
    ['Evergreen Presbyterian Church', '1103 North Pontiac Avenue', 'Dothan', 'Houston', '36303', '792-7898'],
    ['First Church of the Nazarene', '1081 Honeysuckle Road', 'Dothan', 'Houston', '36305', '792-6974'],
    ['Dothan 7th Day Adventist', '147 Picard Street', 'Dothan', 'Houston', '36301', '678-650-5766'],
    ['Cottonwood United Meth. Church', '1331 Metcalf Street', 'Cottonwood', 'Houston', '36320', '547-8617'],
    ['Philadelphia Baptist Church', '24 Philadelphia Church Road', 'Gordon', 'Houston', '36343', '522-3373'],
    ['Salvation Army - Houston County', '1001 South Bell Street', 'Dothan', 'Houston', '36301', '792-1911'],
    ['Shady Grove C.H. Church', '355 County Road 75 S.', 'Pansey', 'Houston', '36370', '714-3878'],
    ['Southeast Alabama Baptist Assoc', '1306 Ross Clark Circle', 'Dothan', 'Houston', '36303', '699-2855'],
    ['St. John Missionary BC', '5529 South State Highway 95', 'Gordon', 'Houston', '36343', '522-3220'],
    ['The Harbor Church', '320 N. Foster Street', 'Dothan', 'Houston', '36303', '790-4031'],
    ["TOPS/Momma Tina's", '605 N. Alice Street', 'Dothan', 'Houston', '36303', '714-3482'],
    ['Memphis Baptist Church', '4595 Eddins Road', 'Dothan', 'Houston', '36301', '677-5387'],
    ['Westgate Church of Christ', '617 Westgate Pkwy', 'Dothan', 'Houston', '36303', '793-2280'],
    ['Helping Hands Dothan', '435 J. Steele Road', 'Dothan', 'Houston', '36303', '601-934-0554'],

    // ── Henry County (6) ────────────────────────────────────────────────
    ['Sardis Missionary Baptist Church', '115 County Road 238', 'Headland', 'Henry', '36345', '693-5318'],
    ["Lord's House of Prayer", '121 Ash Drive', 'Abbeville', 'Henry', '36310', '618-0480'],
    ['Judson Baptist Church', '180 County Road 93', 'Abbeville', 'Henry', '36310', '618-5984'],
    ['Judson Baptist Assn.', '532 Ozark Road', 'Abbeville', 'Henry', '36310', '585-3274'],
    ['Christ Temple Outreach', '2836 Highway 10 East', 'Abbeville', 'Henry', '36310', '787-5713'],
    ['Greater Shiloh Baptist Church', '12 Martin Luther King jr. Drive', 'Headland', 'Henry', '36345', '693-3590'],

    // ── Barbour County (6 Wiregrass — "White Oak UMC" dropped as a dup) ─
    ['Eufaula Church of God', '4097 U.S. Highway 431 S.', 'Eufaula', 'Barbour', '36327', '687-4581'],
    ['Friendly AOG', '35 Cooper Road', 'Clayton', 'Barbour', '36016', '775-7615'],
    ['Holy Redeemer Catholic Church', '515 West Broad Street', 'Eufaula', 'Barbour', '36027', '687-3716'],
    ['Grace Independent Baptist', '9 Cheneyhatchee Drive', 'Eufaula', 'Barbour', '36027', '687-5397'],
    ['Hilltop Cidel Christian Church', '343 South Randolph Avenue', 'Eufaula', 'Barbour', '36027', '688-1229'],
    ['Shiloh A.M.E. Church', '13 Humer Street', 'Midway', 'Barbour', '36053', '775-3131'],
];

// name, street, city, county, zip, phone, lat, lng — already geocoded (FBEA table)
const NEW_PANTRIES_WITH_COORDS = [
    ['Calvary Hope Center Food Bank', '3267 Louisville Street', 'Clio', 'Barbour', '36017', '850-363-1283', 31.7096977, -85.6102997],
];

async function run() {
    const total = NEW_PANTRIES.length + NEW_PANTRIES_WITH_COORDS.length;
    console.log(`Adding ${total} Wiregrass pantries to resources/\n`);
    let count = 0;

    for (const [name, street, city, county, zip, phone] of NEW_PANTRIES) {
        const coords = await geocode(`${street}, ${city}, AL ${zip}`, county);
        await writePantry(name, street, city, county, zip, phone, coords);
        count++;
        console.log(`${count}/${total} — [${county}] ${name} (${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)})`);
    }

    for (const [name, street, city, county, zip, phone, lat, lng] of NEW_PANTRIES_WITH_COORDS) {
        await writePantry(name, street, city, county, zip, phone, { lat, lng });
        count++;
        console.log(`${count}/${total} — [${county}] ${name} (${lat}, ${lng})`);
    }

    console.log(`\nDone. ${count} new Wiregrass pantries added.`);
    process.exit(0);
}

async function writePantry(name, street, city, county, zip, phone, coords) {
    const geohash = encodeGeohash(coords.lat, coords.lng);
    await db.collection('resources').add({
        orgId: 'org_pantry_belt',
        name,
        locationType: 'stationary_pantry',
        status: 'active',
        county,
        coordinates: coords,
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
        createdBy: 'ai_import_wiregrass_2026-08-17',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
}

run().catch(err => { console.error('Failed:', err); process.exit(1); });
