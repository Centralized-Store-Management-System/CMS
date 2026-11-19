import postgres from "npm:postgres@3.4.5";

const SUPABASE_URL = (Deno.env.get("SUPABASE_URL") || "").replace(/\/$/, "");
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const DB_URL = Deno.env.get("SUPABASE_DB_URL") || "";
const BACKOFFICE_URL = SUPABASE_URL + "/functions/v1/backoffice";
const BUCKET = "hr-employee-documents";
const MAX_BYTES = 20 * 1024 * 1024;
const SIGNED_SECONDS = 300;
const ALLOWED_MIME = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);
const CATEGORIES = new Set(["resume", "id_card", "education", "contract", "bank", "medical", "social_security", "pdpa", "other"]);
const ORIGIN_ALLOW = new Set(["https://centralized-store-management.github.io", "https://centralized-store-management-system.github.io"]);

const sql = DB_URL ? postgres(DB_URL, { max: 2, idle_timeout: 10, connect_timeout: 10 }) : null;

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
      "access-control-allow-headers": "content-type, x-cms-session",
      "access-control-allow-methods": "GET, POST, OPTIONS",
      "access-control-max-age": "600",
    } : {}),
  },
});
function safeName(s: string) {
  return String(s || "document").normalize("NFKC").replace(/[^\p{L}\p{N}._-]+/gu, "_").replace(/^\.+|\.+$/g, "").slice(0, 90) || "document";
}
function extOf(name: string) { return (name.split(".").pop() || "").toLowerCase(); }
function detectMime(file: File) {
  const ext = extOf(file.name);
  const extMime: Record<string, string> = { pdf: "application/pdf", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp" };
  return file.type && ALLOWED_MIME.has(file.type) ? file.type : (extMime[ext] || "");
}
function verifySignature(bytes: Uint8Array, mime: string) {
  if (mime === "application/pdf") return new TextDecoder().decode(bytes.slice(0, 5)) === "%PDF-";
  if (mime === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mime === "image/png") return bytes[0] === 0x89 && new TextDecoder().decode(bytes.slice(1, 4)) === "PNG";
  if (mime === "image/webp") return new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" && new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP";
  return false;
}
function parseJsonp(text: string) {
  const t = text.trim();
  try { return JSON.parse(t); } catch (_) { /* JSONP follows */ }
  const start = t.indexOf("("), end = t.lastIndexOf(")");
  if (start < 0 || end <= start) throw new HttpError(401, "ยืนยันสิทธิ์ไม่สำเร็จ กรุณาเข้าสู่ระบบใหม่");
  try { return JSON.parse(t.slice(start + 1, end)); }
  catch (_) { throw new HttpError(401, "ยืนยันสิทธิ์ไม่สำเร็จ กรุณาเข้าสู่ระบบใหม่"); }
}
async function authorize(token: string, employeeId: string) {
  if (!token || token.length > 4096) throw new HttpError(401, "กรุณาเข้าสู่ระบบใหม่");
  const u = new URL(BACKOFFICE_URL);
  u.searchParams.set("action", "bootstrap");
  u.searchParams.set("t", token);
  u.searchParams.set("callback", "_hrdoc_auth");
  u.searchParams.set("_", String(Date.now()));
  const res = await fetch(u, { headers: { accept: "application/javascript, application/json" }, cache: "no-store" });
  if (!res.ok) throw new HttpError(401, "Session หมดอายุหรือยืนยันสิทธิ์ไม่ได้ กรุณาเข้าสู่ระบบใหม่");
  const result = parseJsonp(await res.text());
  if (!result || result.ok === false) throw new HttpError(401, "Session หมดอายุหรือยืนยันสิทธิ์ไม่ได้ กรุณาเข้าสู่ระบบใหม่");
  const boot = result.data || result;
  const me = boot.me;
  if (!me || !me.role) throw new HttpError(401, "ไม่พบข้อมูลผู้ใช้งาน");
  const allowed = me.role === "owner" || (Array.isArray(me.perms) && me.perms.includes("hr"));
  if (!allowed) throw new HttpError(403, "บัญชีนี้ไม่มีสิทธิ์ HR");
  const employees = boot.tables && Array.isArray(boot.tables.employees) ? boot.tables.employees : [];
  const employee = employees.find((e: Record<string, unknown>) => String(e.id) === String(employeeId));
  if (!employee) throw new HttpError(404, "ไม่พบพนักงาน หรือไม่มีสิทธิ์เข้าถึงข้อมูลพนักงานรายนี้");
  const scope = me.scope;
  const scopeList = Array.isArray(scope) ? scope.map(String) : (typeof scope === "string" ? scope.split(",").map((x: string) => x.trim()).filter(Boolean) : []);
  if (me.role !== "owner" && scope !== "*" && !scopeList.includes(String(employee.branch || ""))) {
    throw new HttpError(403, "ไม่มีสิทธิ์เข้าถึงเอกสารของสาขานี้");
  }
  return { me, employee };
}
async function ensurePrivateBucket() {
  const headers = { apikey: SERVICE_KEY, authorization: "Bearer " + SERVICE_KEY };
  const check = await fetch(`${SUPABASE_URL}/storage/v1/bucket/${BUCKET}`, { headers, cache: "no-store" });
  if (check.ok) {
    const bucket = await check.json();
    if (bucket.public !== false) throw new Error("HR documents bucket must remain private");
    return;
  }
  // Storage API may encode a missing bucket as HTTP 400 with code NoSuchBucket,
  // rather than HTTP 404. Treat only that explicit response as "create it".
  let lookupError: Record<string, unknown> = {};
  try { lookupError = await check.json(); } catch (_) { /* no body */ }
  const missingBucket = check.status === 404 ||
    (check.status === 400 && (lookupError.code === "NoSuchBucket" ||
      String(lookupError.error || "").toLowerCase() === "bucket not found"));
  if (!missingBucket) throw new Error("Cannot verify private HR document bucket: " + check.status);
  const create = await fetch(`${SUPABASE_URL}/storage/v1/bucket`, {
    method: "POST", headers: { ...headers, "content-type": "application/json" },
    body: JSON.stringify({ id: BUCKET, name: BUCKET, public: false, file_size_limit: MAX_BYTES, allowed_mime_types: [...ALLOWED_MIME] }),
  });
  if (!create.ok && create.status !== 409) throw new Error("Cannot create private HR document bucket: " + create.status);
  const verify = await fetch(`${SUPABASE_URL}/storage/v1/bucket/${BUCKET}`, { headers, cache: "no-store" });
  if (!verify.ok || (await verify.json()).public !== false) throw new Error("HR document bucket is not private");
}
async function storageUpload(path: string, bytes: Uint8Array, mime: string) {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path.split("/").map(encodeURIComponent).join("/")}`, {
    method: "POST",
    headers: { apikey: SERVICE_KEY, authorization: "Bearer " + SERVICE_KEY, "content-type": mime, "cache-control": "60", "x-upsert": "false" },
    body: bytes,
  });
  if (!res.ok) throw new Error("อัปโหลดเอกสารไม่สำเร็จ (" + res.status + ")");
}
async function storageDelete(path: string) {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}`, {
    method: "DELETE",
    headers: { apikey: SERVICE_KEY, authorization: "Bearer " + SERVICE_KEY, "content-type": "application/json" },
    body: JSON.stringify({ prefixes: [path] }),
  });
  if (!res.ok && res.status !== 404) throw new Error("ลบไฟล์ในที่เก็บเอกสารไม่สำเร็จ (" + res.status + ")");
}
async function signedUrl(path: string) {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/sign/${BUCKET}/${path.split("/").map(encodeURIComponent).join("/")}`, {
    method: "POST",
    headers: { apikey: SERVICE_KEY, authorization: "Bearer " + SERVICE_KEY, "content-type": "application/json" },
    body: JSON.stringify({ expiresIn: SIGNED_SECONDS }),
  });
  if (!res.ok) throw new Error("เปิดเอกสารไม่สำเร็จ (" + res.status + ")");
  const data = await res.json();
  const raw = data.signedURL || data.signedUrl;
  if (!raw) throw new Error("ระบบไม่สามารถสร้างลิงก์ดูเอกสารได้");
  if (raw.startsWith("https://") || raw.startsWith("http://")) return raw;
  if (raw.startsWith("/storage/v1/")) return SUPABASE_URL + raw;
  if (raw.startsWith("/")) return SUPABASE_URL + "/storage/v1" + raw;
  return SUPABASE_URL + "/storage/v1/" + raw;
}
async function audit(documentId: string | null, employeeId: string, action: string, actor: string) {
  await sql!.unsafe(
    "insert into public.hr_employee_document_audit (document_id, employee_id, action, actor) values ($1::uuid, $2, $3, $4)",
    [documentId, employeeId, action, actor],
  );
}
function requireEnv() {
  if (!SUPABASE_URL || !SERVICE_KEY || !DB_URL || !sql) throw new HttpError(503, "ระบบเอกสาร HR ยังตั้งค่าไม่ครบ กรุณาติดต่อ IT");
}
Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin") || "";
  if (origin && !ORIGIN_ALLOW.has(origin)) return json({ ok: false, error: "origin_not_allowed" }, 403);
  if (req.method === "OPTIONS") return new Response("ok", { headers: {
    ...(origin ? { "access-control-allow-origin": origin } : {}),
    "access-control-allow-headers": "content-type, x-cms-session",
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-max-age": "600",
    "vary": "Origin",
  } });
  try {
    requireEnv();
    const token = req.headers.get("x-cms-session") || "";
    if (!token) throw new HttpError(401, "กรุณาเข้าสู่ระบบใหม่");
    const url = new URL(req.url);
    const action = req.method === "GET" ? (url.searchParams.get("action") || "list") : "";
    if (req.method === "GET" && action === "list") {
      const employeeId = url.searchParams.get("employeeId") || "";
      const { employee } = await authorize(token, employeeId);
      const rows = await sql`select id, employee_id, category, label, original_name, mime_type, size_bytes, uploaded_by, created_at
        from public.hr_employee_documents where employee_id = ${employeeId} and deleted_at is null order by created_at desc`;
      return json({ ok: true, documents: rows }, 200, origin);
    }
    if (req.method === "GET" && action === "view") {
      const id = url.searchParams.get("id") || "";
      const [doc] = await sql`select id, employee_id, object_path, mime_type from public.hr_employee_documents where id = ${id}::uuid and deleted_at is null limit 1`;
      if (!doc) throw new HttpError(404, "ไม่พบเอกสาร");
      const access = await authorize(token, doc.employee_id);
      await ensurePrivateBucket();
      const link = await signedUrl(doc.object_path);
      await audit(String(doc.id), String(doc.employee_id), "view", String(access.me.username || access.me.code || access.me.role));
      return json({ ok: true, url: link, expiresIn: SIGNED_SECONDS, mimeType: doc.mime_type }, 200, origin);
    }
    if (req.method === "POST") {
      const contentType = req.headers.get("content-type") || "";
      if (contentType.includes("multipart/form-data")) {
        const form = await req.formData();
        const employeeId = String(form.get("employeeId") || "");
        const category = String(form.get("category") || "");
        const label = String(form.get("label") || "").trim().slice(0, 120);
        const file = form.get("file");
        if (!(file instanceof File)) throw new HttpError(400, "กรุณาเลือกไฟล์เอกสาร");
        const { me, employee } = await authorize(token, employeeId);
        await ensurePrivateBucket();
        if (!CATEGORIES.has(category)) throw new HttpError(400, "ประเภทเอกสารไม่ถูกต้อง");
        if (!label) throw new HttpError(400, "กรุณาระบุชื่อเอกสาร");
        if (file.size <= 0 || file.size > MAX_BYTES) throw new HttpError(413, "ไฟล์ต้องมีขนาดไม่เกิน 20 MB");
        const mime = detectMime(file);
        if (!mime || !ALLOWED_MIME.has(mime)) throw new HttpError(415, "รองรับเฉพาะ PDF, JPG, PNG และ WEBP");
        const bytes = new Uint8Array(await file.arrayBuffer());
        if (!verifySignature(bytes, mime)) throw new HttpError(415, "ชนิดไฟล์ไม่ตรงกับเนื้อหาไฟล์");
        const id = crypto.randomUUID();
        const ext = mime === "application/pdf" ? "pdf" : mime === "image/jpeg" ? "jpg" : mime === "image/png" ? "png" : "webp";
        const objectPath = `${safeName(String(employee.id))}/${id}.${ext}`;
        await storageUpload(objectPath, bytes, mime);
        try {
          const actor = String(me.username || me.code || me.role);
          const row = await sql!.begin(async (tx: typeof sql) => {
            const [record] = await tx`insert into public.hr_employee_documents
              (id, employee_id, employee_branch, category, label, original_name, mime_type, size_bytes, object_path, uploaded_by)
              values (${id}::uuid, ${String(employee.id)}, ${String(employee.branch || "")}, ${category}, ${label}, ${safeName(file.name)}, ${mime}, ${file.size}, ${objectPath}, ${actor})
              returning id, employee_id, category, label, original_name, mime_type, size_bytes, uploaded_by, created_at`;
            await tx`insert into public.hr_employee_document_audit (document_id, employee_id, action, actor)
              values (${id}::uuid, ${String(employee.id)}, 'upload', ${actor})`;
            return record;
          });
          return json({ ok: true, document: row }, 200, origin);
        } catch (e) {
          await storageDelete(objectPath).catch(() => {});
          throw e;
        }
      }
      const body = await req.json();
      if (body.action === "delete") {
        const id = String(body.id || "");
        const [doc] = await sql`select id, employee_id, object_path from public.hr_employee_documents where id = ${id}::uuid and deleted_at is null limit 1`;
        if (!doc) throw new HttpError(404, "ไม่พบเอกสาร");
        const { me } = await authorize(token, doc.employee_id);
        await ensurePrivateBucket();
        await storageDelete(doc.object_path);
        const actor = String(me.username || me.code || me.role);
        await sql!.begin(async (tx: typeof sql) => {
          await tx`update public.hr_employee_documents set deleted_at = now() where id = ${id}::uuid`;
          await tx`insert into public.hr_employee_document_audit (document_id, employee_id, action, actor)
            values (${String(doc.id)}::uuid, ${String(doc.employee_id)}, 'delete', ${actor})`;
        });
        return json({ ok: true }, 200, origin);
      }
    }
    throw new HttpError(405, "คำสั่งไม่ถูกต้อง");
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500;
    const message = e instanceof HttpError ? e.message : "ระบบเอกสาร HR ขัดข้องชั่วคราว";
    if (!(e instanceof HttpError)) console.error("hr-documents", e);
    return json({ ok: false, error: message }, status, origin);
  }
});
