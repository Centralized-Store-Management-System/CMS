/* เมนู Finance & Accounting ในเว็บหลังร้าน (index.html) — ไฟล์แยก ไม่แก้ app.js
 * แสดงเฉพาะผู้ที่มีสิทธิ์ใน Finance: ถาม Finance API (action=session) ครั้งเดียวต่อการเข้าสู่ระบบ แล้วจำผลใน sessionStorage
 * Owner ของ CMS มีสิทธิ์เสมอ · ผู้ใช้อื่นต้องให้ Owner เพิ่มที่ Finance › ตั้งค่า › ผู้ใช้งาน Finance */
'use strict';
(function () {
  if (typeof renderNav !== 'function' || typeof viewMenu !== 'function') return;
  const API = 'https://ytxbnqosenolojifeikf.supabase.co/functions/v1/finance-api';
  const KEY = 'amz.fin.access', HREF = 'modules/finance/finance.html';
  const tag = () => String((typeof S !== 'undefined' && S.token) || '').slice(-12);
  const read = () => { try { const v = JSON.parse(sessionStorage.getItem(KEY) || 'null'); return v && v.t === tag() ? v.ok : null; } catch (_) { return null; } };
  let busy = false;
  async function check() {
    if (busy || typeof S === 'undefined' || !S.token || S.demo || read() !== null) return;
    busy = true;
    try {
      const r = await fetch(API + '?action=session', { headers: { 'x-cms-session': S.token }, cache: 'no-store' });
      const j = await r.json().catch(() => ({}));
      if (r.status === 200 || r.status === 403) {   // 401/5xx = ยังไม่แน่ใจ ไว้ถามใหม่รอบหน้า
        sessionStorage.setItem(KEY, JSON.stringify({ t: tag(), ok: r.ok && !!j.ok }));
        if (r.ok && j.ok) addNav();
      }
    } catch (_) { /* ออฟไลน์: ลองใหม่ครั้งหน้า */ } finally { busy = false; }
  }
  const ic = () => (typeof icon === 'function' ? icon('acct') : '');
  function addNav() {
    if (read() !== true) return;
    const nav = document.getElementById('nav');
    if (nav && !nav.querySelector('[data-fin]')) nav.insertAdjacentHTML('beforeend', `<h4>Finance</h4><a href="${HREF}" data-fin="1"><span class="ic">${ic()}</span>Finance &amp; Accounting</a>`);
  }
  const r0 = renderNav;
  window.renderNav = renderNav = function () { const r = r0.apply(this, arguments); addNav(); check(); return r; };
  const v0 = viewMenu;
  window.viewMenu = viewMenu = function () {
    let h = v0.apply(this, arguments);
    if (read() === true) {
      const tile = `<h3 class="h3">Finance</h3><div class="tiles"><a class="tile" href="${HREF}" data-fin="1"><span class="mi">${ic()}</span><span><b>Finance &amp; Accounting</b><span>รายรับ รายจ่าย ภาษี บัญชี รายงาน</span></span></a></div>`;
      h = h.includes('<h3 class="h3">My Account</h3>') ? h.replace('<h3 class="h3">My Account</h3>', tile + '<h3 class="h3">My Account</h3>') : h + tile;
    }
    return h;
  };
})();
