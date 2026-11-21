import postgres from "npm:postgres@3.4.5";

const SUPABASE_URL = (Deno.env.get("SUPABASE_URL") || "").replace(/\/$/, "");
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
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
  if (!SUPABASE_URL || !SERVICE_KEY || !DB_URL || !db) {
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
  const [mapping] = await db!.`
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
  await db!.`
    insert into finance.audit_events (company_id, actor_ref, action, entity_type, entity_id, after_data, request_id)
    values (${user.companyId}::uuid, ${user.actorRef}, ${action}, ${entityType}, ${entityId}, ${db!.json(after)}, ${requestId})
  `;
}
async function listData(url: URL, user: { companyId: string }, action: string) {
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit")) || 25));
  const offset = Math.max(0, Number(url.searchParams.get("offset")) || 0);
  if (action === "partners") {
    const rows = await db!.`
      select id, partner_type, display_name, legal_name, tax_id, branch_number, email, phone,
             address, default_wht_type, default_wht_rate, is_active, created_at, updated_at
      from finance.partners where company_id = ${user.companyId}::uuid
      order by display_name asc limit ${limit} offset ${offset}
    `;
    return { items: rows, limit, offset };
  }
  if (action === "accounts") {
    const rows = await db!.`
      select id, account_code, account_name, account_type, parent_id, is_active
      from finance.chart_of_accounts where company_id = ${user.companyId}::uuid
      order by account_code asc limit ${limit} offset ${offset}
    `;
    return { items: rows, limit, offset };
  }
  if (action === "documents") {
    const status = asText(url.searchParams.get("status"), 30);
    const rows = status
      ? await db!.`select id, document_type, document_number, document_date, due_date, partner_id, status, subtotal, discount_total, vat_total, wht_total, grand_total, currency_code, created_at from finance.documents where company_id = ${user.companyId}::uuid and status = ${status} order by document_date desc, created_at desc limit ${limit} offset ${offset}`
      : await db!.`select id, document_type, document_number, document_date, due_date, partner_id, status, subtotal, discount_total, vat_total, wht_total, grand_total, currency_code, created_at from finance.documents where company_id = ${user.companyId}::uuid order by document_date desc, created_at desc limit ${limit} offset ${offset}`;
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
    if (!description || !Number.isFinite(quantity) || quantity <= 0 || quantity > 100000000 || !Number.isFinite(unitPrice) || unitPrice < 0) {
      throw new HttpError(400, "รายละเอียด จำนวน หรือราคาของรายการที่ " + (index + 1) + " ไม่ถูกต้อง");
    }
    const amount = round2(quantity * unitPrice);
    return { description, quantity, unitPrice, amount };
  });
  const subtotal = round2(normalized.reduce((sum, line) => sum + line.amount, 0));
  const vat = round2(subtotal * vatRate / 100);
  const wht = round2(subtotal * whtRate / 100);
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
           ${vatRate}, ${round2(line.amount * vatRate / 100)}, ${whtRate}, ${round2(line.amount * whtRate / 100)}, ${line.amount})
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
    if (action === "partner.create") {
      const partner = await createPartner(body, user, requestId);
      return json({ ok: true, data: partner }, 201, origin);
    }
    if (action === "document.create") {
      const document = await createDocument(body, user, requestId, idempotencyKey);
      return json({ ok: true, data: document }, 201, origin);
    }
    if (action === "payment.approve" || action === "period.close" || action === "journal.post" || action === "tax.submit") {
      requireOwner(user);
      throw new HttpError(501, "ขั้นตอนอนุมัตินี้ยังไม่เปิดใช้จนกว่าจะเพิ่ม Workflow และทดสอบใน Staging");
    }
    throw new HttpError(404, "ไม่พบ Finance API action");
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    if (!(error instanceof HttpError)) console.error("finance-api", error);
    return json({ ok: false, error: error instanceof HttpError ? error.message : "Finance API ขัดข้องชั่วคราว" }, status, origin);
  }
});
