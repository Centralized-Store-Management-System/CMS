/* ระบบ HR บุคคล (Owner และ HR): ข้อมูลพนักงานทุกอย่าง รูปถ่าย สิทธิ์ใช้งาน PIN สาขาประจำ สาขาที่ดูแล และผู้สมัคร
 * กะและวันหยุดของแต่ละคน ตั้งที่เมนู ตารางงาน > รูปแบบกะ */
let HR_DEPARTMENTS = [];
let HR_POSITIONS = [
  { id:'legacy-manager', position_code:'MANAGER', name_th:'ผู้จัดการร้าน', status:'active' },
  { id:'legacy-assistant', position_code:'ASST_MANAGER', name_th:'ผู้ช่วยผู้จัดการ', status:'active' },
  { id:'legacy-barista', position_code:'BARISTA', name_th:'บาริสต้า', status:'active' },
  { id:'legacy-cashier', position_code:'CASHIER', name_th:'แคชเชียร์', status:'active' },
  { id:'legacy-parttime', position_code:'PARTTIME', name_th:'พาร์ทไทม์', status:'active' }
];
const POSITIONS = HR_POSITIONS.filter(p => p.status === 'active').map(p => p.name_th);
const HR_POSITION_API = 'https://ytxbnqosenolojifeikf.supabase.co/functions/v1/hr-position-api';
async function hrPositionRequest(method='GET', body=null) {
  const r=await fetch(HR_POSITION_API,{method,headers:{'content-type':'application/json','x-cms-session':S.token||''},body:body?JSON.stringify(body):undefined,cache:'no-store'});
  const p=await r.json().catch(()=>({}));
  if(!r.ok||!p.ok) throw new Error(p.error||'โหลดข้อมูลตำแหน่งไม่สำเร็จ');
  return p;
}
async function hrLoadPositions() {
  HR_POSITION_ERROR='';
  try {
    const p=await hrPositionRequest();
    if(!Array.isArray(p.positions)) throw new Error('Position API ส่งข้อมูลไม่ถูกต้อง');
    HR_POSITIONS=p.positions;
    HR_DEPARTMENTS=Array.isArray(p.departments)?p.departments:[];
    HR_POSITION_SYNC=Array.isArray(p.sync)?p.sync:[];
    return p;
  } catch(e) {
    HR_POSITION_ERROR=e.message||'โหลด Position Master ไม่สำเร็จ';
    console.warn('HR position master unavailable; compatibility data remains read-only for new assignments',HR_POSITION_ERROR);
    throw e;
  }
}
let HR_POSITION_LOADED=false, HR_POSITION_LOADING=false, HR_POSITION_ERROR='', HR_POSITION_SYNC=[];
function pPositions() {
 if(!HR_POSITION_LOADED&&!HR_POSITION_LOADING){HR_POSITION_LOADING=true;hrLoadPositions().catch(()=>{}).finally(()=>{HR_POSITION_LOADED=true;HR_POSITION_LOADING=false;if(typeof App!=='undefined')App.render();});return '<p class="loading">กำลังโหลด Position Master…</p>';}
 const rows=HR_POSITIONS;
 return `<div class="h2">Position Master <span class="spacer"></span><button class="btn" data-a="newDepartment" ${HR_POSITION_ERROR?'disabled':''}>+ Department</button><button class="btn primary" data-a="newPosition" ${HR_POSITION_ERROR?'disabled':''}>Create Position</button></div>
 ${HR_POSITION_ERROR?`<p class="status bad">เชื่อมต่อ Position Master ไม่สำเร็จ: ${esc(HR_POSITION_ERROR)} · ข้อมูลสำรองแสดงเพื่อดูเท่านั้น <button class="btn sm" data-a="reloadPositions">ลองใหม่</button></p>`:''}
 <p class="note">HR เป็นเจ้าของข้อมูลตำแหน่งและส่งเหตุการณ์ไปยัง IT ผ่าน Sync Queue · การสร้างตำแหน่งไม่ให้สิทธิ์ใช้งานโดยอัตโนมัติ IT ต้องกำหนด Role, Permission และ Data Scope ก่อน</p>
 ${HR_POSITION_SYNC.length?`<p class="chips">${HR_POSITION_SYNC.map(x=>`<span class="chip ${x.status==='processed'?'ok':x.status==='failed'||x.status==='dead_letter'?'bad':'warn'}">${esc(x.status)}: ${Number(x.count)||0}</span>`).join('')}</p>`:''}
 <div class="group">${rows.map(p=>`<button class="row" data-a="position:${esc(p.id)}"><span class="main"><span class="t">${esc(p.name_th)}</span><span class="s">${esc(p.position_code)} · ${esc(p.department||'ไม่ระบุแผนก')} · v${Number(p.version||1)}</span></span><span class="chip ${p.status==='active'?'ok':'warn'}">${p.status==='active'?'Active':'Inactive'}</span></button>`).join('')||empty('ยังไม่มีตำแหน่ง')}</div>`;
}
function openPosition(id) {
 if(HR_POSITION_ERROR) throw new Error('Position Master ยังเชื่อมต่อไม่ได้ จึงปิดการแก้ไข/สร้างชั่วคราวเพื่อป้องกันข้อมูลไม่ตรงกัน');
 const p=id?HR_POSITIONS.find(x=>x.id===id):{status:'active'};
 if(id&&!p)return;
 openForm({title:id?'แก้ไขตำแหน่ง':'Create Position',fields:[
  {k:'position_code',label:'Position Code',req:1,help:'ภาษาอังกฤษ ตัวเลข _ หรือ -'},
  {k:'name_th',label:'ชื่อตำแหน่ง (ไทย)',req:1},
  {k:'name_en',label:'Position Name (English)'},
  {k:'department_id',label:'Department',type:'select',options:[['','ไม่ระบุแผนก'],...HR_DEPARTMENTS.map(d=>[d.id,d.name])]},
  {k:'level',label:'Position Level'},
  {k:'description',label:'รายละเอียดหน้าที่',type:'textarea'},
  {k:'status',label:'สถานะ',type:'select',options:[['active','Active'],['inactive','Inactive']]}
 ],data:p,onSave:async v=>{
  const dept=HR_DEPARTMENTS.find(d=>d.id===v.department_id);
  if(dept)v.department=dept.name;else if(!v.department_id)v.department='';
  const x=await hrPositionRequest('POST',{action:'save-position',...v,id:id||undefined});
  const i=HR_POSITIONS.findIndex(z=>z.id===x.position.id);
  if(i<0)HR_POSITIONS.push(x.position);else HR_POSITIONS[i]=x.position;
  HR_POSITIONS.sort((a,b)=>a.name_th.localeCompare(b.name_th,'th'));
  toast(x.position.sync_status==='pending'?'บันทึกแล้ว · เข้าคิวส่งข้อมูลให้ IT แล้ว · ยังไม่มีการให้สิทธิ์อัตโนมัติ':'บันทึก Position Master แล้ว · IT ต้องกำหนดสิทธิ์ก่อนใช้งาน');
 },onDelete:null});
}

function openDepartment() {
 if(HR_POSITION_ERROR) throw new Error('Position API ยังไม่พร้อม');
 openForm({title:'Create Department',fields:[
  {k:'department_code',label:'Department Code',req:1,help:'อังกฤษ ตัวเลข _ หรือ -'},
  {k:'name',label:'Department Name',req:1}
 ],data:{},onSave:async v=>{
  const r=await hrPositionRequest('POST',{action:'save-department',...v});
  if(r.department&&!HR_DEPARTMENTS.some(d=>d.id===r.department.id))HR_DEPARTMENTS.push(r.department);
  HR_DEPARTMENTS.sort((a,b)=>a.name.localeCompare(b.name,'th'));
  toast('บันทึก Department Master แล้ว');
 }});
}

const PAYTYPES = [['monthly', 'รายเดือน'], ['daily', 'รายวัน'], ['hourly', 'รายชั่วโมง (พาร์ทไทม์)']];
const EMP_STAT = ['ทดลองงาน', 'ประจำ', 'ลาออก'];
const APP_STAT = ['ใหม่', 'นัดสัมภาษณ์', 'ผ่านสัมภาษณ์', 'ไม่ผ่าน', 'รับเข้าทำงานแล้ว'];
const ROLE_OPTS = () => [['staff', 'Staff — พนักงาน'], ['manager', 'Manager — Manager สาขา'], ...(allBranch() ? [['hr', 'HR — ดูแลบุคคล เงินเดือน']] : []), ...(S.me.role === 'owner' ? [['owner', 'Owner — ทุกสิทธิ์']] : [])];
const patText = id => { const p = timeCtx().patterns[id]; if (!p) return ''; return [1, 2, 3, 4, 5, 6, 0].map(w => { const c = Calc.upper(p['d' + w]); return c ? (Calc.isOffCode(c) ? '·' : c) : '–'; }).join(' '); };
const payLabel = e => ({ monthly: `เดือนละ ${fmt(e.rate)} บาท`, daily: `วันละ ${fmt(e.rate)} บาท`, hourly: `ชั่วโมงละ ${fmt(e.rate)} บาท` })[e.payType || 'monthly'];
const dailyRate = e => e.payType === 'daily' ? num(e.rate) : e.payType === 'hourly' ? num(e.rate) * (num(S.settings.hoursPerDay) || 8) : num(e.rate) / 30;
const belowMin = e => num(e.rate) > 0 && num(S.settings.minWage) > 0 && dailyRate(e) < num(S.settings.minWage) - 0.01;
function nextCode() { let n = S.t.employees.length + 1, c; do { c = 'E' + String(n++).padStart(3, '0'); } while (S.t.employees.some(e => e.code === c)); return c; }

const F_EMP = e => [
  { k: 'photo', label: 'รูปถ่าย', type: 'photo' },
  { k: 'code', label: 'รหัสพนักงาน (ใช้เข้าสู่ระบบ)', half: 1, req: 1 }, { k: 'role', label: 'Role', half: 1, type: 'select', options: ROLE_OPTS() },
  ...(S.t.branches.length > 1 || myBranches().length > 1 ? [
    { k: 'branch', label: 'สาขาประจำ', half: 1, type: 'select', options: branchOpts(myBranches()), req: 1 },
    { k: 'branchAccess', label: 'ดูแลสาขาเพิ่ม', type: 'multi', options: [...(allBranch() ? [['*', 'ทุกสาขา']] : []), ...myBranches().map(b => [b.code, b.name])], help: 'สำหรับ Manager ที่ดูแลหลายสาขา หรือ HR ที่ดูแลเฉพาะบางสาขา (HR ที่ไม่เลือก = ดูแลทุกสาขา)' }
  ] : []),
  ...(e.account ? [] : [{ k: 'pin', label: e.hasPin || e.pinSet ? 'ตั้ง PIN ใหม่ (เว้นว่าง = ใช้ PIN เดิม)' : 'PIN 4–6 หลัก (เว้นว่างได้)', half: 1, type: 'pin', help: 'เว้นว่างได้ ถ้าจะสร้างชื่อผู้ใช้ให้ที่หน้า Users (เจ้าตัวตั้ง PIN 6 หลักเอง แนะนำ)' }]),
  { k: 'status', label: 'สถานะ', half: 1, type: 'select', options: EMP_STAT },
  { k: 'firstName', label: 'ชื่อ', half: 1, req: 1 }, { k: 'lastName', label: 'นามสกุล', half: 1 },
  { k: 'nickname', label: 'ชื่อเล่น', half: 1 }, { k: 'nameEn', label: 'ชื่อ-นามสกุล (อังกฤษ)', half: 1, help: 'ใช้ตรวจตอนลงทะเบียน LINE เช่น Somchai Jaidee' }, { k: 'scanId', label: 'รหัสในเครื่องสแกนนิ้ว', half: 1, help: 'ว่าง = ใช้รหัสพนักงาน (เครื่องที่ใช้เลข 1, 001 จับคู่กับ A001 ให้เอง)' }, { k: 'phone', label: 'เบอร์โทร', half: 1, type: 'tel' }, { k: 'email', label: 'อีเมล', half: 1, type: 'email', help: 'ข้อมูลติดต่อเท่านั้น (ไม่ใช้รับรหัสเข้าระบบ) · ลืม PIN: รับรหัสทาง LINE ที่ผูกไว้ · คนไม่มี LINE ให้ Owner/HR รีเซ็ตรหัสให้' },
  { k: 'idCard', label: 'เลขบัตรประชาชน', half: 1, inputmode: 'numeric' }, { k: 'birthDate', label: 'วันเกิด', half: 1, type: 'date' },
  { k: 'address', label: 'ที่อยู่', type: 'textarea' },
  { k: 'position', label: 'ตำแหน่ง', half: 1, type: 'select', options: HR_POSITIONS.filter(p=>p.status==='active'||p.name_th===e.position).map(p=>p.name_th) }, { k: 'startDate', label: 'วันเริ่มงาน', half: 1, type: 'date' },
  { k: 'payType', label: 'รูปแบบค่าจ้าง', half: 1, type: 'select', options: PAYTYPES }, { k: 'rate', label: 'อัตราค่าจ้าง (บาท)', half: 1, type: 'number', req: 1 },
  { k: 'endDate', label: 'วันสุดท้าย (ถ้าลาออก)', half: 1, type: 'date' },
  { k: 'probationEnd', label: 'ครบทดลองงาน', half: 1, type: 'date', help: 'เว้นว่าง = วันเริ่มงาน + 119 วัน (แจ้งเตือนเฉพาะสถานะทดลองงาน)' }, { k: 'contractEnd', label: 'สัญญาจ้างสิ้นสุด (ถ้ามี)', half: 1, type: 'date' },
  { k: 'docs', label: 'เอกสารที่มีวันหมดอายุ', type: 'textarea', rows: 2, help: 'บรรทัดละรายการ: ปปปป-ดด-วว ชื่อเอกสาร เช่น 2027-03-01 ใบรับรองแพทย์ · ระบบแจ้งเตือนก่อนหมดอายุ 30 วัน' },
  { k: 'ssoEnrolled', label: 'ขึ้นทะเบียนประกันสังคม มาตรา 33', type: 'check' },
  { k: 'bank', label: 'ธนาคาร', half: 1 }, { k: 'bankAcct', label: 'เลขบัญชี', half: 1, inputmode: 'numeric' },
  { k: 'emergency', label: 'ผู้ติดต่อฉุกเฉิน', help: 'ชื่อ ความสัมพันธ์ และเบอร์โทร' },
  { k: 'pdpaConsent', label: 'พนักงานเซ็นหนังสือยินยอมเก็บข้อมูลส่วนบุคคล (PDPA) แล้ว', type: 'check' },
  { k: 'note', label: 'บันทึกเพิ่มเติม', type: 'textarea' }
];
function empRow(e) {
    const c = [`<span class="chip ${e.status === 'ลาออก' ? '' : e.status === 'ทดลองงาน' ? 'warn' : 'ok'}">${esc(e.status || '')}</span>`, `<span class="chip mc">${esc(ROLE_NAME[e.role] || 'พนักงาน')}</span>`];
    if (belowMin(e)) c.push('<span class="chip bad">ต่ำกว่าค่าแรงขั้นต่ำ</span>');
    if (e.status !== 'ลาออก' && !bool(e.pdpaConsent)) c.push('<span class="chip">ยังไม่มีใบยินยอม PDPA</span>');
    if (e.account) c.push(`<span class="chip ${/รอ/.test(e.account) ? 'warn' : 'ok'}">${esc(e.account)}</span>`);
    else if (e.status !== 'ลาออก' && e.hasPin === false) c.push('<span class="chip bad">ยังไม่มี PIN / ชื่อผู้ใช้</span>');
    if (e.branchAccess) c.push(`<span class="chip br">ดูแล${e.branchAccess === '*' ? 'ทุกสาขา' : esc(e.branchAccess)}</span>`);
    const pt = patText(e.id);
    if (e.status !== 'ลาออก' && !pt && ['manager', 'staff'].includes(e.role)) c.push('<span class="chip warn">ยังไม่ได้ตั้งรูปแบบกะ</span>');
    return `<button class="row" data-a="emp:${e.id}">${avatar(e)}<span class="main"><span class="t">${esc(fullName(e))}</span><span class="s">${esc(e.code || '')} ${esc(e.position || '')}, ${payLabel(e)}${pt ? `, กะ จ–อา: ${esc(pt)}` : ''}</span><span class="chips">${c.join('')}</span></span></button>`;
}
function pEmp() {
  if(!HR_POSITION_LOADED&&!HR_POSITION_LOADING){HR_POSITION_LOADING=true;hrLoadPositions().catch(()=>{}).finally(()=>{HR_POSITION_LOADED=true;HR_POSITION_LOADING=false;if(typeof App!=='undefined')App.render();});}
  const list = S.t.employees.filter(e => myEmp(e) && inBr(e.branch)).sort((a, b) => (a.status === 'ลาออก') - (b.status === 'ลาออก') || String(a.code || '').localeCompare(String(b.code || '')));
  const groups = !S.branch && multiBranch() ? myBranches().map(b => [b, list.filter(e => e.branch === b.code)]).filter(g => g[1].length) : [[null, list]];
  const bd0 = today(), bd1 = addDays(bd0, 1), key = d => String(d || '').slice(5, 10);
  const active = list.filter(e => e.status !== 'ลาออก' && e.birthDate);
  const b0 = active.filter(e => key(e.birthDate) === key(bd0));
  const b1 = active.filter(e => key(e.birthDate) === key(bd1));
  const birthdayRow = (e, when) => `<div class="row static"><span class="avatar" aria-hidden="true">🎂</span><span class="main"><span class="t">${esc(fullName(e))}</span><span class="s">${esc(e.code || '')}${e.position ? ' · ' + esc(e.position) : ''}${multiBranch() ? ' · ' + esc(branchName(e.branch)) : ''}</span></span><span class="chip ${when === 'วันนี้' ? 'ok' : 'warn'}">${when}</span></div>`;
  const birthdayHtml = `<h3 class="h3">🎂 วันเกิดที่กำลังจะถึง <span class="muted">วันนี้ ${b0.length} · พรุ่งนี้ ${b1.length}</span></h3><div class="group">${b0.map(e => birthdayRow(e, 'วันนี้')).join('')}${b1.map(e => birthdayRow(e, 'พรุ่งนี้')).join('')}${!b0.length && !b1.length ? empty('ไม่มีวันเกิดวันนี้หรือพรุ่งนี้') : ''}</div>`;
  return `<div class="h2">พนักงาน ${list.filter(e => e.status !== 'ลาออก').length} คน<span class="spacer"></span><button class="btn primary" data-a="newEmp">เพิ่มพนักงาน</button></div>
  ${groups.map(([b, l]) => `${b ? `<h3 class="h3">${esc(b.name)} <span class="muted">${l.filter(e => e.status !== 'ลาออก').length} คน</span></h3>` : ''}<div class="group">${l.map(empRow).join('') || empty('ยังไม่มีพนักงาน กด “เพิ่มพนักงาน” เพื่อเริ่ม')}</div>`).join('')}
  ${birthdayHtml}
  <p class="note">พนักงานที่มีชื่อผู้ใช้ (เช่น staff_somchaij สร้างที่หน้า Users) ใช้ PIN 6 หลักที่ตั้งเองทั้งลงเวลาและเข้าระบบ คนที่ยังไม่มีใช้รหัสพนักงาน + PIN ที่ HR ตั้ง ระบบให้เห็นเฉพาะส่วนที่มีสิทธิ์ (ตั้งที่ ตั้งค่า > สิทธิ์การใช้งาน) และเฉพาะสาขาประจำ + สาขาที่ดูแลเพิ่ม กะและวันหยุดของแต่ละคนตั้งที่ ตารางงาน > รูปแบบกะ</p>`;
}
function openEmp(id, draft) {
  const e = id ? empById(id) : (draft || { status: 'ทดลองงาน', role: 'staff', branch: oneBranch(), branchAccess: '', payType: 'monthly', startDate: today(), ssoEnrolled: true, code: nextCode(), position: 'บาริสต้า' });
  openForm({
    title: id ? fullName(e) : 'เพิ่มพนักงาน', fields: F_EMP(e), data: { ...e, position: (HR_POSITIONS.find(p=>p.id===e.positionId)||{}).name_th || e.position || '', pin: '' },
    extraHTML: `${id && can('schedule_edit', 'schedule_view') ? `<p class="note">กะและวันหยุดประจำสัปดาห์: ${esc(patText(id) || 'ยังไม่ได้ตั้ง')} <a href="#sched/pattern">ตั้งที่ ตารางงาน > รูปแบบกะ</a></p>` : ''}<p class="note">เลขบัตรประชาชน บัญชีธนาคาร และรูปถ่ายเป็นข้อมูลส่วนบุคคล เก็บในไฟล์ HR แยกจากระบบอื่น เห็นได้เฉพาะ Owner และผู้มีสิทธิ์ HR ของสาขานั้น</p>${id && typeof empHistHTML === 'function' ? empHistHTML(id) : ''}`,
    onSave: async v => {
      if(HR_POSITION_LOADING) throw new Error('กำลังโหลดข้อมูลตำแหน่ง รอสักครู่แล้วกดบันทึกอีกครั้ง');   // โหลดตำแหน่งไม่สำเร็จ → ยังบันทึกพนักงานได้ด้วยรายการสำรอง (ไม่ล็อกงาน HR ทั้งหมด)
      const pin = String(v.pin || '').trim();
      if (pin && !/^\d{4,6}$/.test(pin)) throw new Error('PIN ต้องเป็นตัวเลข 4–6 หลัก');
      if (S.t.employees.some(x => x.id !== v.id && String(x.code).toLowerCase() === String(v.code).toLowerCase())) throw new Error('รหัสพนักงานซ้ำ');
      if (String(v.code).toLowerCase() === 'owner') throw new Error('รหัส owner สงวนไว้สำหรับ Owner');
      if (!pin) delete v.pin;
      delete v.hasPin; delete v.account;
      if (!v.branch) v.branch = oneBranch();
      const matchedPosition=HR_POSITIONS.find(p=>p.name_th===v.position||p.position_code===v.position||p.id===v.positionId);
      if(!matchedPosition||matchedPosition.status!=='active') throw new Error('กรุณาเลือกตำแหน่งที่ Active จาก Position Master');
      if(/^[0-9a-f-]{36}$/i.test(String(matchedPosition.id||''))) v.positionId=matchedPosition.id; else delete v.positionId;
      v.positionCode=matchedPosition.position_code;
      v.position=matchedPosition.name_th;
      await DB.upsert('employees', v);
      if (!id) setTimeout(() => toast(can('users') && !pin ? 'เพิ่มแล้ว ต่อไปสร้างชื่อผู้ใช้ให้ที่หน้า Users และตั้งกะที่ ตารางงาน > รูปแบบกะ' : 'เพิ่มแล้ว ตั้งกะและวันหยุดของพนักงานคนนี้ที่ ตารางงาน > รูปแบบกะ'), 300);
      if (belowMin(v)) setTimeout(() => toast('อัตราค่าจ้างนี้ต่ำกว่าค่าแรงขั้นต่ำที่ตั้งไว้ ตรวจอีกครั้ง'), 600);
    },
    onDelete: id ? async () => {
      if (S.t.attendance.some(a => a.empId === id) || S.t.payroll.some(p => p.empId === id)) throw new Error('มีประวัติเวลาทำงานหรือเงินเดือนแล้ว เปลี่ยนสถานะเป็น “ลาออก” แทนการลบ');
      await DB.remove('employees', id);
    } : null
  });
}
const F_APP = () => [
  { k: 'photo', label: 'รูปถ่าย', type: 'photo' }, { k: 'name', label: 'ชื่อ-นามสกุล', req: 1 },
  ...(myBranches().length > 1 || allBranch() && S.t.branches.length > 1 ? [{ k: 'branch', label: 'สาขาที่สมัคร', type: 'select', options: [...(allBranch() ? [['', 'ยังไม่ระบุ']] : []), ...branchOpts(myBranches())] }] : []),
  { k: 'phone', label: 'เบอร์โทร', half: 1, type: 'tel' }, { k: 'position', label: 'สมัครตำแหน่ง', half: 1, type: 'select', options: HR_POSITIONS.filter(p=>p.status==='active').map(p=>p.name_th) },
  { k: 'appliedDate', label: 'วันที่สมัคร', half: 1, type: 'date' }, { k: 'source', label: 'ช่องทาง', half: 1, type: 'select', options: ['หน้าร้าน', 'Facebook', 'JobThai/JobsDB', 'เพื่อนแนะนำ', 'อื่นๆ'] },
  { k: 'status', label: 'สถานะ', half: 1, type: 'select', options: APP_STAT }, { k: 'expectedPay', label: 'ค่าจ้างที่คาดหวัง', half: 1, type: 'number' },
  { k: 'interviewDate', label: 'วันสัมภาษณ์', half: 1, type: 'date' }, { k: 'interviewTime', label: 'เวลาสัมภาษณ์', half: 1, type: 'time' },
  { k: 'availability', label: 'วันและเวลาที่ทำงานได้' }, { k: 'note', label: 'ผลสัมภาษณ์/บันทึก', type: 'textarea' }
];
function pApp() {
  if(!HR_POSITION_LOADED&&!HR_POSITION_LOADING){HR_POSITION_LOADING=true;hrLoadPositions().catch(()=>{}).finally(()=>{HR_POSITION_LOADED=true;HR_POSITION_LOADING=false;if(typeof App!=='undefined')App.render();});}
  const list = S.t.applicants.filter(a => !S.branch || a.branch === S.branch || !a.branch).sort((a, b) => APP_STAT.indexOf(a.status) - APP_STAT.indexOf(b.status) || String(b.appliedDate || '').localeCompare(String(a.appliedDate || '')));
  const cnt = APP_STAT.map(s => [s, list.filter(a => a.status === s).length]).filter(x => x[1]);
  return `<div class="h2">ผู้สมัคร ${list.length} คน<span class="spacer"></span><button class="btn primary" data-a="newApp">เพิ่มผู้สมัคร</button></div>
  ${cnt.length ? `<p class="chips" style="margin:0 2px 12px">${cnt.map(([s, n]) => `<span class="chip">${s} ${n}</span>`).join('')}</p>` : ''}
  <div class="group">${list.map(a => `<button class="row" data-a="app:${a.id}">${avatar({ photo: a.photo, nickname: a.name })}<span class="main"><span class="t">${esc(a.name)}</span><span class="s">${esc(a.position || '')}${multiBranch() ? ', ' + esc(a.branch ? branchName(a.branch) : 'ยังไม่ระบุสาขา') : ''}, สมัคร ${thDate(a.appliedDate)}${a.interviewDate ? `, สัมภาษณ์ ${thDate(a.interviewDate)} ${esc(a.interviewTime || '')}` : ''}</span></span><span class="chip ${a.status === 'ไม่ผ่าน' ? 'bad' : a.status === 'รับเข้าทำงานแล้ว' ? 'ok' : 'warn'}">${esc(a.status)}</span></button>`).join('') || empty('ยังไม่มีผู้สมัคร')}</div>`;
}
function openApp(id) {
  const a = id ? S.t.applicants.find(x => x.id === id) : { appliedDate: today(), status: 'ใหม่', position: 'บาริสต้า', source: 'หน้าร้าน', branch: S.branch || (multiBranch() ? '' : oneBranch()) };
  openForm({
    title: id ? a.name : 'เพิ่มผู้สมัคร', fields: F_APP(), data: a,
    onSave: v => DB.upsert('applicants', v),
    onDelete: id ? () => DB.remove('applicants', id) : null,
    extra: id && a.status !== 'รับเข้าทำงานแล้ว' ? [{ label: 'รับเข้าทำงาน', fn: hire }] : []
  });
}
async function hire(v) {
  await DB.upsert('applicants', { ...v, status: 'รับเข้าทำงานแล้ว' });
  const [fn, ...ln] = String(v.name || '').trim().split(/\s+/);
  const part = v.position === 'พาร์ทไทม์';
  openEmp(null, { firstName: fn || '', lastName: ln.join(' '), phone: v.phone, photo: v.photo, position: v.position, role: 'staff', branch: v.branch || oneBranch(), branchAccess: '', status: 'ทดลองงาน', payType: part ? 'hourly' : 'monthly', rate: v.expectedPay || '', startDate: today(), ssoEnrolled: true, code: nextCode(), note: `รับจากผู้สมัคร ${thDate(v.appliedDate)}` });
  toast('ย้ายผู้สมัครเป็นพนักงาน ตั้ง PIN และค่าจ้างให้ครบแล้วบันทึก');
}

defMod({
  key: 'hr', mod: 'hr', label: 'HR', icon: 'hr', group: 'People', desc: 'ประวัติพนักงาน รูป สิทธิ์ใช้งาน ผู้สมัคร', perm: ['hr'],
  subs: [
    { key: 'emp', label: 'Employees', view: pEmp },
    { key: 'positions', label: 'Positions', view: pPositions },
    { key: 'app', label: 'Recruitment', view: pApp },
    { key: 'docs', label: 'Documents', view: () => window.HRDocuments ? window.HRDocuments.view() : '<p class="note">กำลังโหลดเมนู Documents…</p>' }
  ],
  summary: () => { const n = activeEmps().length, a = S.t.applicants.filter(x => ['ใหม่', 'นัดสัมภาษณ์', 'ผ่านสัมภาษณ์'].includes(x.status)).length; return `พนักงาน ${n} คน${a ? `, ผู้สมัครรอดำเนินการ ${a}` : ''}`; },
  acts: { newEmp: () => openEmp(), emp: id => openEmp(id), newApp: () => openApp(), app: id => openApp(id), newPosition: () => openPosition(), newDepartment: () => openDepartment(), position: id => openPosition(id), reloadPositions: async () => { HR_POSITION_LOADING=true; try { await hrLoadPositions(); HR_POSITION_LOADED=true; } catch(e) {} finally { HR_POSITION_LOADING=false; if(typeof App!=='undefined') App.render(); } } }
});
