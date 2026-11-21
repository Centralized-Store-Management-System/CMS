// หนังสือรับรองการหักภาษี ณ ที่จ่าย (50 ทวิ) — สร้างจากคำขอเบิก บันทึกแล้วผูกกับเลขที่คำขอ พิมพ์ซ้ำได้ตลอด
import { audit, date, db, fail, money, num, oneOf, opt, round2, text, todayBangkok, Tx, uuid } from "./util.ts";
import { need, User } from "./auth.ts";
import { EXPENSE_DOCS, nextDocNumber } from "./posting.ts";
import { canManage, canSee } from "./expense-clearances.ts";

const FORMS = ["pnd1a", "pnd1a_special", "pnd2", "pnd3", "pnd2a", "pnd3a", "pnd53"] as const;
const CONDITIONS = ["withhold", "always", "once", "other"] as const;
const CODE = /^(1|2|3|4a|4b1\.[1-4]|4b2\.[1-5]|5|6)$/;
const CLOSED = ["voided", "reversed"];

const d10 = (v: unknown) => v instanceof Date ? v.toISOString().slice(0, 10) : String(v || "").slice(0, 10);
const addr = (v: unknown) => (v && typeof v === "object" ? String((v as Record<string, unknown>).text || "") : String(v || ""));

async function loadDoc(sql: Tx, u: User, id: string) {
  const [d] = await sql`select d.id, d.document_type, d.document_number, d.status, d.created_by, d.subtotal, d.vat_total, d.wht_total, d.grand_total,
      d.reference, d.partner_id, p.display_name, p.legal_name, p.tax_id, p.branch_number, p.address, p.default_wht_type, p.default_wht_rate
    from finance.documents d left join finance.partners p on p.id = d.partner_id
    where d.id = ${id}::uuid and d.company_id = ${u.companyId}::uuid`;
  if (!d) fail(404, "ไม่พบคำขอเบิก");
  if (!EXPENSE_DOCS.includes(d.document_type)) fail(400, "ออกหนังสือรับรองหัก ณ ที่จ่ายได้เฉพาะเอกสารรายจ่าย");
  return d;
}
const CERT_COLS = (sql: Tx) => sql`c.id, c.document_id, c.cert_number, c.book_no, c.issue_date, c.form_type, c.seq_no, c.payer, c.payee, c.items,
  c.total_amount, c.total_tax, c.funds, c.payer_condition, c.payer_condition_other, c.note, c.status, c.void_reason, c.created_by, c.created_at, c.updated_at`;

/** ค่าเริ่มต้นของฟอร์ม: ข้อมูลบริษัท (ผู้จ่าย) + ผู้รับเงิน + ยอดจากคำขอ (เคลียร์บางส่วน = ตามสัดส่วนที่ใช้จริง) */
export async function whtDraft(url: URL, u: User) {
  need(u, "read");
  const sql = db();
  const d = await loadDoc(sql, u, uuid(url.searchParams.get("document_id"), "คำขอเบิก")!);
  await canSee(sql, u, d.created_by);
  const [co] = await sql`select legal_name, tax_id, address, branch_type, branch_number from finance.companies where id = ${u.companyId}::uuid`;
  const [clr] = await sql`select payment_date, actual_expense_amount from finance.expense_clearances where document_id = ${d.id}::uuid`;
  const lines = await sql`select description, wht_rate from finance.document_lines where document_id = ${d.id}::uuid order by line_no`;
  const grand = num(d.grand_total), exp = clr && clr.actual_expense_amount != null ? num(clr.actual_expense_amount) : grand;
  const ratio = grand > 0 && Math.abs(exp - grand) > 0.004 ? exp / grand : 1;
  const rate = num(lines[0]?.wht_rate) || num(d.default_wht_rate);
  const amount = round2(num(d.subtotal) * ratio);
  const tax = num(d.wht_total) ? round2(num(d.wht_total) * ratio) : round2(amount * rate / 100);
  const taxId = String(d.tax_id || "");
  const wt = String(d.default_wht_type || "").toLowerCase();
  const form = wt === "pnd3" ? "pnd3" : wt === "pnd53" ? "pnd53" : (/^0\d{12}$/.test(taxId) ? "pnd53" : "pnd3");
  return {
    document: { id: d.id, document_number: d.document_number, status: d.status, wht_total: num(d.wht_total) },
    draft: {
      document_id: d.id, issue_date: todayBangkok(), form_type: form, book_no: "", seq_no: "", payer_condition: "withhold", payer_condition_other: "", note: "",
      payer: { name: String(co?.legal_name || ""), tax_id: String(co?.tax_id || ""), address: addr(co?.address), branch: co?.branch_type === "branch" ? "สาขา " + (co.branch_number || "") : "สำนักงานใหญ่" },
      payee: { name: String(d.legal_name || d.display_name || d.reference || ""), tax_id: taxId, address: addr(d.address), branch: d.branch_number ? "สาขา " + d.branch_number : "" },
      items: [{ code: "5", label: lines.map((l: Record<string, unknown>) => l.description).filter(Boolean).join(", ").slice(0, 200), pay_date: clr ? d10(clr.payment_date) : todayBangkok(), amount, rate, tax }],
      funds: { gpf: 0, sso: 0, pvd: 0 },
    },
  };
}

export async function listWht(url: URL, u: User) {
  need(u, "read");
  const sql = db();
  const d = await loadDoc(sql, u, uuid(url.searchParams.get("document_id"), "คำขอเบิก")!);
  await canSee(sql, u, d.created_by);
  const items = await sql`select ${CERT_COLS(sql)} from finance.wht_certificates c where c.company_id = ${u.companyId}::uuid and c.document_id = ${d.id}::uuid order by c.created_at`;
  return { items };
}

export async function getWht(url: URL, u: User) {
  need(u, "read");
  const sql = db();
  const [c] = await sql`select ${CERT_COLS(sql)}, d.document_number, d.created_by as doc_creator, d.status as document_status
    from finance.wht_certificates c join finance.documents d on d.id = c.document_id
    where c.id = ${uuid(url.searchParams.get("id"), "หนังสือรับรอง")!}::uuid and c.company_id = ${u.companyId}::uuid`;
  if (!c) fail(404, "ไม่พบหนังสือรับรองหัก ณ ที่จ่าย");
  await canSee(sql, u, c.doc_creator);
  return { certificate: c };
}

function party(v: unknown, label: string, requireTax: boolean) {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  const name = text(o.name, 200);
  if (!name) fail(400, "กรุณากรอกชื่อ" + label);
  const tax = text(o.tax_id, 20).replace(/\D/g, "");
  if (tax && tax.length !== 13) fail(400, "เลขประจำตัวผู้เสียภาษีของ" + label + "ต้องมี 13 หลัก");
  if (requireTax && !tax) fail(400, "กรุณากรอกเลขประจำตัวผู้เสียภาษีของ" + label);
  return { name, tax_id: tax, address: text(o.address, 400), branch: text(o.branch, 60) };
}

/** บันทึก (สร้างใหม่ / แก้ไข) — ผูกกับคำขอเบิกอัตโนมัติ */
export async function saveWht(body: Record<string, unknown>, u: User, rid: string) {
  need(u, "request");
  const docId = uuid(body.document_id, "คำขอเบิก")!;
  const id = uuid(body.id, "หนังสือรับรอง", false);
  const issue = date(body.issue_date, "วันที่ออกหนังสือ");
  const form = oneOf(body.form_type, FORMS, "แบบยื่นภาษี");
  const cond = oneOf(body.payer_condition || "withhold", CONDITIONS, "ผู้จ่ายเงิน");
  const condOther = cond === "other" ? text(body.payer_condition_other, 120) : "";
  if (cond === "other" && !condOther) fail(400, "กรุณาระบุเงื่อนไขผู้จ่ายเงิน (อื่น ๆ)");
  const payer = party(body.payer, "ผู้มีหน้าที่หักภาษี (ผู้จ่ายเงิน)", true);
  const payee = party(body.payee, "ผู้ถูกหักภาษี (ผู้รับเงิน)", false);
  const raw = Array.isArray(body.items) ? body.items as Record<string, unknown>[] : [];
  if (!raw.length || raw.length > 12) fail(400, "ต้องมีรายการเงินได้ 1–12 รายการ");
  const items = raw.map((x, i) => {
    const code = text(x.code, 8);
    if (!CODE.test(code)) fail(400, "รายการที่ " + (i + 1) + ": ประเภทเงินได้ไม่ถูกต้อง");
    const amount = money(x.amount, "รายการที่ " + (i + 1) + ": จำนวนเงินที่จ่าย", { allowZero: false });
    const tax = money(x.tax ?? 0, "รายการที่ " + (i + 1) + ": ภาษีที่หัก");
    if (tax > amount) fail(400, "รายการที่ " + (i + 1) + ": ภาษีที่หักมากกว่าจำนวนเงินที่จ่าย");
    const rate = Number(x.rate || 0);
    if (!Number.isFinite(rate) || rate < 0 || rate > 100) fail(400, "รายการที่ " + (i + 1) + ": อัตราภาษีไม่ถูกต้อง");
    const label = text(x.label, 200);
    if (code === "6" && !label) fail(400, "รายการที่ " + (i + 1) + ": กรุณาระบุประเภทเงินได้ (อื่น ๆ)");
    return { code, label, pay_date: date(x.pay_date, "รายการที่ " + (i + 1) + ": วันที่จ่าย"), amount, rate: round2(rate), tax };
  });
  const totalAmount = round2(items.reduce((a, x) => a + x.amount, 0)), totalTax = round2(items.reduce((a, x) => a + x.tax, 0));
  const f = (body.funds && typeof body.funds === "object" ? body.funds : {}) as Record<string, unknown>;
  const funds = { gpf: money(f.gpf || 0, "เงินสะสม กบข./กสจ."), sso: money(f.sso || 0, "เงินสมทบประกันสังคม"), pvd: money(f.pvd || 0, "เงินกองทุนสำรองเลี้ยงชีพ") };
  return await db().begin(async (tx: Tx) => {
    const [d] = await tx`select id, document_type, document_number, status, created_by from finance.documents
      where id = ${docId}::uuid and company_id = ${u.companyId}::uuid for update`;
    if (!d) fail(404, "ไม่พบคำขอเบิก");
    if (!EXPENSE_DOCS.includes(d.document_type)) fail(400, "ออกหนังสือรับรองหัก ณ ที่จ่ายได้เฉพาะเอกสารรายจ่าย");
    if (CLOSED.includes(d.status)) fail(409, "คำขอนี้ถูกยกเลิก/กลับรายการแล้ว ออกหนังสือรับรองไม่ได้");
    await canManage(tx, u, d.created_by);
    const vals = { book: opt(body.book_no, 30), seq: opt(body.seq_no, 30), note: opt(body.note, 500) };
    let row;
    if (id) {
      const [old] = await tx`select id, status, document_id from finance.wht_certificates where id = ${id}::uuid and company_id = ${u.companyId}::uuid for update`;
      if (!old || old.document_id !== d.id) fail(404, "ไม่พบหนังสือรับรองหัก ณ ที่จ่าย");
      if (old.status !== "active") fail(409, "หนังสือฉบับนี้ถูกยกเลิกแล้ว แก้ไขไม่ได้");
      if (d.status === "posted") fail(409, "คำขอนี้ปิดงานแล้ว — แก้หนังสือรับรองไม่ได้ (ยกเลิกแล้วออกฉบับใหม่ได้โดย Owner)");
      [row] = await tx`update finance.wht_certificates set book_no = ${vals.book}, issue_date = ${issue}::date, form_type = ${form}, seq_no = ${vals.seq},
          payer = ${tx.json(payer)}, payee = ${tx.json(payee)}, items = ${tx.json(items)}, total_amount = ${totalAmount}, total_tax = ${totalTax},
          funds = ${tx.json(funds)}, payer_condition = ${cond}, payer_condition_other = ${condOther || null}, note = ${vals.note},
          updated_by = ${u.actorRef}, updated_at = now() where id = ${id}::uuid returning id, cert_number, total_amount, total_tax`;
    } else {
      const no = await nextDocNumber(tx, u, "wht_certificate", issue);
      [row] = await tx`insert into finance.wht_certificates (company_id, document_id, cert_number, book_no, issue_date, form_type, seq_no, payer, payee, items,
          total_amount, total_tax, funds, payer_condition, payer_condition_other, note, created_by)
        values (${u.companyId}::uuid, ${d.id}::uuid, ${no}, ${vals.book}, ${issue}::date, ${form}, ${vals.seq}, ${tx.json(payer)}, ${tx.json(payee)}, ${tx.json(items)},
          ${totalAmount}, ${totalTax}, ${tx.json(funds)}, ${cond}, ${condOther || null}, ${vals.note}, ${u.actorRef})
        returning id, cert_number, total_amount, total_tax`;
    }
    await audit(tx, u, id ? "update_wht_certificate" : "create_wht_certificate", "document", d.id, { ...row, document_number: d.document_number }, rid);
    return { ...row, document_id: d.id, document_number: d.document_number };
  });
}

export async function voidWht(body: Record<string, unknown>, u: User, rid: string) {
  need(u, "request");
  const id = uuid(body.id, "หนังสือรับรอง")!;
  const reason = text(body.reason, 300);
  if (!reason) fail(400, "กรุณาระบุเหตุผลที่ยกเลิก");
  return await db().begin(async (tx: Tx) => {
    const [c] = await tx`select c.id, c.status, c.cert_number, c.document_id, d.status as doc_status, d.created_by
      from finance.wht_certificates c join finance.documents d on d.id = c.document_id
      where c.id = ${id}::uuid and c.company_id = ${u.companyId}::uuid for update of c`;
    if (!c) fail(404, "ไม่พบหนังสือรับรองหัก ณ ที่จ่าย");
    if (c.status !== "active") fail(409, "หนังสือฉบับนี้ถูกยกเลิกแล้ว");
    await canManage(tx, u, c.created_by);
    if (c.doc_status === "posted" && !["owner", "approver"].includes(u.role)) fail(403, "คำขอนี้ปิดงานแล้ว — ให้ Owner เป็นผู้ยกเลิก");
    const [out] = await tx`update finance.wht_certificates set status = 'voided', void_reason = ${reason}, voided_by = ${u.actorRef}, voided_at = now(), updated_at = now()
      where id = ${id}::uuid returning id, cert_number, status`;
    await audit(tx, u, "void_wht_certificate", "document", c.document_id, { ...out, reason }, rid);
    return out;
  });
}
