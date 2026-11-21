-- HR Position Master + centrally managed application permission mappings.
-- Existing employee.position text remains backward compatible; new records also store position_id.
create extension if not exists pgcrypto;
create table if not exists public.hr_positions (
  id uuid primary key default gen_random_uuid(),
  position_code text not null unique,
  name_th text not null,
  name_en text,
  department text,
  level text,
  description text,
  status text not null default 'active' check (status in ('active','inactive')),
  created_by text,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists hr_positions_status_name_idx on public.hr_positions(status, name_th);
create table if not exists public.it_position_permissions (
  id uuid primary key default gen_random_uuid(),
  position_id uuid not null references public.hr_positions(id) on delete cascade,
  application_key text not null,
  permission_codes text[] not null default '{}',
  branch_scope text not null default 'assigned',
  status text not null default 'draft' check (status in ('draft','active','inactive')),
  version integer not null default 1,
  updated_by text,
  updated_at timestamptz not null default now(),
  unique(position_id, application_key)
);
create table if not exists public.hr_position_audit (
  id uuid primary key default gen_random_uuid(),
  position_id uuid,
  action text not null,
  before_state jsonb,
  after_state jsonb,
  actor text not null,
  created_at timestamptz not null default now()
);
alter table public.hr_positions enable row level security;
alter table public.it_position_permissions enable row level security;
alter table public.hr_position_audit enable row level security;
revoke all on public.hr_positions, public.it_position_permissions, public.hr_position_audit from anon, authenticated;
grant all on public.hr_positions, public.it_position_permissions, public.hr_position_audit to service_role;
