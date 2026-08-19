/**
 * tools/addHAFBMontgomeryPantries.js — Adds Montgomery-area pantries from the
 * HAFB Montgomery County dataset (PDF export, 2026-08-17) to the live
 * `resources` collection. Uses the Admin SDK (serviceAccountKey.json), so it
 * bypasses Firestore rules entirely — run with care.
 *
 * Coordinates come directly from the source dataset (no geocoding needed).
 *
 * Dedup performed before writing, against both the source PDF and the 36
 * Montgomery resources already live in Firestore:
 *  - 4 exact duplicate rows within the PDF itself (Newtown Church of Christ,
 *    St. John's AME Church, and a 3-way "MBA Love Loud" cluster all sharing
 *    the same address/coords) collapsed to one row each.
 *  - 12 rows dropped as duplicates of existing `resources` docs: matched by
 *    identical/near-identical phone number (Pilgrim Rest, Resurrection
 *    Catholic, St. Bede, Community of Hope, Beulah Baptist, FBC Community
 *    Ministries) or by an unmistakable name match despite a differing phone
 *    (Newtown Church of Christ, St. John's/St Johns A M E Church, Church of
 *    the Holy Comforter/Episcopal Church of the Holy Comforter, Holt Street
 *    Church of Christ, Grace Community Church).
 *  - 1 row dropped because its only address is a PO Box (MBA Love Loud
 *    Mobile, PO Box 3319) — not a real physical location to pin on the map.
 */
require('dotenv').config();
const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

// Minimal geohash encoder (matches tools/addMontgomeryPantries.js).
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
    const digits = raw.replace(/\D/g, '');
    if (digits.length !== 10) return raw;
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

// ── New Montgomery-area pantries (HAFB dataset, 2026-08-17), post-dedup ────
const NEW_PANTRIES = [
    { name: 'East Lake Community Development', street: '135 S. Panama St.', city: 'Montgomery', zip: '36107', phone: '(205) 639-5083', lat: 32.3792902, lng: -86.2741152, county: 'Montgomery' },
    { name: 'Beacon Light Ministries', street: '874 Martha St.', city: 'Montgomery', zip: '36104', phone: '(334) 262-8382', lat: 32.3745355, lng: -86.3250936, county: 'Montgomery' },
    { name: 'Eastern Hills Baptist Church', street: '3604 Pleasant Ridge Rd.', city: 'Montgomery', zip: '36109', phone: '(334) 538-1136', lat: 32.3784469, lng: -86.2560862, county: 'Montgomery' },
    { name: 'Fresh Oil Revival Center', street: '6004-D E. Shirley Lane', city: 'Montgomery', zip: '36105', phone: '(334) 531-0057', lat: 32.3711085, lng: -86.2104658, county: 'Montgomery' },
    { name: 'First Montgomery S.D.A. Church', street: '4233 Atlanta Highway', city: 'Montgomery', zip: '36109', phone: '(334) 669-7803', lat: 32.3829062, lng: -86.2363116, county: 'Montgomery' },
    { name: 'Dalraida Church of Christ', street: '3740 Atlanta Highway', city: 'Montgomery', zip: '36109', phone: '(706) 616-2694', lat: 32.3823597, lng: -86.2514548, county: 'Montgomery' },
    { name: 'Sunshine Ministries, Inc', street: '2750 Tremont Street', city: 'Montgomery', zip: '36110', phone: '(334) 669-2010', lat: 32.4292299, lng: -86.2908086, county: 'Montgomery' },
    { name: "St. Margaret's Services, Inc.", street: '4455 Narrow Lane Road', city: 'Montgomery', zip: '36116', phone: '(334) 233-9688', lat: 32.3203521, lng: -86.2808374, county: 'Montgomery' },
    { name: 'MBA- Love Loud- Montgomery County', street: '1551 East Ann Street', city: 'Montgomery', zip: '36107', phone: '(334) 269-5726', lat: 32.3621978, lng: -86.270493, county: 'Montgomery' },
    { name: 'MBA Love Loud (Mobile)', street: '20 Interstate Park Dr.', city: 'Montgomery', zip: '36109', phone: '(334) 269-5726', lat: 32.3629505, lng: -86.2437243, county: 'Montgomery' },
    { name: 'Metropolitan United Methodist Church', street: '3091 Gaston Avenue', city: 'Montgomery', zip: '36105', phone: '334-263-0950', lat: 32.3500809, lng: -86.3176264, county: 'Montgomery' },
    { name: 'Church of the Ascension', street: '315 Clanton Ave.', city: 'Montgomery', zip: '36104', phone: '(334) 462-5166', lat: 32.3595425, lng: -86.3037226, county: 'Montgomery' },
    { name: 'Bible Verse Church', street: '2601 East S. Blvd.', city: 'Montgomery', zip: '36116', phone: '(334) 245-3447', lat: 32.3278024, lng: -86.2559973, county: 'Montgomery' },
    { name: 'First Christian Church', street: '1705 Taylor Road', city: 'Montgomery', zip: '36117', phone: '(334) 546-1178', lat: 32.3532239, lng: -86.1712267, county: 'Montgomery' },
    { name: 'First Baptist Church - Greater Washington Park', street: '2813 E. 3rd St.', city: 'Montgomery', zip: '36108', phone: '(334) 467-4181', lat: 32.3634219, lng: -86.2697527, county: 'Montgomery' },
    { name: 'Holy Spirit Catholic Church', street: '8570 Vaughn Rd', city: 'Montgomery', zip: '36117', phone: '(334) 546-9252', lat: 32.336929, lng: -86.1519646, county: 'Montgomery' },
    { name: 'True Divine Community Development, Inc.', street: '4601 Troy Highway', city: 'Montgomery', zip: '36116', phone: '(334) 220-4582', lat: 32.3102192, lng: -86.2178365, county: 'Montgomery' },
    { name: 'Eternal Fountain Ministries', street: '3368 Harrison Rd.', city: 'Montgomery', zip: '36109', phone: '706-304-7527', lat: 32.3664778, lng: -86.2560741, county: 'Montgomery' },
    { name: 'Maggie Street Missionary Baptist Church', street: '642 Maggie Street', city: 'Montgomery', zip: '36106', phone: '(334) 590-2558', lat: 32.3709262, lng: -86.2908871, county: 'Montgomery' },
    { name: 'All Saints Kingdom Church', street: '4732 Narrow Lane Rd', city: 'Montgomery', zip: '36116', phone: '(334) 322-2198', lat: 32.3134559, lng: -86.2837003, county: 'Montgomery' },
    { name: 'Church of the Highlands', street: '4255 Taylor Rd.', city: 'Montgomery', zip: '36116', phone: '(256) 848-4292', lat: 32.3226623, lng: -86.1769692, county: 'Montgomery' },
    { name: 'St. Paul AME Church', street: '706 East Patton St.', city: 'Montgomery', zip: '36111', phone: '(334) 324-2931', lat: 32.3330285, lng: -86.2947698, county: 'Montgomery' },
    { name: 'Snowdoun Baptist Church', street: '6564 Norman Bridge Road', city: 'Montgomery', zip: '36105', phone: '(334) 315-3499', lat: 32.2549022, lng: -86.3027957, county: 'Montgomery' },
    { name: 'Westside Church of Christ', street: '1301 East South Boulevard', city: 'Montgomery', zip: '36116', phone: '(334) 543-6837', lat: 32.3271642, lng: -86.28601, county: 'Montgomery' },
    { name: 'Amazing Grace Health Ministries, Inc.', street: '5911 Monticello Dr', city: 'Montgomery', zip: '36117', phone: '(334) 590-2812', lat: 32.3656798, lng: -86.210733, county: 'Montgomery' },
    { name: 'Evangel Church', street: '3975 Vaughn Road', city: 'Montgomery', zip: '36106', phone: '(334) 233-6569', lat: 32.3502132, lng: -86.2409368, county: 'Montgomery' },
    { name: 'Lord Saving Many Solutions', street: '935 Early St.', city: 'Montgomery', zip: '36108', phone: '(334) 440-6071', lat: 32.3585962, lng: -86.3224329, county: 'Montgomery' },
    { name: 'Salvation Army (Montgomery River Region)', street: '4250 Lomac St.', city: 'Montgomery', zip: '36106', phone: '(334) 801-8258', lat: 32.3577848, lng: -86.2313369, county: 'Montgomery' },
    { name: 'Woodland Methodist Church', street: '4428 Wallahatchie Rd.', city: 'Pike Road', zip: '36064', phone: '(334) 301-1445', lat: 32.3129117, lng: -86.0466281, county: 'Montgomery' },
    { name: 'St. James Missionary Baptist Church', street: '491 St. James Church Loop', city: 'Pike Road', zip: '36064', phone: '(334) 657-3290', lat: 32.3548525, lng: -86.0472801, county: 'Montgomery' },
    { name: 'Old Mount Pleasant Missionary Baptist Church', street: '25169 Troy Hwy.', city: 'Pine Level', zip: '36065', phone: '(334) 467-0793', lat: 32.0264042, lng: -86.0312689, county: 'Montgomery' },
    { name: 'Anointed Warrior Hill Baptist Church', street: '1 Pine Level Lane', city: 'Pine Level', zip: '36065', phone: '(334) 819-9763', lat: 32.0785972, lng: -86.0626529, county: 'Autauga' },
    { name: 'New Providence Baptist Church -- Ramer', street: '15840 Woodley Rd.', city: 'Ramer', zip: '36064', phone: '(334) 558-6613', lat: 32.1483519, lng: -86.138981, county: 'Montgomery' },
    { name: 'Jericho A.M.E. Zion Church', street: '5251 Hobbie Road', city: 'Snowdoun', zip: '36105', phone: '(334) 284-3354', lat: 32.189017, lng: -86.2418907, county: 'Montgomery' },
];

async function run() {
    console.log(`Adding ${NEW_PANTRIES.length} HAFB Montgomery-area pantries to resources/\n`);
    let count = 0;
    for (const p of NEW_PANTRIES) {
        const geohash = encodeGeohash(p.lat, p.lng);
        await db.collection('resources').add({
            orgId: 'org_pantry_belt',
            name: p.name,
            locationType: 'stationary_pantry',
            status: 'active',
            county: p.county,
            coordinates: { lat: p.lat, lng: p.lng },
            geohash,
            address: { street: p.street, city: p.city, county: p.county, state: 'AL', zip: p.zip },
            hours: 'Call for hours',
            phone: normalizePhone(p.phone),
            website: '',
            eligibilityNotes: 'Open to all',
            docsRequired: ['Call ahead'],
            serviceRadiusMiles: null,
            capacity: null,
            tags: [],
            verified: false,
            createdBy: 'ai_import_hafb_montgomery_2026-08-17',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        count++;
        console.log(`${count}/${NEW_PANTRIES.length} — ${p.name} (${p.lat}, ${p.lng})`);
    }
    console.log(`\nDone. ${count} new Montgomery-area pantries added.`);
    process.exit(0);
}

run().catch(err => { console.error('Failed:', err); process.exit(1); });
