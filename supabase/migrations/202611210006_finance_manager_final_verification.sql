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
create unique index if not exists payments_company_id_id_uq on finance.payments(company_id, id);
alter table finance.document_files drop constraint if exists document_files_payment_id_fkey;
alter table finance.document_files drop constraint if exists document_files_company_payment_fk;
alter table finance.document_files add constraint document_files_company_payment_fk
  foreign key (company_id, payment_id) references finance.payments(company_id, id) on delete restrict;
alter table finance.document_files drop constraint if exists document_files_file_category_check;
alter table finance.document_files add constraint document_files_file_category_check
  check (file_category in ('payment_evidence','receipt_invoice','tax_invoice','wht_document','supporting'));

create index if not exists document_files_company_payment_idx
  on finance.document_files(company_id, payment_id, created_at desc)
  where payment_id is not null and deleted_at is null;

create table if not exists finance.payment_verifications (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references finance.companies(id) on delete restrict,
  payment_id uuid not null unique,
  status text not null default 'pending' check (status in ('pending','verified')),
  checklist jsonb not null default '{}'::jsonb,
  verified_by text,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payment_verifications_state_check check (
    (status = 'verified' and verified_by is not null and verified_at is not null)
    or (status = 'pending' and verified_by is null and verified_at is null)
  )
);
alter table finance.payment_verifications drop constraint if exists payment_verifications_company_payment_fk;
alter table finance.payment_verifications add constraint payment_verifications_company_payment_fk
  foreign key (company_id, payment_id) references finance.payments(company_id, id) on delete cascade;

create index if not exists payment_verifications_company_status_idx
  on finance.payment_verifications(company_id, status, updated_at desc);
alter table finance.payment_verifications enable row level security;
revoke all on finance.payment_verifications from anon, authenticated;
grant all on finance.payment_verifications to service_role;
alter table finance.document_files enable row level security;
revoke all on finance.document_files from anon, authenticated;
grant all on finance.document_files to service_role;


-- Keep private Storage objects in sync when UAT purge removes finance.document_files rows.
create or replace function finance.delete_document_file_storage_object()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $finance$
begin
  delete from storage.objects
    where bucket_id = old.storage_bucket and name = old.object_path;
  return old;
end;
$finance$;
revoke all on function finance.delete_document_file_storage_object() from public, anon, authenticated;
grant execute on function finance.delete_document_file_storage_object() to service_role;
drop trigger if exists trg_document_files_delete_storage_object on finance.document_files;
create trigger trg_document_files_delete_storage_object
  after delete on finance.document_files
  for each row execute function finance.delete_document_file_storage_object();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('finance-private-documents', 'finance-private-documents', false, 20971520,
  array['application/pdf','image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = false, file_size_limit = 20971520,
  allowed_mime_types = excluded.allowed_mime_types;

commit;
