/* ครบกำหนดภายใน 30 วัน (ทดลองงาน 119 วัน / สัญญาจ้าง / เอกสาร) — การ์ดในหน้า Today สำหรับ Owner และผู้มีสิทธิ์ HR
 * ใช้กฎเดียวกับ 38_DueAlerts.gs (แจ้ง LINE ทุกเช้า 08:00) · อ่านอย่างเดียว */
'use strict';
function dueItemsWeb() {
  const T = today(), out = [];
  const diff = d => Math.round((new Date(d + 'T00:00:00Z') - new Date(T + 'T00:00:00Z')) / 864e5);
  S.t.employees.filter(e => e.status !== 'ลาออก' && inBr(e.branch)).forEach(e => {
    const add = (kind, date, label) => { if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date || ''))) return; const days = diff(date); if (days <= 30 && days >= -60) out.push({ e, kind, date, days, label }); };
    if (e.status === 'ทดลองงาน' && e.probationEnd) add('probation', e.probationEnd, 'ครบทดลองงาน');   // ไม่ได้ตั้งวันเอง: หน้า Today เดิมแสดงอยู่แล้ว (วันเริ่มงาน + 119 วัน)
    if (e.contractEnd) add('contract', e.contractEnd, 'สัญญาจ้างสิ้นสุด');
    String(e.docs || '').split('\n').forEach(l => { const t = l.trim(); add('doc', t.slice(0, 10), (t.slice(10).trim() || 'เอกสาร') + ' หมดอายุ'); });
  });
  return out.sort((a, b) => a.days - b.days);
}
function dueCardHTML() {
  const L = dueItemsWeb();
  if (!L.length) return '';
  const when = d => d > 0 ? `อีก ${d} วัน` : d === 0 ? 'วันนี้' : `เลยมา ${-d} วัน`;
  return `<h3 class="h3">ครบกำหนดเร็วๆ นี้</h3><div class="group" id="due-card">${L.map(x => `<button class="row" data-a="emp:${esc(x.e.id)}">${avatar(x.e)}<span class="main"><span class="t">${esc(shortName(x.e))} · ${esc(x.label)}</span><span class="s">${esc(thDate(x.date))}${multiBranch() ? ' · ' + esc(branchName(x.e.branch)) : ''}</span></span><span class="chip ${x.days < 0 ? 'bad' : x.days <= 7 ? 'warn' : ''}">${when(x.days)}</span></button>`).join('')}</div>`;
}
(function () {
  const r = App.render.bind(App);
  App.render = function () {
    const out = r.apply(this, arguments);
    try {
      if (S.me && S.route && S.route.mod === 'today' && can('hr') && !document.getElementById('due-card')) {
        const h = dueCardHTML(), v = document.getElementById('view');
        if (h && v) { const box = document.createElement('div'); box.innerHTML = h; const hello = v.querySelector('.hello'); if (hello) hello.after(...box.childNodes); else v.prepend(...box.childNodes); }
      }
    } catch (e) { /* ไม่ให้กระทบหน้าอื่น */ }
    return out;
  };
})();
