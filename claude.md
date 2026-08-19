# AccessBelt — Project Constitution (claude.md)

**This file is law.** Update only when schemas, rules, or architecture change.

---

## Data schemas

### App state (in-memory unless noted)

- **Auth:** Hybrid, anonymous-by-default. Firebase Anonymous Auth runs on every launch via `utils/auth.ts`'s `initAppSecurity()` (Tier 1) — no account needed to use the app. A companion `_app_sessions/{uid}` doc (Tier 3A) is bootstrapped alongside it so Firestore rules can confirm writes come from the real app binary. Real email/password accounts are an **optional upgrade**, reachable from Profile → Account → `/(auth)/signin` (`utils/auth.ts`'s `signUpWithEmail()`/`signInWithEmail()`/`signOutUser()`). Signing up links the credential to the existing anonymous uid via `linkWithCredential()` — the uid never changes, so `user_profiles/{uid}` and session data carry over automatically with no migration step. Signing out returns to a fresh anonymous identity (the previous account's data stays intact in Firestore under its own uid, untouched, ready for the next sign-in). Because switching identity changes `auth.currentUser.uid`, every sign-up/sign-in/sign-out calls `reestablishSession()` to force an immediate `_app_sessions/{newUid}` bootstrap — `initAppSecurity()`'s own memoization is time-based, not uid-based, and would otherwise leave the new uid failing `hasActiveSession()` for up to 10 minutes.
- **Profile (`app/(tabs)/profile.tsx`):** A settings screen — dark mode, push notifications, location, newsletter toggles; local `useState` only, not persisted.
- **Demographic Profile (Firestore: `user_profiles/{uid}`)** — optional, user-entered, keyed by the anonymous Firebase uid, not linked to any real-world identity:
  - `age: number` (13–120)
  - `familySize: number` (1–20)
  - `zipCode: string` (5-digit)
  - `race: string | null` (optional; one of the standard census-style categories in `utils/userProfile.ts`'s `RACE_OPTIONS`, or `prefer_not_to_say`)
  - `pushToken: string | null` (optional, set when push notifications are enabled)
  - `updatedAt: serverTimestamp`
  - Read/write via `utils/userProfile.ts` (`getUserProfile()` / `saveUserProfile()`); gated on `useAuthReady()` before reading.
- **Pantries (Firestore: `resources/{id}`):** Loaded live in `app/(tabs)/map.tsx` via `fetchPantries()`, querying `where('status', '==', 'active')`. Firestore fields: `orgId, name, locationType, status, county, coordinates: {lat, lng}, geohash, address: {street, city, county, state, zip}, hours (string | per-day object | null), phone, website, eligibilityNotes, docsRequired: string[], serviceRadiusMiles, capacity, tags: string[], verified, createdBy, createdAt, updatedAt`. Mapped client-side into the screen's flat `Pantry` type `{ id, name, city, county, lat, lng, phone, address, hours, eligibility, docs, website, verified }`; docs missing valid non-zero coordinates are filtered out. Import/seed scripts live in `tools/` and `seedFirestore.js` (Admin SDK, bypasses rules — see maintenance log).
- **Pete messages:** Array of `{ id, role: 'user' | 'assistant', text }` in component state; mock replies by keyword.

### Payload (future)

- If backend added: define API request/response shapes here.
- If analytics: define event payloads here.

---

## Behavioral rules

1. **Tone:** Helpful, clear, respectful. Alabama Black Belt focus; no jargon.
2. **Do not:** Guess at business logic; change pantry data without updating architecture; add a second logo asset (use single `logo.png`).
3. **Links:** External links open in browser or dialer (211). Map directions: Apple Maps on iOS, Google Maps on Android.
4. **Tab order:** Always Home → Map → Pete → Profile. Entry after auth: `/(tabs)/map`.

---

## Architectural invariants

1. **Expo Router:** Entry is `app/index.tsx`; tabs live under `app/(tabs)/`; auth under `app/(auth)/`. No custom native modules without prebuild.
2. **Assets:** `assets/logo.png` = app icon, splash, and in-app logo. `assets/pete.png` = Pantry Pete avatar. `assets/background.png` = sign-in / header background.
3. **Theme:** `context/ThemeContext.tsx` provides light/dark; every screen including the tab bar (`app/(tabs)/_layout.tsx`) follows it via `theme.card`/`theme.border`/`theme.subtext`. (Previously the tab bar was fixed-light "for visibility" — reversed 2026-08-13 per explicit request.)
4. **Map:** `react-native-maps`; iOS uses MapKit (default provider, optional `mapType="mutedStandard"`).

---

## Maintenance log

| Date       | Change |
|-----------|--------|
| 2026-08-17 | Imported 152 pantries across 11 Food Bank of North Alabama (FBNA) counties — Marshall, Franklin, Lauderdale, Colbert, Lawrence, Morgan, Limestone, Madison, Jackson, DeKalb, Cullman — into `resources/` via `tools/addFBNAPantries.js`. Source had no coordinates (geocoded via Census, 18 rural fallbacks to county-seat) and no phone numbers at all (only a staff contact name, left blank). Unlike prior imports, the source's Hours column was detailed enough to extract real per-entry schedules instead of the generic "Call for hours" placeholder. Fixed one row's own County column (Lawrence's "The Helping Hand" read "Madison"), moved one row from the Limestone file to Madison per its own County field ("Good Shepherd UMC"), and collapsed one exact duplicate (Morgan's "Hartselle-Decatur SDA Hispanic Church" listed twice back-to-back). No existing Firestore resources were found in any of these 11 counties beforehand. |
| 2026-08-17 | Imported 227 pantries across 12 Community Food Bank of Central Alabama (CFBCA) counties — Shelby, Etowah, Cherokee, Talladega, Clay, Cleburne, Calhoun, St. Clair, Blount, Jefferson, Walker, Winston — into `resources/` via `tools/addCFBCAPantries.js`, using source coordinates as-given. Applied two exclusion rules not used in prior batches: (1) dropped ~7 "CSFP" (senior commodity program) rows that shared the exact same address as a same-site "Pantry"-named row, keeping the Pantry entry; (2) dropped ~18 rows whose only AgencyGroup category was bare "Residential" (shelters/rehab/senior housing with no pantry or soup-kitchen component) as not being food-distribution points — combo categories like "Residential & Pantry" were kept. No existing Firestore resources were found in any of these 12 counties beforehand. |
| 2026-08-17 | Imported 52 pantries across 8 West Alabama Food Bank (WAFB) counties — Hale, Bibb, Tuscaloosa, Pickens, Fayette, Lamar, Marion, Sumter — into `resources/` via `tools/addWestAlabamaPantries.js`, using the source's own coordinates (no corruption/mismatch pattern this time). "Greene County.pdf" turned out to be a duplicate export of Sumter County's 3 rows under the wrong filename (every row explicitly tagged County=Sumter) — contributed zero real Greene entries; the Sumter trio was written once. No overlaps found against existing Firestore resources in any of the 9 counties checked. |
| 2026-08-17 | Imported 46 pantries across 6 East Alabama counties — Macon, Chambers, Randolph, Tallapoosa, Lee, Russell — into `resources/` via `tools/addEastAlabamaPantries.js`. Source PDFs turned out to be arbitrary slices of one shared unfiltered multi-county query, not per-county exports — every row was filed under its own "County" column value rather than its PDF's filename. The FBEA sub-table's own lat/lng was corrupted for Randolph/Tallapoosa/Russell (real addresses tens of miles apart sharing identical coordinates), so all FBEA rows were re-geocoded from their street address via the Census geocoder instead; the HAFB sub-table's coordinates were trusted as-is (consistent with every prior import). Excluded 1 internal admin record ("HAFB ADMIN - Tuskegee VA") and 6 rows matching pantries already live in Firestore (Barbour's "Forgiven Ministries"; Russell's "St. Patrick Lazarus (Food) Pantry", "Lakewood Baptist Church", "St./John 23rd Center", "Potter's House Baptist (Church Sincere Ministry)"; Macon's "Macon County Food Pantry"). |
| 2026-08-17 | Imported 65 pantries across 6 Wiregrass-region counties — Coffee, Geneva, Dale, Houston, Henry, Barbour — into `resources/` via `tools/addWiregrassPantries.js`. Source had coordinates for only 3 of 65 rows (Barbour's FBEA table); the rest geocoded via the Census geocoder, 7 falling back to county-seat coordinates. Moved "Helping Hands Dothan" from Dale's PDF to Houston County (its own County column and address both say Dothan/Houston, not Dale). Dropped 3 Barbour rows already live in Firestore under matching phone/name: "White Oak UMC", "Eufaula Church of God In Christ", "Bakerhill Community Outreach". |
| 2026-08-17 | Imported 37 pantries across 9 HAFB counties — Lowndes, Elmore, Autauga, Chilton, Coosa, Bullock, Pike, Crenshaw, Butler — into `resources/` via `tools/addBlackBeltHAFBPantries.js`. Corrected 3 source rows where the PDF's own "County" column held a city name instead of the real county (Elmore's "Holy Assembly of Jesus" read "Wetumpka"; Chilton's "Trinity Episcopal Church" read "Clanton"; Crenshaw's "Faith Walk Ministries" read "Lowndes") — each corrected against the row's own city and the file's census-county summary row. No overlaps found against existing Firestore resources in any of the 9 counties. |
| 2026-08-17 | Imported 45 pantries across 4 Selma Area Food Bank counties — Dallas, Perry, Marengo, Wilcox — into `resources/` via `tools/addSelmaAreaPantries.js`. This source had no coordinates, so addresses were geocoded via the free US Census Bureau geocoder after discovering the Google Maps Geocoding API isn't enabled on this project's Cloud billing account (`tools/addMontgomeryPantries.js`'s Google geocoding path is currently broken as a result — first 45-row run silently fell back to 4 identical county-center points and had to be deleted and redone once the Census geocoder was wired in as the primary path). 8 rural addresses the Census geocoder couldn't match still fall back to county-seat coordinates. Dropped 2 rows with no address in the source at all, 3 unrelated animal-shelter/trade-association rows embedded in the Dallas PDF, and 2 rows matching pantries already live in Firestore (one exact, one same-block address match). |
| 2026-08-17 | Imported 157 pantries across 9 Feeding the Gulf Coast (FTGC) counties — Baldwin, Clarke, Choctaw, Conecuh, Covington, Escambia, Mobile, Monroe, Washington — into `resources/` via `tools/addFTGCRegionPantries.js` (Admin SDK, real lat/lng from source). Deduped 2 rows against the 2 FTGC/CFBCA-table entries for the same Theodore, AL food bank site already live in Firestore, plus corrected several source typos (bad area code, invalid ZIP, a mistyped phone confirmed via its sibling location, two mislabeled county values). |
| 2026-08-17 | Imported 34 Montgomery-area pantries from the HAFB Montgomery County dataset into `resources/` via `tools/addHAFBMontgomeryPantries.js` (Admin SDK, real lat/lng from source — no geocoding needed). Deduped against the 36 Montgomery resources already live (12 rows dropped on matching phone or unmistakable name) plus 4 exact-duplicate rows and 1 PO-Box-only row within the source PDF itself. Corrected the stale "Pantries: static array" schema line above — pantries have been Firestore-backed (`resources` collection) since before this session; the doc just hadn't been updated to match. |
| 2026-08-13 | Added optional real email/password accounts on top of the anonymous-auth base (`/(auth)/signin`, previously dead/unreachable code, now reachable from Profile → Account); anonymous→real upgrade preserves uid via `linkWithCredential()`. Added race field to `user_profiles`. |
| 2026-08-13 | Corrected Auth/Profile schema to match actual anonymous-auth architecture (was stale, predated `utils/auth.ts`); added `user_profiles/{uid}` demographic schema; dark-mode theming pass across all screens; added push notifications (`utils/notifications.ts`), which required `npx expo prebuild --clean` per invariant #1 ("no custom native modules without prebuild") — regenerated `ios/` was already untracked/gitignored, so this was low-risk. |
| (today)   | B.L.A.S.T. applied: task_plan, findings, progress, claude.md, architecture/, .tmp/ |
| 2026-08-10 | Entry point reverted to `/(tabs)/map` (was briefly changed to `/(tabs)/home`, then reverted per explicit request) |

---
*Only update this file when a schema, rule, or invariant changes.*
