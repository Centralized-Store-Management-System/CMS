/* กระดิ่งแจ้งเตือน "งานที่รอคุณ" — รวมงานค้างจาก 2 ระบบไว้ที่เดียว แสดงทุกหน้าจอ
 * 1) งานอนุมัติหลังร้าน (ใบลา OT แก้เวลา ปรับสต็อก คนไม่มาตามตาราง) — อ่านจากข้อมูลที่โหลดไว้แล้ว ไม่เรียกเซิร์ฟเวอร์เพิ่ม
 * 2) งานเบิก–เคลียร์ค่าใช้จ่าย (โมดูล Finance) — ถาม finance-api ครั้งเดียวแล้วจำไว้ 60 วิ ไม่ต้องเปิดหน้า Finance ก่อน
 *    คนที่ไม่มีสิทธิ์ Finance จะถูกปิดถามอัตโนมัติ ไม่รบกวนเซิร์ฟเวอร์ซ้ำ
 * ใช้ร่วมกับ js/today-verifier.js (ใช้ตัวเลขชุดเดียวกัน จะได้ไม่ขัดกัน) ผ่าน window.WorkInbox
 * ไม่แก้ app.js / mod-approve.js / finance-embed.js */
'use strict';
(function () {
  if (typeof S !== 'object' || typeof API !== 'object') return;
  const FIN_API = (typeof AMZ_API === 'string' ? AMZ_API : '').replace(/\/[^/]+$/, '/finance-api');
  const FRESH = 60e3;
  const F = { at: 0, items: [], todo: 0, off: false, busy: null };   // off = บัญชีนี้ไม่มีสิทธิ์ Finance
  const esc2 = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

  async function finFetch(force) {
    if (F.off || !FIN_API || !S.token || S.demo) return F;
    if (!force && Date.now() - F.at < FRESH) return F;
    if (F.busy) return F.busy;
    F.busy = (async () => {
      try {
        const r = await fetch(FIN_API + '?action=expense-flow&tab=todo', { headers: { 'x-cms-session': S.token, accept: 'application/json' }, cache: 'no-store' });
        const j = await r.json().catch(() => ({}));
        if (r.status === 401 || r.status === 403) { F.off = true; F.items = []; F.todo = 0; }
        else if (r.ok && j.ok && j.data) { F.items = (j.data.items || []).filter(x => x.my_action); F.todo = Number((j.data.counts || {}).todo || F.items.length) || 0; }
      } catch (_) { /* เน็ตสะดุด: ใช้ค่าเดิมไปก่อน ไม่ต้องรบกวนผู้ใช้ */ }
      F.at = Date.now(); F.busy = null;
      return F;
    })();
    return F.busy;
  }

  const cms = () => { try { return typeof approvals === 'function' ? approvals() : { total: 0 }; } catch (_) { return { total: 0 }; } };
  const total = () => (cms().total || 0) + (F.todo || 0);

  window.WorkInbox = {
    total, finTodo: () => F.todo || 0, finItems: () => F.items.slice(),
    /** โหลดใหม่แล้ววาดจอ — เรียกหลังทำ Action เช่นอนุมัติ */
    refresh: async (force = true) => { await finFetch(force); paint(); if (typeof App !== 'undefined' && App.render) App.render(); }
  };

  // ---------- กระดิ่งบนแถบหัว ----------
  const st = document.createElement('style');
  st.textContent = [
    '#wi-bell{position:relative;display:inline-grid;place-items:center;width:38px;height:38px;border-radius:50%;border:0;background:transparent;cursor:pointer;color:inherit;-webkit-tap-highlight-color:transparent}',
    '#wi-bell:hover{background:rgba(0,0,0,.06)}#wi-bell svg{width:21px;height:21px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}',
    '#wi-bell b{position:absolute;top:2px;right:0;min-width:17px;height:17px;padding:0 4px;border-radius:9px;background:#C0392B;color:#fff;font:700 11px/17px system-ui,sans-serif;text-align:center}',
    '#wi-bell.none b{display:none}',
    '.wi-row{display:flex;align-items:center;gap:10px;padding:11px 2px;border-bottom:1px solid var(--line,#e4ece7);text-decoration:none;color:inherit}',
    '.wi-row:last-child{border-bottom:0}.wi-row .m{flex:1;min-width:0}.wi-row .t{display:block;font-weight:600}',
    '.wi-row .s{display:block;font-size:12.5px;color:var(--muted,#5c7268);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.wi-row .n{font:700 15px/1 var(--display,inherit);color:#9A6B00;background:rgba(231,184,75,.16);border-radius:9px;padding:6px 9px}'
  ].join('');
  document.head.appendChild(st);

  const BELL = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 8.5a6 6 0 1 0-12 0c0 6-2 7.5-2 7.5h16s-2-1.5-2-7.5Z"/><path d="M13.7 20a2 2 0 0 1-3.4 0"/></svg>';

  /** วาดเลขบนกระดิ่ง — เขียน DOM เฉพาะตอนค่าเปลี่ยนจริง ไม่งั้น MutationObserver ด้านล่างจะเรียกตัวเองวนไม่รู้จบ */
  let shown = -1;
  function paint() {
    const b = document.getElementById('wi-bell');
    if (!b) { shown = -1; return; }
    const n = total();
    if (n === shown) return;
    shown = n;
    b.classList.toggle('none', !n);
    b.querySelector('b').textContent = n > 99 ? '99+' : String(n);
    b.setAttribute('aria-label', n ? `งานที่รอคุณ ${n} รายการ` : 'ไม่มีงานค้าง');
  }
  function put() {
    const tools = document.querySelector('.topbar .tools');
    if (!tools || document.getElementById('wi-bell')) return paint();
    if (!S.me) return;
    tools.insertAdjacentHTML('afterbegin', `<button type="button" id="wi-bell" class="none" title="งานที่รอคุณ">${BELL}<b></b></button>`);
    paint();
    finFetch().then(paint);
  }

  function open() {
    const A = cms(), rows = [];
    const go = (href, t, s, n) => `<a class="wi-row" href="${href}" data-wi-go><span class="m"><span class="t">${esc2(t)}</span><span class="s">${esc2(s)}</span></span><span class="n">${n}</span></a>`;
    const add = (list, t, s) => { if (list && list.length) rows.push(go('#approve', t, s, list.length)); };
    add(A.L, 'ใบลา', 'รออนุมัติในหน้า Approvals');
    add(A.OTR, 'คำขอ OT', 'พนักงานยื่นขอ OT');
    add(A.OT, 'OT จากเวลาทำงาน', 'รออนุมัติ');
    add(A.FIX, 'ขอแก้เวลา', 'รออนุมัติ');
    add(A.OFF, 'ทำงานวันหยุด', 'รออนุมัติ');
    add(A.MV, 'ปรับสต็อก', 'รออนุมัติ');
    add(A.MISS, 'คนไม่มาตามตาราง', 'ตรวจและบันทึกให้เรียบร้อย');
    F.items.slice(0, 6).forEach(it => rows.push(`<a class="wi-row" href="#fin/expflow/${esc2(it.id)}" data-wi-go><span class="m"><span class="t">${esc2(it.title || 'คำขอเบิก')}</span><span class="s">เบิก–เคลียร์ · ${esc2(it.document_number || '')}${it.created_by_name ? ' · ผู้เบิก ' + esc2(it.created_by_name) : ''}</span></span><span class="n">฿${esc2(Number(it.amount || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))}</span></a>`));
    if (F.todo > F.items.length) rows.push(go('#fin/expflow', 'งานเบิก–เคลียร์อื่น', 'ดูทั้งหมดในหน้า Finance', F.todo - F.items.length));
    openSheet(`<h2 style="margin:0 0 4px">งานที่รอคุณ</h2>
      <p class="muted" style="margin:0 0 10px">รวมงานค้างจากหลังร้านและการเงินไว้ที่เดียว</p>
      ${rows.length ? `<div class="group">${rows.join('')}</div>` : '<div class="group"><div class="row static"><span class="main"><span class="t">ไม่มีงานค้าง 🎉</span><span class="s">ถ้ามีงานใหม่เข้ามา ตัวเลขบนกระดิ่งจะขึ้นเอง</span></span></div></div>'}
      <div class="actions"><button class="btn" data-wi-x>ปิด</button><span class="grow"></span><button class="btn" data-wi-r>โหลดใหม่</button></div>`);
    const sh = document.querySelector('.sheet');
    if (!sh) return;
    sh.querySelector('[data-wi-x]').onclick = () => closeSheet();
    sh.querySelector('[data-wi-r]').onclick = async ev => { await busy(ev.target, () => WorkInbox.refresh(true), 'กำลังโหลด…'); closeSheet(); open(); };
    sh.querySelectorAll('[data-wi-go]').forEach(a => a.addEventListener('click', () => closeSheet()));
  }

  document.addEventListener('click', e => { if (e.target.closest && e.target.closest('#wi-bell')) { e.preventDefault(); finFetch().then(() => { paint(); open(); }); } });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) finFetch().then(paint); });
  let queued = 0;
  const tick = () => { if (queued) return; queued = requestAnimationFrame(() => { queued = 0; put(); }); };   // รวมหลายการเปลี่ยนหน้าจอเป็นรอบเดียว
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', tick) : tick();
  new MutationObserver(tick).observe(document.getElementById('root') || document.body, { childList: true, subtree: true });
})();
