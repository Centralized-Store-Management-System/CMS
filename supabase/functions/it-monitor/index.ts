import postgres from "npm:postgres@3.4.5";

const SUPABASE_URL = (Deno.env.get("SUPABASE_URL") || "").replace(/\/$/, "");
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const DB_URL = Deno.env.get("SUPABASE_DB_URL") || "";
const BACKOFFICE_URL = SUPABASE_URL + "/functions/v1/backoffice";
const ALLOWED_ORIGIN = "https://centralized-store-management.github.io";
const sql = DB_URL ? postgres(DB_URL, { max: 2, idle_timeout: 10, connect_timeout: 10 }) : null;

class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}
const response = (body: unknown, status = 200, origin = "") => new Response(JSON.stringify(body), {
  status, headers: {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store, private",
    "vary": "Origin",
    ...(origin ? {
      "access-control-allow-origin": origin,
      "access-control-allow-headers": "content-type, x-cms-session",
      "access-control-allow-methods": "GET, POST, OPTIONS",
      "access-control-max-age": "600",
    } : {}),
  },
});
function parseJsonp(text: string) {
  const t = text.trim();
  try { return JSON.parse(t); } catch (_) { /* JSONP */ }
  const a = t.indexOf("("), b = t.lastIndexOf(")");
  if (a < 0 || b <= a) throw new HttpError(401, "ยืนยันบัญชี Owner ไม่สำเร็จ");
  try { return JSON.parse(t.slice(a + 1, b)); } catch (_) { throw new HttpError(401, "ยืนยันบัญชี Owner ไม่สำเร็จ"); }
}
async function requireOwner(token: string) {
  if (!token || token.length > 4096) throw new HttpError(401, "กรุณาเข้าสู่ระบบ Owner ใหม่");
  const u = new URL(BACKOFFICE_URL);
  u.searchParams.set("action", "bootstrap");
  u.searchParams.set("t", token);
  u.searchParams.set("callback", "_it_monitor_auth");
  u.searchParams.set("_", String(Date.now()));
  const r = await fetch(u, { cache: "no-store" });
  if (!r.ok) throw new HttpError(401, "Session หมดอายุ กรุณาเข้าสู่ระบบ Owner ใหม่");
  const parsed = parseJsonp(await r.text());
  const boot = parsed.data || parsed;
  if (!boot.me || boot.me.role !== "owner") throw new HttpError(403, "เฉพาะ Owner เท่านั้นที่เข้าถึง AI Monitoring ได้");
}
function safeJson(v: unknown) {
  if (typeof v !== "string") return v || {};
  try { return JSON.parse(v); } catch (_) { return {}; }
}
type Finding = { level: "critical" | "warning" | "info"; code: string; title: string; detail: string; action: string };
async function runMonitor() {
  if (!sql) throw new Error("Database connection is not configured");
  const [result] = await sql.begin(async (tx: typeof sql) => {
    const [lock] = await tx`select pg_try_advisory_xact_lock(771926051) as acquired`;
    if (!lock.acquired) return [{ skipped: true, reason: "previous monitor cycle is still running" }];
    const [data] = await tx`
      select
        pg_database_size(current_database())::bigint as database_bytes,
        (select count(*) from backoffice.outbox_errors where at > now() - interval '24 hours')::int as outbox_errors_24h,
        (select kind || ': ' || left(coalesce(detail,''),160) from backoffice.outbox_errors order by at desc limit 1) as last_outbox_error,
        (select v from backoffice.kv where ns='props' and k='SUPA_IT') as supa_it,
        (select v from backoffice.kv where ns='props' and k='ORDER_IT') as order_it,
        (select v from backoffice.kv where ns='props' and k='ORDER_SYNC_LAST') as order_sync_last,
        (select v from backoffice.kv where ns='props' and k='ORDER_SSO_LOG') as sso_log,
        (select count(*) from public.orders where created_at > now() - interval '24 hours')::int as orders_24h,
        (select count(*) from public.orders where order_status in ('pending','confirmed','preparing','ready','on_the_way','arrived') and created_at < now() - interval '90 minutes')::int as stale_orders,
        (select count(*) from public.branches where is_active is true)::int as active_branches,
        (select count(*) from storage.buckets where id='hr-employee-documents' and public is false)::int as hr_private_bucket_ready,
        (select count(*) from cron.job where jobname='backoffice-tick' and active)::int as backoffice_cron_active,
        (select max(start_time) from cron.job_run_details where jobid=(select jobid from cron.job where jobname='backoffice-tick' limit 1)) as backoffice_cron_last_at,
        (select status from cron.job_run_details where jobid=(select jobid from cron.job where jobname='backoffice-tick' limit 1) order by start_time desc limit 1) as backoffice_cron_last_status,
        (select count(*) from cron.job_run_details where jobid=(select jobid from cron.job where jobname='backoffice-tick' limit 1) and start_time > now()-interval '24 hours' and status <> 'succeeded')::int as backoffice_cron_failures_24h
    `;
    const supa = safeJson(data.supa_it) as Record<string, unknown>;
    const order = safeJson(data.order_it) as Record<string, unknown>;
    const sync = safeJson(data.order_sync_last) as Record<string, unknown>;
    const sso = safeJson(data.sso_log);
    const now = Date.now();
    const ageMinutes = (v: unknown) => {
      const t = Date.parse(String(v || ""));
      return Number.isFinite(t) ? Math.max(0, (now - t) / 60000) : null;
    };
    const supaAge = ageMinutes(supa.at), orderAge = ageMinutes(order.at);
    const syncErrors = Array.isArray(sync.errors) ? sync.errors.length : 0;
    const ssoFailures = Array.isArray(sso) ? sso.filter((x: Record<string, unknown>) => x.ok === false && (ageMinutes(x.at) ?? 999999) <= 1440).length : 0;
    const cronAge = ageMinutes(data.backoffice_cron_last_at);
    const findings: Finding[] = [];
    const add = (level: Finding["level"], code: string, title: string, detail: string, action: string) => findings.push({ level, code, title, detail, action });
    if (!data.backoffice_cron_active) add("critical","CRON_DISABLED","ตัวจัดงานเบื้องหลังหยุดทำงาน","ไม่พบ backoffice-tick ที่ Active","ตรวจสอบ pg_cron และ Edge Function backoffice");
    else if (cronAge === null || cronAge > 3) add("critical","CRON_STALE","งานตรวจระบบหลักไม่อัปเดต","Cron heartbeat เก่ากว่า 3 นาที","ตรวจ pg_cron job และ logs ของ backoffice");
    else if (data.backoffice_cron_last_status !== "succeeded") add("warning","CRON_LAST_FAILED","Cron รอบล่าสุดไม่สำเร็จ",String(data.backoffice_cron_last_status || "ไม่พบสถานะ"),"ตรวจสอบรายละเอียด job_run_details");
    if (Number(data.backoffice_cron_failures_24h) > 0) add("warning","CRON_FAILURES","พบ Cron ทำงานล้มเหลว",String(data.backoffice_cron_failures_24h)+" ครั้งใน 24 ชั่วโมง","ตรวจรายละเอียด Cron รอบที่ล้มเหลว");
    if (supaAge === null || supaAge > 4) add("critical","SUPA_HEARTBEAT_STALE","ข้อมูลสุขภาพ Supabase ไม่สดใหม่",supaAge === null ? "ไม่พบ SUPA_IT" : "ข้อมูลล่าสุด "+supaAge.toFixed(1)+" นาที","ตรวจ Supabase health task และการเชื่อมต่อฐานข้อมูล");
    if (orderAge === null || orderAge > 4) add("warning","ORDER_HEARTBEAT_STALE","ข้อมูลสุขภาพ Order System ไม่สดใหม่",orderAge === null ? "ไม่พบ ORDER_IT" : "ข้อมูลล่าสุด "+orderAge.toFixed(1)+" นาที","ตรวจ orderTick และ orderSync");
    if (Number(data.outbox_errors_24h) > 0) add(Number(data.outbox_errors_24h) >= 5 ? "critical" : "warning","OUTBOX_ERRORS","พบงานส่งออกผิดพลาด",String(data.outbox_errors_24h)+" รายการใน 24 ชั่วโมง"+(data.last_outbox_error ? " · "+data.last_outbox_error : ""),"ตรวจรายการ outbox และลองส่งซ้ำหลังแก้สาเหตุ");
    if (syncErrors > 0) add("critical","ORDER_SYNC_ERRORS","การซิงก์ CMS กับ Order มีข้อผิดพลาด",syncErrors+" รายการในรอบล่าสุด","ตรวจ ORDER_SYNC_LAST ก่อนสั่งซิงก์ใหม่");
    if (ssoFailures > 0) add("warning","ORDER_SSO_FAILURES","พบการเข้า Order SSO ไม่สำเร็จ",ssoFailures+" ครั้งใน 24 ชั่วโมง","ตรวจ ORDER_SSO_LOG และสิทธิ์บัญชี");
    if (Number(data.stale_orders) > 0) add("warning","STALE_ORDERS","พบออเดอร์ค้างนาน",Number(data.stale_orders)+" ออเดอร์ค้างเกิน 90 นาที","ตรวจหน้า Live Orders และสถานะออเดอร์");
    if (!data.hr_private_bucket_ready) add("info","HR_BUCKET_NOT_INITIALIZED","พื้นที่เอกสาร HR ยังไม่ถูกสร้าง","จะสร้าง Private Bucket เมื่อมีการอัปโหลดเอกสาร HR ครั้งแรก","ไม่ต้องดำเนินการจนกว่าจะเริ่มใช้งานเอกสาร HR");
    if (supa.mail === false) add("info","MAIL_NOT_CONFIGURED","ยังไม่ได้ตั้งค่าระบบอีเมล","ไม่พบการตั้งค่า Resend ในเซิร์ฟเวอร์","ตั้งค่า RESEND_API_KEY และ MAIL_FROM เมื่อพร้อมใช้งาน");
    if (!findings.length) add("info","ALL_CLEAR","ไม่พบความผิดปกติจากการตรวจพื้นฐาน","Cron, Supabase heartbeat, Order heartbeat และ outbox ปกติ","ติดตามรอบตรวจอัตโนมัติต่อเนื่อง");
    const critical = findings.filter(x=>x.level==="critical").length;
    const warning = findings.filter(x=>x.level==="warning").length;
    const risk = Math.max(0, Math.min(100, 100 - critical*25 - warning*10));
    const status = critical ? "critical" : warning ? "warning" : "healthy";
    const metrics = {
      databaseBytes: Number(data.database_bytes),
      outboxErrors24h: Number(data.outbox_errors_24h),
      orders24h: Number(data.orders_24h),
      staleOrders: Number(data.stale_orders),
      activeBranches: Number(data.active_branches),
      backofficeCronActive: Boolean(data.backoffice_cron_active),
      backofficeCronLastAt: data.backoffice_cron_last_at,
      backofficeCronLastStatus: data.backoffice_cron_last_status,
      backofficeCronFailures24h: Number(data.backoffice_cron_failures_24h),
      supaHeartbeatAgeMinutes: supaAge === null ? null : Number(supaAge.toFixed(1)),
      orderHeartbeatAgeMinutes: orderAge === null ? null : Number(orderAge.toFixed(1)),
      orderSyncErrors: syncErrors,
      orderSsoFailures24h: ssoFailures,
      hrPrivateBucketReady: Boolean(data.hr_private_bucket_ready),
    };
    const [saved] = await tx`insert into public.it_monitor_runs (risk_score,status,findings,metrics)
      values (${risk},${status},${JSON.stringify(findings)}::jsonb,${JSON.stringify(metrics)}::jsonb)
      returning id,checked_at,risk_score,status,findings,metrics`;
    await tx`delete from public.it_monitor_runs where checked_at < now()-interval '90 days'`;
    return [saved];
  });
  return result;
}
async function latestRun() {
  const [row] = await sql!`select id,checked_at,risk_score,status,findings,metrics from public.it_monitor_runs order by checked_at desc limit 1`;
  return row || null;
}
Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin") || "";
  if (origin && origin !== ALLOWED_ORIGIN) return response({ok:false,error:"origin_not_allowed"},403);
  if (req.method === "OPTIONS") return new Response("ok",{headers:{...(origin?{"access-control-allow-origin":origin}:{}),"access-control-allow-headers":"content-type, x-cms-session","access-control-allow-methods":"GET, POST, OPTIONS","access-control-max-age":"600","vary":"Origin"}});
  try {
    if (!SUPABASE_URL || !SERVICE_KEY || !sql) throw new HttpError(503,"IT monitor is not configured");
    if (req.method === "POST") {
      const body = await req.json().catch(()=>({}));
      const [key] = await sql`select v from backoffice.kv where ns='props' and k='CRON_KEY'`;
      if (urlHasCron(req.url)) {
        if (!key || body.k !== key.v) throw new HttpError(403,"Invalid scheduler key");
        const result = await runMonitor();
        return response({ok:true,result},200,origin);
      }
      const token = req.headers.get("x-cms-session") || "";
      await requireOwner(token);
      if (body.action !== "run") throw new HttpError(400,"Unsupported action");
      const result = await runMonitor();
      return response({ok:true,result},200,origin);
    }
    if (req.method === "GET") {
      const token = req.headers.get("x-cms-session") || "";
      await requireOwner(token);
      return response({ok:true,latest:await latestRun()},200,origin);
    }
    throw new HttpError(405,"Method not allowed");
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500;
    const message = e instanceof HttpError ? e.message : "ระบบ IT Monitoring ขัดข้องชั่วคราว";
    if (!(e instanceof HttpError)) console.error("it-monitor",e);
    return response({ok:false,error:message},status,origin);
  }
});
function urlHasCron(raw: string) { return new URL(raw).searchParams.get("__cron") === "1"; }
