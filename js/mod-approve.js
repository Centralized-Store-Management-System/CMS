/* ศูนย์อนุมัติ: ใบลา OT ทำงานวันหยุด คำขอแก้เวลา คนที่ไม่มาตามตาราง (สิทธิ์ approve_time) และปรับยอดสต็อก (สิทธิ์ approve_stock)
 * เห็นเฉพาะสาขาที่ดูแล เลือกสาขาที่มุมบนเพื่อดูทีละสาขา */
let _miss = null, _missRev = -1;
/** วันที่มีกะตามตารางงานแต่ไม่พบการลงเวลา ไม่มีใบลา และไม่มีคำขอแก้เวลา (ย้อนหลัง 31 วัน) */
function missingDays() {
  if (_missRev === S.rev + '|' + S.branch && _miss) return _miss;
  const T = today(), from = addDays(T, -31), att = attIndex(), out = [];
  const fixes = new Set(S.t.timefix.filter(f => f.status === 'รออนุมัติ').map(f => f.date + '|' + f.empId));
  activeEmps().forEach(e => {
    for (let d = e.startDate && e.startDate > from ? e.startDate : from; d < T; d = addDays(d, 1)) {
      if (e.endDate && d > e.endDate) break;
      const k = d + '|' + e.id;
      if (att[k] || fixes.has(k) || leaveOn(e.id, d)) continue;
      const p = planOf(e, d);
      if (!p.off && p.source !== 'ค่าตั้งต้น') out.push({ e, d, p });
    }
  });
  _miss = out.sort((a, b) => b.d.localeCompare(a.d)); _missRev = S.rev + '|' + S.branch;
  return _miss;
}
function approvals() {
  const T = can('approve_time'), empIn = r => inBr((empById(r.empId) || {}).branch);
  const L = T ? S.t.leaves.filter(l => l.status === 'รออนุมัติ' && empIn(l)) : [];
  const OT = T ? S.t.attendance.filter(a => a.otStatus === 'รออนุมัติ' && num(a.otMin) > 0 && attInBr(a)) : [];
  const OFF = T ? S.t.attendance.filter(a => a.offStatus === 'รออนุมัติ' && a.offWork === 'true' && attInBr(a)) : [];
  const FIX = T ? S.t.timefix.filter(f => f.status === 'รออนุมัติ' && empIn(f)) : [];
  const OTR = T ? (S.t.otreq || []).filter(r => r.status === 'รออนุมัติ' && empIn(r)) : [];
  const MV = can('approve_stock') ? S.t.moves.filter(m => m.status === 'รออนุมัติ' && inBr(m.branch)) : [];
  const MISS = T ? missingDays() : [];
  return { L, OT, OTR, OFF, FIX, MV, MISS, total: L.length + OT.length + OTR.length + OFF.length + FIX.length + MV.length + MISS.length };
}
const yesNo = (act, id) => `<span class="mini"><button class="btn sm primary" data-a="${act}:${id}/อนุมัติ">อนุมัติ</button><button class="btn sm" data-a="${act}:${id}/ไม่อนุมัติ">ไม่อนุมัติ</button></span>`;
const section = (title, n, all, body, note) => `<div class="h2" style="margin-top:20px">${title} <span class="chip mc">${n}</span><span class="spacer"></span>${all && n > 1 ? `<button class="btn sm" data-a="apAll:${all}">อนุมัติทั้งหมด</button>` : ''}</div>${note ? `<p class="note" style="margin-top:-6px">${note}</p>` : ''}<div class="group">${body}</div>`;
function pApprove() {
  const A = approvals();
  let h = `<div class="sumbox"><p class="big">${A.total ? `รออนุมัติ ${A.total} รายการ` : 'ไม่มีรายการค้าง'}</p><p class="muted">${A.total ? 'รายการที่ยังไม่อนุมัติจะไม่ถูกนำไปคิดเงินเดือนและสต็อก' : 'ใบลา OT คำขอแก้เวลา และการปรับสต็อกใหม่ จะขึ้นที่นี่'}</p></div>`;
  if (A.L.length) h += section('ใบลา', A.L.length, 'L', A.L.map(leaveRow).join(''));
  if (A.OT.length) h += section('OT', A.OT.length, 'OT', A.OT.map(a => { const e = empById(a.empId) || {}; return `<div class="row">${avatar(e)}<span class="main"><span class="t">${esc(shortName(e))}, OT ${a.otMin} นาที ${branchChip(a.branch)}</span><span class="s">${thDate(a.date, { weekday: 'short', day: 'numeric', month: 'short' })} ออกงาน ${esc(a.outTime)} (กะเลิก ${esc(a.planEnd || '-')})</span></span>${yesNo('apOT', a.id)}</div>`; }).join(''), 'นับเฉพาะส่วนที่เกินเวลาเลิกกะ ปัดลงทีละ 15 นาที');
  if (A.OTR.length) h += section('คำขอ OT (พนักงานคีย์เอง)', A.OTR.length, 'OTR', A.OTR.map(r => { const e = empById(r.empId) || {}; return `<div class="row">${avatar(e)}<span class="main"><span class="t">${esc(shortName(e))}, OT ${num(r.minutes)} นาที</span><span class="s">${thDate(r.date, { weekday: 'short', day: 'numeric', month: 'short' })} ${esc(r.startTime)}–${esc(r.endTime)} · ${esc(r.reason)}</span></span><span class="mini"><button class="btn sm" data-a="apOTRedit:${r.id}">แก้นาที</button></span>${yesNo('apOTR', r.id)}</div>`; }).join(''), 'แก้นาทีก่อนอนุมัติได้ หรือกดจากการ์ดใน LINE');
  if (A.OFF.length) h += section('ทำงานในวันหยุดของตัวเอง', A.OFF.length, 'OFF', A.OFF.map(a => { const e = empById(a.empId) || {}; return `<div class="row">${avatar(e)}<span class="main"><span class="t">${esc(shortName(e))}, ${thDate(a.date, { weekday: 'short', day: 'numeric', month: 'short' })}</span><span class="s">เข้า ${esc(a.inTime)} ออก ${esc(a.outTime || '–')}, ตารางงานวันนี้เป็นวันหยุด</span></span>${yesNo('apOff', a.id)}</div>`; }).join(''), 'อนุมัติ = ได้ค่าทำงานในวันหยุดตามกฎหมาย ถ้าร้านไม่ได้สั่งให้มา กดไม่อนุมัติ');
  if (A.FIX.length) h += section('คำขอแก้เวลา / ลืมลงเวลา', A.FIX.length, 'FIX', A.FIX.map(f => {
    const e = empById(f.empId) || {}, cur = S.t.attendance.find(a => a.empId === f.empId && a.date === f.date);
    return `<div class="row">${avatar(e)}<span class="main"><span class="t">${esc(shortName(e))}, ${thDate(f.date, { weekday: 'short', day: 'numeric', month: 'short' })}</span><span class="s">ขอ${f.inTime ? ' เข้า ' + esc(f.inTime) : ''}${f.outTime ? ' ออก ' + esc(f.outTime) : ''}${cur ? ` (เดิม เข้า ${esc(cur.inTime || '–')} ออก ${esc(cur.outTime || '–')})` : ' (ไม่มีการลงเวลาเดิม)'}, ${esc(f.reason || '')}</span></span>${yesNo('apFix', f.id)}</div>`;
  }).join(''), 'อนุมัติแล้ว ระบบแก้เวลาและคิดสาย/OT ใหม่ให้เอง');
  if (A.MV.length) h += section('ปรับยอดสต็อกจากการตรวจนับ', A.MV.length, 'MV', A.MV.map(m => { const it = itemById(m.itemId) || {}; return `<div class="row"><span class="main"><span class="t">${esc(it.name || '(ไม่พบสินค้า)')} ${num(m.qty) > 0 ? '+' : ''}${fmtQ(m.qty)} ${esc(it.unit || '')} ${branchChip(m.branch)}</span><span class="s">${thDate(m.date)}, มูลค่า ${baht(Math.abs(num(m.qty) * num(m.unitCost)))}, โดย ${esc(m.by || '-')}${m.note ? ', ' + esc(m.note) : ''}</span></span>${yesNo('apMove', m.id)}</div>`; }).join(''));
  if (A.MISS.length) h += section('มีกะตามตาราง แต่ไม่พบการลงเวลา', A.MISS.length, '', A.MISS.slice(0, 60).map(x => `<div class="row">${avatar(x.e)}<span class="main"><span class="t">${esc(shortName(x.e))}, ${thDate(x.d, { weekday: 'short', day: 'numeric', month: 'short' })}</span><span class="s">${esc(planLabel(x.p))} (${esc(x.p.source)})</span></span><span class="mini"><button class="btn sm" data-a="miss:${x.e.id}/${x.d}/ขาดงาน">ขาดงาน</button><button class="btn sm" data-a="miss:${x.e.id}/${x.d}/ลาป่วย">ลาป่วย</button><button class="btn sm" data-a="miss:${x.e.id}/${x.d}/ลากิจ">ลากิจ</button><button class="btn sm" data-a="miss:${x.e.id}/${x.d}/off">เป็นวันหยุด</button><button class="btn sm" data-a="miss:${x.e.id}/${x.d}/add">ใส่เวลา</button></span></div>`).join(''), 'ย้อนหลัง 31 วัน ขาดงาน = หักเงินเดือนตามวันที่ไม่ได้ทำงาน, เป็นวันหยุด = แก้ตารางงานวันนั้นเป็นหยุด');
  return h;
}
/** อนุมัติแบบไม่ต้องรอ: รายการหายจากหน้าทันที ส่งเข้า Google เบื้องหลัง (fast.js) */
async function decide(table, field, id, status) {
  const r = S.t[table].find(x => x.id === id); if (!r) return;
  DB.bg(table, [{ ...r, [field]: status }]);
}
async function apFix(arg, btn) {
  const [id, st] = arg.split('/'), f = S.t.timefix.find(x => x.id === id); if (!f) return;
  const res = await busy(btn, () => DB.upsertMany('timefix', [{ ...f, status: st }]), '…');
  const extra = res && res.extra;
  if (extra && extra.attendance) extra.attendance.forEach(a => DB.local('attendance', a));
  toast(st === 'อนุมัติ' ? 'อนุมัติแล้ว แก้เวลาทำงานให้แล้ว' : 'บันทึกว่าไม่อนุมัติ'); App.render();
}
async function apAll(kind, btn) {
  const A = approvals();
  const go = async () => {
    if (kind === 'L') DB.bg('leaves', A.L.map(l => ({ ...l, status: 'อนุมัติ' })));
    if (kind === 'OT') DB.bg('attendance', A.OT.map(a => ({ ...a, otStatus: 'อนุมัติ' })));
    if (kind === 'OTR') DB.bg('otreq', A.OTR.map(r => ({ ...r, status: 'อนุมัติ' })));
    if (kind === 'OFF') DB.bg('attendance', A.OFF.map(a => ({ ...a, offStatus: 'อนุมัติ' })));
    if (kind === 'MV') DB.bg('moves', A.MV.map(m => ({ ...m, status: 'อนุมัติ' })));
    if (kind === 'FIX') { const res = await DB.upsertMany('timefix', A.FIX.map(f => ({ ...f, status: 'อนุมัติ' }))); if (res.extra && res.extra.attendance) res.extra.attendance.forEach(a => DB.local('attendance', a)); }
  };
  await armed(btn, async () => { await busy(btn, go, 'กำลังอนุมัติ…'); toast('อนุมัติทั้งหมดแล้ว'); App.render(); }, 'แตะอีกครั้งเพื่ออนุมัติทั้งหมด');
}
async function missAct(arg, btn) {
  const [empId, d, kind] = arg.split('/');
  if (kind === 'add') return openAtt(null, { empId, date: d });
  if (kind === 'off') { const e = empById(empId); await busy(btn, () => saveSchedule([{ date: d, empId, branch: e ? planOf(e, d).branch : '', shift: 'OFF', start: '', end: '', note: 'เปลี่ยนเป็นวันหยุดจากหน้าอนุมัติ' }]), '…'); toast('แก้ตารางงานเป็นวันหยุดแล้ว'); return App.render(); }
  await busy(btn, () => DB.upsert('leaves', { empId, type: kind, dateFrom: d, dateTo: d, days: 1, status: 'อนุมัติ', reason: 'บันทึกจากหน้าอนุมัติ (ไม่พบการลงเวลา)' }), '…');
  toast(`บันทึกเป็น${kind}แล้ว`); App.render();
}

defMod({
  key: 'approve', mod: 'approve', label: 'Approvals', icon: 'approve', group: '', desc: 'ใบลา OT แก้เวลา ปรับสต็อก คนไม่มาตามตาราง', perm: ['approve_time', 'approve_stock'],
  view: pApprove,
  badge: () => approvals().total,
  summary: () => { const n = approvals().total; return n ? `รออนุมัติ <em>${n}</em> รายการ` : 'ไม่มีรายการค้าง'; },
  acts: {
    apLeave: async (a, b) => { const [id, st] = a.split('/'); decide('leaves', 'status', id, st); toast(st === 'อนุมัติ' ? 'อนุมัติแล้ว' : 'บันทึกว่าไม่อนุมัติ'); App.render(); },
    apOT: async (a, b) => { const [id, st] = a.split('/'); decide('attendance', 'otStatus', id, st); toast('บันทึกแล้ว'); App.render(); },
    apOTR: async (a, b) => { const [id, st] = a.split('/'); decide('otreq', 'status', id, st); toast('บันทึกแล้ว'); App.render(); },
    apOTRedit: (a, b) => { const r = (S.t.otreq || []).find(x => x.id === a); if (!r) return; openForm({ title: 'อนุมัติ OT (แก้นาที)', fields: [{ k: 'otOk', label: `นาทีที่อนุมัติ (ขอ ${r.minutes})`, type: 'number', req: 1 }, { k: 'decideNote', label: 'หมายเหตุถึงพนักงาน' }], data: { otOk: r.otOk !== '' && r.otOk != null ? r.otOk : r.minutes, decideNote: '' }, saveLabel: 'อนุมัติ', savedMsg: 'อนุมัติ OT แล้ว', onSave: async v => { const ok = Math.max(0, Math.min(num(v.otOk), num(r.minutes))); await DB.upsertMany('otreq', [{ ...r, otOk: ok, decideNote: v.decideNote || '', status: 'อนุมัติ' }]); } }); },
    apOff: async (a, b) => { const [id, st] = a.split('/'); decide('attendance', 'offStatus', id, st); toast('บันทึกแล้ว'); App.render(); },
    apMove: async (a, b) => { const [id, st] = a.split('/'); decide('moves', 'status', id, st); toast('บันทึกแล้ว'); App.render(); },
    apFix: (a, b) => apFix(a, b), apAll: (a, b) => apAll(a, b), miss: (a, b) => missAct(a, b)
  }
});
