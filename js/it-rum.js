/* Super Advance IT · Authentication & Real User Monitoring
 * เก็บเฉพาะชื่อขั้นตอน, เวลา, success/fail และ device class — ไม่เก็บ PIN, token, username หรือข้อมูลลูกค้า
 * ส่งเป็น batch เบื้องหลังทุก 60 วินาที ไม่ block UI
 */
'use strict';
const RUM = { q: [], slow: 3000, hid: 0, started: performance.now() };
document.addEventListener('visibilitychange', () => { if (document.hidden) RUM.hid++; });
(function () {
  const call = API.call, AUTH = ['login', 'auth2', 'devUnlock', 'devReg'];   // ขั้นตอนเข้าระบบ: บันทึกทุกครั้ง ไม่ใช่เฉพาะครั้งที่ช้า
  API.call = async function (action, params = {}) {
    const t0 = performance.now(), h0 = RUM.hid;
    // ระหว่างรอ ถ้าจอดับ/สลับแอป (มือถือพักการทำงาน) ไม่นับ — เวลาที่ได้ไม่ใช่ความช้าจริงของระบบ
    const add = ok => { if (RUM.hid === h0 && !document.hidden) rumAdd(action, performance.now() - t0, ok, AUTH.includes(action)); };
    try { const r = await call.call(API, action, params); add(true); return r; }
    catch (e) { add(false); throw e; }
  };
})();
function rumAdd(action, ms, ok, force = false) {
  if (!force && ms < RUM.slow && ok) return;
  RUM.q.push({ a: String(action).slice(0, 48), ms: Math.max(0, Math.round(ms)), ok: !!ok });
  if (RUM.q.length > 80) RUM.q.shift();
}
window.addEventListener('amz:auth-performance', e => {
  const d = e.detail || {};
  if (typeof d.stage === 'string' && Number.isFinite(d.ms)) rumAdd('auth:' + d.stage, d.ms, d.ok !== false, true);
});
(function recordPageTiming() {
  const send = () => {
    const n = performance.getEntriesByType('navigation')[0];
    if (n) {
      rumAdd('page:dom_ready', n.domContentLoadedEventEnd - n.startTime, true, true);
      rumAdd('page:load', n.loadEventEnd - n.startTime, true, true);
    }
  };
  if (document.readyState === 'complete') setTimeout(send, 0);
  else window.addEventListener('load', () => setTimeout(send, 0), { once: true });
})();
function rumFlush() {
  if (!RUM.q.length || !S.token || S.demo) return;
  const items = RUM.q.splice(0, 30);
  try { API.post({ op: 'itBeacon', t: S.token, items }).catch(() => { RUM.q.unshift(...items); }); }
  catch (_) { RUM.q.unshift(...items); }
}
setInterval(rumFlush, 60000);
document.addEventListener('visibilitychange', () => { if (document.hidden) rumFlush(); });
// ลิงก์ Owner Console ใต้ชื่อผู้ใช้ (เฉพาะ Owner / ผู้มีสิทธิ์ Super Advance IT)
new MutationObserver(() => {
  const ub = document.getElementById('userbox');
  if (!ub || ub.querySelector('[data-oclink]') || !S.me || !(S.me.role === 'owner' || (S.me.perms || []).includes('it'))) return;
  const a = document.createElement('a'); a.className = 'btn sm'; a.href = 'owner.html'; a.dataset.oclink = '1'; a.textContent = '🛠 Owner Console'; a.style.marginTop = '6px';
  ub.appendChild(a);
}).observe(document.documentElement, { childList: true, subtree: true });
