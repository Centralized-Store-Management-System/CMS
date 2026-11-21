-- Allow clearance journals as a first-class source and prevent duplicate posting per expense document.
alter table finance.journal_entries
  drop constraint if exists journal_entries_source_type_check;

alter table finance.journal_entries
  add constraint journal_entries_source_type_check
  check (source_type = any (array[
    'manual','document','payment','reversal','tax','opening','expense_clearance'
  ]::text[]));

create unique index if not exists journal_entries_one_expense_clearance_uq
  on finance.journal_entries (company_id, source_document_id)
  where source_type = 'expense_clearance' and source_document_id is not null;

comment on index finance.journal_entries_one_expense_clearance_uq is
  'Idempotency guard: at most one final-verification journal per expense document.';
