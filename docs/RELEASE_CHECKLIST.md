# Release Checklist

## Pre-Release / Production Deployment
- [ ] **Turn off map diagnostics before public release.** Set `SHOW_MAP_DIAGNOSTICS = false` in `app/(tabs)/profile.tsx`.
- [ ] Confirm `app.config.js` version and version codes (`versionCode` for Android, `buildNumber` for iOS).
- [ ] Confirm production signing certificates and SHA-1 fingerprints in Google Cloud Console & Firebase.
- [ ] Verify Maps SDK and Places API quotas / billing status.
- [ ] Review Google Play Console Pre-Launch Report and App Store Connect TestFlight feedback before production rollout.
