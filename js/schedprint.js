/* พิมพ์ / Export ตารางทำงานรายเดือน (แบบฟอร์มพร้อมพิมพ์ แยกแต่ละสาขา)
 * - อ่านจากข้อมูลในระบบตอนกด (ตารางงาน รูปแบบกะ วันลา วันหยุดนักขัตฤกษ์) จึงเป็นข้อมูลล่าสุดเสมอ
 * - ดูสาขาเดียว = สาขานั้น / ดู "ทุกสาขา" = ทุกสาขาที่ดูแล หน้าละสาขา (สาขาที่เพิ่มในอนาคตมาเอง)
 * - อ่านอย่างเดียว ไม่บันทึกอะไร ไม่กระทบระบบอื่น */
'use strict';
const SP = {
  excelUrl: 'https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/exceljs.min.js',
  col: { wkend: 'C6E0B4', hol: 'F4B183', off: '92D050', leave: 'F8CBAD', away: 'D9D9D9', none: 'EDEDED', head: '1F4E3D', sec: 'E2EFDA', title: 'E8F0EA' },
  wdTh: ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'],
  leaveShort: { 'ลาป่วย': 'ป่วย', 'ลากิจ': 'กิจ', 'ลาพักร้อน': 'พักร้อน', 'ขาดงาน': 'ขาด', 'ลาไม่รับค่าจ้าง': 'ไม่รับเงิน' }
};
const spRoleGroup = r => r === 'manager' ? 'ผู้จัดการร้าน' : r === 'staff' ? 'พนักงาน' : 'อื่นๆ';
const spTime = t => String(t || '').replace(/^0(\d)/, '$1');

/** ข้อมูลตาราง 1 สาขา 1 เดือน (ใช้ทั้งพิมพ์และ Excel) */
function spBuild(b, m) {
  const dates = monthDates(m), ctx = timeCtx(), hol = ctx.hol || {}, home = homeEmps(b, m), guests = guestEmps(b, m);
  const perDay = dates.map(() => ({ work: 0, off: 0, leave: 0, sh: {} }));
  const shifts = shiftsFor(b);
  const mkRow = (e, guest, no) => {
    let work = 0, off = 0, mins = 0;
    const cells = dates.map((d, i) => {
      if (!employed(e, d)) return { t: '', k: 'none' };
      const p = Calc.planFor(e, d, ctx), here = (p.branch || e.branch) === b;
      if (guest && !here) return { t: '', k: 'none' };
      if (!here && !p.off) return { t: '→' + (p.branch || ''), k: 'away' };
      const lv = leaveOn(e.id, d, ['อนุมัติ']);
      if (lv) { perDay[i].leave++; off++; return { t: SP.leaveShort[lv.type] || 'ลา', k: 'leave' }; }
      if (p.off) { perDay[i].off++; off++; return { t: 'หยุด', k: 'off' }; }
      if (p.source === 'ค่าตั้งต้น') return { t: '', k: 'blank' };
      work++; mins += Calc.planMinutes(p, S.settings); perDay[i].work++;
      const code = p.name === 'กำหนดเวลาเอง' ? spTime(p.start) + '-' + spTime(p.end) : (p.code || '');
      if (p.code && p.name !== 'กำหนดเวลาเอง') perDay[i].sh[Calc.upper(p.code)] = (perDay[i].sh[Calc.upper(p.code)] || 0) + 1;
      const s = ctx.shifts[Calc.upper(p.code)];
      return { t: code, k: 'shift', c: s && s.color };
    });
    const pat = ctx.patterns[e.id], loop = pat ? [1, 2, 3, 4, 5, 6, 0].filter(w => Calc.isOffCode(pat['d' + w])).map(w => SP.wdTh[w]).join('-') : '';
    return { no, first: e.firstName || '', last: e.lastName || '', nick: e.nickname || '', code: e.code || '', pos: guest ? 'จาก ' + branchName(e.branch) : (e.position || ROLE_NAME[e.role] || ''), loop, cells, work, off, hrs: Math.round(mins / 6) / 10 };
  };
  const groups = [];
  home.forEach(e => { const g = spRoleGroup(e.role); let G = groups.find(x => x.name === g); if (!G) groups.push(G = { name: g, rows: [] }); G.rows.push(mkRow(e, false, G.rows.length + 1)); });
  if (guests.length) groups.push({ name: 'มาช่วยจากสาขาอื่น', rows: guests.map((e, i) => mkRow(e, true, i + 1)) });
  const br = branchBy(b) || {};
  return { b, m, br, dates, hol, groups, perDay, shifts, st: S.settings };
}

/* ---------- พิมพ์ (หน้าเว็บพร้อมพิมพ์ / บันทึกเป็น PDF) ---------- */
function spPageHTML(R) {
  const C = SP.col, st = R.st, n = R.dates.length;
  const dayCls = d => { const w = Calc.weekday(d); return R.hol[d] ? 'hol' : (w === 0 || w === 6 ? 'wk' : ''); };
  const head1 = R.dates.map(d => `<th class="${dayCls(d)}">${SP.wdTh[Calc.weekday(d)]}</th>`).join('');
  const head2 = R.dates.map(d => `<th class="${dayCls(d)}" title="${esc(R.hol[d] || '')}">${+d.slice(8)}</th>`).join('');
  let body = '';
  R.groups.forEach(G => {
    body += `<tr class="sec"><td colspan="${7 + n + 3}">${esc(G.name)}</td></tr>`;
    G.rows.forEach(r => {
      body += `<tr><td class="c">${r.no}</td><td class="l">${esc(r.first)}</td><td class="l">${esc(r.last)}</td><td class="c">${esc(r.nick)}</td><td class="c">${esc(r.code)}</td><td class="c sm">${esc(r.pos)}</td><td class="c sm">${esc(r.loop)}</td>`
        + r.cells.map((c, i) => `<td class="d ${c.k} ${c.k === 'shift' || c.k === 'blank' ? dayCls(R.dates[i]) + 'l' : ''}"${c.k === 'shift' && c.c ? ` style="color:${esc(c.c)}"` : ''}>${esc(c.t)}</td>`).join('')
        + `<td class="c b">${r.work}</td><td class="c b">${r.off}</td><td class="c">${r.hrs}</td></tr>`;
    });
  });
  const codes = R.shifts.map(s => Calc.upper(s.code));
  const foot = codes.map(c => `<tr class="ft"><td colspan="7" class="r">คนเข้ากะ ${esc(c)}</td>${R.perDay.map(p => `<td class="d">${p.sh[c] || ''}</td>`).join('')}<td colspan="3"></td></tr>`).join('')
    + `<tr class="ft"><td colspan="7" class="r"><b>รวมคนทำงาน / วัน</b></td>${R.perDay.map(p => `<td class="d b">${p.work}</td>`).join('')}<td colspan="3"></td></tr>`
    + `<tr class="ft"><td colspan="7" class="r"><b>หยุด + ลา / วัน</b></td>${R.perDay.map(p => `<td class="d b offc">${p.off + p.leave || ''}</td>`).join('')}<td colspan="3"></td></tr>`;
  const legend = R.shifts.map(s => `<span><b style="color:${esc(s.color || '#333')}">${esc(s.code)}</b> ${esc(s.name || '')} ${esc(spTime(s.start))}–${esc(spTime(s.end))}${num(s.breakMin) ? ' (พัก ' + num(s.breakMin) + ' นาที)' : ''}</span>`).join('');
  const hols = R.dates.filter(d => R.hol[d]).map(d => `${+d.slice(8)} ${esc(R.hol[d])}`).join(' · ');
  return `<section class="page">
  <div class="t1">${esc(st.shopName || 'Café Amazon')} ${esc(R.br.name || R.b)} (${esc(R.b)}) · เวลาร้าน ${esc(st.shiftStart || '')}–${esc(st.shiftEnd || '')}${R.br.openDate ? ' · เปิดสาขา ' + esc(thDate(R.br.openDate)) : ''}</div>
  <div class="t2">ตารางทำงาน ${esc(thMonth(R.m))}</div>
  <table><colgroup><col style="width:2%"><col style="width:7%"><col style="width:7%"><col style="width:4.5%"><col style="width:3.5%"><col style="width:5.5%"><col style="width:4%">${R.dates.map(() => '<col>').join('')}<col style="width:2.6%"><col style="width:2.6%"><col style="width:2.8%"></colgroup><thead><tr><th rowspan="2">#</th><th rowspan="2">ชื่อ</th><th rowspan="2">นามสกุล</th><th rowspan="2">ชื่อเล่น</th><th rowspan="2">รหัส</th><th rowspan="2">ตำแหน่ง</th><th rowspan="2" class="sm">หยุด<br>ประจำ</th>${head1}<th rowspan="2" class="sm">วัน<br>ทำงาน</th><th rowspan="2" class="sm">วัน<br>หยุด</th><th rowspan="2" class="sm">ชม.</th></tr><tr>${head2}</tr></thead>
  <tbody>${body || `<tr><td colspan="${n + 10}" class="c">ยังไม่มีพนักงานในสาขานี้</td></tr>`}</tbody><tfoot>${foot}</tfoot></table>
  <div class="leg"><span class="k" style="background:#${C.off}">หยุด</span> วันหยุด <span class="k" style="background:#${C.leave}">ลา</span> ลา (อนุมัติแล้ว) <span class="k" style="background:#${C.away}">→</span> ไปช่วยสาขาอื่น <span class="k" style="background:#${C.wkend}">ส-อา</span> เสาร์–อาทิตย์ <span class="k" style="background:#${C.hol}">นักขัตฯ</span> วันหยุดนักขัตฤกษ์ ${legend}</div>
  ${hols ? `<div class="leg">วันหยุดนักขัตฤกษ์: ${hols}</div>` : ''}
  <div class="sign"><span>ผู้จัดทำ ...................................... วันที่ ........../........../..........</span><span>ผู้อนุมัติ ...................................... วันที่ ........../........../..........</span></div>
  <div class="gen">พิมพ์จากระบบ ${esc(new Date().toLocaleString('th-TH'))} · ข้อมูลตามระบบ ณ เวลาที่พิมพ์</div>
</section>`;
}
function spPrint(list) {
  const C = SP.col, w = window.open('', '_blank');
  if (!w) { toast('เบราว์เซอร์บล็อกหน้าต่างใหม่ อนุญาต Pop-up แล้วกดอีกครั้ง'); return; }
  const css = `@page{size:A4 landscape;margin:7mm}*{box-sizing:border-box}body{margin:0;font-family:"IBM Plex Sans Thai","Leelawadee UI",Tahoma,sans-serif;color:#111;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .bar{position:sticky;top:0;background:#fff;border-bottom:1px solid #ccc;padding:8px 12px;display:flex;gap:8px;align-items:center;font-size:14px}.bar button{font:inherit;padding:6px 14px;border-radius:8px;border:1px solid #1F4E3D;background:#1F4E3D;color:#fff;cursor:pointer}
  .page{padding:6px 4px;page-break-after:always;break-after:page}.page:last-child{page-break-after:auto;break-after:auto}
  .t1{background:#${C.title};text-align:center;font-size:11px;padding:3px;border:1px solid #999;border-bottom:0}.t2{background:#${C.head};color:#fff;text-align:center;font-size:15px;font-weight:600;padding:4px;border:1px solid #999}
  table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:8.5px}th,td{border:1px solid #9a9a9a;padding:2px 1px;overflow:hidden;white-space:nowrap;text-overflow:clip}
  thead th{background:#F2F2F2;font-weight:600}th.wk,td.wkl{background:#${C.wkend}}th.hol,td.holl{background:#${C.hol}}
  .c{text-align:center}.l{text-align:left;padding-left:3px}.r{text-align:right;padding-right:4px}.b{font-weight:600}.sm{font-size:7.5px;white-space:normal}
  td.d{text-align:center;font-weight:600}td.off{background:#${C.off}}td.leave{background:#${C.leave}}td.away{background:#${C.away};color:#555;font-weight:400;font-size:7px}td.none{background:#${C.none}}
  tr.sec td{background:#${C.sec};font-weight:600;text-align:left;padding-left:4px}tr.ft td{background:#FAFAFA}td.offc{color:#9C0006}
  colgroup col.n{width:3%}.leg{font-size:9px;margin-top:5px;display:flex;flex-wrap:wrap;gap:4px 12px;align-items:center}.k{display:inline-block;padding:0 5px;border:1px solid #999;font-weight:600}
  .sign{display:flex;justify-content:space-between;font-size:10px;margin-top:14px}.gen{font-size:8px;color:#777;margin-top:6px}
  @media print{.bar{display:none}}`;
  const pages = list.map(spPageHTML).join('');
  w.document.open();
  w.document.write(`<!doctype html><html lang="th"><head><meta charset="utf-8"><title>ตารางทำงาน ${esc(thMonth(list[0].m))}</title>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Thai:wght@400;600&display=swap"><style>${css}</style></head>
  <body><div class="bar"><b>ตารางทำงาน ${esc(thMonth(list[0].m))}</b><span>${list.length} สาขา · กระดาษ A4 แนวนอน</span><span style="flex:1"></span><button onclick="print()">พิมพ์ / บันทึก PDF</button></div>${pages}</body></html>`);
  w.document.close();
  setTimeout(() => { try { w.focus(); w.print(); } catch (e) { /* ผู้ใช้กดปุ่มพิมพ์เองได้ */ } }, 900);
}

/* ---------- Excel (.xlsx มีสีและเส้นตาราง พร้อมพิมพ์ แผ่นละสาขา) ---------- */
async function spExcel(list) {
  if (!window.ExcelJS) await loadScript(SP.excelUrl);
  const C = SP.col, wb = new ExcelJS.Workbook();
  wb.creator = 'Café back office';
  const fill = hex => ({ type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + hex } });
  const thin = { style: 'thin', color: { argb: 'FF9A9A9A' } }, border = { top: thin, left: thin, bottom: thin, right: thin };
  const used = {};
  list.forEach(R => {
    let name = String(R.br.name || R.b).replace(/[\\/?*[\]:]/g, ' ').slice(0, 28) || R.b;
    while (used[name]) name = name.slice(0, 25) + '_' + (used[name]++);
    used[name] = 1;
    const n = R.dates.length, totalCols = 7 + n + 3, ws = wb.addWorksheet(name, {
      pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.25, right: 0.25, top: 0.3, bottom: 0.3, header: 0.1, footer: 0.1 } },
      views: [{ state: 'frozen', xSplit: 7, ySplit: 4 }]
    });
    ws.columns = [{ width: 4 }, { width: 13 }, { width: 14 }, { width: 8 }, { width: 7 }, { width: 13 }, { width: 9 }, ...R.dates.map(() => ({ width: 5.2 })), { width: 6 }, { width: 6 }, { width: 6 }];
    const st = R.st;
    const r1 = ws.addRow([`${st.shopName || 'Café Amazon'} ${R.br.name || R.b} (${R.b}) · เวลาร้าน ${st.shiftStart || ''}–${st.shiftEnd || ''}`]);
    ws.mergeCells(1, 1, 1, totalCols); r1.getCell(1).alignment = { horizontal: 'center' }; r1.getCell(1).fill = fill(C.title); r1.getCell(1).font = { size: 10 };
    const r2 = ws.addRow([`ตารางทำงาน ${thMonth(R.m)}`]);
    ws.mergeCells(2, 1, 2, totalCols); r2.getCell(1).alignment = { horizontal: 'center' }; r2.getCell(1).fill = fill(C.head); r2.getCell(1).font = { size: 14, bold: true, color: { argb: 'FFFFFFFF' } }; r2.height = 22;
    const h1 = ws.addRow(['#', 'ชื่อ', 'นามสกุล', 'ชื่อเล่น', 'รหัส', 'ตำแหน่ง', 'หยุดประจำ', ...R.dates.map(d => SP.wdTh[Calc.weekday(d)]), 'วันทำงาน', 'วันหยุด', 'ชม.']);
    const h2 = ws.addRow(['', '', '', '', '', '', '', ...R.dates.map(d => +d.slice(8)), '', '', '']);
    [1, 2, 3, 4, 5, 6, 7, totalCols - 2, totalCols - 1, totalCols].forEach(c => ws.mergeCells(3, c, 4, c));
    [h1, h2].forEach(h => h.eachCell({ includeEmpty: true }, (cell, c) => {
      const d = R.dates[c - 8], w = d ? Calc.weekday(d) : -1;
      cell.fill = fill(d && R.hol[d] ? C.hol : (w === 0 || w === 6) ? C.wkend : 'F2F2F2');
      cell.font = { bold: true, size: 9 }; cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }; cell.border = border;
    }));
    R.groups.forEach(G => {
      const s = ws.addRow([G.name]); ws.mergeCells(s.number, 1, s.number, totalCols);
      s.getCell(1).fill = fill(C.sec); s.getCell(1).font = { bold: true, size: 10 }; s.getCell(1).border = border;
      G.rows.forEach(r => {
        const row = ws.addRow([r.no, r.first, r.last, r.nick, r.code, r.pos, r.loop, ...r.cells.map(c => c.t), r.work, r.off, r.hrs]);
        row.eachCell({ includeEmpty: true }, (cell, c) => {
          cell.border = border; cell.font = { size: 9 }; cell.alignment = { horizontal: c === 2 || c === 3 ? 'left' : 'center', vertical: 'middle' };
          const cc = r.cells[c - 8];
          if (cc) {
            const d = R.dates[c - 8], w = Calc.weekday(d);
            const bg = cc.k === 'off' ? C.off : cc.k === 'leave' ? C.leave : cc.k === 'away' ? C.away : cc.k === 'none' ? C.none : R.hol[d] ? C.hol : (w === 0 || w === 6) ? C.wkend : null;
            if (bg) cell.fill = fill(bg);
            cell.font = { size: 9, bold: cc.k !== 'away', color: cc.k === 'shift' && /^#[0-9a-f]{6}$/i.test(cc.c || '') ? { argb: 'FF' + cc.c.slice(1).toUpperCase() } : undefined };
          }
          if (c >= totalCols - 2) cell.font = { size: 9, bold: c < totalCols };
        });
      });
    });
    const footRow = (label, vals, color) => {
      const row = ws.addRow(['', '', '', '', '', '', label, ...vals, '', '', '']);
      ws.mergeCells(row.number, 1, row.number, 7);
      row.getCell(1).value = label;
      row.eachCell({ includeEmpty: true }, (cell, c) => { cell.border = border; cell.font = { size: 9, bold: true, color: color && c > 7 ? { argb: 'FF' + color } : undefined }; cell.alignment = { horizontal: c <= 7 ? 'right' : 'center' }; cell.fill = fill('FAFAFA'); });
    };
    R.shifts.forEach(s => footRow('คนเข้ากะ ' + s.code, R.perDay.map(p => p.sh[Calc.upper(s.code)] || '')));
    footRow('รวมคนทำงาน / วัน', R.perDay.map(p => p.work));
    footRow('หยุด + ลา / วัน', R.perDay.map(p => p.off + p.leave || ''), '9C0006');
    ws.addRow([]);
    const lg = ws.addRow(['รหัสกะ: ' + R.shifts.map(s => `${s.code} ${s.name || ''} ${spTime(s.start)}–${spTime(s.end)}`).join('   ·   ') + '   |   หยุด = วันหยุด · ป่วย/กิจ/พักร้อน = ลาที่อนุมัติแล้ว · → = ไปช่วยสาขาอื่น']);
    ws.mergeCells(lg.number, 1, lg.number, totalCols); lg.getCell(1).font = { size: 9 };
    const hols = R.dates.filter(d => R.hol[d]).map(d => `${+d.slice(8)} ${R.hol[d]}`).join(' · ');
    if (hols) { const hr = ws.addRow(['วันหยุดนักขัตฤกษ์: ' + hols]); ws.mergeCells(hr.number, 1, hr.number, totalCols); hr.getCell(1).font = { size: 9 }; }
    ws.addRow([]);
    const sg = ws.addRow(['ผู้จัดทำ ............................................ วันที่ ......../......../........            ผู้อนุมัติ ............................................ วันที่ ......../......../........']);
    ws.mergeCells(sg.number, 1, sg.number, totalCols); sg.getCell(1).font = { size: 10 };
    ws.pageSetup.printTitlesRow = '3:4';
  });
  const buf = await wb.xlsx.writeBuffer();
  const a = document.createElement('a'), url = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  a.href = url; a.download = `ตารางทำงาน_${list[0].m}${list.length === 1 ? '_' + list[0].b : '_ทุกสาขา'}.xlsx`;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/* ---------- ปุ่มในหน้า Schedule > Roster ---------- */
const spBranches = () => S.branch ? [S.branch] : openBranches().map(b => b.code);
function spInject() {
  if (!S.me || !S.route || S.route.mod !== 'sched' || S.route.sub !== 'month' || document.getElementById('sp-bar')) return;
  const view = document.getElementById('view'); if (!view || !oneBranch()) return;
  const n = spBranches().length;
  const bar = document.createElement('div');
  bar.id = 'sp-bar'; bar.className = 'actions'; bar.style.marginTop = '0';
  bar.innerHTML = `<span class="muted" style="align-self:center">ตารางพร้อมพิมพ์ ${esc(thMonth(S.month))}${n > 1 ? ` (${n} สาขา แผ่นละสาขา)` : ''}</span><span class="grow"></span><button class="btn" data-sp="print">${icon('download')}พิมพ์ / PDF</button><button class="btn" data-sp="xlsx">${icon('download')}Excel พร้อมพิมพ์</button>`;
  const seg = view.querySelector('.seg, .brseg');
  if (seg && seg.parentNode === view) seg.after(bar); else view.prepend(bar);
}
document.addEventListener('click', async e => {
  const btn = e.target.closest && e.target.closest('[data-sp]');
  if (!btn) return;
  const list = spBranches().map(b => spBuild(b, S.month));
  if (!list.length) { toast('ยังไม่มีสาขา'); return; }
  if (btn.dataset.sp === 'print') spPrint(list);
  else { try { await busy(btn, () => spExcel(list), 'กำลังสร้างไฟล์…'); } catch (err) { toast('สร้างไฟล์ไม่สำเร็จ: ' + err.message); } }
});
(function () {
  const r = App.render.bind(App);
  App.render = function () { const out = r.apply(this, arguments); try { spInject(); } catch (e) { /* ไม่ให้กระทบหน้าอื่น */ } return out; };
})();
