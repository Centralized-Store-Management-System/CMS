# Finance & Accounting — Implementation Roadmap

## Phase 0 — Isolation baseline (current)
- [x] Inspect repository structure and project conventions.
- [x] Confirm existing entry points and shared backend constraints.
- [x] Create isolated feature branch.
- [x] Document module boundaries and performance gates.
- [ ] Verify current Supabase schema, migration history, roles and RLS without writes.
- [ ] Capture current production performance baseline (requires authorized monitoring access).

## Phase 1 — UI shell
- [ ] Build Finance standalone route and responsive shell.
- [ ] Create expandable Finance navigation; default view shows concise dashboard/status.
- [ ] Add role-aware navigation for Owner and Accounting.
- [ ] Keep route unlinked from production Owner Portal until auth tests pass.

## Phase 2 — Identity and access
- [ ] Read existing auth contract and implement a narrow adapter.
- [ ] Server-side Owner/Accounting authorization.
- [ ] RLS tests and audit trail.
- [ ] No changes to current login, PIN or session flow.

## Phase 3 — Data foundation
- [ ] Finance-only schema and migration set.
- [ ] Company/tax profile, partners, categories, document numbering.
- [ ] Private document storage.
- [ ] Audit and approval events.

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
