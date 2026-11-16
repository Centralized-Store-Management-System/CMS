/* หน้าจอใน LINE (LIFF / ลิงก์ในการ์ด LINE) เท่านั้น — แสดงเฉพาะเรื่องที่กดมาจากเมนู LINE · แอป / เว็บ / คอม ไม่เปลี่ยน
 * - ลงเวลา (ค่าเริ่มต้น): ปุ่มใหญ่ "เข้างาน" กับ "ออกงาน" กดแล้วปุ่มทึบพร้อมเวลา + บันทึกของวันนี้
 * - ขอลา / ขอ OT / แจ้งแก้เวลา / แลกกะ / ตารางของฉัน: แสดงเฉพาะหน้านั้น (แบบฟอร์ม + คำขอของฉัน)
 * - สรุปเดือนนี้: ย้ายไปดูในแอป (ข้อมูลเยอะ โหลดช้าใน LINE)
 * - เร็วขึ้น: หน้าลงเวลาใช้ข้อมูลย่อของวันนี้อย่างเดียว ไม่โหลดข้อมูลทั้งเดือนตามหลัง */
'use strict';
(function () {
  if (typeof viewMe !== 'function' || typeof C === 'undefined') return;
  const inLine = () => !!(C.liff || (typeof LFX !== 'undefined' && LFX.inLine));
  const focus = () => (typeof LFX !== 'undefined' && LFX.focus) || 'clock';
  const TITLE = { leave: 'ขอลา', ot: 'ขอ OT', fix: 'แจ้งแก้เวลา', swap: 'แลกกะ', days: 'ตารางของฉัน', month: 'สรุปเดือนนี้' };

  const st = document.createElement('style');
  st.textContent = [
    '.lv-hi{display:flex;align-items:flex-end;justify-content:space-between;gap:10px;margin:6px 0 12px}.lv-hi b{font:600 20px var(--display);display:block}.lv-hi span{color:var(--muted);font-size:13px}',
    '.lv-plan{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin:0 0 14px;font-size:14px}',
    '.lv-btns{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:4px 0 10px}',
    '.lv-btn{min-height:128px;border-radius:20px;border:2px solid var(--line);background:var(--surface,#fff);color:var(--muted);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;font:600 22px var(--display);cursor:pointer;-webkit-tap-highlight-color:transparent;transition:transform .1s}',
    '.lv-btn small{font:500 13px var(--font);opacity:.9}.lv-btn:active{transform:scale(.97)}',
    '.lv-btn.go-in{background:#1D7A4E;border-color:#1D7A4E;color:#fff;box-shadow:0 8px 22px rgba(29,122,78,.35)}',
    '.lv-btn.go-out{background:#9A4B1E;border-color:#9A4B1E;color:#fff;box-shadow:0 8px 22px rgba(154,75,30,.3)}',
    '.lv-btn.done{background:#33443B;border-color:#33443B;color:#fff;opacity:.92;cursor:default}',
    '.lv-btn.wait{opacity:.45;cursor:default}',
    '.lv-btn[disabled]{pointer-events:none}',
    '.lv-rec .row .v{font:600 16px var(--display)}',
    '.lv-more{display:flex;justify-content:center;margin:18px 0 6px}'
  ].join('');
  document.head.appendChild(st);

  function hi() {
    const m = C.my, p = m.plan, lv = m.days && m.days[0] && m.days[0].leave;
    return `<div class="lv-hi"><div><b>สวัสดี ${esc(m.emp.name)}</b><span>${thDate(m.today, { weekday: 'long', day: 'numeric', month: 'short' })}</span></div><button class="btn sm" data-a="lvClose">ปิด</button></div>
      <div class="lv-plan"><span class="chip">${esc(planText(p))}</span>${multi() && !p.off ? `<span class="chip">${esc(brName(p.branch || m.homeBranch))}</span>` : ''}${p.pubHoliday ? `<span class="chip warn">${esc(p.pubHoliday)}</span>` : ''}${lv ? `<span class="chip ${statusText[lv.status] || ''}">${esc(lv.type)} ${esc(lv.status)}</span>` : ''}</div>`;
  }
  function clockView() {
    const m = C.my, p = m.plan, s = m.state, tb = brOf(p.branch || m.homeBranch) || {}, r = C.result;
    const recIn = s === 'in' ? m.open : s === 'done' ? m.todayRec : null, recOut = s === 'done' ? m.todayRec : null;
    const off = tb.allowLine === false;
    let h = '';
    if (r) h += `<p class="status ${r.ok ? 'good' : 'bad'}" role="status">${r.msg}</p>`;
    if (off && s !== 'done') h += `<p class="status" role="note">สาขา ${esc(tb.name || '')} ลงเวลาด้วย<b>เครื่องสแกนนิ้ว</b>ที่ร้าน</p>`;
    const bIn = s === 'out' && !off ? `<button class="lv-btn go-in" data-a="clock:in">เข้างาน<small>แตะเมื่อถึงร้าน</small></button>`
      : `<button class="lv-btn ${recIn ? 'done' : 'wait'}" disabled>${recIn ? '✓ เข้างานแล้ว' : 'เข้างาน'}<small>${recIn ? esc(recIn.inTime) + ' น.' + (recIn.date && recIn.date !== m.today ? ' (เมื่อวาน)' : '') : ''}</small></button>`;
    const bOut = s === 'in' && !off ? `<button class="lv-btn go-out" data-a="clock:out">ออกงาน<small>แตะก่อนกลับ</small></button>`
      : `<button class="lv-btn ${recOut ? 'done' : 'wait'}" disabled>${recOut ? '✓ ออกงานแล้ว' : 'ออกงาน'}<small>${recOut ? esc(recOut.outTime) + ' น.' : s === 'out' ? 'เข้างานก่อน' : ''}</small></button>`;
    h += `<div class="lv-btns">${bIn}${bOut}</div>`;
    if (s !== 'done' && !off) {
      if (tb.requireSelfie) h += `<div class="selfie-box"><button type="button" class="btn" data-a="cam">${C.selfie ? 'ถ่ายใหม่' : 'ถ่ายรูปยืนยันตัวตน'}</button><input id="ck-cam" type="file" accept="image/*" capture="user" class="vh" data-selfie="1" tabindex="-1" aria-hidden="true">${C.selfie ? `<img src="${C.selfie}" alt="รูปที่ถ่าย">` : '<span class="muted">ต้องถ่ายรูปก่อนกดลงเวลา</span>'}</div>`;
      if (S.demo) h += `<div class="field check" style="margin-top:10px"><input type="checkbox" id="ck-inside"${C.inside ? ' checked' : ''}><label for="ck-inside">ทดลอง: สมมุติว่าอยู่ในร้าน (โหมดทดลองเท่านั้น)</label></div>`;
      h += `<p class="status" id="ck-msg">${p.off && s === 'out' ? 'วันนี้เป็นวันหยุดตามตาราง ถ้ามาทำงาน ระบบจะส่งให้ผู้มีสิทธิ์อนุมัติ' : `ระบบตรวจ GPS ว่าอยู่ในรัศมี ${tb.radius || 80} เมตรของร้าน`}</p>`;
    }
    const rows = [];
    rows.push(['เข้างาน', recIn ? esc(recIn.inTime) : '–', recIn ? (num(recIn.lateMin) ? `<span class="chip warn">สาย ${recIn.lateMin} นาที</span>` : '<span class="chip ok">ตรงเวลา</span>') : '']);
    rows.push(['ออกงาน', recOut ? esc(recOut.outTime) : '–', '']);
    if (recOut && num(recOut.workMin)) rows.push(['ทำงาน', hrsShort(recOut.workMin), '']);
    if (recOut && num(recOut.otMin)) rows.push(['OT', recOut.otMin + ' นาที', `<span class="chip ${statusText[recOut.otStatus] || 'warn'}">${esc(recOut.otStatus || 'รออนุมัติ')}</span>`]);
    h += `<h3 class="h3">บันทึกวันนี้</h3><div class="group lv-rec">${rows.map(([k, v, c]) => `<div class="row static"><span class="main"><span class="t">${k}</span>${c ? `<span class="chips">${c}</span>` : ''}</span><span class="v">${v}</span></div>`).join('')}</div>`;
    return h;
  }
  function monthView() {
    return `<div class="group pad" style="text-align:center"><p style="margin:6px 0 12px">ประวัติลงเวลาทั้งเดือน สาย และ OT ดูในแอปพนักงาน (ข้อมูลเยอะ เปิดในแอปเร็วกว่า)</p><button class="btn primary" data-a="lvApp">เปิดแอปพนักงาน</button></div>`;
  }
  function lineView() {
    const f = focus();
    let h = `<div class="clock-shell">${header()}${hi()}`;
    if (f === 'clock') h += clockView();
    else {
      if (C.result) h += `<p class="status ${C.result.ok ? 'good' : 'bad'}" role="status">${C.result.msg}</p>`;
      h += `<h3 class="h2" style="margin:4px 0 10px">${TITLE[f] || ''}</h3>`;
      h += f === 'month' ? monthView() : ({ days: tabDays, ot: tabOT, leave: tabLeave, fix: tabFix, swap: typeof tabSwap === 'function' ? tabSwap : tabDays }[f] || tabDays)();
      if (C.my.lite && f !== 'days' && f !== 'month') h += '<p class="loading" style="margin-top:8px">กำลังโหลดรายการของฉัน…</p>';
    }
    return h + '</div>';
  }

  const vm0 = viewMe;
  viewMe = function () { return inLine() && C.my ? lineView() : vm0(); };
  // ลงเวลาใน LINE ใช้ข้อมูลย่อของวันนี้พอ: ไม่โหลดข้อมูลทั้งเดือนตามหลัง (เร็วขึ้น ไม่แย่งคิว Google)
  if (typeof loadFull === 'function') { const lf0 = loadFull; loadFull = function () { if (inLine() && focus() === 'clock') return Promise.resolve(); return lf0.apply(this, arguments); }; }
  document.addEventListener('click', e => {
    const a = e.target.closest('[data-a="lvClose"],[data-a="lvApp"]'); if (!a) return;
    e.preventDefault(); e.stopPropagation();
    if (a.dataset.a === 'lvClose') { try { if (window.liff && liff.closeWindow) return liff.closeWindow(); } catch (x) { /* */ } return window.close(); }
    const url = location.href.split('?')[0].split('#')[0];
    try { if (window.liff && liff.openWindow) return liff.openWindow({ url, external: true }); } catch (x) { /* */ }
    window.open(url, '_blank');
  }, true);
})();
