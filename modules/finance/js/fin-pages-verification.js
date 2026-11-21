// Finance: final document verification page + payment evidence upload
(function () {
  const F = window.FIN;
  if (!F) return;
  const { api, esc, baht, thDate, thDateTime, run } = F;
  const categoryLabel = {
    payment_evidence: "หลักฐานการจ่ายเงิน",
    receipt_invoice: "ใบเสร็จ / ใบแจ้งหนี้",
    tax_invoice: "ใบกำกับภาษี",
    wht_document: "เอกสารหัก ณ ที่จ่าย",
    supporting: "เอกสารประกอบอื่น ๆ",
  };
  F.page("verification", {
    title: "ตรวจเอกสารหลังจ่าย",
    async render(el) {
      const result = await api.get("verification-queue");
      const items = result.items || [];
      const canUpload = F.can("request");
      const canVerify = F.can("verify");
      const cards = items.map(p => {
        const files = Array.isArray(p.files) ? p.files : [];
        const fileRows = files.length ? files.map(f => `<div class="fm-row" style="justify-content:space-between;gap:10px">
          <span><b>${esc(categoryLabel[f.file_category] || f.file_category)}</b><small class="sub">${esc(f.original_name)} · ${Math.max(1, Math.round(Number(f.size_bytes || 0) / 1024))} KB</small></span>
          <button class="fm-btn fm-btn-sm" data-open-file="${esc(f.id)}">เปิดไฟล์</button>
        </div>`).join("") : '<div class="fm-empty"><small>ยังไม่มีเอกสารแนบ</small></div>';
        const verified = p.verification_status === "verified";
        const uploadForm = canUpload ? `<form class="fm-form-grid" data-upload-form="${esc(p.id)}">
          <label class="fm-field"><span>ประเภทเอกสาร</span><select name="category">${Object.entries(categoryLabel).map(([k,v]) => `<option value="${k}">${v}</option>`).join("")}</select></label>
          <label class="fm-field"><span>เลือกไฟล์ (PDF / JPG / PNG / WEBP)</span><input name="file" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp" required></label>
          <div class="fm-form-actions fm-field-full"><button class="fm-btn fm-btn-primary" type="submit" ${verified ? "disabled" : ""}>＋ แนบเอกสาร</button></div>
        </form>` : "";
        const verifyAction = canVerify && !verified ? `<div class="fm-panel" style="margin-top:12px">
          <label class="fm-check"><input type="checkbox" data-confirm-check="${esc(p.id)}"> ตรวจสอบเอกสารและหลักฐานทั้งหมดแล้ว และยืนยันว่าครบถ้วน</label>
          <div class="fm-form-actions"><button class="fm-btn fm-btn-primary" data-verify="${esc(p.id)}" ${Number(p.file_count) < 1 || Number(p.evidence_count) < 1 ? "disabled" : ""}>Confirm Document Complete</button></div>
        </div>` : "";
        const status = verified
          ? `<span class="fm-badge ok">Verified & Completed</span><small class="sub">ตรวจโดย ${esc(p.verified_by_name || p.verified_by || "ผู้ตรวจสอบ")} · ${esc(thDateTime(p.verified_at))}</small>`
          : `<span class="fm-badge warn">รอตรวจเอกสาร</span>`;
        return `<section class="fm-panel" style="margin-bottom:14px">
          <div class="fm-panel-head"><div><div class="fm-eyebrow">${esc(p.document_number || "PAYMENT")}</div><h2>${esc(p.partner_name || (p.payment_type === "disbursement" ? "รายการจ่ายเงิน" : "รายการรับเงิน"))}</h2>
          <p>${esc(thDate(p.payment_date))} · ${esc(p.method || "")} · ${esc(p.payment_type === "disbursement" ? "จ่ายเงิน" : "รับเงิน")}</p></div>
          <div style="text-align:right"><b>${baht(p.amount)}</b><div>${status}</div></div></div>
          <div class="fm-panel-head"><b>เอกสารแนบ (${files.length})</b></div>
          ${fileRows}
          ${uploadForm}
          ${verifyAction}
        </section>`;
      }).join("");
      el.innerHTML = F.head("FINAL VERIFICATION", "ตรวจเอกสารหลังจ่าย", "Manager / Staff แนบหลักฐานหลังจ่ายเงินจริง · Final Verifier ตรวจและยืนยันความครบถ้วน") +
        (items.length ? cards : '<section class="fm-panel"><div class="fm-empty"><b>ยังไม่มีรายการที่จ่ายเงินจริง</b><small>รายการจะปรากฏที่นี่หลังบันทึกการจ่ายเงินจริงแล้ว</small></div></section>');
      el.querySelectorAll("[data-upload-form]").forEach(form => {
        form.addEventListener("submit", async e => {
          e.preventDefault();
          const id = form.dataset.uploadForm;
          const file = form.querySelector('input[name="file"]').files[0];
          if (!file) { F.toast("กรุณาเลือกไฟล์", "bad"); return; }
          const button = form.querySelector("button[type=submit]");
          await run(button, () => F.upload("file.upload", { payment_id: id, category: form.category.value }, file), "แนบเอกสารแล้ว");
          F.reload();
        });
      });
      el.addEventListener("click", async e => {
        const open = e.target.closest("[data-open-file]");
        if (open) {
          const r = await run(open, () => api.get("file-url", { file_id: open.dataset.openFile }));
          if (r && r.url) window.open(r.url, "_blank", "noopener");
          return;
        }
        const verify = e.target.closest("[data-verify]");
        if (verify) {
          const id = verify.dataset.verify;
          const check = el.querySelector(`[data-confirm-check="${id}"]`);
          if (!check || !check.checked) { F.toast("กรุณาติ๊กยืนยันว่าเอกสารครบถ้วน", "bad"); return; }
          if (await run(verify, () => api.post("payment.verify-documents", { payment_id: id, confirm_complete: true }), "ยืนยันเอกสารครบถ้วนแล้ว")) F.reload();
        }
      });
    },
  });
})();
