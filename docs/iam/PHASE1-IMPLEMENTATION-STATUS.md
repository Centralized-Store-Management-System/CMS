# HR Position ID & IAM Foundation — Phase 1 Status

Date: 21 Nov 2026
Branch: feat/hr-position-id-sync-phase1
Base: feat/hr-position-iam-email-line

## Implemented in this branch / UAT

Updated: 21 Nov 2026, UAT project `ytxbnqosenolojifeikf`.

- Applied `dynamic_org_iam_foundation` migration to UAT (version `20261121150539`).
- Applied `iam_null_scope_unique_indexes` migration (version `20261121150758`).
- Deployed `hr-position-api` v3 to UAT. It now returns Position Master, Department Master and queue status; creates/updates positions transactionally with audit + outbox; supports department create/update; maps duplicate-key errors to HTTP 409.
- Seeded 10 draft application registrations, 2 draft roles (Final Verifier and Accounting), 3 departments, linked the 7 existing positions to departments, and created 2 draft position-role bindings. No active grants were created.
- Added `iam-admin-api` v1 to UAT and the owner-side Centralized IAM catalog UI on this feature branch. The API supports draft application/permission/role catalogs, role-permission assignment, draft position-role bindings and retrying failed outbox records. It explicitly rejects activating a position-role binding until protected backends enforce authorization.
- Added dynamic Department Master create flow to the HR Position Master UI on this feature branch.

## Implemented in this branch

1. Added an additive schema migration for dynamic organizations/departments, application registry, permission catalog, roles, role-permission links, position-role bindings, scoped principal grants, sync outbox and IAM audit log.
2. Added stable department_id and optimistic version columns to HR positions.
3. Updated HR Position API to enqueue a versioned hr.position.created / hr.position.updated event in the same database transaction as the position write and audit records.
4. Added position sync queue status to the Position API read model.
5. Updated HR Position Master to show sync queue status, disable create/edit when the authoritative Position API is unavailable, and avoid silently using local fallback data for new employee assignment.
6. Updated employee save to require a successfully loaded authoritative Position Master and persist positionId plus positionCode, while retaining the legacy display label for compatibility.

## Important limitations — not yet complete

- The feature branch UI has not been merged/deployed to the live Back Office / Owner site. UAT schema and Edge Functions are deployed, but the HR screen visible in the current live site may still be the previous version.
- The outbox has no per-application consumer/acknowledgement worker yet. Events remain pending; they are not synchronized across business applications.
- The IAM catalog UI/API currently creates and edits draft catalogs only. Permission catalog entries are not yet seeded because real module permission contracts have not been audited.
- Runtime authorization enforcement is not implemented in Finance, HR, Payroll, Inventory, Orders, Schedule, LINE or LIFF. Binding activation is intentionally blocked by the API.
- Email invitation registration and verified Email+LINE linking are not implemented. Existing Apps Script user identity and LINE onboarding remain unchanged.
- Full HR ↔ Users canonical identity sync and automated provisioning from position changes are not yet implemented.
- Existing it_position_permissions remains as a legacy compatibility path; it is not yet replaced.
- No business module is claimed as centrally enforced until its backend and RLS policies have been individually upgraded and tested.
- Email invitation registration and verified Email+LINE linking are not implemented in this phase.
- No change has been made to production login, LINE onboarding, Finance workflow or existing role enforcement.

## Required validation before opening HR UAT to the user

1. Publish the feature branch UI to a controlled UAT URL without merging unrelated feature work or Finance changes.
2. Run static/type checks on both Edge Functions and browser JavaScript.
3. Verify authenticated HR GET and create/update position requests.
4. Verify create/update position writes HR row, HR audit and outbox row atomically.
5. Verify duplicate position code returns HTTP 409.
6. Verify unauthenticated users and non-HR users are denied.
7. Verify HR can create a position but cannot activate IT grants.
8. Verify Owner/IT Admin can manage draft applications, permissions, roles and bindings.
9. Verify direct API calls cannot activate bindings; verify outbox retry and idempotency.
10. Verify employee records persist UUID positionId and preserve existing display values.
11. Verify failed Position API prevents new/changed position assignments rather than persisting fallback IDs.
12. Implement and test the per-application consumer/acknowledgement flow.
13. Implement verified Email invitation and LINE identity linking, then regression-test duplicate account prevention.
14. Run Recruitment → Hire → Employee and HR ↔ Users synchronization regression tests.

## Safety decision

This phase is intentionally additive and isolated on a feature branch. Do not merge to main, apply the migration to the shared UAT project, or deploy the Edge Function until the Finance branch coordination and UAT test window are confirmed.

## Phase 2 — HR ↔ Users position reference hardening

Branch: `feat/hr-position-user-sync-hardening`

- Updated the browser-side HR/User synchronization wrapper to propagate `positionId`, `positionCode`, and the legacy display label in both directions.
- Position-only changes do not clear legacy custom permissions; legacy permissions are cleared only when the legacy role itself changes.
- Existing role, branch, branch-access and employment-status synchronization behavior is retained.
- This is local application-state synchronization after the existing DB write. It does not claim a transactional server-side identity sync or cross-application IAM provisioning.
- Automated browser regression and live HR/Users account validation remain required before merge/deployment.


## Phase 3 — Runtime authorization evaluator foundation

Branch: `feat/iam-runtime-authorization-foundation`

- Added `iam-authorize` Edge Function and deployed version 1 to UAT project `ytxbnqosenolojifeikf`.
- Evaluator revalidates the existing CMS Back Office session, applies default-deny checks across active Application → Permission → Role → Principal Grant relationships, checks grant validity windows and requested scope, and writes allow/deny audit entries.
- No IAM grants or application activation were created. Current seeded applications and roles remain Draft.
- Position-role bindings are not resolved by this evaluator because canonical employee↔principal links and effective-dated employee assignments are not yet authoritative.
- No existing module has been changed to call this endpoint. It is not yet an enforcement boundary until each protected backend integrates it and fails closed.
- UAT authenticated positive/negative matrix remains pending; deployment status alone is not a security test.
