# Proposal: how `operatorUid`, `operatorPortalAccess` and `miniProfile` get set

Status: **proposal only, nothing built.** Needs your decision before any code.

## Today
- Nothing sets these fields. The app's green "Verified" tier needs `verified && operatorPortalAccess && miniProfile`, so no pantry can ever be green.
- Operators cannot set them: the portal self-service rule (`firestore.rules`, agencies update) only allows `phone, website, eligibilityNotes, hours, structuredHours, updatedAt, lastOperatorEdit`.
- **Gap found:** the *other* update path (`isOrgStaff() && hasOrgAccess(...)`) has no field allow-list, so any `org_staff`/`org_admin` in the pantry's org can currently write `operatorUid`, `operatorPortalAccess` and `verified` on that pantry through the client. This is pre-existing. Recommend closing it with a `diff().affectedKeys().hasOnly(...)` allow-list that excludes those three fields and `verified`, as its own rules commit.

## Proposed flow (server-owned, human-approved)
1. **Request.** A verified-email operator signs up in the portal and submits an access request for one pantry (pantry id, their name, contact email). Stored in `accessbelt-operator/accessRequests` (create-only by the requester, read by `state_admin`). No PII beyond what they type for this purpose; never copied to analytics.
2. **Review.** A `state_admin` reviews it in the Control Center (fits 3a/3d) and confirms the person really represents the pantry, e.g. by calling the pantry's listed number. That call is the same human check that earns `verified`.
3. **Approve (callable function, Admin SDK, `state_admin` only).** One function does all of this together so it cannot half-apply:
   - sets `agencies/{id}.operatorUid = <uid>` and `operatorPortalAccess = true`;
   - mints claims via the existing `grantOperatorAccess` logic (`role: org_staff`, `orgId`, `counties`, `pantryId`);
   - writes an `auditLogs` entry;
   - optionally sets `verified = true` if the reviewer confirmed the pantry exists (still a human decision, never automatic).
4. **`miniProfile`.** Set by the operator through the self-service path once approved: add `miniProfile` to the `hasOnly` allow-list with a shape check (map; known keys only such as `description`, `services[]`, `languages[]`; size limits; no precise location). Green tier then follows automatically from the three fields.
5. **Revoke.** A `state_admin` callable sets `operatorPortalAccess = false`, clears `operatorUid`, removes the claims. Pantry stays on the map, drops back to orange/grey.

## Decisions for you
1. Is a phone call to the listed number the identity check, or something lighter (email-domain match, magic link)?
2. One operator per pantry (`operatorUid` is a single string today) or several? Several means an `operatorUids` list and a rules change; I'd keep one for now.
3. Should `miniProfile` content be moderated before it goes green, or is operator-written text fine?
4. OK to close the org-staff field gap above as a separate rules commit?
5. The approve function would live in the portal repo's functions codebase (`operator-portal`) next to `grantOperatorAccess`, not in this repo's `default` codebase. Agree?
