# Architecture notes — Operator Portal & Control Center groundwork

Written 2026-10-13 from a read-only survey of the repo. Nothing was run, deployed or changed other than adding this file. Items marked **(verify)** were inferred from code, not observed running.

## 1. How the Operator Portal is built today

- **Location:** `Operator-Portal/` inside this working directory, but it is **a separate git repo** (own `.git`, own `package.json`) and is **gitignored by this repo** (`.gitignore` lines 36–37). Commits made here will not include portal changes; portal changes need commits inside `Operator-Portal/`.
- **Stack:** Vite 8 + React 19 + TypeScript + Tailwind 4 + react-router-dom 7 + Leaflet + lucide-react. It is **not** Expo web. Hosting is Vercel (`vercel.json`), not Firebase Hosting.
- **Data layer:** `src/data/repository.ts` defines a `DataRepository` interface with two implementations: `MockRepository` (default) and `FirestoreRepository`, selected by `VITE_USE_FIREBASE`. The Firestore implementation is documented in its own header as **never run against a real project**.
- **No real-time listeners.** `grep onSnapshot` over `Operator-Portal/src` returns nothing. `useWorkspace` does a one-shot `loadWorkspace()` (`getDoc`/`getDocs`), then applies optimistic updates and rolls back on failure. A change made elsewhere never appears until reload.
- **Two code paths write pantry data, and they disagree** (see §2.3).
  1. `FirestoreRepository` (Shift Mode, Hours, Profile, etc.) targets collection `resources`.
  2. `src/pages/PantryAdmin.tsx` ("Phase 5") targets collection `agencies` directly via `getDoc`/`updateDoc`, bypassing the repository.
- **Portal Cloud Function:** `Operator-Portal/functions/index.js` exports `grantOperatorAccess` (callable; mints `role`, `orgId`, `counties`, optional `pantryId` claims). Its Firebase codebase is `operator-portal`, separate from this repo's `default` codebase.
- **Other tooling:** `scripts/bootstrap-first-admin.mjs` (first `state_admin` claim). No tests, no emulator config, no a11y tooling in the portal.

## 2. Firestore collections

Production project is `pantrybelt-1e7eb`. Three databases are involved:

| Database | Owner / deploy source | Rules file |
|---|---|---|
| `(default)` | this repo (`firebase.json`, CI deploy) | `firestore.rules` |
| `accessbelt-agency` | this repo | `firestore.agency.rules` (deny-all stub, no schema) |
| `accessbelt-operator` | **Operator-Portal repo only** (CI here deliberately never deploys it) | `Operator-Portal/firestore/operator.rules` |

### 2.1 Mobile app (reads/writes)
- `agencies` (read, `where status == active`): `map.tsx:400`, `utils/pantries.ts`, `context/StatsContext.tsx`. Fields per `CLAUDE.md`, including `hours` (string or per-day object), `eligibilityNotes`, `phone`, `website`, `socialMedia`, `operatorPortalAccess`, `miniProfile`, `verified`.
- `user_profiles/{uid}`, `_app_sessions/{uid}`, `feedback`, `analytics_*` and `analytics/*/events` (create-only, session-gated), `waitlist`.
- The mobile app **never reads `resources`, `liveStatus`, `structuredHours` or `lastOperatorEdit`** (grepped `app/`, `utils/`, `context/`).
- The mobile app uses **no `onSnapshot`**; reads are `getDocs`. So "updates within a couple of seconds in the running app" needs mobile changes too, not just the portal.

### 2.2 Portal (reads/writes)
- `(default)/resources`: `FirestoreRepository` reads/writes pantry identity, address, hours (weekday map), coordinates, `verificationTier`, `familiesReached`, `liveStatus.*`.
- `(default)/agencies`: `PantryAdmin.tsx` queries `operatorUid == uid && operatorPortalAccess == true`, writes `phone, website, eligibility, hours (string), structuredHours, updatedAt, lastOperatorEdit`.
- `(default)/users`, `(default)/organizations`: team list and invites.
- `accessbelt-operator`: `events`, `liveStatus`, `broadcasts`, `closures`, `activity`. Everything is scoped by `orgId` + `pantryId`.
- **Index/rules mismatch:** the portal's own doc says `FirestoreRepository` needs composite indexes in `operator.indexes.json`; only the portal repo deploys them.

### 2.3 Schema disagreements that block the Phase 1 goal
1. **Wrong collection.** The mobile app moved `resources` → `agencies` on 2026-08-25. `FirestoreRepository` still writes `resources`. Anything an operator edits through Shift Mode / Hours / Profile reaches no phone. Only `PantryAdmin.tsx` writes the right collection.
2. **Wrong field name.** Portal writes `eligibility`; mobile reads `eligibilityNotes`. The rule allow-list (`validOperatorSelfServiceFields`) also names `eligibility`, so fixing it means a rules change (needs your approval and emulator tests).
3. **Hours shape.** Portal writes `hours` as a string plus `structuredHours` (map). Mobile reads `hours` (string or per-day object) and ignores `structuredHours`. The string is probably fine; `structuredHours` is dead weight on the phone. **(verify)** whether `PantryAdmin` generates the string from the structured form.
4. **Live status.** `liveStatus` is written to `resources` and the operator DB, never read by the phone. Also, the operator-DB `liveStatus` write and the shared-DB mirror write are two separate non-atomic writes, so a partial failure is possible.
5. **Status vocabulary.** Portal `ResourceDoc.status` includes `unopened|pending|active|inactive|closed`; the app shows only `active`. Setting `closed` hides the pin. That may be exactly intended, but confirm.
6. **Green-tier plumbing exists on one side only.** `operatorPortalAccess`, `operatorUid`, `miniProfile` drive the app's green "Verified" tier (`pantryTier()`). `CLAUDE.md` says nothing sets them. Nothing in the portal sets them either, and `operatorUid` is **absent from `CLAUDE.md`'s agencies schema and from `validAgencyOptionalFields`**.

## 3. Auth and operator vs. user

- **Mobile users:** Firebase Anonymous Auth on every launch (`utils/auth.ts`), optional email/password link-up.
- **Operators:** Firebase email/password sign-in in the portal; authority comes from **custom claims** `role` (`state_admin|org_admin|org_staff|read_only_partner|field_worker`), `orgId`, `counties` (+ optional `pantryId`) minted by `grantOperatorAccess`. A user with no `role`/`orgId` gets a "not set up as operator" error.
- **No `admin: true` claim exists anywhere.** The closest thing is `role == 'state_admin'`. The prompt's Control Center gate (`admin: true`) is a new claim; decide whether to reuse `state_admin` instead (recommended, fewer concepts and the rules helper `isStateAdmin()` already exists).
- Rules additionally require `email_verified == true` for any operator write (`operatorWriteAllowed()`).

## 4. Security rules: current state and gaps

- `(default)` rules are extensive (≈530 lines) with a rules test suite at `tests/rules/firestore.test.js` (`npm run test:rules`, own emulator config on port 8085).
- **Gaps / things to watch:**
  1. Volunteer vs. Shift Lead is **UI-only**; both map to `org_staff` (acknowledged in `permissions.ts` and the integration doc).
  2. `agencies` update has two paths. The portal self-service path requires `operatorUid == request.auth.uid` and `request.time` for both timestamps, so any write not using `serverTimestamp()` fails. The portal's `PantryAdmin` does use it.
  3. `resources` still has live rules but the app doesn't use it. It is dead surface area with write access for org staff.
  4. `users` create/update lets org admins create docs, and `inviteTeamMember` writes an invite doc, but nothing consumes it. Invites currently do not grant access. **(verify)** whether `grantOperatorAccess` is ever invoked from the UI; grep suggests not.
  5. `auditLogs` is read-only to `state_admin`; nothing writes it from the client by design.
  6. No server-side bounds on `agencies.hours` beyond ≤300 chars on the self-service path. Fine.
- Portal DB rules (`operator.rules`) have no tests and no `email_verified` requirement, unlike `(default)`.
- `.env` in the repo root holds real keys (gitignored, confirmed by `git status` being clean). Not touched or printed.

## 5. Firebase config and environments

- **No separate dev/staging project.** `.firebaserc` in both repos only lists `default: pantrybelt-1e7eb` (production). `firebase.ts` hard-codes `projectId: 'pantrybelt-1e7eb'` and has **no emulator connection code** (no `connectFirestoreEmulator`/`connectAuthEmulator`).
- Mobile config: `firebase.ts` / `config/firebase.ts`, key from `EXPO_PUBLIC_FIREBASE_API_KEY`.
- Portal config: `src/services/firebase.ts`, from `VITE_FIREBASE_*`. Opening a named database uses `getFirestore(app, 'accessbelt-operator')`.
- Emulators declared: auth 9099, functions 5001, firestore 8080 (`firebase.json`); rules tests use 8085. `firebase.json` has **`singleProjectMode` unset** for the main emulator config, and a `firestore-debug.log` shows an emulator was used locally on 2026-09-29. The portal repo declares **no emulators**.
- Because production is the only project, "emulators only" (your stated fallback) is the plan. That requires adding emulator wiring to both clients behind an explicit env flag, defaulting off, and refusing to start with the flag on if the project id looks like production.
- The `(default)` DB also has 8 BigQuery export extensions on analytics collections. Not touched by this work.

## 6. Constraints from `CLAUDE.md` that shape the plan

- Platform scope is **Users + Agencies only** (Operating Agreement Art. VII). The Control Center is internal admin tooling for the company, which looks in-scope, but anything exposing data to a third constituency is not.
- Privacy §6.5: **no precise location, county-level only**, and any change to *data collection practices* is a unanimous-consent Major Decision. Friction events about operators/agencies are arguably agency-side and acceptable, but I'd want your call on whether Phase 3b needs both Members' sign-off. Nothing about end-users (the mobile app) should be added.
- Accessibility: public WCAG 2.1 AA commitment applies to the app; the portal inherits the same promise by reasonable extension.
- Tab order, single logo asset, and "don't change pantry data without updating architecture" are mobile-side rules, but changing which collection operators write to is a pantry-data architecture change, so `CLAUDE.md` must be updated alongside.

## 7. Proposed phased plan (awaiting your OK)

**Phase 0 (prereq, small).** Emulator harness for both repos: `connect*Emulator` behind an explicit flag with a production-id guard; seed script that loads a handful of fake `agencies` plus a test operator with claims. No schema changes.

**Phase 1. Sync.**
1. Propose one shared types file (`agencies` doc shape) and list the diffs from §2.3. **Decision needed from you:** (a) point `FirestoreRepository` at `agencies` and retire `resources` writes (recommended), and (b) rename portal `eligibility` → `eligibilityNotes`, which needs a rules allow-list change as its own commit with emulator tests.
2. Portal: replace one-shot loads with `onSnapshot` (with unsubscribe on unmount, offline/permission-denied/failed-write banners; keep the existing optimistic-rollback behavior).
3. Mobile: the pantry detail/pin currently reads via `getDocs`. For the "within a couple of seconds" criterion either switch the map's agencies read to `onSnapshot` (bandwidth and cost impact on a ~880-doc query for every user, **needs your decision**) or listen only to the single open pantry's doc. I recommend the single-doc listener.
4. Test: emulator script that writes via the portal repository and asserts the mobile query/mapper sees it; plus a manual script.

**Phase 2. Portal UI.** Responsive and WCAG pass, axe in CI (needs a new dev dependency, e.g. `@axe-core/playwright`, so I'll ask first), hosting config. Note the portal is on **Vercel**, so `docs/DEPLOY.md` should describe Vercel, not Firebase Hosting, unless you want to move it.

**Phase 3. Control Center.** Gate on `state_admin` claim (or new `admin`), enforced in rules and functions. Order as you specified: 3a dashboard, 3b funnel events (storage proposal first), 3c sandbox toggle with production hard-block, 3d bounties board, 3e Horse design doc only.

## 8. Decisions I need from you

1. Approve retargeting portal writes from `resources` to `agencies` (and eventually deprecating `resources`).
2. Approve a rules change so operators can write `eligibilityNotes` (or tell me to adapt the portal to the existing `eligibility` and change the mobile read instead).
3. Mobile live updates: single-doc listener (recommended) vs. a full `onSnapshot` on the map query.
4. Reuse `state_admin` for Control Center access, or mint a new `admin: true` claim?
5. Where should Phase 1 changes to `Operator-Portal/` be committed, given it is a separate repo? (I assume its own repo and commits; this repo's `.gitignore` is untouched.)
6. The three `[FILL IN]`s from your prompt were left blank. I'm assuming: dev project = **emulators only**; branding = **match the existing theme**; deployment target = **keep Vercel**. Say if any is wrong.
7. Does the Phase 3b operator-funnel tracking need unanimous Member consent under Operating Agreement §6.5, in your view?
