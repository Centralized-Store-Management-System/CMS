-- Extend clearance amounts without changing legacy API semantics.
-- actual_amount remains the legacy paid amount until the UI/API cutover is complete.
alter table finance.expense_clearances
  add column if not exists actual_paid_amount numeric(14,2),
  add column if not exists actual_expense_amount numeric(14,2),
  add column if not exists refund_amount numeric(14,2) not null default 0,
  add column if not exists payment_account_id uuid references finance.chart_of_accounts(id);

update finance.expense_clearances
set actual_paid_amount = coalesce(actual_paid_amount, actual_amount)
where actual_paid_amount is null;

alter table finance.expense_clearances
  add constraint expense_clearances_paid_nonnegative
    check (actual_paid_amount is null or actual_paid_amount >= 0),
  add constraint expense_clearances_expense_nonnegative
    check (actual_expense_amount is null or actual_expense_amount >= 0),
  add constraint expense_clearances_refund_nonnegative
    check (refund_amount >= 0);

comment on column finance.expense_clearances.actual_amount is
  'Legacy actual paid amount; retained for backward compatibility during API/UI migration.';
comment on column finance.expense_clearances.actual_paid_amount is
  'Gross cash disbursed to requester/vendor for this clearance.';
comment on column finance.expense_clearances.actual_expense_amount is
  'Actual eligible expense supported by receipts, excluding refundable unused advance.';
comment on column finance.expense_clearances.refund_amount is
  'Unused advance refunded to company; must be reconciled against paid amount.';
comment on column finance.expense_clearances.payment_account_id is
  'Explicit chart-of-accounts cash/bank/card/cheque account used for settlement.';
