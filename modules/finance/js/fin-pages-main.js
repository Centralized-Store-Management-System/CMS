/* Finance: ภาพรวม + กล่องรออนุมัติ */
(function () {
  'use strict';
  const F = window.FIN, { esc, money, baht, thDate, table, badge, L, api, run } = F;

  F.page('dashboard', {
    title: 'ภาพรวม',
    async render(el) {
      const s = await F.refreshBadges() || await api.get('summary');
      const co = F.session.company, k = s.kpi, p = s.pending || {};
      const needSetup = !s.setup.accounts || !s.setup.periods;
      const max = Math.max(1, ...s.series.map(x => Math.max(x.revenue, x.expense)));
      const steps = needSetup || !s.setup.open_now ? `<section class="fm-panel"><div class="fm-panel-head"><div><h2>เริ่มต้นใช้งาน</h2><p>ทำ 3 ขั้นนี้ครั้งเดียวก่อนบันทึกรายการ</p></div></div><div class="fm-steps">
        <div class="fm-step ${co.name && !/test/i.test(co.name) ? 'done' : ''}"><div><b>ข้อมูลบริษัท</b><small>ชื่อ เลขผู้เสียภาษี จด VAT หรือไม่</small></div><button class="fm-btn fm-btn-sm" data-go="#company">เปิด</button></div>
        <div class="fm-step ${s.setup.accounts ? 'done' : ''}"><div><b>ผังบัญชีมาตรฐาน + รอบบัญชีปีนี้</b><small>${s.setup.accounts} บัญชี · ${s.setup.periods} รอบบัญชี</small></div>${F.can('admin') ? '<button class="fm-btn fm-btn-sm fm-btn-primary" id="fmSetup">ตั้งค่าเริ่มต้น</button>' : '<small class="fm-muted">ให้ Owner ตั้งค่า</small>'}</div>
        <div class="fm-step ${s.setup.open_now ? 'done' : ''}"><div><b>รอบบัญชีเดือนปัจจุบันเปิดอยู่</b><small>${s.setup.open_now ? 'พร้อมลงบัญชี' : 'ยังไม่มีรอบบัญชีของเดือนนี้'}</small></div><button class="fm-btn fm-btn-sm" data-go="#periods">เปิด</button></div>
      </div></section>` : '';
      const todo = [
        [p.documents, 'เอกสารรออนุมัติ', '#approvals'], [p.payments, 'รายการรับ/จ่ายรออนุมัติ', '#approvals'], [p.to_pay, 'รายการที่อนุมัติแล้ว รอบันทึกรับ/จ่ายจริง', '#approvals'],
        [p.journals, 'สมุดรายวันรอลงบัญชี', '#approvals'], [p.filings, 'แบบภาษีรอตรวจ', '#filings'], [p.drafts, 'เอกสารฉบับร่าง', '#expense'],
      ].filter(x => x[0]).map(x => `<button class="fm-step" data-go="${x[2]}" style="cursor:pointer;text-align:left;font:inherit"><div><b>${x[0]} ${esc(x[1])}</b></div><span>›</span></button>`).join('');
      el.innerHTML = F.head('FINANCE OVERVIEW', 'ภาพรวมการเงิน', esc(co.name) + ' · ' + esc(F.session.actor.displayName) + ' (' + esc(L.role[F.session.actor.role]) + ')',
        F.can('write') ? '<button class="fm-btn fm-btn-light" data-go="#income/new">＋ รายรับ</button><button class="fm-btn fm-btn-primary" data-go="#expense/new">＋ รายจ่าย</button>' : '') +
        (co.environment !== 'production' ? '<div class="fm-notice warn"><span>!</span><div><b>โหมดทดสอบ (UAT)</b><small>รายการทั้งหมดในโหมดนี้เป็นข้อมูลทดสอบ เมื่อบริษัทเปิดจริง Owner กด "เริ่มใช้งานจริง" ที่ ตั้งค่าระบบ — ระบบจะล้างรายการทดสอบทั้งหมด (เก็บผังบัญชี คู่ค้า ผู้ใช้ไว้)</small></div></div>' : '') +
        steps +
        `<div class="fm-kpis">
          <article class="fm-kpi click" data-go="#profit-loss"><div class="fm-kpi-label">รายได้เดือนนี้</div><strong>${baht(k.revenue_mtd)}</strong><small>ค่าใช้จ่าย ${baht(k.expense_mtd)}</small></article>
          <article class="fm-kpi click" data-go="#profit-loss"><div class="fm-kpi-label">กำไร (ขาดทุน) เดือนนี้</div><strong style="color:${k.profit_mtd < 0 ? '#b3261e' : 'inherit'}">${baht(k.profit_mtd)}</strong><small>จากรายการที่ลงบัญชีแล้ว</small></article>
          <article class="fm-kpi click" data-go="#balance-sheet"><div class="fm-kpi-label">เงินสด + เงินฝาก</div><strong>${baht(k.cash)}</strong><small>ยอดคงเหลือตามบัญชี</small></article>
          <article class="fm-kpi click" data-go="#aging"><div class="fm-kpi-label">ลูกหนี้ / เจ้าหนี้</div><strong>${baht(k.ar)}</strong><small>เจ้าหนี้ ${baht(k.ap)}</small></article>
        </div>
        <div class="fm-grid2">
          <section class="fm-panel"><div class="fm-panel-head"><div><h2>รายได้–ค่าใช้จ่าย 6 เดือน</h2><p>จากสมุดรายวันที่ลงบัญชีแล้ว</p></div><div class="fm-legend"><span><i style="background:var(--green)"></i>รายได้</span><span><i style="background:#d9906a"></i>ค่าใช้จ่าย</span></div></div>
            ${s.series.length ? `<div class="fm-bars">${s.series.map(x => `<div class="fm-bar" title="${esc(F.monthName(x.month))}: รายได้ ${money(x.revenue)} / ค่าใช้จ่าย ${money(x.expense)}"><i class="r" style="height:${Math.max(0, x.revenue) / max * 100}%"></i><i class="e" style="height:${Math.max(0, x.expense) / max * 100}%"></i></div>`).join('')}</div><div class="fm-bar-labels">${s.series.map(x => `<span>${esc(F.monthName(x.month).split(' ')[0].slice(0, 6))}</span>`).join('')}</div>` : '<div class="fm-empty"><b>ยังไม่มีรายการที่ลงบัญชี</b><small>เมื่ออนุมัติเอกสารแล้ว กราฟจะแสดงที่นี่</small></div>'}
          </section>
          <section class="fm-panel"><div class="fm-panel-head"><div><h2>งานที่ต้องทำ</h2><p>ภาษีค้างนำส่ง: VAT ${baht(k.vat_due)} · หัก ณ ที่จ่าย ${baht(k.wht_due)}</p></div></div>
            <div class="fm-steps" style="counter-reset:none">${todo || '<div class="fm-empty"><b>ไม่มีงานค้าง</b></div>'}</div>
            ${s.filings.length ? '<h3 style="font-size:13px;margin:14px 0 6px">แบบภาษีที่ยังไม่ยื่น</h3>' + s.filings.map(f => `<div class="fm-step" style="margin-bottom:6px"><div><b>${esc(L.form[f.form_code])} ${esc(F.monthName(f.tax_period))}</b><small>กำหนด ${thDate(f.due_date)} · ${baht(f.return_amount)}</small></div>${badge(f.status)}</div>`).join('') : ''}
          </section>
        </div>
        <section class="fm-panel"><div class="fm-panel-head"><div><h2>รายการบัญชีล่าสุด</h2></div><button class="fm-btn fm-btn-sm" data-go="#journals">ดูสมุดรายวัน ›</button></div>
          ${table([{ h: 'วันที่', f: r => thDate(r.journal_date) }, { h: 'เลขที่', k: 'journal_number' }, { h: 'รายการ', k: 'description' }, { h: 'ที่มา', f: r => esc(L.source[r.source_type] || r.source_type) }, { h: 'จำนวนเงิน', num: 1, f: r => money(r.total_debit) }], s.recent, { empty: 'ยังไม่มีรายการบัญชี', compact: true })}
        </section>`;
      const b = el.querySelector('#fmSetup');
      if (b) b.onclick = () => run(b, () => api.post('setup.defaults', { year: Number(F.today().slice(0, 4)) }), r => `สร้างผังบัญชี ${r.accounts_created} บัญชี · รอบบัญชี ${r.periods_created} รอบ`).then(r => { if (r) { F.bust(''); F.reload(); } });
    },
  });

  // ----- รออนุมัติ -----
  F.page('approvals', {
    title: 'รออนุมัติ', need: 'approve',
    async render(el) {
      const q = await api.get('approvals');
      const me = F.session.actor.ref, self = F.session.company.allowSelfApproval && F.session.actor.role === 'owner';
      const mine = r => r.created_by === me && !self;
      const btn = (act, id, label, cls, r) => mine(r) ? '<small class="fm-muted" title="Maker–Checker: อนุมัติรายการที่ตัวเองสร้างไม่ได้">รายการของคุณ</small>' : `<button class="fm-btn fm-btn-sm ${cls || ''}" data-act="${act}" data-id="${id}">${label}</button>`;
      const sect = (title, html, n) => `<section class="fm-panel"><div class="fm-panel-head"><div><h2>${title} <span class="fm-badge ${n ? 'warn' : ''}">${n}</span></h2></div></div>${html}</section>`;
      el.innerHTML = F.head('APPROVALS', 'รออนุมัติ', 'ผู้อนุมัติต้องไม่ใช่คนเดียวกับผู้บันทึก (Maker–Checker)' + (self ? ' · <b>เปิดให้ Owner อนุมัติรายการของตนเองได้</b>' : '')) +
        sect('เอกสาร', table([{ h: 'วันที่', f: r => thDate(r.document_date) }, { h: 'เลขที่', f: r => `<a class="fm-link" href="#document/${r.id}">${esc(r.document_number)}</a><span class="sub">${esc(L.docType[r.document_type])}</span>` }, { h: 'คู่ค้า', f: r => esc(r.partner_name || '–') }, { h: 'ยอดรวม', num: 1, f: r => money(r.grand_total) },
          { h: '', cls: 'acts', f: r => btn('doc-return', r.id, 'ตีกลับ', '', r) + ' ' + btn('doc-approve', r.id, ['expense', 'bill', 'payment_voucher'].includes(r.document_type) ? 'อนุมัติคำขอเบิก' : 'อนุมัติ + ลงบัญชี', 'fm-btn-primary', r) }], q.documents, { empty: 'ไม่มีเอกสารรออนุมัติ' }), q.documents.length) +
        sect('รับ/จ่ายเงิน รออนุมัติ', table([{ h: 'วันที่', f: r => thDate(r.payment_date) }, { h: 'ประเภท', f: r => esc(L.payType[r.payment_type]) }, { h: 'เอกสาร', f: r => esc(r.document_number || '–') }, { h: 'ช่องทาง', f: r => esc(L.method[r.method]) }, { h: 'จำนวน', num: 1, f: r => money(r.amount) },
          { h: '', cls: 'acts', f: r => btn('pay-reject', r.id, 'ปฏิเสธ', '', r) + ' ' + btn('pay-approve', r.id, 'อนุมัติ', 'fm-btn-primary', r) }], q.payments, { empty: 'ไม่มีรายการรออนุมัติ' }), q.payments.length) +
        sect('อนุมัติแล้ว — รอบันทึกว่ารับ/จ่ายจริง', table([{ h: 'วันที่', f: r => thDate(r.payment_date) }, { h: 'ประเภท', f: r => esc(L.payType[r.payment_type]) }, { h: 'เอกสาร', f: r => esc(r.document_number || '–') }, { h: 'จำนวน', num: 1, f: r => money(r.amount) },
          { h: '', cls: 'acts', f: r => `<button class="fm-btn fm-btn-sm fm-btn-primary" data-act="pay-paid" data-id="${r.id}">บันทึกว่า${r.payment_type === 'receipt' ? 'รับ' : 'จ่าย'}แล้ว</button>` }], q.to_pay, { empty: 'ไม่มีรายการ' }), q.to_pay.length) +
        sect('สมุดรายวัน รอลงบัญชี', table([{ h: 'วันที่', f: r => thDate(r.journal_date) }, { h: 'เลขที่', f: r => `<a class="fm-link" href="#journal/${r.id}">${esc(r.journal_number)}</a>` }, { h: 'รายการ', k: 'description' }, { h: 'จำนวน', num: 1, f: r => money(r.total_debit) },
          { h: '', cls: 'acts', f: r => btn('je-reject', r.id, 'ตีกลับ', '', r) + ' ' + btn('je-post', r.id, 'ลงบัญชี', 'fm-btn-primary', r) }], q.journals, { empty: 'ไม่มีรายการ' }), q.journals.length) +
        sect('แบบภาษี รอตรวจ', table([{ h: 'แบบ', f: r => esc(L.form[r.form_code]) }, { h: 'งวด', f: r => esc(F.monthName(r.tax_period)) }, { h: 'กำหนดยื่น', f: r => thDate(r.due_date) }, { h: 'ยอด', num: 1, f: r => money(r.return_amount) },
          { h: '', cls: 'acts', f: r => `<button class="fm-btn fm-btn-sm" data-go="#filings">เปิด</button>` }], q.filings, { empty: 'ไม่มีรายการ' }), q.filings.length);
      el.onclick = async e => {
        const b = e.target.closest('[data-act]'); if (!b) return;
        const id = b.dataset.id, a = b.dataset.act;
        const done = () => { F.refreshBadges(); F.reload(); };
        if (a === 'doc-approve') { if (await run(b, () => api.post('document.approve', { document_id: id }), x => x && x.accounting_posted === false ? 'อนุมัติคำขอเบิกแล้ว — รอผู้เบิกจ่ายเงินและเคลียร์ (ลงบัญชีตอนปิดงาน)' : 'อนุมัติแล้ว · ลงบัญชี ' + x.journal_number)) done(); }
        if (a === 'doc-return') { const n = await F.ask('ตีกลับเอกสาร', 'เอกสารจะกลับเป็นฉบับร่างให้ผู้บันทึกแก้ไข', { input: true, required: true, label: 'เหตุผล' }); if (n && await run(b, () => api.post('document.return', { document_id: id, note: n }), 'ตีกลับแล้ว')) done(); }
        if (a === 'pay-approve') { if (await run(b, () => api.post('payment.approve', { payment_id: id }), 'อนุมัติแล้ว')) done(); }
        if (a === 'pay-reject') { const n = await F.ask('ปฏิเสธรายการ', 'รายการนี้จะถูกปิด สร้างใหม่ได้ภายหลัง', { input: true, required: true, label: 'เหตุผล', danger: true, ok: 'ปฏิเสธ' }); if (n && await run(b, () => api.post('payment.reject', { payment_id: id, note: n }), 'ปฏิเสธแล้ว')) done(); }
        if (a === 'pay-paid') { if (await F.ask('ยืนยันรับ/จ่ายเงินจริง', 'ระบบจะลงบัญชีเงินสด/ธนาคารทันที และตัดยอดคงค้างของเอกสาร', { ok: 'ยืนยัน' }) && await run(b, () => api.post('payment.mark-paid', { payment_id: id }), r => 'บันทึกแล้ว · ลงบัญชี ' + r.journal_number)) done(); }
        if (a === 'je-post') { if (await run(b, () => api.post('journal.post', { journal_id: id }), 'ลงบัญชีแล้ว')) done(); }
        if (a === 'je-reject') { const n = await F.ask('ตีกลับสมุดรายวัน', 'รายการจะกลับเป็นฉบับร่าง', { input: true, required: true, label: 'เหตุผล' }); if (n && await run(b, () => api.post('journal.reject', { journal_id: id, note: n }), 'ตีกลับแล้ว')) done(); }
      };
    },
  });
})();
