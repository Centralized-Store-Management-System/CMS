# Finance Module — Parallel Engineering Review

Review date: 2026-11-21
Review branch: `review/finance-uat-gaps`
Base branch: `feature/finance-module-foundation`
Scope: Read-only review of the current Finance SQL drafts, API source, frontend adapters, and live Supabase metadata. No production schema or business records were changed.

## Verified live environment

- Supabase project: `ytxbnqosenolojifeikf` (`cafe-amazon-order-management`)
- Project health: `ACTIVE_HEALTHY` at time of review.
- Finance schema: 24 base tables exist.
- All 24 Finance tables have RLS enabled.
- No Finance RLS policies are present (0 policies).
- `anon` and `authenticated` have no USAGE privilege on schema `finance`; `service_role` has USAGE. This is consistent with a server-only access design, but the Edge Function must enforce all tenant/role checks.
- Live row counts checked: companies=1, user_roles=0, partners=0, documents=0, payments=0, journal_entries=0, audit_events=0.
- Supabase Edge Function inventory contains no function named `finance-api`; it is not deployed.
- Repository `supabase/config.toml` sets `[functions.finance-api] verify_jwt = false`. This is only safe if the function performs its own robust CMS-session validation; the current source does attempt this.

## Release blockers

### P0 — CMS identity cannot access a Finance workspace yet
The API `authenticate()` resolves a CMS actor and then requires exactly one active mapping in `finance.user_roles`. The live table has zero rows. Consequently, all valid CMS users will be denied with “ยังไม่ได้กำหนดสิทธิ์ Finance ให้ผู้ใช้งานนี้”. Do not insert a guessed actor ID. Obtain a verified CMS bootstrap payload / stable actor reference and explicitly assign the intended Owner role.

### P0 — Finance API is not deployed
The current Edge Function inventory has no `finance-api`. Frontend requests cannot complete against the intended function until it is deployed with verified secrets and tested. Do not deploy the current source unchanged: see the missing workflow actions below.

### P0 — Core accounting workflows return HTTP 501
Current API source explicitly returns 501 for:
- `payment.approve`
- `period.close`
- `journal.post`
- `tax.submit`

The UI also labels several areas as Preview Only. Do not represent the module as end-to-end operational until these workflows are implemented and tested.

## Data integrity and security review items

1. **Tenant-consistent foreign keys:** several tables carry `company_id` while foreign keys reference only the child record ID. Add composite unique keys and composite foreign keys (company_id, referenced_id) where practical so a row cannot reference a partner/document/account belonging to another company even if an API bug occurs. Review at least documents→partners, payments→documents, tax_transactions→documents/partners, journal_lines→accounts/partners, payment_allocations→payments/documents, and tax_filing_lines→filings/transactions/partners.
2. **Journal posting invariant:** ensure posting is a single DB transaction that locks the journal header, validates at least two lines, verifies debit=credit and company consistency, verifies the accounting period is open, allocates a unique journal number, writes immutable posting/audit data, then transitions status to posted. The existing balance CHECK alone does not prove line sums equal header totals.
3. **Payment workflow:** implement legal state transitions, maker-checker (creator cannot approve own payment), approval event and payment event audit, idempotency, and safe allocation totals. The SQL trigger already limits some transitions, but the API must enforce business rules and company ownership.
4. **Period close:** lock period; reject close if draft/pending documents or unposted journals exist; prevent posting into closed periods; require Owner; audit both close and reopen.
5. **Tax filing:** snapshot filing lines from reviewed tax transactions, prevent duplicate filings, reconcile totals, enforce approval before submission, and record submission reference/time. Do not claim e-filing integration unless an actual Revenue Department integration exists.
6. **Company registration:** the one existing company row is not assumed to be the real legal entity. Confirm its details and UAT designation before using it. Do not overwrite it with guessed company data.
7. **Audit append-only:** retain server-only access and validate triggers/permissions; ensure all mutations write audit events in the same transaction.
8. **Storage:** draft 004 defines metadata only. Private bucket creation, signed upload/download, MIME/size validation, malware scanning policy, and cleanup lifecycle remain separate work.

## Frontend integration review

- `finance-auth.js` calls the fixed Supabase Function URL and sends the CMS token in `x-cms-session`.
- `finance-cms-session.js` reads `amz.tok` from sessionStorage. Confirm the real Finance route always runs in a context where this exact token is present; do not alter CMS login/PIN/session.
- `finance.js` still renders multiple pages as Preview Only.
- `finance-master-data.js` and `finance-transactions.js` need full persistence/read-path verification; current transaction screen explicitly says it does not save to DB until API is tested.
- When JS/CSS is changed, bump the matching `?v=` references in HTML.

## Recommended execution order

1. Verify the CMS bootstrap payload and stable actor identifier without exposing the token; assign a single UAT Owner mapping only after explicit confirmation of identity/company.
2. Confirm the existing company row is the intended test workspace; otherwise create a clearly labelled UAT company without modifying the existing row.
3. Fix and test tenant-consistent constraints; retain RLS and server-only grants.
4. Complete API actions: company update/read, partner/account CRUD, document read/create, payment create/approve/pay/allocate, journal create/post/reverse, period close/reopen, VAT/WHT transaction and filing workflows, audit.
5. Deploy only `finance-api` after code review and secret verification; never expose DB credentials or service-role credentials in browser code.
6. Integrate frontend and test each action with isolated UAT records; verify idempotency and role separation.
7. Run Supabase security/performance advisors and regression checks. Resolve Finance-specific findings before release.

## Explicitly not performed

- No DDL or DML was executed against the live database in this review.
- No Finance Edge Function was deployed.
- No existing CMS table, row, authentication flow, or production record was changed.
- No real cash movement, bank integration, or tax filing was initiated.


## Follow-up completed on 2026-11-21

### Applied to the live Finance schema

Migration `finance_tenant_integrity_v2` was applied successfully to project `ytxbnqosenolojifeikf`. It is additive and scoped to schema `finance` only. It added composite unique indexes and 14 composite foreign-key constraints so related rows must belong to the same company:

- documents → partners
- payments → documents
- tax_transactions → documents and partners
- journal_entries → source documents
- payment_allocations → payments and documents
- payment_events → payments
- tax_filing_lines → tax filings, tax transactions, and partners
- document_files → documents and tax filings
- categories → default chart-of-account entries

Before applying, eight cross-company orphan/mismatch checks returned zero. The migration was then verified by querying PostgreSQL system catalogs; all 14 expected constraints were present. No business records were inserted, updated, or deleted by this migration.

Migration source is tracked at:
`supabase/migrations/202611210001_finance_tenant_integrity.sql`

### Advisor result

Supabase Health Advisor returned no findings. Security Advisor reported `rls_enabled_no_policy` informational findings across the project, including Finance tables. Finance tables are intentionally server-only at this stage: schema USAGE and table privileges are revoked from `anon` and `authenticated`, and the API must enforce actor, role, and company scoping. This is not a reason to grant browser access or add permissive RLS policies. Reassess once the final API connection role is confirmed.

### Remaining blockers

- Finance Edge Function is still absent from the deployed function inventory.
- Finance user role mapping is still empty; CMS actor identity must be verified before creating an Owner mapping.
- API actions still include HTTP 501 placeholders for approval, period close, journal posting, and tax submission.
- Journal line company/account consistency needs a follow-up database invariant; `journal_lines` currently has no `company_id` column.
- Full end-to-end workflow testing has not yet been performed.


### Journal-line tenant integrity completed

A second additive migration, `finance_journal_line_tenant_integrity`, was applied successfully and verified:

- Added `finance.journal_lines.company_id` as NOT NULL.
- Backfilled from the parent journal entry (the table had no rows at migration time).
- Added composite foreign keys to enforce same-company journal entry, account, and partner references.
- Added a trigger that derives `company_id` from the parent journal entry on insert/update, so the API does not need to trust a client-supplied company ID.
- Verified the column is NOT NULL, all four company-related foreign keys exist, and the trigger is installed.
- Supabase Health Advisor returned no findings after the change.

Migration source:
`supabase/migrations/202611210002_finance_journal_line_tenant_integrity.sql`

No Finance transaction records were created or changed. Current key row counts remain: companies=1 (UAT workspace), partners=0, documents=0, payments=0, journal_entries=0, journal_lines=0, audit_events=0.


## Finance module implementation progress (2026-11-21, latest)

### Database migrations applied and verified
- `finance_tenant_integrity_v2`: 14 composite tenant-consistency foreign keys plus supporting unique indexes.
- `finance_journal_line_tenant_integrity`: non-null journal_lines.company_id, parent-derived trigger, and composite FKs to journal, account, and partner.
- `finance_payment_idempotency`: company-scoped unique idempotency key for safe payment retries.
- All migrations were applied to the existing isolated UAT workspace only. No real income/expense/payment transactions were seeded.

### Edge Function deployed
- Function: `finance-api`
- Live status: ACTIVE
- Deployed version: 4
- Gateway JWT verification: false by design because the function performs CMS custom-session validation itself.
- Runtime readiness check: an unauthenticated GET returned HTTP 401 (expected), rather than a missing-function or configuration error. This confirms the deployed route is responding and the function's deny-without-CMS-session path is active. A valid CMS-authenticated browser test is still required.

### API actions implemented in deployed source
- Reads: session, company, summary, audit, partners, accounts, documents, payments, tax-transactions, journals, periods.
- Writes: partner.create, account.create, document.create, document.submit, document.approve, payment.create, payment.approve, payment.mark-paid, journal.create, journal.post.
- Document and payment approval enforce maker-checker separation. Journal posting requires balanced totals and an open accounting period.
- VAT output/input and WHT source transactions are generated from document line totals. The tax screen labels them as source transactions, not as a Revenue Department filing or proof of submission.
- The first CMS Owner can be provisioned automatically only when there are zero active Finance role mappings and exactly one active UAT company. No role was manually seeded and no CMS actor reference was guessed.

### Frontend changes
- Dashboard now authenticates and loads live summary from Finance API.
- Income and expense forms persist draft documents and submit them for review.
- Payment screen connects to payment register with pending/approved/paid states and approval actions.
- VAT/WHT screen reads source tax transactions.
- Journal screen creates balanced entries and offers posting actions, subject to maker-checker and open-period controls.
- JavaScript parse checks passed for Finance controller, transaction module, and new workflow module.

### Still outstanding / not claimed as complete
- A valid CMS session has not yet been exercised against Finance API from the user's browser. Therefore first-owner bootstrap and actor mapping remain pending live confirmation.
- No live business UAT transaction has been created or end-to-end approved/posted yet.
- Company legal profile, tax profile, accounting periods, and chart of accounts need operator/accountant review and setup. The current company is explicitly named `Café Amazon – CMS Finance Test Workspace`, environment `uat`, VAT registration false.
- External tax filing to the Revenue Department is not integrated; no filing has been submitted.
- Browser/mobile regression and full Deno type-check are not yet verified.
- Existing CMS authentication and shared runtime files were not changed.
