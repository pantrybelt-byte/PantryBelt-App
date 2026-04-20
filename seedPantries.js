// seedPantries.js — Updated pantry list with geocoding
// Reads credentials from .env — never commit real keys to source control.
require('dotenv').config();
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, addDoc, getDocs, deleteDoc, doc } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: "pantrybelt-1e7eb.firebaseapp.com",
  projectId: "pantrybelt-1e7eb",
  storageBucket: "pantrybelt-1e7eb.firebasestorage.app",
  messagingSenderId: "886799477652",
  appId: "1:886799477362:web:bd790a7b927be4153a30eb"
};

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_GEOCODING_KEY;

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const PANTRIES = [
  // ── Dallas County ─────────────────────────────────────
  { name: 'Selma Area Food Bank', type: 'Pantry', county: 'Dallas', city: 'Selma', address: '101 Avenue C, Selma, AL', phone: '(334) 872-4111', hours: 'Call for hours', eligibility: 'Dallas, Marengo, Perry, Wilcox counties', docs: 'Photo ID', website: 'https://selmafoodbank.com', verified: true },
  { name: 'Selma Area Food Bank (Hub)', type: 'Hub', county: 'Dallas', city: 'Selma', address: '101 Craig Industrial Park, Selma, AL', phone: '(334) 872-4111', hours: 'Call for hours', eligibility: 'Regional hub', docs: 'Call ahead', website: 'https://selmafoodbank.com', verified: true },
  { name: 'Christian Outreach Alliance', type: 'Pantry', county: 'Dallas', city: 'Selma', address: '700 Jeff Davis Ave, Selma, AL', phone: '(334) 872-6904', hours: 'Call for hours', eligibility: 'Dallas County residents', docs: 'Photo ID', website: '', verified: false },

  // ── Sumter County ─────────────────────────────────────
  { name: 'Sumter County DHR', type: 'Pantry', county: 'Sumter', city: 'Livingston', address: '108 West Main St, Livingston, AL 35470', phone: '(205) 652-5000', hours: 'Weekdays — call ahead', eligibility: 'Sumter County residents', docs: 'Photo ID, proof of residency', website: '', verified: false },

  // ── Russell County ────────────────────────────────────
  { name: "Potter's House Baptist", type: 'Pantry', county: 'Russell', city: 'Phenix City', address: '124 Highway 165, Phenix City, AL', phone: '(334) 298-4416', hours: 'Call for hours', eligibility: 'Russell County residents', docs: 'Photo ID', website: '', verified: false },
  { name: 'John 23rd Center', type: 'Pantry', county: 'Russell', city: 'Hurtsboro', address: '16 Sussex Street, Hurtsboro, AL', phone: '(334) 667-7362', hours: 'Call for hours', eligibility: 'Russell County residents', docs: 'Call ahead', website: '', verified: false },
  { name: 'Open Door Tabernacle', type: 'Pantry', county: 'Russell', city: 'Opelika', address: '2089 Lee Rd 42, Opelika, AL', phone: '(334) 703-6548', hours: 'Call for hours', eligibility: 'Open to all', docs: 'None required', website: '', verified: false },
  { name: 'Lakewood Baptist Church', type: 'Pantry', county: 'Russell', city: 'Phenix City', address: '4011 Lakewood Dr, Phenix City, AL', phone: '(334) 298-6433', hours: 'Call for hours', eligibility: 'Russell County residents', docs: 'Photo ID', website: '', verified: false },
  { name: 'St. Patrick Lazarus Pantry', type: 'Pantry', county: 'Russell', city: 'Phenix City', address: '607 16th Street, Phenix City, AL', phone: '(334) 298-8552', hours: 'Call for hours', eligibility: 'Open to all', docs: 'None required', website: '', verified: false },

  // ── Macon County ──────────────────────────────────────
  { name: 'Venison Provisions', type: 'Pantry', county: 'Macon', city: 'Shorter', address: '1884 County Rd 6, Shorter, AL', phone: '(334) 439-5080', hours: 'Call for hours', eligibility: 'Macon County residents', docs: 'Call ahead', website: '', verified: false },
  { name: 'Macon County Food Pantry', type: 'Pantry', county: 'Macon', city: 'Tuskegee', address: 'Shorter/Tuskegee Area, AL', phone: '(334) 724-2601', hours: 'Call for hours', eligibility: 'Macon County residents', docs: 'Photo ID', website: '', verified: false },

  // ── Marengo County ────────────────────────────────────
  { name: 'Operation Homecare', type: 'Pantry', county: 'Marengo', city: 'York', address: '300 Kentucky Ave, York, AL', phone: '(205) 392-9292', hours: '1st & 3rd Mon 9:30am-12:30pm', eligibility: 'Marengo County residents', docs: 'Call ahead', website: '', verified: true },
  { name: 'Demopolis Food Pantry', type: 'Pantry', county: 'Marengo', city: 'Demopolis', address: '410 N Main Ave, Demopolis, AL', phone: '(334) 289-3363', hours: 'Call for hours', eligibility: 'Marengo County residents', docs: 'Photo ID', website: '', verified: false },

  // ── Montgomery County ─────────────────────────────────
  { name: 'Heart of Alabama Food Bank', type: 'Hub', county: 'Montgomery', city: 'Montgomery', address: '521 Trade Center St, Montgomery, AL', phone: '(334) 263-3784', hours: 'Weekdays — call ahead', eligibility: 'Central Alabama residents', docs: 'Call for details', website: 'https://hafb.org', verified: true },
  { name: 'FBC Community Ministries', type: 'Pantry', county: 'Montgomery', city: 'Montgomery', address: '380 Arba Street, Montgomery, AL', phone: '(334) 241-5141', hours: 'Call for hours', eligibility: 'Montgomery County residents', docs: 'Photo ID', website: '', verified: false },
  { name: 'Love Loud River Region', type: 'Pantry', county: 'Montgomery', city: 'Montgomery', address: 'Montgomery, AL', phone: '(334) 271-2525', hours: 'Call for hours', eligibility: 'Open to all', docs: 'None required', website: '', verified: false },
  { name: 'Feeding the Multitude', type: 'Pantry', county: 'Montgomery', city: 'Montgomery', address: 'Montgomery, AL', phone: '(334) 387-2563', hours: 'Call for hours', eligibility: 'Open to all', docs: 'None required', website: '', verified: false },
  { name: 'Hands of Christ Ministry', type: 'Pantry', county: 'Montgomery', city: 'Montgomery', address: 'Montgomery, AL', phone: '(334) 262-6438', hours: 'Call for hours', eligibility: 'Open to all', docs: 'None required', website: '', verified: false },
  { name: 'Frazer Community Ministries', type: 'Pantry', county: 'Montgomery', city: 'Montgomery', address: 'Montgomery, AL', phone: '(334) 260-3656', hours: 'Call for hours', eligibility: 'Open to all', docs: 'None required', website: '', verified: false },
  { name: 'St. Bede Catholic Church', type: 'Pantry', county: 'Montgomery', city: 'Montgomery', address: 'Montgomery, AL', phone: '(334) 272-3463', hours: 'Call for hours', eligibility: 'Open to all', docs: 'None required', website: '', verified: false },

  // ── Regional Hubs ─────────────────────────────────────
  { name: 'West Alabama Food Bank', type: 'Hub', county: 'Tuscaloosa', city: 'Northport', address: '3610 McFarland Blvd, Northport, AL', phone: '(205) 759-5519', hours: 'Call for hours', eligibility: 'West Alabama residents', docs: 'Call ahead', website: '', verified: true },
  { name: 'Food Bank of East Alabama', type: 'Hub', county: 'Lee', city: 'Auburn', address: '375 Industry Drive, Auburn, AL', phone: '(334) 821-9006', hours: 'Call for hours', eligibility: 'East Alabama residents', docs: 'Photo ID', website: '', verified: true },
  { name: 'Feeding the Gulf Coast', type: 'Hub', county: 'Mobile', city: 'Theodore', address: '5248 Mobile South St, Theodore, AL', phone: '(251) 653-1617', hours: 'Call for hours', eligibility: 'Gulf Coast region residents', docs: 'Call ahead', website: '', verified: true },

  // ── Barbour County ────────────────────────────────────
  { name: 'Bakerhill Community Outreach', type: 'Pantry', county: 'Barbour', city: 'Bakerhill', address: 'Bakerhill, AL', phone: '(334) 687-8372', hours: 'Call for hours', eligibility: 'Barbour County residents', docs: 'Call ahead', website: '', verified: false },
  { name: 'FMC Food Bank', type: 'Pantry', county: 'Barbour', city: 'Clayton', address: 'Clayton, AL', phone: '(334) 775-0031', hours: 'Call for hours', eligibility: 'Barbour County residents', docs: 'Call ahead', website: '', verified: false },
  { name: 'Eufaula Church of God In Christ', type: 'Pantry', county: 'Barbour', city: 'Eufaula', address: 'Eufaula, AL', phone: '(334) 687-5397', hours: 'Call for hours', eligibility: 'Barbour County residents', docs: 'None required', website: '', verified: false },
  { name: 'Forgiven Ministries', type: 'Pantry', county: 'Barbour', city: 'Eufaula', address: 'Eufaula, AL', phone: '(334) 687-2896', hours: 'Call for hours', eligibility: 'Open to all', docs: 'None required', website: '', verified: false },
  { name: 'White Oak UMC', type: 'Pantry', county: 'Barbour', city: 'Eufaula', address: 'Eufaula, AL', phone: '(334) 687-5991', hours: 'Call for hours', eligibility: 'Barbour County residents', docs: 'None required', website: '', verified: false },

  // ── Choctaw County ────────────────────────────────────
  { name: 'Community Action Agency', type: 'Pantry', county: 'Choctaw', city: 'Butler', address: 'Butler, AL', phone: '(205) 459-3232', hours: 'Call for hours', eligibility: 'Choctaw County residents', docs: 'Photo ID', website: '', verified: false },

  // ── Wilcox County ─────────────────────────────────────
  { name: 'Wilcox County Food Bank', type: 'Pantry', county: 'Wilcox', city: 'Camden', address: 'Camden, AL', phone: '(334) 682-9515', hours: 'Call for hours', eligibility: 'Wilcox County residents', docs: 'Photo ID', website: '', verified: false },

  // ── Pickens County ────────────────────────────────────
  { name: 'Pickens County Food Pantry', type: 'Pantry', county: 'Pickens', city: 'Carrollton', address: 'Carrollton, AL', phone: '(205) 367-1243', hours: 'Call for hours', eligibility: 'Pickens County residents', docs: 'Photo ID', website: '', verified: false },

  // ── Greene County ─────────────────────────────────────
  { name: 'Greene County Food Bank', type: 'Pantry', county: 'Greene', city: 'Eutaw', address: 'Eutaw, AL', phone: '(205) 372-3311', hours: 'Call for hours', eligibility: 'Greene County residents', docs: 'Photo ID', website: '', verified: false },

  // ── Hale County ──────────────────────────────────────
  { name: 'Hale County Dept of Human Res', type: 'Pantry', county: 'Hale', city: 'Greensboro', address: 'Greensboro, AL', phone: '(334) 624-2580', hours: 'Weekdays — call ahead', eligibility: 'Hale County residents', docs: 'Photo ID, proof of residency', website: '', verified: false },

  // ── Butler County ─────────────────────────────────────
  { name: 'Butler County DHR', type: 'Pantry', county: 'Butler', city: 'Greenville', address: 'Greenville, AL', phone: '(334) 382-2652', hours: 'Weekdays — call ahead', eligibility: 'Butler County residents', docs: 'Photo ID, proof of residency', website: '', verified: false },

  // ── Lowndes County ────────────────────────────────────
  { name: 'Lowndes County Food Pantry', type: 'Pantry', county: 'Lowndes', city: 'Hayneville', address: 'Hayneville, AL', phone: '(334) 548-2515', hours: 'Call for hours', eligibility: 'Lowndes County residents', docs: 'Photo ID', website: '', verified: false },

  // ── Perry County ──────────────────────────────────────
  { name: 'Perry County Food Bank', type: 'Pantry', county: 'Perry', city: 'Marion', address: 'Marion, AL', phone: '(334) 683-6541', hours: 'Call for hours', eligibility: 'Perry County residents', docs: 'Photo ID', website: '', verified: false },

  // ── Pike County ───────────────────────────────────────
  { name: 'Pike County Salvation Army', type: 'Pantry', county: 'Pike', city: 'Troy', address: 'Troy, AL', phone: '(334) 808-1069', hours: 'Call for hours', eligibility: 'Pike County residents', docs: 'Photo ID', website: '', verified: false },

  // ── Bullock County ────────────────────────────────────
  { name: 'Bullock County Food Pantry', type: 'Pantry', county: 'Bullock', city: 'Union Springs', address: 'Union Springs, AL', phone: '(334) 738-2720', hours: 'Call for hours', eligibility: 'Bullock County residents', docs: 'Photo ID', website: '', verified: false },
  { name: 'First Missionary Baptist', type: 'Pantry', county: 'Bullock', city: 'Union Springs', address: 'Union Springs, AL', phone: '(334) 738-3317', hours: 'Call for hours', eligibility: 'Open to all', docs: 'None required', website: '', verified: false },
];

// Geocode address using Google Maps API
async function geocode(address) {
  const encoded = encodeURIComponent(address);
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encoded}&key=${GOOGLE_MAPS_API_KEY}`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    if (data.status === 'OK' && data.results[0]) {
      const { lat, lng } = data.results[0].geometry.location;
      return { lat, lng };
    }
    console.warn(`   ⚠️  Geocode status: ${data.status} for "${address}" — using city center`);
    return null;
  } catch (err) {
    console.warn(`   ⚠️  Geocode failed: ${err.message}`);
    return null;
  }
}

// City center fallbacks for entries without full addresses
const CITY_CENTERS = {
  'Montgomery': { lat: 32.3668, lng: -86.2999 },
  'Selma': { lat: 32.4073, lng: -87.0211 },
  'Eufaula': { lat: 31.8913, lng: -85.1455 },
  'Butler': { lat: 32.0843, lng: -88.2195 },
  'Camden': { lat: 31.9929, lng: -87.2913 },
  'Carrollton': { lat: 33.2640, lng: -88.0937 },
  'Eutaw': { lat: 32.8474, lng: -87.9020 },
  'Greensboro': { lat: 32.7054, lng: -87.5984 },
  'Greenville': { lat: 31.8268, lng: -86.6213 },
  'Hayneville': { lat: 32.1835, lng: -86.5794 },
  'Marion': { lat: 32.6329, lng: -87.3192 },
  'Troy': { lat: 31.8043, lng: -85.9641 },
  'Union Springs': { lat: 32.1443, lng: -85.7152 },
  'Bakerhill': { lat: 31.9360, lng: -85.2696 },
  'Clayton': { lat: 31.8779, lng: -85.4502 },
  'Tuskegee': { lat: 32.4241, lng: -85.6909 },
  'Shorter': { lat: 32.3957, lng: -85.9094 },
  'Northport': { lat: 33.2290, lng: -87.5836 },
  'Theodore': { lat: 30.5438, lng: -88.1731 },
  'Auburn': { lat: 32.6099, lng: -85.4808 },
  'Hurtsboro': { lat: 32.2376, lng: -85.4138 },
  'Opelika': { lat: 32.6453, lng: -85.3783 },
  'Phenix City': { lat: 32.4698, lng: -85.0007 },
  'York': { lat: 32.4918, lng: -88.2959 },
  'Demopolis': { lat: 32.5173, lng: -87.8364 },
  'Livingston': { lat: 32.5832, lng: -88.1872 },
};

async function clearPantries() {
  console.log('🗑️  Clearing old pantry data...');
  const snapshot = await getDocs(collection(db, 'pantries'));
  for (const d of snapshot.docs) {
    await deleteDoc(doc(db, 'pantries', d.id));
  }
  console.log(`   Deleted ${snapshot.size} old documents\n`);
}

async function seedPantries() {
  console.log('🔥 PantryBelt — Seeding updated pantry list\n');
  await clearPantries();

  const ref = collection(db, 'pantries');
  let count = 0;
  let failed = 0;

  for (const pantry of PANTRIES) {
    try {
      let coords = null;

      // Try full address first
      if (pantry.address && !pantry.address.endsWith(', AL')) {
        coords = await geocode(pantry.address);
      }

      // Fall back to city center if geocode fails or address is vague
      if (!coords && CITY_CENTERS[pantry.city]) {
        coords = CITY_CENTERS[pantry.city];
        console.log(`   📍 Using city center for ${pantry.name}`);
      }

      // Last resort — Montgomery center
      if (!coords) {
        coords = { lat: 32.3668, lng: -86.2999 };
        console.log(`   ⚠️  Using Montgomery fallback for ${pantry.name}`);
      }

      await addDoc(ref, { ...pantry, lat: coords.lat, lng: coords.lng });
      count++;
      console.log(`✅ ${count}/${PANTRIES.length} — ${pantry.name} (${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)})`);

      // Delay to avoid rate limiting
      await new Promise(res => setTimeout(res, 250));
    } catch (err) {
      failed++;
      console.error(`❌ Failed: ${pantry.name} — ${err.message}`);
    }
  }

  console.log(`\n🎉 Done! ${count} pantries seeded. ${failed > 0 ? `${failed} failed.` : 'All successful!'}`);
  console.log(`📊 Total pantries in Firestore: ${count}`);
  process.exit(0);
}

seedPantries();
