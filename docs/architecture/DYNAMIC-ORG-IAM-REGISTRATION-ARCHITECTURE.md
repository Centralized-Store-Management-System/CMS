# Dynamic Organization, IAM & Identity Architecture

Status: DESIGN BASELINE — phased implementation; this document does not change production authentication or authorization.
Date: 21 Nov 2026
Repository: Centralized-Store-Management-System/CMS

## 1. Product decision

The future organization is unknown. Do not encode today's departments, positions, role names, application names, approval levels, or login providers as fixed source-code assumptions.

Use configuration-driven architecture, but never permission-by-label. HR owns organizational facts; IT owns access policy; each application enforces its registered permissions on the server; Workflow owns approval routing; Authentication owns verified identities.

Core rule: Create once → publish configuration → evaluate centrally → enforce at each protected backend.

A new position, department, organization, application, permission, or workflow step should be configurable through administration UI where practical. A new application capability may still require code to implement the capability itself; registering a module must never magically create functionality that does not exist.

## 2. Bounded contexts and sources of truth

| Domain | Source of truth | Owns | Must not own |
|---|---|---|---|
| Organization / HR | HR master | Organizations, business units, departments, positions, employee records, effective-dated assignments, employment status | Application privileges |
| Identity | Auth / Identity service | Canonical principal, verified Email identity, LINE subject, provider linking, recovery, invitations | Job title or business permissions |
| Access control (IAM) | IT Control Center | Applications, permission catalog, roles/bundles, position-to-role policy, user grants, data scopes, policy versions | Employee identity facts |
| Workflow | Workflow service | Workflow definitions, stages, approver resolution, delegation, thresholds, separation-of-duties | Credentials or UI-only approval |
| Business applications | Each module backend | Domain data and actions; server-side authorization | Duplicated local role masters |

HR is the origin for employee/position records. IT is the sole administrative control plane for access. Each module backend enforces the resolved permission. Hiding a menu is never authorization.

## 3. Dynamic data model

Use stable UUID identifiers and effective-dated relationships. Preserve legacy identifiers during migration.

### Organization
- organizations: id, code, name, status, metadata
- business_units: id, organization_id, parent_id, code, name, status
- departments: id, organization_id, business_unit_id, parent_id, code, name, status
- positions: id, organization_id, department_id, code, names, description, status, version
- employee_position_assignments: employee_id, position_id, org/unit/department scope, branch scope, valid_from, valid_to, assignment status, recorded_by

A position definition is not an employee assignment. Preserve history by closing the previous assignment and creating a new effective-dated assignment.

### Identity
- principals: one canonical internal identity per person/account
- principal_identities: principal_id, provider (email / line / future provider), provider_subject, normalized_identifier, verified_at, linked_at, status
- employee_principal_links: employee_id, principal_id, link_status, verified_by, linked_at
- invitations: employee_id, destination, provider, token_hash, expires_at, accepted_at, status
- identity_audit: actor, principal, action, before/after metadata, timestamp

Enforce uniqueness for provider + provider_subject and one active employee link per principal/employee according to the approved account policy. Never link by display name alone. Never store raw OTPs, invitation tokens, or credentials.

### IAM
- applications: application_key, display_name, owner, status, integration_version, metadata
- permission_catalog: application_key, permission_code, resource, action, description, risk_level, status
- roles: role_key, name, description, status, version
- role_permissions: role_id, permission_id, constraints
- position_role_bindings: position_id, role_id, scope template, status, effective dates
- principal_role_grants: principal_id, role_id, scope, valid_from, valid_to, grant source, status
- policy_versions / access_audit: immutable version and change history

Existing it_position_permissions may act as a compatibility adapter during migration; do not create a competing permission master without a migration plan.

Position != Role != Permission != Scope. A position may map to zero or more role bundles. A person may have additional time-bound grants. Every grant has explicit scope. Default is deny.

### Workflow
- workflow_definitions: workflow_key, application_key, version, status
- workflow_stages: workflow_id, stage_key, order, stage_type, resolver_type, resolver_config, required_count, conditions
- workflow_instances: business record, current stage, assignee snapshot, status
- workflow_actions: actor, action, timestamp, comments, policy version

Support configurable approval stages and thresholds. Enforce maker-checker and separation-of-duties in the backend. Final Verifier is a position label; authority is granted by IT and consumed by a workflow stage policy. Do not hardcode a fixed number of approval levels.

## 4. Runtime access decision

For every protected request, the backend evaluates:
1. Is the principal authenticated and active?
2. Is the employee link valid, if employee-only access is required?
3. Is employment/assignment active at the requested effective time?
4. Which active role grants apply?
5. Does the grant include this application/resource/action?
6. Is the requested record within organization/branch/department scope?
7. Are there separation-of-duties, workflow-stage, or explicit deny constraints?
8. Is the policy version current enough for this action?

Return allow/deny plus reason code and policy version. Sensitive writes fail closed when IAM cannot be evaluated. UI navigation may consume effective permissions for display, but is not the enforcement layer.

Position transfer and revocation must invalidate/re-evaluate cached grants. Define a short maximum cache TTL and revocation event. Do not rely only on stale JWT custom claims for high-risk financial authorization.

## 5. HR → IT provisioning contract

HR creates or changes a position/employee assignment. The write commits HR data and an outbox event in the same database transaction. A worker delivers an idempotent event to IT.

Events include schema version, event id, aggregate id, aggregate version, event type, timestamp and actor. IT consumes the event idempotently and updates its read model / mapping eligibility. Failed delivery is retried and visible in an admin sync monitor.

Creating a position MUST NOT automatically grant permissions. It creates an eligible position in IT. An authorized IT Admin configures and activates role bindings. Employee assignment changes trigger recomputation and revocation of stale access.

Do not make HR depend on every application being online. Use outbox/retry/dead-letter handling and show sync status (Pending / Synced / Failed) with safe retry.

## 6. Initial Finance positions

Seed or reconcile idempotently by immutable code:
- FINAL_VERIFIER — Final Verifier, Finance
- ACCOUNTING — Accounting, Finance & Accounting

These are organizational positions only. They must not receive active permissions merely because they exist. IT explicitly maps each to approved permission bundles and scopes.

For Finance:
- Final Verifier is a separate final-check stage; no self-verification of records they created or materially edited.
- Accounting receives only implemented and approved accounting functions. Future GL, journal, AP/AR, tax and reports are separate permission catalog entries; do not grant future functions before they exist.
- Approval authority and accounting preparation remain separable.

## 7. Email and LINE registration

Both methods resolve to the same canonical principal and Employee ID, not duplicate users.

### Employee onboarding
1. HR creates employee and sets active/invited status.
2. HR assigns position and organizational scope.
3. IT computes eligible access (default deny until approved).
4. System creates a single-use, expiring invitation bound to employee + destination/provider.
5. Email verifies mailbox ownership; LINE verifies the ID token server-side (issuer, audience, signature, nonce/state).
6. Employee proves control of the HR-approved destination/invitation. Never match solely by name, phone or display name.
7. Provider identity links to the canonical principal with uniqueness constraints and audit.
8. Login through either provider resolves the same principal, employee status and current IAM grants.

### Linking the second provider
An already linked account must be authenticated and step-up verified before adding another provider. Email linking requires verified email; LINE linking requires verified LINE identity. Recovery and unlinking require secure proof and audit.

### Registration safety
- No unrestricted public employee self-registration.
- Do not expose whether an employee code/email exists (avoid account enumeration).
- Rate-limit invitation, OTP, verification and recovery endpoints.
- Hash one-time tokens; store expiry and single-use state server-side.
- Existing email OTP for PIN reset is not proof that employee registration exists.
- Keep existing LINE registration and Back Office login intact until unified flow passes UAT and has rollback.

## 8. Application integration contract

Each application registers its application key and owner, permission catalog/schema version, protected backend actions/resources, supported principal types, scope resolver, policy-decision integration and health/compatibility status.

A module is not integrated merely because it appears in IT UI. It is integrated only when its backend checks permissions for all protected read/write paths, data scope is enforced, and automated negative tests prove unauthorized access is denied.

## 9. Security and operations

- Default deny; least privilege; no client-only authorization.
- RLS on exposed tables; service-role keys never enter browser code.
- No authorization decisions from user-editable metadata.
- Immutable audit for position, assignment, role, permission, identity-link, workflow and revocation changes.
- Separate maker/checker for high-risk Finance changes.
- Idempotency keys and concurrency/version checks on writes.
- Soft-deactivate positions with active assignments; block deletion if referenced. Preserve history.
- Version policies; rollback configuration without resurrecting revoked users.
- Exports and audit views respect the same scope.
- Alert on failed sync, stale grants, identity-link conflicts and policy evaluation failures.

## 10. Migration and rollout plan

### Phase 0 — Inventory and safety
- Audit HR, Users, IT, Finance, LINE, Email, Back Office and Line-Order entry points.
- Identify authoritative employee/user stores and actual authorization checks.
- Verify UAT migrations/functions and branch divergence.
- Do not change production auth or deploy production permission enforcement.

### Phase 1 — HR master stabilization
- Replace hardcoded position fallback with database-backed master and explicit loading/error states.
- Persist immutable position IDs in all employee/recruitment save and sync paths.
- Add assignment history and deactivation safeguards.
- Verify HR → Users mapping without breaking legacy role behavior.

### Phase 2 — IAM registry and compatibility adapter
- Register applications and permission catalogs.
- Normalize role bundles, position-role bindings and scopes.
- Bridge existing role/perms fields while each backend is upgraded.
- Keep enforcement OFF until each app passes tests.

### Phase 3 — Backend enforcement
- Upgrade one module at a time. Finance integration must be coordinated with Claude's active Finance branch before shared-file edits.
- Test allow/deny, cross-branch isolation, revoked users, stale sessions, direct API calls and RLS.
- Publish app integration status with evidence.

### Phase 4 — Workflow engine
- Move approval stages to versioned workflow definitions.
- Configure Final Verifier and Accounting responsibilities through data, not hardcoded position-name checks.
- Verify maker-checker and no-self-approval.

### Phase 5 — Unified Email + LINE identity
- Implement invitation and provider linking in the authoritative authentication backend. Confirm ownership of Back Office endpoints before changing them.
- Keep old flows active during UAT; switch only after real-account tests and rollback are ready.

### Phase 6 — Expand
- Add organization, department, position, role, permission, module, provider or workflow stage through configuration.
- Add code only when a genuinely new business capability is required.

## 11. Definition of Done

- HR positions have stable IDs and effective-dated assignments.
- IT configures and activates permission bundles/scopes without hardcoded position names.
- Every claimed application enforces access server-side and denies unauthorized direct API access.
- Transfer, suspension and termination revoke stale access within a defined SLA.
- Email and LINE authenticate the same canonical employee account, with verified and audited linking.
- Workflow steps are configurable and enforce separation of duties.
- UAT covers positive, negative, cross-scope, concurrency, retry, duplicate, recovery and rollback cases.
- Production behavior remains unchanged until approved cutover.

## 12. Verified baseline (21 Nov 2026)

The branch feat/hr-position-iam-email-line contains:
- hr_positions, it_position_permissions and hr_position_audit migrations and a seed for seven positions including Final Verifier and Accounting.
- hr-position-api source and HR Position Master UI.
- Employee/recruitment selectors use Position Master with a compatibility fallback.
- Position permission records are configuration only; not all application APIs enforce them.
- HR-to-Users synchronization has not yet been upgraded to resolve effective position grants.
- LINE registration exists in the existing LIFF/Back Office flow, but canonical identity linking needs end-to-end proof.
- register.html redirects to LINE onboarding; it is not Email registration.
- email-otp.js is for PIN setup/reset, not invitation-based employee registration.

Live UAT project ytxbnqosenolojifeikf was inspected read-only on 21 Nov 2026:
- migrations 20261121144925 and 20261121144928 are recorded as applied;
- Edge Function hr-position-api is ACTIVE v1;
- this verifies deployment state only, not full application security or end-to-end behavior.

No production migration, production function deployment, production authentication switch, or production permission enforcement is authorized by this plan.
