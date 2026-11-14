/* ระบบเงินเดือน (Owner และ HR): คิดจากการลงเวลา + ตารางงาน + การลาที่อนุมัติแล้ว → สลิป → ไฟล์โอน → ปิดงวด → งบกำไรขาดทุน
 * เงินเดือนจ่ายตามพนักงาน (สาขาประจำ) แต่ค่าแรงในงบกำไรขาดทุนแบ่งให้แต่ละสาขาตามชั่วโมงที่ไปทำงานจริง (branchSplit) */
/** สัดส่วนชั่วโมงทำงานในแต่ละสาขา ไม่มีการลงเวลา = สาขาประจำทั้งหมด */
function splitOf(att, home) {
  const by = {}; let tot = 0;
  att.forEach(a => { const b = a.branch || home, m = Math.max(1, num(a.workMin)); by[b] = (by[b] || 0) + m; tot += m; });
  if (!tot) return { [home]: 1 };
  Object.keys(by).forEach(k => { by[k] = by[k] / tot; });
  return by;
}
const splitStr = o => Object.entries(o).map(([k, v]) => k + ':' + Math.round(v * 1000) / 1000).join(',');
const splitParse = (s, home) => { const o = {}; String(s || '').split(',').forEach(x => { const [k, v] = x.split(':'); if (k && v !== undefined) o[k] = num(v); }); return Object.keys(o).length ? o : { [home || '']: 1 }; };
const splitText = (o, home) => Object.entries(o).filter(([k]) => k !== home).map(([k, v]) => `${branchName(k)} ${Math.round(v * 100)}%`).join(', ');
/** ค่าแรงรวม (ค่าจ้าง + ประกันสังคมส่วนนายจ้าง) ที่เป็นของสาขา b ('' = ทุกสาขา) */
const _payMemo = {};
const payAll = (month, f) => { const k = month + '|' + f + '|' + S.rev; if (!_payMemo[k]) { Object.keys(_payMemo).forEach(x => delete _payMemo[x]); _payMemo[k] = calcPayroll(month, f, true); } return _payMemo[k]; };
const laborCost = (month, f, b) => sum(payAll(month, f), r => (num(r.gross) + num(r.employerSso)) * (b ? (r.split[b] || 0) : 1));
const estTax = Calc.estTax;
const stripPay = r => { const o = { ...r }; delete o.emp; delete o.closed; delete o.minOk; delete o.split; return o; };
/** เงินเดือนทั้งงวด f = สัดส่วนของเดือนที่ผ่านไป (ใช้ประมาณการกลางเดือนในงบกำไรขาดทุน) */
function calcPayroll(month, f = 1, all = false) {
  // สูตรอยู่ใน shared/calc.js (Calc.payroll) ใช้ตัวเดียวกับ Apps Script ตอนปิดงวด ตัวเลขตรงกันทุกสตางค์
  const st = S.settings, year = month.slice(0, 4);
  const saved = {}; S.t.payroll.filter(p => p.period === month).forEach(p => { saved[p.empId] = p; });
  const emps = Calc.payrollEmps(S.t.employees.filter(e => (all || (myEmp(e) && inBr(e.branch))) && e.payType !== undefined), month, saved);
  const att = S.t.attendance.filter(a => (a.date || '').startsWith(month));
  const leaves = S.t.leaves.filter(l => l.status === 'อนุมัติ' && ((l.dateFrom || '').startsWith(year) || (l.dateTo || '').startsWith(year)));
  const otreq = (S.t.otreq || []).filter(r => r.status === 'อนุมัติ' && (r.date || '').startsWith(month));
  return emps.map(e => {
    const sv = saved[e.id];
    if (sv && sv.status === 'ปิดงวดแล้ว') return { ...sv, emp: e, closed: true, split: splitParse(sv.branchSplit, sv.branch || e.branch) };
    const mine = att.filter(a => a.empId === e.id);
    const r = Calc.payroll({ emp: e, month, f, today: today(), st, att: mine, leaves, otreq, saved: sv });
    const bsplit = splitOf(mine.filter(a => a.inTime), e.branch);
    return { ...r, emp: e, split: bsplit, branchSplit: splitStr(bsplit), minOk: !belowMin(e) };
  });
}
function pendingFor(m) {
  const mine = id => { const e = empById(id); return !!e && myEmp(e) && inBr(e.branch); };
  const a = S.t.attendance.filter(x => (x.date || '').startsWith(m) && mine(x.empId));
  return {
    ot: a.filter(x => x.otStatus === 'รออนุมัติ').length,
    off: a.filter(x => x.offStatus === 'รออนุมัติ').length,
    open: a.filter(x => x.inTime && !x.outTime && x.date < today()).length,
    lv: S.t.leaves.filter(l => (l.dateFrom || '').startsWith(m) && l.status === 'รออนุมัติ' && mine(l.empId)).length,
    fix: S.t.timefix.filter(f => (f.date || '').startsWith(m) && f.status === 'รออนุมัติ' && mine(f.empId)).length,
    miss: missingDays().filter(x => x.d.startsWith(m)).length
  };
}
function pPay() {
  const m = S.month, rows = calcPayroll(m), st = S.settings;
  const closed = rows.length > 0 && rows.every(r => r.closed);
  const P = pendingFor(m), pendN = P.ot + P.off + P.lv + P.fix + P.miss;
  let h = `<div class="sumbox"><p class="big">${baht(sum(rows, 'net'))}</p><p>ยอดโอนสุทธิ${thMonth(m)} ${rows.length} คน <span class="chip ${closed ? 'ok' : 'warn'}">${closed ? 'ปิดงวดแล้ว' : 'ยังไม่ปิดงวด'}</span></p><p class="muted">ต้นทุนนายจ้างรวม ${baht(sum(rows, 'gross') + sum(rows, 'employerSso'))} (ค่าจ้าง ${fmt(sum(rows, 'gross'))} + ประกันสังคมส่วนนายจ้าง ${fmt(sum(rows, 'employerSso'))})</p></div>`;
  if (!closed && (pendN || P.open)) h += `<div class="group pad" style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><span class="main note warn" style="margin:0">ก่อนปิดงวด: ${[P.lv && `ใบลา ${P.lv}`, P.ot && `OT ${P.ot}`, P.off && `ทำงานวันหยุด ${P.off}`, P.fix && `คำขอแก้เวลา ${P.fix}`, P.miss && `ไม่พบการลงเวลา ${P.miss}`, P.open && `ลืมลงเวลาออก ${P.open}`].filter(Boolean).join(', ')} รายการ ส่วนที่ยังไม่อนุมัติจะไม่ถูกนำมาคิดเงิน</span><a class="btn sm" href="#approve" style="--mc:var(--m-approve)">ไปหน้าอนุมัติ</a></div>`;
  const groups = !S.branch && multiBranch() ? myBranches().map(b => [b, rows.filter(r => r.emp.branch === b.code)]).filter(g => g[1].length) : [[null, rows]];
  h += groups.map(([b, list]) => `${b ? `<h3 class="h3">${esc(b.name)} <span class="muted">สุทธิ ${baht(sum(list, 'net'))}</span></h3>` : ''}<div class="group">${list.map(r => {
    const bits = [`ฐาน ${fmt(r.base)}`];
    if (num(r.otPay) + num(r.holPay)) bits.push(`OT/วันหยุด ${fmt(num(r.otPay) + num(r.holPay))}`);
    if (num(r.absentDed) + num(r.lateDed)) bits.push(`หักขาด/สาย ${fmt(num(r.absentDed) + num(r.lateDed))}`);
    if (num(r.sso)) bits.push(`ประกันสังคม ${fmt(r.sso)}`);
    if (num(r.tax)) bits.push(`ภาษี ${fmt(r.tax)}`);
    const sp = splitText(r.split, r.emp.branch), ch = [r.minOk === false ? '<span class="chip bad">ค่าจ้างต่ำกว่าขั้นต่ำ</span>' : '', sp ? `<span class="chip br">ไปช่วย ${esc(sp)}</span>` : ''].join('');
    return `<button class="row" data-a="pay:${r.empId}">${avatar(r.emp)}<span class="main"><span class="t">${esc(shortName(r.emp))}</span><span class="s">${bits.join(', ')}</span>${ch ? `<span class="chips">${ch}</span>` : ''}</span><span class="v">${fmt(r.net)}</span></button>`;
  }).join('') || empty('ยังไม่มีพนักงานในงวดนี้')}</div>`).join('');
  h += `
<div class="actions">${closed ? '<button class="btn" data-a="reopenPay">เปิดงวดเพื่อแก้ไข</button>' : '<button class="btn primary" data-a="closePay">ปิดงวดเงินเดือน</button>'}<button class="btn" data-a="payCsv">ไฟล์โอนเงิน (CSV)</button></div>
  <p class="note">หักขาดงานและมาสายคิดตามเวลาที่ไม่ได้ทำงานจริงเท่านั้น ห้ามหักเป็นค่าปรับ (พ.ร.บ.คุ้มครองแรงงาน มาตรา 76) ${(st.otRate === '' || st.otRate == null ? 50 : num(st.otRate)) > 0 ? `OT อัตราคงที่ ${st.otRate === '' || st.otRate == null ? 50 : num(st.otRate)} บาท/ชม. (ตั้งที่ Settings) กฎหมายกำหนด OT วันทำงานไม่น้อยกว่า 1.5 เท่าของค่าจ้างรายชั่วโมง ตรวจให้อัตรานี้ไม่ต่ำกว่านั้น` : 'OT วันทำงาน 1.5 เท่า'} ทำงานในวันหยุด เพิ่ม 1 เท่าสำหรับรายเดือน หรือ 2 เท่าสำหรับรายวัน/รายชั่วโมง OT ในวันหยุด 3 เท่า ภาษีหัก ณ ที่จ่ายเป็นประมาณการจากค่าใช้จ่ายและลดหย่อนพื้นฐาน${S.t.branches.length > 1 ? ' คนที่ไปช่วยสาขาอื่น ค่าแรงในงบกำไรขาดทุนแบ่งให้สาขานั้นตามชั่วโมงที่ไปทำงาน' : ''}</p>`;
  return h;
}
function slipLines(r) {
  const L = (l, v, c = 'ind') => `<tr class="${c}"><td>${l}</td><td>${v}</td></tr>`, m = fmtMoney;
  let s = L('รายได้', '', 'sub');
  s += L(r.payType === 'monthly' ? 'เงินเดือน' : r.payType === 'daily' ? `ค่าจ้างรายวัน (${r.workDays} วันทำงาน รวมวันลาและวันหยุดที่ได้ค่าจ้าง)` : `ค่าจ้างรายชั่วโมง (${hrsShort(r.workMin)})`, m(r.base));
  if (num(r.otPay)) s += L(`ค่าล่วงเวลา (${r.otMin} นาที)`, m(r.otPay));
  if (num(r.holPay)) s += L('ค่าทำงานในวันหยุด', m(r.holPay));
  if (num(r.allowance)) s += L('เบี้ยเลี้ยง/ค่าตำแหน่ง', m(r.allowance));
  if (num(r.bonus)) s += L('โบนัส/คอมมิชชัน', m(r.bonus));
  if (num(r.absentDed)) s += L(`วันที่ไม่ได้ทำงาน (${fmtQ(num(r.absent) + num(r.unpaid))} วัน)`, '−' + m(r.absentDed));
  if (num(r.lateDed)) s += L(`เวลาที่ไม่ได้ทำงานจากการมาสาย (${r.lateMin} นาที)`, '−' + m(r.lateDed));
  s += L('รวมเงินได้', m(r.gross), 'sub') + L('รายการหัก', '', 'sub') + L('ประกันสังคม', m(r.sso)) + L('ภาษีหัก ณ ที่จ่าย (ประมาณการ)', m(r.tax));
  if (num(r.otherDed)) s += L('หักอื่นๆ ตามที่พนักงานยินยอม', m(r.otherDed));
  return s + L('เงินได้สุทธิ', m(r.net), 'total');
}
function openPay(empId) {
  const r = calcPayroll(S.month).find(x => x.empId === empId); if (!r) return;
  const pf = [{ k: 'allowance', label: 'เบี้ยเลี้ยง/ค่าตำแหน่ง', half: 1, type: 'number' }, { k: 'bonus', label: 'โบนัส/คอมมิชชัน', half: 1, type: 'number' }, { k: 'otherDed', label: 'หักอื่นๆ (มีหนังสือยินยอม)', half: 1, type: 'number' }, { k: 'note', label: 'หมายเหตุ', half: 1 }];
  const sh = openSheet(`<h3>${esc(fullName(r.emp))}</h3><p class="muted">${thMonth(S.month)}, ${payLabel(r.emp)}, ลงเวลา ${r.workDays} วัน${num(r.lateMin) ? `, สายรวม ${r.lateMin} นาที` : ''}</p>
    <div class="group"><table class="stmt">${slipLines(r)}</table></div>
    ${r.closed ? '<p class="note">งวดนี้ปิดแล้ว ต้องเปิดงวดก่อนจึงแก้ไขได้</p>' : `<div class="form">${pf.map(f => fieldHTML(f, r[f.k] || '')).join('')}</div>`}
    <div class="actions"><button class="btn" data-act="slip">สลิปเงินเดือน</button><span class="grow"></span><button class="btn" data-act="cancel">ปิด</button>${r.closed ? '' : '<button class="btn primary" data-act="save">บันทึก</button>'}</div><p class="err" role="alert"></p>`);
  sh.addEventListener('click', async ev => {
    const b = ev.target.closest('[data-act]'); if (!b) return;
    const a = b.dataset.act;
    if (a === 'cancel') return closeSheet();
    if (a === 'slip') return openSlip(r);
    if (a === 'save') { try { await busy(b, () => DB.upsert('payroll', { ...stripPay(r), ...collect(sh, pf, {}), status: 'ร่าง' })); closeSheet(); App.render(); toast('บันทึกแล้ว'); } catch (e) { showErr(sh, e.message); } }
  });
}
function openSlip(r) {
  const st = S.settings;
  const sh = openSheet(`<div class="print-area slip"><h3>สลิปเงินเดือน</h3><p class="muted">${esc(st.shopName)}${r.emp.branch ? ' ' + esc(branchName(r.emp.branch)) : ''}, งวด${thMonth(r.period)}</p><p><b>${esc(fullName(r.emp))}</b> รหัส ${esc(r.emp.code || '')}<br>${esc(r.emp.position || '')}${r.emp.bank ? `, โอนเข้า ${esc(r.emp.bank)} ${esc(r.emp.bankAcct || '')}` : ''}</p><table class="stmt">${slipLines(r)}</table></div>
    <div class="actions"><button class="btn primary" data-act="print">พิมพ์หรือบันทึกเป็น PDF</button><span class="grow"></span><button class="btn" data-act="cancel">ปิด</button></div>`);
  sh.addEventListener('click', e => { const a = e.target.closest('[data-act]'); if (!a) return; if (a.dataset.act === 'print') window.print(); else closeSheet(); });
}
async function closePay(btn) {
  const m = S.month, rows = calcPayroll(m).filter(r => !r.closed);
  if (!rows.length) return toast('ไม่มีรายการให้ปิดงวด');
  const P = pendingFor(m);
  const go = async () => {
    const now = new Date().toISOString();
    const res = await busy(btn, () => DB.upsertMany('payroll', rows.map(r => ({ ...stripPay(r), status: 'ปิดงวดแล้ว', closedAt: now }))));
    // ตัวเลขที่บันทึกคิดใหม่ที่ฝั่ง Google จากข้อมูลเต็ม (25_Payroll.gs) ถ้าต่างจากหน้าจอ แจ้งให้รู้
    const back = (res && res.rows) || [], diff = r2(sum(back, 'net') - sum(rows, 'net'));
    toast(diff ? `ปิดงวดแล้ว ยอดสุทธิจากข้อมูลเต็มต่างจากหน้าจอ ${fmt(diff)} บาท (ใช้ยอดจากข้อมูลเต็ม)` : 'ปิดงวดแล้ว ตัวเลขตรงกับข้อมูลในชีตทุกบาท ค่าแรงถูกนำเข้างบกำไรขาดทุนเดือนนี้'); App.render();
  };
  if (P.ot + P.off + P.lv + P.fix + P.miss + P.open) return armed(btn, go, 'ยังมีรายการค้าง แตะอีกครั้งเพื่อปิดงวด');
  return go();
}
async function reopenPay(btn) {
  const rows = S.t.payroll.filter(p => p.period === S.month && p.status === 'ปิดงวดแล้ว').map(p => ({ ...p, status: 'ร่าง' }));
  await busy(btn, () => DB.upsertMany('payroll', rows)); toast('เปิดงวดแล้ว แก้ไขได้'); App.render();
}
function payCsv() {
  const rows = calcPayroll(S.month);
  const csv = toCsv([['รหัส', 'ชื่อ', 'สาขา', 'ธนาคาร', 'เลขบัญชี', 'ค่าจ้างรวม', 'ประกันสังคม', 'ภาษี', 'หักอื่น', 'โอนสุทธิ'], ...rows.map(r => [r.emp.code, `${r.emp.firstName || ''} ${r.emp.lastName || ''}`.trim(), r.emp.branch, r.emp.bank, r.emp.bankAcct, r2(r.gross), r.sso, r.tax, r.otherDed, r2(r.net)])]);
  showText('ไฟล์โอนเงินเดือน ' + thMonth(S.month), csv, `payroll-${S.month}${S.branch ? '-' + S.branch : ''}.csv`);
}

defMod({
  key: 'pay', mod: 'pay', label: 'Payroll', icon: 'pay', group: 'People', desc: 'คิดจากเวลาทำงาน OT ขาด ลา สาย', perm: ['payroll'], month: true,
  view: pPay,
  summary: () => { const rows = calcPayroll(S.month); return `${thMonth(S.month)} สุทธิ ${baht(sum(rows, 'net'))}`; },
  acts: { pay: id => openPay(id), closePay: (a, b) => closePay(b), reopenPay: (a, b) => reopenPay(b), payCsv: () => payCsv() }
});
