// รับ / จ่ายเงิน: สร้าง (รออนุมัติ) → อนุมัติ (Maker–Checker) → บันทึกว่าจ่าย/รับจริง (ลงบัญชี + ตัดยอดเอกสาร) · ปฏิเสธ · ยกเลิก
import { approvalEvent, audit, date, db, fail, money, num, oneOf, opt, round2, text, Tx, uuid } from "./util.ts";
import { makerChecker, need, User } from "./auth.ts";
import { accountById, EXPENSE_DOCS, postEntry, REVENUE_DOCS, sysAccount } from "./posting.ts";

const METHODS = ["cash", "bank_transfer", "credit_card", "cheque", "other"] as const;

async function outstanding(tx: Tx, docId: string, excludePayment: string | null = null) {
  const [r] = await tx`select d.grand_total,
      coalesce((select sum(p.amount) from finance.payments p where p.document_id = d.id and p.status in ('pending','approved','paid') and (${excludePayment}::uuid is null or p.id <> ${excludePayment}::uuid)), 0) as committed
    from finance.documents d where d.id = ${docId}::uuid`;
  return round2(num(r.grand_total) - num(r.committed));
}

export async function createPayment(body: Record<string, unknown>, u: User, rid: string, idem: string) {
  need(u, "write");
  if (!idem || idem.length < 8) fail(400, "ต้องมี Idempotency Key เพื่อกันบันทึกซ้ำ");
  const type = oneOf(body.payment_type, ["receipt", "disbursement"] as const, "ประเภทการรับ/จ่าย");
  const d = date(body.payment_date, "วันที่รับ/จ่าย");
  const amount = money(body.amount, "จำนวนเงิน", { allowZero: false });
  const method = oneOf(body.method, METHODS, "ช่องทาง");
  const docId = uuid(body.document_id, "เอกสาร", false);
  const offsetId = uuid(body.offset_account_id, "บัญชีคู่", false);
  let cashId = uuid(body.cash_account_id, "บัญชีเงินสด/ธนาคาร", false);
  if (!docId && !offsetId) fail(400, "เลือกเอกสารที่จะรับ/จ่าย หรือเลือกบัญชีคู่ (กรณีไม่มีเอกสาร)");
  return await db().begin(async (tx: Tx) => {
    await tx`select pg_advisory_xact_lock(hashtextextended(${u.companyId + ":pay:" + idem}, 0))`;
    const [ex] = await tx`select id, status, amount from finance.payments where company_id = ${u.companyId}::uuid and idempotency_key = ${idem}`;
    if (ex) return { ...ex, duplicate: true };
    let partnerId = uuid(body.partner_id, "คู่ค้า", false);
    if (docId) {
      const [doc] = await tx`select id, document_type, status, partner_id from finance.documents where id = ${docId}::uuid and company_id = ${u.companyId}::uuid for update`;
      if (!doc) fail(400, "ไม่พบเอกสาร");
      if (doc.status !== "posted") fail(409, "รับ/จ่ายได้เฉพาะเอกสารที่อนุมัติและลงบัญชีแล้ว");
      if (doc.document_type === "credit_note") fail(400, "ใบลดหนี้ไม่ต้องรับ/จ่ายเงินผ่านเมนูนี้");
      const want = REVENUE_DOCS.includes(doc.document_type) ? "receipt" : "disbursement";
      if (want !== type) fail(400, want === "receipt" ? "เอกสารรายรับต้องบันทึกเป็น \"รับเงิน\"" : "เอกสารรายจ่ายต้องบันทึกเป็น \"จ่ายเงิน\"");
      const left = await outstanding(tx, docId);
      if (amount - left > 0.004) fail(400, "จำนวนเงินเกินยอดคงค้างของเอกสาร (คงค้าง " + left.toFixed(2) + ")");
      partnerId = doc.partner_id ? String(doc.partner_id) : partnerId;
    }
    if (offsetId) await accountById(tx, u, offsetId);
    if (cashId) { const a = await accountById(tx, u, cashId, ["asset"]); cashId = String(a.id); }
    else cashId = await sysAccount(tx, u, method === "cash" ? "cash" : "bank");
    const [p] = await tx`insert into finance.payments (company_id, document_id, partner_id, payment_type, payment_date, amount, method, reference_number, status, created_by, idempotency_key, cash_account_id, offset_account_id, note)
      values (${u.companyId}::uuid, ${docId}::uuid, ${partnerId}::uuid, ${type}, ${d}::date, ${amount}, ${method}, ${opt(body.reference_number, 120)}, 'pending', ${u.actorRef}, ${idem}, ${cashId}::uuid, ${offsetId}::uuid, ${opt(body.note, 500)})
      returning id, payment_type, payment_date, amount, method, status, document_id`;
    await tx`insert into finance.payment_events (company_id, payment_id, actor_ref, action, note, request_id) values (${u.companyId}::uuid, ${p.id}, ${u.actorRef}, 'created', ${opt(body.note, 500)}, ${rid})`;
    await audit(tx, u, "create", "payment", p.id, p, rid);
    return p;
  });
}

async function lockPayment(tx: Tx, u: User, id: string) {
  const [p] = await tx`select * from finance.payments where id = ${id}::uuid and company_id = ${u.companyId}::uuid for update`;
  if (!p) fail(404, "ไม่พบรายการรับ/จ่ายเงิน");
  return p;
}

export async function approvePayment(body: Record<string, unknown>, u: User, rid: string) {
  need(u, "approve");
  const id = uuid(body.payment_id, "รายการ")!;
  return await db().begin(async (tx: Tx) => {
    const p = await lockPayment(tx, u, id);
    if (p.status !== "pending") fail(409, "อนุมัติได้เฉพาะรายการที่รออนุมัติ");
    const self = makerChecker(u, p.created_by);
    const [out] = await tx`update finance.payments set status = 'approved', approved_by = ${u.actorRef} where id = ${id}::uuid returning id, status, amount, approved_by`;
    await tx`insert into finance.payment_events (company_id, payment_id, actor_ref, action, note, request_id) values (${u.companyId}::uuid, ${id}::uuid, ${u.actorRef}, 'approved', ${self ? "อนุมัติรายการของตนเอง" : opt(body.note, 500)}, ${rid})`;
    await approvalEvent(tx, u, "payment", id, "approved", self ? "อนุมัติรายการของตนเอง" : opt(body.note, 500), rid);
    await audit(tx, u, self ? "approve_self" : "approve", "payment", id, out, rid);
    return out;
  });
}

export async function rejectPayment(body: Record<string, unknown>, u: User, rid: string) {
  need(u, "approve");
  const id = uuid(body.payment_id, "รายการ")!;
  const note = text(body.note, 500);
  if (!note) fail(400, "กรุณาระบุเหตุผลที่ปฏิเสธ");
  return await db().begin(async (tx: Tx) => {
    const p = await lockPayment(tx, u, id);
    if (p.status !== "pending") fail(409, "ปฏิเสธได้เฉพาะรายการที่รออนุมัติ");
    const [out] = await tx`update finance.payments set status = 'rejected', rejected_by = ${u.actorRef} where id = ${id}::uuid returning id, status`;
    await tx`insert into finance.payment_events (company_id, payment_id, actor_ref, action, note, request_id) values (${u.companyId}::uuid, ${id}::uuid, ${u.actorRef}, 'rejected', ${note}, ${rid})`;
    await approvalEvent(tx, u, "payment", id, "rejected", note, rid);
    await audit(tx, u, "reject", "payment", id, out, rid);
    return out;
  });
}

export async function cancelPayment(body: Record<string, unknown>, u: User, rid: string) {
  need(u, "write");
  const id = uuid(body.payment_id, "รายการ")!;
  const note = text(body.note, 500);
  if (!note) fail(400, "กรุณาระบุเหตุผลที่ยกเลิก");
  return await db().begin(async (tx: Tx) => {
    const p = await lockPayment(tx, u, id);
    if (!["pending", "approved"].includes(p.status)) fail(409, "ยกเลิกได้เฉพาะรายการที่ยังไม่ได้รับ/จ่ายจริง");
    if (p.created_by !== u.actorRef && !["owner", "approver"].includes(u.role)) fail(403, "ยกเลิกได้เฉพาะผู้สร้างรายการ หรือผู้อนุมัติ");
    const [out] = await tx`update finance.payments set status = 'cancelled' where id = ${id}::uuid returning id, status`;
    await tx`insert into finance.payment_events (company_id, payment_id, actor_ref, action, note, request_id) values (${u.companyId}::uuid, ${id}::uuid, ${u.actorRef}, 'cancelled', ${note}, ${rid})`;
    await audit(tx, u, "cancel", "payment", id, out, rid);
    return out;
  });
}

// บันทึกว่ารับ/จ่ายเงินจริงแล้ว → ลงบัญชี (Dr/Cr เงินสด/ธนาคาร กับ ลูกหนี้/เจ้าหนี้ หรือบัญชีคู่) และตัดยอดคงค้างของเอกสาร
export async function markPaid(body: Record<string, unknown>, u: User, rid: string) {
  need(u, "approve");
  const id = uuid(body.payment_id, "รายการ")!;
  return await db().begin(async (tx: Tx) => {
    const p = await lockPayment(tx, u, id);
    if (p.status !== "approved") fail(409, "ต้องอนุมัติรายการก่อนบันทึกว่ารับ/จ่ายแล้ว");
    const amount = num(p.amount), pid = p.partner_id ? String(p.partner_id) : null;
    const pd = p.payment_date instanceof Date ? p.payment_date.toISOString().slice(0, 10) : String(p.payment_date);
    let counter: string, docNo = "";
    if (p.document_id) {
      const [doc] = await tx`select id, document_type, document_number, status from finance.documents where id = ${p.document_id} for update`;
      if (doc.status !== "posted") fail(409, "เอกสารถูกกลับรายการแล้ว บันทึกรับ/จ่ายไม่ได้");
      const left = await outstanding(tx, String(p.document_id), id);
      if (amount - left > 0.004) fail(409, "จำนวนเงินเกินยอดคงค้างของเอกสาร");
      counter = await sysAccount(tx, u, REVENUE_DOCS.includes(doc.document_type) ? "ar" : "ap");
      docNo = doc.document_number || "";
    } else counter = String(p.offset_account_id);
    const cash = String(p.cash_account_id || await sysAccount(tx, u, p.method === "cash" ? "cash" : "bank"));
    const receipt = p.payment_type === "receipt";
    const desc = (receipt ? "รับเงิน " : "จ่ายเงิน ") + (docNo || p.reference_number || "") ;
    const je = await postEntry(tx, u, {
      date: pd, description: desc.trim(), source_type: "payment", source_payment_id: id, created_by: p.created_by,
      lines: receipt
        ? [{ account_id: cash, debit: amount, credit: 0, description: desc }, { account_id: counter, debit: 0, credit: amount, partner_id: pid, description: desc }]
        : [{ account_id: counter, debit: amount, credit: 0, partner_id: pid, description: desc }, { account_id: cash, debit: 0, credit: amount, description: desc }],
    });
    if (p.document_id) await tx`insert into finance.payment_allocations (company_id, payment_id, document_id, amount) values (${u.companyId}::uuid, ${id}::uuid, ${p.document_id}, ${amount})`;
    const paidAt = body.paid_at ? new Date(String(body.paid_at)) : new Date();
    if (Number.isNaN(paidAt.getTime())) fail(400, "วันเวลารับ/จ่ายจริงไม่ถูกต้อง");
    const [out] = await tx`update finance.payments set status = 'paid', paid_at = ${paidAt.toISOString()}::timestamptz where id = ${id}::uuid returning id, status, paid_at, amount`;
    await tx`insert into finance.payment_events (company_id, payment_id, actor_ref, action, note, request_id) values (${u.companyId}::uuid, ${id}::uuid, ${u.actorRef}, 'paid', ${opt(body.note, 500)}, ${rid})`;
    await audit(tx, u, "mark_paid", "payment", id, { ...out, journal: je.journal_number }, rid);
    return { ...out, journal_number: je.journal_number };
  });
}

export async function listPayments(url: URL, u: User) {
  const status = text(url.searchParams.get("status"), 20);
  const type = text(url.searchParams.get("type"), 20);
  const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit")) || 50));
  const offset = Math.max(0, Number(url.searchParams.get("offset")) || 0);
  const rows = await db()`select p.id, p.payment_type, p.payment_date, p.amount, p.method, p.reference_number, p.status, p.note,
      p.created_by, p.approved_by, p.paid_at, p.created_at, p.document_id, d.document_number, coalesce(pt.display_name, pt2.display_name) as partner_name,
      ca.account_code as cash_account_code, ca.account_name as cash_account_name, oa.account_code as offset_account_code, oa.account_name as offset_account_name
    from finance.payments p
      left join finance.documents d on d.id = p.document_id
      left join finance.partners pt on pt.id = p.partner_id
      left join finance.partners pt2 on pt2.id = d.partner_id
      left join finance.chart_of_accounts ca on ca.id = p.cash_account_id
      left join finance.chart_of_accounts oa on oa.id = p.offset_account_id
    where p.company_id = ${u.companyId}::uuid and (${status} = '' or p.status = ${status}) and (${type} = '' or p.payment_type = ${type})
    order by p.payment_date desc, p.created_at desc limit ${limit} offset ${offset}`;
  return { items: rows, limit, offset };
}

// เอกสารที่ยังรับ/จ่ายไม่ครบ (ใช้เลือกตอนสร้างรายการรับ/จ่าย)
export async function openDocuments(url: URL, u: User) {
  const kind = text(url.searchParams.get("kind"), 10);
  const types = kind === "income" ? REVENUE_DOCS.filter(t => t !== "credit_note") : EXPENSE_DOCS;
  const rows = await db()`select d.id, d.document_type, d.document_number, d.document_date, d.due_date, d.grand_total, p.display_name as partner_name,
      d.grand_total - coalesce((select sum(x.amount) from finance.payments x where x.document_id = d.id and x.status in ('pending','approved','paid')), 0) as outstanding
    from finance.documents d left join finance.partners p on p.id = d.partner_id
    where d.company_id = ${u.companyId}::uuid and d.status = 'posted' and d.document_type = any(${types})
      and d.grand_total - coalesce((select sum(x.amount) from finance.payments x where x.document_id = d.id and x.status in ('pending','approved','paid')), 0) > 0.004
    order by d.document_date limit 200`;
  return { items: rows };
}
