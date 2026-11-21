/* แอป Owner หน้าแรก: จัดการร้าน · ระบบ IT · Finance & Accounting
 * ระบบออเดอร์ (Live Orders / Web Admin Portal) อยู่ในเมนู Order System ของจัดการร้านแล้ว · สาขาอยู่ในเมนูของระบบ IT
 * ไฟล์แยก โหลดท้ายสุด: ตัดปุ่มอื่นที่ไฟล์ไหนก็ตามเติมเข้ามาในหน้าแรก (ไม่แก้ owner.js / order-link.js) */
'use strict';
(function () {
  const keep = el => el.matches('a[href^="index.html"], a[href="modules/finance/finance.html"], [data-land="it"]');
  const ensureFinance = menu => {
    if (!menu || menu.querySelector('a[href="modules/finance/finance.html"]')) return;
    const base = menu.querySelector('a[href^="index.html"]');
    const link = base ? base.cloneNode(true) : document.createElement('a');
    link.href = 'modules/finance/finance.html';
    link.removeAttribute('data-land');
    link.setAttribute('aria-label', 'Finance & Accounting');
    link.textContent = 'Finance & Accounting';
    link.style.display = 'flex';
    link.style.alignItems = 'center';
    link.style.gap = '8px';
    menu.appendChild(link);
  };
  const prune = () => {
    const m = document.querySelector('.oc-land-menu');
    if (!m) return;
    [...m.children].forEach(el => { if (!keep(el)) el.remove(); });
    ensureFinance(m);
  };
  if (typeof ocLanding === 'function') { const l0 = ocLanding; window.ocLanding = ocLanding = function () { const r = l0.apply(this, arguments); prune(); return r; }; }
  new MutationObserver(prune).observe(document.body, { childList: true, subtree: true });
  prune();
})();
