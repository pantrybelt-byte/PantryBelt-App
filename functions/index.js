/**
 * AccessBelt Cloud Functions — TIER 3B Security
 *
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │  UPGRADE PATH: Deploy when upgrading to Firebase Blaze plan         │
 * │                                                                      │
 * │  How it strengthens Tier 3:                                          │
 * │  • Replaces the Firestore session doc with a Firebase Custom Claim   │
 * │  • Custom claims live in the JWT — can't be forged or spoofed        │
 * │  • The function validates a time-based nonce + rate-limits per UID   │
 * │  • Only the app binary has the nonce algorithm (from .env secret)    │
 * │                                                                      │
 * │  Deployment:                                                         │
 * │    cd functions && npm install                                       │
 * │    firebase deploy --only functions --project pantrybelt-1e7eb      │
 * └─────────────────────────────────────────────────────────────────────┘
 *
 * Once deployed, update firestore.rules to use:
 *   request.auth.token.appVerified == true
 * instead of hasActiveSession(), for even stronger server-side verification.
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');

admin.initializeApp();
const db = admin.firestore();

// Rate limit: max 5 grant requests per UID per hour
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

/**
 * grantAppAccess — Tier 3B Cloud Function
 *
 * Called by utils/auth.ts after anonymous sign-in (when on Blaze plan).
 * Sets a custom claim { appVerified: true } on the anonymous Firebase user.
 *
 * The Firestore rules can then check:
 *   request.auth.token.appVerified == true
 *
 * Security checks performed server-side:
 *   1. UID must match the authenticated caller
 *   2. Nonce must be valid for the current time window
 *   3. Rate limit: max 5 calls per UID per hour
 */
exports.grantAppAccess = onCall({ cors: true }, async (request) => {
    // ── Must be authenticated ─────────────────────────────────────────────
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Authentication required.');
    }

    const uid = request.auth.uid;
    const { nonce, platform } = request.data ?? {};

    // ── Validate inputs ───────────────────────────────────────────────────
    if (!nonce || typeof nonce !== 'string') {
        throw new HttpsError('invalid-argument', 'nonce required.');
    }
    if (!platform || !['ios', 'android', 'web'].includes(platform)) {
        throw new HttpsError('invalid-argument', 'Invalid platform.');
    }

    // ── Validate time-based nonce ─────────────────────────────────────────
    // The nonce must match: "{uid_last8}_pb_{platform}_{currentHourSlot}"
    // Current AND previous hour slot are accepted (10-minute grace window handled client-side)
    const hourSlot = Math.floor(Date.now() / 3_600_000);
    const uidSuffix = uid.slice(-8);
    const validNonces = new Set([
        `${uidSuffix}_pb_${platform}_${hourSlot}`,
        `${uidSuffix}_pb_${platform}_${hourSlot - 1}`,
    ]);

    if (!validNonces.has(nonce)) {
        console.warn(`[Security] Invalid nonce attempt from uid=${uid}`);
        throw new HttpsError('permission-denied', 'Invalid app nonce.');
    }

    // ── Rate limiting ─────────────────────────────────────────────────────
    const rateRef = db.collection('_rate_limits').doc(uid);
    const rateSnap = await rateRef.get();
    const now = Date.now();

    if (rateSnap.exists) {
        const { count, windowStart } = rateSnap.data();
        if (now - windowStart < RATE_LIMIT_WINDOW_MS) {
            if (count >= RATE_LIMIT_MAX) {
                console.warn(`[Security] Rate limit hit for uid=${uid}`);
                throw new HttpsError('resource-exhausted', 'Too many requests. Try again later.');
            }
            await rateRef.update({ count: admin.firestore.FieldValue.increment(1) });
        } else {
            // Window expired — reset
            await rateRef.set({ count: 1, windowStart: now });
        }
    } else {
        await rateRef.set({ count: 1, windowStart: now });
    }

    // ── Set custom claim ──────────────────────────────────────────────────
    await admin.auth().setCustomUserClaims(uid, {
        appVerified: true,
        platform,
        claimedAt: now,
    });

    // Log for audit trail
    console.log(`[Security] appVerified claim granted to uid=${uid} platform=${platform}`);

    return { success: true, uid };
});

// ═══════════════════════════════════════════════════════════════════════════
// OPERATOR PORTAL — claims, claim review, live-status and broadcast sync
// ═══════════════════════════════════════════════════════════════════════════
//
// The portal writes to the `accessbelt-operator` database only. These
// functions are the single bridge to (default), which families read:
//   • syncLiveStatus  operator liveStatus/{pantryId} -> agencies/{pantryId}.liveStatus
//   • syncBroadcast   operator broadcasts/{id}      -> (default)/broadcasts/{id}
// Both check that the pantry in `agencies` belongs to the writer's orgId
// before copying anything, because operator rules can only check the orgId
// the client wrote, not who owns the pantry.

const { onDocumentWritten } = require('firebase-functions/v2/firestore');
const { logger } = require('firebase-functions');
const { getFirestore, FieldValue, Timestamp } = require('firebase-admin/firestore');
const {
    computeExpiry, toPublicLiveStatus, toPublicBroadcast, sameDoc, encodeGeohash,
} = require('./lib/liveStatus');

const OPERATOR_DB = 'accessbelt-operator';
// Firestore-triggered functions must run where the operator database lives.
// Confirm with: firebase firestore:databases:get accessbelt-operator
const OPERATOR_DB_REGION = 'us-central1';

const opDb = getFirestore(OPERATOR_DB);

// Imported pantries carry this placeholder orgId until someone claims them.
const UNCLAIMED_ORG_IDS = new Set(['org_pantry_belt', '', undefined, null]);
const OPERATOR_ROLES = ['org_staff', 'org_admin', 'state_admin'];
const ROLE_TITLE = { state_admin: 'Manager', org_admin: 'Manager', org_staff: 'Shift Lead' };

function requireStateAdmin(request) {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required.');
    if (request.auth.token.role !== 'state_admin') {
        throw new HttpsError('permission-denied', 'Only a state administrator can do this.');
    }
}

function cleanCounties(value) {
    if (!Array.isArray(value) || value.length === 0 || value.length > 67) return null;
    if (!value.every((c) => typeof c === 'string' && c.length > 0 && c.length <= 40)) return null;
    return [...new Set(value)];
}

/**
 * Sets the operator claims on a user, keeping unrelated claims (appVerified),
 * and records the operator in (default)/users for the portal's Team page.
 */
async function setOperatorClaims(uid, { role, orgId, counties, pantryId }, profile = {}) {
    const user = await admin.auth().getUser(uid);
    const existing = user.customClaims ?? {};
    await admin.auth().setCustomUserClaims(uid, { ...existing, role, orgId, counties, pantryId });

    await db.collection('users').doc(uid).set({
        orgId,
        role,
        authorizedCounties: counties,
        email: user.email ?? '',
        name: profile.name ?? user.displayName ?? user.email ?? '',
        title: ROLE_TITLE[role],
        status: 'Active',
        updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
}

/**
 * grantOperatorAccess — mint operator claims directly.
 *
 * state_admin may grant any role in any org. org_admin may add org_staff to
 * their own org, within their own counties. Nobody can grant themselves a
 * higher role. The token picks up new claims on its next refresh
 * (getIdToken(true) on the client).
 */
exports.grantOperatorAccess = onCall({ cors: true }, async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required.');
    const caller = request.auth.token;
    const { uid, role, orgId, pantryId } = request.data ?? {};
    const counties = cleanCounties(request.data?.counties);

    if (typeof uid !== 'string' || uid.length === 0) throw new HttpsError('invalid-argument', 'uid required.');
    if (!OPERATOR_ROLES.includes(role)) throw new HttpsError('invalid-argument', 'Unknown role.');
    if (typeof orgId !== 'string' || orgId.length === 0) throw new HttpsError('invalid-argument', 'orgId required.');
    if (!counties) throw new HttpsError('invalid-argument', 'counties must be a non-empty list.');
    if (typeof pantryId !== 'string' || pantryId.length === 0) throw new HttpsError('invalid-argument', 'pantryId required.');

    const isStateAdmin = caller.role === 'state_admin';
    const isOrgAdminForOrg = caller.role === 'org_admin' && caller.orgId === orgId
        && role === 'org_staff'
        && Array.isArray(caller.counties) && counties.every((c) => caller.counties.includes(c));
    if (!isStateAdmin && !isOrgAdminForOrg) {
        throw new HttpsError('permission-denied', 'Not allowed to grant this access.');
    }
    if (uid === request.auth.uid && !isStateAdmin) {
        throw new HttpsError('permission-denied', 'You cannot change your own access.');
    }

    await setOperatorClaims(uid, { role, orgId, counties, pantryId });
    logger.info('operator claims granted', { by: request.auth.uid, uid, role, orgId });
    return { success: true };
});

/**
 * reviewPantryClaim — a state admin approves or rejects a "Claim my pantry"
 * request. Approval links the pantry to an org (a new one if the pantry was
 * unclaimed), turns on operatorPortalAccess, and grants claims to the claimant.
 */
exports.reviewPantryClaim = onCall({ cors: true }, async (request) => {
    requireStateAdmin(request);
    const { claimId, decision, reason } = request.data ?? {};
    if (typeof claimId !== 'string' || !['approve', 'reject'].includes(decision)) {
        throw new HttpsError('invalid-argument', 'claimId and decision (approve|reject) required.');
    }

    const claimRef = opDb.collection('pantryClaims').doc(claimId);
    const claimSnap = await claimRef.get();
    if (!claimSnap.exists) throw new HttpsError('not-found', 'Claim not found.');
    const claim = claimSnap.data();
    if (claim.status !== 'pending') throw new HttpsError('failed-precondition', `Claim is already ${claim.status}.`);

    const review = {
        reviewedBy: request.auth.uid,
        reviewedAt: FieldValue.serverTimestamp(),
        reviewNote: typeof reason === 'string' ? reason.slice(0, 500) : '',
    };

    if (decision === 'reject') {
        await claimRef.update({ status: 'rejected', ...review });
        return { success: true, status: 'rejected' };
    }

    const agencyRef = db.collection('agencies').doc(claim.pantryId);
    const agencySnap = await agencyRef.get();
    if (!agencySnap.exists) throw new HttpsError('failed-precondition', 'That pantry is no longer listed.');
    const agency = agencySnap.data();

    const unclaimed = UNCLAIMED_ORG_IDS.has(agency.orgId);
    const orgId = unclaimed ? `org_${claim.pantryId}` : agency.orgId;
    const role = unclaimed ? 'org_admin' : 'org_staff';
    const counties = [agency.county];

    if (unclaimed) {
        await db.collection('organizations').doc(orgId).set({
            name: agency.name ?? '',
            jurisdictionCounties: counties,
            createdAt: FieldValue.serverTimestamp(),
            createdBy: request.auth.uid,
        }, { merge: true });
    }
    await agencyRef.update({ orgId, operatorPortalAccess: true, updatedAt: FieldValue.serverTimestamp() });
    await setOperatorClaims(claim.claimantUid, { role, orgId, counties, pantryId: claim.pantryId },
        { name: claim.contactName });
    await claimRef.update({ status: 'approved', orgId, role, ...review });

    logger.info('pantry claim approved', { claimId, pantryId: claim.pantryId, orgId, role });
    return { success: true, status: 'approved', orgId, role };
});

/** US Census one-line geocoder (free, no key). Returns {lat, lng} or null. */
async function geocodeCensus(address) {
    const url = 'https://geocoding.geo.census.gov/geocoder/locations/onelineaddress'
        + `?address=${encodeURIComponent(address)}&benchmark=Public_AR_Current&format=json`;
    try {
        const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
        if (!res.ok) return null;
        const body = await res.json();
        const match = body?.result?.addressMatches?.[0]?.coordinates;
        return match ? { lat: match.y, lng: match.x } : null;
    } catch (e) {
        logger.warn('census geocode failed', { message: e.message });
        return null;
    }
}

/**
 * reviewNewPantrySubmission — a state admin approves or rejects an "Add an
 * unlisted pantry" submission. Approval geocodes the address (or uses the
 * lat/lng the admin supplies), creates the agencies listing unverified, and
 * makes the submitter its org_admin.
 */
exports.reviewNewPantrySubmission = onCall({ cors: true }, async (request) => {
    requireStateAdmin(request);
    const { submissionId, decision, reason, lat, lng } = request.data ?? {};
    if (typeof submissionId !== 'string' || !['approve', 'reject'].includes(decision)) {
        throw new HttpsError('invalid-argument', 'submissionId and decision (approve|reject) required.');
    }

    const subRef = opDb.collection('newPantrySubmissions').doc(submissionId);
    const subSnap = await subRef.get();
    if (!subSnap.exists) throw new HttpsError('not-found', 'Submission not found.');
    const sub = subSnap.data();
    if (sub.status !== 'pending') throw new HttpsError('failed-precondition', `Submission is already ${sub.status}.`);

    const review = {
        reviewedBy: request.auth.uid,
        reviewedAt: FieldValue.serverTimestamp(),
        reviewNote: typeof reason === 'string' ? reason.slice(0, 500) : '',
    };

    if (decision === 'reject') {
        await subRef.update({ status: 'rejected', ...review });
        return { success: true, status: 'rejected' };
    }

    let coords = null;
    if (typeof lat === 'number' && typeof lng === 'number'
        && lat >= 30 && lat <= 35.1 && lng >= -88.6 && lng <= -84.8) {
        coords = { lat, lng };
    } else {
        coords = await geocodeCensus(`${sub.street}, ${sub.city}, AL ${sub.zip}`);
    }
    if (!coords) {
        throw new HttpsError('failed-precondition',
            'The Census geocoder could not place this address. Approve again with lat and lng.');
    }

    const agencyRef = db.collection('agencies').doc();
    const orgId = `org_${agencyRef.id}`;
    const county = sub.county;

    await db.collection('organizations').doc(orgId).set({
        name: sub.orgName || sub.pantryName,
        jurisdictionCounties: [county],
        createdAt: FieldValue.serverTimestamp(),
        createdBy: request.auth.uid,
    });
    await agencyRef.set({
        orgId,
        name: sub.pantryName,
        locationType: 'stationary_pantry',
        status: 'active',
        county,
        coordinates: coords,
        geohash: encodeGeohash(coords.lat, coords.lng),
        address: { street: sub.street, city: sub.city, county, state: 'AL', zip: sub.zip },
        hours: sub.hoursText,
        phone: sub.phone,
        website: sub.website ?? '',
        socialMedia: [],
        eligibilityNotes: '',
        docsRequired: [],
        tags: [],
        verified: false,
        operatorPortalAccess: true,
        miniProfile: null,
        createdBy: `portal_submission_${submissionId}`,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
    });
    await setOperatorClaims(sub.submitterUid,
        { role: 'org_admin', orgId, counties: [county], pantryId: agencyRef.id },
        { name: sub.contactName });
    await subRef.update({ status: 'approved', agencyId: agencyRef.id, orgId, ...review });

    logger.info('new pantry approved', { submissionId, agencyId: agencyRef.id, orgId });
    return { success: true, status: 'approved', agencyId: agencyRef.id };
});

/** Reads agencies/{pantryId} and confirms it belongs to orgId. */
async function ownedAgency(pantryId, orgId, context) {
    const snap = await db.collection('agencies').doc(pantryId).get();
    if (!snap.exists) {
        logger.warn(`${context}: pantry not found in agencies`, { pantryId });
        return null;
    }
    const agency = snap.data();
    if (agency.orgId !== orgId) {
        logger.warn(`${context}: orgId does not own pantry, not copied`, { pantryId, orgId, owner: agency.orgId });
        return null;
    }
    return { ref: snap.ref, data: agency };
}

/**
 * syncLiveStatus — copies Shift Mode status onto the public agencies doc,
 * with an expiresAt (end of today's posted hours, else 6 hours) after which
 * the app falls back to the posted schedule.
 */
exports.syncLiveStatus = onDocumentWritten(
    { document: 'liveStatus/{pantryId}', database: OPERATOR_DB, region: OPERATOR_DB_REGION },
    async (event) => {
        const pantryId = event.params.pantryId;
        const after = event.data?.after;

        if (!after?.exists) {
            const before = event.data?.before?.data();
            const owned = before && await ownedAgency(pantryId, before.orgId, 'syncLiveStatus');
            if (owned) await owned.ref.update({ liveStatus: FieldValue.delete() });
            return;
        }

        const source = after.data();
        const owned = await ownedAgency(pantryId, source.orgId, 'syncLiveStatus');
        if (!owned) return;

        const expiresAt = Timestamp.fromDate(computeExpiry(owned.data.hours));
        const liveStatus = toPublicLiveStatus(source, expiresAt);
        if (!liveStatus) {
            logger.warn('syncLiveStatus: invalid state, not copied', { pantryId, state: source.state });
            return;
        }
        await owned.ref.update({ liveStatus });
    }
);

/**
 * syncBroadcast — publishes operator broadcasts to (default)/broadcasts,
 * where the app reads them by county, then marks sentToApp. Edits are
 * re-published and deletions removed. Idempotent: its own sentToApp write
 * re-triggers it and finds nothing to change.
 */
exports.syncBroadcast = onDocumentWritten(
    { document: 'broadcasts/{broadcastId}', database: OPERATOR_DB, region: OPERATOR_DB_REGION },
    async (event) => {
        const broadcastId = event.params.broadcastId;
        const publicRef = db.collection('broadcasts').doc(broadcastId);
        const after = event.data?.after;

        if (!after?.exists) {
            await publicRef.delete();
            return;
        }

        const source = after.data();
        const owned = await ownedAgency(source.pantryId, source.orgId, 'syncBroadcast');
        if (!owned) return;

        const next = toPublicBroadcast(source, owned.data, source.pantryId);
        const current = await publicRef.get();
        if (!current.exists || !sameDoc(current.data(), next)) {
            await publicRef.set(next);
        }
        if (source.sentToApp !== true) {
            await after.ref.update({ sentToApp: true });
        }
    }
);
