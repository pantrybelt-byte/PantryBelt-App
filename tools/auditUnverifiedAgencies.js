/**
 * tools/auditUnverifiedAgencies.js
 *
 * READ-ONLY audit of `agencies` for the Operator Portal data-layer review.
 * Never writes. Reuses the county bounding boxes from validatePantryDataset.js.
 *
 * Run: node tools/auditUnverifiedAgencies.js
 * Output: console summary + tools/unverified-audit-report.json + tools/unverified-flags.csv
 */

const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

const serviceAccountPath = path.resolve(__dirname, '../serviceAccountKey.json');
const serviceAccount = require(serviceAccountPath);
if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();

const ALABAMA_COUNTIES = [
  'Autauga', 'Baldwin', 'Barbour', 'Bibb', 'Blount', 'Bullock', 'Butler',
  'Calhoun', 'Chambers', 'Cherokee', 'Chilton', 'Choctaw', 'Clarke', 'Clay',
  'Cleburne', 'Coffee', 'Colbert', 'Conecuh', 'Coosa', 'Covington',
  'Crenshaw', 'Cullman', 'Dale', 'Dallas', 'DeKalb', 'Elmore', 'Escambia',
  'Etowah', 'Fayette', 'Franklin', 'Geneva', 'Greene', 'Hale', 'Henry',
  'Houston', 'Jackson', 'Jefferson', 'Lamar', 'Lauderdale', 'Lawrence',
  'Lee', 'Limestone', 'Lowndes', 'Macon', 'Madison', 'Marengo', 'Marion',
  'Marshall', 'Mobile', 'Monroe', 'Montgomery', 'Morgan', 'Perry',
  'Pickens', 'Pike', 'Randolph', 'Russell', 'St. Clair', 'Shelby',
  'Sumter', 'Talladega', 'Tallapoosa', 'Tuscaloosa', 'Walker',
  'Washington', 'Wilcox', 'Winston',
];

const COUNTY_BOUNDS = {
  'Autauga': { minLat: 32.34, maxLat: 32.71, minLng: -86.92, maxLng: -86.41 },
  'Baldwin': { minLat: 30.22, maxLat: 31.08, minLng: -88.06, maxLng: -87.52 },
  'Barbour': { minLat: 31.52, maxLat: 32.05, minLng: -85.79, maxLng: -85.05 },
  'Bibb': { minLat: 32.82, maxLat: 33.22, minLng: -87.37, maxLng: -86.88 },
  'Blount': { minLat: 33.74, maxLat: 34.13, minLng: -86.96, maxLng: -86.37 },
  'Bullock': { minLat: 31.95, maxLat: 32.37, minLng: -85.99, maxLng: -85.50 },
  'Butler': { minLat: 31.52, maxLat: 31.93, minLng: -86.96, maxLng: -86.40 },
  'Calhoun': { minLat: 33.50, maxLat: 33.93, minLng: -86.10, maxLng: -85.55 },
  'Chambers': { minLat: 32.75, maxLat: 33.15, minLng: -85.65, maxLng: -85.10 },
  'Cherokee': { minLat: 33.93, maxLat: 34.42, minLng: -86.00, maxLng: -85.45 },
  'Chilton': { minLat: 32.70, maxLat: 33.06, minLng: -87.00, maxLng: -86.42 },
  'Choctaw': { minLat: 31.77, maxLat: 32.23, minLng: -88.52, maxLng: -87.97 },
  'Clarke': { minLat: 31.34, maxLat: 31.86, minLng: -88.20, maxLng: -87.52 },
  'Clay': { minLat: 33.12, maxLat: 33.52, minLng: -86.13, maxLng: -85.63 },
  'Cleburne': { minLat: 33.50, maxLat: 33.93, minLng: -85.63, maxLng: -85.20 },
  'Coffee': { minLat: 31.12, maxLat: 31.55, minLng: -86.25, maxLng: -85.65 },
  'Colbert': { minLat: 34.55, maxLat: 34.92, minLng: -88.10, maxLng: -87.52 },
  'Conecuh': { minLat: 31.15, maxLat: 31.62, minLng: -87.22, maxLng: -86.65 },
  'Coosa': { minLat: 32.75, maxLat: 33.18, minLng: -86.22, maxLng: -85.72 },
  'Covington': { minLat: 30.97, maxLat: 31.50, minLng: -86.77, maxLng: -86.15 },
  'Crenshaw': { minLat: 31.62, maxLat: 31.97, minLng: -86.40, maxLng: -85.85 },
  'Cullman': { minLat: 33.89, maxLat: 34.37, minLng: -87.15, maxLng: -86.57 },
  'Dale': { minLat: 31.15, maxLat: 31.58, minLng: -85.85, maxLng: -85.35 },
  'Dallas': { minLat: 32.05, maxLat: 32.56, minLng: -87.42, maxLng: -86.82 },
  'DeKalb': { minLat: 34.32, maxLat: 34.73, minLng: -86.10, maxLng: -85.55 },
  'Elmore': { minLat: 32.35, maxLat: 32.70, minLng: -86.35, maxLng: -85.85 },
  'Escambia': { minLat: 30.97, maxLat: 31.38, minLng: -87.47, maxLng: -86.85 },
  'Etowah': { minLat: 33.90, maxLat: 34.28, minLng: -86.35, maxLng: -85.85 },
  'Fayette': { minLat: 33.55, maxLat: 33.95, minLng: -87.95, maxLng: -87.43 },
  'Franklin': { minLat: 34.32, maxLat: 34.72, minLng: -88.17, maxLng: -87.63 },
  'Geneva': { minLat: 30.98, maxLat: 31.42, minLng: -86.20, maxLng: -85.60 },
  'Greene': { minLat: 32.50, maxLat: 32.95, minLng: -88.17, maxLng: -87.65 },
  'Hale': { minLat: 32.50, maxLat: 32.95, minLng: -87.77, maxLng: -87.22 },
  'Henry': { minLat: 31.25, maxLat: 31.62, minLng: -85.53, maxLng: -85.05 },
  'Houston': { minLat: 31.00, maxLat: 31.40, minLng: -85.60, maxLng: -85.10 },
  'Jackson': { minLat: 34.55, maxLat: 35.00, minLng: -86.40, maxLng: -85.80 },
  'Jefferson': { minLat: 33.38, maxLat: 33.80, minLng: -87.22, maxLng: -86.57 },
  'Lamar': { minLat: 33.55, maxLat: 33.95, minLng: -88.35, maxLng: -87.85 },
  'Lauderdale': { minLat: 34.65, maxLat: 35.00, minLng: -87.80, maxLng: -87.20 },
  'Lawrence': { minLat: 34.37, maxLat: 34.72, minLng: -87.55, maxLng: -86.95 },
  'Lee': { minLat: 32.45, maxLat: 32.80, minLng: -85.55, maxLng: -85.10 },
  'Limestone': { minLat: 34.62, maxLat: 35.00, minLng: -87.25, maxLng: -86.75 },
  'Lowndes': { minLat: 31.95, maxLat: 32.42, minLng: -86.80, maxLng: -86.22 },
  'Macon': { minLat: 32.18, maxLat: 32.55, minLng: -86.00, maxLng: -85.47 },
  'Madison': { minLat: 34.53, maxLat: 34.92, minLng: -86.82, maxLng: -86.30 },
  'Marengo': { minLat: 31.98, maxLat: 32.50, minLng: -88.12, maxLng: -87.47 },
  'Marion': { minLat: 33.95, maxLat: 34.37, minLng: -88.20, maxLng: -87.63 },
  'Marshall': { minLat: 34.08, maxLat: 34.57, minLng: -86.60, maxLng: -86.10 },
  'Mobile': { minLat: 30.22, maxLat: 31.02, minLng: -88.43, maxLng: -87.92 },
  'Monroe': { minLat: 31.33, maxLat: 31.82, minLng: -87.60, maxLng: -87.00 },
  'Montgomery': { minLat: 32.10, maxLat: 32.58, minLng: -86.50, maxLng: -85.95 },
  'Morgan': { minLat: 34.28, maxLat: 34.62, minLng: -87.10, maxLng: -86.55 },
  'Perry': { minLat: 32.30, maxLat: 32.73, minLng: -87.52, maxLng: -87.05 },
  'Pickens': { minLat: 33.02, maxLat: 33.47, minLng: -88.35, maxLng: -87.83 },
  'Pike': { minLat: 31.60, maxLat: 32.00, minLng: -86.08, maxLng: -85.55 },
  'Randolph': { minLat: 33.10, maxLat: 33.52, minLng: -85.65, maxLng: -85.18 },
  'Russell': { minLat: 32.08, maxLat: 32.55, minLng: -85.48, maxLng: -84.98 },
  'St. Clair': { minLat: 33.52, maxLat: 33.90, minLng: -86.57, maxLng: -86.10 },
  'Shelby': { minLat: 33.10, maxLat: 33.50, minLng: -86.95, maxLng: -86.48 },
  'Sumter': { minLat: 32.33, maxLat: 32.85, minLng: -88.47, maxLng: -87.95 },
  'Talladega': { minLat: 33.10, maxLat: 33.57, minLng: -86.35, maxLng: -85.78 },
  'Tallapoosa': { minLat: 32.55, maxLat: 33.08, minLng: -86.00, maxLng: -85.43 },
  'Tuscaloosa': { minLat: 33.00, maxLat: 33.55, minLng: -87.87, maxLng: -87.18 },
  'Walker': { minLat: 33.68, maxLat: 34.10, minLng: -87.45, maxLng: -86.95 },
  'Washington': { minLat: 31.05, maxLat: 31.60, minLng: -88.42, maxLng: -87.95 },
  'Wilcox': { minLat: 31.73, maxLat: 32.22, minLng: -87.48, maxLng: -86.88 },
  'Winston': { minLat: 33.95, maxLat: 34.32, minLng: -87.55, maxLng: -87.15 },
};

const GENERIC_URLS = new Set([
  'https://www.foodbankonline.org',
  'https://www.foodbanknorthal.org',
  'https://www.feedingthegulfcoast.org',
  'https://hafb.org',
  'https://wiregrassfoodbank.com',
  'https://westalabamafoodbank.org',
  'https://foodbankofeastalabama.com',
]);
const DIRECTORY_HOST_HINTS = [
  '211.org', 'foodpantries.org', 'ampleharvest.org', 'yelp.com', 'yellowpages.com',
  'facebook.com', 'google.com/maps', 'goo.gl/maps', 'maps.app.goo.gl',
  'feedingamerica.org', 'foodbankonline.org', 'foodbanknorthal.org',
  'feedingthegulfcoast.org', 'hafb.org', 'wiregrassfoodbank.com',
  'westalabamafoodbank.org', 'foodbankofeastalabama.com',
];

function normalizeCounty(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (ALABAMA_COUNTIES.includes(trimmed)) return trimmed;
  const lower = trimmed.toLowerCase();
  const match = ALABAMA_COUNTIES.find(c => c.toLowerCase() === lower);
  if (match) return match;
  const stripped = lower.replace(/\s*county\s*$/i, '').trim();
  return ALABAMA_COUNTIES.find(c => c.toLowerCase() === stripped) || null;
}

function isWithinBounds(lat, lng, bounds) {
  return lat >= bounds.minLat && lat <= bounds.maxLat && lng >= bounds.minLng && lng <= bounds.maxLng;
}

function normalizePhone(phone) {
  if (typeof phone !== 'string') return '';
  return phone.replace(/[^0-9]/g, '');
}

function phoneIsMalformed(phone) {
  const digits = normalizePhone(phone);
  if (digits.length === 0) return false; // handled as "missing" separately
  if (digits.length === 10) return false;
  if (digits.length === 11 && digits.startsWith('1')) return false;
  return true;
}

function classifyHours(hours) {
  if (hours === undefined || hours === null) return 'missing';
  if (typeof hours === 'string') {
    return hours.trim() === '' ? 'missing' : 'free-text';
  }
  if (typeof hours === 'object') {
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    const hasAnyDay = days.some(d => hours[d] && typeof hours[d] === 'object');
    if (!hasAnyDay) return Object.keys(hours).length === 0 ? 'missing' : 'malformed-object';
    return 'structured-ok';
  }
  return 'malformed-object';
}

function isDirectoryWebsite(website) {
  if (typeof website !== 'string' || website.trim() === '') return false;
  const trimmed = website.trim();
  if (GENERIC_URLS.has(trimmed)) return true;
  const lower = trimmed.toLowerCase();
  return DIRECTORY_HOST_HINTS.some(host => lower.includes(host));
}

function normalizeNameForDedupe(name) {
  return (name || '')
    .toLowerCase()
    .replace(/[.,'"()]/g, '')
    .replace(/\b(church|pantry|inc|the|of|food|ministries|ministry)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeAddressForDedupe(street) {
  return (street || '')
    .toLowerCase()
    .replace(/[.,#]/g, '')
    .replace(/\bstreet\b/g, 'st').replace(/\bavenue\b/g, 'ave')
    .replace(/\bdrive\b/g, 'dr').replace(/\broad\b/g, 'rd')
    .replace(/\bboulevard\b/g, 'blvd').replace(/\bhighway\b/g, 'hwy')
    .replace(/\s+/g, ' ')
    .trim();
}

async function main() {
  console.log('Fetching all `agencies` documents (read-only)...');
  const snapshot = await db.collection('agencies').get();
  const docs = snapshot.docs.map(d => ({ id: d.id, data: d.data() }));
  console.log(`Fetched ${docs.length} documents.\n`);

  // ── Tier classification (mirrors app/(tabs)/map.tsx pantryTier()) ─────────
  function tierOf(data) {
    const verified = data.verified === true;
    const hasActivity = !!(data.phone || data.website || (Array.isArray(data.socialMedia) && data.socialMedia.length > 0));
    if (verified && data.operatorPortalAccess === true && data.miniProfile != null) return 'green';
    if (hasActivity) return 'orange';
    return 'grey';
  }

  // ── 1. County x tier counts ────────────────────────────────────────────
  const byCounty = {};
  for (const { data } of docs) {
    const county = normalizeCounty(data.county) || `(unrecognized: ${data.county})`;
    const tier = tierOf(data);
    if (!byCounty[county]) byCounty[county] = { grey: 0, orange: 0, green: 0, verifiedTrue: 0, total: 0 };
    byCounty[county][tier]++;
    byCounty[county].total++;
    if (data.verified === true) byCounty[county].verifiedTrue++;
  }

  // ── Coordinate dupe frequency map (placeholder detection) ─────────────
  const coordFreq = {};
  for (const { data } of docs) {
    const lat = data.coordinates?.lat, lng = data.coordinates?.lng;
    if (typeof lat !== 'number' || typeof lng !== 'number') continue;
    const key = `${lat.toFixed(5)},${lng.toFixed(5)}`;
    coordFreq[key] = (coordFreq[key] || 0) + 1;
  }

  // ── Name/address dedupe index across the WHOLE dataset ─────────────────
  const nameIndex = {};
  const addrIndex = {};
  for (const { id, data } of docs) {
    const nKey = normalizeNameForDedupe(data.name);
    const addr = data.address || {};
    const aKey = `${normalizeAddressForDedupe(addr.street)}|${(addr.city || '').toLowerCase().trim()}`;
    if (nKey) (nameIndex[nKey] ||= []).push(id);
    if (addr.street && addr.city) (addrIndex[aKey] ||= []).push(id);
  }

  // ── 2/3. Per-record checks, UNVERIFIED only (verified !== true) ────────
  const flagged = [];
  const checkCounts = {};
  const bump = (k) => { checkCounts[k] = (checkCounts[k] || 0) + 1; };

  for (const { id, data } of docs) {
    if (data.verified === true) continue; // only auditing unverified records

    const county = normalizeCounty(data.county);
    const failed = [];

    // phone
    const phone = data.phone;
    if (!phone || String(phone).trim() === '') failed.push('missing_phone');
    else if (phoneIsMalformed(phone)) failed.push('malformed_phone');

    // hours
    const hoursClass = classifyHours(data.hours);
    if (hoursClass === 'missing') failed.push('missing_hours');
    else if (hoursClass === 'free-text') failed.push('unparseable_hours_freetext');
    else if (hoursClass === 'malformed-object') failed.push('malformed_hours_object');

    // address
    const addr = data.address || {};
    if (!addr.street || String(addr.street).trim() === '') failed.push('missing_street');
    if (!addr.city || String(addr.city).trim() === '') failed.push('missing_city');
    if (!addr.zip || String(addr.zip).trim() === '') failed.push('missing_zip');

    // coordinates
    const lat = data.coordinates?.lat, lng = data.coordinates?.lng;
    if (typeof lat !== 'number' || typeof lng !== 'number' || isNaN(lat) || isNaN(lng)) {
      failed.push('missing_coordinates');
    } else {
      if (lat === 0 && lng === 0) failed.push('placeholder_coords_zero');
      const key = `${lat.toFixed(5)},${lng.toFixed(5)}`;
      if (coordFreq[key] > 1) failed.push(`placeholder_coords_repeated_x${coordFreq[key]}`);
      if (county && COUNTY_BOUNDS[county] && !isWithinBounds(lat, lng, COUNTY_BOUNDS[county])) {
        failed.push('coords_outside_county_bounds');
      }
    }

    // website
    if (isDirectoryWebsite(data.website)) failed.push('website_is_directory_listing');

    // dedupe
    const nKey = normalizeNameForDedupe(data.name);
    const aKey = `${normalizeAddressForDedupe(addr.street)}|${(addr.city || '').toLowerCase().trim()}`;
    const nameDupes = (nameIndex[nKey] || []).filter(x => x !== id);
    const addrDupes = addr.street && addr.city ? (addrIndex[aKey] || []).filter(x => x !== id) : [];
    if (nameDupes.length > 0) failed.push(`duplicate_name_x${nameDupes.length + 1}`);
    if (addrDupes.length > 0) failed.push(`duplicate_address_x${addrDupes.length + 1}`);

    if (failed.length > 0) {
      failed.forEach(bump);
      flagged.push({
        id,
        name: data.name || '(unnamed)',
        county: county || data.county || '(unknown)',
        tier: tierOf(data),
        checksFailed: failed,
        phone: data.phone || '',
        website: data.website || '',
        lat, lng,
      });
    }
  }

  // ── Report ──────────────────────────────────────────────────────────────
  console.log('─'.repeat(70));
  console.log('COUNTY x VERIFICATION TIER');
  console.log('─'.repeat(70));
  const countyRows = Object.entries(byCounty).sort((a, b) => b[1].total - a[1].total);
  console.log('County'.padEnd(16), 'Grey'.padStart(6), 'Orange'.padStart(8), 'Green'.padStart(7), 'verified:true'.padStart(14), 'Total'.padStart(7));
  for (const [county, c] of countyRows) {
    console.log(county.padEnd(16), String(c.grey).padStart(6), String(c.orange).padStart(8), String(c.green).padStart(7), String(c.verifiedTrue).padStart(14), String(c.total).padStart(7));
  }

  const totals = countyRows.reduce((acc, [, c]) => {
    acc.grey += c.grey; acc.orange += c.orange; acc.green += c.green; acc.verifiedTrue += c.verifiedTrue; acc.total += c.total;
    return acc;
  }, { grey: 0, orange: 0, green: 0, verifiedTrue: 0, total: 0 });
  console.log('-'.repeat(70));
  console.log('TOTAL'.padEnd(16), String(totals.grey).padStart(6), String(totals.orange).padStart(8), String(totals.green).padStart(7), String(totals.verifiedTrue).padStart(14), String(totals.total).padStart(7));

  console.log('\n' + '─'.repeat(70));
  console.log('CHECK FAILURE COUNTS (unverified records only, i.e. verified !== true)');
  console.log('─'.repeat(70));
  const unverifiedTotal = docs.filter(d => d.data.verified !== true).length;
  console.log(`Unverified records audited: ${unverifiedTotal}`);
  console.log(`Records with >=1 flag:      ${flagged.length}`);
  Object.entries(checkCounts).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => {
    console.log(`  ${String(v).padStart(4)}  ${k}`);
  });

  // Write full CSV
  const csvPath = path.resolve(__dirname, 'unverified-flags.csv');
  const csvHeader = 'doc_id,name,county,tier,phone,website,lat,lng,checks_failed\n';
  const csvRows = flagged.map(f =>
    [f.id, `"${(f.name || '').replace(/"/g, '""')}"`, f.county, f.tier, `"${f.phone}"`, `"${f.website}"`, f.lat, f.lng, `"${f.checksFailed.join('; ')}"`].join(',')
  );
  fs.writeFileSync(csvPath, csvHeader + csvRows.join('\n'));
  console.log(`\nFull flagged-record CSV written to: ${csvPath}`);

  const jsonPath = path.resolve(__dirname, 'unverified-audit-report.json');
  fs.writeFileSync(jsonPath, JSON.stringify({
    generatedAt: new Date().toISOString(),
    totals,
    byCounty,
    unverifiedTotal,
    checkCounts,
    flagged,
  }, null, 2));
  console.log(`Full JSON report written to: ${jsonPath}`);
}

main().catch(err => {
  console.error('Audit failed:', err);
  process.exit(1);
});
