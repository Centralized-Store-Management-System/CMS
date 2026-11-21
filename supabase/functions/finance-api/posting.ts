// เครื่องลงบัญชี: ผังบัญชีมาตรฐาน, บัญชีระบบ, ตรวจรอบบัญชี, ออกเลขเอกสาร/สมุดรายวัน, ลงบัญชีแบบสมดุล
import { fail, num, round2, Tx } from "./util.ts";
import type { User } from "./auth.ts";

// ผังบัญชีมาตรฐานสำหรับร้านกาแฟ/SME ไทย (Owner ปรับเพิ่มได้) · system_key = บัญชีที่ระบบใช้ลงบัญชีอัตโนมัติ
export const DEFAULT_COA: [string, string, string, string | null][] = [
  ["1000", "เงินสด", "asset", "cash"],
  ["1010", "เงินฝากธนาคาร", "asset", "bank"],
  ["1100", "ลูกหนี้การค้า", "asset", "ar"],
  ["1150", "ภาษีซื้อ", "asset", "vat_input"],
  ["1160", "ภาษีเงินได้ถูกหัก ณ ที่จ่าย", "asset", "wht_receivable"],
  ["1200", "สินค้าคงเหลือ / วัตถุดิบ", "asset", null],
  ["1300", "ค่าใช้จ่ายจ่ายล่วงหน้า / เงินมัดจำ", "asset", null],
  ["1500", "อุปกรณ์และเครื่องใช้ร้าน", "asset", null],
  ["1590", "ค่าเสื่อมราคาสะสม", "asset", null],
  ["2000", "เจ้าหนี้การค้า", "liability", "ap"],
  ["2100", "ภาษีขาย", "liability", "vat_output"],
  ["2110", "ภาษีมูลค่าเพิ่มค้างจ่าย", "liability", "vat_payable"],
  ["2120", "ภาษีหัก ณ ที่จ่ายค้างจ่าย", "liability", "wht_payable"],
  ["2200", "ค่าใช้จ่ายค้างจ่าย", "liability", null],
  ["2300", "เงินกู้ยืม", "liability", null],
  ["3000", "ทุน", "equity", "capital"],
  ["3100", "กำไร (ขาดทุน) สะสม", "equity", "retained"],
  ["4000", "รายได้จากการขาย", "revenue", "revenue"],
  ["4100", "รายได้อื่น", "revenue", null],
  ["5000", "ต้นทุนขาย / วัตถุดิบ", "expense", null],
  ["5100", "เงินเดือนและค่าแรง", "expense", null],
  ["5200", "ค่าเช่า", "expense", null],
  ["5300", "ค่าน้ำ ค่าไฟ ค่าโทรศัพท์", "expense", null],
  ["5400", "ค่าธรรมเนียมแฟรนไชส์ / Royalty", "expense", null],
  ["5500", "ค่าการตลาด", "expense", null],
  ["5600", "ค่าซ่อมแซมและบำรุงรักษา", "expense", null],
  ["5700", "ค่าธรรมเนียมธนาคาร / ชำระเงิน", "expense", null],
  ["5800", "ค่าเสื่อมราคา", "expense", null],
  ["5900", "ค่าใช้จ่ายอื่น", "expense", "expense"],
];

export const DOC_PREFIX: Record<string, string> = {
  tax_invoice: "TIV", invoice: "INV", receipt: "RE", credit_note: "CN", debit_note: "DN",
  expense: "EXP", bill: "BIL", payment_voucher: "PV", other: "DOC", wht_certificate: "WTI",
};
export const REVENUE_DOCS = ["tax_invoice", "invoice", "receipt", "debit_note", "credit_note"];
export const EXPENSE_DOCS = ["expense", "bill", "payment_voucher"];

export async function sysAccount(tx: Tx, u: User, key: string) {
  const [a] = await tx`select id from finance.chart_of_accounts where company_id = ${u.companyId}::uuid and system_key = ${key} and is_active`;
  if (!a) fail(409, "ยังไม่ได้ตั้งผังบัญชีมาตรฐาน — ไปที่ ตั้งค่า › ตั้งค่าเริ่มต้น ก่อน");
  return String(a.id);
}
export async function accountByCode(tx: Tx, u: User, code: string, types: string[]) {
  const [a] = await tx`select id, account_type from finance.chart_of_accounts where company_id = ${u.companyId}::uuid and account_code = ${code} and is_active`;
  if (!a) fail(400, "ไม่พบรหัสบัญชี " + code + " หรือถูกปิดใช้งาน");
  if (!types.includes(a.account_type)) fail(400, "บัญชี " + code + " ไม่ใช่ประเภทที่ใช้กับรายการนี้");
  return String(a.id);
}
export async function accountById(tx: Tx, u: User, id: string, types?: string[]) {
  const [a] = await tx`select id, account_type, account_code from finance.chart_of_accounts where id = ${id}::uuid and company_id = ${u.companyId}::uuid and is_active`;
  if (!a) fail(400, "ไม่พบบัญชีที่เลือก หรือถูกปิดใช้งาน");
  if (types && !types.includes(a.account_type)) fail(400, "บัญชี " + a.account_code + " ไม่ใช่ประเภทที่ใช้กับรายการนี้");
  return a;
}

export async function requireOpenPeriod(tx: Tx, u: User, d: string) {
  const [p] = await tx`select id, period_code, status from finance.accounting_periods
    where company_id = ${u.companyId}::uuid and starts_on <= ${d}::date and ends_on >= ${d}::date limit 1`;
  if (!p) fail(409, "ยังไม่มีรอบบัญชีของวันที่ " + d + " — ให้ Owner สร้างรอบบัญชีที่ ตั้งค่า › รอบบัญชี");
  if (!["open", "reopened"].includes(p.status)) fail(409, "รอบบัญชี " + p.period_code + " ปิดแล้ว ลงบัญชีวันที่นี้ไม่ได้");
  return p;
}

export async function nextDocNumber(tx: Tx, u: User, type: string, d: string) {
  const key = d.slice(0, 7).replace("-", "");
  const prefix = DOC_PREFIX[type] || "DOC";
  const [s] = await tx`insert into finance.document_sequences (company_id, document_type, prefix, date_pattern, next_number, padding, reset_frequency, last_reset_key)
      values (${u.companyId}::uuid, ${type}, ${prefix}, 'YYYYMM', 2, 4, 'monthly', ${key})
      on conflict (company_id, document_type) do update set
        next_number = case when finance.document_sequences.last_reset_key = ${key} then finance.document_sequences.next_number + 1 else 2 end,
        last_reset_key = ${key}
      returning next_number - 1 as n, prefix`;
  return s.prefix + "-" + key + "-" + String(s.n).padStart(4, "0");
}

async function nextJournalNumber(tx: Tx, u: User, d: string) {
  const key = d.slice(0, 7);
  const [s] = await tx`insert into finance.journal_sequences (company_id, prefix, period_key, next_number, padding)
      values (${u.companyId}::uuid, 'JV', ${key}, 2, 5)
      on conflict (company_id, period_key) do update set next_number = finance.journal_sequences.next_number + 1
      returning next_number - 1 as n`;
  return "JV-" + key.replace("-", "") + "-" + String(s.n).padStart(5, "0");
}

export type Line = { account_id: string; debit: number; credit: number; description?: string | null; partner_id?: string | null };
// รวมบรรทัดบัญชีเดียวกันด้านเดียวกัน · ตัดบรรทัดศูนย์
export function compact(lines: Line[]) {
  const m = new Map<string, Line>();
  for (const l of lines) {
    const d = round2(l.debit || 0), c = round2(l.credit || 0);
    if (!d && !c) continue;
    const k = l.account_id + "|" + (d ? "D" : "C") + "|" + (l.partner_id || "") + "|" + (l.description || "");
    const x = m.get(k);
    if (x) { x.debit = round2(x.debit + d); x.credit = round2(x.credit + c); }
    else m.set(k, { ...l, debit: d, credit: c });
  }
  return [...m.values()];
}

// ลงบัญชีทันที (รายการที่ผ่านการอนุมัติแล้ว: เอกสาร, การชำระเงิน, ภาษี, กลับรายการ)
export async function postEntry(tx: Tx, u: User, e: {
  date: string; description: string; source_type: string; created_by?: string | null;
  source_document_id?: string | null; source_payment_id?: string | null; reversal_of?: string | null; lines: Line[];
}) {
  await requireOpenPeriod(tx, u, e.date);
  const lines = compact(e.lines);
  const dr = round2(lines.reduce((a, l) => a + l.debit, 0)), cr = round2(lines.reduce((a, l) => a + l.credit, 0));
  if (lines.length < 2 || dr <= 0 || Math.abs(dr - cr) > 0.004) fail(500, "ระบบคำนวณรายการบัญชีไม่สมดุล (Dr " + dr + " / Cr " + cr + ")");
  const no = await nextJournalNumber(tx, u, e.date);
  const [je] = await tx`insert into finance.journal_entries
      (company_id, journal_number, journal_date, description, source_type, source_document_id, source_payment_id, reversal_of, status, total_debit, total_credit, created_by)
      values (${u.companyId}::uuid, ${no}, ${e.date}::date, ${e.description.slice(0, 500)}, ${e.source_type}, ${e.source_document_id || null}::uuid,
              ${e.source_payment_id || null}::uuid, ${e.reversal_of || null}::uuid, 'draft', ${dr}, ${cr}, ${e.created_by || u.actorRef})
      returning id`;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    await tx`insert into finance.journal_lines (journal_entry_id, account_id, line_no, description, debit, credit, partner_id)
      values (${je.id}, ${l.account_id}::uuid, ${i + 1}, ${l.description || null}, ${l.debit}, ${l.credit}, ${l.partner_id || null}::uuid)`;
  }
  const [posted] = await tx`update finance.journal_entries set status = 'posted', posted_at = now(), posted_by = ${u.actorRef}, approved_by = ${u.actorRef}
      where id = ${je.id} returning id, journal_number, journal_date, status, total_debit, total_credit`;
  return posted;
}

// กลับรายการสมุดรายวันที่ลงบัญชีแล้ว (สลับเดบิต/เครดิต) — ต้นฉบับเปลี่ยนเป็น reversed
export async function reverseEntry(tx: Tx, u: User, journalId: string, d: string, reason: string) {
  const [je] = await tx`select id, journal_number, status from finance.journal_entries where id = ${journalId}::uuid and company_id = ${u.companyId}::uuid for update`;
  if (!je) fail(404, "ไม่พบสมุดรายวัน");
  if (je.status !== "posted") fail(409, "กลับรายการได้เฉพาะสมุดรายวันที่ลงบัญชีแล้ว");
  const lines = await tx`select account_id, debit, credit, description, partner_id from finance.journal_lines where journal_entry_id = ${je.id} order by line_no`;
  const rev = await postEntry(tx, u, {
    date: d, description: "กลับรายการ " + je.journal_number + (reason ? " — " + reason : ""), source_type: "reversal", reversal_of: je.id,
    lines: lines.map((l: Record<string, unknown>) => ({ account_id: String(l.account_id), debit: num(l.credit), credit: num(l.debit), description: l.description as string, partner_id: l.partner_id as string })),
  });
  await tx`update finance.journal_entries set status = 'reversed' where id = ${je.id}`;
  return rev;
}

export async function ensureDefaults(tx: Tx, u: User) {
  let created = 0;
  for (const [code, name, type, key] of DEFAULT_COA) {
    const r = await tx`insert into finance.chart_of_accounts (company_id, account_code, account_name, account_type, system_key)
      values (${u.companyId}::uuid, ${code}, ${name}, ${type}, ${key})
      on conflict (company_id, account_code) do update set system_key = coalesce(finance.chart_of_accounts.system_key, excluded.system_key)
      returning (xmax = 0) as inserted`;
    if (r[0] && r[0].inserted) created++;
  }
  return created;
}

export async function createYearPeriods(tx: Tx, u: User, year: number) {
  const [c] = await tx`select fiscal_year_start_month from finance.companies where id = ${u.companyId}::uuid`;
  const start = Number(c?.fiscal_year_start_month || 1);
  let created = 0;
  for (let i = 0; i < 12; i++) {
    const m0 = start - 1 + i, y = year + Math.floor(m0 / 12), m = (m0 % 12) + 1;
    const code = y + "-" + String(m).padStart(2, "0");
    const first = code + "-01";
    const last = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
    const r = await tx`insert into finance.accounting_periods (company_id, period_code, starts_on, ends_on)
      values (${u.companyId}::uuid, ${code}, ${first}::date, ${last}::date) on conflict (company_id, period_code) do nothing returning id`;
    if (r.length) created++;
  }
  return created;
}
