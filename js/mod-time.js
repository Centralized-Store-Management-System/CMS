/* ระบบเวลาทำงาน: ลงเวลา → การลา → เงินเดือน
 * แผนของแต่ละวันมาจากเมนู ตารางงาน (mod-schedule.js) ระบบใช้คิดสาย OT ทำงานวันหยุด และสาขาที่ต้องไปทำงาน */
const LEAVE_TYPES = ['ลาป่วย', 'ลากิจ', 'ลาพักร้อน', 'ขาดงาน', 'ลาไม่รับค่าจ้าง'];

/* ---------- ลงเวลา ---------- */
function attChips(a) {
  const c = [];
  if (num(a.lateMin)) c.push(`<span class="chip warn">สาย ${a.lateMin} นาที</span>`);
  if (num(a.otMin)) c.push(`<span class="chip ${a.otStatus === 'อนุมัติ' ? 'ok' : a.otStatus === 'ไม่อนุมัติ' ? 'bad' : 'warn'}">OT ${a.otMin} นาที ${esc(a.otStatus || '')}</span>`);
  if (a.offWork === 'true') c.push(`<span class="chip ${a.offStatus === 'อนุมัติ' ? 'ok' : 'warn'}">ทำงานวันหยุด ${esc(a.offStatus || '')}</span>`);
  else if (bool(a.holiday)) c.push('<span class="chip">วันหยุดตามประเพณี</span>');
  if (a.source && a.source !== 'gps') c.push(`<span class="chip">${a.source === 'manual' ? 'แก้ไขโดยหลังร้าน' : esc(a.source)}</span>`);
  if (a.inTime && !a.outTime && a.date < today()) c.push('<span class="chip bad">ลืมลงเวลาออก</span>');
  return c.join('');
}
function attRow(a) {
  const e = empById(a.empId) || {};
  const plan = a.planCode === '' && !a.planStart ? 'วันหยุด' : `กะ ${esc(a.planCode || '-')} ${esc(a.planStart || '')}${a.planEnd ? '–' + esc(a.planEnd) : ''}`;
  const dist = a.source === 'gps' && a.inDist !== '' && a.inDist != null ? `, ห่างร้าน ${a.inDist} ม.` : '';
  const e2 = empById(a.empId) || {}, ch = attChips(a) + (multiBranch() || (a.branch && a.branch !== e2.branch) ? branchChip(a.branch) + (a.branch && e2.branch && a.branch !== e2.branch ? '<span class="chip">ไปช่วยสาขาอื่น</span>' : '') : '');
  return `<button class="row" data-a="att:${a.id}">${avatar(e)}<span class="main"><span class="t">${esc(shortName(e))}</span><span class="s">เข้า ${esc(a.inTime || '–')} ออก ${esc(a.outTime || '–')}, ${a.offWork === 'true' ? 'วันหยุดตามตาราง' : plan}${dist}</span>${ch ? `<span class="chips">${ch}</span>` : ''}</span><span class="v">${a.outTime ? hrsShort(a.workMin) : ''}</span></button>`;
}
function pAtt() {
  const m = S.month, f = S.f.attEmp || '';
  const monthRows = S.t.attendance.filter(a => (a.date || '').startsWith(m) && attInBr(a));
  const rows = monthRows.filter(a => !f || a.empId === f).sort((a, b) => (b.date + (b.inTime || '')).localeCompare(a.date + (a.inTime || '')));
  const who = [...new Set([...activeEmps().map(e => e.id), ...monthRows.map(a => a.empId)])].map(empById).filter(Boolean);
  let h = `<div class="toolbar"><select data-ch="attEmp" aria-label="กรองตามพนักงาน"><option value="">ทุกคน</option>${who.map(e => `<option value="${esc(e.id)}"${e.id === f ? ' selected' : ''}>${esc(shortName(e))}${multiBranch() ? ' (' + esc(e.branch) + ')' : ''}</option>`).join('')}</select><button class="btn" data-a="newAtt">เพิ่มเวลาที่ลืมลง</button>${can('approve_time') ? '<button class="btn" data-a="recalcMonth">คิดใหม่ตามตาราง</button>' : ''}</div>
  <div class="group">${statRow(thMonth(m), '', `ลงเวลา ${rows.length} ครั้ง, สายรวม ${fmt(sum(rows, 'lateMin'))} นาที, OT อนุมัติแล้ว ${fmt(sum(rows.filter(a => a.otStatus === 'อนุมัติ'), 'otMin'))} นาที, รออนุมัติ ${fmt(sum(rows.filter(a => a.otStatus === 'รออนุมัติ'), 'otMin'))} นาที`)}</div>`;
  const by = {}; rows.forEach(a => { (by[a.date] = by[a.date] || []).push(a); });
  const dates = Object.keys(by);
  if (!dates.length) h += `<div class="group">${empty(`ยังไม่มีการลงเวลาใน${thMonth(m)}`)}</div>`;
  dates.forEach(d => { h += `<h3 class="h3">${thDate(d, { weekday: 'short', day: 'numeric', month: 'short' })}</h3><div class="group">${by[d].map(attRow).join('')}</div>`; });
  return h;
}
const F_ATT = () => [
  { k: 'empId', label: 'พนักงาน', type: 'select', options: empOpts(), req: 1 },
  { k: 'date', label: 'วันที่', half: 1, type: 'date', req: 1 }, { k: 'inTime', label: 'เวลาเข้า', half: 1, type: 'time', req: 1 },
  { k: 'outTime', label: 'เวลาออก', half: 1, type: 'time' },
  { k: 'note', label: 'เหตุผลที่แก้ไข', type: 'textarea' }
];
function openAtt(id, preset) {
  const a = id ? S.t.attendance.find(x => x.id === id) : { date: today(), source: 'manual', ...(preset || {}) };
  const ph = [a.inPhoto && ['เข้างาน', a.inPhoto], a.outPhoto && ['ออกงาน', a.outPhoto]].filter(Boolean);
  const extraHTML = (ph.length ? `<div class="photos">${ph.map(([l, p]) => `<button class="btn" data-act="ph" data-id="${esc(p)}">ดูรูปตอน${l}</button>`).join('')}</div>` : '') + '<p class="live"></p>';
  openForm({
    title: id ? 'แก้ไขเวลาทำงาน' : 'เพิ่มเวลาทำงาน', fields: F_ATT(), data: a, extraHTML,
    sub: id && a.source === 'gps' ? `ลงเวลาผ่าน GPS ห่างร้าน ${esc(a.inDist)} ม.` : 'ระบบคิดสาย OT และวันหยุดจากตารางงานของวันนั้นให้เอง',
    live: sh => {
      const v = collect(sh, F_ATT(), a), e = empById(v.empId), out = $('.live', sh);
      if (!e || !v.date || !v.inTime) { out.textContent = ''; return; }
      const p = planOf(e, v.date), r = Calc.calcAtt(v, p, S.settings);
      out.innerHTML = `ตามตาราง: ${esc(planLabel(p))}<br>สาย ${r.lateMin} นาที, ทำงาน ${hrsShort(r.workMin)}, OT ${r.otMin} นาที`;
    },
    onSave: async v => {
      if (!empById(v.empId)) throw new Error('เลือกพนักงาน');
      if (!id && S.t.attendance.some(x => x.empId === v.empId && x.date === v.date)) throw new Error('วันนี้มีรายการของพนักงานคนนี้แล้ว แตะรายการเดิมเพื่อแก้ไข');
      if (!id || v.inTime !== a.inTime || v.outTime !== a.outTime || v.date !== a.date) v.source = 'manual';
      const p = planOf(empById(v.empId), v.date);
      if (!v.branch || !id) v.branch = p.branch;
      Calc.applyPlan(v, p, S.settings);
      await DB.upsert('attendance', v);
    },
    onDelete: id && can('approve_time') ? () => DB.remove('attendance', id) : null,
    onAct: { ph: async b => { const url = await API.call('photo', { t: S.token, id: b.dataset.id }); b.outerHTML = `<figure><img src="${esc(url)}" alt=""></figure>`; } }
  });
}
async function recalcMonth(btn) {
  const rows = S.t.attendance.filter(a => (a.date || '').startsWith(S.month) && a.inTime && attInBr(a)).map(a => ({ ...a }));
  const changed = rows.filter(a => { const e = empById(a.empId); if (!e) return false; const before = [a.lateMin, a.workMin, a.otMin, a.planCode, a.offWork].join('|'); Calc.applyPlan(a, planOf(e, a.date), S.settings); return before !== [a.lateMin, a.workMin, a.otMin, a.planCode, a.offWork].join('|'); });
  if (!changed.length) return toast('เวลาทำงานทุกรายการตรงกับตารางงานแล้ว');
  await busy(btn, () => DB.upsertMany('attendance', changed));
  toast(`คิดใหม่ ${changed.length} รายการ`); App.render();
}

/* ---------- การลา ---------- */
function leaveRow(l) {
  const e = empById(l.empId) || {};
  const right = l.status === 'รออนุมัติ' && can('approve_time')
    ? `<span class="mini"><button class="btn sm primary" data-a="apLeave:${l.id}/อนุมัติ">อนุมัติ</button><button class="btn sm" data-a="apLeave:${l.id}/ไม่อนุมัติ">ไม่อนุมัติ</button></span>`
    : `<span class="chip ${l.status === 'อนุมัติ' ? 'ok' : l.status === 'รออนุมัติ' ? 'warn' : 'bad'}">${esc(l.status)}</span>`;
  return `<div class="row"><button class="rowmain" data-a="leave:${l.id}">${avatar(e)}<span class="main"><span class="t">${esc(shortName(e))}, ${esc(l.type)} ${fmtQ(l.days)} วัน</span><span class="s">${thDate(l.dateFrom)}${l.dateTo && l.dateTo !== l.dateFrom ? '–' + thDate(l.dateTo) : ''}${l.reason ? ', ' + esc(l.reason) : ''}${l.by ? `, บันทึกโดย ${esc(l.by)}` : ''}</span></span></button>${right}</div>`;
}
function pLeave() {
  const y = S.month.slice(0, 4), st = S.settings;
  const used = (eid, t) => sum(S.t.leaves.filter(l => l.empId === eid && l.type === t && l.status === 'อนุมัติ' && (l.dateFrom || '').startsWith(y)), 'days');
  const order = { รออนุมัติ: 0, อนุมัติ: 1, ไม่อนุมัติ: 2, ยกเลิก: 3 };
  const list = S.t.leaves.filter(l => (l.dateFrom || '').startsWith(y) && inBr((empById(l.empId) || {}).branch)).sort((a, b) => (order[a.status] ?? 4) - (order[b.status] ?? 4) || String(b.dateFrom).localeCompare(String(a.dateFrom)));
  return `<div class="h2">การลาและขาดงาน ปี ${+y + 543}<span class="spacer"></span><button class="btn primary" data-a="newLeave">บันทึกการลา</button></div>
  <div class="group">${list.map(leaveRow).join('') || empty('ยังไม่มีการลาในปีนี้')}</div>
  <h3 class="h3">สิทธิ์ลาที่ใช้ไป</h3><div class="group">${activeEmps().map(e => `<div class="row static">${avatar(e)}<span class="main"><span class="t">${esc(shortName(e))}</span><span class="s">ป่วย ${fmtQ(used(e.id, 'ลาป่วย'))}/${st.sickPaidDays}, กิจ ${fmtQ(used(e.id, 'ลากิจ'))}/${st.personalPaidDays}, พักร้อน ${fmtQ(used(e.id, 'ลาพักร้อน'))}/${st.annualDays}, ขาดงาน ${fmtQ(used(e.id, 'ขาดงาน'))} วัน</span></span></div>`).join('') || empty('ยังไม่มีพนักงาน')}</div>
  <p class="note">พนักงานส่งใบลาเองได้จากหน้าลงเวลา ใบลาจะเข้ามารออนุมัติที่นี่และที่หน้า อนุมัติ ลาเกินสิทธิ์ที่ได้ค่าจ้าง ระบบคิดเป็นวันไม่ได้รับค่าจ้างให้อัตโนมัติ</p>`;
}
const F_LEAVE = () => [
  { k: 'empId', label: 'พนักงาน', type: 'select', options: empOpts(), req: 1 },
  { k: 'type', label: 'ประเภท', half: 1, type: 'select', options: LEAVE_TYPES }, { k: 'days', label: 'จำนวนวัน', half: 1, type: 'number', help: 'ครึ่งวันใส่ 0.5 เว้นว่างให้นับเอง' },
  { k: 'dateFrom', label: 'ตั้งแต่', half: 1, type: 'date', req: 1 }, { k: 'dateTo', label: 'ถึง', half: 1, type: 'date', req: 1 },
  { k: 'reason', label: 'เหตุผล', type: 'textarea' }
];
function openLeave(id, preset) {
  const l = id ? S.t.leaves.find(x => x.id === id) : { type: 'ลาป่วย', dateFrom: today(), dateTo: today(), ...(preset || {}) };
  openForm({
    title: id ? 'แก้ไขการลา' : 'บันทึกการลาหรือขาดงาน', fields: F_LEAVE(), data: l,
    sub: id ? `สถานะ: ${esc(l.status)}` : (can('approve_time') ? 'คุณมีสิทธิ์อนุมัติ บันทึกแล้วถือว่าอนุมัติ' : 'ใบลาจะรอผู้มีสิทธิ์อนุมัติ'),
    onSave: async v => {
      if (v.dateTo < v.dateFrom) throw new Error('วันสิ้นสุดต้องไม่ก่อนวันเริ่ม');
      if (v.days === '' || v.days == null) v.days = Calc.dayCount(v.dateFrom, v.dateTo);
      if (!id) v.status = can('approve_time') ? 'อนุมัติ' : 'รออนุมัติ';
      await DB.upsert('leaves', v);
    },
    onDelete: id && can('approve_time') ? () => DB.remove('leaves', id) : null
  });
}

defMod({
  key: 'time', mod: 'time', label: 'Time Attendance', icon: 'time', group: 'People', desc: 'ลงเวลา การลา',
  perm: ['time', 'approve_time'],
  subs: [
    { key: 'att', label: 'Attendance', perm: ['time', 'approve_time'], month: true, view: pAtt },
    { key: 'leave', label: 'Leave', perm: ['time', 'approve_time'], month: true, view: pLeave }
  ],
  summary: () => {
    const T = today();
    const inNow = S.t.attendance.filter(a => a.date === T && a.inTime && !a.outTime && inBr(a.branch)).length;
    const lv = S.t.leaves.filter(l => l.status === 'อนุมัติ' && l.dateFrom <= T && (l.dateTo || l.dateFrom) >= T && inBr((empById(l.empId) || {}).branch)).length;
    return `ตอนนี้อยู่ในร้าน ${inNow} คน` + (lv ? `, ลาวันนี้ ${lv} คน` : '');
  },
  acts: {
    newAtt: () => openAtt(), att: id => openAtt(id), recalcMonth: (a, b) => recalcMonth(b),
    newLeave: () => openLeave(), leave: id => openLeave(id)
  }
});
