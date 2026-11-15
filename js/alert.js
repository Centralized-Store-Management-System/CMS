/* เสียง + แจ้งเตือนบนเครื่อง เมื่อมีรายการรออนุมัติใหม่ (ใบลา OT คำขอ OT แก้เวลา ทำงานวันหยุด ปรับสต็อก)
 * - ปุ่มกระดิ่งที่แถบบน: กดครั้งแรกเพื่ออนุญาตเสียงและการแจ้งเตือนของเบราว์เซอร์ (เบราว์เซอร์บังคับให้ผู้ใช้กดเอง)
 * - เปิดหน้าหลังร้านค้างไว้ (สลับไปแท็บอื่น/ย่อหน้าต่างได้) ระบบเช็คทุก 15 วินาที มีรายการใหม่: ดังเสียง + เด้งแจ้งเตือน + ตัวเลขบนชื่อแท็บ
 * - ปิดเบราว์เซอร์แล้วจะไม่เด้ง ใช้ LINE แทน (ต้องเปิดการแจ้งเตือนแชตร้านใน LINE) */
'use strict';
const ALERT = { on: true, seen: null, ctx: null, every: 15000, busy: false, base: document.title };
try { ALERT.on = localStorage.getItem('amz.alert') !== 'off'; } catch (e) { /* ใช้ค่าตั้งต้น */ }

function alertCan() { return S.me && typeof approvals === 'function' && (can('approve_time') || can('approve_stock')); }
function alertItems() {
  const A = approvals(), out = [];
  const nm = r => { const e = empById(r.empId) || {}; return e.nickname || e.firstName || ''; };
  A.L.forEach(r => out.push(['L' + r.id, `${nm(r)} ขอ${r.type || 'ลา'} ${r.dateFrom}`]));
  A.OTR.forEach(r => out.push(['R' + r.id, `${nm(r)} ขอ OT ${r.date} ${r.startTime}–${r.endTime}`]));
  A.OT.forEach(r => out.push(['O' + r.id, `${nm(r)} OT ${r.otMin} นาที ${r.date}`]));
  A.OFF.forEach(r => out.push(['F' + r.id, `${nm(r)} ทำงานวันหยุด ${r.date}`]));
  A.FIX.forEach(r => out.push(['X' + r.id, `${nm(r)} ขอแก้เวลา ${r.date}`]));
  A.MV.forEach(r => out.push(['M' + r.id, `ปรับสต็อก ${r.date}`]));
  return out;
}
/** เทียบกับครั้งก่อน มีรายการใหม่ → แจ้ง */
function alertCheck() {
  if (!alertCan()) { document.title = ALERT.base; return; }
  const items = alertItems(), ids = new Set(items.map(x => x[0]));
  document.title = (items.length ? `(${items.length}) ` : '') + ALERT.base;
  if (!ALERT.seen) { ALERT.seen = ids; return; }   // ครั้งแรกหลังเข้าระบบ: จำไว้ ไม่ดัง
  const fresh = items.filter(x => !ALERT.seen.has(x[0]));
  ALERT.seen = ids;
  if (!fresh.length || !ALERT.on) return;
  alertSound();
  alertPop(fresh);
}
function alertSound() {
  try {
    const c = ALERT.ctx || (ALERT.ctx = new (window.AudioContext || window.webkitAudioContext)());
    if (c.state === 'suspended') c.resume();
    [[880, 0], [1320, 0.18], [880, 0.5], [1320, 0.68]].forEach(([f, t]) => {
      const o = c.createOscillator(), g = c.createGain();
      o.type = 'sine'; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, c.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.35, c.currentTime + t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + t + 0.16);
      o.connect(g).connect(c.destination); o.start(c.currentTime + t); o.stop(c.currentTime + t + 0.18);
    });
  } catch (e) { /* เครื่องไม่รองรับเสียง */ }
  try { navigator.vibrate && navigator.vibrate([200, 100, 200]); } catch (e) { /* ignore */ }
}
function alertPop(fresh) {
  const title = `รออนุมัติใหม่ ${fresh.length} รายการ`, body = fresh.slice(0, 4).map(x => x[1]).join('\n') + (fresh.length > 4 ? `\nและอีก ${fresh.length - 4} รายการ` : '');
  if (!document.hidden) toast(title + ': ' + fresh[0][1]);
  try {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    const n = new Notification(title, { body, tag: 'amz-approve', renotify: true });
    n.onclick = () => { window.focus(); location.hash = '#approve'; n.close(); };
  } catch (e) { /* มือถือบางรุ่นต้องติดตั้งเป็นแอปก่อน */ }
}
async function alertToggle() {
  if (!ALERT.on || (('Notification' in window) && Notification.permission === 'default')) {
    ALERT.on = true;
    try { if ('Notification' in window && Notification.permission === 'default') await Notification.requestPermission(); } catch (e) { /* ignore */ }
    alertSound();
    const np = 'Notification' in window ? Notification.permission : 'none';
    toast(np === 'granted' ? 'เปิดเสียงและแจ้งเตือนรายการรออนุมัติแล้ว' : 'เปิดเสียงแล้ว (เบราว์เซอร์นี้ไม่อนุญาตการแจ้งเตือนเด้ง เปิดได้ที่การตั้งค่าเว็บไซต์)');
  } else { ALERT.on = false; toast('ปิดเสียงแจ้งเตือนรายการรออนุมัติแล้ว'); }
  try { localStorage.setItem('amz.alert', ALERT.on ? 'on' : 'off'); } catch (e) { /* ignore */ }
  alertBell();
}
function alertBell() {
  const bar = document.querySelector('.topbar .tools');
  if (!bar) return;
  let b = document.getElementById('tb-bell');
  if (!alertCan()) { if (b) b.remove(); return; }
  if (!b) { b = document.createElement('button'); b.id = 'tb-bell'; b.type = 'button'; b.className = 'bellbtn'; b.onclick = alertToggle; bar.appendChild(b); }
  const ask = ALERT.on && 'Notification' in window && Notification.permission === 'default';
  b.textContent = ALERT.on ? '🔔' : '🔕';
  b.title = ALERT.on ? (ask ? 'แตะเพื่ออนุญาตการแจ้งเตือน' : 'เสียงแจ้งเตือนเปิดอยู่ (แตะเพื่อปิด)') : 'เสียงแจ้งเตือนปิดอยู่ (แตะเพื่อเปิด)';
  b.classList.toggle('ask', ask);
}
// ปลดล็อกเสียง: เบราว์เซอร์ให้เล่นเสียงได้หลังผู้ใช้แตะหน้าเว็บอย่างน้อย 1 ครั้ง
document.addEventListener('pointerdown', () => { try { if (!ALERT.ctx) ALERT.ctx = new (window.AudioContext || window.webkitAudioContext)(); if (ALERT.ctx.state === 'suspended') ALERT.ctx.resume(); } catch (e) { /* ignore */ } }, { once: true });

// เช็คทุกครั้งที่โหลดข้อมูลใหม่ และหลังวาดหน้า (ใส่ปุ่มกระดิ่ง)
(function () {
  const ob = window.bootstrap;
  window.bootstrap = async function () { const r = await ob.apply(this, arguments); try { alertCheck(); } catch (e) { /* ignore */ } return r; };
  const or = App.render.bind(App);
  App.render = function () { const r = or.apply(App, arguments); try { alertBell(); } catch (e) { /* ignore */ } return r; };
})();
// เช็คเบาๆ ทุก 15 วินาที รวมตอนสลับไปแท็บอื่น (sync.js หยุดตอนแท็บซ่อน)
setInterval(async () => {
  if (!ALERT.on || !S.token || S.demo || ALERT.busy || !alertCan()) return;
  if (!document.hidden && SYNC.busy) return;
  ALERT.busy = true;
  try {
    const r = await API.call('sync', { t: S.token });
    if (SYNC.v && r.v !== SYNC.v) {
      SYNC.v = r.v;
      if (document.hidden || (!document.querySelector('.sheet') && !document.activeElement?.matches('input,textarea,select'))) { await bootstrap(); App.render(); }
      else SYNC.pending = true;
    } else if (!SYNC.v) SYNC.v = r.v;
  } catch (e) { /* รอบหน้า */ }
  finally { ALERT.busy = false; }
}, ALERT.every);

(function () {
  const st = document.createElement('style');
  st.textContent = '.topbar .tools:has(.bellbtn){display:flex}.bellbtn{border:1px solid var(--line,#ddd);background:var(--card,#fff);border-radius:999px;width:36px;height:36px;font-size:17px;line-height:1;cursor:pointer;flex:none}.bellbtn.ask{animation:bellpulse 1.4s ease-in-out infinite}@keyframes bellpulse{50%{box-shadow:0 0 0 6px rgba(201,138,30,.25)}}';
  document.head.appendChild(st);
})();
