import postgres from "npm:postgres@3.4.5";

const DB_URL = Deno.env.get("SUPABASE_DB_URL") || "";
const BACKOFFICE_URL = (Deno.env.get("SUPABASE_URL") || "").replace(/\/$/, "") + "/functions/v1/backoffice";
const sql = DB_URL ? postgres(DB_URL, { max: 4, idle_timeout: 10, connect_timeout: 10 }) : null;
const ORIGINS = new Set(["https://centralized-store-management.github.io", "https://centralized-store-management-system.github.io"]);

class HttpError extends Error { status: number; constructor(status: number, message: string) { super(message); this.status = status; } }
const cors = (o: string) => o ? { "access-control-allow-origin": o, "access-control-allow-headers": "content-type,x-cms-session", "access-control-allow-methods": "POST,OPTIONS", "vary": "Origin" } : {};
const reply = (body: unknown, status = 200, origin = "") => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store, private", ...cors(origin) } });

function parseSession(raw: string) {
  try { return JSON.parse(raw); } catch {
    const a = raw.indexOf("("), b = raw.lastIndexOf(")");
    if (a < 0 || b <= a) throw new HttpError(401, "Session ไม่ถูกต้อง");
    try { return JSON.parse(raw.slice(a + 1, b)); } catch { throw new HttpError(401, "Session ไม่ถูกต้อง"); }
  }
}
async function authenticate(token: string) {
  if (!token || token.length > 4096) throw new HttpError(401, "กรุณาเข้าสู่ระบบใหม่");
  const u = new URL(BACKOFFICE_URL);
  u.searchParams.set("action", "bootstrap"); u.searchParams.set("t", token);
  u.searchParams.set("callback", "_iam_authorize"); u.searchParams.set("_", String(Date.now()));
  const r = await fetch(u, { cache: "no-store", headers: { accept: "application/json, application/javascript" } });
  if (!r.ok) throw new HttpError(401, "Session หมดอายุ");
  const payload = parseSession(await r.text()), boot = payload.data || payload, me = boot.me;
  if (!me || !me.role) throw new HttpError(401, "ไม่พบผู้ใช้");
  if (me.status === "disabled" || me.active === false) throw new HttpError(403, "บัญชีถูกปิดใช้งาน");
  const refs = [...new Set([me.id, me.code, me.username].filter((x) => typeof x === "string" && x.trim()).map((x) => String(x).trim()))];
  if (!refs.length) throw new HttpError(403, "บัญชีไม่มี Principal Reference ที่ใช้ตรวจสิทธิ์");
  return { me, refs };
}
function validKey(s: unknown) { return typeof s === "string" && /^[a-z0-9_-]{2,60}$/.test(s); }
Deno.serve(async (req) => {
  const origin = req.headers.get("origin") || "";
  if (origin && !ORIGINS.has(origin)) return reply({ ok: false, error: "origin_not_allowed" }, 403, origin);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(origin) });
  try {
    if (req.method !== "POST") throw new HttpError(405, "Method not allowed");
    if (!sql) throw new HttpError(503, "IAM authorization service unavailable");
    const { me, refs } = await authenticate(req.headers.get("x-cms-session") || "");
    const body = await req.json().catch(() => ({}));
    const application = String(body.application_key || "");
    const permission = String(body.permission_code || "");
    if (!validKey(application) || !/^[A-Za-z0-9._:-]{2,120}$/.test(permission)) throw new HttpError(400, "application_key หรือ permission_code ไม่ถูกต้อง");

    // Default deny. Only active application, permission, role and time-valid direct grants qualify.
    // Position bindings are deliberately not expanded here until employee↔principal linkage is authoritative.
    const rows = await sql`
      select g.id as grant_id, g.scope, g.valid_from, g.valid_to,
             r.role_key, p.permission_code, a.application_key
      from public.iam_principal_role_grants g
      join public.iam_roles r on r.id = g.role_id and r.status = 'active'
      join public.iam_role_permissions rp on rp.role_id = r.id
      join public.iam_permissions p on p.id = rp.permission_id and p.status = 'active'
      join public.iam_applications a on a.id = p.application_id and a.status = 'active'
      where g.principal_ref = any(${refs}::text[])
        and g.status = 'active'
        and g.valid_from <= now()
        and (g.valid_to is null or g.valid_to > now())
        and a.application_key = ${application}
        and p.permission_code = ${permission}
      order by g.created_at desc
    `;
    if (!rows.length) return reply({ ok: true, decision: "deny", reason: "no_active_grant", policy_version: null }, 200, origin);

    const requested = body.resource_scope && typeof body.resource_scope === "object" && !Array.isArray(body.resource_scope) ? body.resource_scope : {};
    const granted = rows.find((row) => {
      const scope = row.scope && typeof row.scope === "object" ? row.scope : {};
      return Object.entries(requested).every(([key, value]) => {
        const allowed = scope[key];
        return allowed === "*" || (Array.isArray(allowed) && allowed.map(String).includes(String(value))) || (allowed !== undefined && String(allowed) === String(value));
      });
    });
    if (!granted) return reply({ ok: true, decision: "deny", reason: "scope_mismatch", policy_version: null }, 200, origin);

    await sql`insert into public.iam_audit_log(actor_ref,action_key,target_type,target_id,after_state)
      values(${refs[0]},'iam.authorization.checked','permission',${permission},
        ${sql.json({ application_key: application, permission_code: permission, decision: "allow", role_key: granted.role_key, grant_id: granted.grant_id, resource_scope: requested })})`;
    return reply({ ok: true, decision: "allow", reason: "active_grant", role_key: granted.role_key, policy_version: null }, 200, origin);
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500;
    if (status === 500) console.error("iam-authorize", e);
    return reply({ ok: false, error: status === 500 ? "authorization_unavailable" : e.message }, status, origin);
  }
});
