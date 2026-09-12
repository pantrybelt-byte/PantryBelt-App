# Changelog

## Build 24 — 2026-09-12

### Added
- Driving-safety disclaimer on onboarding's "Find Pantries Near You" slide: *"Safety Disclaimer: Do not use the AccessBelt map or interact with the application while driving. Please secure your vehicle in a safe location before searching for nearby resources."*

### Verified, no change needed
- **Auth session persistence** — already implemented (`firebase.ts` uses `initializeAuth` + `getReactNativePersistence(ReactNativeAsyncStorage)`); sessions already survive app restarts.
- **Location accuracy** — left as-is. iOS/Android grant the precise-vs-approximate choice to the end user at the OS permission prompt regardless of what the app requests; the app's current `Accuracy.High`/`Balanced` requests remain, preserving street-level map centering and "nearest pantry" sort accuracy.
- **Branding** — "AccessBelt" (one word) confirmed as the consistent name across UI, bundle ID, and legal copy, per the project's governance doc.
- **Console logs** — none present in app code.

### Not changed this build
- **Build number** — this project uses EAS remote build versioning (`eas.json` → `appVersionSource: "remote"`, `autoIncrement: true`); there is no local build-number field to hand-edit in `app.config.js`/`package.json`. Use `eas build:version:set` if a specific number needs to be forced.
- **Dependency versions** — left untouched for this release; a dependency audit/upgrade pass was deliberately deferred rather than run right before a TestFlight submission.
