/* ทำให้รู้สึกเร็ว
 * 1) บันทึกเบื้องหลัง (DB.bg): หน้าจอเปลี่ยนทันที ส่งเข้า Google ตามหลัง ถ้าไม่สำเร็จคืนค่าเดิมและเตือน
 * 2) แถบสถานะการบันทึกมุมจอ (ทุกการบันทึก): กำลังบันทึก… / บันทึกแล้ว / บันทึกไม่สำเร็จ
 * 3) เปิดซ้ำ/รีเฟรชแล้วขึ้นทันทีจากข้อมูลที่จำไว้ในแท็บนี้ แล้วอัปเดตเบื้องหลัง (ปิดแท็บแล้วลบเอง) */
const SaveQ = { n: 0, t: 0 };
function saveState(kind, msg) {
  let el = document.getElementById('gsave');
  if (!el) { el = document.createElement('div'); el.id = 'gsave'; el.className = 'gsave'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
  clearTimeout(SaveQ.t);
  el.className = 'gsave on ' + kind;
  el.textContent = msg;
  if (kind !== 'busy') SaveQ.t = setTimeout(() => { el.className = 'gsave'; }, kind === 'err' ? 6000 : 1800);
}
(function wrapWrite() {
  const orig = API.write.bind(API);
  API.write = async payload => {
    SaveQ.n++; saveState('busy', SaveQ.n > 1 ? `กำลังบันทึก ${SaveQ.n} รายการ…` : 'กำลังบันทึก…');
    try { const r = await orig(payload); SaveQ.n--; saveState(SaveQ.n ? 'busy' : 'ok', SaveQ.n ? `กำลังบันทึก ${SaveQ.n} รายการ…` : 'บันทึกแล้ว'); return r; }
    catch (e) { SaveQ.n--; saveState('err', 'บันทึกไม่สำเร็จ: ' + e.message); throw e; }
  };
})();
/** บันทึกแบบไม่ต้องรอ: ใส่ในหน้าจอก่อน แล้วส่งเบื้องหลัง คืน Promise ของผลจริง (ไม่จำเป็นต้องรอ) */
DB.bg = function (table, rows, onDone) {
  const arr = S.t[table], before = rows.map(r => { r.id = r.id || uid(); const o = arr.find(x => x.id === r.id); return o ? { ...o } : null; });
  rows.forEach(r => DB.local(table, r));
  const p = DB.upsertMany(table, rows).then(res => { if (onDone) onDone(res); App.render(); return res; }, e => {
    rows.forEach((r, i) => { if (before[i]) DB.local(table, before[i]); else S.t[table] = S.t[table].filter(x => x.id !== r.id); });
    S.rev++; App.render(); toast('บันทึกไม่สำเร็จ คืนค่าเดิมแล้ว: ' + e.message);
  });
  return p;
};
/* ---------- บันทึกไม่ต้องรอ สำหรับข้อมูลที่ไม่มีการคำนวณฝั่ง Google (รายจ่าย ยอดขาย สต็อก สินค้า ผู้สมัคร) ----------
 * ปิดฟอร์มทันที หน้าจอเปลี่ยนทันที ส่งเข้า Google เบื้องหลัง (แถบมุมจอบอกสถานะ) ถ้าไม่สำเร็จคืนค่าเดิมและเตือน
 * ข้อมูลที่มีผลต่อเงิน/เวลา (ลงเวลา เงินเดือน ใบลา ตารางงาน พนักงาน) ยังรอผลจริงจาก Google เหมือนเดิม */
const OPTIMISTIC = new Set(['expenses', 'sales', 'moves', 'items', 'applicants']);
(function () {
  const up = DB.upsertMany.bind(DB), rm = DB.remove.bind(DB);
  DB.upsertMany = function (table, rows, opt) {
    if (S.demo || !OPTIMISTIC.has(table) || (opt && opt.wait) || !rows.length) return up(table, rows);
    const arr = S.t[table], before = rows.map(r => { r.id = r.id || uid(); const o = arr.find(x => x.id === r.id); return o ? { ...o } : null; });
    rows.forEach(r => DB.local(table, r));
    up(table, rows.map(r => ({ ...r }))).then(() => { S.rev++; if (!document.querySelector('.sheet')) App.render(); }, e => {
      rows.forEach((r, i) => { if (before[i]) DB.local(table, before[i]); else S.t[table] = S.t[table].filter(x => x.id !== r.id); });
      S.rev++; App.render(); toast('บันทึกไม่สำเร็จ คืนค่าเดิมแล้ว: ' + e.message);
    });
    return Promise.resolve({ rows: rows.map(r => ({ ...r })), pending: true });
  };
  DB.remove = function (table, id) {
    if (S.demo || !OPTIMISTIC.has(table)) return rm(table, id);
    const old = S.t[table].find(r => r.id === id);
    S.t[table] = S.t[table].filter(r => r.id !== id); S.rev++;
    API.write({ op: 'remove', table, id }).catch(e => { if (old) { S.t[table].push(old); S.rev++; App.render(); } toast('ลบไม่สำเร็จ คืนค่าเดิมแล้ว: ' + e.message); });
    return Promise.resolve();
  };
})();
/* ---------- เปิดซ้ำทันที ---------- */
const BOOT_KEY = 'amz.boot';
function rememberBoot(d) { try { sessionStorage.setItem(BOOT_KEY, JSON.stringify({ tok: S.token, at: Date.now(), d })); } catch (e) { /* ใหญ่เกินก็ข้าม */ } }
function cachedBoot() {
  try { const c = JSON.parse(sessionStorage.getItem(BOOT_KEY) || 'null'); return c && c.tok === S.token && Date.now() - c.at < 6 * 3600e3 ? c.d : null; } catch (e) { return null; }
}
function forgetBoot() { try { sessionStorage.removeItem(BOOT_KEY); } catch (e) { /* */ } }
