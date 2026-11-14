/* ความเร็ว (คู่กับ apps-script/16_Speed.gs)
 * ตอนเปิดระบบ Apps Script ส่งตารางงาน เวลาทำงาน สต็อก ยอดขาย รายจ่าย มาเฉพาะตั้งแต่ต้นเดือนก่อน (S.win) ระบบจึงเปิดเร็วแม้ใช้มาหลายปี
 * เลือกเดือนที่เก่ากว่านั้น หน้าเว็บโหลดเดือนนั้นมาเพิ่มเอง ครั้งเดียวต่อเดือน
 * แถวที่โหลดมาทีหลังติด _h ไว้ ยอดคงเหลือสต็อกจะไม่นับซ้ำ (ยอดก่อนช่วงนี้มากับ S.stockOpen แล้ว) */
function needMonth(m) { return !!(S.win && /^\d{4}-\d{2}$/.test(m || '') && m < S.win.slice(0, 7) && S.hist[m] !== true); }
async function ensureMonth(m) {
  if (!needMonth(m)) return false;
  if (!S.hist[m]) {
    S.hist[m] = API.call('history', { t: S.token, m }).then(r => {
      Object.entries((r && r.tables) || {}).forEach(([t, rows]) => {
        const arr = S.t[t]; if (!arr) return;
        const have = new Set(arr.map(x => x.id));
        rows.forEach(x => { if (!have.has(x.id)) { x._h = 1; arr.push(x); } });
      });
      S.hist[m] = true; S.rev++;
    }, e => { delete S.hist[m]; throw e; });
  }
  await S.hist[m];
  return true;
}
/** เปลี่ยนเดือนที่ดู: เดือนเก่าแสดง "กำลังโหลด" ระหว่างดึงข้อมูล */
async function goMonth(m) {
  S.month = m; S.f.pending = {};
  if (needMonth(m)) {
    const v = $('#view'); if (v) v.innerHTML = `<p class="loading">กำลังโหลดข้อมูล${esc(thMonth(m))}…</p>`;
    try { await ensureMonth(m); } catch (e) { toast(e.message); }
  }
  App.render();
}
