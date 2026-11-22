import postgres from "npm:postgres@3.4.5";

const SUPABASE_URL = (Deno.env.get("SUPABASE_URL") || "").replace(/\/$/, "");
const DB_URL = Deno.env.get("SUPABASE_DB_URL") || "";
const BACKOFFICE_URL = SUPABASE_URL + "/functions/v1/backoffice";
const ALLOWED_ORIGINS = new Set([
  "https://centralized-store-management.github.io",
  "https://centralized-store-management-system.github.io",
]);
const sql = DB_URL ? postgres(DB_URL, { max: 2, idle_timeout: 10, connect_timeout: 10 }) : null;

class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}
function reply(body: unknown, status = 200, origin = "") {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store, private",
      "vary": "Origin",
      ...(origin && ALLOWED_ORIGINS.has(origin) ? {
        "access-control-allow-origin": origin,
        "access-control-allow-headers": "content-type, x-cms-session",
        "access-control-allow-methods": "GET, OPTIONS",
        "access-control-max-age": "600",
      } : {}),
    },
  });
}
function parseJsonp(text: string) {
  const raw = text.trim();
  try { return JSON.parse(raw); } catch (_) { /* Back Office may return JSONP. */ }
  const a = raw.indexOf("("), b = raw.lastIndexOf(")");
  if (a < 0 || b <= a) throw new HttpError(401, "ยืนยันบัญชี Owner ไม่สำเร็จ");
  try { return JSON.parse(raw.slice(a + 1, b)); }
  catch (_) { throw new HttpError(401, "ยืนยันบัญชี Owner ไม่สำเร็จ"); }
}
async function requireOwner(token: string) {
  if (!token || token.length > 4096) throw new HttpError(401, "กรุณาเข้าสู่ระบบ Owner ใหม่");
  const u = new URL(BACKOFFICE_URL);
  u.searchParams.set("action", "bootstrap");
  u.searchParams.set("t", token);
  u.searchParams.set("callback", "_it_intelligence_network_auth");
  u.searchParams.set("_", String(Date.now()));
  const r = await fetch(u, { cache: "no-store" });
  if (!r.ok) throw new HttpError(401, "Session หมดอายุ กรุณาเข้าสู่ระบบ Owner ใหม่");
  const parsed = parseJsonp(await r.text());
  const boot = parsed.data || parsed;
  if (!boot.me || boot.me.role !== "owner") throw new HttpError(403, "เฉพาะ Owner เท่านั้นที่เข้าถึง AI Intelligence Network ได้");
}

const DOMAIN_DEFINITIONS = [
  { key: "finance", label: "FINANCE", labelTh: "การเงินและบัญชี", departmentCodes: ["FINANCE", "FINANCE_ACCOUNTING"], departmentTerms: ["finance", "บัญชี"], appKeys: ["finance", "accounting", "payroll"] },
  { key: "hr", label: "HR", labelTh: "ทรัพยากรบุคคล", departmentCodes: ["HR", "HUMAN_RESOURCES"], departmentTerms: ["human resources", "ทรัพยากรบุคคล", "hr"], appKeys: ["hr", "payroll", "schedule"] },
  { key: "it", label: "IT ADVANCE", labelTh: "เทคโนโลยีและระบบ", departmentCodes: ["IT", "IT_ADVANCE", "TECHNOLOGY"], departmentTerms: ["technology", "information technology", "ไอที"], appKeys: [] },
  { key: "shop", label: "MGR SHOP", labelTh: "บริหารสาขา", departmentCodes: ["OPERATIONS", "MGR_SHOP", "SHOP_OPERATIONS"], departmentTerms: ["operations", "shop", "สาขา", "ปฏิบัติการ"], appKeys: ["backoffice", "inventory", "schedule", "orders"] },
  { key: "line-order", label: "LINE ORDER", labelTh: "ระบบสั่งซื้อออนไลน์", departmentCodes: ["LINE_ORDER", "DIGITAL_ORDER"], departmentTerms: ["line order", "digital order", "order"], appKeys: ["orders", "line", "liff"] },
];

const safeCount = (v: unknown) => Number(v || 0);
function isManagerPosition(position: Record<string, unknown> | null | undefined) {
  if (!position) return false;
  const text = [position.position_code, position.name_th, position.name_en, position.level]
    .map(v => String(v || "")).join(" ").toLowerCase();
  return /manager|head|director|supervisor|ผู้จัดการ|หัวหน้า|ผู้อำนวยการ|บริหาร/.test(text);
}
function mapDomain(domain: typeof DOMAIN_DEFINITIONS[number], departments: any[], staff: any[], applications: any[], owner: any) {
  const matchedDepartments = departments.filter(d =>
    domain.departmentCodes.includes(String(d.department_code || "").toUpperCase()) ||
    domain.departmentTerms.some(term => (String(d.name || "") + " " + String(d.department_code || "")).toLowerCase().includes(term.toLowerCase()))
  );
  const matchedIds = new Set(matchedDepartments.map(d => d.id));
  const members = staff.filter(s => s.department_id && matchedIds.has(s.department_id));
  const formalManagers = members.filter(s => s.is_active && isManagerPosition(s.position));
  const roleManagers = members.filter(s => s.is_active && String(s.role || "").toLowerCase() === "manager");
  const appRows = domain.appKeys.map(key => applications.find(a => a.application_key === key)).filter(Boolean);
  const appConnections = appRows.map(app => ({
    application_key: app.application_key,
    display_name: app.display_name,
    registry_status: app.status,
    permission_count: safeCount(app.permission_count),
    active_permission_count: safeCount(app.active_permission_count),
    active_grant_count: safeCount(app.active_grant_count),
    active_position_binding_count: safeCount(app.active_position_binding_count),
    link_status: app.status === "active" && safeCount(app.active_permission_count) > 0 &&
      (safeCount(app.active_grant_count) > 0 || safeCount(app.active_position_binding_count) > 0) ? "verified" : "missing",
  }));
  return {
    ...domain,
    department_records: matchedDepartments.map(d => ({ id: d.id, code: d.department_code, name: d.name, status: d.status, parent_id: d.parent_id, organization_id: d.organization_id })),
    department_record_count: matchedDepartments.length,
    members,
    formal_managers: formalManagers,
    role_managers_without_formal_position: roleManagers.filter(s => !isManagerPosition(s.position)),
    acting_owner: formalManagers.length === 0 && owner ? { id: owner.id, name: owner.staff_name, role: owner.role, assignment_type: "display_rule_only" } : null,
    manager_status: formalManagers.length ? "assigned" : "vacant",
    applications: appConnections,
  };
}

async function readSnapshot() {
  if (!sql) throw new HttpError(503, "Database connection is not configured");
  return await sql.begin(async (tx: typeof sql) => {
    await tx`SET TRANSACTION READ ONLY`;

    const orgs = await tx`
      select id, organization_code, name, status, metadata, created_at, updated_at
      from public.org_organizations order by organization_code
    `;
    const departments = await tx`
      select id, organization_id, parent_id, department_code, name, status, metadata, created_at, updated_at
      from public.org_departments order by department_code
    `;
    const positions = await tx`
      select p.id, p.position_code, p.name_th, p.name_en, p.department, p.level, p.status,
             p.description, p.department_id, d.department_code, d.name as department_name, p.version
      from public.hr_positions p
      left join public.org_departments d on d.id = p.department_id
      order by d.department_code nulls last, p.position_code
    `;
    const staff = await tx`
      select s.id, s.staff_name, s.role, s.is_active, s.position_id, s.branch_id,
             s.cms_ref, p.position_code, p.name_th as position_name_th, p.name_en as position_name_en,
             p.level as position_level, p.department_id, d.department_code, d.name as department_name,
             b.branch_code, b.branch_name
      from public.staff s
      left join public.hr_positions p on p.id = s.position_id
      left join public.org_departments d on d.id = p.department_id
      left join public.branches b on b.id = s.branch_id
      order by s.is_active desc, s.staff_name
    `;
    const applications = await tx`
      select a.id, a.application_key, a.display_name, a.owner_key, a.status, a.integration_version,
             a.metadata, a.created_at, a.updated_at,
             (select count(*)::int from public.iam_permissions p where p.application_id = a.id) as permission_count,
             (select count(*)::int from public.iam_permissions p where p.application_id = a.id and p.status = 'active') as active_permission_count,
             (select count(distinct g.id)::int
                from public.iam_permissions p
                join public.iam_role_permissions rp on rp.permission_id = p.id
                join public.iam_principal_role_grants g on g.role_id = rp.role_id
               where p.application_id = a.id and p.status = 'active'
                 and g.status = 'active' and g.revoked_at is null
                 and (g.valid_to is null or g.valid_to > now())) as active_grant_count,
             (select count(distinct pb.id)::int
                from public.iam_permissions p
                join public.iam_role_permissions rp on rp.permission_id = p.id
                join public.iam_position_role_bindings pb on pb.role_id = rp.role_id
               where p.application_id = a.id and p.status = 'active'
                 and pb.status = 'active' and (pb.valid_to is null or pb.valid_to >= current_date)) as active_position_binding_count
      from public.iam_applications a order by a.application_key
    `;
    const appAccess = await tx`
      select distinct ip.staff_id, a.application_key, a.display_name, r.role_key, g.status, g.valid_from, g.valid_to
      from public.iam_principals ip
      join public.iam_principal_role_grants g
        on g.principal_ref = ip.id::text
        or g.principal_ref = ip.staff_id::text
        or (ip.cms_ref is not null and g.principal_ref = ip.cms_ref)
        or (ip.auth_user_id is not null and g.principal_ref = ip.auth_user_id::text)
      join public.iam_roles r on r.id = g.role_id
      join public.iam_role_permissions rp on rp.role_id = r.id
      join public.iam_permissions p on p.id = rp.permission_id and p.status = 'active'
      join public.iam_applications a on a.id = p.application_id
      where ip.status = 'active' and g.status = 'active' and g.revoked_at is null
        and g.valid_from <= now() and (g.valid_to is null or g.valid_to > now())
      order by ip.staff_id, a.application_key
    `;
    const positionAccess = await tx`
      select distinct pb.position_id, a.application_key, a.display_name, r.role_key, pb.status
      from public.iam_position_role_bindings pb
      join public.iam_roles r on r.id = pb.role_id
      join public.iam_role_permissions rp on rp.role_id = r.id
      join public.iam_permissions p on p.id = rp.permission_id and p.status = 'active'
      join public.iam_applications a on a.id = p.application_id
      where pb.status = 'active' and (pb.valid_to is null or pb.valid_to >= current_date)
      order by pb.position_id, a.application_key
    `;
    const relationships = await tx`
      select src.relname as source_table, sa.attname as source_column,
             dst.relname as target_table, da.attname as target_column, c.conname as constraint_name
      from pg_constraint c
      join pg_class src on src.oid = c.conrelid
      join pg_namespace sn on sn.oid = src.relnamespace
      join pg_class dst on dst.oid = c.confrelid
      join pg_attribute sa on sa.attrelid = src.oid and sa.attnum = c.conkey[1]
      join pg_attribute da on da.attrelid = dst.oid and da.attnum = c.confkey[1]
      where c.contype = 'f' and sn.nspname = 'public'
        and src.relname = any(array[
          'staff','hr_positions','org_departments','iam_principals','iam_principal_role_grants',
          'iam_permissions','iam_role_permissions','iam_position_role_bindings',
          'orders','order_items','customers','branches','order_status_history','line_channels'
        ])
      order by src.relname, sa.attname
    `;
    const [latestMonitor] = await tx`
      select id, checked_at, risk_score, status, findings, metrics
      from public.it_monitor_runs order by checked_at desc limit 1
    `;
    const [counts] = await tx`
      select
        (select count(*)::int from public.staff where is_active is true) as active_staff,
        (select count(*)::int from public.iam_applications) as registered_applications,
        (select count(*)::int from public.iam_applications where status = 'active') as active_applications,
        (select count(*)::int from public.iam_permissions) as permissions,
        (select count(*)::int from public.iam_permissions where status = 'active') as active_permissions,
        (select count(*)::int from public.iam_principal_role_grants where status = 'active' and revoked_at is null and (valid_to is null or valid_to > now())) as active_user_grants,
        (select count(*)::int from public.iam_position_role_bindings where status = 'active' and (valid_to is null or valid_to >= current_date)) as active_position_bindings,
        (select count(*)::int from public.org_organizations where status = 'active') as active_organizations,
        (select count(*)::int from public.org_departments where status = 'active') as active_departments
    `;
    const owner = staff.find((s: any) => s.is_active && (s.role === "super_admin" || String(s.staff_name).toLowerCase() === "owner")) || null;
    const safeStaff = staff.map((s: any) => ({
      id: s.id, staff_name: s.staff_name, role: s.role, is_active: s.is_active,
      position_id: s.position_id, position_code: s.position_code, position_name_th: s.position_name_th,
      position_name_en: s.position_name_en, position_level: s.position_level,
      position: s.position_id ? { position_code: s.position_code, name_th: s.position_name_th, name_en: s.position_name_en, level: s.position_level } : null,
      department_id: s.department_id, department_code: s.department_code, department_name: s.department_name,
      branch_code: s.branch_code, branch_name: s.branch_name,
      iam_application_access: appAccess.filter((a: any) => a.staff_id === s.id),
      iam_position_access: positionAccess.filter((a: any) => a.position_id === s.position_id),
    }));
    const domainMap = DOMAIN_DEFINITIONS.map(d => mapDomain(d, departments, safeStaff, applications, owner ? { id: owner.id, staff_name: owner.staff_name, role: owner.role } : null));
    const findings = Array.isArray(latestMonitor?.findings) ? latestMonitor.findings : [];
    return {
      generated_at: new Date().toISOString(),
      read_only: true,
      data_sources: [
        "public.org_organizations", "public.org_departments", "public.hr_positions", "public.staff",
        "public.iam_applications", "public.iam_permissions", "public.iam_roles",
        "public.iam_principals", "public.iam_principal_role_grants",
        "public.iam_position_role_bindings", "pg_constraint (foreign keys)", "public.it_monitor_runs"
      ],
      owner: owner ? { id: owner.id, staff_name: owner.staff_name, role: owner.role } : null,
      organizations: orgs,
      departments,
      positions,
      staff: safeStaff,
      applications,
      app_access: appAccess,
      position_access: positionAccess,
      relationships,
      domains: domainMap,
      monitor: latestMonitor ? {
        id: latestMonitor.id, checked_at: latestMonitor.checked_at, risk_score: latestMonitor.risk_score,
        status: latestMonitor.status, findings, metrics: latestMonitor.metrics
      } : null,
      counts,
      integration_policy: {
        dashed_red_means: "ยังไม่พบ active IAM permission / role binding ใน Registry ไม่ได้ยืนยันว่า network layer ล่ม",
        domain_mapping: "ชื่อ 5 กลุ่มเป็น functional domains ตามโครงสร้าง PJD WIN ที่ Owner กำหนด ส่วน department/personnel/application records ดึงจากฐานข้อมูลจริง",
        acting_owner: "แสดง Owner เป็น Acting เฉพาะมุมมองนี้เมื่อไม่พบผู้ดำรงตำแหน่งหัวหน้าจาก HR Position ที่ active; ไม่มีการเขียนหรือเปลี่ยนตำแหน่งในฐานข้อมูล"
      }
    };
  });
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin") || "";
  if (req.method === "OPTIONS") {
    if (origin && !ALLOWED_ORIGINS.has(origin)) return reply({ ok: false, error: "Origin ไม่ได้รับอนุญาต" }, 403);
    return reply({ ok: true }, 200, origin);
  }
  if (origin && !ALLOWED_ORIGINS.has(origin)) return reply({ ok: false, error: "Origin ไม่ได้รับอนุญาต" }, 403);
  if (req.method !== "GET") return reply({ ok: false, error: "รองรับเฉพาะ GET / read-only" }, 405, origin);
  try {
    await requireOwner(req.headers.get("x-cms-session") || "");
    const data = await readSnapshot();
    return reply({ ok: true, data }, 200, origin);
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500;
    if (!(e instanceof HttpError)) console.error("it-intelligence-network", String(e).slice(0, 500));
    return reply({ ok: false, error: e instanceof HttpError ? e.message : "อ่านข้อมูล AI Intelligence Network ไม่สำเร็จ" }, status, origin);
  }
});