-- Finance Manager / Staff request workflow + final document verification
-- Additive only: does not change existing transaction rows or grant any user a new role.
begin;

alter table finance.user_roles drop constraint if exists user_roles_role_code_check;
alter table finance.user_roles add constraint user_roles_role_code_check
  check (role_code in ('owner','approver','manager','staff','verifier','accountant','viewer'));

alter table finance.document_files add column if not exists payment_id uuid;
alter table finance.document_files add column if not exists file_category text not null default 'supporting';
alter table finance.document_files drop constraint if exists document_files_check;
alter table finance.document_files add constraint document_files_check
  check (num_nonnulls(document_id, filing_id, payment_id) = 1);
alter table finance.document_files drop constraint if exists document_files_payment_id_fkey;
alter table finance.document_files add constraint document_files_payment_id_fkey
  foreign key (payment_id) references finance.payments(id) on delete restrict;
alter table finance.document_files drop constraint if exists document_files_file_category_check;
alter table finance.document_files add constraint document_files_file_category_check
  check (file_category in ('payment_evidence','receipt_invoice','tax_invoice','wht_document','supporting'));

create index if not exists document_files_company_payment_idx
  on finance.document_files(company_id, payment_id, created_at desc)
  where payment_id is not null and deleted_at is null;

create table if not exists finance.payment_verifications (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references finance.companies(id) on delete restrict,
  payment_id uuid not null unique references finance.payments(id) on delete restrict,
  status text not null default 'pending' check (status in ('pending','verified')),
  checklist jsonb not null default '{}'::jsonb,
  verified_by text,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists payment_verifications_company_status_idx
  on finance.payment_verifications(company_id, status, updated_at desc);
alter table finance.payment_verifications enable row level security;
revoke all on finance.payment_verifications from anon, authenticated;
grant all on finance.payment_verifications to service_role;
alter table finance.document_files enable row level security;
revoke all on finance.document_files from anon, authenticated;
grant all on finance.document_files to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('finance-private-documents', 'finance-private-documents', false, 20971520,
  array['application/pdf','image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = false, file_size_limit = 20971520,
  allowed_mime_types = excluded.allowed_mime_types;

commit;
