-- Dynamic organization + IAM foundation.
-- Deliberately additive: legacy roles, auth, HR employee storage and Finance workflows remain unchanged.
-- No grants are activated by creating a position or role.

create table if not exists public.org_organizations (
  id uuid primary key default gen_random_uuid(),
  organization_code text not null unique,
  name text not null,
  status text not null default 'active' check (status in ('active','inactive')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.org_departments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.org_organizations(id) on delete restrict,
  parent_id uuid references public.org_departments(id) on delete restrict,
  department_code text not null,
  name text not null,
  status text not null default 'active' check (status in ('active','inactive')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, department_code)
);

create table if not exists public.iam_applications (
  id uuid primary key default gen_random_uuid(),
  application_key text not null unique check (application_key ~ '^[a-z0-9_-]{2,60}$'),
  display_name text not null,
  owner_key text,
  status text not null default 'draft' check (status in ('draft','active','inactive')),
  integration_version integer not null default 1,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.iam_permissions (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.iam_applications(id) on delete restrict,
  permission_code text not null check (permission_code ~ '^[a-zA-Z0-9._:-]{2,120}$'),
  resource_key text not null,
  action_key text not null,
  description text,
  risk_level text not null default 'normal' check (risk_level in ('normal','sensitive','critical')),
  status text not null default 'draft' check (status in ('draft','active','inactive')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (application_id, permission_code),
  unique (application_id, resource_key, action_key)
);

create table if not exists public.iam_roles (
  id uuid primary key default gen_random_uuid(),
  role_key text not null unique check (role_key ~ '^[a-zA-Z0-9_-]{2,80}$'),
  display_name text not null,
  description text,
  status text not null default 'draft' check (status in ('draft','active','inactive')),
  version integer not null default 1,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.iam_role_permissions (
  role_id uuid not null references public.iam_roles(id) on delete restrict,
  permission_id uuid not null references public.iam_permissions(id) on delete restrict,
  constraints jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  primary key (role_id, permission_id)
);

create table if not exists public.iam_position_role_bindings (
  id uuid primary key default gen_random_uuid(),
  position_id uuid not null references public.hr_positions(id) on delete restrict,
  role_id uuid not null references public.iam_roles(id) on delete restrict,
  scope_template jsonb not null default '{"branch":"assigned"}'::jsonb,
  status text not null default 'draft' check (status in ('draft','active','inactive')),
  valid_from date,
  valid_to date,
  created_by text,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (valid_to is null or valid_from is null or valid_to >= valid_from),
  unique (position_id, role_id, valid_from)
);

create table if not exists public.iam_principal_role_grants (
  id uuid primary key default gen_random_uuid(),
  principal_ref text not null,
  role_id uuid not null references public.iam_roles(id) on delete restrict,
  scope jsonb not null default '{}'::jsonb,
  grant_source text not null default 'manual',
  status text not null default 'active' check (status in ('active','revoked','expired')),
  valid_from timestamptz not null default now(),
  valid_to timestamptz,
  granted_by text,
  revoked_by text,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  check (valid_to is null or valid_to >= valid_from)
);
create index if not exists iam_principal_grants_lookup_idx
  on public.iam_principal_role_grants(principal_ref, status, valid_from, valid_to);

create table if not exists public.iam_sync_outbox (
  id uuid primary key default gen_random_uuid(),
  event_key text not null unique,
  aggregate_type text not null,
  aggregate_id text not null,
  aggregate_version integer not null default 1,
  event_type text not null,
  schema_version integer not null default 1,
  payload jsonb not null,
  status text not null default 'pending' check (status in ('pending','processing','processed','failed','dead_letter')),
  attempt_count integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  last_error text,
  created_at timestamptz not null default now(),
  processed_at timestamptz
);
create index if not exists iam_sync_outbox_pending_idx
  on public.iam_sync_outbox(status, next_attempt_at, created_at)
  where status in ('pending','failed');

create table if not exists public.iam_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_ref text not null,
  action_key text not null,
  target_type text not null,
  target_id text,
  before_state jsonb,
  after_state jsonb,
  policy_version integer,
  created_at timestamptz not null default now()
);
create index if not exists iam_audit_log_target_idx
  on public.iam_audit_log(target_type, target_id, created_at desc);

alter table public.org_organizations enable row level security;
alter table public.org_departments enable row level security;
alter table public.iam_applications enable row level security;
alter table public.iam_permissions enable row level security;
alter table public.iam_roles enable row level security;
alter table public.iam_role_permissions enable row level security;
alter table public.iam_position_role_bindings enable row level security;
alter table public.iam_principal_role_grants enable row level security;
alter table public.iam_sync_outbox enable row level security;
alter table public.iam_audit_log enable row level security;

revoke all on public.org_organizations, public.org_departments,
  public.iam_applications, public.iam_permissions, public.iam_roles,
  public.iam_role_permissions, public.iam_position_role_bindings,
  public.iam_principal_role_grants, public.iam_sync_outbox, public.iam_audit_log
from anon, authenticated;

grant all on public.org_organizations, public.org_departments,
  public.iam_applications, public.iam_permissions, public.iam_roles,
  public.iam_role_permissions, public.iam_position_role_bindings,
  public.iam_principal_role_grants, public.iam_sync_outbox, public.iam_audit_log
to service_role;

comment on table public.iam_sync_outbox is
  'Transactional outbox for reliable HR-to-IT and cross-module configuration synchronization. Not yet consumed until an authenticated worker is deployed.';
comment on table public.iam_position_role_bindings is
  'Position-to-role policy bindings. Draft by default; creating a position never grants access.';
comment on table public.iam_principal_role_grants is
  'Effective, scoped principal grants. Runtime enforcement must be implemented by each protected backend before activation.';
