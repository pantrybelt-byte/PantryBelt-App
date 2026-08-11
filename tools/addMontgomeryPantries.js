/**
 * tools/addMontgomeryPantries.js — One-off addition of researched Montgomery
 * County pantries to the live `resources` collection. Uses the Admin SDK
 * (serviceAccountKey.json), so it bypasses Firestore rules entirely — run
 * with care. Source data is from web research (foodpantries.org,
 * gracechurchal.com, holycomfortermgm.org) on 2026-08-10; hours/phone
 * numbers should be spot-checked before being treated as fully verified.
 */
require('dotenv').config();
const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_GEOCODING_KEY;

// Minimal geohash encoder (no external dependency needed for this one-off script).
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

async function geocode(address) {
    const encoded = encodeURIComponent(address);
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encoded}&key=${GOOGLE_MAPS_API_KEY}`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.status === 'OK' && data.results[0]) {
        return data.results[0].geometry.location; // { lat, lng }
    }
    console.warn(`   ⚠️  Geocode "${data.status}" for "${address}" — falling back to Montgomery center`);
    return { lat: 32.3668, lng: -86.2999 };
}

// ── New Montgomery County pantries (web research, 2026-08-10) ──────────────
const NEW_PANTRIES = [
    { name: 'Forest Park Baptist Ministry Center', zip: '36106', phone: '(334) 269-5726', hours: 'Mon & Wed 9:00am–12:00pm, 1:00–3:00pm', eligibility: 'Open to all', docs: ['Call ahead'] },
    { name: 'Episcopal Church of the Holy Comforter', zip: '36111', phone: '(334) 281-1337', hours: 'Tue 10:00am–12:00pm', eligibility: 'Open to all', docs: ['Call ahead'] },
    { name: 'Reaching Out Mission Outreach (St. Jude the Apostle)', zip: '36107', phone: '(334) 277-0182', hours: 'Thu 10:00am–2:00pm', eligibility: 'Open to all', docs: ['Call ahead'] },
    { name: 'We Care Ministries', zip: '36106', phone: '(334) 832-9511', hours: 'Call for hours', eligibility: 'Open to all', docs: ['Call ahead'] },
    { name: 'St Johns A M E Church', zip: '36104', phone: '(334) 265-4136', hours: 'Call for hours', eligibility: 'Open to all', docs: ['Call ahead'] },
    { name: 'Seventh Day Adventist Church', zip: '36109', phone: '(334) 277-4164', hours: 'Call for hours', eligibility: 'Open to all', docs: ['Call ahead'] },
    { name: 'Pilgrim Rest Baptist Church', zip: '36107', phone: '(334) 265-1807', hours: 'Call for hours', eligibility: 'Open to all', docs: ['Call ahead'] },
    { name: 'Old Augusta Baptist Church', zip: '36117', phone: '(334) 279-7245', hours: 'Sat 8:00am–12:00pm', eligibility: 'Open to all', docs: ['Call ahead'] },
    { name: 'New Harvest Church of Christ', zip: '36116', phone: '(334) 286-8000', hours: '4th Sat 9:00–11:00am', eligibility: 'Open to all', docs: ['Call ahead'] },
    { name: 'Mount Zion A M E Zion Church', zip: '36104', phone: '(334) 265-9361', hours: '10:00–11:00am', eligibility: 'Open to all', docs: ['Call ahead'] },
    { name: 'Love Center Full Gospel', zip: '36111', phone: '(770) 907-9877', hours: 'Wed 6:30–7:00pm; Sun 11:00–11:30am', eligibility: 'Open to all', docs: ['Call ahead'] },
    { name: 'King Hill Baptist Family Life Center', zip: '36107', phone: '(334) 262-1260', hours: 'Call for details', eligibility: 'Open to all', docs: ['Call ahead'] },
    { name: 'Holt Street Church of Christ', zip: '36105', phone: '(334) 265-2253', hours: 'Sun & Wed', eligibility: 'Open to all', docs: ['Call ahead'] },
    { name: 'Freewill Baptist Church', zip: '36108', phone: '(334) 262-2205', hours: '2nd & 4th Tue of month', eligibility: 'Open to all', docs: ['Call ahead'] },
    { name: 'First Baptist Church Mission Center', zip: '36104', phone: '(334) 263-6369', hours: 'Mon 9:00am–12:00pm; Wed 1:00–3:00pm', eligibility: 'Open to all', docs: ['Call ahead'] },
    { name: 'First Baptist Church Community Ministries', zip: '36104', phone: '(334) 262-2273', hours: 'Wed 9:00–11:30am, 12:30–3:00pm', eligibility: 'Open to all', docs: ['Call ahead'] },
    { name: 'Family Guidance Center of Alabama', zip: '36116', phone: '(334) 270-4100', hours: 'Mon–Fri 8:00am–4:30pm', eligibility: 'Open to all', docs: ['Call ahead'] },
    { name: 'Dalraida United Methodist Church', zip: '36109', phone: '(334) 272-2190', hours: 'Wed 10:00–11:30am', eligibility: 'Open to all', docs: ['Call ahead'] },
    { name: 'Church of Christ', zip: '36108', phone: '(334) 265-2253', hours: 'Call for hours', eligibility: 'Open to all', docs: ['Call ahead'] },
    { name: 'Catoma Baptist Church', zip: '36108', phone: '(334) 265-2881', hours: '1st Tue of month 9:00–10:00am', eligibility: 'Open to all', docs: ['Call ahead'] },
    { name: 'Beulah Baptist Church', zip: '36106', phone: '(334) 265-2697', hours: '3rd Tue & Fri', eligibility: 'Open to all', docs: ['Call ahead'] },
    { name: 'Shepherds Ministries, Inc', zip: '36116', phone: '(334) 288-6650', hours: '2nd Tue & 4th Thu of month', eligibility: 'Open to all', docs: ['Call ahead'] },
    { name: 'Newtown Church of Christ', zip: '36104', phone: '(334) 262-5519', hours: 'Call for details', eligibility: 'Open to all', docs: ['Call ahead'] },
    { name: 'Community of Hope', zip: '36116', phone: '(334) 235-2634', hours: 'Wed 9:00am–2:30pm', eligibility: 'Open to all', docs: ['Call ahead'] },
    { name: 'Catholic Social Services', zip: '36116', phone: '(334) 288-8890', hours: 'Tue & Thu 8:30am', eligibility: 'Open to all', docs: ['Call ahead'] },
    { name: 'Paul Outreach Service', zip: '36108', phone: '(334) 233-0771', hours: 'Mon–Fri 8:00am–5:00pm', eligibility: 'Open to all', docs: ['Call ahead'] },
    { name: 'Mercy House', zip: '36108', phone: '(334) 649-1534', hours: 'Mon–Fri 10:00am–7:00pm; Sat 10:00am–2:00pm', eligibility: 'Open to all', docs: ['Call ahead'] },
    { name: 'Grace Community Church', zip: '36123', phone: '(334) 652-4723', hours: 'Wed 10:00am–12:00pm', eligibility: 'Open to all', docs: ['Call ahead'] },
    { name: 'Resurrection Catholic Missions', zip: '36110', phone: '(334) 230-1961', hours: 'Mon–Fri 10:00am–3:30pm, by appointment', eligibility: 'Open to all', docs: ['Appointment required'] },
];

async function run() {
    console.log(`🔥 Adding ${NEW_PANTRIES.length} Montgomery County pantries to resources/\n`);
    let count = 0;
    for (const p of NEW_PANTRIES) {
        const coords = await geocode(`Montgomery, AL ${p.zip}`);
        const geohash = encodeGeohash(coords.lat, coords.lng);

        await db.collection('resources').add({
            orgId: 'org_pantry_belt',
            name: p.name,
            locationType: 'stationary_pantry',
            status: 'active',
            county: 'Montgomery',
            coordinates: coords,
            geohash,
            address: { street: '', city: 'Montgomery', county: 'Montgomery', state: 'AL', zip: p.zip },
            hours: p.hours,
            phone: p.phone,
            website: '',
            eligibilityNotes: p.eligibility,
            docsRequired: p.docs,
            serviceRadiusMiles: null,
            capacity: null,
            tags: [],
            verified: false,
            createdBy: 'ai_research_batch_2026-08-10',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        count++;
        console.log(`✅ ${count}/${NEW_PANTRIES.length} — ${p.name} (${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)})`);
    }
    console.log(`\n🎉 Done. ${count} new Montgomery pantries added.`);
    process.exit(0);
}

run().catch(err => { console.error('❌ Failed:', err); process.exit(1); });
