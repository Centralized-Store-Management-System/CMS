// หน้า "เบิก–เคลียร์ค่าใช้จ่าย": รายการตามขั้นตอน + งานที่ต้องทำของแต่ละบทบาท + รายละเอียดครบในที่เดียว
import { audit, db, fail, oneOf, text, Tx, uuid } from "./util.ts";
import { CAN, need, User } from "./auth.ts";
import { EXPENSE_DOCS } from "./posting.ts";
import { canManage, canSee, scopeSql, storeFile } from "./expense-clearances.ts";

// ขั้นตอน (ตรงกับแผนภาพ): ร่าง → รอ Owner อนุมัติคำขอ → รอบันทึกจ่าย/เคลียร์ → รอ Owner ตรวจเคลียร์ → รอผู้ตรวจสุดท้าย → ปิดงาน
export const STAGES = ["draft", "request_review", "to_clear", "clear_review", "verify", "closed", "cancelled"] as const;
type Row = Record<string, any>;

function stageOf(r: Row) {
  if (["void", "reversed"].includes(r.status)) return "cancelled";
  if (r.status === "posted") return "closed";
  if (r.status === "pending_review") return "request_review";
  if (r.status === "draft") return "draft";
  if (r.status === "approved") {
    if (r.c_status === "pending_owner_review") return "clear_review";
    if (r.c_status === "owner_approved") return "verify";
    return "to_clear";   // ยังไม่บันทึก / ร่าง / ถูกส่งกลับ
  }
  return "draft";
}
const can = (u: User, cap: keyof typeof CAN) => (CAN[cap] as readonly string[]).includes(u.role);
function mine(u: User, r: Row) {
  const st = stageOf(r);
  const own = r.created_by === u.actorRef;
  const scoped = own || ["manager", "staff"].includes(u.role) || u.role === "approver";   // รายการที่ query มาแล้วผ่านสิทธิ์สาขาแล้ว
  if ((st === "draft" || st === "to_clear") && can(u, "request") && scoped && (u.role !== "owner" || own)) return true;
  if ((st === "request_review" || st === "clear_review") && can(u, "approve")) {
    const maker = st === "request_review" ? r.created_by : r.c_submitted_by;
    return maker !== u.actorRef || u.allowSelfApproval === true;
  }
  if (st === "verify" && can(u, "verify")) return ![r.created_by, r.c_submitted_by, r.c_owner_approved_by].includes(u.actorRef);
  return false;
}

const ROW_SQL = (sql: Tx, u: User) => sql`
  select d.id, d.document_type, d.document_number, d.document_date, d.status, d.grand_total, d.created_by, d.created_at, d.notes,
    coalesce(p.display_name, d.reference) as payee,
    (select l.description from finance.document_lines l where l.document_id = d.id order by l.line_no limit 1) as title,
    c.id as c_id, c.status as c_status, c.returned_stage as c_returned_stage, c.return_note as c_return_note,
    c.actual_paid_amount as c_paid, c.actual_expense_amount as c_expense, c.refund_amount as c_refund,
    c.submitted_by as c_submitted_by, c.owner_approved_by as c_owner_approved_by, c.updated_at as c_updated_at,
    (select e.note from finance.approval_events e where e.company_id = d.company_id and e.entity_type = 'document' and e.entity_id = d.id
       and e.action = 'returned' order by e.created_at desc limit 1) as request_return_note,
    (select e.action from finance.approval_events e where e.company_id = d.company_id and e.entity_type = 'document' and e.entity_id = d.id
       order by e.created_at desc limit 1) as last_doc_action,
    coalesce(cr.display_name, d.created_by) as created_by_name,
    greatest(d.created_at, coalesce(c.updated_at, d.created_at)) as touched_at
  from finance.documents d
  left join finance.expense_clearances c on c.document_id = d.id
  left join finance.partners p on p.id = d.partner_id
  left join finance.user_roles cr on cr.company_id = d.company_id and cr.cms_actor_ref = d.created_by
  where d.company_id = ${u.companyId}::uuid and d.document_type = any(${EXPENSE_DOCS}) and ${scopeSql(sql, u)}`;

function shape(u: User, r: Row) {
  const stage = stageOf(r);
  const returned = (stage === "draft" && r.last_doc_action === "returned") ? "owner_request"
    : (stage === "to_clear" && r.c_status === "returned") ? (r.c_returned_stage === "verifier" ? "verifier" : "owner_clear") : null;
  return {
    id: r.id, document_number: r.document_number, document_date: r.document_date, document_type: r.document_type, title: r.title, payee: r.payee,
    amount: Number(r.grand_total), status: r.status, stage, returned,
    return_note: returned === "owner_request" ? r.request_return_note : returned ? r.c_return_note : null,
    clearance: r.c_id ? { id: r.c_id, status: r.c_status, paid: Number(r.c_paid || 0), expense: Number(r.c_expense || 0), refund: Number(r.c_refund || 0) } : null,
    created_by: r.created_by, created_by_name: r.created_by_name, touched_at: r.touched_at, my_action: mine(u, r),
  };
}

export async function listFlow(url: URL, u: User) {
  need(u, "read");
  const tab = text(url.searchParams.get("tab"), 12) || "todo";
  const q = text(url.searchParams.get("q"), 80).toLowerCase();
  const sql = db();
  const rows = await sql`select * from (${ROW_SQL(sql, u)}) x order by touched_at desc limit 400`;
  const all = rows.map((r: Row) => shape(u, r));
  const counts: Record<string, number> = { todo: 0 };
  for (const s of STAGES) counts[s] = 0;
  for (const it of all) { counts[it.stage]++; if (it.my_action) counts.todo++; }
  let items = all;
  if (tab === "todo") items = all.filter(i => i.my_action);
  else if ((STAGES as readonly string[]).includes(tab)) items = all.filter(i => i.stage === tab);
  else if (tab === "open") items = all.filter(i => !["closed", "cancelled"].includes(i.stage));
  if (q) items = items.filter(i => [i.document_number, i.title, i.payee, i.created_by_name].some(v => String(v || "").toLowerCase().includes(q)));
  return { items: items.slice(0, 200), counts, role: u.role };
}

export async function getFlowItem(url: URL, u: User) {
  need(u, "read");
  const id = uuid(url.searchParams.get("id"), "เอกสาร")!;
  const sql = db();
  const [r] = await sql`select * from (${ROW_SQL(sql, u)}) x where x.id = ${id}::uuid`;
  if (!r) {
    const [exists] = await sql`select 1 from finance.documents where id = ${id}::uuid and company_id = ${u.companyId}::uuid`;
    fail(exists ? 403 : 404, exists ? "รายการนี้อยู่นอกสิทธิ์/สาขาที่รับผิดชอบ" : "ไม่พบคำขอเบิก");
  }
  const it = shape(u, r);
  const [doc] = await sql`select d.id, d.document_type, d.document_number, d.document_date, d.status, d.subtotal, d.vat_total, d.wht_total, d.grand_total,
      d.reference, d.notes, d.partner_id, d.created_by, d.submitted_by, d.approved_by, d.posted_at, p.display_name as partner_name
    from finance.documents d left join finance.partners p on p.id = d.partner_id where d.id = ${id}::uuid`;
  const lines = await sql`select line_no, description, quantity, unit_price, vat_rate, vat_amount, wht_rate, wht_amount, account_code, line_total
    from finance.document_lines where document_id = ${id}::uuid order by line_no`;
  const [clr] = await sql`select c.*, je.journal_number, pa.account_code as payment_account_code, pa.account_name as payment_account_name
    from finance.expense_clearances c
    left join finance.journal_entries je on je.id = c.journal_entry_id
    left join finance.chart_of_accounts pa on pa.id = c.payment_account_id
    where c.document_id = ${id}::uuid`;
  const files = await sql`select f.id, f.file_category, f.original_name, f.mime_type, f.size_bytes, f.created_at, f.uploaded_by,
      case when f.clearance_id is not null then 'clearance' else 'request' end as stage
    from finance.document_files f
    where f.company_id = ${u.companyId}::uuid and f.deleted_at is null
      and (f.document_id = ${id}::uuid or (${clr ? clr.id : null}::uuid is not null and f.clearance_id = ${clr ? clr.id : null}::uuid))
    order by f.created_at`;
  const events = await sql`select e.entity_type, e.action, e.note, e.actor_ref, e.created_at, coalesce(ur.display_name, e.actor_ref) as actor_name
    from finance.approval_events e
    left join finance.user_roles ur on ur.company_id = e.company_id and ur.cms_actor_ref = e.actor_ref
    where e.company_id = ${u.companyId}::uuid
      and ((e.entity_type = 'document' and e.entity_id = ${id}::uuid) or (${clr ? clr.id : null}::uuid is not null and e.entity_type = 'expense_clearance' and e.entity_id = ${clr ? clr.id : null}::uuid))
    order by e.created_at`;
  const names = await sql`select cms_actor_ref, display_name from finance.user_roles where company_id = ${u.companyId}::uuid`;
  const nameOf: Record<string, string> = {}; for (const n of names) nameOf[n.cms_actor_ref] = n.display_name || n.cms_actor_ref;

  // ปุ่มที่ผู้ใช้คนนี้กดได้ (API ตรวจซ้ำทุกครั้งที่กด)
  const st = it.stage, own = doc.created_by === u.actorRef;
  let manage = false;
  try { await canManage(sql, u, doc.created_by); manage = can(u, "request"); } catch (_) { manage = false; }
  const notMakerOf = (maker: string | null) => maker !== u.actorRef || u.allowSelfApproval === true;
  const sod = ![doc.created_by, clr?.submitted_by, clr?.owner_approved_by].filter(Boolean).includes(u.actorRef);
  const actions = {
    edit_request: st === "draft" && manage,
    submit_request: st === "draft" && manage,
    attach_request: ["draft", "request_review", "to_clear"].includes(st) && manage,
    approve_request: st === "request_review" && can(u, "approve") && notMakerOf(doc.created_by),
    return_request: st === "request_review" && can(u, "approve"),
    clear: st === "to_clear" && manage,
    approve_clearance: st === "clear_review" && can(u, "approve") && notMakerOf(clr?.submitted_by),
    return_clearance: st === "clear_review" && can(u, "approve"),
    verify: st === "verify" && can(u, "verify") && sod,
    verifier_return: st === "verify" && can(u, "verify") && sod,
    self_blocked: (st === "request_review" && can(u, "approve") && !notMakerOf(doc.created_by)) || (st === "clear_review" && can(u, "approve") && !notMakerOf(clr?.submitted_by))
      ? "คุณเป็นผู้สร้าง/ผู้ส่งรายการนี้ ต้องให้ผู้อนุมัติคนอื่นอนุมัติ (หรือเปิด \"อนุมัติรายการของตัวเองได้\" ในตั้งค่า)" : null,
    sod_blocked: st === "verify" && can(u, "verify") && !sod ? "ผู้สร้าง ผู้ส่งเคลียร์ หรือ Owner ผู้อนุมัติ เป็นผู้ตรวจสุดท้ายของรายการเดียวกันไม่ได้" : null,
  };
  let pay_accounts: Row[] = [];
  if (actions.clear) pay_accounts = await sql`select id, account_code as code, account_name as name, account_type, system_key from finance.chart_of_accounts
    where company_id = ${u.companyId}::uuid and is_active = true and account_type in ('asset','liability')
      and (system_key in ('cash','bank') or account_code like '10%' or account_code like '20%')
    order by account_code limit 60`;
  return {
    item: it, document: { ...doc, created_by_name: nameOf[doc.created_by] || doc.created_by, approved_by_name: doc.approved_by ? nameOf[doc.approved_by] || doc.approved_by : null },
    lines, clearance: clr ? { ...clr, submitted_by_name: nameOf[clr.submitted_by] || clr.submitted_by,
      owner_approved_by_name: clr.owner_approved_by ? nameOf[clr.owner_approved_by] || clr.owner_approved_by : null,
      verified_by_name: clr.verified_by ? nameOf[clr.verified_by] || clr.verified_by : null,
      returned_by_name: clr.returned_by ? nameOf[clr.returned_by] || clr.returned_by : null } : null,
    files, events, actions, pay_accounts, own,
  };
}

// แนบเอกสารตอนขอเบิก (ใบเสนอราคา ใบแจ้งหนี้ ฯลฯ) — ก่อนปิดงาน
export async function uploadRequestFile(form: FormData, u: User, rid: string) {
  need(u, "request");
  const id = uuid(form.get("document_id"), "คำขอเบิก")!;
  const category = oneOf(form.get("category"), ["quotation", "supporting", "receipt_invoice", "tax_invoice"] as const, "ประเภทเอกสาร");
  const file = form.get("file"); if (!(file instanceof File)) fail(400, "กรุณาเลือกไฟล์เอกสาร");
  const sql = db();
  const [d] = await sql`select id, status, document_type, created_by from finance.documents where id = ${id}::uuid and company_id = ${u.companyId}::uuid`;
  if (!d) fail(404, "ไม่พบคำขอเบิก");
  if (!EXPENSE_DOCS.includes(d.document_type)) fail(400, "แนบเอกสารแบบนี้ได้เฉพาะคำขอเบิกค่าใช้จ่าย");
  if (!["draft", "pending_review", "approved"].includes(d.status)) fail(409, "ปิดงานแล้ว เพิ่มเอกสารไม่ได้");
  await canManage(sql, u, d.created_by);
  return await storeFile(u, rid, file as File, category, { document_id: id }, "document", id);
}

// ลบไฟล์ที่แนบผิด — ทำได้เฉพาะช่วงที่ยังแก้ไขได้ (ร่างคำขอ / ร่างหรือถูกส่งกลับของรายการเคลียร์)
export async function deleteFile(body: Record<string, unknown>, u: User, rid: string) {
  need(u, "request");
  const fileId = uuid(body.file_id, "ไฟล์")!;
  return await db().begin(async (tx: Tx) => {
    const [f] = await tx`select f.id, f.document_id, f.clearance_id, f.original_name, d1.status as doc_status, d1.created_by as doc_creator,
        c.status as c_status, d2.created_by as c_creator
      from finance.document_files f
      left join finance.documents d1 on d1.id = f.document_id
      left join finance.expense_clearances c on c.id = f.clearance_id
      left join finance.documents d2 on d2.id = c.document_id
      where f.id = ${fileId}::uuid and f.company_id = ${u.companyId}::uuid and f.deleted_at is null for update of f`;
    if (!f || (!f.document_id && !f.clearance_id)) fail(404, "ไม่พบไฟล์");
    if (f.document_id) { if (f.doc_status !== "draft") fail(409, "ลบได้เฉพาะไฟล์ของคำขอที่ยังเป็นร่าง"); await canManage(tx, u, f.doc_creator); }
    else { if (!["draft", "returned"].includes(f.c_status)) fail(409, "ส่งเคลียร์แล้ว ลบไฟล์ไม่ได้"); await canManage(tx, u, f.c_creator); }
    await tx`update finance.document_files set deleted_at = now() where id = ${fileId}::uuid`;
    await audit(tx, u, "delete_file", f.document_id ? "document" : "expense_clearance", f.document_id || f.clearance_id, { file: f.original_name }, rid);
    return { id: fileId, deleted: true };
  });
}
export { canSee };
