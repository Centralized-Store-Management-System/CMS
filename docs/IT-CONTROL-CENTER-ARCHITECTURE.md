# IT Control Center — System Scope & Deployment Blueprint

Status: PHASE A COMPLETE / PHASE B ISOLATION BASELINE — Owner Theme now has a dedicated stylesheet entry point; no runtime switches or authentication behavior changed.
Date: 20 Nov 2026

## 1. Purpose
Create one Owner-only IT Control Center that governs rollout boundaries. Every setting is scoped independently by:
1. Product/system
2. User class
3. Delivery surface (web or installed PWA/app)
4. Device class (PC, mobile, iPad/tablet)
5. Capability (theme, authentication policy, feature availability, deployment version)

A setting must never propagate to another system merely because two pages share a CSS or JavaScript asset.

## 2. Repository inventory (observed)
| Product / entry point | Primary audience | Surface / role | Notes |
|---|---|---|---|
| owner.html | Owner only | Owner Console / installed Owner PWA | Owner-only login; existing Owner PWA device lock |
| index.html | Back Office users | Web PC, mobile browser, installable PWA | Used for store management; may be opened from Owner via from=owner |
| clock.html | Staff / managers | Time Clock web/PWA; branch tablet entry | Existing staff/manager app-lock path; must not inherit Owner lock |
| line.html | LINE users | LINE in-app page | Keep lightweight; exclude from heavy theme assets and Owner UI rollout |
| register.html | Registration/onboarding | Web | Keep authentication/onboarding scope explicit; do not assume it is staff app |
| Line-Order (separate repository) | Order/admin users and customers | Separate web application | Out of scope for Owner Theme rollout; preserve its own auth and deployment |
| LINE OA / customer LIFF flows | Customers/staff entry points | LINE LIFF | Excluded from Theme rollout unless separately approved |

## 3. System × user × device matrix
The control plane must represent each row independently; do not use one global ON/OFF flag.

| System | User class | PC Web | Mobile Web | iPad Web | Installed Mobile App/PWA | Installed iPad App/PWA |
|---|---|---:|---:|---:|---:|---:|
| Owner Console (owner.html) | Owner | Separate policy | Separate policy | Separate policy | Separate policy | Separate policy |
| Back Office (index.html) | Owner via handoff | Separate policy | Separate policy | Separate policy | Separate policy | Separate policy |
| Back Office (index.html) | Manager / HR / Staff | Separate policy | Separate policy | Separate policy | Separate policy | Separate policy |
| Time Clock (clock.html) | Staff / Manager | Separate policy | Separate policy | Separate policy | Separate policy | Separate policy |
| Branch kiosk / tablet mode | Branch device | N/A | N/A | Separate policy | N/A | Separate policy |
| LINE / LIFF | LINE identity | Excluded | Excluded | Excluded | LINE container policy | LINE container policy |
| Customer Order / Line-Order | Customer / order admin | Separate product | Separate product | Separate product | Separate product | Separate product |

Initial rollout policy:
- Owner Theme: target scope only; PC, mobile, and iPad must each pass preview and device QA before ACTIVE.
- Back Office Theme rollout: OFF / LOCKED until separately approved.
- Staff Theme rollout: OFF / LOCKED until separately approved.
- LINE/LIFF and Customer Order: EXCLUDED; never inherit Owner Theme.
- Existing authentication and app-lock behavior remains unchanged until a separately tested auth-policy release is approved.

## 4. Authentication model
Authentication policy is independently configurable for each system + user class + device/surface combination.

Required independent profiles:
- Owner / PC Web
- Owner / Mobile Web
- Owner / iPad Web
- Owner / Installed Mobile PWA
- Owner / Installed iPad PWA
- Back Office / Owner handoff
- Back Office / Manager, HR, Staff
- Staff / PC Web
- Staff / Mobile Web or installed PWA
- Staff / iPad Web or installed PWA
- Branch kiosk / managed tablet
- LINE / LIFF identity handoff
- Customer Order / its own identity and session

Each profile stores policy metadata only: allowed methods, step-up requirement, session policy, device enrollment requirement, status, and version. Credentials, PINs, TOTP seeds, magic links, and session tokens must never be stored in Theme/IT rollout configuration.

Security invariants:
- Owner and Staff identities and sessions remain separate.
- Owner PWA lock must not run in Staff/Manager context.
- A Back Office page opened from Owner is a controlled handoff; it is not permission to turn every Back Office user into Owner.
- LINE/LIFF and Customer Order authentication remain untouched by this rollout.
- Do not disable existing login paths until replacement has passed end-to-end tests on real devices and rollback is ready.

## 5. Theme model
Theme is scoped by product + device class. Each scope has its own:
- theme_id and immutable theme_version
- layout profile (desktop / mobile / tablet)
- asset bundle and CSS entry points
- preview status
- approval record
- deployment status
- rollback target

Shared CSS is not a deployment mechanism. Shared assets must be split or guarded by explicit product/scope selectors before rollout. A cache-bust alone does not isolate products.

## 6. IT Control Center navigation
1. Overview
2. Product & System Registry
3. Theme Management
4. Authentication Profiles
5. Device & Surface Management
6. Feature Flags
7. Deployment Approval
8. Version & Rollback
9. Audit Log

## 7. Deployment state machine
DRAFT → PREVIEW → QA PASSED → APPROVAL REQUIRED → DEPLOYING → VERIFYING → ACTIVE → LOCKED

Failure path:
DEPLOYING / VERIFYING → FAILED → ROLLBACK REQUIRED → ROLLED BACK

OFF means feature not enabled in that scope. LOCKED means configuration/version cannot be changed or deployed without a new approved version. Neither state may silently block existing production login or business functions.

Every deployment records:
- target product, user class, surface and device
- files/assets and version
- before/after configuration
- approver and timestamp
- QA evidence
- deployment result and rollback reference

## 8. Required implementation sequence
Phase A — inventory and isolation
- Register all products/entry points and their current CSS/JS dependencies.
- Detect shared assets across owner.html, index.html, clock.html, line.html, register.html.
- Establish product-specific theme entry points and selectors.
- No business logic or auth changes.

Phase B — Owner Theme rollout
- Scope theme to Owner only.
- Separate PC, mobile, iPad layouts.
- Preview each device scope; verify no bleed to Back Office, Staff, LINE or Order.
- Lock approved version.

Phase C — IT Control Center control plane
- Add secure persistent configuration storage and server-side Owner authorization.
- Add independent system/device switches, approval workflow, audit log, rollback.
- Do not implement controls as localStorage-only toggles.

Phase D — Authentication profiles
- Map and test existing authentication paths first.
- Add independent profiles and device rules without replacing current login.
- Only then enable approved policy changes per scope.

Phase E — other systems
- Back Office, Staff, LINE/LIFF, and Customer Order require separate approval and QA.
- Do not deploy automatically or inherit Owner settings.

## 9. Acceptance criteria
- A Theme change for Owner Mobile cannot alter Owner PC, iPad, Back Office, Staff, LINE/LIFF or Customer Order.
- Owner authentication changes cannot alter Staff authentication.
- PC, mobile, and iPad can have independent authentication and layout profiles.
- Feature switches are enforced server-side for protected operations; UI hiding alone is insufficient.
- Config is persistent, versioned, audited and rollback-capable.
- Existing production login, permissions, schedules, time clock, order and LINE flows remain unchanged unless specifically approved.
- Real-device tests are required for iPhone, Android, iPadOS and desktop browsers before marking a scope ACTIVE.

## 10. Phase A implementation record (20 Nov 2026)
- Added `css/owner-theme.css` as an Owner-only copy of the existing visual layer.
- `owner.html` now loads the isolated stylesheet and declares `data-app="owner"`.
- `index.html`, `clock.html`, and `line.html` declare explicit app identities (`backoffice`, `staff`, `line`).
- Back Office and Staff continue loading the original `css/prototype-theme.css`; only Owner loads `css/owner-theme.css`. This prevents future Owner Theme edits from propagating through the shared stylesheet URL.
- Existing authentication, permissions, routes, API calls, and business rules were not changed. Owner Theme remains a visual baseline, not yet an independently switchable server-side deployment.

## 11. Phase B/C/D implementation record (20 Nov 2026)

### Phase B — Device-specific Theme rollout
- Added Owner PC/Mobile/iPad scope records and separate installed-app scopes for mobile/iPad. Owner Theme is enabled for the five Owner scopes only.
- Added IT Control Center preview frame selector for PC/Mobile/iPad. This is a responsive-size mock preview, not a live screenshot from physical hardware.
- Back Office, Staff, LINE and Registration remain Theme OFF and rollout-locked.

### Phase C — IT Control Center backend
- Added `public.it_control_settings` and `public.it_control_audit`; RLS enabled and direct `anon`/`authenticated` privileges revoked.
- Added `it-control-center` Edge Function v1. GET/POST requires a valid CMS Owner session verified through the existing Back Office bootstrap. All changes are persisted and audited.
- Seeded 16 scopes across Owner, Back Office, Staff, LINE and Registration, including device and surface distinctions.

### Phase D — Authentication policy separation
- Added per-scope `auth_profile` draft storage, separate from Theme settings.
- `auth_enforcement_enabled` is false for all 16 scopes. Existing Owner, Staff, Manager, Authenticator, PIN and LINE login flows are unchanged.
- The control panel labels policies as Draft / Not enforced. This phase establishes configuration and audit, not a live authentication replacement.

### Verification
- Database query confirmed 16 scopes, 5 Owner Theme scopes ON, 11 non-Owner scopes rollout-locked, and 0 authentication enforcement scopes ON.
- Edge Function `it-control-center` deployed ACTIVE v1.
- Remaining QA: authenticated Owner GET/POST through the live UI, audit entry verification, visual review on real PC/Mobile/iPad, and browser-level regression checks before enabling enforcement or unlocking other systems.

## 12. Current implementation boundary
This document establishes the approved design baseline only. No runtime feature flags, authentication policies, shared assets, database records, Edge Functions, or production behavior are changed by this commit. Those require implementation against verified server-side authorization and storage contracts.
