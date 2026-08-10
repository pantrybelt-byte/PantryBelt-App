/**
 * AccessBelt — Four-Pillar Firestore Seed Script
 * Seeds one representative document per collection so the Firebase Console
 * shows all four pillars: organizations, resources, events, resourceRequests.
 * Run once: node seedFirestore.js
 */

const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

// ── Helpers ──────────────────────────────────────────────────────────────────

const ts = (iso) => admin.firestore.Timestamp.fromDate(new Date(iso));

function log(msg) {
  process.stdout.write(`  ${msg}\n`);
}

// ── Seed Data ────────────────────────────────────────────────────────────────

const organizations = [
  {
    id: 'org_united_way_dallas',
    data: {
      id:                   'org_united_way_dallas',
      name:                 'United Way of Central Alabama — Dallas County',
      type:                 'united_way',
      jurisdictionCounties: ['Dallas', 'Hale', 'Perry'],
      contactName:          'Margaret Johnson',
      contactEmail:         'mjohnson@unitedway-dallas.org',
      contactPhone:         '(334) 555-0100',
      isActive:             true,
      tier:                 'regional',
      createdAt:            ts('2024-01-01T00:00:00Z'),
      updatedAt:            ts('2024-01-01T00:00:00Z'),
    },
  },
  {
    id: 'org_oma_perry',
    data: {
      id:                   'org_oma_perry',
      name:                 'Office of Minority Affairs — Perry County',
      type:                 'state_agency',
      jurisdictionCounties: ['Perry'],
      contactName:          'Rev. James Carter',
      contactEmail:         'jcarter@oma.alabama.gov',
      contactPhone:         '(334) 555-0201',
      isActive:             true,
      tier:                 'local',
      createdAt:            ts('2024-01-01T00:00:00Z'),
      updatedAt:            ts('2024-01-01T00:00:00Z'),
    },
  },
];

const resources = [
  {
    id: 'res_dls_001',
    data: {
      id:               'res_dls_001',
      orgId:            'org_united_way_dallas',
      name:             'Selma Community Food Pantry',
      locationType:     'stationary_pantry',
      status:           'active',
      county:           'Dallas',
      coordinates:      { lat: 32.4076, lng: -87.0211 },
      geohash:          'djd2g3h8',
      address: {
        street: '215 Broad St',
        city:   'Selma',
        county: 'Dallas',
        state:  'AL',
        zip:    '36701',
      },
      hours: {
        monday:    { open: '09:00', close: '17:00', closed: false },
        tuesday:   { open: '09:00', close: '17:00', closed: false },
        wednesday: { open: null,    close: null,    closed: true  },
        thursday:  { open: '09:00', close: '17:00', closed: false },
        friday:    { open: '09:00', close: '14:00', closed: false },
        saturday:  { open: '09:00', close: '12:00', closed: false },
        sunday:    { open: null,    close: null,    closed: true  },
        notes:     'Closed on all state and federal holidays',
      },
      phone:             '(334) 555-0192',
      website:           'https://selmafoodpantry.org',
      eligibilityNotes:  'Open to all Dallas County residents. No income verification required.',
      docsRequired:      ['Photo ID', 'Proof of Dallas County residence'],
      serviceRadiusMiles: 20,
      capacity:          300,
      tags:              ['snap-eligible', 'senior-friendly', 'bilingual-spanish'],
      createdBy:         'uid_jane_smith',
      createdAt:         ts('2024-01-15T10:30:00Z'),
      updatedAt:         ts('2024-06-01T14:22:00Z'),
    },
  },
  {
    id: 'res_per_002',
    data: {
      id:               'res_per_002',
      orgId:            'org_oma_perry',
      name:             'Marion Resource Center',
      locationType:     'stationary_pantry',
      status:           'unopened',
      county:           'Perry',
      coordinates:      { lat: 32.6368, lng: -87.3195 },
      geohash:          'djd4k2p1',
      address: {
        street: '100 Washington St',
        city:   'Marion',
        county: 'Perry',
        state:  'AL',
        zip:    '36756',
      },
      hours:             null,
      phone:             null,
      website:           null,
      eligibilityNotes:  'To be confirmed upon site activation.',
      docsRequired:      [],
      serviceRadiusMiles: null,
      capacity:          null,
      tags:              [],
      createdBy:         'uid_state_admin_01',
      createdAt:         ts('2024-06-10T09:00:00Z'),
      updatedAt:         ts('2024-06-10T09:00:00Z'),
    },
  },
];

const events = [
  {
    id: 'evt_dls_20240715',
    data: {
      id:               'evt_dls_20240715',
      resourceId:       'res_dls_001',
      orgId:            'org_united_way_dallas',
      county:           'Dallas',
      coordinates:      { lat: 32.4076, lng: -87.0211 },
      eventType:        'scheduled_distribution',
      title:            'July Monthly Food Box Distribution',
      description:      'Monthly pre-packed food boxes for eligible Dallas County households. Drive-through pickup at rear parking lot.',
      startTime:        ts('2024-07-15T09:00:00Z'),
      endTime:          ts('2024-07-15T13:00:00Z'),
      isRecurring:      true,
      recurrenceRule:   'FREQ=MONTHLY;BYDAY=3MO',
      status:           'published',
      fulfillmentStatus: 'not_started',
      fulfillmentNotes:  '',
      expectedHouseholds: 150,
      servedHouseholds:   0,
      createdBy:         'uid_jane_smith',
      createdAt:         ts('2024-06-20T11:00:00Z'),
      updatedAt:         ts('2024-06-20T11:00:00Z'),
    },
  },
  {
    id: 'evt_per_mob_001',
    data: {
      id:               'evt_per_mob_001',
      resourceId:       'res_per_002',
      orgId:            'org_oma_perry',
      county:           'Perry',
      coordinates:      { lat: 32.6368, lng: -87.3195 },
      eventType:        'mobile_stop',
      title:            'Perry County Mobile Distribution Pilot',
      description:      'Pilot mobile stop pending site coordinator assignment and county approval.',
      startTime:        null,
      endTime:          null,
      isRecurring:      false,
      recurrenceRule:   null,
      status:           'unopened',
      fulfillmentStatus: 'unopened',
      fulfillmentNotes:  'Awaiting site coordinator assignment from Office of Minority Affairs.',
      expectedHouseholds: null,
      servedHouseholds:   0,
      createdBy:         'uid_state_admin_01',
      createdAt:         ts('2024-06-10T09:05:00Z'),
      updatedAt:         ts('2024-06-10T09:05:00Z'),
    },
  },
];

const resourceRequests = [
  {
    id: 'req_dls_20240710',
    data: {
      id:          'req_dls_20240710',
      eventId:     'evt_dls_20240715',
      resourceId:  'res_dls_001',
      orgId:       'org_united_way_dallas',
      county:      'Dallas',
      requestType: 'supply_need',
      status:      'pending',
      priority:    'high',
      submittedBy: 'uid_jane_smith',
      assignedTo:  'uid_warehouse_coord',
      notes:       'Stock critically low ahead of July distribution. Items needed no later than July 13th.',
      dueDate:     ts('2024-07-13T17:00:00Z'),
      createdAt:   ts('2024-07-10T08:00:00Z'),
      updatedAt:   ts('2024-07-10T08:00:00Z'),
    },
    items: [
      {
        id: 'item_001',
        data: {
          id:                'item_001',
          category:          'food',
          itemName:          'Canned Green Beans',
          quantityRequested: 500,
          quantityFulfilled: 200,
          unit:              'cans',
          urgency:           'within_week',
          notes:             'Del Monte or comparable store brand acceptable.',
        },
      },
      {
        id: 'item_002',
        data: {
          id:                'item_002',
          category:          'hygiene',
          itemName:          'Bar Soap (4-pack)',
          quantityRequested: 100,
          quantityFulfilled: 100,
          unit:              'packs',
          urgency:           'within_week',
          notes:             '',
        },
      },
    ],
  },
];

// ── Runner ───────────────────────────────────────────────────────────────────

async function seed() {
  console.log('\nAccessBelt — Seeding Four-Pillar Firestore Collections\n');

  // Pillar 1: organizations
  console.log('Pillar 1 — organizations');
  for (const org of organizations) {
    await db.collection('organizations').doc(org.id).set(org.data);
    log(`✔ organizations/${org.id}`);
  }

  // Pillar 2: resources
  console.log('\nPillar 2 — resources');
  for (const res of resources) {
    await db.collection('resources').doc(res.id).set(res.data);
    log(`✔ resources/${res.id}`);
  }

  // Pillar 3: events
  console.log('\nPillar 3 — events');
  for (const evt of events) {
    await db.collection('events').doc(evt.id).set(evt.data);
    log(`✔ events/${evt.id}`);
  }

  // Pillar 4: resourceRequests + items subcollection
  console.log('\nPillar 4 — resourceRequests');
  for (const req of resourceRequests) {
    await db.collection('resourceRequests').doc(req.id).set(req.data);
    log(`✔ resourceRequests/${req.id}`);

    if (req.items && req.items.length > 0) {
      for (const item of req.items) {
        await db
          .collection('resourceRequests')
          .doc(req.id)
          .collection('items')
          .doc(item.id)
          .set(item.data);
        log(`  ✔ resourceRequests/${req.id}/items/${item.id}`);
      }
    }
  }

  console.log('\n✅ All four pillars seeded successfully.');
  console.log('   Open your Firebase Console → Firestore to verify:\n');
  console.log('   https://console.firebase.google.com/project/pantrybelt-1e7eb/firestore\n');
}

seed().catch((err) => {
  console.error('\n❌ Seed failed:', err.message);
  process.exit(1);
});
