# Finance Module — Repository & Supabase Read-only Audit

Audit date: 21 Nov 2026  
Repository: `Centralized-Store-Management-System/CMS`  
Supabase project: `ytxbnqosenolojifeikf` (`cafe-amazon-order-management`)  
Mode: Read-only inspection; no database writes or deployments performed.

## 1. Repository findings

- Default branch: `main`.
- Current application entry points include `index.html`, `owner.html`, `clock.html`, and `line.html`.
- Existing Owner app loads its own JavaScript bundle from `owner.html`; the Owner landing flow and IT Console are implemented in Owner-specific scripts.
- Existing back-office API configuration is centralized in `js/config.js` and points to the Supabase `backoffice` Edge Function.
- `AGENTS.md` requires new features to use new files, isolate PC/mobile/web/app/LINE behavior, avoid shared CSS/theme changes for module-specific styling, and version JS assets when referenced by HTML.
- `AGENTS.md` and `HANDOFF.md` state that business logic is served through the existing backoffice runtime and that its encrypted server payload must not be edited manually.
- The Owner home currently has a deliberately constrained landing page; Finance navigation must be added only after the existing Owner navigation and authorization contract are mapped. Do not bypass that design by adding an unreviewed landing button.

## 2. Supabase findings

Project status: `ACTIVE_HEALTHY`  
Region: `ap-southeast-1`  
Database engine: PostgreSQL 17.12

Read-only table inventory returned 103 tables across:
- `auth`
- `backoffice`
- `cron`
- `net`
- `public`
- `realtime`
- `storage`
- `supabase_migrations`
- `vault`

Existing application data is split between:
- `backoffice` schema (9 tables observed, including books/sheets/rows/kv/files/triggers/outbox/code)
- `public` schema (41 tables observed, including branches, staff, orders, HR document records and IT monitoring/control tables)

No `finance` schema or `finance.*` tables were present in the read-only inventory at audit time.

The migration inventory includes 25 project migrations through:
- `20261121031519_it_ops_dedupe_queue_and_retention`

This confirms the IT Ops deduplication/queue/retention migration is registered in the connected Supabase project's migration history. This audit did not modify or re-run it.

## 3. Architecture implications

1. This Supabase project is shared by the existing Café Amazon order-management platform; Finance must be treated as an additive module inside a shared production database, not as an isolated database instance.
2. A dedicated `finance` schema is the appropriate first isolation boundary. It must not alter existing `public` or `backoffice` tables, triggers, policies or functions.
3. Existing CMS identity is not yet proven to be interchangeable with Supabase Auth identity for all Owner/Accounting actions. The Finance auth adapter must be based on a verified contract, not assumptions.
4. Existing Edge Function `backoffice` must not be expanded with Finance logic. Finance endpoints should be independent functions with their own limits, logs and authorization.
5. Do not enable Finance Realtime subscriptions or recurring jobs until there is a concrete use case and resource budget. Start with explicit API reads and bounded asynchronous sync.
6. Do not create a Supabase development branch for this work without checking its compute cost/confirmation flow. A separate local/staging test environment may be preferable for the first schema prototype.

## 4. Audit limitations

- This was a read-only metadata inventory. It did not inspect every RLS policy definition, function body, trigger body, index, query plan, Edge Function secret, hosting header or live performance metric.
- No production performance baseline was captured.
- No POS/HR/bank integration API was assumed to exist.
- No schema, policy, trigger, function, bucket, secret, cron job or production data was changed.

## 5. Next safe implementation step

Inspect the exact current Owner navigation and session contract, then build a Finance-only standalone UI shell on this feature branch. Keep it unlinked from production pages until role enforcement and regression tests pass. The next database step should be a reviewed migration draft only; apply it first in an isolated development/staging database, never directly to production during foundation work.
