# PantryBelt — Progress

## Done

- Expo 54 app with expo-router, tabs: Home (Info), Map, Pete, Profile.
- Sign-in screen; after auth/guest → `/(tabs)/home`.
- Map tab: 28 Alabama pantries, city filter, Apple MapKit on iOS, directions (Apple Maps / Google).
- Pantry Pete tab: mock Q&A (SNAP, WIC, recipes, pantries, 211); avatar image `assets/pete.png`.
- Profile: user can add/edit name, email, phone, address (Edit/Save); preferences toggles; resources links; sign out.
- Logo: single `assets/logo.png` (transparent badge); app icon, splash, in-app. Sign-in logo has no extra background; home has white circle behind logo.
- Tab bar: order Home → Map → Pete → Profile; full width; emoji labels visible (font 18, padding, overflow visible).
- B.L.A.S.T. applied: `task_plan.md`, `findings.md`, `progress.md`, `claude.md`, `architecture/`, `.tmp/`.

## Errors / tests

- Past: `babel-preset-expo` missing → added `babel-preset-expo@~54.0.10`.
- Past: `react-native-maps` missing → added to package.json.
- Past: expo-router 6 + peer deps conflict → kept expo-router ~5.
- Run: `npx expo start --go --port 8082` (or 8083 if 8082 in use).

## Next (optional)

- Persist profile fields (e.g. AsyncStorage).
- EAS Build for TestFlight / Play.
- Backend or CMS for pantry data.

---
*Log what was done, errors, and test results after each meaningful task.*
