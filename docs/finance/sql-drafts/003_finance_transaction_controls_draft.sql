-- DRAFT ONLY — NOT APPLIED. Depends on 001 and 002.
-- Hardening for transaction totals, posted-record immutability and audit history.
-- Review with a Thai accounting professional and security owner before staging.

begin;

-- Monetary and quantity domain constraints.
alter table finance.documents
  add constraint documents_nonnegative_totals check (
    subtotal >= 0 and discount_total >= 0 and vat_total >= 0 and
    wht_total >= 0 and grand_total >= 0
  );
alter table finance.document_lines
  add constraint document_lines_positive_quantity check (quantity > 0),
  add constraint document_lines_nonnegative_amounts check (
    unit_price >= 0 and discount_amount >= 0 and vat_amount >= 0 and
    wht_amount >= 0 and line_total >= 0
  ),
  add constraint document_lines_vat_rate_range check (vat_rate is null or (vat_rate >= 0 and vat_rate <= 100)),
  add constraint document_lines_wht_rate_range check (wht_rate is null or (wht_rate >= 0 and wht_rate <= 100));
alter table finance.payments
  add constraint payments_nonnegative_reference check (length(coalesce(reference_number,'')) <= 120);
alter table finance.journal_lines
  add constraint journal_lines_one_sided check ((debit = 0) <> (credit = 0));
alter table finance.journal_entries
  add constraint journal_entries_nonnegative_totals check (total_debit >= 0 and total_credit >= 0);

-- Common updated_at trigger for Finance-owned mutable master/control rows.
create or replace function finance.touch_updated_at()
returns trigger language plpgsql set search_path = pg_catalog, finance
as $$
begin
  new.updated_at := now();
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['companies','user_roles','partners','tax_filings','categories','document_sequences','documents','accounting_periods']
  loop
    execute format('drop trigger if exists %I on finance.%I', 'trg_'||t||'_updated_at', t);
    execute format('create trigger %I before update on finance.%I for each row execute function finance.touch_updated_at()', 'trg_'||t||'_updated_at', t);
  end loop;
end $$;

-- Posted accounting records are corrected by reversal/adjustment, never overwritten.
create or replace function finance.guard_posted_record()
returns trigger language plpgsql set search_path = pg_catalog, finance
as $$
declare old_status text;
begin
  old_status := to_jsonb(old)->>'status';
  if old_status in ('posted','paid','submitted','closed') then
    raise exception 'Finance record is locked; create a reversal or adjustment instead'
      using errcode = '55000';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;

drop trigger if exists trg_documents_guard_posted on finance.documents;
create trigger trg_documents_guard_posted
before update or delete on finance.documents
for each row execute function finance.guard_posted_record();

drop trigger if exists trg_journal_entries_guard_posted on finance.journal_entries;
create trigger trg_journal_entries_guard_posted
before update or delete on finance.journal_entries
for each row execute function finance.guard_posted_record();

-- Audit history is append-only even for service_role application code.
create or replace function finance.reject_audit_mutation()
returns trigger language plpgsql set search_path = pg_catalog, finance
as $$
begin
  raise exception 'Finance audit events are append-only'
    using errcode = '55000';
end $$;

drop trigger if exists trg_audit_events_immutable on finance.audit_events;
create trigger trg_audit_events_immutable
before update or delete on finance.audit_events
for each row execute function finance.reject_audit_mutation();

create index if not exists documents_partner_date_idx
  on finance.documents(company_id, partner_id, document_date desc);
create index if not exists documents_due_status_idx
  on finance.documents(company_id, due_date, status) where due_date is not null;
create index if not exists payments_document_status_idx
  on finance.payments(company_id, document_id, status);
create index if not exists tax_transactions_counterparty_idx
  on finance.tax_transactions(company_id, counterparty_id, tax_period);

-- Re-assert deny-by-default client access after adding Finance functions/triggers.
revoke all on all tables in schema finance from public, anon, authenticated;
revoke all on all sequences in schema finance from public, anon, authenticated;
revoke all on all functions in schema finance from public, anon, authenticated;
grant usage on schema finance to service_role;

commit;
