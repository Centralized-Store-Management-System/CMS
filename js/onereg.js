/* ลงทะเบียน LINE สำเร็จ → แสดงชื่อผู้ใช้ + PIN เข้าเว็บทันที (44_OneReg.gs) — ส่งเข้าแชต LINE ด้วย */
function oneRegShow(w) {
  if (!w || !w.username || typeof openSheet !== 'function') return;
  const e = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const sh = openSheet(`<h2 style="margin:0 0 6px">🔐 เข้าระบบผ่านเว็บ</h2>
    <p class="muted" style="margin:0 0 12px">ลงทะเบียนครั้งเดียว ใช้ได้ทั้ง LINE และเว็บ · ส่งข้อมูลนี้เข้าแชต LINE ให้แล้ว</p>
    <div class="group"><div class="row static"><span class="main"><span class="s">ชื่อผู้ใช้</span><span class="t" style="font-size:18px">${e(w.username)}</span></span></div>
    ${w.code && w.code !== w.username ? `<div class="row static"><span class="main"><span class="s">หรือใช้รหัสพนักงาน</span><span class="t">${e(w.code)}</span></span></div>` : ''}
    <div class="row static"><span class="main"><span class="s">PIN</span><span class="t" style="font-size:26px;letter-spacing:6px">${w.pin ? e(w.pin) : '<span style="font-size:15px;letter-spacing:0">ใช้ PIN เดิมของคุณ</span>'}</span></span></div></div>
    <p class="note">${w.pin ? 'จำ PIN ไว้ (Owner ไม่เห็น) เปลี่ยนเองได้ที่ "บัญชีของฉัน" · ' : ''}ลืม PIN พิมพ์ "ลืม PIN" ในแชต LINE · เปิดจาก LINE ไม่ต้องใช้ PIN</p>
    <div class="actions"><span class="grow"></span><button class="btn primary" data-or-close>เข้าใจแล้ว</button></div>`);
  if (sh) sh.querySelector('[data-or-close]').addEventListener('click', () => closeSheet());
}
