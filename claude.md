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
- **Pantries:** Static array in `app/(tabs)/map.tsx`. Each item: `{ id, name, city, county, lat, lng, phone, address, hours, eligibility, docs, website }`.
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
| 2026-08-13 | Added optional real email/password accounts on top of the anonymous-auth base (`/(auth)/signin`, previously dead/unreachable code, now reachable from Profile → Account); anonymous→real upgrade preserves uid via `linkWithCredential()`. Added race field to `user_profiles`. |
| 2026-08-13 | Corrected Auth/Profile schema to match actual anonymous-auth architecture (was stale, predated `utils/auth.ts`); added `user_profiles/{uid}` demographic schema; dark-mode theming pass across all screens; added push notifications (`utils/notifications.ts`), which required `npx expo prebuild --clean` per invariant #1 ("no custom native modules without prebuild") — regenerated `ios/` was already untracked/gitignored, so this was low-risk. |
| (today)   | B.L.A.S.T. applied: task_plan, findings, progress, claude.md, architecture/, .tmp/ |
| 2026-08-10 | Entry point reverted to `/(tabs)/map` (was briefly changed to `/(tabs)/home`, then reverted per explicit request) |

---
*Only update this file when a schema, rule, or invariant changes.*
