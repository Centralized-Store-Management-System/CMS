/* หน้าลงเวลาเมื่อเปิดจาก LINE (LIFF / ลิงก์ในการ์ด LINE)
 * - ไม่มีปุ่ม Back Office และไม่มีหน้าใส่รหัส/PIN (LINE ยืนยันตัวตนให้แล้ว) — หมดเวลาก็เข้าใหม่ด้วย LINE เอง
 * - แสดงเฉพาะรายการที่กดมาจากเมนู LINE: ลงเวลา / ขอลา / ขอ OT / แจ้งแก้เวลา / แลกกะ / ตารางของฉัน / เดือนนี้
 *   (เปิดโดยไม่ระบุรายการ = แสดงหน้าเต็มเหมือนเดิม แต่ไม่มี Back Office) */
'use strict';
const LFX = {
  inLine: /\bLine\//i.test(navigator.userAgent) || new URLSearchParams(location.search).has('liff') || new URLSearchParams(location.search).has('liff.state'),
  focus: null, titles: { clock: 'ลงเวลาเข้า-ออกงาน', leave: 'ขอลา', ot: 'ขอ OT', fix: 'แจ้งแก้เวลา', swap: 'แลกกะ', days: 'ตารางของฉัน', month: 'สรุปเดือนนี้' }
};
(function () {
  const q = new URLSearchParams(location.search);
  let t = q.get('tab');
  if (!t && q.get('liff.state')) { try { t = new URLSearchParams(decodeURIComponent(q.get('liff.state')).split('?')[1] || '').get('tab'); } catch (e) { /* */ } }
  if (t && LFX.titles[t]) LFX.focus = t;
  if (LFX.inLine) document.documentElement.classList.add('in-line');
  const st = document.createElement('style');
  st.textContent = 'html.in-line .clock-top a[href="index.html"]{display:none!important}';
  document.head.appendChild(st);
})();
const lfxLine = () => LFX.inLine || C.liff || C.via === 'line';
function lfxApply() {
  if (!lfxLine()) return;
  const root = document.getElementById('root'); if (!root) return;
  root.querySelectorAll('.clock-top a[href="index.html"]').forEach(a => a.remove());
  // ไม่มีหน้าใส่รหัสใน LINE: หมดเวลา/ออกจากระบบ → เข้าใหม่ด้วย LINE
  if ((C.step === 'who' || C.step === 'pin') && C.liff) {
    let n = 0; try { n = Number(sessionStorage.getItem('lfx.re') || 0); } catch (e) { /* */ }
    if (n < 2) {
      try { sessionStorage.setItem('lfx.re', String(n + 1)); } catch (e) { /* */ }
      if (typeof lfForget === 'function') lfForget();
      root.innerHTML = '<p class="loading">กำลังเข้าสู่ระบบด้วย LINE…</p>';
      setTimeout(() => location.reload(), 200);
    } else root.innerHTML = '<div class="clock-shell"><p class="status bad" style="margin-top:24px">เข้าสู่ระบบด้วย LINE ไม่สำเร็จ ปิดหน้านี้แล้วกดเมนูใน LINE อีกครั้ง</p></div>';
    return;
  }
  if (C.step !== 'me') return;
  try { sessionStorage.removeItem('lfx.re'); } catch (e) { /* */ }
  const f = LFX.focus; if (!f) return;
  const shell = root.querySelector('.clock-shell'), nav = shell && shell.querySelector('nav.tabs');
  if (!shell || !nav) return;
  if (f === 'clock') {
    let x = nav.nextSibling; while (x) { const n = x.nextSibling; x.remove(); x = n; }
    nav.remove();
  } else {
    const keep = new Set([shell.querySelector('.clock-top'), shell.querySelector('h2.h2'), ...shell.querySelectorAll('p[role="status"]')]);
    let x = shell.firstChild;
    while (x && x !== nav) { const n = x.nextSibling; if (!keep.has(x) && !(x.querySelector && [...keep].some(k => k && x.contains(k)))) x.remove(); x = n; }
    nav.outerHTML = `<h3 class="h2" style="margin:14px 0 6px">${LFX.titles[f]}</h3>`;
    const gr = shell.querySelector('p.status.good'); if (gr && /เข้าจาก LINE/.test(gr.textContent)) gr.remove();
  }
}
(function () {
  const r0 = window.render;
  window.render = function () { const out = r0.apply(this, arguments); try { lfxApply(); } catch (e) { /* ไม่ให้กระทบหน้า */ } return out; };
  // ให้แท็บตรงกับรายการที่กดมา (เช่น ?tab=swap)
  const em = window.enterMe;
  if (em) window.enterMe = function (r, tab) { const out = em.apply(this, arguments); if (LFX.focus && LFX.focus !== 'clock' && C.tab !== LFX.focus) { C.tab = LFX.focus; window.render(); } return out; };
})();
