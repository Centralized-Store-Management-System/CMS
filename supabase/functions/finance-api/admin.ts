// ข้อมูลหลักและการดูแลระบบ: บริษัท, ตั้งค่าเริ่มต้น, ผังบัญชี, คู่ค้า, ผู้ใช้งาน Finance, รายการรออนุมัติ, ประวัติ, ล้างข้อมูลทดสอบ, เริ่มใช้งานจริง
import { audit, db, fail, money, oneOf, opt, text, todayBangkok, Tx, uuid } from "./util.ts";
import { cmsCall, need, User } from "./auth.ts";
import { createYearPeriods, ensureDefaults } from "./posting.ts";

export async function getCompany(_url: URL, u: User) {
  const [c] = await db()`select id, legal_name, tax_id, branch_type, branch_number, address, vat_registered, fiscal_year_start_month, currency_code, status, environment, allow_self_approval, go_live_at, go_live_by, created_at
    from finance.companies where id = ${u.companyId}::uuid`;
  return { company: c };
}

export async function updateCompany(body: Record<string, unknown>, u: User, rid: string) {
  need(u, "admin");
  const name = text(body.legal_name, 200);
  if (!name) fail(400, "กรุณาระบุชื่อบริษัท/กิจการ");
  const taxId = text(body.tax_id, 13);
  if (taxId && !/^\d{13}$/.test(taxId)) fail(400, "เลขประจำตัวผู้เสียภาษีต้องมี 13 หลัก");
  const branchType = oneOf(body.branch_type || "head_office", ["head_office", "branch"] as const, "สำนักงาน");
  const fy = Number(body.fiscal_year_start_month || 1);
  if (!Number.isInteger(fy) || fy < 1 || fy > 12) fail(400, "เดือนเริ่มรอบปีบัญชีไม่ถูกต้อง");
  return await db().begin(async (tx: Tx) => {
    const [old] = await tx`select legal_name, tax_id, vat_registered, allow_self_approval from finance.companies where id = ${u.companyId}::uuid for update`;
    const [c] = await tx`update finance.companies set legal_name = ${name}, tax_id = ${taxId || null}, branch_type = ${branchType},
        branch_number = ${branchType === "branch" ? opt(body.branch_number, 5) : null}, address = ${tx.json({ text: text(body.address, 500) })},
        vat_registered = ${body.vat_registered === true}, fiscal_year_start_month = ${fy}, allow_self_approval = ${body.allow_self_approval === true}
      where id = ${u.companyId}::uuid returning id, legal_name, tax_id, vat_registered, allow_self_approval, fiscal_year_start_month`;
    await audit(tx, u, "update", "company", u.companyId, c, rid, old);
    return c;
  });
}

// ตั้งค่าเริ่มต้น: ผังบัญชีมาตรฐาน + รอบบัญชีของปีนี้ (กดซ้ำได้ ไม่สร้างซ้ำ)
export async function setupDefaults(body: Record<string, unknown>, u: User, rid: string) {
  need(u, "admin");
  const year = Number(body.year || todayBangkok().slice(0, 4));
  return await db().begin(async (tx: Tx) => {
    const accounts = await ensureDefaults(tx, u);
    const periods = await createYearPeriods(tx, u, year);
    await audit(tx, u, "setup_defaults", "company", u.companyId, { accounts, periods, year }, rid);
    return { accounts_created: accounts, periods_created: periods, year };
  });
}

export async function listAccounts(url: URL, u: User) {
  const all = url.searchParams.get("all") === "1";
  const rows = await db()`select a.id, a.account_code, a.account_name, a.account_type, a.system_key, a.is_active, a.description, a.parent_id,
      exists(select 1 from finance.journal_lines jl where jl.account_id = a.id) as used
    from finance.chart_of_accounts a where a.company_id = ${u.companyId}::uuid and (${all} or a.is_active) order by a.account_code`;
  return { items: rows };
}

export async function saveAccount(body: Record<string, unknown>, u: User, rid: string) {
  need(u, "admin");
  const id = uuid(body.id, "บัญชี", false);
  const name = text(body.account_name, 200);
  if (!name) fail(400, "กรุณาระบุชื่อบัญชี");
  return await db().begin(async (tx: Tx) => {
    if (id) {
      const [old] = await tx`select * from finance.chart_of_accounts where id = ${id}::uuid and company_id = ${u.companyId}::uuid for update`;
      if (!old) fail(404, "ไม่พบบัญชี");
      const active = body.is_active !== false;
      if (!active && old.system_key) fail(409, "บัญชีระบบ (ใช้ลงบัญชีอัตโนมัติ) ปิดใช้งานไม่ได้");
      const [a] = await tx`update finance.chart_of_accounts set account_name = ${name}, description = ${opt(body.description, 300)}, is_active = ${active}
        where id = ${id}::uuid returning id, account_code, account_name, account_type, is_active`;
      await audit(tx, u, "update", "chart_of_account", id, a, rid, { account_name: old.account_name, is_active: old.is_active });
      return a;
    }
    const code = text(body.account_code, 20);
    if (!/^[0-9A-Za-z.-]{2,20}$/.test(code)) fail(400, "รหัสบัญชีต้องเป็นตัวเลข/ตัวอักษร 2–20 ตัว");
    const type = oneOf(body.account_type, ["asset", "liability", "equity", "revenue", "expense"] as const, "ประเภทบัญชี");
    const [a] = await tx`insert into finance.chart_of_accounts (company_id, account_code, account_name, account_type, description)
      values (${u.companyId}::uuid, ${code}, ${name}, ${type}, ${opt(body.description, 300)}) returning id, account_code, account_name, account_type, is_active`;
    await audit(tx, u, "create", "chart_of_account", a.id, a, rid);
    return a;
  });
}

const PCOLS = "id, partner_type, display_name, legal_name, tax_id, branch_number, email, phone, address, default_wht_type, default_wht_rate, is_active, created_at";
export async function listPartners(url: URL, u: User) {
  const q = text(url.searchParams.get("q"), 80);
  const type = text(url.searchParams.get("type"), 20);
  const all = url.searchParams.get("all") === "1";
  const rows = await db()`select id, partner_type, display_name, legal_name, tax_id, branch_number, email, phone, address, default_wht_type, default_wht_rate, is_active, created_at
    from finance.partners where company_id = ${u.companyId}::uuid and (${all} or is_active)
      and (${type} = '' or partner_type = ${type} or partner_type = 'both')
      and (${q} = '' or display_name ilike ${"%" + q + "%"} or coalesce(tax_id,'') like ${q + "%"})
    order by display_name limit 500`;
  return { items: rows };
}

export async function savePartner(body: Record<string, unknown>, u: User, rid: string) {
  need(u, "write");
  const id = uuid(body.id, "คู่ค้า", false);
  const name = text(body.display_name, 200);
  if (!name) fail(400, "กรุณาระบุชื่อคู่ค้า");
  const type = oneOf(body.partner_type, ["customer", "vendor", "both", "employee", "government"] as const, "ประเภทคู่ค้า");
  const taxId = text(body.tax_id, 13);
  if (taxId && !/^\d{13}$/.test(taxId)) fail(400, "เลขประจำตัวผู้เสียภาษีต้องมี 13 หลัก");
  const whtType = text(body.default_wht_type, 10).toLowerCase();
  if (whtType && !["pnd3", "pnd53"].includes(whtType)) fail(400, "ประเภทแบบหัก ณ ที่จ่ายต้องเป็น ภ.ง.ด.3 (บุคคล) หรือ ภ.ง.ด.53 (นิติบุคคล)");
  const whtRate = body.default_wht_rate === "" || body.default_wht_rate == null ? null : money(body.default_wht_rate, "อัตราหัก ณ ที่จ่าย");
  const email = text(body.email, 254);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail(400, "อีเมลไม่ถูกต้อง");
  return await db().begin(async (tx: Tx) => {
    const vals = { name, type, legal: opt(body.legal_name, 200), taxId: taxId || null, branch: opt(body.branch_number, 5), email: email || null, phone: opt(body.phone, 40), addr: tx.json({ text: text(body.address, 500) }), whtType: whtType || null, whtRate };
    if (id) {
      const [old] = await tx`select * from finance.partners where id = ${id}::uuid and company_id = ${u.companyId}::uuid for update`;
      if (!old) fail(404, "ไม่พบคู่ค้า");
      const [p] = await tx`update finance.partners set partner_type = ${vals.type}, display_name = ${vals.name}, legal_name = ${vals.legal}, tax_id = ${vals.taxId}, branch_number = ${vals.branch},
          email = ${vals.email}, phone = ${vals.phone}, address = ${vals.addr}, default_wht_type = ${vals.whtType}, default_wht_rate = ${vals.whtRate}, is_active = ${body.is_active !== false}
        where id = ${id}::uuid returning id, display_name, partner_type, is_active`;
      await audit(tx, u, "update", "partner", id, p, rid, { display_name: old.display_name, tax_id: old.tax_id, is_active: old.is_active });
      return p;
    }
    const [p] = await tx`insert into finance.partners (company_id, partner_type, display_name, legal_name, tax_id, branch_number, email, phone, address, default_wht_type, default_wht_rate)
      values (${u.companyId}::uuid, ${vals.type}, ${vals.name}, ${vals.legal}, ${vals.taxId}, ${vals.branch}, ${vals.email}, ${vals.phone}, ${vals.addr}, ${vals.whtType}, ${vals.whtRate})
      returning id, display_name, partner_type, is_active`;
    await audit(tx, u, "create", "partner", p.id, p, rid);
    return p;
  });
}

// ---- ผู้ใช้งาน Finance (สิทธิ์ในระบบ Finance เท่านั้น ไม่แก้ผู้ใช้/สิทธิ์ของ CMS) ----
export async function listUsers(_url: URL, u: User) {
  need(u, "admin");
  const rows = await db()`select cms_actor_ref, role_code, display_name, is_active, granted_by, created_at, updated_at from finance.user_roles
    where company_id = ${u.companyId}::uuid order by is_active desc, role_code = 'owner' desc, display_name`;
  return { items: rows };
}
// รายชื่อผู้ใช้ CMS ที่เลือกมาให้สิทธิ์ได้ (อ่านจาก CMS ด้วย Session ของ Owner — CMS เป็นเจ้าของข้อมูลผู้ใช้)
export async function cmsUsers(_url: URL, u: User) {
  need(u, "admin");
  const boot = await cmsCall("bootstrap", u.token, 20000) as { tables?: { users?: Record<string, unknown>[] } };
  const list = (boot && boot.tables && boot.tables.users || [])
    .filter(x => x && x.id && x.id !== "owner" && String(x.status || "active") === "active")
    .map(x => ({ actor_ref: "u:" + String(x.id), name: String(x.name || x.username || x.id), username: String(x.username || ""), cms_role: String(x.role || ""), branch: String(x.branch || "") }));
  return { items: list };
}
export async function setUser(body: Record<string, unknown>, u: User, rid: string) {
  need(u, "admin");
  const ref = text(body.actor_ref, 90);
  if (!/^u:[\w.-]{1,80}$/.test(ref)) fail(400, "รหัสผู้ใช้ไม่ถูกต้อง (เลือกจากรายชื่อผู้ใช้ CMS)");
  const role = oneOf(body.role, ["manager", "staff", "verifier", "approver", "accountant", "viewer"] as const, "สิทธิ์");
  const name = text(body.display_name, 120) || ref;
  const active = body.is_active !== false;
  return await db().begin(async (tx: Tx) => {
    const [old] = await tx`select role_code, is_active from finance.user_roles where company_id = ${u.companyId}::uuid and cms_actor_ref = ${ref}`;
    const [r] = await tx`insert into finance.user_roles (company_id, cms_actor_ref, role_code, is_active, display_name, granted_by)
      values (${u.companyId}::uuid, ${ref}, ${role}, ${active}, ${name}, ${u.actorRef})
      on conflict (company_id, cms_actor_ref) do update set role_code = excluded.role_code, is_active = excluded.is_active, display_name = excluded.display_name, granted_by = excluded.granted_by
      returning cms_actor_ref, role_code, is_active, display_name`;
    await audit(tx, u, old ? "update" : "grant", "user_role", ref, r, rid, old || null);
    return r;
  });
}

export async function approvalsQueue(_url: URL, u: User) {
  need(u, "approve");
  const sql = db();
  const [docs, pays, toPay, journals, filings] = await Promise.all([
    sql`select d.id, d.document_type, d.document_number, d.document_date, d.grand_total, d.created_by, p.display_name as partner_name from finance.documents d left join finance.partners p on p.id = d.partner_id
        where d.company_id = ${u.companyId}::uuid and d.status = 'pending_review' order by d.document_date limit 100`,
    sql`select p.id, p.payment_type, p.payment_date, p.amount, p.method, p.created_by, d.document_number from finance.payments p left join finance.documents d on d.id = p.document_id
        where p.company_id = ${u.companyId}::uuid and p.status = 'pending' order by p.payment_date limit 100`,
    sql`select p.id, p.payment_type, p.payment_date, p.amount, p.method, p.created_by, p.approved_by, d.document_number from finance.payments p left join finance.documents d on d.id = p.document_id
        where p.company_id = ${u.companyId}::uuid and p.status = 'approved' order by p.payment_date limit 100`,
    sql`select id, journal_number, journal_date, description, total_debit, created_by from finance.journal_entries where company_id = ${u.companyId}::uuid and status = 'pending_review' order by journal_date limit 100`,
    sql`select id, form_code, tax_period, return_amount, prepared_by, due_date from finance.tax_filings where company_id = ${u.companyId}::uuid and status = 'review' order by due_date limit 50`,
  ]);
  return { documents: docs, payments: pays, to_pay: toPay, journals, filings };
}

export async function listAudit(url: URL, u: User) {
  need(u, "approve");
  const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit")) || 50));
  const offset = Math.max(0, Number(url.searchParams.get("offset")) || 0);
  const entity = text(url.searchParams.get("entity"), 30);
  const rows = await db()`select a.id, a.actor_ref, coalesce(ur.display_name, a.actor_ref) as actor_name, a.action, a.entity_type, a.entity_id, a.after_data, a.created_at
    from finance.audit_events a left join finance.user_roles ur on ur.company_id = a.company_id and ur.cms_actor_ref = a.actor_ref
    where a.company_id = ${u.companyId}::uuid and (${entity} = '' or a.entity_type = ${entity}) order by a.created_at desc limit ${limit} offset ${offset}`;
  return { items: rows, limit, offset };
}

// ล้างข้อมูลทดสอบ (เฉพาะบริษัททดสอบ) — ต้องพิมพ์ยืนยัน
export async function purgeTestData(body: Record<string, unknown>, u: User, rid: string) {
  need(u, "admin");
  if (u.environment !== "uat") fail(409, "บริษัทนี้เริ่มใช้งานจริงแล้ว ล้างข้อมูลไม่ได้");
  if (text(body.confirm, 40) !== "ล้างข้อมูลทดสอบ") fail(400, "พิมพ์คำว่า \"ล้างข้อมูลทดสอบ\" เพื่อยืนยัน");
  const keep = body.keep_setup !== false;
  return await db().begin(async (tx: Tx) => {
    const [r] = await tx`select finance.purge_company_transactions(${u.companyId}::uuid, ${keep}) as n`;
    await audit(tx, u, "purge_test_data", "company", u.companyId, { keep_setup: keep, deleted: r.n }, rid);
    return { deleted: r.n, keep_setup: keep };
  });
}

// เริ่มใช้งานจริง: ล้างรายการทดสอบทั้งหมด (เก็บผังบัญชี คู่ค้า รอบบัญชี ผู้ใช้) แล้วเปลี่ยนเป็นบริษัทจริงถาวร
export async function goLive(body: Record<string, unknown>, u: User, _rid: string) {
  need(u, "admin");
  if (u.environment !== "uat") fail(409, "เริ่มใช้งานจริงไปแล้ว");
  if (text(body.confirm, 40) !== "เริ่มใช้งานจริง") fail(400, "พิมพ์คำว่า \"เริ่มใช้งานจริง\" เพื่อยืนยัน");
  return await db().begin(async (tx: Tx) => {
    const [c] = await tx`select legal_name, tax_id from finance.companies where id = ${u.companyId}::uuid`;
    if (!c.legal_name || /test|ทดสอบ/i.test(c.legal_name)) fail(409, "กรุณาแก้ชื่อบริษัทจริงที่ ข้อมูลบริษัท ก่อนเริ่มใช้งานจริง");
    const [r] = await tx`select finance.go_live(${u.companyId}::uuid, ${u.actorRef}) as n`;
    return { deleted: r.n, environment: "production" };
  });
}
