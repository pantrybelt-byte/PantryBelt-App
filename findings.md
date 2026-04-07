# PantryBelt — Findings

## Research & discoveries

- **Expo SDK 54** — Use `expo@~54`, `react-native@0.81`, `babel-preset-expo@~54.0.10`. `expo-router@6` can conflict with peer deps; `~5.0.0` is stable.
- **react-native-maps** — On iOS, default provider is Apple MapKit. Use `mapType="mutedStandard"` for Apple style. Directions: open `maps.apple.com` on iOS, Google Maps on Android.
- **Tab bar** — Use fixed `backgroundColor: '#ffffff'`, `tabBarContentContainerStyle` / `tabBarItemStyle` for full width. Font size 18–22 and `paddingBottom: 20` help prevent emoji/label clipping.
- **Logo** — Single asset `assets/logo.png` for icon, splash, and in-app. Sign-in: `backgroundColor: 'transparent'` on container so no extra background. Home header: white circle behind logo optional.

## Constraints

- No backend; auth is in-memory (sign in / guest → home).
- Pantry list is static in `map.tsx`; no CMS/API yet.
- Pantry Pete is mock keyword replies; no LLM/API key.
- Expo Go for development; production requires EAS Build or similar.

## Open questions

- Persist profile (name, email, phone, address) to AsyncStorage or backend?
- Add real auth (e.g. Supabase, Firebase)?
- Add API or CMS for pantry data?

---
*Append new findings here. Update when constraints or discoveries change.*
