/**
 * tools/addCFBCAPantries.js — Adds pantries from twelve Community Food
 * Bank of Central Alabama (CFBCA) county datasets (PDF exports,
 * 2026-08-17) to the live `resources` collection: Shelby, Etowah,
 * Cherokee, Talladega, Clay, Cleburne, Calhoun, St. Clair, Blount,
 * Jefferson, Walker, Winston. Uses the Admin SDK (serviceAccountKey.json),
 * so it bypasses Firestore rules entirely — run with care.
 *
 * Coordinates come directly from the source dataset (no geocoding needed).
 *
 * Two systematic exclusions applied before writing:
 *  - "CSFP - X" rows (the Commodity Supplemental Food Program, a senior
 *    grocery-box program) that share the exact same street address as a
 *    same-site "Pantry"-type row are dropped, keeping the Pantry-named
 *    entry — otherwise the map would show two stacked pins at one
 *    building for what is, from a "where do I go" standpoint, one site
 *    (e.g. Talladega's "CSFP - The Sanctuary" vs. "The Sanctuary";
 *    Calhoun's "CSFP - CCAPS" vs. "Friendship Missionary Baptist" — same
 *    address AND phone; Jefferson's "CSFP - Tarrant" vs. "True Vine
 *    Evangelical"). ~7 such pairs found across the batch.
 *  - Rows whose AgencyGroup is bare "Residential" or "Residential
 *    (non-USDA)" — shelters, rehab housing, senior apartments — with no
 *    Pantry/Soup Kitchen component are excluded: they are not food
 *    distribution points, so listing them on a food-pantry locator map
 *    would be misleading. Combo categories that do include food service
 *    ("Residential & Pantry", "Residential & Soup Kitchen") are kept. This
 *    also resolves several of the CSFP pairs above from the other
 *    direction — e.g. Jefferson's "ELCD - Villa Maria" (Residential) sits
 *    at the same address as "CSFP - Villa Maria"; the Residential row is
 *    dropped on category grounds and the CSFP row (real food distribution
 *    to that building's residents) is kept standalone. ~18 such rows,
 *    concentrated in Jefferson and Blount.
 *
 * No existing Firestore resources were found in any of these 12 counties
 * before this import (all previously untouched).
 */
require('dotenv').config();
const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

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
    if (!raw) return '';
    const digits = raw.replace(/\D/g, '');
    if (digits.length !== 10) return raw;
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

// name, street, city, county, zip, phone, lat, lng
const NEW_PANTRIES = [
    // ── Shelby County (19) ──────────────────────────────────────────────
    ['Build-A-Bridge Pantry', '7993 County Road 62', 'Vincent', 'Shelby', '35178', '2059600026', 33.3712671, -86.4161316],
    ['Matthew 25-35 Outreach Organization Pantry', '5511 Hwy 280 Suite 116', 'Birmingham', 'Shelby', '35242', '2057061002', 33.405422, -86.662945],
    ['New Life Pentecostal Church Pantry', '30 Persimmon Lane', 'Columbiana', 'Shelby', '35051', '2052962264', 33.1617303, -86.634731],
    ['Shelby Baptist Association Pantry', '205 Walton Street', 'Columbiana', 'Shelby', '35051', '2059109713', 33.1667937, -86.6324632],
    ["St. Catherine's Episcopal Church Pantry", "642 Kings' Home Dr", 'Chelsea', 'Shelby', '35043', '2055299438', 33.3274448, -86.6389115],
    ['The Episcopal Church of St. Francis of Assisi', '3545 Cahaba Valley Rd', 'Pelham', 'Shelby', '35214', '2056018131', 33.357844, -86.7410389],
    ['Our Light Ministry Pantry', '11692 N County Rd 41', 'Leeds', 'Shelby', '35094', '2053696634', 33.496288, -86.5445163],
    ['Mount Pleasant Baptist Church Pantry', '5320 Helena Road', 'Helena', 'Shelby', '35080', '2055159626', 33.3007808, -86.8418496],
    ['Manna Ministries Pantry', '333 Smokey Rd.', 'Alabaster', 'Shelby', '35007', '2538867797', 33.2011964, -86.8215809],
    ['Oak Mountain Missions Pantry', '2699 Pelham Parkway', 'Pelham', 'Shelby', '35124', '2055278192', 33.3141495, -86.7989271],
    ['Alabaster Church of God Pantry', '530 1st Ave W', 'Alabaster', 'Shelby', '35007', '2055889262', 33.244624, -86.8223266],
    ['Love in Action Pantry', '1026A Commerce Boulevard', 'Pelham', 'Shelby', '35124', '2054103014', 33.3363642, -86.790016],
    ['Westwood Baptist Church (Harvest House) Pantry', '1440 Simmsville Rd', 'Alabaster', 'Shelby', '35007', '2059089905', 33.2558174, -86.8008917],
    ['First Baptist Church Alabaster Pantry', '903 3rd Avenue NW', 'Alabaster', 'Shelby', '35007', '2056633531', 33.2467353, -86.8272112],
    ['Upper Room Church Pantry', '656 Co Rd 8', 'Montevallo', 'Shelby', '35115', '2054799535', 33.0765749, -86.87309],
    ['Ward Chapel AME Church Pantry', '765 West St', 'Montevallo', 'Shelby', '35115', '2052762735', 33.0994545, -86.8656207],
    ['Montevallo Falcon Food Pantry', '1031 Middle Street', 'Montevallo', 'Shelby', '35115', '2056656245', 33.102829, -86.8657471],
    ['Shelby Emergency Assistance Pantry', '160 Shoshone Drive', 'Montevallo', 'Shelby', '35115', '', 33.1073041, -86.8516762],
    ['Present-Truth Tabernacle Ministries Pantry', '350 Davis Hawkins St.', 'Montevallo', 'Shelby', '35115', '2057067685', 33.1110604, -86.8769808],

    // ── Etowah County (17) ──────────────────────────────────────────────
    ['White Springs Baptist Church Pantry', '4411 Rainbow Drive', 'Rainbow City', 'Etowah', '35906', '2563936345', 33.9382662, -86.0634971],
    ['Mt. Pisgah Baptist Church Pantry', '7400 Tabor Road', 'Gadsden', 'Etowah', '35904', '2565722791', 34.1222138, -85.9425588],
    ['Aurora Missionary Baptist Church Pantry', '5005 Hwy 179', 'Boaz', 'Etowah', '35956', '2054936198', 34.120348, -86.1920145],
    ['Etowah Baptist Association Pantry', '9462 Hwy 278 W.', 'Altoona', 'Etowah', '35952', '2565471691', 34.0564571, -86.2130656],
    ['First United Methodist Church Attalla Pantry', '601 4th St NW', 'Attalla', 'Etowah', '35954', '2563902287', 34.0235642, -86.0875494],
    ['Etowah Baptist Missions Center Pantry', '215 Wall Street', 'Gadsden', 'Etowah', '35904', '2565462980', 34.0209779, -86.0453209],
    ['Gadsden Christian Fellowship Pantry', '719 Nunnally Ave', 'Gadsden', 'Etowah', '35903', '2566133005', 33.969755, -85.962009],
    ['Salvation Army Gadsden Residential & Pantry', '114 N. 11th St', 'Gadsden', 'Etowah', '35901', '2565464673', 34.0186762, -86.0175563],
    ['Way of the Cross Soup Kitchen', '101 N. 24th St.', 'Gadsden', 'Etowah', '35904', '2563900134', 34.019774, -86.0397777],
    ['CSFP - Baptist Retirement', '1315 Coats St.', 'Gadsden', 'Etowah', '35903', '2564949400', 33.9973482, -85.9644495],
    ['First Church of the Nazarene Rainbow City Pantry', '3867 Rainbow Drive', 'Rainbow City', 'Etowah', '35906', '2563936055', 33.9498831, -86.0516482],
    ['Rainbow Church of Christ Pantry', '2201 Rainbow Dr', 'Gadsden', 'Etowah', '35901', '2563905592', 33.9722815, -86.0190632],
    ['North Glencoe Baptist Church Pantry & Backpack', '1119 Chastain Blvd', 'Gadsden', 'Etowah', '35905', '2564921910', 33.9704705, -85.9465184],
    ['First Baptist Church Gadsden Pantry', '235 South 5th Street', 'Gadsden', 'Etowah', '35901', '2565476828', 34.0117182, -86.0067357],
    ['Catholic Center of Concern Pantry', '612 Chestnut Street', 'Gadsden', 'Etowah', '35901', '2565460028', 34.0135864, -86.0074926],
    ['ROSS Gadsden Pantry & Soup Kitchen', '1024 1st Ave', 'Gadsden', 'Etowah', '35901', '2059200790', 34.0183608, -86.0163443],
    ["A Servant's Heart Mission Pantry", '11431 U.S. Hwy. 278 East', 'Piedmont', 'Etowah', '36272', '2564414780', 33.9677303, -85.76905],

    // ── Cherokee County (4) ─────────────────────────────────────────────
    ['Clearview Worship Center Pantry', '901 Cedar Bluff Rd', 'Centre', 'Cherokee', '35960', '2565575348', 34.1670527, -85.660255],
    ['CSFP - Cherokee Manor', '394 Northwood Dr', 'Centre', 'Cherokee', '35906', '2569274581', 34.161612, -85.6533714],
    ['Family Care Center Pantry', '1250 West Main Street', 'Centre', 'Cherokee', '35960', '2565572891', 34.1563895, -85.6957216],
    ['Cedar Bluff First United Methodist Church Pantry', '3600 Old Hwy 9', 'Cedar Bluff', 'Cherokee', '35959', '2562013704', 34.2206151, -85.6053639],

    // ── Talladega County (10) ───────────────────────────────────────────
    ['Lincoln Food Pantry', '225 Magnolia Street', 'Lincoln', 'Talladega', '35096', '2054738097', 33.6070224, -86.1187982],
    ['Chandler Springs Assembly Pantry', '1401 Horns Lake Rd', 'Talladega', 'Talladega', '35160', '8636771085', 33.3215827, -85.9988815],
    ['Red Door Kitchen Soup Kitchen', '500 South St W', 'Talladega', 'Talladega', '35160', '2564930203', 33.4312439, -86.1100391],
    ['Samaritan House Pantry', '806 N St. E', 'Talladega', 'Talladega', '35160', '2563687310', 33.4403761, -86.0854888],
    ['Sycamore House of Compassion Pantry & Soup Kitchen', '341 Thurman Road', 'Sylacauga', 'Talladega', '35149', '2562670831', 33.2589348, -86.2021009],
    ['Harper Springs Baptist Church Pantry', '525 Harper Springs Rd', 'Sylacauga', 'Talladega', '35150', '2563759141', 33.1676825, -86.3088676],
    ['First Baptist Church Childersburg Pantry', '200 8th Ave SW', 'Childersburg', 'Talladega', '35044', '2565891038', 33.2765791, -86.3541683],
    ['Alabama Childhood Food Solutions Pantry & Backpack', '114 Canyon Ridge Road', 'Sylacauga', 'Talladega', '35151', '2054512358', 33.1459562, -86.2638539],
    ["Saint Mary's Client Choice Senior Grocery Program", '2389 St Mary Rd.', 'Lincoln', 'Talladega', '35096', '', 33.624168, -86.063007],
    ['The Sanctuary Pantry', '46639 U.S. Hwy 280', 'Sylacauga', 'Talladega', '35150', '3135755828', 33.111626, -86.2335574],

    // ── Clay County (6) ─────────────────────────────────────────────────
    ['Ashland First Methodist Church - Clay Co. Food Bank Pantry', '192 2nd Avenue South', 'Ashland', 'Clay', '36251', '2562830757', 33.2728556, -85.833322],
    ['CSFP - Ashland Housing Authority', '128 1st St N', 'Ashland', 'Clay', '36251', '2563542661', 33.2759166, -85.8359712],
    ['First United Methodist Church Lineville', '60220 AL-49', 'Lineville', 'Clay', '36266', '2566841287', 33.3121204, -85.7540092],
    ['Lineville Baptist Church Pantry & Soup Kitchen', '60315 Hwy 49', 'Lineville', 'Clay', '36266', '2562827156', 33.3135405, -85.7547472],
    ['Lineville Mobile Pantry (Clay County Farmers Market)', '86838 AL-9', 'Lineville', 'Clay', '36266', '2566402433', 33.2917602, -85.7752779],
    ['Coosa Community Services Pantry & Soup Kitchen', '51 Wesobulga Street', 'Lineville', 'Clay', '36266', '2562764177', 33.3090209, -85.7537078],

    // ── Cleburne County (3) ─────────────────────────────────────────────
    ['HEARTS of Cleburne Pantry', '129 Almon Street', 'Heflin', 'Cleburne', '36264', '2569265544', 33.6492129, -85.5901055],
    ['Feeding Cleburne Pantry', '21393 Main Street', 'Ranburne', 'Cleburne', '36273', '7705509767', 33.5254526, -85.3424219],
    ['Vise Grove SDA Pantry', '303 County Road 116', 'Heflin', 'Cleburne', '36264', '6786739444', 33.5204664, -85.5393242],

    // ── Calhoun County (13) ─────────────────────────────────────────────
    ['All Saints Interfaith Center Pantry', '1513 Noble Street', 'Anniston', 'Calhoun', '36201', '2562367793', 33.66443, -85.8294654],
    ['Community Enabler Developer Pantry', '104 F Street', 'Anniston', 'Calhoun', '36201', '2562376144', 33.6406475, -85.8271547],
    ['Anniston Soup Bowl Soup Kitchen', '301 W 15th Street', 'Anniston', 'Calhoun', '36201', '2562366794', 33.6640021, -85.8344653],
    ['CSFP - Southern Ridge', '3000 Cresthill Avenue', 'Anniston', 'Calhoun', '36201', '2562360193', 33.6836, -85.8414253],
    ['Jesus is the Way, Truth, Life Pantry', '520 Golden Springs Road', 'Anniston', 'Calhoun', '36207', '2564529958', 33.6393297, -85.7870905],
    ['Walter Wellborn Elementary School Family Market', '525 Cooper Cir', 'Anniston', 'Calhoun', '36201', '2562946614', 33.6517251, -85.8795194],
    ['Mt. Liberty/Turning Point Missionary Baptist Pantry', '851 Morrisville Rd', 'Anniston', 'Calhoun', '36201', '2562838515', 33.6607853, -85.8785775],
    ['New Life Christian Cathedral, Inc. Residential & Soup Kitchen', '1800 Gurnee Avenue', 'Anniston', 'Calhoun', '36201', '2564735088', 33.6679788, -85.8319322],
    ['Salvation Army Anniston Pantry', '404 Noble Street', 'Anniston', 'Calhoun', '36201', '2562365643', 33.6496211, -85.8299513],
    ['Friendship Missionary Baptist Pantry', '1130 West 14th St', 'Anniston', 'Calhoun', '36201', '9194520870', 33.662139, -85.8451424],
    ['Piedmont Benevolence Center Pantry', '20222 AL Hwy 9', 'Piedmont', 'Calhoun', '36272', '2564472220', 33.9067797, -85.60863],
    ['Jacksonville Christian Outreach Center Pantry', '206 Francis Street West', 'Jacksonville', 'Calhoun', '36265', '2562828184', 33.8164003, -85.7628323],
    ['Cornerstone Church Pantry', '2885 Choccolocco Road', 'Anniston', 'Calhoun', '36207', '2563439577', 33.6508196, -85.7378348],

    // ── St. Clair County (9) ────────────────────────────────────────────
    ['Argo Community Food Bank Pantry', '100 Blackjack Road', 'Trussville', 'St. Clair', '35173', '2053522123', 33.6897651, -86.5107082],
    ['Ashville First Methodist Church Pantry', '292 7th Avenue', 'Ashville', 'St. Clair', '35953', '2055402011', 33.835479, -86.2527054],
    ['Steele United Methodist Church Pantry', '3375 Pope Ave', 'Steele', 'St. Clair', '35987', '2563902992', 33.9398201, -86.2016435],
    ['The Healing Place Pantry', '90 Sheffield Drive', 'Ashville', 'St. Clair', '35953', '2055153645', 33.8668927, -86.2886107],
    ['New Hope Baptist Pell City Pantry', '75 Cogswell Avenue', 'Pell City', 'St. Clair', '35125', '2052012751', 33.6288538, -86.2767995],
    ['Bethel Baptist Church Pantry', '8332 Moody Parkway', 'Odenville', 'St. Clair', '35120', '2052435424', 33.6236346, -86.4513646],
    ['Christian Love Pantry', '205 Edwin Holladay Place', 'Pell City', 'St. Clair', '35125', '2058847200', 33.5880177, -86.2870447],
    ["Shepherd's Supply, Inc. Pantry", '768 Kerr Road', 'Moody', 'St. Clair', '35004', '2054412340', 33.6075232, -86.4574144],
    ['Good Works', '200 Koa Road', 'Riverside', 'St. Clair', '35135', '2053698516', 33.5966599, -86.2296995],

    // ── Blount County (8) ───────────────────────────────────────────────
    ['First Baptist Church Hayden Pantry', '5080 State Hwy 160', 'Hayden', 'Blount', '35079', '2055274353', 33.8912219, -86.7559487],
    ['Red Hill Church of God Pantry', '3261 Shipp Rd', 'Hayden', 'Blount', '35079', '', 33.8624297, -86.9194853],
    ['Blountsville United Methodist Church Pantry', '85 Church Street', 'Blountsville', 'Blount', '35031', '2054293347', 34.0810079, -86.5902655],
    ['First Baptist Church of Remlap Mobile Pantry', '15487 Remlap Dr', 'Remlap', 'Blount', '35133', '2058070645', 33.7941505, -86.6170219],
    ['Faith Church of the Nazarene Pantry', '4820 Skyline Drive', 'Warrior', 'Blount', '35180', '2054714690', 33.8469511, -86.8303094],
    ['Hope House Pantry', '1000 Lincoln Avenue', 'Oneonta', 'Blount', '35121', '2056254673', 33.9572475, -86.4661219],
    ['Union Hill Baptist Church Pantry', '2919 County Hwy 39', 'Oneonta', 'Blount', '35121', '2052749232', 33.9981098, -86.4094976],
    ['Open Arms Fellowship Pantry', '18078 Co Hwy 26', 'Blountsville', 'Blount', '35031', '2566771475', 34.0584208, -86.4739498],

    // ── Jefferson County (119) ──────────────────────────────────────────
    ['Palmerdale Methodist Church Pantry', '7776 Highway 75', 'Pinson', 'Jefferson', '35126', '2056813940', 33.7304472, -86.6539997],
    ['Bethel United Methodist Church Pantry', '9417 Thermal Road', 'Warrior', 'Jefferson', '35180', '2052831383', 33.7946328, -86.7089546],
    ['Waterstone Church Pantry', '210 Brake Street S', 'Warrior', 'Jefferson', '35180', '2056477475', 33.8116153, -86.8072364],
    ['Cane Creek Missionary Baptist Pantry', '963 Warrior Jasper Road', 'Warrior', 'Jefferson', '35180', '2052381879', 33.8143112, -86.8477415],
    ['CSFP - East Lake House', '7901 1st Ave S', 'Birmingham', 'Jefferson', '35206', '2058331798', 33.5638089, -86.7237971],
    ['Adventist Community Services Pantry', '105 6th Avenue North', 'Birmingham', 'Jefferson', '35204', '2059034273', 33.512243, -86.8342835],
    ['Highlands United Methodist Church Soup Kitchen', '1045 20th Street South', 'Birmingham', 'Jefferson', '35205', '2059338751', 33.5014694, -86.7954712],
    ['Serving You Ministries, Inc. Pantry', '6523 1st Avenue N', 'Birmingham', 'Jefferson', '35206', '2059086216', 33.5493172, -86.7406286],
    ['I Care Christian Ministries Pantry', '2241 Forestdale Blvd', 'Forestdale', 'Jefferson', '35214', '2053353815', 33.5780237, -86.9141968],
    ['Family Worship Center Pantry', '8301 8th Ave S', 'Birmingham', 'Jefferson', '35206', '2056237289', 33.5647398, -86.7093028],
    ['True Vine Evangelical Pantry', '4030 40th Terrace North', 'Birmingham', 'Jefferson', '35217', '2058361512', 33.5624227, -86.7771731],
    ['The Church at Southside Soup Kitchen', '401 22nd St S', 'Birmingham', 'Jefferson', '35233', '2056133836', 33.5101483, -86.7987884],
    ['Life Changers Christian Church Pantry', '1529 Tomahawk Road', 'Forestdale', 'Jefferson', '35214', '2055661367', 33.5705045, -86.8909357],
    ['Tabernacle Baptist Church Pantry', '600 Center Street', 'Birmingham', 'Jefferson', '35204', '2052834822', 33.5130661, -86.8368767],
    ['New Beginnings United Methodist Church Pantry', '2133 32nd Ave. N', 'Birmingham', 'Jefferson', '35207', '', 33.5516618, -86.8247406],
    ['Thirgood Memorial CME Church', '517 Center Street North', 'Birmingham', 'Jefferson', '35204', '2059022994', 33.5122697, -86.8358468],
    ['Jesus Said Feed the Hungry Soup Kitchen', '1016 19th Street South', 'Birmingham', 'Jefferson', '35205', '2052007336', 33.500542, -86.7984156],
    ['East Lake United Methodist Church Pantry', '7753 1st Avenue South', 'Birmingham', 'Jefferson', '35206', '2053703193', 33.5614806, -86.7249762],
    ['Community Action Togetherness Service, Inc Pantry', '2617 Eastern Valley Road', 'Leeds', 'Jefferson', '35094', '2053838626', 33.498413, -86.603009],
    ['Freedom Rain, Inc. (Lovelady) Residential & Pantry', '7916 2nd Avenue South', 'Birmingham', 'Jefferson', '35206', '2056015034', 33.5640566, -86.7232469],
    ['Leeds Outreach Pantry', '1000 Park Drive', 'Leeds', 'Jefferson', '35094', '2056997291', 33.544922, -86.5640108],
    ['Leeds First Methodist Church Pantry', '1189 6th Street', 'Leeds', 'Jefferson', '35094', '2056998575', 33.5439856, -86.544669],
    ['Grace Episcopal Church Pantry', '5712 1st Avenue North', 'Birmingham', 'Jefferson', '35212', '2054589534', 33.5426916, -86.7502248],
    ['ROSS Birmingham Pantry & Soup Kitchen', '3608 7th Court S', 'Birmingham', 'Jefferson', '35222', '2059200790', 33.5169023, -86.7775759],
    ['Birmingham AIDS Outreach Pantry', '205 32nd Street South', 'Birmingham', 'Jefferson', '35233', '2053224197', 33.5185408, -86.7864497],
    ['Avondale Samaritan Place Pantry', '3829 5th Avenue South', 'Birmingham', 'Jefferson', '35222', '2059031187', 33.5204118, -86.7748737],
    ['CSFP - CJFS', '3794 Crosshaven Dr', 'Vestavia', 'Jefferson', '35223', '2058793438', 33.4674142, -86.7315816],
    ['LifeChurch Birmingham', '5567 Chalkville Rd', 'Birmingham', 'Jefferson', '35235', '2059865433', 33.6525248, -86.6382029],
    ['Church of the Highlands Dream Center Pantry', '5705 1st Ave N', 'Birmingham', 'Jefferson', '35212', '2055911700', 33.5416793, -86.7498487],
    ['Christian Service Mission Pantry', '3600 3rd Ave S', 'Birmingham', 'Jefferson', '35222', '2053979997', 33.5213085, -86.7801853],
    ['Holy Rosary Food Pantry', '7414 Georgia Rd', 'Birmingham', 'Jefferson', '35212', '2052663065', 33.5415291, -86.7272021],
    ['Meals on Wheels Pantry & Soup Kitchen', '3620 8th Ave South', 'Birmingham', 'Jefferson', '35232', '', 33.5161489, -86.7757105],
    ['Vestavia Hills Methodist Church Pantry', '2061 Kentucky Ave.', 'Vestavia Hills', 'Jefferson', '35216', '2054449793', 33.446599, -86.7868539],
    ['Revelation Knowledge Bible Church Pantry', '3314 Sweeney Hollow Rd', 'Birmingham', 'Jefferson', '35215', '2054150024', 33.6808222, -86.6776926],
    ['Jefferson State Pioneer Food Pantry', '2601 Carson Road', 'Birmingham', 'Jefferson', '35215', '2058567913', 33.6563999, -86.7076803],
    ['Community Care Development Network Pantry', '1920 Old Springville Road', 'Center Point', 'Jefferson', '35215', '2055860740', 33.6343735, -86.6626979],
    ['Kingdom Ministries Pantry', '2129 Center Point Parkway', 'Birmingham', 'Jefferson', '35235', '2054964150', 33.6417287, -86.6830311],
    ['NAME Ministries Inc Pantry & Soup Kitchen', '701 18th St', 'Ensley', 'Jefferson', '35218', '2057861642', 33.5123449, -86.8937325],
    ['Jesus is Lord Ministry Pantry', '1268 Maple St', 'Birmingham', 'Jefferson', '35217', '2057038388', 33.5779848, -86.7758174],
    ['YWCA/Interfaith Hospitality House Pantry', '5916 1st Avenue South', 'Birmingham', 'Jefferson', '35212', '2055914302', 33.5427514, -86.7475155],
    ['Groveland Baptist Church', '5437 5th Ave S', 'Birmingham', 'Jefferson', '35212', '2055293602', 33.5370868, -86.7521338],
    ['Word of Faith/Project Noah Pantry', '5326 South Oporto-Madrid Blvd', 'Birmingham', 'Jefferson', '35210', '2057207115', 33.5271114, -86.7237571],
    ['Woodlawn Community Table', '139 54th St N', 'Birmingham', 'Jefferson', '35212', '2055953776', 33.5402303, -86.7544626],
    ['Brother Bryan Mission Residential & Soup Kitchen', '1608 2nd Ave N', 'Birmingham', 'Jefferson', '35203', '6599104474', 33.5131486, -86.8116009],
    ['Southside Baptist Church Pantry', '1016 19th St S', 'Birmingham', 'Jefferson', '35205', '2059026523', 33.500542, -86.7984156],
    ['Crumly Chapel United Methodist Church Pantry', '341 Crumly Chapel Rd.', 'Birmingham', 'Jefferson', '35214', '2057034542', 33.5686078, -86.9166187],
    ['Disabled American Veterans Pantry', '238 2nd Avenue North', 'Birmingham', 'Jefferson', '35204', '2052024460', 33.5045668, -86.8304325],
    ['Joe Brooks Food Ministry Pantry', '300 4th Court North', 'Birmingham', 'Jefferson', '35204', '2058356400', 33.5091162, -86.8311094],
    ['Redeemed Christian Church of God Pantry', '213 1st Ave N', 'Birmingham', 'Jefferson', '35204', '2052403096', 33.5028703, -86.8307142],
    ['Calvary Resurrection Christian Pantry', '356 Killough Springs Road', 'Birmingham', 'Jefferson', '35215', '2058368022', 33.616156, -86.6998578],
    ['Huffman High School - School Pantry Program', '900 Springville RD', 'Birmingham', 'Jefferson', '35215', '', 33.6102309, -86.6830272],
    ['Faith Missionary Baptist Roebuck Pantry', '9841 Red Mill Road', 'Birmingham', 'Jefferson', '35215', '2054272886', 33.5973845, -86.7149003],
    ['Hope Community Outreach Pantry', '8713 Division Avenue', 'Birmingham', 'Jefferson', '35206', '2056022686', 33.5767359, -86.717033],
    ['Victorious Living Pantry', '8737 4th Avenue South', 'Birmingham', 'Jefferson', '35206', '2059191282', 33.5757756, -86.7106784],
    ['Connecting Pointe Pantry', '2305 Old Alton Rd', 'Irondale', 'Jefferson', '35210', '2055410661', 33.5681319, -86.6452568],
    ['South Highland Presbyterian Church Pantry', '2035 Highland Ave S', 'Birmingham', 'Jefferson', '35205', '2052409130', 33.4993942, -86.7943648],
    ['CSFP - Villa Maria', '500 82nd St S.', 'Birmingham', 'Jefferson', '35206', '2058382313', 33.5658135, -86.7162338],
    ['Smithfield Backpack Buddies Agency Backpack', '300 4th Court North', 'Birmingham', 'Jefferson', '35204', '2056022846', 33.5091162, -86.8311094],
    ['CSFP - Highland Manor', '2040 Highland Ave #1600', 'Birmingham', 'Jefferson', '35205', '', 33.5000951, -86.7943772],
    ['Paul Mitchell Ministries Pantry', '1425 Lomb Ave.', 'Birmingham', 'Jefferson', '35211', '2056126403', 33.5000929, -86.8610287],
    ['Fairfield First Seventh Day Adventist Church Pantry', '540 54th Street', 'Fairfield', 'Jefferson', '35064', '2054472254', 33.4843349, -86.9095283],
    ['Pleasant Hill United Methodist Church Pantry', '4809 Bell Hill Road', 'Bessemer', 'Jefferson', '35022', '2059109383', 33.3308003, -86.9975564],
    ['Twenty-Third Street Missionary Baptist Church Pantry', '331 S. 23rd Street', 'Birmingham', 'Jefferson', '35233', '2059142692', 33.5114092, -86.79767],
    ['The Ministry Center at Green Springs Pantry', '2230 Green Springs Highway', 'Birmingham', 'Jefferson', '35205', '2059798633', 33.4813189, -86.8244099],
    ['Emergency Food Boxes Food Bank', '107 Walter Davis Drive', 'Birmingham', 'Jefferson', '35209', '', 33.4745329, -86.8386833],
    ['Miracle Academy Pantry', '3420 Hickory Avenue SouthWest', 'Birmingham', 'Jefferson', '35221', '2059233483', 33.4565146, -86.8897097],
    ['The Grace Place Pantry', '1630 Powder Plant Road', 'Bessemer', 'Jefferson', '35022', '2055195402', 33.3494256, -87.0151875],
    ['Church of the Reconciler Pantry', '4601 Gary Avenue', 'Fairfield', 'Jefferson', '35064', '2088611205', 33.4911373, -86.914978],
    ['Greater 14th Baptist Senior Grocery Program', '418 14th Street S', 'Bessemer', 'Jefferson', '35020', '', 33.3920019, -86.9497312],
    ['Kikstart Incorporated Pantry', '1250 Powder Plant Rd', 'Bessemer', 'Jefferson', '35022', '6235707616', 33.3674581, -87.0121489],
    ['UAB Blazer Kitchen Pantry', '1613 11th Ave S', 'Birmingham', 'Jefferson', '35205', '2059341581', 33.4979016, -86.8015061],
    ['Titusville Development Corp Pantry', '401 Omega Street', 'Birmingham', 'Jefferson', '35205', '2059250958', 33.4972693, -86.8260123],
    ['The Community Kitchens of Birmingham Soup Kitchen', '1024 12th St S', 'Birmingham', 'Jefferson', '35205', '2052513569', 33.4955872, -86.8078857],
    ["St. Mark's Episcopal Church Pantry", '228 Dennison Ave SW', 'Birmingham', 'Jefferson', '35211', '2059197608', 33.4821896, -86.8376646],
    ["St. Andrew's Episcopal Church Pantry", '1024 12th Street South', 'Birmingham', 'Jefferson', '35205', '2056399652', 33.4955872, -86.8078857],
    ['Birmingham Hispanic SDA Church Pantry', '42 5th Ave S', 'Birmingham', 'Jefferson', '35205', '6012860221', 33.4946905, -86.83029],
    ['Full Deliverance Church of God Pantry', '1117 Rutledge Drive', 'Midfield', 'Jefferson', '35228', '2055679411', 33.4514905, -86.9348975],
    ['PATCH', '2440 Minor Pkwy', 'Adamsville', 'Jefferson', '35005', '2059879226', 33.5795692, -86.9329164],
    ['CSFP - Be The Change', '600 Main Street Suit 101', 'Gardendale', 'Jefferson', '35071', '2059665239', 33.6390028, -86.8097359],
    ['Fultondale Baptist Church Pantry', '1419 Stouts Rd', 'Fultondale', 'Jefferson', '35068', '2059105694', 33.607472, -86.797564],
    ['New Life SDA Church Pantry', '5626 Ash Street', 'Birmingham', 'Jefferson', '35207', '2057541823', 33.5795066, -86.8019499],
    ['Salvation Army City Command Pantry', '2015 26th Ave N', 'Birmingham', 'Jefferson', '35234', '2053282420', 33.5448755, -86.8238442],
    ['Greater Birmingham Ministries Pantry', '2304 12th Avenue North', 'Birmingham', 'Jefferson', '35234', '2053266821', 33.529416, -86.8098266],
    ['New Pilgrim Baptist Church Pantry', '708 Goldwire Place SW', 'Birmingham', 'Jefferson', '35211', '2053351626', 33.4876016, -86.8361974],
    ['Garywood Church Pantry', '2730 Allison-Bonnett Memorial Dr', 'Hueytown', 'Jefferson', '35023', '2055865321', 33.4557127, -86.9677273],
    ["Mt. Pilgrim People's Development Center Pantry", '6748 Grasselli Road', 'Fairfield', 'Jefferson', '35064', '2057805099', 33.4699986, -86.9249204],
    ['Triumph Youth & Adult Community Development Corporation Pantry', '1431 13th Ave N', 'Bessemer', 'Jefferson', '35020', '2052388590', 33.4047671, -86.9693198],
    ['Ministries of Deliverance Pantry', '2531 9th Avenue North', 'Bessemer', 'Jefferson', '35020', '2054258340', 33.41412, -86.9543985],
    ['Church of God of the Union Assembly Pantry', '1230 Simmons St', 'Bessemer', 'Jefferson', '35020', '2052812156', 33.4022516, -86.9706694],
    ['I.J. Community Development Pantry', '1027 11th Street North', 'Bessemer', 'Jefferson', '35020', '2052406872', 33.3990883, -86.9710042],
    ['New Life Interfaith Ministries, Inc Pantry', '1622 7th Avenue North', 'Bessemer', 'Jefferson', '35020', '2054254735', 33.4029358, -86.9606175],
    ['First Methodist Church Hueytown Pantry', '110 Sunset Drive', 'Hueytown', 'Jefferson', '35023', '2053054186', 33.4517756, -86.9975603],
    ['Greater Saint John Baptist Church Pantry', '2401 Carlos Ave. SW', 'Birmingham', 'Jefferson', '35211', '2057574767', 33.4646948, -86.8744041],
    ['Urban Ministry, Inc. Pantry', '1229 Cotton Ave', 'Birmingham', 'Jefferson', '35211', '', 33.4923227, -86.8519843],
    ['House of Love', '1001 35th St Ensley', 'Birmingham', 'Jefferson', '35218', '2059014717', 33.4967941, -86.902179],
    ['CSFP - Princeton Towers', '622-692 10th St. SW', 'Birmingham', 'Jefferson', '35211', '2057773833', 33.4971959, -86.8484074],
    ['CJ Donald Middle School - School Based Pantry', '715 Valley Rd', 'Fairfield', 'Jefferson', '35064', '', 33.490535, -86.9057792],
    ['Fairfield High Preparatory School - School Pantry Program', '610 Valley Rd', 'Fairfield', 'Jefferson', '35064', '', 33.4911852, -86.9083268],
    ["The Coleman's Redevelopment House Pantry", '901 17th Street Southwest', 'Birmingham', 'Jefferson', '35211', '2059666273', 33.4844932, -86.85997],
    ['CSFP - McMillon Estates', '1001 57th Street West', 'Birmingham', 'Jefferson', '35228', '', 33.4784022, -86.9015148],
    ['Sixth Ave Baptist Church Pantry & Backpack', '337 10th Ave SW', 'Birmingham', 'Jefferson', '35211', '7038509926', 33.4853336, -86.8390283],
    ['Green Valley Baptist Church Pantry & Backpack', '1815 Patton Chapel Road', 'Hoover', 'Jefferson', '35226', '2055858483', 33.3887516, -86.8165389],
    ['Adventist Community - South Park Pantry', '414 South Park Road', 'Birmingham', 'Jefferson', '35211', '2059030849', 33.4806465, -86.8746527],
    ['Trinity United Methodist Church Pantry & Backpack', '914 Oak Grove Road', 'Birmingham', 'Jefferson', '35209', '2058791737', 33.4543615, -86.8292507],
    ['The Leaf Pantry and Urban Farm', '910 9th Street', 'Midfield', 'Jefferson', '35228', '2059991854', 33.4526316, -86.9443639],
    ["James B and Vah's Emporium CDC, Inc Pantry", '3004 Westview Drive', 'Adamsville', 'Jefferson', '35005', '2052493851', 33.5925276, -86.9281315],
    ['North Jefferson Baptist Caring Center Pantry', '3396 Mt. Olive Road', 'Mt. Olive', 'Jefferson', '35117', '2056083112', 33.6888143, -86.8729346],
    ['Love Fellowship Christian Center', '1150 Hillcrest Road', 'Adamsville', 'Jefferson', '35005', '4043950137', 33.6008206, -86.9258268],
    ['Open Door Church Pantry', '1012 McDonald Chapel Road', 'Birmingham', 'Jefferson', '35224', '2055195474', 33.5394575, -86.9404425],
    ['Nurturing Golden Hearts Pantry', '113 Hueytown Plaza', 'Hueytown', 'Jefferson', '35023', '2059027910', 33.4474433, -86.9959848],
    ['First Seventh Day Adventist Adamsville Pantry', '4205 Main St', 'Adamsville', 'Jefferson', '35005', '2055026166', 33.5940552, -86.9462771],
    ['Gardendale First Baptist Church Pantry', '940 Main Street', 'Gardendale', 'Jefferson', '35071', '2055314008', 33.6492771, -86.8125532],
    ['The HUB Community Development Corporation, Inc. Pantry', '7555 Dickey Springs Road', 'Bessemer', 'Jefferson', '35022', '2052304290', 33.3325349, -86.9595863],
    ['Cahaba Medical Care Pantry', '7000 Grasselli Rd', 'Fairfield', 'Jefferson', '35064', '2056796325', 33.4679983, -86.9193683],
    ['Metro West Ministries Pantry', '4912 Lloyd Noland Parkway', 'Fairfield', 'Jefferson', '35064', '2054235757', 33.4898721, -86.9116818],
    ['Bluff Park United Methodist Church Pantry', '733 Valley Street', 'Hoover', 'Jefferson', '35226', '2058429902', 33.4171226, -86.8481484],
    ['CSFP - Project Hopewell', '4817 Jefferson Ave SW', 'Birmingham', 'Jefferson', '35221', '2052437070', 33.4461298, -86.9057153],
    ['United Community Center, Inc. Pantry', '3617 Hickory Ave SW', 'Birmingham', 'Jefferson', '35221', '2059252944', 33.4557979, -86.8926225],
    ['Homewood Church of Christ Pantry', '265 W Oxmoor Road', 'Birmingham', 'Jefferson', '35209', '2059425683', 33.4387837, -86.8403123],

    // ── Walker County (15) ──────────────────────────────────────────────
    ['Parrish First Baptist Church Pantry', '95 1st St', 'Parrish', 'Walker', '35580', '2053003101', 33.731645, -87.284576],
    ["Eagle's Rest Pantry", '10600 Main Street', 'Oakman', 'Walker', '35579', '2055222329', 33.7179345, -87.3859392],
    ['Walk of Faith Ministries Pantry', '2873 Prospect Road', 'Nauvoo', 'Walker', '35578', '2052759165', 33.9315999, -87.4413843],
    ['New Prospect Baptist Church Pantry', '770 Highway 5', 'Jasper', 'Walker', '35503', '2053871947', 33.8623894, -87.2971291],
    ['Mt. Vernon Baptist Church Pantry', '6450 Curry Highway', 'Jasper', 'Walker', '35503', '2055221188', 33.9571631, -87.2129936],
    ['Westside Baptist Church Pantry', '1101 West 22nd Street', 'Jasper', 'Walker', '35501', '2052215131', 33.8285849, -87.2886458],
    ["St. Mary's Episcopal Church Pantry", '801 The Trace W', 'Jasper', 'Walker', '35504', '2053877746', 33.8612672, -87.2863161],
    ["Christian's Place Mission Pantry", '130 Third Avenue', 'Nauvoo', 'Walker', '35578', '2055296123', 33.9907184, -87.4854948],
    ['Hope House Church Soup Kitchen', '1602 10th Ave', 'Jasper', 'Walker', '35501', '2052751253', 33.8358969, -87.2865953],
    ['Sumiton Church of God Pantry', '50 Hosanna Drive', 'Sumiton', 'Walker', '35148', '2054822728', 33.7470599, -87.0486852],
    ['Mission of Hope Pantry', '38 Cut N Curl Road', 'Dora', 'Walker', '35062', '2059993385', 33.7511589, -87.0817647],
    ['Backyard Blessings - Walker County Agency Backpack', '2221 Hwy 78', 'Dora', 'Walker', '35062', '2055449094', 33.7560425, -87.0645259],
    ['Argo First Baptist Church Pantry', '1705 Old Bankhead Hwy', 'Cordova', 'Walker', '35550', '2057067461', 33.799904, -87.1127997],
    ['Boldo Community Christian Church Pantry', '55 Gray Road', 'Jasper', 'Walker', '35504', '7138231312', 33.8551244, -87.1822886],
    ['Dilworth Church of God Pantry', '3688 Hull Road', 'Empire', 'Walker', '35063', '2056486327', 33.8006565, -87.0546114],

    // ── Winston County (4) ──────────────────────────────────────────────
    ['First Baptist Church Haleyville Pantry', '1117 20th St', 'Haleyville', 'Winston', '35565', '2054860961', 34.2264381, -87.6200551],
    ['Main Street Ministries Pantry', '991 Hwy 33', 'Double Springs', 'Winston', '35553', '2052721356', 34.1707533, -87.4027846],
    ['Community Bs Auxiliary Client Choice Senior Grocery Program', '29 Heck St', 'Lynn', 'Winston', '35575', '2058935250', 34.0521919, -87.5530414],
    ['Addison First Baptist Church Pantry', '115 2nd Street S', 'Addison', 'Winston', '35540', '2567476470', 34.1989523, -87.1750461],
];

async function run() {
    console.log(`Adding ${NEW_PANTRIES.length} CFBCA-region pantries to resources/\n`);
    let count = 0;
    for (const [name, street, city, county, zip, phone, lat, lng] of NEW_PANTRIES) {
        const geohash = encodeGeohash(lat, lng);
        await db.collection('resources').add({
            orgId: 'org_pantry_belt',
            name,
            locationType: 'stationary_pantry',
            status: 'active',
            county,
            coordinates: { lat, lng },
            geohash,
            address: { street, city, county, state: 'AL', zip },
            hours: 'Call for hours',
            phone: normalizePhone(phone),
            website: '',
            eligibilityNotes: 'Open to all',
            docsRequired: ['Call ahead'],
            serviceRadiusMiles: null,
            capacity: null,
            tags: [],
            verified: false,
            createdBy: 'ai_import_cfbca_2026-08-17',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        count++;
        if (count % 20 === 0 || count === NEW_PANTRIES.length) {
            console.log(`${count}/${NEW_PANTRIES.length} — [${county}] ${name}`);
        }
    }
    console.log(`\nDone. ${count} new CFBCA-region pantries added.`);
    process.exit(0);
}

run().catch(err => { console.error('Failed:', err); process.exit(1); });
