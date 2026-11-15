/* พนักงานทำทุกอย่างได้จากหน้าเว็บหลังร้าน ไม่ต้องไปหน้าอื่น / ไม่ต้องใส่ PIN ซ้ำ (เข้าระบบแล้ว)
 * ปุ่ม/ลิงก์ "ลงเวลา / ขอลา" (Today, เมนู My Workspace) → เปิดหน้าต่างซ้อน: ลงเวลา ขอ OT ลา แก้เวลา ตาราง สรุปเดือน
 * ทำรายการเสร็จ → ข้อมูลหน้า Today/ตารางงานอัปเดตทันที (live.js) และแจ้ง LINE ตามปกติ (ใบรับคำขอ/การ์ดถึงผู้อนุมัติ) */
'use strict';
const MYCLK = { el: null };
function myClockOpen(href) {
  if (!S.token || !S.me || !S.me.empId || S.demo) return false;
  const u = new URL(href, location.href), q = u.searchParams;
  q.set('embed', '1');
  myClockClose(true);
  const wrap = document.createElement('div');
  wrap.className = 'myclk'; wrap.setAttribute('role', 'dialog'); wrap.setAttribute('aria-modal', 'true'); wrap.setAttribute('aria-label', 'ลงเวลาและคำขอของฉัน');
  wrap.innerHTML = `<div class="myclk-box"><div class="myclk-bar"><b>ลงเวลา · คำขอของฉัน</b><button type="button" class="btn sm" data-myclk="x" aria-label="ปิด">ปิด ✕</button></div><iframe title="ลงเวลาและคำขอของฉัน" allow="geolocation; camera" src="${u.pathname.split('/').pop()}?${q.toString()}#t=${encodeURIComponent(S.token)}"></iframe></div>`;
  wrap.addEventListener('click', ev => { if (ev.target === wrap || ev.target.closest('[data-myclk="x"]')) myClockClose(); });
  document.body.appendChild(wrap); document.body.classList.add('myclk-on');
  MYCLK.el = wrap;
  return true;
}
function myClockClose(silent) {
  if (!MYCLK.el) return;
  MYCLK.el.remove(); MYCLK.el = null; document.body.classList.remove('myclk-on');
  if (!silent && typeof LIVE !== 'undefined') { LIVE.last = 0; LIVE.dirty = false; App.render(); }
}
// ดักลิงก์ไปหน้าลงเวลาทุกจุดในหลังร้าน
document.addEventListener('click', ev => {
  const a = ev.target.closest && ev.target.closest('a[href^="clock.html"]');
  if (!a || ev.ctrlKey || ev.metaKey || ev.shiftKey) return;
  if (myClockOpen(a.getAttribute('href'))) ev.preventDefault();
}, true);
document.addEventListener('keydown', ev => { if (ev.key === 'Escape' && MYCLK.el) myClockClose(); });
window.addEventListener('message', ev => {
  if (ev.origin !== location.origin || !ev.data || !ev.data.amz) return;
  const d = ev.data;
  if (d.amz === 'changed' && typeof LIVE !== 'undefined') { LIVE.last = 0; if (typeof liveTick === 'function') liveTick(); }
  if (d.amz === 'close') {
    myClockClose();
    if (d.expired) { toast(d.note || 'หมดเวลาการใช้งาน เข้าสู่ระบบใหม่'); if (typeof logout === 'function') logout(); }
    else if (d.note) toast(d.note);
  }
});
(function () {
  const st = document.createElement('style');
  st.textContent = '.myclk{position:fixed;inset:0;z-index:300;background:rgba(15,25,20,.45);display:flex;align-items:center;justify-content:center;padding:16px}' +
    '.myclk-box{background:var(--bg,#F3F5F2);width:min(520px,100%);height:min(860px,100%);border-radius:18px;overflow:hidden;display:flex;flex-direction:column;box-shadow:0 20px 60px rgba(0,0,0,.25)}' +
    '.myclk-bar{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:10px 12px 10px 16px;background:var(--card,#fff);border-bottom:1px solid var(--line,#e3e7e4)}' +
    '.myclk iframe{flex:1;border:0;width:100%;background:transparent}body.myclk-on{overflow:hidden}' +
    '@media (max-width:600px){.myclk{padding:0}.myclk-box{width:100%;height:100%;border-radius:0}}';
  document.head.appendChild(st);
})();
