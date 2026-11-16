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
  else if (C.step === 'reg') root.innerHTML = viewReg();
  else root.innerHTML = viewMe();
}
function viewWho() {
  const now = new Date();
  return `<div class="clock-shell">${header()}
    <p class="clock-face" id="ck-time">${hhmm(now)}</p><p class="clock-date">${now.toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
    ${!C.branches.some(b => b.hasGeo) ? '<p class="status bad">ร้านยังไม่ได้ตั้งพิกัดสำหรับลงเวลา แจ้ง Owner</p>' : C.kiosk && brOf(C.kiosk) && !brOf(C.kiosk).hasGeo ? `<p class="status bad">${esc(brName(C.kiosk))} ยังไม่ได้ตั้งพิกัด แจ้ง Owner</p>` : ''}
    <form class="group pad who-form" id="people" data-who="1" autocomplete="off"><div class="form"><div class="field"><label for="ck-code">รหัสพนักงาน</label><input id="ck-code" autocapitalize="characters" autocomplete="off" placeholder="เช่น A123" maxlength="20" value="${esc(C.whoCode || '')}"></div></div>
      <p class="err" id="who-err" role="alert">${esc(C.whoErr || '')}</p><div class="actions" style="margin-bottom:0"><button class="btn big primary" type="button" data-a="codeNext">ถัดไป</button></div></form>
    <p class="status good" style="margin-top:18px">ลงทะเบียน LINE แล้วไม่ต้องใช้ PIN: พิมพ์ "ลงเวลา" ในแชต LINE ของร้าน</p><p class="note">ใช้ PIN 6 หลักที่ได้ทาง LINE ตอนลงทะเบียน ถ้าลืม PIN พิมพ์ "ลืม PIN" ในแชต LINE ของร้าน${multi() && !C.kiosk ? ' ลงเวลาได้ทุกสาขา ระบบดูจาก GPS ว่าคุณอยู่สาขาไหน' : ''}</p></div>`;
}
function viewPin() {
  const e = C.emp, su = C.su, n = su ? su.vals[su.stage].length : C.pin.length;
  const sub = su ? `<span class="chip">ตั้ง PIN ครั้งแรก ${su.stage + 1}/3</span><br>${SU_STEPS[su.stage]}` : 'ใส่ PIN 4–6 หลัก';
  return `<div class="clock-shell">${header()}
    <div style="text-align:center;margin-top:10px"><h2 class="h2" style="justify-content:center;margin:8px 0 0">รหัส ${esc(e.code)}</h2><p class="muted su-step" style="margin:2px 0 0">${sub}</p></div>
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
    <h2 class="h2" style="margin-top:6px">สวัสดี ${esc(m.emp.name)}<span class="spacer"></span>${C.via === 'line' ? '' : '<button class="btn sm" data-a="lineLink">เชื่อม LINE</button> '}<button class="btn sm" data-a="done">เสร็จแล้ว</button></h2>
    ${C.via === 'line' ? '<p class="status good" style="margin:0 0 8px">เข้าจาก LINE แล้ว ไม่ต้องใส่ PIN</p>' : ''}
    <div class="today-card"><span class="k">วันนี้ ${thDate(m.today, { weekday: 'long', day: 'numeric', month: 'short' })}${p.source === 'ตารางงาน' ? ', ตามตารางงาน' : p.source ? ', ' + esc(p.source) : ''}</span>
      <p class="shift">${esc(planText(p))}</p>${multi() && !p.off ? `<p style="margin:2px 0 6px">ที่ <b>${esc(tb.name || p.branch)}</b>${p.branch && p.branch !== m.homeBranch ? ' <span class="chip warn">ไปช่วยสาขาอื่น</span>' : ''}</p>` : ''}
      ${p.pubHoliday ? `<span class="chip warn">${esc(p.pubHoliday)}</span> ` : ''}${todayLeave ? `<span class="chip ${statusText[todayLeave.status] || ''}">${esc(todayLeave.type)} ${esc(todayLeave.status)}</span>` : ''}
      <p style="margin:8px 0 0">${stateLine}</p></div>`;
  if (r) h += `<p class="status ${r.ok ? 'good' : 'bad'}" role="status">${r.msg}</p>`;
  const chOff = C.via === 'line' ? tb.allowLine === false : tb.allowKiosk === false;   // สาขาปิดช่องทางนี้ (ใช้เครื่องสแกนนิ้ว)
  if (st !== 'done' && chOff) h += `<p class="status" role="note">สาขา ${esc(tb.name || '')} ลงเวลาด้วย<b>เครื่องสแกนนิ้ว</b>ที่ร้าน เวลาจะขึ้นที่นี่หลังร้านนำเข้าข้อมูลจากเครื่อง ขอ OT ลา แจ้งแก้เวลา ใช้แท็บด้านล่างได้ตามปกติ</p>`;
  if (st !== 'done' && !chOff) {
    const type = st === 'in' ? 'out' : 'in';
    if (tb.requireSelfie) h += `<div class="selfie-box"><button type="button" class="btn" data-a="cam">${C.selfie ? 'ถ่ายใหม่' : 'ถ่ายรูปยืนยันตัวตน'}</button><input id="ck-cam" type="file" accept="image/*" capture="user" class="vh" data-selfie="1" tabindex="-1" aria-hidden="true">${C.selfie ? `<img src="${C.selfie}" alt="รูปที่ถ่าย">` : '<span class="muted">ต้องถ่ายรูปก่อนกดลงเวลา</span>'}</div>`;
    if (S.demo) h += `<div class="field check" style="margin-top:10px"><input type="checkbox" id="ck-inside"${C.inside ? ' checked' : ''}><label for="ck-inside">ทดลอง: สมมุติว่าอยู่ในร้าน (โหมดทดลองเท่านั้น)</label></div>`;
    h += `<p class="status" id="ck-msg">${p.off && type === 'in' ? 'วันนี้เป็นวันหยุดตามตาราง ถ้ามาทำงาน ระบบจะส่งให้ผู้มีสิทธิ์อนุมัติ' : `กดเมื่ออยู่ในร้าน ระบบตรวจ GPS ว่าอยู่ในรัศมี ${tb.radius || 80} เมตร${multi() ? ' ของสาขาใดสาขาหนึ่ง' : ''}`}</p>
      <button class="btn big primary" data-a="clock:${type}">${type === 'in' ? 'เข้างาน' : 'ออกงาน'}</button>`;
  }
  const tabs = [['days', 'ตารางของฉัน'], ['month', 'เดือนนี้'], ['ot', 'ขอ OT'], ['leave', 'ขอลา'], ['fix', 'แจ้งแก้เวลา']].concat(typeof tabSwap === 'function' ? [['swap', 'แลกกะ']] : []);   // แลกกะ (clock-swap.js)
  h += `<nav class="tabs" style="margin-top:22px" aria-label="ข้อมูลของฉัน">${tabs.map(([k, l]) => `<a href="#" data-a="tab:${k}"${C.tab === k ? ' aria-current="page"' : ''}>${l}</a>`).join('')}</nav>`;
  h += ({ days: tabDays, month: tabMonth, ot: tabOT, leave: tabLeave, fix: tabFix, swap: typeof tabSwap === 'function' ? tabSwap : tabDays }[C.tab] || tabDays)();
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

/* ===== Key OT ===== */
const otMinOf = (a, b) => { if (!a || !b) return 0; let m = toMin(b) - toMin(a); if (m <= 0) m += 1440; return Math.floor(m / 15) * 15; };
function tabOT() {
  const m = C.my, list = m.otreqs || [], rate = num(m.otRate);
  return `<p class="note" style="margin-top:0">OT หลังเลิกกะระบบคิดให้เองตอนออกงาน ถ้าทำ OT นอกเวลาที่ลงไว้ (เช่น มาก่อนเปิดร้าน งานนอกสถานที่) ขอที่นี่ ส่งให้ผู้อนุมัติใน LINE${rate ? ` · ${rate} บาท/ชม.` : ''}</p>
  <div class="group pad"><div class="form">
    <div class="field"><label for="ot-date">วันที่ทำ OT</label><input id="ot-date" type="date" value="${m.today}" max="${addDays(m.today, 14)}" min="${addDays(m.today, -31)}"></div>
    <div class="field half"><label for="ot-s">เริ่ม</label><input id="ot-s" type="time" value="${esc(m.plan && !m.plan.off && m.plan.end ? m.plan.end : '')}"></div><div class="field half"><label for="ot-e">สิ้นสุด</label><input id="ot-e" type="time"></div>
    <p class="status" id="ot-sum" style="margin:0;grid-column:1/-1">ใส่เวลาเริ่ม-สิ้นสุด ระบบคิดทีละ 15 นาที</p>
    <div class="field"><label for="ot-r">งานที่ทำ / เหตุผล</label><textarea id="ot-r" rows="2" placeholder="เช่น ทำความสะอาดเครื่องหลังปิดร้าน"></textarea></div></div>
    <div class="actions" style="margin-bottom:0"><button class="btn primary" data-a="sendOT">ส่งคำขอ OT</button></div><p class="err" id="ot-err" role="alert"></p></div>
  <h3 class="h3">คำขอ OT ของฉัน</h3><div class="group">${list.map(r => { const paid = r.status === 'อนุมัติ' && r.otOk !== '' && r.otOk != null ? num(r.otOk) : num(r.minutes); return `<div class="row static"><span class="main"><span class="t">${thDate(r.date, { weekday: 'short', day: 'numeric', month: 'short' })} ${esc(r.startTime)}–${esc(r.endTime)}</span><span class="s">${esc(r.reason)}${r.decideNote ? ' · ' + esc(r.decideNote) : ''}</span><span class="chips"><span class="chip ${statusText[r.status] || ''}">${esc(r.status)}</span><span class="chip">${hrsShort(paid)}${rate ? ' · ' + fmt(Math.round(paid / 60 * rate * 100) / 100) + ' บาท' : ''}</span>${r.status === 'อนุมัติ' && num(r.otOk) !== num(r.minutes) && r.otOk !== '' ? `<span class="chip warn">ขอ ${r.minutes} นาที</span>` : ''}</span></span>${r.status === 'รออนุมัติ' ? `<button class="btn sm" data-a="cancel:otreq/${r.id}">ยกเลิก</button>` : ''}</div>`; }).join('') || empty('ยังไม่มีคำขอ OT')}</div>`;
}
/* ===== LINE LIFF: เข้าระบบด้วย LINE ไม่ต้องใช้ PIN / ลงทะเบียนครั้งแรก ===== */
function viewReg() {
  const pr = C.lineProfile || {};
  return `<div class="clock-shell">${header()}
    <div class="reg-line">${pr.pictureUrl ? `<img src="${esc(pr.pictureUrl)}" alt="">` : `<span class="ph">${esc((pr.displayName || 'L').slice(0, 1))}</span>`}<span><small>บัญชี LINE ของคุณ</small><b>${esc(pr.displayName || '')}</b></span></div>
    <h2 class="h2" style="margin-top:16px">ลงทะเบียนพนักงาน</h2>
    <p class="note" style="margin-top:0">ครั้งแรกครั้งเดียว กรอกให้ตรงกับข้อมูลที่ร้านบันทึกไว้ (ชื่อไทย หรือชื่อภาษาอังกฤษ) ต่อไปเปิดจาก LINE ได้เลย ไม่ต้องใช้ PIN</p>
    <div class="group pad"><div class="form">
      <div class="field"><label for="rg-code">รหัสพนักงาน</label><input id="rg-code" autocapitalize="characters" placeholder="เช่น A123" maxlength="12"></div>
      <div class="field"><label for="rg-first">ชื่อ</label><input id="rg-first" maxlength="40" placeholder="Somchai"></div>
      <div class="field"><label for="rg-last">นามสกุล</label><input id="rg-last" maxlength="60" placeholder="Jaidee"></div></div>
      <p class="err" id="rg-err" role="alert">${esc(C.regErr || '')}</p>
      <div class="actions" style="margin-bottom:0"><button class="btn big primary" data-a="liffReg">ลงทะเบียน</button></div></div>
    <p class="note">ไม่รู้รหัสพนักงาน ถาม Owner/HR · 1 รหัสพนักงานลงทะเบียนได้กับ LINE เดียว</p></div>`;
}
function enterMe(r, tab) {
  S.token = r.token; setMy(r.my); C.via = 'line';
  C.shopName = C.my.shopName || C.shopName;
  C.emp = { id: C.my.emp.id, nickname: C.my.emp.name, code: C.my.emp.code };
  C.step = 'me'; C.tab = { leave: 'leave', fix: 'fix', month: 'month', ot: 'ot', swap: 'swap' }[tab] || 'days'; C.result = null; C.selfie = '';
  render();
  if (C.my.state !== 'done') startGeo();
  if (C.my.lite) loadFull();
  if (!C.tick) C.tick = setInterval(() => { if (C.step !== 'who' && C.step !== 'reg' && ++C.idle >= IDLE_SEC) backToWho('ออกจากระบบอัตโนมัติเพราะไม่มีการใช้งาน'); }, 1000);
}
async function liffBoot() {
  if (typeof liffFastBoot === 'function') return liffFastBoot();   // liff-fast.js: เปิดเร็ว
  // ใส่ LIFF ID ไว้ใน js/config.js (window.AMZ_LIFF) ไม่ต้องถามเซิร์ฟเวอร์ก่อน เปิดเร็วขึ้น 1 รอบ
  const sdk = window.liff ? Promise.resolve() : loadScript('https://static.line-scdn.net/liff/edge/2/sdk.js');
  // ปลุก Apps Script ระหว่างโหลด LINE SDK (ครั้งแรกหลังว่างนาน Google ใช้เวลาเริ่ม 1–3 วิ) ให้คำขอถัดไปเร็ว
  if (window.AMZ_LIFF) API.call('liffInfo').catch(() => {});
  const info = window.AMZ_LIFF ? { liffId: window.AMZ_LIFF } : await API.call('liffInfo');
  if (!info.liffId) return false;
  if (info.theme) applyTheme(info.theme);
  C.shopName = info.shopName || C.shopName;
  await sdk;
  await liff.init({ liffId: info.liffId });
  if (!liff.isLoggedIn()) { liff.login({ redirectUri: location.href }); return true; }
  C.liff = true;
  const tab = new URLSearchParams(location.search).get('tab');
  $('#root').innerHTML = '<p class="loading">กำลังเข้าสู่ระบบด้วย LINE…</p>';
  const r = await API.call('liffLogin', { idToken: liff.getIDToken() });
  if (r.registered) { enterMe(r, tab === 'clock' ? 'days' : tab); return true; }
  try { C.lineProfile = await liff.getProfile(); } catch (e) { C.lineProfile = { displayName: r.lineName }; }
  C.step = 'reg'; C.regTab = tab; render(); return true;
}
async function liffReg(btn) {
  const code = $('#rg-code').value.trim(), firstName = $('#rg-first').value.trim(), lastName = $('#rg-last').value.trim();
  if (!code || !firstName || !lastName) { $('#rg-err').textContent = 'กรอกให้ครบทุกช่อง'; return; }
  try {
    const g = await busy(btn, () => API.call('liffRegister', { idToken: liff.getIDToken(), code, firstName, lastName }), 'กำลังตรวจสอบ…');
    const r = g.login || await API.call('liffLogin', { idToken: liff.getIDToken() });   // ลงทะเบียน + เข้าระบบในคำขอเดียว
    enterMe(r, C.regTab); toast('ลงทะเบียนสำเร็จ ต่อไปเปิดจาก LINE ได้เลย');
    if (g.web && typeof oneRegShow === 'function') oneRegShow(g.web);   // ชื่อผู้ใช้ + PIN เข้าเว็บ (onereg.js)
  } catch (e) { $('#rg-err').textContent = e.message; }
}

/* ===== การทำงาน ===== */
async function loadStaff() {
  const d = await API.call('staff', C.kiosk ? { branch: C.kiosk } : {});
  C.staff = d.staff || []; C.shopName = d.shopName || ''; C.branches = d.branches || [];
  if (d.theme !== undefined) applyTheme(d.theme);
}
/** พิมพ์รหัสพนักงาน → ตรวจว่ามีจริง / ต้องตั้ง PIN ครั้งแรกไหม (หน้าเว็บไม่แสดงรายชื่อใคร) */
async function codeNext(btn) {
  const code = ($('#ck-code') || {}).value ? $('#ck-code').value.trim() : '';
  C.whoCode = code; C.whoErr = '';
  if (!code) { C.whoErr = 'ใส่รหัสพนักงาน'; return render(); }
  try {
    const r = await busy(btn, () => API.call('clockWho', { code }), '…');
    C.emp = { code: r.code, id: '' }; C.pin = ''; C.pinErr = ''; C.su = r.setup ? { stage: 0, vals: ['', '', ''] } : null; C.step = 'pin'; C.whoCode = '';
    render(); bump(); const pi = $('#pin-input'); if (pi && matchMedia('(pointer:fine)').matches) pi.focus();
  } catch (e) { C.whoErr = e.message; render(); }
}
async function submitPin() {
  if (!/^\d{4,6}$/.test(C.pin)) { C.pinErr = 'ใส่ PIN 4–6 หลัก'; return render(); }
  C.pinErr = '';
  const btn = $('[data-a="key:ok"]');
  try {
    await busy(btn, async () => {
      const r = await API.call('login', { code: C.emp.code, pin: C.pin, from: 'หน้าลงเวลา', my: 1 });
      S.token = r.token;
      setMy(r.my || await API.call('my', { t: S.token }));   // ข้อมูลของฉันมากับการเข้าสู่ระบบแล้ว (Apps Script รุ่นเก่าไม่มี จึงขอแยก)
    }, '…');
    C.pin = ''; C.step = 'me'; C.tab = 'days'; C.result = null; C.selfie = '';
    render(); bump();
    if (C.my.state !== 'done') startGeo();
    if (C.my.lite) loadFull();
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
      const r = await API.call('setupPin', { code: C.emp.code, setup: su.vals[0], pin: su.vals[1], pin2: su.vals[2], from: 'clock' });
      S.token = r.token;
      setMy(await API.call('my', { t: S.token }));
    }, '…');
    C.emp.setup = false; C.su = null; C.step = 'me'; C.tab = 'days'; C.result = null; C.selfie = '';
    render(); bump(); toast('ตั้ง PIN เรียบร้อย ครั้งต่อไปใช้ PIN นี้');
  } catch (e) {
    const back = /รหัสเปิดใช้งาน|ผิดหลายครั้ง/.test(e.message) ? 0 : 1;
    su.stage = back; su.vals = back ? [su.vals[0], '', ''] : ['', '', '']; C.pinErr = e.message; render();
  }
}
async function refreshMy() { setMy(await API.call('my', { t: S.token })); }
/** ส่งสำเร็จแล้วแสดงผลทันที ข้อมูลรายการคำขอโหลดใหม่เบื้องหลัง (ไม่ต้องรอรอบที่ 2) */
function refreshLater() { const res = () => C.result; refreshMy().then(() => { const r = res(); C.result = r; if (C.step === 'me') render(); }).catch(() => {}); }
/* ===== ความเร็ว: ตั๋วเวลา / GPS ล่วงหน้า / รูปส่งก่อน / ข้อมูลเต็มโหลดตามหลัง (24_FastClock.gs) ===== */
function setMy(m) {
  C.my = m;
  if (m && m.tk) { C.tk = m.tk; C.tk0 = performance.now(); }
  if (m && m.branches) C.branches = m.branches;
}
function tapInfo() { return C.tk ? { tk: C.tk, el: Math.round(performance.now() - C.tk0) } : {}; }
async function loadFull() {
  try { const res = C.result; setMy(await API.call('my', { t: S.token })); C.result = res; if (C.step === 'me') render(); } catch (e) { /* ใช้ข้อมูลย่อไปก่อน */ }
}
function startGeo() {
  if (C.geoWatch != null || !navigator.geolocation || S.demo) return;
  try { C.geoWatch = navigator.geolocation.watchPosition(p => { C.pos = { coords: p.coords, at: Date.now() }; }, () => {}, { enableHighAccuracy: true, maximumAge: 10000, timeout: 30000 }); } catch (e) { C.geoWatch = null; }
}
function stopGeo() { if (C.geoWatch != null) { try { navigator.geolocation.clearWatch(C.geoWatch); } catch (e) { /* ignore */ } C.geoWatch = null; } }
/** ตำแหน่งที่หาไว้แล้ว ถ้ายังสดและแม่นพอ ใช้ได้เลยไม่ต้องรอ GPS */
function freshPos(tb) { const p = C.pos; return p && Date.now() - p.at < 45000 && p.coords.accuracy <= (tb.maxAccuracy || 100) ? p : null; }
function startPhotoUpload() { C.photoId = uid(); const id = C.photoId; C.photoUp = API.post({ op: 'clockPhoto', t: S.token, id, data: C.selfie }).catch(e => { C.photoUp = null; throw e; }); }
setInterval(() => { if (S.token && C.step === 'me' && C.tk && performance.now() - C.tk0 > 150000 && !document.hidden) API.call('tick', { t: S.token }).then(x => { C.tk = x.tk; C.tk0 = performance.now(); }).catch(() => {}); }, 30000);
async function doClock(type, btn) {
  const box = $('#ck-msg'), m = C.my, tb = brOf(m.plan.branch || m.homeBranch) || C.branches[0] || {};
  const msg = (t, cls = '') => { box.textContent = t; box.className = 'status ' + cls; };
  if (tb.requireSelfie && !C.selfie) return msg('ถ่ายรูปยืนยันตัวตนก่อนกดลงเวลา', 'bad');
  const tap = tapInfo();   // ล็อกเวลาที่กดทันที (ช้าตรงไหนหลังจากนี้ก็ไม่ทำให้สาย)
  btn.disabled = true;
  try {
    let lat, lng, acc;
    if (S.demo && C.inside && tb.lat) { lat = tb.lat + 0.0001; lng = tb.lng + 0.0001; acc = 15; }
    else {
      let pos = freshPos(tb);
      if (!pos) { msg('กำลังหาตำแหน่ง GPS…'); try { pos = await getPos(); } catch (ge) { throw new Error(geoErr(ge)); } }
      ({ latitude: lat, longitude: lng, accuracy: acc } = pos.coords);
      const n = nearest(lat, lng);
      if (n.near && !n.hit) {
        const ref = tb.hasGeo ? { b: tb, d: haversine(tb.lat, tb.lng, lat, lng) } : n.near;
        throw new Error(`อยู่นอกพื้นที่ร้าน ห่าง${ref.b.name} ${fmt(ref.d)} ม. (ลงเวลาได้ในรัศมี ${ref.b.radius} ม.)`);
      }
    }
    let photoId = '';
    if (C.selfie) { if (!C.photoUp) startPhotoUpload(); msg('กำลังส่งรูป…'); photoId = C.photoId; await C.photoUp; }
    msg('กำลังบันทึกเวลา…');
    const r = await API.call('clock', { t: S.token, type, lat, lng, acc, photoId, ...tap });
    const extra = type === 'in'
      ? (r.offWork ? ', วันนี้เป็นวันหยุดตามตาราง รออนุมัติ' : num(r.lateMin) ? `, สาย ${r.lateMin} นาที` : toMin(r.time) < toMin(r.plan.start) - 30 ? `, มาก่อนเวลากะ (${r.plan.start})` : ', ตรงเวลา')
      : `, ทำงาน ${hrsShort(r.workMin)}${num(r.otMin) ? `, OT ${r.otMin} นาที รออนุมัติ` : ''}`;
    const where = multi() ? ` ที่${r.branchName || brName(r.branch)}` : '';
    const other = r.otherBranch ? ` ตารางงานวันนี้อยู่${brName(r.otherBranch)} แจ้ง Manager แล้ว` : '';
    C.result = { ok: true, msg: `${esc(r.name)} ${type === 'in' ? 'เข้างาน' : 'ออกงาน'}${esc(where)}แล้ว เวลา ${esc(r.time)} น.${esc(extra)} (ห่างร้าน ${r.dist} ม.)${esc(other)}` };
    C.selfie = ''; C.photoUp = null; C.photoId = '';
    // แสดงผลทันที แล้วค่อยโหลดข้อมูลใหม่เบื้องหลัง
    const rec = { date: r.date, inTime: type === 'in' ? r.time : (m.open && m.open.inTime) || '', outTime: type === 'out' ? r.time : '', lateMin: r.lateMin, workMin: r.workMin, otMin: r.otMin };
    if (type === 'in') { m.state = 'in'; m.open = rec; } else { m.state = 'done'; m.todayRec = rec; m.open = null; }
    render();
    loadFull();
  } catch (e) {
    if (e.code === 'SESSION') return backToWho('หมดเวลาการใช้งาน แตะชื่อแล้วใส่ PIN ใหม่');
    if (/รูป/.test(e.message || '')) { C.photoUp = null; }
    msg(e.message || 'ลงเวลาไม่สำเร็จ', 'bad');
  } finally { if (btn.isConnected) btn.disabled = false; }
}
async function sendOT(btn) {
  const q = { kind: 'ot', date: $('#ot-date').value, startTime: $('#ot-s').value, endTime: $('#ot-e').value, reason: $('#ot-r').value.trim(), reqId: C.reqId = C.reqId || uid() };
  try {
    const r = await busy(btn, () => API.call('myRequest', { t: S.token, p: JSON.stringify(q) }), 'กำลังส่ง…');
    C.reqId = ''; refreshLater();
    C.result = { ok: true, msg: `ส่งคำขอ OT ${hrsShort(r.minutes || 0)} แล้ว รออนุมัติ ระบบแจ้งผลใน LINE` }; render(); window.scrollTo(0, 0);
  } catch (e) { if (e.code === 'SESSION') return backToWho('หมดเวลาการใช้งาน'); $('#ot-err').textContent = e.message; }
}
async function sendReq(kind, btn) {
  const errEl = $(kind === 'leave' ? '#lv-err' : '#fx-err');
  C.reqId = C.reqId || uid();   // กดซ้ำ/เน็ตช้า ส่งซ้ำ ระบบบันทึกครั้งเดียว
  const q = kind === 'leave'
    ? { kind, type: $('#lv-type').value, dateFrom: $('#lv-from').value, dateTo: $('#lv-to').value, days: $('#lv-days').value, reason: $('#lv-reason').value.trim() }
    : { kind, date: $('#fx-date').value, inTime: $('#fx-in').value, outTime: $('#fx-out').value, reason: $('#fx-reason').value.trim() };
  q.reqId = C.reqId;
  try {
    await busy(btn, () => API.call('myRequest', { t: S.token, p: JSON.stringify(q) }), 'กำลังส่ง…');
    C.reqId = '';
    refreshLater();
    C.result = { ok: true, msg: kind === 'leave' ? 'ส่งใบลาแล้ว รออนุมัติ' : 'ส่งคำขอแก้เวลาแล้ว รออนุมัติ' };
    render(); window.scrollTo(0, 0);
  } catch (e) { if (e.code === 'SESSION') return backToWho('หมดเวลาการใช้งาน แตะชื่อแล้วใส่ PIN ใหม่'); errEl.textContent = e.message; }
}
function backToWho(note) {
  const t = S.token;
  stopGeo(); C.tk = ''; C.pos = null; C.photoUp = null;
  if (C.via === 'line') {   // มาจาก LINE: จบแล้วกลับไปที่แชต
    S.token = ''; C.my = null; C.via = ''; C.result = null;
    $('#root').innerHTML = `<div class="clock-shell">${header()}<div class="today-card" style="text-align:center;margin-top:24px"><p class="shift">เรียบร้อย</p><p>${esc(note || 'ปิดหน้านี้แล้วกลับไปที่ LINE ได้เลย')}</p><p class="muted">ครั้งต่อไปพิมพ์ "เข้างาน" หรือกดเมนูในแชต LINE ของร้าน</p></div>${C.liff ? '<div class="actions"><button class="btn big primary" onclick="liff.closeWindow()">กลับไปที่แชต</button></div>' : ''}</div>`;
    if (C.liff && !note) { try { liff.closeWindow(); } catch (x) { /* เปิดนอก LINE */ } }
    if (t) API.call('logout', { t }).catch(() => {});
    return;
  }
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
  codeNext: (a, b) => codeNext(b),
  done: () => backToWho(),
  tab: k => { C.tab = k; C.result = null; render(); },
  cam: () => { const c = $('#ck-cam'); if (c) c.click(); },
  clock: (t, b) => doClock(t, b),
  liffReg: (a, b) => liffReg(b),
  sendOT: (a, b) => sendOT(b),
  lineLink: async (a, b) => { const r = await busy(b, () => API.call('lineLinkCode', { t: S.token }), '…'); C.result = { ok: true, msg: `เพิ่มเพื่อน LINE ของร้าน แล้วส่งข้อความ <b>link ${esc(r.code)}</b> ภายใน ${r.minutes} นาที ผูกแล้วพิมพ์ "เมนู" เพื่อลงเวลา ขอลา ดูตารางงานผ่าน LINE` }; render(); window.scrollTo(0, 0); },
  sendLeave: (a, b) => sendReq('leave', b), sendFix: (a, b) => sendReq('fix', b),
  cancel: async (a, b) => { const [table, id] = a.split('/'); try { await busy(b, () => API.call('myRequest', { t: S.token, p: JSON.stringify({ kind: 'cancel', table, id }) }), '…'); refreshLater(); toast('ยกเลิกคำขอแล้ว'); } catch (e) { toast(e.message); } }
};
document.addEventListener('submit', e => { if (e.target.dataset && e.target.dataset.who) { e.preventDefault(); codeNext($('[data-a="codeNext"]')); } });
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
  if (e.target.id === 'ot-s' || e.target.id === 'ot-e') { const mm = otMinOf($('#ot-s').value, $('#ot-e').value), rate = num(C.my && C.my.otRate), el = $('#ot-sum'); if (el) el.textContent = mm ? `OT ${hrsShort(mm)}${rate ? ` ≈ ${fmt(Math.round(mm / 60 * rate * 100) / 100)} บาท` : ''}` : 'ใส่เวลาเริ่ม-สิ้นสุด ระบบคิดทีละ 15 นาที'; return; }
  if (e.target.id === 'ck-find') { const q = e.target.value.trim().toLowerCase(); $$('#people button').forEach(b => { b.hidden = q && !b.dataset.name.toLowerCase().includes(q); }); }
});
document.addEventListener('change', async e => {
  bump();
  const t = e.target;
  if (t.id === 'ck-inside') { C.inside = t.checked; return; }
  if (t.dataset.selfie && t.files && t.files[0]) {
    try { C.selfie = await readPhoto(t.files[0], 360); C.result = null; if (S.token && !S.demo) startPhotoUpload(); render(); } catch (err) { toast(err.message); }
  }
});

async function boot() {
  applyTheme(cachedTheme());
  loadCfg();
  if (window.AMZ_EMBED && typeof embedBoot === 'function') return embedBoot();   // เปิดจากหลังร้าน (clock-embed.js)
  const qb = new URLSearchParams(location.search).get('branch');
  if (qb && /^[A-Za-z0-9-]{2,10}$/.test(qb)) C.kiosk = qb.toUpperCase();
  $('#root').innerHTML = '<p class="loading">กำลังโหลดรายชื่อ…</p>';
  const qs = new URLSearchParams(location.search), lt = qs.get('lt');
  const inLine = /\bLine\//i.test(navigator.userAgent) || qs.has('liff.state') || qs.has('liff') || qs.has('tab') && !lt;
  if (inLine && !S.demo) {
    try { if (await liffBoot()) { loadStaff().catch(() => {}); return; } }
    catch (e) { $('#root').innerHTML = `<div class="clock-shell">${header()}<p class="status bad">${esc(e.message || 'เปิดผ่าน LINE ไม่สำเร็จ')}</p><div class="actions"><button class="btn" onclick="location.reload()">ลองใหม่</button></div></div>`; return; }
  }
  if (lt) {   // ลิงก์จากการ์ดใน LINE: เข้าระบบให้เลยโดยไม่ต้องใส่ PIN (ใช้ได้ครั้งเดียว)
    history.replaceState(null, '', location.pathname + (C.kiosk ? '?branch=' + C.kiosk : ''));
    try {
      $('#root').innerHTML = '<p class="loading">กำลังเข้าสู่ระบบจาก LINE…</p>';
      const r = await API.call('lineLogin', { lt });
      if (!r.my) throw new Error('บัญชีนี้ไม่ใช่พนักงาน ลงเวลาไม่ได้');
      S.token = r.token; setMy(r.my); C.via = 'line';
      C.shopName = C.my.shopName || C.shopName;
      C.emp = { id: C.my.emp.id, nickname: C.my.emp.name, code: C.my.emp.code };
      C.step = 'me'; C.tab = { leave: 'leave', fix: 'fix', month: 'month', ot: 'ot', swap: 'swap' }[qs.get('tab')] || 'days'; C.result = null; C.selfie = '';
      render();
      if (C.my.state !== 'done') startGeo();
      if (C.my.lite) loadFull();
      C.tick = setInterval(() => { if (C.step !== 'who' && ++C.idle >= IDLE_SEC) backToWho('ออกจากระบบอัตโนมัติเพราะไม่มีการใช้งาน'); }, 1000);
      loadStaff().catch(() => {});
      return;
    } catch (e) { C.via = ''; toast(e.message); }
  }
  try { await loadStaff(); } catch (e) { $('#root').innerHTML = `<div class="clock-shell">${header()}<p class="status bad">${esc(e.message)}</p><div class="actions"><button class="btn" onclick="location.reload()">ลองใหม่</button></div></div>`; return; }
  render();
  C.tick = setInterval(() => {
    const el = $('#ck-time'); if (el) el.textContent = hhmm(new Date());
    if (C.step !== 'who' && ++C.idle >= IDLE_SEC) backToWho('ออกจากระบบอัตโนมัติเพราะไม่มีการใช้งาน');
  }, 1000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && C.step === 'who') loadStaff().then(render).catch(() => {}); });
}
document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', boot) : boot();   // เริ่มหลังไฟล์เสริมโหลดครบ (LINE ไม่แวบหน้าเดิม)
