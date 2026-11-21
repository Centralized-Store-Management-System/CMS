// ยืนยันตัวตนด้วย CMS Session (ไม่แตะระบบ Login / PIN / Session ของ CMS)
// - เบราว์เซอร์ส่ง token ของ CMS มาใน header x-cms-session → ตรวจกับ CMS ผ่าน action=me (เบา ไม่ดึงข้อมูลทั้งระบบ)
// - ผู้ใช้ CMS ที่เป็น Owner = Finance Owner อัตโนมัติ · ผู้ใช้อื่นต้องให้ Owner กำหนดสิทธิ์ Finance ก่อน (ตาราง finance.user_roles)
// - รหัสผู้ใช้ (actor_ref) ใช้รูปแบบเดียวกับ staff.cms_ref ของระบบออเดอร์: owner | u:<CMS user id>
import { db, fail, HttpError, Tx } from "./util.ts";

const SUPABASE_URL = (Deno.env.get("SUPABASE_URL") || "").replace(/\/$/, "");
const CMS_URL = Deno.env.get("FINANCE_CMS_URL") || (SUPABASE_URL + "/functions/v1/backoffice");
const CACHE_MS = 30_000;
const cache = new Map<string, { at: number; me: CmsMe }>();

export type Role = "owner" | "approver" | "accountant" | "viewer";
export type CmsMe = { role: string; uid?: string; code?: string; name?: string; perms?: string[] };
export type User = {
  actorRef: string; displayName: string; role: Role; cmsRole: string; token: string;
  companyId: string; companyName: string; currency: string; environment: "uat" | "production";
  allowSelfApproval: boolean; vatRegistered: boolean;
};

async function sha256(s: string) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, "0")).join("");
}
function parseJsonp(raw: string) {
  const t = raw.trim();
  try { return JSON.parse(t); } catch (_) { /* JSONP */ }
  const a = t.indexOf("("), b = t.lastIndexOf(")");
  if (a < 0 || b <= a) fail(401, "ยืนยัน CMS Session ไม่สำเร็จ");
  try { return JSON.parse(t.slice(a + 1, b)); } catch (_) { return fail(401, "ข้อมูล CMS Session ไม่ถูกต้อง"); }
}

export async function cmsCall(action: string, token: string, timeoutMs = 8000) {
  const url = new URL(CMS_URL);
  url.searchParams.set("action", action);
  url.searchParams.set("t", token);
  url.searchParams.set("callback", "_fin");
  const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), timeoutMs);
  let res: Response;
  try { res = await fetch(url, { headers: { accept: "application/javascript, application/json" }, signal: ctl.signal }); }
  catch (_) { return fail(503, "ติดต่อระบบ CMS เพื่อตรวจสอบ Session ไม่ได้ ลองใหม่อีกครั้ง"); }
  finally { clearTimeout(timer); }
  if (!res.ok) fail(401, "CMS Session หมดอายุหรือไม่ถูกต้อง");
  const p = parseJsonp(await res.text());
  if (!p || p.ok === false) {
    const code = p && (p.code || (p.error && p.error.code));
    if (code === "SESSION" || /เข้าสู่ระบบ|หมดเวลา/.test(String(p && (p.error || p.message) || ""))) fail(401, "หมดเวลาการใช้งาน CMS กรุณาเข้าสู่ระบบหลังร้านใหม่");
    fail(401, "CMS Session หมดอายุหรือไม่ถูกต้อง");
  }
  return p.data !== undefined ? p.data : p;
}

async function cmsMe(token: string): Promise<CmsMe> {
  if (!token || token.length < 8 || token.length > 4096) fail(401, "ไม่พบ CMS Session กรุณาเข้าสู่ระบบหลังร้าน (จัดการร้าน) ก่อน");
  const key = await sha256(token);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.me;
  const me = await cmsCall("me", token) as CmsMe;
  if (!me || !me.role) fail(401, "ไม่พบข้อมูลผู้ใช้งาน CMS");
  if (cache.size > 500) cache.clear();
  cache.set(key, { at: Date.now(), me });
  return me;
}

export function actorRefOf(me: CmsMe) {
  if (String(me.role).toLowerCase() === "owner") return "owner";
  if (me.uid) return "u:" + String(me.uid).slice(0, 80);
  if (me.code) return "c:" + String(me.code).slice(0, 80);
  return fail(403, "ไม่พบรหัสผู้ใช้งาน CMS ที่ตรวจสอบย้อนกลับได้");
}

export async function authenticate(token: string): Promise<User> {
  const me = await cmsMe(token);
  const actorRef = actorRefOf(me);
  const cmsOwner = actorRef === "owner";
  const sql = db();
  let [row] = await sql`select ur.role_code, ur.display_name, c.id as company_id, c.legal_name, c.currency_code, c.environment, c.allow_self_approval, c.vat_registered
      from finance.user_roles ur join finance.companies c on c.id = ur.company_id
      where ur.cms_actor_ref = ${actorRef} and ur.is_active and c.status = 'active'
      order by c.environment = 'production' desc, ur.created_at limit 1`;
  if (!row && cmsOwner) {
    // Owner ของ CMS: ผูกเป็น Finance Owner ของบริษัทที่เปิดใช้งาน (มีได้บริษัทเดียว)
    const companies = await sql`select id from finance.companies where status = 'active' order by environment = 'production' desc, created_at limit 2`;
    if (companies.length === 1) {
      await sql`insert into finance.user_roles (company_id, cms_actor_ref, role_code, is_active, display_name, granted_by)
        values (${companies[0].id}, 'owner', 'owner', true, ${String(me.name || "Owner").slice(0, 120)}, 'system')
        on conflict (company_id, cms_actor_ref) do update set role_code = 'owner', is_active = true, updated_at = now()`;
      [row] = await sql`select ur.role_code, ur.display_name, c.id as company_id, c.legal_name, c.currency_code, c.environment, c.allow_self_approval, c.vat_registered
        from finance.user_roles ur join finance.companies c on c.id = ur.company_id
        where ur.cms_actor_ref = 'owner' and ur.is_active and c.id = ${companies[0].id}`;
    } else if (!companies.length) fail(409, "ยังไม่มีบริษัทในระบบ Finance");
    else fail(409, "พบหลายบริษัท ต้องเลือกบริษัทก่อน");
  }
  if (!row) fail(403, "บัญชีนี้ยังไม่ได้รับสิทธิ์ Finance — ให้ Owner เพิ่มสิทธิ์ที่เมนู ตั้งค่า › ผู้ใช้งาน Finance");
  let role = row.role_code as Role;
  if (role === "owner" && !cmsOwner) role = "approver";   // Finance Owner ต้องเป็น Owner ของ CMS เท่านั้น
  return {
    actorRef, token, role, cmsRole: String(me.role),
    displayName: String(row.display_name || me.name || me.code || "CMS User"),
    companyId: String(row.company_id), companyName: String(row.legal_name), currency: String(row.currency_code || "THB"),
    environment: row.environment, allowSelfApproval: !!row.allow_self_approval, vatRegistered: !!row.vat_registered,
  };
}

// สิทธิ์ตามบทบาท
export const CAN = {
  read: ["owner", "approver", "accountant", "viewer"],
  write: ["owner", "approver", "accountant"],      // บันทึก/แก้ร่าง ส่งตรวจ สร้างรายการชำระ สมุดรายวัน คู่ค้า
  approve: ["owner", "approver"],                  // อนุมัติ/ตีกลับ เอกสาร การชำระ สมุดรายวัน แบบภาษี
  admin: ["owner"],                                // ผังบัญชี รอบบัญชี ตั้งค่าบริษัท ผู้ใช้ ล้างข้อมูลทดสอบ เริ่มใช้งานจริง
} as const;
const LABEL: Record<keyof typeof CAN, string> = { read: "ดูข้อมูล", write: "บันทึกรายการ", approve: "อนุมัติ", admin: "ผู้ดูแล Finance (Owner)" };
export function need(u: User, cap: keyof typeof CAN) {
  if (!(CAN[cap] as readonly string[]).includes(u.role)) throw new HttpError(403, "สิทธิ์ของคุณไม่พอ — ต้องมีสิทธิ์" + LABEL[cap]);
}
// แยกหน้าที่ผู้บันทึกกับผู้อนุมัติ (Maker–Checker): ห้ามอนุมัติรายการที่ตัวเองสร้าง
// ยกเว้น Owner เปิด "อนุมัติรายการของตนเองได้" ไว้ (ร้านที่มีผู้ใช้คนเดียว) → บันทึกว่าอนุมัติตนเองในประวัติ
export function makerChecker(u: User, createdBy: string | null) {
  if (createdBy && createdBy === u.actorRef) {
    if (u.role === "owner" && u.allowSelfApproval) return "self_approved";
    throw new HttpError(403, "ผู้บันทึกรายการไม่สามารถอนุมัติรายการของตนเองได้ (Maker–Checker)");
  }
  return null;
}
export function capabilities(u: User) {
  const has = (c: keyof typeof CAN) => (CAN[c] as readonly string[]).includes(u.role);
  return { read: has("read"), write: has("write"), approve: has("approve"), admin: has("admin") };
}
export async function companyRow(tx: Tx, u: User) {
  const [c] = await tx`select * from finance.companies where id = ${u.companyId}::uuid`;
  return c;
}
