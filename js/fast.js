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
/* ---------- เปิดซ้ำทันที ---------- */
const BOOT_KEY = 'amz.boot';
function rememberBoot(d) { try { sessionStorage.setItem(BOOT_KEY, JSON.stringify({ tok: S.token, at: Date.now(), d })); } catch (e) { /* ใหญ่เกินก็ข้าม */ } }
function cachedBoot() {
  try { const c = JSON.parse(sessionStorage.getItem(BOOT_KEY) || 'null'); return c && c.tok === S.token && Date.now() - c.at < 6 * 3600e3 ? c.d : null; } catch (e) { return null; }
}
function forgetBoot() { try { sessionStorage.removeItem(BOOT_KEY); } catch (e) { /* */ } }
