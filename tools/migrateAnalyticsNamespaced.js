/**
 * tools/migrateAnalyticsNamespaced.js — Analytics Namespacing Migration
 *
 * One-time COPY (never delete) of the 8 flat `analytics_*` collections into
 * namespaced subcollection paths, plus a county+month rollup joining
 * analytics_searches + analytics_user_counties into final_analytical_kpis.
 *
 *   analytics_sessions            -> analytics/sessions/events/{id}
 *   analytics_user_counties       -> analytics/user_counties/events/{id}
 *   analytics_searches            -> analytics/searches/events/{id}
 *   analytics_food_deserts        -> analytics/food_deserts/events/{id}
 *   analytics_pantry_engagements  -> analytics/pantry_engagements/events/{id}
 *   analytics_referrals           -> analytics/referrals/events/{id}
 *   analytics_search_outcomes     -> analytics/search_outcomes/events/{id}
 *   analytics_monthly_summary     -> analytics/monthly_summary/events/{id}
 *   (analytics_searches + analytics_user_counties) -> final_analytical_kpis/{monthYear_county}
 *
 * JOIN NOTE: analytics_searches and analytics_user_counties share no foreign
 * key (no deviceId/sessionId/uid on either doc — see audit). final_analytical_kpis
 * is therefore a county+monthYear ROLLUP (counts), not a per-document join.
 * Docs with a missing/null county are bucketed under county "Unknown" so their
 * counts aren't silently dropped.
 *
 * Idempotency: destination doc IDs are deterministic (straight copies reuse the
 * source doc ID; KPI docs are keyed by `${monthYear}_${county}`), and every
 * write is a `.set()` overwrite — re-running never duplicates documents.
 *
 * Resume: after each committed batch, the last source doc ID is checkpointed to
 * .tmp/migrate-analytics-checkpoint.json. A restarted run resumes each straight
 * -copy collection with `startAfter(lastDocId)` instead of re-scanning from the
 * top. The KPI rollup has no partial-resume — it recomputes from a full scan of
 * both source collections every run, which is safe (idempotent) and cheap at
 * this data volume; only its batched writes are what actually change.
 *
 * Usage:
 *   node tools/migrateAnalyticsNamespaced.js --dry-run   # counts + 3 samples per collection, no writes
 *   node tools/migrateAnalyticsNamespaced.js             # real run, resumable
 *
 * Prerequisites: serviceAccountKey.json must exist at project root (matches
 * tools/test-analytics.js convention).
 */

const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');
const { FieldPath } = require('firebase-admin/firestore');

const serviceAccount = require('../serviceAccountKey.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const DRY_RUN = process.argv.includes('--dry-run');
const BATCH_SIZE = 450; // Firestore hard limit is 500 — leave headroom
const CHECKPOINT_PATH = path.join(__dirname, '..', '.tmp', 'migrate-analytics-checkpoint.json');
const KPI_COLLECTION = 'final_analytical_kpis';

// source collection -> destination subcollection segment under analytics/{type}/events
const COLLECTIONS = [
    { source: 'analytics_sessions', type: 'sessions' },
    { source: 'analytics_user_counties', type: 'user_counties' },
    { source: 'analytics_searches', type: 'searches' },
    { source: 'analytics_food_deserts', type: 'food_deserts' },
    { source: 'analytics_pantry_engagements', type: 'pantry_engagements' },
    { source: 'analytics_referrals', type: 'referrals' },
    { source: 'analytics_search_outcomes', type: 'search_outcomes' },
    { source: 'analytics_monthly_summary', type: 'monthly_summary' },
];

// ─── Checkpoint I/O ─────────────────────────────────────────────────────────
function loadCheckpoint() {
    try {
        return JSON.parse(fs.readFileSync(CHECKPOINT_PATH, 'utf8'));
    } catch {
        return {};
    }
}

function saveCheckpoint(checkpoint) {
    fs.mkdirSync(path.dirname(CHECKPOINT_PATH), { recursive: true });
    fs.writeFileSync(CHECKPOINT_PATH, JSON.stringify(checkpoint, null, 2));
}

// ─── Shared batch commit ────────────────────────────────────────────────────
async function commitBatch(writes) {
    if (writes.length === 0) return;
    const batch = db.batch();
    for (const { ref, data } of writes) batch.set(ref, data);
    await batch.commit();
}

function destEventsRef(type) {
    return db.collection('analytics').doc(type).collection('events');
}

// ─── Straight copy, one source collection at a time ────────────────────────
async function copyCollection(source, type, checkpoint) {
    const destRef = destEventsRef(type);
    const entry = checkpoint[source] ?? { lastDocId: null, copied: 0 };
    let scanned = 0;

    while (true) {
        let q = db.collection(source).orderBy(FieldPath.documentId()).limit(BATCH_SIZE);
        if (entry.lastDocId) q = q.startAfter(entry.lastDocId);
        const snap = await q.get();
        if (snap.empty) break;

        scanned += snap.size;
        const writes = snap.docs.map(d => ({ ref: destRef.doc(d.id), data: d.data() }));
        await commitBatch(writes);

        entry.lastDocId = snap.docs[snap.docs.length - 1].id;
        entry.copied += writes.length;
        checkpoint[source] = entry;
        saveCheckpoint(checkpoint);

        process.stdout.write(`  [${source}] copied ${entry.copied} so far...\r`);
        if (snap.size < BATCH_SIZE) break;
    }
    if (scanned > 0) process.stdout.write('\n');
    return entry.copied;
}

async function dryRunCollection(source, type) {
    const [countSnap, sampleSnap] = await Promise.all([
        db.collection(source).count().get(),
        db.collection(source).orderBy(FieldPath.documentId()).limit(3).get(),
    ]);
    const destRef = destEventsRef(type);
    console.log(`\n--- ${source} -> analytics/${type}/events (${countSnap.data().count} docs) ---`);
    for (const doc of sampleSnap.docs) {
        console.log(`  ${destRef.path}/${doc.id} =`, JSON.stringify(doc.data()));
    }
}

// ─── KPI rollup: analytics_searches + analytics_user_counties -> final_analytical_kpis ──
function bucketKey(monthYear, county) {
    const countyKey = (county && String(county).trim()) || 'Unknown';
    return { docId: `${monthYear}_${countyKey.replace(/\s+/g, '_')}`, countyKey };
}

async function buildKpiBuckets() {
    const [searchesSnap, countiesSnap] = await Promise.all([
        db.collection('analytics_searches').get(),
        db.collection('analytics_user_counties').get(),
    ]);

    const buckets = new Map();
    let skippedSearches = 0;
    let skippedCounties = 0;

    function bucket(monthYear, county) {
        const { docId, countyKey } = bucketKey(monthYear, county);
        if (!buckets.has(docId)) {
            buckets.set(docId, {
                docId, county: countyKey, monthYear,
                searchCount: 0, countySessionCount: 0,
            });
        }
        return buckets.get(docId);
    }

    for (const doc of searchesSnap.docs) {
        const d = doc.data();
        if (!d.monthYear) { skippedSearches++; continue; }
        bucket(d.monthYear, d.county).searchCount++;
    }
    for (const doc of countiesSnap.docs) {
        const d = doc.data();
        if (!d.monthYear) { skippedCounties++; continue; }
        bucket(d.monthYear, d.county).countySessionCount++;
    }

    return {
        buckets: [...buckets.values()],
        searchesScanned: searchesSnap.size,
        countiesScanned: countiesSnap.size,
        skippedSearches,
        skippedCounties,
    };
}

async function writeKpiBuckets(buckets, checkpoint) {
    const destRef = db.collection(KPI_COLLECTION);
    let written = 0;
    for (let i = 0; i < buckets.length; i += BATCH_SIZE) {
        const chunk = buckets.slice(i, i + BATCH_SIZE);
        const writes = chunk.map(b => ({
            ref: destRef.doc(b.docId),
            data: {
                county: b.county,
                monthYear: b.monthYear,
                searchCount: b.searchCount,
                countySessionCount: b.countySessionCount,
                sourceCollections: ['analytics_searches', 'analytics_user_counties'],
                computedAt: admin.firestore.FieldValue.serverTimestamp(),
            },
        }));
        await commitBatch(writes);
        written += writes.length;
        process.stdout.write(`  [${KPI_COLLECTION}] wrote ${written}/${buckets.length}...\r`);
    }
    if (buckets.length > 0) process.stdout.write('\n');
    checkpoint[KPI_COLLECTION] = { lastRunBuckets: buckets.length };
    saveCheckpoint(checkpoint);
    return written;
}

// ─── Runner ─────────────────────────────────────────────────────────────────
async function run() {
    console.log(DRY_RUN ? '\n=== DRY RUN — no writes will be made ===\n' : '\n=== Analytics Namespacing Migration ===\n');

    if (DRY_RUN) {
        for (const { source, type } of COLLECTIONS) {
            await dryRunCollection(source, type);
        }

        const { buckets, searchesScanned, countiesScanned, skippedSearches, skippedCounties } = await buildKpiBuckets();
        console.log(`\n--- analytics_searches + analytics_user_counties -> ${KPI_COLLECTION} (${buckets.length} rollup docs) ---`);
        console.log(`  scanned: ${searchesScanned} searches, ${countiesScanned} user_counties`);
        if (skippedSearches || skippedCounties) {
            console.log(`  ⚠️  skipped (missing monthYear): ${skippedSearches} searches, ${skippedCounties} user_counties`);
        }
        for (const b of buckets.slice(0, 3)) {
            console.log(`  ${KPI_COLLECTION}/${b.docId} =`, JSON.stringify(b));
        }
        console.log('\nDry run complete — nothing was written.\n');
        return;
    }

    const checkpoint = loadCheckpoint();
    const results = [];

    for (const { source, type } of COLLECTIONS) {
        const copied = await copyCollection(source, type, checkpoint);
        results.push({ source, type, copied });
    }

    const { buckets, searchesScanned, countiesScanned, skippedSearches, skippedCounties } = await buildKpiBuckets();
    if (skippedSearches || skippedCounties) {
        console.log(`⚠️  skipped (missing monthYear): ${skippedSearches} searches, ${skippedCounties} user_counties`);
    }
    const kpiWritten = await writeKpiBuckets(buckets, checkpoint);

    console.log('\n=== Source vs destination counts ===\n');
    for (const { source, type } of COLLECTIONS) {
        const [srcCount, destCount] = await Promise.all([
            db.collection(source).count().get(),
            destEventsRef(type).count().get(),
        ]);
        const src = srcCount.data().count;
        const dst = destCount.data().count;
        console.log(`  ${source.padEnd(28)} src=${src}  dst(analytics/${type}/events)=${dst}  ${src === dst ? '✅' : '❌ MISMATCH'}`);
    }
    const kpiCount = await db.collection(KPI_COLLECTION).count().get();
    console.log(`  ${KPI_COLLECTION.padEnd(28)} rollup_docs_written=${kpiWritten}  dst_count=${kpiCount.data().count}  (from ${searchesScanned} searches + ${countiesScanned} user_counties)`);

    console.log('\nSource collections were NOT modified or deleted. Drop them manually once the new paths are verified.\n');
}

run()
    .then(() => process.exit(0))
    .catch(err => {
        console.error('\n❌ Migration failed:', err);
        console.error('Safe to re-run — checkpointed collections will resume, not duplicate.\n');
        process.exit(1);
    });
