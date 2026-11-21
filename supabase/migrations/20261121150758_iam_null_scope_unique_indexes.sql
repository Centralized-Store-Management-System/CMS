-- Prevent duplicate global departments and default position-role bindings (NULL valid_from).
create unique index if not exists org_departments_global_code_uidx
  on public.org_departments(department_code) where organization_id is null;
create unique index if not exists iam_position_role_binding_default_uidx
  on public.iam_position_role_bindings(position_id,role_id) where valid_from is null;
