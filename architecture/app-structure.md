# PantryBelt — App Structure (Layer 1 SOP)

## Goal

Define how the Expo app is organized so new features and fixes stay consistent.

## Inputs

- User opens app → `app/index.tsx` redirects to sign-in or (if we add auth check) tabs.
- Sign-in / Guest → `router.replace('/(tabs)/home')`.

## Structure

```
app/
├── index.tsx              → Redirect to (auth) or (tabs)
├── _layout.tsx            → Root Stack: ThemeProvider, StatusBar, (auth), (tabs)
├── (auth)/
│   └── signin.tsx         → Logo, email/password, Apple, Guest → (tabs)/home
└── (tabs)/
    ├── _layout.tsx        → Tab bar: Home, Map, Pete, Profile (order fixed)
    ├── home.tsx           → Info: logo, stats, announcements, quick links, Ask Pete CTA
    ├── map.tsx            → MapView, pantry markers, city filter, detail modal, Ask Pete CTA
    ├── pete.tsx           → Chat UI, mock replies, quick questions, 211 button
    └── profile.tsx        → User card (edit name/email/phone/address), prefs, resources, sign out

assets/
├── logo.png               → App icon, splash, in-app logo (single source)
├── pete.png               → Pantry Pete avatar
└── background.png         → Auth/header background

context/
└── ThemeContext.tsx       → dark, toggle, bg, card, text, subtext, border, input
```

## Tool logic (for future automation)

- **Build:** `npx expo start` for dev; EAS Build for production.
- **No `tools/` Python scripts required** for current client-only app. If we add data pipelines or backend jobs, add scripts under `tools/` and document here.

## Edge cases

- **Tab bar:** Use full width and sufficient padding so emoji labels don’t clip on small devices.
- **Logo:** Sign-in uses transparent container; home can use white circle behind logo.
- **Map:** If Expo Go shows Google on iOS, production build will use MapKit when provider is default.

---
*If app structure or navigation changes, update this SOP before changing code.*
