/* ตั้งค่า (เฉพาะ Owner): สาขาและพิกัดลงเวลา สัญญาแฟรนไชส์ของแต่ละสาขา, กฎเวลาและค่าจ้าง, วันหยุด, สิทธิ์ 4 ระดับ, ไฟล์และการเชื่อมต่อ, บันทึกการใช้งาน */
const DEFAULT_PERMS = { admin: ['users', 'admin'], hr: ['hr', 'payroll', 'approve_time', 'time', 'schedule_edit', 'schedule_view'], manager: ['time', 'schedule_edit', 'schedule_view', 'stock', 'sales'], staff: ['stock', 'schedule_view'] };
const PERM_ROLES = ['admin', 'hr', 'manager', 'staff'];
const CFG = {
  shop: [['กิจการ', [{ k: 'shopName', label: 'ชื่อร้าน/กิจการ', help: 'แสดงบนหน้าลงเวลาและสลิปเงินเดือน ชื่อแต่ละสาขาตั้งที่รายการสาขาด้านล่าง' }]]],
  rules: [['เวลาทำงาน (ใช้เมื่อพนักงานยังไม่มีรูปแบบกะ)', [
      { k: 'shiftStart', label: 'เข้างานปกติ', half: 1, type: 'time' }, { k: 'shiftEnd', label: 'เลิกงานปกติ', half: 1, type: 'time' },
      { k: 'hoursPerDay', label: 'ชั่วโมงทำงานต่อวัน', half: 1, type: 'number' }, { k: 'breakMin', label: 'พักระหว่างกะ (นาที)', half: 1, type: 'number' },
      { k: 'lateGrace', label: 'ผ่อนผันมาสาย (นาที)', half: 1, type: 'number' }, { k: 'otMinMinutes', label: 'OT ขั้นต่ำที่นับ (นาที)', half: 1, type: 'number' }, { k: 'otRate', label: 'ค่า OT (บาท/ชั่วโมง)', half: 1, type: 'number', help: 'อัตราคงที่ทุกคน ใส่ 0 = คิดตามกฎหมาย 1.5 เท่า (วันหยุด 3 เท่า) ของค่าจ้างรายชั่วโมง' }]],
    ['ค่าจ้างและสิทธิ์ตามกฎหมาย', [
      { k: 'minWage', label: 'ค่าแรงขั้นต่ำต่อวันของพื้นที่', half: 1, type: 'number', help: 'ตรวจประกาศคณะกรรมการค่าจ้างฉบับล่าสุด ถ้าสาขาอยู่ต่างจังหวัด ใช้อัตราที่สูงกว่า' },
      { k: 'sickPaidDays', label: 'ลาป่วยได้ค่าจ้าง (วัน/ปี)', half: 1, type: 'number' }, { k: 'personalPaidDays', label: 'ลากิจได้ค่าจ้าง (วัน/ปี)', half: 1, type: 'number' },
      { k: 'annualDays', label: 'พักร้อน (วัน/ปี)', half: 1, type: 'number', help: 'สิทธิ์เกิดเมื่อทำงานครบ 1 ปี' },
      { k: 'ssoRate', label: 'ประกันสังคม (%)', half: 1, type: 'number' }, { k: 'ssoFloor', label: 'ฐานค่าจ้างต่ำสุด', half: 1, type: 'number' },
      { k: 'ssoCeil', label: 'เพดานค่าจ้าง', half: 1, type: 'number', help: 'ปี 2569–2571 = 17,500' },
      { k: 'ssoIncludeOT', label: 'นำ OT รวมในฐานประกันสังคม', type: 'check' }]]],
  holidays: [['วันหยุดตามประเพณี (ใช้ทุกสาขา)', [{ k: 'holidays', label: 'บรรทัดละหนึ่งวัน เช่น 2026-12-05 วันพ่อแห่งชาติ', type: 'textarea', rows: 10, help: 'ร้านต้องประกาศอย่างน้อย 13 วันต่อปี รวมวันแรงงาน ใช้คิดค่าทำงานในวันหยุดและแสดงในตารางงาน' }]]],
  franchise: [['ค่าตั้งต้นสำหรับสาขาใหม่', [
      { k: 'royaltyPct', label: 'Royalty Fee (% ของยอดขาย)', half: 1, type: 'number', help: 'ยืนยันตัวเลขกับสัญญาแฟรนไชส์จริง' }, { k: 'marketingPct', label: 'Marketing Fee (% ของยอดขาย)', half: 1, type: 'number' },
      { k: 'posRentMonthly', label: 'ค่าเช่า POS ต่อเดือน', half: 1, type: 'number' },
      { k: 'amortMonths', label: 'ตัดจำหน่ายเงินลงทุนกี่เดือน', half: 1, type: 'number', help: 'สัญญา 6 ปี = 72 เดือน' }],
      '<p class="note">แต่ละสาขามีสัญญาของตัวเอง ตั้งค่า Royalty เงินลงทุน และค่าเช่า POS ของแต่ละสาขาได้ที่แท็บ สาขา ช่องที่เว้นว่างใช้ค่าตั้งต้นนี้</p>'],
    ['ภาษี', [{ k: 'vatRegistered', label: 'กิจการจดทะเบียนภาษีมูลค่าเพิ่ม (VAT)', type: 'check', help: 'ยอดขายรวมทุกสาขาเกิน 1.8 ล้านบาทต่อปี ต้องจด VAT' }]]]
};
const cfgFields = sub => (CFG[sub] || []).flatMap(g => g[1]);
function cfgView(sub) {
  const st = S.settings;
  return CFG[sub].map(([title, fields, extra]) => `<h3 class="h3">${title}</h3><div class="group pad"><div class="form">${fields.map(f => fieldHTML(f, st[f.k])).join('')}</div>${extra || ''}</div>`).join('') + `<div class="actions"><button class="btn primary big" data-a="saveCfg:${sub}">บันทึกการตั้งค่า</button></div>`;
}
const clockUrl = b => location.href.split(/[?#]/)[0].replace(/[^/]*$/, '') + clockLink(b || '');
const F_BRANCH = isNew => [
  { k: 'code', label: 'รหัสสาขา', half: 1, req: 1, help: isNew ? 'อังกฤษหรือตัวเลข เช่น B02 เปลี่ยนภายหลังไม่ได้' : 'เปลี่ยนไม่ได้ เพราะข้อมูลเดิมอ้างอิงรหัสนี้' }, { k: 'name', label: 'ชื่อสาขา', half: 1, req: 1 },
  { k: 'status', label: 'สถานะ', half: 1, type: 'select', options: ['เปิด', 'ปิด'] }, { k: 'openDate', label: 'วันเปิดสาขา', half: 1, type: 'date' },
  { k: 'address', label: 'ที่อยู่', type: 'textarea', rows: 2 }, { k: 'phone', label: 'เบอร์โทรสาขา', half: 1, type: 'tel' },
  { k: 'lat', label: 'ละติจูด', half: 1, type: 'number' }, { k: 'lng', label: 'ลองจิจูด', half: 1, type: 'number' },
  { k: 'radius', label: 'รัศมีที่ลงเวลาได้ (เมตร)', half: 1, type: 'number' }, { k: 'maxAccuracy', label: 'ยอมให้ GPS คลาดเคลื่อน (เมตร)', half: 1, type: 'number' },
  { k: 'requireSelfie', label: 'ต้องถ่ายรูปทุกครั้งที่ลงเวลา', type: 'check' },
  { k: 'royaltyPct', label: 'Royalty (%)', half: 1, type: 'number', help: 'ว่าง = ใช้ค่าตั้งต้น' }, { k: 'marketingPct', label: 'Marketing (%)', half: 1, type: 'number' },
  { k: 'posRentMonthly', label: 'ค่าเช่า POS ต่อเดือน', half: 1, type: 'number' }, { k: 'investment', label: 'เงินลงทุนเปิดสาขานี้', half: 1, type: 'number' },
  { k: 'amortMonths', label: 'ตัดจำหน่ายกี่เดือน', half: 1, type: 'number' },
  { k: 'note', label: 'บันทึก', type: 'textarea', rows: 2 }
];
function pBranches() {
  const list = S.t.branches.slice().sort((a, b) => (a.status === 'ปิด') - (b.status === 'ปิด') || String(a.code).localeCompare(String(b.code)));
  return cfgView('shop') + `<div class="h2" style="margin-top:20px">สาขา ${list.filter(b => b.status !== 'ปิด').length} สาขา<span class="spacer"></span><button class="btn primary" data-a="newBranch">เพิ่มสาขา</button></div>
  <div class="group">${list.map(b => {
    const staff = S.t.employees.filter(e => e.branch === b.code && e.status !== 'ลาออก').length, geo = num(b.lat) && num(b.lng);
    const ch = [`<span class="chip ${b.status === 'ปิด' ? '' : 'ok'}">${esc(b.status || 'เปิด')}</span>`, geo ? `<span class="chip">ลงเวลาในรัศมี ${num(b.radius) || 80} ม.</span>` : '<span class="chip bad">ยังไม่ได้ตั้งพิกัด</span>', num(b.investment) ? `<span class="chip">ลงทุน ${fmt(b.investment)}</span>` : ''];
    return `<div class="row"><button class="rowmain" data-a="branch:${esc(b.id)}"><span class="avatar" style="border-radius:12px">${icon('branch')}</span><span class="main"><span class="t">${esc(b.name)} <span class="muted">${esc(b.code)}</span></span><span class="s">พนักงาน ${staff} คน${b.openDate ? ', เปิด ' + thDate(b.openDate, { day: 'numeric', month: 'short', year: 'numeric' }) : ''}${b.address ? ', ' + esc(b.address) : ''}</span><span class="chips">${ch.join('')}</span></span></button><span class="mini"><button class="btn sm" data-a="copyClock:${esc(b.code)}">ลิงก์ลงเวลา</button></span></div>`;
  }).join('') || empty('ยังไม่มีสาขา')}</div>
  <h3 class="h3">หน้าลงเวลาสำหรับพนักงาน</h3><div class="group pad"><p style="margin:0">ลิงก์เดียวใช้ได้ทุกสาขา ระบบดูจาก GPS ว่าพนักงานอยู่สาขาไหน ถ้าตั้งแท็บเล็ตไว้หน้าร้าน ใช้ลิงก์ของสาขานั้น (ปุ่ม "ลิงก์ลงเวลา") จะแสดงเฉพาะคนของสาขาและคนที่มาช่วยวันนี้</p><p class="kurl">${esc(clockUrl())}</p><div class="actions" style="margin-bottom:0"><button class="btn" data-a="copyClock">คัดลอกลิงก์</button><a class="btn" href="${esc(clockUrl())}" target="_blank" rel="noopener">เปิดหน้าลงเวลา</a></div></div>
  <p class="note">แยกตามสาขา: พิกัดลงเวลา ตารางงาน คนที่ต้องการต่อกะ การลงเวลา ยอดคงเหลือสต็อก ยอดขาย รายจ่าย สัญญาแฟรนไชส์ และงบกำไรขาดทุน
  ใช้ร่วมกัน: ข้อมูลพนักงาน (มีสาขาประจำ) เงินเดือน รายการสินค้า กะทำงาน วันหยุด กฎเวลาและค่าจ้าง สาขาที่มีข้อมูลแล้วลบไม่ได้ เปลี่ยนสถานะเป็น "ปิด" แทน</p>`;
}
function openBranch(id) {
  const st = S.settings, b = id ? S.t.branches.find(x => x.id === id) : { status: 'เปิด', openDate: today(), radius: 80, maxAccuracy: 100, requireSelfie: true, amortMonths: st.amortMonths };
  const sh = openForm({
    title: id ? b.name : 'เพิ่มสาขา', fields: F_BRANCH(!id), data: b,
    extraHTML: '<div class="actions"><button class="btn" data-act="geo">ใช้ตำแหน่งปัจจุบันเป็นพิกัดสาขา</button></div><p class="note geo-note">ยืนกลางร้านแล้วกดปุ่ม ระบบจะใส่พิกัดให้ จากนั้นกดบันทึก</p>',
    onSave: async v => {
      v.code = String(v.code || '').trim().toUpperCase();
      if (id && v.code !== b.code) throw new Error('เปลี่ยนรหัสสาขาที่สร้างแล้วไม่ได้');
      if (S.t.branches.some(x => x.id !== v.id && x.code === v.code)) throw new Error('รหัสสาขาซ้ำ');
      if (!id) v.id = 'branch_' + v.code;
      await DB.upsert('branches', v);
    },
    onDelete: id ? () => DB.remove('branches', id) : null,
    onAct: { geo: async (btn, sheet) => geoInto(sheet) }
  });
  if (id) { const c = $('[data-k="code"]', sh); if (c) c.readOnly = true; }
}
async function geoInto(sh) {
  const note = $('.geo-note', sh);
  note.textContent = 'กำลังหาตำแหน่ง…';
  try {
    const p = await getPos();
    $('[data-k="lat"]', sh).value = p.coords.latitude.toFixed(6);
    $('[data-k="lng"]', sh).value = p.coords.longitude.toFixed(6);
    note.textContent = `ได้พิกัดแล้ว คลาดเคลื่อน ±${Math.round(p.coords.accuracy)} ม. กดบันทึกเพื่อใช้งาน${p.coords.accuracy > 50 ? ' (ถ้าเกิน 50 ม. ลองเปิด Wi-Fi แล้วกดใหม่)' : ''}`;
  } catch (e) { note.textContent = geoErr(e); }
}
function currentPerms() { let p = {}; try { p = JSON.parse(S.settings.perms || '{}'); } catch (e) { p = {}; } const o = {}; PERM_ROLES.forEach(r => { o[r] = p[r] || DEFAULT_PERMS[r]; }); return o; }
function pPerms() {
  const P = currentPerms(), list = S.permList.length ? S.permList : [];
  const cell = (role, k, lock) => lock ? '<td><span class="lock">Owner only</span></td>' : `<td><input type="checkbox" data-perm="${role}:${k}"${P[role].includes(k) ? ' checked' : ''} aria-label="${ROLE_NAME[role]}: ${esc(k)}"></td>`;
  const who = r => [...S.t.employees.filter(e => e.role === r && e.status !== 'ลาออก'), ...(S.t.users || []).filter(u => !u.master && u.role === r && u.status !== 'disabled').map(u => ({ ...u, nickname: u.name + ' (user)' }))].map(e => shortName(e) + (multiBranch() ? ` (${e.branchAccess === '*' || (r === 'hr' && !e.branchAccess) ? 'ทุกสาขา' : [e.branch, ...String(e.branchAccess || '').split(',').filter(Boolean)].join('+')})` : '')).join(', ') || 'ยังไม่มี';
  return `<p class="note" style="margin-top:0">กำหนดว่าแต่ละระดับเห็นระบบไหนได้บ้าง ตรวจสิทธิ์ที่ฝั่ง Google ทุกครั้ง คนที่ไม่มีสิทธิ์จะไม่ได้รับข้อมูลส่วนนั้นเลย ทุกคนลงเวลา ดูตารางของตัวเอง ขอลา และแจ้งแก้เวลาได้เสมอ</p>
  <div class="group"><table class="perm"><thead><tr><th>ระบบ</th><th>Owner</th><th>Admin</th><th>HR</th><th>Manager</th><th>Staff</th></tr></thead><tbody>${list.map(([k, label, lock]) => `<tr><td>${esc(label)}</td><td>✓</td>${PERM_ROLES.map(r => cell(r, k, lock)).join('')}</tr>`).join('')}</tbody></table></div>
  <h3 class="h3">เห็นข้อมูลสาขาไหน</h3><div class="group">${statRow('Owner', '', 'ทุกสาขา บัญชี owner' + (who('owner') !== 'ยังไม่มี' ? ', ' + esc(who('owner')) : ''))}${statRow('Admin', '', 'ทุกสาขา (ดูแลระบบ ไม่เห็นเงินเดือนถ้าไม่ได้ให้สิทธิ์): ' + esc(who('admin')))}${statRow('HR', '', 'ทุกสาขา (หรือเฉพาะสาขาที่เลือกใน "ดูแลสาขาเพิ่ม"): ' + esc(who('hr')))}${statRow('Manager', '', 'สาขาประจำ + สาขาที่ดูแลเพิ่ม: ' + esc(who('manager')))}${statRow('Staff', '', 'สาขาประจำ: ' + esc(who('staff')))}</div>
  <p class="note">เปลี่ยน Role และสาขาของพนักงานที่ HR > Employees ของบัญชีผู้ใช้อื่นที่ System > Users (ตั้ง "สิทธิ์เฉพาะคน" ได้) Dashboard, P&L และ Settings เป็นสิทธิ์ของ Owner เท่านั้น ไม่มีใครเพิ่มสิทธิ์ให้ตัวเองได้</p>
  <div class="actions"><button class="btn primary big" data-a="savePerms">บันทึกสิทธิ์</button></div>`;
}
function pData() {
  const books = S.books || {};
  const names = { core: 'ระบบหลัก', hr: 'HR', time: 'เวลาทำงานและตารางงาน', payroll: 'เงินเดือน', stock: 'สต็อก', acct: 'บัญชี' };
  let h = `<h3 class="h3" style="margin-top:4px">ไฟล์ Google Sheet แยกตามระบบ</h3><div class="group">${Object.keys(names).map(k => { const b = books[k]; const url = b && b.url && !S.demo ? b.url : ''; return url ? `<a class="row" href="${esc(url)}" target="_blank" rel="noopener"><span class="main"><span class="t">${esc(b.title)}</span><span class="s">เปิดใน Google Sheets</span></span><span class="v" aria-hidden="true">↗</span></a>` : statRow(esc((b && b.title) || 'Amazon Cafe ' + names[k]), '', S.demo ? 'โหมดทดลอง: ข้อมูลอยู่ในเครื่องนี้' : 'ยังไม่ได้สร้างไฟล์'); }).join('')}</div>`;
  h += `<h3 class="h3">การเชื่อมต่อ</h3><div class="group pad"><div class="form"><div class="field"><label for="c-api">URL ของ Apps Script Web App</label><input id="c-api" type="url" value="${esc(S.cfg.apiUrl || '')}" placeholder="https://script.google.com/macros/s/…/exec"><span class="help">เว้นว่าง = โหมดทดลอง ข้อมูลอยู่ในเบราว์เซอร์นี้เท่านั้น</span></div></div><div class="actions" style="margin-bottom:0"><button class="btn" data-a="testApi">ทดสอบการเชื่อมต่อ</button><button class="btn primary" data-a="saveApi">บันทึก URL</button></div></div>`;
  h += `<h3 class="h3">ข้อมูล</h3><div class="group pad"><div class="actions" style="margin:0"><button class="btn" data-a="exportJson">สำรองข้อมูลทั้งหมด (JSON)</button>${S.demo ? '<button class="btn danger" data-a="demoReset">เริ่มข้อมูลตัวอย่างใหม่</button>' : ''}</div></div>`;
  return h;
}
async function saveCfg(sub, btn) {
  const v = collect($('#view'), cfgFields(sub), S.settings);
  S.settings = { ...S.settings, ...v };
  await busy(btn, () => DB.saveSettings());
  S.rev++; toast('บันทึกการตั้งค่าแล้ว'); App.render();
}
async function savePerms(btn) {
  const P = { admin: [], hr: [], manager: [], staff: [] };
  $$('[data-perm]').forEach(c => { if (c.checked) { const [r, k] = c.dataset.perm.split(':'); P[r].push(k); } });
  S.settings.perms = JSON.stringify(P);
  await busy(btn, () => DB.saveSettings());
  toast('บันทึกสิทธิ์แล้ว มีผลตอนผู้ใช้เข้าสู่ระบบหรือรีเฟรชหน้า'); App.render();
}
const getPos = () => new Promise((res, rej) => { if (!navigator.geolocation) return rej({ code: 0 }); navigator.geolocation.getCurrentPosition(res, rej, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }); });
const geoErr = e => ({ 0: 'อุปกรณ์หรือเบราว์เซอร์นี้ไม่รองรับ GPS', 1: 'ยังไม่ได้อนุญาตให้ใช้ตำแหน่ง เปิดสิทธิ์ Location ให้เบราว์เซอร์ แล้วลองอีกครั้ง', 2: 'หาตำแหน่งไม่ได้ เปิด GPS หรือออกไปใกล้ประตูร้านแล้วลองใหม่', 3: 'หาตำแหน่งนานเกินไป ลองกดใหม่อีกครั้ง' })[e && e.code] || 'หาตำแหน่งไม่ได้';
async function testApi(btn) {
  const url = ($('#c-api') || {}).value.trim();
  if (!url) return toast('ใส่ URL ก่อน');
  if (!validUrl(url)) return toast('URL ต้องเป็นลิงก์ Web App ของ Apps Script ที่ลงท้ายด้วย /exec');
  try { const r = await busy(btn, () => jsonp({ action: 'ping' }, url), 'กำลังทดสอบ…'); toast('เชื่อมต่อได้ เวลาเซิร์ฟเวอร์ ' + r.time); } catch (e) { toast(e.message); }
}
function saveApi() {
  const url = ($('#c-api') || {}).value.trim();
  if (url && !validUrl(url)) return toast('URL ต้องเป็นลิงก์ Web App ของ Apps Script ที่ลงท้ายด้วย /exec');
  S.cfg.apiUrl = url; LS.set('amz.cfg', S.cfg);
  SS.set('amz.tok', '');
  location.hash = ''; location.reload();
}

defMod({
  key: 'set', mod: 'set', noBranch: true, label: 'Settings', icon: 'set', group: 'System', desc: 'สาขา พิกัด กฎเวลาและค่าจ้าง วันหยุด แฟรนไชส์ สิทธิ์ ไฟล์', perm: ['settings'],
  subs: [
    { key: 'shop', label: 'Branches', view: pBranches },
    { key: 'rules', label: 'Work Rules', view: () => cfgView('rules') },
    { key: 'holidays', label: 'Holidays', view: () => cfgView('holidays') },
    { key: 'franchise', label: 'Franchise', view: () => cfgView('franchise') },
    { key: 'perms', label: 'Permissions', view: pPerms },
    { key: 'data', label: 'Data & Connection', view: pData }
  ],
  summary: () => `${S.t.branches.filter(b => b.status !== 'ปิด').length} สาขา, ` + (S.demo ? 'Demo mode ยังไม่ได้เชื่อม Google Sheet' : 'เชื่อม Google Sheet แล้ว 6 ไฟล์'),
  acts: {
    saveCfg: (a, b) => saveCfg(a, b), savePerms: (a, b) => savePerms(b),
    newBranch: () => openBranch(), branch: id => openBranch(id),
    testApi: (a, b) => testApi(b), saveApi: () => saveApi(),
    copyClock: async b => { const u = clockUrl(b); try { await navigator.clipboard.writeText(u); toast('คัดลอกลิงก์แล้ว' + (b ? ' (' + branchName(b) + ')' : '')); } catch (e) { showText('ลิงก์ลงเวลา' + (b ? ' ' + branchName(b) : ''), u, 'clock-link.txt'); } },
    exportJson: () => showText('สำรองข้อมูล', JSON.stringify({ exportedAt: new Date().toISOString(), settings: S.settings, tables: S.t }), `amazon-cafe-backup-${today()}.json`),
    demoReset: (a, b) => armed(b, () => { DemoServer.reset(); DemoServer.seed(); SS.set('amz.tok', ''); location.hash = ''; location.reload(); }, 'แตะอีกครั้ง ข้อมูลที่ลองใส่จะหายหมด')
  }
});
