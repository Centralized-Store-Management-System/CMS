/* LINE Alerts: แจ้งเตือนผ่าน LINE Official Account (Messaging API)
 * - รายการรออนุมัติ ส่งพร้อมปุ่ม อนุมัติ / ไม่อนุมัติ กดใน LINE ได้เลย (ลิงก์ใช้ครั้งเดียว ของผู้รับคนนั้น)
 * - ลงเวลาเข้า-ออก (ทุกครั้ง หรือเฉพาะผิดปกติ) และสรุปประจำวัน
 * Channel access token เก็บที่ฝั่ง Google (Script Properties) หน้าเว็บไม่ได้รับ token กลับมา */
const ROUTES = [['owner', 'Owner (ค่าตั้งต้น)'], ['hr', 'HR / Admin (ไม่มีส่ง Owner)'], ['manager', 'Manager ของสาขา (ไม่มีส่ง Owner)'], ['all', 'ทุกคนที่มีสิทธิ์อนุมัติของสาขา']];
const regUrl = () => (S.settings.webUrl || location.href).split('#')[0].split('?')[0].replace(/[^/]*\.html?$/i, '').replace(/\/?$/, '/') + 'clock.html';
const HOURS = Array.from({ length: 10 }, (_, i) => String(14 + i));
async function loadLine(btn) {
  S.f.line = await busy(btn, () => API.call('lineStatus', { t: S.token }), '…');
  App.render();
}
function linePreview() {
  if (!S.demo || !window.DemoServer || !DemoServer.pushes) return '';
  const seen = {}, uniq = [];
  DemoServer.pushes().filter(p => /push$/.test(p.url)).forEach(p => { const m = p.messages[0] || {}, k = m.altText || m.text || ''; if (seen[k]) { seen[k].n++; return; } seen[k] = { ...p, n: 1 }; uniq.push(seen[k]); });
  const list = uniq.reverse().slice(0, 8);
  if (!list.length) return '';
  const flat = (x, type, out = []) => { if (!x) return out; if (x.type === type) out.push(x); (x.contents || []).forEach(k => flat(k, type, out)); return out; };
  const bubble = m => {
    if (m.type === 'text') return `<div class="bubble txt">${esc(m.text)}</div>`;
    const c = m.contents || {}, hd = flat(c.header, 'text'), body = flat(c.body, 'text'), ft = flat(c.footer, 'button');
    return `<div class="bubble"><div class="bh" style="background:${esc((c.header && c.header.backgroundColor) || '#06C755')}">${hd.map(x => esc(x.text)).join('<br>')}</div><div class="bb">${body.map((b, i) => `<p${i === 0 ? ' style="font-weight:600;font-size:16px"' : ''}>${esc(b.text)}</p>`).join('')}</div><div class="bf">${ft.map(b => b.action.uri && /action=lineAct/.test(b.action.uri) ? `<button class="${b.style === 'primary' ? 'p' : 's'}" data-a="demoLine:${esc(b.action.uri.split('?')[1])}">${esc(b.action.label)}</button>` : `<button class="s" data-a="close">${esc(b.action.label)}</button>`).join('')}</div></div>`;
  };
  return `<h3 class="h3">ตัวอย่างข้อความใน LINE (Demo)</h3><div class="phone"><p class="lhead"><span>LINE OA ของร้าน</span><span>${list.length} ข้อความล่าสุด</span></p>${list.map(p => p.messages.map(bubble).join('') + (p.n > 1 ? `<p class="lhead" style="margin:-4px 0 10px;font-weight:400;font-size:12px">ส่งถึง ${p.n} คน</p>` : '')).join('')}</div><p class="note">โหมดทดลองไม่ได้ส่ง LINE จริง ลองกดปุ่ม อนุมัติ ในข้อความด้านบน จะเห็นหน้าที่ผู้อนุมัติเห็นในมือถือ และรายการในระบบเปลี่ยนจริง</p>`;
}
function pLineSetup() {
  const L = S.f.line, st = S.settings, edit = can('settings', 'admin');
  if (!L) { if (!S.f.lineLoading) { S.f.lineLoading = 1; setTimeout(() => loadLine().catch(e => toast(e.message)).finally(() => { S.f.lineLoading = 0; }), 0); } return '<p class="loading">กำลังโหลดสถานะ LINE…</p>'; }
  const webUrl = st.webUrl || '';
  let h = `<div class="kpis"><div class="kpi ${L.hasToken ? 'ok' : 'warn'}"><b>${L.hasToken ? 'พร้อม' : 'ยังไม่ตั้ง'}</b><span>Channel access token${L.hasToken ? ' …' + esc(L.tokenTail) : ''}</span></div><div class="kpi"><b>${L.recipients.length}</b><span>ผู้รับที่ผูก LINE แล้ว</span></div><div class="kpi"><b>${fmt(L.sentThisMonth)}</b><span>ข้อความเดือนนี้</span></div><div class="kpi ${L.failedThisMonth ? 'bad' : ''}"><b>${fmt(L.failedThisMonth)}</b><span>ส่งไม่สำเร็จ</span></div></div>`;
  h += linePreview();
  h += `<h3 class="h3">ส่งอะไรบ้าง</h3><div class="group pad"><div class="form">
    <div class="field check"><input type="checkbox" id="ln-ap"${bool(st.lineApprovals) ? ' checked' : ''}${edit ? '' : ' disabled'}><label for="ln-ap">รายการรออนุมัติ (ลา OT ทำงานวันหยุด แก้เวลา ปรับสต็อก) พร้อมปุ่มอนุมัติใน LINE</label></div>
    <div class="field half"><label for="ln-clk">แจ้งการลงเวลา</label><select id="ln-clk"${edit ? '' : ' disabled'}>${opts([['off', 'ไม่แจ้ง'], ['exceptions', 'เฉพาะที่ผิดปกติ (สาย OT วันหยุด ต่างสาขา ออกก่อน)'], ['all', 'ทุกครั้งที่เข้า-ออกงาน']], st.lineClock || 'off')}</select></div>
    <div class="field half"><label for="ln-dh">สรุปประจำวัน</label><select id="ln-dh"${edit ? '' : ' disabled'}>${opts([['', 'ไม่ส่ง'], ...HOURS.map(x => [x, `ทุกวัน ${x}:00 น.`])], bool(st.lineDaily) ? String(st.lineDailyHour || 21) : '')}</select></div>
    <div class="field check"><input type="checkbox" id="ln-pin"${bool(st.lineRequirePin) ? ' checked' : ''}${edit ? '' : ' disabled'}><label for="ln-pin">ต้องใส่ PIN ก่อนอนุมัติจาก LINE (ปลอดภัยขึ้นถ้ามีคนส่งต่อข้อความ)</label></div>
    <div class="field half"><label for="ln-rot">ใครอนุมัติ OT / ทำงานวันหยุด ใน LINE</label><select id="ln-rot"${edit ? '' : ' disabled'}>${opts(ROUTES, st.lineRouteOT || 'owner')}</select></div>
    <div class="field half"><label for="ln-rlv">ใครอนุมัติใบลา (ทุกประเภท) ใน LINE</label><select id="ln-rlv"${edit ? '' : ' disabled'}>${opts(ROUTES, st.lineRouteLeave || 'owner')}</select></div>
    <div class="field"><label for="ln-res">แจ้งพนักงานทาง LINE</label><select id="ln-res"${edit ? '' : ' disabled'}>${opts([['result', 'ผลอนุมัติ / ไม่อนุมัติ (แนะนำ ประหยัดโควตา)'], ['all', 'ใบรับคำขอ + ผลอนุมัติ + ยืนยันทุกครั้งที่ลงเวลา'], ['off', 'ไม่แจ้ง']], st.lineResults || 'result')}</select><span class="help">ผู้อนุมัติกด "แก้ไขก่อนอนุมัติ" ในการ์ดได้ (แก้นาที OT, ประเภทลา วันที่ จำนวนวัน) พนักงานเห็นสิ่งที่แก้ในการ์ดผลอนุมัติ ผู้อนุมัติที่ไม่ใช่ Owner ต้องมีสิทธิ์ "อนุมัติเวลา" (หน้า Users)</span></div>
    <div class="field"><label for="ln-web">ลิงก์หน้าเว็บหลังร้าน (ปุ่ม "เปิดในระบบ" ใน LINE)</label><input id="ln-web" type="url" value="${esc(webUrl)}" placeholder="https://…/index.html"${edit ? '' : ' disabled'}><span class="help"><a href="#" data-a="lineWebHere">ใช้ลิงก์ของหน้านี้</a></span></div>
  </div>${edit ? '<div class="actions" style="margin-bottom:0"><button class="btn primary" data-a="lineSave">บันทึก</button></div>' : ''}</div>
  <p class="note">แต่ละคนเลือกเองได้ว่าจะรับแจ้งเตือนอะไร (ชื่อของตัวเอง > LINE แจ้งเตือน) ระบบส่งรายการรออนุมัติเฉพาะคนที่มีสิทธิ์อนุมัติของสาขานั้น และแจ้งลงเวลาเฉพาะคนที่ดูแลสาขานั้น</p>`;
  h += `<h3 class="h3">ผู้รับ</h3><div class="group">${L.recipients.map(r => `<div class="row static"><span class="main"><span class="t">${esc(r.name)} <span class="muted">${esc(r.role || '')}</span></span><span class="s">${esc(String(r.events || '').split(',').filter(Boolean).map(e => ({ approvals: 'รออนุมัติ', clock: 'ลงเวลาทุกครั้ง', clockEx: 'ลงเวลาผิดปกติ', daily: 'สรุปรายวัน' }[e] || e)).join(', ') || 'ยังไม่ได้เลือกการแจ้งเตือน')}</span></span>${L.hasToken && edit ? `<button class="btn sm" data-a="lineTest:${esc(r.ref)}">ทดสอบ</button>` : ''}</div>`).join('') || empty('ยังไม่มีใครผูก LINE')}</div>
  <div class="actions"><button class="btn" data-a="myAccount">ผูก LINE ของฉัน</button>${can('users') ? '<a class="btn" href="#users">ผูก LINE ให้ผู้ใช้อื่น</a>' : ''}<span class="grow"></span><button class="btn" data-a="lineLoad">รีเฟรช</button></div>`;
  const SF = L.staff || [];
  h += `<h3 class="h3">พนักงานลงทะเบียน LINE <span class="muted">${SF.filter(x => x.linked).length}/${SF.length}</span></h3><p class="note" style="margin-top:0">พนักงานพิมพ์หา LINE ของร้าน: <b>รหัสพนักงาน ชื่อ นามสกุล</b> เช่น E001 Narong Srideewongsawat ระบบจับคู่ด้วยรหัสพนักงาน LINE UID ใช้ยืนยันตัวตน (1 คน 1 LINE) Owner ได้การ์ดแจ้งทุกครั้ง</p><div class="group">${SF.map(x => `<div class="row static"><span class="main"><span class="t"><b>${esc(x.code)}</b> ${esc(x.name)}${x.nick ? ` <span class="muted">(${esc(x.nick)})</span>` : ''}</span><span class="s">${x.linked ? `LINE: ${esc(x.lineName || 'ลงทะเบียนแล้ว')}${x.at ? ' · ' + esc(x.at) : ''}` : 'ยังไม่ลงทะเบียน'}</span></span><span class="chip ${x.linked ? 'ok' : ''}">${x.linked ? 'ลงทะเบียนแล้ว' : 'ยังไม่ลงทะเบียน'}</span>${x.linked && (can('users') || edit) ? `<button class="btn sm" data-a="lineUnlink:${esc(x.id)}">ยกเลิก</button>` : ''}</div>`).join('') || empty('ยังไม่มีพนักงาน')}</div>`;
  h += `<h3 class="h3">ประวัติการส่งล่าสุด</h3><div class="group">${L.recent.map(n => `<div class="row static"><span class="main"><span class="t">${esc(n.title || n.kind)}</span><span class="s">${esc(n.at ? new Date(n.at).toLocaleString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '')} ถึง ${esc(n.toName || '-')}${n.result ? ' · ' + esc(n.result) : ''}${n.error ? ' · ' + esc(n.error) : ''}</span></span><span class="chip ${n.status === 'failed' ? 'bad' : n.status === 'used' ? 'ok' : ''}">${esc({ sent: 'ส่งแล้ว', failed: 'ไม่สำเร็จ', used: 'กดแล้ว', closed: 'ปิดแล้ว', expired: 'หมดอายุ' }[n.status] || n.status)}</span></div>`).join('') || empty('ยังไม่มีการส่ง')}</div>`;
  return h;
}
function pLineGuide() {
  if (!S.f.line && !S.f.lineLoading) { S.f.lineLoading = 1; setTimeout(() => loadLine().catch(e => toast(e.message)).finally(() => { S.f.lineLoading = 0; }), 0); }
  const L = S.f.line || {}, edit = can('settings', 'admin');
  return `<div class="group pad"><ol class="steps">
    <li>สร้าง LINE Official Account ของร้าน (ฟรี) ที่ LINE Official Account Manager</li>
    <li>เปิดใช้ Messaging API ใน LINE OA Manager แล้วไปที่ LINE Developers Console > Channel ของร้าน > แท็บ Messaging API</li>
    <li>กด Issue ที่ <b>Channel access token (long-lived)</b> คัดลอกมาใส่ที่ปุ่มด้านล่าง</li>
    <li>ใส่ <b>Webhook URL</b> เป็น URL ของ Apps Script ด้านล่าง แล้วเปิด Use webhook (ปุ่ม Verify อาจขึ้นว่าไม่สำเร็จเพราะ Apps Script ตอบแบบ redirect แต่ใช้งานได้ตามปกติ)</li>
    <li>ใน LINE OA Manager > ตั้งค่าการตอบกลับ ปิด "ข้อความตอบกลับอัตโนมัติ" เพื่อไม่ให้ตอบซ้ำ</li>
    <li>พนักงานเพิ่มเพื่อน LINE OA แล้วพิมพ์ <b>รหัสพนักงาน ชื่อ นามสกุล</b> เช่น <b>E001 Narong Srideewongsawat</b> (ชื่อไทยหรืออังกฤษตามที่บันทึกในหน้า HR) ลงทะเบียนครั้งเดียว ไม่ต้องใช้ PIN · Owner/HR ที่ไม่มีรหัสพนักงาน ใช้ "ผูก LINE ของฉัน" (link 123456)</li>
    <li>ตั้ง <b>ลิงก์หน้าเว็บหลังร้าน</b> ในแท็บ Notifications (ปุ่มลงเวลาใน LINE เปิด clock.html ที่อยู่ข้างกัน)</li>
    <li><b>LIFF (ทางเข้าหลักของพนักงาน: ลงทะเบียน ลงเวลา ขอ OT แก้เวลา ลา)</b>: LINE Developers > Provider เดียวกับ Messaging API > Create channel > <b>LINE Login</b> > แท็บ LIFF > Add: Size = Tall, Endpoint URL = <code>${esc(regUrl())}</code>, Scope = <b>openid</b> + <b>profile</b> > คัดลอก <b>LIFF ID</b> และ <b>Channel ID</b> (แท็บ Basic settings) มาใส่ด้านล่าง</li>
    <li>LINE OA Manager > Rich menu > 6 ช่อง: <b>ลงเวลา</b> (ลิงก์ <code>https://liff.line.me/LIFF-ID?tab=clock</code>), <b>ขอ OT</b> (<code>?tab=ot</code>), <b>แก้เวลา</b> (<code>?tab=fix</code>), <b>ลา</b> (ข้อความ "ลา" หรือ <code>?tab=leave</code>), <b>OT ของฉัน</b> (ข้อความ "OT"), <b>ตารางงาน</b> (ข้อความ) · คนที่ยังไม่ลงทะเบียน เปิดลิงก์ไหนก็ได้ ระบบแสดงฟอร์มลงทะเบียนให้ก่อน</li>
  </ol></div>
  ${edit ? `<h3 class="h3">LIFF (ทางเข้าหลักของพนักงาน)</h3><div class="group pad"><div class="form"><div class="field half"><label for="ln-liff">LIFF ID</label><input id="ln-liff" value="${esc(S.settings.liffId || '')}" placeholder="1234567890-AbCdEfGh"></div><div class="field half"><label for="ln-lch">Channel ID ของ LINE Login</label><input id="ln-lch" inputmode="numeric" value="${esc(S.settings.lineLoginChannelId || '')}" placeholder="1234567890"></div></div><div class="actions" style="margin-bottom:0"><button class="btn primary" data-a="liffSave">บันทึก</button>${S.settings.liffId ? `<span class="help">ลิงก์ LIFF: https://liff.line.me/${esc(S.settings.liffId)}</span>` : ''}</div></div>` : ''}
  <h3 class="h3">พิมพ์ในแชต LINE (หรือกดจาก Rich menu)</h3><div class="group">${[['เข้างาน / ออกงาน / ลงเวลา', 'ตั้ง LIFF แล้ว: ได้การ์ดกะวันนี้ + ปุ่มเปิดหน้าลงเวลาใน LINE (GPS มือถือ + เซลฟี่ ไม่ต้องใส่ PIN) ยังไม่ตั้ง LIFF: ส่งตำแหน่งในแชต'], ['แก้เวลา / ลืมลงเวลา', 'ปุ่มเปิดฟอร์มแจ้งแก้เวลาใน LINE'], ['ลา', 'เลือกประเภท วันที่ (ปฏิทินในแชต) เต็มวัน/ครึ่งวัน/หลายวัน เหตุผล แล้วยืนยัน หรือพิมพ์ประโยคเดียว เช่น ลาป่วย พรุ่งนี้ ไม่สบาย / ลากิจ 20/11-21/11 ธุระ'], ['OT', 'OT เดือนนี้ อนุมัติ/รออนุมัติ พร้อมเงิน + ปุ่ม ขอ OT (คีย์เวลาเอง)'], ['ตารางงาน / สถานะ', 'กะ 7 วัน และคำขอที่รอ'], ['รออนุมัติ', 'Owner/Manager: จำนวนรายการที่รอพิจารณา'], ['ลงทะเบียน', 'เปิดฟอร์ม LIFF (รหัสพนักงาน ชื่อ นามสกุล)'], ['ยกเลิก', 'ยกเลิกสิ่งที่ทำค้างอยู่']].map(([k, v]) => statRow(k, '', v)).join('')}</div>
  <div class="group">${statRow('Webhook URL', '', esc(L.webhookUrl || (S.demo ? 'https://script.google.com/macros/s/…/exec (Demo)' : 'URL ของ Apps Script /exec')))}${statRow('Channel access token', L.hasToken ? '<span class="chip ok">ตั้งแล้ว</span>' : '<span class="chip warn">ยังไม่ตั้ง</span>', L.hasToken ? 'ลงท้าย …' + esc(L.tokenTail) + ' (เก็บที่ฝั่ง Google ไม่แสดงในหน้าเว็บ)' : '')}</div>
  ${edit ? `<div class="actions"><button class="btn primary" data-a="lineToken">${L.hasToken ? 'เปลี่ยน token' : 'ใส่ Channel access token'}</button>${L.hasToken ? '<button class="btn danger" data-a="lineTokenDel">ลบ token</button>' : ''}</div>` : ''}
  <p class="note">ข้อความแบบ push (แจ้งเตือนทั้งหมดของระบบ) นับโควตาข้อความรายเดือนของ LINE OA นับตามจำนวนผู้รับ แพ็กเกจฟรีส่งได้จำนวนจำกัด ดูโควตาที่ LINE OA Manager ข้อความตอบกลับตอนผูกบัญชีไม่นับโควตา ถ้าใกล้เต็ม เปลี่ยนแจ้งลงเวลาเป็น "เฉพาะที่ผิดปกติ" หรือใช้สรุปรายวันแทน</p>`;
}
async function lineSave(btn) {
  const dh = $('#ln-dh').value;
  const row = { lineApprovals: $('#ln-ap').checked ? 'true' : 'false', lineClock: $('#ln-clk').value, lineDaily: dh ? 'true' : 'false', lineDailyHour: dh || String(S.settings.lineDailyHour || 21), lineRequirePin: $('#ln-pin').checked ? 'true' : 'false', lineRouteOT: $('#ln-rot').value, lineRouteLeave: $('#ln-rlv').value, lineResults: $('#ln-res').value, webUrl: $('#ln-web').value.trim() };
  await busy(btn, () => API.write({ op: 'saveSetting', row }));
  Object.assign(S.settings, row);
  toast('บันทึกการแจ้งเตือน LINE แล้ว');
  await loadLine();
}
function lineTokenSheet() {
  const sh = openSheet(`<h3>Channel access token</h3><p class="muted">LINE Developers Console > Channel ของร้าน > Messaging API > Channel access token (long-lived) > Issue แล้วคัดลอกมาวาง</p><div class="form"><div class="field"><label for="ln-tok">Token</label><input id="ln-tok" type="password" autocomplete="off" spellcheck="false"></div></div><div class="actions"><span class="grow"></span><button class="btn" data-a="close">ยกเลิก</button><button class="btn primary" data-act="go">บันทึก</button></div><p class="err" role="alert"></p>`);
  sh.addEventListener('click', async e => {
    const b = e.target.closest('[data-act="go"]'); if (!b) return;
    try { await busy(b, () => API.write({ op: 'lineToken', token: $('#ln-tok', sh).value })); closeSheet(); toast('บันทึก token แล้ว'); await loadLine(); } catch (err) { showErr(sh, err.message); }
  });
}
async function demoLine(q) {
  const p = Object.fromEntries(new URLSearchParams(q));
  const html = DemoServer.page(p);
  const sh = openSheet(`<h3>หน้าที่ผู้อนุมัติเห็นในมือถือ</h3><iframe class="lframe" title="หน้ายืนยันจาก LINE" sandbox=""></iframe><div class="actions"><span class="grow"></span><button class="btn primary" data-a="close">ปิด</button></div>`);
  $('iframe', sh).srcdoc = html;
  await bootstrap();
  S.f.line = await API.call('lineStatus', { t: S.token });
  App.render();
}

defMod({
  key: 'notify', mod: 'set', noBranch: true, label: 'LINE Alerts', icon: 'notify', group: 'System', desc: 'อนุมัติจาก LINE แจ้งการลงเวลา สรุปประจำวัน',
  perm: ['settings', 'admin'],
  subs: [
    { key: 'setup', label: 'Notifications', view: pLineSetup },
    { key: 'guide', label: 'Setup Guide', view: pLineGuide }
  ],
  summary: () => (S.settings.lineApprovals === 'true' ? 'เปิดแจ้งเตือนรออนุมัติ' : 'ยังไม่ได้เปิดแจ้งเตือน') + (S.settings.lineClock && S.settings.lineClock !== 'off' ? ', แจ้งลงเวลา' : ''),
  acts: {
    lineLoad: (a, b) => loadLine(b), lineSave: (a, b) => lineSave(b), lineToken: () => lineTokenSheet(),
    lineTokenDel: (a, b) => armed(b, async () => { await API.write({ op: 'lineToken', token: '' }); toast('ลบ token แล้ว'); await loadLine(); }, 'แตะอีกครั้ง หยุดส่ง LINE ทั้งหมด'),
    lineTest: async (a, b) => { await busy(b, () => API.write({ op: 'lineTest', ref: a }), 'กำลังส่ง…'); toast('ส่งข้อความทดสอบแล้ว'); await loadLine(); },
    lineWebHere: () => { const i = $('#ln-web'); if (i) i.value = location.href.split('#')[0]; },
    lineUnlink: (a, b) => armed(b, async () => { await API.write({ op: 'lineUnlink', empId: a }); toast('ยกเลิกการลงทะเบียน LINE แล้ว'); await loadLine(); }, 'แตะอีกครั้งเพื่อยกเลิก'),
    liffSave: async (a, b) => { const row = { liffId: $('#ln-liff').value.trim(), lineLoginChannelId: $('#ln-lch').value.trim() }; await busy(b, () => API.write({ op: 'saveSetting', row })); Object.assign(S.settings, row); toast('บันทึก LIFF แล้ว'); App.render(); },
    demoLine: a => demoLine(a)
  }
});
