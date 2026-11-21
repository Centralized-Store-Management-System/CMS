// Expense request clearance — one canonical expense document, no duplicate expense document.
import { approvalEvent, audit, date, db, fail, money, oneOf, opt, text, Tx, uuid } from "./util.ts";
import { makerChecker, need, User } from "./auth.ts";
import { EXPENSE_DOCS, postEntry, sysAccount, accountByCode, Line } from "./posting.ts";
import { num, round2 } from "./util.ts";

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


/** Final verification is the only step that posts an expense to the ledger. */
export async function verifyClearance(body:Record<string,unknown>,u:User,rid:string) {
  need(u,"verify");
  if(body.confirm_complete!==true) fail(400,"กรุณายืนยันว่าเอกสารและหลักฐานครบถ้วน");
  const id=uuid(body.clearance_id,"รายการเคลียร์")!;
  return await db().begin(async(tx:Tx)=>{
    const [c]=await tx`select c.*,d.id as doc_id,d.document_type,d.document_number,d.document_date,d.status as doc_status,
      d.created_by,d.partner_id,d.subtotal,d.vat_total,d.wht_total,d.grand_total,p.default_wht_type,p.display_name as partner_name
      from finance.expense_clearances c join finance.documents d on d.id=c.document_id
      left join finance.partners p on p.id=d.partner_id
      where c.id=${id}::uuid and c.company_id=${u.companyId}::uuid for update of c,d`;
    if(!c) fail(404,"ไม่พบรายการเคลียร์");
    if(c.status!=="owner_approved") fail(409,"รายการนี้ยังไม่ผ่าน Owner อนุมัติ");
    if(c.doc_status!=="approved") fail(409,"สถานะเอกสารเบิกไม่ถูกต้อง");
    if([c.created_by,c.submitted_by,c.owner_approved_by].filter(Boolean).includes(u.actorRef))
      fail(403,"ผู้สร้าง ผู้ส่งเคลียร์ หรือ Owner ผู้อนุมัติ ไม่สามารถตรวจสอบขั้นสุดท้ายรายการเดียวกันได้");
    const [evidence]=await tx`select count(*)::int n from finance.document_files
      where company_id=${u.companyId}::uuid and clearance_id=${id}::uuid and deleted_at is null and file_category='payment_evidence'`;
    if(Number(evidence.n)<1) fail(409,"ต้องแนบหลักฐานการจ่ายเงินจริงอย่างน้อย 1 ไฟล์");
    const actual=round2(num(c.actual_amount)), grand=round2(num(c.grand_total));
    if(Math.abs(actual-grand)>0.004)
      fail(409,"ยอดจ่ายจริงไม่เท่ากับยอดเอกสารที่อนุมัติ ระบบยังไม่ลงบัญชีเพื่อป้องกันยอดภาษีคลาดเคลื่อน กรุณาให้ Owner ปรับเอกสารและส่งเคลียร์ใหม่");
    const lines=await tx`select * from finance.document_lines where document_id=${c.doc_id}::uuid order by line_no`;
    if(!lines.length) fail(409,"ไม่พบรายละเอียดค่าใช้จ่ายสำหรับลงบัญชี");
    const desc=String(c.document_number)+(c.partner_name?" · "+c.partner_name:"");
    const jl:Line[]=[];
    const claimVat=u.vatRegistered&&num(c.vat_total)>0;
    const defExp=await sysAccount(tx,u,"expense");
    for(const l of lines){
      const acc=l.account_code?await accountByCode(tx,u,String(l.account_code),["expense","asset"]):defExp;
      jl.push({account_id:acc,debit:round2(num(l.line_total)+(claimVat?0:num(l.vat_amount))),credit:0,description:l.description});
    }
    if(claimVat) jl.push({account_id:await sysAccount(tx,u,"vat_input"),debit:num(c.vat_total),credit:0,description:desc});
    const cashKey=c.payment_method==="bank_transfer"?"bank":c.payment_method==="cash"?"cash":null;
    if(!cashKey) fail(409,"ช่องทางจ่ายนี้ยังไม่ได้กำหนดบัญชีคู่รายการ กรุณาใช้เงินสดหรือโอนธนาคาร หรือกำหนดผังบัญชีก่อน");
    jl.push({account_id:await sysAccount(tx,u,cashKey),debit:0,credit:actual,description:desc});
    if(num(c.wht_total)>0) jl.push({account_id:await sysAccount(tx,u,"wht_payable"),debit:0,credit:num(c.wht_total),description:desc});
    const je=await postEntry(tx,u,{date:date(c.payment_date,"วันที่จ่ายเงินจริง"),description:"เคลียร์ค่าใช้จ่าย "+desc,source_type:"expense_clearance",source_document_id:c.doc_id,created_by:c.created_by,lines:jl});
    const tp=String(c.payment_date).slice(0,7),sub=num(c.subtotal),vat=num(c.vat_total),wht=num(c.wht_total);
    if(vat&&u.vatRegistered) await tx`insert into finance.tax_transactions
      (company_id,document_id,tax_type,tax_period,tax_base,tax_rate,tax_amount,counterparty_id,tax_form_code,status)
      values(${u.companyId}::uuid,${c.doc_id}::uuid,'vat_input',${tp},${sub},${num(lines[0]?.vat_rate)},${vat},${c.partner_id}::uuid,'PP30','reviewed')
      on conflict(document_id,tax_type,tax_period) do update set tax_base=excluded.tax_base,tax_amount=excluded.tax_amount,status='reviewed'`;
    if(wht) await tx`insert into finance.tax_transactions
      (company_id,document_id,tax_type,tax_period,tax_base,tax_rate,tax_amount,counterparty_id,tax_form_code,status)
      values(${u.companyId}::uuid,${c.doc_id}::uuid,'wht',${tp},${sub},${num(lines[0]?.wht_rate)},${wht},${c.partner_id}::uuid,
      ${String(c.default_wht_type||"").toLowerCase()==="pnd3"?"PND3":"PND53"},'reviewed')
      on conflict(document_id,tax_type,tax_period) do update set tax_base=excluded.tax_base,tax_amount=excluded.tax_amount,tax_form_code=excluded.tax_form_code,status='reviewed'`;
    const [doc]=await tx`update finance.documents set status='posted',posted_at=now(),approved_by=${u.actorRef}
      where id=${c.doc_id}::uuid and status='approved' returning id,document_number,status,grand_total,posted_at`;
    const [out]=await tx`update finance.expense_clearances set status='verified',verified_by=${u.actorRef},verified_at=now(),updated_at=now()
      where id=${id}::uuid and status='owner_approved' returning *`;
    await approvalEvent(tx,u,"expense_clearance",id,"verified","ตรวจสอบขั้นสุดท้ายและลงบัญชีแล้ว",rid);
    await audit(tx,u,"verify_and_post_expense_clearance","expense_clearance",id,{clearance:out,document:doc,journal:je.journal_number},rid);
    return {clearance:out,document:doc,journal_number:je.journal_number,accounting_posted:true};
  });
}
