# AccessBelt — Key & Credential Inventory

This document lists every API key, credential, and service account used across AccessBelt, where it is stored, how it is secured, and its rotation procedure.

> **Security Notice**: Never commit secret keys, private keys, or API tokens directly to this repository. All sensitive credentials are kept outside git in `.env`, secret managers, or external config paths.

---

## 1. Firebase Web Client API Key

* **Variable Name**: `EXPO_PUBLIC_FIREBASE_API_KEY`
* **What Uses It**:
  * AccessBelt Mobile App (iOS and Android) via `firebase.ts` / `config/firebase.ts`.
  * Authenticates client instances with Firebase Authentication and Cloud Firestore.
* **Where It Is Stored**:
  * **Local**: `.env` (`EXPO_PUBLIC_FIREBASE_API_KEY`)
  * **EAS Cloud**: EAS Environment Variables (`production`, `preview`, `development`)
* **Cloud Project & Console**:
  * **Project**: `pantrybelt-1e7eb`
  * **Console**: Firebase Console → Project Settings → General (Web App config) / Google Cloud Console → APIs & Services → Credentials.
* **Restrictions**:
  * **Application Restrictions**: None (Public client identifier; security is enforced server-side by Firestore Security Rules and Firebase Auth).
  * **API Target Restrictions**: Scoped to standard Firebase services (Identity Toolkit, Firestore, Storage, App Check).
* **Who Can Rotate**: Project Owner / Firebase Admin in Firebase Console.

---

## 2. Google Maps Android API Key

* **Variable Name**: `GOOGLE_MAPS_ANDROID_KEY`
* **What Uses It**:
  * Google Maps SDK for Android to render vector map tiles and markers in the `Map` tab.
  * Evaluated at build time in `app.config.js` and injected strictly into the native `AndroidManifest.xml` (`com.google.android.geo.API_KEY`). Notice it intentionally omits the `EXPO_PUBLIC_` prefix so it is never bundled into client JavaScript.
  * *(iOS intentionally does not use this key; iOS uses native Apple Maps).*
* **Where It Is Stored**:
  * **Local**: `.env` (`GOOGLE_MAPS_ANDROID_KEY`)
  * **EAS Cloud**: EAS Environment Variables (`production`, `preview`, `development`) with **Secret** visibility.
* **Cloud Project & Console**:
  * **Project**: `pantrybelt-1e7eb`
  * **Console**: Google Cloud Console (`pantrybelt-1e7eb`) → APIs & Services → Credentials.
* **Restrictions**:
  * **Application Restrictions**: Strictly restricted to Android applications matching:
    * Package Name: `com.accessbelt.app`
    * SHA-1 Certificate Fingerprints:
      1. `a57704e7d5004b9b87c9bf26c29a9c70a9403f9a` — EAS Upload key (signs the `.aab` before it reaches Play).
      2. `4ebcefe549718bb4f0cdcfe0516fa08ea6582812` — added early in this key's history; provenance unconfirmed, kept for compatibility.
      3. `c9a230b75eddb9a6d6f988c7b6352d23d6b6b874` — **the real Google Play App Signing certificate**, added 2026-09-22 after Build 9 shipped with a blank map on every real device. Verified directly (not guessed): downloaded an actual generated APK for versionCode 9 via the Play Developer API (`generatedApks.download`, using the existing submission service account) and extracted its signing certificate. Fingerprints 1–2 never covered this certificate, so every real install was silently rejected by the Maps backend from the very first Android build — a Cloud Console gap, not a client-code bug, despite several prior app-side "fix" attempts across builds 5–9.
  * **API Target Restrictions**: Restricted strictly to `Maps SDK for Android` (`maps-android-backend.googleapis.com`). All other Google Cloud APIs are rejected.
  * **Propagation note**: restriction changes on this key take effect within minutes without a new build — Build 9 (already on the internal track) should start rendering the map once this change propagates, no rebuild required for this specific fix.
* **Who Can Rotate**: GCP Project Owner / Android Release Manager.
* **Current Active Key**: UID `65e6702c-a03d-400a-a74f-6a7fbdb2ad11` ("AccessBelt Android Maps Sep 2026 v3"), created 2026-09-22. The only other surviving key, `772782b7...` ("Maps", see below), is intentionally retained but unused. The two exposed keys from this rotation were deleted.
* **Rotation History**:
  * `772782b7-e9f5-4b71-9c47-377059a6f633` ("Maps") — original key. Tightened (application + API-target restrictions added) 2026-09-21; superseded 2026-09-22. Not deleted — left in place, still restricted, unused going forward.
  * `0a9d474e-17c6-4c98-9799-43c315d2e1cc` ("AccessBelt Android Maps Sep 2026") — created 2026-09-21. Its value was accidentally printed to local tool output during a pre-flight check on 2026-09-22 (never transmitted externally). Retired same day, then **deleted** 2026-09-22 once no longer needed (soft-delete; recoverable for 30 days via GCP Undelete if ever needed).
  * `fbea4944-430e-4530-8617-1a337c050bab` ("AccessBelt Android Maps Sep 2026 v2") — created 2026-09-22 as a replacement, but its value was *also* accidentally printed to local tool output during creation (gcloud's operation-status line ignored `--format`). Never used for real traffic. **Deleted** 2026-09-22 (soft-delete; 30-day undelete window).
  * `65e6702c-a03d-400a-a74f-6a7fbdb2ad11` ("AccessBelt Android Maps Sep 2026 v3") — created 2026-09-22 with output fully redirected to a file so the value was never displayed. This is the sole active key, live in `.env` and EAS (`production`/`preview`/`development`, secret visibility).

---

## 3. Gemini API Key (Server-Side Cloud Function Secret)

* **Secret Name**: `GEMINI_API_KEY` (Google Cloud Secret Manager)
* **What Uses It**:
  * Pete AI Assistant backend Cloud Function (`askPete` in `functions/src/index.ts`).
  * Relays Pete's user prompts and sanitizes inputs before querying Gemini.
  * **Not shipped in the client app.** Replaced direct client-side requests with `httpsCallable(functions, "askPete")`.
* **Where It Is Stored**:
  * **Production / Cloud**: Google Cloud Secret Manager via Firebase Functions (`defineSecret("GEMINI_API_KEY")`).
  * **Local Testing**: Set interactively via `firebase functions:secrets:set GEMINI_API_KEY`.
* **Cloud Project & Console**:
  * **Project**: `pantrybelt-1e7eb` (Firebase Cloud Functions & GCP Secret Manager).
  * **Source Key**: Google AI Studio (`https://aistudio.google.com/app/apikey`).
* **Restrictions**:
  * **Server-side only**: Never embedded into mobile binaries or exposed to client network traffic.
  * **Rate Limiting**: Enforced server-side per Firebase Auth UID (30 messages/day counter in Firestore).
  * **Input Capping**: Enforced server-side (max 1,000 characters per message).
  * **Authentication**: Requires valid Firebase Auth token (`request.auth`).
* **Who Can Rotate**: GCP Project Owner / Firebase Admin via `firebase functions:secrets:set GEMINI_API_KEY`.

---

## 4. Google Maps Geocoding API Key

* **Variable Name**: `GOOGLE_MAPS_GEOCODING_KEY`
* **What Uses It**:
  * Developer scripts and administrative data pipelines (e.g. `seedPantries.js`, verification tools) to resolve physical Alabama pantry addresses into latitude/longitude coordinates.
  * Never bundled or used in the mobile runtime application.
* **Where It Is Stored**:
  * **Local Only**: `.env` (`GOOGLE_MAPS_GEOCODING_KEY`). Kept on developer machines only; deleted from EAS environments.
* **Cloud Project & Console**:
  * **Project**: `pantries-488902`
  * **Console**: Google Cloud Console (`pantries-488902`) → APIs & Services → Credentials.
* **Restrictions**:
  * **Application Restrictions**: None (Server/script key used exclusively from developer machines).
  * **API Targets**: Geocoding API.
* **Who Can Rotate**: GCP Project Owner (`pantries-488902`).

---

## 5. Firebase Admin Service Account Key

* **Variable Name**: `GOOGLE_APPLICATION_CREDENTIALS`
* **What Uses It**:
  * Local administrative scripts (`seedFirestore.js`, `updatePantries.js`, migration tools in `tools/`).
  * Bypasses Firestore security rules using Firebase Admin SDK for database initialization and dataset updates.
* **Where It Is Stored**:
  * **Moved outside the repository**: `~/.config/accessbelt/serviceAccountKey.json` with file permissions `600` (directory `700`).
  * Never committed to git.
* **Cloud Project & Console**:
  * **Project**: `pantrybelt-1e7eb`
  * **Console**: Firebase Console → Project Settings → Service accounts → "Generate new private key".
* **Restrictions**:
  * Full Firebase Admin / IAM administrative permissions. Must remain strictly confidential.
* **Who Can Rotate**: Firebase Project Owner in Firebase Console.

---

## 6. Google Play Store Submission Service Account Key

* **Variable Name**: `PLAY_STORE_SERVICE_ACCOUNT_KEY_PATH`
* **What Uses It**:
  * EAS CLI (`eas submit -p android`) to submit production `.aab` bundles directly to Google Play Console (internal test track).
  * Evaluated dynamically in `eas.json` via `${PLAY_STORE_SERVICE_ACCOUNT_KEY_PATH:-/Users/.../.config/accessbelt/google-service-account.json}`.
* **Where It Is Stored**:
  * **Moved outside the repository**: `~/.config/accessbelt/google-service-account.json` with file permissions `600`.
  * Never committed to git.
* **Cloud Project & Console**:
  * **Project**: Google Cloud Console linked to Google Play Console developer account.
  * **Console**: Google Play Console → API access → Service Accounts.
* **Restrictions**:
  * Scoped strictly to Google Play Android Developer API with release management permissions for `com.accessbelt.app`.
* **Who Can Rotate**: Google Play Console Account Owner.

---

## 7. App Session Identifier

* **Variable Name**: `EXPO_PUBLIC_APP_SESSION_ID`
* **What Uses It**:
  * Client session bootstrap and anti-tamper validation in `utils/auth.ts`.
* **Where It Is Stored**:
  * **Local**: `.env`
  * **EAS Cloud**: EAS Environment Variables (`production`, `preview`, `development`).
* **Restrictions**:
  * Application identifier token.
* **Who Can Rotate**: AccessBelt Lead Engineers.
