/**
 * tools/addEastAlabamaPantries.js — Adds pantries from six East Alabama
 * county datasets (PDF exports, 2026-08-17) to the live `resources`
 * collection: Macon, Chambers, Randolph, Tallapoosa, Lee, Russell. Uses the
 * Admin SDK (serviceAccountKey.json), so it bypasses Firestore rules
 * entirely — run with care.
 *
 * Source data quality notes:
 *  - Each PDF is a fixed-size slice of one shared, unfiltered multi-county
 *    FBEA/HAFB query — the file's title county is NOT reliable. Every row
 *    below is filed under its OWN "County" column value instead (several
 *    rows in "Macon County.pdf" are actually Lee County, several rows in
 *    "Tallapoosa County.pdf" are actually Randolph/Macon, etc).
 *  - The FBEA tables' own Latitude/Longitude columns are corrupted for
 *    Randolph, Tallapoosa, and Russell: multiple rows for real addresses
 *    tens of miles apart share an identical or near-identical coordinate
 *    pair (e.g. a Roanoke, AL church and a Camp Hill, AL church — 25 miles
 *    apart — both listed at 32.7945442,-85.6493672). Lee County's own FBEA
 *    rows show no such collisions, but every FBEA row here is re-geocoded
 *    from its street address anyway for consistency, ignoring the source
 *    lat/lng. HAFB-table rows (3 in the Tallapoosa file, 1 kept from Macon)
 *    have always been reliable in prior imports and are used as-is.
 *  - Two rows have no address at all in the source, only a bare "Alabama"
 *    state value and a lat/lng — nothing to geocode, so their given
 *    coordinates are used as the only available location data.
 *
 * Exclusions before writing:
 *  - "HAFB ADMIN - Tuskegee VA" (Macon) — an internal administrative
 *    record for the food bank itself, not a public pantry site.
 *  - "Forgiven Ministries" (listed in the Chambers PDF, but its own County
 *    column says Barbour) — matches the existing Firestore Barbour entry
 *    of the same distinctive name.
 *  - Four Russell County rows matching pantries already live in Firestore
 *    by exact address/phone: "St. Patrick Lazarus Food Pantry" (→ "St.
 *    Patrick Lazarus Pantry"), "Lakewood Baptist Church", "St. John 23rd
 *    Center" (→ "John 23rd Center"), "Potter's House Baptist Church
 *    Sincere Ministry" (→ "Potter's House Baptist").
 *  - "Macon County Food Pantry" (from the Russell PDF, County=Macon) —
 *    matches the existing Firestore Macon entry of the same name (a vague
 *    "Shorter/Tuskegee Area" stub); the new row has a real street address
 *    but per established practice the new duplicate is dropped rather than
 *    used to upgrade the existing doc, which is out of scope here.
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
    Macon:      { lat: 32.4244, lng: -85.6913 }, // Tuskegee
    Chambers:   { lat: 32.8598, lng: -85.3936 }, // LaFayette
    Randolph:   { lat: 33.2704, lng: -85.4527 }, // Wedowee
    Tallapoosa: { lat: 32.9098, lng: -85.9319 }, // Alexander City
    Lee:        { lat: 32.6099, lng: -85.4808 }, // Opelika/Auburn
    Russell:    { lat: 32.4610, lng: -85.0008 }, // Phenix City
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
    const digits = raw.replace(/\D/g, '');
    if (digits.length === 7) return `(334) ${raw}`;
    if (digits.length !== 10) return raw;
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

// name, street, city, county, zip, phone — geocoded from address
const NEW_PANTRIES = [
    // ── Lee County (17) ─────────────────────────────────────────────────
    ['Lakeview Baptist Church', '1600 East Glenn Avenue', 'Auburn', 'Lee', '36832', '334-887-7904'],
    ['Mount Moriah Missionary Baptist Church', '2255 Wrights Mill Road', 'Auburn', 'Lee', '36830', '334-821-3750'],
    ['Mount of Transfiguration', '3125 Wyndham Industrial Drive', 'Opelika', 'Lee', '36801', '334-750-5958'],
    ['Lee-Russell Council of Governments', '2207 Gateway Drive', 'Opelika', 'Lee', '36801', '334-749-5264'],
    ['Auburn Wesley Foundation (Loachapoka Methodist Church)', '6220 Stage Road', 'Loachapoka', 'Lee', '36865', ''],
    ['Catholic Social Services of Lee County', '2200 Gateway Drive, Suite A', 'Opelika', 'Lee', '36801', '334-363-0698'],
    ['Auburn United Methodist Church (Good News Center)', '302 East Magnolia Avenue', 'Auburn', 'Lee', '36832', '334-826-8800'],
    ['Community Market', '3810-C Pepperell Parkway', 'Opelika', 'Lee', '36801', '334-749-8844'],
    ['Auburn Community Development', '400 Boykin Center', 'Auburn', 'Lee', '36832', '334-821-2262'],
    ['Auburn Opelika SDA Church', '1201 South Uniroyal Road', 'Opelika', 'Lee', '36801', '334-758-4272'],
    ['Bridge Church', '1000 Lee Road 263', 'Cusseta', 'Lee', '36852', '334-742-0144'],
    ['Christian Care Ministries', '1000 Samford Court', 'Opelika', 'Lee', '36801', ''],
    ["St. Michael's Catholic Church", '1100 North College Street', 'Auburn', 'Lee', '36832', '334-887-5540'],
    ['Smiths Station Baptist Church', '2460 Panther Parkway', 'Smiths Station', 'Lee', '36877', '334-297-4932'],
    ['New Nelius Baptist Church', '175 New Nelius Church Road', 'Smiths Station', 'Lee', '36877', '229-829-5615'],
    ['Pine Grove Church Manna House', '7235 US-29 North', 'Opelika', 'Lee', '36801', '334-749-8874'],

    // ── Macon County (4) ────────────────────────────────────────────────
    ['Tuskegee Islamic Community', '1103 South Main Street', 'Tuskegee', 'Macon', '36083', ''],
    ['Zelda Kitt Ministry', '145 County Road 20', 'Shorter', 'Macon', '36075', '334-604-6093'],
    ['Mount Sinai Baptist Church Soup Kitchen', '106 East Oak St', 'Tuskegee', 'Macon', '36083', ''],
    ['From Under the Tree Ministries', '302 North School St', 'Tuskegee', 'Macon', '36083', ''],

    // ── Randolph County (4 — "Favored Families" listed separately, no address) ─
    ['Wedowee Lighthouse Community Kitchen', '17 2nd Street West', 'Wedowee', 'Randolph', '36278', ''],
    ['Wadley Cooperative Parish', '393 Highland Avenue', 'Wadley', 'Randolph', '36276', '334-646-2365'],
    ['Community Life Church', '220 County Road 79', 'Roanoke', 'Randolph', '36274', '334-863-5433'],
    ['Roanoke First Methodist Church', '806 Main Street', 'Roanoke', 'Randolph', '36274', '334-863-2253'],

    // ── Tallapoosa County (7 geocoded + 3 HAFB below) ───────────────────
    ['River of Life Worship Center', '1715 Tallapoosa Street', 'Alexander City', 'Tallapoosa', '35010', ''],
    ['Tallapoosa Christian Crisis Center', '4425 Dadeville Road', 'Alexander City', 'Tallapoosa', '35011', '256-329-3327'],
    ['Carrville Baptist Church', '2436 Notasulga Road', 'Tallassee', 'Tallapoosa', '36078', '334-283-2221'],
    ['House of Restoration Pentecostal Church', '519 Slaughter Avenue', 'Camp Hill', 'Tallapoosa', '36850', '256-524-0951'],
    ['First Universalist Church of Camp Hill', '', 'Camp Hill', 'Tallapoosa', '36850', '334-497-0868'],
    ['Food Pantry of the First Baptist Church Dadeville', '178 Tallassee Street', 'Dadeville', 'Tallapoosa', '36853', '334-559-8053'],
    ['Loaves & Fishes Ministry', '337 Hatcher Street', 'Dadeville', 'Tallapoosa', '36853', ''],

    // ── Chambers County (4) ─────────────────────────────────────────────
    ['Tabernacle of Praise Church International', '139 Church Street', 'Valley', 'Chambers', '36854', '334-524-8755'],
    ['Valley First Assembly of God', '5307 US-29', 'Valley', 'Chambers', '36854', '706-585-6990'],
    ['Christian Service Center', '5342 Cusseta Road', 'Lanett', 'Chambers', '36863', '334-476-2605'],
    ['Pilgrim Baptist Church', '420 North 12th Ave', 'Lanett', 'Chambers', '36863', ''],

    // ── Russell County (5) ──────────────────────────────────────────────
    ['Children & Family Connection', '910 13th Street', 'Phenix City', 'Russell', '36868', '334-448-1010'],
    ['Bethlehem Missionary Baptist Church', '3694 US Highway 80 West', 'Phenix City', 'Russell', '36869', '334-298-1403'],
    ['Summerville Baptist Church', '3500 Summerville Road', 'Phenix City', 'Russell', '36867', '334-298-4416'],
    ['Phenix City SDA Church', '4016 US-80 West', 'Phenix City', 'Russell', '36870', '334-298-951'],
    ['Church On The Rock', '4 Crawford Church Road', 'Phenix City', 'Russell', '36869', ''],
];

// name, street, city, county, zip, phone, lat, lng — trusted as-given (HAFB rows)
const NEW_PANTRIES_WITH_COORDS = [
    ['Bowen United Methodist Church', '2701 West Montgomery Rd.', 'Tuskegee', 'Macon', '36087', '(334) 727-4239', 32.4120795, -85.7152475],
    ['Early Rose Missionary Baptist Church', '57 E Street', 'Alexander City', 'Tallapoosa', '35010', '(256) 794-0952', 32.9547179, -85.9555075],
    ['Family Worship Center of Alex City', '427 E. Church Street', 'Alexander City', 'Tallapoosa', '35010', '(256) 392-4331', 32.9406223, -85.9438746],
    ['Pentecostals of Dadeville', '800 Horseshoe Bend Road', 'Dadeville', 'Tallapoosa', '36853', '(256) 596-3411', 32.8566519, -85.776556],
];

// name, street, city, county, zip, phone, lat, lng — no address in source at all; given coords are the only location data available
const NEW_PANTRIES_NO_ADDRESS = [
    ['Greater Ebenezer Missionary Baptist Church', '', '', 'Lee', '', '706-718-2724', 32.4008557, -85.7220855],
    ['Favored Families Food Pantry', '', '', 'Randolph', '', '', 33.170017, -85.3681572],
];

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
        createdBy: 'ai_import_east_alabama_2026-08-17',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
}

async function run() {
    const total = NEW_PANTRIES.length + NEW_PANTRIES_WITH_COORDS.length + NEW_PANTRIES_NO_ADDRESS.length;
    console.log(`Adding ${total} East Alabama pantries to resources/\n`);
    let count = 0;

    for (const [name, street, city, county, zip, phone] of NEW_PANTRIES) {
        const addr = street ? `${street}, ${city}, AL ${zip}` : `${city}, AL ${zip}`;
        const coords = await geocode(addr, county);
        await writePantry(name, street, city, county, zip, phone, coords);
        count++;
        console.log(`${count}/${total} — [${county}] ${name} (${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)})`);
    }

    for (const [name, street, city, county, zip, phone, lat, lng] of NEW_PANTRIES_WITH_COORDS) {
        await writePantry(name, street, city, county, zip, phone, { lat, lng });
        count++;
        console.log(`${count}/${total} — [${county}] ${name} (${lat}, ${lng}) [HAFB coords]`);
    }

    for (const [name, street, city, county, zip, phone, lat, lng] of NEW_PANTRIES_NO_ADDRESS) {
        await writePantry(name, street, city, county, zip, phone, { lat, lng });
        count++;
        console.log(`${count}/${total} — [${county}] ${name} (${lat}, ${lng}) [no address in source]`);
    }

    console.log(`\nDone. ${count} new East Alabama pantries added.`);
    process.exit(0);
}

run().catch(err => { console.error('Failed:', err); process.exit(1); });
