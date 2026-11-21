/* Finance: รายงานบัญชี (ส่งออก CSV / พิมพ์ได้ทุกหน้า) */
(function () {
  'use strict';
  const F = window.FIN, { esc, money, thDate, table, api, L } = F;
  const first = () => F.thisMonth() + '-01';
  const rangeBar = (from, to, extra = '') => `<div class="fm-toolbar"><label>ตั้งแต่ <input type="date" id="fmFrom" value="${from}"></label><label>ถึง <input type="date" id="fmTo" value="${to}"></label>
    <select id="fmQuick"><option value="">ช่วงเวลา…</option><option value="m">เดือนนี้</option><option value="pm">เดือนก่อน</option><option value="q">ไตรมาสนี้</option><option value="y">ปีนี้</option></select>${extra}
    <button class="fm-btn fm-btn-light" id="fmCsv">↓ CSV</button><button class="fm-btn fm-btn-light" onclick="window.print()">พิมพ์</button></div>`;
  function quick(el, onChange) {
    el.querySelector('#fmQuick').onchange = e => {
      const t = F.today(), y = +t.slice(0, 4), m = +t.slice(5, 7), pad = n => String(n).padStart(2, '0'), last = (yy, mm) => new Date(Date.UTC(yy, mm, 0)).toISOString().slice(0, 10);
      let f, to = t;
      if (e.target.value === 'm') f = t.slice(0, 8) + '01';
      if (e.target.value === 'pm') { const py = m === 1 ? y - 1 : y, pm = m === 1 ? 12 : m - 1; f = py + '-' + pad(pm) + '-01'; to = last(py, pm); }
      if (e.target.value === 'q') f = y + '-' + pad(Math.floor((m - 1) / 3) * 3 + 1) + '-01';
      if (e.target.value === 'y') f = y + '-01-01';
      if (f) { el.querySelector('#fmFrom').value = f; el.querySelector('#fmTo').value = to; onChange(); }
    };
    el.querySelector('#fmFrom').onchange = onChange; el.querySelector('#fmTo').onchange = onChange;
  }
  const lines = (rows) => table([{ h: 'รหัส', k: 'account_code' }, { h: 'บัญชี', k: 'account_name' }, { h: 'จำนวนเงิน', num: 1, f: r => money(r.amount) }], rows, { empty: 'ไม่มีรายการ', compact: true });

  F.page('profit-loss', {
    title: 'งบกำไรขาดทุน',
    async render(el) {
      el.innerHTML = F.head('PROFIT & LOSS', 'งบกำไรขาดทุน', esc(F.session.company.name)) + rangeBar(first(), F.today()) + `<div id="fmR">${F.loading()}</div>`;
      let d;
      const load = async () => {
        d = await api.get('profit-loss', { from: el.querySelector('#fmFrom').value, to: el.querySelector('#fmTo').value });
        el.querySelector('#fmR').innerHTML = `<section class="fm-panel fm-report"><p class="fm-muted" style="margin-top:0">${thDate(d.from)} – ${thDate(d.to)}</p>
          <h3>รายได้</h3>${lines(d.revenue)}<div class="fm-totals"><div class="total"><span>รวมรายได้</span><span>${money(d.totals.revenue)}</span></div></div>
          <h3>ค่าใช้จ่าย</h3>${lines(d.expense)}<div class="fm-totals"><div class="total"><span>รวมค่าใช้จ่าย</span><span>${money(d.totals.expense)}</span></div>
          <div class="grand"><span>${d.totals.net >= 0 ? 'กำไรสุทธิ' : 'ขาดทุนสุทธิ'}</span><span style="color:${d.totals.net < 0 ? '#b3261e' : 'inherit'}">${money(d.totals.net)}</span></div></div></section>`;
      };
      quick(el, load);
      el.querySelector('#fmCsv').onclick = () => d && F.csv('profit-loss-' + d.from + '_' + d.to + '.csv', [['หมวด', 'รหัส', 'บัญชี', 'จำนวนเงิน']].concat(d.revenue.map(r => ['รายได้', r.account_code, r.account_name, r.amount]), [['', '', 'รวมรายได้', d.totals.revenue]], d.expense.map(r => ['ค่าใช้จ่าย', r.account_code, r.account_name, r.amount]), [['', '', 'รวมค่าใช้จ่าย', d.totals.expense], ['', '', 'กำไร (ขาดทุน) สุทธิ', d.totals.net]]));
      await load();
    },
  });

  F.page('balance-sheet', {
    title: 'งบแสดงฐานะการเงิน',
    async render(el) {
      el.innerHTML = F.head('BALANCE SHEET', 'งบแสดงฐานะการเงิน', esc(F.session.company.name)) + `<div class="fm-toolbar"><label>ณ วันที่ <input type="date" id="fmAsOf" value="${F.today()}"></label><button class="fm-btn fm-btn-light" id="fmCsv">↓ CSV</button><button class="fm-btn fm-btn-light" onclick="window.print()">พิมพ์</button></div><div id="fmR">${F.loading()}</div>`;
      let d;
      const load = async () => {
        d = await api.get('balance-sheet', { as_of: el.querySelector('#fmAsOf').value });
        el.querySelector('#fmR').innerHTML = `${d.totals.balanced ? '' : '<div class="fm-notice bad"><span>!</span><div><b>งบไม่สมดุล</b><small>โปรดตรวจสอบรายการบัญชี</small></div></div>'}
          <div class="fm-grid2"><section class="fm-panel fm-report"><h3 style="margin-top:0">สินทรัพย์</h3>${lines(d.assets)}<div class="fm-totals"><div class="grand"><span>รวมสินทรัพย์</span><span>${money(d.totals.assets)}</span></div></div></section>
          <section class="fm-panel fm-report"><h3 style="margin-top:0">หนี้สิน</h3>${lines(d.liabilities)}<div class="fm-totals"><div class="total"><span>รวมหนี้สิน</span><span>${money(d.totals.liabilities)}</span></div></div>
          <h3>ส่วนของเจ้าของ</h3>${lines(d.equity)}<div class="fm-totals"><div class="total"><span>รวมส่วนของเจ้าของ</span><span>${money(d.totals.equity)}</span></div><div class="grand"><span>รวมหนี้สินและส่วนของเจ้าของ</span><span>${money(d.totals.liabilities_equity)}</span></div></div></section></div>`;
      };
      el.querySelector('#fmAsOf').onchange = load;
      el.querySelector('#fmCsv').onclick = () => d && F.csv('balance-sheet-' + d.as_of + '.csv', [['หมวด', 'รหัส', 'บัญชี', 'จำนวนเงิน']].concat(d.assets.map(r => ['สินทรัพย์', r.account_code, r.account_name, r.amount]), d.liabilities.map(r => ['หนี้สิน', r.account_code, r.account_name, r.amount]), d.equity.map(r => ['ส่วนของเจ้าของ', r.account_code, r.account_name, r.amount]), [['', '', 'รวมสินทรัพย์', d.totals.assets], ['', '', 'รวมหนี้สินและส่วนของเจ้าของ', d.totals.liabilities_equity]]));
      await load();
    },
  });

  F.page('trial-balance', {
    title: 'งบทดลอง',
    async render(el) {
      el.innerHTML = F.head('TRIAL BALANCE', 'งบทดลอง', 'ยอดยกมา + เคลื่อนไหวในช่วง = ยอดคงเหลือ (บวก = เดบิต)') + rangeBar(first(), F.today()) + `<div id="fmR">${F.loading()}</div>`;
      let d;
      const load = async () => {
        d = await api.get('trial-balance', { from: el.querySelector('#fmFrom').value, to: el.querySelector('#fmTo').value });
        el.querySelector('#fmR').innerHTML = (d.totals.balanced ? '<div class="fm-notice"><span>✓</span><div><b>สมดุล</b><small>เดบิตรวมเท่ากับเครดิตรวม</small></div></div>' : '<div class="fm-notice bad"><span>!</span><div><b>ไม่สมดุล</b></div></div>') +
          table([{ h: 'รหัส', f: r => `<a class="fm-link" href="#ledger/${r.id}">${esc(r.account_code)}</a>` }, { h: 'บัญชี', k: 'account_name' }, { h: 'ประเภท', f: r => esc(L.acType[r.account_type]) }, { h: 'ยอดยกมา', num: 1, f: r => money(r.opening) }, { h: 'เดบิต', num: 1, f: r => money(r.debit) }, { h: 'เครดิต', num: 1, f: r => money(r.credit) }, { h: 'คงเหลือ', num: 1, f: r => money(r.closing) }],
            d.items, { empty: 'ยังไม่มีรายการบัญชีในช่วงนี้', compact: true, foot: ['รวม', '', '', '', { v: money(d.totals.debit), num: 1 }, { v: money(d.totals.credit), num: 1 }, ''] });
      };
      quick(el, load);
      el.querySelector('#fmCsv').onclick = () => d && F.csv('trial-balance-' + d.from + '_' + d.to + '.csv', [['รหัส', 'บัญชี', 'ประเภท', 'ยอดยกมา', 'เดบิต', 'เครดิต', 'คงเหลือ']].concat(d.items.map(r => [r.account_code, r.account_name, L.acType[r.account_type], r.opening, r.debit, r.credit, r.closing])));
      await load();
    },
  });

  F.page('ledger', {
    title: 'บัญชีแยกประเภท',
    async render(el, accId) {
      const accounts = await F.accounts(true);
      el.innerHTML = F.head('GENERAL LEDGER', 'บัญชีแยกประเภท', '') + rangeBar(first(), F.today(), `<select id="fmAcc" style="min-width:220px">${accounts.map(a => `<option value="${a.id}" ${a.id === accId ? 'selected' : ''}>${esc(a.account_code + ' ' + a.account_name)}</option>`).join('')}</select>`) + `<div id="fmR">${accounts.length ? F.loading() : '<div class="fm-empty"><b>ยังไม่มีผังบัญชี</b></div>'}</div>`;
      if (!accounts.length) return;
      let d;
      const load = async () => {
        d = await api.get('ledger', { account_id: el.querySelector('#fmAcc').value, from: el.querySelector('#fmFrom').value, to: el.querySelector('#fmTo').value });
        el.querySelector('#fmR').innerHTML = `<section class="fm-panel"><b>${esc(d.account.account_code + ' ' + d.account.account_name)}</b> <span class="fm-muted">· ยอดยกมา ${money(d.opening)} · ยอดยกไป ${money(d.closing)}</span></section>` +
          table([{ h: 'วันที่', f: r => thDate(r.journal_date) }, { h: 'เลขที่', f: r => `<a class="fm-link" href="#journal/${r.journal_id}">${esc(r.journal_number)}</a>` }, { h: 'รายการ', f: r => esc(r.description || '') + (r.partner_name ? `<span class="sub">${esc(r.partner_name)}</span>` : '') }, { h: 'เดบิต', num: 1, f: r => Number(r.debit) ? money(r.debit) : '' }, { h: 'เครดิต', num: 1, f: r => Number(r.credit) ? money(r.credit) : '' }, { h: 'คงเหลือ', num: 1, f: r => money(r.balance) }],
            d.items, { empty: 'ไม่มีความเคลื่อนไหวในช่วงนี้', compact: true });
      };
      quick(el, load); el.querySelector('#fmAcc').onchange = load;
      el.querySelector('#fmCsv').onclick = () => d && F.csv('ledger-' + d.account.account_code + '.csv', [['วันที่', 'เลขที่', 'รายการ', 'เดบิต', 'เครดิต', 'คงเหลือ'], ['', '', 'ยอดยกมา', '', '', d.opening]].concat(d.items.map(r => [F.d10(r.journal_date), r.journal_number, r.description || '', r.debit, r.credit, r.balance])));
      await load();
    },
  });

  F.page('aging', {
    title: 'อายุลูกหนี้ / เจ้าหนี้',
    async render(el) {
      el.innerHTML = F.head('AGING', 'อายุลูกหนี้ / เจ้าหนี้', 'นับจากวันครบกำหนด (ถ้าไม่ระบุ ใช้วันที่เอกสาร)') + `<div class="fm-tabs" id="fmK"><button data-k="ar" class="on">ลูกหนี้ (รอรับ)</button><button data-k="ap">เจ้าหนี้ (รอจ่าย)</button></div><div class="fm-toolbar"><label>ณ วันที่ <input type="date" id="fmAsOf" value="${F.today()}"></label><button class="fm-btn fm-btn-light" id="fmCsv">↓ CSV</button><button class="fm-btn fm-btn-light" onclick="window.print()">พิมพ์</button></div><div id="fmR">${F.loading()}</div>`;
      let d;
      const B = [['current', 'ยังไม่ครบกำหนด'], ['d1_30', '1–30 วัน'], ['d31_60', '31–60 วัน'], ['d61_90', '61–90 วัน'], ['d90p', 'เกิน 90 วัน'], ['total', 'รวม']];
      const load = async () => {
        d = await api.get('aging', { kind: el.querySelector('#fmK .on').dataset.k, as_of: el.querySelector('#fmAsOf').value });
        el.querySelector('#fmR').innerHTML = table([{ h: 'คู่ค้า', k: 'partner_name' }].concat(B.map(([k, h]) => ({ h, num: 1, f: r => money(r[k]) }))), d.partners, { empty: 'ไม่มียอดค้าง', compact: true, foot: ['รวม'].concat(B.map(([k]) => ({ v: money(d.totals[k] || 0), num: 1 }))) }) +
          '<h3 style="font-size:14px;margin:18px 0 8px">รายเอกสาร</h3>' + table([{ h: 'เอกสาร', f: r => `<a class="fm-link" href="#document/${r.id}">${esc(r.document_number)}</a>` }, { h: 'คู่ค้า', k: 'partner_name' }, { h: 'ครบกำหนด', f: r => thDate(r.due_date || r.document_date) }, { h: 'เกินกำหนด (วัน)', num: 1, f: r => Math.max(0, r.days_over) }, { h: 'คงค้าง', num: 1, f: r => money(r.outstanding) }], d.documents, { empty: 'ไม่มี', compact: true });
      };
      el.querySelector('#fmK').onclick = e => { const b = e.target.closest('button'); if (!b) return; el.querySelectorAll('#fmK button').forEach(x => x.classList.toggle('on', x === b)); load(); };
      el.querySelector('#fmAsOf').onchange = load;
      el.querySelector('#fmCsv').onclick = () => d && F.csv('aging-' + d.kind + '-' + d.as_of + '.csv', [['คู่ค้า'].concat(B.map(b => b[1]))].concat(d.partners.map(r => [r.partner_name].concat(B.map(([k]) => r[k])))));
      await load();
    },
  });
})();
