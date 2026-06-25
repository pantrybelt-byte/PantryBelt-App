const admin = require('firebase-admin');
const { getFirestore } = require('firebase-admin/firestore');

// Initialize the app.
// Note: This assumes you have your GOOGLE_APPLICATION_CREDENTIALS environment variable set,
// or you are running this in an environment already authenticated with Google Cloud.
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = getFirestore(admin.app(), 'pantrybelt-statewide');

// We are adding these so the 'organizations' pillar appears in the console.
const organizations = [
  {
    id: "org_united_way_dallas",
    name: "United Way of Dallas County",
    jurisdictionCounties: ["Dallas"],
    isActive: true,
    createdAt: "2024-01-01T08:00:00Z"
  },
  {
    id: "org_oma_perry",
    name: "Office of Minority Affairs - Perry",
    jurisdictionCounties: ["Perry"],
    isActive: true,
    createdAt: "2024-01-01T08:00:00Z"
  }
];

const resources = [
  {
    id: "res_dls_001",
    orgId: "org_united_way_dallas",
    name: "Selma Community Food Pantry",
    locationType: "stationary_pantry",
    status: "active",
    county: "Dallas",
    coordinates: { lat: 32.4076, lng: -87.0211 },
    geohash: "djd2g3h8",
    address: {
      street: "215 Broad St", city: "Selma", county: "Dallas", state: "AL", zip: "36701"
    },
    hours: {
      monday:    { open: "09:00", close: "17:00", closed: false },
      tuesday:   { open: "09:00", close: "17:00", closed: false },
      wednesday: { open: null,    close: null,    closed: true  },
      thursday:  { open: "09:00", close: "17:00", closed: false },
      friday:    { open: "09:00", close: "14:00", closed: false },
      saturday:  { open: "09:00", close: "12:00", closed: false },
      sunday:    { open: null,    close: null,    closed: true  },
      notes: "Closed on all state and federal holidays"
    },
    phone: "(334) 555-0192",
    website: "https://selmafoodpantry.org",
    eligibilityNotes: "Open to all Dallas County residents. No income verification required.",
    docsRequired: ["Photo ID", "Proof of Dallas County residence"],
    serviceRadiusMiles: 20,
    capacity: 300,
    tags: ["snap-eligible", "senior-friendly", "bilingual-spanish"],
    createdBy: "uid_jane_smith",
    createdAt: "2024-01-15T10:30:00Z",
    updatedAt: "2024-06-01T14:22:00Z"
  },
  {
    id: "res_per_002",
    orgId: "org_oma_perry",
    name: "Marion Resource Center",
    locationType: "stationary_pantry",
    status: "unopened",
    county: "Perry",
    coordinates: { lat: 32.6368, lng: -87.3195 },
    geohash: "djd4k2p1",
    address: {
      street: "100 Washington St", city: "Marion", county: "Perry", state: "AL", zip: "36756"
    },
    hours: null,
    phone: null,
    website: null,
    eligibilityNotes: "To be confirmed upon site activation.",
    docsRequired: [],
    serviceRadiusMiles: null,
    capacity: null,
    tags: [],
    createdBy: "uid_state_admin_01",
    createdAt: "2024-06-10T09:00:00Z",
    updatedAt: "2024-06-10T09:00:00Z"
  }
];

const events = [
  {
    id: "evt_dls_20240715",
    resourceId: "res_dls_001",
    orgId: "org_united_way_dallas",
    county: "Dallas",
    coordinates: { lat: 32.4076, lng: -87.0211 },
    eventType: "scheduled_distribution",
    title: "July Monthly Food Box Distribution",
    description: "Monthly pre-packed food boxes for eligible Dallas County households. Drive-through pickup at rear parking lot.",
    startTime: "2024-07-15T09:00:00Z",
    endTime: "2024-07-15T13:00:00Z",
    isRecurring: true,
    recurrenceRule: "FREQ=MONTHLY;BYDAY=3MO",
    status: "published",
    fulfillmentStatus: "not_started",
    fulfillmentNotes: "",
    expectedHouseholds: 150,
    servedHouseholds: 0,
    createdBy: "uid_jane_smith",
    createdAt: "2024-06-20T11:00:00Z",
    updatedAt: "2024-06-20T11:00:00Z"
  },
  {
    id: "evt_per_mob_001",
    resourceId: "res_per_002",
    orgId: "org_oma_perry",
    county: "Perry",
    coordinates: { lat: 32.6368, lng: -87.3195 },
    eventType: "mobile_stop",
    title: "Perry County Mobile Distribution Pilot",
    description: "Pilot mobile stop pending site coordinator assignment and county approval.",
    startTime: null,
    endTime: null,
    isRecurring: false,
    recurrenceRule: null,
    status: "unopened",
    fulfillmentStatus: "unopened",
    fulfillmentNotes: "Awaiting site coordinator assignment from Office of Minority Affairs.",
    expectedHouseholds: null,
    servedHouseholds: 0,
    createdBy: "uid_state_admin_01",
    createdAt: "2024-06-10T09:05:00Z",
    updatedAt: "2024-06-10T09:05:00Z"
  }
];

const resourceRequests = [
  {
    id: "req_dls_20240710",
    eventId: "evt_dls_20240715",
    resourceId: "res_dls_001",
    orgId: "org_united_way_dallas",
    county: "Dallas",
    requestType: "supply_need",
    status: "pending",
    priority: "high",
    submittedBy: "uid_jane_smith",
    assignedTo: "uid_warehouse_coord",
    notes: "Stock critically low ahead of July distribution. Items needed no later than July 13th.",
    dueDate: "2024-07-13T17:00:00Z",
    createdAt: "2024-07-10T08:00:00Z",
    updatedAt: "2024-07-10T08:00:00Z"
  }
];

const items = [
  {
    id: "item_001",
    category: "food",
    itemName: "Canned Green Beans",
    quantityRequested: 500,
    quantityFulfilled: 200,
    unit: "cans",
    urgency: "within_week",
    notes: "Del Monte or comparable store brand acceptable."
  },
  {
    id: "item_002",
    category: "hygiene",
    itemName: "Bar Soap (4-pack)",
    quantityRequested: 100,
    quantityFulfilled: 100,
    unit: "packs",
    urgency: "within_week",
    notes: ""
  }
];

async function seedDatabase() {
  console.log('🌱 Starting database seed process...');

  try {
    // 1. Seed Organizations
    for (const org of organizations) {
      await db.collection('organizations').doc(org.id).set(org);
      console.log(`✅ Seeded Organization: ${org.id}`);
    }

    // 2. Seed Resources
    for (const res of resources) {
      await db.collection('resources').doc(res.id).set(res);
      console.log(`✅ Seeded Resource: ${res.id}`);
    }

    // 3. Seed Events
    for (const evt of events) {
      await db.collection('events').doc(evt.id).set(evt);
      console.log(`✅ Seeded Event: ${evt.id}`);
    }

    // 4. Seed Resource Requests & Items Subcollection
    for (const req of resourceRequests) {
      await db.collection('resourceRequests').doc(req.id).set(req);
      console.log(`✅ Seeded Resource Request: ${req.id}`);

      for (const item of items) {
        await db.collection('resourceRequests').doc(req.id).collection('items').doc(item.id).set(item);
        console.log(`  ↪ ✅ Seeded Subcollection Item: ${item.id}`);
      }
    }

    console.log('\n🎉 Seeding Complete! All four pillars have been generated.');
    console.log('👉 Head over to your Firebase Console > Firestore Database to view them.');
    process.exit(0);

  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  }
}

// Run the script
seedDatabase();
