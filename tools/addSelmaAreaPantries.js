/**
 * tools/addSelmaAreaPantries.js — Adds pantries from the Selma Area Food
 * Bank agency roster (October 2025) to the live `resources` collection:
 * Dallas, Perry, Marengo, Wilcox counties. Uses the Admin SDK
 * (serviceAccountKey.json), so it bypasses Firestore rules entirely — run
 * with care.
 *
 * Unlike the HAFB/FTGC imports, this source has no coordinates at all, so
 * each address is geocoded via the free US Census Bureau geocoder (no key
 * required — the Google Maps Geocoding API is not enabled on this Cloud
 * project's billing account), falling back to the county-seat center for
 * addresses it can't match (mostly rural county-road addresses). No ZIP
 * codes were provided in the source either.
 *
 * Exclusions before writing:
 *  - 3 rows from a "CFBCA" table embedded in the Dallas County PDF (Greater
 *    Birmingham Humane Society, Alabama Assoc. of Foodbanks, Shelby Co.
 *    Humane Society) — animal shelters and a food-bank trade association,
 *    not pantries; their own County column even lists Jefferson/Shelby, not
 *    Dallas, and their coordinates were an identical placeholder for all
 *    three rows.
 *  - 2 rows with no address at all in the source ("Cahaba Center for Mental
 *    Health", Dallas/Perry; "Catholic Social Ministries", Wilcox) — nothing
 *    to geocode or place on a map.
 *  - "Christian Outreach Alliance" (700 J L Chestnut Boulevard, Selma) —
 *    already live in Firestore as the same name at "700 Jeff Davis Ave,
 *    Selma" (Jeff Davis Ave was renamed J L Chestnut Blvd; same site).
 *  - "Trinity Episcopal Church Food Pantry" (408 N Main Avenue, Demopolis)
 *    — two doors down from the existing Firestore "Demopolis Food Pantry"
 *    (410 N Main Ave, Demopolis); treated as the same pantry surfaced under
 *    a generic vs. a church-specific name in two different surveys.
 *  - "Eastern Star Baptist Church" and "Friends of Theo Ratlif" (Marengo)
 *    share an address (940 Martha Drive, Demopolis) but are different
 *    named orgs/contacts — kept as distinct co-located entries, not deduped.
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
    Dallas:  { lat: 32.4074, lng: -87.0211 },  // Selma
    Perry:   { lat: 32.6368, lng: -87.3195 },  // Marion
    Marengo: { lat: 32.5088, lng: -87.8353 },  // Demopolis
    Wilcox:  { lat: 31.9974, lng: -87.2836 },  // Camden
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
    const first = raw.split(';')[0].trim();
    const digits = first.replace(/\D/g, '');
    if (digits.length !== 10) return first;
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

// name, street, city, county, phone
const NEW_PANTRIES = [
    // ── Dallas County (23) ──────────────────────────────────────────────
    ['AGAPE Community Development', '2306 US Highway 80 East', 'Selma', 'Dallas', '334-375-0386'],
    ['Alabama Teen Challenge', '3888 County Road 261', 'Jones', 'Dallas', '334-872-0133'],
    ['Crosspoint Christian Church', '1710 West Dallas Avenue', 'Selma', 'Dallas', '334-872-0086'],
    ['Faith Community Outreach Ministry', '4846 Highway 80 W', 'Selma', 'Dallas', '334-431-2411'],
    ['Five Points CDC', '7333 County Road 33', 'Orrville', 'Dallas', '334-996-0077'],
    ['Alabama Avenue Church of God', '2259 Alabama Avenue', 'Selma', 'Dallas', '334-412-0657'],
    ['Ellwood Community Church - Circle of Love', '1 Bell Road', 'Selma', 'Dallas', '334-875-4888'],
    ['Tyus Ministries', '203 Hobson Street', 'Selma', 'Dallas', '334-874-8340'],
    ['Special Years Plus, Inc.', '2710 Prospect Lane', 'Selma', 'Dallas', '334-875-3214'],
    ['Restoration Place', '2001 West Highland Avenue', 'Selma', 'Dallas', '334-872-8657'],
    ['Shady Grove Baptist Church', '234 County Road 83', 'Selma', 'Dallas', '334-875-6760'],
    ['Temple Gate Community Service Center', '1227 Philpot Street', 'Selma', 'Dallas', '504-400-6027'],
    ['New Sister Springs Baptist Church', '446 County Road 67', 'Selma', 'Dallas', '334-875-9520'],
    ['New Life Christian Church', '401 3rd Avenue', 'Selma', 'Dallas', '334-412-4915'],
    ['Abundant Life Center', '210 Lawrence Street', 'Selma', 'Dallas', '334-590-7260'],
    ['Mt. Olive #2 Baptist Church', '6827 Alabama Highway 41', 'Sardis', 'Dallas', '334-875-8259'],
    ['Greater New Hope', '4955 US Highway 80 East', 'Selma', 'Dallas', '334-267-1569'],
    ['New Hope Apostolic Church', '718 Franklin Street', 'Selma', 'Dallas', '334-418-0202'],
    ['Rising Star Primitive Baptist Church', '3665 County Road 115', 'Orrville', 'Dallas', '334-874-9658'],
    ['SABRA Sanctuary', '726 Dallas Avenue', 'Selma', 'Dallas', '334-412-9427'],
    ['Sandridge Missionary Baptist Church', '5024 County Road 27', 'Selma', 'Dallas', '334-267-1015'],
    ['Sardis Community Center', '6144 County Road 30', 'Sardis', 'Dallas', '334-872-7155'],
    ['Selma AIR', '102 Central Park Place', 'Selma', 'Dallas', '334-872-6795'],

    // ── Perry County (7) ────────────────────────────────────────────────
    ['Cahaba Medical Care Foundation', '1303 Washington Street', 'Marion', 'Perry', '205-277-2409'],
    ['Eagle Grove Missionary Baptist Church', '1467 County Road 38', 'Marion', 'Perry', '334-875-9985'],
    ['East Perry Improvement Center', '5689 County Road 64', 'Marion', 'Perry', '334-349-6783'],
    ['Faith in Action Ministries', '353 Water Avenue', 'Uniontown', 'Perry', '251-895-9239'],
    ['CHOICE', '60 Hamburg Duncan Road', 'Uniontown', 'Perry', '334-231-7019'],
    ['Sowing Seeds of Hope', '1728 South Washington Street', 'Marion', 'Perry', '334-683-4666'],
    ['Project G.R.A.C.E.', '20987 Highway 183', 'Marion', 'Perry', '334-345-0356'],

    // ── Marengo County (10) ─────────────────────────────────────────────
    ['BBCF', '2420 East Coats Avenue', 'Linden', 'Marengo', '334-654-4807'],
    ['Christian Chapel Baptist Church', '500 West Decatur Street', 'Demopolis', 'Marengo', '334-289-0332'],
    ['Eastern Star Baptist Church', '940 Martha Drive', 'Demopolis', 'Marengo', '334-289-0807'],
    ['Bethel Baptist Association', '308 E Coats Avenue', 'Linden', 'Marengo', '334-295-8805'],
    ['Braxton Senior Care Facility, Inc.', '307 South Cherry Street', 'Demopolis', 'Marengo', '334-289-2421'],
    ['Friends of Theo Ratlif', '940 Martha Drive', 'Demopolis', 'Marengo', '334-654-4457'],
    ['Central Baptist', '3620 County Road 6', "Dixon's Mill", 'Marengo', '334-992-2351'],
    ['TUCCA', '2400 E Coats Avenue', 'Linden', 'Marengo', '334-216-1385'],
    ['Linden Baptist Church', '100 Abbott Street', 'Linden', 'Marengo', '334-295-4278'],
    ['T.E.E.L.A', '1120 7th Avenue', 'Thomaston', 'Marengo', '334-375-0162'],

    // ── Wilcox County (5) ───────────────────────────────────────────────
    ['Blackbelt Central Alabama Housing', '211 Claiborne Street', 'Camden', 'Wilcox', '334-874-7907'],
    ['Yellow Bluff Baptist Church', '387 County Road 18', 'Pine Hill', 'Wilcox', '334-830-3419'],
    ['St Thomas AME Church', '323 St Thomas Church Road', 'Lower Peach Tree', 'Wilcox', '334-564-0808'],
    ['St. Wisdom Baptist Church', '245 Washington Court', 'Camden', 'Wilcox', '334-682-5986'],
    ['Pine Hill Mission', '3915 Broad Street', 'Pinehill', 'Wilcox', '334-419-7008'],
];

async function run() {
    console.log(`Adding ${NEW_PANTRIES.length} Selma-area pantries to resources/\n`);
    let count = 0;
    for (const [name, street, city, county, phone] of NEW_PANTRIES) {
        const coords = await geocode(`${street}, ${city}, AL`, county);
        const geohash = encodeGeohash(coords.lat, coords.lng);

        await db.collection('resources').add({
            orgId: 'org_pantry_belt',
            name,
            locationType: 'stationary_pantry',
            status: 'active',
            county,
            coordinates: coords,
            geohash,
            address: { street, city, county, state: 'AL', zip: '' },
            hours: 'Call for hours',
            phone: normalizePhone(phone),
            website: '',
            eligibilityNotes: 'Open to all',
            docsRequired: ['Call ahead'],
            serviceRadiusMiles: null,
            capacity: null,
            tags: [],
            verified: false,
            createdBy: 'ai_import_selma_area_2026-08-17',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        count++;
        console.log(`${count}/${NEW_PANTRIES.length} — [${county}] ${name} (${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)})`);
    }
    console.log(`\nDone. ${count} new Selma-area pantries added.`);
    process.exit(0);
}

run().catch(err => { console.error('Failed:', err); process.exit(1); });
