// รายงานบัญชี: งบทดลอง, กำไรขาดทุน, งบดุล, บัญชีแยกประเภท, อายุลูกหนี้/เจ้าหนี้, ภาพรวม
// อ่านจากสมุดรายวันที่ลงบัญชีแล้วเท่านั้น (posted + reversed — รายการที่ถูกกลับจะหักล้างกับรายการกลับเอง)
import { date, db, fail, num, round2, text, todayBangkok, uuid } from "./util.ts";
import type { User } from "./auth.ts";
import { REVENUE_DOCS, EXPENSE_DOCS } from "./posting.ts";

const POSTED = ["posted", "reversed"];
const normal = (type: string) => (type === "asset" || type === "expense") ? 1 : -1;   // ยอดปกติ: สินทรัพย์/ค่าใช้จ่าย = เดบิต

function range(url: URL) {
  const t = todayBangkok();
  const from = url.searchParams.get("from") ? date(url.searchParams.get("from"), "วันที่เริ่ม") : t.slice(0, 8) + "01";
  const to = url.searchParams.get("to") ? date(url.searchParams.get("to"), "วันที่สิ้นสุด") : t;
  if (from > to) fail(400, "วันที่เริ่มต้องไม่เกินวันที่สิ้นสุด");
  return { from, to };
}

export async function trialBalance(url: URL, u: User) {
  const { from, to } = range(url);
  const rows = await db()`select a.id, a.account_code, a.account_name, a.account_type,
      coalesce(sum(case when je.journal_date < ${from}::date then jl.debit - jl.credit end), 0) as opening,
      coalesce(sum(case when je.journal_date between ${from}::date and ${to}::date then jl.debit end), 0) as debit,
      coalesce(sum(case when je.journal_date between ${from}::date and ${to}::date then jl.credit end), 0) as credit
    from finance.chart_of_accounts a
      left join finance.journal_lines jl on jl.account_id = a.id
      left join finance.journal_entries je on je.id = jl.journal_entry_id and je.status = any(${POSTED}) and je.journal_date <= ${to}::date
    where a.company_id = ${u.companyId}::uuid and (je.id is not null or jl.id is null)
    group by a.id order by a.account_code`;
  const items = rows.map((r: Record<string, unknown>) => {
    const opening = num(r.opening), debit = num(r.debit), credit = num(r.credit);
    return { ...r, opening: round2(opening), debit: round2(debit), credit: round2(credit), closing: round2(opening + debit - credit) };
  }).filter((r: { opening: number; debit: number; credit: number }) => r.opening || r.debit || r.credit);
  const t = items.reduce((a: { debit: number; credit: number }, r: { debit: number; credit: number }) => ({ debit: a.debit + r.debit, credit: a.credit + r.credit }), { debit: 0, credit: 0 });
  return { from, to, items, totals: { debit: round2(t.debit), credit: round2(t.credit), balanced: Math.abs(t.debit - t.credit) < 0.005 } };
}

async function balances(u: User, from: string | null, to: string, types: string[]) {
  return await db()`select a.id, a.account_code, a.account_name, a.account_type, a.system_key, coalesce(sum(jl.debit - jl.credit), 0) as bal
    from finance.chart_of_accounts a
      join finance.journal_lines jl on jl.account_id = a.id
      join finance.journal_entries je on je.id = jl.journal_entry_id and je.status = any(${POSTED})
    where a.company_id = ${u.companyId}::uuid and a.account_type = any(${types}) and je.journal_date <= ${to}::date and (${from}::date is null or je.journal_date >= ${from}::date)
    group by a.id order by a.account_code`;
}

export async function profitLoss(url: URL, u: User) {
  const { from, to } = range(url);
  const rows = await balances(u, from, to, ["revenue", "expense"]);
  const map = (t: string) => rows.filter((r: Record<string, unknown>) => r.account_type === t).map((r: Record<string, unknown>) => ({ account_code: r.account_code, account_name: r.account_name, amount: round2(num(r.bal) * normal(t)) })).filter((r: { amount: number }) => r.amount);
  const revenue = map("revenue"), expense = map("expense");
  const tr = round2(revenue.reduce((a: number, r: { amount: number }) => a + r.amount, 0)), te = round2(expense.reduce((a: number, r: { amount: number }) => a + r.amount, 0));
  return { from, to, revenue, expense, totals: { revenue: tr, expense: te, net: round2(tr - te) } };
}

export async function balanceSheet(url: URL, u: User) {
  const asOf = url.searchParams.get("as_of") ? date(url.searchParams.get("as_of"), "ณ วันที่") : todayBangkok();
  const rows = await balances(u, null, asOf, ["asset", "liability", "equity", "revenue", "expense"]);
  const sect = (t: string) => rows.filter((r: Record<string, unknown>) => r.account_type === t).map((r: Record<string, unknown>) => ({ account_code: r.account_code, account_name: r.account_name, amount: round2(num(r.bal) * normal(t)) })).filter((r: { amount: number }) => r.amount);
  const earnings = round2(rows.filter((r: Record<string, unknown>) => r.account_type === "revenue" || r.account_type === "expense").reduce((a: number, r: Record<string, unknown>) => a - num(r.bal), 0));
  const assets = sect("asset"), liabilities = sect("liability"), equity = sect("equity");
  if (earnings) equity.push({ account_code: "", account_name: "กำไร (ขาดทุน) สะสมที่ยังไม่ได้ปิดบัญชี", amount: earnings });
  const s = (a: { amount: number }[]) => round2(a.reduce((x, r) => x + r.amount, 0));
  const ta = s(assets), tl = s(liabilities), te = s(equity);
  return { as_of: asOf, assets, liabilities, equity, totals: { assets: ta, liabilities: tl, equity: te, liabilities_equity: round2(tl + te), balanced: Math.abs(ta - tl - te) < 0.005 } };
}

export async function ledger(url: URL, u: User) {
  const { from, to } = range(url);
  const accountId = uuid(url.searchParams.get("account_id"), "บัญชี")!;
  const sql = db();
  const [acc] = await sql`select id, account_code, account_name, account_type from finance.chart_of_accounts where id = ${accountId}::uuid and company_id = ${u.companyId}::uuid`;
  if (!acc) fail(404, "ไม่พบบัญชี");
  const [op] = await sql`select coalesce(sum(jl.debit - jl.credit), 0) as bal from finance.journal_lines jl join finance.journal_entries je on je.id = jl.journal_entry_id
    where jl.account_id = ${accountId}::uuid and je.status = any(${POSTED}) and je.journal_date < ${from}::date`;
  const lines = await sql`select je.journal_date, je.journal_number, je.id as journal_id, je.source_type, coalesce(jl.description, je.description) as description, jl.debit, jl.credit, p.display_name as partner_name
    from finance.journal_lines jl join finance.journal_entries je on je.id = jl.journal_entry_id left join finance.partners p on p.id = jl.partner_id
    where jl.account_id = ${accountId}::uuid and je.status = any(${POSTED}) and je.journal_date between ${from}::date and ${to}::date
    order by je.journal_date, je.journal_number, jl.line_no limit 2000`;
  let run = num(op.bal);
  const items = lines.map((l: Record<string, unknown>) => { run = round2(run + num(l.debit) - num(l.credit)); return { ...l, balance: run }; });
  return { from, to, account: acc, opening: round2(num(op.bal)), items, closing: run };
}

export async function aging(url: URL, u: User) {
  const kind = text(url.searchParams.get("kind"), 3) === "ap" ? "ap" : "ar";
  const asOf = url.searchParams.get("as_of") ? date(url.searchParams.get("as_of"), "ณ วันที่") : todayBangkok();
  const types = kind === "ar" ? REVENUE_DOCS.filter(t => t !== "credit_note") : EXPENSE_DOCS;
  const rows = await db()`select d.id, d.document_number, d.document_type, d.document_date, d.due_date, d.grand_total, p.id as partner_id, coalesce(p.display_name, 'ไม่ระบุคู่ค้า') as partner_name,
      d.grand_total - coalesce((select sum(pa.amount) from finance.payment_allocations pa join finance.payments x on x.id = pa.payment_id where pa.document_id = d.id and x.payment_date <= ${asOf}::date), 0) as outstanding,
      (${asOf}::date - coalesce(d.due_date, d.document_date)) as days_over
    from finance.documents d left join finance.partners p on p.id = d.partner_id
    where d.company_id = ${u.companyId}::uuid and d.status = 'posted' and d.document_type = any(${types}) and d.document_date <= ${asOf}::date`;
  const open = rows.map((r: Record<string, unknown>) => ({ ...r, outstanding: round2(num(r.outstanding)), days_over: Number(r.days_over) })).filter((r: { outstanding: number }) => r.outstanding > 0.004);
  const bucket = (d: number) => d <= 0 ? "current" : d <= 30 ? "d1_30" : d <= 60 ? "d31_60" : d <= 90 ? "d61_90" : "d90p";
  const by = new Map<string, Record<string, number | string>>();
  for (const r of open as { partner_id: string; partner_name: string; outstanding: number; days_over: number }[]) {
    const k = r.partner_id || "-";
    const x = by.get(k) || { partner_name: r.partner_name, current: 0, d1_30: 0, d31_60: 0, d61_90: 0, d90p: 0, total: 0 };
    const b = bucket(r.days_over);
    x[b] = round2(Number(x[b]) + r.outstanding); x.total = round2(Number(x.total) + r.outstanding);
    by.set(k, x);
  }
  const partners = [...by.values()].sort((a, b) => Number(b.total) - Number(a.total));
  const totals = partners.reduce<Record<string, number>>((a, r) => { for (const k of ["current", "d1_30", "d31_60", "d61_90", "d90p", "total"]) a[k] = round2((a[k] || 0) + Number(r[k])); return a; }, {});
  return { kind, as_of: asOf, documents: open, partners, totals };
}

export async function summary(_url: URL, u: User) {
  const sql = db();
  const t = todayBangkok(), m0 = t.slice(0, 8) + "01";
  const six = new Date(Date.UTC(Number(t.slice(0, 4)), Number(t.slice(5, 7)) - 6, 1)).toISOString().slice(0, 10);
  const [kpi] = await sql`select
      coalesce(sum(case when a.account_type = 'revenue' and je.journal_date >= ${m0}::date then jl.credit - jl.debit end), 0) as revenue_mtd,
      coalesce(sum(case when a.account_type = 'expense' and je.journal_date >= ${m0}::date then jl.debit - jl.credit end), 0) as expense_mtd,
      coalesce(sum(case when a.system_key in ('cash','bank') then jl.debit - jl.credit end), 0) as cash,
      coalesce(sum(case when a.system_key = 'ar' then jl.debit - jl.credit end), 0) as ar,
      coalesce(sum(case when a.system_key = 'ap' then jl.credit - jl.debit end), 0) as ap,
      coalesce(sum(case when a.system_key in ('vat_output','vat_payable') then jl.credit - jl.debit when a.system_key = 'vat_input' then jl.credit - jl.debit end), 0) as vat_due,
      coalesce(sum(case when a.system_key = 'wht_payable' then jl.credit - jl.debit end), 0) as wht_due
    from finance.journal_lines jl join finance.journal_entries je on je.id = jl.journal_entry_id and je.status = any(${POSTED}) and je.journal_date <= ${t}::date
      join finance.chart_of_accounts a on a.id = jl.account_id
    where jl.company_id = ${u.companyId}::uuid`;
  const series = await sql`select to_char(je.journal_date, 'YYYY-MM') as m,
      coalesce(sum(case when a.account_type = 'revenue' then jl.credit - jl.debit end), 0) as revenue,
      coalesce(sum(case when a.account_type = 'expense' then jl.debit - jl.credit end), 0) as expense
    from finance.journal_lines jl join finance.journal_entries je on je.id = jl.journal_entry_id and je.status = any(${POSTED})
      join finance.chart_of_accounts a on a.id = jl.account_id
    where jl.company_id = ${u.companyId}::uuid and je.journal_date >= ${six}::date and je.journal_date <= ${t}::date and a.account_type in ('revenue','expense')
    group by 1 order by 1`;
  const [pend] = await sql`select
      (select count(*)::int from finance.documents where company_id = ${u.companyId}::uuid and status = 'pending_review') as documents,
      (select count(*)::int from finance.documents where company_id = ${u.companyId}::uuid and status = 'draft') as drafts,
      (select count(*)::int from finance.payments where company_id = ${u.companyId}::uuid and status = 'pending') as payments,
      (select count(*)::int from finance.payments where company_id = ${u.companyId}::uuid and status = 'approved') as to_pay,
      (select count(*)::int from finance.journal_entries where company_id = ${u.companyId}::uuid and status = 'pending_review') as journals,
      (select count(*)::int from finance.tax_filings where company_id = ${u.companyId}::uuid and status = 'review') as filings`;
  const filings = await sql`select form_code, tax_period, due_date, status, return_amount from finance.tax_filings where company_id = ${u.companyId}::uuid and status in ('preparing','review','approved') order by due_date limit 5`;
  const recent = await sql`select je.journal_number, je.journal_date, je.description, je.total_debit, je.source_type from finance.journal_entries je
    where je.company_id = ${u.companyId}::uuid and je.status = any(${POSTED}) order by je.posted_at desc nulls last limit 8`;
  const [setup] = await sql`select (select count(*)::int from finance.chart_of_accounts where company_id = ${u.companyId}::uuid) as accounts,
      (select count(*)::int from finance.accounting_periods where company_id = ${u.companyId}::uuid) as periods,
      (select count(*)::int from finance.accounting_periods where company_id = ${u.companyId}::uuid and ${t}::date between starts_on and ends_on and status in ('open','reopened')) as open_now`;
  const r2 = (v: unknown) => round2(num(v));
  return {
    today: t,
    kpi: { revenue_mtd: r2(kpi.revenue_mtd), expense_mtd: r2(kpi.expense_mtd), profit_mtd: round2(num(kpi.revenue_mtd) - num(kpi.expense_mtd)), cash: r2(kpi.cash), ar: r2(kpi.ar), ap: r2(kpi.ap), vat_due: r2(kpi.vat_due), wht_due: r2(kpi.wht_due) },
    series: series.map((s: Record<string, unknown>) => ({ month: s.m, revenue: r2(s.revenue), expense: r2(s.expense) })),
    pending: pend, filings, recent, setup,
  };
}
