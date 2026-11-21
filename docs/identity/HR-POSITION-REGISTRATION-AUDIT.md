# HR Position, IT Permission and Registration Audit

## Scope reviewed
- `js/mod-hr.js`
- `js/hrsync.js`
- `js/it-control-center.js`
- `supabase/functions/it-control-center/index.ts`
- `js/onereg.js`
- `js/liff-fast.js`
- `js/email-otp.js`
- `register.html`
- `line.html`
- `clock.html`

## Findings

### HR positions
- HR position choices were a hardcoded array in `js/mod-hr.js`.
- Employee and recruitment forms shared the hardcoded list.
- Employee data stored a position label; no centrally managed position identifier was present.
- HR-to-Users synchronization in `js/hrsync.js` mirrors role, branch and status, but does not implement Position-to-Application-Permission provisioning.

### IT Control Center
- Existing IT Control Center manages theme rollout and stores an authentication policy profile.
- The current UI explicitly reports Authentication Enforcement as OFF.
- Existing endpoint authorizes Owner and edits theme/auth profile settings only.
- It did not provide a Position Permission Matrix or publish effective permissions to every application.

### LINE registration
- LINE registration exists in the LIFF flow: `liffLogin` returns registered or unregistered state; unregistered users enter the LINE registration screen.
- `js/onereg.js` displays the web username/PIN after LINE registration.
- This is evidence of a LINE registration flow, but account-linking and role/permission propagation still require end-to-end verification.

### Email registration
- `register.html` redirects to `clock.html?liff=1`; it is not an email registration form.
- `js/email-otp.js` implements email OTP for PIN setup/reset using `otpSend` and `otpVerify`.
- This is not equivalent to a new email-based account registration or an invitation acceptance flow.
- The backend implementation of `otpSend`, `otpVerify`, `liffLogin`, and LINE registration lives outside the tracked source in this repository's current tree (Back Office endpoint), so registration changes require a separately reviewed Back Office deployment and mail-provider configuration.

## Implemented in this branch
- Added `hr_positions`, `it_position_permissions`, and `hr_position_audit` schema migration.
- Seeded existing operational positions plus Final Verifier and Accounting.
- Added secured `hr-position-api` Edge Function:
  - HR/Owner/Admin can read Position Master.
  - HR/Owner/Admin can create/update Position Master.
  - Owner/Admin can create/update position permission mappings.
  - Mapping versions increment on update.
  - Position and permission changes create audit records.
- Added HR Position Master UI and linked employee/recruitment position selectors to the master list.
- Employee save records `positionId` and `positionCode` in addition to legacy position label.
- Added Position Permissions entry point to Owner IT Control Center.

## Important limitations / next integration gates
1. The new migration has not been applied to Supabase by this code change.
2. The new Edge Function has not been deployed.
3. Position permission mappings are configuration records only. They are NOT yet enforced by all existing application APIs. Do not represent this as end-to-end IAM completion.
4. `hrsync.js` still contains legacy role synchronization. It has not yet been changed to compute effective permissions from the new position mappings because existing application authorization is currently based on legacy role/perms fields and server-side Back Office logic.
5. Email self-registration is not implemented. Do not enable a public registration page until a secure invitation/verification API is added to Back Office or a dedicated auth service, with mail provider secrets, rate limiting, duplicate-identity protection and employee matching.
6. LINE registration currently uses the existing LIFF/Back Office flow. It must be tested against the same canonical employee/user identity before claiming unified Email + LINE login.

## Safe next steps
- Apply migrations in isolated UAT only.
- Deploy `hr-position-api` to UAT.
- Test HR create/edit/deactivate and IT permission mapping.
- Extend Back Office bootstrap and all relevant APIs to resolve effective permissions from approved mappings before activating cross-app enforcement.
- Implement email invitation + verified identity linking in Back Office using a configured mail provider.
- Test Email-first then LINE-link and LINE-first then Email-link against one employee/user identity.
- Keep production auth behavior unchanged until the complete UAT suite passes.
