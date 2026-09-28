#!/usr/bin/env node
/**
 * tools/geocodePipeline.js — Phase 3 geocoding pipeline
 *
 * Parses scraped pantry addresses (Firecrawl output), geocodes them, classifies
 * how precise each result actually is, and queues anything imprecise for manual
 * pin review in the portal rather than silently writing a wrong coordinate.
 *
 *   node tools/geocodePipeline.js --in tools/.tmp/scraped.json            # dry run
 *   node tools/geocodePipeline.js --in tools/.tmp/scraped.json --write    # write to Firestore
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * READ THIS BEFORE CHASING "100% ROOFTOP"
 * ─────────────────────────────────────────────────────────────────────────────
 * The Phase 3 brief asks for Google Geocoding with a ROOFTOP location_type and
 * a Places / Address Validation retry. Google geocoding is NOT enabled on this
 * project's Cloud billing account (see claude.md, 2026-08-17), so the current
 * path is the free US Census geocoder — the same one every tools/add*Pantries.js
 * import already uses.
 *
 * The Census geocoder cannot return ROOFTOP precision *even in principle*. It
 * interpolates a point along a TIGER street-centerline segment from the address
 * range on that block. In Google's vocabulary every Census result is
 * RANGE_INTERPOLATED at best. So "100% ROOFTOP" is unreachable on this path, and
 * a classifier that pretended otherwise would be the worst outcome: confidently
 * wrong pins with no review queue.
 *
 * What this pipeline does instead is grade honestly:
 *
 *   exact         single unambiguous TIGER match, house number inside the
 *                 block's address range           → safe to write
 *   interpolated  matched, but the house number sits outside the range or the
 *                 match was fuzzy                 → QUEUE for review
 *   ambiguous     Census returned multiple matches → QUEUE for review
 *   nomatch       no match at all                  → QUEUE for review
 *   po_box        not a physical location          → QUEUE, never geocode
 *
 * Only `exact` is written. Everything else lands in the review queue with the
 * reason attached. When the queue gets big enough to be worth money, enable
 * Google Geocoding billing and turn on the GOOGLE branch below — the classifier
 * already has a slot for a real ROOFTOP verdict.
 *
 * COORDINATE PRECISION
 * ────────────────────
 * Census returns ~8 decimal places. We store the double exactly as received —
 * no rounding, no toFixed(), no parseFloat(x.toFixed(6)). Rounding to 5 decimals
 * moves a point by up to ~1.1 m, and to 4 by ~11 m, which is enough to put a
 * rural pantry on the wrong side of a road. Anything with fewer than 6 decimals
 * is flagged, because that is the signature of a coordinate that was rounded
 * upstream or is a county-seat fallback rather than a real geocode.
 */

const fs = require('fs');
const path = require('path');

// ─── CLI ──────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const getArg = (name, fallback = null) => {
    const i = args.indexOf(name);
    return i !== -1 && args[i + 1] ? args[i + 1] : fallback;
};
const INPUT = getArg('--in');
const WRITE = args.includes('--write');
const OUT_DIR = getArg('--outDir', path.join(__dirname, '.tmp', 'geocode'));
const THROTTLE_MS = Number(getArg('--throttle', '250'));

if (!INPUT) {
    console.error('Usage: node tools/geocodePipeline.js --in <scraped.json> [--write] [--outDir dir]');
    process.exit(1);
}

const CENSUS_URL = 'https://geocoding.geo.census.gov/geocoder/locations/onelineaddress';
const BENCHMARK = 'Public_AR_Current';

// Minimum decimal places before we consider a coordinate suspiciously coarse.
const MIN_DECIMALS = 6;

// ─── Address parsing ──────────────────────────────────────────────────────────

const PO_BOX_RE = /\b(p\.?\s*o\.?\s*box|post\s+office\s+box)\b/i;

/** Street-type abbreviations normalized so Census matches more reliably. */
const STREET_ABBR = {
    street: 'St', str: 'St', st: 'St',
    avenue: 'Ave', ave: 'Ave', av: 'Ave',
    boulevard: 'Blvd', blvd: 'Blvd',
    drive: 'Dr', dr: 'Dr',
    road: 'Rd', rd: 'Rd',
    lane: 'Ln', ln: 'Ln',
    court: 'Ct', ct: 'Ct',
    circle: 'Cir', cir: 'Cir',
    place: 'Pl', pl: 'Pl',
    parkway: 'Pkwy', pkwy: 'Pkwy',
    highway: 'Hwy', hwy: 'Hwy',
    county: 'County', route: 'Rte', rte: 'Rte',
    north: 'N', south: 'S', east: 'E', west: 'W',
};

/**
 * Normalize a scraped address string. Firecrawl output is raw page text, so it
 * arrives with newlines, doubled whitespace, unit suffixes and occasional
 * trailing phone numbers glued on.
 */
function normalizeAddress(raw) {
    if (!raw || typeof raw !== 'string') return '';
    let s = raw
        .replace(/\s+/g, ' ')
        .replace(/[‘’“”]/g, "'")
        .trim();

    // Drop a trailing phone number that scraping often concatenates on.
    s = s.replace(/[,\s]*(\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\s*$/, '');

    // Drop suite/unit — Census matches the base address more reliably without it.
    s = s.replace(/[,\s]+(suite|ste|unit|apt|apartment|#)\s*[\w-]+/gi, '');

    // Expand/standardize street words.
    s = s.split(' ').map(word => {
        const bare = word.replace(/[.,]/g, '').toLowerCase();
        return STREET_ABBR[bare] ? STREET_ABBR[bare] : word;
    }).join(' ');

    return s.replace(/\s*,\s*/g, ', ').replace(/,\s*,/g, ',').trim();
}

/** Extract the leading house number, if the address has one. */
function houseNumber(addr) {
    const m = addr.match(/^\s*(\d+)/);
    return m ? Number(m[1]) : null;
}

/** Count decimal places on a coordinate as returned (before any formatting). */
function decimalPlaces(n) {
    const s = String(n);
    const i = s.indexOf('.');
    return i === -1 ? 0 : s.length - i - 1;
}

// ─── Geocoders ────────────────────────────────────────────────────────────────

async function geocodeCensus(address) {
    const url = `${CENSUS_URL}?address=${encodeURIComponent(address)}&benchmark=${BENCHMARK}&format=json`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Census HTTP ${res.status}`);
    const data = await res.json();
    return data?.result?.addressMatches ?? [];
}

/**
 * FUTURE BRANCH — Google Geocoding / Places / Address Validation.
 * Intentionally not wired: billing is disabled for this project, so calling it
 * returns REQUEST_DENIED and would just convert every row into a false
 * "nomatch". Enable billing, set GOOGLE_MAPS_GEOCODING_KEY, and flip
 * USE_GOOGLE to true — classify() already understands a 'ROOFTOP' verdict.
 */
const USE_GOOGLE = false;

// ─── Precision classifier ─────────────────────────────────────────────────────

/**
 * Grade a geocode result. Returns { precision, reason, lat, lng, matched }.
 * Only precision === 'exact' is considered writable.
 */
function classify(inputAddress, matches) {
    if (PO_BOX_RE.test(inputAddress)) {
        return { precision: 'po_box', reason: 'PO Box is not a physical location', lat: null, lng: null };
    }
    if (!matches || matches.length === 0) {
        return { precision: 'nomatch', reason: 'Census returned no address matches', lat: null, lng: null };
    }
    if (matches.length > 1) {
        return {
            precision: 'ambiguous',
            reason: `Census returned ${matches.length} candidate matches`,
            lat: matches[0].coordinates.y,
            lng: matches[0].coordinates.x,
            matched: matches[0].matchedAddress,
        };
    }

    const m = matches[0];
    const lat = m.coordinates.y;
    const lng = m.coordinates.x;
    const matched = m.matchedAddress;

    // A rounded-looking coordinate is the tell for an upstream fallback
    // (county-seat centroid) rather than a real interpolation.
    if (decimalPlaces(lat) < MIN_DECIMALS || decimalPlaces(lng) < MIN_DECIMALS) {
        return {
            precision: 'interpolated',
            reason: `Coordinate has fewer than ${MIN_DECIMALS} decimals (${lat}, ${lng}) — likely a centroid, not a geocode`,
            lat, lng, matched,
        };
    }

    // Confirm the house number actually falls inside the matched TIGER block
    // range. Census will happily snap 9999 Main St onto the 100-block.
    const want = houseNumber(inputAddress);
    const side = m.tigerLine?.side;
    const comp = m.addressComponents ?? {};
    const from = Number(side === 'L' ? comp.fromAddress : comp.fromAddress);
    const to = Number(side === 'L' ? comp.toAddress : comp.toAddress);

    if (want !== null && Number.isFinite(from) && Number.isFinite(to)) {
        const lo = Math.min(from, to);
        const hi = Math.max(from, to);
        if (want < lo || want > hi) {
            return {
                precision: 'interpolated',
                reason: `House number ${want} is outside matched block range ${lo}–${hi}`,
                lat, lng, matched,
            };
        }
    } else if (want === null) {
        return {
            precision: 'interpolated',
            reason: 'Address has no house number — matched to a street, not a building',
            lat, lng, matched,
        };
    }

    return { precision: 'exact', reason: 'Single TIGER match, house number within block range', lat, lng, matched };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function main() {
    const rows = JSON.parse(fs.readFileSync(INPUT, 'utf8'));
    if (!Array.isArray(rows)) throw new Error('Input must be a JSON array of scraped records');

    console.log(`\nGeocoding ${rows.length} scraped records via Census (${BENCHMARK})`);
    console.log(`Mode: ${WRITE ? 'WRITE to Firestore' : 'DRY RUN (no writes)'}`);
    if (USE_GOOGLE) console.log('Google branch: ENABLED');
    console.log('');

    const writable = [];
    const queue = [];
    const counts = { exact: 0, interpolated: 0, ambiguous: 0, nomatch: 0, po_box: 0, error: 0 };

    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const raw = row.address ?? row.street ?? row.fullAddress ?? '';
        const address = normalizeAddress(raw);
        const label = row.name || row.orgName || `row ${i + 1}`;

        if (!address) {
            counts.nomatch++;
            queue.push({ ...row, normalizedAddress: '', precision: 'nomatch', reason: 'No address field in source record' });
            continue;
        }

        let verdict;
        try {
            const matches = await geocodeCensus(address);
            verdict = classify(address, matches);
        } catch (err) {
            counts.error++;
            queue.push({ ...row, normalizedAddress: address, precision: 'nomatch', reason: `Geocoder error: ${err.message}` });
            console.log(`  ✖ ${label}: ${err.message}`);
            await sleep(THROTTLE_MS);
            continue;
        }

        counts[verdict.precision]++;

        const record = {
            ...row,
            normalizedAddress: address,
            matchedAddress: verdict.matched ?? null,
            precision: verdict.precision,
            reason: verdict.reason,
            // Full doubles, exactly as the geocoder returned them. Do not round.
            coordinates: verdict.lat !== null ? { lat: verdict.lat, lng: verdict.lng } : null,
        };

        if (verdict.precision === 'exact') {
            writable.push(record);
            console.log(`  ✓ ${label}  (${verdict.lat}, ${verdict.lng})`);
        } else {
            queue.push(record);
            console.log(`  ⚠ ${label}  [${verdict.precision}] ${verdict.reason}`);
        }

        await sleep(THROTTLE_MS);
    }

    fs.mkdirSync(OUT_DIR, { recursive: true });
    const queuePath = path.join(OUT_DIR, 'queue-manual-review.json');
    const writePath = path.join(OUT_DIR, 'geocoded-exact.json');
    fs.writeFileSync(queuePath, JSON.stringify(queue, null, 2));
    fs.writeFileSync(writePath, JSON.stringify(writable, null, 2));

    const total = rows.length || 1;
    console.log('\n─── Summary ───────────────────────────────────');
    for (const [k, v] of Object.entries(counts)) {
        if (v) console.log(`  ${k.padEnd(14)} ${String(v).padStart(4)}  (${((v / total) * 100).toFixed(1)}%)`);
    }
    console.log(`\n  writable (exact):  ${writable.length}  → ${writePath}`);
    console.log(`  manual review:     ${queue.length}  → ${queuePath}`);

    if (!WRITE) {
        console.log('\nDry run — nothing written to Firestore. Re-run with --write to apply.');
        return;
    }

    // ── Firestore write (Admin SDK, bypasses rules) ──────────────────────────
    const admin = require('firebase-admin');
    if (admin.apps.length === 0) admin.initializeApp();
    const db = admin.firestore();

    let written = 0;
    for (const batchStart of range(0, writable.length, 400)) {
        const batch = db.batch();
        for (const rec of writable.slice(batchStart, batchStart + 400)) {
            if (!rec.id) continue;
            batch.set(db.collection('agencies').doc(rec.id), {
                coordinates: rec.coordinates,
                geocodePrecision: rec.precision,
                geocodedAt: admin.firestore.FieldValue.serverTimestamp(),
            }, { merge: true });
            written++;
        }
        await batch.commit();
    }
    console.log(`\nWrote ${written} coordinate updates to agencies/.`);
    console.log(`${queue.length} records still need a manual pin — see ${queuePath}.`);
}

function* range(start, end, step) {
    for (let i = start; i < end; i += step) yield i;
}

main().catch(err => {
    console.error('\nPipeline failed:', err);
    process.exit(1);
});
