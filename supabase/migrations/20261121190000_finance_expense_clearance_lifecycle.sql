-- Expense request / clearance lifecycle. Additive only; existing transactions remain unchanged.
create table if not exists finance.expense_clearances (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references finance.companies(id) on delete restrict,
  document_id uuid not null references finance.documents(id) on delete restrict,
  actual_amount numeric(14,2) not null check (actual_amount > 0),
  payment_date date not null,
  payment_method text not null check (payment_method in ('cash','bank_transfer','credit_card','cheque','other')),
  reference_number text,
  notes text,
  status text not null default 'draft' check (status in ('draft','pending_owner_review','owner_approved','returned','verified')),
  submitted_by text not null,
  owner_approved_by text,
  verified_by text,
  submitted_at timestamptz,
  owner_approved_at timestamptz,
  verified_at timestamptz,
  returned_by text,
  returned_at timestamptz,
  return_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (document_id),
  unique (company_id,id)
);
create index if not exists expense_clearances_company_status_idx
  on finance.expense_clearances(company_id,status,updated_at desc);
create index if not exists expense_clearances_submitter_idx
  on finance.expense_clearances(company_id,submitted_by,updated_at desc);
alter table finance.document_files
  add column if not exists clearance_id uuid references finance.expense_clearances(id) on delete restrict;
create index if not exists document_files_clearance_idx
  on finance.document_files(company_id,clearance_id) where deleted_at is null;
