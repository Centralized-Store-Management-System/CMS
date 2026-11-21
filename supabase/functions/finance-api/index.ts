import postgres from "npm:postgres@3.4.5";

const SUPABASE_URL = (Deno.env.get("SUPABASE_URL") || "").replace(/\/$/, "");
const DB_URL = Deno.env.get("SUPABASE_DB_URL") || "";
const BACKOFFICE_URL = SUPABASE_URL + "/functions/v1/backoffice";
const ORIGINS = new Set([
  "https://centralized-store-management.github.io",
  "https://centralized-store-management-system.github.io",
]);
const db = DB_URL ? postgres(DB_URL, { max: 3, idle_timeout: 10, connect_timeout: 8 }) : null;

class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}
const json = (body: unknown, status = 200, origin = "") => new Response(JSON.stringify(body), {
  status,
  headers: {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store, private",
    "vary": "Origin",
    ...(origin ? {
      "access-control-allow-origin": origin,
      "access-control-allow-headers": "content-type, x-cms-session, idempotency-key",
      "access-control-allow-methods": "GET, POST, OPTIONS",
      "access-control-max-age": "600",
    } : {}),
  },
});
function requireEnv() {
  if (!SUPABASE_URL || !DB_URL || !db) {
    throw new HttpError(503, "Finance API ยังไม่ได้ตั้งค่าฐานข้อมูลและ Secrets");
  }
}
function parseBootstrap(raw: string) {
  const text = raw.trim();
  try { return JSON.parse(text); } catch (_) { /* CMS currently supports JSONP */ }
  const start = text.indexOf("("), end = text.lastIndexOf(")");
  if (start < 0 || end <= start) throw new HttpError(401, "ยืนยัน CMS Session ไม่สำเร็จ");
  try { return JSON.parse(text.slice(start + 1, end)); }
  catch (_) { throw new HttpError(401, "ข้อมูล CMS Session ไม่ถูกต้อง"); }
}
async function authenticate(token: string) {
  if (!token || token.length > 4096) throw new HttpError(401, "กรุณาเข้าสู่ระบบใหม่");
  const url = new URL(BACKOFFICE_URL);
  url.searchParams.set("action", "bootstrap");
  url.searchParams.set("t", token);
  url.searchParams.set("callback", "_finance_auth");
  url.searchParams.set("_", String(Date.now()));
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  let response: Response;
  try {
    response = await fetch(url, {
      headers: { accept: "application/json, application/javascript" },
      cache: "no-store",
      signal: controller.signal,
    });
  } catch (_) {
    throw new HttpError(503, "ไม่สามารถตรวจสอบ CMS Session ได้");
  } finally { clearTimeout(timer); }
  if (!response.ok) throw new HttpError(401, "CMS Session หมดอายุหรือไม่ถูกต้อง");
  const payload = parseBootstrap(await response.text());
  if (!payload || payload.ok === false) throw new HttpError(401, "CMS Session หมดอายุหรือไม่ถูกต้อง");
  const boot = payload.data || payload;
  const me = boot.me;
  if (!me || !me.role) throw new HttpError(401, "ไม่พบข้อมูลผู้ใช้งาน");
  const actorRef = me.id != null ? String(me.id) :
    me.username ? String(me.username) :
    me.code ? String(me.code) : "";
  if (!actorRef) throw new HttpError(403, "ไม่พบรหัสผู้ใช้งาน CMS ที่ตรวจสอบย้อนกลับได้");
  const cmsOwner = String(me.role).toLowerCase() === "owner";
  const cmsAccounting = Array.isArray(me.perms) && me.perms.map(String).includes("acct");
  if (!cmsOwner && !cmsAccounting) throw new HttpError(403, "บัญชีนี้ไม่มีสิทธิ์ Finance");
  const [mapping] = await db!`
    select ur.company_id, ur.role_code, c.legal_name, c.currency_code
    from finance.user_roles ur
    join finance.companies c on c.id = ur.company_id
    where ur.cms_actor_ref = ${actorRef} and ur.is_active = true and c.status = 'active'
    order by ur.created_at asc limit 2
  `;
  if (!mapping) throw new HttpError(403, "ยังไม่ได้กำหนดสิทธิ์ Finance ให้ผู้ใช้งานนี้");
  if (mapping.role_code === "owner" && !cmsOwner) throw new HttpError(403, "สิทธิ์ CMS ไม่ตรงกับ Finance Owner");
  if (mapping.role_code === "accounting" && !cmsAccounting && !cmsOwner) throw new HttpError(403, "สิทธิ์ CMS ไม่ตรงกับ Finance Accounting");
  const [second] = await db!`
    select id from finance.user_roles
    where cms_actor_ref = ${actorRef} and is_active = true
    offset 1 limit 1
  `;
  if (second) throw new HttpError(409, "ผู้ใช้งานถูกผูกกับหลายบริษัท ต้องกำหนด Company Context ก่อน");
  return {
    actorRef,
    displayName: String(me.name || me.displayName || me.username || me.code || "CMS User"),
    role: mapping.role_code as "owner" | "accounting",
    companyId: String(mapping.company_id),
    companyName: String(mapping.legal_name),
    currency: String(mapping.currency_code || "THB"),
  };
}
function requireOwner(user: { role: string }) {
  if (user.role !== "owner") throw new HttpError(403, "รายการนี้ต้องได้รับอนุมัติจาก Finance Owner");
}
function asText(value: unknown, max = 500) {
  return String(value ?? "").trim().slice(0, max);
}
function asMoney(value: unknown, label: string) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > 9999999999999999) throw new HttpError(400, label + " ไม่ถูกต้อง");
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
function round2(n: number) { return Math.round((n + Number.EPSILON) * 100) / 100; }
function validDate(value: unknown, label: string) {
  const s = asText(value, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || Number.isNaN(Date.parse(s)) || new Date(s + "T00:00:00Z").toISOString().slice(0, 10) !== s) throw new HttpError(400, label + " ไม่ถูกต้อง");
  return s;
}
async function audit(user: { actorRef: string; companyId: string }, action: string, entityType: string, entityId: string, after: unknown, requestId: string) {
  await db!`
    insert into finance.audit_events (company_id, actor_ref, action, entity_type, entity_id, after_data, request_id)
    values (${user.companyId}::uuid, ${user.actorRef}, ${action}, ${entityType}, ${entityId}, ${db!.json(after)}, ${requestId})
  `;
}
async function listData(url: URL, user: { companyId: string }, action: string) {
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit")) || 25));
  const offset = Math.max(0, Number(url.searchParams.get("offset")) || 0);
  if (action === "company") {
    const [company] = await db!`select id, legal_name, tax_id, branch_type, branch_number, address, vat_registered, fiscal_year_start_month, currency_code, status from finance.companies where id = ${user.companyId}::uuid limit 1`;
    return { company };
  }
  if (action === "audit") {
    const rows = await db!`select id, actor_ref, action, entity_type, entity_id, request_id, created_at from finance.audit_events where company_id = ${user.companyId}::uuid order by created_at desc limit ${limit} offset ${offset}`;
    return { items: rows, limit, offset };
  }
  if (action === "summary") {
    const [summary] = await db!`
      select
        coalesce(sum(case when document_type in ('invoice','tax_invoice','receipt') and document_date >= date_trunc('month', current_date)::date then grand_total else 0 end),0) as revenue_mtd,
        coalesce(sum(case when document_type in ('expense','bill','payment_voucher') and document_date >= date_trunc('month', current_date)::date then grand_total else 0 end),0) as expense_mtd,
        count(*) filter (where status in ('draft','pending_review')) as pending_documents
      from finance.documents where company_id = ${user.companyId}::uuid
    `;
    return summary;
  }
  if (action === "partners") {
    const rows = await db!`
      select id, partner_type, display_name, legal_name, tax_id, branch_number, email, phone,
             address, default_wht_type, default_wht_rate, is_active, created_at, updated_at
      from finance.partners where company_id = ${user.companyId}::uuid
      order by display_name asc limit ${limit} offset ${offset}
    `;
    return { items: rows, limit, offset };
  }
  if (action === "accounts") {
    const rows = await db!`
      select id, account_code, account_name, account_type, parent_id, is_active
      from finance.chart_of_accounts where company_id = ${user.companyId}::uuid
      order by account_code asc limit ${limit} offset ${offset}
    `;
    return { items: rows, limit, offset };
  }
  if (action === "documents") {
    const status = asText(url.searchParams.get("status"), 30);
    const rows = status
      ? await db!`select id, document_type, document_number, document_date, due_date, partner_id, status, subtotal, discount_total, vat_total, wht_total, grand_total, currency_code, created_at from finance.documents where company_id = ${user.companyId}::uuid and status = ${status} order by document_date desc, created_at desc limit ${limit} offset ${offset}`
      : await db!`select id, document_type, document_number, document_date, due_date, partner_id, status, subtotal, discount_total, vat_total, wht_total, grand_total, currency_code, created_at from finance.documents where company_id = ${user.companyId}::uuid order by document_date desc, created_at desc limit ${limit} offset ${offset}`;
    return { items: rows, limit, offset };
  }
  
  if (action === "payments") {
    const status = asText(url.searchParams.get("status"), 20);
    const rows = status
      ? await db!`select id, document_id, payment_type, payment_date, amount, method, reference_number, status, approved_by, paid_at, created_by, created_at from finance.payments where company_id = ${user.companyId}::uuid and status = ${status} order by payment_date desc, created_at desc limit ${limit} offset ${offset}`
      : await db!`select id, document_id, payment_type, payment_date, amount, method, reference_number, status, approved_by, paid_at, created_by, created_at from finance.payments where company_id = ${user.companyId}::uuid order by payment_date desc, created_at desc limit ${limit} offset ${offset}`;
    return { items: rows, limit, offset };
  }
  if (action === "tax-transactions") {
    const rows = await db!`select id, document_id, tax_type, tax_period, tax_base, tax_rate, tax_amount, counterparty_id, tax_form_code, status, created_at from finance.tax_transactions where company_id = ${user.companyId}::uuid order by tax_period desc, created_at desc limit ${limit} offset ${offset}`;
    return { items: rows, limit, offset };
  }
  if (action === "journals") {
    const rows = await db!`select id, journal_number, journal_date, description, status, total_debit, total_credit, created_by, approved_by, posted_at, created_at from finance.journal_entries where company_id = ${user.companyId}::uuid order by journal_date desc, created_at desc limit ${limit} offset ${offset}`;
    return { items: rows, limit, offset };
  }
  if (action === "periods") {
    const rows = await db!`select id, period_code, starts_on, ends_on, status, closed_at from finance.accounting_periods where company_id = ${user.companyId}::uuid order by starts_on desc limit ${limit} offset ${offset}`;
    return { items: rows, limit, offset };
  }
throw new HttpError(404, "ไม่พบ Finance API action");
}
async function createPartner(body: Record<string, unknown>, user: { companyId: string; actorRef: string }, requestId: string) {
  const name = asText(body.display_name, 200);
  const type = asText(body.partner_type, 20);
  const taxId = asText(body.tax_id, 13);
  if (!name) throw new HttpError(400, "กรุณาระบุชื่อคู่ค้า");
  if (!["customer", "vendor", "both", "employee", "government"].includes(type)) throw new HttpError(400, "ประเภทคู่ค้าไม่ถูกต้อง");
  if (taxId && !/^\d{13}$/.test(taxId)) throw new HttpError(400, "เลขผู้เสียภาษีต้องมี 13 หลัก");
  const [row] = await db!.begin(async tx => {
    const [partner] = await tx.`
      insert into finance.partners
        (company_id, partner_type, display_name, legal_name, tax_id, branch_number, email, phone, address, default_wht_type, default_wht_rate)
      values (
        ${user.companyId}::uuid, ${type}, ${name}, ${asText(body.legal_name, 200) || null},
        ${taxId || null}, ${asText(body.branch_number, 20) || null},
        ${asText(body.email, 254) || null}, ${asText(body.phone, 40) || null},
        ${tx.json(body.address && typeof body.address === "object" ? body.address : {})},
        ${asText(body.default_wht_type, 30) || null},
        ${body.default_wht_rate == null || body.default_wht_rate === "" ? null : asMoney(body.default_wht_rate, "อัตราหัก ณ ที่จ่าย")}
      )
      returning id, partner_type, display_name, legal_name, tax_id, branch_number, email, phone, address, default_wht_type, default_wht_rate, is_active, created_at
    `;
    await tx.`
      insert into finance.audit_events (company_id, actor_ref, action, entity_type, entity_id, after_data, request_id)
      values (${user.companyId}::uuid, ${user.actorRef}, 'create', 'partner', ${String(partner.id)}, ${tx.json(partner)}, ${requestId})
    `;
    return [partner];
  });
  return row;
}
async function createAccount(body: Record<string, unknown>, user: { companyId: string; actorRef: string; role: string }, requestId: string) {
  requireOwner(user);
  const code = asText(body.account_code, 20), name = asText(body.account_name, 200);
  const type = asText(body.account_type, 20);
  if (!/^[0-9A-Za-z.-]{2,20}$/.test(code)) throw new HttpError(400, "รหัสบัญชีต้องมี 2–20 ตัวอักษร");
  if (!name) throw new HttpError(400, "กรุณาระบุชื่อบัญชี");
  if (!["asset", "liability", "equity", "revenue", "expense"].includes(type)) throw new HttpError(400, "ประเภทบัญชีไม่ถูกต้อง");
  const [row] = await db!.begin(async tx => {
    const [account] = await tx.`insert into finance.chart_of_accounts (company_id, account_code, account_name, account_type)
      values (${user.companyId}::uuid, ${code}, ${name}, ${type})
      returning id, account_code, account_name, account_type, parent_id, is_active`;
    await tx.`insert into finance.audit_events (company_id, actor_ref, action, entity_type, entity_id, after_data, request_id)
      values (${user.companyId}::uuid, ${user.actorRef}, 'create', 'chart_of_account', ${String(account.id)}, ${tx.json(account)}, ${requestId})`;
    return [account];
  });
  return row;
}
async function createDocument(body: Record<string, unknown>, user: { companyId: string; actorRef: string }, requestId: string, idempotencyKey: string) {
  const type = asText(body.document_type, 30);
  if (!["invoice", "tax_invoice", "receipt", "expense", "bill", "payment_voucher", "credit_note", "debit_note", "other"].includes(type)) throw new HttpError(400, "ประเภทเอกสารไม่ถูกต้อง");
  const date = validDate(body.document_date, "วันที่เอกสาร");
  const due = body.due_date ? validDate(body.due_date, "วันครบกำหนด") : null;
  if (due && due < date) throw new HttpError(400, "วันครบกำหนดต้องไม่ก่อนวันที่เอกสาร");
  const partnerId = asText(body.partner_id, 36);
  if (partnerId && !/^[0-9a-f-]{36}$/i.test(partnerId)) throw new HttpError(400, "รหัสคู่ค้าไม่ถูกต้อง");
  const lines = Array.isArray(body.lines) ? body.lines as Record<string, unknown>[] : [];
  if (!lines.length || lines.length > 200) throw new HttpError(400, "เอกสารต้องมีรายการ 1–200 รายการ");
  const vatRate = Number(body.vat_rate ?? 7), whtRate = Number(body.wht_rate ?? 0);
  if (![0, 7].includes(vatRate) || ![0, 1, 2, 3, 5, 10].includes(whtRate)) throw new HttpError(400, "อัตราภาษีไม่อยู่ในค่าที่อนุญาต");
  const normalized = lines.map((line, index) => {
    const description = asText(line.description, 500);
    const quantity = Number(line.quantity), unitPrice = Number(line.unit_price);
    if (!description || !Number.isFinite(quantity) || quantity <= 0 || quantity > 100000000 || !Number.isFinite(unitPrice) || unitPrice < 0 || unitPrice > 1000000000000) {
      throw new HttpError(400, "รายละเอียด จำนวน หรือราคาของรายการที่ " + (index + 1) + " ไม่ถูกต้อง");
    }
    const amount = round2(quantity * unitPrice);
    if (!Number.isFinite(amount) || amount > 9999999999999999) throw new HttpError(400, "มูลค่ารายการสูงเกินขอบเขตที่รองรับ");
    return { description, quantity, unitPrice, amount, vatAmount: round2(amount * vatRate / 100), whtAmount: round2(amount * whtRate / 100) };
  });
  const subtotal = round2(normalized.reduce((sum, line) => sum + line.amount, 0));
  const vat = round2(normalized.reduce((sum, line) => sum + line.vatAmount, 0));
  const wht = round2(normalized.reduce((sum, line) => sum + line.whtAmount, 0));
  const grand = round2(subtotal + vat - wht);
  const [doc] = await db!.begin(async tx => {
    if (idempotencyKey) {
      await tx.`select pg_advisory_xact_lock(hashtextextended(${user.companyId + ":" + idempotencyKey}, 0))`;
      const [existing] = await tx.`select id, document_number, status, subtotal, vat_total, wht_total, grand_total from finance.documents where company_id = ${user.companyId}::uuid and idempotency_key = ${idempotencyKey} limit 1`;
      if (existing) return [existing];
    }
    if (partnerId) {
      const [partner] = await tx.`select id from finance.partners where id = ${partnerId}::uuid and company_id = ${user.companyId}::uuid and is_active = true limit 1`;
      if (!partner) throw new HttpError(400, "ไม่พบคู่ค้าในบริษัทนี้ หรือคู่ค้าถูกปิดใช้งาน");
    }
    const [created] = await tx.`
      insert into finance.documents
        (company_id, document_type, document_date, due_date, partner_id, status, subtotal, vat_total, wht_total, grand_total, notes, created_by, idempotency_key)
      values
        (${user.companyId}::uuid, ${type}, ${date}::date, ${due}::date, ${partnerId || null}::uuid, 'draft',
         ${subtotal}, ${vat}, ${wht}, ${grand}, ${asText(body.notes, 2000) || null}, ${user.actorRef}, ${idempotencyKey || null})
      returning id, document_type, document_number, document_date, due_date, partner_id, status, subtotal, vat_total, wht_total, grand_total, currency_code, created_at
    `;
    for (let i = 0; i < normalized.length; i++) {
      const line = normalized[i];
      await tx.`
        insert into finance.document_lines
          (document_id, line_no, description, quantity, unit_price, vat_rate, vat_amount, wht_rate, wht_amount, line_total)
        values
          (${String(created.id)}::uuid, ${i + 1}, ${line.description}, ${line.quantity}, ${line.unitPrice},
           ${vatRate}, ${line.vatAmount}, ${whtRate}, ${line.whtAmount}, ${line.amount})
      `;
    }
    await tx.`
      insert into finance.audit_events (company_id, actor_ref, action, entity_type, entity_id, after_data, request_id)
      values (${user.companyId}::uuid, ${user.actorRef}, 'create', 'document', ${String(created.id)}, ${tx.json({ ...created, line_count: normalized.length })}, ${requestId})
    `;
    return [created];
  });
  return doc;
}

async function createPayment(body: Record<string, unknown>, user: { companyId: string; actorRef: string }, requestId: string, idempotencyKey: string) {
  if (!idempotencyKey || idempotencyKey.length < 8) throw new HttpError(400, "ต้องมี Idempotency Key เพื่อป้องกันการบันทึกซ้ำ");
  const type = asText(body.payment_type, 20);
  if (!["receipt", "disbursement", "refund"].includes(type)) throw new HttpError(400, "ประเภทการชำระเงินไม่ถูกต้อง");
  const date = validDate(body.payment_date, "วันที่ชำระเงิน");
  const amount = asMoney(body.amount, "จำนวนเงิน");
  if (amount <= 0) throw new HttpError(400, "จำนวนเงินต้องมากกว่า 0");
  const method = asText(body.method, 30);
  if (!["cash", "bank_transfer", "credit_card", "cheque", "other"].includes(method)) throw new HttpError(400, "ช่องทางชำระเงินไม่ถูกต้อง");
  const documentId = asText(body.document_id, 36);
  if (documentId && !/^[0-9a-f-]{36}$/i.test(documentId)) throw new HttpError(400, "รหัสเอกสารไม่ถูกต้อง");
  const [payment] = await db!.begin(async tx => {
    await tx.`select pg_advisory_xact_lock(hashtextextended(${user.companyId + ":payment:" + idempotencyKey}, 0))`;
    const [existing] = await tx.`select id, payment_type, payment_date, amount, method, reference_number, status, created_at from finance.payments where company_id=${user.companyId}::uuid and idempotency_key=${idempotencyKey} limit 1`;
    if (existing) return [existing];
    if (documentId) {
      const [doc] = await tx.`select id from finance.documents where id=${documentId}::uuid and company_id=${user.companyId}::uuid and status in ('approved','posted') limit 1`;
      if (!doc) throw new HttpError(400, "ไม่พบเอกสารที่อนุมัติแล้วในบริษัทนี้");
    }
    const [row] = await tx.`
      insert into finance.payments
        (company_id, document_id, payment_type, payment_date, amount, method, reference_number, status, created_by, idempotency_key)
      values
        (${user.companyId}::uuid, ${documentId || null}::uuid, ${type}, ${date}::date, ${amount}, ${method},
         ${asText(body.reference_number,120) || null}, 'pending', ${user.actorRef}, ${idempotencyKey})
      returning id, document_id, payment_type, payment_date, amount, method, reference_number, status, created_by, created_at
    `;
    await tx.`insert into finance.payment_events (company_id,payment_id,actor_ref,action,note,request_id)
      values (${user.companyId}::uuid,${String(row.id)}::uuid,${user.actorRef},'created',${asText(body.note,500)||null},${requestId})`;
    await tx.`insert into finance.audit_events (company_id,actor_ref,action,entity_type,entity_id,after_data,request_id)
      values (${user.companyId}::uuid,${user.actorRef},'create','payment',${String(row.id)},${tx.json(row)},${requestId})`;
    return [row];
  });
  return payment;
}
async function approvePayment(body: Record<string, unknown>, user: { companyId: string; actorRef: string; role: string }, requestId: string) {
  requireOwner(user);
  const id = asText(body.payment_id,36);
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new HttpError(400,"รหัสการชำระเงินไม่ถูกต้อง");
  const [payment] = await db!.begin(async tx => {
    const [row] = await tx.`select id,status,created_by from finance.payments where id=${id}::uuid and company_id=${user.companyId}::uuid for update`;
    if (!row) throw new HttpError(404,"ไม่พบรายการชำระเงิน");
    if (row.created_by === user.actorRef) throw new HttpError(403,"ผู้สร้างรายการไม่สามารถอนุมัติรายการของตนเองได้");
    if (row.status !== "pending") throw new HttpError(409,"รายการนี้ไม่ได้อยู่ในสถานะรออนุมัติ");
    const [updated] = await tx.`update finance.payments set status='approved', approved_by=${user.actorRef} where id=${id}::uuid and company_id=${user.companyId}::uuid returning id,payment_type,payment_date,amount,method,reference_number,status,approved_by,created_by,created_at`;
    await tx.`insert into finance.payment_events (company_id,payment_id,actor_ref,action,note,request_id) values (${user.companyId}::uuid,${id}::uuid,${user.actorRef},'approved',${asText(body.note,500)||null},${requestId})`;
    await tx.`insert into finance.approval_events (company_id,entity_type,entity_id,action,actor_ref,note,request_id) values (${user.companyId}::uuid,'payment',${id}::uuid,'approved',${user.actorRef},${asText(body.note,500)||null},${requestId})`;
    await tx.`insert into finance.audit_events (company_id,actor_ref,action,entity_type,entity_id,after_data,request_id) values (${user.companyId}::uuid,${user.actorRef},'approve','payment',${id},${tx.json(updated)},${requestId})`;
    return [updated];
  });
  return payment;
}
async function markPaymentPaid(body: Record<string, unknown>, user: { companyId: string; actorRef: string; role: string }, requestId: string) {
  requireOwner(user);
  const id=asText(body.payment_id,36);
  if(!/^[0-9a-f-]{36}$/i.test(id)) throw new HttpError(400,"รหัสการชำระเงินไม่ถูกต้อง");
  const paidAt=body.paid_at?new Date(String(body.paid_at)):new Date();
  if(Number.isNaN(paidAt.getTime())) throw new HttpError(400,"วันเวลาชำระเงินจริงไม่ถูกต้อง");
  const [payment]=await db!.begin(async tx=>{
    const [row]=await tx.`select id,status from finance.payments where id=${id}::uuid and company_id=${user.companyId}::uuid for update`;
    if(!row) throw new HttpError(404,"ไม่พบรายการชำระเงิน");
    if(row.status!=="approved") throw new HttpError(409,"ต้องอนุมัติรายการก่อนบันทึกว่าชำระแล้ว");
    const [updated]=await tx.`update finance.payments set status='paid',paid_at=${paidAt.toISOString()}::timestamptz where id=${id}::uuid and company_id=${user.companyId}::uuid returning id,status,paid_at,approved_by`;
    await tx.`insert into finance.payment_events (company_id,payment_id,actor_ref,action,note,request_id) values (${user.companyId}::uuid,${id}::uuid,${user.actorRef},'marked_paid',${asText(body.note,500)||null},${requestId})`;
    await tx.`insert into finance.audit_events (company_id,actor_ref,action,entity_type,entity_id,after_data,request_id) values (${user.companyId}::uuid,${user.actorRef},'mark_paid','payment',${id},${tx.json(updated)},${requestId})`;
    return [updated];
  });
  return payment;
}
Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin") || "";
  if (origin && !ORIGINS.has(origin)) return json({ ok: false, error: "origin_not_allowed" }, 403);
  if (req.method === "OPTIONS") return new Response("ok", { headers: {
    ...(origin ? { "access-control-allow-origin": origin } : {}),
    "access-control-allow-headers": "content-type, x-cms-session, idempotency-key",
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-max-age": "600", "vary": "Origin",
  }});
  if (req.method !== "GET" && req.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405, origin);
  try {
    requireEnv();
    const token = req.headers.get("x-cms-session") || "";
    const user = await authenticate(token);
    const url = new URL(req.url);
    const requestId = req.headers.get("x-request-id") || crypto.randomUUID();
    if (req.method === "GET") {
      const action = url.searchParams.get("action") || "session";
      if (action === "session") return json({ ok: true, data: {
        actor: { displayName: user.displayName, role: user.role },
        company: { id: user.companyId, name: user.companyName, currency: user.currency },
        capabilities: {
          readFinance: true, manageMasterData: true, prepareAccounting: true,
          approvePayments: user.role === "owner", closePeriods: user.role === "owner",
          postJournal: user.role === "owner", submitTax: user.role === "owner",
        },
      }}, 200, origin);
      return json({ ok: true, data: await listData(url, user, action) }, 200, origin);
    }
    const body = await req.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new HttpError(400, "รูปแบบข้อมูลไม่ถูกต้อง");
    const action = asText(body.action, 40);
    const idempotencyKey = asText(req.headers.get("idempotency-key") || body.idempotency_key, 120);
    if (action === "account.create") {
      const account = await createAccount(body, user, requestId);
      return json({ ok: true, data: account }, 201, origin);
    }
    if (action === "partner.create") {
      const partner = await createPartner(body, user, requestId);
      return json({ ok: true, data: partner }, 201, origin);
    }
    if (action === "document.create") {
      const document = await createDocument(body, user, requestId, idempotencyKey);
      return json({ ok: true, data: document }, 201, origin);
    }
    if (action === "payment.create") {
      const payment = await createPayment(body, user, requestId, idempotencyKey);
      return json({ ok: true, data: payment }, 201, origin);
    }
    if (action === "payment.approve") {
      const payment = await approvePayment(body, user, requestId);
      return json({ ok: true, data: payment }, 200, origin);
    }
    if (action === "payment.mark-paid") {
      const payment = await markPaymentPaid(body, user, requestId);
      return json({ ok: true, data: payment }, 200, origin);
    }
    if (action === "period.close" || action === "journal.post" || action === "tax.submit") {
      requireOwner(user);
      throw new HttpError(501, "Workflow นี้ยังไม่เปิดใช้");
    }
    throw new HttpError(404, "ไม่พบ Finance API action");
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    if (!(error instanceof HttpError)) console.error("finance-api", error);
    return json({ ok: false, error: error instanceof HttpError ? error.message : "Finance API ขัดข้องชั่วคราว" }, status, origin);
  }
});
