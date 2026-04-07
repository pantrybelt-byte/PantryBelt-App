# PantryBelt — Task Plan (B.L.A.S.T.)

## North Star
One app that connects Alabama's Black Belt families to food pantries, SNAP/EBT, and Pantry Pete assistance—reliable on any device.

## Phases & Checklists

### Phase 1: Blueprint ✅
- [x] North Star defined
- [x] Integrations: in-app map (Apple MapKit on iOS), 211, external links (DHR, WIC, etc.)
- [x] Source of truth: local pantry data in `app/(tabs)/map.tsx`; profile state in React state
- [x] Delivery: Expo app (iOS/Android via Expo Go or build)
- [x] Behavioral rules: See `claude.md`

### Phase 2: Link
- [ ] Verify Expo/React Native toolchain
- [ ] Confirm map provider (Apple MapKit iOS, default Android)
- [ ] No backend yet; .env only if API keys added later

### Phase 3: Architect
- [x] App structure documented in `architecture/`
- [ ] Any new feature: update architecture SOP before code

### Phase 4: Stylize
- [x] Tab bar: full width, visible emojis, order Home → Map → Pete → Profile
- [x] Logo: single asset `assets/logo.png`; sign-in no extra background
- [ ] Future: user feedback on UI before release

### Phase 5: Trigger
- [ ] Build for TestFlight / Play (when ready)
- [ ] No cron/webhooks (client-only app unless backend added)

---
*Update this file when phases are completed or new work is planned.*
