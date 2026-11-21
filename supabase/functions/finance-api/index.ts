// Finance API (Supabase Edge Function) — ระบบการเงินและบัญชีของ CMS
// เบราว์เซอร์ส่ง CMS Session ใน header x-cms-session · ข้อมูลอยู่ใน schema finance (เข้าถึงได้เฉพาะฝั่งเซิร์ฟเวอร์)
// GET  ?action=<อ่าน>&...      POST {action:"<เขียน>", ...}   (+ header idempotency-key สำหรับสร้างเอกสาร/รายการรับจ่าย)
import { dbError, HttpError, text } from "./util.ts";
import { authenticate, capabilities, User } from "./auth.ts";
import * as D from "./documents.ts";
import * as P from "./payments.ts";
import * as J from "./journals.ts";
import * as T from "./tax.ts";
import * as R from "./reports.ts";
import * as A from "./admin.ts";
import * as V from "./verification.ts";
import * as C from "./expense-clearances.ts";

const ORIGINS = new Set([
  "https://centralized-store-management.github.io",
  "https://centralized-store-management-system.github.io",
  ...String(Deno.env.get("FINANCE_TEST_ORIGINS") || "").split(",").map(s => s.trim()).filter(Boolean),
]);
const VERSION = "1.1.0";

type Reader = (url: URL, u: User) => Promise<unknown>;
type Writer = (body: Record<string, unknown>, u: User, rid: string, idem: string) => Promise<unknown>;

const READ: Record<string, Reader> = {
  company: A.getCompany, accounts: A.listAccounts, partners: A.listPartners, users: A.listUsers, "cms-users": A.cmsUsers,
  approvals: A.approvalsQueue, audit: A.listAudit,
  documents: D.listDocuments, document: D.getDocument,
  payments: P.listPayments, "open-documents": P.openDocuments,
  "verification-queue": V.verificationQueue, "payment-files": V.listPaymentFiles, "file-url": V.fileUrl,
  "expense-clearances": C.listClearances,
  journals: J.listJournals, journal: J.getJournal, periods: J.listPeriods,
  "tax-report": T.taxReport, filings: T.listFilings,
  summary: R.summary, "trial-balance": R.trialBalance, "profit-loss": R.profitLoss, "balance-sheet": R.balanceSheet, ledger: R.ledger, aging: R.aging,
};
const WRITE: Record<string, Writer> = {
  "company.update": A.updateCompany, "setup.defaults": A.setupDefaults, "account.save": A.saveAccount, "partner.save": A.savePartner,
  "user.set": A.setUser, "company.purge-test-data": A.purgeTestData, "company.go-live": A.goLive,
  "document.create": D.createDocument, "document.update": D.updateDocument, "document.submit": D.submitDocument, "document.return": D.returnDocument,
  "document.void": D.voidDocument, "document.approve": D.approveDocument, "document.reverse": D.reverseDocument,
  "payment.create": P.createPayment, "payment.approve": P.approvePayment, "payment.reject": P.rejectPayment, "payment.cancel": P.cancelPayment, "payment.mark-paid": P.markPaid,
  "payment.verify-documents": V.verifyPaymentDocuments,
  "expense-clearance.submit": C.submitClearance, "expense-clearance.approve": C.approveClearance, "expense-clearance.return": C.returnClearance, "expense-clearance.verify": C.verifyClearance,
  "journal.create": J.createJournal, "journal.submit": J.submitJournal, "journal.post": J.postJournal, "journal.reject": J.rejectJournal, "journal.delete": J.deleteDraftJournal, "journal.reverse": J.reverseJournal,
  "period.create-year": J.createPeriods, "period.close": J.closePeriod, "period.reopen": J.reopenPeriod,
  "tax.prepare": T.prepareFiling, "tax.submit-review": T.submitFilingReview, "tax.return": T.returnFiling, "tax.approve": T.approveFiling, "tax.mark-submitted": T.markFiled, "tax.mark-paid": T.markFilingPaid,
};

function cors(origin: string): Record<string, string> {
  return origin ? {
    "access-control-allow-origin": origin, "vary": "Origin",
    "access-control-allow-headers": "content-type, x-cms-session, idempotency-key, x-request-id",
    "access-control-allow-methods": "GET, POST, OPTIONS", "access-control-max-age": "600",
  } : {};
}
const json = (body: unknown, status: number, origin: string) => new Response(JSON.stringify(body), {
  status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store, private", "x-content-type-options": "nosniff", ...cors(origin) },
});

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin") || "";
  if (origin && !ORIGINS.has(origin)) return json({ ok: false, error: "origin_not_allowed" }, 403, "");
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(origin) });
  if (req.method !== "GET" && req.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405, origin);
  const rid = text(req.headers.get("x-request-id"), 64) || crypto.randomUUID();
  try {
    const user = await authenticate(req.headers.get("x-cms-session") || "");
    const url = new URL(req.url);
    if (req.method === "GET") {
      const action = url.searchParams.get("action") || "session";
      if (action === "session") return json({ ok: true, data: {
        version: VERSION,
        actor: { displayName: user.displayName, role: user.role, ref: user.actorRef, cmsRole: user.cmsRole },
        company: { id: user.companyId, name: user.companyName, currency: user.currency, environment: user.environment, vatRegistered: user.vatRegistered, allowSelfApproval: user.allowSelfApproval },
        capabilities: capabilities(user),
      } }, 200, origin);
      const limitedReads: Record<string, string[]> = {
        manager: ["summary", "accounts", "partners", "documents", "document", "payments", "open-documents", "verification-queue", "payment-files", "file-url", "expense-clearances"],
        staff: ["accounts", "partners", "documents", "document", "payments", "open-documents", "verification-queue", "payment-files", "file-url", "expense-clearances"],
        verifier: ["verification-queue", "payment-files", "file-url", "expense-clearances"],
      };
      const allowedReads = limitedReads[user.role];
      if (allowedReads && !allowedReads.includes(action)) throw new HttpError(403, "บทบาทนี้ไม่มีสิทธิ์ดูข้อมูลส่วนนี้");
      if (action === "approvals" && !capabilities(user).approve) throw new HttpError(403, "เฉพาะ Owner หรือผู้อนุมัติเท่านั้น");
      const fn = READ[action];
      if (!fn) throw new HttpError(404, "ไม่พบ Finance API action");
      return json({ ok: true, data: await fn(url, user) }, 200, origin);
    }
    const contentType = (req.headers.get("content-type") || "").toLowerCase();
    if (contentType.includes("multipart/form-data")) {
      const declaredLength = Number(req.headers.get("content-length") || 0);
      if (declaredLength > 20 * 1024 * 1024 + 256 * 1024) throw new HttpError(413, "ไฟล์ต้องมีขนาดไม่เกิน 20 MB");
      const form = await req.formData();
      const uploadAction = text(form.get("action"), 40);
      if (uploadAction !== "file.upload" && uploadAction !== "expense-clearance.file.upload") throw new HttpError(404, "ไม่พบ Finance API action");
      if (!["owner", "manager", "staff", "approver", "accountant"].includes(user.role)) throw new HttpError(403, "บทบาทนี้ไม่มีสิทธิ์แนบเอกสาร");
      const data = uploadAction === "expense-clearance.file.upload" ? await C.uploadClearanceFile(form, user, rid) : await V.uploadPaymentFile(form, user, rid);
      return json({ ok: true, data }, 201, origin);
    }
    const raw = await req.text();
    if (raw.length > 200_000) throw new HttpError(413, "ข้อมูลใหญ่เกินไป");
    let body: Record<string, unknown>;
    try { body = JSON.parse(raw); } catch (_) { throw new HttpError(400, "รูปแบบข้อมูลไม่ถูกต้อง"); }
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new HttpError(400, "รูปแบบข้อมูลไม่ถูกต้อง");
    const action = text(body.action, 40);
    const limitedWrites: Record<string, string[]> = {
      manager: ["document.create", "document.update", "document.submit", "document.void", "payment.create", "payment.mark-paid", "payment.cancel", "expense-clearance.submit"],
      staff: ["document.create", "document.update", "document.submit", "document.void", "payment.create", "payment.mark-paid", "payment.cancel", "expense-clearance.submit"],
      verifier: ["payment.verify-documents", "expense-clearance.verify"],
    };
    const allowedWrites = limitedWrites[user.role];
    if (allowedWrites && !allowedWrites.includes(action)) throw new HttpError(403, "บทบาทนี้ไม่มีสิทธิ์ทำรายการนี้");
    const fn = WRITE[action];
    if (!fn) throw new HttpError(404, "ไม่พบ Finance API action");
    const idem = text(req.headers.get("idempotency-key") || body.idempotency_key, 120);
    const data = await fn(body, user, rid, idem);
    return json({ ok: true, data }, action.endsWith(".create") ? 201 : 200, origin);
  } catch (e) {
    const he = e instanceof HttpError ? e : dbError(e);
    if (!he) console.error("finance-api", rid, e);
    return json({ ok: false, error: he ? he.message : "Finance API ขัดข้องชั่วคราว (รหัส " + rid.slice(0, 8) + ")" }, he ? he.status : 500, origin);
  }
});
