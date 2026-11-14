/* ภาพรวมร้าน (เฉพาะ Owner): กำไรเดือนนี้ (รวมหรือรายสาขา), เปรียบเทียบสาขา, ใครเข้ากะวันนี้เทียบกับการลงเวลาจริง, คนไม่พอ, งานค้าง, ยอดขายรายวัน */
function salesChart(m) {
  const days = daysIn(m), vals = [];
  for (let i = 1; i <= days; i++) { const d = `${m}-${pad(i)}`; vals.push(sum(S.t.sales.filter(s => s.date === d && inBr(s.branch)), saleTotal)); }
  const max = Math.max(...vals, 1), w = 620, h = 130, bw = w / days;
  return `<svg class="chart" viewBox="0 0 ${w} ${h + 20}" role="img" aria-label="กราฟยอดขายรายวัน ${thMonth(m)}">${vals.map((v, i) => `<rect x="${(i * bw + 1.5).toFixed(1)}" y="${(h - v / max * h).toFixed(1)}" width="${Math.max(1, bw - 3).toFixed(1)}" height="${(v / max * h).toFixed(1)}" rx="2"><title>วันที่ ${i + 1}: ${fmt(v)} บาท</title></rect>`).join('')}${[1, 10, 20, days].map(d => `<text x="${((d - 0.5) * bw).toFixed(1)}" y="${h + 16}" text-anchor="middle">${d}</text>`).join('')}</svg>`;
}
/** ตารางงานวันนี้ เทียบกับการลงเวลาจริง (ระบบตารางงาน + ลงเวลา + การลา) */
function todayRoster() {
  const T = today(), now = new Date(), nowMin = now.getHours() * 60 + now.getMinutes();
  const guests = S.t.employees.filter(e => !inBr(e.branch) && S.branch && planOf(e, T).branch === S.branch && !planOf(e, T).off);
  return [...activeEmps(), ...guests].filter(e => planOf(e, T).source !== 'ค่าตั้งต้น' || S.t.attendance.some(x => x.empId === e.id && x.date === T)).map(e => {
    const p = planOf(e, T), lv = leaveOn(e.id, T, ['อนุมัติ']), a = S.t.attendance.find(x => x.empId === e.id && x.date === T && x.inTime);
    let st, cls = '';
    if (a) { st = `เข้า ${a.inTime}${a.outTime ? ' ออก ' + a.outTime : ''}`; cls = num(a.lateMin) ? 'warn' : 'ok'; if (num(a.lateMin)) st += `, สาย ${a.lateMin} นาที`; if (p.off) { st += ', วันหยุดของตัวเอง'; cls = 'warn'; } }
    else if (lv) { st = lv.type; cls = ''; }
    else if (p.off) { st = 'หยุด'; cls = ''; }
    else if (S.branch && p.branch !== S.branch) { st = 'ไปช่วย' + branchName(p.branch); cls = ''; }
    else if (nowMin > toMin(p.start) + num(S.settings.lateGrace)) { st = 'ยังไม่ลงเวลา'; cls = 'bad'; }
    else { st = 'ยังไม่ถึงเวลา'; }
    return { e, p, st, cls, sort: p.off && !a ? 9999 : toMin(p.start) || 0 };
  }).sort((x, y) => x.sort - y.sort);
}
function pDash() {
  const p = pnl(S.month), rev = p.revenue;
  const segs = [['วัตถุดิบและของเสีย', p.cogs, 's-cogs'], ['ค่าแรงและประกันสังคม', p.labor, 's-labor'], ['ค่า Royalty และการตลาด', p.royalty + p.mkt, 's-fr'], ['ค่าเช่า น้ำ ไฟ', p.occupancy, 's-rent'], ['อื่นๆ และค่าเสื่อม', p.otherExp + p.pos + p.amort, 's-other']];
  if (p.profit > 0) segs.push(['กำไร', p.profit, 's-profit']);
  const scale = Math.max(rev, p.totalCost, 1), per = v => rev > 0 ? (v / rev * 100).toFixed(1) : '0.0';
  const per2 = (a, b) => (a / b * 100).toFixed(1) + '%';
  const lead = rev <= 0 ? `ยังไม่มียอดขายใน${thMonth(S.month)}` : p.profit >= 0 ? `ขายได้ทุก 100 บาท เหลือเป็นกำไร ${per(p.profit)} บาท` : `ขายได้ทุก 100 บาท ยังขาดทุน ${per(-p.profit)} บาท`;
  const notes = [];
  if (p.isCur) notes.push(`เดือนนี้ยังไม่จบ ต้นทุนคงที่ปันส่วนตามวันที่ผ่านไป ${p.elapsed}/${p.dim} วัน`);
  if (p.laborEst) notes.push('ค่าแรงเป็นประมาณการจนกว่าจะปิดงวดเงินเดือน');
  let h = `<section class="hero"><p class="muted" style="margin:0">${thMonth(S.month)}${S.branch ? ' ' + esc(branchName(S.branch)) : p.parts.length > 1 ? ' รวมทุกสาขา' : ''}</p><h2 class="lead">${lead}</h2>
    <div class="bar" role="img" aria-label="สัดส่วนต้นทุนเทียบยอดขาย">${segs.filter(s => s[1] > 0).map(s => `<span style="width:${(s[1] / scale * 100).toFixed(2)}%;background:var(--${s[2]})"></span>`).join('')}${p.profit < 0 && rev > 0 ? `<i class="rev-mark" style="left:${(rev / scale * 100).toFixed(2)}%" title="ยอดขาย"></i>` : ''}</div>
    <div class="legend">${segs.map(s => `<div><i style="background:var(--${s[2]})"></i><span>${s[0]}</span><b>${per(s[1])}</b></div>`).join('')}</div>
    ${notes.length ? `<p class="note">${notes.join(' ')}</p>` : ''}</section>`;
  const A = approvals(), sT = S.t.sales.filter(s => s.date === today() && inBr(s.branch)), low = lowStock(), gaps = upcomingGaps(3);
  if (!S.branch && p.parts.length > 1) h += `<h3 class="h3">แต่ละสาขา ${thMonth(S.month)}</h3><div class="brgrid">${p.parts.map(x => { const q = pnl(S.month, x.code); return `<button class="group pad tilebtn" data-a="setBr:${esc(x.code)}"><b>${esc(branchName(x.code))}</b><span class="big ${q.profit < 0 ? 'neg' : ''}">${q.profit >= 0 ? '' : '−'}${fmt(Math.abs(q.profit))}</span><span class="muted">${q.profit >= 0 ? 'กำไร' : 'ขาดทุน'} จากยอดขาย ${fmt(q.gross)}${q.revenue > 0 ? ` (${per2(q.profit, q.revenue)})` : ''}</span></button>`; }).join('')}</div>`;
  h += `<div class="split"><div><h3 class="h3">งานวันนี้</h3><div class="group">
    ${A.total ? `<a class="row" href="#approve" style="--mc:var(--m-approve)"><span class="avatar" style="border-radius:12px">${icon('approve')}</span><span class="main"><span class="t">รออนุมัติ ${A.total} รายการ</span><span class="s">${[A.L.length && `ใบลา ${A.L.length}`, A.OT.length && `OT ${A.OT.length}`, A.OFF.length && `ทำงานวันหยุด ${A.OFF.length}`, A.FIX.length && `แก้เวลา ${A.FIX.length}`, A.MV.length && `ปรับสต็อก ${A.MV.length}`, A.MISS.length && `ไม่พบการลงเวลา ${A.MISS.length}`].filter(Boolean).join(', ')}</span></span><span class="v" aria-hidden="true">›</span></a>` : ''}
    <a class="row" href="#acct/sales" style="--mc:var(--m-acct)"><span class="avatar" style="border-radius:12px">${icon('acct')}</span><span class="main"><span class="t">ยอดขายวันนี้</span><span class="s">${sT.length ? fmt(sum(sT, 'cups')) + ' แก้ว' + (multiBranch() && !S.branch ? `, ปิดยอดแล้ว ${sT.length}/${openBranches().length} สาขา` : '') : 'ยังไม่ปิดยอด'}</span></span><span class="v">${sT.length ? fmt(sum(sT, saleTotal)) : ''}</span></a>
    ${gaps.length ? `<a class="row" href="#sched/month" style="--mc:var(--m-sched)"><span class="avatar" style="border-radius:12px">${icon('sched')}</span><span class="main"><span class="t">3 วันข้างหน้าคนไม่พอ ${gaps.length} กะ</span><span class="s">${gaps.slice(0, 4).map(g => `${thDate(g.d)} ${multiBranch() && !S.branch ? esc(branchName(g.b)) + ' ' : ''}${esc(g.code)} ขาด ${g.short}`).join(', ')}</span></span><span class="v" aria-hidden="true">›</span></a>` : ''}
    ${low.length ? `<a class="row" href="#stock/onhand" style="--mc:var(--m-stock)"><span class="avatar" style="border-radius:12px">${icon('stock')}</span><span class="main"><span class="t">วัตถุดิบถึงจุดสั่งซื้อ ${low.length} รายการ</span><span class="s">${low.slice(0, 4).map(x => esc(x.i.name) + (multiBranch() && !S.branch ? ` (${esc(x.br)})` : '')).join(', ')}${low.length > 4 ? ' และอื่นๆ' : ''}</span></span></a>` : ''}
  </div></div>
  <div><h3 class="h3">ตารางงานวันนี้ เทียบการลงเวลา</h3><div class="group" data-mod="time">${todayRoster().map(r => `<div class="row static">${avatar(r.e)}<span class="main"><span class="t">${esc(shortName(r.e))}</span><span class="s">${r.p.off ? 'วันหยุดตามตาราง' : `${esc(r.p.code || '')} ${esc(r.p.start)}–${esc(r.p.end)}`}${multiBranch() && !S.branch ? ' ' + esc(branchName(r.p.branch)) : ''}</span></span><span class="chip ${r.cls}">${esc(r.st)}</span></div>`).join('') || empty('ยังไม่มีพนักงาน')}</div></div></div>`;
  h += `<h3 class="h3">สรุป${thMonth(S.month)}</h3><div class="group">
    ${statRow('ยอดขาย', baht(p.gross), `${fmt(p.cups)} แก้ว${p.cups ? `, เฉลี่ย ${fmt(p.gross / p.cups)} บาทต่อแก้ว` : ''}`)}
    ${statRow(p.profit >= 0 ? 'กำไรสุทธิ' : 'ขาดทุนสุทธิ', baht(p.profit), rev > 0 ? `อัตรากำไร ${per(p.profit)}%` : '')}
    ${p.be ? statRow('จุดคุ้มทุน', baht(p.be) + '/วัน', p.beCups ? `ต้องขายประมาณวันละ ${fmt(p.beCups)} แก้ว` : '') : ''}
    <a class="row" href="#acct/pnl"><span class="main"><span class="t">ดูงบกำไรขาดทุนเต็ม</span></span><span class="v" aria-hidden="true">›</span></a>
  </div>
  <h3 class="h3">ยอดขายรายวัน</h3><div class="group pad" data-mod="acct">${salesChart(S.month)}</div>`;
  return h;
}

defMod({
  key: 'dash', mod: 'dash', label: 'Dashboard', icon: 'dash', group: '', desc: 'กำไรเดือนนี้ ใครเข้ากะวันนี้ งานค้าง', perm: ['dash'], month: true,
  view: pDash,
  summary: () => { const p = pnl(S.month); return p.revenue > 0 ? `${p.profit >= 0 ? 'กำไร' : 'ขาดทุน'} ${baht(Math.abs(p.profit))} เดือนนี้` : 'ยังไม่มียอดขายเดือนนี้'; }
});
