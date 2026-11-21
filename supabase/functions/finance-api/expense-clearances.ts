// เบิก–เคลียร์ค่าใช้จ่าย: เอกสารรายจ่ายฉบับเดียวตลอดทาง (ไม่สร้างเอกสารซ้ำ)
// คำขอ → Owner อนุมัติวงเงิน (ยังไม่ลงบัญชี) → บันทึกจ่ายเงิน + หลักฐาน → เคลียร์ (ค่าใช้จ่ายจริง / เงินคืน)
// → Owner ตรวจเคลียร์ (ส่งกลับได้) → ผู้ตรวจสุดท้าย (ส่งกลับได้) → ปิดงาน = ลงบัญชี + ภาษี + รายงาน/แดชบอร์ดอัปเดต
import { approvalEvent, audit, date, db, fail, money, num, oneOf, opt, round2, text, Tx, uuid } from "./util.ts";
import { makerChecker, need, User } from "./auth.ts";
import { EXPENSE_DOCS, postEntry, sysAccount, accountByCode, accountById, Line } from "./posting.ts";

const METHODS = ["cash", "bank_transfer", "credit_card", "cheque", "other"] as const;
const EDITABLE = ["draft", "returned"];

// Manager เห็น/จัดการได้เฉพาะคำขอของคนในสาขาเดียวกัน · Staff เฉพาะของตัวเอง · Owner/Approver ทั้งบริษัท
export async function canManage(sql: Tx, u: User, creator: string) {
  if (creator === u.actorRef || ["owner", "approver"].includes(u.role)) return;
  if (u.role === "manager") {
    const [scope] = await sql`select 1 from public.staff ms
      join public.staff rs on rs.cms_ref = ${creator} and rs.is_active = true
      where ms.cms_ref = ${u.actorRef} and ms.is_active = true and ms.branch_id = rs.branch_id limit 1`;
    if (scope) return;
  }
  fail(403, "ไม่มีสิทธิ์จัดการรายการนี้ หรือรายการอยู่นอกสาขาที่รับผิดชอบ");
}
export async function canSee(sql: Tx, u: User, creator: string) {
  if (!["staff", "manager"].includes(u.role)) return;   // owner/approver/accountant/viewer/verifier เห็นทั้งบริษัท
  await canManage(sql, u, creator);
}
// สิทธิ์ตามสาขาสำหรับใช้ใน where (Manager / Staff) — ตารางเอกสารต้องใช้ชื่อ d
export function scopeSql(sql: Tx, u: User) {
  return sql`(${u.role} not in ('staff','manager')
    or (${u.role} = 'staff' and d.created_by = ${u.actorRef})
    or (${u.role} = 'manager' and (d.created_by = ${u.actorRef} or exists (select 1 from public.staff ms
      join public.staff rs on rs.cms_ref = d.created_by and rs.is_active = true
      where ms.cms_ref = ${u.actorRef} and ms.is_active = true and ms.branch_id = rs.branch_id))))`;
}

export async function listClearances(url: URL, u: User) {
  need(u, "read");
  const status = text(url.searchParams.get("status"), 32);
  const sql = db();
  const rows = await sql`select c.*, d.document_number, d.document_date, d.document_type, d.grand_total as requested_amount,
      d.created_by as requester, d.status as document_status,
      (select count(*)::int from finance.document_files f where f.company_id = c.company_id and f.clearance_id = c.id and f.deleted_at is null) as file_count
    from finance.expense_clearances c join finance.documents d on d.id = c.document_id
    where c.company_id = ${u.companyId}::uuid and ${scopeSql(sql, u)}
      and (${status} = '' or c.status = ${status})
    order by c.updated_at desc limit 200`;
  return { items: rows };
}

async function checkAccount(tx: Tx, u: User, id: string | null, types: string[], label: string) {
  if (!id) return null;
  const acc = await accountById(tx, u, id, types);
  if (!acc) fail(400, label + " ไม่ถูกต้อง");
  return String(acc.id);
}
const methodTypes = (m: string) => m === "credit_card" ? ["liability"] : m === "other" ? ["asset", "liability"] : ["asset"];

/** บันทึกการจ่ายเงิน + ผลการเคลียร์ · submit=false = บันทึกร่าง (แนบไฟล์ต่อได้) · submit=true = ส่งให้ Owner ตรวจ */
export async function submitClearance(body: Record<string, unknown>, u: User, rid: string) {
  need(u, "request");
  const submit = body.submit !== false;
  const documentId = uuid(body.document_id, "เอกสารเบิก")!;
  const paid = money(body.actual_paid_amount ?? body.actual_amount, "ยอดที่จ่ายจริง", { allowZero: false });
  const expense = money(body.actual_expense_amount ?? paid, "ค่าใช้จ่ายจริง", { allowZero: false });
  if (expense > paid + 0.004) fail(400, "ค่าใช้จ่ายจริงมากกว่ายอดที่จ่าย — ถ้าใช้เกินวงเงิน ให้ทำคำขอเบิกเพิ่ม");
  const refund = round2(paid - expense);
  if (body.refund_amount !== undefined && body.refund_amount !== null && body.refund_amount !== "" &&
      Math.abs(round2(Number(body.refund_amount)) - refund) > 0.004) fail(400, "ยอดคืนเงินต้องเท่ากับ ยอดที่จ่าย − ค่าใช้จ่ายจริง");
  const paidOn = date(body.payment_date, "วันที่จ่ายเงิน");
  const method = oneOf(body.payment_method, METHODS, "ช่องทางจ่าย");
  const payAccIn = uuid(body.payment_account_id, "บัญชีที่จ่าย", false);
  const refundAccIn = uuid(body.refund_account_id, "บัญชีรับเงินคืน", false);
  if (["credit_card", "other"].includes(method) && !payAccIn) fail(400, "บัตรเครดิต/ช่องทางอื่น ต้องเลือกบัญชีที่ใช้จ่าย");
  return await db().begin(async (tx: Tx) => {
    const payAcc = await checkAccount(tx, u, payAccIn, methodTypes(method), "บัญชีที่จ่าย");
    const refundAcc = await checkAccount(tx, u, refundAccIn, ["asset"], "บัญชีรับเงินคืน");
    const [doc] = await tx`select id, document_type, document_number, status, created_by, grand_total from finance.documents
      where id = ${documentId}::uuid and company_id = ${u.companyId}::uuid for update`;
    if (!doc) fail(404, "ไม่พบเอกสารเบิก");
    if (!EXPENSE_DOCS.includes(doc.document_type)) fail(400, "เอกสารนี้ไม่ใช่เอกสารรายจ่าย");
    if (doc.status !== "approved") fail(409, "ต้องให้ Owner อนุมัติคำขอเบิกก่อน จึงจะบันทึกจ่าย/เคลียร์ได้");
    await canManage(tx, u, doc.created_by);
    if (paid > Number(doc.grand_total) + 0.004) fail(400, "ยอดที่จ่ายเกินวงเงินที่ Owner อนุมัติ (" + Number(doc.grand_total).toLocaleString("th-TH", { minimumFractionDigits: 2 }) + " บาท)");
    const [ex] = await tx`select * from finance.expense_clearances where document_id = ${documentId}::uuid for update`;
    if (ex && !EDITABLE.includes(ex.status)) fail(409, "ส่งเคลียร์แล้ว แก้ไขไม่ได้ (ถ้าต้องแก้ ให้ผู้ตรวจส่งกลับ)");
    let status = ex ? ex.status : "draft", keepOwner = false;
    if (submit) {
      if (!ex) fail(409, "กรุณาบันทึกร่างและแนบหลักฐานการจ่ายเงินก่อนส่งเคลียร์");
      const [ev] = await tx`select count(*)::int n from finance.document_files
        where company_id = ${u.companyId}::uuid and clearance_id = ${ex.id}::uuid and deleted_at is null and file_category = 'payment_evidence'`;
      if (Number(ev.n) < 1) fail(409, "กรุณาแนบหลักฐานการจ่ายเงิน (สลิป/ใบเสร็จ) อย่างน้อย 1 ไฟล์");
      // ผู้ตรวจสุดท้ายส่งกลับ + ยอดเท่าเดิม → กลับไปผู้ตรวจสุดท้ายโดยตรง (Owner อนุมัติยอดนี้แล้ว) · ยอดเปลี่ยน → Owner ตรวจใหม่
      keepOwner = ex.status === "returned" && ex.returned_stage === "verifier" && !!ex.owner_approved_by &&
        Math.abs(num(ex.actual_paid_amount) - paid) < 0.005 && Math.abs(num(ex.actual_expense_amount) - expense) < 0.005;
      status = keepOwner ? "owner_approved" : "pending_owner_review";
    }
    const vals = { paid, expense, refund, payAcc, refundAcc, paidOn, method, ref: opt(body.reference_number, 120), notes: opt(body.notes, 1000) };
    let row;
    if (ex) {
      [row] = await tx`update finance.expense_clearances set actual_amount = ${vals.paid}, actual_paid_amount = ${vals.paid},
        actual_expense_amount = ${vals.expense}, refund_amount = ${vals.refund}, payment_account_id = ${vals.payAcc}::uuid,
        refund_account_id = ${vals.refundAcc}::uuid, payment_date = ${vals.paidOn}::date, payment_method = ${vals.method},
        reference_number = ${vals.ref}, notes = ${vals.notes}, status = ${status}, updated_at = now(),
        submitted_by = ${submit ? u.actorRef : ex.submitted_by}, submitted_at = ${submit ? new Date().toISOString() : ex.submitted_at},
        owner_approved_by = ${submit && !keepOwner ? null : ex.owner_approved_by}, owner_approved_at = ${submit && !keepOwner ? null : ex.owner_approved_at},
        returned_stage = ${submit ? null : ex.returned_stage}
        where id = ${ex.id}::uuid returning *`;
    } else {
      [row] = await tx`insert into finance.expense_clearances
        (company_id, document_id, actual_amount, actual_paid_amount, actual_expense_amount, refund_amount, payment_account_id, refund_account_id,
         payment_date, payment_method, reference_number, notes, status, submitted_by)
        values (${u.companyId}::uuid, ${documentId}::uuid, ${vals.paid}, ${vals.paid}, ${vals.expense}, ${vals.refund}, ${vals.payAcc}::uuid, ${vals.refundAcc}::uuid,
         ${vals.paidOn}::date, ${vals.method}, ${vals.ref}, ${vals.notes}, 'draft', ${u.actorRef}) returning *`;
    }
    if (submit) await approvalEvent(tx, u, "expense_clearance", row.id, keepOwner ? "resubmitted_to_verifier" : "submitted", null, rid);
    await audit(tx, u, submit ? "submit_expense_clearance" : "save_expense_clearance", "expense_clearance", row.id, row, rid);
    return { ...row, next_step: submit ? (keepOwner ? "final_verification" : "owner_review") : "attach_and_submit" };
  });
}

export async function approveClearance(body: Record<string, unknown>, u: User, rid: string) {
  need(u, "approve");
  const id = uuid(body.clearance_id, "รายการเคลียร์")!;
  return await db().begin(async (tx: Tx) => {
    const [c] = await tx`select c.* from finance.expense_clearances c where c.id = ${id}::uuid and c.company_id = ${u.companyId}::uuid for update`;
    if (!c) fail(404, "ไม่พบรายการเคลียร์");
    if (c.status !== "pending_owner_review") fail(409, "รายการนี้ไม่ได้รอ Owner ตรวจเคลียร์");
    const self = makerChecker(u, c.submitted_by);
    const [out] = await tx`update finance.expense_clearances set status = 'owner_approved', owner_approved_by = ${u.actorRef},
      owner_approved_at = now(), returned_stage = null, updated_at = now() where id = ${id}::uuid returning *`;
    await approvalEvent(tx, u, "expense_clearance", id, "owner_approved", self ? "อนุมัติรายการของตนเอง" : opt(body.note, 500), rid);
    await audit(tx, u, self ? "approve_self_expense_clearance" : "approve_expense_clearance", "expense_clearance", id, out, rid);
    return { ...out, next_step: "final_verification" };
  });
}

async function sendBack(body: Record<string, unknown>, u: User, rid: string, stage: "owner" | "verifier") {
  const id = uuid(body.clearance_id, "รายการเคลียร์")!;
  const note = text(body.note, 500);
  if (!note) fail(400, "กรุณาระบุเหตุผลที่ส่งกลับ");
  return await db().begin(async (tx: Tx) => {
    const [c] = await tx`select c.*, d.created_by from finance.expense_clearances c join finance.documents d on d.id = c.document_id
      where c.id = ${id}::uuid and c.company_id = ${u.companyId}::uuid for update of c`;
    if (!c) fail(404, "ไม่พบรายการเคลียร์");
    const want = stage === "owner" ? "pending_owner_review" : "owner_approved";
    if (c.status !== want) fail(409, stage === "owner" ? "ส่งกลับได้เฉพาะรายการที่รอ Owner ตรวจ" : "ส่งกลับได้เฉพาะรายการที่รอผู้ตรวจสุดท้าย");
    if (stage === "verifier" && [c.created_by, c.submitted_by, c.owner_approved_by].filter(Boolean).includes(u.actorRef))
      fail(403, "ผู้สร้าง ผู้ส่งเคลียร์ หรือ Owner ผู้อนุมัติ ไม่สามารถเป็นผู้ตรวจสุดท้ายของรายการเดียวกัน");
    const [out] = await tx`update finance.expense_clearances set status = 'returned', returned_stage = ${stage}, returned_by = ${u.actorRef},
      returned_at = now(), return_note = ${note}, updated_at = now(),
      owner_approved_by = ${stage === "owner" ? null : c.owner_approved_by}, owner_approved_at = ${stage === "owner" ? null : c.owner_approved_at}
      where id = ${id}::uuid returning *`;
    await approvalEvent(tx, u, "expense_clearance", id, stage === "owner" ? "returned" : "verifier_returned", note, rid);
    await audit(tx, u, stage === "owner" ? "return_expense_clearance" : "verifier_return_expense_clearance", "expense_clearance", id, out, rid);
    return { ...out, next_step: "manager_correct" };
  });
}
export async function returnClearance(body: Record<string, unknown>, u: User, rid: string) { need(u, "approve"); return sendBack(body, u, rid, "owner"); }
export async function verifierReturnClearance(body: Record<string, unknown>, u: User, rid: string) { need(u, "verify"); return sendBack(body, u, rid, "verifier"); }

// แบ่งยอดตามสัดส่วน (เศษสตางค์ไปบรรทัดสุดท้าย)
function allocate(total: number, weights: number[]) {
  const sum = weights.reduce((a, w) => a + w, 0) || 1;
  let left = round2(total);
  return weights.map((w, i) => {
    if (i === weights.length - 1) return round2(left);
    const v = round2(total * w / sum); left = round2(left - v); return v;
  });
}

/** ผู้ตรวจสุดท้ายยืนยัน = ปิดงาน: ลงบัญชีค่าใช้จ่ายจริง (เคลียร์บางส่วน/มีเงินคืน ได้) + ภาษีซื้อ/หัก ณ ที่จ่ายตามสัดส่วน */
export async function verifyClearance(body: Record<string, unknown>, u: User, rid: string) {
  need(u, "verify");
  if (body.confirm_complete !== true) fail(400, "กรุณาติ๊กยืนยันว่าตรวจเอกสารและหลักฐานครบถ้วนแล้ว");
  const id = uuid(body.clearance_id, "รายการเคลียร์")!;
  return await db().begin(async (tx: Tx) => {
    const [c] = await tx`select c.*, d.id as doc_id, d.document_type, d.document_number, d.status as doc_status, d.created_by,
      d.partner_id, d.subtotal, d.vat_total, d.wht_total, d.grand_total, p.default_wht_type, p.display_name as partner_name
      from finance.expense_clearances c join finance.documents d on d.id = c.document_id
      left join finance.partners p on p.id = d.partner_id
      where c.id = ${id}::uuid and c.company_id = ${u.companyId}::uuid for update of c, d`;
    if (!c) fail(404, "ไม่พบรายการเคลียร์");
    if (c.status === "verified") fail(409, "รายการนี้ปิดงานแล้ว");
    if (c.status !== "owner_approved") fail(409, "รายการนี้ยังไม่ผ่าน Owner ตรวจเคลียร์");
    if (c.doc_status !== "approved") fail(409, "สถานะเอกสารเบิกไม่ถูกต้อง");
    if ([c.created_by, c.submitted_by, c.owner_approved_by].filter(Boolean).includes(u.actorRef))
      fail(403, "ผู้สร้าง ผู้ส่งเคลียร์ หรือ Owner ผู้อนุมัติ ไม่สามารถเป็นผู้ตรวจสุดท้ายของรายการเดียวกัน");
    const [ev] = await tx`select count(*)::int n from finance.document_files
      where company_id = ${u.companyId}::uuid and clearance_id = ${id}::uuid and deleted_at is null and file_category = 'payment_evidence'`;
    if (Number(ev.n) < 1) fail(409, "ต้องมีหลักฐานการจ่ายเงินอย่างน้อย 1 ไฟล์");
    const lines = await tx`select * from finance.document_lines where document_id = ${c.doc_id}::uuid order by line_no`;
    if (!lines.length) fail(409, "ไม่พบรายละเอียดค่าใช้จ่ายสำหรับลงบัญชี");

    const grand = round2(num(c.grand_total)), paid = round2(num(c.actual_paid_amount ?? c.actual_amount));
    const expense = round2(num(c.actual_expense_amount ?? paid)), refund = round2(paid - expense);
    const full = Math.abs(expense - grand) < 0.005;
    const ratio = grand > 0 ? expense / grand : 1;
    const vat = full ? round2(num(c.vat_total)) : round2(num(c.vat_total) * ratio);
    const wht = full ? round2(num(c.wht_total)) : round2(num(c.wht_total) * ratio);
    const base = round2(expense - vat + wht);   // มูลค่าก่อนภาษีที่ใช้จริง
    if (base <= 0) fail(409, "คำนวณมูลค่าค่าใช้จ่ายไม่ได้ กรุณาตรวจยอด");
    const claimVat = u.vatRegistered && vat > 0;
    const weights = lines.map((l: Record<string, unknown>) => num(l.line_total));
    const baseParts = allocate(base, weights), vatParts = allocate(claimVat ? 0 : vat, weights);
    const desc = String(c.document_number) + (c.partner_name ? " · " + c.partner_name : "");
    const defExp = await sysAccount(tx, u, "expense");
    const jl: Line[] = [];
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      const acc = l.account_code ? await accountByCode(tx, u, String(l.account_code), ["expense", "asset"]) : defExp;
      jl.push({ account_id: acc, debit: round2(baseParts[i] + vatParts[i]), credit: 0, description: l.description, partner_id: c.partner_id });
    }
    if (claimVat) jl.push({ account_id: await sysAccount(tx, u, "vat_input"), debit: vat, credit: 0, description: desc });
    const defKey = c.payment_method === "bank_transfer" || c.payment_method === "cheque" ? "bank" : c.payment_method === "cash" ? "cash" : null;
    const payAccOpt = c.payment_account_id ? String(c.payment_account_id) : defKey ? await sysAccount(tx, u, defKey) : null;
    if (!payAccOpt) fail(409, "ยังไม่ได้เลือกบัญชีที่ใช้จ่ายสำหรับช่องทางนี้ ให้ผู้เบิกแก้ไขรายการ");
    const payAcc = String(payAccOpt);
    if (refund > 0) {
      const refundAcc = String(c.refund_account_id ? c.refund_account_id : c.payment_method === "cash" || !defKey ? await sysAccount(tx, u, "cash") : payAcc);
      jl.push({ account_id: refundAcc, debit: refund, credit: 0, description: "รับเงินคืน " + desc });
    }
    jl.push({ account_id: payAcc, debit: 0, credit: paid, description: desc, partner_id: c.partner_id });
    if (wht > 0) jl.push({ account_id: await sysAccount(tx, u, "wht_payable"), debit: 0, credit: wht, description: desc, partner_id: c.partner_id });
    const pd = c.payment_date instanceof Date ? c.payment_date.toISOString().slice(0, 10) : String(c.payment_date).slice(0, 10);
    const je = await postEntry(tx, u, { date: pd, description: "เคลียร์ค่าใช้จ่าย " + desc, source_type: "expense_clearance", source_document_id: c.doc_id, created_by: c.created_by, lines: jl });

    const tp = pd.slice(0, 7);
    if (claimVat) await tx`insert into finance.tax_transactions
      (company_id, document_id, tax_type, tax_period, tax_base, tax_rate, tax_amount, counterparty_id, tax_form_code, status)
      values (${u.companyId}::uuid, ${c.doc_id}::uuid, 'vat_input', ${tp}, ${base}, ${num(lines[0].vat_rate)}, ${vat}, ${c.partner_id}::uuid, 'PP30', 'reviewed')
      on conflict (document_id, tax_type, tax_period) do update set tax_base = excluded.tax_base, tax_amount = excluded.tax_amount, status = 'reviewed'`;
    if (wht > 0) await tx`insert into finance.tax_transactions
      (company_id, document_id, tax_type, tax_period, tax_base, tax_rate, tax_amount, counterparty_id, tax_form_code, status)
      values (${u.companyId}::uuid, ${c.doc_id}::uuid, 'wht', ${tp}, ${base}, ${num(lines[0].wht_rate)}, ${wht}, ${c.partner_id}::uuid,
        ${String(c.default_wht_type || "").toLowerCase() === "pnd3" ? "PND3" : "PND53"}, 'reviewed')
      on conflict (document_id, tax_type, tax_period) do update set tax_base = excluded.tax_base, tax_amount = excluded.tax_amount, tax_form_code = excluded.tax_form_code, status = 'reviewed'`;
    const [doc] = await tx`update finance.documents set status = 'posted', posted_at = now()
      where id = ${c.doc_id}::uuid and status = 'approved' returning id, document_number, status, grand_total, posted_at`;
    const [out] = await tx`update finance.expense_clearances set status = 'verified', verified_by = ${u.actorRef}, verified_at = now(),
      journal_entry_id = ${je.id}::uuid, updated_at = now() where id = ${id}::uuid and status = 'owner_approved' returning *`;
    await approvalEvent(tx, u, "expense_clearance", id, "verified", "ตรวจครบถ้วน ปิดงานและลงบัญชีแล้ว", rid);
    await audit(tx, u, "verify_and_post_expense_clearance", "expense_clearance", id, { clearance: out, document: doc, journal: je.journal_number, expense, refund, vat, wht }, rid);
    return { clearance: out, document: doc, journal_number: je.journal_number, journal_id: je.id, accounting_posted: true, expense, refund, vat, wht };
  });
}

// ---------- ไฟล์หลักฐาน (private Storage, ลิงก์เปิดอายุ 2 นาที) ----------
const BUCKET = "finance-private-documents";
const MAX_BYTES = 20 * 1024 * 1024;
const MIME = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);
export function storage() {
  const base = (Deno.env.get("SUPABASE_URL") || "").replace(/\/$/, ""), key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!base || !key) fail(503, "ระบบจัดเก็บเอกสารยังไม่ได้ตั้งค่า");
  return { base, key };
}
const enc = (path: string) => path.split("/").map(encodeURIComponent).join("/");
export const safeName = (name: string) => String(name || "document").normalize("NFKC").replace(/[^\p{L}\p{N}._-]+/gu, "_").replace(/^\.+/, "").slice(0, 100) || "document";

export async function signedUrl(bucket: string, path: string) {
  const { base, key } = storage();
  const res = await fetch(`${base}/storage/v1/object/sign/${bucket}/${enc(path)}`, {
    method: "POST", headers: { apikey: key, Authorization: `Bearer ${key}`, "content-type": "application/json" }, body: JSON.stringify({ expiresIn: 120 }) });
  if (!res.ok) fail(502, "สร้างลิงก์เปิดเอกสารไม่สำเร็จ");
  const data = await res.json(); const s = String(data.signedURL || data.signedUrl || "");
  if (!s) fail(502, "ระบบไม่ส่งลิงก์เอกสารกลับมา");
  return s.startsWith("http") ? s : base + (s.startsWith("/storage/") ? s : "/storage/v1" + s);
}

/** เก็บไฟล์ลง Storage แล้วบันทึกแถว document_files (ล้มเหลว = ลบไฟล์ทิ้ง) */
export async function storeFile(u: User, rid: string, file: File, category: string, link: { clearance_id?: string; document_id?: string }, auditEntity: string, auditId: string) {
  if (file.size < 1 || file.size > MAX_BYTES) fail(400, "ไฟล์ต้องมีขนาดไม่เกิน 20 MB");
  if (!MIME.has(file.type)) fail(400, "รองรับเฉพาะ PDF, JPG, PNG และ WEBP");
  const { base, key } = storage();
  const folder = link.clearance_id ? "expense-clearance/" + link.clearance_id : "expense-request/" + link.document_id;
  const path = `${u.companyId}/${folder}/${crypto.randomUUID()}-${safeName(file.name)}`;
  const up = await fetch(`${base}/storage/v1/object/${BUCKET}/${enc(path)}`, { method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "content-type": file.type, "x-upsert": "false" }, body: new Uint8Array(await file.arrayBuffer()) });
  if (!up.ok) fail(502, "อัปโหลดไฟล์ไม่สำเร็จ กรุณาลองใหม่");
  try {
    return await db().begin(async (tx: Tx) => {
      const [row] = await tx`insert into finance.document_files (company_id, clearance_id, document_id, storage_bucket, object_path, original_name, mime_type, size_bytes, uploaded_by, file_category)
        values (${u.companyId}::uuid, ${link.clearance_id || null}::uuid, ${link.document_id || null}::uuid, ${BUCKET}, ${path}, ${String(file.name || "document").slice(0, 255)},
          ${file.type}, ${file.size}, ${u.actorRef}, ${category})
        returning id, clearance_id, document_id, file_category, original_name, mime_type, size_bytes, created_at`;
      await audit(tx, u, "upload_file", auditEntity, auditId, row, rid);
      return row;
    });
  } catch (e) {
    await fetch(`${base}/storage/v1/object/${BUCKET}`, { method: "DELETE", headers: { apikey: key, Authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({ prefixes: [path] }) }).catch(() => null);
    throw e;
  }
}

export async function listClearanceFiles(url: URL, u: User) {
  need(u, "read");
  const id = uuid(url.searchParams.get("clearance_id"), "รายการเคลียร์")!;
  const sql = db();
  const [c] = await sql`select c.id, d.created_by from finance.expense_clearances c join finance.documents d on d.id = c.document_id
    where c.id = ${id}::uuid and c.company_id = ${u.companyId}::uuid`;
  if (!c) fail(404, "ไม่พบรายการเคลียร์");
  await canSee(sql, u, c.created_by);
  const items = await sql`select id, file_category, original_name, mime_type, size_bytes, created_at, uploaded_by
    from finance.document_files where company_id = ${u.companyId}::uuid and clearance_id = ${id}::uuid and deleted_at is null order by created_at desc`;
  return { items };
}

// ไฟล์ของคำขอเบิก (document_id) หรือของรายการเคลียร์ (clearance_id)
export async function clearanceFileUrl(url: URL, u: User) {
  need(u, "read");
  const fileId = uuid(url.searchParams.get("file_id"), "ไฟล์")!;
  const sql = db();
  const [f] = await sql`select f.storage_bucket, f.object_path, coalesce(d1.created_by, d2.created_by) as created_by
    from finance.document_files f
    left join finance.expense_clearances c on c.id = f.clearance_id and c.company_id = f.company_id
    left join finance.documents d1 on d1.id = c.document_id
    left join finance.documents d2 on d2.id = f.document_id and d2.company_id = f.company_id
    where f.id = ${fileId}::uuid and f.company_id = ${u.companyId}::uuid and f.deleted_at is null
      and (f.clearance_id is not null or f.document_id is not null)`;
  if (!f) fail(404, "ไม่พบไฟล์");
  await canSee(sql, u, f.created_by);
  return { url: await signedUrl(f.storage_bucket, String(f.object_path)) };
}

export async function uploadClearanceFile(form: FormData, u: User, rid: string) {
  need(u, "request");
  const id = uuid(form.get("clearance_id"), "รายการเคลียร์")!;
  const category = oneOf(form.get("category"), ["payment_evidence", "receipt_invoice", "tax_invoice", "wht_document", "supporting", "refund_evidence"] as const, "ประเภทเอกสาร");
  const file = form.get("file"); if (!(file instanceof File)) fail(400, "กรุณาเลือกไฟล์เอกสาร");
  const sql = db();
  const [c] = await sql`select c.id, c.status, d.created_by from finance.expense_clearances c join finance.documents d on d.id = c.document_id
    where c.id = ${id}::uuid and c.company_id = ${u.companyId}::uuid`;
  if (!c) fail(404, "ไม่พบรายการเคลียร์");
  await canManage(sql, u, c.created_by);
  if (!EDITABLE.includes(c.status)) fail(409, "ส่งเคลียร์แล้ว เพิ่มหลักฐานไม่ได้ (ถ้าต้องเพิ่ม ให้ผู้ตรวจส่งกลับ)");
  return await storeFile(u, rid, file as File, category, { clearance_id: id }, "expense_clearance", id);
}
