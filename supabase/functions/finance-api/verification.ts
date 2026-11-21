// Finance: payment evidence upload + final verification (Owner / assigned Verifier)
import { audit, db, fail, oneOf, uuid, Tx } from "./util.ts";
import { need, User } from "./auth.ts";

const BUCKET = "finance-private-documents";
const MAX_BYTES = 20 * 1024 * 1024;
const CATEGORIES = ["payment_evidence", "receipt_invoice", "tax_invoice", "wht_document", "supporting"] as const;
const MIME = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);

function storageConfig() {
  const base = (Deno.env.get("SUPABASE_URL") || "").replace(/\/$/, "");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!base || !key) fail(503, "ระบบจัดเก็บเอกสารยังไม่ได้ตั้งค่า");
  return { base, key };
}
function encodedPath(path: string) { return path.split("/").map(encodeURIComponent).join("/"); }
function safeName(name: string) {
  return String(name || "document").normalize("NFKC").replace(/[^\p{L}\p{N}._-]+/gu, "_").replace(/^\.+/, "").slice(0, 100) || "document";
}
function canSeePayment(u: User, createdBy: string | null) {
  if (u.role === "staff" && createdBy !== u.actorRef) fail(403, "ดูรายการนี้ได้เฉพาะผู้สร้างรายการ");
}
function canManagePayment(u: User, createdBy: string | null) {
  if (createdBy === u.actorRef || ["owner", "manager", "approver"].includes(u.role)) return;
  fail(403, "ดำเนินการได้เฉพาะผู้สร้างรายการ หรือ Manager");
}

export async function verificationQueue(_url: URL, u: User) {
  need(u, "read");
  const ownOnly = u.role === "staff";
  const rows = await db()`
    select p.id, p.payment_type, p.payment_date, p.amount, p.method, p.reference_number, p.status,
      p.created_by, p.paid_at, d.document_number, coalesce(pt.display_name, pt2.display_name) as partner_name,
      coalesce(v.status, 'pending') as verification_status, v.verified_by, v.verified_at,
      (select r.display_name from finance.user_roles r where r.company_id = p.company_id and r.cms_actor_ref = v.verified_by) as verified_by_name,
      (select count(*)::int from finance.document_files f where f.company_id = p.company_id and f.payment_id = p.id and f.deleted_at is null) as file_count,
      (select count(*)::int from finance.document_files f where f.company_id = p.company_id and f.payment_id = p.id and f.file_category = 'payment_evidence' and f.deleted_at is null) as evidence_count,
      coalesce((select json_agg(json_build_object('id', f.id, 'file_category', f.file_category, 'original_name', f.original_name,
        'mime_type', f.mime_type, 'size_bytes', f.size_bytes, 'created_at', f.created_at) order by f.created_at desc)
        from finance.document_files f where f.company_id = p.company_id and f.payment_id = p.id and f.deleted_at is null), '[]'::json) as files
    from finance.payments p
      left join finance.documents d on d.id = p.document_id
      left join finance.partners pt on pt.id = p.partner_id
      left join finance.partners pt2 on pt2.id = d.partner_id
      left join finance.payment_verifications v on v.company_id = p.company_id and v.payment_id = p.id
    where p.company_id = ${u.companyId}::uuid and p.status = 'paid'
      and (${ownOnly} = false or p.created_by = ${u.actorRef})
    order by p.paid_at desc nulls last, p.created_at desc limit 200`;
  return { items: rows.map((r: Record<string, unknown>) => ({
    ...r, files: typeof r.files === "string" ? JSON.parse(r.files) : (r.files || []),
  })) };
}

export async function listPaymentFiles(url: URL, u: User) {
  need(u, "read");
  const paymentId = uuid(url.searchParams.get("payment_id"), "รายการจ่าย")!;
  const sql = db();
  const [p] = await sql`select id, created_by from finance.payments where id = ${paymentId}::uuid and company_id = ${u.companyId}::uuid`;
  if (!p) fail(404, "ไม่พบรายการจ่าย");
  canSeePayment(u, p.created_by);
  const items = await sql`select id, file_category, original_name, mime_type, size_bytes, created_at, uploaded_by
    from finance.document_files where company_id = ${u.companyId}::uuid and payment_id = ${paymentId}::uuid
      and deleted_at is null order by created_at desc`;
  return { items };
}

export async function fileUrl(url: URL, u: User) {
  need(u, "read");
  const fileId = uuid(url.searchParams.get("file_id"), "ไฟล์")!;
  const sql = db();
  const [f] = await sql`select f.id, f.storage_bucket, f.object_path, p.created_by
    from finance.document_files f join finance.payments p on p.id = f.payment_id and p.company_id = f.company_id
    where f.id = ${fileId}::uuid and f.company_id = ${u.companyId}::uuid and f.deleted_at is null`;
  if (!f) fail(404, "ไม่พบไฟล์");
  canSeePayment(u, f.created_by);
  const { base, key } = storageConfig();
  const res = await fetch(`${base}/storage/v1/object/sign/${f.storage_bucket}/${encodedPath(String(f.object_path))}`, {
    method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({ expiresIn: 120 }),
  });
  if (!res.ok) fail(502, "สร้างลิงก์เปิดเอกสารไม่สำเร็จ");
  const data = await res.json();
  const signed = String(data.signedURL || data.signedUrl || "");
  if (!signed) fail(502, "ระบบไม่ส่งลิงก์เอกสารกลับมา");
  return { url: signed.startsWith("http") ? signed : base + signed };
}

export async function uploadPaymentFile(form: FormData, u: User, rid: string) {
  need(u, "request");
  const paymentId = uuid(form.get("payment_id"), "รายการจ่าย")!;
  const category = oneOf(form.get("category"), CATEGORIES, "ประเภทเอกสาร");
  const file = form.get("file");
  if (!(file instanceof File)) fail(400, "กรุณาเลือกไฟล์เอกสาร");
  if (file.size < 1 || file.size > MAX_BYTES) fail(400, "ไฟล์ต้องมีขนาดไม่เกิน 20 MB");
  if (!MIME.has(file.type)) fail(400, "รองรับเฉพาะ PDF, JPG, PNG และ WEBP");
  const sql = db();
  const [p] = await sql`select id, status, created_by, document_id from finance.payments
    where id = ${paymentId}::uuid and company_id = ${u.companyId}::uuid`;
  if (!p) fail(404, "ไม่พบรายการจ่าย");
  if (p.status !== "paid") fail(409, "แนบหลักฐานได้หลังบันทึกว่าจ่ายเงินจริงแล้วเท่านั้น");
  canManagePayment(u, p.created_by);
  const [existingVerification] = await sql`select status from finance.payment_verifications
    where company_id = ${u.companyId}::uuid and payment_id = ${paymentId}::uuid`;
  if (existingVerification?.status === "verified") fail(409, "รายการนี้ตรวจเอกสารครบถ้วนแล้ว หากต้องแก้ไขให้ Owner จัดการก่อน");

  const { base, key } = storageConfig();
  const path = `${u.companyId}/${paymentId}/${crypto.randomUUID()}-${safeName(file.name)}`;
  const uploadRes = await fetch(`${base}/storage/v1/object/${BUCKET}/${encodedPath(path)}`, {
    method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "content-type": file.type, "x-upsert": "false" },
    body: new Uint8Array(await file.arrayBuffer()),
  });
  if (!uploadRes.ok) fail(502, "อัปโหลดไฟล์ไม่สำเร็จ กรุณาลองใหม่");
  try {
    return await sql.begin(async (tx: Tx) => {
      const [row] = await tx`insert into finance.document_files
        (company_id, document_id, payment_id, storage_bucket, object_path, original_name, mime_type, size_bytes, uploaded_by, file_category)
        values (${u.companyId}::uuid, ${p.document_id}::uuid, ${paymentId}::uuid, ${BUCKET}, ${path}, ${file.name.slice(0, 255)}, ${file.type}, ${file.size}, ${u.actorRef}, ${category})
        returning id, payment_id, file_category, original_name, mime_type, size_bytes, created_at`;
      await audit(tx, u, "upload_payment_document", "payment", paymentId, row, rid);
      return row;
    });
  } catch (e) {
    await fetch(`${base}/storage/v1/object/${BUCKET}`, {
      method: "DELETE",
      headers: { apikey: key, Authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({ prefixes: [path] }),
    }).catch(() => null);
    throw e;
  }
}

export async function verifyPaymentDocuments(body: Record<string, unknown>, u: User, rid: string) {
  need(u, "verify");
  const paymentId = uuid(body.payment_id, "รายการจ่าย")!;
  if (body.confirm_complete !== true) fail(400, "กรุณาติ๊กยืนยันว่าเอกสารครบถ้วนก่อน");
  return await db().begin(async (tx: Tx) => {
    const [p] = await tx`select id, status from finance.payments
      where id = ${paymentId}::uuid and company_id = ${u.companyId}::uuid for update`;
    if (!p) fail(404, "ไม่พบรายการจ่าย");
    if (p.status !== "paid") fail(409, "ตรวจเอกสารได้หลังจ่ายเงินจริงแล้วเท่านั้น");
    const [counts] = await tx`select count(*)::int as total,
      count(*) filter (where file_category = 'payment_evidence')::int as evidence
      from finance.document_files where company_id = ${u.companyId}::uuid and payment_id = ${paymentId}::uuid and deleted_at is null`;
    if (!counts.total || !counts.evidence) fail(409, "กรุณาแนบหลักฐานการจ่ายเงินอย่างน้อย 1 ไฟล์ก่อนตรวจสอบ");
    const checklist = { documents_complete: true, attachment_count: Number(counts.total), payment_evidence_count: Number(counts.evidence) };
    const [row] = await tx`insert into finance.payment_verifications
      (company_id, payment_id, status, checklist, verified_by, verified_at, updated_at)
      values (${u.companyId}::uuid, ${paymentId}::uuid, 'verified', ${tx.json(checklist)}, ${u.actorRef}, now(), now())
      on conflict (payment_id) do update set status = 'verified', checklist = excluded.checklist,
        verified_by = excluded.verified_by, verified_at = now(), updated_at = now()
      returning payment_id, status, checklist, verified_by, verified_at`;
    await audit(tx, u, "verify_payment_documents", "payment", paymentId, row, rid);
    return row;
  });
}
