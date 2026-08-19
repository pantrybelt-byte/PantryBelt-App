/**
 * tools/addFTGCRegionPantries.js — Adds pantries from nine Feeding the Gulf
 * Coast (FTGC) county datasets (PDF exports, 2026-08-17) to the live
 * `resources` collection: Baldwin, Clarke, Choctaw, Conecuh, Covington,
 * Escambia, Mobile, Monroe, Washington. Uses the Admin SDK
 * (serviceAccountKey.json), so it bypasses Firestore rules entirely — run
 * with care.
 *
 * Coordinates come directly from the source dataset (no geocoding needed).
 *
 * Dedup performed before writing:
 *  - Mobile County's own PDF lists "Feeding The Gulf Coast-Pantry" (FTGC
 *    table) and "Feeding the Gulf Coast Food Bank" (CFBCA table) — both the
 *    same physical site at 5248 Mobile South Street, Theodore, and both
 *    already present in Firestore as `3rSkOnIZfAsGDAGIpeQ7`. Both dropped.
 *  - A handful of obvious source typos corrected before insert: an invalid
 *    "344" area code (Covington Baptist Association) fixed to 334; an
 *    invalid ZIP (Beulah Baptist Church, Opp) fixed from 36967 to 36467; a
 *    mistyped phone (Pensacola Caring Hearts Inc., Brewton) fixed from
 *    "8503-775-1838" to match its correct 850-375-1838 (confirmed against
 *    the identical, correctly-typed number on its sibling Evergreen
 *    location in the Conecuh dataset); two Clarke County rows whose source
 *    "County" column read the truncated/invalid value "Thomas" corrected to
 *    Clarke, matching the file they came from.
 *  - Same-name entries with genuinely different addresses/phones (e.g.
 *    "Empowerment Tabernacle Christian Center" in both Escambia and Monroe;
 *    "Pensacola Caring Hearts Inc." in both Escambia and Conecuh) were kept
 *    as distinct locations rather than dropped — different cities, ~30+
 *    miles apart, consistent with a multi-site ministry rather than a
 *    duplicate record.
 *  - Pre-existing Choctaw County resource ("Community Action Agency") does
 *    not match any row in this dataset by name/phone — left untouched, no
 *    overlap.
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
    // ── Baldwin County (19) ─────────────────────────────────────────────
    ['McGhee Memorial Church of God in Christ', '500 Martin Luther King Blvd', 'Bay Minette', 'Baldwin', '36507', '251-937-3600', 30.866691, -87.78322604],
    ['Morning Dove Baptist Church', '54681 Lottie Road', 'Perdido', 'Baldwin', '36562', '251-580-3674', 31.02245702, -87.62360501],
    ['Mt. Aid Missionary Baptist Church', '9470 US Hwy 90', 'Daphne', 'Baldwin', '36532', '251-626-0020', 30.67966055, -87.99662573],
    ['Community Action Agency of South Alabama', '26440 North Pollard Road', 'Daphne', 'Baldwin', '36526', '251-626-2646', 30.61040002, -87.88501],
    ['The Shoulder', '31214 Coleman Lane', 'Spanish Fort', 'Baldwin', '36577', '251-626-2199', 30.67962699, -87.834115],
    ['African Universal Church', '8355 Jonesboro Road', 'Daphne', 'Baldwin', '36526', '251-626-6056', 30.59780901, -87.87959496],
    ['Prodisee Pantry', '9315 Spanish Fort Boulevard', 'Spanish Fort', 'Baldwin', '36527', '251-626-1720', 30.67708799, -87.86375903],
    ['Turning Point Church', '32450 US Hwy-90', 'Seminole', 'Baldwin', '36574', '850-207-0765', 30.514618, -87.47292304],
    ['Greenwood Community Covenant Church', '21950 County Road 36', 'Summerdale', 'Baldwin', '36580', '251-989-6495', 30.50152802, -87.64924802],
    ['New Life in Christ Church', '102 East Berry Avenue', 'Foley', 'Baldwin', '36536', '251-943-2225', 30.41746499, -87.68231304],
    ['Christian Service Center', '317 Dolphin Avenue', 'Gulf Shores', 'Baldwin', '36547', '251-968-5256', 30.27318499, -87.68221598],
    ['Foley Hispanic Seventh Day Adventist Church', '817 North Cedar Street', 'Foley', 'Baldwin', '36535', '662-266-9370', 30.41384501, -87.69199296],
    ['Swift Presbyterian Church', '23208 Swift Church Road', 'Foley', 'Baldwin', '36535', '251-943-8367', 30.37518998, -87.62799202],
    ['St. Joseph Conference of Society of St. Vincent de Paul', '12688 Santa Piedro Road', 'Lillian', 'Baldwin', '36549', '251-473-3761', 30.410248, -87.44194998],
    ['Faith Factory', '17927 Samantha Drive', 'Foley', 'Baldwin', '36535', '251-401-5345', 30.40419401, -87.71846201],
    ['Miflin Baptist Church', '24687 County Road 20', 'Elberta', 'Baldwin', '36530', '251-238-7777', 30.37272101, -87.603742],
    ['South Baldwin Christian Church', '19489 Keller Road', 'Foley', 'Baldwin', '36535', '251-981-1000', 30.34137801, -87.69190403],
    ['Christian Life Church', '25550 Canal Road', 'Orange Beach', 'Baldwin', '36561', '251-967-4840', 30.28775998, -87.58921398],
    ['Shepherd of the Bay Lutheran Church', '12851 Perdido Street', 'Lillian', 'Baldwin', '36549', '251-962-7682', 30.41228401, -87.44791898],

    // ── Clarke County (6) ───────────────────────────────────────────────
    ['Labor of Love Association', '22 Church Street', 'Coffeeville', 'Clarke', '36524', '251-744-1520', 31.75579576, -88.08605876],
    ['Liberty Baptist Church', '7759 Old Hwy 5 South', 'Thomasville', 'Clarke', '36784', '', 31.81385445, -87.70031209],
    ['Catholic Social Services of Clarke County', '1206 College Ave.', 'Jackson', 'Clarke', '36545', '251-246-0131', 31.52374895, -87.89518738],
    ['First United Methodist Church', '146 College Ave', 'Jackson', 'Clarke', '36545', '251-246-2224', 31.51151399, -87.89304498],
    ['Thomasville Church of God in Christ', '1200 Church Drive', 'Thomasville', 'Clarke', '36784', '334-636-2728', 31.905538, -87.748244],
    ['The Open Door', '27915 Hwy 69 North', 'Coffeeville', 'Clarke', '36524', '251-843-5644', 31.82278155, -88.09955965],

    // ── Choctaw County (3) ──────────────────────────────────────────────
    ['F.A.I.T.H. Groceries', '817 West Pushmataha Street', 'Butler', 'Choctaw', '36904', '205-457-2637', 32.09005259, -88.22943812],
    ['Lusk Assembly of God', '655 Lusk Road', 'Gilbertown', 'Choctaw', '36908', '205-691-1019', 31.95900269, -88.28517929],
    ['Gilbertown Food Bank', '95 West Main Street', 'Gilbertown', 'Choctaw', '36908', '251-769-6425', 31.87696241, -88.32181992],

    // ── Conecuh County (3) ──────────────────────────────────────────────
    ['Belleville Missionary Baptist Church', '7841 County Road 15', 'Repton', 'Conecuh', '36575', '251-248-2495', 31.43492463, -87.10687103],
    ['Creation Science Evangelism Ministries', '488 Pearl Lane', 'Repton', 'Conecuh', '36474', '855-244-3644', 31.353674, -87.17787602],
    ['Pensacola Caring Hearts Inc. - Evergreen', '10930 Hwy 31 South', 'Evergreen', 'Conecuh', '36401', '850-375-1838', 31.40872402, -87.00027994],

    // ── Covington County (8) ────────────────────────────────────────────
    ['South Central Alabama Mental Health Board', '205 Academy Drive', 'Andalusia', 'Covington', '36420', '334-428-5050', 31.31121337, -86.44730156],
    ['Covington Baptist Association', '18350 U. S. Highway 84', 'Andalusia', 'Covington', '36421', '334-222-3009', 31.30900393, -86.40412672],
    ['Christ The King Parish', '508 Sanford Road', 'Andalusia', 'Covington', '36420', '334-222-4808', 31.31108922, -86.45725358],
    ['Northern Heights Baptist Church', '405 Pearl Drive', 'Opp', 'Covington', '36467', '334-493-6625', 31.28697078, -86.26426701],
    ['West County Line Baptist Church', '30380 County Line Loop', 'Opp', 'Covington', '36467', '334-764-6466', 31.28694268, -86.19810657],
    ['Opp Church of Christ', '901 East Hart Avenue', 'Opp', 'Covington', '36467', '334-493-3728', 31.28274799, -86.24133448],
    ['Beulah Baptist Church', '16612 Maggie Road', 'Opp', 'Covington', '36467', '334-493-0470', 31.22806127, -86.23178887],
    ['Meals of Love Opp', '205 East Covington Avenue', 'Opp', 'Covington', '36467', '', 31.28163099, -86.253507],

    // ── Escambia County (7) ─────────────────────────────────────────────
    ['Escambia County Community Enabled, Inc.', '114 Deer Street', 'Brewton', 'Escambia', '36426', '', 31.10473902, -87.07013898],
    ['Zion Star A.M.E. Zion Church', '127 Carvers Ave', 'Atmore', 'Escambia', '36502', '251-446-3598', 31.030191, -87.48650801],
    ['Empowerment Tabernacle Christian Center', '309 Peachtree Street', 'Atmore', 'Escambia', '36502', '251-253-9817', 31.03745999, -87.49175198],
    ['Pensacola Caring Hearts Inc.', '301 Liles Blvd', 'Brewton', 'Escambia', '36426', '850-375-1838', 31.12545625, -87.0632181],
    ['Spirit and Truth Tabernacle', '608 McCurdy St', 'Flomaton', 'Escambia', '36441', '251-296-5112', 31.00400307, -87.26005956],
    ['Grace Baptist Church', '714 Brandenburg Street', 'East Brewton', 'Escambia', '36426', '', 31.09288801, -87.05942498],
    ['Friendly Holiness Church', '3266 Atmosphere Road', 'Atmore', 'Escambia', '36502', '251-368-9229', 31.12113498, -87.522243],

    // ── Monroe County (8) ───────────────────────────────────────────────
    ['Empowerment Tabernacle Christian Center', '3823 Bowden St.', 'Frisco City', 'Monroe', '36445', '251-267-3822', 31.43599401, -87.39670899],
    ['Annunciation Catholic Church', '565 Whetstone Street', 'Monroeville', 'Monroe', '36460', '251-575-2644', 31.49949899, -87.32870502],
    ['Excel Assembly of God', '1014 Highway 136 West', 'Excel', 'Monroe', '36439', '251-765-2597', 31.459649, -87.34111904],
    ['Our Place Youth and Family Center', '271 Park Drive', 'Monroeville', 'Monroe', '36460', '251-575-7060', 31.51528279, -87.34376756],
    ['Camp Yahweh', '355 Wilcox Street', 'Monroeville', 'Monroe', '36460', '251-593-0054', 31.52149202, -87.31840299],
    ['Kingdom Works Inc.', '225 Legion Drive', 'Monroeville', 'Monroe', '36460', '251-244-0357', 31.52363937, -87.3355856],
    ['Jabezz Ministry', '4200 Bowden Street', 'Frisco City', 'Monroe', '36445', '251-267-3663', 31.42063186, -87.42021853],
    ["Uriah United Methodist Church - The Shepard's Pantry", '26 County Road 3', 'Uriah', 'Monroe', '36480', '717-486-7543', 31.30565391, -87.50217693],

    // ── Washington County (7) ───────────────────────────────────────────
    ['Lilly Grove Baptist Church', '98 Martin Luther King Avenue', 'Chatom', 'Washington', '36518', '251-847-3673', 31.4593925, -88.25760649],
    ['Tibbie Baptist Church', '160 Tibbie Church Road', 'Tibbie', 'Washington', '36583', '251-847-2889', 31.36540985, -88.25357571],
    ['Millry Baptist Church', '70 5th Avenue', 'Millry', 'Washington', '36558', '251-846-2263', 31.636186, -88.314317],
    ['Copeland Assembly of God', '468 Copeland-Buckatunna Road', 'Millry', 'Washington', '36558', '251-846-2638', 31.56064401, -88.42372003],
    ['Prestwick Community Outreach', '53 Train Track Road', 'Leroy', 'Washington', '36548', '251-246-3982', 31.45276748, -87.96693106],
    ['Washington Baptist Association', '14810 St. Stephens Avenue', 'Chatom', 'Washington', '36518', '251-847-2753', 31.45897779, -88.23164646],
    ['The Friends Center Inc.', '66 Academy Lane', 'McIntosh', 'Washington', '36553', '251-829-6507', 31.20334653, -88.05735991],

    // ── Mobile County (96 — "Feeding The Gulf Coast-Pantry" / "Feeding the
    //    Gulf Coast Food Bank" dropped as an existing-Firestore duplicate) ─
    ['Church of the Lord Jesus Christ Apostolic', '5443 McCrary Road', 'Semmes', 'Mobile', '36575', '251-689-8909', 30.80440101, -88.26049898],
    ['MOWA Band/Choctaw/Mobile', '1080 Red Fox Road West', 'Mt. Vernon', 'Mobile', '36560', '251-829-5500', 31.13983199, -88.06332301],
    ['Kushla Assembly of God', '6025 Hwy 45', 'Eight Mile', 'Mobile', '36613', '251-263-3392', 30.81598502, -88.15899585],
    ['Pine Grove Missionary Baptist Church', '19130 Pine Grove Church Road', 'Mt. Vernon', 'Mobile', '36560', '205-274-8346', 31.09048121, -87.99317379],
    ['Saint Vincent Society of Saint Thomas', '251 North Craft Highway', 'Chickasaw', 'Mobile', '36611', '251-458-4578', 30.76611201, -88.07563996],
    ['Saraland United Methodist Church', '415 McKeough Avenue', 'Saraland', 'Mobile', '36571', '251-675-2728', 30.80940899, -88.08239603],
    ['Bayou Sara Baptist Church', '12 Bayou Sara Avenue', 'Saraland', 'Mobile', '36571', '251-675-1770', 30.82667399, -88.06790699],
    ['Pure Word Deliverance House of Prayer', '2530 South Shelton Beach Road', 'Eight Mile', 'Mobile', '36613', '251-456-1234', 30.75616701, -88.14005296],
    ['Cedar Street Missionary Baptist Church', '541 Cedar Street', 'Saraland', 'Mobile', '36571', '251-675-0606', 30.83381902, -88.05860903],
    ['Home of Grace For Women, Inc', '394 Aldock Road', 'Eight Mile', 'Mobile', '36613', '251-456-7807', 30.768289, -88.10447799],
    ["St. Andrew's Chapel", '2354 Dead Lake Marina Road', 'Creola', 'Mobile', '36525', '251-490-1095', 30.90623044, -87.98022191],
    ['Outbreak Christian Ministries', '150 North Craft Hwy', 'Chickasaw', 'Mobile', '36611', '251-287-7059', 30.76305899, -88.07388697],
    ['High Praise Worship Church', '265 Thompson Blvd', 'Chickasaw', 'Mobile', '36611', '251-452-4996', 30.76308698, -88.08934203],
    ["Chickasaw United Methodist Church - Mike's Pantry", '108 Lee Street', 'Chickasaw', 'Mobile', '36611', '251-452-3461', 30.76381101, -88.08022101],
    ['Azalea City Church of Christ', '3550 Schillinger Road North', 'Semmes', 'Mobile', '36575', '251-649-2436', 30.76472301, -88.22464397],
    ['First Baptist Church of Satsuma', '5600 Old Highway 43', 'Satsuma', 'Mobile', '36572', '251-675-1280', 30.85516036, -88.05497245],
    ['One Meal Mobile', '1120 Joaneen Drive Suite D', 'Saraland', 'Mobile', '36571', '251-622-3460', 30.80573302, -88.10182101],
    ['Lott Road Church of God', '5301 Lott Road', 'Eight Mile', 'Mobile', '36613', '251-649-8991', 30.800798, -88.24172201],
    ['Citronelle United Methodist Church', '7970 Lebaron Avenue', 'Citronelle', 'Mobile', '36522', '251-866-7423', 31.095454, -88.23161704],
    ['The Lift Worldwide Corp', '19645 3rd North Street', 'Citronelle', 'Mobile', '36522', '601-508-8853', 31.11411501, -88.23512],
    ['Calvary Baptist Church', '21276 Highway 45', 'Citronelle', 'Mobile', '36522', '251-866-7501', 31.13483202, -88.25033601],
    ['Triumph Ministries, Inc.', '17980 Celeste Road', 'Citronelle', 'Mobile', '36522', '251-866-5530', 31.06624701, -88.23380497],
    ['House Of Rescue Church Ministries', '258-B Glenwood Street', 'Mobile', 'Mobile', '36606', '', 30.67763302, -88.09102897],
    ['Holy Name of Jesus', '2275 Snow Road N.', 'Semmes', 'Mobile', '36575', '251-649-4794', 30.736829, -88.27764701],
    ['New Generation Church', '1350 N Cody Rd.', 'Mobile', 'Mobile', '36608', '251-334-0898', 30.716279, -88.20731396],
    ['Freewater Missionary Baptist Church', '11470 Irvington Blvd Hwy', 'Irvington', 'Mobile', '36544', '251-824-2035', 30.452363, -88.24198403],
    ['Refuge Church of Mobile Alabama', '6159 Moffett Road', 'Mobile', 'Mobile', '36618', '251-649-3502', 30.74664601, -88.18609501],
    ['Nazaree Full Gospel Church', '1695 North Beltline Highway', 'Mobile', 'Mobile', '36618', '251-478-9948', 30.65544187, -88.12351451],
    ['Infinite Opportunities', '6389 Three Notch Road', 'Mobile', 'Mobile', '36619', '251-662-9812', 30.58854898, -88.19044798],
    ['Yorktown Missionary Baptist Church', '851 East Street', 'Plateau', 'Mobile', '36610', '251-452-8108', 30.73416971, -88.05869392],
    ['First Baptist Church of Baltimore Street', '1200 Baltimore Street', 'Mobile', 'Mobile', '36605', '251-433-8492', 30.66674698, -88.06522101],
    ['Mt. Olive A. M. E. Zion Church', '701 Bella Street', 'Prichard', 'Mobile', '36610', '251-456-2058', 30.73436026, -88.09071353],
    ['Mt. Hebron Missionary Baptist Church', '2531 Berkley Avenue', 'Mobile', 'Mobile', '36610', '251-457-9900', 30.73510501, -88.10998397],
    ['Bayou Recovery Project', '8720 Downey Street', 'Bayou La Batre', 'Mobile', '36509', '251-824-1550', 30.41204898, -88.24750502],
    ['Northside Bible Church', '2700 North University Blvd', 'Mobile', 'Mobile', '36618', '251-457-2464', 30.744559, -88.16003299],
    ['The Holy Church of God (Grand Bay)', '14400 Fort Lake Road', 'Grand Bay', 'Mobile', '36541', '251-865-2045', 30.54866029, -88.38428107],
    ['The Veterans Closet', '3224 St. Stephens Road', 'Prichard', 'Mobile', '36612', '888-213-8505', 30.74997199, -88.11432303],
    ['St. Vincent DePaul Conference of the St. Vincent De Paul Society', '6625 Three Notch Road', 'Mobile', 'Mobile', '36619', '251-223-7947', 30.58863502, -88.19621004],
    ['True Light Missionary Baptist Church', '2001 West Main Street', 'Prichard', 'Mobile', '36610', '251-456-3155', 30.74142002, -88.09691801],
    ['Catholic Social Services Service Center', '188 South Florida Street', 'Mobile', 'Mobile', '36606', '251-434-1550', 30.68117299, -88.10181899],
    ['St. Pius X Church', '217 South Sage Avenue', 'Mobile', 'Mobile', '36606', '251-471-2449', 30.67844799, -88.11387603],
    ['St. Andrew Episcopal Church', '1854 Staples Road', 'Mobile', 'Mobile', '36605', '251-479-0336', 30.58993698, -88.08618096],
    ['Gateway Community Outreach at Navco', '1719 Navco Road', 'Mobile', 'Mobile', '36605', '251-471-3552', 30.63086449, -88.1059694],
    ['Mt. Zion Baptist Church', '1012 Adams Street', 'Mobile', 'Mobile', '36603', '251-432-2997', 30.69481601, -88.06010997],
    ['New Birth Community Church', '1329 Forrest Ridge Road', 'Mobile', 'Mobile', '36618', '251-307-5628', 30.71764999, -88.169656],
    ['Redeemed Community Church', '6254 Howells Ferry Road', 'Mobile', 'Mobile', '36618', '251-639-1900', 30.72871699, -88.18834002],
    ['Mulherin Custodial Home', '2496 Halls Mill Road', 'Mobile', 'Mobile', '36606', '251-471-1998', 30.657934, -88.10027798],
    ['The Joseph Project', '126 Mobile Street', 'Mobile', 'Mobile', '36607', '251-478-6356', 30.69468001, -88.10351197],
    ['Truevine Missionary Baptist', '1850 Dr. Martin Luther King Ave.', 'Mobile', 'Mobile', '36617', '251-473-6906', 30.71104899, -88.076826],
    ['Samuel Chapel African Methodist Episcopal Church', '717 Prichard Avenue', 'Prichard', 'Mobile', '36610', '251-456-7588', 30.728459, -88.08831298],
    ['The New Pleasant View Baptist Church', '1517 Katye St.', 'Mobile', 'Mobile', '36617', '251-456-2374', 30.72320702, -88.11172397],
    ['St. Stephen African Methodist Episcopal Church', '2707 Josephine Street', 'Mobile', 'Mobile', '36607', '251-479-3053', 30.704781, -88.10326898],
    ['Holy Trinity Ministry Church of God in Christ', '1105 South Broad Street', 'Mobile', 'Mobile', '36603', '251-473-2779', 30.664233, -88.05603301],
    ['Central Presbyterian Church', '1260 Dauphin Street', 'Mobile', 'Mobile', '36604', '251-432-0591', 30.687869, -88.06532],
    ['Emmanuel Seventh-Day Adventist Church', '2000 Dr. Martin Luther King Jr. Ave', 'Mobile', 'Mobile', '36617', '251-479-1215', 30.71394799, -88.07851797],
    ['Church of Life, Inc.', '539 South Wilson Avenue', 'Prichard', 'Mobile', '36610', '251-457-4040', 30.728705, -88.08270599],
    ['Trinity Episcopal Church', '1900 Dauphin Street', 'Mobile', 'Mobile', '36606', '251-473-2779', 30.686761, -88.08614601],
    ['St. James Major Parish', '714 North College Street', 'Prichard', 'Mobile', '36610', '251-456-6842', 30.72781501, -88.09295102],
    ['Salvation Army', '1009 Dauphin Street', 'Mobile', 'Mobile', '36604', '251-438-1625', 30.68728399, -88.05858598],
    ['New Hope Outreach Ministries', '1007 Springhill Ave.', 'Mobile', 'Mobile', '36604', '251-442-7905', 30.69058, -88.05918201],
    ['Wings of Life', '800 St. Louis Street', 'Mobile', 'Mobile', '36602', '251-432-5245', 30.69085099, -88.05415396],
    ['State Street African Methodist Episcopal Zion Church', '502 State Street', 'Mobile', 'Mobile', '36603', '251-432-3965', 30.69385598, -88.05021304],
    ['Watchman International Ministries', '108 North Dearborn Street', 'Mobile', 'Mobile', '36602', '251-232-1574', 30.69132498, -88.05116103],
    ['St. Louis Missionary Baptist Church', '108 North Dearborn Street', 'Mobile', 'Mobile', '36602', '251-438-3823', 30.69132498, -88.05116103],
    ['Waterfront Rescue Mission', '279-A North Washington Ave.', 'Mobile', 'Mobile', '36603', '251-433-1847', 30.693277, -88.05360897],
    ['South Alabama Worship Center', '2811 Schillinger Road South', 'Semmes', 'Mobile', '36575', '251-721-8610', 30.74973801, -88.22612999],
    ["St. John's Deliverance Temple", '2621 Ralston Road', 'Mobile', 'Mobile', '36605', '251-479-2084', 30.68058399, -88.10234202],
    ['Providence Baptist Church', '2159 Dauphin Street', 'Mobile', 'Mobile', '36606', '251-802-8732', 30.68605599, -88.09267601],
    ['New Beginning Church of God', '3106 Moffett Road', 'Mobile', 'Mobile', '36607', '251-653-6606', 30.701725, -88.113828],
    ['Grace Temple Holiness Church', '159 Hemley Avenue', 'Mobile', 'Mobile', '36607', '251-478-9200', 30.69795302, -88.112261],
    ['Closing the Revolving Door', '117 Phillips Ave', 'Prichard', 'Mobile', '36610', '251-402-5965', 30.73196073, -88.07935977],
    ['Mt. Olive Missionary Baptist Church', '409 Lexington Ave', 'Mobile', 'Mobile', '36603', '251-438-3166', 30.70001999, -88.06902597],
    ['Greater Morning Star Baptist Church', '401 Donald Street', 'Mobile', 'Mobile', '36617', '251-479-7891', 30.70330901, -88.08132298],
    ['True Glory Church of the Lord Jesus Christ', '401 Whistler Street', 'Prichard', 'Mobile', '36610', '251-457-0900', 30.73980399, -88.08398096],
    ['First Baptist Church of Dawes', '3941 Dawes Road', 'Mobile', 'Mobile', '36695', '251-633-7331', 30.60853601, -88.25441297],
    ['Providence Hospital Outreach - Senior and Guadalupe Center', '1900 Cody Road', 'Mobile', 'Mobile', '36695', '251-544-4480', 30.651255, -88.20853697],
    ['Regency Church of Christ', '501 University Boulevard South', 'Mobile', 'Mobile', '36609', '251-345-8050', 30.66687099, -88.16985901],
    ['Providence Presbyterian Church', '2320 Schillinger Road South', 'Mobile', 'Mobile', '36695', '256-405-8697', 30.64288002, -88.225211],
    ['Overcoming Church of God Pentecostal, Inc.', '1306 Martin Luther King Jr Dr', 'Prichard', 'Mobile', '36610', '', 30.74698899, -88.07562303],
    ['Sweet Bethel Missionary Baptist Church', '8555 Sweet Bethel Drive West', 'Coden', 'Mobile', '36523', '251-824-4132', 30.38724217, -88.24610423],
    ['Kingswood United Methodist Church', '5200 Perin Road', 'Mobile', 'Mobile', '36693', '251-661-0420', 30.63373498, -88.16173401],
    ['Pleasant Grove Missionary Baptist', '132 North Hobbs Ave.', 'Prichard', 'Mobile', '36610', '251-456-6486', 30.74369901, -88.09106099],
    ['Greater Miracle Temple', '703 South Hobbs Ave.', 'Prichard', 'Mobile', '36610', '251-604-1057', 30.74001601, -88.09750801],
    ["First Baptist Tillman's Corner", '5660 Three Notch Road', 'Mobile', 'Mobile', '36619', '251-661-0114', 30.58964198, -88.17311798],
    ['Authentic Life Church', '3750 Michael Boulevard', 'Mobile', 'Mobile', '36609', '251-342-4886', 30.66505501, -88.14031196],
    ['Serenity Care, Inc.', '1951 Dawes Road', 'Mobile', 'Mobile', '36606', '205-255-3975', 30.65052402, -88.24602402],
    ['Hands Of Hope Ministry', '3750 Michael Blvd', 'Mobile', 'Mobile', '36609', '251-287-6146', 30.66505501, -88.14031196],
    ['St. Mark United Methodist Church Society of St. Stephen', '439 Azalea Road', 'Mobile', 'Mobile', '36609', '251-342-5861', 30.66640898, -88.15121296],
    ['AIDS Alabama South', '4321 Downtowner Blvd', 'Mobile', 'Mobile', '36609', '251-471-5277', 30.673876, -88.14200201],
    ['Little Sisters of the Poor', '1655 McGill Avenue', 'Mobile', 'Mobile', '36604', '251-476-6335', 30.683217, -88.07851697],
    ['Victory Health Partners, Inc.', '3750 Professional Parkway', 'Mobile', 'Mobile', '36609', '251-460-0999', 30.66690699, -88.14081496],
    ['Airport Boulevard Baptist Church', '6301 Airport Boulevard', 'Mobile', 'Mobile', '36608', '251-342-3280', 30.67626099, -88.18719002],
    ["A Servant's Love", '2200 Cody Road South', 'Mobile', 'Mobile', '36695', '251-895-6967', 30.64505101, -88.20960398],
    ['Calvary Assembly of God', '6800 Three Notch Road', 'Mobile', 'Mobile', '36619', '251-661-8130', 30.58963402, -88.19973203],
    ['The One 2eight Project', '6390 Old Shell Road', 'Mobile', 'Mobile', '36689', '', 30.69175401, -88.19028504],
    ['Tillmans Corner Senior Service Center', '5863 Nevius Road', 'Theodore', 'Mobile', '36619', '251-661-6600', 30.59604299, -88.17803304],
];

async function run() {
    console.log(`Adding ${NEW_PANTRIES.length} FTGC-region pantries to resources/\n`);
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
            createdBy: 'ai_import_ftgc_region_2026-08-17',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        count++;
        console.log(`${count}/${NEW_PANTRIES.length} — [${county}] ${name}`);
    }
    console.log(`\nDone. ${count} new FTGC-region pantries added.`);
    process.exit(0);
}

run().catch(err => { console.error('Failed:', err); process.exit(1); });
