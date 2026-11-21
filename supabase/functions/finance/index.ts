// Finance authorization adapter — isolated from the existing Back Office function.
// Uses the established CMS session bootstrap contract. This function is not deployed yet.
const SUPABASE_URL = (Deno.env.get("SUPABASE_URL") || "").replace(/\/$/, "");
const BACKOFFICE_URL = SUPABASE_URL + "/functions/v1/backoffice";
const ORIGIN_ALLOW = new Set([
  "https://centralized-store-management.github.io",
  "https://centralized-store-management-system.github.io",
]);
const PERMISSION = "acct";
const REQUEST_TIMEOUT_MS = 8000;

class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}
function json(body: unknown, status: number, origin: string) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store, private",
      "vary": "Origin",
      ...(origin ? {
        "access-control-allow-origin": origin,
        "access-control-allow-headers": "content-type, x-cms-session",
        "access-control-allow-methods": "GET, OPTIONS",
        "access-control-max-age": "600",
      } : {}),
    },
  });
}
function parseJsonp(text: string) {
  const start = text.indexOf("("), end = text.lastIndexOf(")");
  if (start < 0 || end <= start) throw new HttpError(401, "ยืนยัน Session ไม่สำเร็จ");
  try { return JSON.parse(text.slice(start + 1, end)); }
  catch (_) { throw new HttpError(401, "ข้อมูล Session ไม่ถูกต้อง"); }
}
async function authorize(token: string) {
  if (!SUPABASE_URL) throw new HttpError(503, "Finance authorization ยังตั้งค่าไม่ครบ");
  if (!token || token.length > 4096) throw new HttpError(401, "กรุณาเข้าสู่ระบบใหม่");
  const url = new URL(BACKOFFICE_URL);
  url.searchParams.set("action", "bootstrap");
  url.searchParams.set("t", token);
  url.searchParams.set("callback", "_finance_auth");
  url.searchParams.set("_", String(Date.now()));
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(url, {
      headers: { accept: "application/javascript, application/json" },
      cache: "no-store",
      signal: controller.signal,
    });
  } catch (_) {
    throw new HttpError(503, "ตรวจสอบ Session ไม่สำเร็จ กรุณาลองใหม่");
  } finally { clearTimeout(timer); }
  if (!response.ok) throw new HttpError(401, "Session หมดอายุหรือยืนยันสิทธิ์ไม่ได้");
  const payload = parseJsonp(await response.text());
  if (!payload || payload.ok === false) throw new HttpError(401, "Session หมดอายุหรือยืนยันสิทธิ์ไม่ได้");
  const boot = payload.data || payload;
  const me = boot.me;
  if (!me || !me.role) throw new HttpError(401, "ไม่พบข้อมูลผู้ใช้งาน");
  const permissions = Array.isArray(me.perms) ? me.perms.map(String) : [];
  const isOwner = String(me.role).toLowerCase() === "owner";
  const canAccounting = permissions.includes(PERMISSION);
  if (!isOwner && !canAccounting) throw new HttpError(403, "บัญชีนี้ไม่มีสิทธิ์ Finance");
  // Do not invent an actor identifier. Until a stable CMS identity is present,
  // reads may proceed but audit-sensitive writes must remain disabled.
  const actorRef = me.id != null ? String(me.id) :
    me.username ? String(me.username) :
    me.code ? String(me.code) : "";
  return {
    actor: {
      id: actorRef || null,
      displayName: String(me.name || me.displayName || me.username || me.code || "CMS User"),
      role: isOwner ? "owner" : "accounting",
      cmsRole: String(me.role),
      auditReady: !!actorRef,
    },
    capabilities: {
      readFinance: true,
      manageUsers: isOwner,
      approvePayments: isOwner,
      closePeriods: isOwner,
      prepareAccounting: isOwner || canAccounting,
      postJournal: isOwner,
      submitTax: isOwner,
    },
  };
}
Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin") || "";
  if (origin && !ORIGIN_ALLOW.has(origin)) return json({ ok: false, error: "origin_not_allowed" }, 403, "");
  if (req.method === "OPTIONS") return new Response("ok", { headers: {
    ...(origin ? { "access-control-allow-origin": origin } : {}),
    "access-control-allow-headers": "content-type, x-cms-session",
    "access-control-allow-methods": "GET, OPTIONS",
    "access-control-max-age": "600",
    "vary": "Origin",
  }});
  if (req.method !== "GET") return json({ ok: false, error: "method_not_allowed" }, 405, origin);
  try {
    const token = req.headers.get("x-cms-session") || "";
    const auth = await authorize(token);
    return json({ ok: true, data: auth }, 200, origin);
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    const message = error instanceof HttpError ? error.message : "Finance authorization error";
    return json({ ok: false, error: message }, status, origin);
  }
});
