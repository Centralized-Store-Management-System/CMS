-- Cover foreign-key joins used by HR and IAM policy resolution.
-- Additive indexes only; no data or authorization behavior changes.
create index if not exists hr_positions_department_id_idx
  on public.hr_positions(department_id)
  where department_id is not null;

create index if not exists iam_position_role_bindings_role_id_idx
  on public.iam_position_role_bindings(role_id);

create index if not exists iam_principal_role_grants_role_id_idx
  on public.iam_principal_role_grants(role_id);

create index if not exists iam_role_permissions_permission_id_idx
  on public.iam_role_permissions(permission_id);

create index if not exists org_departments_parent_id_idx
  on public.org_departments(parent_id)
  where parent_id is not null;
