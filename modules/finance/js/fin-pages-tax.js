/* Finance: รายงานภาษีซื้อ–ขาย, หัก ณ ที่จ่าย, แบบภาษี */
(function () {
  'use strict';
  const F = window.FIN, { esc, money, thDate, table, badge, L, api, run } = F;
  const periodPicker = (id, v) => `<input type="month" id="${id}" value="${v || F.thisMonth()}">`;

  F.page('vat', {
    title: 'ภาษีซื้อ–ภาษีขาย',
    async render(el) {
      el.innerHTML = F.head('VAT', 'รายงานภาษีซื้อ–ภาษีขาย', 'จากเอกสารที่อนุมัติ/ลงบัญชีแล้ว ตามเดือนภาษี', periodPicker('fmVP') + '<button class="fm-btn fm-btn-light" id="fmVCsv">↓ CSV</button><button class="fm-btn fm-btn-primary" data-go="#filings">จัดทำ ภ.พ.30</button>') +
        (F.session.company.vatRegistered ? '' : '<div class="fm-notice warn"><span>!</span><div><b>บริษัทยังไม่ได้จดทะเบียน VAT</b><small>ไม่ต้องยื่น ภ.พ.30 · ภาษีซื้อจะรวมเป็นต้นทุนค่าใช้จ่าย</small></div></div>') + `<div id="fmV">${F.loading()}</div>`;
      let data;
      const load = async () => {
        data = await api.get('tax-report', { period: el.querySelector('#fmVP').value });
        const t = data.totals, cols = [{ h: 'วันที่', f: x => thDate(x.document_date) }, { h: 'เลขที่', f: x => `${esc(x.document_number)}${x.reference ? `<span class="sub">อ้างอิง ${esc(x.reference)}</span>` : ''}` }, { h: 'คู่ค้า', f: x => esc(x.partner_name || '–') + `<span class="sub">${esc(x.partner_tax_id || '')}${x.partner_branch ? ' สาขา ' + esc(x.partner_branch) : ''}</span>` }, { h: 'มูลค่า', num: 1, f: x => money(x.tax_base) }, { h: 'VAT', num: 1, f: x => money(x.tax_amount) }, { h: '', f: x => badge(x.status) }];
        const out = data.items.filter(x => x.tax_type === 'vat_output'), inp = data.items.filter(x => x.tax_type === 'vat_input');
        el.querySelector('#fmV').innerHTML = `<div class="fm-kpis"><article class="fm-kpi"><div class="fm-kpi-label">ภาษีขาย</div><strong>${money(t.vat_output)}</strong><small>ยอดขาย ${money(t.sales_base)}</small></article><article class="fm-kpi"><div class="fm-kpi-label">ภาษีซื้อ</div><strong>${money(t.vat_input)}</strong><small>ยอดซื้อ ${money(t.purchase_base)}</small></article><article class="fm-kpi"><div class="fm-kpi-label">${t.vat_net >= 0 ? 'ต้องชำระ' : 'ชำระเกิน (ขอคืน/ยกไป)'}</div><strong>${money(Math.abs(t.vat_net))}</strong><small>ภาษีขาย − ภาษีซื้อ</small></article><article class="fm-kpi"><div class="fm-kpi-label">กำหนดยื่น (e-Filing)</div><strong style="font-size:17px">${thDate(nextDue(data.period, 23))}</strong><small>ภ.พ.30</small></article></div>
          <section class="fm-panel"><div class="fm-panel-head"><h2>รายงานภาษีขาย</h2></div>${table(cols, out, { empty: 'ไม่มีภาษีขายในเดือนนี้', compact: true, foot: ['รวม', '', '', { v: money(t.sales_base), num: 1 }, { v: money(t.vat_output), num: 1 }, ''] })}</section>
          <section class="fm-panel"><div class="fm-panel-head"><h2>รายงานภาษีซื้อ</h2></div>${table(cols, inp, { empty: 'ไม่มีภาษีซื้อในเดือนนี้', compact: true, foot: ['รวม', '', '', { v: money(t.purchase_base), num: 1 }, { v: money(t.vat_input), num: 1 }, ''] })}</section>`;
      };
      el.querySelector('#fmVP').onchange = load;
      el.querySelector('#fmVCsv').onclick = () => data && F.csv('vat-' + data.period + '.csv', [['ประเภท', 'วันที่', 'เลขที่', 'อ้างอิง', 'คู่ค้า', 'เลขผู้เสียภาษี', 'สาขา', 'มูลค่า', 'VAT']].concat(data.items.filter(x => x.tax_type !== 'wht').map(x => [x.tax_type === 'vat_output' ? 'ภาษีขาย' : 'ภาษีซื้อ', F.d10(x.document_date), x.document_number, x.reference || '', x.partner_name || '', x.partner_tax_id || '', x.partner_branch || '', x.tax_base, x.tax_amount])));
      await load();
    },
  });
  function nextDue(p, day) { const [y, m] = p.split('-').map(Number); const ny = m === 12 ? y + 1 : y, nm = m === 12 ? 1 : m + 1; return ny + '-' + String(nm).padStart(2, '0') + '-' + String(day).padStart(2, '0'); }

  F.page('wht', {
    title: 'ภาษีหัก ณ ที่จ่าย',
    async render(el) {
      el.innerHTML = F.head('WITHHOLDING TAX', 'ภาษีหัก ณ ที่จ่าย', 'ที่เราหักผู้ขาย (ต้องนำส่ง ภ.ง.ด.3 บุคคล / ภ.ง.ด.53 นิติบุคคล) และที่ลูกค้าหักเรา (เครดิตภาษี)', periodPicker('fmWP') + '<button class="fm-btn fm-btn-light" id="fmWCsv">↓ CSV</button><button class="fm-btn fm-btn-primary" data-go="#filings">จัดทำแบบ</button>') + `<div id="fmW">${F.loading()}</div>`;
      let data;
      const load = async () => {
        data = await api.get('tax-report', { period: el.querySelector('#fmWP').value });
        const w = data.items.filter(x => x.tax_type === 'wht'), t = data.totals;
        const cols = [{ h: 'วันที่', f: x => thDate(x.document_date) }, { h: 'เลขที่', k: 'document_number' }, { h: 'คู่ค้า', f: x => esc(x.partner_name || '–') + `<span class="sub">${esc(x.partner_tax_id || '')}</span>` }, { h: 'เงินได้', num: 1, f: x => money(x.tax_base) }, { h: 'อัตรา', num: 1, f: x => Number(x.tax_rate) + '%' }, { h: 'ภาษี', num: 1, f: x => money(x.tax_amount) }, { h: '', f: x => badge(x.status) }];
        const sec = (title, form, total) => `<section class="fm-panel"><div class="fm-panel-head"><h2>${title}</h2><b>${money(total)}</b></div>${table(cols, w.filter(x => x.tax_form_code === form), { empty: 'ไม่มีรายการ', compact: true })}</section>`;
        el.querySelector('#fmW').innerHTML = `<div class="fm-kpis"><article class="fm-kpi"><div class="fm-kpi-label">ภ.ง.ด.3 (บุคคลธรรมดา)</div><strong>${money(t.pnd3)}</strong><small>นำส่งภายใน ${thDate(nextDue(data.period, 15))} (e-Filing)</small></article><article class="fm-kpi"><div class="fm-kpi-label">ภ.ง.ด.53 (นิติบุคคล)</div><strong>${money(t.pnd53)}</strong><small>นำส่งภายใน ${thDate(nextDue(data.period, 15))} (e-Filing)</small></article><article class="fm-kpi"><div class="fm-kpi-label">ถูกหัก ณ ที่จ่าย</div><strong>${money(t.wht_received)}</strong><small>ใช้เครดิตตอนยื่นภาษีเงินได้</small></article></div>` +
          sec('ภ.ง.ด.3 — หักบุคคลธรรมดา', 'PND3', t.pnd3) + sec('ภ.ง.ด.53 — หักนิติบุคคล', 'PND53', t.pnd53) + sec('ลูกค้าหักเรา (เก็บหนังสือรับรองการหักภาษี)', 'WHT_RECEIVED', t.wht_received);
      };
      el.querySelector('#fmWP').onchange = load;
      el.querySelector('#fmWCsv').onclick = () => data && F.csv('wht-' + data.period + '.csv', [['แบบ', 'วันที่', 'เลขที่', 'คู่ค้า', 'เลขผู้เสียภาษี', 'เงินได้', 'อัตรา', 'ภาษี']].concat(data.items.filter(x => x.tax_type === 'wht').map(x => [x.tax_form_code, F.d10(x.document_date), x.document_number, x.partner_name || '', x.partner_tax_id || '', x.tax_base, x.tax_rate, x.tax_amount])));
      await load();
    },
  });

  F.page('filings', {
    title: 'แบบภาษี',
    async render(el) {
      const items = (await api.get('filings')).items;
      el.innerHTML = F.head('TAX FILINGS', 'แบบภาษี', 'จัดทำ → ส่งตรวจ → อนุมัติ → ยื่นที่ระบบกรมสรรพากร (efiling.rd.go.th) แล้วกลับมาบันทึกเลขอ้างอิง → บันทึกการชำระ') +
        '<div class="fm-notice"><span>ⓘ</span><div><b>ระบบนี้ไม่ได้ยื่นแบบให้อัตโนมัติ</b><small>ใช้ตัวเลขจากหน้านี้ไปกรอกที่ระบบ e-Filing ของกรมสรรพากร แล้วกลับมาบันทึกเลขอ้างอิงการยื่น</small></div></div>' +
        (F.can('write') ? `<section class="fm-panel"><div class="fm-panel-head"><div><h2>จัดทำแบบใหม่</h2><p>ดึงรายการภาษีของเดือนที่ลงบัญชีแล้ว (จัดทำซ้ำได้จนกว่าจะส่งตรวจ)</p></div></div><div class="fm-toolbar"><select id="fmFForm"><option value="PP30">ภ.พ.30 (VAT)</option><option value="PND3">ภ.ง.ด.3</option><option value="PND53">ภ.ง.ด.53</option></select>${periodPicker('fmFP')}<button class="fm-btn fm-btn-primary" id="fmFPrep">จัดทำ</button></div></section>` : '') +
        table([{ h: 'แบบ / งวด', f: x => `<b>${esc(L.form[x.form_code])}</b> ${esc(F.monthName(x.tax_period))}<span class="sub">${x.line_count} รายการ · กำหนด ${thDate(x.due_date)}</span>` },
          { h: 'รายละเอียด', f: x => x.form_code === 'PP30' ? `ขาย ${money(x.totals.vat_output)} · ซื้อ ${money(x.totals.vat_input)}` : `เงินได้ ${money(x.totals.base)}` },
          { h: 'ยอด', num: 1, f: x => money(x.return_amount) + (x.form_code === 'PP30' && Number(x.totals.net) < 0 ? '<span class="sub">ชำระเกิน</span>' : '') },
          { h: 'สถานะ', f: x => badge(x.status) + (x.receipt_reference ? `<span class="sub">อ้างอิง ${esc(x.receipt_reference)}</span>` : '') + (x.notes ? `<span class="sub">${esc(x.notes)}</span>` : '') },
          { h: '', cls: 'acts', f: x => actions(x) }], items, { empty: 'ยังไม่มีแบบภาษี' });
      const prep = el.querySelector('#fmFPrep');
      if (prep) prep.onclick = async () => { if (await run(prep, () => api.post('tax.prepare', { form_code: el.querySelector('#fmFForm').value, period: el.querySelector('#fmFP').value }), r => 'จัดทำแล้ว · ยอด ' + money(r.return_amount))) F.reload(); };
      el.onclick = async e => {
        const b = e.target.closest('[data-f]'); if (!b) return;
        const id = b.dataset.id; let ok;
        if (b.dataset.f === 'review') ok = await run(b, () => api.post('tax.submit-review', { filing_id: id }), 'ส่งตรวจแล้ว');
        if (b.dataset.f === 'return') { const n = await F.ask('ตีกลับแบบภาษี', '', { input: true, required: true }); if (n) ok = await run(b, () => api.post('tax.return', { filing_id: id, note: n }), 'ตีกลับแล้ว'); }
        if (b.dataset.f === 'approve') { if (await F.ask('อนุมัติแบบภาษี', 'รายการภาษีของงวดจะถูกล็อก' + (b.dataset.form === 'PP30' ? ' และระบบจะลงบัญชีโอนภาษีซื้อ–ขายเข้า "ภาษีมูลค่าเพิ่มค้างจ่าย"' : ''), {})) ok = await run(b, () => api.post('tax.approve', { filing_id: id }), 'อนุมัติแล้ว'); }
        if (b.dataset.f === 'filed') { const ref = await F.ask('บันทึกว่ายื่นแบบแล้ว', 'กรอกเลขอ้างอิง/เลขที่ใบเสร็จจากระบบกรมสรรพากร', { input: true, required: true, label: 'เลขอ้างอิงการยื่น', placeholder: 'เช่น เลขที่ใบเสร็จ / Reference No.' }); if (ref) { const d = await F.ask('วันที่ยื่นแบบ', '', { input: true, type: 'date', label: 'วันที่', required: true }); if (d) ok = await run(b, () => api.post('tax.mark-submitted', { filing_id: id, receipt_reference: ref, submitted_at: d }), 'บันทึกแล้ว'); } }
        if (b.dataset.f === 'paid') { const d = await F.ask('บันทึกการชำระภาษี', 'ระบบจะลงบัญชี Dr ภาษีค้างจ่าย / Cr เงินฝากธนาคาร (ถ้ายอดเป็นชำระเกิน ไม่ลงบัญชี)', { input: true, type: 'date', label: 'วันที่ชำระ', required: true }); if (d) ok = await run(b, () => api.post('tax.mark-paid', { filing_id: id, paid_date: d }), 'บันทึกแล้ว'); }
        if (ok) { F.refreshBadges(); F.reload(); }
      };
    },
  });
  function actions(x) {
    const me = F.session.actor.ref, self = F.session.company.allowSelfApproval && F.session.actor.role === 'owner';
    if (x.status === 'preparing' && F.can('write')) return `<button class="fm-btn fm-btn-sm fm-btn-primary" data-f="review" data-id="${x.id}">ส่งตรวจ</button>`;
    if (x.status === 'review' && F.can('approve')) return `<button class="fm-btn fm-btn-sm" data-f="return" data-id="${x.id}">ตีกลับ</button> ` + (x.prepared_by === me && !self ? '<small class="fm-muted">คุณเป็นผู้จัดทำ</small>' : `<button class="fm-btn fm-btn-sm fm-btn-primary" data-f="approve" data-form="${x.form_code}" data-id="${x.id}">อนุมัติ</button>`);
    if (x.status === 'approved' && F.can('approve')) return `<button class="fm-btn fm-btn-sm fm-btn-primary" data-f="filed" data-id="${x.id}">บันทึกว่ายื่นแล้ว</button>`;
    if (x.status === 'submitted' && F.can('approve')) return `<button class="fm-btn fm-btn-sm fm-btn-primary" data-f="paid" data-id="${x.id}">บันทึกการชำระ</button>`;
    return '';
  }
})();
