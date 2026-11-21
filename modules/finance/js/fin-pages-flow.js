// Finance: เบิก–เคลียร์ค่าใช้จ่าย — หน้าเดียวจบตามแผนภาพ
// ขอเบิก → Owner อนุมัติ → จ่ายเงิน + เคลียร์ (ใช้จริง/เงินคืน) → Owner ตรวจเคลียร์ → ผู้ตรวจสุดท้าย → ปิดงาน (ลงบัญชี + รายงาน)
// ทุกขั้นส่งกลับให้ผู้เบิกแก้ได้ · ผู้ใช้แต่ละคนเห็นเฉพาะปุ่มที่ทำได้ตอนนี้ (API ตรวจสิทธิ์ซ้ำทุกครั้ง)
(function () {
  const F = window.FIN;
  if (!F) return;
  const { api, esc, baht, money, thDate, thDateTime, run } = F;

  const STEPS = [
    ['draft', 'ขอเบิก', 'กรอก + แนบเอกสาร'],
    ['request_review', 'Owner อนุมัติ', 'อนุมัติวงเงิน'],
    ['to_clear', 'จ่ายเงิน + เคลียร์', 'สลิป ใบเสร็จ เงินคืน'],
    ['clear_review', 'Owner ตรวจเคลียร์', 'ตรวจยอดจริง'],
    ['verify', 'ผู้ตรวจสุดท้าย', 'ตรวจเอกสารครบ'],
    ['closed', 'ปิดงาน', 'ลงบัญชีอัตโนมัติ'],
  ];
  const STAGE = {
    draft: ['ร่าง · รอส่งขออนุมัติ', 'n'], request_review: ['รอ Owner อนุมัติ', 'warn'], to_clear: ['รอจ่ายเงิน / เคลียร์', 'info'],
    clear_review: ['รอ Owner ตรวจเคลียร์', 'warn'], verify: ['รอผู้ตรวจสุดท้าย', 'warn'], closed: ['ปิดงานแล้ว', 'ok'], cancelled: ['ยกเลิก', 'mute'],
  };
  const TODO = { draft: 'แก้ไข / ส่งขออนุมัติ', request_review: 'อนุมัติคำขอ', to_clear: 'บันทึกจ่ายเงิน + เคลียร์', clear_review: 'ตรวจเคลียร์', verify: 'ตรวจขั้นสุดท้าย' };
  const WAIT = { draft: 'ผู้เบิกส่งขออนุมัติ', request_review: 'Owner อนุมัติคำขอ', to_clear: 'ผู้เบิกบันทึกจ่ายเงินและเคลียร์', clear_review: 'Owner ตรวจเคลียร์', verify: 'ผู้ตรวจสุดท้ายตรวจเอกสาร' };
  const RETURNED = { owner_request: 'Owner ส่งคำขอกลับ', owner_clear: 'Owner ส่งเคลียร์กลับ', verifier: 'ผู้ตรวจสุดท้ายส่งกลับ' };
  const FILE = {
    quotation: 'ใบเสนอราคา', supporting: 'เอกสารประกอบ', receipt_invoice: 'ใบเสร็จ / ใบแจ้งหนี้', tax_invoice: 'ใบกำกับภาษี',
    payment_evidence: 'หลักฐานการจ่าย (สลิป)', refund_evidence: 'หลักฐานคืนเงิน', wht_document: 'หนังสือรับรองหัก ณ ที่จ่าย',
  };
  const REQ_FILES = ['quotation', 'supporting', 'receipt_invoice', 'tax_invoice'];
  const CLR_FILES = ['payment_evidence', 'receipt_invoice', 'tax_invoice', 'wht_document', 'refund_evidence', 'supporting'];
  const EVENT = {
    'document:submitted': 'ส่งขออนุมัติ', 'document:approved': 'Owner อนุมัติคำขอ', 'document:returned': 'Owner ส่งคำขอกลับ', 'document:cancelled': 'ยกเลิกคำขอ',
    'document:reversed': 'กลับรายการบัญชี', 'expense_clearance:submitted': 'ส่งเคลียร์', 'expense_clearance:owner_approved': 'Owner อนุมัติเคลียร์',
    'expense_clearance:returned': 'Owner ส่งเคลียร์กลับ', 'expense_clearance:verifier_returned': 'ผู้ตรวจสุดท้ายส่งกลับ',
    'expense_clearance:resubmitted_to_verifier': 'แก้ไขแล้ว ส่งกลับไปผู้ตรวจ', 'expense_clearance:verified': 'ปิดงาน ลงบัญชีแล้ว',
  };
  const ACCEPT = '.pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp';
  const role = () => (F.session && F.session.actor && F.session.actor.role) || '';
  const stepIdx = st => st === 'closed' ? 5 : STEPS.findIndex(s => s[0] === st);
  const stageBadge = st => { const x = STAGE[st] || [st, 'n']; return `<span class="fm-badge ${x[1]}">${esc(x[0])}</span>`; };
  const kb = n => Math.max(1, Math.round(Number(n || 0) / 1024)) + ' KB';
  let tab = 'todo';

  function stepper(stage, returned) {
    const idx = stepIdx(stage);
    return `<ol class="ff-stepper" aria-label="ขั้นตอน">${STEPS.map((s, i) => {
      const cls = stage === 'closed' || i < idx ? 'done' : i === idx ? (returned ? 'now back' : 'now') : '';
      return `<li class="ff-step ${cls}"${i === idx ? ' aria-current="step"' : ''}><i>${stage === 'closed' || i < idx ? '✓' : i + 1}</i><b>${esc(s[1])}</b><small>${esc(s[2])}</small></li>`;
    }).join('')}</ol>`;
  }
  const dots = (stage, returned) => { const idx = stepIdx(stage); return `<div class="ff-dots">${STEPS.map((_, i) => `<span class="${stage === 'closed' || i < idx ? 'on' : i === idx ? (returned ? 'back' : 'on') : ''}"></span>`).join('')}</div>`; };

  async function openFile(btn, id) {
    const tabw = window.open('about:blank', '_blank');
    const r = await run(btn, () => api.get('expense-clearance-file-url', { file_id: id }));
    if (r && r.url) { if (tabw) tabw.location.href = r.url; else window.location.href = r.url; } else if (tabw) tabw.close();
  }
  async function uploadMany(action, fields, files, btn) {
    let n = 0;
    for (const f of files) {
      if (f.size > 20 * 1024 * 1024) { F.toast(f.name + ': ไฟล์ใหญ่เกิน 20 MB', 'bad'); continue; }
      const ok = await run(btn, () => F.upload(action, fields, f));
      if (ok) n++;
    }
    if (n) F.toast('แนบแล้ว ' + n + ' ไฟล์', 'ok');
    return n;
  }
  const uploader = (key, cats, hint) => `<div class="ff-up" data-up="${key}"><select aria-label="ประเภทเอกสาร">${cats.map(c => `<option value="${c}">${esc(FILE[c])}</option>`).join('')}</select>
    <label class="fm-btn fm-btn-light">＋ แนบไฟล์<input type="file" multiple accept="${ACCEPT}"></label>${hint ? `<small class="fm-muted">${hint}</small>` : ''}</div>`;

  // ---------- รายการ ----------
  async function list(el) {
    const canNew = F.can('request');
    el.innerHTML = F.head('EXPENSE', 'เบิก–เคลียร์ค่าใช้จ่าย', 'ขอเบิก → Owner อนุมัติ → จ่ายเงิน + เคลียร์ → Owner ตรวจ → ผู้ตรวจสุดท้าย → ปิดงาน (ลงบัญชีให้อัตโนมัติ)',
      canNew ? '<button class="fm-btn fm-btn-primary" data-go="#expflow/new">＋ ขอเบิกใหม่</button>' : '') +
      `<div class="fm-tabs" id="ffTabs"></div><div class="fm-toolbar"><input type="search" id="ffQ" placeholder="ค้นหา รายการ / เลขที่ / ผู้เบิก / ร้าน" style="flex:1;min-width:200px"></div><div id="ffList">${F.loading()}</div>`;
    let data = null;
    const draw = () => {
      const c = data.counts || {};
      const open = ['draft', 'request_review', 'to_clear', 'clear_review', 'verify'].reduce((a, k) => a + (c[k] || 0), 0);
      F.$('#ffTabs', el).innerHTML = [['todo', 'ต้องทำ', c.todo], ['open', 'กำลังดำเนินการ', open], ['closed', 'ปิดแล้ว', c.closed], ['all', 'ทั้งหมด', null]]
        .map(([k, t, n]) => `<button data-tab="${k}" class="${k === tab ? 'on' : ''}">${t}${n != null ? ' (' + n + ')' : ''}</button>`).join('');
      const items = data.items || [];
      F.$('#ffList', el).innerHTML = items.length ? `<div class="ff-list">${items.map(it => `<a class="ff-item" href="#expflow/${esc(it.id)}">
          <div class="ff-item-main"><b>${esc(it.title || 'คำขอเบิก')}</b><small>${esc(it.document_number)} · ${esc(thDate(it.document_date))}${it.payee ? ' · ' + esc(it.payee) : ''} · ผู้เบิก ${esc(it.created_by_name || '')}</small></div>
          <div class="ff-item-side"><b>${baht(it.clearance && it.stage === 'closed' ? it.clearance.expense : it.amount)}</b>${stageBadge(it.stage)}</div>
          ${it.stage !== 'cancelled' ? dots(it.stage, it.returned) : ''}
          ${it.returned ? `<div class="ff-flag">${esc(RETURNED[it.returned])}${it.return_note ? ': ' + esc(it.return_note) : ''}</div>` : ''}
          ${it.my_action ? `<div class="ff-todo">→ ต้องทำ: ${esc(it.returned ? 'แก้ไขแล้วส่งใหม่' : TODO[it.stage] || '')}</div>` : ''}
        </a>`).join('')}</div>`
        : `<div class="fm-panel"><div class="fm-empty"><b>${tab === 'todo' ? 'ไม่มีงานที่ต้องทำ 🎉' : 'ยังไม่มีรายการ'}</b><small>${canNew ? 'กด "＋ ขอเบิกใหม่" เพื่อเริ่ม' : 'รายการที่ต้องตรวจจะขึ้นที่นี่'}</small></div></div>`;
    };
    const load = async () => {
      F.$('#ffList', el).innerHTML = F.loading();
      data = await api.get('expense-flow', { tab, q: F.$('#ffQ', el).value.trim() });
      draw();
    };
    el.addEventListener('click', e => { const b = e.target.closest('[data-tab]'); if (b) { tab = b.dataset.tab; load().catch(err => { F.$('#ffList', el).innerHTML = F.errorBox(err.message); }); } });
    let t; F.$('#ffQ', el).addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => load().catch(() => {}), 300); });
    await load();
  }

  // ---------- ขอเบิก (ฟอร์มง่าย 1 รายการ) ----------
  async function requestForm(el, id) {
    if (!F.can('request')) { el.innerHTML = F.errorBox('บทบาทของคุณขอเบิกไม่ได้'); return; }
    const vatReg = !!(F.session.company && F.session.company.vatRegistered);
    const [accounts, item] = await Promise.all([F.accounts().catch(() => []), id ? api.get('expense-flow-item', { id }) : null]);
    const d = item && item.document, l0 = item && item.lines[0];
    if (item && (item.lines.length > 1 || !item.actions.edit_request)) { F.nav('#document/edit:' + id); return; }
    const gross = l0 ? Number(l0.line_total) + Number(l0.vat_amount || 0) : '';
    const accOpts = '<option value="">ค่าใช้จ่ายทั่วไป</option>' + accounts.filter(a => a.account_type === 'expense' && a.is_active !== false)
      .map(a => `<option value="${esc(a.account_code)}" ${l0 && l0.account_code === a.account_code ? 'selected' : ''}>${esc(a.account_code + ' ' + a.account_name)}</option>`).join('');
    const vat0 = l0 ? Number(l0.vat_rate) > 0 : false, wht0 = l0 ? Number(l0.wht_rate || 0) : 0;
    el.innerHTML = F.head('EXPENSE REQUEST', id ? 'แก้ไขคำขอ ' + d.document_number : 'ขอเบิกค่าใช้จ่าย', 'กรอกข้อมูล แนบใบเสนอราคา/เอกสารประกอบ แล้วกด "ส่งขออนุมัติ"',
      `<button class="fm-btn fm-btn-light" data-go="${id ? '#expflow/' + esc(id) : '#expflow'}">← กลับ</button>`) +
      `<form class="fm-panel" id="ffReq" autocomplete="off">
        <div class="fm-form-grid">
          <label class="fm-field fm-field-full"><span>ซื้อ / จ่ายค่าอะไร *</span><input name="description" required maxlength="300" placeholder="เช่น ซื้อแก้วกาแฟ 500 ใบ" value="${esc(l0 ? l0.description : '')}"></label>
          <label class="fm-field"><span>จำนวนเงินที่ขอเบิก (บาท) *</span><input name="amount" type="number" inputmode="decimal" min="0.01" step="0.01" required value="${esc(gross)}"></label>
          <label class="fm-field"><span>วันที่</span><input name="document_date" type="date" required value="${esc(d ? F.d10(d.document_date) : F.today())}"></label>
          <label class="fm-field"><span>จ่ายให้ (ร้าน / ผู้รับเงิน)</span><input name="reference" maxlength="120" value="${esc(d ? d.reference || '' : '')}"></label>
          <label class="fm-field"><span>หมวดค่าใช้จ่าย</span><select name="account_code">${accOpts}</select></label>
          ${vatReg ? `<label class="fm-check fm-field-full"><input type="checkbox" name="vat" ${vat0 ? 'checked' : ''}> มีใบกำกับภาษี (ยอดข้างบนรวม VAT 7% แล้ว)</label>` : ''}
          <label class="fm-field"><span>หัก ณ ที่จ่าย</span><select name="wht_rate">${[0, 1, 2, 3, 5].map(v => `<option value="${v}" ${v === wht0 ? 'selected' : ''}>${v ? v + '%' : 'ไม่หัก'}</option>`).join('')}</select></label>
          <label class="fm-field fm-field-full"><span>หมายเหตุ</span><textarea name="notes" rows="2" maxlength="2000">${esc(d ? d.notes || '' : '')}</textarea></label>
        </div>
        <p class="ff-preview" id="ffPrev"></p>
        ${id ? '' : `<div class="fm-field fm-field-full"><span>แนบเอกสาร (ไม่บังคับ)</span><div class="ff-up"><select name="cat">${REQ_FILES.map(c => `<option value="${c}">${esc(FILE[c])}</option>`).join('')}</select><input type="file" name="files" multiple accept="${ACCEPT}"></div></div>`}
        <div class="fm-form-actions"><button type="button" class="fm-btn fm-btn-light" data-save="wht" title="บันทึกคำขอเป็นร่าง แล้วกรอกหนังสือรับรองหัก ณ ที่จ่าย (50 ทวิ) ต่อ">บันทึก + สร้างหนังสือหัก ณ ที่จ่าย</button><button type="button" class="fm-btn fm-btn-light" data-save="draft">บันทึกร่าง</button><button type="button" class="fm-btn fm-btn-primary" data-save="submit">ส่งขออนุมัติ</button></div>
        <small class="fm-muted">หลายรายการ / เลือกผู้ขายในระบบ → <a href="#expense/new">ใช้ฟอร์มรายจ่ายแบบละเอียด</a></small>
      </form>`;
    const form = F.$('#ffReq', el);
    const vals = () => {
      const fd = new FormData(form), amount = Math.round(Number(fd.get('amount')) * 100) / 100, vat = vatReg && fd.get('vat') === 'on', wht = Number(fd.get('wht_rate') || 0);
      const base = vat ? Math.round(amount * 100 / 107 * 100) / 100 : amount, vatAmt = Math.round((amount - base) * 100) / 100, whtAmt = Math.round(base * wht) / 100;
      return { fd, amount, vat, wht, base, vatAmt, whtAmt, net: Math.round((base + vatAmt - whtAmt) * 100) / 100 };
    };
    const prev = () => { const v = vals(); F.$('#ffPrev', el).textContent = v.amount > 0 ? `ยอดขอเบิกสุทธิ ${baht(v.net)}` + (v.vat || v.wht ? ` (ก่อน VAT ${money(v.base)}${v.vat ? ' · VAT ' + money(v.vatAmt) : ''}${v.wht ? ' · หัก ณ ที่จ่าย ' + money(v.whtAmt) : ''})` : '') : ''; };
    form.addEventListener('input', prev); prev();
    form.addEventListener('click', async e => {
      const b = e.target.closest('[data-save]'); if (!b) return;
      if (!form.reportValidity()) return;
      const v = vals(), submit = b.dataset.save === 'submit', wht = b.dataset.save === 'wht';
      const body = { document_type: 'expense', document_date: v.fd.get('document_date'), reference: v.fd.get('reference'), notes: v.fd.get('notes'),
        vat_rate: v.vat ? 7 : 0, vat_inclusive: v.vat, wht_rate: v.wht,
        lines: [{ description: v.fd.get('description'), quantity: 1, unit_price: v.amount, account_code: v.fd.get('account_code') || null }] };
      const r = await run(b, async () => {
        let docId = id;
        if (id) await api.post('document.update', { ...body, document_id: id });
        else docId = (await api.post('document.create', body, { idem: F.idem() })).id;
        const files = !id && form.querySelector('[name=files]') ? [...form.querySelector('[name=files]').files] : [];
        for (const f of files) await F.upload('expense-request.file.upload', { document_id: docId, category: v.fd.get('cat') }, f);
        if (submit) await api.post('document.submit', { document_id: docId });
        return docId;
      }, submit ? 'ส่งขออนุมัติแล้ว' : wht ? 'บันทึกคำขอแล้ว — กรอกหนังสือรับรองหัก ณ ที่จ่ายต่อ' : 'บันทึกร่างแล้ว');
      if (r) { F.refreshBadges(); F.nav(wht ? '#wht50/new:' + r : '#expflow/' + r); }
    });
  }

  // ---------- รายละเอียด + ปุ่มตามขั้น ----------
  async function detail(el, id) {
    const r = await api.get('expense-flow-item', { id });
    const { item: it, document: d, clearance: c, files, events, actions: a } = r;
    const wht = r.wht || [], whtOn = wht.filter(w => w.status === 'active');
    const reqFiles = files.filter(f => f.stage === 'request'), clrFiles = files.filter(f => f.stage === 'clearance');
    const evidence = clrFiles.filter(f => f.file_category === 'payment_evidence').length;
    const canDelReq = a.edit_request, canDelClr = a.clear && c && ['draft', 'returned'].includes(c.status);
    const fileList = (arr, canDel) => arr.length ? `<div class="ff-files">${arr.map(f => `<div class="ff-file"><div><b>${esc(FILE[f.file_category] || f.file_category)}</b><small>${esc(f.original_name)} · ${kb(f.size_bytes)}</small></div>
        <button type="button" class="fm-btn fm-btn-sm fm-btn-light" data-open="${esc(f.id)}">เปิด</button>${canDel ? `<button type="button" class="fm-btn fm-btn-sm fm-btn-ghost" data-del="${esc(f.id)}" aria-label="ลบไฟล์">ลบ</button>` : ''}</div>`).join('')}</div>`
      : '<p class="fm-muted" style="margin:0">ยังไม่มีไฟล์</p>';

    // กล่อง "สิ่งที่ต้องทำตอนนี้"
    let act = '';
    const amount = Number(d.grand_total);
    if (a.submit_request) act = `<section class="fm-panel ff-act"><h2>ขั้นที่ 1 · ตรวจรายละเอียด แนบเอกสาร แล้วส่งขออนุมัติ</h2><p>Owner จะได้รับคำขอทันที</p>
        ${uploader('req', REQ_FILES)}<div class="ff-btns" style="margin-top:12px"><button class="fm-btn fm-btn-primary" data-do="submit-request">ส่งขออนุมัติ</button>
        <button class="fm-btn fm-btn-light" data-go="#expflow/edit:${esc(d.id)}">แก้ไขคำขอ</button><button class="fm-btn fm-btn-ghost" data-do="void">ยกเลิกคำขอ</button></div></section>`;
    else if (a.approve_request || a.return_request) act = `<section class="fm-panel ff-act"><h2>อนุมัติคำขอเบิก ${baht(amount)}</h2><p>อนุมัติ = ให้ผู้เบิกจ่ายเงินได้ไม่เกินวงเงินนี้ (ยังไม่ลงบัญชีจนกว่าจะเคลียร์และปิดงาน)</p>
        <div class="ff-btns">${a.approve_request ? '<button class="fm-btn fm-btn-primary" data-do="approve-request">อนุมัติวงเงิน</button>' : ''}<button class="fm-btn fm-btn-light" data-do="return-request">ส่งกลับให้แก้</button></div></section>`;
    else if (a.clear) act = clearForm(d, c, r.pay_accounts, evidence, clrFiles);
    else if (a.approve_clearance || a.return_clearance) act = `<section class="fm-panel ff-act"><h2>ตรวจเคลียร์</h2><p>ตรวจยอดจ่ายจริง ใบเสร็จ และเงินคืน แล้วอนุมัติ หรือส่งกลับให้แก้</p>${sumBox(c)}
        <div class="ff-btns">${a.approve_clearance ? '<button class="fm-btn fm-btn-primary" data-do="approve-clearance">อนุมัติเคลียร์</button>' : ''}<button class="fm-btn fm-btn-light" data-do="return-clearance">ส่งกลับให้แก้</button></div></section>`;
    else if (a.verify) act = `<section class="fm-panel ff-act"><h2>ตรวจขั้นสุดท้าย</h2><p>ยืนยันแล้วระบบจะปิดงาน ลงบัญชี และอัปเดตรายงาน/แดชบอร์ดให้ทันที</p>${sumBox(c)}
        <ul class="ff-check"><li class="${reqFiles.length ? 'ok' : 'no'}">เอกสารตอนขอเบิก ${reqFiles.length} ไฟล์</li><li class="${evidence ? 'ok' : 'no'}">หลักฐานการจ่ายเงิน ${evidence} ไฟล์</li>
        <li class="${clrFiles.some(f => ['receipt_invoice', 'tax_invoice'].includes(f.file_category)) ? 'ok' : 'no'}">ใบเสร็จ / ใบกำกับภาษี</li>${Number(d.wht_total) > 0 || whtOn.length ? `<li class="${whtOn.length ? 'ok' : 'no'}">หนังสือรับรองหัก ณ ที่จ่าย (50 ทวิ) ${whtOn.length} ฉบับ</li>` : ''}${Number(c.refund_amount) > 0 ? `<li class="${clrFiles.some(f => f.file_category === 'refund_evidence') ? 'ok' : 'no'}">หลักฐานคืนเงิน ${baht(c.refund_amount)}</li>` : ''}</ul>
        <label class="fm-check"><input type="checkbox" id="ffConfirm"> ตรวจเอกสารและหลักฐานทั้งหมดแล้ว ครบถ้วนและถูกต้อง</label>
        <div class="ff-btns" style="margin-top:12px"><button class="fm-btn fm-btn-primary" data-do="verify">ยืนยัน ปิดงาน</button><button class="fm-btn fm-btn-light" data-do="verifier-return">ส่งกลับให้แก้</button></div></section>`;
    else if (it.stage === 'closed') act = `<div class="fm-notice"><span>✓</span><div><b>ปิดงานแล้ว${c && c.journal_number ? ' · ลงบัญชี ' + esc(c.journal_number) : ''}</b><small>${c ? 'ค่าใช้จ่ายจริง ' + baht(c.actual_expense_amount) + (Number(c.refund_amount) > 0 ? ' · คืนเงิน ' + baht(c.refund_amount) : '') + ' · ' : ''}รายงานและแดชบอร์ดอัปเดตแล้ว
        ${c && c.journal_entry_id && !['manager', 'staff', 'verifier'].includes(role()) ? ` · <a href="#journal/${esc(c.journal_entry_id)}">ดูรายการบัญชี</a>` : ''}</small></div></div>`;
    else if (it.stage !== 'cancelled') act = `<div class="fm-notice warn"><span>⏳</span><div><b>รอ ${esc(WAIT[it.stage] || '')}</b><small>${a.attach_request ? 'แนบเอกสารเพิ่มได้ด้านล่าง' : 'ระบบจะขึ้นในรายการ "ต้องทำ" ของผู้รับผิดชอบ'}</small></div></div>` +
      (a.attach_request && it.stage === 'request_review' ? `<section class="fm-panel">${uploader('req', REQ_FILES)}</section>` : '');
    const block = a.self_blocked || a.sod_blocked;

    el.innerHTML = F.head(d.document_number, it.title || 'คำขอเบิก', `ผู้เบิก ${esc(d.created_by_name)} · ${esc(thDate(d.document_date))}${it.payee ? ' · จ่ายให้ ' + esc(it.payee) : ''}`,
      '<button class="fm-btn fm-btn-light" data-go="#expflow">← รายการเบิก</button>') +
      (it.stage === 'cancelled' ? '' : stepper(it.stage, it.returned)) +
      (it.returned ? `<div class="fm-notice bad"><span>↩</span><div><b>${esc(RETURNED[it.returned])}</b><small>${esc(it.return_note || '')} — แก้ไขแล้วส่งใหม่</small></div></div>` : '') +
      (block ? `<div class="fm-notice"><span>ⓘ</span><div><b>${esc(block)}</b></div></div>` : '') + act +
      `<div class="fm-grid2">
        <section class="fm-panel"><div class="fm-panel-head"><h2>คำขอเบิก</h2>${stageBadge(it.stage)}</div>
          <dl class="fm-dl"><dt>ยอดที่อนุมัติ/ขอเบิก</dt><dd><b>${baht(amount)}</b></dd>
          ${Number(d.vat_total) ? `<dt>VAT</dt><dd>${baht(d.vat_total)}</dd>` : ''}${Number(d.wht_total) ? `<dt>หัก ณ ที่จ่าย</dt><dd>${baht(d.wht_total)}</dd>` : ''}
          <dt>รายการ</dt><dd>${r.lines.map(l => esc(l.description) + (r.lines.length > 1 ? ' · ' + baht(Number(l.line_total) + Number(l.vat_amount || 0)) : '')).join('<br>')}</dd>
          ${d.notes ? `<dt>หมายเหตุ</dt><dd>${esc(d.notes)}</dd>` : ''}${d.approved_by_name ? `<dt>อนุมัติคำขอโดย</dt><dd>${esc(d.approved_by_name)}</dd>` : ''}</dl>
          <h3 class="ff-h3">เอกสารตอนขอเบิก</h3>${fileList(reqFiles, canDelReq)}</section>
        <section class="fm-panel"><div class="fm-panel-head"><h2>การจ่ายเงิน / เคลียร์</h2></div>
          ${c ? `${sumBox(c)}<dl class="fm-dl"><dt>วันที่จ่าย</dt><dd>${esc(thDate(c.payment_date))}</dd><dt>ช่องทาง</dt><dd>${esc(F.L.method[c.payment_method] || c.payment_method)}${c.payment_account_name ? ' · ' + esc(c.payment_account_code + ' ' + c.payment_account_name) : ''}</dd>
            ${c.reference_number ? `<dt>เลขอ้างอิง</dt><dd>${esc(c.reference_number)}</dd>` : ''}${c.notes ? `<dt>หมายเหตุ</dt><dd>${esc(c.notes)}</dd>` : ''}
            ${c.owner_approved_by_name ? `<dt>Owner อนุมัติเคลียร์</dt><dd>${esc(c.owner_approved_by_name)}</dd>` : ''}${c.verified_by_name ? `<dt>ผู้ตรวจสุดท้าย</dt><dd>${esc(c.verified_by_name)} · ${esc(thDateTime(c.verified_at))}</dd>` : ''}</dl>
            <h3 class="ff-h3">หลักฐานการจ่าย / ใบเสร็จ</h3>${fileList(clrFiles, canDelClr)}` : '<p class="fm-muted" style="margin:0">ยังไม่ได้บันทึกการจ่ายเงิน</p>'}</section>
      </div>
      ${whtPanel(d, wht, a)}
      <section class="fm-panel"><div class="fm-panel-head"><h2>ประวัติ</h2></div>${events.length ? `<ol class="ff-time">${events.map(e => `<li class="${/return/.test(e.action) ? 'bad' : ''}"><div><b>${esc(EVENT[e.entity_type + ':' + e.action] || e.action)}</b>
        <small>${esc(e.actor_name)} · ${esc(thDateTime(e.created_at))}${e.note ? ' · ' + esc(e.note) : ''}</small></div></li>`).join('')}</ol>` : '<p class="fm-muted" style="margin:0">ยังไม่มีประวัติ</p>'}</section>`;
    wire(el, r);
  }

  // หนังสือรับรองหัก ณ ที่จ่าย (50 ทวิ) ที่ผูกกับคำขอนี้
  function whtPanel(d, wht, a) {
    if (!wht.length && !a.wht_create) return '';
    const need = Number(d.wht_total) > 0 && !wht.some(w => w.status === 'active');
    return `<section class="fm-panel" id="ffWht"><div class="fm-panel-head"><div><h2>หนังสือรับรองหัก ณ ที่จ่าย (50 ทวิ)</h2><p>${need ? 'คำขอนี้มีหัก ณ ที่จ่าย ' + baht(d.wht_total) + ' — สร้างหนังสือแล้วพิมพ์ให้ผู้รับเงิน' : 'บันทึกแล้วแนบกับคำขอนี้อัตโนมัติ · พิมพ์ 2 ฉบับ (ผู้รับเงิน / เก็บเป็นหลักฐาน)'}</p></div>
      ${a.wht_create ? `<button class="fm-btn ${need ? 'fm-btn-primary' : 'fm-btn-light'}" data-go="#wht50/new:${esc(d.id)}">＋ สร้างหนังสือหัก ณ ที่จ่าย</button>` : ''}</div>
      ${wht.length ? `<div class="ff-files">${wht.map(w => `<div class="ff-file${w.status === 'active' ? '' : ' ff-void'}"><div><b>${esc(w.cert_number)} · ${esc(({ pnd3: 'ภ.ง.ด.3', pnd53: 'ภ.ง.ด.53', pnd1a: 'ภ.ง.ด.1ก', pnd1a_special: 'ภ.ง.ด.1ก พิเศษ', pnd2: 'ภ.ง.ด.2', pnd2a: 'ภ.ง.ด.2ก', pnd3a: 'ภ.ง.ด.3ก' })[w.form_type] || w.form_type)}</b>
          <small>${esc(thDate(w.issue_date))} · จ่าย ${baht(w.total_amount)} · หักภาษี ${baht(w.total_tax)}${w.status === 'active' ? '' : ' · ยกเลิกแล้ว' + (w.void_reason ? ': ' + esc(w.void_reason) : '')}</small></div>
          ${w.status === 'active' ? `<button type="button" class="fm-btn fm-btn-sm fm-btn-primary" data-wht-print="${esc(w.id)}">พิมพ์</button><button type="button" class="fm-btn fm-btn-sm fm-btn-light" data-go="#wht50/${esc(w.id)}">ดู</button>
          ${a.wht_edit ? `<button type="button" class="fm-btn fm-btn-sm fm-btn-light" data-go="#wht50/edit:${esc(w.id)}">แก้ไข</button>` : ''}${a.wht_create ? `<button type="button" class="fm-btn fm-btn-sm fm-btn-ghost" data-wht-void="${esc(w.id)}">ยกเลิก</button>` : ''}` : ''}</div>`).join('')}</div>`
        : '<p class="fm-muted" style="margin:0">ยังไม่มีหนังสือรับรอง</p>'}</section>`;
  }

  function sumBox(c) {
    return `<div class="ff-sum"><div><small>จ่ายไป</small><b>${baht(c.actual_paid_amount)}</b></div><div><small>ใช้จริง</small><b>${baht(c.actual_expense_amount)}</b></div><div><small>คืนเงิน</small><b>${baht(c.refund_amount)}</b></div></div>`;
  }

  function clearForm(d, c, accounts, evidence, clrFiles) {
    const amount = Number(d.grand_total), paid = c ? Number(c.actual_paid_amount) : amount, exp = c ? Number(c.actual_expense_amount) : amount;
    const method = c ? c.payment_method : 'cash';
    const accOpts = '<option value="">— เลือกบัญชี —</option>' + (accounts || []).map(x => `<option value="${esc(x.id)}" ${c && c.payment_account_id === x.id ? 'selected' : ''}>${esc(x.code + ' ' + x.name)}</option>`).join('');
    return `<section class="fm-panel ff-act"><h2>ขั้นที่ 3 · บันทึกจ่ายเงิน + เคลียร์</h2><p>วงเงินที่อนุมัติ ${baht(amount)} · แนบสลิป/ใบเสร็จ ถ้าใช้ไม่หมดให้ใส่ยอดใช้จริง ระบบคำนวณเงินคืนให้</p>
      <form id="ffClr" class="fm-form-grid three" autocomplete="off">
        <label class="fm-field"><span>วันที่จ่ายเงิน *</span><input type="date" name="payment_date" required value="${esc(c ? F.d10(c.payment_date) : F.today())}"></label>
        <label class="fm-field"><span>จ่ายด้วย *</span><select name="payment_method">${Object.entries(F.L.method).map(([k, v]) => `<option value="${k}" ${k === method ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select></label>
        <label class="fm-field" id="ffAcc" ${['credit_card', 'other'].includes(method) ? '' : 'hidden'}><span>บัญชีที่ใช้จ่าย *</span><select name="payment_account_id">${accOpts}</select></label>
        <label class="fm-field"><span>ยอดที่จ่ายไป (บาท) *</span><input type="number" name="actual_paid_amount" inputmode="decimal" step="0.01" min="0.01" max="${amount}" required value="${paid}"></label>
        <label class="fm-field"><span>ค่าใช้จ่ายจริง (ตามใบเสร็จ) *</span><input type="number" name="actual_expense_amount" inputmode="decimal" step="0.01" min="0.01" required value="${exp}"></label>
        <label class="fm-field"><span>เงินคืนบริษัท</span><input name="refund" readonly tabindex="-1" value="${money(Math.max(0, paid - exp))}"></label>
        <label class="fm-field"><span>เลขอ้างอิง (สลิป/ใบเสร็จ)</span><input name="reference_number" maxlength="120" value="${esc(c && c.reference_number || '')}"></label>
        <label class="fm-field fm-field-full"><span>หมายเหตุ</span><input name="notes" maxlength="1000" value="${esc(c && c.notes || '')}"></label>
      </form>
      ${Number(d.wht_total) > 0 ? `<div class="fm-notice"><span>ⓘ</span><div><b>มีหัก ณ ที่จ่าย ${baht(d.wht_total)}</b><small>สร้าง/พิมพ์หนังสือรับรอง 50 ทวิ ได้ที่ส่วน "หนังสือรับรองหัก ณ ที่จ่าย" ด้านล่าง แล้วแนบสแกนฉบับที่เซ็นแล้วเป็น "หนังสือรับรองหัก ณ ที่จ่าย"</small></div></div>` : ''}
      <h3 class="ff-h3">แนบหลักฐาน ${evidence ? `<span class="fm-badge ok">สลิป ${evidence} ไฟล์</span>` : '<span class="fm-badge warn">ต้องแนบสลิปอย่างน้อย 1 ไฟล์</span>'}</h3>
      ${uploader('clr', CLR_FILES, 'PDF / รูปภาพ ไม่เกิน 20 MB · แนบได้หลายไฟล์')}
      <div class="ff-btns" style="margin-top:12px"><button class="fm-btn fm-btn-primary" data-do="submit-clearance">ส่งเคลียร์ให้ Owner</button><button class="fm-btn fm-btn-light" data-do="save-clearance">บันทึกร่าง</button></div></section>`;
  }

  function wire(el, r) {
    const { document: d, clearance: c } = r;
    const clr = F.$('#ffClr', el);
    const clrVals = (submit) => {
      const fd = new FormData(clr);
      return { document_id: d.id, submit, payment_date: fd.get('payment_date'), payment_method: fd.get('payment_method'),
        payment_account_id: ['credit_card', 'other'].includes(fd.get('payment_method')) ? fd.get('payment_account_id') || null : null,
        actual_paid_amount: Number(fd.get('actual_paid_amount')), actual_expense_amount: Number(fd.get('actual_expense_amount')),
        reference_number: fd.get('reference_number'), notes: fd.get('notes') };
    };
    if (clr) {
      clr.addEventListener('input', () => {
        const p = Number(clr.actual_paid_amount.value || 0), x = Number(clr.actual_expense_amount.value || 0);
        clr.refund.value = money(Math.max(0, Math.round((p - x) * 100) / 100));
        F.$('#ffAcc', el).hidden = !['credit_card', 'other'].includes(clr.payment_method.value);
      });
    }
    const saveDraft = async () => { if (!clr.reportValidity()) throw new Error('กรุณากรอกข้อมูลการจ่ายเงินให้ครบ'); return api.post('expense-clearance.submit', clrVals(false)); };
    el.querySelectorAll('[data-up] input[type=file]').forEach(inp => inp.addEventListener('change', async () => {
      const box = inp.closest('[data-up]'), files = [...inp.files], cat = box.querySelector('select').value, btn = box.querySelector('label');
      if (!files.length) return;
      let n = 0;
      if (box.dataset.up === 'req') n = await uploadMany('expense-request.file.upload', { document_id: d.id, category: cat }, files, btn);
      else {
        let cid = c && c.id;
        if (!cid || ['draft', 'returned'].includes(c.status)) { const s = await run(btn, saveDraft); if (!s) { inp.value = ''; return; } cid = s.id; }
        n = await uploadMany('expense-clearance.file.upload', { clearance_id: cid, category: cat }, files, btn);
      }
      inp.value = '';
      if (n) F.reload();
    }));
    el.addEventListener('click', async e => {
      const op = e.target.closest('[data-open]'); if (op) return openFile(op, op.dataset.open);
      const wp = e.target.closest('[data-wht-print]'); if (wp) { const w = window.open('', '_blank'); try { await F.load('wht50'); F.printWht(wp.dataset.whtPrint, w); } catch (err) { if (w) w.close(); F.toast(err.message, 'bad'); } return; }
      const wv = e.target.closest('[data-wht-void]');
      if (wv) { const why = await F.ask('ยกเลิกหนังสือรับรองหัก ณ ที่จ่าย', 'เลขที่เดิมจะไม่ถูกนำกลับมาใช้ (ออกฉบับใหม่ได้)', { input: true, required: true, label: 'เหตุผล', danger: true, ok: 'ยกเลิกหนังสือ' }); if (why && await run(wv, () => api.post('wht-certificate.void', { id: wv.dataset.whtVoid, reason: why }), 'ยกเลิกแล้ว')) F.reload(); return; }
      const del = e.target.closest('[data-del]');
      if (del) { if (await F.ask('ลบไฟล์', 'ลบไฟล์นี้ออกจากรายการ?', { ok: 'ลบ', danger: true }) && await run(del, () => api.post('expense-file.delete', { file_id: del.dataset.del }), 'ลบไฟล์แล้ว')) F.reload(); return; }
      const b = e.target.closest('[data-do]'); if (!b) return;
      const done = (msg) => async (fn) => { const out = await run(b, fn, msg); if (out) { F.refreshBadges(); F.reload(); } return out; };
      switch (b.dataset.do) {
        case 'submit-request': return done('ส่งขออนุมัติแล้ว')(() => api.post('document.submit', { document_id: d.id }));
        case 'void': { const why = await F.ask('ยกเลิกคำขอ', 'ยกเลิกคำขอนี้?', { input: true, required: true, label: 'เหตุผล', danger: true, ok: 'ยกเลิกคำขอ' }); if (why) return done('ยกเลิกแล้ว')(() => api.post('document.void', { document_id: d.id, reason: why })); return; }
        case 'approve-request': { if (await F.ask('อนุมัติคำขอเบิก', `อนุมัติวงเงิน <b>${baht(d.grand_total)}</b> ให้ผู้เบิกดำเนินการจ่าย?`, { ok: 'อนุมัติ' })) return done('อนุมัติแล้ว — รอผู้เบิกจ่ายเงินและเคลียร์')(() => api.post('document.approve', { document_id: d.id })); return; }
        case 'return-request': { const why = await F.ask('ส่งกลับให้แก้', 'บอกผู้เบิกว่าต้องแก้อะไร', { input: true, required: true, label: 'เหตุผล', ok: 'ส่งกลับ' }); if (why) return done('ส่งกลับแล้ว')(() => api.post('document.return', { document_id: d.id, note: why })); return; }
        case 'save-clearance': return done('บันทึกร่างแล้ว')(saveDraft);
        case 'submit-clearance': {
          if (!clr.reportValidity()) return;
          const v = clrVals(true);
          if (v.actual_expense_amount > v.actual_paid_amount) { F.toast('ค่าใช้จ่ายจริงมากกว่ายอดที่จ่าย — ถ้าใช้เกิน ให้ขอเบิกเพิ่ม', 'bad'); return; }
          if (!r.files.some(f => f.stage === 'clearance' && f.file_category === 'payment_evidence')) { F.toast('แนบหลักฐานการจ่ายเงิน (สลิป) อย่างน้อย 1 ไฟล์ก่อนส่ง', 'bad'); return; }
          return done(x => x && x.next_step === 'final_verification' ? 'ส่งแล้ว — กลับไปที่ผู้ตรวจสุดท้าย' : 'ส่งเคลียร์แล้ว — รอ Owner ตรวจ')(() => api.post('expense-clearance.submit', v));
        }
        case 'approve-clearance': return done('อนุมัติเคลียร์แล้ว — รอผู้ตรวจสุดท้าย')(() => api.post('expense-clearance.approve', { clearance_id: c.id }));
        case 'return-clearance': { const why = await F.ask('ส่งเคลียร์กลับให้แก้', 'บอกผู้เบิกว่าต้องแก้อะไร', { input: true, required: true, label: 'เหตุผล', ok: 'ส่งกลับ' }); if (why) return done('ส่งกลับแล้ว')(() => api.post('expense-clearance.return', { clearance_id: c.id, note: why })); return; }
        case 'verify': {
          if (!F.$('#ffConfirm', el).checked) { F.toast('กรุณาติ๊กยืนยันว่าตรวจเอกสารครบถ้วนแล้ว', 'bad'); return; }
          return done(x => 'ปิดงานแล้ว · ลงบัญชี ' + (x && x.journal_number || ''))(() => api.post('expense-clearance.verify', { clearance_id: c.id, confirm_complete: true }));
        }
        case 'verifier-return': { const why = await F.ask('ส่งกลับให้แก้', 'บอกผู้เบิกว่าต้องแก้อะไร', { input: true, required: true, label: 'เหตุผล', ok: 'ส่งกลับ' }); if (why) return done('ส่งกลับแล้ว')(() => api.post('expense-clearance.verifier-return', { clearance_id: c.id, note: why })); return; }
      }
    });
  }

  F.page('expflow', {
    title: 'เบิก–เคลียร์ค่าใช้จ่าย',
    async render(el, arg) {
      if (arg === 'new') return requestForm(el, null);
      if (arg && arg.startsWith('edit:')) return requestForm(el, arg.slice(5));
      if (arg) return detail(el, arg);
      return list(el);
    },
  });
})();
