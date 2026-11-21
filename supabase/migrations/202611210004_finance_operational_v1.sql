-- Finance พร้อมใช้งาน v1 (21 พ.ย. 2569 · Claude) — เพิ่มอย่างเดียว ไม่ลบข้อมูล · เฉพาะ schema finance
-- 1) แก้บั๊ก: accounting_periods มี trigger updated_at แต่ไม่มีคอลัมน์ → แก้ไขรอบบัญชีไม่ได้เลย
-- 2) สิทธิ์ Finance 4 ระดับ: owner / approver / accountant / viewer
-- 3) บัญชีระบบ (system_key) สำหรับลงบัญชีอัตโนมัติ · ตั้งค่าบริษัท (อนุมัติรายการตนเอง / วันเริ่มใช้งานจริง)
-- 4) การเปลี่ยนสถานะที่ล็อกแล้วแบบควบคุม: ปิดรอบ→เปิดใหม่, ลงบัญชีแล้ว→กลับรายการ, ยื่นแบบแล้ว→ชำระแล้ว
-- 5) ล้างข้อมูลทดสอบ (เฉพาะบริษัท uat) และเริ่มใช้งานจริง (ทางเดียว)

-- 1) periods
alter table finance.accounting_periods add column if not exists updated_at timestamptz not null default now();
alter table finance.accounting_periods add column if not exists close_note text;

-- 2) roles
alter table finance.user_roles drop constraint if exists user_roles_role_code_check;
update finance.user_roles set role_code = 'accountant' where role_code = 'accounting';
alter table finance.user_roles add constraint user_roles_role_code_check check (role_code in ('owner','approver','accountant','viewer'));
alter table finance.user_roles add column if not exists display_name text;
alter table finance.user_roles add column if not exists granted_by text;

-- 3) company settings / system accounts
alter table finance.companies add column if not exists allow_self_approval boolean not null default false;
alter table finance.companies add column if not exists go_live_at timestamptz;
alter table finance.companies add column if not exists go_live_by text;
alter table finance.chart_of_accounts add column if not exists system_key text;
alter table finance.chart_of_accounts add column if not exists description text;
alter table finance.chart_of_accounts add column if not exists updated_at timestamptz not null default now();
create unique index if not exists chart_of_accounts_system_key_uq on finance.chart_of_accounts (company_id, system_key) where system_key is not null;
do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_chart_of_accounts_updated_at') then
    create trigger trg_chart_of_accounts_updated_at before update on finance.chart_of_accounts for each row execute function finance.touch_updated_at();
  end if;
end $$;

-- documents
alter table finance.documents add column if not exists submitted_by text;
alter table finance.documents add column if not exists voided_by text;
alter table finance.documents add column if not exists void_reason text;
alter table finance.documents add column if not exists reference text;

-- journals
alter table finance.journal_entries add column if not exists source_type text not null default 'manual';
alter table finance.journal_entries add column if not exists source_payment_id uuid;
alter table finance.journal_entries add column if not exists reversal_of uuid;
alter table finance.journal_entries add column if not exists posted_by text;
alter table finance.journal_entries add column if not exists review_note text;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'journal_entries_source_type_check') then
    alter table finance.journal_entries add constraint journal_entries_source_type_check check (source_type in ('manual','document','payment','reversal','tax','opening'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'journal_entries_company_payment_fk') then
    alter table finance.journal_entries add constraint journal_entries_company_payment_fk foreign key (company_id, source_payment_id) references finance.payments (company_id, id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'journal_entries_company_reversal_fk') then
    alter table finance.journal_entries add constraint journal_entries_company_reversal_fk foreign key (company_id, reversal_of) references finance.journal_entries (company_id, id);
  end if;
end $$;
create unique index if not exists journal_entries_one_reversal_uq on finance.journal_entries (company_id, reversal_of) where reversal_of is not null;
create unique index if not exists journal_entries_one_document_uq on finance.journal_entries (company_id, source_document_id) where source_type = 'document';
create unique index if not exists journal_entries_one_payment_uq on finance.journal_entries (company_id, source_payment_id) where source_type = 'payment';
create index if not exists journal_lines_company_account_idx on finance.journal_lines (company_id, account_id);

-- payments
alter table finance.payments add column if not exists partner_id uuid;
alter table finance.payments add column if not exists cash_account_id uuid;
alter table finance.payments add column if not exists offset_account_id uuid;
alter table finance.payments add column if not exists note text;
alter table finance.payments add column if not exists rejected_by text;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'payments_company_partner_fk') then
    alter table finance.payments add constraint payments_company_partner_fk foreign key (company_id, partner_id) references finance.partners (company_id, id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'payments_company_cash_account_fk') then
    alter table finance.payments add constraint payments_company_cash_account_fk foreign key (company_id, cash_account_id) references finance.chart_of_accounts (company_id, id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'payments_company_offset_account_fk') then
    alter table finance.payments add constraint payments_company_offset_account_fk foreign key (company_id, offset_account_id) references finance.chart_of_accounts (company_id, id);
  end if;
end $$;

-- tax filings
alter table finance.tax_filings add column if not exists notes text;
alter table finance.tax_filings add column if not exists journal_entry_id uuid;
alter table finance.tax_filings add column if not exists submitted_by text;
alter table finance.tax_filings add column if not exists totals jsonb not null default '{}'::jsonb;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'tax_filings_company_journal_fk') then
    alter table finance.tax_filings add constraint tax_filings_company_journal_fk foreign key (company_id, journal_entry_id) references finance.journal_entries (company_id, id);
  end if;
end $$;

-- 4) การเปลี่ยนสถานะของรายการที่ล็อกแล้ว (แทน guard_posted_record เดิม) + ช่องทางล้างข้อมูลทดสอบ
create or replace function finance.purge_allowed(p_company uuid)
returns boolean language sql stable set search_path = '' as $$
  select p_company is not null
     and coalesce(current_setting('finance.purge_company', true), '') = p_company::text
     and exists (select 1 from finance.companies c where c.id = p_company and c.environment = 'uat')
$$;

create or replace function finance.guard_locked_transition()
returns trigger language plpgsql set search_path = '' as $$
declare
  old_status text := to_jsonb(old)->>'status';
  allowed text[];
  ok boolean := false;
begin
  if tg_op = 'DELETE' then
    if finance.purge_allowed(old.company_id) then return old; end if;
    if old_status in ('posted','paid','submitted','closed','reversed','approved','reopened') and tg_table_name <> 'accounting_periods' then
      raise exception 'Finance record is locked; create a reversal or adjustment instead' using errcode = '55000';
    end if;
    if tg_table_name = 'accounting_periods' and old_status in ('closed','reopened') then
      raise exception 'Closed accounting period cannot be deleted' using errcode = '55000';
    end if;
    return old;
  end if;
  if old_status not in ('posted','paid','submitted','closed','reversed') then return new; end if;
  if tg_table_name in ('documents','journal_entries') and old_status = 'posted' and new.status = 'reversed' then
    ok := true; allowed := array['status','updated_at','voided_by','void_reason'];
  elsif tg_table_name = 'tax_filings' and old_status = 'submitted' and new.status = 'paid' then
    ok := true; allowed := array['status','updated_at','notes'];
  elsif tg_table_name = 'accounting_periods' and old_status = 'closed' and new.status = 'reopened' then
    ok := true; allowed := array['status','updated_at','reopened_by','reopened_at','close_note'];
  end if;
  if not ok or (to_jsonb(new) - allowed) is distinct from (to_jsonb(old) - allowed) then
    raise exception 'Finance record is locked; create a reversal or adjustment instead' using errcode = '55000';
  end if;
  return new;
end $$;

drop trigger if exists trg_documents_guard_posted on finance.documents;
create trigger trg_documents_guard_posted before update or delete on finance.documents for each row execute function finance.guard_locked_transition();
drop trigger if exists trg_journal_entries_guard_posted on finance.journal_entries;
create trigger trg_journal_entries_guard_posted before update or delete on finance.journal_entries for each row execute function finance.guard_locked_transition();
drop trigger if exists trg_payments_guard_posted on finance.payments;
create trigger trg_payments_guard_posted before update or delete on finance.payments for each row execute function finance.guard_locked_transition();
drop trigger if exists trg_tax_filings_guard_submitted on finance.tax_filings;
create trigger trg_tax_filings_guard_submitted before update or delete on finance.tax_filings for each row execute function finance.guard_locked_transition();
drop trigger if exists trg_accounting_periods_guard_closed on finance.accounting_periods;
create trigger trg_accounting_periods_guard_closed before update or delete on finance.accounting_periods for each row execute function finance.guard_locked_transition();

-- บรรทัดเอกสาร/สมุดรายวัน: ล้างข้อมูลทดสอบได้
create or replace function finance.guard_document_line_parent()
returns trigger language plpgsql set search_path to 'pg_catalog', 'finance' as $function$
declare source_status text; target_status text; source_id uuid; target_id uuid; parent_company uuid;
begin
  source_id := case when tg_op = 'INSERT' then null else old.document_id end;
  target_id := case when tg_op = 'DELETE' then null else new.document_id end;
  if tg_op = 'DELETE' then
    select company_id into parent_company from finance.documents where id = source_id;
    if finance.purge_allowed(parent_company) then return old; end if;
  end if;
  if source_id is not null then
    select status into source_status from finance.documents where id = source_id;
    if source_status in ('posted','voided','reversed') then
      raise exception 'Document lines are locked by their parent document' using errcode = '55000';
    end if;
  end if;
  if target_id is not null then
    select status into target_status from finance.documents where id = target_id;
    if target_status in ('posted','voided','reversed') then
      raise exception 'Cannot add or move lines into a locked document' using errcode = '55000';
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $function$;

create or replace function finance.guard_journal_line_parent()
returns trigger language plpgsql set search_path to 'pg_catalog', 'finance' as $function$
declare source_status text; target_status text; source_id uuid; target_id uuid;
begin
  if tg_op = 'DELETE' and finance.purge_allowed(old.company_id) then return old; end if;
  source_id := case when tg_op = 'INSERT' then null else old.journal_entry_id end;
  target_id := case when tg_op = 'DELETE' then null else new.journal_entry_id end;
  if source_id is not null then
    select status into source_status from finance.journal_entries where id = source_id;
    if source_status in ('posted','reversed') then
      raise exception 'Journal lines are locked by their parent journal' using errcode = '55000';
    end if;
  end if;
  if target_id is not null and tg_op <> 'INSERT' then
    select status into target_status from finance.journal_entries where id = target_id;
    if target_status in ('posted','reversed') then
      raise exception 'Cannot add or move lines into a locked journal' using errcode = '55000';
    end if;
  end if;
  if tg_op = 'INSERT' then
    select status into target_status from finance.journal_entries where id = target_id;
    if target_status in ('posted','reversed') and coalesce(current_setting('finance.posting', true), '') <> 'on' then
      raise exception 'Cannot add or move lines into a locked journal' using errcode = '55000';
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $function$;

create or replace function finance.reject_audit_mutation()
returns trigger language plpgsql set search_path to 'pg_catalog', 'finance' as $function$
begin
  if tg_op = 'DELETE' and finance.purge_allowed(old.company_id) then return old; end if;
  raise exception 'Finance audit events are append-only' using errcode = '55000';
end $function$;

create or replace function finance.reject_payment_event_mutation()
returns trigger language plpgsql set search_path to 'pg_catalog', 'finance' as $function$
begin
  if tg_op = 'DELETE' and finance.purge_allowed(old.company_id) then return old; end if;
  raise exception 'Payment events are append-only' using errcode = '55000';
end $function$;

-- เปลี่ยนจากใช้งานจริงกลับเป็นทดสอบไม่ได้
create or replace function finance.guard_company_environment()
returns trigger language plpgsql set search_path = '' as $$
begin
  if old.environment = 'production' and new.environment <> 'production' then
    raise exception 'Production company cannot return to UAT' using errcode = '55000';
  end if;
  return new;
end $$;
drop trigger if exists trg_companies_environment_guard on finance.companies;
create trigger trg_companies_environment_guard before update on finance.companies for each row execute function finance.guard_company_environment();

-- 5) ล้างข้อมูลทดสอบ — เฉพาะบริษัท uat · p_keep_setup = เก็บผังบัญชี คู่ค้า รอบบัญชี ผู้ใช้
create or replace function finance.purge_company_transactions(p_company uuid, p_keep_setup boolean default true)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare env text; n jsonb := '{}'::jsonb; c int;
begin
  select environment into env from finance.companies where id = p_company for update;
  if env is null then raise exception 'Company not found' using errcode = 'P0002'; end if;
  if env <> 'uat' then raise exception 'Purge is allowed only for the UAT workspace' using errcode = '42501'; end if;
  perform set_config('finance.purge_company', p_company::text, true);
  update finance.tax_filings set journal_entry_id = null where company_id = p_company and status not in ('submitted','paid');
  delete from finance.tax_filing_lines where company_id = p_company; get diagnostics c = row_count; n := n || jsonb_build_object('tax_filing_lines', c);
  delete from finance.document_files where company_id = p_company; get diagnostics c = row_count; n := n || jsonb_build_object('document_files', c);
  delete from finance.tax_filings where company_id = p_company; get diagnostics c = row_count; n := n || jsonb_build_object('tax_filings', c);
  delete from finance.payment_allocations where company_id = p_company; get diagnostics c = row_count; n := n || jsonb_build_object('payment_allocations', c);
  delete from finance.payment_events where company_id = p_company; get diagnostics c = row_count; n := n || jsonb_build_object('payment_events', c);
  delete from finance.journal_lines where company_id = p_company; get diagnostics c = row_count; n := n || jsonb_build_object('journal_lines', c);
  delete from finance.journal_entries where company_id = p_company; get diagnostics c = row_count; n := n || jsonb_build_object('journal_entries', c);
  delete from finance.payments where company_id = p_company; get diagnostics c = row_count; n := n || jsonb_build_object('payments', c);
  delete from finance.tax_transactions where company_id = p_company; get diagnostics c = row_count; n := n || jsonb_build_object('tax_transactions', c);
  delete from finance.document_lines where document_id in (select id from finance.documents where company_id = p_company); get diagnostics c = row_count; n := n || jsonb_build_object('document_lines', c);
  delete from finance.documents where company_id = p_company; get diagnostics c = row_count; n := n || jsonb_build_object('documents', c);
  delete from finance.approval_events where company_id = p_company; get diagnostics c = row_count; n := n || jsonb_build_object('approval_events', c);
  delete from finance.audit_events where company_id = p_company; get diagnostics c = row_count; n := n || jsonb_build_object('audit_events', c);
  delete from finance.integration_inbox where company_id = p_company;
  delete from finance.integration_outbox where company_id = p_company;
  delete from finance.journal_sequences where company_id = p_company;
  delete from finance.document_sequences where company_id = p_company;
  if not p_keep_setup then
    delete from finance.categories where company_id = p_company;
    delete from finance.partners where company_id = p_company; get diagnostics c = row_count; n := n || jsonb_build_object('partners', c);
    delete from finance.chart_of_accounts where company_id = p_company; get diagnostics c = row_count; n := n || jsonb_build_object('chart_of_accounts', c);
    delete from finance.accounting_periods where company_id = p_company; get diagnostics c = row_count; n := n || jsonb_build_object('accounting_periods', c);
    delete from finance.company_tax_profiles where company_id = p_company;
  else
    -- รอบบัญชีที่ปิดไว้ระหว่างทดสอบ → เปิดใหม่ให้เริ่มจริงได้
    alter table finance.accounting_periods disable trigger trg_accounting_periods_guard_closed;
    update finance.accounting_periods set status = 'open', closed_by = null, closed_at = null, reopened_by = null, reopened_at = null, close_note = null where company_id = p_company;
    alter table finance.accounting_periods enable trigger trg_accounting_periods_guard_closed;
  end if;
  perform set_config('finance.purge_company', '', true);
  return n;
end $$;

-- เริ่มใช้งานจริง: ล้างรายการทดสอบ (เก็บการตั้งค่า) แล้วเปลี่ยนเป็น production ถาวร
create or replace function finance.go_live(p_company uuid, p_actor text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare n jsonb;
begin
  n := finance.purge_company_transactions(p_company, true);
  update finance.companies set environment = 'production', go_live_at = now(), go_live_by = p_actor where id = p_company;
  insert into finance.audit_events (company_id, actor_ref, action, entity_type, entity_id, after_data)
  values (p_company, p_actor, 'go_live', 'company', p_company::text, jsonb_build_object('purged', n));
  return n;
end $$;

revoke all on function finance.purge_company_transactions(uuid, boolean) from public, anon, authenticated;
revoke all on function finance.go_live(uuid, text) from public, anon, authenticated;
revoke all on function finance.purge_allowed(uuid) from public, anon, authenticated;
grant execute on function finance.purge_company_transactions(uuid, boolean) to service_role;
grant execute on function finance.go_live(uuid, text) to service_role;
