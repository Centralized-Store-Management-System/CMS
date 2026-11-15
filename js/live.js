/* อัปเดตหลังร้านแบบเกือบเรียลไทม์ (32_LiveSync.gs) — แทนการซิงก์ทุก 20 วินาทีเดิม
 * - ถามทุก 5 วินาที (สลับไปแท็บอื่น: ทุก 15 วินาที) ได้เฉพาะตารางที่เปลี่ยน ไม่โหลดทั้งระบบใหม่
 *   คำขอใหม่จาก LINE / อนุมัติจากการ์ด LINE / ผู้ใช้อื่นบันทึก → ขึ้นในหน้าเว็บภายในไม่กี่วินาที + เสียงแจ้งเตือน (alert.js)
 * - กดอนุมัติ/ไม่อนุมัติ: รายการหายทันที และไม่เด้งกลับมาแม้ข้อมูลรอบเก่าจาก Google มาถึงทีหลัง
 * - กำลังกรอกฟอร์มอยู่: รอให้ปิดฟอร์มก่อนค่อยวาดหน้าใหม่ */
'use strict';
const LIVE = { on: true, vers: null, busy: false, fast: 5000, slow: 15000, last: 0, dirty: false, ov: [] };

/* ---------- ค่าที่เพิ่งบันทึก: กันข้อมูลรอบเก่าทับ ---------- */
function liveOverlay(t0) {
  const now = Date.now();
  LIVE.ov = LIVE.ov.filter(o => !o.doneAt || now - o.doneAt < 60000);
  LIVE.ov.forEach(o => { if (!o.doneAt || o.doneAt > t0) o.rows.forEach(r => DB.local(o.table, r)); });
}
(function () {
  const up = DB.upsertMany.bind(DB);
  DB.upsertMany = async function (table, rows) {
    const o = { table, rows: (rows || []).filter(r => r && r.id).map(r => ({ ...r })), doneAt: 0 };
    if (o.rows.length) LIVE.ov.push(o);
    try { const res = await up(table, rows); o.doneAt = Date.now(); return res; }
    catch (e) { LIVE.ov = LIVE.ov.filter(x => x !== o); throw e; }
  };
  const ob = window.bootstrap;
  window.bootstrap = async function () {
    const t0 = Date.now(), r = await ob.apply(this, arguments);
    liveOverlay(t0); LIVE.vers = null; LIVE.last = 0;
    return r;
  };
})();

/* ---------- รวมข้อมูลที่เปลี่ยน ---------- */
const liveDateOf = r => String(r.date || r.dateFrom || r.month || '');
function liveMerge(t, rows) {
  const ids = new Set(rows.map(r => r.id));
  const keep = (S.t[t] || []).filter(r => !ids.has(r.id) && S.win && liveDateOf(r) && liveDateOf(r) < S.win);   // ข้อมูลเดือนเก่าที่โหลดเพิ่มไว้
  S.t[t] = rows.concat(keep);
}
const liveBusyUI = () => !!document.querySelector('.sheet') || !!(document.activeElement && document.activeElement.matches('input,textarea,select'));
function liveRender() {
  if (liveBusyUI()) { LIVE.dirty = true; return; }
  LIVE.dirty = false; App.render();
}

async function liveTick() {
  if (!LIVE.on || !S.token || !S.me || S.demo || LIVE.busy) return;
  if (LIVE.dirty && !liveBusyUI()) liveRender();
  if (Date.now() - LIVE.last < (document.hidden ? LIVE.slow : LIVE.fast) - 300) return;
  LIVE.busy = true; LIVE.last = Date.now();
  const t0 = Date.now();
  try {
    const r = await API.call('delta', { t: S.token, vers: JSON.stringify(LIVE.vers || {}) });
    if (!LIVE.vers) { LIVE.vers = r.vers; return; }
    if (r.full) { await bootstrap(); liveRender(); return; }
    LIVE.vers = r.vers;
    const ts = Object.keys(r.tables || {});
    if (!ts.length) return;
    ts.forEach(t => liveMerge(t, r.tables[t]));
    if (r.stockOpening) S.stockOpen = r.stockOpening;
    liveOverlay(t0); S.rev++;
    if (typeof alertCheck === 'function') { try { alertCheck(); } catch (e) { /* ignore */ } }
    liveRender();
  } catch (e) { /* เน็ตหลุด/หมดเวลาเข้าระบบ: รอบหน้าค่อยลองใหม่ */ }
  finally { LIVE.busy = false; }
}
// ตัวจับเวลาใน Worker: เบราว์เซอร์ไม่หน่วงเวลาเหมือนตัวจับเวลาปกติตอนสลับแท็บ (แจ้งเตือนยังมาตรงเวลา)
(function () {
  try {
    const w = new Worker(URL.createObjectURL(new Blob(['setInterval(function(){postMessage(1)},1000)'], { type: 'text/javascript' })));
    w.onmessage = liveTick;
  } catch (e) { setInterval(liveTick, 1000); }
})();
document.addEventListener('visibilitychange', () => { if (!document.hidden) { LIVE.last = 0; liveTick(); } });
