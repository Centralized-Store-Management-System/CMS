/* แอปมีเวอร์ชันใหม่ → แจ้งให้แตะอัปเดต (ทุกแอป: หลังร้าน / Owner / พนักงาน · มือถือ / PC / เว็บ)
 * - แอปที่เปิดค้างไว้ (สลับแอปไปมา) ไม่โหลดหน้าใหม่เอง จึงยังเป็นเวอร์ชันเก่าแม้ deploy แล้ว
 * - ตรวจเมื่อกลับมาที่แอป (ซ่อนไว้ ≥ 30 วิ) และทุก 10 นาทีขณะเปิดอยู่: ขอหน้า html ล่าสุด (เช็ค ETag เบามาก)
 *   เทียบไฟล์ js/css ?v= กับที่หน้านี้โหลดอยู่ ถ้าต่าง → แถบ "มีเวอร์ชันใหม่ · แตะเพื่ออัปเดต"
 * - ไม่โหลดหน้าใหม่เอง (กันข้อมูลที่กรอกค้างหาย) · สั่งให้ sw.js ตรวจรุ่นใหม่ด้วย */
(function () {
  'use strict';
  if (window.__amzUpd) return; window.__amzUpd = 1;
  const MIN_HIDDEN = 30000, EVERY = 600000;
  let hiddenAt = 0, last = 0, shown = false, busy = false;
  const mine = () => {
    const s = new Set();
    document.querySelectorAll('script[src], link[rel="stylesheet"][href]').forEach(el => { const u = el.getAttribute('src') || el.getAttribute('href'); if (/^(js|css)\/[^?]+\?v=/.test(u)) s.add(u); });
    return s;
  };
  async function check() {
    if (busy || shown || !navigator.onLine) return;
    busy = true; last = Date.now();
    try {
      try { const r = navigator.serviceWorker && await navigator.serviceWorker.getRegistration(); if (r) r.update().catch(() => {}); } catch (e) { /* */ }
      const res = await fetch(location.pathname, { cache: 'no-cache', credentials: 'same-origin' });
      if (!res.ok) return;
      const html = await res.text(), now = mine();
      if (!now.size) return;
      const want = [...html.matchAll(/(?:src|href)="((?:js|css)\/[^"?]+\?v=[^"]+)"/g)].map(m => m[1]);
      if (want.length && want.some(u => !now.has(u))) bar();
    } catch (e) { /* เน็ตหลุด: ไว้ตรวจรอบหน้า */ } finally { busy = false; }
  }
  function bar() {
    shown = true;
    const st = document.createElement('style');
    st.textContent = '.amz-upd{position:fixed;left:50%;top:calc(env(safe-area-inset-top,0px) + 10px);transform:translateX(-50%);z-index:9999;display:flex;align-items:center;gap:10px;max-width:calc(100vw - 24px);padding:9px 10px 9px 16px;border-radius:999px;background:#0b5a3f;color:#fff;font-size:14px;font-weight:600;white-space:nowrap;box-shadow:0 8px 24px rgba(0,0,0,.18);cursor:pointer;-webkit-tap-highlight-color:transparent}'
      + '.amz-upd b{background:#fff;color:#0b5a3f;border-radius:999px;padding:5px 12px;font-size:13px;white-space:nowrap}.amz-upd i{font-style:normal;opacity:.75;padding:0 4px;font-size:18px;line-height:1}';
    document.head.appendChild(st);
    const b = document.createElement('div'); b.className = 'amz-upd'; b.setAttribute('role', 'button');
    b.innerHTML = '<span>มีเวอร์ชันใหม่</span><b>แตะเพื่ออัปเดต</b><i aria-label="ปิด">×</i>';
    b.addEventListener('click', e => { if (e.target.tagName === 'I') { b.remove(); return; } location.reload(); });
    document.body.appendChild(b);
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { hiddenAt = Date.now(); return; }
    if (hiddenAt && Date.now() - hiddenAt >= MIN_HIDDEN) check();
  });
  setInterval(() => { if (!document.hidden && Date.now() - last >= EVERY) check(); }, 60000);
  window.AMZ_UPDATE_CHECK = check;
})();
