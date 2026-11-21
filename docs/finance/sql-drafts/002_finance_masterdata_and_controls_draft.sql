-- DRAFT ONLY — NOT APPLIED. Depends on 001_finance_schema_draft.sql.
-- Additional Finance master-data, period-control and asynchronous integration objects.
begin;

create table finance.company_tax_profiles (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references finance.companies(id) on delete restrict,
  tax_registration_no text,
  vat_registered boolean not null default false,
  vat_effective_date date,
  vat_branch_no text,
  tax_address jsonb not null default '{}'::jsonb,
  default_vat_rate numeric(7,4),
  tax_profile_version integer not null default 1,
  effective_from date not null default current_date,
  effective_to date,
  approved_by text,
  created_at timestamptz not null default now(),
  unique(company_id, tax_profile_version),
  check(effective_to is null or effective_to >= effective_from)
);
create index company_tax_profiles_company_idx on finance.company_tax_profiles(company_id,effective_from desc);

create table finance.categories (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references finance.companies(id) on delete restrict,
  category_code text not null,
  category_name text not null,
  category_type text not null check(category_type in ('revenue','expense','asset','liability','equity','other')),
  parent_id uuid references finance.categories(id) on delete restrict,
  default_account_id uuid references finance.chart_of_accounts(id) on delete restrict,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id,category_code)
);
create index categories_company_type_idx on finance.categories(company_id,category_type,is_active);

create table finance.document_sequences (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references finance.companies(id) on delete restrict,
  document_type text not null,
  prefix text not null default '',
  date_pattern text not null default 'YYYYMM',
  next_number bigint not null default 1 check(next_number > 0),
  padding smallint not null default 5 check(padding between 1 and 12),
  reset_frequency text not null default 'yearly' check(reset_frequency in ('never','yearly','monthly')),
  last_reset_key text,
  is_active boolean not null default true,
  updated_at timestamptz not null default now(),
  unique(company_id,document_type)
);

create table finance.accounting_periods (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references finance.companies(id) on delete restrict,
  period_code text not null,
  starts_on date not null,
  ends_on date not null,
  status text not null default 'open' check(status in ('open','closing','closed','reopened')),
  closed_by text,
  closed_at timestamptz,
  reopened_by text,
  reopened_at timestamptz,
  created_at timestamptz not null default now(),
  check(ends_on >= starts_on),
  unique(company_id,period_code)
);
create index accounting_periods_company_dates_idx on finance.accounting_periods(company_id,starts_on,ends_on);

create table finance.approval_events (
  id bigint generated always as identity primary key,
  company_id uuid not null references finance.companies(id) on delete restrict,
  entity_type text not null,
  entity_id uuid not null,
  action text not null check(action in ('submitted','approved','rejected','returned','cancelled','posted','reversed')),
  actor_ref text not null,
  note text,
  request_id text,
  created_at timestamptz not null default now()
);
create index approval_events_entity_idx on finance.approval_events(company_id,entity_type,entity_id,created_at desc);

create table finance.integration_outbox (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references finance.companies(id) on delete restrict,
  target_system text not null,
  event_type text not null,
  aggregate_type text not null,
  aggregate_id text not null,
  payload jsonb not null,
  idempotency_key text not null,
  status text not null default 'queued' check(status in ('queued','processing','sent','retry','dead_letter','cancelled')),
  attempts integer not null default 0,
  next_attempt_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  unique(company_id,target_system,idempotency_key)
);
create index integration_outbox_queue_idx on finance.integration_outbox(status,next_attempt_at,created_at);

do $$
declare r record;
begin
  for r in select tablename from pg_tables where schemaname='finance'
  loop
    execute format('alter table finance.%I enable row level security',r.tablename);
    execute format('revoke all on finance.%I from public, anon, authenticated',r.tablename);
    execute format('grant all on finance.%I to service_role',r.tablename);
  end loop;
end $$;

commit;
