/* ระบบตารางงาน: ตั้งในระบบได้เลย ไม่ต้องทำใน Excel
 * 1) คนที่ต้องการต่อกะของแต่ละสาขา  2) รูปแบบกะรายสัปดาห์ของแต่ละคน  3) สร้างตารางทั้งเดือน แล้วแก้เฉพาะวันที่ต่างออกไป
 * ระบบตรวจให้ว่าคนพอไหม ทำงานติดกันเกิน 6 วันไหม ชั่วโมงเกิน 48 ต่อสัปดาห์ไหม
 * ตารางงานส่งต่อให้: หน้าลงเวลา (สาย OT ทำงานวันหยุด และสาขาที่ต้องไป), หน้าอนุมัติ (ขาดงาน), เงินเดือน, ภาพรวม
 * หลายสาขา: แต่ละสาขามีตารางของตัวเอง ยืมคนข้ามสาขาได้ โดยสาขาต้นทางเป็นคนส่งไปช่วย */
const XLSX_URL = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
const ensureXlsx = async () => { if (!window.XLSX) await loadScript(XLSX_URL); };
const WEEK = [1, 2, 3, 4, 5, 6, 0];
const MAX_WEEK_MIN = 48 * 60, MAX_RUN = 6;

function monthDates(m) { const n = daysIn(m); return Array.from({ length: n }, (_, i) => `${m}-${pad(i + 1)}`); }
const ROLE_ORDER = { owner: 0, manager: 1, staff: 2, hr: 3 };
const byRole = (a, b) => (ROLE_ORDER[a.role] ?? 3) - (ROLE_ORDER[b.role] ?? 3) || String(a.code || '').localeCompare(String(b.code || ''));
const workingIn = (e, first, last) => (!e.startDate || e.startDate <= last) && (e.status !== 'ลาออก' || (e.endDate || '') >= first);
const employed = (e, d) => !(e.startDate && d < e.startDate) && !(e.endDate && e.status === 'ลาออก' && d > e.endDate);
const hasPattern = e => !!timeCtx().patterns[e.id];
const seeAtt = () => can('time', 'approve_time');   // เห็นผลลงเวลา (จุดสี/ตรวจตาราง) เฉพาะผู้ดูแลเวลา
const seeLeave = () => true;   // Staff ก็เห็นวันลา (เซิร์ฟเวอร์ส่งเฉพาะที่ควรเห็น: ของตัวเองครบ ของเพื่อนแค่ "ลา" 27_StaffView.gs)
const attIndex = () => { const o = {}; S.t.attendance.forEach(a => { if (a.inTime) o[a.date + '|' + a.empId] = a; }); return o; };

/** พนักงานประจำสาขา b ที่อยู่ในตาราง (HR/Owner ที่ไม่มีรูปแบบกะและไม่มีกะในเดือนนี้ ไม่แสดง) */
function homeEmps(b, m) {
  const first = m + '-01', last = m + '-' + pad(daysIn(m));
  return S.t.employees.filter(e => e.branch === b && workingIn(e, first, last) && (['manager', 'staff'].includes(e.role) || hasPattern(e) || S.t.schedule.some(r => r.empId === e.id && (r.date || '').startsWith(m) && String(r.shift || '').trim() && !Calc.isOffCode(r.shift)))).sort(byRole);
}
/** คนจากสาขาอื่นที่ถูกส่งมาช่วยสาขา b ในเดือนนี้ */
function guestEmps(b, m) {
  const ids = new Set(S.t.schedule.filter(r => r.branch === b && (r.date || '').startsWith(m) && !Calc.isOffCode(r.shift)).map(r => r.empId));
  return S.t.employees.filter(e => ids.has(e.id) && e.branch !== b).sort(byRole);
}
function needRow(b, code) { return S.t.staffing.find(x => x.branch === b && Calc.upper(x.shift) === Calc.upper(code)); }
const needOn = (b, code, d) => { const r = needRow(b, code); return r ? num(r['d' + Calc.weekday(d)]) : 0; };
const needShifts = b => shiftsFor(b).filter(s => { const r = needRow(b, s.code); return r && WEEK.some(w => num(r['d' + w]) > 0); });
const working = (p, e, d) => !p.off && p.source !== 'ค่าตั้งต้น' && employed(e, d) && !(seeLeave() && leaveOn(e.id, d, ['อนุมัติ']));
/** จำนวนคนในแต่ละกะที่สาขา b วันที่ d */
function coverage(b, d, emps, ctx) {
  const o = { _t: 0 };
  emps.forEach(e => { const p = Calc.planFor(e, d, ctx); if (p.branch !== b || !working(p, e, d)) return; o._t++; if (p.code) o[p.code] = (o[p.code] || 0) + 1; });
  return o;
}
function covCell(have, need) {
  if (!need && !have) return '<td class="cov"></td>';
  const c = have < need ? 'bad' : have > need ? 'over' : 'ok';
  return `<td class="cov ${c}" title="มี ${have} ต้องการ ${need}">${have}/${need}</td>`;
}
function branchSeg(key = 'sched') {
  const list = openBranches();
  if (list.length < 2) return '';
  const cur = oneBranch();
  return `<div class="seg" role="group" aria-label="สาขา">${list.map(b => `<button data-a="setBr:${esc(b.code)}" aria-pressed="${b.code === cur}">${esc(b.name)}</button>`).join('')}</div>`;
}

/* ---------- ตรวจตาราง: คนพอไหม และกฎหมายแรงงาน ---------- */
function laborChecks(e, dates, ctx) {
  const out = [], last = dates[dates.length - 1];
  let run = 0, from = '';
  const flush = to => { if (run > MAX_RUN && to >= dates[0]) out.push(`ทำงานติดกัน <b>${run} วัน</b> (${thDate(from)}–${thDate(to)}) ต้องมีวันหยุดอย่างน้อยสัปดาห์ละ 1 วัน`); };
  for (let d = addDays(dates[0], -MAX_RUN); d <= last; d = addDays(d, 1)) {
    const p = Calc.planFor(e, d, ctx);
    if (working(p, e, d)) { if (!run) from = d; run++; } else { flush(addDays(d, -1)); run = 0; }
  }
  flush(last);
  let mon = dates[0]; while (Calc.weekday(mon) !== 1) mon = addDays(mon, -1);
  for (; mon <= last; mon = addDays(mon, 7)) {
    let mins = 0;
    for (let i = 0; i < 7; i++) { const d = addDays(mon, i), p = Calc.planFor(e, d, ctx); if (working(p, e, d)) mins += Calc.planMinutes(p, S.settings); }
    if (mins > MAX_WEEK_MIN) out.push(`สัปดาห์ ${thDate(mon)}–${thDate(addDays(mon, 6))} ตามตาราง <b>${hrsShort(mins)}</b> เกิน 48 ชม. (ส่วนที่เกินต้องจ่ายเป็น OT)`);
  }
  return out;
}
function rosterChecks(b, dates, emps, home, ctx) {
  const items = [];
  const gaps = [];
  needShifts(b).forEach(s => dates.forEach(d => {
    const need = needOn(b, s.code, d); if (!need) return;
    const have = coverage(b, d, emps, ctx)[Calc.upper(s.code)] || 0;
    if (have < need) gaps.push([d, s.code, need - have]);
  }));
  if (gaps.length) items.push({ t: `คนไม่พอ ${gaps.length} กะ`, s: gaps.slice(0, 10).map(([d, c, n]) => `${thDate(d)} ${esc(c)} ขาด ${n}`).join(', ') + (gaps.length > 10 ? ' …' : ''), c: 'bad' });
  home.forEach(e => {
    if (!hasPattern(e) && !S.t.schedule.some(r => r.empId === e.id && dates.includes(r.date))) items.push({ t: shortName(e), s: 'ยังไม่ได้ตั้งรูปแบบกะ ตั้งที่แท็บ รูปแบบกะ ก่อนสร้างตาราง', c: 'warn' });
    laborChecks(e, dates, ctx).forEach(s => items.push({ t: shortName(e), s, c: 'warn' }));
  });
  return items;
}

/* ---------- ตารางเดือน ---------- */
function schedView() {
  const base = timeCtx(), pend = S.f.pending || {};
  if (!Object.keys(pend).length) return base;
  const sched = { ...base.sched };
  Object.entries(pend).forEach(([k, v]) => { const [date, empId] = k.split('|'); sched[k] = { date, empId, ...v }; });
  return { ...base, sched };
}
function cellHTML(e, d, b, ctx, att, T, guest) {
  const k = d + '|' + e.id, p = Calc.planFor(e, d, ctx), here = p.branch === b;
  if (!employed(e, d)) return '<td><button class="cellbtn elsewhere" disabled aria-label="ยังไม่ได้เริ่มงาน"><span class="pill">·</span></button></td>';
  const lv = seeLeave() ? leaveOn(e.id, d) : null, cls = ['cellbtn'];
  let text, sub = '';
  if (guest && !here) { cls.push('elsewhere'); text = '·'; }
  else if (!here && !p.off) { cls.push('away'); text = p.code || p.start.replace(':00', ''); sub = '→' + p.branch; }
  else if (lv) { cls.push('leave'); text = 'ลา'; }
  else if (p.off) { cls.push('off'); text = 'หยุด'; }
  else if (p.name === 'กำหนดเวลาเอง') { cls.push('custom'); text = p.start.replace(':00', ''); sub = p.end.replace(':00', ''); }
  else text = p.code || '•';
  if (p.source !== 'ตารางงาน' && !(guest && !here)) cls.push('def');
  if (S.f.pending && k in S.f.pending) cls.push('dirty');
  let dot = '';
  if (seeAtt() && d < T && (here || !guest)) {
    const a = att[k];
    if (a) dot = `<i class="${isLate(a) ? 'late' : 'ok'}"></i>`;
    else if (!p.off && !lv && p.source !== 'ค่าตั้งต้น') dot = '<i class="miss"></i>';
  }
  const tip = `${shortName(e)} ${thDate(d)}: ${guest && !here ? 'อยู่สาขาประจำ' : lv ? lv.type + ' (' + lv.status + ')' : planLabel(p)}${p.source !== 'ตารางงาน' ? ' (' + p.source + ')' : ''}`;
  if (can('schedule_edit') && !frozenMonth(d) && (myEmp(e) || here) && !(guest && !here) && !lv) {
    const cur = cellVal(ctx.sched[k], b), base = cellVal(timeCtx().sched[k], b);
    return `<td><div class="cellpick"><span class="${cls.join(' ')}" style="--sc:${p.off ? 'var(--muted)' : shiftColor(p.code)}" aria-hidden="true"><span class="pill">${esc(text)}</span>${sub ? `<small>${esc(sub)}</small>` : ''}${dot}</span><select data-cell="${e.id}/${d}" data-v="${esc(cur)}" title="${esc(tip)}" aria-label="${esc(tip)}">${cellOptions(e, d, b, cur, base, ctx.sched[k] || timeCtx().sched[k])}</select></div></td>`;
  }
  return `<td><button class="${cls.join(' ')}" style="--sc:${p.off ? 'var(--muted)' : shiftColor(p.code)}" data-a="cell:${e.id}/${d}" title="${esc(tip)}" aria-label="${esc(tip)}"><span class="pill">${esc(text)}</span>${sub ? `<small>${esc(sub)}</small>` : ''}${dot}</button></td>`;
}
/** ค่าของช่องใน Drop Down: '' = ตามรูปแบบกะ, รหัสกะ, OFF, C = เวลาเอง, __away = ส่งไปช่วยสาขาอื่น */
function cellVal(entry, b) {
  if (!entry || !String(entry.shift || '').trim()) return '';
  if (entry.branch && entry.branch !== b) return '__away';
  const c = Calc.upper(entry.shift);
  return Calc.isOffCode(c) ? 'OFF' : c;
}
function cellOptions(e, d, b, cur, base, entry) {
  const pat = (timeCtx().patterns[e.id] || {})['d' + Calc.weekday(d)], pc = Calc.upper(pat || '');
  const def = !pc ? 'เวลาปกติร้าน' : Calc.isOffCode(pc) ? 'หยุด' : pc;
  const o = (v, t) => `<option value="${esc(v)}"${cur === v ? ' selected' : ''}>${esc(t)}</option>`;
  const list = shiftsFor(b), codes = list.map(x => Calc.upper(x.code));
  let h = o('', `ตามรูปแบบกะ (${def})`) + list.map(x => o(Calc.upper(x.code), `${x.code} · ${x.name} ${x.start}–${x.end}`)).join('');
  [cur, base].filter((v, i, a) => v && a.indexOf(v) === i && !['OFF', 'C', '__away'].includes(v) && !codes.includes(v)).forEach(v => { const x = shiftByCode(v); h += o(v, x ? `${x.code} · ${x.name} ${x.start}–${x.end}` : v); });
  h += o('OFF', 'หยุด');
  if (cur === 'C' || base === 'C') h += o('C', `เวลาเอง ${(entry && entry.start) || ''}–${(entry && entry.end) || ''}`);
  if (cur === '__away' || base === '__away') h += o('__away', `ไปช่วย${branchName((entry && entry.branch) || '')}`);
  return h + o('__more', 'อื่นๆ: กำหนดเวลาเอง / ส่งไปสาขาอื่น / ดูการลงเวลา…');
}
/** เลือกกะใน Drop Down: เก็บไว้ก่อน ยังไม่ส่งเข้า Google จนกว่าจะกดบันทึก */
function rosterPick(sel) {
  const [empId, d] = sel.dataset.cell.split('/'), v = sel.value, b = oneBranch(), k = d + '|' + empId;
  if (v === '__more') { sel.value = sel.dataset.v; return cellTap(sel.dataset.cell); }
  S.f.pending = S.f.pending || {};
  if (v === cellVal(timeCtx().sched[k], b)) delete S.f.pending[k];
  else S.f.pending[k] = v === '' ? { shift: '', branch: '' } : { shift: v, branch: b };
  rerenderKeep(sel.dataset.cell);
}
/** วาดตารางใหม่โดยไม่เลื่อนกลับไปวันที่ 1 */
function rerenderKeep(cell) {
  const w = $('.roster-wrap'), st = w ? [w.scrollLeft, w.scrollTop] : null, y = window.scrollY;
  App.render();
  const w2 = $('.roster-wrap'); if (w2 && st) { w2.scrollLeft = st[0]; w2.scrollTop = st[1]; }
  window.scrollTo(0, y);
  const f = cell && $(`select[data-cell="${cell}"]`); if (f && matchMedia('(pointer:fine)').matches) f.focus({ preventScroll: true });
}
document.addEventListener('change', e => { if (e.target && e.target.dataset && e.target.dataset.cell) rosterPick(e.target); });
window.addEventListener('beforeunload', e => { if (Object.keys(S.f.pending || {}).length) { e.preventDefault(); e.returnValue = ''; } });
function brushBar(b, withPattern = true) {
  const br = S.f.brush || '';
  return `<div class="brushes" role="group" aria-label="แปรงระบายกะ"><span class="muted" style="font-size:13px">แปรง:</span><button class="brush" aria-pressed="${!br}" data-a="brush:">แตะเพื่อเลือก</button>${shiftsFor(b).map(s => `<button class="brush" style="--sc:${esc(s.color || 'var(--mc)')}" aria-pressed="${br === Calc.upper(s.code)}" data-a="brush:${esc(Calc.upper(s.code))}" title="${esc(s.name)} ${esc(s.start)}–${esc(s.end)}">${esc(s.code)}</button>`).join('')}<button class="brush" aria-pressed="${br === 'OFF'}" data-a="brush:OFF">หยุด</button>${withPattern ? `<button class="brush" aria-pressed="${br === '_'}" data-a="brush:_">ตามรูปแบบกะ</button>` : `<button class="brush" aria-pressed="${br === '_'}" data-a="brush:_">ล้าง</button>`}</div>`;
}
function pRoster() {
  const m = S.month, dates = monthDates(m), T = today(), edit = can('schedule_edit') && !frozenMonth(m), b = oneBranch();
  if (!b) return `<div class="group">${empty('ยังไม่มีสาขา เพิ่มที่ ตั้งค่า > สาขา')}</div>`;
  const home = homeEmps(b, m), guests = guestEmps(b, m), all = [...home, ...guests];
  const ctx = schedView(), att = seeAtt() ? attIndex() : {}, hol = ctx.hol;
  const pendN = Object.keys(S.f.pending || {}).length;
  let h = branchSeg();
  if (edit) {
    h += `<div class="actions" style="margin-top:0"><button class="btn primary" data-a="rosterGen">สร้างตารางจากรูปแบบกะ</button><a class="btn" href="#sched/pattern">ตั้งรูปแบบกะ</a><a class="btn" href="#sched/need">คนที่ต้องการ</a><span class="grow"></span><button class="btn" data-a="rosterTemplate">${icon('download')}ส่งออก Excel</button></div>`;
    h += '<p class="note" style="margin-top:0">แตะช่องแล้วเลือกกะจากรายการ แก้ได้หลายช่องก่อน แล้วกด <b>บันทึกตารางงาน</b> ครั้งเดียว (ช่องที่แก้มีกรอบ)</p>';
  }
  const saveBar = pendN ? `<div class="group pad savebar"><span class="main"><b>แก้ไขแล้ว ${pendN} ช่อง</b><span class="sb-note"> ยังไม่ได้บันทึก</span></span><button class="btn" data-a="rosterDiscard">ยกเลิก</button><button class="btn primary" data-a="rosterSave">บันทึกตารางงาน</button></div>` : '';
  if (!all.length) return h + `<div class="group">${empty(`${esc(branchName(b))} ยังไม่มีพนักงาน เพิ่มที่ HR บุคคล`)}</div>`;
  const head = `<tr><th class="rname">${esc(branchName(b))}</th>${dates.map(d => { const wd = Calc.weekday(d); const c = [hol[d] ? 'hol' : '', wd === 0 || wd === 6 ? 'wkend' : '', d === T ? 'today' : ''].join(' '); return `<th class="${c}" title="${esc(hol[d] || '')}">${+d.slice(8)}<small>${WD[wd]}</small></th>`; }).join('')}</tr>`;
  const row = (e, guest) => `<tr><td class="rname"><b>${esc(shortName(e))}</b><small>${guest ? 'จาก' + esc(branchName(e.branch)) : esc(e.position || ROLE_NAME[e.role] || '')}</small></td>${dates.map(d => cellHTML(e, d, b, ctx, att, T, guest)).join('')}</tr>`;
  h += `<div class="roster-wrap"><table class="roster"><thead>${head}</thead><tbody>${home.map(e => row(e, false)).join('')}`;
  if (guests.length) h += `<tr class="sec"><td colspan="${dates.length + 1}">มาช่วยจากสาขาอื่น</td></tr>${guests.map(e => row(e, true)).join('')}`;
  const cov = dates.map(d => coverage(b, d, all, ctx));
  h += `</tbody><tfoot>${needShifts(b).map(s => `<tr><td class="rname">กะ ${esc(s.code)} มี/ต้องการ</td>${dates.map((d, i) => covCell(cov[i][Calc.upper(s.code)] || 0, needOn(b, s.code, d))).join('')}</tr>`).join('')}<tr><td class="rname">คนเข้างาน</td>${cov.map(c => `<td>${c._t}</td>`).join('')}</tr></tfoot></table></div>${saveBar}`;
  h += `<div class="legend-line"><span><b>${esc(shiftsFor(b).map(s => s.code).join(' '))}</b> รหัสกะ</span><span>กรอบเส้นประ = ยังไม่ได้สร้างตาราง ใช้รูปแบบกะ</span>${multiBranch() || S.t.branches.length > 1 ? '<span>→B02 = ไปช่วยสาขาอื่น</span>' : ''}${seeAtt() ? '<span><i style="background:var(--ok)"></i>มาตามตาราง</span><span><i style="background:var(--warn)"></i>สาย</span><span><i style="background:var(--bad)"></i>ไม่พบการลงเวลา</span>' : ''}<span>ลายขีด = ลา</span></div>`;
  if (edit || seeAtt()) {
    const issues = rosterChecks(b, dates, all, home, ctx);
    h += `<h3 class="h3">ตรวจตาราง${thMonth(m)}</h3><div class="group checks">${issues.length ? issues.map(x => `<div class="row static"><span class="main"><span class="t">${esc(x.t)}</span><span class="s">${x.s}</span></span><span class="chip ${x.c}">${x.c === 'bad' ? 'ต้องแก้' : 'ตรวจดู'}</span></div>`).join('') : statRow('ไม่พบปัญหา', '<span class="chip ok">ผ่าน</span>', 'คนครบทุกกะ ไม่มีใครทำงานติดกันเกิน 6 วันหรือเกิน 48 ชม./สัปดาห์')}</div>`;
  }
  const hours = home.map(e => { let mins = 0, days = 0; dates.forEach(d => { const p = Calc.planFor(e, d, ctx); if (working(p, e, d)) { days++; mins += Calc.planMinutes(p, S.settings); } }); return { e, mins, days }; });
  h += `<h3 class="h3">ชั่วโมงตามตาราง${thMonth(m)}</h3><div class="group">${hours.map(x => statRow(esc(shortName(x.e)), hrsShort(x.mins), `${x.days} วันทำงาน`)).join('')}</div>`;
  if (!edit) h += '<p class="note">จัดหรือแก้ตารางงานได้เฉพาะผู้ที่ได้รับสิทธิ์ ถ้าต้องการแลกกะ แจ้งผู้จัดการร้าน</p>';
  return h;
}
function cellTap(arg) {
  const [empId, d] = arg.split('/'), e = empById(empId); if (!e) return;
  const k = d + '|' + empId, b = oneBranch(), p = Calc.planFor(e, d, schedView());
  const mine = myEmp(e), lent = p.branch === b;
  const canEdit = can('schedule_edit') && (mine || lent);
  const a = seeAtt() ? attIndex()[k] : null, lv = seeLeave() ? leaveOn(empId, d) : null;
  const info = `<p class="muted">${esc(WD_FULL[Calc.weekday(d)])} ${thDate(d, { day: 'numeric', month: 'long' })}: ${esc(planLabel(p))} <span class="chip">${esc(p.source)}</span>${p.pubHoliday ? ` <span class="chip warn">${esc(p.pubHoliday)}</span>` : ''}</p>
    ${lv ? `<p class="note warn">${esc(lv.type)} ${esc(lv.status)}</p>` : ''}${a ? `<p class="note">ลงเวลา${a.branch && a.branch !== p.branch ? 'ที่' + esc(branchName(a.branch)) : ''} เข้า ${esc(a.inTime)} ออก ${esc(a.outTime || '–')}${num(a.lateMin) ? `, สาย ${a.lateMin} นาที` : ''}${num(a.otMin) ? `, OT ${a.otMin} นาที (${esc(a.otStatus)})` : ''}</p>` : ''}`;
  if (!canEdit) {
    const why = can('schedule_edit') && !mine ? `<p class="note">${esc(shortName(e))} เป็นพนักงาน${esc(branchName(e.branch))} ถ้าต้องการให้มาช่วย ให้ Manager สาขานั้นเลือก "ทำงานที่สาขา" เป็น${esc(branchName(b))}</p>` : '';
    openSheet(`<h3>${esc(shortName(e))}</h3>${info}${why}<div class="actions"><span class="grow"></span><button class="btn primary" data-a="close">ปิด</button></div>`);
    return;
  }
  const open = S.t.branches.filter(x => x.status !== 'ปิด');
  const brList = mine ? open : open.filter(x => x.code === b || x.code === e.branch);
  const brSel = open.length > 1 ? `<div class="form"><div class="field"><label for="cx-b">ทำงานที่สาขา</label><select id="cx-b">${opts(branchOpts(brList), p.branch || e.branch)}</select><span class="help">${mine ? 'เลือกสาขาอื่น = ส่งไปช่วยสาขานั้นในวันนี้ ลงเวลาที่สาขานั้นได้' : 'คนที่ยืมมา เปลี่ยนกะได้ หรือส่งกลับสาขาประจำ'}</span></div></div>` : '';
  const sh = openSheet(`<h3>${esc(shortName(e))}${e.branch !== b ? ` <small class="muted">จาก${esc(branchName(e.branch))}</small>` : ''}</h3>${info}${brSel}
    <div class="shiftlist">${S.t.shifts.map(s => `<button style="--sc:${esc(s.color || 'var(--mc)')}" data-pick="${esc(Calc.upper(s.code))}"><b>${esc(s.code)}</b><span>${esc(s.name)} ${esc(s.start)}–${esc(s.end)}${s.branch ? ' (' + esc(s.branch) + ')' : ''}</span></button>`).join('')}<button data-pick="OFF"><b>หยุด</b><span>วันหยุดของพนักงาน</span></button><button data-pick="_"><b>ตามรูปแบบกะ</b><span>ล้างช่องนี้ กลับไปใช้รูปแบบกะที่สาขาประจำ</span></button></div>
    <h3 class="h3" style="margin-top:16px">กำหนดเวลาเอง</h3><div class="form"><div class="field half"><label for="cx-s">เข้า</label><input id="cx-s" type="time" value="${esc(p.start || '')}"></div><div class="field half"><label for="cx-e">ออก</label><input id="cx-e" type="time" value="${esc(p.end || '')}"></div></div>
    <div class="actions"><button class="btn" data-pick="CUSTOM">ใช้เวลานี้</button><span class="grow"></span><button class="btn" data-a="close">ปิด</button></div><p class="err" role="alert"></p>`);
  sh.addEventListener('click', async ev => {
    const btn = ev.target.closest('[data-pick]'); if (!btn) return;
    const v = btn.dataset.pick, br = $('#cx-b', sh) ? $('#cx-b', sh).value : (p.branch || e.branch);
    let row = { id: d + '_' + empId, date: d, empId, branch: br, shift: v, start: '', end: '' };
    if (v === '_') row = { ...row, shift: '', branch: '' };
    if (v === 'CUSTOM') {
      const s = $('#cx-s', sh).value, en = $('#cx-e', sh).value;
      if (!s || !en) return showErr(sh, 'ใส่เวลาเข้าและออก');
      row = { ...row, shift: 'C', start: s, end: en };
    }
    try { await busy(btn, () => saveSchedule([row])); if (S.f.pending) delete S.f.pending[k]; closeSheet(); rerenderKeep(); toast(v !== '_' && br !== (p.branch || e.branch) ? (br === e.branch ? `บันทึกแล้ว ${shortName(e)} กลับไปทำงานที่${branchName(br)}` : `บันทึกแล้ว ${shortName(e)} ไปทำงานที่${branchName(br)}`) : 'บันทึกตารางงานแล้ว'); } catch (err) { showErr(sh, err.message); }
  });
}
/** บันทึกตารางงาน แล้วคิดเวลาทำงานของวันที่เปลี่ยนใหม่ในหน้าเว็บด้วย (ฝั่ง Google คิดให้แล้วเช่นกัน) */
async function saveSchedule(rows) {
  rows.forEach(r => { r.id = r.date + '_' + r.empId; });
  const res = await DB.upsertMany('schedule', rows);
  relocalAtt(new Set(rows.map(r => r.date + '|' + r.empId)));
  return res;
}
function relocalAtt(keys, test) {
  S.t.attendance.filter(a => a.inTime && (keys ? keys.has(a.date + '|' + a.empId) : test(a))).forEach(a => {
    const e = empById(a.empId); if (e) { Calc.applyPlan(a, planOf(e, a.date), S.settings); S.rev++; }
  });
}
async function rosterSave(btn) {
  const rows = Object.entries(S.f.pending || {}).map(([k, v]) => { const [date, empId] = k.split('|'); return { date, empId, start: '', end: '', ...v }; });
  if (!rows.length) return;
  // ไม่ต้องรอ: ใส่ในตารางทันที ส่งเข้า Google เบื้องหลัง ถ้าไม่สำเร็จคืนช่องที่แก้ให้แก้ต่อได้
  const pend = S.f.pending; S.f.pending = {};
  rows.forEach(r => { r.id = r.date + '_' + r.empId; DB.local('schedule', r); });
  rerenderKeep();
  saveSchedule(rows).then(res => { const n = res && res.extra && res.extra.recalc; toast(`บันทึกตารางงาน ${rows.length} ช่อง${n ? `, คิดเวลาทำงานใหม่ ${n} รายการ` : ''}`); rerenderKeep(); },
    e => { S.f.pending = { ...pend, ...S.f.pending }; S.t.schedule = S.t.schedule.filter(x => !rows.some(r => r.id === x.id && !x.updatedAt)); S.rev++; rerenderKeep(); toast('บันทึกตารางงานไม่สำเร็จ ช่องที่แก้ยังอยู่ กดบันทึกอีกครั้ง: ' + e.message); });
}
/** สร้างตารางทั้งเดือนจากรูปแบบกะ (ช่องที่จัดไว้แล้วไม่ถูกแตะ เว้นแต่เลือกเขียนทับตั้งแต่วันนี้) */
function genRows(b, m, overwrite) {
  const base = timeCtx(), T = today(), rows = [], noPat = [];
  homeEmps(b, m).forEach(e => {
    if (!base.patterns[e.id]) { noPat.push(shortName(e)); return; }
    monthDates(m).forEach(d => {
      if (!employed(e, d)) return;
      const cur = base.sched[d + '|' + e.id], set = cur && String(cur.shift || '').trim() !== '';
      if (set && !(overwrite && d >= T && (cur.branch || e.branch) === e.branch)) return;
      const p = Calc.planFor(e, d, { ...base, sched: {} });
      rows.push({ date: d, empId: e.id, branch: e.branch, shift: p.off ? 'OFF' : p.code, start: '', end: '' });
    });
  });
  return { rows, noPat };
}
function rosterGen() {
  const m = S.month, b = oneBranch();
  const sh = openSheet(`<h3>สร้างตาราง${esc(thMonth(m))} ${esc(branchName(b))}</h3><p class="muted">ใส่กะและวันหยุดของแต่ละคนตามรูปแบบกะรายสัปดาห์ ทุกวันในเดือน จากนั้นแก้เฉพาะวันที่ต่างออกไป (แลกกะ ไปช่วยสาขาอื่น วันหยุดพิเศษ)</p>
    <div class="form"><div class="field check"><input type="checkbox" id="gen-ow"><label for="gen-ow">เขียนทับช่องที่จัดไว้แล้ว ตั้งแต่วันนี้เป็นต้นไป (ไม่แตะวันที่ผ่านมาและวันที่ส่งไปช่วยสาขาอื่น)</label></div></div>
    <p class="live"></p><div class="actions"><span class="grow"></span><button class="btn" data-a="close">ยกเลิก</button><button class="btn primary" data-act="go">สร้างตาราง</button></div><p class="err" role="alert"></p>`);
  const live = () => { const r = genRows(b, m, $('#gen-ow', sh).checked); $('.live', sh).innerHTML = `จะใส่ ${r.rows.length} ช่อง${r.noPat.length ? `<br><span class="chip warn">ยังไม่มีรูปแบบกะ: ${esc(r.noPat.join(', '))}</span>` : ''}`; return r; };
  live();
  sh.addEventListener('change', live);
  sh.addEventListener('click', async e => {
    const btn = e.target.closest('[data-act="go"]'); if (!btn) return;
    const r = live();
    if (!r.rows.length) return showErr(sh, r.noPat.length ? 'ตั้งรูปแบบกะก่อน' : 'ทุกช่องของเดือนนี้จัดไว้แล้ว');
    try { await busy(btn, () => saveSchedule(r.rows), 'กำลังสร้าง…'); closeSheet(); S.f.pending = {}; App.render(); toast(`สร้างตารางงาน ${r.rows.length} ช่องแล้ว`); } catch (err) { showErr(sh, err.message); }
  });
}

/* ---------- รูปแบบกะรายสัปดาห์ ---------- */
const patVal = (empId, w) => { const pp = (S.f.patPend || {})[empId]; if (pp && ('d' + w) in pp) return pp['d' + w]; const p = timeCtx().patterns[empId]; return p ? Calc.upper(p['d' + w]) : ''; };
function patMinutes(empId) {
  let mins = 0, days = 0;
  WEEK.forEach(w => { const c = patVal(empId, w); const s = shiftByCode(c); if (s && !Calc.isOffCode(c)) { days++; mins += Calc.planMinutes(s, S.settings); } });
  return { mins, days };
}
function pPatterns() {
  const b = oneBranch(), edit = can('schedule_edit');
  const emps = S.t.employees.filter(e => e.branch === b && e.status !== 'ลาออก').sort(byRole);
  const pendN = Object.keys(S.f.patPend || {}).length;
  let h = branchSeg();
  h += '<p class="note">ตั้งครั้งเดียวใช้ทุกสัปดาห์ แต่ละคนเข้ากะไหนวันไหน หยุดวันไหน แล้วไปที่แท็บ ตารางเดือน กด "สร้างตารางจากรูปแบบกะ" วันที่ยังไม่ได้สร้างตาราง ระบบลงเวลาก็ใช้รูปแบบนี้คิดสายและ OT ให้</p>';
  if (edit) h += brushBar(b, false);
  if (pendN) h += `<div class="group pad" style="display:flex;align-items:center;gap:10px;flex-wrap:wrap"><span class="main">แก้รูปแบบกะ ${pendN} คน ยังไม่ได้บันทึก</span><button class="btn" data-a="patDiscard">ยกเลิก</button><button class="btn primary" data-a="patSave">บันทึกรูปแบบกะ</button></div>`;
  if (!emps.length) return h + `<div class="group">${empty('สาขานี้ยังไม่มีพนักงาน')}</div>`;
  h += `<div class="roster-wrap"><table class="roster pat"><thead><tr><th class="rname">${esc(branchName(b))}</th>${WEEK.map(w => `<th class="${w === 0 || w === 6 ? 'wkend' : ''}">${WD[w]}<small>${WD_FULL[w]}</small></th>`).join('')}<th>ต่อสัปดาห์</th></tr></thead><tbody>`;
  emps.forEach(e => {
    const x = patMinutes(e.id), bad = x.mins > MAX_WEEK_MIN || x.days > MAX_RUN;
    h += `<tr><td class="rname"><b>${esc(shortName(e))}</b><small>${esc(e.position || ROLE_NAME[e.role] || '')}</small></td>${WEEK.map(w => {
      const c = patVal(e.id, w), dirty = S.f.patPend && S.f.patPend[e.id] && ('d' + w) in S.f.patPend[e.id];
      const off = Calc.isOffCode(c) && c !== '', none = c === '';
      return `<td><button class="cellbtn${off ? ' off' : ''}${none ? ' def' : ''}${dirty ? ' dirty' : ''}" style="--sc:${off || none ? 'var(--muted)' : shiftColor(c)}" data-a="patCell:${e.id}/${w}" aria-label="${esc(shortName(e) + ' ' + WD_FULL[w] + ': ' + (none ? 'ยังไม่กำหนด' : off ? 'หยุด' : c))}"${edit ? '' : ' disabled'}><span class="pill">${none ? '–' : off ? 'หยุด' : esc(c)}</span></button></td>`;
    }).join('')}<td class="wk${bad ? ' bad' : ''}">${hrsShort(x.mins)}<br>${x.days} วัน</td></tr>`;
  });
  const sup = (code, w) => emps.filter(e => patVal(e.id, w) === Calc.upper(code)).length;
  h += `</tbody><tfoot>${needShifts(b).map(s => `<tr><td class="rname">กะ ${esc(s.code)} มี/ต้องการ</td>${WEEK.map(w => { const r = needRow(b, s.code); return covCell(sup(s.code, w), r ? num(r['d' + w]) : 0); }).join('')}<td></td></tr>`).join('')}</tfoot></table></div>`;
  const warn = emps.filter(e => { const x = patMinutes(e.id); return x.mins > MAX_WEEK_MIN || x.days > MAX_RUN; });
  if (warn.length) h += `<p class="note warn">${warn.map(e => esc(shortName(e))).join(', ')}: ทำงานเกิน 48 ชม. หรือไม่มีวันหยุดในสัปดาห์ ตามกฎหมายต้องมีวันหยุดอย่างน้อยสัปดาห์ละ 1 วัน และเวลาทำงานปกติไม่เกิน 48 ชม.</p>`;
  if (!needShifts(b).length) h += '<p class="note">ตั้งจำนวนคนที่ต้องการต่อกะที่แท็บ คนที่ต้องการ แล้วตารางนี้จะบอกว่ากะไหนคนไม่พอ</p>';
  return h;
}
function patTap(arg) {
  const [empId, w] = arg.split('/'), e = empById(empId); if (!e || !can('schedule_edit')) return;
  const setVal = v => { S.f.patPend = S.f.patPend || {}; S.f.patPend[empId] = { ...(S.f.patPend[empId] || {}), ['d' + w]: v }; };
  if (S.f.brush) { setVal(S.f.brush === '_' ? '' : S.f.brush); App.render(); return; }
  const sh = openSheet(`<h3>${esc(shortName(e))} ทุกวัน${esc(WD_FULL[w])}</h3><div class="shiftlist">${shiftsFor(e.branch).map(s => `<button style="--sc:${esc(s.color || 'var(--mc)')}" data-pick="${esc(Calc.upper(s.code))}"><b>${esc(s.code)}</b><span>${esc(s.name)} ${esc(s.start)}–${esc(s.end)}</span></button>`).join('')}<button data-pick="OFF"><b>หยุด</b><span>วันหยุดประจำสัปดาห์</span></button><button data-pick=""><b>ไม่กำหนด</b><span>ใช้เวลาปกติของร้าน</span></button></div><div class="actions"><span class="grow"></span><button class="btn" data-a="close">ปิด</button></div>`);
  sh.addEventListener('click', ev => { const b = ev.target.closest('[data-pick]'); if (!b) return; setVal(b.dataset.pick); closeSheet(); App.render(); });
}
async function patSave(btn) {
  const pend = S.f.patPend || {}, ids = Object.keys(pend);
  if (!ids.length) return;
  const rows = ids.map(empId => { const r = { id: 'pat_' + empId, empId }; WEEK.forEach(w => { r['d' + w] = patVal(empId, w); }); return r; });
  const res = await busy(btn, () => DB.upsertMany('patterns', rows));
  S.f.patPend = {};
  const set = new Set(ids), sched = timeCtx().sched;
  relocalAtt(null, a => set.has(a.empId) && !(sched[a.date + '|' + a.empId] && String(sched[a.date + '|' + a.empId].shift || '').trim()));
  const n = res && res.extra && res.extra.recalc;
  toast(`บันทึกรูปแบบกะ ${rows.length} คน${n ? `, คิดเวลาทำงานย้อนหลังใหม่ ${n} รายการ` : ''}`);
  App.render();
}

/* ---------- คนที่ต้องการต่อกะ ---------- */
function pNeeds() {
  const b = oneBranch(), edit = can('schedule_edit'), list = shiftsFor(b);
  const emps = S.t.employees.filter(e => e.branch === b && e.status !== 'ลาออก');
  const sup = (code, w) => emps.filter(e => patVal(e.id, w) === Calc.upper(code)).length;
  let h = branchSeg() + `<p class="note">แต่ละกะต้องมีคนกี่คนในแต่ละวัน ระบบใช้ตัวเลขนี้เตือนในตารางเดือนและรูปแบบกะ เมื่อคนไม่พอ ตัวเลขเล็กใต้ช่อง = จำนวนคนตามรูปแบบกะตอนนี้</p>`;
  if (!list.length) return h + `<div class="group">${empty('ยังไม่มีกะ เพิ่มที่แท็บ กะทำงาน')}</div>`;
  h += `<div class="roster-wrap"><table class="roster"><thead><tr><th class="rname">${esc(branchName(b))}</th>${WEEK.map(w => `<th class="${w === 0 || w === 6 ? 'wkend' : ''}">${WD[w]}</th>`).join('')}</tr></thead><tbody>`;
  list.forEach(s => {
    const r = needRow(b, s.code) || {};
    h += `<tr><td class="rname"><b>${esc(s.code)} ${esc(s.name)}</b><small>${esc(s.start)}–${esc(s.end)}</small></td>${WEEK.map(w => `<td class="num"><input type="number" inputmode="numeric" min="0" max="50" data-need="${esc(Calc.upper(s.code))}/${w}" value="${esc(r['d' + w] ?? '')}" aria-label="${esc(s.code + ' ' + WD_FULL[w])}"${edit ? '' : ' disabled'}><span>มี ${sup(s.code, w)}</span></td>`).join('')}</tr>`;
  });
  h += '</tbody></table></div>';
  if (edit) h += `<div class="actions"><button class="btn" data-a="needCopy">ใช้ตัวเลขวันจันทร์กับทุกวัน</button><span class="grow"></span><button class="btn primary" data-a="needSave">บันทึก</button></div>`;
  return h;
}
async function needSave(btn) {
  const b = oneBranch(), by = {};
  $$('[data-need]').forEach(i => { const [code, w] = i.dataset.need.split('/'); (by[code] = by[code] || { id: 'need_' + b + '_' + code, branch: b, shift: code })['d' + w] = i.value === '' ? '' : Math.max(0, Math.round(+i.value)); });
  const rows = Object.values(by).filter(r => needRow(b, r.shift) || WEEK.some(w => r['d' + w] !== ''));
  if (!rows.length) return toast('ยังไม่ได้ใส่ตัวเลข');
  await busy(btn, () => DB.upsertMany('staffing', rows));
  toast('บันทึกจำนวนคนที่ต้องการแล้ว'); App.render();
}
function needCopy() { const mon = {}; $$('[data-need$="/1"]').forEach(i => { mon[i.dataset.need.split('/')[0]] = i.value; }); $$('[data-need]').forEach(i => { i.value = mon[i.dataset.need.split('/')[0]] ?? i.value; }); }

/* ---------- กะทำงาน ---------- */
const F_SHIFT = () => [
  { k: 'code', label: 'รหัสกะ', half: 1, req: 1, help: 'สั้นๆ เช่น M, L, P' }, { k: 'name', label: 'ชื่อกะ', half: 1, req: 1 },
  { k: 'start', label: 'เวลาเข้า', half: 1, type: 'time', req: 1 }, { k: 'end', label: 'เวลาออก', half: 1, type: 'time', req: 1 },
  { k: 'breakMin', label: 'พัก (นาที)', half: 1, type: 'number', help: 'หักเมื่อกะยาวเกิน 5 ชม.' },
  ...(S.t.branches.length > 1 ? [{ k: 'branch', label: 'ใช้ที่สาขา', half: 1, type: 'select', options: [['', 'ทุกสาขา'], ...branchOpts(S.t.branches)] }] : []),
  { k: 'color', label: 'สี', type: 'color' }
];
function pShifts() {
  const edit = can('schedule_edit'), list = S.t.shifts.filter(s => !s.branch || inBr(s.branch));
  return `<div class="h2">กะทำงาน ${list.length} กะ<span class="spacer"></span>${edit ? '<button class="btn primary" data-a="newShift">เพิ่มกะ</button>' : ''}</div>
  <div class="group">${list.map(s => `<button class="row" data-a="shift:${s.id}" style="--mc:${esc(s.color || 'var(--m-sched)')}"><span class="avatar" style="border-radius:12px">${esc(s.code)}</span><span class="main"><span class="t">${esc(s.name)} ${s.branch ? branchChip(s.branch) : ''}</span><span class="s">${esc(s.start)}–${esc(s.end)}, พัก ${num(s.breakMin)} นาที, ทำงาน ${hrsShort(Calc.planMinutes(s, S.settings))}${S.t.branches.length > 1 && !s.branch ? ', ใช้ได้ทุกสาขา' : ''}</span></span></button>`).join('') || empty('ยังไม่มีกะ')}</div>
  <p class="note">แก้เวลาของกะ ระบบคิดเวลาทำงานย้อนหลังของกะนั้นใหม่ให้ กะที่ใช้เฉพาะสาขา (เช่น กะดึกของสาขาที่เปิดถึง 22:00) ตั้ง "ใช้ที่สาขา" ได้</p>`;
}
function openShift(id) {
  const s = id ? S.t.shifts.find(x => x.id === id) : { breakMin: 60, color: SWATCHES[S.t.shifts.length % SWATCHES.length], branch: '' };
  openForm({
    title: id ? `กะ ${s.code}` : 'เพิ่มกะ', fields: F_SHIFT(), data: s, readOnly: !can('schedule_edit'),
    onSave: async v => {
      v.code = Calc.upper(v.code);
      if (!/^[A-Z0-9ก-๙]{1,4}$/.test(v.code) || ['OFF', 'X', 'H', 'C'].includes(v.code)) throw new Error('รหัสกะ 1–4 ตัวอักษร และห้ามใช้ OFF X H C');
      if (S.t.shifts.some(x => x.id !== v.id && Calc.upper(x.code) === v.code)) throw new Error('รหัสกะซ้ำ');
      await DB.upsert('shifts', v);
      relocalAtt(null, a => Calc.upper(a.planCode) === v.code);
    },
    onDelete: id && can('schedule_edit') ? async () => {
      const c = Calc.upper(s.code);
      if (S.t.schedule.some(r => Calc.upper(r.shift) === c) || S.t.patterns.some(p => WEEK.some(w => Calc.upper(p['d' + w]) === c))) throw new Error('กะนี้ถูกใช้ในตารางงานหรือรูปแบบกะ แก้เวลาแทนการลบ');
      await DB.remove('shifts', id);
    } : null
  });
}

/* ---------- นำเข้า/ส่งออก Excel (ทางเลือก) ---------- */
function pImport() {
  return `<p class="note">ปกติไม่ต้องใช้ Excel ตั้งรูปแบบกะแล้วสร้างตารางในระบบได้เลย หน้านี้สำหรับร้านที่มีตารางใน Excel อยู่แล้ว หรืออยากส่งไฟล์ให้พนักงาน</p>
  <div class="group">
    <button class="row" data-a="rosterFile"><span class="avatar" style="border-radius:12px">${icon('upload')}</span><span class="main"><span class="t">โหลดไฟล์ Excel หรือ CSV</span><span class="s">แถวหัวเป็นวันที่ คอลัมน์แรกเป็นรหัสหรือชื่อเล่นพนักงาน ช่องว่างไม่เปลี่ยนตารางเดิม</span></span></button>
    <button class="row" data-a="rosterPaste"><span class="avatar" style="border-radius:12px">${icon('sched')}</span><span class="main"><span class="t">วางจาก Excel หรือ Google Sheet</span><span class="s">คัดลอกทั้งตารางแล้ววาง</span></span></button>
    <button class="row" data-a="rosterTemplate"><span class="avatar" style="border-radius:12px">${icon('download')}</span><span class="main"><span class="t">ดาวน์โหลดตาราง${esc(thMonth(S.month))} ${esc(branchName(oneBranch()))}</span><span class="s">ใช้เป็นแบบฟอร์ม หรือส่งให้พนักงานดู</span></span></button>
  </div><input type="file" id="roster-file" accept=".xlsx,.xls,.csv" class="vh" data-file="roster" tabindex="-1" aria-hidden="true">
  <p class="note">คนที่นำเข้าได้ คือพนักงานในสาขาที่คุณดูแล ทุกช่องบันทึกเป็นการทำงานที่สาขาประจำของคนนั้น ถ้าจะส่งไปช่วยสาขาอื่น แก้ทีละช่องในตารางเดือน</p>`;
}
function parseDelimited(t, delim) {
  const rows = []; let row = [], cur = '', q = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (q) { if (c === '"') { if (t[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; continue; }
    if (c === '"') q = true;
    else if (c === delim) { row.push(cur); cur = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && t[i + 1] === '\n') i++; row.push(cur); rows.push(row); row = []; cur = ''; }
    else cur += c;
  }
  if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
  return rows;
}
const parseTable = text => { text = text.replace(/^﻿/, ''); const first = text.split(/\r?\n/)[0] || ''; return parseDelimited(text, first.split('\t').length > first.split(',').length ? '\t' : ','); };
function isoDate(y, m, d) { if (!(m >= 1 && m <= 12 && d >= 1 && d <= 31)) return null; const s = `${y}-${pad(m)}-${pad(d)}`; return d <= daysIn(s.slice(0, 7)) ? s : null; }
function headerDate(v, month) {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') {
    if (Number.isInteger(v) && v >= 1 && v <= 31) return isoDate(+month.slice(0, 4), +month.slice(5, 7), v);
    if (v > 20000 && v < 90000) { const d = new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 86400000); return isoDate(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()); }
    return null;
  }
  const s = String(v).trim(); let m;
  if ((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/))) return isoDate(+m[1], +m[2], +m[3]);
  if ((m = s.match(/^(\d{1,2})[/.](\d{1,2})(?:[/.](\d{2,4}))?$/))) {
    let y = m[3] ? +m[3] : +month.slice(0, 4);
    if (y < 100) y = y >= 50 ? 2500 + y - 543 : 2000 + y;
    if (y > 2400) y -= 543;
    return isoDate(y, +m[2], +m[1]);
  }
  if ((m = s.match(/^(\d{1,2})(?:\s+\D{1,4}\.?)?$/))) return isoDate(+month.slice(0, 4), +month.slice(5, 7), +m[1]);
  return null;
}
function rosterCell(v) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim(); if (!s) return null;
  const u = s.toUpperCase().replace(/\s+/g, '');
  if (['OFF', 'หยุด', 'X', '-', '—', 'วันหยุด', 'H'].includes(u)) return { shift: 'OFF' };
  if (/^ลา/.test(s)) return { shift: 'OFF', note: s, leave: true };
  const t = s.match(/^(\d{1,2})[:.](\d{2})\s*(?:-|–|—|~|ถึง)\s*(\d{1,2})[:.](\d{2})$/);
  if (t && +t[1] < 24 && +t[3] < 24 && +t[2] < 60 && +t[4] < 60) return { shift: 'C', start: `${pad(+t[1])}:${t[2]}`, end: `${pad(+t[3])}:${t[4]}` };
  const sh = timeCtx().shifts;
  if (sh[u]) return { shift: u };
  const byName = S.t.shifts.find(x => String(x.name || '').trim() === s);
  if (byName) return { shift: Calc.upper(byName.code) };
  return { unknown: s };
}
function matchEmp(cells, emps) {
  for (const c of cells) {
    const l = String(c ?? '').trim().toLowerCase(); if (!l) continue;
    const e = emps.find(x => String(x.code || '').toLowerCase() === l) || emps.find(x => [x.nickname, x.firstName, `${x.firstName || ''} ${x.lastName || ''}`.trim()].some(n => n && String(n).trim().toLowerCase() === l));
    if (e) return e;
  }
  return null;
}
function parseRoster(table, month) {
  const rows = table.map(r => (Array.isArray(r) ? r : []));
  for (const r of rows.slice(0, 3)) for (const c of r) { const m = String(c ?? '').match(/(?:^|\D)(\d{4})-(\d{2})(?!-?\d)/); if (m && +m[2] >= 1 && +m[2] <= 12) { month = `${m[1]}-${m[2]}`; break; } }
  let hi = -1, cols = [];
  rows.slice(0, 15).forEach((r, i) => { const c = r.map((v, j) => [j, headerDate(v, month)]).filter(x => x[1]); if (c.length > cols.length) { hi = i; cols = c; } });
  if (hi < 0) throw new Error('ไม่พบแถวหัวตารางที่เป็นวันที่ ใช้แบบฟอร์มจากปุ่มดาวน์โหลด หรือใส่วันที่ 1–31 ในแถวหัวตาราง');
  const firstCol = Math.min(...cols.map(c => c[0]));
  const emps = activeEmps(true);
  const out = [], unknownNames = [], unknownCodes = {}, perEmp = {}, leaves = [];
  rows.slice(hi + 1).forEach(r => {
    const idCells = r.slice(0, firstCol), dataCells = cols.map(([j]) => r[j]);
    if (!dataCells.some(v => String(v ?? '').trim())) return;
    const e = matchEmp(idCells, emps);
    if (!e) { const label = idCells.map(x => String(x ?? '').trim()).filter(Boolean).join(' '); if (label && !/^วัน|^คนเข้า|^รวม|^กะ/.test(label)) unknownNames.push(label); return; }
    cols.forEach(([j, d]) => {
      const c = rosterCell(r[j]);
      if (!c) return;
      if (c.unknown) { unknownCodes[c.unknown] = (unknownCodes[c.unknown] || 0) + 1; return; }
      if (c.leave) leaves.push(`${shortName(e)} ${thDate(d)}`);
      out.push({ date: d, empId: e.id, branch: e.branch, shift: c.shift, start: c.start || '', end: c.end || '', note: c.note || '' });
      perEmp[e.id] = (perEmp[e.id] || 0) + 1;
    });
  });
  const ds = cols.map(c => c[1]).sort();
  return { rows: out, unknownNames, unknownCodes, perEmp, leaves, from: ds[0], to: ds[ds.length - 1] };
}
async function readRosterFile(file) {
  if (/\.csv$|\.txt$/i.test(file.name)) return parseTable(await file.text());
  await ensureXlsx();
  const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
  return XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: true, defval: '' });
}
function previewRoster(r) {
  if (!r.rows.length) throw new Error('ไม่พบข้อมูลกะที่นำเข้าได้' + (r.unknownNames.length ? ` (ไม่รู้จักชื่อ: ${r.unknownNames.slice(0, 5).join(', ')})` : ''));
  const warn = [];
  if (r.unknownNames.length) warn.push(`ไม่พบพนักงานชื่อ ${r.unknownNames.slice(0, 6).map(esc).join(', ')} ใช้รหัสพนักงานหรือชื่อเล่นให้ตรงกับ HR (นำเข้าได้เฉพาะพนักงานสาขาที่คุณดูแล)`);
  const uc = Object.entries(r.unknownCodes);
  if (uc.length) warn.push(`ไม่รู้จักรหัสกะ ${uc.slice(0, 8).map(([c, n]) => `"${esc(c)}" ${n} ช่อง`).join(', ')} ช่องเหล่านี้จะไม่ถูกนำเข้า เพิ่มรหัสกะได้ที่แท็บ กะทำงาน`);
  if (r.leaves.length) warn.push(`ช่องที่เขียนว่า "ลา" ${r.leaves.length} ช่อง ใส่เป็นวันหยุดในตาราง การลาจริงต้องบันทึกที่ เวลาทำงาน > การลา`);
  const sh = openSheet(`<h3>ตรวจก่อนนำเข้าตารางงาน</h3><p class="muted">${thDate(r.from, { day: 'numeric', month: 'short', year: 'numeric' })} ถึง ${thDate(r.to, { day: 'numeric', month: 'short', year: 'numeric' })}, ${Object.keys(r.perEmp).length} คน, ${r.rows.length} ช่อง ช่องที่ว่างในไฟล์จะไม่เปลี่ยนตารางเดิม</p>
    ${warn.map(w => `<p class="note warn">${w}</p>`).join('')}
    <div class="preview"><table><thead><tr><th>พนักงาน</th><th>ช่อง</th><th>สรุป</th></tr></thead><tbody>${Object.entries(r.perEmp).map(([id, n]) => { const e = empById(id); const by = {}; r.rows.filter(x => x.empId === id).forEach(x => { const k = x.shift === 'C' ? 'กำหนดเวลา' : x.shift === 'OFF' ? 'หยุด' : x.shift; by[k] = (by[k] || 0) + 1; }); return `<tr><td>${esc(shortName(e))}</td><td>${n}</td><td>${Object.entries(by).map(([k, v]) => `${esc(k)} ${v}`).join(', ')}</td></tr>`; }).join('')}</tbody></table></div>
    <div class="actions"><span class="grow"></span><button class="btn" data-a="close">ยกเลิก</button><button class="btn primary" data-act="go">นำเข้า ${r.rows.length} ช่อง</button></div><p class="err" role="alert"></p>`);
  sh.addEventListener('click', async e => {
    const b = e.target.closest('[data-act="go"]'); if (!b) return;
    try {
      const res = await busy(b, () => saveSchedule(r.rows), 'กำลังนำเข้า…');
      closeSheet();
      if (r.from && r.from.slice(0, 7) !== S.month) S.month = r.from.slice(0, 7);
      location.hash = 'sched/month'; App.render();
      ensureMonth(S.month).then(ok => { if (ok) App.render(); }).catch(err => toast(err.message));
      const n = res && res.extra && res.extra.recalc;
      toast(`นำเข้าตารางงาน ${r.rows.length} ช่องแล้ว${n ? `, คิดเวลาทำงานใหม่ ${n} รายการ` : ''}`);
    } catch (err) { showErr(sh, err.message); }
  });
}
async function rosterFileChosen(file) {
  try { previewRoster(parseRoster(await readRosterFile(file), S.month)); }
  catch (e) { toast(e.message); }
}
function rosterPaste() {
  const sh = openSheet(`<h3>วางตารางงานจาก Excel หรือ Google Sheet</h3><p class="muted">คัดลอกทั้งตารางรวมแถวหัวที่เป็นวันที่ (1, 2, 3… หรือวันที่เต็ม) และคอลัมน์รหัสหรือชื่อเล่นพนักงาน แล้ววางที่นี่ เดือนที่ใช้: ${esc(thMonth(S.month))}</p><textarea class="code" rows="9" aria-label="ข้อมูลตารางงาน" placeholder="รหัส&#9;ชื่อ&#9;1&#9;2&#9;3&#10;A01&#9;แนน&#9;M&#9;M&#9;OFF"></textarea><div class="actions"><span class="grow"></span><button class="btn" data-a="close">ยกเลิก</button><button class="btn primary" data-act="go">ตรวจข้อมูล</button></div><p class="err" role="alert"></p>`);
  sh.addEventListener('click', e => {
    const b = e.target.closest('[data-act="go"]'); if (!b) return;
    try { previewRoster(parseRoster(parseTable($('textarea', sh).value), S.month)); } catch (err) { showErr(sh, err.message); }
  });
}
async function rosterTemplate(btn) {
  const m = S.month, dates = monthDates(m), b = oneBranch(), emps = homeEmps(b, m), ctx = timeCtx();
  const codes = shiftsFor(b).map(s => s.code).join(', ');
  const aoa = [['ตารางงาน', m, branchName(b), `ใส่รหัสกะ (${codes}) หรือ OFF = หยุด หรือเวลา เช่น 08:00-17:00 แล้วโหลดกลับเข้าระบบ ช่องว่าง = ไม่เปลี่ยน`],
    ['รหัส', 'ชื่อ', ...dates.map(d => `${+d.slice(8)} ${WD[Calc.weekday(d)]}`)],
    ...emps.map(e => [e.code || '', shortName(e), ...dates.map(d => { const p = Calc.planFor(e, d, ctx); if (p.branch !== b && !p.off) return (p.code || '') + '@' + p.branch; return p.off ? 'OFF' : p.name === 'กำหนดเวลาเอง' || !p.code ? `${p.start}-${p.end}` : p.code; })])];
  try {
    await busy(btn, ensureXlsx, 'กำลังเตรียมไฟล์…');
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = [{ wch: 8 }, { wch: 12 }, ...dates.map(() => ({ wch: 6 }))];
    XLSX.utils.book_append_sheet(wb, ws, 'ตารางงาน');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['รหัสกะ', 'ชื่อกะ', 'เข้า', 'ออก', 'พัก (นาที)'], ...shiftsFor(b).map(s => [s.code, s.name, s.start, s.end, s.breakMin]), ['OFF', 'วันหยุด', '', '', '']]), 'รหัสกะ');
    XLSX.writeFile(wb, `ตารางงาน-${b}-${m}.xlsx`);
  } catch (e) {
    download(`ตารางงาน-${b}-${m}.csv`, '﻿' + toCsv(aoa), 'text/csv;charset=utf-8');
    toast('โหลดตัวสร้างไฟล์ Excel ไม่ได้ ดาวน์โหลดเป็น CSV แทน (เปิดด้วย Excel ได้)');
  }
}

/** กะที่คนไม่พอ ใน 7 วันข้างหน้า ของสาขาที่ดูแล (ใช้ในเมนูและหน้าภาพรวม) */
function upcomingGaps(days = 7) {
  const T = today(), out = [], ctx = timeCtx();
  openBranches().filter(b => inBr(b.code)).forEach(b => {
    const emps = S.t.employees.filter(e => e.status !== 'ลาออก');
    for (let i = 0; i < days; i++) {
      const d = addDays(T, i), cov = coverage(b.code, d, emps, ctx);
      needShifts(b.code).forEach(s => { const need = needOn(b.code, s.code, d), have = cov[Calc.upper(s.code)] || 0; if (have < need) out.push({ b: b.code, d, code: s.code, short: need - have }); });
    }
  });
  return out;
}

defMod({
  key: 'sched', mod: 'sched', label: 'Schedule', icon: 'sched', group: 'People', desc: 'ตั้งตารางในระบบ รูปแบบกะ คนที่ต้องการ ยืมคนข้ามสาขา',
  perm: ['schedule_view', 'schedule_edit', 'time'],
  subs: [
    { key: 'month', label: 'Roster', perm: ['schedule_view', 'schedule_edit', 'time'], month: true, view: pRoster },
    { key: 'pattern', label: 'Shift Patterns', perm: ['schedule_view', 'schedule_edit', 'time'], view: pPatterns },
    { key: 'need', label: 'Staffing', perm: ['schedule_view', 'schedule_edit', 'time'], view: pNeeds },
    { key: 'shifts', label: 'Shifts', perm: ['schedule_view', 'schedule_edit'], view: pShifts },
    { key: 'import', label: 'Excel Import', perm: ['schedule_edit'], month: true, view: pImport }
  ],
  summary: () => {
    const T = today(), emps = activeEmps();
    const on = emps.filter(e => { const p = planOf(e, T); return !p.off && p.source !== 'ค่าตั้งต้น'; }).length;
    const gaps = can('schedule_edit') ? upcomingGaps().length : 0;
    return `วันนี้เข้ากะ ${on} คน` + (gaps ? `, 7 วันข้างหน้าคนไม่พอ ${gaps} กะ` : '');
  },
  acts: {
    cell: a => cellTap(a),
    brush: a => { S.f.brush = a; App.render(); },
    setBr: a => { setBranch(a); App.render(); },
    rosterSave: (a, b) => rosterSave(b), rosterDiscard: () => { S.f.pending = {}; rerenderKeep(); },
    rosterGen: () => rosterGen(),
    patCell: a => patTap(a), patSave: (a, b) => patSave(b), patDiscard: () => { S.f.patPend = {}; App.render(); },
    needSave: (a, b) => needSave(b), needCopy: () => needCopy(),
    rosterFile: () => { const f = $('#roster-file'); if (f) { f.value = ''; f.click(); } },
    rosterPaste: () => rosterPaste(), rosterTemplate: (a, b) => rosterTemplate(b),
    newShift: () => openShift(), shift: id => openShift(id)
  }
});
