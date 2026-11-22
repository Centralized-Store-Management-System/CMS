// hr-position-api — ตำแหน่งงาน (Position Master) ของ HR + แม่แบบสิทธิ์ของตำแหน่ง
// - ตำแหน่ง = แม่แบบสิทธิ์: Role ของบัญชี CMS + สิทธิ์เมนู + บทบาท Finance (ตาราง it_position_permissions: app 'cms' / 'finance')
// - บัญชี CMS/พนักงานได้ Role+สิทธิ์ตามตำแหน่ง (หน้าเว็บ js/hr-position-perms.js เป็นผู้ปรับผ่าน API หลังร้าน) → ระบบออเดอร์ซิงก์ต่อเอง (order-link)
// - บทบาท Finance ปรับที่นี่ (finance.user_roles) เฉพาะแถวที่ตำแหน่งเป็นผู้ให้ (granted_by = 'position:<code>') — สิทธิ์ที่ Owner ตั้งเองใน Finance ไม่ถูกแตะ
// ผู้ใช้: Owner / Admin / HR (Role hr หรือมีสิทธิ์ 'hr') · HR ให้สิทธิ์ได้ไม่เกินสิทธิ์ที่ตัวเองมี
import postgres from "npm:postgres@3.4.5";
const DB_URL = Deno.env.get("SUPABASE_DB_URL") || "";
const API = (Deno.env.get("SUPABASE_URL") || "").replace(/\/$/, "") + "/functions/v1/backoffice";
const sql = DB_URL ? postgres(DB_URL, { max: 4, idle_timeout: 10, connect_timeout: 10 }) : null;
const ORIGINS = new Set([
  "https://centralized-store-management.github.io",
  "https://centralized-store-management-system.github.io",
  ...String(Deno.env.get("HR_TEST_ORIGINS") || "").split(",").map(s => s.trim()).filter(Boolean),
]);
class HttpError extends Error { status: number; constructor(status: number, message: string) { super(message); this.status = status; } }
const cors = (o: string): Record<string, string> => o ? { "access-control-allow-origin": o, "access-control-allow-headers": "content-type,x-cms-session", "access-control-allow-methods": "GET,POST,OPTIONS", "vary": "Origin" } : {};
const reply = (x: unknown, s = 200, o = "") => new Response(JSON.stringify(x), { status: s, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...cors(o) } });
function parse(t: string) { try { return JSON.parse(t); } catch { const a = t.indexOf("("), b = t.lastIndexOf(")"); if (a < 0 || b <= a) throw new HttpError(401, "Session ไม่ถูกต้อง"); return JSON.parse(t.slice(a + 1, b)); } }
const UUID = /^[0-9a-f-]{36}$/i;

type Who = { name: string; role: string; perms: string[]; ref: string };
async function actor(token: string): Promise<Who> {
  if (!token || token.length > 4096) throw new HttpError(401, "กรุณาเข้าสู่ระบบใหม่");
  const u = new URL(API); u.searchParams.set("action", "bootstrap"); u.searchParams.set("t", token); u.searchParams.set("callback", "_hr_position_auth");
  const r = await fetch(u, { cache: "no-store" });
  if (!r.ok) throw new HttpError(401, "Session หมดอายุ");
  const p = parse(await r.text()), me = (p.data || p).me;
  if (!me) throw new HttpError(401, "ไม่พบผู้ใช้");
  const role = String(me.role || "");
  const perms = (Array.isArray(me.perms) ? me.perms : String(me.perms || "").split(",")).map((x: unknown) => String(x).trim()).filter(Boolean);
  // ผู้ที่ใช้เมนู HR ได้ (Role hr หรือ Manager ที่ได้สิทธิ์ 'hr') ต้องใช้หน้าตำแหน่งได้ด้วย — เดิมเช็กแค่ Role ทำให้ Manager+HR โดน 403
  if (!["owner", "admin", "hr"].includes(role) && !perms.includes("hr")) throw new HttpError(403, "ไม่มีสิทธิ์ HR");
  const ref = role === "owner" ? "owner" : me.uid ? "u:" + String(me.uid) : "c:" + String(me.code || "");
  return { name: String(me.name || me.code || role), role, perms, ref };
}

// ---------- แม่แบบสิทธิ์ ----------
const CMS_ROLES = ["admin", "hr", "manager", "staff"];
const FIN_ROLES = ["approver", "manager", "staff", "verifier", "accountant", "viewer"];
const FIN_BASIC = ["manager", "staff", "viewer"];   // Admin/HR ให้ได้เฉพาะบทบาทพื้นฐาน · ผู้อนุมัติ/ผู้ตรวจ/บัญชี = Owner เท่านั้น (แยกหน้าที่)
function tmplOf(rows: Array<{ application_key: string; permission_codes: string[]; status: string }>) {
  const cms = rows.find(r => r.application_key === "cms" && r.status === "active");
  const fin = rows.find(r => r.application_key === "finance" && r.status === "active");
  const codes = cms ? cms.permission_codes || [] : [];
  return {
    role: (codes.find(c => c.startsWith("role:")) || "").slice(5),
    perms: codes.filter(c => !c.startsWith("role:")),
    finance: ((fin && fin.permission_codes || []).find(c => c.startsWith("role:")) || "").slice(5),
  };
}
function checkTemplate(who: Who, old: ReturnType<typeof tmplOf>, next: ReturnType<typeof tmplOf>) {
  if (next.role && !CMS_ROLES.includes(next.role)) throw new HttpError(400, "Role ไม่ถูกต้อง");
  if (next.finance && !FIN_ROLES.includes(next.finance)) throw new HttpError(400, "บทบาท Finance ไม่ถูกต้อง");
  if (who.role === "owner") return;
  if (next.role !== old.role && next.role === "admin" && who.role !== "admin") throw new HttpError(403, "เฉพาะ Owner / Admin ให้ Role Admin ได้");
  if (next.finance !== old.finance && next.finance && !FIN_BASIC.includes(next.finance)) throw new HttpError(403, "บทบาท Finance ระดับผู้อนุมัติ/ผู้ตรวจ/บัญชี กำหนดได้เฉพาะ Owner");
  if (who.role !== "admin") {
    const extra = next.perms.filter(p => !old.perms.includes(p) && !who.perms.includes(p));
    if (extra.length) throw new HttpError(403, "ให้สิทธิ์ได้เฉพาะสิทธิ์ที่คุณมีอยู่: " + extra.join(", "));
  }
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin") || "";
  if (origin && !ORIGINS.has(origin)) return reply({ ok: false, error: "origin_not_allowed" }, 403, origin);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(origin) });
  try {
    if (!sql) throw new HttpError(503, "Position API ยังไม่พร้อม");
    if (!["GET", "POST"].includes(req.method)) throw new HttpError(405, "Method not allowed");
    const who = await actor(req.headers.get("x-cms-session") || "");
    if (req.method === "GET") {
      const positions = await sql`select * from public.hr_positions order by status desc,name_th`;
      const departments = await sql`select id,department_code,name,status,organization_id,parent_id from public.org_departments where status='active' order by name`;
      const permissions = await sql`select p.position_id,p.application_key,p.permission_codes,p.branch_scope,p.status,p.version,p.updated_by,p.updated_at from public.it_position_permissions p`;
      const staff = await sql`select s.id,s.staff_name,s.role,s.cms_ref,s.branch_id,s.position_id,s.is_active,p.position_code,p.name_th as position_name from public.staff s left join public.hr_positions p on p.id=s.position_id order by s.staff_name`;
      const history = await sql`select h.*,s.staff_name from public.staff_position_history h join public.staff s on s.id=h.staff_id order by h.changed_at desc limit 200`;
      const sync = await sql`select status,count(*)::int as count from public.iam_sync_outbox group by status`;
      return reply({ ok: true, positions, departments, permissions, staff, history, sync, me: { role: who.role, perms: who.perms } }, 200, origin);
    }
    const b = await req.json().catch(() => ({}));
    if (b.action === "assign-staff-position") {
      const staffId = String(b.staff_id || ""), positionId = b.position_id === null || b.position_id === "" ? null : String(b.position_id);
      if (!UUID.test(staffId)) throw new HttpError(400, "staff_id ไม่ถูกต้อง");
      if (positionId && !UUID.test(positionId)) throw new HttpError(400, "position_id ไม่ถูกต้อง");
      const result = await sql.begin(async tx => {
        const [staff] = await tx`select * from public.staff where id=${staffId}::uuid for update`;
        if (!staff) throw new HttpError(404, "ไม่พบพนักงาน");
        if (positionId) {
          const [position] = await tx`select id from public.hr_positions where id=${positionId}::uuid and status='active'`;
          if (!position) throw new HttpError(400, "ตำแหน่งไม่พบหรือปิดใช้งาน");
        }
        const [saved] = await tx`update public.staff set position_id=${positionId}::uuid where id=${staffId}::uuid returning id,staff_name,role,cms_ref,auth_user_id,branch_id,position_id,is_active`;
        await tx`insert into public.iam_audit_log(actor_ref,action_key,target_type,target_id,before_state,after_state)
          values(${who.name},'hr.staff_position.assigned','staff',${staffId},${sql.json({ position_id: staff.position_id, staff_name: staff.staff_name, cms_ref: staff.cms_ref, branch_id: staff.branch_id })},${sql.json(saved)})`;
        return saved;
      });
      return reply({ ok: true, staff: result, history_recorded: true, sync_status: "pending" }, 200, origin);
    }
    if (b.action === "run-sync") {
      const workerUrl = (Deno.env.get("SUPABASE_URL") || "") + "/functions/v1/iam-sync-worker";
      const r = await fetch(workerUrl, { method: "POST", headers: { "content-type": "application/json", "x-cms-session": req.headers.get("x-cms-session") || "" }, body: JSON.stringify({ limit: b.limit || 25 }) });
      const payload = await r.json().catch(() => ({ ok: false, error: "worker_response_invalid" }));
      return reply(payload, r.status, origin);
    }
    if (b.action === "save-position") {
      const name = String(b.name_th || "").trim(), code = String(b.position_code || "").trim().toUpperCase();
      if (!name || !/^[A-Z0-9_-]{2,24}$/.test(code)) throw new HttpError(400, "กรุณาระบุชื่อตำแหน่งและรหัสตำแหน่งให้ถูกต้อง (อังกฤษ/ตัวเลข/_/- 2–24 ตัว)");
      const id = b.id ? String(b.id) : null;
      if (id && !UUID.test(id)) throw new HttpError(400, "id ไม่ถูกต้อง");
      const saved = await sql.begin(async tx => {
        const old = id ? (await tx`select * from public.hr_positions where id=${id}::uuid for update`)[0] : null;
        if (id && !old) throw new HttpError(404, "ไม่พบตำแหน่ง");
        const departmentId = b.department_id && UUID.test(String(b.department_id)) ? String(b.department_id) : null;
        const [row] = id ? await tx`update public.hr_positions set position_code=${code},name_th=${name},name_en=${String(b.name_en || "")},department=${String(b.department || "")},department_id=${departmentId}::uuid,level=${String(b.level || "")},description=${String(b.description || "")},status=${b.status === "inactive" ? "inactive" : "active"},version=version+1,updated_by=${who.name},updated_at=now() where id=${id}::uuid returning *`
          : await tx`insert into public.hr_positions(position_code,name_th,name_en,department,department_id,level,description,created_by,updated_by) values(${code},${name},${String(b.name_en || "")},${String(b.department || "")},${departmentId}::uuid,${String(b.level || "")},${String(b.description || "")},${who.name},${who.name}) returning *`;
        const action = id ? "update" : "create";
        await tx`insert into public.hr_position_audit(position_id,action,before_state,after_state,actor) values(${row.id},${action},${old ? sql.json(old) : null},${sql.json(row)},${who.name})`;
        const eventKey = crypto.randomUUID();
        const payload = { event_id: eventKey, event_type: id ? "hr.position.updated" : "hr.position.created", schema_version: 1, occurred_at: new Date().toISOString(), actor: who.name, position: row };
        await tx`insert into public.iam_sync_outbox(event_key,aggregate_type,aggregate_id,aggregate_version,event_type,schema_version,payload) values(${eventKey},'hr_position',${row.id},${row.version},${payload.event_type},1,${sql.json(payload)})`;
        await tx`insert into public.iam_audit_log(actor_ref,action_key,target_type,target_id,before_state,after_state) values(${who.name},${"hr.position." + action},'hr_position',${row.id},${old ? sql.json(old) : null},${sql.json(row)})`;
        return { ...row, sync_status: "pending" };
      });
      return reply({ ok: true, position: saved }, 200, origin);
    }
    if (b.action === "save-department") {
      if (who.role !== "owner" && who.role !== "admin") throw new HttpError(403, "เฉพาะ Owner / IT Admin จัดการแผนกได้");
      const code = String(b.department_code || "").trim().toUpperCase(), name = String(b.name || "").trim();
      if (!/^[A-Z0-9_-]{2,30}$/.test(code) || !name) throw new HttpError(400, "กรุณาระบุรหัสและชื่อแผนกให้ถูกต้อง");
      const row = await sql.begin(async tx => {
        const existing = (await tx`select * from public.org_departments where organization_id is null and department_code=${code} for update`)[0];
        if (existing) return (await tx`update public.org_departments set name=${name},status='active',updated_at=now() where id=${existing.id} returning *`)[0];
        return (await tx`insert into public.org_departments(department_code,name,status) values(${code},${name},'active') returning *`)[0];
      });
      await sql`insert into public.iam_audit_log(actor_ref,action_key,target_type,target_id,after_state) values(${who.name},'org.department.saved','department',${row.id},${sql.json(row)})`;
      return reply({ ok: true, department: row }, 200, origin);
    }
    // แม่แบบสิทธิ์ของตำแหน่ง: Role + สิทธิ์เมนู (CMS) + บทบาท Finance
    if (b.action === "save-template") {
      const positionId = String(b.position_id || "");
      if (!UUID.test(positionId)) throw new HttpError(400, "position_id ไม่ถูกต้อง");
      const next = {
        role: String(b.cms_role || "").trim(),
        perms: [...new Set((Array.isArray(b.cms_perms) ? b.cms_perms : String(b.cms_perms || "").split(",")).map((x: unknown) => String(x).trim()).filter((x: string) => /^[a-z0-9_]{2,40}$/.test(x)))] as string[],
        finance: String(b.finance_role || "").trim(),
      };
      const rows = await sql.begin(async tx => {
        const [pos] = await tx`select id,position_code from public.hr_positions where id=${positionId}::uuid for update`;
        if (!pos) throw new HttpError(404, "ไม่พบตำแหน่ง");
        const cur = await tx`select application_key,permission_codes,status from public.it_position_permissions where position_id=${positionId}::uuid`;
        const old = tmplOf(cur as never);
        checkTemplate(who, old, next);
        const cmsCodes = [...(next.role ? ["role:" + next.role] : []), ...next.perms];
        const finCodes = next.finance ? ["role:" + next.finance] : [];
        const out = [];
        for (const [app, codes] of [["cms", cmsCodes], ["finance", finCodes]] as const) {
          const [row] = await tx`insert into public.it_position_permissions(position_id,application_key,permission_codes,branch_scope,status,updated_by)
            values(${positionId}::uuid,${app},${codes as string[]},'assigned','active',${who.name})
            on conflict(position_id,application_key) do update set permission_codes=excluded.permission_codes,status='active',version=it_position_permissions.version+1,updated_by=excluded.updated_by,updated_at=now() returning *`;
          out.push(row);
        }
        await tx`insert into public.hr_position_audit(position_id,action,before_state,after_state,actor) values(${positionId}::uuid,'permission_template_update',${sql.json(old)},${sql.json(next)},${who.name})`;
        return out;
      });
      return reply({ ok: true, permissions: rows }, 200, origin);
    }
    // บทบาท Finance ตามตำแหน่ง: items = [{ uid, position_id|null, name }] ของบัญชีผู้ใช้ CMS ที่ผูกกับพนักงาน
    if (b.action === "sync-finance") {
      const items = (Array.isArray(b.items) ? b.items : []).slice(0, 500) as Array<{ uid?: unknown; position_id?: unknown; name?: unknown }>;
      const perm = await sql`select position_id,application_key,permission_codes,status from public.it_position_permissions where application_key='finance'`;
      const codeOf = new Map((await sql`select id,position_code from public.hr_positions where status='active'`).map(r => [String(r.id), String(r.position_code)]));
      const finOf = (pid: string) => { const r = perm.find(x => String(x.position_id) === pid && x.status === "active"); return r ? ((r.permission_codes || []).find((c: string) => c.startsWith("role:")) || "").slice(5) : ""; };
      const companies = await sql`select id from finance.companies where status='active'`;
      const res = { granted: 0, updated: 0, revoked: 0, kept: 0, skipped: 0 };
      await sql.begin(async tx => {
        for (const it of items) {
          const uid = String(it.uid || "");
          if (!/^[A-Za-z0-9_.-]{1,80}$/.test(uid) || uid === "owner") { res.skipped++; continue; }
          const ref = "u:" + uid;
          if (ref === who.ref) { res.skipped++; continue; }   // ไม่ปรับสิทธิ์ Finance ของตัวเอง
          const pid = it.position_id && UUID.test(String(it.position_id)) ? String(it.position_id) : "";
          const code = pid ? codeOf.get(pid) : undefined;
          const role = code ? finOf(pid) : "";
          if (role && who.role !== "owner" && !FIN_BASIC.includes(role)) { res.skipped++; continue; }   // บทบาทระดับสูง ให้ Owner เป็นผู้ซิงก์
          const name = String(it.name || "").slice(0, 120);
          for (const c of companies) {
            const [old] = await tx`select role_code,is_active,granted_by from finance.user_roles where company_id=${c.id} and cms_actor_ref=${ref} for update`;
            const byPos = old && String(old.granted_by || "").startsWith("position:");
            if (role) {
              if (!old) { await tx`insert into finance.user_roles(company_id,cms_actor_ref,role_code,is_active,display_name,granted_by) values(${c.id},${ref},${role},true,${name},${"position:" + code})`; res.granted++; }
              else if (byPos) {
                if (old.role_code !== role || !old.is_active || old.granted_by !== "position:" + code) { await tx`update finance.user_roles set role_code=${role},is_active=true,granted_by=${"position:" + code},updated_at=now() where company_id=${c.id} and cms_actor_ref=${ref}`; res.updated++; }
              } else res.kept++;   // Owner ตั้งสิทธิ์ Finance ให้เองแล้ว → คงไว้
            } else if (old && byPos && old.is_active) {
              await tx`update finance.user_roles set is_active=false,updated_at=now() where company_id=${c.id} and cms_actor_ref=${ref}`; res.revoked++;
            }
          }
        }
        if (res.granted || res.updated || res.revoked) await tx`insert into public.iam_audit_log(actor_ref,action_key,target_type,target_id,after_state) values(${who.name},'hr.position.finance_sync','finance_user_roles','batch',${sql.json(res)})`;
      });
      return reply({ ok: true, ...res }, 200, origin);
    }
    if (b.action === "set-permissions") {
      if (who.role !== "owner" && who.role !== "admin") throw new HttpError(403, "เฉพาะ Owner / IT Admin กำหนดสิทธิ์ได้");
      const positionId = String(b.position_id || ""); if (!UUID.test(positionId)) throw new HttpError(400, "position_id ไม่ถูกต้อง");
      const app = String(b.application_key || ""); if (!/^[a-z0-9_-]{2,40}$/.test(app)) throw new HttpError(400, "application_key ไม่ถูกต้อง");
      const codes = Array.isArray(b.permission_codes) ? [...new Set(b.permission_codes.map((x: unknown) => String(x)).filter((x: string) => /^[a-z0-9._:-]{2,100}$/.test(x)))] : [];
      const status = b.status === "active" ? "active" : "draft";
      const [row] = await sql`insert into public.it_position_permissions(position_id,application_key,permission_codes,branch_scope,status,updated_by) values(${positionId}::uuid,${app},${codes as string[]},${b.branch_scope === "all" ? "all" : "assigned"},${status},${who.name}) on conflict(position_id,application_key) do update set permission_codes=excluded.permission_codes,branch_scope=excluded.branch_scope,status=excluded.status,version=it_position_permissions.version+1,updated_by=excluded.updated_by,updated_at=now() returning *`;
      await sql`insert into public.hr_position_audit(position_id,action,after_state,actor) values(${positionId}::uuid,'permission_mapping_update',${sql.json(row)},${who.name})`;
      return reply({ ok: true, permission: row }, 200, origin);
    }
    throw new HttpError(400, "ไม่รู้จัก action");
  } catch (e) {
    const pgCode = (e as { code?: string })?.code;
    const s = e instanceof HttpError ? e.status : pgCode === "23505" ? 409 : 500;
    if (s === 500) console.error("hr-position-api", e);
    const message = s === 409 ? "รหัสนี้มีอยู่แล้ว กรุณาใช้รหัสอื่น" : s === 500 ? "เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่" : e instanceof Error ? e.message : "เกิดข้อผิดพลาด";
    return reply({ ok: false, error: message }, s, origin);
  }
});
