// Expense request clearance — one canonical expense document, no duplicate expense document.
import { approvalEvent, audit, date, db, fail, money, oneOf, opt, text, Tx, uuid } from "./util.ts";
import { makerChecker, need, User } from "./auth.ts";
import { EXPENSE_DOCS } from "./posting.ts";

const METHODS = ["cash","bank_transfer","credit_card","cheque","other"] as const;

export async function listClearances(url: URL, u: User) {
  need(u,"read");
  const status=text(url.searchParams.get("status"),32);
  const rows=await db()`select c.*, d.document_number, d.document_date, d.document_type, d.grand_total as requested_amount,
      d.created_by as requester, d.status as document_status,
      (select count(*)::int from finance.document_files f where f.company_id=c.company_id and f.clearance_id=c.id and f.deleted_at is null) as file_count
    from finance.expense_clearances c join finance.documents d on d.id=c.document_id
    where c.company_id=${u.companyId}::uuid
      and (${u.role} not in ('staff','manager') or d.created_by=${u.actorRef})
      and (${u.role}<>'staff' or d.created_by=${u.actorRef})
      and (${status}='' or c.status=${status})
    order by c.updated_at desc limit 200`;
  return {items:rows};
}

export async function submitClearance(body: Record<string,unknown>,u:User,rid:string) {
  need(u,"request");
  const documentId=uuid(body.document_id,"เอกสารเบิก")!;
  const amount=money(body.actual_amount,"ยอดจ่ายจริง",{allowZero:false});
  const paidOn=date(body.payment_date,"วันที่จ่ายเงินจริง");
  const method=oneOf(body.payment_method,METHODS,"ช่องทางจ่าย");
  return await db().begin(async(tx:Tx)=>{
    const [doc]=await tx`select id,document_type,document_number,status,created_by,grand_total from finance.documents
      where id=${documentId}::uuid and company_id=${u.companyId}::uuid for update`;
    if(!doc) fail(404,"ไม่พบเอกสารเบิก");
    if(!EXPENSE_DOCS.includes(doc.document_type)) fail(400,"เอกสารนี้ไม่ใช่เอกสารรายจ่าย");
    if(doc.status!=="approved") fail(409,"ต้องได้รับอนุมัติคำขอเบิกก่อนจึงจะเคลียร์ได้");
    if(doc.created_by!==u.actorRef && !["manager","owner","approver"].includes(u.role)) fail(403,"เคลียร์ได้เฉพาะผู้สร้างคำขอ หรือ Manager");
    if(amount>Number(doc.grand_total)+0.004) fail(400,"ยอดจ่ายจริงเกินวงเงินที่ Owner อนุมัติ");
    const [existing]=await tx`select * from finance.expense_clearances where document_id=${documentId}::uuid for update`;
    let row;
    if(existing) {
      if(!["draft","returned"].includes(existing.status)) fail(409,"เอกสารเคลียร์ถูกส่งตรวจแล้ว ไม่สามารถแก้ไขได้");
      [row]=await tx`update finance.expense_clearances set actual_amount=${amount},payment_date=${paidOn}::date,
        payment_method=${method},reference_number=${opt(body.reference_number,120)},notes=${opt(body.notes,1000)},
        status='pending_owner_review',submitted_by=${u.actorRef},submitted_at=now(),updated_at=now(),return_note=null
        where id=${existing.id}::uuid returning *`;
    } else {
      [row]=await tx`insert into finance.expense_clearances
        (company_id,document_id,actual_amount,payment_date,payment_method,reference_number,notes,status,submitted_by,submitted_at)
        values(${u.companyId}::uuid,${documentId}::uuid,${amount},${paidOn}::date,${method},${opt(body.reference_number,120)},
        ${opt(body.notes,1000)},'pending_owner_review',${u.actorRef},now()) returning *`;
    }
    await approvalEvent(tx,u,"expense_clearance",row.id,"submitted",null,rid);
    await audit(tx,u,"submit_expense_clearance","expense_clearance",row.id,row,rid);
    return row;
  });
}

export async function approveClearance(body:Record<string,unknown>,u:User,rid:string) {
  need(u,"approve");
  const id=uuid(body.clearance_id,"รายการเคลียร์")!;
  return await db().begin(async(tx:Tx)=>{
    const [c]=await tx`select c.*,d.created_by,d.document_number from finance.expense_clearances c
      join finance.documents d on d.id=c.document_id where c.id=${id}::uuid and c.company_id=${u.companyId}::uuid for update of c`;
    if(!c) fail(404,"ไม่พบรายการเคลียร์");
    if(c.status!=="pending_owner_review") fail(409,"รายการนี้ไม่ได้รอ Owner ตรวจสอบ");
    makerChecker(u,c.submitted_by);
    const [out]=await tx`update finance.expense_clearances set status='owner_approved',owner_approved_by=${u.actorRef},
      owner_approved_at=now(),updated_at=now() where id=${id}::uuid returning *`;
    await approvalEvent(tx,u,"expense_clearance",id,"owner_approved",opt(body.note,500),rid);
    await audit(tx,u,"approve_expense_clearance","expense_clearance",id,out,rid);
    return out;
  });
}

export async function returnClearance(body:Record<string,unknown>,u:User,rid:string) {
  need(u,"approve");
  const id=uuid(body.clearance_id,"รายการเคลียร์")!;
  const note=text(body.note,500);
  if(!note) fail(400,"กรุณาระบุเหตุผลที่ส่งกลับ");
  return await db().begin(async(tx:Tx)=>{
    const [c]=await tx`select id,status from finance.expense_clearances where id=${id}::uuid and company_id=${u.companyId}::uuid for update`;
    if(!c) fail(404,"ไม่พบรายการเคลียร์");
    if(c.status!=="pending_owner_review") fail(409,"ส่งกลับได้เฉพาะรายการที่รอ Owner ตรวจสอบ");
    const [out]=await tx`update finance.expense_clearances set status='returned',returned_by=${u.actorRef},
      returned_at=now(),return_note=${note},updated_at=now() where id=${id}::uuid returning *`;
    await approvalEvent(tx,u,"expense_clearance",id,"returned",note,rid);
    await audit(tx,u,"return_expense_clearance","expense_clearance",id,out,rid);
    return out;
  });
}
