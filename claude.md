# PantryBelt — Project Constitution (claude.md)

**This file is law.** Update only when schemas, rules, or architecture change.

---

## Data schemas

### App state (in-memory unless noted)

- **Auth:** No persistent user; "Sign In" / "Continue as Guest" both route to `/(tabs)/home`. No token or session stored.
- **Profile:**
  - `displayName: string`
  - `email: string`
  - `phone: string`
  - `address: string`
  - Stored in component state only; not persisted unless we add AsyncStorage/backend.
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
4. **Tab order:** Always Home → Map → Pete → Profile. Entry after auth: `/(tabs)/home`.

---

## Architectural invariants

1. **Expo Router:** Entry is `app/index.tsx`; tabs live under `app/(tabs)/`; auth under `app/(auth)/`. No custom native modules without prebuild.
2. **Assets:** `assets/logo.png` = app icon, splash, and in-app logo. `assets/pete.png` = Pantry Pete avatar. `assets/background.png` = sign-in / header background.
3. **Theme:** `context/ThemeContext.tsx` provides light/dark; tab bar uses fixed light style for visibility.
4. **Map:** `react-native-maps`; iOS uses MapKit (default provider, optional `mapType="mutedStandard"`).

---

## Maintenance log

| Date       | Change |
|-----------|--------|
| (today)   | B.L.A.S.T. applied: task_plan, findings, progress, claude.md, architecture/, .tmp/ |

---
*Only update this file when a schema, rule, or invariant changes.*
