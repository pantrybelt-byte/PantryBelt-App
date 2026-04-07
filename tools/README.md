# tools/ — Layer 3 (B.L.A.S.T.)

Reserved for **deterministic, atomic scripts** (e.g. Python or Node) when needed:

- Data seeding or exports
- API handshake / health checks
- Build or deploy automation

PantryBelt is currently a client-only Expo app; no scripts required yet. When adding any script:

1. Document the goal and I/O in `architecture/`.
2. Use `.env` for secrets; use `.tmp/` for intermediate files.
3. Keep scripts small and testable.
