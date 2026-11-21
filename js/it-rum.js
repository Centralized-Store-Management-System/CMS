/* Super Advance IT: วัดเวลาที่หน้าเว็บรอจริงของแต่ละคำสั่ง (เฉพาะที่ช้าเกิน 3 วินาที) ส่งให้ Owner Console ดู
 * ส่งรวบเป็นชุดทุก 60 วินาทีแบบไม่ต้องรอผล (ไม่ทำให้หน้าเว็บช้าลง) + ลิงก์ Owner Console สำหรับ Owner/ผู้มีสิทธิ์ */
'use strict';
const RUM = { q: [], slow: 3000, hid: 0 };
document.addEventListener('visibilitychange', () => { if (document.hidden) RUM.hid++; });
(function () {
  const call = API.call;
  API.call = async function (action, params = {}) {
    const t0 = performance.now(), h0 = RUM.hid;
    // ระหว่างรอ ถ้าจอดับ/สลับแอป (มือถือพักการทำงาน) ไม่นับ — เวลาที่ได้ไม่ใช่ความช้าจริงของระบบ
    const add = ok => { if (RUM.hid === h0 && !document.hidden) rumAdd(action, performance.now() - t0, ok); };
    try { const r = await call.call(API, action, params); add(true); return r; }
    catch (e) { add(false); throw e; }
  };
})();
function rumAdd(a, ms, ok) { if (a === 'auth2' || a === 'it' || a === 'login') return; if (ms >= RUM.slow || !ok) RUM.q.push({ a, ms: Math.round(ms), ok }); if (RUM.q.length > 40) RUM.q.shift(); }
setInterval(() => {
  if (!RUM.q.length || !S.token || S.demo) return;
  const items = RUM.q.splice(0, 20);
  try { API.post({ op: 'itBeacon', t: S.token, items }).catch(() => {}); } catch (e) { /* */ }
}, 60000);
document.addEventListener('visibilitychange', () => { if (document.hidden && RUM.q.length && S.token && !S.demo) { try { API.post({ op: 'itBeacon', t: S.token, items: RUM.q.splice(0, 20) }).catch(() => {}); } catch (e) { /* */ } } });
// ลิงก์ Owner Console ใต้ชื่อผู้ใช้ (เฉพาะ Owner / ผู้มีสิทธิ์ Super Advance IT)
new MutationObserver(() => {
  const ub = document.getElementById('userbox');
  if (!ub || ub.querySelector('[data-oclink]') || !S.me || !(S.me.role === 'owner' || (S.me.perms || []).includes('it'))) return;
  const a = document.createElement('a'); a.className = 'btn sm'; a.href = 'owner.html'; a.dataset.oclink = '1'; a.textContent = '🛠 Owner Console'; a.style.marginTop = '6px';
  ub.appendChild(a);
}).observe(document.documentElement, { childList: true, subtree: true });
