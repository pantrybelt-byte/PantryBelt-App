const admin = require('firebase-admin');
const serviceAccount = require('/Users/Thad/.config/accessbelt/serviceAccountKey.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

// Targeted list of verified Madison County pantries with their own contact info
const updates = [
  {
    id: 'OsRb3FYBTyUhCXSqxDpJ',
    name: 'Huntsville Assistance Program (HAP)',
    phone: '256-534-1928',
    website: 'https://huntsvilleap.org'
  },
  {
    id: 'SCYPbPy2OIteH2cLOGRH',
    name: 'Huntsville Assistance Program (HAP) - Madison',
    phone: '256-325-0871',
    website: 'https://huntsvilleap.org'
  },
  {
    id: 'pnzwmxIkmyOrgbWTGoaZ',
    name: 'Huntsville Assistance Program (HAP)- Toney',
    phone: '256-828-8788',
    website: 'https://huntsvilleap.org'
  },
  {
    id: 'u46CSuIrRWwvZuyHU3cy',
    name: 'Downtown Rescue Mission',
    phone: '256-536-2441',
    website: 'https://downtownrescuemission.org'
  },
  {
    id: 'PU3WVmHmHcbtFAW9uCHm',
    name: 'Manna House',
    phone: '256-503-4848',
    website: 'https://mymannahouse.com'
  },
  {
    id: 'JKIhcXtH5adV21xrMtQb',
    name: 'Asbury Church',
    phone: '256-837-0365',
    website: 'https://weareasbury.com'
  },
  {
    id: 'HHlT3FsMkVGNTuKwdMqd',
    name: 'St. John the Baptist Catholic Church- St. Vincent dePaul',
    phone: '256-726-0100',
    website: 'https://www.stjohnbchurch.org'
  },
  {
    id: 'rvYMMOkwnWtnGzamhIKg',
    name: 'Oakwood Community Health Action Center',
    phone: '256-726-7777',
    website: 'https://chac.oakwood.edu'
  },
  {
    id: 'LJXDCQy6ObFN01wSNnUm',
    name: 'Life Church Huntsville',
    phone: '256-852-5580',
    website: 'https://lifechurchhuntsville.com'
  },
  {
    id: 'MBdjEiI1ifmwqCpMoD0j',
    name: 'First Baptist Church, Madison',
    phone: '256-772-9712',
    website: 'https://www.fbcmadison.net'
  },
  {
    id: 'DNMVJjj431gU5dMQBY4g',
    name: 'Rose of Sharon',
    phone: '256-536-2970',
    website: 'https://roseofsharonsoupkitchen.org'
  },
  {
    id: 'DWsyP7HYjWKsq3IOYwLm',
    name: 'Lincoln Church of Christ',
    phone: '256-536-7211',
    website: 'http://www.lincolnchurch.org'
  },
  {
    id: 'Mc8foWZzcQLm1MGO4vaW',
    name: 'St. Joseph Catholic Church- St. Vincent dePaul',
    phone: '256-534-8459',
    website: 'https://saintjosephcc.com'
  }
];

function pantryTier(p) {
  if (p.verified) return 'green';
  if (p.phone || p.website || (p.socialMedia && p.socialMedia.length > 0)) return 'orange';
  return 'grey';
}

async function applyUpdates() {
  console.log(`Applying contact updates to ${updates.length} Madison County pantries...`);
  const batch = db.batch();

  for (const item of updates) {
    const docRef = db.collection('agencies').doc(item.id);
    batch.update(docRef, {
      phone: item.phone,
      website: item.website,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
  }

  await batch.commit();
  console.log('Successfully committed batch update.\n');

  // Verify
  console.log('Verifying pin tiers in Madison County:');
  const snap = await db.collection('agencies').where('status', '==', 'active').get();
  let orangeCount = 0;
  let greyCount = 0;
  let greenCount = 0;

  snap.forEach(doc => {
    const d = doc.data();
    if (d.county === 'Madison' || (d.city && (d.city.toLowerCase().includes('huntsville') || d.city.toLowerCase().includes('madison')))) {
      const tier = pantryTier(d);
      if (tier === 'orange') orangeCount++;
      else if (tier === 'green') greenCount++;
      else greyCount++;
      
      const matched = updates.find(u => u.id === doc.id);
      if (matched) {
        console.log(`- [${tier.toUpperCase()}] ${d.name}: phone="${d.phone}", website="${d.website}"`);
      }
    }
  });

  console.log(`\nMadison County Summary:`);
  console.log(`  Orange: ${orangeCount}`);
  console.log(`  Grey:   ${greyCount}`);
  console.log(`  Green:  ${greenCount}`);
  console.log(`  Total:  ${orangeCount + greyCount + greenCount}`);
}

applyUpdates().catch(err => {
  console.error('Error applying updates:', err);
  process.exit(1);
});
