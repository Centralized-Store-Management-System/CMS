/* แอป Owner หน้าแรก: มีแค่ 2 ปุ่ม — จัดการร้าน · ระบบ IT (กติกาเจ้าของ ห้ามเพิ่มปุ่มหน้าแรก)
 * ระบบออเดอร์อยู่ในเมนู Order System · Finance & Accounting อยู่ในเมนูของจัดการร้าน · สาขาอยู่ในเมนูของระบบ IT
 * ไฟล์แยก โหลดท้ายสุด: ตัดปุ่มอื่นที่ไฟล์ไหนก็ตามเติมเข้ามาในหน้าแรก (ไม่แก้ owner.js / order-link.js) */
'use strict';
(function () {
  const keep = el => el.matches('a[href^="index.html"], [data-land="it"]');
  const prune = () => { const m = document.querySelector('.oc-land-menu'); if (m) [...m.children].forEach(el => { if (!keep(el)) el.remove(); }); };
  if (typeof ocLanding === 'function') { const l0 = ocLanding; window.ocLanding = ocLanding = function () { const r = l0.apply(this, arguments); prune(); return r; }; }
  new MutationObserver(prune).observe(document.body, { childList: true, subtree: true });
  prune();
})();
