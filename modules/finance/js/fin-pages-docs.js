/* Finance: รายรับ / รายจ่าย (เอกสาร) + รับ–จ่ายเงิน */
(function () {
  'use strict';
  const F = window.FIN, { esc, money, thDate, table, badge, L, api, run, $ } = F;
  const INCOME = ['tax_invoice', 'invoice', 'receipt', 'debit_note', 'credit_note'], EXPENSE = ['expense', 'bill', 'payment_voucher'];
  const r2 = n => Math.round((n + Number.EPSILON) * 100) / 100;

  // ---------- รายการเอกสาร ----------
  function listPage(kind) {
    return {
      title: kind === 'income' ? 'รายรับ / ลูกหนี้' : 'รายจ่าย / เจ้าหนี้',
      async render(el, arg) {
        if (arg === 'new') return docForm(el, kind, null);
        const st = (F.cache['docStatus:' + kind] || {}).v || '';
        el.innerHTML = F.head(kind === 'income' ? 'INCOME' : 'EXPENSES', this.title, kind === 'income' ? 'ใบกำกับภาษี ใบแจ้งหนี้ ใบเสร็จ ใบลด/เพิ่มหนี้' : 'ค่าใช้จ่าย บิลผู้ขาย ใบสำคัญจ่าย',
          F.can('write') ? `<button class="fm-btn fm-btn-primary" data-go="#${kind}/new">＋ ${kind === 'income' ? 'บันทึกรายรับ' : 'บันทึกรายจ่าย'}</button>` : '') +
          `<div class="fm-tabs" id="fmSt">${[['', 'ทั้งหมด'], ['draft', 'ร่าง'], ['pending_review', 'รออนุมัติ'], ['posted', 'ลงบัญชีแล้ว'], ['voided', 'ยกเลิก'], ['reversed', 'กลับรายการ']].map(([v, t]) => `<button data-st="${v}" class="${v === st ? 'on' : ''}">${t}</button>`).join('')}</div>
           <div class="fm-toolbar"><input type="search" id="fmQ" placeholder="ค้นหาเลขที่ / คู่ค้า / อ้างอิง" style="flex:1;min-width:200px"><button class="fm-btn fm-btn-light" id="fmCsv">↓ CSV</button></div><div id="fmList">${F.loading()}</div>`;
        let rows = [];
        const load = async () => {
          const s = el.querySelector('#fmSt .on').dataset.st, q = el.querySelector('#fmQ').value.trim();
          F.cache['docStatus:' + kind] = { at: Date.now(), v: s };
          const r = await api.get('documents', { kind, status: s, q, limit: 200 });
          rows = r.items;
          el.querySelector('#fmList').innerHTML = table([
            { h: 'วันที่', f: x => thDate(x.document_date) },
            { h: 'เลขที่', f: x => `<b>${esc(x.document_number || '–')}</b><span class="sub">${esc(L.docType[x.document_type])}</span>` },
            { h: 'คู่ค้า', f: x => esc(x.partner_name || '–') + (x.reference ? `<span class="sub">อ้างอิง ${esc(x.reference)}</span>` : '') },
            { h: 'ยอดรวม', num: 1, f: x => money(x.grand_total) },
            { h: kind === 'income' ? 'รับแล้ว' : 'จ่ายแล้ว', num: 1, f: x => x.status === 'posted' && x.document_type !== 'credit_note' ? money(x.paid_total) + (Number(x.paid_total) >= Number(x.grand_total) - 0.004 ? '<span class="sub">ครบ</span>' : `<span class="sub">ค้าง ${money(x.grand_total - x.paid_total)}</span>`) : '–' },
            { h: 'สถานะ', f: x => badge(x.status) },
          ], rows, { empty: 'ยังไม่มีเอกสาร', emptyHint: F.can('write') ? 'กด "บันทึก' + (kind === 'income' ? 'รายรับ' : 'รายจ่าย') + '" เพื่อเริ่ม' : '', rowAttr: x => `data-open="${x.id}"` }).replace('class="fm-table"', 'class="fm-table cards"');
        };
        el.querySelector('#fmSt').onclick = e => { const b = e.target.closest('button'); if (!b) return; el.querySelectorAll('#fmSt button').forEach(x => x.classList.toggle('on', x === b)); load(); };
        let t; el.querySelector('#fmQ').oninput = () => { clearTimeout(t); t = setTimeout(load, 350); };
        el.querySelector('#fmList').onclick = e => { const tr = e.target.closest('[data-open]'); if (tr) F.nav('#document/' + tr.dataset.open); };
        el.querySelector('#fmCsv').onclick = () => F.csv(kind + '-' + F.today() + '.csv', [['วันที่', 'เลขที่', 'ประเภท', 'คู่ค้า', 'อ้างอิง', 'ก่อนภาษี', 'VAT', 'หัก ณ ที่จ่าย', 'ยอดรวม', 'รับ/จ่ายแล้ว', 'สถานะ']].concat(rows.map(x => [F.d10(x.document_date), x.document_number, L.docType[x.document_type], x.partner_name || '', x.reference || '', x.subtotal, x.vat_total, x.wht_total, x.grand_total, x.paid_total, (L.status[x.status] || [x.status])[0]])));
        await load();
      },
    };
  }
  F.page('income', listPage('income'));
  F.page('expense', listPage('expense'));

  // ---------- ฟอร์มเอกสาร (สร้าง / แก้ร่าง) ----------
  async function docForm(el, kind, existing) {
    if (!F.can('write')) { el.innerHTML = F.errorBox('สิทธิ์ของคุณบันทึกรายการไม่ได้'); return; }
    const [accounts, partners] = await Promise.all([F.accounts(), F.partners()]);
    const vatReg = F.session.company.vatRegistered;
    const singleOwnerMode = F.session.actor.role === 'owner' && F.session.company.allowSelfApproval;
    const types = (kind === 'income' ? INCOME : EXPENSE).filter(t => t !== 'tax_invoice' || vatReg);
    const acTypes = kind === 'income' ? ['revenue'] : ['expense', 'asset'];
    const accOpts = '<option value="">บัญชีมาตรฐาน</option>' + accounts.filter(a => acTypes.includes(a.account_type)).map(a => `<option value="${esc(a.account_code)}">${esc(a.account_code + ' ' + a.account_name)}</option>`).join('');
    const pOpts = '<option value="">— ไม่ระบุ —</option>' + partners.filter(p => p.is_active).map(p => `<option value="${p.id}">${esc(p.display_name)}${p.tax_id ? ' · ' + esc(p.tax_id) : ''}</option>`).join('');
    const d = existing ? existing.document : null, lines = existing ? existing.lines : [{ description: '', quantity: 1, unit_price: '' }];
    const vatRate = d ? Number(existing.lines[0] && existing.lines[0].vat_rate || 0) : (vatReg ? 7 : 0);
    const whtRate = d ? Number(existing.lines[0] && existing.lines[0].wht_rate || 0) : 0;
    el.innerHTML = F.head(kind === 'income' ? 'INCOME' : 'EXPENSE', d ? 'แก้ไข ' + d.document_number : (kind === 'income' ? 'บันทึกรายรับ' : 'บันทึกรายจ่าย'), 'ราคาต่อหน่วยเป็นราคาก่อน VAT (ติ๊ก "ราคารวม VAT" ถ้าราคาในบิลรวม VAT แล้ว)') +
      `<form class="fm-panel" id="fmDoc" autocomplete="off">
        <div class="fm-form-grid three">
          <label class="fm-field"><span>ประเภทเอกสาร *</span><select name="document_type" ${d ? 'disabled' : ''}>${types.map(t => `<option value="${t}" ${d && d.document_type === t ? 'selected' : ''}>${esc(L.docType[t])}</option>`).join('')}</select></label>
          <label class="fm-field"><span>วันที่เอกสาร *</span><input type="date" name="document_date" required value="${esc(d ? F.d10(d.document_date) : F.today())}"></label>
          <label class="fm-field"><span>ครบกำหนดชำระ</span><input type="date" name="due_date" value="${esc(d ? F.d10(d.due_date) : '')}"></label>
          <label class="fm-field"><span>${kind === 'income' ? 'ลูกค้า' : 'ผู้ขาย'}</span><span style="display:flex;gap:6px"><select name="partner_id" style="flex:1">${pOpts}</select><button type="button" class="fm-btn fm-btn-sm" id="fmAddP" title="เพิ่มคู่ค้า">＋</button></span></label>
          <label class="fm-field"><span>เลขที่อ้างอิง (บิล/ใบเสร็จของคู่ค้า)</span><input name="reference" maxlength="120" value="${esc(d ? d.reference || '' : '')}"></label>
          <div class="fm-field"><span>ภาษี</span><span style="display:flex;gap:6px;flex-wrap:wrap">
            <select name="vat_rate" title="VAT"><option value="0" ${vatRate === 0 ? 'selected' : ''}>ไม่มี VAT</option><option value="7" ${vatRate === 7 ? 'selected' : ''} ${kind === 'income' && !vatReg ? 'disabled' : ''}>VAT 7%</option></select>
            <select name="wht_rate" title="หัก ณ ที่จ่าย">${[0, 1, 1.5, 2, 3, 5, 10].map(v => `<option value="${v}" ${v === whtRate ? 'selected' : ''}>${v ? 'หัก ณ ที่จ่าย ' + v + '%' : 'ไม่หัก ณ ที่จ่าย'}</option>`).join('')}</select></span></div>
        </div>
        <label class="fm-check" style="margin:10px 0 4px"><input type="checkbox" name="vat_inclusive"> ราคาที่กรอกเป็นราคารวม VAT แล้ว</label>
        ${kind === 'income' && !vatReg ? '<small class="fm-muted">บริษัทยังไม่ได้จด VAT — เก็บภาษีขายไม่ได้ (เปลี่ยนได้ที่ ข้อมูลบริษัท)</small>' : ''}
        <h3 style="font-size:14px;margin:16px 0 6px">รายการ</h3>
        <table class="fm-lines"><thead><tr><th style="width:38%">รายละเอียด *</th><th style="width:10%">จำนวน</th><th style="width:15%">ราคา/หน่วย</th><th style="width:25%">บัญชี</th><th class="fm-right" style="width:12%">จำนวนเงิน</th><th></th></tr></thead><tbody id="fmLines"></tbody></table>
        <button type="button" class="fm-btn fm-btn-sm fm-btn-ghost" id="fmAddLine">＋ เพิ่มบรรทัด</button>
        <div class="fm-totals" id="fmTot"></div>
        <label class="fm-field fm-field-full" style="margin-top:10px"><span>หมายเหตุ</span><textarea name="notes" rows="2" maxlength="2000">${esc(d ? d.notes || '' : '')}</textarea></label>
        ${F.session.actor.role === 'owner' && !F.session.company.allowSelfApproval ? '<div class="fm-notice warn"><span>!</span><div><b>โหมดผู้ใช้คนเดียวยังไม่เปิด</b><small>เปิด “อนุมัติรายการที่ตัวเองบันทึกได้” ในข้อมูลบริษัท เพื่อบันทึกและลงบัญชีได้ในขั้นตอนเดียว</small><button type="button" class="fm-btn fm-btn-sm" data-go="#company">เปิดข้อมูลบริษัท</button></div></div>' : ''}
        <div class="fm-form-actions"><button type="button" class="fm-btn fm-btn-light" data-go="${d ? '#document/' + d.id : '#' + kind}">ยกเลิก</button><button type="submit" class="fm-btn fm-btn-light" data-mode="draft">บันทึกร่าง</button><button type="submit" class="fm-btn fm-btn-primary" data-mode="submit">${singleOwnerMode ? 'บันทึกและลงบัญชี' : 'บันทึกและส่งอนุมัติ'}</button></div>
      </form>`;
    const form = el.querySelector('#fmDoc'), body = el.querySelector('#fmLines');
    if (d && d.partner_id) form.partner_id.value = d.partner_id;
    form.partner_id.addEventListener('change', () => {
      const p = partners.find(x => x.id === form.partner_id.value);
      if (p && p.default_wht_rate != null && !d) form.wht_rate.value = String(Number(p.default_wht_rate));
      calc();
    });
    const addLine = l => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td><input name="description" maxlength="300" placeholder="เช่น ค่าเมล็ดกาแฟ" value="${esc(l.description || '')}"></td><td><input name="quantity" type="number" step="any" min="0" value="${esc(l.quantity == null ? 1 : Number(l.quantity))}"></td><td><input name="unit_price" type="number" step="0.01" min="0" value="${esc(l.unit_price === '' ? '' : Number(l.unit_price))}"></td><td><select name="account_code">${accOpts}</select></td><td class="fm-right fm-mono" data-amt>0.00</td><td><button type="button" class="del" title="ลบบรรทัด">×</button></td>`;
      if (l.account_code) tr.querySelector('[name=account_code]').value = l.account_code;
      body.appendChild(tr);
    };
    lines.forEach(addLine);
    const calc = () => {
      const vr = Number(form.vat_rate.value), wr = Number(form.wht_rate.value), inc = form.vat_inclusive.checked;
      let sub = 0, vat = 0, wht = 0;
      body.querySelectorAll('tr').forEach(tr => {
        const g = r2((Number(tr.querySelector('[name=quantity]').value) || 0) * (Number(tr.querySelector('[name=unit_price]').value) || 0));
        const base = inc && vr ? r2(g * 100 / (100 + vr)) : g, v = inc && vr ? r2(g - base) : r2(base * vr / 100);
        sub += base; vat += v; wht += r2(base * wr / 100);
        tr.querySelector('[data-amt]').textContent = money(base);
      });
      sub = r2(sub); vat = r2(vat); wht = r2(wht);
      el.querySelector('#fmTot').innerHTML = `<div><span>มูลค่าก่อนภาษี</span><b>${money(sub)}</b></div>${vr ? `<div><span>VAT ${vr}%</span><b>${money(vat)}</b></div>` : ''}${wr ? `<div><span>หัก ณ ที่จ่าย ${wr}%</span><b>−${money(wht)}</b></div>` : ''}<div class="grand"><span>${kind === 'income' ? 'ยอดที่จะได้รับ' : 'ยอดที่ต้องจ่าย'}</span><span>${money(sub + vat - wht)}</span></div>`;
    };
    form.oninput = calc; form.onchange = calc; calc();
    el.querySelector('#fmAddLine').onclick = () => { addLine({ description: '', quantity: 1, unit_price: '' }); calc(); };
    body.onclick = e => { if (e.target.closest('.del') && body.children.length > 1) { e.target.closest('tr').remove(); calc(); } };
    el.querySelector('#fmAddP').onclick = () => partnerQuick(kind === 'income' ? 'customer' : 'vendor', async p => {
      const fresh = await F.partners(); partners.splice(0, partners.length, ...fresh);
      const match = partners.find(x => x.id === p.id);
      const o = document.createElement('option'); o.value = p.id; o.textContent = (match && match.display_name) || p.display_name;
      form.partner_id.appendChild(o); form.partner_id.value = p.id;
      if (match && match.default_wht_rate != null) form.wht_rate.value = String(Number(match.default_wht_rate));
      calc();
    });
    const key = F.idem();
    form.onsubmit = async e => {
      e.preventDefault();
      const btn = e.submitter || form.querySelector('[data-mode=submit]'), submit = btn.dataset.mode === 'submit';
      const payload = {
        document_type: form.document_type.value, document_date: form.document_date.value, due_date: form.due_date.value || null, partner_id: form.partner_id.value || null,
        reference: form.reference.value, notes: form.notes.value, vat_rate: Number(form.vat_rate.value), wht_rate: Number(form.wht_rate.value), vat_inclusive: form.vat_inclusive.checked,
        lines: [...body.querySelectorAll('tr')].map(tr => ({ description: tr.querySelector('[name=description]').value, quantity: Number(tr.querySelector('[name=quantity]').value), unit_price: Number(tr.querySelector('[name=unit_price]').value), account_code: tr.querySelector('[name=account_code]').value || null })).filter(l => l.description || l.unit_price),
      };
      const soloOwner = F.session.actor.role === 'owner' && F.session.company.allowSelfApproval;
      const r = await run(btn, async () => {
        let saved;
        if (d) {
          await api.post('document.update', { ...payload, document_id: d.id });
          if (submit) {
            await api.post('document.submit', { document_id: d.id });
            if (soloOwner) await api.post('document.approve', { document_id: d.id, note: 'Owner one-person workflow' });
          }
          saved = { id: d.id };
        } else {
          saved = await api.post('document.create', { ...payload, submit }, { idem: key });
          if (submit && soloOwner) await api.post('document.approve', { document_id: saved.id, note: 'Owner one-person workflow' });
        }
        return saved;
      }, submit ? (soloOwner ? 'บันทึกและลงบัญชีแล้ว' : 'บันทึกและส่งอนุมัติแล้ว') : 'บันทึกร่างแล้ว');
      if (r) { F.refreshBadges(); F.nav('#document/' + r.id); }
    };
  }

  function partnerQuick(type, done) {
    const m = F.modal('เพิ่มคู่ค้า', `<form id="fmPQ" class="fm-form-grid">
      <label class="fm-field fm-field-full"><span>ชื่อที่แสดง *</span><input name="display_name" required maxlength="200"></label>
      <label class="fm-field fm-field-full"><span>ชื่อจดทะเบียน</span><input name="legal_name" maxlength="200" placeholder="ชื่อบริษัท/ชื่อนิติบุคคล"></label>
      <label class="fm-field"><span>ประเภท</span><select name="partner_type">${Object.entries(L.partnerType).map(([k, v]) => `<option value="${k}" ${k === type ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
      <label class="fm-field"><span>เลขผู้เสียภาษี (13 หลัก)</span><input name="tax_id" inputmode="numeric" maxlength="13" pattern="\\d{13}"></label>
      <label class="fm-field"><span>เลขสาขา (ถ้ามี)</span><input name="branch_number" maxlength="5" placeholder="00000"></label>
      <label class="fm-field fm-field-full"><span>ที่อยู่</span><textarea name="address" rows="2" maxlength="500"></textarea></label>
      <label class="fm-field"><span>แบบหัก ณ ที่จ่าย</span><select name="default_wht_type"><option value="pnd53">ภ.ง.ด.53 — นิติบุคคล</option><option value="pnd3">ภ.ง.ด.3 — บุคคลธรรมดา</option></select></label>
      <label class="fm-field"><span>อัตราหัก ณ ที่จ่ายเริ่มต้น</span><select name="default_wht_rate"><option value="" selected>ไม่กำหนด</option>${[1,1.5,2,3,5,10].map(v => `<option value="${v}" >${v}%</option>`).join('')}</select></label>
      <div class="fm-form-actions fm-field-full"><button type="button" class="fm-btn fm-btn-light" data-close>ยกเลิก</button><button class="fm-btn fm-btn-primary">บันทึกคู่ค้า</button></div></form>`);
    const f = m.el.querySelector('#fmPQ');
    f.onsubmit = async e => { e.preventDefault(); const r = await run(f.querySelector('.fm-btn-primary'), () => api.post('partner.save', Object.fromEntries(new FormData(f))), 'เพิ่มคู่ค้าแล้ว'); if (r) { F.bust('partners'); m.close(); done(r); } };
  }
  F.partnerQuick = partnerQuick;

  // ---------- รายละเอียดเอกสาร ----------
  F.page('document', {
    title: 'เอกสาร',
    async render(el, id) {
      const [kindArg, docId] = id.includes(':') ? id.split(':') : ['', id];
      const r = await api.get('document', { id: docId });
      const d = r.document, kind = INCOME.includes(d.document_type) ? 'income' : 'expense';
      if (kindArg === 'edit') return docForm(el, kind, r);
      F.crumb(kind, d.document_number || 'เอกสาร');
      const me = F.session.actor.ref, mineBlocked = d.created_by === me && !(F.session.company.allowSelfApproval && F.session.actor.role === 'owner');
      const paid = r.payments.filter(p => p.status === 'paid').reduce((a, p) => a + Number(p.amount), 0);
      const committed = r.payments.filter(p => ['pending', 'approved', 'paid'].includes(p.status)).reduce((a, p) => a + Number(p.amount), 0);
      const left = r2(Number(d.grand_total) - committed);
      const acts = [];
      if (d.status === 'draft' && F.can('write')) acts.push(`<button class="fm-btn fm-btn-light" data-go="#document/edit:${d.id}">แก้ไข</button>`, '<button class="fm-btn fm-btn-light" data-a="void">ยกเลิกเอกสาร</button>', '<button class="fm-btn fm-btn-primary" data-a="submit">ส่งอนุมัติ</button>');
      if (d.status === 'pending_review') {
        if (F.can('write')) acts.push('<button class="fm-btn fm-btn-light" data-a="void">ยกเลิกเอกสาร</button>');
        if (F.can('approve')) acts.push('<button class="fm-btn fm-btn-light" data-a="return">ตีกลับ</button>', mineBlocked ? '<span class="fm-badge warn" title="Maker–Checker">เอกสารของคุณ — ให้ผู้อื่นอนุมัติ</span>' : '<button class="fm-btn fm-btn-primary" data-a="approve">อนุมัติ + ลงบัญชี</button>');
      }
      if (d.status === 'posted') {
        if (F.can('write') && d.document_type !== 'credit_note' && left > 0.004) acts.push(`<button class="fm-btn fm-btn-primary" data-a="pay">${kind === 'income' ? 'รับเงิน' : 'จ่ายเงิน'}</button>`);
        if (F.can('approve')) acts.push('<button class="fm-btn fm-btn-light" data-a="reverse">กลับรายการ</button>');
      }
      if (Number(d.wht_total) > 0 && r.payments.some(p => p.status === 'paid')) acts.push('<button class="fm-btn fm-btn-light" data-a="wht-print">พิมพ์หนังสือรับรองหัก ณ ที่จ่าย (50 ทวิ)</button>');
      acts.push('<button class="fm-btn fm-btn-light" onclick="window.print()">พิมพ์</button>');
      el.innerHTML = F.head(L.docType[d.document_type] || 'เอกสาร', d.document_number || 'เอกสาร', badge(d.status) + (d.void_reason ? ' · ' + esc(d.void_reason) : ''), acts.join('')) +
        `<div class="fm-grid2"><section class="fm-panel"><dl class="fm-dl">
          <dt>วันที่</dt><dd>${thDate(d.document_date)}${d.due_date ? ' · ครบกำหนด ' + thDate(d.due_date) : ''}</dd>
          <dt>${kind === 'income' ? 'ลูกค้า' : 'ผู้ขาย'}</dt><dd>${esc(d.partner_name || '–')}${d.partner_tax_id ? ' · ' + esc(d.partner_tax_id) : ''}</dd>
          <dt>อ้างอิง</dt><dd>${esc(d.reference || '–')}</dd><dt>หมายเหตุ</dt><dd>${esc(d.notes || '–')}</dd>
          <dt>ผู้บันทึก / อนุมัติ</dt><dd>${esc(d.created_by_name || d.created_by || '–')} / ${esc(d.approved_by_name || d.approved_by || '–')}</dd></dl></section>
        <section class="fm-panel"><div class="fm-totals" style="max-width:none;margin:0">
          <div><span>มูลค่าก่อนภาษี</span><b>${money(d.subtotal)}</b></div><div><span>VAT</span><b>${money(d.vat_total)}</b></div>${Number(d.wht_total) ? `<div><span>หัก ณ ที่จ่าย</span><b>−${money(d.wht_total)}</b></div>` : ''}
          <div class="grand"><span>ยอดรวม</span><span>${money(d.grand_total)}</span></div>
          ${d.status === 'posted' && d.document_type !== 'credit_note' ? `<div><span>${kind === 'income' ? 'รับแล้ว' : 'จ่ายแล้ว'}</span><b>${money(paid)}</b></div><div><span>คงค้าง (หักรายการรออนุมัติ)</span><b>${money(left)}</b></div>` : ''}
        </div></section></div>
        <section class="fm-panel"><div class="fm-panel-head"><h2>รายการ</h2></div>${table([{ h: '#', k: 'line_no' }, { h: 'รายละเอียด', k: 'description' }, { h: 'บัญชี', f: x => esc(x.account_code || 'มาตรฐาน') }, { h: 'จำนวน', num: 1, f: x => Number(x.quantity) }, { h: 'ราคา/หน่วย', num: 1, f: x => money(x.unit_price) }, { h: 'VAT', num: 1, f: x => money(x.vat_amount) }, { h: 'จำนวนเงิน', num: 1, f: x => money(x.line_total) }], r.lines, { compact: true })}</section>
        <div class="fm-grid2"><section class="fm-panel"><div class="fm-panel-head"><h2>รับ/จ่ายเงิน</h2></div>${table([{ h: 'วันที่', f: x => thDate(x.payment_date) }, { h: 'ช่องทาง', f: x => esc(L.method[x.method]) }, { h: 'จำนวน', num: 1, f: x => money(x.amount) }, { h: 'สถานะ', f: x => badge(x.status) }], r.payments, { empty: 'ยังไม่มี', compact: true })}</section>
        <section class="fm-panel"><div class="fm-panel-head"><h2>บันทึกบัญชีและประวัติ</h2></div>
          ${r.journals.map(j => `<div><a class="fm-link" href="#journal/${j.id}">${esc(j.journal_number)}</a> ${badge(j.status)} <small class="fm-muted">${thDate(j.journal_date)}</small></div>`).join('') || '<small class="fm-muted">ยังไม่ลงบัญชี</small>'}
          <ul style="margin:10px 0 0;padding-left:18px;font-size:12.5px;color:var(--muted)">${r.events.map(ev => `<li>${F.thDateTime(ev.created_at)} · ${esc({ submitted: 'ส่งอนุมัติ', approved: 'อนุมัติ', returned: 'ตีกลับ', cancelled: 'ยกเลิก', reversed: 'กลับรายการ', posted: 'ลงบัญชี', rejected: 'ปฏิเสธ' }[ev.action] || ev.action)} โดย ${esc(ev.actor_name || ev.actor_ref)}${ev.note ? ' — ' + esc(ev.note) : ''}</li>`).join('')}</ul></section></div>`;
      el.querySelector('.fm-head-actions').onclick = async e => {
        const b = e.target.closest('[data-a]'); if (!b) return;
        const a = b.dataset.a;
        let ok;
        if (a === 'wht-print') { await printWhtCertificates(d, r); return; }
        if (a === 'submit') ok = await run(b, () => api.post('document.submit', { document_id: d.id }), 'ส่งอนุมัติแล้ว');
        if (a === 'approve') ok = await run(b, () => api.post('document.approve', { document_id: d.id }), x => 'อนุมัติแล้ว · ลงบัญชี ' + x.journal_number);
        if (a === 'return') { const n = await F.ask('ตีกลับเอกสาร', 'เอกสารจะกลับเป็นฉบับร่าง', { input: true, required: true }); if (n) ok = await run(b, () => api.post('document.return', { document_id: d.id, note: n }), 'ตีกลับแล้ว'); }
        if (a === 'void') { const n = await F.ask('ยกเลิกเอกสาร', 'เอกสารที่ยกเลิกแล้วจะใช้ต่อไม่ได้ (เลขที่เอกสารไม่ถูกนำกลับมาใช้)', { input: true, required: true, danger: true, ok: 'ยกเลิกเอกสาร' }); if (n) ok = await run(b, () => api.post('document.void', { document_id: d.id, reason: n }), 'ยกเลิกแล้ว'); }
        if (a === 'reverse') { const n = await F.ask('กลับรายการเอกสาร', 'ระบบจะลงบัญชีกลับด้าน (ใช้เมื่อบันทึกผิด) — ถ้าเป็นการคืนสินค้า/ลดราคา ให้ออกใบลดหนี้แทน', { input: true, required: true, danger: true, ok: 'กลับรายการ' }); if (n) ok = await run(b, () => api.post('document.reverse', { document_id: d.id, reason: n }), x => 'กลับรายการแล้ว · ' + x.reversal_journal); }
        if (a === 'pay') { payForm(kind === 'income' ? 'receipt' : 'disbursement', { id: d.id, label: d.document_number + (d.partner_name ? ' · ' + d.partner_name : ''), left }); return; }
        if (ok) { F.refreshBadges(); F.reload(); }
      };
    },
  });

  // หนังสือรับรองการหักภาษี ณ ที่จ่าย: สร้างจากยอดที่จ่ายจริง และข้อมูลบริษัท/คู่ค้า
  async function printWhtCertificates(d, detail) {
    const win = window.open('', '_blank');
    if (!win) { F.toast('เบราว์เซอร์บล็อกหน้าต่างพิมพ์ กรุณาอนุญาต Pop-up', 'bad'); return; }
    win.document.write('<p style="font-family:sans-serif;padding:24px">กำลังจัดเตรียมเอกสาร…</p>');
    try {
      const [coRes, partners] = await Promise.all([api.get('company'), F.partners()]);
      const co = coRes.company || {};
      const partner = partners.find(p => p.id === d.partner_id) || {};
      const paid = detail.payments.filter(p => p.status === 'paid' && p.payment_type === 'disbursement');
      if (!paid.length) throw new Error('ยังไม่มีรายการจ่ายเงินจริง');
      if (!co.tax_id || !partner.tax_id) throw new Error('กรุณากรอกเลขผู้เสียภาษีของบริษัทและคู่ค้าให้ครบก่อนออกหนังสือรับรอง');
      const addr = x => (x && typeof x === 'object' ? x.text : x) || '—';
      const branch = x => x.branch_type === 'branch' ? ('สาขา ' + (x.branch_number || '')) : 'สำนักงานใหญ่';
      const escv = F.esc;
      const base = Number(d.subtotal), total = Number(d.grand_total) || 0, wht = Number(d.wht_total);
      const rate = Number(detail.lines[0] && detail.lines[0].wht_rate || (base ? wht / base * 100 : 0));
      const income = detail.lines.map(x => x.description).filter(Boolean).join(', ') || 'ค่าบริการ';
      const pages = paid.map((p, i) => {
        const ratio = total > 0 ? Math.min(1, Number(p.amount) / total) : 0;
        const taxBase = Math.round(base * ratio * 100) / 100, tax = Math.round(wht * ratio * 100) / 100;
        const ref = 'WHT-' + d.document_number + '-' + (i + 1);
        const dateText = F.thDate(p.payment_date);
        const copy = label => `<article class="cert"><div class="top"><b>หนังสือรับรองการหักภาษี ณ ที่จ่าย</b><strong>50 ทวิ</strong></div><div class="copy">${label}</div>
          <div class="meta">เลขที่เอกสาร: ${escv(ref)}　วันที่จ่าย: ${dateText}</div>
          <h3>ผู้มีหน้าที่หักภาษี ณ ที่จ่าย (ผู้จ่ายเงิน)</h3>
          <div class="row"><span>ชื่อ: ${escv(co.legal_name || '')}</span><span>เลขประจำตัวผู้เสียภาษี: ${escv(co.tax_id)}</span></div>
          <div>ที่อยู่: ${escv(addr(co.address))}</div><div>สำนักงาน: ${escv(branch(co))}</div>
          <h3>ผู้ถูกหักภาษี ณ ที่จ่าย (ผู้รับเงิน)</h3>
          <div class="row"><span>ชื่อ: ${escv(partner.legal_name || partner.display_name || '')}</span><span>เลขประจำตัวผู้เสียภาษี: ${escv(partner.tax_id)}</span></div>
          <div>ที่อยู่: ${escv(addr(partner.address))}</div><div>สำนักงาน: ${escv(partner.branch_number ? 'สาขา ' + partner.branch_number : 'สำนักงานใหญ่')}</div>
          <h3>รายละเอียดการจ่ายเงิน</h3>
          <table><thead><tr><th>ประเภทเงินได้ / รายละเอียด</th><th>วันจ่าย</th><th>จำนวนเงินที่จ่าย</th><th>อัตรา</th><th>ภาษีที่หัก</th></tr></thead>
          <tbody><tr><td>${escv(income)}</td><td>${dateText}</td><td class="num">${F.money(taxBase)}</td><td class="num">${rate}%</td><td class="num">${F.money(tax)}</td></tr></tbody></table>
          <div class="sum"><span>รวมเงินได้ที่จ่าย</span><b>${F.money(taxBase)} บาท</b><span>ภาษีที่หักและนำส่ง</span><b>${F.money(tax)} บาท</b></div>
          <p class="note">อ้างอิงเอกสารรายจ่าย ${escv(d.document_number)} · รายการนี้จัดทำจากข้อมูล CMS โปรดตรวจสอบประเภทเงินได้และข้อมูลตามหลักฐานก่อนลงนาม/ส่งมอบ</p>
          <div class="sign"><div>ลงชื่อ................................................ผู้จ่ายเงิน<br>วันที่................................................</div><div>ลงชื่อ................................................ผู้รับเงิน<br>วันที่................................................</div></div></article>`;
        return copy('ฉบับที่ ' + (i + 1) + ' — ' + (i === 0 ? 'ผู้ถูกหักภาษี' : 'ผู้มีหน้าที่หักภาษี')) + copy('สำเนา — เก็บไว้เป็นหลักฐาน');
      }).join('');
      win.document.open();
      win.document.write(`<!doctype html><html lang="th"><head><meta charset="utf-8"><title>หนังสือรับรองหัก ณ ที่จ่าย ${escv(d.document_number)}</title><style>
        @page{size:A4;margin:14mm}*{box-sizing:border-box}body{font-family:Arial,"Tahoma",sans-serif;color:#111;font-size:12px}
        .cert{page-break-after:always;min-height:260mm;position:relative;padding:2mm}.top{display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #111;padding-bottom:10px;font-size:20px}
        .top strong{font-size:28px}.copy{text-align:right;font-weight:bold;margin:8px 0}.meta{margin:12px 0;color:#333}
        h3{font-size:13px;background:#eee;padding:7px;margin:14px 0 8px}.row{display:flex;justify-content:space-between;gap:18px;margin:7px 0}
        table{width:100%;border-collapse:collapse;margin-top:10px}th,td{border:1px solid #555;padding:9px;text-align:left}th{background:#eee}.num{text-align:right;white-space:nowrap}
        .sum{display:grid;grid-template-columns:1fr auto;gap:8px;margin:18px 0;font-size:14px}.note{margin-top:18px;line-height:1.6}
        .sign{display:grid;grid-template-columns:1fr 1fr;gap:25px;margin-top:55px;line-height:2.2;text-align:center}
        @media print{.cert:last-child{page-break-after:auto}}
      </style></head><body>${pages}<script>window.onload=()=>setTimeout(()=>window.print(),300)<\/script></body></html>`);
      win.document.close();
    } catch (e) {
      win.document.body.innerHTML = '<p style="font:16px sans-serif;padding:24px;color:#b00">' + escvError(e.message) + '</p>';
    }
    function escvError(v) { return String(v || 'เกิดข้อผิดพลาด').replace(/[&<>"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch])); }
  }

  // ---------- รับ / จ่ายเงิน ----------
  async function payForm(type, doc) {
    const accounts = await F.accounts();
    const cashAcc = accounts.filter(a => a.account_type === 'asset' && ['cash', 'bank'].includes(a.system_key) || /^10/.test(a.account_code));
    let docs = [];
    if (!doc) docs = (await api.get('open-documents', { kind: type === 'receipt' ? 'income' : 'expense' })).items;
    const m = F.modal(type === 'receipt' ? 'รับเงิน' : 'จ่ายเงิน', `<form id="fmPay" class="fm-form-grid">
      ${doc ? `<div class="fm-field fm-field-full"><span>เอกสาร</span><b>${esc(doc.label)}</b><small class="fm-muted">คงค้าง ${money(doc.left)}</small></div>` :
        `<label class="fm-field fm-field-full"><span>เอกสาร</span><select name="document_id"><option value="">— ไม่มีเอกสาร (ระบุบัญชีคู่) —</option>${docs.map(x => `<option value="${x.id}" data-left="${x.outstanding}">${esc(x.document_number)} · ${esc(x.partner_name || '')} · ค้าง ${money(x.outstanding)}</option>`).join('')}</select></label>
         <label class="fm-field fm-field-full" id="fmOff" ><span>บัญชีคู่ (กรณีไม่มีเอกสาร) เช่น ทุน, เงินกู้, ค่าใช้จ่าย</span><select name="offset_account_id"><option value="">— เลือก —</option>${accounts.filter(a => !['cash', 'bank'].includes(a.system_key)).map(a => `<option value="${a.id}">${esc(a.account_code + ' ' + a.account_name)}</option>`).join('')}</select></label>`}
      <label class="fm-field"><span>วันที่ *</span><input type="date" name="payment_date" required value="${F.today()}"></label>
      <label class="fm-field"><span>จำนวนเงิน *</span><input type="number" name="amount" step="0.01" min="0.01" required value="${doc ? doc.left : ''}"></label>
      <label class="fm-field"><span>ช่องทาง</span><select name="method">${Object.entries(L.method).map(([k, v]) => `<option value="${k}" ${k === 'bank_transfer' ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
      <label class="fm-field"><span>บัญชีเงินสด/ธนาคาร</span><select name="cash_account_id"><option value="">อัตโนมัติตามช่องทาง</option>${cashAcc.map(a => `<option value="${a.id}">${esc(a.account_code + ' ' + a.account_name)}</option>`).join('')}</select></label>
      <label class="fm-field"><span>เลขอ้างอิง (สลิป/เช็ค)</span><input name="reference_number" maxlength="120"></label>
      <label class="fm-field"><span>หมายเหตุ</span><input name="note" maxlength="500"></label>
      <p class="fm-field-full fm-muted" style="margin:0;font-size:12px">ขั้นตอน: บันทึก → ผู้อนุมัติอนุมัติ → บันทึกว่า${type === 'receipt' ? 'รับ' : 'จ่าย'}เงินจริง (ระบบลงบัญชีให้)</p>
      <div class="fm-form-actions fm-field-full"><button type="button" class="fm-btn fm-btn-light" data-close>ยกเลิก</button><button class="fm-btn fm-btn-primary">บันทึก (ส่งอนุมัติ)</button></div></form>`);
    const f = m.el.querySelector('#fmPay'), key = F.idem();
    if (!doc) f.document_id.onchange = () => { const o = f.document_id.selectedOptions[0]; if (o && o.dataset.left) f.amount.value = Number(o.dataset.left).toFixed(2); m.el.querySelector('#fmOff').hidden = !!f.document_id.value; };
    f.onsubmit = async e => {
      e.preventDefault();
      const v = Object.fromEntries(new FormData(f));
      const body = { payment_type: type, payment_date: v.payment_date, amount: Number(v.amount), method: v.method, cash_account_id: v.cash_account_id || null, reference_number: v.reference_number, note: v.note, document_id: doc ? doc.id : (v.document_id || null), offset_account_id: doc ? null : (v.document_id ? null : v.offset_account_id || null) };
      const soloOwner = F.session.actor.role === 'owner' && F.session.company.allowSelfApproval;
      const r = await run(f.querySelector('.fm-btn-primary'), async () => {
        const created = await api.post('payment.create', body, { idem: key });
        if (soloOwner) {
          await api.post('payment.approve', { payment_id: created.id, note: 'Owner one-person workflow' });
          return api.post('payment.mark-paid', { payment_id: created.id, note: 'บันทึกการชำระโดย Owner' });
        }
        return created;
      }, soloOwner ? 'บันทึกและลงบัญชีการชำระแล้ว' : 'บันทึกแล้ว · รออนุมัติ');
      if (r) { m.close(); F.refreshBadges(); F.reload(); }
    };
  }
  F.payForm = payForm;

  F.page('payments', {
    title: 'รับ–จ่ายเงิน',
    async render(el) {
      el.innerHTML = F.head('PAYMENTS', 'รับ–จ่ายเงิน', 'ทุกรายการต้องผ่านการอนุมัติก่อนบันทึกว่ารับ/จ่ายจริง',
        F.can('write') ? '<button class="fm-btn fm-btn-light" data-new="receipt">＋ รับเงิน</button><button class="fm-btn fm-btn-primary" data-new="disbursement">＋ จ่ายเงิน</button>' : '') +
        `<div class="fm-tabs" id="fmPSt">${[['', 'ทั้งหมด'], ['pending', 'รออนุมัติ'], ['approved', 'รอรับ/จ่ายจริง'], ['paid', 'รับ/จ่ายแล้ว'], ['rejected', 'ปฏิเสธ'], ['cancelled', 'ยกเลิก']].map(([v, t], i) => `<button data-st="${v}" class="${i ? '' : 'on'}">${t}</button>`).join('')}</div><div id="fmPList">${F.loading()}</div>`;
      el.querySelector('.fm-page-head').onclick = e => { const b = e.target.closest('[data-new]'); if (b) payForm(b.dataset.new, null); };
      const load = async () => {
        const s = el.querySelector('#fmPSt .on').dataset.st;
        const r = await api.get('payments', { status: s, limit: 200 });
        const me = F.session.actor.ref, self = F.session.company.allowSelfApproval && F.session.actor.role === 'owner';
        el.querySelector('#fmPList').innerHTML = table([
          { h: 'วันที่', f: x => thDate(x.payment_date) }, { h: 'ประเภท', f: x => `<b>${esc(L.payType[x.payment_type])}</b><span class="sub">${esc(L.method[x.method])}${x.reference_number ? ' · ' + esc(x.reference_number) : ''}</span>` },
          { h: 'เอกสาร / บัญชีคู่', f: x => x.document_id ? `<a class="fm-link" href="#document/${x.document_id}">${esc(x.document_number)}</a><span class="sub">${esc(x.partner_name || '')}</span>` : esc((x.offset_account_code || '') + ' ' + (x.offset_account_name || '')) },
          { h: 'จำนวน', num: 1, f: x => money(x.amount) }, { h: 'สถานะ', f: x => badge(x.status) },
          { h: '', cls: 'acts', f: x => {
            const o = [];
            if (x.status === 'pending' && F.can('approve')) o.push(x.created_by === me && !self ? '<small class="fm-muted">รายการของคุณ</small>' : `<button class="fm-btn fm-btn-sm fm-btn-primary" data-a="approve" data-id="${x.id}">อนุมัติ</button> <button class="fm-btn fm-btn-sm" data-a="reject" data-id="${x.id}">ปฏิเสธ</button>`);
            if (x.status === 'approved' && F.can('approve')) o.push(`<button class="fm-btn fm-btn-sm fm-btn-primary" data-a="paid" data-id="${x.id}">บันทึกว่า${x.payment_type === 'receipt' ? 'รับ' : 'จ่าย'}แล้ว</button>`);
            if (['pending', 'approved'].includes(x.status) && F.can('write') && (x.created_by === me || F.can('approve'))) o.push(`<button class="fm-btn fm-btn-sm" data-a="cancel" data-id="${x.id}">ยกเลิก</button>`);
            return o.join(' ');
          } },
        ], r.items, { empty: 'ยังไม่มีรายการ' }).replace('class="fm-table"', 'class="fm-table cards"');
      };
      el.querySelector('#fmPSt').onclick = e => { const b = e.target.closest('button'); if (!b) return; el.querySelectorAll('#fmPSt button').forEach(x => x.classList.toggle('on', x === b)); load(); };
      el.querySelector('#fmPList').onclick = async e => {
        const b = e.target.closest('[data-a]'); if (!b) return;
        const id = b.dataset.id; let ok;
        if (b.dataset.a === 'approve') ok = await run(b, () => api.post('payment.approve', { payment_id: id }), 'อนุมัติแล้ว');
        if (b.dataset.a === 'paid') { if (await F.ask('ยืนยันรับ/จ่ายเงินจริง', 'ระบบจะลงบัญชีเงินสด/ธนาคารทันที', {})) ok = await run(b, () => api.post('payment.mark-paid', { payment_id: id }), x => 'บันทึกแล้ว · ลงบัญชี ' + x.journal_number); }
        if (b.dataset.a === 'reject') { const n = await F.ask('ปฏิเสธรายการ', '', { input: true, required: true, danger: true, ok: 'ปฏิเสธ' }); if (n) ok = await run(b, () => api.post('payment.reject', { payment_id: id, note: n }), 'ปฏิเสธแล้ว'); }
        if (b.dataset.a === 'cancel') { const n = await F.ask('ยกเลิกรายการ', '', { input: true, required: true, danger: true, ok: 'ยกเลิกรายการ' }); if (n) ok = await run(b, () => api.post('payment.cancel', { payment_id: id, note: n }), 'ยกเลิกแล้ว'); }
        if (ok) { F.refreshBadges(); load(); }
      };
      await load();
    },
  });
})();
