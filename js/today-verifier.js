/* หน้า Today ของ Role Final Verifier — งานของคนตรวจสอบ ไม่ใช่งานลงเวลา
 * - ตัด "ของฉัน" (ปุ่มลงเวลา กะของฉัน ชั่วโมงเดือนนี้) และ "วันนี้ของสาขา" ออก เพราะ Role นี้ไม่ลงเวลา
 * - แทนด้วย: การ์ดสรุปว่าวันนี้อนุมัติอะไรไปบ้าง · เลือกดูย้อนหลังรายวันได้ · รายการที่ตัดสินไปแล้ว
 * - ใช้ข้อมูลชุดเดียวกับ "ประวัติการอนุมัติ" ในหน้า Approvals (approve-history.js → window.ApproveHistory)
 * ไม่แก้ mod-today.js / today-ux.js — สลับ view เฉพาะตอนผู้ใช้เป็น Role นี้ */
'use strict';
(function () {
  if (typeof MODS === 'undefined') return;
  const ROLE = 'verifier';
  let day = '';                       // วันที่เลือก (ว่าง = วันนี้)

  const st = document.createElement('style');
  st.textContent = [
    '.tv-hero{background:linear-gradient(135deg,#10392A 0%,#17694A 100%);color:#fff;border-radius:22px;padding:20px;margin-bottom:14px;position:relative;overflow:hidden}',
    '.tv-hero::after{content:"";position:absolute;right:-40px;top:-40px;width:170px;height:170px;border-radius:50%;background:rgba(255,255,255,.07)}',
    '.tv-hero::before{content:"";position:absolute;right:26px;bottom:-54px;width:110px;height:110px;border-radius:50%;background:rgba(255,255,255,.05)}',
    '.tv-hero .tv-badge{display:inline-flex;align-items:center;gap:6px;padding:5px 11px;border-radius:999px;background:rgba(255,255,255,.16);font-size:12px;font-weight:700}',
    '.tv-hero h2{font:700 26px/1.25 var(--display);margin:10px 0 2px;position:relative}',
    '.tv-hero p{margin:0;color:#B8D2C3;font-size:13.5px;position:relative}',
    '.tv-hero .tv-big{display:flex;align-items:baseline;gap:8px;margin-top:14px;position:relative}',
    '.tv-hero .tv-big b{font:700 40px/1 var(--display)}.tv-hero .tv-big span{color:#B8D2C3;font-size:13.5px}',
    '.tv-hero .tv-mark{position:absolute;right:18px;top:18px;width:46px;height:46px;border-radius:14px;background:rgba(255,255,255,.14);display:grid;place-items:center}',
    '.tv-hero .tv-mark svg{width:26px;height:26px}',
    '.tv-tiles{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-bottom:16px}',
    '@media (max-width:560px){.tv-tiles{grid-template-columns:repeat(2,minmax(0,1fr))}}',
    '.tv-tile{border-radius:16px;padding:12px;background:var(--card,#fff);border:1px solid var(--line,#e4ece7);display:flex;flex-direction:column;gap:2px}',
    '.tv-tile small{font-size:12px;color:var(--muted,#5c7268)}.tv-tile b{font:700 24px/1.1 var(--display)}',
    '.tv-tile.wait{border-color:#E7B84B;background:rgba(231,184,75,.10)}.tv-tile.wait b{color:#9A6B00}',
    '.tv-bar{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin:18px 0 8px}',
    '.tv-bar .grow{flex:1}', '.tv-bar input[type=date]{width:auto;margin:0}'
  ].join('');
  document.head.appendChild(st);

  const SEAL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 12.5l2 2 4-4.5"/><path d="M12 3l7.5 3.4v5c0 4.3-3.1 8.3-7.5 9.6-4.4-1.3-7.5-5.3-7.5-9.6v-5L12 3Z"/></svg>';
  const KINDS = [['ใบลา', 'ใบลา'], ['คำขอ OT', 'OT'], ['แก้เวลา', 'แก้เวลา'], ['สต็อก', 'สต็อก']];
  const rows = D => { try { return (window.ApproveHistory && window.ApproveHistory.items(D)) || []; } catch (e) { return []; } };
  const pending = () => { try { return typeof approvals === 'function' ? approvals() : { total: 0 }; } catch (e) { return { total: 0 }; } };
  const WI = () => window.WorkInbox || null;
  const finTodo = () => (WI() ? WI().finTodo() : 0);          // งานเบิก–เคลียร์ที่รอคนนี้ (โมดูล Finance)
  const waiting = () => (pending().total || 0) + finTodo();   // งานค้างรวมทั้งสองระบบ ให้ตรงกับกระดิ่ง

  function view() {
    const T0 = today(), D = day || T0, L = rows(D), me = S.me;
    const ok = L.filter(x => x.status === 'อนุมัติ').length, no = L.length - ok;
    const P = pending(), W = waiting(), hr = new Date().getHours();
    const nOf = key => L.filter(x => x.kind === key || (key === 'สต็อก' && x.kind === 'ปรับสต็อก') || (key === 'คำขอ OT' && x.kind === 'OT')).length;
    const isToday = D === T0;
    const hero = `<section class="tv-hero">
      <i class="tv-mark">${SEAL}</i>
      <span class="tv-badge">${esc(ROLE_NAME[me.role] || 'Final Verifier')}</span>
      <h2>${hr < 12 ? 'สวัสดีตอนเช้า' : hr < 17 ? 'สวัสดีตอนบ่าย' : 'สวัสดีตอนเย็น'}, ${esc(me.name)}</h2>
      <p>${thDate(T0, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} · ${allBranch() ? 'ดูแลทุกสาขา' : esc(branchName(S.branch) || '')}</p>
      <span class="tv-big"><b>${isToday ? ok + no : ok + no}</b><span>รายการที่คุณตรวจแล้ว${isToday ? 'วันนี้' : 'วันที่ ' + thDate(D, { day: 'numeric', month: 'short' })}${W ? ` · ค้างอีก ${W} รายการ` : ' · ไม่มีค้าง'}</span></span>
    </section>`;
    const tiles = `<div class="tv-tiles">
      <div class="tv-tile"><small>อนุมัติ</small><b>${ok}</b></div>
      <div class="tv-tile"><small>ไม่อนุมัติ</small><b>${no}</b></div>
      <div class="tv-tile"><small>ใบลา · OT · แก้เวลา</small><b>${nOf('ใบลา') + nOf('คำขอ OT') + nOf('แก้เวลา')}</b></div>
      <a class="tv-tile wait" href="${finTodo() && !(P.total || 0) ? '#fin/expflow' : '#approve'}"><small>รออนุมัติตอนนี้</small><b>${W}</b></a>
    </div>`;
    const fi = WI() ? WI().finItems() : [];
    const money = n => '฿' + Number(n || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const fin = fi.length || finTodo() ? `<h3 class="h3">เบิก–เคลียร์ค่าใช้จ่าย ที่รอคุณตรวจ <span class="chip">${finTodo() || fi.length}</span></h3><div class="group">${
      fi.slice(0, 6).map(it => `<a class="row" href="#fin/expflow/${esc(it.id)}"><span class="main"><span class="t">${esc(it.title || 'คำขอเบิก')}</span><span class="s">${esc(it.document_number || '')}${it.created_by_name ? ' · ผู้เบิก ' + esc(it.created_by_name) : ''}</span></span><span class="chip">${esc(money(it.amount))}</span></a>`).join('')
      || `<a class="row" href="#fin/expflow"><span class="main"><span class="t">มีงานรอตรวจ ${finTodo()} รายการ</span><span class="s">เปิดหน้า Finance เพื่อดูรายละเอียด</span></span></a>`}</div>` : '';
    const tasks = typeof myTasks === 'function' ? myTasks() : [];
    const todo = tasks.length ? `<h3 class="h3">งานที่รอคุณ</h3><div class="group">${tasks.join('')}</div>` : '';
    const list = `<div class="h2 tv-bar" id="tvh">สิ่งที่ตรวจไปแล้ว <span class="chip">${L.length}</span><span class="grow"></span>
      <button class="btn sm" data-tv="-1" aria-label="วันก่อนหน้า">‹</button>
      <input type="date" class="field" id="tv-day" value="${D}" max="${T0}" min="${S.windowFrom || addDays(T0, -62)}">
      <button class="btn sm" data-tv="1" aria-label="วันถัดไป"${isToday ? ' disabled' : ''}>›</button>
      ${isToday ? '' : '<button class="btn sm" data-tv="0">วันนี้</button>'}</div>
      <p class="note" style="margin-top:-4px">${isToday ? 'วันนี้' : thDate(D, { weekday: 'long', day: 'numeric', month: 'long' })} · อนุมัติ ${ok} · ไม่อนุมัติ ${no}</p>
      <div class="group">${L.length ? L.map(x => {
      const e = empById(x.r.empId) || {};
      return `<div class="row static">${x.r.empId ? avatar(e) : ''}<span class="main"><span class="t">${x.r.empId ? esc(shortName(e)) + ' · ' : ''}${esc(x.title)}</span><span class="s">${esc(x.kind)}${x.sub ? ' · ' + esc(x.sub) : ''}${x.by ? ' · โดย ' + esc(x.by) : ''}</span></span><span class="chip ${x.status === 'อนุมัติ' ? 'ok' : 'bad'}">${esc(x.status)}</span></div>`;
    }).join('') : `<div class="row static"><span class="main"><span class="t">ยังไม่ได้ตรวจอะไรใน${isToday ? 'วันนี้' : 'วันนั้น'}</span><span class="s">${P.total ? 'มี ' + P.total + ' รายการรออยู่ที่หน้า Approvals' : 'ไม่มีรายการค้าง'}</span></span></div>`}</div>`;
    return hero + tiles + fin + todo + list;
  }

  const m = MODS.find(x => x.key === 'today');
  if (m && !m.__tv) {
    const v0 = m.view, s0 = m.summary; m.__tv = 1;
    m.view = function () { return (S.me && S.me.role === ROLE) ? view() : v0.apply(this, arguments); };
    m.summary = function () {
      if (!(S.me && S.me.role === ROLE)) return s0 ? s0.apply(this, arguments) : '';
      const n = rows(today()).length, p = waiting();
      return `ตรวจแล้ววันนี้ ${n}` + (p ? ` · ค้าง ${p}` : '');
    };
  }
  const repaint = () => { if (typeof App !== 'undefined' && App.render) App.render(); };
  document.addEventListener('click', e => {
    const b = e.target.closest && e.target.closest('[data-tv]'); if (!b) return;
    const k = Number(b.dataset.tv), T0 = today();
    day = k === 0 ? '' : addDays(day || T0, k);
    if (day >= T0) day = '';
    repaint();
  });
  document.addEventListener('change', e => {
    if (e.target.id !== 'tv-day') return;
    day = e.target.value && e.target.value < today() ? e.target.value : '';
    repaint();
  });
})();
