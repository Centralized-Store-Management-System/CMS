/* Centralized IAM Admin Console. Draft-only policy configuration; no runtime privileges are activated here. */
'use strict';
const IAM_API='https://ytxbnqosenolojifeikf.supabase.co/functions/v1/iam-admin-api';
let IAM_DATA={applications:[],permissions:[],roles:[],rolePermissions:[],bindings:[],positions:[],outbox:[]};
async function iamRequest(method='GET',body=null){
 const r=await fetch(IAM_API,{method,headers:{'content-type':'application/json','x-cms-session':S.token||''},body:body?JSON.stringify(body):undefined,cache:'no-store'});
 const p=await r.json().catch(()=>({}));if(!r.ok||!p.ok)throw new Error(p.error||'IAM API error');return p;
}
async function iamAdminOpen(){
 ocMain('<p class="loading">กำลังโหลด IAM Catalog…</p>');
 try{const p=await iamRequest();IAM_DATA=p;iamRender();}
 catch(e){ocMain('<div class="status bad">'+esc(e.message)+'</div>');}
}
function iamRender(){
 const d=IAM_DATA;
 ocMain(`<div class="h2"><div><h1 style="margin:0">Centralized IAM</h1><p class="muted">Organization · Application · Permission · Role · Position Binding</p></div><span class="spacer"></span><button class="btn" onclick="ocControlLoad()">กลับ IT Control Center</button><button class="btn" onclick="iamAdminOpen()">Refresh</button></div>
 <div class="kpis"><div class="kpi"><b>${d.applications.length}</b><span>Applications</span></div><div class="kpi"><b>${d.permissions.length}</b><span>Permissions</span></div><div class="kpi"><b>${d.roles.length}</b><span>Roles</span></div><div class="kpi warn"><b>${d.bindings.filter(x=>x.status==='draft').length}</b><span>Draft Position Bindings</span></div></div>
 <div class="note warn">ระบบนี้จัดการ Policy Catalog และ Draft Binding เท่านั้น ยังไม่เปิดใช้สิทธิ์จริงจนกว่าแต่ละ Backend จะเชื่อม Server-side Authorization และผ่านการทดสอบ</div>
 <section class="group pad"><div class="h2">Application Registry <span class="spacer"></span><button class="btn primary" onclick="iamAddApplication()">+ Add Application</button></div>
 ${d.applications.map(a=>`<div class="row static"><span class="main"><b>${esc(a.display_name)}</b><span class="s">${esc(a.application_key)} · ${esc(a.status)} · v${a.integration_version}</span></span><span class="chip warn">Draft</span></div>`).join('')||'<p class="muted">ยังไม่มี Application</p>'}</section>
 <section class="group pad"><div class="h2">Permission Catalog <span class="spacer"></span><button class="btn primary" onclick="iamAddPermission()">+ Add Permission</button></div>
 ${d.permissions.map(p=>`<div class="row static"><span class="main"><b>${esc(p.permission_code)}</b><span class="s">${esc(p.application_name)} · ${esc(p.resource_key)} / ${esc(p.action_key)} · ${esc(p.risk_level)}</span></span><span class="chip warn">Draft</span></div>`).join('')||'<p class="muted">ยังไม่มี Permission</p>'}</section>
 <section class="group pad"><div class="h2">Role Catalog <span class="spacer"></span><button class="btn primary" onclick="iamAddRole()">+ Add Role</button></div>
 ${d.roles.map(r=>{const n=d.rolePermissions.filter(x=>x.role_id===r.id).length;return `<div class="row static"><span class="main"><b>${esc(r.display_name)}</b><span class="s">${esc(r.role_key)} · ${n} permissions · ${esc(r.status)}</span></span><button class="btn sm" onclick="iamSetRolePermissions('${r.id}')">Assign Permissions</button></div>`;}).join('')||'<p class="muted">ยังไม่มี Role</p>'}</section>
 <section class="group pad"><div class="h2">Position → Role Bindings <span class="spacer"></span><button class="btn primary" onclick="iamBindPosition()">+ Bind Position</button></div>
 ${d.bindings.map(b=>`<div class="row static"><span class="main"><b>${esc(b.position_code)} · ${esc(b.name_th)}</b><span class="s">${esc(b.role_key)} · ${esc(b.role_name)} · Scope ${esc(JSON.stringify(b.scope_template))}</span></span><span class="chip warn">${esc(b.status)} (no access)</span></div>`).join('')||'<p class="muted">ยังไม่มี Position Binding</p>'}</section>
 <section class="group pad"><div class="h2">HR → IT Sync Queue</div>
 ${d.outbox.map(x=>`<div class="row static"><span class="main"><b>${esc(x.status)}</b><span class="s">${Number(x.count)||0} events</span></span></div>`).join('')||'<p class="muted">ยังไม่มี Event</p>'}
 <p class="note">Outbox events are queued transactionally. A module-level consumer/acknowledgement is still required before an event can be considered synchronized across business applications.</p></section>`);
}
async function iamAddApplication(){
 const k=await ITDialog.prompt('Application Key (เช่น finance, hr, payroll)','',{title:'Add Application'});if(!k)return;
 const n=await ITDialog.prompt('ชื่อระบบที่แสดง',k,{title:'Add Application'});if(!n)return;
 try{await iamRequest('POST',{action:'save-application',application_key:k,display_name:n});await iamAdminOpen();}catch(e){ITDialog.alert(e.message);}
}
async function iamAddPermission(){
 if(!IAM_DATA.applications.length)return ITDialog.alert('เพิ่ม Application ก่อน');
 const app=await ITDialog.prompt('Application Key',IAM_DATA.applications[0].application_key,{title:'Add Permission',detail:IAM_DATA.applications.map(x=>x.application_key+' = '+x.display_name).join('\n')});if(!app)return;
 const code=await ITDialog.prompt('Permission Code เช่น finance.expense.view','',{title:'Add Permission'});if(!code)return;
 const resource=await ITDialog.prompt('Resource Key เช่น expense','expense',{title:'Add Permission'});if(!resource)return;
 const action=await ITDialog.prompt('Action Key เช่น view','view',{title:'Add Permission'});if(!action)return;
 const risk=await ITDialog.prompt('Risk Level: normal / sensitive / critical','normal',{title:'Add Permission'});
 try{await iamRequest('POST',{action:'save-permission',application_key:app,permission_code:code,resource_key:resource,action_key:action,risk_level:risk||'normal'});await iamAdminOpen();}catch(e){ITDialog.alert(e.message);}
}
async function iamAddRole(){
 const k=await ITDialog.prompt('Role Key (เช่น finance_final_verifier)','',{title:'Add Role'});if(!k)return;
 const n=await ITDialog.prompt('ชื่อ Role ที่แสดง',k,{title:'Add Role'});if(!n)return;
 try{await iamRequest('POST',{action:'save-role',role_key:k,display_name:n});await iamAdminOpen();}catch(e){ITDialog.alert(e.message);}
}
async function iamSetRolePermissions(id){
 const role=IAM_DATA.roles.find(x=>x.id===id);if(!role)return;
 const existing=IAM_DATA.rolePermissions.filter(x=>x.role_id===id).map(x=>IAM_DATA.permissions.find(p=>p.id===x.permission_id)?.permission_code).filter(Boolean);
 const list=IAM_DATA.permissions.map(x=>x.permission_code+' ['+x.application_key+']').join('\n');
 const v=await ITDialog.prompt('ใส่ Permission Code คั่นด้วย comma',existing.join(','),{title:'Assign · '+role.display_name,detail:list});
 if(v===null)return;
 const codes=v.split(',').map(x=>x.trim()).filter(Boolean);
 const ids=codes.map(c=>IAM_DATA.permissions.find(p=>p.permission_code===c)?.id);
 if(ids.some(x=>!x))return ITDialog.alert('พบ Permission Code ที่ไม่มีใน Catalog');
 try{await iamRequest('POST',{action:'set-role-permissions',role_id:id,permission_ids:ids});await iamAdminOpen();}catch(e){ITDialog.alert(e.message);}
}
async function iamBindPosition(){
 if(!IAM_DATA.positions.length||!IAM_DATA.roles.length)return ITDialog.alert('ต้องมี Position และ Role ก่อน');
 const pos=await ITDialog.prompt('Position Code',IAM_DATA.positions[0].position_code,{title:'Bind Position → Role',detail:IAM_DATA.positions.map(x=>x.position_code+' = '+x.name_th).join('\n')});if(!pos)return;
 const p=IAM_DATA.positions.find(x=>x.position_code.toUpperCase()===pos.trim().toUpperCase());if(!p)return ITDialog.alert('ไม่พบ Position');
 const roleKey=await ITDialog.prompt('Role Key',IAM_DATA.roles[0].role_key,{title:'Bind Position → Role',detail:IAM_DATA.roles.map(x=>x.role_key+' = '+x.display_name).join('\n')});if(!roleKey)return;
 const r=IAM_DATA.roles.find(x=>x.role_key===roleKey.trim());if(!r)return ITDialog.alert('ไม่พบ Role');
 try{await iamRequest('POST',{action:'bind-position-role',position_id:p.id,role_id:r.id,scope:{branch:'assigned'}});await iamAdminOpen();}catch(e){ITDialog.alert(e.message);}
}
