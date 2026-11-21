// สมุดรายวันทั่วไป (บันทึกเอง) + รอบบัญชี (สร้าง / ปิด / เปิดใหม่)
import { approvalEvent, audit, date, db, fail, money, num, opt, round2, text, Tx, uuid } from "./util.ts";
import { makerChecker, need, User } from "./auth.ts";
import { compact, createYearPeriods, requireOpenPeriod, reverseEntry } from "./posting.ts";

function parseLines(body: Record<string, unknown>) {
  const raw = Array.isArray(body.lines) ? body.lines as Record<string, unknown>[] : [];
  if (raw.length < 2 || raw.length > 100) fail(400, "สมุดรายวันต้องมี 2–100 บรรทัด");
  const lines = raw.map((l, i) => {
    const account_id = uuid(l.account_id, "บัญชีบรรทัดที่ " + (i + 1))!;
    const debit = money(l.debit || 0, "เดบิตบรรทัดที่ " + (i + 1)), credit = money(l.credit || 0, "เครดิตบรรทัดที่ " + (i + 1));
    if ((debit > 0) === (credit > 0)) fail(400, "บรรทัดที่ " + (i + 1) + ": กรอกเดบิตหรือเครดิตอย่างใดอย่างหนึ่ง");
    return { account_id, debit, credit, description: opt(l.description, 300), partner_id: uuid(l.partner_id, "คู่ค้าบรรทัดที่ " + (i + 1), false) };
  });
  const dr = round2(lines.reduce((a, l) => a + l.debit, 0)), cr = round2(lines.reduce((a, l) => a + l.credit, 0));
  if (dr <= 0 || Math.abs(dr - cr) > 0.004) fail(400, "ยอดเดบิต (" + dr.toFixed(2) + ") และเครดิต (" + cr.toFixed(2) + ") ต้องเท่ากัน");
  return { lines, dr, cr };
}

export async function createJournal(body: Record<string, unknown>, u: User, rid: string) {
  need(u, "write");
  const d = date(body.journal_date, "วันที่");
  const description = text(body.description, 500);
  if (!description) fail(400, "กรุณาระบุคำอธิบายรายการ");
  const { lines, dr, cr } = parseLines(body);
  return await db().begin(async (tx: Tx) => {
    for (const l of lines) {
      const [a] = await tx`select id from finance.chart_of_accounts where id = ${l.account_id}::uuid and company_id = ${u.companyId}::uuid and is_active`;
      if (!a) fail(400, "พบบัญชีที่ไม่มีอยู่ หรือถูกปิดใช้งาน");
      if (l.partner_id) { const [p] = await tx`select id from finance.partners where id = ${l.partner_id}::uuid and company_id = ${u.companyId}::uuid`; if (!p) fail(400, "ไม่พบคู่ค้า"); }
    }
    const key = d.slice(0, 7);
    const [s] = await tx`insert into finance.journal_sequences (company_id, prefix, period_key, next_number, padding) values (${u.companyId}::uuid, 'JV', ${key}, 2, 5)
      on conflict (company_id, period_key) do update set next_number = finance.journal_sequences.next_number + 1 returning next_number - 1 as n`;
    const no = "JV-" + key.replace("-", "") + "-" + String(s.n).padStart(5, "0");
    const [je] = await tx`insert into finance.journal_entries (company_id, journal_number, journal_date, description, source_type, status, total_debit, total_credit, created_by)
      values (${u.companyId}::uuid, ${no}, ${d}::date, ${description}, ${body.opening === true ? "opening" : "manual"}, 'draft', ${dr}, ${cr}, ${u.actorRef})
      returning id, journal_number, journal_date, description, status, total_debit, total_credit`;
    const cl = compact(lines);
    for (let i = 0; i < cl.length; i++) {
      const l = cl[i];
      await tx`insert into finance.journal_lines (journal_entry_id, account_id, line_no, description, debit, credit, partner_id)
        values (${je.id}, ${l.account_id}::uuid, ${i + 1}, ${l.description || null}, ${l.debit}, ${l.credit}, ${l.partner_id || null}::uuid)`;
    }
    await tx`update finance.journal_entries set status = 'pending_review' where id = ${je.id}`;
    je.status = "pending_review";
    await approvalEvent(tx, u, "journal", je.id, "submitted", null, rid);
    await audit(tx, u, "create", "journal", je.id, { ...je, lines: cl.length }, rid);
    return je;
  });
}

export async function postJournal(body: Record<string, unknown>, u: User, rid: string) {
  need(u, "approve");
  const id = uuid(body.journal_id, "สมุดรายวัน")!;
  return await db().begin(async (tx: Tx) => {
    const [je] = await tx`select * from finance.journal_entries where id = ${id}::uuid and company_id = ${u.companyId}::uuid for update`;
    if (!je) fail(404, "ไม่พบสมุดรายวัน");
    if (je.status !== "pending_review") fail(409, "ลงบัญชีได้เฉพาะรายการที่รออนุมัติ");
    const self = makerChecker(u, je.created_by);
    const d = je.journal_date instanceof Date ? je.journal_date.toISOString().slice(0, 10) : String(je.journal_date);
    await requireOpenPeriod(tx, u, d);
    const [s] = await tx`select count(*)::int n, coalesce(sum(debit),0) dr, coalesce(sum(credit),0) cr from finance.journal_lines where journal_entry_id = ${id}::uuid`;
    if (s.n < 2 || Math.abs(num(s.dr) - num(s.cr)) > 0.004 || Math.abs(num(s.dr) - num(je.total_debit)) > 0.004) fail(409, "ยอดบรรทัดไม่ตรงกับยอดรวม หรือไม่สมดุล");
    const [out] = await tx`update finance.journal_entries set status = 'posted', approved_by = ${u.actorRef}, posted_by = ${u.actorRef}, posted_at = now()
      where id = ${id}::uuid returning id, journal_number, status, posted_at`;
    await approvalEvent(tx, u, "journal", id, "posted", self ? "อนุมัติรายการของตนเอง" : opt(body.note, 500), rid);
    await audit(tx, u, self ? "post_self" : "post", "journal", id, out, rid);
    return out;
  });
}

export async function rejectJournal(body: Record<string, unknown>, u: User, rid: string) {
  need(u, "approve");
  const id = uuid(body.journal_id, "สมุดรายวัน")!;
  const note = text(body.note, 500);
  if (!note) fail(400, "กรุณาระบุเหตุผลที่ตีกลับ");
  return await db().begin(async (tx: Tx) => {
    const [je] = await tx`select id, status from finance.journal_entries where id = ${id}::uuid and company_id = ${u.companyId}::uuid for update`;
    if (!je) fail(404, "ไม่พบสมุดรายวัน");
    if (je.status !== "pending_review") fail(409, "ตีกลับได้เฉพาะรายการที่รออนุมัติ");
    const [out] = await tx`update finance.journal_entries set status = 'draft', review_note = ${note} where id = ${id}::uuid returning id, journal_number, status`;
    await approvalEvent(tx, u, "journal", id, "returned", note, rid);
    await audit(tx, u, "return", "journal", id, out, rid);
    return out;
  });
}

export async function deleteDraftJournal(body: Record<string, unknown>, u: User, rid: string) {
  need(u, "write");
  const id = uuid(body.journal_id, "สมุดรายวัน")!;
  return await db().begin(async (tx: Tx) => {
    const [je] = await tx`select id, status, created_by, journal_number, source_type from finance.journal_entries where id = ${id}::uuid and company_id = ${u.companyId}::uuid for update`;
    if (!je) fail(404, "ไม่พบสมุดรายวัน");
    if (je.status !== "draft" || je.source_type !== "manual" && je.source_type !== "opening") fail(409, "ลบได้เฉพาะสมุดรายวันฉบับร่างที่บันทึกเอง");
    if (je.created_by !== u.actorRef && u.role !== "owner") fail(403, "ลบได้เฉพาะผู้สร้างรายการ");
    await tx`delete from finance.journal_lines where journal_entry_id = ${id}::uuid`;
    await tx`delete from finance.journal_entries where id = ${id}::uuid`;
    await audit(tx, u, "delete_draft", "journal", id, { journal_number: je.journal_number }, rid);
    return { id, deleted: true };
  });
}

export async function reverseJournal(body: Record<string, unknown>, u: User, rid: string) {
  need(u, "approve");
  const id = uuid(body.journal_id, "สมุดรายวัน")!;
  const reason = text(body.reason, 500);
  if (!reason) fail(400, "กรุณาระบุเหตุผลที่กลับรายการ");
  const d = date(body.reversal_date, "วันที่กลับรายการ");
  return await db().begin(async (tx: Tx) => {
    const [je] = await tx`select source_type from finance.journal_entries where id = ${id}::uuid and company_id = ${u.companyId}::uuid`;
    if (!je) fail(404, "ไม่พบสมุดรายวัน");
    if (je.source_type !== "manual" && je.source_type !== "opening") fail(409, "รายการนี้มาจากเอกสาร/การชำระเงิน — ให้กลับรายการที่ต้นทาง");
    const rev = await reverseEntry(tx, u, id, d, reason);
    await approvalEvent(tx, u, "journal", id, "reversed", reason, rid);
    await audit(tx, u, "reverse", "journal", id, { reversal: rev.journal_number }, rid);
    return rev;
  });
}

export async function listJournals(url: URL, u: User) {
  const status = text(url.searchParams.get("status"), 20);
  const source = text(url.searchParams.get("source"), 20);
  const from = text(url.searchParams.get("from"), 10), to = text(url.searchParams.get("to"), 10);
  const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit")) || 50));
  const offset = Math.max(0, Number(url.searchParams.get("offset")) || 0);
  const rows = await db()`select id, journal_number, journal_date, description, source_type, status, total_debit, total_credit, created_by, approved_by, posted_at, review_note, created_at
    from finance.journal_entries where company_id = ${u.companyId}::uuid and (${status} = '' or status = ${status}) and (${source} = '' or source_type = ${source})
      and (${from} = '' or journal_date >= ${from || "1900-01-01"}::date) and (${to} = '' or journal_date <= ${to || "2999-12-31"}::date)
    order by journal_date desc, journal_number desc limit ${limit} offset ${offset}`;
  return { items: rows, limit, offset };
}

export async function getJournal(url: URL, u: User) {
  const id = uuid(url.searchParams.get("id"), "สมุดรายวัน")!;
  const sql = db();
  const [je] = await sql`select * from finance.journal_entries where id = ${id}::uuid and company_id = ${u.companyId}::uuid`;
  if (!je) fail(404, "ไม่พบสมุดรายวัน");
  const lines = await sql`select jl.line_no, jl.debit, jl.credit, jl.description, a.account_code, a.account_name, p.display_name as partner_name
    from finance.journal_lines jl join finance.chart_of_accounts a on a.id = jl.account_id left join finance.partners p on p.id = jl.partner_id
    where jl.journal_entry_id = ${id}::uuid order by jl.line_no`;
  return { journal: je, lines };
}

// ---- รอบบัญชี ----
export async function listPeriods(_url: URL, u: User) {
  const rows = await db()`select ap.id, ap.period_code, ap.starts_on, ap.ends_on, ap.status, ap.closed_by, ap.closed_at, ap.reopened_by, ap.reopened_at, ap.close_note,
      (select count(*)::int from finance.journal_entries j where j.company_id = ap.company_id and j.journal_date between ap.starts_on and ap.ends_on and j.status in ('posted','reversed')) as posted_count
    from finance.accounting_periods ap where ap.company_id = ${u.companyId}::uuid order by ap.starts_on desc`;
  return { items: rows };
}
export async function createPeriods(body: Record<string, unknown>, u: User, rid: string) {
  need(u, "admin");
  const year = Number(body.year);
  if (!Number.isInteger(year) || year < 2020 || year > 2100) fail(400, "ปีไม่ถูกต้อง (ค.ศ.)");
  return await db().begin(async (tx: Tx) => {
    const n = await createYearPeriods(tx, u, year);
    await audit(tx, u, "create_periods", "accounting_period", String(year), { year, created: n }, rid);
    return { year, created: n };
  });
}
export async function closePeriod(body: Record<string, unknown>, u: User, rid: string) {
  need(u, "admin");
  const id = uuid(body.period_id, "รอบบัญชี")!;
  return await db().begin(async (tx: Tx) => {
    const [p] = await tx`select * from finance.accounting_periods where id = ${id}::uuid and company_id = ${u.companyId}::uuid for update`;
    if (!p) fail(404, "ไม่พบรอบบัญชี");
    if (!["open", "reopened"].includes(p.status)) fail(409, "รอบบัญชีนี้ปิดอยู่แล้ว");
    const [chk] = await tx`select
        (select count(*)::int from finance.documents where company_id = ${u.companyId}::uuid and document_date between ${p.starts_on} and ${p.ends_on} and status in ('draft','pending_review')) as docs,
        (select count(*)::int from finance.journal_entries where company_id = ${u.companyId}::uuid and journal_date between ${p.starts_on} and ${p.ends_on} and status in ('draft','pending_review')) as journals,
        (select count(*)::int from finance.payments where company_id = ${u.companyId}::uuid and payment_date between ${p.starts_on} and ${p.ends_on} and status in ('pending','approved')) as payments`;
    const issues = [chk.docs && chk.docs + " เอกสารยังไม่อนุมัติ", chk.journals && chk.journals + " สมุดรายวันยังไม่ลงบัญชี", chk.payments && chk.payments + " รายการรับ/จ่ายยังไม่เสร็จ"].filter(Boolean);
    if (issues.length) fail(409, "ปิดรอบ " + p.period_code + " ไม่ได้: " + issues.join(", "));
    const [out] = await tx`update finance.accounting_periods set status = 'closed', closed_by = ${u.actorRef}, closed_at = now(), close_note = ${opt(body.note, 500)}
      where id = ${id}::uuid returning id, period_code, status, closed_at`;
    await audit(tx, u, "close", "accounting_period", id, out, rid);
    return out;
  });
}
export async function reopenPeriod(body: Record<string, unknown>, u: User, rid: string) {
  need(u, "admin");
  const id = uuid(body.period_id, "รอบบัญชี")!;
  const reason = text(body.reason, 500);
  if (!reason) fail(400, "กรุณาระบุเหตุผลที่เปิดรอบบัญชีใหม่");
  return await db().begin(async (tx: Tx) => {
    const [p] = await tx`select status from finance.accounting_periods where id = ${id}::uuid and company_id = ${u.companyId}::uuid for update`;
    if (!p) fail(404, "ไม่พบรอบบัญชี");
    if (p.status !== "closed") fail(409, "เปิดใหม่ได้เฉพาะรอบที่ปิดแล้ว");
    const [out] = await tx`update finance.accounting_periods set status = 'reopened', reopened_by = ${u.actorRef}, reopened_at = now(), close_note = ${reason}
      where id = ${id}::uuid returning id, period_code, status, reopened_at`;
    await audit(tx, u, "reopen", "accounting_period", id, { ...out, reason }, rid);
    return out;
  });
}

export async function submitJournal(body: Record<string, unknown>, u: User, rid: string) {
  need(u, "write");
  const id = uuid(body.journal_id, "สมุดรายวัน")!;
  return await db().begin(async (tx: Tx) => {
    const [je] = await tx`select id, status, source_type from finance.journal_entries where id = ${id}::uuid and company_id = ${u.companyId}::uuid for update`;
    if (!je) fail(404, "ไม่พบสมุดรายวัน");
    if (je.status !== "draft") fail(409, "ส่งตรวจได้เฉพาะสมุดรายวันฉบับร่าง");
    const [out] = await tx`update finance.journal_entries set status = 'pending_review', review_note = null where id = ${id}::uuid returning id, journal_number, status`;
    await approvalEvent(tx, u, "journal", id, "submitted", opt(body.note, 500), rid);
    await audit(tx, u, "submit", "journal", id, out, rid);
    return out;
  });
}
