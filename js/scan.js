/* นำเข้าเวลาจากเครื่องสแกนนิ้ว (26_Scanner.gs)
 * รองรับไฟล์ที่เครื่องส่งออก: ZKTeco attlog.dat / .txt (คั่นด้วย Tab), .csv, Excel (.xlsx/.xls)
 * หาเวลาในแต่ละบรรทัดเอง (ปี พ.ศ./ค.ศ. วันที่แบบ 2026-11-14 หรือ 14/11/2569) รหัสพนักงานคือช่องแรกที่ไม่ใช่วันเวลา
 * จับคู่ด้วยรหัสพนักงาน (หรือรหัสเครื่องสแกนในหน้าพนักงาน) ตรวจก่อนส่ง แล้วส่งเป็นชุดละ 2,000 รายการ */
'use strict';
const SCAN = { list: [], file: '' };
const DT_RE = /(\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}\/\d{1,2}\/\d{2,4})(?:[ T,;\t]+|\s*)(\d{1,2}:\d{2}(?::\d{2})?)/;
function scanParseRows(rows) {
  const out = [];
  let idCol = -1, dCol = -1, tCol = -1;
  const head = (rows[0] || []).map(x => String(x).toLowerCase());
  head.forEach((h, i) => {
    if (idCol < 0 && /(^|\b)(ac-?no|no\.?|id|user ?id|enroll|pin|emp|รหัส|เลขที่)/.test(h)) idCol = i;
    if (dCol < 0 && /(date|time|วันที่|เวลา|datetime|checktime)/.test(h)) dCol = i;
  });
  head.forEach((h, i) => { if (i !== dCol && /^(time|เวลา)$/.test(h.trim())) tCol = i; });
  rows.forEach((r, ri) => {
    const cells = r.map(x => x instanceof Date ? x.toISOString().slice(0, 19).replace('T', ' ') : String(x == null ? '' : x).trim());
    let ts = '', id = '';
    const line = cells.join('\t'), m = line.match(DT_RE);
    if (dCol >= 0 && tCol >= 0 && ri > 0) { const mm = (cells[dCol] + ' ' + cells[tCol]).match(DT_RE); if (mm) ts = mm[1] + ' ' + mm[2]; }
    else if (m) ts = m[1] + ' ' + m[2];
    if (!ts) return;
    if (idCol >= 0 && ri > 0 && cells[idCol]) id = cells[idCol];
    else id = cells.find(c => c && !DT_RE.test(c) && !/^\d{1,2}:\d{2}/.test(c) && !/^\d{4}[-/]/.test(c)) || '';
    id = id.replace(/^0+(?=\d)/, s => s);   // คงรูปเดิม เซิร์ฟเวอร์จับคู่ 001 = 1 = A001 ให้
    if (id) out.push({ id, ts });
  });
  return out;
}
async function scanReadFile(file) {
  if (/\.(xlsx|xls)$/i.test(file.name)) {
    await ensureXlsx();
    const wb = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true });
    return scanParseRows(XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: true, defval: '' }));
  }
  const txt = await file.text();
  return scanParseRows(txt.split(/\r?\n/).filter(l => l.trim()).map(l => l.split(/\t|,|;|\s{2,}/)));
}
/** จับคู่ฝั่งหน้าเว็บเพื่อแสดงตัวอย่าง (เซิร์ฟเวอร์จับคู่ซ้ำอีกครั้งด้วยกติกาเดียวกัน) */
function scanMatch(id) {
  const k = String(id).trim().toLowerCase(), es = S.t.employees;
  const ex = es.find(e => String(e.scanId || '').trim().toLowerCase() === k) || es.find(e => String(e.code || '').trim().toLowerCase() === k);
  if (ex) return ex;
  const d = (k.match(/(\d+)\s*$/) || [])[1];
  if (!d) return null;
  const list = es.filter(e => e.status !== 'ลาออก' && ((String(e.scanId || e.code).match(/(\d+)\s*$/) || [])[1] || 'x').replace(/^0+/, '') === d.replace(/^0+/, ''));
  return list.length === 1 ? list[0] : null;
}
function openScanImport() {
  SCAN.list = []; SCAN.file = '';
  const brs = myBranches();
  openSheet(`<h2 class="h2">นำเข้าเวลาจากเครื่องสแกนนิ้ว</h2>
    <p class="note" style="margin-top:0">ส่งออกไฟล์จากเครื่อง (USB) เช่น attlog.dat, .txt, .csv หรือ Excel แล้วเลือกไฟล์ด้านล่าง ระบบหาเวลาสแกนและรหัสพนักงานให้เอง สแกนแรกของกะ = เข้างาน สแกนสุดท้าย = ออกงาน นำเข้าซ้ำได้ไม่ซ้ำ</p>
    <div class="form">${brs.length > 1 ? `<div class="field"><label for="sc-br">เครื่องนี้อยู่สาขา</label><select id="sc-br">${brs.map(b => `<option value="${esc(b.code)}">${esc(b.name)}</option>`).join('')}</select></div>` : ''}
      <div class="field"><label for="sc-file">ไฟล์จากเครื่องสแกน</label><input type="file" id="sc-file" accept=".dat,.txt,.csv,.xlsx,.xls,text/plain"></div></div>
    <div id="sc-prev"></div>
    <div class="actions"><button class="btn primary" data-a="scanGo" disabled id="sc-go">นำเข้า</button><button class="btn" data-a="close">ปิด</button></div>
    ${S.me.role === 'owner' ? `<details style="margin-top:14px"><summary>ส่งอัตโนมัติจากเครื่อง/โปรแกรมเชื่อมต่อ (API)</summary><p class="note">โปรแกรมเชื่อมเครื่องสแกน POST ไปที่ URL Apps Script ด้วย <code>{"op":"scanPush","key":"…","punches":[{"id":"A123","ts":"2026-11-14 07:58:12","sn":"เลขเครื่อง"}]}</code> ผูกเลขเครื่องกับสาขาที่ ตั้งค่า (scanDevices: SN=B01)</p><p id="sc-key" class="note"></p><button class="btn sm" data-a="scanKeyNew">ออกกุญแจใหม่</button></details>` : ''}`);
  $('#sc-file').addEventListener('change', async ev => {
    const f = ev.target.files[0]; if (!f) return;
    try {
      SCAN.list = await scanReadFile(f); SCAN.file = f.name;
      const by = {}, miss = {};
      SCAN.list.forEach(p => { const e = scanMatch(p.id); if (e) { by[e.id] = by[e.id] || { e, n: 0, d: new Set() }; by[e.id].n++; by[e.id].d.add(p.ts.slice(0, 10)); } else miss[p.id] = (miss[p.id] || 0) + 1; });
      const dates = SCAN.list.map(p => p.ts).sort();
      $('#sc-prev').innerHTML = SCAN.list.length ? `<p class="status good">พบ ${fmt(SCAN.list.length)} สแกน ${dates.length ? `ช่วง ${esc(dates[0].slice(0, 16))} ถึง ${esc(dates[dates.length - 1].slice(0, 16))}` : ''}</p>
        <div class="group">${Object.values(by).map(x => `<div class="row static">${avatar(x.e)}<span class="main"><span class="t">${esc(shortName(x.e))} <span class="muted">${esc(x.e.code)}</span></span><span class="s">${x.n} สแกน · ${x.d.size} วัน</span></span></div>`).join('')}</div>
        ${Object.keys(miss).length ? `<p class="status bad">ไม่พบพนักงานของรหัส: ${Object.entries(miss).map(([k, n]) => `<b>${esc(k)}</b> (${n})`).join(', ')} — ใส่ "รหัสในเครื่องสแกนนิ้ว" ที่หน้าพนักงาน แล้วนำเข้าใหม่ได้</p>` : ''}` : '<p class="status bad">ไม่พบเวลาสแกนในไฟล์นี้</p>';
      $('#sc-go').disabled = !Object.keys(by).length;
    } catch (e) { $('#sc-prev').innerHTML = `<p class="status bad">${esc(e.message)}</p>`; }
  });
  if (S.me.role === 'owner' && !S.demo) scanKeyShow(null, false);
}
async function scanKeyShow(btn, renew) {
  try { const r = await (btn ? busy(btn, () => API.write({ op: 'scanKey', renew: renew ? 1 : 0 })) : API.write({ op: 'scanKey' })); const el = $('#sc-key'); if (el) el.innerHTML = 'กุญแจ: <code>' + esc(r.key) + '</code>'; } catch (e) { toast(e.message); }
}
async function scanGo(btn) {
  const br = $('#sc-br') ? $('#sc-br').value : '';
  const chunks = []; for (let i = 0; i < SCAN.list.length; i += 2000) chunks.push(SCAN.list.slice(i, i + 2000));
  let tot = { punches: 0, fresh: 0, days: 0, unmatched: {}, skippedFix: 0 };
  try {
    await busy(btn, async () => {
      for (let i = 0; i < chunks.length; i++) {
        btn.textContent = `กำลังนำเข้า ${i + 1}/${chunks.length}…`;
        const r = await API.write({ op: 'scanImport', punches: chunks[i], branch: br });
        tot.punches += r.punches; tot.fresh += r.fresh; tot.days += r.days; tot.skippedFix += r.skippedFix || 0; Object.assign(tot.unmatched, r.unmatched);
      }
    }, 'กำลังนำเข้า…');
    closeSheet();
    await bootstrap(); App.render();
    toast(`นำเข้าแล้ว ${fmt(tot.punches)} สแกน (ใหม่ ${fmt(tot.fresh)}) สร้าง/ปรับ ${tot.days} วันทำงาน${tot.skippedFix ? `, ข้าม ${tot.skippedFix} วันที่แก้เวลาแล้ว` : ''}${Object.keys(tot.unmatched).length ? ', มีรหัสไม่พบพนักงาน' : ''}`);
  } catch (e) { toast(e.message); }
}
