// เอกสารรายรับ / รายจ่าย: ร่าง → ส่งตรวจ → อนุมัติ (ลงบัญชีอัตโนมัติ + ภาษี) · ตีกลับ · ยกเลิก · กลับรายการ
import { approvalEvent, audit, date, db, fail, money, num, oneOf, opt, round2, text, Tx, uuid } from "./util.ts";
import { makerChecker, need, User } from "./auth.ts";
import { accountByCode, EXPENSE_DOCS, Line, nextDocNumber, postEntry, reverseEntry, REVENUE_DOCS, sysAccount } from "./posting.ts";

const TYPES = [...REVENUE_DOCS, ...EXPENSE_DOCS] as const;
const VAT_RATES = [0, 7], WHT_RATES = [0, 1, 1.5, 2, 3, 5, 10];

type Calc = { lines: { description: string; quantity: number; unit_price: number; account_code: string | null; base: number; vat: number; wht: number }[]; subtotal: number; vat: number; wht: number; grand: number; vatRate: number; whtRate: number };

function calc(body: Record<string, unknown>, type: string, u: User): Calc {
  const vatRate = Number(body.vat_rate ?? 0), whtRate = Number(body.wht_rate ?? 0);
  if (!VAT_RATES.includes(vatRate)) fail(400, "อัตรา VAT ต้องเป็น 0 หรือ 7");
  if (!WHT_RATES.includes(whtRate)) fail(400, "อัตราหัก ณ ที่จ่ายไม่ถูกต้อง");
  if (REVENUE_DOCS.includes(type) && vatRate > 0 && !u.vatRegistered) fail(400, "บริษัทยังไม่ได้จดทะเบียน VAT — เก็บภาษีขายไม่ได้ (ตั้งค่าได้ที่ ข้อมูลบริษัท)");
  if (type === "tax_invoice" && !u.vatRegistered) fail(400, "ออกใบกำกับภาษีได้เฉพาะบริษัทที่จดทะเบียน VAT");
  const inclusive = body.vat_inclusive === true;
  const raw = Array.isArray(body.lines) ? body.lines as Record<string, unknown>[] : [];
  if (!raw.length || raw.length > 100) fail(400, "เอกสารต้องมีรายการ 1–100 บรรทัด");
  const lines = raw.map((l, i) => {
    const description = text(l.description, 300);
    const quantity = Number(l.quantity ?? 1), unit_price = Number(l.unit_price);
    if (!description) fail(400, "บรรทัดที่ " + (i + 1) + ": กรุณาระบุรายละเอียด");
    if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 1e7) fail(400, "บรรทัดที่ " + (i + 1) + ": จำนวนไม่ถูกต้อง");
    if (!Number.isFinite(unit_price) || unit_price < 0 || unit_price > 1e10) fail(400, "บรรทัดที่ " + (i + 1) + ": ราคาไม่ถูกต้อง");
    const gross = round2(quantity * unit_price);
    const base = inclusive && vatRate ? round2(gross * 100 / (100 + vatRate)) : gross;
    const vat = inclusive && vatRate ? round2(gross - base) : round2(base * vatRate / 100);
    const wht = round2(base * whtRate / 100);
    const code = text(l.account_code, 20) || null;
    return { description, quantity, unit_price, account_code: code, base, vat, wht };
  });
  const subtotal = round2(lines.reduce((a, l) => a + l.base, 0));
  const vat = round2(lines.reduce((a, l) => a + l.vat, 0));
  const wht = round2(lines.reduce((a, l) => a + l.wht, 0));
  const grand = round2(subtotal + vat - wht);
  if (subtotal <= 0) fail(400, "มูลค่าเอกสารต้องมากกว่า 0");
  return { lines, subtotal, vat, wht, grand, vatRate, whtRate };
}

async function checkPartner(tx: Tx, u: User, id: string | null) {
  if (!id) return;
  const [p] = await tx`select id from finance.partners where id = ${id}::uuid and company_id = ${u.companyId}::uuid and is_active`;
  if (!p) fail(400, "ไม่พบคู่ค้าในบริษัทนี้ หรือคู่ค้าถูกปิดใช้งาน");
}
async function checkLineAccounts(tx: Tx, u: User, type: string, c: Calc) {
  const types = REVENUE_DOCS.includes(type) ? ["revenue"] : ["expense", "asset"];
  for (const l of c.lines) if (l.account_code) await accountByCode(tx, u, l.account_code, types);
}
async function writeLines(tx: Tx, docId: string, c: Calc) {
  for (let i = 0; i < c.lines.length; i++) {
    const l = c.lines[i];
    await tx`insert into finance.document_lines (document_id, line_no, description, quantity, unit_price, vat_rate, vat_amount, wht_rate, wht_amount, account_code, line_total)
      values (${docId}::uuid, ${i + 1}, ${l.description}, ${l.quantity}, ${l.unit_price}, ${c.vatRate}, ${l.vat}, ${c.whtRate}, ${l.wht}, ${l.account_code}, ${l.base})`;
  }
}
const COLS = "id, document_type, document_number, document_date, due_date, partner_id, status, subtotal, vat_total, wht_total, grand_total, reference, notes, created_by, submitted_by, approved_by, posted_at, created_at";

export async function createDocument(body: Record<string, unknown>, u: User, rid: string, idem: string) {
  need(u, "write");
  const type = oneOf(body.document_type, TYPES, "ประเภทเอกสาร");
  const d = date(body.document_date, "วันที่เอกสาร");
  const due = body.due_date ? date(body.due_date, "วันครบกำหนด") : null;
  if (due && due < d) fail(400, "วันครบกำหนดต้องไม่ก่อนวันที่เอกสาร");
  const partnerId = uuid(body.partner_id, "คู่ค้า", false);
  const c = calc(body, type, u);
  return await db().begin(async (tx: Tx) => {
    if (idem) {
      await tx`select pg_advisory_xact_lock(hashtextextended(${u.companyId + ":doc:" + idem}, 0))`;
      const [ex] = await tx`select id, document_number, status, grand_total from finance.documents where company_id = ${u.companyId}::uuid and idempotency_key = ${idem}`;
      if (ex) return { ...ex, duplicate: true };
    }
    await checkPartner(tx, u, partnerId);
    await checkLineAccounts(tx, u, type, c);
    const no = await nextDocNumber(tx, u, type, d);
    const [doc] = await tx`insert into finance.documents
      (company_id, document_type, document_number, document_date, due_date, partner_id, status, subtotal, vat_total, wht_total, grand_total, reference, notes, created_by, idempotency_key)
      values (${u.companyId}::uuid, ${type}, ${no}, ${d}::date, ${due}::date, ${partnerId}::uuid, 'draft', ${c.subtotal}, ${c.vat}, ${c.wht}, ${c.grand},
              ${opt(body.reference, 120)}, ${opt(body.notes, 2000)}, ${u.actorRef}, ${idem || null})
      returning id, document_type, document_number, document_date, status, subtotal, vat_total, wht_total, grand_total`;
    await writeLines(tx, doc.id, c);
    await audit(tx, u, "create", "document", doc.id, { ...doc, lines: c.lines.length }, rid);
    if (body.submit === true) {
      await tx`update finance.documents set status = 'pending_review', submitted_by = ${u.actorRef} where id = ${doc.id}`;
      await approvalEvent(tx, u, "document", doc.id, "submitted", null, rid);
      doc.status = "pending_review";
    }
    return doc;
  });
}

export async function updateDocument(body: Record<string, unknown>, u: User, rid: string) {
  need(u, "write");
  const id = uuid(body.document_id, "รหัสเอกสาร")!;
  return await db().begin(async (tx: Tx) => {
    const [old] = await tx`select * from finance.documents where id = ${id}::uuid and company_id = ${u.companyId}::uuid for update`;
    if (!old) fail(404, "ไม่พบเอกสาร");
    if (old.status !== "draft") fail(409, "แก้ไขได้เฉพาะเอกสารฉบับร่าง (ถ้าส่งตรวจแล้ว ให้ผู้อนุมัติตีกลับก่อน)");
    if (old.created_by !== u.actorRef && !["owner", "approver"].includes(u.role)) fail(403, "แก้ไขได้เฉพาะผู้สร้างเอกสาร หรือผู้อนุมัติ");
    const d = date(body.document_date, "วันที่เอกสาร");
    const due = body.due_date ? date(body.due_date, "วันครบกำหนด") : null;
    if (due && due < d) fail(400, "วันครบกำหนดต้องไม่ก่อนวันที่เอกสาร");
    const partnerId = uuid(body.partner_id, "คู่ค้า", false);
    const c = calc(body, old.document_type, u);
    await checkPartner(tx, u, partnerId);
    await checkLineAccounts(tx, u, old.document_type, c);
    await tx`delete from finance.document_lines where document_id = ${id}::uuid`;
    const [doc] = await tx`update finance.documents set document_date = ${d}::date, due_date = ${due}::date, partner_id = ${partnerId}::uuid,
        subtotal = ${c.subtotal}, vat_total = ${c.vat}, wht_total = ${c.wht}, grand_total = ${c.grand}, reference = ${opt(body.reference, 120)}, notes = ${opt(body.notes, 2000)}
        where id = ${id}::uuid returning id, document_number, status, subtotal, vat_total, wht_total, grand_total`;
    await writeLines(tx, id, c);
    await audit(tx, u, "update", "document", id, doc, rid, { grand_total: old.grand_total, document_date: old.document_date });
    return doc;
  });
}

export async function submitDocument(body: Record<string, unknown>, u: User, rid: string) {
  need(u, "write");
  const id = uuid(body.document_id, "รหัสเอกสาร")!;
  return await db().begin(async (tx: Tx) => {
    const [r] = await tx`select id, status from finance.documents where id = ${id}::uuid and company_id = ${u.companyId}::uuid for update`;
    if (!r) fail(404, "ไม่พบเอกสาร");
    if (r.status !== "draft") fail(409, "ส่งตรวจได้เฉพาะเอกสารฉบับร่าง");
    const [doc] = await tx`update finance.documents set status = 'pending_review', submitted_by = ${u.actorRef} where id = ${id}::uuid returning id, document_number, status`;
    await approvalEvent(tx, u, "document", id, "submitted", opt(body.note, 500), rid);
    await audit(tx, u, "submit", "document", id, doc, rid);
    return doc;
  });
}

export async function returnDocument(body: Record<string, unknown>, u: User, rid: string) {
  need(u, "approve");
  const id = uuid(body.document_id, "รหัสเอกสาร")!;
  const note = text(body.note, 500);
  if (!note) fail(400, "กรุณาระบุเหตุผลที่ตีกลับ");
  return await db().begin(async (tx: Tx) => {
    const [r] = await tx`select id, status from finance.documents where id = ${id}::uuid and company_id = ${u.companyId}::uuid for update`;
    if (!r) fail(404, "ไม่พบเอกสาร");
    if (r.status !== "pending_review") fail(409, "ตีกลับได้เฉพาะเอกสารที่รออนุมัติ");
    const [doc] = await tx`update finance.documents set status = 'draft' where id = ${id}::uuid returning id, document_number, status`;
    await approvalEvent(tx, u, "document", id, "returned", note, rid);
    await audit(tx, u, "return", "document", id, { ...doc, note }, rid);
    return doc;
  });
}

export async function voidDocument(body: Record<string, unknown>, u: User, rid: string) {
  need(u, "write");
  const id = uuid(body.document_id, "รหัสเอกสาร")!;
  const reason = text(body.reason, 500);
  if (!reason) fail(400, "กรุณาระบุเหตุผลที่ยกเลิก");
  return await db().begin(async (tx: Tx) => {
    const [r] = await tx`select id, status, created_by from finance.documents where id = ${id}::uuid and company_id = ${u.companyId}::uuid for update`;
    if (!r) fail(404, "ไม่พบเอกสาร");
    if (!["draft", "pending_review"].includes(r.status)) fail(409, "ยกเลิกได้เฉพาะเอกสารที่ยังไม่ลงบัญชี — เอกสารที่ลงบัญชีแล้วให้ใช้ \"กลับรายการ\"");
    if (r.created_by !== u.actorRef && !["owner", "approver"].includes(u.role)) fail(403, "ยกเลิกได้เฉพาะผู้สร้างเอกสาร หรือผู้อนุมัติ");
    const [doc] = await tx`update finance.documents set status = 'voided', voided_by = ${u.actorRef}, void_reason = ${reason} where id = ${id}::uuid returning id, document_number, status`;
    await approvalEvent(tx, u, "document", id, "cancelled", reason, rid);
    await audit(tx, u, "void", "document", id, doc, rid);
    return doc;
  });
}

// อนุมัติ = ลงบัญชีทันที (สมุดรายวันอัตโนมัติ) + บันทึกภาษีขาย/ซื้อ/หัก ณ ที่จ่าย ของงวด
export async function approveDocument(body: Record<string, unknown>, u: User, rid: string) {
  need(u, "approve");
  const id = uuid(body.document_id, "รหัสเอกสาร")!;
  return await db().begin(async (tx: Tx) => {
    const [doc] = await tx`select d.*, p.default_wht_type, p.display_name as partner_name from finance.documents d left join finance.partners p on p.id = d.partner_id
      where d.id = ${id}::uuid and d.company_id = ${u.companyId}::uuid for update of d`;
    if (!doc) fail(404, "ไม่พบเอกสาร");
    if (doc.status !== "pending_review") fail(409, "อนุมัติได้เฉพาะเอกสารที่รออนุมัติ");
    const self = makerChecker(u, doc.created_by);
    const dd = doc.document_date instanceof Date ? doc.document_date.toISOString().slice(0, 10) : String(doc.document_date);
    const lines = await tx`select * from finance.document_lines where document_id = ${id}::uuid order by line_no`;
    const isRev = REVENUE_DOCS.includes(doc.document_type), credit = doc.document_type === "credit_note";
    const sub = num(doc.subtotal), vat = num(doc.vat_total), wht = num(doc.wht_total), grand = num(doc.grand_total);
    const pid = doc.partner_id ? String(doc.partner_id) : null;
    const jl: Line[] = [];
    const desc = (doc.document_number || "") + (doc.partner_name ? " · " + doc.partner_name : "");
    if (isRev) {
      const defRev = await sysAccount(tx, u, "revenue");
      const ar = await sysAccount(tx, u, "ar");
      const s = credit ? -1 : 1;   // ใบลดหนี้ = กลับด้าน
      const side = (amt: number, debitWhenPositive: boolean): Pick<Line, "debit" | "credit"> => {
        const v = s * amt; const dr = debitWhenPositive ? v > 0 : v < 0;
        return dr ? { debit: Math.abs(v), credit: 0 } : { debit: 0, credit: Math.abs(v) };
      };
      jl.push({ account_id: ar, ...side(grand, true), partner_id: pid, description: desc });
      if (wht) jl.push({ account_id: await sysAccount(tx, u, "wht_receivable"), ...side(wht, true), partner_id: pid, description: desc });
      for (const l of lines) {
        const acc = l.account_code ? await accountByCode(tx, u, l.account_code, ["revenue"]) : defRev;
        jl.push({ account_id: acc, ...side(num(l.line_total), false), description: l.description });
      }
      if (vat) jl.push({ account_id: await sysAccount(tx, u, "vat_output"), ...side(vat, false), description: desc });
    } else {
      const defExp = await sysAccount(tx, u, "expense");
      const ap = await sysAccount(tx, u, "ap");
      const claimVat = u.vatRegistered && vat > 0;   // ไม่ได้จด VAT → ภาษีซื้อเป็นต้นทุน
      for (const l of lines) {
        const acc = l.account_code ? await accountByCode(tx, u, l.account_code, ["expense", "asset"]) : defExp;
        jl.push({ account_id: acc, debit: round2(num(l.line_total) + (claimVat ? 0 : num(l.vat_amount))), credit: 0, description: l.description });
      }
      if (claimVat) jl.push({ account_id: await sysAccount(tx, u, "vat_input"), debit: vat, credit: 0, description: desc });
      jl.push({ account_id: ap, debit: 0, credit: grand, partner_id: pid, description: desc });
      if (wht) jl.push({ account_id: await sysAccount(tx, u, "wht_payable"), debit: 0, credit: wht, partner_id: pid, description: desc });
    }
    const je = await postEntry(tx, u, { date: dd, description: "ลงบัญชีเอกสาร " + desc, source_type: "document", source_document_id: id, created_by: doc.created_by, lines: jl });
    // ภาษีของงวด (ใช้ทำรายงานภาษีซื้อ/ขาย และแบบ ภ.พ.30 / ภ.ง.ด.3 / 53)
    const tp = dd.slice(0, 7), sg = credit ? -1 : 1;
    if (vat && (isRev || u.vatRegistered)) {
      await tx`insert into finance.tax_transactions (company_id, document_id, tax_type, tax_period, tax_base, tax_rate, tax_amount, counterparty_id, tax_form_code, status)
        values (${u.companyId}::uuid, ${id}::uuid, ${isRev ? "vat_output" : "vat_input"}, ${tp}, ${sg * sub}, ${num(lines[0]?.vat_rate)}, ${sg * vat}, ${pid}::uuid, 'PP30', 'reviewed')
        on conflict (document_id, tax_type, tax_period) do update set tax_base = excluded.tax_base, tax_amount = excluded.tax_amount, status = 'reviewed'`;
    }
    if (wht) {
      const form = isRev ? "WHT_RECEIVED" : (String(doc.default_wht_type || "").toLowerCase() === "pnd3" ? "PND3" : "PND53");
      await tx`insert into finance.tax_transactions (company_id, document_id, tax_type, tax_period, tax_base, tax_rate, tax_amount, counterparty_id, tax_form_code, status)
        values (${u.companyId}::uuid, ${id}::uuid, 'wht', ${tp}, ${sg * sub}, ${num(lines[0]?.wht_rate)}, ${sg * wht}, ${pid}::uuid, ${form}, 'reviewed')
        on conflict (document_id, tax_type, tax_period) do update set tax_base = excluded.tax_base, tax_amount = excluded.tax_amount, tax_form_code = excluded.tax_form_code, status = 'reviewed'`;
    }
    const [out] = await tx`update finance.documents set status = 'posted', approved_by = ${u.actorRef}, posted_at = now() where id = ${id}::uuid
      returning id, document_number, status, grand_total, approved_by, posted_at`;
    await approvalEvent(tx, u, "document", id, "approved", self ? "อนุมัติรายการของตนเอง" : opt(body.note, 500), rid);
    await audit(tx, u, self ? "approve_self" : "approve", "document", id, { ...out, journal: je.journal_number }, rid);
    return { ...out, journal_number: je.journal_number };
  });
}

// กลับรายการเอกสารที่ลงบัญชีแล้ว (เช่น บันทึกผิด) — ต้องยังไม่มีการชำระ และภาษียังไม่ถูกยื่น
export async function reverseDocument(body: Record<string, unknown>, u: User, rid: string) {
  need(u, "approve");
  const id = uuid(body.document_id, "รหัสเอกสาร")!;
  const reason = text(body.reason, 500);
  if (!reason) fail(400, "กรุณาระบุเหตุผลที่กลับรายการ");
  return await db().begin(async (tx: Tx) => {
    const [doc] = await tx`select id, status, document_number, document_date from finance.documents where id = ${id}::uuid and company_id = ${u.companyId}::uuid for update`;
    if (!doc) fail(404, "ไม่พบเอกสาร");
    if (doc.status !== "posted") fail(409, "กลับรายการได้เฉพาะเอกสารที่ลงบัญชีแล้ว");
    const [paid] = await tx`select count(*)::int n from finance.payments where document_id = ${id}::uuid and status in ('pending','approved','paid')`;
    if (paid.n) fail(409, "เอกสารนี้มีรายการรับ/จ่ายเงินแล้ว — ยกเลิกหรือกลับรายการชำระเงินก่อน หรือออกใบลดหนี้แทน");
    const [filed] = await tx`select count(*)::int n from finance.tax_transactions where document_id = ${id}::uuid and status = 'filed'`;
    if (filed.n) fail(409, "ภาษีของเอกสารนี้ถูกยื่นแบบแล้ว — ใช้ใบลดหนี้/เพิ่มหนี้ในงวดถัดไปแทน");
    const [je] = await tx`select id from finance.journal_entries where source_document_id = ${id}::uuid and source_type = 'document' and status = 'posted'`;
    const d = body.reversal_date ? date(body.reversal_date, "วันที่กลับรายการ") : (doc.document_date instanceof Date ? doc.document_date.toISOString().slice(0, 10) : String(doc.document_date));
    const rev = je ? await reverseEntry(tx, u, je.id, d, reason) : null;
    await tx`update finance.tax_transactions set status = 'adjusted' where document_id = ${id}::uuid`;
    const [out] = await tx`update finance.documents set status = 'reversed', voided_by = ${u.actorRef}, void_reason = ${reason} where id = ${id}::uuid returning id, document_number, status`;
    await approvalEvent(tx, u, "document", id, "reversed", reason, rid);
    await audit(tx, u, "reverse", "document", id, { ...out, reversal: rev && rev.journal_number }, rid);
    return { ...out, reversal_journal: rev && rev.journal_number };
  });
}

export async function listDocuments(url: URL, u: User) {
  const kind = text(url.searchParams.get("kind"), 10);
  const status = text(url.searchParams.get("status"), 20);
  const q = text(url.searchParams.get("q"), 80);
  const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit")) || 50));
  const offset = Math.max(0, Number(url.searchParams.get("offset")) || 0);
  const types = kind === "income" ? REVENUE_DOCS : kind === "expense" ? EXPENSE_DOCS : [...TYPES];
  const sql = db();
  const rows = await sql`select d.id, d.document_type, d.document_number, d.document_date, d.due_date, d.partner_id, p.display_name as partner_name,
      d.status, d.subtotal, d.vat_total, d.wht_total, d.grand_total, d.reference, d.created_by, d.approved_by, d.created_at,
      coalesce((select sum(pa.amount) from finance.payment_allocations pa where pa.document_id = d.id), 0) as paid_total
    from finance.documents d left join finance.partners p on p.id = d.partner_id
    where d.company_id = ${u.companyId}::uuid and d.document_type = any(${types})
      and (${status} = '' or d.status = ${status})
      and (${q} = '' or d.document_number ilike ${"%" + q + "%"} or p.display_name ilike ${"%" + q + "%"} or d.reference ilike ${"%" + q + "%"})
    order by d.document_date desc, d.created_at desc limit ${limit} offset ${offset}`;
  return { items: rows, limit, offset };
}

export async function getDocument(url: URL, u: User) {
  const id = uuid(url.searchParams.get("id"), "รหัสเอกสาร")!;
  const sql = db();
  const [doc] = await sql`select d.*, p.display_name as partner_name, p.tax_id as partner_tax_id from finance.documents d left join finance.partners p on p.id = d.partner_id
    where d.id = ${id}::uuid and d.company_id = ${u.companyId}::uuid`;
  if (!doc) fail(404, "ไม่พบเอกสาร");
  const [lines, events, journal, payments] = await Promise.all([
    sql`select line_no, description, quantity, unit_price, vat_rate, vat_amount, wht_rate, wht_amount, account_code, line_total from finance.document_lines where document_id = ${id}::uuid order by line_no`,
    sql`select action, actor_ref, note, created_at from finance.approval_events where company_id = ${u.companyId}::uuid and entity_type = 'document' and entity_id = ${id}::uuid order by created_at`,
    sql`select je.id, je.journal_number, je.status, je.journal_date from finance.journal_entries je where je.company_id = ${u.companyId}::uuid and je.source_document_id = ${id}::uuid order by je.created_at`,
    sql`select id, payment_type, payment_date, amount, status, method from finance.payments where company_id = ${u.companyId}::uuid and document_id = ${id}::uuid order by created_at`,
  ]);
  return { document: doc, lines, events, journals: journal, payments };
}
