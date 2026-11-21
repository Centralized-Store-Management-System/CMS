# Finance & Accounting Module — Architecture Blueprint

สถานะ: Foundation / Design Baseline  
Branch: feature/finance-module-foundation  
ขอบเขต: เพิ่มระบบ Finance & Accounting ภายใน CMS โดยไม่เปลี่ยนพฤติกรรมของระบบเดิม

## 1. เป้าหมายและข้อห้าม

เป้าหมายคือให้ผู้ใช้เข้าระบบผ่าน CMS/Owner Portal เดียวกัน แต่ Finance เป็นโมดูลที่แยกการทำงานอย่างชัดเจน ทั้ง UI, CSS, JavaScript, API, Database, Storage และ Background Processing

ข้อห้าม:
- ห้ามแก้ไฟล์ shared runtime, authentication, PIN/session, owner landing, app shell หรือ shared CSS เพื่อให้ Finance ทำงานได้ หากยังมีทางเลือกแบบ isolated
- ห้ามเพิ่ม query, polling, realtime subscription หรือ background task ของ Finance ในหน้า Owner/Shop/Clock ที่ไม่ได้เปิด Finance
- ห้ามสร้าง database trigger บนตารางเดิมเพื่อเรียก Finance แบบ synchronous
- ห้ามให้ Finance เขียนกลับไปยังข้อมูลต้นทางของระบบอื่น
- ห้าม deploy migration หรือ Edge Function ไป production จาก branch นี้
- ห้ามเปิด autonomous financial actions, automatic payment, automatic tax filing หรือ hard-delete financial records

## 2. Architecture decision

เริ่มด้วย Modular Monolith + Isolated Services:
- CMS ยังคงเป็น management platform และ identity entry point
- Finance UI เป็น independent route/entry point และโหลดเมื่อผู้ใช้เลือก Finance เท่านั้น (lazy loading)
- Finance API ใช้ Edge Functions แยกชื่อและ namespace
- Finance data อยู่ใน PostgreSQL schema `finance`
- Finance documents อยู่ใน private Storage bucket แยก
- Integration ใช้ asynchronous inbox/outbox + queue/pull model; หลีกเลี่ยง synchronous cross-module calls
- Shared authentication ใช้ได้เฉพาะ adapter ที่ผ่านการตรวจสอบแล้ว ไม่เปลี่ยน flow เดิม

ไม่เริ่มด้วย microservices หลาย deployment โดยไม่จำเป็น เพราะเพิ่มภาระการดูแลโดยยังไม่มีปริมาณงานรองรับ

## 3. ข้อเท็จจริงจาก repository ที่ต้องคงไว้

- CMS เป็นเจ้าของข้อมูลหลักสำหรับสาขา ผู้ใช้ และสิทธิ์
- Existing application entry points ได้แก่ `index.html`, `owner.html`, `clock.html`, `line.html`
- Existing Owner app มีหน้า landing และระบบ IT เฉพาะของตน
- Existing API configuration อยู่ใน `js/config.js` และ backoffice Edge Function
- Server business logic มีการ pin jsDelivr import ไปยัง commit SHA; ห้ามแก้ไฟล์ server หรือ encrypted server payload เพื่อเพิ่ม Finance
- มีข้อกำหนดให้ feature ใหม่ใช้ไฟล์ใหม่ แยก CSS/JS scope และเพิ่ม cache version เมื่อแก้ไฟล์ JS ที่ถูกโหลดจาก HTML
- `clock.html`/LINE/LIFF ต้องเบาเป็นพิเศษ
- Shared CSS/theme ไม่ควรเปลี่ยนเพื่อปรับหน้าตาเฉพาะ module

## 4. Proposed module boundaries

```
CMS Platform
├── Existing modules (unchanged)
│   ├── Back Office
│   ├── Owner & IT
│   ├── Staff / Clock / LIFF
│   └── Line-Order integration
│
├── Finance Module (new, isolated)
│   ├── Dashboard
│   ├── Company & Tax Profile
│   ├── Revenue / Receivables
│   ├── Expenses / Payables
│   ├── Payment Vouchers & Approvals
│   ├── VAT
│   ├── Withholding Tax / Certificates
│   ├── Accounting / General Ledger
│   ├── Financial Statements
│   ├── Payroll Tax (later phase)
│   ├── Tax Filing Calendar
│   ├── Documents
│   └── Integration & Audit
│
└── Integration Boundary
    ├── Read-only source adapters
    ├── Inbox / Outbox
    ├── Background workers
    └── Sync logs / retries / dead-letter queue
```

Suggested file boundaries:
- `modules/finance/` — Finance UI and module-local assets
- `modules/finance/finance.html` — standalone entry point; do not include in existing pages until auth integration is verified
- `modules/finance/css/` — module-scoped styles only
- `modules/finance/js/` — module-scoped code only
- `supabase/functions/finance-*/` — independent API functions
- `supabase/migrations/finance/` — versioned SQL migration source files
- `docs/finance/` — specifications, data dictionary, test evidence

## 5. Database isolation

Create a dedicated `finance` schema. Do not add Finance columns or triggers to existing `public` or `backoffice` tables.

Initial logical domains:
- company_profiles, company_branches
- partners, expense_categories, revenue_categories
- source_documents, sales_documents, expense_documents, document_items
- receipts, payables, payment_vouchers, payments
- vat_transactions, vat_periods, vat_returns
- wht_transactions, wht_certificates, wht_returns
- chart_of_accounts, journal_entries, journal_lines
- tax_periods, tax_filings, tax_payments
- finance_documents, document_versions
- integration_sources, integration_inbox, integration_outbox, sync_jobs, sync_logs
- approval_events, audit_events

All financial records should use stable UUIDs, timestamps, creator identity, lifecycle status, source references and audit history. Use reversal/adjustment records rather than destructive edits after posting.

Single-company user experience is the initial scope. Data model should retain company_id on relevant records so future multi-company support does not require a redesign.

## 6. Security model

Initial roles:
- Owner: full visibility; approves payments, period closing and tax filing.
- Accounting: enters and reviews documents, prepares tax schedules and filing packages; cannot approve own high-risk actions or hard-delete posted records.

Implementation requirements:
- Verify current CMS auth/session contract before implementing the adapter.
- Enforce authorization server-side and in RLS; never rely only on hidden UI controls.
- Use least-privilege grants for schema, tables, functions and storage.
- Private bucket only; signed URLs with short expiry.
- Secrets remain in Edge Function secrets, never frontend or repository.
- Record audit events for create, update, submit, approve, reject, post, reverse, export and integration changes.

## 7. Performance isolation / SLO gates

Finance must not add any work to existing pages until opened. It must not share a blocking transaction with existing modules.

Required controls:
- Lazy-load Finance bundle only after route selection.
- Keep Finance CSS out of global stylesheets.
- No Finance polling/realtime listeners while Finance is closed.
- Background jobs use bounded batches, concurrency limits and exponential backoff with jitter.
- Use idempotency keys and unique source references to prevent duplicate imports.
- Apply request timeouts, circuit breakers and dead-letter handling.
- Paginate all lists; avoid unbounded reads and N+1 queries.
- Use indexes only on Finance-owned tables.
- Never perform report aggregation during page bootstrap; generate/cache snapshots asynchronously.
- Integration is non-blocking: failure to sync must not fail POS, HR, CMS or Owner operations.

Before production rollout, capture baseline and compare:
- Existing page load / interactive time on Owner, Back Office, Clock and LINE.
- Existing API latency and error rate.
- Database CPU, query latency, connection pressure and Edge Function duration.
- Finance closed-state network requests must be zero (except shared auth calls already present).
- Any statistically significant regression in existing workflows blocks release; target is no measurable degradation within test noise.

## 8. Integration contract

Use explicit source adapters and allowlisted fields. Start read-only:
- CMS master data: branch and user references, only when needed.
- POS/Order: sales summaries and source transaction IDs, subject to source API and reconciliation.
- HR: payroll inputs only after field mapping and access review.
- Bank: statement import/API only after provider support and consent.
- IT Monitoring: read-only health, queue, sync, backup and error metrics.

Every imported event must carry source_system, source_record_id, source_updated_at, received_at, idempotency_key and processing_status. Store raw payload only when necessary, encrypted/restricted and with retention policy. Reconciliation must expose unmatched, duplicated, delayed and rejected records.

## 9. Delivery phases

1. Repository audit and architecture baseline (this branch).
2. Finance module shell and responsive navigation, no production integration.
3. Auth adapter and roles, tested without changing existing login.
4. Finance schema and RLS migrations, applied only to isolated development/staging.
5. Core masters and document capture.
6. Revenue/expense workflows and approval/audit.
7. VAT/WHT and accounting ledger with accountant-reviewed rules.
8. Reports, filing calendar and document export.
9. Read-only integrations with reconciliation queue.
10. Performance, security, regression and backup/restore tests.
11. Controlled production rollout behind feature flag.

## 10. Release gates

Do not merge/release until:
- Existing CMS regression tests pass.
- Finance auth and RLS tests pass for Owner and Accounting.
- Migration is additive and scoped to `finance`; no changes to existing schemas/tables/policies.
- Closed Finance module causes no extra network/API/DB work.
- Queue retry/idempotency/dead-letter tests pass.
- Backup and restore test passes.
- Owner explicitly approves production rollout.

## 11. Open technical checks before implementation

- Verify actual Owner Portal menu insertion point and current navigation behavior.
- Verify existing auth/session adapter contract and role source.
- Verify Supabase project migration history and current schema privileges.
- Verify hosting routing and static asset cache headers.
- Verify whether Supabase Queues/pgmq is enabled; choose queue implementation only after checking current project capabilities and cost.
- Verify POS/HR/bank source APIs; no direct integration is assumed until proven.
- Confirm accountant-approved chart of accounts, VAT/WHT rules, document numbering and filing workflow before posting logic is built.
