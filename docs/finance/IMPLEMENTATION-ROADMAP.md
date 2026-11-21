# Finance & Accounting — Implementation Roadmap

## Phase 0 — Isolation baseline (current)
- [x] Inspect repository structure and project conventions.
- [x] Confirm existing entry points and shared backend constraints.
- [x] Create isolated feature branch.
- [x] Document module boundaries and performance gates.
- [ ] Verify current Supabase schema, migration history, roles and RLS without writes.
- [ ] Capture current production performance baseline (requires authorized monitoring access).

## Phase 1 — UI shell
- [x] Build Finance standalone route and responsive shell.
- [x] Create expandable Finance navigation; default view shows concise dashboard/status.
- [ ] Add role-aware navigation for Owner and Accounting (blocked on verified CMS identity contract).
- [x] Keep route unlinked from production Owner Portal until auth tests pass.

- [x] Add Finance-only CMS Theme Bridge (brand colors, typography, logo, light/dark, scale, radius, density) without importing CMS runtime or shared CSS.\n\n## Phase 2 — Identity and access
- [x] Read existing auth contract: custom CMS token validated via `backoffice?action=bootstrap`; claims include `me.role`, `me.perms`, `me.scope` (from existing HR Documents function).\n- [x] Implement isolated Finance authorization Edge Function source and lazy frontend adapter (not deployed).\n- [ ] Verify stable actor reference against real, non-production CMS session before enabling writes.
- [ ] Server-side Owner/Accounting authorization.
- [ ] RLS tests and audit trail.
- [ ] No changes to current login, PIN or session flow.

## Phase 3 — Data foundation
- [x] Draft Finance-only schema foundation (001) and master-data/control tables (002); not applied.\n- [ ] Review SQL, configure private API exposure/connection and apply only in isolated staging after approval.
- [x] Build isolated master-data UI for company/tax profile, partners and chart of accounts (local validation only).
- [ ] Deploy reviewed Finance schema, then connect forms to authenticated persistence API.
- [ ] Categories and document numbering service.
- [ ] Private document storage.
- [x] Draft approval events and audit event tables.\n- [ ] Add automated audit immutability and role-based tests.

## Phase 4 — Workflows
- [ ] Revenue and receipts.
- [ ] Expenses and payables.
- [ ] Payment vouchers and approvals.
- [ ] VAT and withholding tax schedules.
- [ ] Journals, ledger and financial reports.
- [ ] Tax filing calendar and export packages.

## Phase 5 — Integrations
- [ ] Read-only source adapters.
- [ ] Asynchronous inbox/outbox and bounded queue workers.
- [ ] Idempotency, retry, dead-letter and reconciliation.
- [ ] POS/HR/bank integrations only after source APIs and field mappings are confirmed.

## Phase 6 — Release
- [ ] Unit, integration, RLS, security and regression tests.
- [ ] Compare performance baseline.
- [ ] Backup/restore and rollback rehearsal.
- [ ] Feature-flagged release with explicit Owner approval.

## Release rule
A failed Finance feature must not block or degrade any existing CMS workflow. Any regression in existing workflows blocks release.
