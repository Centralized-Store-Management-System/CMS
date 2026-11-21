-- ขั้นตอนเบิก–เคลียร์ค่าใช้จ่ายครบวงจร (ต่อจาก expense_clearance_lifecycle ของ GPT) — เพิ่มอย่างเดียว ไม่แก้ข้อมูลเดิม
-- 1) แก้บั๊ก: ไฟล์ของรายการเคลียร์ (clearance_id) ไม่ผ่าน check เดิมที่นับแค่ document/filing/payment → อัปโหลดหลักฐานไม่ได้
-- 2) ประเภทไฟล์: ใบเสนอราคา (แนบตอนขอเบิก) และหลักฐานคืนเงิน
-- 3) ส่งกลับจากขั้นไหน (Owner / ผู้ตรวจสุดท้าย), บัญชีรับเงินคืน, รายการบัญชีที่ปิดงาน
begin;

alter table finance.document_files drop constraint if exists document_files_check;
alter table finance.document_files add constraint document_files_check
  check (num_nonnulls(document_id, filing_id, payment_id, clearance_id) = 1);

alter table finance.document_files drop constraint if exists document_files_file_category_check;
alter table finance.document_files add constraint document_files_file_category_check
  check (file_category in ('payment_evidence','receipt_invoice','tax_invoice','wht_document','supporting','refund_evidence','quotation'));

alter table finance.expense_clearances
  add column if not exists returned_stage text,
  add column if not exists refund_account_id uuid references finance.chart_of_accounts(id),
  add column if not exists journal_entry_id uuid references finance.journal_entries(id);

alter table finance.expense_clearances drop constraint if exists expense_clearances_returned_stage_check;
alter table finance.expense_clearances add constraint expense_clearances_returned_stage_check
  check (returned_stage is null or returned_stage in ('owner','verifier'));

-- 3.1) ประวัติการอนุมัติของรายการเคลียร์ (เดิมอนุญาตแค่ 7 คำ → Owner อนุมัติเคลียร์/ผู้ตรวจยืนยัน บันทึกไม่ได้)
alter table finance.approval_events drop constraint if exists approval_events_action_check;
alter table finance.approval_events add constraint approval_events_action_check
  check (action in ('submitted','approved','rejected','returned','cancelled','posted','reversed',
                    'owner_approved','verified','verifier_returned','resubmitted_to_verifier'));

create index if not exists document_files_document_idx on finance.document_files (company_id, document_id) where document_id is not null and deleted_at is null;

comment on column finance.expense_clearances.returned_stage is 'ส่งกลับจากขั้นไหน: owner = Owner ตรวจเคลียร์, verifier = ผู้ตรวจสุดท้าย (แก้แล้วยอดเท่าเดิม → กลับไปผู้ตรวจสุดท้ายโดยตรง)';

-- 4) ล้างข้อมูลทดสอบ (UAT) ต้องลบรายการเคลียร์ก่อนเอกสาร/รายการบัญชี (เดิมไม่ลบ → ปุ่มล้างข้อมูลทดสอบล้มเหลวเมื่อมีรายการเคลียร์)
create or replace function finance.purge_company_transactions(p_company uuid, p_keep_setup boolean default true)
returns jsonb language plpgsql security definer set search_path to ''
as $function$
declare env text; n jsonb := '{}'::jsonb; c int;
begin
  select environment into env from finance.companies where id = p_company for update;
  if env is null then raise exception 'Company not found' using errcode = 'P0002'; end if;
  if env <> 'uat' then raise exception 'Purge is allowed only for the UAT workspace' using errcode = '42501'; end if;
  perform set_config('finance.purge_company', p_company::text, true);
  update finance.tax_filings set journal_entry_id = null where company_id = p_company and status not in ('submitted','paid');
  delete from finance.tax_filing_lines where company_id = p_company; get diagnostics c = row_count; n := n || jsonb_build_object('tax_filing_lines', c);
  delete from finance.document_files where company_id = p_company; get diagnostics c = row_count; n := n || jsonb_build_object('document_files', c);
  delete from finance.expense_clearances where company_id = p_company; get diagnostics c = row_count; n := n || jsonb_build_object('expense_clearances', c);
  delete from finance.payment_verifications where company_id = p_company; get diagnostics c = row_count; n := n || jsonb_build_object('payment_verifications', c);
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
    alter table finance.accounting_periods disable trigger trg_accounting_periods_guard_closed;
    update finance.accounting_periods set status = 'open', closed_by = null, closed_at = null, reopened_by = null, reopened_at = null, close_note = null where company_id = p_company;
    alter table finance.accounting_periods enable trigger trg_accounting_periods_guard_closed;
  end if;
  perform set_config('finance.purge_company', '', true);
  return n;
end $function$;
revoke all on function finance.purge_company_transactions(uuid, boolean) from public, anon, authenticated;
grant execute on function finance.purge_company_transactions(uuid, boolean) to service_role;

commit;
