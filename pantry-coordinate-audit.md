# Pantry Coordinate Audit Report — v2

**Audit Date:** 2026-09-25

**Scope:** Full audit of 122 pantries: 60 duplicate-cluster pantries (Phase 1) +
29 random-jitter pantries (from `spreadMontgomeryPantries.js`) +
81 truncated-decimal pantries, all deduped to 122 unique entries.

**Geocoder chain:** Google Geocoding API (ROOFTOP/RANGE_INTERPOLATED only) →
US Census Bureau geocoder → OpenStreetMap Nominatim.

## Summary

| Status | Count | Meaning |
| :--- | :---: | :--- |
| ✅ **OK** | 11 | Verified coordinate within 50 m of stored — accurate |
| 🟡 **CHECK** | 2 | 50–200 m discrepancy — minor parcel/campus drift |
| 🔴 **WRONG** | 51 | >200 m and ≤20 km discrepancy — likely geocoding fallback error |
| ⚪ **MANUAL** | 58 | Needs hand-verification (missing address, county mismatch, >20 km shift, or city-level only) |
| **TOTAL** | **122** | |

## Audit Findings Table (Worst First)

| Status | Pantry Name | County | Address | Stored (Lat, Lng) | Verified (Lat, Lng) | Discrepancy | Source | Loc Type | Stored Pin | Verified Pin |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 🔴 **WRONG** | Belmor Baptist Church | Limestone | 5895 Mooresville Rd., Mooresville, AL, 35649 | `34.80290, -86.97220` | `34.64050, -86.88035` | 19,914 m | google | ROOFTOP | [📍](https://www.google.com/maps?q=34.8029,-86.9722) | [📍](https://www.google.com/maps?q=34.640501,-86.880345) |
| 🔴 **WRONG** | Shiloh Baptist Church | Geneva | 873 Shiloh Road, Hartford, AL, 36344 | `31.03960, -85.85580` | `31.11487, -85.67041` | 19,539 m | google | ROOFTOP | [📍](https://www.google.com/maps?q=31.0396,-85.8558) | [📍](https://www.google.com/maps?q=31.114871,-85.670408) |
| 🔴 **WRONG** | St. Joseph on the Mountain | DeKalb | 21145 Scenic Drive, Mentone, AL, 35984 | `34.44480, -85.71970` | `34.57917, -85.59007` | 19,088 m | google | RANGE_INTERPOLATED | [📍](https://www.google.com/maps?q=34.4448,-85.7197) | [📍](https://www.google.com/maps?q=34.579174,-85.590067) |
| 🔴 **WRONG** | Cowboy Church of Colbert County | Colbert | 3440 Hwy 157, Leighton, AL, 35646 | `34.73650, -87.70250` | `34.65934, -87.54403` | 16,837 m | google | ROOFTOP | [📍](https://www.google.com/maps?q=34.7365,-87.7025) | [📍](https://www.google.com/maps?q=34.659338,-87.544032) |
| 🔴 **WRONG** | Bakerhill Community Outreach | Barbour | Bakerhill, AL, Bakerhill, AL | `31.93600, -85.26960` | `31.79329, -85.26618` | 15,872 m | nominatim | RANGE_INTERPOLATED | [📍](https://www.google.com/maps?q=31.936,-85.2696) | [📍](https://www.google.com/maps?q=31.793288,-85.266178) |
| 🔴 **WRONG** | Church of God of Union Assembly | Marshall | 1 Chloris Street, Albertville, AL, 35950 | `34.35810, -86.29470` | `34.25720, -86.18317` | 15,193 m | google | ROOFTOP | [📍](https://www.google.com/maps?q=34.3581,-86.2947) | [📍](https://www.google.com/maps?q=34.257201,-86.183166) |
| 🔴 **WRONG** | Pleasant View Baptist Church | Jackson | 1825 County Road 378, Dutton, AL, 35744 | `34.67250, -86.03470` | `34.65751, -85.87207` | 14,966 m | google | RANGE_INTERPOLATED | [📍](https://www.google.com/maps?q=34.6725,-86.0347) | [📍](https://www.google.com/maps?q=34.657515,-85.872073) |
| 🔴 **WRONG** | Open Door Tabernacle | Russell | 2089 Lee Rd 42, Opelika, AL, Opelika, AL | `32.64530, -85.37830` | `32.51270, -85.36678` | 14,783 m | google | ROOFTOP | [📍](https://www.google.com/maps?q=32.6453,-85.3783) | [📍](https://www.google.com/maps?q=32.512704,-85.366776) |
| 🔴 **WRONG** | Forgiven Ministries | Barbour | Eufaula, AL, Eufaula, AL | `31.89130, -85.14550` | `31.98605, -85.07911` | 12,258 m | nominatim | RANGE_INTERPOLATED | [📍](https://www.google.com/maps?q=31.8913,-85.1455) | [📍](https://www.google.com/maps?q=31.986052,-85.079113) |
| 🔴 **WRONG** | White Oak UMC | Barbour | Eufaula, AL, Eufaula, AL | `31.89130, -85.14550` | `31.98605, -85.07911` | 12,258 m | nominatim | RANGE_INTERPOLATED | [📍](https://www.google.com/maps?q=31.8913,-85.1455) | [📍](https://www.google.com/maps?q=31.986052,-85.079113) |
| 🔴 **WRONG** | Eufaula Church of God In Christ | Barbour | Eufaula, AL, Eufaula, AL | `31.89130, -85.14550` | `31.98605, -85.07911` | 12,258 m | nominatim | RANGE_INTERPOLATED | [📍](https://www.google.com/maps?q=31.8913,-85.1455) | [📍](https://www.google.com/maps?q=31.986052,-85.079113) |
| 🔴 **WRONG** | Coffee County Community Church | Coffee | 130 Vester Cole, New Brockton, AL, 36351 | `31.32380, -85.85520` | `31.38629, -85.93125` | 10,022 m | google | ROOFTOP | [📍](https://www.google.com/maps?q=31.3238,-85.8552) | [📍](https://www.google.com/maps?q=31.386289,-85.931254) |
| 🔴 **WRONG** | Potter's House Baptist | Russell | 124 Highway 165, Phenix City, AL, Phenix City, AL | `32.46980, -85.00070` | `32.40460, -85.03567` | 7,958 m | google | ROOFTOP | [📍](https://www.google.com/maps?q=32.4698,-85.0007) | [📍](https://www.google.com/maps?q=32.404598,-85.035671) |
| 🔴 **WRONG** | Living Word Ministries | Jackson | 9545 Alabama Hwy. 79, Scottsboro, AL, 35768 | `34.67250, -86.03470` | `34.63724, -86.10921` | 7,862 m | google | ROOFTOP | [📍](https://www.google.com/maps?q=34.6725,-86.0347) | [📍](https://www.google.com/maps?q=34.637239,-86.109207) |
| 🔴 **WRONG** | First Missionary Baptist | Bullock | Union Springs, AL, Union Springs, AL | `32.14430, -85.71520` | `32.08852, -85.76272` | 7,649 m | nominatim | RANGE_INTERPOLATED | [📍](https://www.google.com/maps?q=32.1443,-85.7152) | [📍](https://www.google.com/maps?q=32.088515,-85.762719) |
| 🔴 **WRONG** | Bullock County Food Pantry | Bullock | Union Springs, AL, Union Springs, AL | `32.14430, -85.71520` | `32.08852, -85.76272` | 7,649 m | nominatim | RANGE_INTERPOLATED | [📍](https://www.google.com/maps?q=32.1443,-85.7152) | [📍](https://www.google.com/maps?q=32.088515,-85.762719) |
| 🔴 **WRONG** | Lee-Russell Council of Governments | Lee | 2207 Gateway Drive, Opelika, AL, 36801 | `32.60990, -85.48080` | `32.62550, -85.40363` | 7,432 m | google | ROOFTOP | [📍](https://www.google.com/maps?q=32.6099,-85.4808) | [📍](https://www.google.com/maps?q=32.625504,-85.403635) |
| 🔴 **WRONG** | Heaven's Storehouse at Oakwood University Church | Madison | 5500 Adventist Blvd, Huntsville, AL, 35896 | `34.73040, -86.58610` | `34.75301, -86.65127` | 6,464 m | google | ROOFTOP | [📍](https://www.google.com/maps?q=34.7304,-86.5861) | [📍](https://www.google.com/maps?q=34.753006,-86.651274) |
| 🔴 **WRONG** | Greene County Food Bank | Greene | Eutaw, AL, Eutaw, AL | `32.84740, -87.90200` | `32.88072, -87.85203` | 5,959 m | google | ROOFTOP | [📍](https://www.google.com/maps?q=32.8474,-87.902) | [📍](https://www.google.com/maps?q=32.880722,-87.852031) |
| 🔴 **WRONG** | Selma Area Food Bank (Hub) | Dallas | 101 Craig Industrial Park, Selma, AL, Selma, AL | `32.40730, -87.02110` | `32.36175, -86.98807` | 5,939 m | google | ROOFTOP | [📍](https://www.google.com/maps?q=32.4073,-87.0211) | [📍](https://www.google.com/maps?q=32.361752,-86.988067) |
| 🔴 **WRONG** | Wedowee Lighthouse Community Kitchen | Randolph | 17 2nd Street West, Wedowee, AL, 36278 | `33.27040, -85.45270` | `33.30997, -85.48719` | 5,444 m | google | ROOFTOP | [📍](https://www.google.com/maps?q=33.2704,-85.4527) | [📍](https://www.google.com/maps?q=33.309968,-85.487189) |
| 🔴 **WRONG** | Decatur SDA Church | Morgan | 540 Beltline Road, Decatur, AL, 35601 | `34.60590, -86.98330` | `34.56046, -86.99396` | 5,146 m | google | ROOFTOP | [📍](https://www.google.com/maps?q=34.6059,-86.9833) | [📍](https://www.google.com/maps?q=34.560461,-86.993957) |
| 🔴 **WRONG** | Wilcox County Food Bank | Wilcox | Camden, AL, Camden, AL | `31.99290, -87.29130` | `32.01374, -87.33989` | 5,135 m | google | ROOFTOP | [📍](https://www.google.com/maps?q=31.9929,-87.2913) | [📍](https://www.google.com/maps?q=32.013742,-87.339895) |
| 🔴 **WRONG** | Downtown Rescue Mission | Madison | 1400 Evangel Drive, Huntsville, AL, 35816 | `34.73040, -86.58610` | `34.73686, -86.64146` | 5,109 m | nominatim | RANGE_INTERPOLATED | [📍](https://www.google.com/maps?q=34.7304,-86.5861) | [📍](https://www.google.com/maps?q=34.736864,-86.641456) |
| 🔴 **WRONG** | River of Life Worship Center | Tallapoosa | 1715 Tallapoosa Street, Alexander City, AL, 35010 | `32.90980, -85.93190` | `32.95367, -85.93408` | 4,883 m | google | ROOFTOP | [📍](https://www.google.com/maps?q=32.9098,-85.9319) | [📍](https://www.google.com/maps?q=32.953675,-85.934085) |
| 🔴 **WRONG** | Food Bank of East Alabama | Lee | 375 Industry Drive, Auburn, AL, Auburn, AL | `32.60990, -85.48080` | `32.59831, -85.52836` | 4,638 m | google | ROOFTOP | [📍](https://www.google.com/maps?q=32.6099,-85.4808) | [📍](https://www.google.com/maps?q=32.598308,-85.528362) |
| 🔴 **WRONG** | Selma AIR | Dallas | 102 Central Park Place, Selma, AL | `32.40740, -87.02110` | `32.42679, -87.05489` | 3,835 m | google | ROOFTOP | [📍](https://www.google.com/maps?q=32.4074,-87.0211) | [📍](https://www.google.com/maps?q=32.426787,-87.054887) |
| 🔴 **WRONG** | Patricia Haley Charity | Madison | 3322 South Memorial Parkway, Huntsville, AL, 35804 | `34.73040, -86.58610` | `34.69743, -86.58458` | 3,669 m | google | RANGE_INTERPOLATED | [📍](https://www.google.com/maps?q=34.7304,-86.5861) | [📍](https://www.google.com/maps?q=34.697428,-86.584583) |
| 🔴 **WRONG** | Daleville Heights COC | Dale | 660 Willow Oaks Drive, Ozark, AL, 36360 | `31.45740, -85.64970` | `31.42605, -85.65548` | 3,529 m | google | ROOFTOP | [📍](https://www.google.com/maps?q=31.4574,-85.6497) | [📍](https://www.google.com/maps?q=31.426047,-85.655477) |
| 🔴 **WRONG** | FMC Food Bank | Barbour | Clayton, AL, Clayton, AL | `31.87790, -85.45020` | `31.88305, -85.48409` | 3,251 m | nominatim | RANGE_INTERPOLATED | [📍](https://www.google.com/maps?q=31.8779,-85.4502) | [📍](https://www.google.com/maps?q=31.883054,-85.484089) |
| 🔴 **WRONG** | Ridgecrest Baptist Church | Dale | 1971 Deese Road, Ozark, AL, 36360 | `31.45740, -85.64970` | `31.43713, -85.66108` | 2,500 m | google | ROOFTOP | [📍](https://www.google.com/maps?q=31.4574,-85.6497) | [📍](https://www.google.com/maps?q=31.437125,-85.661085) |
| 🔴 **WRONG** | Northbrook Baptist Church (The Caring Center) | Cullman | 1629 Second Ave. NW, Cullman, AL, 35055 | `34.17480, -86.84340` | `34.19389, -86.85478` | 2,367 m | google | ROOFTOP | [📍](https://www.google.com/maps?q=34.1748,-86.8434) | [📍](https://www.google.com/maps?q=34.193895,-86.854781) |
| 🔴 **WRONG** | Venison Provisions | Macon | 1884 County Rd 6, Shorter, AL, Shorter, AL | `32.39570, -85.90940` | `32.37465, -85.90969` | 2,341 m | google | ROOFTOP | [📍](https://www.google.com/maps?q=32.3957,-85.9094) | [📍](https://www.google.com/maps?q=32.374651,-85.909695) |
| 🔴 **WRONG** | Butler County DHR | Butler | Greenville, AL, Greenville, AL | `31.82680, -86.62130` | `31.84571, -86.61053` | 2,336 m | nominatim | RANGE_INTERPOLATED | [📍](https://www.google.com/maps?q=31.8268,-86.6213) | [📍](https://www.google.com/maps?q=31.845708,-86.610529) |
| 🔴 **WRONG** | Cahaba Medical Care Foundation | Perry | 1303 Washington Street, Marion, AL | `32.63680, -87.31950` | `32.61868, -87.31798` | 2,020 m | google | ROOFTOP | [📍](https://www.google.com/maps?q=32.6368,-87.3195) | [📍](https://www.google.com/maps?q=32.618682,-87.317983) |
| 🔴 **WRONG** | Metropolitan Community Worship Center | Madison | 1116 Church St., Huntsville, AL, 35801 | `34.73040, -86.58610` | `34.74604, -86.59630` | 1,973 m | google | ROOFTOP | [📍](https://www.google.com/maps?q=34.7304,-86.5861) | [📍](https://www.google.com/maps?q=34.74604,-86.596297) |
| 🔴 **WRONG** | Life Church Huntsville | Madison | 2300 S. Memorial Parkway SW, Huntsville, AL, 35801 | `34.73040, -86.58610` | `34.71670, -86.59345` | 1,665 m | google | ROOFTOP | [📍](https://www.google.com/maps?q=34.7304,-86.5861) | [📍](https://www.google.com/maps?q=34.716699,-86.593448) |
| 🔴 **WRONG** | Manna House | Madison | 2110 Memorial Pkwy. SW, Huntsville, AL, 35801 | `34.73040, -86.58610` | `34.71794, -86.59381` | 1,555 m | google | ROOFTOP | [📍](https://www.google.com/maps?q=34.7304,-86.5861) | [📍](https://www.google.com/maps?q=34.717939,-86.593812) |
| 🔴 **WRONG** | West Alabama Food Bank | Tuscaloosa | 3160 McFarland Blvd, Northport, AL 35476, Northport, AL | `33.22900, -87.58360` | `33.24191, -87.58780` | 1,488 m | google | ROOFTOP | [📍](https://www.google.com/maps?q=33.229,-87.5836) | [📍](https://www.google.com/maps?q=33.241915,-87.587797) |
| 🔴 **WRONG** | Children & Family Connection | Russell | 910 13th Street, Phenix City, AL, 36868 | `32.46100, -85.00080` | `32.47084, -85.01048` | 1,422 m | google | ROOFTOP | [📍](https://www.google.com/maps?q=32.461,-85.0008) | [📍](https://www.google.com/maps?q=32.470839,-85.01048) |
| 🔴 **WRONG** | Christian Outreach Alliance | Dallas | 700 Jeff Davis Ave, Selma, AL, Selma, AL | `32.40730, -87.02110` | `32.41458, -87.02888` | 1,090 m | google | ROOFTOP | [📍](https://www.google.com/maps?q=32.4073,-87.0211) | [📍](https://www.google.com/maps?q=32.414579,-87.028877) |
| 🔴 **WRONG** | Hale County Dept of Human Res | Hale | Greensboro, AL, Greensboro, AL | `32.70540, -87.59840` | `32.69892, -87.59379` | 840 m | nominatim | RANGE_INTERPOLATED | [📍](https://www.google.com/maps?q=32.7054,-87.5984) | [📍](https://www.google.com/maps?q=32.698918,-87.593789) |
| 🔴 **WRONG** | Pike County Salvation Army | Pike | Troy, AL, Troy, AL | `31.80430, -85.96410` | `31.80222, -85.95569` | 828 m | nominatim | RANGE_INTERPOLATED | [📍](https://www.google.com/maps?q=31.8043,-85.9641) | [📍](https://www.google.com/maps?q=31.802224,-85.955687) |
| 🔴 **WRONG** | Cullman Caring For Kids | Cullman | 402 Arnold Street NE, Cullman, AL, 35056 | `34.17480, -86.84340` | `34.18084, -86.84043` | 726 m | google | ROOFTOP | [📍](https://www.google.com/maps?q=34.1748,-86.8434) | [📍](https://www.google.com/maps?q=34.180845,-86.84043) |
| 🔴 **WRONG** | Lowndes County Food Pantry | Lowndes | Hayneville, AL, Hayneville, AL | `32.18350, -86.57940` | `32.18755, -86.57410` | 671 m | nominatim | RANGE_INTERPOLATED | [📍](https://www.google.com/maps?q=32.1835,-86.5794) | [📍](https://www.google.com/maps?q=32.187546,-86.574104) |
| 🔴 **WRONG** | Pickens County Food Pantry | Pickens | Carrollton, AL, Carrollton, AL | `33.26400, -88.09370` | `33.26646, -88.09944` | 599 m | nominatim | RANGE_INTERPOLATED | [📍](https://www.google.com/maps?q=33.264,-88.0937) | [📍](https://www.google.com/maps?q=33.266455,-88.09944) |
| 🔴 **WRONG** | St. Patrick Lazarus Pantry | Russell | 607 16th Street, Phenix City, AL, Phenix City, AL | `32.46980, -85.00070` | `32.47457, -85.00045` | 531 m | google | ROOFTOP | [📍](https://www.google.com/maps?q=32.4698,-85.0007) | [📍](https://www.google.com/maps?q=32.474569,-85.000453) |
| 🔴 **WRONG** | John 23rd Center | Russell | 16 Sussex Street, Hurtsboro, AL, Hurtsboro, AL | `32.23760, -85.41380` | `32.23733, -85.41918` | 507 m | google | ROOFTOP | [📍](https://www.google.com/maps?q=32.2376,-85.4138) | [📍](https://www.google.com/maps?q=32.237331,-85.419176) |
| 🔴 **WRONG** | FBC Community Ministries | Montgomery | 380 Arba Street, Montgomery, AL, Montgomery, AL | `32.36680, -86.29990` | `32.36694, -86.30372` | 359 m | google | ROOFTOP | [📍](https://www.google.com/maps?q=32.3668,-86.2999) | [📍](https://www.google.com/maps?q=32.366943,-86.303723) |
| 🔴 **WRONG** | Sumter County DHR | Sumter | 108 West Main St, Livingston, AL 35470, Livingston, AL | `32.58320, -88.18720` | `32.58374, -88.18946` | 220 m | google | ROOFTOP | [📍](https://www.google.com/maps?q=32.5832,-88.1872) | [📍](https://www.google.com/maps?q=32.583742,-88.189457) |
| 🔴 **WRONG** | Marion Resource Center | Perry | 100 Washington St, Marion, AL, 36756 | `32.63680, -87.31950` | `32.63506, -87.31884` | 203 m | google | RANGE_INTERPOLATED | [📍](https://www.google.com/maps?q=32.6368,-87.3195) | [📍](https://www.google.com/maps?q=32.635063,-87.318837) |
| 🟡 **CHECK** | Selma Community Food Pantry | Dallas | 215 Broad St, Selma, AL, 36701 | `32.40760, -87.02110` | `32.40935, -87.02117` | 195 m | google | RANGE_INTERPOLATED | [📍](https://www.google.com/maps?q=32.4076,-87.0211) | [📍](https://www.google.com/maps?q=32.409352,-87.02117) |
| 🟡 **CHECK** | Crossroads Community Outreach | Lauderdale | 220 West Tn Street, Florence, AL, 35630 | `34.79980, -87.67730` | `34.79943, -87.67825` | 96 m | google | ROOFTOP | [📍](https://www.google.com/maps?q=34.7998,-87.6773) | [📍](https://www.google.com/maps?q=34.799433,-87.67825) |
| ✅ **OK** | CSFP - Southern Ridge | Calhoun | 3000 Cresthill Avenue, Anniston, AL, 36201 | `33.68360, -85.84143` | `33.68355, -85.84121` | 21 m | us_census | RANGE_INTERPOLATED | [📍](https://www.google.com/maps?q=33.6836,-85.8414253) | [📍](https://www.google.com/maps?q=33.683553,-85.841205) |
| ✅ **OK** | Southside Baptist Church Pantry | Jefferson | 1016 19th St S, Birmingham, AL, 35205 | `33.50054, -86.79842` | `33.50044, -86.79850` | 13 m | google | ROOFTOP | [📍](https://www.google.com/maps?q=33.500542,-86.7984156) | [📍](https://www.google.com/maps?q=33.500444,-86.798496) |
| ✅ **OK** | Jesus Said Feed the Hungry Soup Kitchen | Jefferson | 1016 19th Street South, Birmingham, AL, 35205 | `33.50054, -86.79842` | `33.50044, -86.79850` | 13 m | google | ROOFTOP | [📍](https://www.google.com/maps?q=33.500542,-86.7984156) | [📍](https://www.google.com/maps?q=33.500444,-86.798496) |
| ✅ **OK** | Hands Of Hope Ministry | Mobile | 3750 Michael Blvd, Mobile, AL, 36609 | `30.66506, -88.14031` | `30.66506, -88.14032` | 1 m | google | ROOFTOP | [📍](https://www.google.com/maps?q=30.66505501,-88.14031196) | [📍](https://www.google.com/maps?q=30.665056,-88.14032) |
| ✅ **OK** | Authentic Life Church | Mobile | 3750 Michael Boulevard, Mobile, AL, 36609 | `30.66506, -88.14031` | `30.66506, -88.14032` | 1 m | google | ROOFTOP | [📍](https://www.google.com/maps?q=30.66505501,-88.14031196) | [📍](https://www.google.com/maps?q=30.665056,-88.14032) |
| ✅ **OK** | St. Louis Missionary Baptist Church | Mobile | 108 North Dearborn Street, Mobile, AL, 36602 | `30.69132, -88.05116` | `30.69132, -88.05116` | 0 m | google | ROOFTOP | [📍](https://www.google.com/maps?q=30.69132498,-88.05116103) | [📍](https://www.google.com/maps?q=30.691322,-88.051161) |
| ✅ **OK** | Watchman International Ministries | Mobile | 108 North Dearborn Street, Mobile, AL, 36602 | `30.69132, -88.05116` | `30.69132, -88.05116` | 0 m | google | ROOFTOP | [📍](https://www.google.com/maps?q=30.69132498,-88.05116103) | [📍](https://www.google.com/maps?q=30.691322,-88.051161) |
| ✅ **OK** | St. Andrew's Episcopal Church Pantry | Jefferson | 1024 12th Street South, Birmingham, AL, 35205 | `33.49559, -86.80789` | `33.49559, -86.80789` | 0 m | google | ROOFTOP | [📍](https://www.google.com/maps?q=33.4955872,-86.8078857) | [📍](https://www.google.com/maps?q=33.495587,-86.807886) |
| ✅ **OK** | The Community Kitchens of Birmingham Soup Kitchen | Jefferson | 1024 12th St S, Birmingham, AL, 35205 | `33.49559, -86.80789` | `33.49559, -86.80789` | 0 m | google | ROOFTOP | [📍](https://www.google.com/maps?q=33.4955872,-86.8078857) | [📍](https://www.google.com/maps?q=33.495587,-86.807886) |
| ✅ **OK** | Smithfield Backpack Buddies Agency Backpack | Jefferson | 300 4th Court North, Birmingham, AL, 35204 | `33.50912, -86.83111` | `33.50912, -86.83111` | 0 m | google | ROOFTOP | [📍](https://www.google.com/maps?q=33.5091162,-86.8311094) | [📍](https://www.google.com/maps?q=33.509116,-86.831109) |
| ✅ **OK** | Joe Brooks Food Ministry Pantry | Jefferson | 300 4th Court North, Birmingham, AL, 35204 | `33.50912, -86.83111` | `33.50912, -86.83111` | 0 m | google | ROOFTOP | [📍](https://www.google.com/maps?q=33.5091162,-86.8311094) | [📍](https://www.google.com/maps?q=33.509116,-86.831109) |
| ⚪ **MANUAL** | Eagle Grove Missionary Baptist Church | Perry | 1467 County Road 38, Marion, AL | `32.63680, -87.31950` | `N/A` | 153,779 m | nominatim | RANGE_INTERPOLATED | [📍](https://www.google.com/maps?q=32.6368,-87.3195) | N/A |
| ⚪ **MANUAL** | Smiths Station Baptist Church | Lee | 2460 Panther Parkway, Smiths Station, AL, 36877 | `32.60990, -85.48080` | `N/A` | 36,566 m | google | RANGE_INTERPOLATED | [📍](https://www.google.com/maps?q=32.6099,-85.4808) | N/A |
| ⚪ **MANUAL** | New Nelius Baptist Church | Lee | 175 New Nelius Church Road, Smiths Station, AL, 36877 | `32.60990, -85.48080` | `N/A` | 35,019 m | google | ROOFTOP | [📍](https://www.google.com/maps?q=32.6099,-85.4808) | N/A |
| ⚪ **MANUAL** | Faith in Action Ministries | Perry | 353 Water Avenue, Uniontown, AL | `32.63680, -87.31950` | `N/A` | 27,608 m | google | ROOFTOP | [📍](https://www.google.com/maps?q=32.6368,-87.3195) | N/A |
| ⚪ **MANUAL** | Paint Rock Missionary Baptist | Jackson | 2911 Hwy 72, Paint Rock, AL, 35764 | `34.67250, -86.03470` | `N/A` | 26,917 m | google | ROOFTOP | [📍](https://www.google.com/maps?q=34.6725,-86.0347) | N/A |
| ⚪ **MANUAL** | Garden City Church Of God | Cullman | 134 Short St., Garden City, AL, 35070 | `34.17480, -86.84340` | `N/A` | 20,950 m | google | RANGE_INTERPOLATED | [📍](https://www.google.com/maps?q=34.1748,-86.8434) | N/A |
| ⚪ **MANUAL** | Auburn Wesley Foundation (Loachapoka Methodist Church) | Lee | 6220 Stage Road, Loachapoka, AL, 36865 *(county mismatch)* | `32.60990, -85.48080` | `N/A` | 10,620 m | google | ROOFTOP | [📍](https://www.google.com/maps?q=32.6099,-85.4808) | N/A |
| ⚪ **MANUAL** | Sowing Seeds of Hope | Perry | 1728 South Washington Street, Marion, AL | `32.63680, -87.31950` | `N/A` | N/A | none | NONE | [📍](https://www.google.com/maps?q=32.6368,-87.3195) | N/A |
| ⚪ **MANUAL** | CHOICE | Perry | 60 Hamburg Duncan Road, Uniontown, AL | `32.63680, -87.31950` | `N/A` | N/A | none | NONE | [📍](https://www.google.com/maps?q=32.6368,-87.3195) | N/A |
| ⚪ **MANUAL** | Hands of Christ Ministry | Montgomery | Montgomery, AL, Montgomery, AL | `32.36680, -86.29990` | `N/A` | N/A | none | NONE | [📍](https://www.google.com/maps?q=32.3668,-86.2999) | N/A |
| ⚪ **MANUAL** | Feeding the Multitude | Montgomery | Montgomery, AL, Montgomery, AL | `32.36680, -86.29990` | `N/A` | N/A | none | NONE | [📍](https://www.google.com/maps?q=32.3668,-86.2999) | N/A |
| ⚪ **MANUAL** | Love Loud River Region | Montgomery | Montgomery, AL, Montgomery, AL | `32.36680, -86.29990` | `N/A` | N/A | none | NONE | [📍](https://www.google.com/maps?q=32.3668,-86.2999) | N/A |
| ⚪ **MANUAL** | Frazer Community Ministries | Montgomery | Montgomery, AL, Montgomery, AL | `32.36680, -86.29990` | `N/A` | N/A | none | NONE | [📍](https://www.google.com/maps?q=32.3668,-86.2999) | N/A |
| ⚪ **MANUAL** | St. John Missionary BC | Houston | 5529 South State Highway 95, Gordon, AL, 36343 | `31.22320, -85.39050` | `N/A` | 38,508 m | google | ROOFTOP | [📍](https://www.google.com/maps?q=31.2232,-85.3905) | N/A |
| ⚪ **MANUAL** | Pine Hill Mission | Wilcox | 3915 Broad Street, Pinehill, AL | `31.99740, -87.28360` | `N/A` | 28,706 m | google | ROOFTOP | [📍](https://www.google.com/maps?q=31.9974,-87.2836) | N/A |
| ⚪ **MANUAL** | Philadelphia Baptist Church | Houston | 24 Philadelphia Church Road, Gordon, AL, 36343 | `31.22320, -85.39050` | `N/A` | 26,907 m | google | ROOFTOP | [📍](https://www.google.com/maps?q=31.2232,-85.3905) | N/A |
| ⚪ **MANUAL** | Shady Grove C.H. Church | Houston | 355 County Road 75 S., Pansey, AL, 36370 | `31.22320, -85.39050` | `N/A` | 21,970 m | google | ROOFTOP | [📍](https://www.google.com/maps?q=31.2232,-85.3905) | N/A |
| ⚪ **MANUAL** | First Universalist Church of Camp Hill | Tallapoosa | Camp Hill, AL, 36850 | `32.90980, -85.93190` | `N/A` | N/A | none | NONE | [📍](https://www.google.com/maps?q=32.9098,-85.9319) | N/A |
| ⚪ **MANUAL** | Friends of Theo Ratlif | Marengo | 940 Martha Drive, Demopolis, AL *(county mismatch)* | `32.50499, -87.82645` | `N/A` | 28 m | google | ROOFTOP | [📍](https://www.google.com/maps?q=32.50498616736,-87.826445480319) | N/A |
| ⚪ **MANUAL** | Eastern Star Baptist Church | Marengo | 940 Martha Drive, Demopolis, AL *(county mismatch)* | `32.50499, -87.82645` | `N/A` | 28 m | google | ROOFTOP | [📍](https://www.google.com/maps?q=32.50498616736,-87.826445480319) | N/A |
| ⚪ **MANUAL** | Sandridge Missionary Baptist Church | Dallas | 5024 County Road 27, Selma, AL | `32.40740, -87.02110` | `N/A` | N/A | none | NONE | [📍](https://www.google.com/maps?q=32.4074,-87.0211) | N/A |
| ⚪ **MANUAL** | St Thomas AME Church | Wilcox | 323 St Thomas Church Road, Lower Peach Tree, AL | `31.99740, -87.28360` | `N/A` | N/A | none | NONE | [📍](https://www.google.com/maps?q=31.9974,-87.2836) | N/A |
| ⚪ **MANUAL** | Perry County Food Bank | Perry | Marion, AL, Marion, AL | `32.63290, -87.31920` | `N/A` | 176,730 m | nominatim | RANGE_INTERPOLATED | [📍](https://www.google.com/maps?q=32.6329,-87.3192) | N/A |
| ⚪ **MANUAL** | Community Action Agency | Choctaw | Butler, AL, Butler, AL | `32.08430, -88.21950` | `N/A` | 146,313 m | nominatim | RANGE_INTERPOLATED | [📍](https://www.google.com/maps?q=32.0843,-88.2195) | N/A |
| ⚪ **MANUAL** | Operation Homecare | Marengo | 300 Kentucky Ave, York, AL, York, AL *(county mismatch)* | `32.49180, -88.29590` | `N/A` | 1,432 m | google | ROOFTOP | [📍](https://www.google.com/maps?q=32.4918,-88.2959) | N/A |
| ⚪ **MANUAL** | Macon County Food Pantry | Macon | Shorter/Tuskegee Area, AL, Tuskegee, AL | `32.42410, -85.69090` | `N/A` | N/A | none | NONE | [📍](https://www.google.com/maps?q=32.4241,-85.6909) | N/A |
| ⚪ **MANUAL** | The Meal Barrel Project, Vina | Franklin | 91 Church Street, Vina, AL, 35593 | `34.50810, -87.72860` | `N/A` | 33,695 m | google | RANGE_INTERPOLATED | [📍](https://www.google.com/maps?q=34.5081,-87.7286) | N/A |
| ⚪ **MANUAL** | Valley First Assembly of God | Chambers | 5307 US-29, Valley, AL, 36854 | `32.85980, -85.39360` | `N/A` | 21,088 m | google | ROOFTOP | [📍](https://www.google.com/maps?q=32.8598,-85.3936) | N/A |
| ⚪ **MANUAL** | Demopolis Food Pantry | Marengo | 410 N Main Ave, Demopolis, AL, Demopolis, AL *(county mismatch)* | `32.51730, -87.83640` | `N/A` | 387 m | google | ROOFTOP | [📍](https://www.google.com/maps?q=32.5173,-87.8364) | N/A |
| ⚪ **MANUAL** | Grace Community Church | Montgomery | Montgomery, AL, 36123 | `32.38143, -86.26906` | `N/A` | N/A | none | NONE | [📍](https://www.google.com/maps?q=32.38143058500573,-86.26906339690053) | N/A |
| ⚪ **MANUAL** | Church of Christ | Montgomery | Montgomery, AL, 36108 | `32.34413, -86.28143` | `N/A` | N/A | none | NONE | [📍](https://www.google.com/maps?q=32.34413488184639,-86.2814309264314) | N/A |
| ⚪ **MANUAL** | Catoma Baptist Church | Montgomery | Montgomery, AL, 36108 | `32.37575, -86.26636` | `N/A` | N/A | none | NONE | [📍](https://www.google.com/maps?q=32.37575254389928,-86.2663600918285) | N/A |
| ⚪ **MANUAL** | First Baptist Church Mission Center | Montgomery | Montgomery, AL, 36104 | `32.37601, -86.31967` | `N/A` | N/A | none | NONE | [📍](https://www.google.com/maps?q=32.376010666279,-86.31967401379201) | N/A |
| ⚪ **MANUAL** | First Baptist Church Community Ministries | Montgomery | Montgomery, AL, 36104 | `32.37524, -86.30769` | `N/A` | N/A | none | NONE | [📍](https://www.google.com/maps?q=32.375235749104036,-86.30769498991447) | N/A |
| ⚪ **MANUAL** | Mercy House | Montgomery | Montgomery, AL, 36108 | `32.38864, -86.31217` | `N/A` | N/A | none | NONE | [📍](https://www.google.com/maps?q=32.388638894343586,-86.3121742211904) | N/A |
| ⚪ **MANUAL** | Holt Street Church of Christ | Montgomery | Montgomery, AL, 36105 | `32.35396, -86.29746` | `N/A` | N/A | none | NONE | [📍](https://www.google.com/maps?q=32.353961211522744,-86.29746106281236) | N/A |
| ⚪ **MANUAL** | New Harvest Church of Christ | Montgomery | Montgomery, AL, 36116 | `32.33589, -86.29570` | `N/A` | N/A | none | NONE | [📍](https://www.google.com/maps?q=32.33589047947071,-86.29570329983979) | N/A |
| ⚪ **MANUAL** | Resurrection Catholic Missions | Montgomery | Montgomery, AL, 36110 | `32.33549, -86.30317` | `N/A` | N/A | none | NONE | [📍](https://www.google.com/maps?q=32.33548788939761,-86.30317040227453) | N/A |
| ⚪ **MANUAL** | Forest Park Baptist Ministry Center | Montgomery | Montgomery, AL, 36106 | `32.36900, -86.33085` | `N/A` | N/A | none | NONE | [📍](https://www.google.com/maps?q=32.36899661188521,-86.33084551010187) | N/A |
| ⚪ **MANUAL** | Freewill Baptist Church | Montgomery | Montgomery, AL, 36108 | `32.40164, -86.28619` | `N/A` | N/A | none | NONE | [📍](https://www.google.com/maps?q=32.401642273388134,-86.28619077214142) | N/A |
| ⚪ **MANUAL** | Family Guidance Center of Alabama | Montgomery | Montgomery, AL, 36116 | `32.34826, -86.30320` | `N/A` | N/A | none | NONE | [📍](https://www.google.com/maps?q=32.34826439087719,-86.30320223686157) | N/A |
| ⚪ **MANUAL** | We Care Ministries | Montgomery | Montgomery, AL, 36106 | `32.40001, -86.26532` | `N/A` | N/A | none | NONE | [📍](https://www.google.com/maps?q=32.40000562242834,-86.26531978216532) | N/A |
| ⚪ **MANUAL** | Mount Zion A M E Zion Church | Montgomery | Montgomery, AL, 36104 | `32.37453, -86.31391` | `N/A` | N/A | none | NONE | [📍](https://www.google.com/maps?q=32.37452522359585,-86.31391049937731) | N/A |
| ⚪ **MANUAL** | Old Augusta Baptist Church | Montgomery | Montgomery, AL, 36117 | `32.34802, -86.29268` | `N/A` | N/A | none | NONE | [📍](https://www.google.com/maps?q=32.34801835285213,-86.29268144418403) | N/A |
| ⚪ **MANUAL** | Dalraida Global Methodist Church | Montgomery | Montgomery, AL, 36109 | `32.33335, -86.31828` | `N/A` | N/A | none | NONE | [📍](https://www.google.com/maps?q=32.33335163467039,-86.31827650840614) | N/A |
| ⚪ **MANUAL** | Paul Outreach Service | Montgomery | Montgomery, AL, 36108 | `32.38798, -86.30681` | `N/A` | N/A | none | NONE | [📍](https://www.google.com/maps?q=32.38798310293589,-86.30680652831734) | N/A |
| ⚪ **MANUAL** | Community of Hope | Montgomery | Montgomery, AL, 36116 | `32.33806, -86.26617` | `N/A` | N/A | none | NONE | [📍](https://www.google.com/maps?q=32.33806485249132,-86.26617221250282) | N/A |
| ⚪ **MANUAL** | Love Center Full Gospel | Montgomery | Montgomery, AL, 36111 | `32.38507, -86.32042` | `N/A` | N/A | none | NONE | [📍](https://www.google.com/maps?q=32.385069611949376,-86.32042230671821) | N/A |
| ⚪ **MANUAL** | Seventh Day Adventist Church | Montgomery | Montgomery, AL, 36109 | `32.33459, -86.27382` | `N/A` | N/A | none | NONE | [📍](https://www.google.com/maps?q=32.33459322134605,-86.27381609290892) | N/A |
| ⚪ **MANUAL** | Episcopal Church of the Holy Comforter | Montgomery | Montgomery, AL, 36111 | `32.34416, -86.32830` | `N/A` | N/A | none | NONE | [📍](https://www.google.com/maps?q=32.344161263981285,-86.32830008329054) | N/A |
| ⚪ **MANUAL** | Shepherds Ministries, Inc | Montgomery | Montgomery, AL, 36116 | `32.39710, -86.29819` | `N/A` | N/A | none | NONE | [📍](https://www.google.com/maps?q=32.39710204416449,-86.29818902592466) | N/A |
| ⚪ **MANUAL** | Reaching Out Mission Outreach (St. Jude the Apostle) | Montgomery | Montgomery, AL, 36107 | `32.38362, -86.33100` | `N/A` | N/A | none | NONE | [📍](https://www.google.com/maps?q=32.38361849935784,-86.33100315506108) | N/A |
| ⚪ **MANUAL** | Catholic Social Services | Montgomery | Montgomery, AL, 36116 | `32.38010, -86.32176` | `N/A` | N/A | none | NONE | [📍](https://www.google.com/maps?q=32.380096849837784,-86.32175763846811) | N/A |
| ⚪ **MANUAL** | St Johns A M E Church | Montgomery | Montgomery, AL, 36104 | `32.39087, -86.31936` | `N/A` | N/A | none | NONE | [📍](https://www.google.com/maps?q=32.39086949570862,-86.31935888315667) | N/A |
| ⚪ **MANUAL** | Pilgrim Rest Baptist Church | Montgomery | Montgomery, AL, 36107 | `32.39824, -86.28727` | `N/A` | N/A | none | NONE | [📍](https://www.google.com/maps?q=32.39824177496065,-86.28727399013636) | N/A |
| ⚪ **MANUAL** | Newtown Church of Christ | Montgomery | Montgomery, AL, 36104 | `32.34152, -86.31102` | `N/A` | N/A | none | NONE | [📍](https://www.google.com/maps?q=32.341521680262915,-86.31101975671405) | N/A |
| ⚪ **MANUAL** | Beulah Baptist Church | Montgomery | Montgomery, AL, 36106 | `32.39691, -86.27242` | `N/A` | N/A | none | NONE | [📍](https://www.google.com/maps?q=32.396910382118435,-86.27242149754925) | N/A |
| ⚪ **MANUAL** | King Hill Baptist Family Life Center | Montgomery | Montgomery, AL, 36107 | `32.35310, -86.31397` | `N/A` | N/A | none | NONE | [📍](https://www.google.com/maps?q=32.35309742736272,-86.3139696276297) | N/A |

## MANUAL Pantries — Reasons

These require hand-verification before any coordinate can be updated in Firestore.

| # | Pantry Name | County | Address | Reason |
| :--- | :--- | :--- | :--- | :--- |
| 1 | Eagle Grove Missionary Baptist Church | Perry | 1467 County Road 38, Marion, AL | Verified point is 154 km from stored point — too large to auto-correct, needs manual review |
| 2 | Smiths Station Baptist Church | Lee | 2460 Panther Parkway, Smiths Station, AL, 36877 | Verified point is 37 km from stored point — too large to auto-correct, needs manual review |
| 3 | New Nelius Baptist Church | Lee | 175 New Nelius Church Road, Smiths Station, AL, 36877 | Verified point is 35 km from stored point — too large to auto-correct, needs manual review |
| 4 | Faith in Action Ministries | Perry | 353 Water Avenue, Uniontown, AL | Verified point is 28 km from stored point — too large to auto-correct, needs manual review |
| 5 | Paint Rock Missionary Baptist | Jackson | 2911 Hwy 72, Paint Rock, AL, 35764 | Verified point is 27 km from stored point — too large to auto-correct, needs manual review |
| 6 | Garden City Church Of God | Cullman | 134 Short St., Garden City, AL, 35070 | Verified point is 21 km from stored point — too large to auto-correct, needs manual review |
| 7 | Auburn Wesley Foundation (Loachapoka Methodist Church) | Lee | 6220 Stage Road, Loachapoka, AL, 36865 | Verified point (32.604781, -85.594018) falls outside Lee County bounds — likely wrong address match |
| 8 | Sowing Seeds of Hope | Perry | 1728 South Washington Street, Marion, AL | No street-level match returned by any geocoder |
| 9 | CHOICE | Perry | 60 Hamburg Duncan Road, Uniontown, AL | No street-level match returned by any geocoder |
| 10 | Hands of Christ Ministry | Montgomery | Montgomery, AL, Montgomery, AL | No street-level match returned by any geocoder |
| 11 | Feeding the Multitude | Montgomery | Montgomery, AL, Montgomery, AL | No street-level match returned by any geocoder |
| 12 | Love Loud River Region | Montgomery | Montgomery, AL, Montgomery, AL | No street-level match returned by any geocoder |
| 13 | Frazer Community Ministries | Montgomery | Montgomery, AL, Montgomery, AL | No street-level match returned by any geocoder |
| 14 | St. John Missionary BC | Houston | 5529 South State Highway 95, Gordon, AL, 36343 | Verified point is 39 km from stored point — too large to auto-correct, needs manual review |
| 15 | Pine Hill Mission | Wilcox | 3915 Broad Street, Pinehill, AL | Verified point is 29 km from stored point — too large to auto-correct, needs manual review |
| 16 | Philadelphia Baptist Church | Houston | 24 Philadelphia Church Road, Gordon, AL, 36343 | Verified point is 27 km from stored point — too large to auto-correct, needs manual review |
| 17 | Shady Grove C.H. Church | Houston | 355 County Road 75 S., Pansey, AL, 36370 | Verified point is 22 km from stored point — too large to auto-correct, needs manual review |
| 18 | First Universalist Church of Camp Hill | Tallapoosa | Camp Hill, AL, 36850 | Missing street address or city — city-level only in Firestore |
| 19 | Friends of Theo Ratlif | Marengo | 940 Martha Drive, Demopolis, AL | Verified point (32.504737, -87.826505) falls outside Marengo County bounds — likely wrong address match |
| 20 | Eastern Star Baptist Church | Marengo | 940 Martha Drive, Demopolis, AL | Verified point (32.504737, -87.826505) falls outside Marengo County bounds — likely wrong address match |
| 21 | Sandridge Missionary Baptist Church | Dallas | 5024 County Road 27, Selma, AL | No street-level match returned by any geocoder |
| 22 | St Thomas AME Church | Wilcox | 323 St Thomas Church Road, Lower Peach Tree, AL | No street-level match returned by any geocoder |
| 23 | Perry County Food Bank | Perry | Marion, AL, Marion, AL | Verified point is 177 km from stored point — too large to auto-correct, needs manual review |
| 24 | Community Action Agency | Choctaw | Butler, AL, Butler, AL | Verified point is 146 km from stored point — too large to auto-correct, needs manual review |
| 25 | Operation Homecare | Marengo | 300 Kentucky Ave, York, AL, York, AL | Verified point (32.48532, -88.309091) falls outside Marengo County bounds — likely wrong address match |
| 26 | Macon County Food Pantry | Macon | Shorter/Tuskegee Area, AL, Tuskegee, AL | No street-level match returned by any geocoder |
| 27 | The Meal Barrel Project, Vina | Franklin | 91 Church Street, Vina, AL, 35593 | Verified point is 34 km from stored point — too large to auto-correct, needs manual review |
| 28 | Valley First Assembly of God | Chambers | 5307 US-29, Valley, AL, 36854 | Verified point is 21 km from stored point — too large to auto-correct, needs manual review |
| 29 | Demopolis Food Pantry | Marengo | 410 N Main Ave, Demopolis, AL, Demopolis, AL | Verified point (32.520336, -87.838427) falls outside Marengo County bounds — likely wrong address match |
| 30 | Grace Community Church | Montgomery | Montgomery, AL, 36123 | Missing street address or city — city-level only in Firestore |
| 31 | Church of Christ | Montgomery | Montgomery, AL, 36108 | Missing street address or city — city-level only in Firestore |
| 32 | Catoma Baptist Church | Montgomery | Montgomery, AL, 36108 | Missing street address or city — city-level only in Firestore |
| 33 | First Baptist Church Mission Center | Montgomery | Montgomery, AL, 36104 | Missing street address or city — city-level only in Firestore |
| 34 | First Baptist Church Community Ministries | Montgomery | Montgomery, AL, 36104 | Missing street address or city — city-level only in Firestore |
| 35 | Mercy House | Montgomery | Montgomery, AL, 36108 | Missing street address or city — city-level only in Firestore |
| 36 | Holt Street Church of Christ | Montgomery | Montgomery, AL, 36105 | Missing street address or city — city-level only in Firestore |
| 37 | New Harvest Church of Christ | Montgomery | Montgomery, AL, 36116 | Missing street address or city — city-level only in Firestore |
| 38 | Resurrection Catholic Missions | Montgomery | Montgomery, AL, 36110 | Missing street address or city — city-level only in Firestore |
| 39 | Forest Park Baptist Ministry Center | Montgomery | Montgomery, AL, 36106 | Missing street address or city — city-level only in Firestore |
| 40 | Freewill Baptist Church | Montgomery | Montgomery, AL, 36108 | Missing street address or city — city-level only in Firestore |
| 41 | Family Guidance Center of Alabama | Montgomery | Montgomery, AL, 36116 | Missing street address or city — city-level only in Firestore |
| 42 | We Care Ministries | Montgomery | Montgomery, AL, 36106 | Missing street address or city — city-level only in Firestore |
| 43 | Mount Zion A M E Zion Church | Montgomery | Montgomery, AL, 36104 | Missing street address or city — city-level only in Firestore |
| 44 | Old Augusta Baptist Church | Montgomery | Montgomery, AL, 36117 | Missing street address or city — city-level only in Firestore |
| 45 | Dalraida Global Methodist Church | Montgomery | Montgomery, AL, 36109 | Missing street address or city — city-level only in Firestore |
| 46 | Paul Outreach Service | Montgomery | Montgomery, AL, 36108 | Missing street address or city — city-level only in Firestore |
| 47 | Community of Hope | Montgomery | Montgomery, AL, 36116 | Missing street address or city — city-level only in Firestore |
| 48 | Love Center Full Gospel | Montgomery | Montgomery, AL, 36111 | Missing street address or city — city-level only in Firestore |
| 49 | Seventh Day Adventist Church | Montgomery | Montgomery, AL, 36109 | Missing street address or city — city-level only in Firestore |
| 50 | Episcopal Church of the Holy Comforter | Montgomery | Montgomery, AL, 36111 | Missing street address or city — city-level only in Firestore |
| 51 | Shepherds Ministries, Inc | Montgomery | Montgomery, AL, 36116 | Missing street address or city — city-level only in Firestore |
| 52 | Reaching Out Mission Outreach (St. Jude the Apostle) | Montgomery | Montgomery, AL, 36107 | Missing street address or city — city-level only in Firestore |
| 53 | Catholic Social Services | Montgomery | Montgomery, AL, 36116 | Missing street address or city — city-level only in Firestore |
| 54 | St Johns A M E Church | Montgomery | Montgomery, AL, 36104 | Missing street address or city — city-level only in Firestore |
| 55 | Pilgrim Rest Baptist Church | Montgomery | Montgomery, AL, 36107 | Missing street address or city — city-level only in Firestore |
| 56 | Newtown Church of Christ | Montgomery | Montgomery, AL, 36104 | Missing street address or city — city-level only in Firestore |
| 57 | Beulah Baptist Church | Montgomery | Montgomery, AL, 36106 | Missing street address or city — city-level only in Firestore |
| 58 | King Hill Baptist Family Life Center | Montgomery | Montgomery, AL, 36107 | Missing street address or city — city-level only in Firestore |
