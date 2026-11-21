// ตัวช่วยร่วมของ Finance API: ข้อผิดพลาด, ตรวจข้อมูลเข้า, ปัดเศษเงิน, ฐานข้อมูล
import postgres from "npm:postgres@3.4.5";

const DB_URL = Deno.env.get("FINANCE_DB_URL") || Deno.env.get("SUPABASE_DB_URL") || "";
export const sql = DB_URL ? postgres(DB_URL, { max: 4, idle_timeout: 10, connect_timeout: 8, prepare: false }) : null;
// deno-lint-ignore no-explicit-any
export type Tx = any;

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}
export const fail = (status: number, message: string): never => { throw new HttpError(status, message); };

export function db() {
  if (!sql) fail(503, "Finance API ยังไม่ได้ตั้งค่าฐานข้อมูล");
  return sql!;
}

export function text(v: unknown, max = 500) { return String(v ?? "").trim().slice(0, max); }
export function opt(v: unknown, max = 500) { const s = text(v, max); return s || null; }
export function uuid(v: unknown, label: string, required = true) {
  const s = text(v, 36);
  if (!s) { if (required) fail(400, "กรุณาระบุ" + label); return null; }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)) fail(400, label + " ไม่ถูกต้อง");
  return s;
}
export function round2(n: number) { return Math.round((n + Number.EPSILON) * 100) / 100; }
export function money(v: unknown, label: string, { min = 0, allowZero = true } = {}) {
  const n = Number(v);
  if (v === "" || v == null || !Number.isFinite(n) || n < min || Math.abs(n) > 999999999999) fail(400, label + " ไม่ถูกต้อง");
  if (!allowZero && n === 0) fail(400, label + " ต้องมากกว่า 0");
  return round2(n);
}
export function date(v: unknown, label: string) {
  const s = text(v, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || new Date(s + "T00:00:00Z").toISOString().slice(0, 10) !== s) fail(400, label + " ไม่ถูกต้อง");
  return s;
}
export function oneOf<T extends string>(v: unknown, list: readonly T[], label: string): T {
  const s = text(v, 40) as T;
  if (!list.includes(s)) fail(400, label + " ไม่ถูกต้อง");
  return s;
}
export function period(v: unknown) {
  const s = text(v, 7);
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(s)) fail(400, "งวดภาษี/รอบบัญชีต้องอยู่ในรูปแบบ YYYY-MM");
  return s;
}
export const num = (v: unknown) => Number(v || 0);
export function todayBangkok() { return new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10); }

// แปลงข้อผิดพลาดจากฐานข้อมูลเป็นข้อความที่ผู้ใช้เข้าใจ
// deno-lint-ignore no-explicit-any
export function dbError(e: any): HttpError | null {
  const code = e && e.code;
  if (!code || typeof code !== "string") return null;
  if (code === "55000") return new HttpError(409, "รายการนี้ถูกล็อกแล้ว (ลงบัญชี/ปิดรอบ/ยื่นแบบแล้ว) แก้ไขไม่ได้ — ให้ทำรายการกลับหรือปรับปรุงแทน");
  if (code === "23505") {
    const c = String(e.constraint_name || e.constraint || "");
    if (c.includes("account_code")) return new HttpError(409, "รหัสบัญชีนี้มีอยู่แล้ว");
    if (c.includes("period_code")) return new HttpError(409, "รอบบัญชีนี้มีอยู่แล้ว");
    if (c.includes("tax_filings")) return new HttpError(409, "มีแบบภาษีของงวดนี้อยู่แล้ว");
    return new HttpError(409, "ข้อมูลซ้ำกับที่มีอยู่แล้ว");
  }
  if (code === "23503") return new HttpError(409, "ข้อมูลอ้างอิงไม่ถูกต้อง หรือถูกใช้งานอยู่");
  if (code === "23514") return new HttpError(409, "ข้อมูลไม่ผ่านเงื่อนไขของระบบบัญชี");
  if (code === "42501") return new HttpError(403, "ไม่อนุญาตให้ทำรายการนี้");
  if (code === "P0002") return new HttpError(404, "ไม่พบข้อมูล");
  return null;
}

export async function audit(tx: Tx, u: { companyId: string; actorRef: string }, action: string, entityType: string, entityId: string, after: unknown, requestId: string, before: unknown = null) {
  await tx`insert into finance.audit_events (company_id, actor_ref, action, entity_type, entity_id, before_data, after_data, request_id)
    values (${u.companyId}::uuid, ${u.actorRef}, ${action}, ${entityType}, ${entityId}, ${before == null ? null : tx.json(before)}, ${after == null ? null : tx.json(after)}, ${requestId})`;
}
export async function approvalEvent(tx: Tx, u: { companyId: string; actorRef: string }, entityType: string, entityId: string, action: string, note: string | null, requestId: string) {
  await tx`insert into finance.approval_events (company_id, entity_type, entity_id, action, actor_ref, note, request_id)
    values (${u.companyId}::uuid, ${entityType}, ${entityId}::uuid, ${action}, ${u.actorRef}, ${note}, ${requestId})`;
}
