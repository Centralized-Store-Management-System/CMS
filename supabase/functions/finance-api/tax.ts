// ภาษี: รายงานภาษีขาย/ภาษีซื้อ, หัก ณ ที่จ่าย, จัดทำแบบ ภ.พ.30 / ภ.ง.ด.3 / ภ.ง.ด.53
// ขั้นตอน: จัดทำ → ส่งตรวจ → อนุมัติ (VAT: ลงบัญชีปิดภาษีซื้อ-ขาย) → บันทึกว่ายื่นแล้ว (เลขอ้างอิงจากกรมสรรพากร) → บันทึกว่าชำระแล้ว (ลงบัญชีจ่ายเงิน)
// ระบบนี้ "ไม่ได้ยื่นแบบให้อัตโนมัติ" — ผู้ใช้ยื่นที่ระบบของกรมสรรพากรเอง แล้วกลับมาบันทึกเลขอ้างอิง
import { approvalEvent, audit, date, db, fail, num, oneOf, opt, period, round2, text, Tx, uuid } from "./util.ts";
import { makerChecker, need, User } from "./auth.ts";
import { accountById, postEntry, sysAccount } from "./posting.ts";

const FORMS = { PP30: { type: "vat", label: "ภ.พ.30", dueDay: 23 }, PND3: { type: "wht", label: "ภ.ง.ด.3", dueDay: 15 }, PND53: { type: "wht", label: "ภ.ง.ด.53", dueDay: 15 } } as const;
type Form = keyof typeof FORMS;

function dueDate(p: string, day: number) {   // กำหนดยื่นแบบทาง e-Filing ของเดือนถัดไป
  const [y, m] = p.split("-").map(Number);
  const ny = m === 12 ? y + 1 : y, nm = m === 12 ? 1 : m + 1;
  return ny + "-" + String(nm).padStart(2, "0") + "-" + String(day).padStart(2, "0");
}

export async function taxReport(url: URL, u: User) {
  const p = period(url.searchParams.get("period"));
  const rows = await db()`select t.id, t.tax_type, t.tax_form_code, t.tax_base, t.tax_rate, t.tax_amount, t.status,
      d.document_number, d.document_type, d.document_date, d.reference, pt.display_name as partner_name, pt.tax_id as partner_tax_id, pt.branch_number as partner_branch
    from finance.tax_transactions t join finance.documents d on d.id = t.document_id left join finance.partners pt on pt.id = t.counterparty_id
    where t.company_id = ${u.companyId}::uuid and t.tax_period = ${p} and t.status in ('reviewed','filed')
    order by t.tax_type, d.document_date, d.document_number`;
  const sum = (f: (r: Record<string, unknown>) => boolean, k: string) => round2(rows.filter(f).reduce((a: number, r: Record<string, unknown>) => a + num(r[k]), 0));
  const output = sum(r => r.tax_type === "vat_output", "tax_amount"), input = sum(r => r.tax_type === "vat_input", "tax_amount");
  return {
    period: p, items: rows,
    totals: {
      sales_base: sum(r => r.tax_type === "vat_output", "tax_base"), vat_output: output,
      purchase_base: sum(r => r.tax_type === "vat_input", "tax_base"), vat_input: input, vat_net: round2(output - input),
      pnd3: sum(r => r.tax_type === "wht" && r.tax_form_code === "PND3", "tax_amount"),
      pnd53: sum(r => r.tax_type === "wht" && r.tax_form_code === "PND53", "tax_amount"),
      wht_received: sum(r => r.tax_type === "wht" && r.tax_form_code === "WHT_RECEIVED", "tax_amount"),
    },
  };
}

export async function prepareFiling(body: Record<string, unknown>, u: User, rid: string) {
  need(u, "write");
  const form = oneOf(body.form_code, ["PP30", "PND3", "PND53"] as const, "แบบภาษี") as Form;
  const p = period(body.period);
  if (form === "PP30" && !u.vatRegistered) fail(400, "บริษัทยังไม่ได้จดทะเบียน VAT — ไม่ต้องยื่น ภ.พ.30");
  const f = FORMS[form];
  return await db().begin(async (tx: Tx) => {
    const [ex] = await tx`select id, status from finance.tax_filings where company_id = ${u.companyId}::uuid and tax_period = ${p} and form_code = ${form} for update`;
    if (ex && ex.status !== "preparing") fail(409, "แบบ " + f.label + " งวด " + p + " อยู่ในขั้นตอน " + ex.status + " แล้ว — จัดทำใหม่ไม่ได้");
    const txs = form === "PP30"
      ? await tx`select id, tax_type, tax_base, tax_rate, tax_amount, counterparty_id from finance.tax_transactions where company_id = ${u.companyId}::uuid and tax_period = ${p} and status = 'reviewed' and tax_type in ('vat_output','vat_input')`
      : await tx`select id, tax_type, tax_base, tax_rate, tax_amount, counterparty_id from finance.tax_transactions where company_id = ${u.companyId}::uuid and tax_period = ${p} and status = 'reviewed' and tax_type = 'wht' and tax_form_code = ${form}`;
    let totals: Record<string, number>, amount: number;
    if (form === "PP30") {
      const out = round2(txs.filter((t: Record<string, unknown>) => t.tax_type === "vat_output").reduce((a: number, t: Record<string, unknown>) => a + num(t.tax_amount), 0));
      const inp = round2(txs.filter((t: Record<string, unknown>) => t.tax_type === "vat_input").reduce((a: number, t: Record<string, unknown>) => a + num(t.tax_amount), 0));
      const sb = round2(txs.filter((t: Record<string, unknown>) => t.tax_type === "vat_output").reduce((a: number, t: Record<string, unknown>) => a + num(t.tax_base), 0));
      const pb = round2(txs.filter((t: Record<string, unknown>) => t.tax_type === "vat_input").reduce((a: number, t: Record<string, unknown>) => a + num(t.tax_base), 0));
      totals = { sales_base: sb, vat_output: out, purchase_base: pb, vat_input: inp, net: round2(out - inp) };
      amount = round2(out - inp);
    } else {
      const base = round2(txs.reduce((a: number, t: Record<string, unknown>) => a + num(t.tax_base), 0));
      amount = round2(txs.reduce((a: number, t: Record<string, unknown>) => a + num(t.tax_amount), 0));
      totals = { base, tax: amount, count: txs.length };
    }
    if (!txs.length) fail(409, "ไม่มีรายการภาษีที่ลงบัญชีแล้วในงวด " + p + " สำหรับ " + f.label);
    let id: string;
    if (ex) {
      id = ex.id;
      await tx`delete from finance.tax_filing_lines where filing_id = ${id}::uuid`;
      await tx`update finance.tax_filings set return_amount = ${Math.abs(amount)}, totals = ${tx.json(totals)}, prepared_by = ${u.actorRef}, notes = ${opt(body.notes, 500)} where id = ${id}::uuid`;
    } else {
      const [r] = await tx`insert into finance.tax_filings (company_id, tax_type, tax_period, form_code, due_date, status, return_amount, prepared_by, totals, notes)
        values (${u.companyId}::uuid, ${f.type}, ${p}, ${form}, ${dueDate(p, f.dueDay)}::date, 'preparing', ${Math.abs(amount)}, ${u.actorRef}, ${tx.json(totals)}, ${opt(body.notes, 500)}) returning id`;
      id = r.id;
    }
    for (const t of txs) {
      const neg = num(t.tax_amount) < 0;
      await tx`insert into finance.tax_filing_lines (company_id, filing_id, source_tax_transaction_id, counterparty_id, description, tax_base, tax_rate, tax_amount)
        values (${u.companyId}::uuid, ${id}::uuid, ${t.id}, ${t.counterparty_id}, ${(t.tax_type === "vat_input" ? "ภาษีซื้อ" : t.tax_type === "vat_output" ? "ภาษีขาย" : "หัก ณ ที่จ่าย") + (neg ? " (ลดหนี้)" : "")},
                ${Math.abs(num(t.tax_base))}, ${num(t.tax_rate)}, ${Math.abs(num(t.tax_amount))})`;
    }
    await audit(tx, u, ex ? "reprepare" : "prepare", "tax_filing", id, { form, period: p, totals }, rid);
    return { id, form_code: form, period: p, status: "preparing", totals, return_amount: Math.abs(amount), due_date: dueDate(p, f.dueDay) };
  });
}

async function lockFiling(tx: Tx, u: User, id: string) {
  const [f] = await tx`select * from finance.tax_filings where id = ${id}::uuid and company_id = ${u.companyId}::uuid for update`;
  if (!f) fail(404, "ไม่พบแบบภาษี");
  return f;
}

export async function submitFilingReview(body: Record<string, unknown>, u: User, rid: string) {
  need(u, "write");
  const id = uuid(body.filing_id, "แบบภาษี")!;
  return await db().begin(async (tx: Tx) => {
    const f = await lockFiling(tx, u, id);
    if (f.status !== "preparing") fail(409, "ส่งตรวจได้เฉพาะแบบที่กำลังจัดทำ");
    const [out] = await tx`update finance.tax_filings set status = 'review' where id = ${id}::uuid returning id, status`;
    await audit(tx, u, "submit", "tax_filing", id, out, rid);
    return out;
  });
}

export async function returnFiling(body: Record<string, unknown>, u: User, rid: string) {
  need(u, "approve");
  const id = uuid(body.filing_id, "แบบภาษี")!;
  const note = text(body.note, 500);
  if (!note) fail(400, "กรุณาระบุเหตุผลที่ตีกลับ");
  return await db().begin(async (tx: Tx) => {
    const f = await lockFiling(tx, u, id);
    if (f.status !== "review") fail(409, "ตีกลับได้เฉพาะแบบที่รอตรวจ");
    const [out] = await tx`update finance.tax_filings set status = 'preparing', notes = ${note} where id = ${id}::uuid returning id, status`;
    await audit(tx, u, "return", "tax_filing", id, { ...out, note }, rid);
    return out;
  });
}

// อนุมัติแบบ: ล็อกรายการภาษีของงวด (filed) · ภ.พ.30 ลงบัญชีโอนภาษีขาย/ซื้อเข้า "ภาษีมูลค่าเพิ่มค้างจ่าย"
export async function approveFiling(body: Record<string, unknown>, u: User, rid: string) {
  need(u, "approve");
  const id = uuid(body.filing_id, "แบบภาษี")!;
  return await db().begin(async (tx: Tx) => {
    const f = await lockFiling(tx, u, id);
    if (f.status !== "review") fail(409, "อนุมัติได้เฉพาะแบบที่รอตรวจ");
    const self = makerChecker(u, f.prepared_by);
    let journal: string | null = null, journalId: string | null = null;
    if (f.form_code === "PP30") {
      const t = f.totals || {};
      const out = num(t.vat_output), inp = num(t.vat_input), net = round2(out - inp);
      const lastDay = new Date(Date.UTC(Number(f.tax_period.slice(0, 4)), Number(f.tax_period.slice(5, 7)), 0)).toISOString().slice(0, 10);
      const lines = [];
      if (out) lines.push(out > 0 ? { account_id: await sysAccount(tx, u, "vat_output"), debit: out, credit: 0 } : { account_id: await sysAccount(tx, u, "vat_output"), debit: 0, credit: -out });
      if (inp) lines.push(inp > 0 ? { account_id: await sysAccount(tx, u, "vat_input"), debit: 0, credit: inp } : { account_id: await sysAccount(tx, u, "vat_input"), debit: -inp, credit: 0 });
      if (net) lines.push(net > 0 ? { account_id: await sysAccount(tx, u, "vat_payable"), debit: 0, credit: net } : { account_id: await sysAccount(tx, u, "vat_payable"), debit: -net, credit: 0 });
      if (lines.length >= 2) {
        const je = await postEntry(tx, u, { date: lastDay, description: "ปิดภาษีซื้อ-ขาย ภ.พ.30 งวด " + f.tax_period, source_type: "tax", created_by: f.prepared_by, lines });
        journal = je.journal_number; journalId = je.id;
      }
    }
    await tx`update finance.tax_transactions set status = 'filed' where id in (select source_tax_transaction_id from finance.tax_filing_lines where filing_id = ${id}::uuid)`;
    const [out] = await tx`update finance.tax_filings set status = 'approved', approved_by = ${u.actorRef}, journal_entry_id = ${journalId}::uuid where id = ${id}::uuid returning id, status, form_code, tax_period, return_amount`;
    await approvalEvent(tx, u, "tax_filing", id, "approved", self ? "อนุมัติรายการของตนเอง" : opt(body.note, 500), rid);
    await audit(tx, u, self ? "approve_self" : "approve", "tax_filing", id, { ...out, journal }, rid);
    return { ...out, journal_number: journal };
  });
}

export async function markFiled(body: Record<string, unknown>, u: User, rid: string) {
  need(u, "approve");
  const id = uuid(body.filing_id, "แบบภาษี")!;
  const ref = text(body.receipt_reference, 120);
  if (!ref) fail(400, "กรุณาระบุเลขอ้างอิงการยื่นแบบจากกรมสรรพากร");
  const d = body.submitted_at ? date(body.submitted_at, "วันที่ยื่นแบบ") : null;
  return await db().begin(async (tx: Tx) => {
    const f = await lockFiling(tx, u, id);
    if (f.status !== "approved") fail(409, "ต้องอนุมัติแบบก่อนบันทึกว่ายื่นแล้ว");
    const [out] = await tx`update finance.tax_filings set status = 'submitted', receipt_reference = ${ref}, submitted_by = ${u.actorRef},
        submitted_at = ${d ? d + "T12:00:00+07:00" : new Date().toISOString()}::timestamptz where id = ${id}::uuid returning id, status, receipt_reference, submitted_at`;
    await audit(tx, u, "mark_submitted", "tax_filing", id, out, rid);
    return out;
  });
}

// บันทึกว่าชำระภาษีแล้ว → ลงบัญชี Dr ภาษีค้างจ่าย / Cr เงินสด-ธนาคาร
export async function markFilingPaid(body: Record<string, unknown>, u: User, rid: string) {
  need(u, "approve");
  const id = uuid(body.filing_id, "แบบภาษี")!;
  const d = date(body.paid_date, "วันที่ชำระ");
  return await db().begin(async (tx: Tx) => {
    const f = await lockFiling(tx, u, id);
    if (f.status !== "submitted") fail(409, "ต้องบันทึกว่ายื่นแบบแล้วก่อน");
    const amount = num(f.return_amount);
    const vatRefund = f.form_code === "PP30" && num((f.totals || {}).net) < 0;
    let journal: string | null = null;
    if (amount > 0 && !vatRefund) {
      const cashId = body.cash_account_id ? String((await accountById(tx, u, uuid(body.cash_account_id, "บัญชีเงินสด/ธนาคาร")!, ["asset"])).id) : await sysAccount(tx, u, "bank");
      const payable = await sysAccount(tx, u, f.form_code === "PP30" ? "vat_payable" : "wht_payable");
      const je = await postEntry(tx, u, { date: d, description: "ชำระภาษี " + FORMS[f.form_code as Form].label + " งวด " + f.tax_period, source_type: "tax",
        lines: [{ account_id: payable, debit: amount, credit: 0 }, { account_id: cashId, debit: 0, credit: amount }] });
      journal = je.journal_number;
    }
    const notes = [f.notes, journal ? "ลงบัญชีชำระ " + journal : (vatRefund ? "ภาษีชำระเกิน (ขอคืน/ยกไป)" : null)].filter(Boolean).join(" · ");
    const [out] = await tx`update finance.tax_filings set status = 'paid', notes = ${notes || null} where id = ${id}::uuid returning id, status`;
    await audit(tx, u, "mark_paid", "tax_filing", id, { ...out, journal }, rid);
    return { ...out, journal_number: journal };
  });
}

export async function listFilings(_url: URL, u: User) {
  const rows = await db()`select id, tax_type, tax_period, form_code, due_date, status, return_amount, totals, receipt_reference, submitted_at, prepared_by, approved_by, submitted_by, notes, created_at,
      (select count(*)::int from finance.tax_filing_lines l where l.filing_id = f.id) as line_count
    from finance.tax_filings f where company_id = ${u.companyId}::uuid order by tax_period desc, form_code`;
  return { items: rows };
}
