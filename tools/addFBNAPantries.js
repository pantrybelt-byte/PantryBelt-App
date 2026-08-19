/**
 * tools/addFBNAPantries.js — Adds pantries from eleven Food Bank of North
 * Alabama (FBNA) county datasets (PDF exports, 2026-08-17) to the live
 * `resources` collection: Marshall, Franklin, Lauderdale, Colbert,
 * Lawrence, Morgan, Limestone, Madison, Jackson, DeKalb, Cullman. Uses the
 * Admin SDK (serviceAccountKey.json), so it bypasses Firestore rules
 * entirely — run with care.
 *
 * This source has no coordinates at all, so every address is geocoded via
 * the free US Census Bureau geocoder, falling back to the county-seat
 * center on a miss. It also has no phone numbers (only a staff contact
 * name, which isn't a public phone line) — phone is left blank for the
 * whole batch. Unlike prior batches, the source's "Hours" column is rich
 * (specific days/times, appointment/eligibility notes), so a short
 * extracted summary is stored in `hours` instead of the generic "Call for
 * hours" placeholder used elsewhere in this project.
 *
 * Two source-data fixes applied before writing:
 *  - "The Helping Hand" (Lawrence County.pdf) has its own County column
 *    reading "Madison", but its city (Town Creek) and its own hours text
 *    ("Serves Lawrence County residency") both say Lawrence — corrected.
 *  - "Good Shepherd UMC" (Limestone County.pdf) has its own County column
 *    reading "Madison" (city: Madison, AL) — filed under Madison, not
 *    Limestone, matching the row's own data over the file it appeared in.
 *  - "Hartselle-Decatur SDA Hispanic Church" (Morgan County.pdf) appears
 *    twice back-to-back, same name/address/contact, just two different
 *    hours notes — written once.
 *
 * No existing Firestore resources were found in any of these 11 counties
 * before this import.
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

const COUNTY_FALLBACK = {
    Marshall:   { lat: 34.3581, lng: -86.2947 }, // Guntersville
    Franklin:   { lat: 34.5081, lng: -87.7286 }, // Russellville
    Lauderdale: { lat: 34.7998, lng: -87.6773 }, // Florence
    Colbert:    { lat: 34.7365, lng: -87.7025 }, // Tuscumbia
    Lawrence:   { lat: 34.4759, lng: -87.2870 }, // Moulton
    Morgan:     { lat: 34.6059, lng: -86.9833 }, // Decatur
    Limestone:  { lat: 34.8029, lng: -86.9722 }, // Athens
    Madison:    { lat: 34.7304, lng: -86.5861 }, // Huntsville
    Jackson:    { lat: 34.6725, lng: -86.0347 }, // Scottsboro
    DeKalb:     { lat: 34.4448, lng: -85.7197 }, // Fort Payne
    Cullman:    { lat: 34.1748, lng: -86.8434 }, // Cullman
};

async function geocode(address, county) {
    const encoded = encodeURIComponent(address);
    const url = `https://geocoding.geo.census.gov/geocoder/locations/onelineaddress?address=${encoded}&benchmark=Public_AR_Current&format=json`;
    const res = await fetch(url);
    const data = await res.json();
    const match = data.result?.addressMatches?.[0];
    if (match) {
        return { lat: match.coordinates.y, lng: match.coordinates.x };
    }
    console.warn(`   ⚠️  No Census geocode match for "${address}" — falling back to ${county} county seat`);
    return COUNTY_FALLBACK[county];
}

// name, street, city, county, zip, hours
const NEW_PANTRIES = [
    // ── Marshall County (9) ─────────────────────────────────────────────
    ['Arab Christian Center', '9105 Ala. Hwy. 69', 'Arab', 'Marshall', '35016', 'Third Sunday, 6pm-7pm'],
    ['St. Vincent De Paul', '929 Gunter Ave.', 'Guntersville', 'Marshall', '35976', 'Tuesdays 4:30-5:30pm'],
    ['Church of God of Union Assembly', '1 Chloris Street', 'Albertville', 'Marshall', '35950', 'Drive-thru Thursdays 5:30-6:30pm'],
    ['Christ Episcopal', '607 East Main Street', 'Albertville', 'Marshall', '35950', '3rd Saturdays 9-11am'],
    ['Marshall County Christian Services', '217 South Cahill Road', 'Albertville', 'Marshall', '35950', 'Wed & Fri 10:30am-2pm'],
    ['Marshall County Hope Center', '1910 Gunter Ave.', 'Guntersville', 'Marshall', '35976', 'Drive-thru 1st & 3rd Saturday 10:30-11:30am'],
    ['Julia Street Congregational Methodist', '302 Thomas Ave.', 'Boaz', 'Marshall', '35957', '3rd Saturday 8-10am'],
    ['New Life Church', '515 2nd Avenue NW', 'Arab', 'Marshall', '35016', 'Sun 10-10:30am, Tue 11am-1pm, Wed 6-6:30pm, Sat 9am-noon'],
    ['Life Point Church', '700 Motley St.', 'Albertville', 'Marshall', '35950', 'Mondays 11am, by appointment'],

    // ── Franklin County (5) ─────────────────────────────────────────────
    ['Russellville Dream Center', '206 Coffee Ave.', 'Russellville', 'Franklin', '35653', 'Tue & Thu 2-3pm'],
    ['Russellville First Methodist', '311 North Jackson Ave', 'Russellville', 'Franklin', '35653', '5th Thursday of month, 1pm'],
    ['The Meal Barrel Project, Vina', '91 Church Street', 'Vina', 'Franklin', '35593', '4th Mondays 6-8pm'],
    ['Faith Mission Outreach', '109 Marion Street', 'Russellville', 'Franklin', '35653', 'Thursdays (except 5th) 1-4pm'],
    ['North Highlands Church of Christ', '2101 North Jackson Avenue', 'Russellville', 'Franklin', '35653', '3rd Saturday 9-10am'],

    // ── Lauderdale County (12) ──────────────────────────────────────────
    ['Underwood Baptist Church', '5091 Hwy. 157', 'Florence', 'Lauderdale', '35633', '3rd Tues of month, 1-2pm'],
    ['Woodmont Baptist Church', '2001 Darby Drive', 'Florence', 'Lauderdale', '35630', 'Every other month, Thu 8:15-9am, by appointment'],
    ['Word Fellowship', '101 CR 426', 'Killen', 'Lauderdale', '35645', '3rd Thursday, 8-11am & 12-3pm'],
    ['Shoals Dream Center', '2950 Cloverdale Road', 'Florence', 'Lauderdale', '35633', 'By appointment, M-F 8am-3pm'],
    ['Salem Church of Christ', '9671 Highway 17', 'Florence', 'Lauderdale', '35634', 'By appointment only'],
    ['Salvation Army- Florence', '1601 Huntsville Road', 'Florence', 'Lauderdale', '35630', 'Food boxes Mon-Thu 9am-4:30pm'],
    ['The Help Center', '621 S. Court St.', 'Florence', 'Lauderdale', '35630', 'M/W/F 8:30am-noon, 3rd Sat 8:30-10am'],
    ['Center Star Methodist Church', '6293 Hwy. 72', 'Killen', 'Lauderdale', '35645', '4th Thursday 10am-noon'],
    ['Crossroads Community Outreach', '220 West Tn Street', 'Florence', 'Lauderdale', '35630', 'M-F 9am-noon, by appointment'],
    ['Fish & Loaves Food Pantry', '510 Lee St.', 'Rogersville', 'Lauderdale', '35652', '2nd Sat 9-11am'],
    ['Killen United Methodist Church', '201 J. C. Mauldin Hwy', 'Killen', 'Lauderdale', '35645', '3rd Saturday 7:30-8:30am'],
    ['North Wood United Methodist Ch.', '1129 Wills Ave.', 'Florence', 'Lauderdale', '35630', 'Fridays, by appointment only'],

    // ── Colbert County (6) ──────────────────────────────────────────────
    ['The Meal Barrel Project', '267 Claude Posey Road', 'Cherokee', 'Colbert', '35616', 'Weekly, Wednesdays 6pm'],
    ['Cowboy Church of Colbert County', '3440 Hwy 157', 'Leighton', 'Colbert', '35646', '3rd Saturday 11am-1pm'],
    ['The Chapel', '600 Columbia Avenue', 'Sheffield', 'Colbert', '35660', 'Soup kitchen Wed 6:30pm, Sun 9:30am'],
    ['Colbert Caring Center', '102 N. Water Street', 'Tuscumbia', 'Colbert', '35674', 'Tue-Thu 9am-2:30pm'],
    ['First Presbyterian Church Sheffield', '130 East 5th Street', 'Sheffield', 'Colbert', '35660', '3rd Tuesday 1-2pm'],
    ['Highland Park Church of Christ', '600 Geneva Avenue', 'Muscle Shoals', 'Colbert', '35661', '1st/3rd Tuesdays 9-11am'],

    // ── Lawrence County (8) — county fix noted above (row 1) ────────────
    ['The Helping Hand', '23271 Ala. Hwy. 157', 'Town Creek', 'Lawrence', '35672', '2nd & 4th Thursdays 8am-4pm'],
    ['The Good Samaritan', '144 Medical Circle', 'Moulton', 'Lawrence', '35650', 'Wednesdays 9am-noon'],
    ['Moulton Dream Center', '14055 Al Hwy 157', 'Moulton', 'Lawrence', '35650', 'Tue 10am-1pm, Sat 9am-noon'],
    ['Oak Grove FCM Church', '284 Co. Rd. 356', 'Trinity', 'Lawrence', '35673', '1st Saturday 8am'],
    ['Living Way Apostolic Church', '4430 Alabama Hwy 20', 'Town Creek', 'Lawrence', '35672', '1st week of month, call ahead'],
    ['Foster Outreach Ministries', '407 Tennessee St', 'Courtland', 'Lawrence', '35618', 'Saturday 10am-2pm'],
    ['Lawrence County Dream Center', '1167 County Road 265', 'Town Creek', 'Lawrence', '35672', '2nd Saturday 11am-1pm'],
    ['Mt. Hope Baptist Church', '7771 County Road 23', 'Mt. Hope', 'Lawrence', '35651', '2nd Saturday 8-10am'],

    // ── Morgan County (15 — duplicate row removed, see header) ──────────
    ['Trinity Baptist Church', '1281 Old Hwy 24', 'Trinity', 'Morgan', '35673', '2nd Monday 4-5:30pm'],
    ['Annunciation of the Lord Catholic Church', '3910 Spring Avenue SW', 'Decatur', 'Morgan', '35603', 'Thursdays 10-11am'],
    ['Decatur SDA Church', '540 Beltline Road', 'Decatur', 'Morgan', '35601', '1st & 3rd Sunday 10:30-11:30am'],
    ['South Decatur Church of God', '3103 Spring Avenue SW', 'Decatur', 'Morgan', '35603', 'Tuesday 9am-noon'],
    ["Share House", '643 Farm Supply Road', "Lacey's Spring", 'Morgan', '35754', 'Mon & Wed 9-11am'],
    ["St. John's Episcopal Church", '202 Gordon Drive SE', 'Decatur', 'Morgan', '35601', '4th Thursday 9:30-11am'],
    ['Salvation Army - Decatur', '114 14th St.', 'Decatur', 'Morgan', '35601', 'Mon & Thu 9am-noon'],
    ['St. Andrew Church of Grace', '109 Memorial Drive NW', 'Decatur', 'Morgan', '35601', 'Sundays from 12:30pm'],
    ['Committee on Church Cooperation', '119 1st Ave NE', 'Decatur', 'Morgan', '35601', 'Mon-Thu 8:30-11am & 1-3:30pm'],
    ['Calvary Assembly of God - Decatur Dream Center', '312 8th Street SW', 'Decatur', 'Morgan', '35601', '3rd Saturday 10-11:30am'],
    ['Central Baptist Church', '2801 Highway 31 South', 'Decatur', 'Morgan', '35603', '2nd Saturday 8:30-11:30am'],
    ['Life Source', '1577 Highway 36 East', 'Hartselle', 'Morgan', '35640', 'Call or text for food boxes'],
    ['Hartselle-Decatur SDA Hispanic Church', '1708 Vest Road', 'Hartselle', 'Morgan', '35640', '2nd Wed of month, 6-7pm'],
    ['Hartselle Church Of The Nazarene', '739 W Main St.', 'Hartselle', 'Morgan', '35640', 'Every Monday 9:30am-noon'],
    ['Good Samaritan Food Pantry (Hartselle)', '209 Hickory Street SE', 'Hartselle', 'Morgan', '35640', 'Tuesdays 9am-2pm'],

    // ── Limestone County (10 — "Good Shepherd UMC" moved to Madison) ────
    ['Athens SDA Church', '1207 Pryor Street East', 'Athens', 'Limestone', '35611', 'Call for access'],
    ['Trinity SDA Church', '823 Brownsferry St.', 'Athens', 'Limestone', '35611', '3rd Thursday 11am-12:30pm'],
    ['Belmor Baptist Church', '5895 Mooresville Rd.', 'Mooresville', 'Limestone', '35649', '1st Monday 9-11am'],
    ['Christians Helping Others', '26469 1st Street', 'Ardmore', 'Limestone', '35739', '1st-4th Tuesday 9am-noon'],
    ['Ebenezer Missionary Baptist Church', '1911 Hine Street', 'Athens', 'Limestone', '35611', '3rd Saturday 10am-noon'],
    ['Macedonia Primitive Baptist Church', '13376 Dupree', 'Worthy Harvest', 'Limestone', '35749', '1st Saturday 8-10am'],
    ['Little Ezekiel MB Church', '16439 Lindsey Rd.', 'Tanner', 'Limestone', '35671', '2nd Thursday 10am-noon'],
    ['Limestone County Churches Involved', '201 North Jefferson St', 'Athens', 'Limestone', '35611', 'Mon-Fri 9-11am'],
    ['First Church- Athens', '17175 Lucas Ferry Rd.', 'Athens', 'Limestone', '35611', 'Last Saturday 10-11am'],
    ['Full Gospel Tabernacle', '17470 Seven Mile Post Road', 'Athens', 'Limestone', '35611', '1st & 3rd Wed 3-5pm'],

    // ── Madison County (54 — includes "Good Shepherd UMC" from Limestone) ─
    ['Wears Chapel Baptist Church', '938 Ryland Pike', 'Huntsville', 'Madison', '35811', '2nd Saturday 10am-noon'],
    ['Asbury Church', '980 Hughes Rd.', 'Madison', 'Madison', '35758', 'By appointment, call ahead'],
    ['Women of Excellence Fellowship', '5074 Meridian St N', 'Huntsville', 'Madison', '35810', 'Appointment required, 1 week notice'],
    ['Victory World Outreach', '4901 N. Memorial Parkway', 'Huntsville', 'Madison', '35810', '3rd Thursday 3-5pm'],
    ['St. Luke Christian Church', '1800 Sparkman Drive', 'Huntsville', 'Madison', '35816', 'Thu & Fri 10am-2pm'],
    ['Triana SDA Church', '252 Advent Dr.', 'Madison', 'Madison', '35656', 'Mon-Wed 9:30am-2pm'],
    ['Abundant Life Food Pantry', '3637 Winchester Road NE', 'New Market', 'Madison', '35761', '3rd Sunday noon-2pm'],
    ['Downtown Rescue Mission', '1400 Evangel Drive', 'Huntsville', 'Madison', '35816', '1st Sunday 1-3pm'],
    ['Fellowship of Faith', '3703 Memorial Parkway NW', 'Huntsville', 'Madison', '35810', 'Tue/Fri/Sat 6am-6pm'],
    ['Redemption Church - The Blessings Closet', '9512 US Hwy 431 S', 'Owens Cross Roads', 'Madison', '35763', '1st & 3rd Mon/Tue 11am-2:30pm'],
    ['RCCG Jesus House', '4906 Blue Spring Road', 'Huntsville', 'Madison', '35810', '2nd Saturday 9am-noon, by appointment'],
    ['Progressive Union Missionary Baptist Church', '1919 Brandontown Road', 'Huntsville', 'Madison', '35816', '2nd Sat of month, noon-2pm'],
    ['Patricia Haley Charity', '3322 South Memorial Parkway', 'Huntsville', 'Madison', '35804', 'Cancer patients only, call to schedule'],
    ['St. Joseph Catholic Church- St. Vincent dePaul', '2300 Beasley Avenue', 'Huntsville', 'Madison', '35816', 'Call Wednesdays 9am'],
    ['St. John the Baptist Catholic Church- St. Vincent dePaul', '1055 Hughes Road', 'Madison', 'Madison', '35758', 'Call Tuesdays 8:30-10:30am'],
    ['Rose of Sharon', '723 Arcadia Cir NW', 'Huntsville', 'Madison', '35810', 'Food box by appt or hot meals Tue-Fri 9am-1pm'],
    ['St. Paul United Methodist Church', '3250 Dunn Drive', 'Huntsville', 'Madison', '35805', 'Wed & Fri 9-11:30am'],
    ['The Harbour', '172 Commissioner Drive', 'Meridianville', 'Madison', '35759', "Client Choice, Tue 4:30-6:30pm"],
    ['Bethlehem Baptist Church', '1936 Elkwood Section Rd', 'Hazel Green', 'Madison', '35750', 'By appointment, call ext 222'],
    ['Faith Chapel', '3913 Pulaski Pike NW', 'Huntsville', 'Madison', '35810', '2nd Saturday 8:30-10:30am'],
    ['Morris Chapel', '2135 Winchester Road NW', 'Huntsville', 'Madison', '35810', '4th Saturday 11am until gone'],
    ['Metropolitan Community Worship Center', '1116 Church St.', 'Huntsville', 'Madison', '35801', '1st & 3rd Sunday by appointment'],
    ['Little Indian Creek Primitive Baptist Church', '884 Indian Creek Road NW', 'Huntsville', 'Madison', '35806', '3rd Saturday 10am-3pm'],
    ['House of Harvest', '9144 Wall Triana Hwy', 'Harvest', 'Madison', '35749', 'Saturday mornings 7:30-9am'],
    ['Lincoln Church of Christ', '1307 Meridian st.', 'Huntsville', 'Madison', '35801', 'Mon & Thu 9-11am'],
    ['Madison Mission SDA Church', '183 Shelton Rd.', 'Madison', 'Madison', '35758', 'As-needed, call church'],
    ['Manna House', '2110 Memorial Pkwy. SW', 'Huntsville', 'Madison', '35801', 'Mon/Wed/Thu 3-6pm'],
    ['Little Flock Primitive Baptist Church', '599 Brock Road', 'Gurley', 'Madison', '35748', '2nd Saturday, drive-thru 10am-noon'],
    ['Mt. Calvary SDA', '1100 Meadow Drive', 'Huntsville', 'Madison', '35816', '1st & 3rd Sunday noon-2pm'],
    ['Oakley Baptist Church', '540 Oakley Chapel Road', 'New Market', 'Madison', '35761', '3rd Saturday 9am-noon'],
    ['Oakwood Community Health Action Center', '1863 Sparkman Dr.', 'Huntsville', 'Madison', '35816', 'Thursdays 11am-2pm'],
    ['New Life SDA Church', '3912 Pulaski Pike', 'Huntsville', 'Madison', '35810', 'Wed 1-3pm'],
    ['Huntsville Assistance Program (HAP)', '1001 Monroe St. SW', 'Huntsville', 'Madison', '35801', 'Mon/Wed/Fri 1-3pm'],
    ['Harvest SDA', '348 Lockhart Road', 'Harvest', 'Madison', '35749', 'Drive-thru 2nd Sunday noon-2:30pm'],
    ['First Church of God in Christ', '3804 Oakwood Ave.', 'Huntsville', 'Madison', '35810', '1st Thursday 10am until distributed'],
    ['First Baptist Church, Madison', '4257 Sullivan St.', 'Madison', 'Madison', '35758', 'Call M-F 9am-2pm'],
    ['Fountain of Life Community Development', '4015 Triana Blvd', 'Huntsville', 'Madison', '35805', '1st & 3rd Sat 9am-1pm'],
    ['Owens Chapel Missionary Baptist Church', '2520 Elton Road', 'Huntsville', 'Madison', '35810', '1st & 3rd Wed 10am-2pm'],
    ['Huntsville Assistance Program (HAP) - Madison', '103 Gin Oak Court', 'Madison', 'Madison', '35758', 'Tue & Thu 1-3pm'],
    ['Huntsville Assistance Program (HAP)- Toney', '11588 Pulaski Pike', 'Toney', 'Madison', '35773', 'Wed & Fri 12:30-2:30pm'],
    ['Life Family Worship Center', '2112 Winchester Road', 'Huntsville', 'Madison', '35810', 'Sun noon-12:30pm, 4th Wed 4:30-6:30pm'],
    ['Life Church Huntsville', '2300 S. Memorial Parkway SW', 'Huntsville', 'Madison', '35801', '3rd Saturday 7-8am'],
    ['Journey Church', '9640 Meridian St. N', 'Huntsville', 'Madison', '35810', 'Wed 1-3pm'],
    ['Hurricane Valley Assembly Church', '2671 Hurricane Road', 'New Market', 'Madison', '35671', 'Call to be added to distribution list'],
    ['One In Christ Ministries', '2131 Hwy 72 E', 'Huntsville', 'Madison', '35810', '4th Saturday 10am'],
    ['Mt. Pisgah SDA', '111 Church Street', 'Gurley', 'Madison', '35748', '2nd Wed 4-5pm'],
    ['New Market U.M.C.', '310 Hurricane Rd.', 'New Market', 'Madison', '35761', 'Tue & Fri 1-3pm'],
    ['New Flower', '3156 University Drive', 'Huntsville', 'Madison', '35773', 'Thu noon-2pm'],
    ['Huntsville Central SDA Church (new)', '403 Treymore Avenue NW', 'Huntsville', 'Madison', '35811', '4th Wed 5-8pm'],
    ['Oasis Christian Center', '12737 Highway 231 North', 'Hazel Green', 'Madison', '35750', '2nd/4th Sat 5-7am; 1st/3rd Thu noon-3pm'],
    ['FBNA Market', '2000 B Vernon Avenue', 'Huntsville', 'Madison', '35805', 'Fri 10am-1pm'],
    ['New Vision Apostolic Ch.', '920 Weatherly Road', 'Huntsville', 'Madison', '35803', '1st Sunday noon-1pm, call ahead'],
    ["Heaven's Storehouse at Oakwood University Church", '5500 Adventist Blvd', 'Huntsville', 'Madison', '35896', 'Wed 11am-noon'],
    ['Good Shepherd UMC', '1418 Old Railroad Bed Road', 'Madison', 'Madison', '35757', 'Tue/Wed/Thu 9am-2pm'],

    // ── Jackson County (12) ─────────────────────────────────────────────
    ['The Well Family Worship Center', '3513 S. Broad St.', 'Scottsboro', 'Jackson', '35769', 'Thursdays 5:30-7:30pm'],
    ["St. Luke's Episcopal Church", '402 Scott St.', 'Scottsboro', 'Jackson', '35768', '1st Saturday 8:30-10am'],
    ['Salvation Army-Scottsboro', '1501 E. Willow St', 'Scottsboro', 'Jackson', '35768', 'Mon, Wed-Fri 9am-2pm'],
    ['Rosalie Baptist Ch.', '15049 Ala. Hwy. 71', 'Pisgah', 'Jackson', '35765', '2nd Wed 10am-noon'],
    ['Roaches Cove Baptist', '1000 County Road 55', 'Fackler', 'Jackson', '35746', '1st Saturday 9-11am'],
    ['Pleasant View Baptist Church', '1825 County Road 378', 'Dutton', 'Jackson', '35744', '3rd Saturday 9-11am'],
    ['Macklin Baptist Church', '16846 AL 71', 'Pisgah', 'Jackson', '35765', 'By appointment, Mon-Fri'],
    ['Living Word Ministries', '9545 Alabama Hwy. 79', 'Scottsboro', 'Jackson', '35768', 'Two Tuesdays/month, 8:30-11am, call first'],
    ['First UMC Scottsboro', '1105 South Broad Street', 'Scottsboro', 'Jackson', '35768', 'Mon-Thu 9-5, Fri 9-2'],
    ['Paint Rock Missionary Baptist', '2911 Hwy 72', 'Paint Rock', 'Jackson', '35764', '3rd Wed 3-5pm'],
    ['Flat Rock Community Center', '894 County Road 326', 'Flat Rock', 'Jackson', '35966', '4th Thu 10am-2pm, appointment required'],
    ["Jacob's Well Ministry", '311 County Road 25', 'Scottsboro', 'Jackson', '35768', '3rd Saturdays 9am-2pm'],

    // ── DeKalb County (6) ───────────────────────────────────────────────
    ['Upper Sand Mountain Parish', '24474 Alabama Hwy. 75', 'Sylvania', 'DeKalb', '35988', 'Mon-Thu 9-11am'],
    ['St. Joseph on the Mountain', '21145 Scenic Drive', 'Mentone', 'DeKalb', '35984', 'Wednesday 9-10:30am'],
    ['Bread of Life', '100 Alabama Avenue NW', 'Fort Payne', 'DeKalb', '35967', 'Tue/Thu/Sat 11:30am-1pm'],
    ['Henagar Baptist Church', '10240 HWY 40', 'Henagar', 'DeKalb', '35978', 'Drive-thru 3rd Saturday 7:30-9am'],
    ['First Methodist Church-Ft Payne', '206 Grand Ave.', 'Ft. Payne', 'DeKalb', '35967', 'Wednesdays 1-3pm'],
    ['Our Lady of the Valley Catholic Church', '2910 Gault Ave. N', 'Fort Payne', 'DeKalb', '35967', 'Wednesdays 9:30am-12:30pm'],

    // ── Cullman County (15) ─────────────────────────────────────────────
    ['Unsheltered International', '479 County Road 827', 'Cullman', 'Cullman', '35057', 'Mon & Thu 9am-noon'],
    ['Cullman Caring For Kids', '402 Arnold Street NE', 'Cullman', 'Cullman', '35056', 'Mon-Thu 9-noon & 1-3pm'],
    ['Spirit Life Church of God', '1650 St. Joseph Drive NW', 'Cullman', 'Cullman', '35055', 'Drive-thru 3rd Saturday 9-11am'],
    ['Sacred Heart Conference -SVDP Cullman', '201 3rd Avenue SE', 'Cullman', 'Cullman', '35055', 'Mon/Wed/Fri 9-11:45am'],
    ['Parkside Outreach Program', '12756 AL Hwy. 69', 'Baileyton', 'Cullman', '35019', 'M-F 9-5, Sat 9-noon'],
    ['The Crossing', '1503 2nd Street SW', 'Cullman', 'Cullman', '35055', 'Tue/Thu 9am-noon & 1-3:30pm'],
    ['Eidson Chapel', '2680 CR 1725', 'Holly Pond', 'Cullman', '35083', '4th Saturday 10am-noon'],
    ["The Link / Master's Hands Food Pantry", '708 9th St SE', 'Cullman', 'Cullman', '35055', 'Tue/Thu 9am-3:30pm'],
    ['Northside Baptist Church', '1310 Katherine St NW', 'Cullman', 'Cullman', '35055', '2nd Tuesday 2-4pm'],
    ['Hillside Baptist Church', '23564 US Hwy 31', 'Falkville', 'Cullman', '35622', '3rd Wed 3-5pm'],
    ["Hamby's Chapel United Methodist", '8063 County Road 1435', 'Vinemont', 'Cullman', '35179', '3rd Saturday 8:30-10am'],
    ['Hanceville First UMC', '704 Commercial St.', 'Hanceville', 'Cullman', '35077', '2nd Saturday 8-9am'],
    ['Garden City Church Of God', '134 Short St.', 'Garden City', 'Cullman', '35070', '4th Saturday 7-10am'],
    ['Mt. Zion Methodist Church', '17478 US 31 N.', 'Cullman', 'Cullman', '35058', '2nd & 4th Monday 11am-noon'],
    ['Northbrook Baptist Church (The Caring Center)', '1629 Second Ave. NW', 'Cullman', 'Cullman', '35055', 'Tue 9-11:30am, Thu 5:30-7pm'],
];

async function run() {
    console.log(`Adding ${NEW_PANTRIES.length} FBNA-region pantries to resources/\n`);
    let count = 0;
    for (const [name, street, city, county, zip, hours] of NEW_PANTRIES) {
        const coords = await geocode(`${street}, ${city}, AL ${zip}`, county);
        const geohash = encodeGeohash(coords.lat, coords.lng);
        await db.collection('resources').add({
            orgId: 'org_pantry_belt',
            name,
            locationType: 'stationary_pantry',
            status: 'active',
            county,
            coordinates: coords,
            geohash,
            address: { street, city, county, state: 'AL', zip },
            hours,
            phone: '',
            website: '',
            eligibilityNotes: 'Open to all',
            docsRequired: ['Call ahead'],
            serviceRadiusMiles: null,
            capacity: null,
            tags: [],
            verified: false,
            createdBy: 'ai_import_fbna_2026-08-17',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        count++;
        if (count % 15 === 0 || count === NEW_PANTRIES.length) {
            console.log(`${count}/${NEW_PANTRIES.length} — [${county}] ${name}`);
        }
    }
    console.log(`\nDone. ${count} new FBNA-region pantries added.`);
    process.exit(0);
}

run().catch(err => { console.error('Failed:', err); process.exit(1); });
