# UAT Test Plan — Dynamic HR Position & IAM

Environment: Supabase UAT `ytxbnqosenolojifeikf`  
Feature branch: `feat/hr-position-id-sync-phase1`

> Do not run this test against production. The feature-branch frontend must be published to a controlled UAT URL before executing browser steps.

## A. HR Position Master

1. Sign in as an Owner or HR account.
2. Open HR → Positions and use Refresh / Retry if the initial load is not complete.
3. Confirm the existing seven positions load from the server, including Final Verifier and Accounting.
4. Confirm Department Master contains Operations, Finance and Finance & Accounting.
5. Create a temporary test department (for example `UAT_QA`) and verify it appears in the Department selector.
6. Create a temporary position with a unique code (for example `UAT_QA_01`), choose the test department and save.
7. Confirm the position appears with a stable UUID, version 1, and a Pending queue indicator.
8. Edit the same position and verify the UUID is unchanged and version increments to 2.
9. Attempt to create a second position using the same Position Code. Expected: HTTP 409 / controlled duplicate message; no duplicate row.
10. Inactivate the temporary position after testing. Do not delete positions referenced by employees.

## B. Employee Assignment

1. Open HR → Employees and create a temporary test employee or edit a designated UAT test employee.
2. Select the new active position.
3. Save and verify the employee record contains `positionId` (UUID), `positionCode`, and the legacy display label.
4. Confirm that a failed Position API load prevents a new or changed position assignment rather than silently using hardcoded fallback positions.
5. Verify Recruitment → Hire → Employee still works.

## C. Centralized IAM Catalog

1. Sign in as Owner and open Owner Console → IT Control Center → Centralized IAM.
2. Confirm the 10 draft application registrations are present.
3. Confirm draft roles `finance_final_verifier` and `accounting_operator` are present.
4. Confirm the two position-role bindings exist for Final Verifier and Accounting, both Draft.
5. Add a test Role and Permission, then assign the Permission to the test Role.
6. Bind the test Role to the temporary position. Expected: binding remains Draft.
7. Attempt to activate a binding through the API. Expected: HTTP 409 until server-side authorization is implemented in the target modules.
8. Confirm only Owner / Admin can access the IAM API; HR and Staff must receive 403.

## D. Security and regression gates

- Unauthenticated requests must receive 401.
- HR can create/update HR positions but cannot edit IAM roles, permissions or bindings.
- No role, permission or position binding is automatically activated by creating a position.
- New IAM tables are not directly exposed to anon/authenticated roles; backend service access only.
- No changes to Finance workflows, production authentication, LINE onboarding or Email registration are part of this UAT slice.
- An Outbox item marked Pending is queued only. Do not treat it as synchronized across applications until a per-application consumer acknowledges delivery.


## E. HR ↔ Users position reference regression (Phase 2)

1. In UAT, edit a test employee and assign an active Position Master record.
2. Save and verify employee `positionId`, `positionCode`, and legacy `position` label.
3. Verify the linked Users record receives the same three fields without changing username, PIN, LINE linkage, branch scope, or status.
4. Change only the employee position; verify existing legacy `perms` on the user are not cleared.
5. Change the employee legacy role; verify existing role-specific legacy `perms` are cleared as before.
6. Edit the linked Users record's position reference and verify the employee's three position fields update.
7. Repeat with an employee who has no linked Users record; verify the HR save succeeds and no unrelated user is changed.
8. Confirm a failed DB write does not trigger the local mirror update (the wrapper mirrors only after the original upsert resolves).
