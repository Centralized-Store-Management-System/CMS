/* Finance: สมุดรายวัน, ผังบัญชี, รอบบัญชี */
(function () {
  'use strict';
  const F = window.FIN, { esc, money, thDate, table, badge, L, api, run } = F;
  const r2 = n => Math.round((n + Number.EPSILON) * 100) / 100;

  F.page('journals', {
    title: 'สมุดรายวัน',
    async render(el) {
      el.innerHTML = F.head('GENERAL JOURNAL', 'สมุดรายวัน', 'รายการจากเอกสาร/รับจ่ายเงินลงให้อัตโนมัติ · บันทึกเองใช้สำหรับรายการปรับปรุง ยอดยกมา โอนเงินระหว่างบัญชี',
        F.can('write') ? '<button class="fm-btn fm-btn-primary" id="fmNewJ">＋ บันทึกสมุดรายวัน</button>' : '') +
        `<div class="fm-toolbar"><select id="fmJSt"><option value="">ทุกสถานะ</option><option value="pending_review">รออนุมัติ</option><option value="draft">ร่าง (ถูกตีกลับ)</option><option value="posted">ลงบัญชีแล้ว</option><option value="reversed">กลับรายการ</option></select>
         <select id="fmJSrc"><option value="">ทุกที่มา</option>${Object.entries(L.source).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select>
         <input type="date" id="fmJFrom" value="${F.thisMonth()}-01"> – <input type="date" id="fmJTo" value="${F.today()}"></div><div id="fmJList">${F.loading()}</div>`;
      const load = async () => {
        const r = await api.get('journals', { status: el.querySelector('#fmJSt').value, source: el.querySelector('#fmJSrc').value, from: el.querySelector('#fmJFrom').value, to: el.querySelector('#fmJTo').value, limit: 200 });
        el.querySelector('#fmJList').innerHTML = table([{ h: 'วันที่', f: x => thDate(x.journal_date) }, { h: 'เลขที่', f: x => `<b>${esc(x.journal_number)}</b><span class="sub">${esc(L.source[x.source_type] || x.source_type)}</span>` }, { h: 'รายการ', f: x => esc(x.description) + (x.review_note ? `<span class="sub">ตีกลับ: ${esc(x.review_note)}</span>` : '') }, { h: 'จำนวนเงิน', num: 1, f: x => money(x.total_debit) }, { h: 'สถานะ', f: x => badge(x.status) }],
          r.items, { empty: 'ไม่มีรายการในช่วงนี้', rowAttr: x => `data-open="${x.id}"` }).replace('class="fm-table"', 'class="fm-table cards"');
      };
      el.querySelector('.fm-toolbar').onchange = load;
      el.querySelector('#fmJList').onclick = e => { const tr = e.target.closest('[data-open]'); if (tr) F.nav('#journal/' + tr.dataset.open); };
      const nb = el.querySelector('#fmNewJ'); if (nb) nb.onclick = () => journalForm();
      await load();
    },
  });

  async function journalForm() {
    const [accounts, partners] = await Promise.all([F.accounts(), F.partners()]);
    const aOpts = '<option value="">— เลือกบัญชี —</option>' + accounts.map(a => `<option value="${a.id}">${esc(a.account_code + ' ' + a.account_name)}</option>`).join('');
    const pOpts = '<option value="">—</option>' + partners.map(p => `<option value="${p.id}">${esc(p.display_name)}</option>`).join('');
    const m = F.modal('บันทึกสมุดรายวัน', `<form id="fmJ"><div class="fm-form-grid"><label class="fm-field"><span>วันที่ *</span><input type="date" name="journal_date" required value="${F.today()}"></label>
      <label class="fm-field"><span>คำอธิบาย *</span><input name="description" required maxlength="500" placeholder="เช่น ยอดยกมาต้นงวด / โอนเงินเข้าลิ้นชัก"></label></div>
      <label class="fm-check" style="margin:8px 0"><input type="checkbox" name="opening"> เป็นรายการยอดยกมา (Opening balance)</label>
      <table class="fm-lines"><thead><tr><th style="width:36%">บัญชี</th><th>คำอธิบายบรรทัด</th><th style="width:15%">เดบิต</th><th style="width:15%">เครดิต</th><th>คู่ค้า</th><th></th></tr></thead><tbody id="fmJL"></tbody></table>
      <button type="button" class="fm-btn fm-btn-sm fm-btn-ghost" id="fmJAdd">＋ เพิ่มบรรทัด</button><div class="fm-totals" id="fmJT"></div>
      <div class="fm-form-actions"><button type="button" class="fm-btn fm-btn-light" data-close>ยกเลิก</button><button class="fm-btn fm-btn-primary">บันทึก (ส่งอนุมัติ)</button></div></form>`, { wide: true });
    const f = m.el.querySelector('#fmJ'), body = m.el.querySelector('#fmJL');
    const add = () => { const tr = document.createElement('tr'); tr.innerHTML = `<td><select name="account_id">${aOpts}</select></td><td><input name="d" maxlength="300"></td><td><input type="number" step="0.01" min="0" name="debit"></td><td><input type="number" step="0.01" min="0" name="credit"></td><td><select name="partner_id">${pOpts}</select></td><td><button type="button" class="del">×</button></td>`; body.appendChild(tr); };
    add(); add();
    const calc = () => { let d = 0, c = 0; body.querySelectorAll('tr').forEach(tr => { d += Number(tr.querySelector('[name=debit]').value) || 0; c += Number(tr.querySelector('[name=credit]').value) || 0; }); d = r2(d); c = r2(c); m.el.querySelector('#fmJT').innerHTML = `<div><span>เดบิตรวม</span><b>${money(d)}</b></div><div><span>เครดิตรวม</span><b>${money(c)}</b></div><div class="grand"><span>ผลต่าง</span><span style="color:${Math.abs(d - c) < 0.005 && d > 0 ? '#17764a' : '#b3261e'}">${money(d - c)}${Math.abs(d - c) < 0.005 && d > 0 ? ' ✓ สมดุล' : ''}</span></div>`; };
    f.oninput = calc; calc();
    m.el.querySelector('#fmJAdd').onclick = add;
    body.onclick = e => { if (e.target.closest('.del') && body.children.length > 2) { e.target.closest('tr').remove(); calc(); } };
    f.onsubmit = async e => {
      e.preventDefault();
      const lines = [...body.querySelectorAll('tr')].map(tr => ({ account_id: tr.querySelector('[name=account_id]').value, description: tr.querySelector('[name=d]').value, debit: Number(tr.querySelector('[name=debit]').value) || 0, credit: Number(tr.querySelector('[name=credit]').value) || 0, partner_id: tr.querySelector('[name=partner_id]').value || null })).filter(l => l.account_id || l.debit || l.credit);
      const r = await run(f.querySelector('.fm-btn-primary'), () => api.post('journal.create', { journal_date: f.journal_date.value, description: f.description.value, opening: f.opening.checked, lines }), x => 'บันทึกแล้ว ' + x.journal_number + ' · รออนุมัติ');
      if (r) { m.close(); F.refreshBadges(); F.nav('#journal/' + r.id); }
    };
  }

  F.page('journal', {
    title: 'สมุดรายวัน', nav: 'journals',
    async render(el, id) {
      const r = await api.get('journal', { id });
      const j = r.journal, me = F.session.actor.ref, self = F.session.company.allowSelfApproval && F.session.actor.role === 'owner';
      const manual = ['manual', 'opening'].includes(j.source_type);
      const acts = [];
      if (j.status === 'pending_review' && F.can('approve')) acts.push('<button class="fm-btn fm-btn-light" data-a="reject">ตีกลับ</button>', j.created_by === me && !self ? '<span class="fm-badge warn">รายการของคุณ — ให้ผู้อื่นลงบัญชี</span>' : '<button class="fm-btn fm-btn-primary" data-a="post">ลงบัญชี</button>');
      if (j.status === 'draft' && manual && F.can('write')) acts.push('<button class="fm-btn fm-btn-light" data-a="delete">ลบร่าง</button>', '<button class="fm-btn fm-btn-primary" data-a="submit">ส่งอนุมัติอีกครั้ง</button>');
      if (j.status === 'posted' && manual && F.can('approve')) acts.push('<button class="fm-btn fm-btn-light" data-a="reverse">กลับรายการ</button>');
      if (j.source_document_id) acts.push(`<button class="fm-btn fm-btn-light" data-go="#document/${j.source_document_id}">เปิดเอกสารต้นทาง</button>`);
      acts.push('<button class="fm-btn fm-btn-light" onclick="window.print()">พิมพ์</button>');
      el.innerHTML = F.head('JOURNAL ENTRY', j.journal_number, badge(j.status) + ' · ' + esc(L.source[j.source_type] || j.source_type) + ' · ' + thDate(j.journal_date), acts.join('')) +
        `<section class="fm-panel"><dl class="fm-dl"><dt>คำอธิบาย</dt><dd>${esc(j.description)}</dd><dt>ผู้บันทึก / ผู้ลงบัญชี</dt><dd>${esc(j.created_by_name || j.created_by || '–')} / ${esc(j.posted_by_name || j.posted_by || j.approved_by || '–')}</dd>${j.review_note ? `<dt>หมายเหตุการตรวจ</dt><dd>${esc(j.review_note)}</dd>` : ''}</dl></section>` +
        table([{ h: 'บัญชี', f: x => `<b>${esc(x.account_code)}</b> ${esc(x.account_name)}` }, { h: 'คำอธิบาย', f: x => esc(x.description || '') + (x.partner_name ? `<span class="sub">${esc(x.partner_name)}</span>` : '') }, { h: 'เดบิต', num: 1, f: x => Number(x.debit) ? money(x.debit) : '' }, { h: 'เครดิต', num: 1, f: x => Number(x.credit) ? money(x.credit) : '' }],
          r.lines, { foot: ['รวม', '', { v: money(j.total_debit), num: 1 }, { v: money(j.total_credit), num: 1 }] });
      el.querySelector('.fm-head-actions').onclick = async e => {
        const b = e.target.closest('[data-a]'); if (!b) return; let ok;
        if (b.dataset.a === 'post') ok = await run(b, () => api.post('journal.post', { journal_id: j.id }), 'ลงบัญชีแล้ว');
        if (b.dataset.a === 'submit') ok = await run(b, () => api.post('journal.submit', { journal_id: j.id }), 'ส่งอนุมัติแล้ว');
        if (b.dataset.a === 'reject') { const n = await F.ask('ตีกลับสมุดรายวัน', '', { input: true, required: true }); if (n) ok = await run(b, () => api.post('journal.reject', { journal_id: j.id, note: n }), 'ตีกลับแล้ว'); }
        if (b.dataset.a === 'delete') { if (await F.ask('ลบร่างสมุดรายวัน', 'ลบถาวร — ใช้ได้กับร่างที่ยังไม่ลงบัญชีเท่านั้น', { danger: true, ok: 'ลบ' }) && await run(b, () => api.post('journal.delete', { journal_id: j.id }), 'ลบแล้ว')) { F.nav('#journals'); return; } }
        if (b.dataset.a === 'reverse') {
          const n = await F.ask('กลับรายการ', 'ระบบจะลงรายการกลับด้านในวันที่ที่เลือก', { input: true, required: true, label: 'เหตุผล', danger: true, ok: 'ต่อไป' });
          if (n) { const d = await F.ask('วันที่กลับรายการ', 'ต้องอยู่ในรอบบัญชีที่เปิดอยู่', { input: true, type: 'date', label: 'วันที่', required: true }); if (d) ok = await run(b, () => api.post('journal.reverse', { journal_id: j.id, reason: n, reversal_date: d }), x => 'กลับรายการแล้ว · ' + x.journal_number); }
        }
        if (ok) { F.refreshBadges(); F.reload(); }
      };
    },
  });

  // ---------- ผังบัญชี ----------
  F.page('accounts', {
    title: 'ผังบัญชี',
    async render(el) {
      const items = (await api.get('accounts', { all: 1 })).items;
      FIN.bust('accounts');
      el.innerHTML = F.head('CHART OF ACCOUNTS', 'ผังบัญชี', 'บัญชีที่มีป้าย "ระบบ" ใช้ลงบัญชีอัตโนมัติ ปิดใช้งานไม่ได้', F.can('admin') ? '<button class="fm-btn fm-btn-primary" id="fmNewA">＋ เพิ่มบัญชี</button>' : '') +
        (items.length ? '' : `<div class="fm-notice warn"><span>!</span><div><b>ยังไม่มีผังบัญชี</b><small>${F.can('admin') ? 'กด "ตั้งค่าเริ่มต้น" ที่หน้าภาพรวม หรือ ตั้งค่าระบบ' : 'ให้ Owner ตั้งค่าเริ่มต้น'}</small></div></div>`) +
        Object.entries(L.acType).map(([t, label]) => `<section class="fm-panel"><div class="fm-panel-head"><h2>${label}</h2></div>${table([
          { h: 'รหัส', f: a => `<b>${esc(a.account_code)}</b>` }, { h: 'ชื่อบัญชี', f: a => esc(a.account_name) + (a.system_key ? ' <span class="fm-badge info">ระบบ</span>' : '') + (a.description ? `<span class="sub">${esc(a.description)}</span>` : '') },
          { h: 'สถานะ', f: a => a.is_active ? '<span class="fm-badge ok">ใช้งาน</span>' : '<span class="fm-badge mute">ปิด</span>' },
          { h: '', cls: 'acts', f: a => `<button class="fm-btn fm-btn-sm" data-ledger="${a.id}">แยกประเภท</button>${F.can('admin') ? ` <button class="fm-btn fm-btn-sm" data-edit="${a.id}">แก้ไข</button>` : ''}` },
        ], items.filter(a => a.account_type === t), { empty: 'ไม่มีบัญชี', compact: true })}</section>`).join('');
      const edit = a => {
        const m = F.modal(a ? 'แก้ไขบัญชี ' + a.account_code : 'เพิ่มบัญชี', `<form id="fmA" class="fm-form-grid">
          <label class="fm-field"><span>รหัสบัญชี *</span><input name="account_code" required maxlength="20" ${a ? 'disabled value="' + esc(a.account_code) + '"' : 'placeholder="เช่น 5110"'}></label>
          <label class="fm-field"><span>ประเภท *</span><select name="account_type" ${a ? 'disabled' : ''}>${Object.entries(L.acType).map(([k, v]) => `<option value="${k}" ${a && a.account_type === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
          <label class="fm-field fm-field-full"><span>ชื่อบัญชี *</span><input name="account_name" required maxlength="200" value="${esc(a ? a.account_name : '')}"></label>
          <label class="fm-field fm-field-full"><span>คำอธิบาย</span><input name="description" maxlength="300" value="${esc(a ? a.description || '' : '')}"></label>
          ${a ? `<label class="fm-check fm-field-full"><input type="checkbox" name="is_active" ${a.is_active ? 'checked' : ''} ${a.system_key ? 'disabled' : ''}> ใช้งาน${a.system_key ? ' (บัญชีระบบ ปิดไม่ได้)' : ''}</label>` : ''}
          <div class="fm-form-actions fm-field-full"><button type="button" class="fm-btn fm-btn-light" data-close>ยกเลิก</button><button class="fm-btn fm-btn-primary">บันทึก</button></div></form>`);
        const f = m.el.querySelector('#fmA');
        f.onsubmit = async e => { e.preventDefault(); const body = { id: a ? a.id : null, account_code: f.account_code.value, account_type: f.account_type.value, account_name: f.account_name.value, description: f.description.value, is_active: a ? (a.system_key ? true : f.is_active.checked) : true }; if (await run(f.querySelector('.fm-btn-primary'), () => api.post('account.save', body), 'บันทึกแล้ว')) { m.close(); F.bust('accounts'); F.reload(); } };
      };
      const nb = el.querySelector('#fmNewA'); if (nb) nb.onclick = () => edit(null);
      el.onclick = e => { const b = e.target.closest('[data-edit]'); if (b) edit(items.find(a => a.id === b.dataset.edit)); const l = e.target.closest('[data-ledger]'); if (l) F.nav('#ledger/' + l.dataset.ledger); };
    },
  });

  // ---------- รอบบัญชี ----------
  F.page('periods', {
    title: 'รอบบัญชี',
    async render(el) {
      const items = (await api.get('periods')).items;
      const y = Number(F.today().slice(0, 4));
      el.innerHTML = F.head('ACCOUNTING PERIODS', 'รอบบัญชี', 'ลงบัญชีได้เฉพาะวันที่ที่อยู่ในรอบที่เปิด · ปิดรอบเมื่อตรวจยอดครบแล้ว (เปิดใหม่ได้โดย Owner พร้อมเหตุผล)',
        F.can('admin') ? `<select id="fmYear">${[y - 1, y, y + 1].map(v => `<option ${v === y ? 'selected' : ''}>${v}</option>`).join('')}</select><button class="fm-btn fm-btn-primary" id="fmMkYear">＋ สร้างรอบบัญชีทั้งปี</button>` : '') +
        table([{ h: 'รอบ', f: p => `<b>${esc(F.monthName(p.period_code))}</b><span class="sub">${thDate(p.starts_on)} – ${thDate(p.ends_on)}</span>` }, { h: 'สถานะ', f: p => badge(p.status) }, { h: 'รายการที่ลงบัญชี', num: 1, f: p => p.posted_count },
          { h: 'ปิด/เปิดล่าสุด', f: p => p.closed_at ? `ปิด ${F.thDateTime(p.closed_at)}${p.reopened_at ? '<span class="sub">เปิดใหม่ ' + F.thDateTime(p.reopened_at) + '</span>' : ''}${p.close_note ? '<span class="sub">' + esc(p.close_note) + '</span>' : ''}` : '–' },
          { h: '', cls: 'acts', f: p => !F.can('admin') ? '' : ['open', 'reopened'].includes(p.status) ? `<button class="fm-btn fm-btn-sm" data-pclose="${p.id}">ปิดรอบ</button>` : `<button class="fm-btn fm-btn-sm" data-reopen="${p.id}">เปิดใหม่</button>` }],
          items, { empty: 'ยังไม่มีรอบบัญชี', emptyHint: F.can('admin') ? 'กด "สร้างรอบบัญชีทั้งปี"' : '' });
      const mk = el.querySelector('#fmMkYear');
      if (mk) mk.onclick = async () => { if (await run(mk, () => api.post('period.create-year', { year: Number(el.querySelector('#fmYear').value) }), r => 'สร้าง ' + r.created + ' รอบ')) F.reload(); };
      el.querySelector('.fm-table-wrap, .fm-empty').onclick = async e => {
        const c = e.target.closest("[data-pclose]"), r = e.target.closest('[data-reopen]'); let ok;
        if (c) { const n = await F.ask('ปิดรอบบัญชี', 'หลังปิดจะลงบัญชีวันที่ในรอบนี้ไม่ได้ · ระบบจะตรวจว่าไม่มีเอกสาร/สมุดรายวัน/รับจ่ายค้าง', { input: true, label: 'หมายเหตุ (ถ้ามี)', ok: 'ปิดรอบ' }); if (n !== null) ok = await run(c, () => api.post('period.close', { period_id: c.dataset.pclose, note: n }), 'ปิดรอบแล้ว'); }
        if (r) { const n = await F.ask('เปิดรอบบัญชีใหม่', 'ใช้เมื่อต้องปรับปรุงรายการย้อนหลัง — ระบบบันทึกเหตุผลไว้ในประวัติ', { input: true, required: true, ok: 'เปิดรอบ' }); if (n) ok = await run(r, () => api.post('period.reopen', { period_id: r.dataset.reopen, reason: n }), 'เปิดรอบแล้ว'); }
        if (ok) F.reload();
      };
    },
  });
})();
