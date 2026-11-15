/* คำขอแลกกะในหลังร้าน (39_ShiftSwap.gs): ส่วน "แลกกะ" ในหน้า Approvals สำหรับผู้มีสิทธิ์แก้ตารางงาน
 * อนุมัติ → ตารางงานของทั้งสองคนสลับให้เอง (ฝั่ง Google) · ตารางถูกแก้ไปก่อน → ระบบไม่ให้อนุมัติ */
'use strict';
if (!TABLES.includes('swaps')) TABLES.push('swaps');
const swLbl = c => { if (c === 'OFF') return 'หยุด'; if (/^C:/.test(c || '')) return c.slice(2); const s = (S.t.shifts || []).find(x => String(x.code).toUpperCase() === String(c || '').toUpperCase()); return c ? c + (s ? ' ' + s.start + '–' + s.end : '') : 'เวลาปกติ'; };
function swPending() { return (S.t.swaps || []).filter(r => r.status === 'รออนุมัติ' && inBr(r.branch)); }
function swSectionHTML() {
  const L = swPending();
  if (!L.length || !can('schedule_edit')) return '';
  return `<h3 class="h3" id="sw-sec">แลกกะ <span class="chip warn">${L.length}</span></h3><div class="group">${L.map(r => {
    const a = empById(r.empId) || {}, b = empById(r.withEmpId) || {};
    let rows = []; try { rows = JSON.parse(r.before || '[]'); } catch (e) { /* */ }
    return `<div class="row static">${avatar(a)}<span class="main"><span class="t">${esc(shortName(a))} ↔ ${esc(shortName(b))}${branchChip(r.branch)}</span><span class="s">${rows.map(x => `${esc(thDate(x.d, { weekday: 'short', day: 'numeric', month: 'short' }))}: ${esc(shortName(a))} ${esc(swLbl(x.a))} ↔ ${esc(shortName(b))} ${esc(swLbl(x.b))}`).join('<br>')}${r.reason ? '<br>เหตุผล: ' + esc(r.reason) : ''}</span></span><span class="stack"><button class="btn sm primary" data-swd="${esc(r.id)}/อนุมัติ">อนุมัติ</button><button class="btn sm" data-swd="${esc(r.id)}/ไม่อนุมัติ">ไม่อนุมัติ</button></span></div>`;
  }).join('')}</div>`;
}
function swInject() {
  if (!S.me || !S.route || S.route.mod !== 'approve' || document.getElementById('sw-sec')) return;
  const h = swSectionHTML(), v = document.getElementById('view');
  if (!h || !v) return;
  const box = document.createElement('div'); box.innerHTML = h;
  const hero = [...v.querySelectorAll('h2,h1,.hero b,.big')].find(x => /ไม่มีรายการค้าง/.test(x.textContent));
  if (hero) hero.textContent = 'รออนุมัติ ' + swPending().length + ' รายการ';
  const first = v.querySelector('h3.h3');
  if (first) first.before(...box.childNodes); else v.append(...box.childNodes);
}
document.addEventListener('click', async e => {
  const b = e.target.closest && e.target.closest('[data-swd]');
  if (!b) return;
  const [id, status] = b.dataset.swd.split('/');
  try {
    await busy(b, () => DB.upsertMany('swaps', [{ id, status }]), '…');
    toast(status === 'อนุมัติ' ? 'อนุมัติแลกกะแล้ว ตารางงานเปลี่ยนให้แล้ว' : 'ไม่อนุมัติคำขอแลกกะแล้ว');
    if (status === 'อนุมัติ' && typeof bootstrap === 'function') { try { await bootstrap(); } catch (x) { /* รอบอัปเดตถัดไป */ } }
    App.render();
  } catch (err) { toast(err.message); App.render(); }
});
(function wait() {
  if (typeof App === 'undefined' || !App.render) return setTimeout(wait, 0);
  const r = App.render.bind(App);
  App.render = function () { const out = r.apply(this, arguments); try { swInject(); } catch (e) { /* ไม่ให้กระทบหน้าอื่น */ } return out; };
})();
