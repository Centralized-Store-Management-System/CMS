/* Approvals > ประวัติการอนุมัติ (Activity): ใครอนุมัติ/ไม่อนุมัติอะไร วันไหน — เริ่มที่วันนี้ เลือกวันย้อนหลังได้
 * ใช้ข้อมูลที่โหลดอยู่ในเครื่องแล้ว (ไม่ดึงเพิ่ม) · เห็นเฉพาะสาขาที่ดูแล ตามสิทธิ์เดียวกับหน้าอนุมัติ
 * ไฟล์แยก: ต่อท้ายหน้า Approvals (mod-approve.js) โดยไม่แก้ไฟล์เดิม */
'use strict';
(function () {
  let day = '';   // วันที่เลือก (ว่าง = วันนี้)
  const DONE = ['อนุมัติ', 'ไม่อนุมัติ'];
  const pad = n => String(n).padStart(2, '0');
  const localDay = iso => { if (!iso) return ''; const d = new Date(iso); return isNaN(d) ? String(iso).slice(0, 10) : d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
  const hm = iso => { const d = new Date(iso); return isNaN(d) ? '' : pad(d.getHours()) + ':' + pad(d.getMinutes()); };
  const empIn = r => inBr((empById(r.empId) || {}).branch);
  const dd = d => d ? thDate(d, { day: 'numeric', month: 'short' }) : '';

  /** รายการที่ตัดสินแล้วในวันที่เลือก */
  function items(D) {
    const T = can('approve_time'), out = [];
    const add = (kind, r, status, at, by, title, sub) => { if (DONE.includes(status) && localDay(at) === D) out.push({ kind, r, status, at, by: by || '', title, sub }); };
    if (T) {
      (S.t.leaves || []).filter(empIn).forEach(l => add('ใบลา', l, l.status, l.decidedAt, l.decidedBy, `${l.type || 'ลา'} ${num(l.days) || ''} วัน`.trim(), dd(l.dateFrom) + (l.dateTo && l.dateTo !== l.dateFrom ? ' – ' + dd(l.dateTo) : '')));
      (S.t.otreq || []).filter(empIn).forEach(r => add('คำขอ OT', r, r.status, r.decidedAt, r.decidedBy, `OT ${r.otOk !== '' && r.otOk != null && r.status === 'อนุมัติ' ? num(r.otOk) + '/' : ''}${num(r.minutes)} นาที`, dd(r.date) + ' ' + (r.startTime || '') + (r.endTime ? '–' + r.endTime : '')));
      (S.t.timefix || []).filter(empIn).forEach(f => add('แก้เวลา', f, f.status, f.decidedAt, f.decidedBy, 'แก้เวลา' + (f.inTime ? ' เข้า ' + f.inTime : '') + (f.outTime ? ' ออก ' + f.outTime : ''), dd(f.date)));
      (S.t.attendance || []).filter(a => attInBr(a)).forEach(a => {
        if (num(a.otMin) > 0) add('OT', a, a.otStatus, a.updatedAt, a.decidedBy, `OT ${num(a.otMin)} นาที`, dd(a.date) + ' ออก ' + (a.outTime || '-'));
        if (a.offWork === 'true') add('ทำงานวันหยุด', a, a.offStatus, a.updatedAt, a.decidedBy, 'ทำงานในวันหยุดของตัวเอง', dd(a.date));
      });
    }
    if (can('approve_stock')) (S.t.moves || []).filter(m => inBr(m.branch)).forEach(m => { const it = (typeof itemById === 'function' && itemById(m.itemId)) || {}; add('ปรับสต็อก', m, m.status, m.updatedAt, m.decidedBy, `${it.name || 'สินค้า'} ${num(m.qty) > 0 ? '+' : ''}${num(m.qty)}`, m.type || ''); });
    if (can('schedule_edit') || T) (S.t.swaps || []).filter(r => inBr(r.branch)).forEach(r => { const b = empById(r.withEmpId) || {}; add('แลกกะ', r, r.status, r.decidedAt, r.decidedBy, 'แลกกะกับ ' + shortName(b), String(r.dates || '').split(',').map(dd).join(', ')); });
    return out.sort((a, b) => String(b.at).localeCompare(String(a.at)));
  }

  function html() {
    const T0 = today(), D = day || T0, L = items(D), ok = L.filter(x => x.status === 'อนุมัติ').length;
    const from = (S.windowFrom || addDays(T0, -62));
    return `<div class="h2" id="aph" style="margin-top:28px">ประวัติการอนุมัติ <span class="chip">${L.length}</span><span class="spacer"></span>
      <button class="btn sm" data-aph="-1" aria-label="วันก่อนหน้า">‹</button>
      <input type="date" class="field" id="aph-day" value="${D}" max="${T0}" min="${from}" style="width:auto;margin:0 4px">
      <button class="btn sm" data-aph="1" aria-label="วันถัดไป"${D >= T0 ? ' disabled' : ''}>›</button>
      ${D !== T0 ? '<button class="btn sm" data-aph="0">วันนี้</button>' : ''}</div>
      <p class="note" style="margin-top:-4px">${D === T0 ? 'วันนี้' : thDate(D, { weekday: 'long', day: 'numeric', month: 'long' })} · อนุมัติ ${ok} · ไม่อนุมัติ ${L.length - ok}</p>
      <div class="group">${L.length ? L.map(x => { const e = empById(x.r.empId) || {}; return `<div class="row static">${x.r.empId ? avatar(e) : ''}<span class="main"><span class="t">${x.r.empId ? esc(shortName(e)) + ', ' : ''}${esc(x.title)} <span class="chip">${esc(x.kind)}</span></span><span class="s">${esc(x.sub || '')}${x.by ? ' · โดย ' + esc(x.by) : ''}${hm(x.at) ? ' · ' + hm(x.at) : ''}</span></span><span class="chip ${x.status === 'อนุมัติ' ? 'ok' : 'bad'}">${x.status}</span></div>`; }).join('') : `<p class="empty">ไม่มีการอนุมัติ${D === T0 ? 'วันนี้' : 'ในวันนี้'}</p>`}</div>`;
  }

  const m = (typeof MODS !== 'undefined') && MODS.find(x => x.key === 'approve');
  if (m) { const v0 = m.view; m.view = function () { return v0.apply(this, arguments) + html(); }; }
  const repaint = () => { const a = document.getElementById('aph'); if (!a) return App.render(); const box = document.createElement('div'); box.innerHTML = html(); let n = a; const old = [n, n.nextElementSibling, n.nextElementSibling && n.nextElementSibling.nextElementSibling]; old[0].replaceWith(...box.childNodes); old.slice(1).forEach(x => x && x.remove()); };
  document.addEventListener('click', e => {
    const b = e.target.closest && e.target.closest('[data-aph]'); if (!b) return;
    const k = Number(b.dataset.aph), T0 = today();
    day = k === 0 ? '' : addDays(day || T0, k); if (day >= T0) day = '';
    repaint();
  });
  document.addEventListener('change', e => { if (e.target.id === 'aph-day') { day = e.target.value && e.target.value < today() ? e.target.value : ''; repaint(); } });
})();
