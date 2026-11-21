-- Canonical employee identity and durable outbox delivery metadata.
-- Additive only: legacy staff/login/LINE flows remain unchanged.
create table if not exists public.iam_principals (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null unique references public.staff(id) on delete restrict,
  auth_user_id uuid unique,
  cms_ref text unique,
  principal_type text not null default 'employee' check (principal_type in ('employee','service')),
  status text not null default 'active' check (status in ('active','inactive','suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists iam_principals_auth_user_idx on public.iam_principals(auth_user_id) where auth_user_id is not null;
create index if not exists iam_principals_cms_ref_idx on public.iam_principals(cms_ref) where cms_ref is not null;

-- Backfill only unambiguous staff identities. Existing login identifiers are copied, never changed.
insert into public.iam_principals(staff_id,auth_user_id,cms_ref,status)
select s.id,s.auth_user_id,nullif(trim(s.cms_ref),''),case when coalesce(s.is_active,true) then 'active' else 'inactive' end
from public.staff s
where not exists (select 1 from public.iam_principals p where p.staff_id=s.id)
on conflict do nothing;

alter table public.iam_sync_outbox
  add column if not exists locked_at timestamptz,
  add column if not exists locked_by text,
  add column if not exists delivered_at timestamptz,
  add column if not exists idempotency_key text;
create unique index if not exists iam_sync_outbox_idempotency_idx
  on public.iam_sync_outbox(idempotency_key) where idempotency_key is not null;
create index if not exists iam_sync_outbox_claim_idx
  on public.iam_sync_outbox(status,next_attempt_at,created_at)
  where status in ('pending','failed','processing');

alter table public.iam_principals enable row level security;
revoke all on public.iam_principals from anon, authenticated;
grant all on public.iam_principals to service_role;
