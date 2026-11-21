-- DRAFT ONLY — NOT APPLIED. Depends on Finance drafts 001–003.
-- Payment allocation, journal controls, tax filing snapshots and private document metadata.
-- Storage bucket creation and API deployment are separate, explicitly approved operations.

begin;

-- A payment may settle one or more documents; partial settlement is supported.
create table finance.payment_allocations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references finance.companies(id) on delete restrict,
  payment_id uuid not null references finance.payments(id) on delete restrict,
  document_id uuid not null references finance.documents(id) on delete restrict,
  amount numeric(18,2) not null check (amount > 0),
  created_at timestamptz not null default now(),
  unique(payment_id, document_id)
);
create index payment_allocations_document_idx
  on finance.payment_allocations(company_id, document_id);
create index payment_allocations_payment_idx
  on finance.payment_allocations(company_id, payment_id);

-- Append-only payment approval / settlement history.
create table finance.payment_events (
  id bigint generated always as identity primary key,
  company_id uuid not null references finance.companies(id) on delete restrict,
  payment_id uuid not null references finance.payments(id) on delete restrict,
  actor_ref text not null,
  action text not null check (action in ('created','submitted','approved','rejected','paid','cancelled','reversed')),
  note text,
  request_id text,
  created_at timestamptz not null default now()
);
create index payment_events_history_idx
  on finance.payment_events(company_id, payment_id, created_at desc);

-- Snapshot the tax figures included in a filing. Rebuild only while preparing/reviewing;
-- submitted filings must be amended, never silently overwritten.
create table finance.tax_filing_lines (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references finance.companies(id) on delete restrict,
  filing_id uuid not null references finance.tax_filings(id) on delete restrict,
  source_tax_transaction_id uuid references finance.tax_transactions(id) on delete restrict,
  counterparty_id uuid references finance.partners(id) on delete restrict,
  description text,
  tax_base numeric(18,2) not null default 0 check (tax_base >= 0),
  tax_rate numeric(7,4) not null default 0 check (tax_rate between 0 and 100),
  tax_amount numeric(18,2) not null default 0 check (tax_amount >= 0),
  created_at timestamptz not null default now()
);
create index tax_filing_lines_filing_idx
  on finance.tax_filing_lines(company_id, filing_id);

-- Private Storage object metadata only. Actual bytes live in a private Supabase Storage bucket.
create table finance.document_files (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references finance.companies(id) on delete restrict,
  document_id uuid references finance.documents(id) on delete restrict,
  filing_id uuid references finance.tax_filings(id) on delete restrict,
  storage_bucket text not null default 'finance-private-documents'
    check (storage_bucket = 'finance-private-documents'),
  object_path text not null,
  original_name text not null,
  mime_type text not null check (mime_type in ('application/pdf','image/jpeg','image/png','image/webp')),
  size_bytes bigint not null check (size_bytes between 1 and 20971520),
  sha256 text,
  uploaded_by text not null,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  check (num_nonnulls(document_id, filing_id) = 1),
  unique(storage_bucket, object_path)
);
create index document_files_company_document_idx
  on finance.document_files(company_id, document_id) where deleted_at is null;
create index document_files_company_filing_idx
  on finance.document_files(company_id, filing_id) where deleted_at is null;

-- Explicit sequence for journal numbers; never derive a number with MAX()+1.
create table finance.journal_sequences (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references finance.companies(id) on delete restrict,
  prefix text not null default 'JV',
  period_key text not null,
  next_number bigint not null default 1 check (next_number > 0),
  padding smallint not null default 5 check (padding between 1 and 12),
  updated_at timestamptz not null default now(),
  unique(company_id, period_key)
);

-- A posted journal must balance. Draft and pending-review journals may be incomplete.
alter table finance.journal_entries
  add constraint journal_entries_posted_balanced
  check (status not in ('posted','reversed') or total_debit = total_credit);

-- Harden child-line guards: inserts are forbidden under posted parents, and an UPDATE
-- cannot move a line out of a posted parent into a draft parent.
create or replace function finance.guard_document_line_parent()
returns trigger language plpgsql set search_path = pg_catalog, finance
as $$
declare
  source_status text;
  target_status text;
  source_id uuid;
  target_id uuid;
begin
  source_id := case when tg_op = 'INSERT' then null else old.document_id end;
  target_id := case when tg_op = 'DELETE' then null else new.document_id end;

  if source_id is not null then
    select status into source_status from finance.documents where id = source_id;
    if source_status in ('posted','voided','reversed') then
      raise exception 'Document lines are locked by their parent document'
        using errcode = '55000';
    end if;
  end if;

  if target_id is not null then
    select status into target_status from finance.documents where id = target_id;
    if target_status in ('posted','voided','reversed') then
      raise exception 'Cannot add or move lines into a locked document'
        using errcode = '55000';
    end if;
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;

drop trigger if exists trg_document_lines_guard_parent on finance.document_lines;
create trigger trg_document_lines_guard_parent
before insert or update or delete on finance.document_lines
for each row execute function finance.guard_document_line_parent();

create or replace function finance.guard_journal_line_parent()
returns trigger language plpgsql set search_path = pg_catalog, finance
as $$
declare
  source_status text;
  target_status text;
  source_id uuid;
  target_id uuid;
begin
  source_id := case when tg_op = 'INSERT' then null else old.journal_entry_id end;
  target_id := case when tg_op = 'DELETE' then null else new.journal_entry_id end;

  if source_id is not null then
    select status into source_status from finance.journal_entries where id = source_id;
    if source_status in ('posted','reversed') then
      raise exception 'Journal lines are locked by their parent journal'
        using errcode = '55000';
    end if;
  end if;

  if target_id is not null then
    select status into target_status from finance.journal_entries where id = target_id;
    if target_status in ('posted','reversed') then
      raise exception 'Cannot add or move lines into a locked journal'
        using errcode = '55000';
    end if;
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;

drop trigger if exists trg_journal_lines_guard_parent on finance.journal_lines;
create trigger trg_journal_lines_guard_parent
before insert or update or delete on finance.journal_lines
for each row execute function finance.guard_journal_line_parent();

-- Payment state transitions are deliberately narrow. Owner authorization is enforced by
-- the Finance API; this trigger prevents invalid state jumps at the database boundary.
create or replace function finance.guard_payment_transition()
returns trigger language plpgsql set search_path = pg_catalog, finance
as $$
begin
  if old.status in ('paid','rejected','cancelled') then
    raise exception 'Final payment status is immutable'
      using errcode = '55000';
  end if;
  if new.status <> old.status and not (
    (old.status = 'pending' and new.status in ('approved','rejected','cancelled')) or
    (old.status = 'approved' and new.status in ('paid','cancelled'))
  ) then
    raise exception 'Invalid payment status transition'
      using errcode = '23514';
  end if;
  return new;
end $$;

drop trigger if exists trg_payments_transition on finance.payments;
create trigger trg_payments_transition
before update on finance.payments
for each row execute function finance.guard_payment_transition();

-- All event/audit history is append-only, including payment events.
create or replace function finance.reject_payment_event_mutation()
returns trigger language plpgsql set search_path = pg_catalog, finance
as $$
begin
  raise exception 'Payment events are append-only'
    using errcode = '55000';
end $$;

create trigger trg_payment_events_immutable
before update or delete on finance.payment_events
for each row execute function finance.reject_payment_event_mutation();

do $$
declare t text;
begin
  foreach t in array array['payment_allocations','payment_events','tax_filing_lines','document_files','journal_sequences']
  loop
    execute format('alter table finance.%I enable row level security', t);
    execute format('revoke all on finance.%I from public, anon, authenticated', t);
    execute format('grant all on finance.%I to service_role', t);
  end loop;
end $$;

revoke all on all tables in schema finance from public, anon, authenticated;
revoke all on all sequences in schema finance from public, anon, authenticated;
grant usage on schema finance to service_role;

commit;
