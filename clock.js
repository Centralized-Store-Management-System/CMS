/* หน้าลงเวลาสำหรับพนักงาน (clock.html) แยกจากระบบหลังร้าน ใช้ได้ทุกสาขา
 * แตะชื่อ → ใส่ PIN → เห็นกะวันนี้และสาขาที่ต้องไป → เข้า/ออกงาน (ระบบหาสาขาจาก GPS + รูป) → ดูตารางของฉัน ขอลา แจ้งลืมลงเวลา
 * clock.html?branch=B01 = แท็บเล็ตประจำสาขา แสดงเฉพาะคนของสาขาและคนที่มาช่วยวันนี้ */
'use strict';
const C = { step: 'who', staff: [], shopName: '', branches: [], kiosk: '', emp: null, my: null, tab: 'days', selfie: '', pin: '', idle: 0, tick: 0, inside: true, result: null, su: null };
// ตั้ง PIN ครั้งแรก (บัญชีที่ Owner สร้างให้): รหัสเปิดใช้งาน → PIN ใหม่ → ยืนยัน ใช้แป้นตัวเลขเดิม
const SU_STEPS = ['ใส่รหัสเปิดใช้งาน 6 หลัก ที่ได้จาก Owner/Admin', 'ตั้ง PIN ใหม่ 6 หลักของคุณ', 'ใส่ PIN ใหม่อีกครั้ง'];
const brOf = c => C.branches.find(b => b.code === c);
const brName = c => (brOf(c) || {}).name || c || '';
const multi = () => C.branches.length > 1;
/** สาขาที่ใกล้ที่สุดที่อยู่ในรัศมี หรือสาขาที่ใกล้ที่สุดถ้าไม่อยู่ในรัศมีใดเลย */
function nearest(lat, lng) {
  const ds = C.branches.filter(b => b.hasGeo).map(b => ({ b, d: haversine(b.lat, b.lng, lat, lng) })).sort((x, y) => x.d - y.d);
  return { hit: ds.find(x => x.d <= x.b.radius), near: ds[0] };
}
const IDLE_SEC = 120;
const haversine = (a, b, c, d) => { const R = 6371000, rad = x => x * Math.PI / 180; const h = Math.sin(rad(c - a) / 2) ** 2 + Math.cos(rad(a)) * Math.cos(rad(c)) * Math.sin(rad(d - b) / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); };
const getPos = () => new Promise((res, rej) => { if (!navigator.geolocation) return rej({ code: 0 }); navigator.geolocation.getCurrentPosition(res, rej, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }); });
const geoErr = e => ({ 0: 'อุปกรณ์หรือเบราว์เซอร์นี้ไม่รองรับ GPS', 1: 'ยังไม่ได้อนุญาตให้ใช้ตำแหน่ง เปิดสิทธิ์ Location ให้เบราว์เซอร์ แล้วลองอีกครั้ง', 2: 'หาตำแหน่งไม่ได้ เปิด GPS หรือออกไปใกล้ประตูร้านแล้วลองใหม่', 3: 'หาตำแหน่งนานเกินไป ลองกดใหม่อีกครั้ง' })[e && e.code] || 'หาตำแหน่งไม่ได้';
const planText = p => p.off ? 'วันหยุด' : `${p.name || 'กะทำงาน'} ${p.start}–${p.end}`;
const statusText = { 'รออนุมัติ': 'warn', 'อนุมัติ': 'ok', 'ไม่อนุมัติ': 'bad', 'ยกเลิก': '' };

function header() {
  const th = cachedTheme();
  return `<div class="clock-top"><span class="brand" style="padding:0;flex:1"><span class="logo${th.logo ? ' has-img' : ''}">${themeLogo(th, icon('cup'))}</span><span><b>Time Clock</b><small>${esc(th.title || C.shopName || 'Café Amazon')}${C.kiosk ? ' · ' + esc(brName(C.kiosk)) : ''}${S.demo ? ' (Demo)' : ''}</small></span></span><a class="btn sm" href="index.html">Back Office</a></div>`;
}
function render() {
  const root = $('#root');
  if (C.step === 'who') root.innerHTML = viewWho();
  else if (C.step === 'pin') root.innerHTML = viewPin();
  else root.innerHTML = viewMe();
}
function viewWho() {
  const now = new Date();
  return `<div class="clock-shell">${header()}
    <p class="clock-face" id="ck-time">${hhmm(now)}</p><p class="clock-date">${now.toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
    ${!C.branches.some(b => b.hasGeo) ? '<p class="status bad">ร้านยังไม่ได้ตั้งพิกัดสำหรับลงเวลา แจ้ง Owner</p>' : C.kiosk && brOf(C.kiosk) && !brOf(C.kiosk).hasGeo ? `<p class="status bad">${esc(brName(C.kiosk))} ยังไม่ได้ตั้งพิกัด แจ้ง Owner</p>` : ''}
    <h2 class="h2">แตะชื่อของคุณ</h2>
    ${C.staff.length > 12 ? '<div class="field" style="margin-bottom:10px"><input id="ck-find" placeholder="ค้นหาชื่อ" aria-label="ค้นหาชื่อ"></div>' : ''}
    <div class="people" id="people">${C.staff.map(e => `<button data-a="pick:${esc(e.id)}" data-name="${esc((e.nickname || '') + ' ' + (e.firstName || '') + ' ' + (e.code || ''))}">${avatar(e)}<b>${esc(e.nickname || e.firstName)}</b><small>${esc(e.position || '')}${multi() && (!C.kiosk || e.branch !== C.kiosk) ? '<br>' + esc(brName(e.branch)) : ''}</small></button>`).join('') || empty('ยังไม่มีรายชื่อพนักงาน')}</div>
    <p class="note" style="margin-top:18px">ใช้ PIN 6 หลักที่คุณตั้งเอง (ครั้งแรกใช้รหัสเปิดใช้งานจาก Owner/Admin) ถ้าลืม PIN ให้ Owner/Admin กดรีเซ็ต${multi() && !C.kiosk ? ' ลงเวลาได้ทุกสาขา ระบบดูจาก GPS ว่าคุณอยู่สาขาไหน' : ''}</p></div>`;
}
function viewPin() {
  const e = C.emp, su = C.su, n = su ? su.vals[su.stage].length : C.pin.length;
  const sub = su ? `<span class="chip">ตั้ง PIN ครั้งแรก ${su.stage + 1}/3</span><br>${SU_STEPS[su.stage]}` : 'ใส่ PIN 4–6 หลัก';
  return `<div class="clock-shell">${header()}
    <div style="text-align:center;margin-top:10px">${avatar(e).replace('class="avatar"', 'class="avatar" style="width:64px;height:64px;margin:0 auto"')}<h2 class="h2" style="justify-content:center;margin:8px 0 0">${esc(e.nickname || e.firstName)}</h2><p class="muted su-step" style="margin:2px 0 0">${sub}</p></div>
    <div class="pin-dots" aria-hidden="true">${[0, 1, 2, 3, 4, 5].map(i => `<i class="${i < n ? 'on' : ''}"${!su && i >= 4 && n <= 4 ? ' style="opacity:.35"' : ''}></i>`).join('')}</div>
    <input id="pin-input" class="vh" inputmode="numeric" autocomplete="off" aria-label="PIN">
    <div class="keypad">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(d => `<button data-a="key:${d}">${d}</button>`).join('')}<button class="fn" data-a="key:back" aria-label="ลบ">ลบ</button><button data-a="key:0">0</button><button class="fn" data-a="key:ok">ตกลง</button></div>
    <p class="err" id="pin-err" role="alert" style="text-align:center">${esc(C.pinErr || '')}</p>
    ${su && su.stage ? '<p class="note" style="text-align:center">PIN นี้ใช้ทั้งลงเวลาและเข้าหลังร้าน ตั้งเลขที่จำได้แต่คนอื่นเดายาก (ห้ามเลขเรียง เลขซ้ำ) และห้ามบอกใคร</p>' : ''}
    <div class="actions" style="justify-content:center"><button class="btn" data-a="back">ไม่ใช่ฉัน</button></div></div>`;
}
function viewMe() {
  const m = C.my, p = m.plan, todayLeave = m.days[0] && m.days[0].leave, tb = brOf(p.branch || m.homeBranch) || {};
  const st = m.state, r = C.result;
  const stateLine = st === 'in' ? `เข้างานแล้วเมื่อ ${esc(m.open.inTime)}${m.open.date !== m.today ? ' (เมื่อวาน)' : ''}${num(m.open.lateMin) ? `, สาย ${m.open.lateMin} นาที` : ''}`
    : st === 'done' ? `วันนี้ลงเวลาครบแล้ว เข้า ${esc(m.todayRec.inTime)} ออก ${esc(m.todayRec.outTime)}` : 'ยังไม่ได้ลงเวลาเข้างาน';
  let h = `<div class="clock-shell">${header()}
    <h2 class="h2" style="margin-top:6px">สวัสดี ${esc(m.emp.name)}<span class="spacer"></span><button class="btn sm" data-a="done">เสร็จแล้ว</button></h2>
    <div class="today-card"><span class="k">วันนี้ ${thDate(m.today, { weekday: 'long', day: 'numeric', month: 'short' })}${p.source === 'ตารางงาน' ? ', ตามตารางงาน' : p.source ? ', ' + esc(p.source) : ''}</span>
      <p class="shift">${esc(planText(p))}</p>${multi() && !p.off ? `<p style="margin:2px 0 6px">ที่ <b>${esc(tb.name || p.branch)}</b>${p.branch && p.branch !== m.homeBranch ? ' <span class="chip warn">ไปช่วยสาขาอื่น</span>' : ''}</p>` : ''}
      ${p.pubHoliday ? `<span class="chip warn">${esc(p.pubHoliday)}</span> ` : ''}${todayLeave ? `<span class="chip ${statusText[todayLeave.status] || ''}">${esc(todayLeave.type)} ${esc(todayLeave.status)}</span>` : ''}
      <p style="margin:8px 0 0">${stateLine}</p></div>`;
  if (r) h += `<p class="status ${r.ok ? 'good' : 'bad'}" role="status">${r.msg}</p>`;
  if (st !== 'done') {
    const type = st === 'in' ? 'out' : 'in';
    if (tb.requireSelfie) h += `<div class="selfie-box"><button type="button" class="btn" data-a="cam">${C.selfie ? 'ถ่ายใหม่' : 'ถ่ายรูปยืนยันตัวตน'}</button><input id="ck-cam" type="file" accept="image/*" capture="user" class="vh" data-selfie="1" tabindex="-1" aria-hidden="true">${C.selfie ? `<img src="${C.selfie}" alt="รูปที่ถ่าย">` : '<span class="muted">ต้องถ่ายรูปก่อนกดลงเวลา</span>'}</div>`;
    if (S.demo) h += `<div class="field check" style="margin-top:10px"><input type="checkbox" id="ck-inside"${C.inside ? ' checked' : ''}><label for="ck-inside">ทดลอง: สมมุติว่าอยู่ในร้าน (โหมดทดลองเท่านั้น)</label></div>`;
    h += `<p class="status" id="ck-msg">${p.off && type === 'in' ? 'วันนี้เป็นวันหยุดตามตาราง ถ้ามาทำงาน ระบบจะส่งให้ผู้มีสิทธิ์อนุมัติ' : `กดเมื่ออยู่ในร้าน ระบบตรวจ GPS ว่าอยู่ในรัศมี ${tb.radius || 80} เมตร${multi() ? ' ของสาขาใดสาขาหนึ่ง' : ''}`}</p>
      <button class="btn big primary" data-a="clock:${type}">${type === 'in' ? 'เข้างาน' : 'ออกงาน'}</button>`;
  }
  const tabs = [['days', 'ตารางของฉัน'], ['month', 'เดือนนี้'], ['leave', 'ขอลา'], ['fix', 'แจ้งแก้เวลา']];
  h += `<nav class="tabs" style="margin-top:22px" aria-label="ข้อมูลของฉัน">${tabs.map(([k, l]) => `<a href="#" data-a="tab:${k}"${C.tab === k ? ' aria-current="page"' : ''}>${l}</a>`).join('')}</nav>`;
  h += { days: tabDays, month: tabMonth, leave: tabLeave, fix: tabFix }[C.tab]();
  return h + '</div>';
}
function tabDays() {
  return `<div class="group daylist">${C.my.days.map(d => { const wd = Calc.weekday(d.date); return `<div class="row static"><span class="dd">${+d.date.slice(8)}<small>${WD[wd]}</small></span><span class="main"><span class="t" style="${d.plan.off ? 'color:var(--muted)' : ''}">${esc(planText(d.plan))}</span><span class="s">${d.date === C.my.today ? 'วันนี้, ' : ''}${multi() && !d.plan.off ? 'ที่' + esc(brName(d.plan.branch || C.my.homeBranch)) + ', ' : ''}${esc(d.plan.source)}${d.plan.pubHoliday ? ', ' + esc(d.plan.pubHoliday) : ''}</span></span>${d.leave ? `<span class="chip ${statusText[d.leave.status] || ''}">${esc(d.leave.type)}${d.leave.status === 'รออนุมัติ' ? ' รออนุมัติ' : ''}</span>` : ''}</div>`; }).join('')}</div>
  <p class="note">ตารางงานจัดโดยร้าน ถ้าวันไหนยังไม่ได้จัด จะแสดงตามรูปแบบกะประจำสัปดาห์ของคุณ</p>`;
}
function tabMonth() {
  const m = C.my, s = m.summary;
  return `<div class="stats"><div><b>${s.days}</b><span>วันที่ลงเวลา</span></div><div><b>${s.lateMin}</b><span>นาทีที่สาย</span></div><div><b>${s.otApproved}</b><span>นาที OT อนุมัติ${s.otPending ? `<br>รออนุมัติ ${s.otPending}` : ''}</span></div></div>
  <div class="group">${m.month.map(a => `<div class="row static"><span class="dd" style="width:44px;text-align:center;font:600 17px var(--display)">${+a.date.slice(8)}</span><span class="main"><span class="t">เข้า ${esc(a.inTime || '–')} ออก ${esc(a.outTime || '–')}</span><span class="s">${a.offWork === 'true' ? 'วันหยุดตามตาราง' : `กะ ${esc(a.planCode || '-')} ${esc(a.planStart || '')}–${esc(a.planEnd || '')}`}${multi() && a.branch ? ', ' + esc(brName(a.branch)) : ''}</span><span class="chips">${num(a.lateMin) ? `<span class="chip warn">สาย ${a.lateMin} นาที</span>` : ''}${num(a.otMin) ? `<span class="chip ${statusText[a.otStatus] || ''}">OT ${a.otMin} นาที ${esc(a.otStatus)}</span>` : ''}${a.offWork === 'true' ? `<span class="chip ${statusText[a.offStatus] || ''}">ทำงานวันหยุด ${esc(a.offStatus)}</span>` : ''}</span></span><span class="v">${a.outTime ? hrsShort(a.workMin) : ''}</span></div>`).join('') || empty('ยังไม่มีการลงเวลาเดือนนี้')}</div>`;
}
function tabLeave() {
  const m = C.my;
  return `<div class="stats">${m.quota.map(q => `<div><b>${fmtQ(Math.max(0, q.quota - q.used))}</b><span>${q.type} คงเหลือ (ใช้ ${fmtQ(q.used)}/${q.quota})</span></div>`).join('')}</div>
  <div class="group pad"><div class="form" id="lv-form">
    <div class="field"><label for="lv-type">ประเภท</label><select id="lv-type"><option>ลาป่วย</option><option>ลากิจ</option><option>ลาพักร้อน</option><option>ลาไม่รับค่าจ้าง</option></select></div>
    <div class="field half"><label for="lv-from">ตั้งแต่</label><input id="lv-from" type="date" value="${m.today}"></div><div class="field half"><label for="lv-to">ถึง</label><input id="lv-to" type="date" value="${m.today}"></div>
    <div class="field half"><label for="lv-days">จำนวนวัน</label><input id="lv-days" type="number" inputmode="decimal" step="0.5" placeholder="นับให้เอง"><span class="help">ครึ่งวันใส่ 0.5</span></div>
    <div class="field"><label for="lv-reason">เหตุผล</label><textarea id="lv-reason" rows="2"></textarea></div></div>
    <div class="actions" style="margin-bottom:0"><button class="btn primary" data-a="sendLeave">ส่งใบลา</button></div><p class="err" id="lv-err" role="alert"></p></div>
  <h3 class="h3">ใบลาของฉันปีนี้</h3><div class="group">${m.leaves.map(l => `<div class="row static"><span class="main"><span class="t">${esc(l.type)} ${fmtQ(l.days)} วัน</span><span class="s">${thDate(l.dateFrom)}${l.dateTo && l.dateTo !== l.dateFrom ? '–' + thDate(l.dateTo) : ''}${l.reason ? ', ' + esc(l.reason) : ''}</span></span><span class="chip ${statusText[l.status] || ''}">${esc(l.status)}</span>${l.status === 'รออนุมัติ' ? `<button class="btn sm" data-a="cancel:leaves/${l.id}">ยกเลิก</button>` : ''}</div>`).join('') || empty('ยังไม่มีใบลา')}</div>`;
}
function tabFix() {
  const m = C.my;
  return `<p class="note" style="margin-top:0">ลืมกดเข้างานหรือออกงาน ส่งคำขอที่นี่ อนุมัติแล้วระบบแก้เวลาให้</p>
  <div class="group pad"><div class="form">
    <div class="field"><label for="fx-date">วันที่</label><input id="fx-date" type="date" value="${m.today}" max="${m.today}"></div>
    <div class="field half"><label for="fx-in">เวลาเข้า</label><input id="fx-in" type="time"></div><div class="field half"><label for="fx-out">เวลาออก</label><input id="fx-out" type="time"></div>
    <div class="field"><label for="fx-reason">เหตุผล</label><textarea id="fx-reason" rows="2" placeholder="เช่น ลืมกดออกงาน"></textarea></div></div>
    <div class="actions" style="margin-bottom:0"><button class="btn primary" data-a="sendFix">ส่งคำขอ</button></div><p class="err" id="fx-err" role="alert"></p></div>
  <h3 class="h3">คำขอของฉัน</h3><div class="group">${m.fixes.map(f => `<div class="row static"><span class="main"><span class="t">${thDate(f.date, { weekday: 'short', day: 'numeric', month: 'short' })}${f.inTime ? ' เข้า ' + esc(f.inTime) : ''}${f.outTime ? ' ออก ' + esc(f.outTime) : ''}</span><span class="s">${esc(f.reason)}</span></span><span class="chip ${statusText[f.status] || ''}">${esc(f.status)}</span>${f.status === 'รออนุมัติ' ? `<button class="btn sm" data-a="cancel:timefix/${f.id}">ยกเลิก</button>` : ''}</div>`).join('') || empty('ยังไม่มีคำขอ')}</div>`;
}

/* ===== การทำงาน ===== */
async function loadStaff() {
  const d = await API.call('staff', C.kiosk ? { branch: C.kiosk } : {});
  C.staff = d.staff || []; C.shopName = d.shopName || ''; C.branches = d.branches || [];
  if (d.theme !== undefined) applyTheme(d.theme);
}
async function submitPin() {
  if (!/^\d{4,6}$/.test(C.pin)) { C.pinErr = 'ใส่ PIN 4–6 หลัก'; return render(); }
  C.pinErr = '';
  const btn = $('[data-a="key:ok"]');
  try {
    await busy(btn, async () => {
      const r = await API.call('login', { empId: C.emp.id, pin: C.pin, from: 'หน้าลงเวลา' });
      S.token = r.token;
      C.my = await API.call('my', { t: S.token });
      if (C.my.branches) C.branches = C.my.branches;
    }, '…');
    C.pin = ''; C.step = 'me'; C.tab = 'days'; C.result = null; C.selfie = '';
    render(); bump();
  } catch (e) {
    C.pin = '';
    if (e.code === 'SETUP') { C.su = { stage: 0, vals: ['', '', ''] }; C.pinErr = 'บัญชีของคุณยังไม่ได้ตั้ง PIN ใส่รหัสเปิดใช้งานก่อน'; }
    else C.pinErr = e.message;
    render();
  }
}
async function suKey(k) {
  const su = C.su, v = su.vals[su.stage];
  if (k === 'back') su.vals[su.stage] = v.slice(0, -1);
  else if (k !== 'ok' && v.length < 6) su.vals[su.stage] = v + k;
  C.pinErr = '';
  if (su.vals[su.stage].length < 6) { if (k === 'ok') C.pinErr = 'ใส่ให้ครบ 6 หลัก'; return render(); }
  if (su.stage < 2) { su.stage++; return render(); }
  if (su.vals[1] !== su.vals[2]) { su.stage = 1; su.vals[1] = su.vals[2] = ''; C.pinErr = 'PIN ทั้ง 2 ครั้งไม่ตรงกัน ตั้งใหม่อีกครั้ง'; return render(); }
  render();
  try {
    await busy($('[data-a="key:ok"]'), async () => {
      const r = await API.call('setupPin', { empId: C.emp.id, setup: su.vals[0], pin: su.vals[1], pin2: su.vals[2], from: 'clock' });
      S.token = r.token;
      C.my = await API.call('my', { t: S.token });
      if (C.my.branches) C.branches = C.my.branches;
    }, '…');
    C.emp.setup = false; C.su = null; C.step = 'me'; C.tab = 'days'; C.result = null; C.selfie = '';
    render(); bump(); toast('ตั้ง PIN เรียบร้อย ครั้งต่อไปใช้ PIN นี้');
  } catch (e) {
    const back = /รหัสเปิดใช้งาน|ผิดหลายครั้ง/.test(e.message) ? 0 : 1;
    su.stage = back; su.vals = back ? [su.vals[0], '', ''] : ['', '', '']; C.pinErr = e.message; render();
  }
}
async function refreshMy() { C.my = await API.call('my', { t: S.token }); }
async function doClock(type, btn) {
  const box = $('#ck-msg'), m = C.my, tb = brOf(m.plan.branch || m.homeBranch) || C.branches[0] || {};
  const msg = (t, cls = '') => { box.textContent = t; box.className = 'status ' + cls; };
  if (tb.requireSelfie && !C.selfie) return msg('ถ่ายรูปยืนยันตัวตนก่อนกดลงเวลา', 'bad');
  btn.disabled = true;
  try {
    let lat, lng, acc;
    if (S.demo && C.inside && tb.lat) { lat = tb.lat + 0.0001; lng = tb.lng + 0.0001; acc = 15; }
    else {
      msg('กำลังหาตำแหน่ง GPS…');
      let pos;
      try { pos = await getPos(); } catch (ge) { throw new Error(geoErr(ge)); }
      ({ latitude: lat, longitude: lng, accuracy: acc } = pos.coords);
      const n = nearest(lat, lng);
      if (n.near && !n.hit) {
        const ref = tb.hasGeo ? { b: tb, d: haversine(tb.lat, tb.lng, lat, lng) } : n.near;
        throw new Error(`อยู่นอกพื้นที่ร้าน ห่าง${ref.b.name} ${fmt(ref.d)} ม. (ลงเวลาได้ในรัศมี ${ref.b.radius} ม.)`);
      }
    }
    let photoId = '';
    if (C.selfie) { photoId = uid(); msg('กำลังส่งรูป…'); await API.post({ op: 'clockPhoto', t: S.token, id: photoId, data: C.selfie }); }
    msg('กำลังบันทึกเวลา…');
    const r = await API.call('clock', { t: S.token, type, lat, lng, acc, photoId });
    const extra = type === 'in'
      ? (r.offWork ? ', วันนี้เป็นวันหยุดตามตาราง รออนุมัติ' : num(r.lateMin) ? `, สาย ${r.lateMin} นาที` : toMin(r.time) < toMin(r.plan.start) - 30 ? `, มาก่อนเวลากะ (${r.plan.start})` : ', ตรงเวลา')
      : `, ทำงาน ${hrsShort(r.workMin)}${num(r.otMin) ? `, OT ${r.otMin} นาที รออนุมัติ` : ''}`;
    const where = multi() ? ` ที่${r.branchName || brName(r.branch)}` : '';
    const other = r.otherBranch ? ` ตารางงานวันนี้อยู่${brName(r.otherBranch)} แจ้ง Manager แล้ว` : '';
    C.result = { ok: true, msg: `${esc(r.name)} ${type === 'in' ? 'เข้างาน' : 'ออกงาน'}${esc(where)}แล้ว เวลา ${esc(r.time)} น.${esc(extra)} (ห่างร้าน ${r.dist} ม.)${esc(other)}` };
    C.selfie = '';
    await refreshMy();
    render();
  } catch (e) {
    if (e.code === 'SESSION') return backToWho('หมดเวลาการใช้งาน แตะชื่อแล้วใส่ PIN ใหม่');
    msg(e.message || 'ลงเวลาไม่สำเร็จ', 'bad');
  } finally { if (btn.isConnected) btn.disabled = false; }
}
async function sendReq(kind, btn) {
  const errEl = $(kind === 'leave' ? '#lv-err' : '#fx-err');
  const q = kind === 'leave'
    ? { kind, type: $('#lv-type').value, dateFrom: $('#lv-from').value, dateTo: $('#lv-to').value, days: $('#lv-days').value, reason: $('#lv-reason').value.trim() }
    : { kind, date: $('#fx-date').value, inTime: $('#fx-in').value, outTime: $('#fx-out').value, reason: $('#fx-reason').value.trim() };
  try {
    await busy(btn, () => API.call('myRequest', { t: S.token, p: JSON.stringify(q) }), 'กำลังส่ง…');
    await refreshMy();
    C.result = { ok: true, msg: kind === 'leave' ? 'ส่งใบลาแล้ว รออนุมัติ' : 'ส่งคำขอแก้เวลาแล้ว รออนุมัติ' };
    render(); window.scrollTo(0, 0);
  } catch (e) { if (e.code === 'SESSION') return backToWho('หมดเวลาการใช้งาน แตะชื่อแล้วใส่ PIN ใหม่'); errEl.textContent = e.message; }
}
function backToWho(note) {
  const t = S.token;
  S.token = ''; C.my = null; C.emp = null; C.pin = ''; C.su = null; C.selfie = ''; C.result = null; C.step = 'who';
  render();
  if (note) toast(note);
  if (t) API.call('logout', { t }).catch(() => {});
}
function bump() { C.idle = 0; }

const CACT = {
  pick: id => { C.emp = C.staff.find(e => e.id === id); if (!C.emp) return; C.pin = ''; C.pinErr = ''; C.su = C.emp.setup ? { stage: 0, vals: ['', '', ''] } : null; C.step = 'pin'; render(); bump(); const pi = $('#pin-input'); if (pi && matchMedia('(pointer:fine)').matches) pi.focus(); },
  key: k => { if (C.su) return suKey(k); if (k === 'back') C.pin = C.pin.slice(0, -1); else if (k === 'ok') return submitPin(); else if (C.pin.length < 6) C.pin += k; C.pinErr = ''; render(); if (C.pin.length === 6) submitPin(); },
  back: () => backToWho(),
  done: () => backToWho(),
  tab: k => { C.tab = k; C.result = null; render(); },
  cam: () => { const c = $('#ck-cam'); if (c) c.click(); },
  clock: (t, b) => doClock(t, b),
  sendLeave: (a, b) => sendReq('leave', b), sendFix: (a, b) => sendReq('fix', b),
  cancel: async (a, b) => { const [table, id] = a.split('/'); try { await busy(b, () => API.call('myRequest', { t: S.token, p: JSON.stringify({ kind: 'cancel', table, id }) }), '…'); await refreshMy(); render(); toast('ยกเลิกคำขอแล้ว'); } catch (e) { toast(e.message); } }
};
document.addEventListener('click', async e => {
  bump();
  const el = e.target.closest('[data-a]'); if (!el) return;
  const [k, ...rest] = el.dataset.a.split(':'); const fn = CACT[k]; if (!fn) return;
  e.preventDefault();
  try { await fn(rest.join(':'), el); } catch (err) { console.error(err); toast(err.message || 'เกิดข้อผิดพลาด'); }
});
document.addEventListener('keydown', e => {
  bump();
  if (C.step !== 'pin') return;
  if (/^\d$/.test(e.key)) { e.preventDefault(); CACT.key(e.key); }
  else if (e.key === 'Backspace') { e.preventDefault(); CACT.key('back'); }
  else if (e.key === 'Enter') { e.preventDefault(); CACT.key('ok'); }
  else if (e.key === 'Escape') backToWho();
});
document.addEventListener('input', e => {
  if (e.target.id === 'ck-find') { const q = e.target.value.trim().toLowerCase(); $$('#people button').forEach(b => { b.hidden = q && !b.dataset.name.toLowerCase().includes(q); }); }
});
document.addEventListener('change', async e => {
  bump();
  const t = e.target;
  if (t.id === 'ck-inside') { C.inside = t.checked; return; }
  if (t.dataset.selfie && t.files && t.files[0]) {
    try { C.selfie = await readPhoto(t.files[0], 360); C.result = null; render(); } catch (err) { toast(err.message); }
  }
});

async function boot() {
  applyTheme(cachedTheme());
  loadCfg();
  const qb = new URLSearchParams(location.search).get('branch');
  if (qb && /^[A-Za-z0-9-]{2,10}$/.test(qb)) C.kiosk = qb.toUpperCase();
  $('#root').innerHTML = '<p class="loading">กำลังโหลดรายชื่อ…</p>';
  try { await loadStaff(); } catch (e) { $('#root').innerHTML = `<div class="clock-shell">${header()}<p class="status bad">${esc(e.message)}</p><div class="actions"><button class="btn" onclick="location.reload()">ลองใหม่</button></div></div>`; return; }
  render();
  C.tick = setInterval(() => {
    const el = $('#ck-time'); if (el) el.textContent = hhmm(new Date());
    if (C.step !== 'who' && ++C.idle >= IDLE_SEC) backToWho('ออกจากระบบอัตโนมัติเพราะไม่มีการใช้งาน');
  }, 1000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && C.step === 'who') loadStaff().then(render).catch(() => {}); });
}
boot();
