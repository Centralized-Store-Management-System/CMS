/* Today: หน้าแรกของทุกคน แยกตามระดับแบบบริษัท
 * Owner: ตัวเลขผู้บริหาร (ยอดขายเดือนนี้เทียบช่วงเดียวกันเดือนก่อน ค่าแรง% ของเสีย) + งานที่ต้องตัดสินใจ
 * HR: งานค้างฝ่ายบุคคล (ใบลา แก้เวลา ครบทดลองงาน ยังไม่มีชื่อผู้ใช้ ยังไม่ปิดงวด)
 * Manager: วันนี้ของสาขา (ใครมา/ยังไม่มา คนพอกะไหม ยอดเมื่อวาน สต็อกใกล้หมด)
 * Staff: กะของฉันวันนี้และ 7 วัน ชั่วโมงเดือนนี้ ใบลาของฉัน ปุ่มลงเวลา */
const PROBATION_DAYS = 119;
const taskRow = (href, ic, t, s, n, cls = '') => `<a class="row task ${cls}" href="${href}"><span class="avatar ti">${icon(ic)}</span><span class="main"><span class="t">${t}</span>${s ? `<span class="s">${s}</span>` : ''}</span>${n !== undefined ? `<span class="chip ${cls || 'mc'}">${n}</span>` : ''}<span class="v" aria-hidden="true">›</span></a>`;
function myTasks() {
  const out = [], T = today();
  if (can('approve_time', 'approve_stock')) { const A = approvals(); if (A.total) out.push(taskRow('#approve', 'approve', 'รออนุมัติ', [A.L.length && `ใบลา ${A.L.length}`, A.OT.length && `OT ${A.OT.length}`, A.OFF.length && `ทำงานวันหยุด ${A.OFF.length}`, A.FIX.length && `แก้เวลา ${A.FIX.length}`, A.MV.length && `สต็อก ${A.MV.length}`, A.MISS.length && `ไม่พบการลงเวลา ${A.MISS.length}`].filter(Boolean).join(' · '), A.total, 'warn')); }
  if (can('sales')) { const y = addDays(T, -1), miss = openBranches().filter(b => inBr(b.code) && (!b.openDate || b.openDate <= y) && !S.t.sales.some(s => s.date === y && s.branch === b.code)); if (miss.length) out.push(taskRow('#acct/sales', 'acct', 'ยังไม่ปิดยอดขายเมื่อวาน', miss.map(b => esc(b.name)).join(', '), miss.length, 'bad')); }
  if (can('schedule_edit')) { const g = upcomingGaps(3); if (g.length) out.push(taskRow('#sched/month', 'sched', 'คนไม่พอใน 3 วันข้างหน้า', g.slice(0, 3).map(x => `${thDate(x.d)} กะ ${esc(x.code)}`).join(', '), g.length, 'warn')); }
  if (can('stock')) { const l = lowStock(); if (l.length) out.push(taskRow('#stock/onhand', 'stock', 'วัตถุดิบถึงจุดสั่งซื้อ', l.slice(0, 4).map(x => esc(x.i.name)).join(', '), l.length)); }
  if (can('hr')) {
    const prob = probationSoon(); if (prob.length) out.push(taskRow('#hr/emp', 'hr', 'ครบทดลองงานใน 30 วัน', prob.slice(0, 4).map(x => `${esc(shortName(x.e))} ${thDate(x.d)}`).join(', '), prob.length));
    const noAcct = S.t.employees.filter(e => e.status !== 'ลาออก' && !e.account && e.hasPin === false && inBr(e.branch)); if (noAcct.length && can('users')) out.push(taskRow('#users', 'users', 'พนักงานยังไม่มีชื่อผู้ใช้', noAcct.slice(0, 4).map(e => esc(shortName(e))).join(', '), noAcct.length));
  }
  if (can('payroll')) { const prev = addMonths(T.slice(0, 7), -1), d = Number(T.slice(8)); if (d > 3 && activeEmps().length && !S.t.payroll.some(p => p.period === prev && p.status === 'ปิดงวดแล้ว')) out.push(taskRow('#pay', 'pay', `ยังไม่ปิดงวดเงินเดือน ${thMonth(prev)}`, 'ตรวจ → ปิดงวด แล้วส่งสลิปให้พนักงาน', undefined, 'warn')); }
  return out;
}
function probationSoon() {
  const T = today(), lim = addDays(T, 30);
  return activeEmps().filter(e => e.startDate).map(e => ({ e, d: addDays(e.startDate, PROBATION_DAYS) })).filter(x => x.d >= T && x.d <= lim).sort((a, b) => a.d.localeCompare(b.d));
}
function addMonths(m, n) { const [y, k] = m.split('-').map(Number), d = new Date(Date.UTC(y, k - 1 + n, 1)); return d.toISOString().slice(0, 7); }
function execKpis() {
  const T = today(), m = T.slice(0, 7), pm = addMonths(m, -1), day = T.slice(8);
  const s = (from, to) => sum(S.t.sales.filter(x => x.date >= from && x.date <= to && inBr(x.branch)), saleTotal);
  const cur = s(m + '-01', T), prev = s(pm + '-01', pm + '-' + day), diff = prev ? (cur - prev) / prev * 100 : 0;
  const waste = sum(S.t.moves.filter(x => x.type === 'ของเสีย' && (x.date || '').startsWith(m) && inBr(x.branch) && (!x.status || x.status === 'อนุมัติ')).map(x => ({ v: num(x.qty) * num(x.unitCost) })), 'v');
  let labor = '';
  if (can('pnl') && typeof pnl === 'function') { const p = pnl(m); if (p.revenue > 0) labor = (p.labor / p.revenue * 100).toFixed(1) + '%'; }
  const late = S.t.attendance.filter(a => (a.date || '').startsWith(m) && attInBr(a) && num(a.lateMin) > 0).length;
  return `<div class="kpis exec">
    <a class="kpi" href="#acct/sales"><b>${baht(cur)}</b><span>ยอดขายเดือนนี้ถึงวันนี้</span>${prev ? `<em class="${diff >= 0 ? 'up' : 'down'}">${diff >= 0 ? '▲' : '▼'} ${Math.abs(diff).toFixed(1)}% เทียบช่วงเดียวกันเดือนก่อน</em>` : ''}</a>
    ${labor ? `<a class="kpi" href="#acct/pnl"><b>${labor}</b><span>ค่าแรงต่อยอดขาย</span><em>${num(labor) > 30 ? 'สูงกว่าเกณฑ์ 30%' : 'อยู่ในเกณฑ์'}</em></a>` : ''}
    <a class="kpi" href="#stock/moves"><b>${baht(waste)}</b><span>ของเสียเดือนนี้</span></a>
    <a class="kpi" href="#time/att"><b>${late}</b><span>ครั้งที่มาสายเดือนนี้</span></a></div>`;
}
function myWeek(e) {
  const T = today(), days = Array.from({ length: 7 }, (_, i) => addDays(T, i));
  return `<div class="week">${days.map(d => { const p = planOf(e, d), lv = leaveOn(e.id, d); return `<div class="wd${d === T ? ' today' : ''}${p.off || lv ? ' off' : ''}"><small>${WD[Calc.weekday(d)]} ${+d.slice(8)}</small><b>${lv ? 'ลา' : p.off ? 'หยุด' : esc(p.code || '•')}</b><span>${lv || p.off ? '' : esc(p.start) + '–' + esc(p.end)}</span></div>`; }).join('')}</div>`;
}
function pToday() {
  const T = today(), me = S.me, e = me.empId ? empById(me.empId) : null, hr = new Date().getHours();
  let h = `<section class="hello"><h2>${hr < 12 ? 'สวัสดีตอนเช้า' : hr < 17 ? 'สวัสดีตอนบ่าย' : 'สวัสดีตอนเย็น'}, ${esc(me.name)}</h2><p class="muted">${thDate(T, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} · ${esc(ROLE_NAME[me.role] || '')}${S.branch ? ' · ' + esc(branchName(S.branch)) : allBranch() ? ' · ทุกสาขา' : ''}</p></section>`;
  if (can('dash')) h += execKpis();
  const tasks = myTasks();
  h += `<h3 class="h3">งานของฉันวันนี้</h3><div class="group">${tasks.join('') || `<div class="row static"><span class="main"><span class="t">ไม่มีงานค้าง</span><span class="s">เรียบร้อยดี</span></span><span class="chip ok">✓</span></div>`}</div>`;
  if (e) {
    const p = planOf(e, T), a = S.t.attendance.find(x => x.empId === e.id && x.date === T), mine = S.t.attendance.filter(x => x.empId === e.id && (x.date || '').startsWith(T.slice(0, 7)));
    const lvs = S.t.leaves.filter(l => l.empId === e.id && l.status === 'รออนุมัติ').length, lvT = leaveOn(e.id, T);
    h += `<h3 class="h3">ของฉัน</h3><div class="group pad my">
      <div class="myline"><div><small class="muted">วันนี้</small><b>${lvT ? esc(lvT.type || 'ลา') + (lvT.status === 'รออนุมัติ' ? ' (รออนุมัติ)' : '') : p.off ? 'วันหยุด' : `${esc(p.code || '')} ${esc(p.start)}–${esc(p.end)}`}</b><span class="muted">${a ? `เข้า ${esc(a.inTime)}${a.outTime ? ' ออก ' + esc(a.outTime) : ''}${num(a.lateMin) > 0 ? ' · สาย ' + a.lateMin + ' นาที' : ''}` : p.off || lvT ? '' : 'ยังไม่ลงเวลา'}${p.branch && p.branch !== e.branch ? ' · ไปช่วย' + esc(branchName(p.branch)) : ''}</span></div>
      <a class="btn primary" href="${esc(clockLink(p.branch || e.branch))}">${icon('clock')}ลงเวลา / ขอลา</a></div>
      ${myWeek(e)}
      <div class="mystats"><span><b>${hrsShort(sum(mine, 'workMin'))}</b> เดือนนี้</span><span><b>${mine.filter(x => num(x.lateMin) > 0).length}</b> ครั้งที่สาย</span><span><b>${lvs}</b> ใบลารออนุมัติ</span></div></div>`;
  }
  if (can('time', 'approve_time') && typeof todayRoster === 'function') {
    const R = todayRoster(), came = R.filter(r => r.cls === 'ok' || r.cls === 'warn').length, notyet = R.filter(r => r.cls === 'bad').length;
    if (R.length) h += `<h3 class="h3">วันนี้ของสาขา <span class="chip ok">มาแล้ว ${came}</span> ${notyet ? `<span class="chip bad">ยังไม่ลงเวลา ${notyet}</span>` : ''}</h3><div class="group">${R.map(r => `<div class="row static">${avatar(r.e)}<span class="main"><span class="t">${esc(shortName(r.e))}</span><span class="s">${r.p.off ? 'วันหยุดตามตาราง' : `${esc(r.p.code || '')} ${esc(r.p.start)}–${esc(r.p.end)}`}</span></span><span class="chip ${r.cls}">${esc(r.st)}</span></div>`).join('')}</div>`;
  }
  if (can('sales')) {
    const y = addDays(T, -1), ys = S.t.sales.filter(s => s.date === y && inBr(s.branch));
    if (ys.length) h += `<h3 class="h3">ยอดขายเมื่อวาน</h3><div class="group">${statRow(baht(sum(ys, saleTotal)), fmt(sum(ys, 'cups')) + ' แก้ว', ys.length > 1 ? ys.map(s => esc(branchName(s.branch)) + ' ' + baht(saleTotal(s))).join(' · ') : '')}</div>`;
  }
  return h;
}
defMod({
  key: 'today', mod: 'dash', label: 'Today', icon: 'dash', group: '', desc: 'งานของฉัน และภาพรวมวันนี้ตามระดับของคุณ', perm: ['*'],
  view: pToday,
  summary: () => { const n = myTasks().length; return n ? `งานรอทำ ${n} เรื่อง` : 'ไม่มีงานค้าง'; }
});
