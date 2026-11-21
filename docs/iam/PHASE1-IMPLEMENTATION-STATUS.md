# HR Position ID & IAM Foundation — Phase 1 Status

Date: 21 Nov 2026
Branch: feat/hr-position-id-sync-phase1
Base: feat/hr-position-iam-email-line

## Implemented in this branch

1. Added an additive schema migration for dynamic organizations/departments, application registry, permission catalog, roles, role-permission links, position-role bindings, scoped principal grants, sync outbox and IAM audit log.
2. Added stable department_id and optimistic version columns to HR positions.
3. Updated HR Position API to enqueue a versioned hr.position.created / hr.position.updated event in the same database transaction as the position write and audit records.
4. Added position sync queue status to the Position API read model.
5. Updated HR Position Master to show sync queue status, disable create/edit when the authoritative Position API is unavailable, and avoid silently using local fallback data for new employee assignment.
6. Updated employee save to require a successfully loaded authoritative Position Master and persist positionId plus positionCode, while retaining the legacy display label for compatibility.

## Important limitations — not yet complete

- The new migration has NOT been applied to Supabase.
- The updated Edge Function has NOT been deployed.
- The outbox has no worker/consumer yet; events remain pending until the IT-side consumer is implemented. UI must not label them Synced.
- The new normalized IAM tables are schema foundation only. IT Admin CRUD UI, app/permission catalog seeding, position-to-role assignment workflow and backend authorization enforcement remain pending.
- Existing it_position_permissions remains as a legacy compatibility path; it is not yet replaced.
- No business module is claimed as centrally enforced until its backend and RLS policies have been individually upgraded and tested.
- Email invitation registration and verified Email+LINE linking are not implemented in this phase.
- No change has been made to production login, LINE onboarding, Finance workflow or existing role enforcement.

## Required validation before UAT migration/deployment

1. Apply migration in a disposable test database and verify all constraints/RLS/grants.
2. Run static/type checks on hr-position-api.
3. Verify create/update position writes HR row, HR audit and outbox row atomically.
4. Verify duplicate position code returns a controlled conflict response.
5. Verify API denies unauthenticated users and non-HR users.
6. Verify HR user can create position but cannot activate IT grants.
7. Verify IT Admin can configure only approved role/permission mappings.
8. Verify employee records persist UUID positionId and preserve existing display values.
9. Verify a failed Position API prevents new/changed position assignments rather than persisting fallback IDs.
10. Run regression checks on Recruitment → Hire → Employee and HR ↔ Users synchronization.

## Safety decision

This phase is intentionally additive and isolated on a feature branch. Do not merge to main, apply the migration to the shared UAT project, or deploy the Edge Function until the Finance branch coordination and UAT test window are confirmed.