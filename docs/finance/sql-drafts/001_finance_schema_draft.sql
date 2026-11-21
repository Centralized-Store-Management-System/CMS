-- DRAFT ONLY — NOT APPLIED TO ANY DATABASE.
-- Finance-owned objects only. Review with an accountant and security owner before use.
-- Intentionally stored under docs/ so migration/deploy tooling will not execute it automatically.

begin;

create schema if not exists finance;
revoke all on schema finance from public, anon, authenticated;
grant usage on schema finance to service_role;

create table finance.companies (
  id uuid primary key default gen_random_uuid(),
  legal_name text not null,
  tax_id text,
  branch_type text not null default 'head_office' check (branch_type in ('head_office','branch')),
  branch_number text,
  address jsonb not null default '{}'::jsonb,
  vat_registered boolean not null default false,
  fiscal_year_start_month smallint not null default 1 check (fiscal_year_start_month between 1 and 12),
  currency_code char(3) not null default 'THB',
  status text not null default 'active' check (status in ('active','inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Maps a verified CMS actor reference to a Finance role. The exact stable CMS actor
-- reference must be confirmed before any real user is inserted.
create table finance.user_roles (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references finance.companies(id),
  cms_actor_ref text not null,
  role_code text not null check (role_code in ('owner','accounting')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id, cms_actor_ref)
);

create table finance.partners (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references finance.companies(id),
  partner_type text not null check (partner_type in ('customer','vendor','both','employee','government')),
  display_name text not null,
  legal_name text,
  tax_id text,
  branch_number text,
  email text,
  phone text,
  address jsonb not null default '{}'::jsonb,
  default_wht_type text,
  default_wht_rate numeric(7,4),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index partners_company_type_idx on finance.partners(company_id, partner_type, is_active);

create table finance.documents (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references finance.companies(id),
  document_type text not null check (document_type in ('invoice','tax_invoice','receipt','expense','bill','payment_voucher','credit_note','debit_note','other')),
  document_number text,
  document_date date not null,
  due_date date,
  partner_id uuid references finance.partners(id),
  status text not null default 'draft' check (status in ('draft','pending_review','approved','posted','voided','reversed')),
  currency_code char(3) not null default 'THB',
  subtotal numeric(18,2) not null default 0,
  discount_total numeric(18,2) not null default 0,
  vat_total numeric(18,2) not null default 0,
  wht_total numeric(18,2) not null default 0,
  grand_total numeric(18,2) not null default 0,
  source_system text,
  source_record_id text,
  idempotency_key text,
  notes text,
  created_by text,
  approved_by text,
  posted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id, document_type, document_number),
  unique(company_id, source_system, source_record_id),
  unique(company_id, idempotency_key)
);
create index documents_company_date_idx on finance.documents(company_id, document_date desc);
create index documents_company_status_idx on finance.documents(company_id, status, document_date desc);

create table finance.document_lines (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references finance.documents(id) on delete restrict,
  line_no integer not null,
  description text not null,
  quantity numeric(18,4) not null default 1,
  unit_price numeric(18,4) not null default 0,
  discount_amount numeric(18,2) not null default 0,
  tax_code text,
  vat_rate numeric(7,4),
  vat_amount numeric(18,2) not null default 0,
  wht_type text,
  wht_rate numeric(7,4),
  wht_amount numeric(18,2) not null default 0,
  account_code text,
  line_total numeric(18,2) not null default 0,
  created_at timestamptz not null default now(),
  unique(document_id, line_no)
);

create table finance.payments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references finance.companies(id),
  document_id uuid references finance.documents(id) on delete restrict,
  payment_type text not null check (payment_type in ('receipt','disbursement','refund')),
  payment_date date not null,
  amount numeric(18,2) not null check (amount > 0),
  method text not null,
  reference_number text,
  status text not null default 'pending' check (status in ('pending','approved','paid','rejected','cancelled')),
  approved_by text,
  paid_at timestamptz,
  created_by text,
  created_at timestamptz not null default now()
);
create index payments_company_date_idx on finance.payments(company_id, payment_date desc);

create table finance.tax_transactions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references finance.companies(id),
  document_id uuid not null references finance.documents(id) on delete restrict,
  tax_type text not null check (tax_type in ('vat_output','vat_input','wht')),
  tax_period char(7) not null,
  tax_base numeric(18,2) not null default 0,
  tax_rate numeric(7,4) not null default 0,
  tax_amount numeric(18,2) not null default 0,
  counterparty_id uuid references finance.partners(id),
  tax_form_code text,
  status text not null default 'unreviewed' check (status in ('unreviewed','reviewed','filed','adjusted')),
  created_at timestamptz not null default now(),
  unique(document_id, tax_type, tax_period)
);
create index tax_transactions_period_idx on finance.tax_transactions(company_id, tax_type, tax_period);

create table finance.tax_filings (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references finance.companies(id),
  tax_type text not null,
  tax_period char(7) not null,
  form_code text not null,
  due_date date,
  status text not null default 'preparing' check (status in ('preparing','review','approved','submitted','paid','amended')),
  return_amount numeric(18,2) not null default 0,
  submitted_at timestamptz,
  receipt_reference text,
  prepared_by text,
  approved_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id, tax_type, tax_period, form_code)
);

create table finance.chart_of_accounts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references finance.companies(id),
  account_code text not null,
  account_name text not null,
  account_type text not null check (account_type in ('asset','liability','equity','revenue','expense')),
  parent_id uuid references finance.chart_of_accounts(id),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(company_id, account_code)
);

create table finance.journal_entries (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references finance.companies(id),
  journal_number text not null,
  journal_date date not null,
  description text,
  source_document_id uuid references finance.documents(id) on delete restrict,
  status text not null default 'draft' check (status in ('draft','pending_review','posted','reversed')),
  total_debit numeric(18,2) not null default 0,
  total_credit numeric(18,2) not null default 0,
  created_by text,
  approved_by text,
  posted_at timestamptz,
  created_at timestamptz not null default now(),
  unique(company_id, journal_number)
);
create index journal_entries_company_date_idx on finance.journal_entries(company_id, journal_date desc);

create table finance.journal_lines (
  id uuid primary key default gen_random_uuid(),
  journal_entry_id uuid not null references finance.journal_entries(id) on delete restrict,
  account_id uuid not null references finance.chart_of_accounts(id),
  line_no integer not null,
  description text,
  debit numeric(18,2) not null default 0 check (debit >= 0),
  credit numeric(18,2) not null default 0 check (credit >= 0),
  partner_id uuid references finance.partners(id),
  created_at timestamptz not null default now(),
  unique(journal_entry_id, line_no),
  check (not (debit > 0 and credit > 0))
);

create table finance.integration_inbox (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references finance.companies(id),
  source_system text not null,
  source_record_id text not null,
  event_type text not null,
  payload jsonb not null,
  idempotency_key text not null,
  status text not null default 'queued' check (status in ('queued','processing','processed','retry','dead_letter','ignored')),
  attempts integer not null default 0,
  next_attempt_at timestamptz,
  last_error text,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  unique(company_id, source_system, idempotency_key)
);
create index integration_inbox_queue_idx on finance.integration_inbox(status, next_attempt_at, received_at);

create table finance.audit_events (
  id bigint generated always as identity primary key,
  company_id uuid references finance.companies(id),
  actor_ref text,
  action text not null,
  entity_type text not null,
  entity_id text,
  before_data jsonb,
  after_data jsonb,
  request_id text,
  created_at timestamptz not null default now()
);
create index audit_events_company_created_idx on finance.audit_events(company_id, created_at desc);

-- Enable RLS and keep all client roles denied. Access is only through a separately
-- authenticated Edge Function using the service role after CMS-session authorization.
do $$
declare r record;
begin
  for r in select tablename from pg_tables where schemaname = 'finance' loop
    execute format('alter table finance.%I enable row level security', r.tablename);
    execute format('revoke all on finance.%I from public, anon, authenticated', r.tablename);
    execute format('grant all on finance.%I to service_role', r.tablename);
  end loop;
end $$;

commit;
