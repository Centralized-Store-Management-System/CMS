/* โหลดหน้าเว็บให้เร็วขึ้น (35_FastLoad.gs) — ไม่เปลี่ยนข้อมูลหรือการทำงานของระบบ
 * 1) ขอข้อมูลแบบย่อ (ชื่อคอลัมน์ครั้งเดียว) แล้วคลายกลับเป็นแถวเหมือนเดิมก่อนส่งให้ระบบใช้
 * 2) เปิดซ้ำ/F5: ขึ้นจากข้อมูลที่จำไว้ทันที แล้วถามเฉพาะตารางที่เปลี่ยน (ไม่โหลดทั้งระบบใหม่)
 *    พนักงาน สาขา ตั้งค่า สิทธิ์ เดือน หรือ Freeze เปลี่ยน → โหลดใหม่ทั้งหมดเหมือนเดิม */
'use strict';
const FL = { pack: new Set(['bootstrap', 'login', 'delta', 'resume', 'history']), last: null };

function flUnpackRows(x) {
  if (!x || x._pk !== 1 || !Array.isArray(x.k) || !Array.isArray(x.r)) return x;
  const k = x.k, n = k.length;
  return x.r.map(a => { const o = {}; for (let i = 0; i < n; i++) if (a[i] !== null && a[i] !== undefined) o[k[i]] = a[i]; return o; });
}
function flUnpackTables(t) { if (t) Object.keys(t).forEach(n => { t[n] = flUnpackRows(t[n]); }); return t; }
function flUnpack(d) {
  if (!d || typeof d !== 'object') return d;
  if (d.tables) flUnpackTables(d.tables);
  if (d.boot && d.boot.tables) flUnpackTables(d.boot.tables);
  if (d.users) d.users = flUnpackRows(d.users);
  if (d.log) d.log = flUnpackRows(d.log);
  return d;
}
(function () {
  const call = API.call;
  API.call = async function (action, params = {}) {
    const pk = FL.pack.has(action);
    const r = await call.call(API, action, pk ? { ...params, pk: '1' } : params);
    if (!pk || !r) return r;
    flUnpack(r);
    if (action === 'bootstrap' && r.fl) FL.last = r.fl;
    if (action === 'login' && r.boot && r.boot.fl) FL.last = r.boot.fl;
    return r;
  };
})();
/** live.js ใช้หลังโหลดใหม่: รู้เลขเวอร์ชันทันที ไม่ต้องเสียรอบถามก่อน */
function flVersAfterBoot(pre) {
  const fl = pre ? (pre._cached ? null : pre.fl) : FL.last;
  return (fl && fl.vers) || null;
}

/** เปิดซ้ำ: c = ข้อมูลที่จำไว้ (แสดงอยู่แล้ว) */
async function fastResume(c) {
  const fl = c && c.fl;
  if (!fl || !fl.vers) return bootstrap();
  const r = await API.call('resume', { t: S.token, vers: JSON.stringify(fl.vers), uv: fl.uv || '', lv: fl.lv || '' });
  if (!r || r.full || r.window !== c.window || (r.frozen || '') !== (c.frozen || '') || JSON.stringify(r.me) !== JSON.stringify(c.me)) return bootstrap();
  c.tables = c.tables || {};
  Object.keys(r.tables || {}).forEach(t => { S.t[t] = r.tables[t]; c.tables[t] = r.tables[t]; });
  if (r.users) { S.t.users = r.users; c.tables.users = r.users; }
  if (r.log) { S.t.log = r.log; c.tables.log = r.log; }
  if (r.stockOpening) { S.stockOpen = r.stockOpening; c.stockOpening = r.stockOpening; }
  c.fl = { vers: r.vers, uv: r.uv !== undefined ? r.uv : fl.uv, lv: r.lv !== undefined ? r.lv : fl.lv };
  if (typeof rememberBoot === 'function') rememberBoot(c);
  if (typeof LIVE !== 'undefined') { LIVE.vers = r.vers; LIVE.last = Date.now(); }
  S.rev++;
}
