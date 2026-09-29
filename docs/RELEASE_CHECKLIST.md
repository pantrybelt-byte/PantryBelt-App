# AccessBelt Release Checklist

> Run through every item in order before each TestFlight / Play Console submission.
> Items marked ⚡ are automated by CI (eas-build-submit.yml or firebase-deploy.yml).

---

## Phase 0 — Prerequisite Environment

- [ ] EXPO_PUBLIC_FIREBASE_API_KEY set in EAS Secrets (never in code or .env)
- [ ] GOOGLE_MAPS_API_KEY set in EAS Secrets
- [ ] GEMINI_API_KEY stored in Google Secret Manager (not EAS)
- [ ] RESEND_API_KEY stored in Google Secret Manager
- [ ] KMS_KEY_NAME stored in Google Secret Manager
- [ ] JKS keystore at ~/.config/accessbelt/ with chmod 600, NOT in the repo
- [ ] Firebase CLI authenticated: npx -y firebase-tools@latest login:ci

---

## Phase 1 — Version Bump

    node tools/bumpVersion.js patch   # or: minor | major

- [ ] app.config.js version bumped (semver, matches Store listings)
- [ ] app.config.js android.versionCode incremented (always ++)
- [ ] app.config.js ios.buildNumber incremented (always ++)
- [ ] Commit: git commit -m "chore: bump version to X.Y.Z (build N)"

---

## Phase 2 — Security

- [ ] ⚡ firebase-deploy.yml deploys updated firestore.rules
- [ ] Firestore rules simulator passes (Firebase Console > Firestore > Rules > Test)
- [ ] No plain-text secrets in repo: git grep -rn "AIza\|-----BEGIN" returns nothing
- [ ] KMS key ring exists: gcloud kms keyrings list --location=us-central1
- [ ] Cloud Functions service account has roles/cloudkms.cryptoKeyEncrypterDecrypter

---

## Phase 3 — Offline / Cache

- [ ] firebase.ts uses initializeFirestore with persistentLocalCache ✓
- [ ] utils/offlineCache.ts exports sortByCounty / sortByProximity ✓
- [ ] utils/network.ts useIsOffline() uses isInternetReachable !== false ✓
- [ ] Offline list UI appears in map.tsx when isOffline && pantries.length > 0 ✓
- [ ] Map loading shows MapLoadingSkeleton / PantryListSkeleton, not ActivityIndicator ✓
- [ ] Kill network on device → see offline banner, tap pantry → modal opens from cache
- [ ] Restore network → servedFromCache triggers background re-fetch (logged in console)

---

## Phase 4 — Geocoding Pipeline

- [ ] Run audit on new import batch:
      node tools/geocodePipeline.js --in tools/.tmp/scraped.json
      Review tools/.tmp/geocode/queue-manual-review.json
      node tools/geocodePipeline.js --in tools/.tmp/scraped.json --write
- [ ] Apply coordinate fixes after human review:
      node tools/fix_pantry_coordinates_dry_run.js
      node tools/fix_pantry_coordinates_dry_run.js --apply
- [ ] geocodePrecision field written to Firestore for all imported docs
- [ ] mapEligible flag recalculated via utils/mapEligibility.ts after any coordinate fix

---

## Phase 5 — Operator Portal

- [ ] Portal deployed: cd Pantry-Belt-Landing-Page- && npm run build && firebase deploy --only hosting
- [ ] /admin route shows login form to unauthenticated visitors
- [ ] Test operator account created in Firebase Console > Authentication
- [ ] operatorPortalAccess: true and operatorUid: <uid> set on a test agency doc
- [ ] Sign in at /admin -> verify pantry details shown
- [ ] Edit phone/website/hours -> Save -> reload -> confirm changes persisted
- [ ] Attempt to mutate coordinates or status from browser -> expect permission-denied
- [ ] firestore.rules Operator Portal path deployed ✓
- [ ] Run deferred impact metric field migration when Operator Portal goes live with VITE_USE_FIREBASE=true:
      node tools/migrateFamiliesToUsersReached.js            # dry run audit
      node tools/migrateFamiliesToUsersReached.js --write     # apply rename (familiesReached -> usersReached, capacityPercentage -> inventoryCapacityPercentage)

---

## Phase 6 — Pre-Build

- [ ] ⚡ EAS build triggered:
      eas build --platform ios --profile production
      eas build --platform android --profile production
- [ ] app.config.js Google Maps API key resolved via EAS Secret
- [ ] @react-native-firebase native modules linked (dev client / bare build)
- [ ] Crashlytics test crash logged in Firebase Console after first launch
- [ ] Analytics DebugView shows session_start event on first launch

---

## Phase 7 — Store Submission

### iOS (TestFlight -> App Store)
- [ ] Provisioning profile and distribution cert valid in Xcode Organizer
- [ ] App Store Connect metadata up to date (screenshots, description, keywords)
- [ ] Age rating: 4+ (no mature content)
- [ ] Privacy Nutrition Label: location (when in use), analytics (no tracking)
- [ ] Review notes for Apple: "This app connects Alabama residents to food pantries. Anonymous authentication is intentional and does not collect personal data."

### Android (Internal -> Production)
- [ ] Google Play Console Pre-Launch Report passed (no crashes in baseline)
- [ ] Data Safety section: Location (approximate, optional), no data sold
- [ ] SHA-1 fingerprint registered in Firebase > Project Settings > Android apps
- [ ] versionCode strictly greater than previous release in Play Console

---

## Phase 8 — Post-Release

- [ ] Monitor Crashlytics for new non-fatal trends within 24 h
- [ ] Check Firebase Console > Functions > Logs for askPete / encryptUserField errors
- [ ] Verify Firestore usage doesn't spike (sign of a runaway listener or retry loop)
- [ ] Tag release: git tag vX.Y.Z && git push --tags
