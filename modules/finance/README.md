# Finance & Accounting Module

สถานะ: Foundation + Responsive UI shell + CMS Theme Bridge — ยังไม่เชื่อม Owner Portal/auth, ยังไม่เชื่อมฐานข้อมูล และยังไม่เปิดใช้งานจริง

## Purpose
โมดูลบัญชี การเงิน และภาษีภายใต้ CMS โดยแยก UI, assets, API, database schema และ background processing จากระบบเดิม

## Non-negotiable isolation rules
1. ห้าม import ไฟล์ JS/CSS ของ Finance จาก `index.html`, `owner.html`, `clock.html` หรือ `line.html` ในช่วง foundation
2. ห้ามแก้ `js/core.js`, `js/config.js`, `js/auth-web.js`, `js/owner.js`, shared CSS, encrypted server payload หรือ Edge Function `backoffice`
3. ห้ามสร้าง trigger หรือ synchronous dependency กับตารางเดิม
4. ห้ามใช้ credentials/secrets ใน frontend
5. ห้ามใช้ production data ในการทดสอบ
6. ยังไม่สร้าง migration หรือ Edge Function ที่ deploy ได้จนกว่าจะตรวจสอบ Supabase schema และ auth contract

## Planned layout
- `finance.html` — independent entry point (later phase)
- `css/` — module-only styles
- `js/` — module-only scripts
- `components/` — reusable Finance-only UI components
- `services/` — API adapters, lazy loaded
- `tests/` — isolated unit and integration tests

## Shared CMS experience\n- Finance เป็น independent entry point ภายใน CMS platform; หน้าจอและเมนู Finance แยกภายใน workspace ของโมดูล\n- ใช้ theme contract เดียวกับ CMS ผ่าน `cms-theme-bridge.js` โดยอ่าน `amz.theme` และ `amz.mytheme` จาก same-origin localStorage\n- สีหลัก, accent, background, font, heading font, logo, light/dark mode, scale, radius และ density ถูกส่งต่อไปยัง Finance-only CSS overrides\n- ไม่โหลด `js/theme.js`, `css/app.css` หรือ CMS runtime เข้ามาใน Finance จึงไม่ผูก dependency กับระบบเดิม\n- Theme Bridge ทำงานเฉพาะเมื่อเปิดหน้า Finance; ไม่มี polling, API, Realtime หรือ network request เพิ่มในหน้าระบบเดิม\n\n## Finance authorization adapter\n- New Edge Function source: `supabase/functions/finance/index.ts` (not deployed).\n- Frontend adapter: `js/finance-auth.js`; it requires the CMS host to explicitly inject a `getSessionToken()` provider and performs no automatic request on load.\n- The server validates the CMS session via the established Back Office bootstrap and applies Owner / `acct` permission checks.\n- Payment approval, period close, journal posting and tax submission capabilities are Owner-only. Accounting can prepare/review.\n- If a stable CMS actor reference is absent, `auditReady=false`; audit-sensitive writes must remain disabled.\n\n## Verified CMS authentication contract (read-only integration design)
- Existing CMS session is custom and validated server-side through `backoffice?action=bootstrap&t=<session>`; it is not safe to assume Supabase Auth JWT.
- Existing HR Documents Edge Function validates `boot.me.role`, `boot.me.perms`, and `boot.me.scope` from that bootstrap response.
- Finance authorization will accept `me.role === 'owner'` or the existing `me.perms` array containing `acct`; this is a Finance-specific permission gate and does not create a global CMS role.
- A stable actor reference must be confirmed from `me.id`, `me.username`, or `me.code` before enabling audit writes. Do not invent or silently map an identity.
- The current preview has no session integration and remains unlinked from Owner until a Finance API adapter, session expiry handling, and authorization tests are complete.

## Database draft extensions\n- `002_finance_masterdata_and_controls_draft.sql` adds versioned tax profiles, categories, document sequences, accounting periods, approval events and integration outbox.\n- Both SQL files remain documentation drafts; neither has been applied to Supabase.\n\n## Master data UI foundation
- Company profile: legal identity, tax ID validation, branch type/code, address, accounting-year start month and VAT registration status.
- Partner register: customer/vendor/both/employee/government classification and basic contact/tax fields.
- Chart of accounts: code/name/type capture with accountant review gate.
- Forms validate locally but do not persist data until Finance schema and authenticated API are deployed and tested.
- Master-data JavaScript loads only when one of these screens is opened.

## Access model
- Owner
- Accounting

## Current state
This directory intentionally contains only architecture scaffolding. No Finance code is loaded by existing applications.
