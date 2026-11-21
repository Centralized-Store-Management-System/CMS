/* IT Control Center · Theme rollout + authentication policy registry.
 * Server-side settings and audit log; authentication enforcement remains intentionally disabled. */
'use strict';
const ITCC_URL='https://ytxbnqosenolojifeikf.supabase.co/functions/v1/it-control-center';
let ITCC={rows:[],audit:[],device:'pc',filter:'all',busy:false};
async function itccRequest(method='GET',body=null){
 const r=await fetch(ITCC_URL,{method,headers:{'content-type':'application/json','x-cms-session':S.token||''},body:body?JSON.stringify(body):undefined,cache:'no-store'});
 const p=await r.json().catch(()=>({}));
 if(!r.ok||!p.ok)throw new Error(p.error||'เชื่อมต่อ IT Control Center ไม่สำเร็จ');
 return p;
}
async function ocControlLoad(){
 ocMain('<p class="loading">กำลังโหลด IT Control Center…</p>');
 try{const p=await itccRequest();ITCC.rows=p.rows||[];ITCC.audit=p.audit||[];ocMain(ocControlPage());}
 catch(e){ocMain('<div class="status bad">'+esc(e.message)+'</div>');}
}
const ITCC_PKG={classic:'Theme เดิม',prototype:'Prototype (หลังร้าน)',owner:'Owner Theme'};
function itccHere(){const a=window.AMZ_SCOPE;if(!a)return'';return `<div class="note">เครื่องนี้: <b>${esc(a.scope||'-')}</b> · ${esc(a.device)} · ${a.surface==='installed_app'?'แอปที่ติดตั้ง':a.surface==='line_liff'?'LINE':'เว็บ'} · ตอนนี้ใช้ ${esc(ITCC_PKG[a.pkg]||a.pkg)} · แต่ละแถวตั้งแยกกัน ไม่กระทบแถวอื่น · ล็อกไว้ = เปลี่ยนไม่ได้จนกว่าจะปลดล็อก</div>`;}
const itccDeviceLabel=r=>r.device_class==='pc'?'PC':r.device_class==='mobile'?'Mobile':r.device_class==='ipad'?'iPad':r.device_class.replaceAll('_',' / ').toUpperCase();
function itccGroupLabel(r){return r.app_label+' · '+(r.user_class==='owner'?'Owner':r.user_class==='staff_manager'?'Staff / Manager':r.user_class==='owner_staff'?'Owner / Staff':'LINE User')+' · '+(r.surface==='installed_app'?'Installed App':r.surface==='line_liff'?'LINE / LIFF':'Web')+' · '+itccDeviceLabel(r);}
function ocControlPage(){
 const ownerRows=ITCC.rows.filter(x=>x.app_key==='owner');
 const visible=ITCC.rows.filter(x=>ITCC.filter==='all'||x.app_key===ITCC.filter);
 const selected=ownerRows.find(x=>x.device_class===ITCC.device&&x.surface==='web')||ownerRows.find(x=>x.device_class===ITCC.device)||ownerRows[0];
 const width=ITCC.device==='pc'?720:ITCC.device==='ipad'?520:360;
 return `<style>
 .itcc-grid{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(280px,.85fr);gap:14px}
 .itcc-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:center;padding:12px;border-bottom:1px solid var(--line)}@media(max-width:640px){.itcc-row{grid-template-columns:minmax(0,1fr)}.itcc-row>.actions{justify-content:flex-start!important}}
 .itcc-row:last-child{border:0}.itcc-meta{font-size:12px;color:var(--muted);margin-top:4px}
 .itcc-preview-wrap{background:#e8eee9;border-radius:18px;padding:18px;overflow:auto}
 .itcc-device{margin:auto;background:#fff;border:8px solid #26352e;border-radius:24px;min-height:260px;box-shadow:0 10px 28px #183b2b22;overflow:hidden}
 .itcc-device.pc{border-radius:12px;border-width:6px}.itcc-device.ipad{border-radius:22px}
 .itcc-mock-head{height:42px;background:#07583f;color:white;padding:12px;font-size:12px}
 .itcc-mock-body{padding:14px;background:#f3f7f4;min-height:200px}
 .itcc-mock-card{height:55px;border-radius:12px;background:white;margin:8px 0;border:1px solid #e7eee9}
 .itcc-pill{display:inline-block;border-radius:30px;padding:4px 9px;font-size:11px;background:#e6f2e9;color:#07583f}
 .itcc-audit{font-size:12px;padding:9px 0;border-bottom:1px solid var(--line)}
 @media(max-width:900px){.itcc-grid{grid-template-columns:1fr}.itcc-device{max-width:100%}}
 </style>
 <h1>IT Control Center</h1><p class="muted">ควบคุม Theme, rollout และ Authentication Policy แยกตามระบบ ผู้ใช้ อุปกรณ์ และช่องทางติดตั้ง</p>
 <div class="kpis" style="margin:12px 0"><div class="kpi ok"><b>${ownerRows.filter(x=>x.theme_enabled).length}</b><span>Owner Theme scopes ON</span></div><div class="kpi"><b>${ITCC.rows.length}</b><span>Scopes ที่ลงทะเบียน</span></div><div class="kpi warn"><b>OFF</b><span>Auth Enforcement</span></div></div>
 <div class="note">การตั้งค่า Theme และ Authentication แยกจากกัน · การแก้ไข Login ปัจจุบันยังไม่เปิดใช้ · ทุกการบันทึกเก็บ Audit Log บนฐานข้อมูล</div>
 <div class="itcc-grid" style="margin-top:14px">
  <section class="group pad">
   <div class="h2">Theme Rollout <span class="spacer"></span><select id="itcc-filter" aria-label="กรองระบบ" style="max-width:180px"><option value="all">ทุกระบบ</option><option value="owner">Owner</option><option value="backoffice">Back Office</option><option value="staff">Staff</option><option value="line">LINE</option><option value="register">Registration</option></select></div>
   <p class="muted">เลือกอุปกรณ์แยกกันได้ PC / Mobile / iPad และ Web / Installed App</p>
   ${itccHere()}
   ${visible.map(x=>`<div class="itcc-row"><div><b>${esc(itccGroupLabel(x))}</b><div class="itcc-meta">${x.theme_enabled?'ใช้ '+esc(ITCC_PKG[x.theme_package]||x.theme_package):'Theme เดิม (ปิด)'} · ${x.rollout_locked?'🔒 ล็อก':'ปลดล็อก'}${window.AMZ_SCOPE&&AMZ_SCOPE.scope===x.scope_key?' · <b>เครื่องนี้</b>':''}</div></div>
    <div class="actions" style="justify-content:flex-end;flex-wrap:wrap;gap:6px">
     <select data-itcc-pkg="${x.scope_key}" aria-label="เลือก Theme" ${x.rollout_locked?'disabled':''} style="max-width:150px">${Object.keys(ITCC_PKG).map(k=>`<option value="${k}" ${x.theme_package===k?'selected':''}>${ITCC_PKG[k]}</option>`).join('')}</select>
     <button class="btn sm ${x.theme_enabled?'':'primary'}" data-itcc-save="theme" data-scope="${x.scope_key}" ${x.rollout_locked?'disabled':''}>${x.theme_enabled?'ปิด':'เปิด'}</button>
     <button class="btn sm" data-itcc-save="${x.rollout_locked?'unlock':'lock'}" data-scope="${x.scope_key}">${x.rollout_locked?'ปลดล็อก':'ล็อก'}</button>
    </div></div>`).join('')}
   <div class="note">ระบบอื่นถูกตั้งค่า LOCKED/OFF เป็นค่าเริ่มต้นเพื่อป้องกัน Theme ของ Owner กระทบระบบอื่น</div>
  </section>
  <section class="group pad">
   <div class="h2">Owner Theme Preview <span class="spacer"></span><span class="chip ok">Owner only</span></div>
   <div class="actions" style="margin:10px 0"><button class="btn sm ${ITCC.device==='pc'?'primary':''}" data-itcc-device="pc">PC</button><button class="btn sm ${ITCC.device==='mobile'?'primary':''}" data-itcc-device="mobile">Mobile</button><button class="btn sm ${ITCC.device==='ipad'?'primary':''}" data-itcc-device="ipad">iPad</button></div>
   <div class="itcc-preview-wrap"><div class="itcc-device ${ITCC.device}" style="width:min(100%,${width}px)"><div class="itcc-mock-head">Café Amazon · Owner Console</div><div class="itcc-mock-body"><span class="itcc-pill">Premium Natural Green</span><h3 style="margin:12px 0 4px">หน้าหลักเจ้าของร้าน</h3><div class="itcc-mock-card"></div><div class="itcc-mock-card"></div><div class="itcc-mock-card"></div></div></div></div>
   <div class="note">Preview เป็นกรอบจำลองขนาดหน้าจอ ยังไม่ใช่ภาพ Capture จากอุปกรณ์จริง</div>
   <div class="group pad" style="margin-top:12px">
    <b>ตั้งค่า ${selected?esc(itccDeviceLabel(selected)):'-'}</b>
    <div class="itcc-meta">${selected?esc(itccGroupLabel(selected)):''}</div>
    ${selected?`<div class="actions" style="margin-top:10px"><button class="btn sm" data-itcc-save="unlock" data-scope="${selected.scope_key}" ${selected.rollout_locked?'':'disabled'}>ปลดล็อก Rollout</button><button class="btn sm ${selected.theme_enabled?'':'primary'}" data-itcc-save="theme" data-scope="${selected.scope_key}" ${selected.rollout_locked?'disabled':''}>${selected.theme_enabled?'ปิด Theme':'เปิด Theme'}</button></div>`:''}
   </div>
  </section>
 </div>
 <section class="group pad" style="margin-top:14px">
  <div class="h2">Authentication Policy <span class="spacer"></span><span class="chip warn">Draft only · Not enforced</span></div>
  <p class="muted">เก็บโปรไฟล์นโยบายแยกตาม User Class / Device / Surface โดยไม่เปลี่ยนวิธี Login จริงจนกว่าจะผ่าน QA และอนุมัติแยกต่างหาก</p>
  ${visible.map(x=>`<div class="itcc-row"><div><b>${esc(itccGroupLabel(x))}</b><div class="itcc-meta">Login: ${esc(x.auth_profile?.login||'-')} · MFA: ${esc(x.auth_profile?.mfa||'-')} · Session: ${esc(x.auth_profile?.session||'-')}</div></div><button class="btn sm" data-itcc-auth="${x.scope_key}">แก้ Policy Draft</button></div>`).join('')}
  <div class="note">Auth Enforcement = OFF ทุก Scope · ระบบยังใช้ Login, Authenticator, Owner PIN และ Staff App Lock เดิม</div>
 </section>
 <section class="group pad" style="margin-top:14px"><div class="h2">Audit Log <span class="spacer"></span><button class="btn sm" data-itcc-refresh>Refresh</button></div>
 ${ITCC.audit.map(a=>`<div class="itcc-audit"><b>${esc(a.scope_key)}</b> · ${esc(a.action)} · ${esc(a.actor)}<div class="itcc-meta">${esc(new Date(a.created_at).toLocaleString('th-TH'))}</div></div>`).join('')||'<p class="muted">ยังไม่มีประวัติการเปลี่ยนแปลง</p>'}</section>`;
}
document.addEventListener('change',async e=>{if(e.target.id==='itcc-filter'){ITCC.filter=e.target.value;ocMain(ocControlPage());return;}
 const sel=e.target.closest('[data-itcc-pkg]');if(!sel)return;
 const row=ITCC.rows.find(x=>x.scope_key===sel.dataset.itccPkg);if(!row||row.theme_package===sel.value)return;
 if(!await ITDialog.confirm('เปลี่ยน Theme ของ '+itccGroupLabel(row)+' เป็น '+ITCC_PKG[sel.value]+' ใช่หรือไม่?',{title:'ยืนยันการเปลี่ยน Theme',detail:'มีผลเฉพาะ Scope นี้'})){sel.value=row.theme_package;return;}
 sel.disabled=true;
 try{await itccRequest('POST',{scopeKey:row.scope_key,changes:{theme_package:sel.value,theme_enabled:true}});toast('บันทึกแล้ว เครื่องใน Scope นี้จะเปลี่ยนเมื่อเปิดหน้าใหม่');if(window.AMZ_SCOPE)AMZ_SCOPE.refresh();await ocControlLoad();}
 catch(err){toast(err.message);sel.value=row.theme_package;sel.disabled=false;}
});
document.addEventListener('click',async e=>{
 const dev=e.target.closest('[data-itcc-device]');if(dev){ITCC.device=dev.dataset.itccDevice;return ocMain(ocControlPage());}
 if(e.target.closest('[data-itcc-refresh]'))return ocControlLoad();
 const action=e.target.closest('[data-itcc-save]');
 if(action){
  const row=ITCC.rows.find(x=>x.scope_key===action.dataset.scope);if(!row)return;
  if(action.dataset.itccSave==='unlock'&&!await ITDialog.confirm('ปลดล็อก Theme Rollout เฉพาะ Scope นี้ใช่หรือไม่?',{title:'ปลดล็อก Rollout'}))return;
  if(action.dataset.itccSave==='lock'&&!await ITDialog.confirm('ล็อก Scope นี้เพื่อป้องกันการเปลี่ยน Theme ใช่หรือไม่?',{title:'ล็อก Scope'}))return;
  if(action.dataset.itccSave==='theme'&&!await ITDialog.confirm((row.theme_enabled?'ปิด':'เปิด')+' Theme เฉพาะ Scope นี้ใช่หรือไม่?',{title:'ยืนยันการตั้งค่า Theme'}))return;
  action.disabled=true;
  try{const k=action.dataset.itccSave,changes=k==='unlock'?{rollout_locked:false}:k==='lock'?{rollout_locked:true}:{theme_enabled:!row.theme_enabled};await itccRequest('POST',{scopeKey:row.scope_key,changes});toast('บันทึกการตั้งค่าและ Audit Log แล้ว');if(window.AMZ_SCOPE)AMZ_SCOPE.refresh();await ocControlLoad();}
  catch(err){toast(err.message);action.disabled=false;}return;
 }
 const auth=e.target.closest('[data-itcc-auth]');
 if(auth){
  const row=ITCC.rows.find(x=>x.scope_key===auth.dataset.itccAuth);if(!row)return;
  const p=row.auth_profile||{};
  const login=await ITDialog.prompt('Login Profile',p.login||'',{title:'Authentication Policy · Draft',placeholder:'ระบุ Login Profile'});if(login===null)return;
  const mfa=await ITDialog.prompt('MFA Profile',p.mfa||'',{title:'Authentication Policy · Draft',placeholder:'ระบุ MFA Profile'});if(mfa===null)return;
  const session=await ITDialog.prompt('Session Profile',p.session||'',{title:'Authentication Policy · Draft',placeholder:'ระบุ Session Profile'});if(session===null)return;
  try{await itccRequest('POST',{scopeKey:row.scope_key,changes:{auth_profile:{login,mfa,session,notes:'Draft only; not enforced'}}});toast('บันทึก Authentication Policy Draft แล้ว');await ocControlLoad();}
  catch(err){toast(err.message);}
 }
});
