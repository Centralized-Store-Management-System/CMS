/* Freeze ข้อมูลรายเดือน (คู่กับ apps-script/17_Freeze.gs) แท็บใน System Admin
 * ปิดเดือนที่จบแล้ว: ย้ายไปคลังข้อมูลรายปี แก้ไม่ได้อีก ระบบเร็วเท่าเดิมแม้ใช้หลายปี */
const FZ_TAB = { attendance: 'ลงเวลา', schedule: 'ตารางงาน', moves: 'สต็อก', sales: 'ยอดขาย', expenses: 'รายจ่าย', log: 'Audit log', notify: 'LINE' };
async function loadFreeze(force) {
  if (S.f.fzLoading || (S.f.fz && !force)) return;
  S.f.fzLoading = true;
  try { S.f.fz = await API.call('freezeStatus', { t: S.token }); } catch (e) { S.f.fzErr = e.message; }
  S.f.fzLoading = false;
  if (S.route && S.route.sub === 'freeze') App.render();
}
function pFreeze() {
  const z = S.f.fz, own = can('settings');
  if (!z) { loadFreeze(); return S.f.fzErr ? `<p class="note bad">${esc(S.f.fzErr)}</p>` : '<p class="loading">กำลังตรวจสถานะ…</p>'; }
  const frozenN = z.periods.filter(p => p.status === 'frozen').length, hotRows = z.hot.reduce((a, x) => a + x.rows, 0);
  let h = `<div class="kpis"><div class="kpi"><b>${esc(z.lastFrozen || '–')}</b><span>Freeze ถึงเดือน</span></div><div class="kpi"><b>${frozenN}</b><span>เดือนที่ Freeze แล้ว</span></div><div class="kpi"><b>${fmt(hotRows)}</b><span>แถวในชีตที่ใช้งาน</span></div><div class="kpi"><b>${z.archives.length}</b><span>ไฟล์คลังข้อมูล</span></div></div>`;
  h += `<p class="note">Freeze = ปิดเดือนที่จบแล้ว ข้อมูลเดือนนั้นย้ายไปไฟล์ "คลังข้อมูล" รายปี (เปิดดูใน Google Sheet ได้) แก้/ลบไม่ได้อีก หน้าเว็บยังเลือกดูเดือนนั้นได้ตามปกติ ระบบจึงเร็วเท่าเดิมเสมอ Freeze ได้ถึง <b>${esc(z.maxFreezable)}</b> (เดือนนี้และเดือนก่อนยังแก้ได้) ต้องเรียงจากเดือนเก่าไปใหม่</p>`;
  const n = z.next;
  if (n) {
    const cnt = Object.entries(n.counts || {}).filter(([, v]) => v).map(([k, v]) => `${FZ_TAB[k] || k} ${fmt(v)}`).join(' · ');
    h += `<h3 class="h3">เดือนถัดไปที่ Freeze ได้</h3><div class="group pad"><div class="fz-month"><b style="font-size:18px">${esc(n.month)}</b>${n.resume ? '<span class="chip warn">ค้างกลางทาง กด Freeze เพื่อทำต่อ</span>' : ''}<span class="muted">${esc(cnt || 'ไม่มีข้อมูล')}</span></div>
      ${n.errors.length ? `<div class="note bad">ต้องจัดการก่อน: ${n.errors.map(esc).join(' / ')}</div>` : ''}
      ${n.warns.length ? `<div class="note warn">คำเตือน: ${n.warns.map(esc).join(' / ')}</div>` : ''}
      ${own ? `<div class="actions" style="margin-bottom:0">${n.warns.length && !n.resume ? `<label class="chk"><input type="checkbox" id="fz-force"> ยืนยัน Freeze แม้มีคำเตือน</label>` : ''}<span class="grow"></span><button class="btn primary" data-a="fzGo:${esc(n.month)}"${n.errors.length ? ' disabled' : ''}>Freeze ${esc(n.month)}</button></div>` : '<p class="note">Freeze ได้เฉพาะ Owner</p>'}</div>`;
  } else h += `<div class="group pad">ยังไม่มีเดือนที่ Freeze ได้ (Freeze ได้เมื่อเดือนนั้นจบไปแล้วอย่างน้อย 1 เดือนเต็ม)</div>`;
  if (z.periods.length) {
    const last = z.periods[z.periods.length - 1];
    h += `<h3 class="h3">เดือนที่ Freeze แล้ว</h3><div class="group">${z.periods.slice().reverse().map(p => `<div class="row static"><span class="main"><span class="t">${esc(p.month)} ${p.status === 'frozen' ? '<span class="chip ok">Freeze แล้ว</span>' : `<span class="chip warn">${esc(p.status)}</span>`}</span><span class="s">${esc(p.by || '')}${p.frozenAt ? ' · ' + esc(String(p.frozenAt).slice(0, 16).replace('T', ' ')) : ''} · ${Object.entries(p.counts || {}).filter(([, v]) => v).map(([k, v]) => `${FZ_TAB[k] || k} ${fmt(v)}`).join(' · ')}</span></span>${own && p === last ? `<button class="btn sm" data-a="fzUndo:${esc(p.month)}">Unfreeze</button>` : ''}</div>`).join('')}</div>`;
  }
  if (z.openMonths.length) h += `<h3 class="h3">เดือนที่ยังไม่ Freeze</h3><div class="group">${z.openMonths.map(o => statRow(esc(o.month), fmt(o.rows) + ' แถว', o.month <= z.maxFreezable ? 'Freeze ได้แล้ว' : 'ยังแก้ไขได้')).join('')}</div>`;
  h += `<h3 class="h3">Freeze อัตโนมัติ</h3><div class="group pad"><div class="fz-month"><span class="main">ทุกวันที่ 5 ตี 2 ระบบ Freeze เดือนที่พร้อมให้เอง (ข้ามเดือนที่มีคำเตือน เช่น ยังไม่ปิดงวดเงินเดือน แล้วบันทึกเหตุผลใน Audit log)</span>${own ? `<button class="btn${z.auto ? '' : ' primary'}" data-a="fzAuto:${z.auto ? 0 : 1}">${z.auto ? 'ปิด' : 'เปิด'} Freeze อัตโนมัติ</button>` : `<span class="chip">${z.auto ? 'เปิด' : 'ปิด'}</span>`}</div></div>`;
  h += `<h3 class="h3">พื้นที่เก็บข้อมูล</h3><div class="group">${z.hot.map(x => statRow(esc(x.tab), fmt(x.rows) + ' แถว', 'ชีตที่ใช้งานทุกวัน')).join('')}${z.archives.map(a => `<div class="row static"><span class="main"><span class="t"><a href="${esc(a.url)}" target="_blank" rel="noopener">คลังข้อมูล ${esc(a.year)}${a.part > 1 ? ' ส่วนที่ ' + a.part : ''}</a></span><span class="s">${(a.cells / 1e6).toFixed(2)} / 10 ล้านเซลล์ (ขึ้นไฟล์ใหม่อัตโนมัติที่ ${(z.maxCells / 1e6).toFixed(0)} ล้าน)</span><div class="fz-bar"><i style="width:${Math.min(100, a.cells / 1e5).toFixed(1)}%"></i></div></span></div>`).join('')}</div>
  <div class="actions"><button class="btn" data-a="fzReload">ตรวจใหม่</button></div>`;
  return h;
}
const FREEZE_ACTS = {
  fzReload: async (a, b) => { await busy(b, () => loadFreeze(true), '…'); App.render(); },
  fzGo: async (m, b) => {
    if (!b.dataset.armed) return armed(b, () => FREEZE_ACTS.fzGo(m, b), `แตะอีกครั้ง: Freeze ${m} (แก้ไม่ได้อีก)`);
    const force = !!($('#fz-force') || {}).checked;
    const r = await busy(b, () => API.write({ op: 'freeze', month: m, force }), 'กำลัง Freeze…');
    toast(`Freeze ${m} แล้ว: ` + Object.entries(r.counts || {}).filter(([, v]) => v).map(([k, v]) => `${FZ_TAB[k] || k} ${v}`).join(', '));
    S.f.fz = null; await bootstrap(); App.render();
  },
  fzUndo: async (m, b) => {
    if (!b.dataset.armed) return armed(b, () => FREEZE_ACTS.fzUndo(m, b), `แตะอีกครั้งเพื่อ Unfreeze ${m}`);
    await busy(b, () => API.write({ op: 'unfreeze', month: m }), '…');
    toast(`Unfreeze ${m} แล้ว แก้ไขได้อีกครั้ง`); S.f.fz = null; await bootstrap(); App.render();
  },
  fzAuto: async (on, b) => { await busy(b, () => API.write({ op: 'freezeAuto', on: on === '1' }), '…'); S.f.fz = null; App.render(); }
};
/** เดือนที่ Freeze แล้ว (ดูอย่างเดียว) */
const frozenMonth = m => !!(S.frozen && m && String(m).slice(0, 7) <= S.frozen);
