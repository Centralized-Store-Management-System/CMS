/* PJD WIN · AI Intelligence Network — Owner-only, read-only topology explorer. */
'use strict';

const ITN_URL = 'https://ytxbnqosenolojifeikf.supabase.co/functions/v1/it-intelligence-network';
let ITN = { data: null, selected: null };

const ITN_APP_INFO = {
  backoffice: { route: 'index.html', source: 'index.html · js/app.js', desc: 'Back Office application' },
  finance: { route: 'modules/finance/finance.html', source: 'modules/finance/finance.html', desc: 'Finance module' },
  accounting: { route: 'modules/finance/finance.html', source: 'modules/finance/finance.html', desc: 'Accounting inside Finance module' },
  hr: { route: 'index.html#hr', source: 'js/mod-hr.js · js/hr-documents.js', desc: 'Human Resources module' },
  payroll: { route: 'index.html#pay', source: 'js/mod-payroll.js', desc: 'Payroll module' },
  inventory: { route: 'index.html#stock', source: 'js/mod-stock.js', desc: 'Inventory / Stock module' },
  orders: { route: 'https://cafe-order-web-admin-portal.github.io/Line-Order/orders.html', source: 'cafe-order-web-admin-portal/Line-Order', desc: 'LINE Order Web Admin Portal' },
  schedule: { route: 'index.html#sched', source: 'js/mod-schedule.js · clock.html', desc: 'Schedule / Time Clock module' },
  line: { route: 'line.html', source: 'line.html · LINE Integration', desc: 'LINE integration entry' },
  liff: { route: 'line.html', source: 'js/liff-view.js · line.html', desc: 'LINE LIFF entry' }
};
const ITN_DOMAINS = [
  { key:'finance', label:'FINANCE', apps:['finance','accounting','payroll'] },
  { key:'hr', label:'HR', apps:['hr','payroll','schedule'] },
  { key:'it', label:'IT ADVANCE', apps:[] },
  { key:'shop', label:'MGR SHOP', apps:['backoffice','inventory','schedule','orders'] },
  { key:'line-order', label:'LINE ORDER', apps:['orders','line','liff'] }
];
const itnEsc = v => String(v ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const itnAppLink = app => ITN_APP_INFO[app.application_key]?.route || '';
const itnAppSource = app => ITN_APP_INFO[app.application_key]?.source || 'public.iam_applications';
const itnDomain = key => ITN.data.domains.find(d=>d.key===key);

async function itnFetch() {
  const r = await fetch(ITN_URL,{method:'GET',headers:{'x-cms-session':S.token||''},cache:'no-store'});
  const p = await r.json().catch(()=>({}));
  if(!r.ok||!p.ok) throw new Error(p.error||'อ่าน AI Intelligence Network ไม่สำเร็จ');
  return p.data;
}
async function ocNetworkLoad() {
  ocMain('<div class="itn-loading"><b>กำลังอ่านข้อมูลจริงจาก PJD WIN</b><small>Organization · HR · IAM · Application Registry · Database Lineage · IT Monitor</small></div>');
  try { ITN.data=await itnFetch(); ITN.selected=null; ocMain(itnPage()); }
  catch(e) { ocMain('<div class="status bad"><b>อ่านข้อมูล Network ไม่สำเร็จ</b><p>'+itnEsc(e.message)+'</p><button class="btn primary" data-itn-refresh>ลองใหม่</button></div>'); }
}
function itnEdge(x1,y1,x2,y2,type,label) {
  const mid=(x1+x2)/2;
  return '<g><path class="itn-edge '+type+'" d="M '+x1+' '+y1+' L '+x2+' '+y2+'"/>'+(label?'<text class="itn-edge-label" x="'+mid+'" y="'+((y1+y2)/2-5)+'">'+itnEsc(label)+'</text>':'')+'</g>';
}
function itnNode(x,y,w,h,title,sub,kind,id,state) {
  return '<g class="itn-node '+state+'" data-itn-kind="'+kind+'" data-itn-id="'+itnEsc(id)+'" tabindex="0" role="button">'+
    '<rect x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+'" rx="15"/>'+
    '<text class="itn-node-title" x="'+(x+w/2)+'" y="'+(y+27)+'">'+itnEsc(title)+'</text>'+
    '<text class="itn-node-sub" x="'+(x+w/2)+'" y="'+(y+50)+'">'+itnEsc(sub)+'</text></g>';
}
function itnGraph(data) {
  const xCenters=[190,515,840,1165,1490], edges=[], nodes=[];
  nodes.push(itnNode(705,32,270,76,'OWNER / CEO',data.owner?data.owner.staff_name+' · '+data.owner.role:'Owner record not found','owner','owner','ok'));
  edges.push(itnEdge(840,108,840,158,'verified','Owner Console'));
  nodes.push(itnNode(645,158,390,92,'AI CONTROL TOWER','Monitor · Trace · Incident Return','ai','ai','ok'));
  data.domains.forEach((d,i)=>{
    const cx=xCenters[i], x=cx-120;
    edges.push(itnEdge(840,250,cx,322,'missing',''));
    const members=(d.members||[]).filter(s=>s.is_active).length;
    const sub=(d.department_record_count||0)+' HR departments · '+members+' active staff · '+(d.acting_owner?'Acting Owner':'Manager assigned');
    nodes.push(itnNode(x,322,240,92,d.label,sub,'domain',d.key,d.manager_status==='vacant'?'warn':'ok'));
    const apps=(d.applications||[]);
    apps.forEach((a,j)=>{
      const ax=cx-105, ay=510+j*96;
      edges.push(itnEdge(cx,414, cx, ay, a.link_status==='verified'?'verified':'missing',''));
      nodes.push(itnNode(ax,ay,210,74,a.display_name,a.registry_status+' · '+a.active_permission_count+' active permissions','app',a.application_key,a.link_status==='verified'?'ok':'bad'));
    });
    if(d.key==='it'){
      const codeNodes=[
        ['Super Advance IT','owner.html#it','js/owner.js · js/it-ai.js','js/owner.js'],
        ['IT Control Center','owner.html#control','js/it-control-center.js · Edge Function','js/it-control-center.js'],
        ['AI Intelligence Network','owner.html#network','js/it-network.js · Edge Function','js/it-network.js'],
        ['IT Monitor','owner.html#ai','js/it-ai.js · it-monitor Edge Function','js/it-ai.js']
      ];
      codeNodes.forEach((c,j)=>{
        const ax=cx-105, ay=510+j*96;
        edges.push(itnEdge(cx,414,cx,ay,'verified','Source code'));
        nodes.push(itnNode(ax,ay,210,74,c[0],'พบ source code จริง','code',c[1],'ok'));
      });
    }
  });
  nodes.push(itnNode(80,890,380,82,'ORG / HR DATA','org_departments · hr_positions · staff','data','org-hr','ok'));
  nodes.push(itnNode(470,890,380,82,'IAM REGISTRY','iam_applications · roles · grants','data','iam','ok'));
  nodes.push(itnNode(900,890,380,82,'ORDER / LINE DATA','orders · items · customers · branches','data','orders','ok'));
  // Draw cross-domain database links only when an actual foreign key connects the table groups.
  const tableGroup = table => {
    if (['staff','hr_positions','org_departments','org_organizations'].includes(table)) return 'org-hr';
    if (['iam_principals','iam_principal_role_grants','iam_permissions','iam_role_permissions','iam_position_role_bindings','iam_applications','iam_roles'].includes(table)) return 'iam';
    if (['orders','order_items','customers','branches','order_status_history','line_channels'].includes(table)) return 'orders';
    return null;
  };
  const groupCenters = {'org-hr':270,'iam':660,'orders':1090};
  const pairs = new Map();
  (data.relationships||[]).forEach(r => {
    const a=tableGroup(r.source_table), b=tableGroup(r.target_table);
    if (!a || !b || a===b) return;
    const key=[a,b].sort().join('|');
    pairs.set(key,(pairs.get(key)||0)+1);
  });
  pairs.forEach((count,key)=>{
    const [a,b]=key.split('|');
    edges.push(itnEdge(groupCenters[a],972,groupCenters[b],972,'verified',count+' actual FK'));
  });
  return '<svg class="itn-svg" viewBox="0 0 1680 1010" role="img" aria-label="PJD WIN system topology">'+edges.join('')+nodes.join('')+'</svg>';
}

function itnDomainDetails(d) {
  const active=(d.members||[]).filter(s=>s.is_active);
  const people=active.map(s=>'<button class="itn-person" data-itn-person="'+itnEsc(s.id)+'"><b>'+itnEsc(s.staff_name)+'</b><small>'+itnEsc(s.position_name_th||'ยังไม่กำหนดตำแหน่ง')+' · CMS Role: '+itnEsc(s.role)+'</small></button>').join('');
  const positions=(ITN.data.positions||[]).filter(p=>(d.department_records||[]).some(dep=>dep.id===p.department_id));
  const heads=positions.filter(p=>/manager|head|director|supervisor|ผู้จัดการ|หัวหน้า|บริหาร/i.test([p.position_code,p.name_th,p.name_en,p.level].join(' ')));
  return '<div class="itn-kicker">ORGANIZATION / ACTING</div><h2>'+itnEsc(d.label)+' · '+itnEsc(d.labelTh)+'</h2>'+
    '<div class="itn-mini-grid"><div><small>HR Department Records</small><b>'+d.department_record_count+'</b></div><div><small>Active Staff</small><b>'+active.length+'</b></div><div><small>Formal Managers</small><b>'+(d.formal_managers||[]).length+'</b></div></div>'+
    (d.acting_owner?'<div class="itn-acting"><b>ACTING · OWNER</b><strong>'+itnEsc(d.acting_owner.name)+'</strong><small>รักษาการชั่วคราวตามเงื่อนไขข้อมูลจริง · ไม่ได้เปลี่ยนตำแหน่งหรือสิทธิ์ใน HR</small></div>':'<div class="itn-note good">ผู้ดำรงตำแหน่งหัวหน้าพบใน HR แล้ว</div>')+
    ((d.department_records||[]).map(dep=>'<div class="itn-detail-row"><b>'+itnEsc(dep.name)+'</b><span>'+itnEsc(dep.code)+' · '+itnEsc(dep.status)+'</span></div>').join('')||'<div class="itn-note warn">ยังไม่มี Department Record ใน public.org_departments · แสดงเป็น Functional Domain ตามโครงสร้างที่ Owner กำหนด</div>')+
    (heads.map(p=>'<div class="itn-detail-row"><b>'+itnEsc(p.name_th||p.name_en)+'</b><span>'+itnEsc(p.status)+' · '+((d.formal_managers||[]).some(s=>s.position_id===p.id)?'มีผู้ดำรงตำแหน่ง':'ยังไม่มีผู้ดำรงตำแหน่ง')+'</span></div>').join('')||'')+
    (d.role_managers_without_formal_position||[]).map(p=>'<div class="itn-note warn">พบ CMS role=manager ของ '+itnEsc(p.staff_name)+' แต่ HR Position คือ '+itnEsc(p.position_name_th||'ไม่ระบุ')+' จึงยังไม่ถือว่าเป็นการแต่งตั้ง Head อย่างเป็นทางการ</div>').join('')+
    '<h3>พนักงานที่ผูกกับหน่วยงาน</h3>'+(people||'<div class="itn-note">ยังไม่มีพนักงานที่ผูกกับ Department Record นี้</div>');
}
function itnPersonDetails(s) {
  const apps=[...(s.iam_application_access||[]),...(s.iam_position_access||[])];
  return '<div class="itn-kicker">EMPLOYEE / ACCESS TRACE</div><h2>'+itnEsc(s.staff_name)+'</h2>'+
    '<div class="itn-mini-grid"><div><small>CMS Role</small><b>'+itnEsc(s.role)+'</b></div><div><small>HR Position</small><b>'+itnEsc(s.position_name_th||'—')+'</b></div><div><small>Account</small><b>'+(s.is_active?'ACTIVE':'INACTIVE')+'</b></div></div>'+
    '<div class="itn-detail-row"><b>Department</b><span>'+itnEsc(s.department_name||'ยังไม่ผูก Department')+'</span></div>'+
    '<div class="itn-detail-row"><b>Branch</b><span>'+itnEsc(s.branch_name||s.branch_code||'—')+'</span></div>'+
    '<h3>Application Access ใน IAM</h3>'+
    (apps.length?apps.map(a=>'<div class="itn-detail-row"><b>'+itnEsc(a.display_name)+' · '+itnEsc(a.role_key||'-')+'</b><span>'+itnEsc(a.status)+'</span></div>').join(''):'<div class="itn-note warn">ไม่พบ Active IAM Grant สำหรับพนักงาน/ตำแหน่งนี้ จึงไม่คาดเดาสิทธิ์จาก CMS Role</div>')+
    '<div class="itn-note">CMS Role และ Application Permission เป็นข้อมูลคนละส่วน · หน้านี้ไม่แก้ไขสิทธิ์การใช้งาน</div>';
}
function itnCodeDetails(route) {
  const items=[
    {label:'Super Advance IT',route:'owner.html#it',files:['js/owner.js','js/it-ai.js','js/it-ops.js'],description:'Owner IT Monitoring, AI diagnosis and IT Operations queue.'},
    {label:'IT Control Center',route:'owner.html#control',files:['js/it-control-center.js','supabase/functions/it-control-center/index.ts'],description:'Existing Owner-only Theme / scope control plane.'},
    {label:'AI Intelligence Network',route:'owner.html#network',files:['js/it-network.js','supabase/functions/it-intelligence-network/index.ts'],description:'Interactive read-only organization, IAM and database topology.'},
    {label:'IT Monitor',route:'owner.html#ai',files:['js/it-ai.js','supabase/functions/it-monitor/index.ts'],description:'Live monitor findings, system diagnostics and incident history.'}
  ];
  const item=items.find(x=>x.route===route);
  if(!item)return '<div class="itn-note warn">ไม่พบเส้นทาง Source Code</div>';
  return '<div class="itn-kicker">SOURCE CODE / REAL OWNER ROUTE</div><h2>'+itnEsc(item.label)+'</h2>'+
    '<p>'+itnEsc(item.description)+'</p>'+
    '<div class="itn-detail-row"><b>Owner route</b><a href="'+itnEsc(item.route)+'">เปิดหน้า '+itnEsc(item.label)+'</a></div>'+
    item.files.map(path=>'<div class="itn-detail-row"><b>'+itnEsc(path)+'</b><a href="https://github.com/Centralized-Store-Management-System/CMS/blob/main/'+path+'" target="_blank" rel="noopener">ดู Source Code</a></div>').join('')+
    '<div class="itn-note good">ไฟล์และ route ถูกระบุจาก repository จริงของ CMS</div>';
}
function itnAppDetails(app) {
  const info=ITN_APP_INFO[app.application_key]||{},href=info.route||'';
  return '<div class="itn-kicker">APPLICATION / REAL ROUTE</div><h2>'+itnEsc(app.display_name)+'</h2>'+
    '<div class="itn-mini-grid"><div><small>Registry</small><b>'+itnEsc(app.status)+'</b></div><div><small>Permissions</small><b>'+app.permission_count+'</b></div><div><small>Active Grants</small><b>'+app.active_grant_count+'</b></div></div>'+
    '<div class="itn-note '+(app.link_status==='verified'?'good':'warn')+'">'+(app.link_status==='verified'?'พบ Active IAM mapping':'ยังไม่พบ Active IAM permission / role binding ที่ยืนยันการเชื่อมต่อ')+'</div>'+
    '<div class="itn-detail-row"><b>Application Key</b><span>'+itnEsc(app.application_key)+'</span></div>'+
    '<div class="itn-detail-row"><b>Source</b><span>'+itnEsc(info.source||'public.iam_applications')+'</span></div>'+
    (href?'<div class="itn-detail-row"><b>Real Route</b><a href="'+itnEsc(href)+'" '+(href.startsWith('http')?'target="_blank" rel="noopener"':'')+'>'+itnEsc(href)+'</a></div>':'<div class="itn-note">ยังไม่พบ Route ใน Application metadata</div>');
}
function itnDataDetails(key) {
  const sets={
    'org-hr':['staff','hr_positions','org_departments','org_organizations','iam_principals','iam_position_role_bindings'],
    iam:['iam_principals','iam_principal_role_grants','iam_permissions','iam_role_permissions','iam_position_role_bindings','iam_applications','iam_roles'],
    orders:['orders','order_items','customers','branches','order_status_history','line_channels']
  };
  const include=sets[key]||[];
  const rels=(ITN.data.relationships||[]).filter(r=>include.includes(r.source_table)||include.includes(r.target_table));
  return '<div class="itn-kicker">DATABASE LINEAGE / FOREIGN KEYS</div><h2>'+itnEsc(key==='org-hr'?'Organization & HR':key==='iam'?'IAM Registry':'Orders & LINE')+'</h2>'+
    '<div class="itn-note good">ทุกเส้นด้านล่างอ่านจาก pg_constraint จริง</div>'+
    (rels.map(r=>'<div class="itn-relation"><b>'+itnEsc(r.source_table)+'.'+itnEsc(r.source_column)+'</b><span>→</span><b>'+itnEsc(r.target_table)+'.'+itnEsc(r.target_column)+'</b><small>'+itnEsc(r.constraint_name)+'</small></div>').join('')||'<div class="itn-note">ไม่พบ Foreign Key path ในกลุ่มนี้</div>');
}
function itnDefaultDetails(data) {
  const c=data.counts||{};
  return '<div class="itn-kicker">LIVE SNAPSHOT · READ ONLY</div><h2>ภาพรวม PJD WIN</h2>'+
    '<div class="itn-mini-grid"><div><small>Organizations</small><b>'+c.active_organizations+'</b></div><div><small>Departments</small><b>'+c.active_departments+'</b></div><div><small>Active Staff</small><b>'+c.active_staff+'</b></div><div><small>Applications</small><b>'+c.registered_applications+'</b></div><div><small>Active Permissions</small><b>'+c.active_permissions+'</b></div><div><small>Active IAM Grants</small><b>'+c.active_user_grants+'</b></div></div>'+
    '<div class="itn-note warn">'+(data.organizations?.length?'พบ Organization Registry '+data.organizations.length+' รายการ':'ยังไม่พบ Organization Record ใน public.org_organizations')+' · Functional Domains 5 กลุ่มมาจากโครงสร้าง PJD WIN ที่ Owner ระบุ ส่วน Department/Employee/Application/Permission ดึงจากฐานข้อมูลจริง</div>'+
    '<h3>เส้นเชื่อมต่อ</h3><div class="itn-legend"><span><i class="itn-sample solid"></i>เขียวทึบ: Foreign Key / Source Code ที่ตรวจพบ</span><span><i class="itn-sample dashed"></i>แดงประ: ควรเชื่อมต่อ แต่ยังไม่มี Active IAM mapping</span></div>'+
    '<div class="itn-note">เส้นแดงประไม่ได้แปลว่า Network ล่ม แต่หมายถึงยังไม่มีหลักฐานการผูกสิทธิ์/การ routing ใน Registry ที่ใช้อยู่</div>'+
    '<h3>Data Sources</h3><div class="itn-source-list">'+(data.data_sources||[]).map(x=>'<span>'+itnEsc(x)+'</span>').join('')+'</div>'+
    '<div class="itn-muted">Snapshot: '+itnEsc(new Date(data.generated_at).toLocaleString('th-TH'))+'</div>';
}
function itnIncidents(data) {
  const monitor=data.monitor, findings=Array.isArray(monitor?.findings)?monitor.findings:[];
  if(!monitor) return '<div class="itn-note">ยังไม่มีรอบตรวจใน it_monitor_runs</div>';
  if(!findings.length) return '<div class="itn-note good">รอบตรวจล่าสุด '+itnEsc(new Date(monitor.checked_at).toLocaleString('th-TH'))+' ไม่พบ Finding ที่ถูกบันทึก</div>';
  return findings.map(f=>{
    const text=[f.code,f.title,f.detail].join(' ').toLowerCase();
    let key=/payroll|finance|account|tax|payment/.test(text)?'finance':/hr|employee|staff|position|attendance/.test(text)?'hr':/order|line|liff|customer|branch/.test(text)?'line-order':/backoffice|cron|supabase|database|api|function|monitor/.test(text)?'it':'shop';
    const d=data.domains.find(x=>x.key===key),recipient=d?.acting_owner?.name||d?.formal_managers?.[0]?.staff_name||'ยังไม่พบผู้รับผิดชอบใน HR';
    const level=String(f.level||'info').toLowerCase();
    return '<article class="itn-incident '+(level==='critical'?'critical':level==='warning'?'warning':'')+'"><b>'+itnEsc(f.title||f.code||'System Finding')+'</b><p>'+itnEsc(f.detail||'')+'</p><small>Code: '+itnEsc(f.code||'-')+' · '+itnEsc(d?.label||'IT')+' · ผู้รับผิดชอบ: '+itnEsc(recipient)+'</small><p>แนวทางตรวจสอบ: '+itnEsc(f.action||'ดูรายละเอียดใน AI Monitoring')+'</p></article>';
  }).join('');
}

function itnIncidentRoute(incident,data) {
  const text=[incident.code,incident.title,incident.detail,incident.recommendation].join(' ').toLowerCase();
  const key=/payroll|finance|account|tax|payment/.test(text)?'finance':/hr|employee|staff|position|attendance/.test(text)?'hr':/order|line|liff|customer|branch/.test(text)?'line-order':/backoffice|cron|supabase|database|api|function|monitor|mail|outbox/.test(text)?'it':'shop';
  const domain=(data.domains||[]).find(x=>x.key===key);
  const head=(domain?.formal_managers||[]).find(x=>x.is_active);
  const owner=data.owner;
  return {domain,head,owner,contact:head?.staff_name||owner?.staff_name||'Owner escalation required',
    contactRole:head?(head.position_name_th||'Department Head'):'Owner · Acting escalation',
    route:head?'HR Position → Department Head':'Owner Console → IT Advance / Incident Center',
    fallback:owner?.staff_name||'Owner record not found'};
}
function itnIncidentBrief(incident,data) {
  const r=itnIncidentRoute(incident,data);
  const sev=String(incident.severity||'info').toUpperCase();
  return [
    'PJD WIN INCIDENT · '+(incident.code||'INCIDENT'),
    'Incident ID: '+incident.id+' | Severity: '+sev+' | Status: '+incident.status,
    'ระบบ/หน่วยงานที่รับผิดชอบเบื้องต้น: '+(r.domain?.label||'IT ADVANCE'),
    'ผู้ที่ต้องติดต่อ: '+r.contact+' ('+r.contactRole+')',
    'เส้นทางส่งต่อ: '+r.route,
    'อาการ: '+(incident.detail||incident.title||'-'),
    'พบครั้งแรก: '+incident.first_seen_at+' | ล่าสุด: '+incident.last_seen_at+' | เกิดซ้ำ: '+incident.occurrence_count,
    'คำแนะนำ: '+(incident.recommendation||'ตรวจสอบหลักฐานและ Log ก่อนดำเนินการ'),
    'การตอบกลับที่ต้องส่ง: รับทราบ / ผู้ตรวจสอบ / สาเหตุ / วิธีแก้ / ผลทดสอบ / เวลาเสร็จ',
    'หมายเหตุ: ห้ามแก้ Production โดยไม่มีการอนุมัติตามระดับความเสี่ยง'
  ].join('\n');
}
function itnIncidentCenter(data) {
  const center=data.incident_center||{}, incidents=center.incidents||[], deps=center.dependency_map||[];
  const open=incidents.filter(x=>!['resolved','closed'].includes(String(x.status).toLowerCase()));
  const n=center.notification_readiness||{}, diag=center.latest_diagnostic;
  const queue=(center.action_queue||[]).map(x=>'<div class="itn-detail-row"><b>'+itnEsc(x.status)+' · '+itnEsc(x.risk_level)+'</b><span>'+x.count+' รายการ'+(x.requires_owner_approval?' · ต้อง Owner อนุมัติ':'')+'</span></div>').join('');
  const cards=incidents.map(x=>{
    const r=itnIncidentRoute(x,data), level=String(x.severity||'info').toLowerCase();
    const brief=itnEsc(itnIncidentBrief(x,data));
    return '<article class="itn-incident '+(level==='critical'||level==='high'?'critical':level==='warning'?'warning':'')+'">'+
      '<div class="itn-incident-top"><b>'+itnEsc(x.title||x.code)+'</b><span>'+itnEsc(x.severity)+' · '+itnEsc(x.status)+'</span></div>'+
      '<p>'+itnEsc(x.detail||'ไม่มีรายละเอียด')+'</p>'+
      '<div class="itn-route-box"><small>หน่วยงานรับผิดชอบเบื้องต้น</small><b>'+itnEsc(r.domain?.label||'IT ADVANCE')+'</b><small>ผู้ที่ต้องไปหา</small><strong>'+itnEsc(r.contact)+'</strong><small>'+itnEsc(r.contactRole)+' · '+itnEsc(r.route)+'</small></div>'+
      '<p><b>สิ่งที่ต้องตรวจ:</b> '+itnEsc(x.recommendation||'ตรวจ Logs, dependency และผลตรวจล่าสุด')+'</p>'+
      '<p><b>ส่งผลกลับ:</b> รับทราบ → ผู้ตรวจสอบ → Root Cause → วิธีแก้ → ผลทดสอบ → เวลาปิดงาน</p>'+
      '<button class="btn sm" data-itn-copy-incident="'+x.id+'" data-brief="'+brief+'">คัดลอกรายงานส่งผู้รับผิดชอบ</button>'+
      '<small>พบครั้งแรก '+itnEsc(x.first_seen_at)+' · ล่าสุด '+itnEsc(x.last_seen_at)+' · เกิดซ้ำ '+x.occurrence_count+' ครั้ง · Monitor Run #'+itnEsc(x.source_monitor_run_id)+'</small>'+
      '</article>';
  }).join('');
  const depRows=deps.map(x=>'<div class="itn-dep-row"><div><b>'+itnEsc(x.component)+' → '+itnEsc(x.depends_on)+'</b><small>'+itnEsc(x.description)+'</small><small>ตรวจสอบ: '+itnEsc(x.verification_hint)+'</small></div><span>'+itnEsc(x.criticality)+'</span></div>').join('');
  return '<div class="itn-kicker">AI INCIDENT COMMAND / OWNER RETURN</div><h2>ศูนย์สั่งการเมื่อระบบมีปัญหา</h2>'+
    '<div class="itn-mini-grid"><div><small>Open Incidents</small><b>'+open.length+'</b></div><div><small>Incident Records</small><b>'+incidents.length+'</b></div><div><small>Dependency Rules</small><b>'+deps.length+'</b></div>'+
    '<div><small>Push Recipients</small><b>'+Number(n.active_push_subscriptions||0)+'</b></div><div><small>Notification Attempts</small><b>'+Number(n.delivery_attempts||0)+'</b></div><div><small>Open Alerts</small><b>'+Number(n.open_alerts||0)+'</b></div></div>'+
    '<div class="itn-note warn">ระบบจะระบุผู้รับผิดชอบจาก HR Position จริงก่อน หากไม่พบ Head จะส่งเส้นทางให้ Owner Acting เป็นผู้รับเรื่องแทน โดยไม่แต่งตั้งตำแหน่งหรือเปลี่ยนสิทธิ์พนักงาน</div>'+
    '<h3>รายการปัญหาและผู้ที่ต้องไปหา</h3>'+(cards||'<div class="itn-note good">ไม่มี Incident ที่ถูกบันทึกใน Incident Registry ขณะนี้ · ตรวจ Monitor ล่าสุดประกอบ</div>')+
    '<h3>ผลวิเคราะห์ AI ล่าสุด</h3>'+(diag?'<div class="itn-detail-row"><b>Diagnostic #'+diag.id+'</b><span>'+itnEsc(diag.overall_status)+' · confidence '+itnEsc(diag.confidence)+'</span></div><pre class="itn-json">'+itnEsc(JSON.stringify(diag.root_causes||[],null,2))+'</pre>':'<div class="itn-note">ยังไม่มี Diagnostic Record</div>')+
    '<h3>Action Queue</h3>'+(queue||'<div class="itn-note">ยังไม่มีรายการ Action Queue</div>')+
    '<h3>เส้นทาง Dependency ที่ต้องตรวจเมื่อเกิดเหตุ</h3>'+(depRows||'<div class="itn-note">ยังไม่มี Dependency Map</div>')+
    '<div class="itn-note '+(Number(n.active_push_subscriptions||0)>0?'good':'warn')+'">การแจ้งเตือนอัตโนมัติ: '+(Number(n.active_push_subscriptions||0)>0?'พบ Push Subscription ที่ Active':'ยังไม่มี Push Subscription ที่ Active')+' · Email/LINE notification ถูกปิดไว้ตาม Governance จนกว่าจะยืนยัน Provider และผู้รับจริง · ระบบจะไม่แสดงว่ามีการส่งแจ้งเตือนแล้วหากไม่มี Delivery Record</div>'+
    '<div class="itn-note">ทุกการส่งกลับต้องมี Incident ID, ผู้รับผิดชอบ, Root Cause, วิธีแก้, หลักฐานก่อน/หลัง และผลทดสอบ · AI แนะนำได้ แต่การแก้ Production ต้องผ่าน Owner Approval ตาม Governance</div>';
}
function itnPage() {
  const d=ITN.data,c=d.counts||{},domains=d.domains||[],findings=d.monitor?.findings||[];
  const vacant=domains.filter(x=>x.manager_status==='vacant').length;
  const missing=(d.applications||[]).filter(x=>x.status!=='active'||!x.active_permission_count||(!x.active_grant_count&&!x.active_position_binding_count)).length;
  const bad=findings.filter(x=>String(x.level).toLowerCase()==='critical').length;
  const warn=findings.filter(x=>String(x.level).toLowerCase()==='warning').length;
  const css = '<style>'+
  '.itn-wrap{color:var(--text,#183c2b)}.itn-head{display:flex;justify-content:space-between;gap:14px;flex-wrap:wrap;padding:18px;background:linear-gradient(115deg,#f4fbf6,#fff);border:1px solid var(--line);border-radius:17px}.itn-head h1{margin:0;color:#064d37;font:700 24px Prompt}.itn-head p{margin:6px 0;color:var(--muted);font-size:12px}.itn-actions{display:flex;gap:8px;flex-wrap:wrap}.itn-kpis{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:9px;margin:13px 0}.itn-kpi,.itn-panel{background:#fff;border:1px solid var(--line);border-radius:14px;padding:12px}.itn-kpi small{display:block;color:var(--muted);font-size:10px}.itn-kpi strong{font:700 22px Prompt;color:#07583f}.itn-kpi.bad strong{color:#b42318}.itn-kpi.warn strong{color:#a9660e}.itn-note{padding:10px 12px;margin:9px 0;background:#f4f8f5;border-radius:10px;color:#607369;font-size:11px;line-height:1.5}.itn-note.warn{background:#fff4df;color:#8b5a12}.itn-note.good{background:#e8f7ef;color:#17673f}.itn-panel{margin:12px 0}.itn-panel-head{display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:10px}.itn-panel-head h2{margin:0;font:700 15px Prompt;color:#174c35}.itn-muted{font-size:10px;color:var(--muted)}.itn-legend{display:flex;gap:12px;flex-wrap:wrap;font-size:10px;color:var(--muted)}.itn-sample{display:inline-block;width:28px;border-top:3px solid #168250;margin-right:5px}.itn-sample.dashed{border-top:3px dashed #c32929}.itn-canvas{max-width:100%;overflow:auto;border:1px solid var(--line);border-radius:12px;background:radial-gradient(#d9e4dd 1px,transparent 1px),#f8fbf9;background-size:22px 22px;-webkit-overflow-scrolling:touch}.itn-svg{display:block;width:1680px;height:auto;max-width:none}.itn-edge{fill:none;stroke-width:2.4}.itn-edge.verified{stroke:#168250}.itn-edge.missing{stroke:#c32929;stroke-dasharray:9 7}.itn-edge-label{font:10px sans-serif;fill:#a12c2c;text-anchor:middle;paint-order:stroke;stroke:#fff;stroke-width:4}.itn-node{cursor:pointer;outline:none}.itn-node rect{fill:#fff;stroke:#cbdad2;stroke-width:1.7;filter:drop-shadow(0 3px 5px #123b2815)}.itn-node.owner rect{fill:#e5f3eb;stroke:#9bc9b0}.itn-node.ai rect{fill:#07583f;stroke:#07583f}.itn-node.ai .itn-node-title{fill:#fff}.itn-node.ai .itn-node-sub{fill:#c7e8d5}.itn-node.domain.warn rect{fill:#fff4df;stroke:#e4bd7d}.itn-node.domain.ok rect{fill:#e8f5ed;stroke:#93c4a6}.itn-node.app.bad rect{fill:#fff0ee;stroke:#df9b94}.itn-node.app.ok rect{fill:#e8f6ee;stroke:#91c6a4}.itn-node.data rect{fill:#eef4ff;stroke:#b1c5e8}.itn-node:focus rect,.itn-node:hover rect{stroke:#086b47;stroke-width:3}.itn-node-title{font:700 14px sans-serif;fill:#174c35;text-anchor:middle}.itn-node-sub{font:10px sans-serif;fill:#61756b;text-anchor:middle}.itn-bottom{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(300px,.85fr);gap:12px}.itn-detail{min-height:230px;max-height:650px;overflow:auto}.itn-detail h2{font:700 17px Prompt;color:#174c35;margin:4px 0 10px}.itn-detail h3{font:700 12px Prompt;color:#174c35;margin:16px 0 7px}.itn-kicker{font-size:9px;font-weight:700;letter-spacing:.08em;color:#0d8052}.itn-mini-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;margin:11px 0}.itn-mini-grid>div{padding:8px;background:#f5f8f6;border:1px solid #e7eee9;border-radius:9px}.itn-mini-grid small{display:block;color:var(--muted);font-size:9px}.itn-mini-grid b{font:700 15px Prompt;color:#07583f}.itn-acting{background:#fff4df;border:1px solid #e7c17c;padding:10px 12px;border-radius:10px;margin:10px 0}.itn-acting b,.itn-acting strong,.itn-acting small{display:block}.itn-acting b{font-size:9px;color:#99600f}.itn-acting strong{font:700 16px Prompt;color:#75440e}.itn-acting small{font-size:10px;color:#98764b}.itn-detail-row{display:flex;justify-content:space-between;gap:10px;padding:7px 0;border-bottom:1px solid var(--line);font-size:10px}.itn-detail-row span{color:var(--muted);text-align:right}.itn-detail-row a{color:#0a754b;overflow-wrap:anywhere}.itn-person{width:100%;display:flex;flex-direction:column;align-items:flex-start;margin:5px 0;padding:9px;border:1px solid var(--line);border-radius:9px;background:#fff;text-align:left;cursor:pointer}.itn-person b{font-size:11px;color:#174c35}.itn-person small{font-size:9px;color:var(--muted)}.itn-relation{display:grid;grid-template-columns:minmax(0,1fr) 18px minmax(0,1fr);gap:5px;padding:7px 0;border-bottom:1px solid var(--line);font-size:9px;overflow-wrap:anywhere}.itn-relation span{text-align:center;color:#168250;font-weight:800}.itn-relation small{grid-column:1/-1;color:var(--muted)}.itn-incident{padding:9px;margin:7px 0;background:#fff;border:1px solid var(--line);border-left:4px solid #889a90;border-radius:9px}.itn-incident.critical{border-left-color:#b42318;background:#fff7f6}.itn-incident.warning{border-left-color:#d28a20;background:#fffaf1}.itn-incident b{font-size:11px}.itn-incident p,.itn-incident small{font-size:10px;color:var(--muted);line-height:1.5}.itn-source-list{display:flex;gap:5px;flex-wrap:wrap}.itn-source-list span{font-size:9px;background:#f3f7f4;padding:5px 7px;border-radius:7px;color:#52685b}.itn-loading{padding:35px;text-align:center;background:#fff;border:1px solid var(--line);border-radius:14px}.itn-loading b,.itn-loading small{display:block}.itn-loading small{color:var(--muted);margin-top:5px}@media(max-width:850px){.itn-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}.itn-bottom{grid-template-columns:1fr}}@media(max-width:500px){.itn-mini-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.itn-head h1{font-size:20px}}'+
  ".itn-incident-top{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}.itn-incident-top span{font-size:9px;color:#8b5a12;white-space:nowrap}.itn-route-box{display:grid;gap:3px;padding:10px;margin:8px 0;border-radius:10px;background:#f0f7f2;border:1px solid #dcebe1}.itn-route-box small{font-size:9px;color:#6b7d72}.itn-route-box b,.itn-route-box strong{font:700 13px Prompt;color:#07583f}.itn-dep-row{display:flex;justify-content:space-between;gap:10px;padding:10px 0;border-bottom:1px solid var(--line)}.itn-dep-row b,.itn-dep-row small{display:block}.itn-dep-row b{font-size:11px}.itn-dep-row small{font-size:9px;color:var(--muted);line-height:1.5}.itn-dep-row>span{font-size:9px;color:#9a641b;white-space:nowrap}.itn-json{white-space:pre-wrap;overflow-wrap:anywhere;background:#f5f8f6;padding:10px;border-radius:9px;font-size:10px;color:#385546}@media(max-width:600px){.itn-incident-top{flex-direction:column}.itn-dep-row{flex-direction:column}}"+\n  '</style>';
  const sourceList=(d.data_sources||[]).map(x=>'<span>'+itnEsc(x)+'</span>').join('');
  const relationList=(d.relationships||[]).map(r=>'<div class="itn-relation"><b>'+itnEsc(r.source_table)+'.'+itnEsc(r.source_column)+'</b><span>→</span><b>'+itnEsc(r.target_table)+'.'+itnEsc(r.target_column)+'</b><small>'+itnEsc(r.constraint_name)+'</small></div>').join('');
  const html=css+
  '<div class="itn-wrap">'+
    '<section class="itn-head"><div><h1>AI Intelligence Network</h1><p>PJD WIN · Interactive Organization & System Dependency Map · Read-only snapshot</p><span class="itn-muted">Owner Acting · System Registry · Employee Access Trace · Database Lineage · Incident Return</span></div><div class="itn-actions"><button class="btn" data-itn-refresh>รีเฟรชข้อมูลจริง</button><button class="btn" data-itn-show-incidents>Incident Command</button><button class="btn primary" data-itn-open-ai>AI Monitoring</button></div></section>'+
    '<section class="itn-kpis">'+
      '<div class="itn-kpi"><small>HR Departments (จริง)</small><strong>'+(c.active_departments||0)+'</strong></div>'+
      '<div class="itn-kpi"><small>Active Employees</small><strong>'+(c.active_staff||0)+'</strong></div>'+
      '<div class="itn-kpi"><small>Application Registry</small><strong>'+(c.registered_applications||0)+'</strong></div>'+
      '<div class="itn-kpi bad"><small>Active IAM Grants</small><strong>'+(c.active_user_grants||0)+'</strong></div>'+
      '<div class="itn-kpi warn"><small>Acting Owner Required</small><strong>'+vacant+'</strong></div>'+
    '</section>'+
    '<div class="itn-note warn">'+(d.organizations?.length?'Organization Registry: '+d.organizations.length+' รายการ':'ยังไม่พบ Organization Record ใน public.org_organizations')+' · '+missing+' Applications ยังไม่มี Active IAM mapping · เส้นประแดงหมายถึง Registry ยังไม่ยืนยัน ไม่ใช่หลักฐานว่า Server ล่ม</div>'+
    '<section class="itn-panel"><div class="itn-panel-head"><div><h2>NETWORK MAP · เลื่อนดูและกดเจาะลึกได้</h2><small class="itn-muted">แตะกล่อง Owner / Department / Application / Data เพื่อดูรายละเอียด</small></div><div class="itn-legend"><span><i class="itn-sample solid"></i>Verified FK / Source Code</span><span><i class="itn-sample dashed"></i>Recommended link · Pending</span></div></div><div class="itn-canvas">'+itnGraph(d)+'</div></section>'+
    '<div id="itn-incident-center" class="itn-panel">'+itnIncidentCenter(d)+'</div>'+\n    '<div class="itn-bottom">'+
      '<section class="itn-panel"><div class="itn-panel-head"><h2>DETAIL EXPLORER</h2><small class="itn-muted">เจาะลึกหน่วยงาน / พนักงาน / ระบบ</small></div><div id="itn-detail" class="itn-detail">'+itnDefaultDetails(d)+'</div></section>'+
      '<section class="itn-panel"><div class="itn-panel-head"><h2>AI INCIDENT RETURN</h2><span class="itn-muted">Critical '+bad+' · Warning '+warn+'</span></div><p class="itn-muted">ผลตรวจล่าสุดจาก public.it_monitor_runs พร้อมหน่วยงานและผู้รับผิดชอบตาม HR mapping</p><div>'+itnIncidents(d)+'</div><button class="btn sm" data-itn-open-ai>เปิด Incident & Approval Center</button></section>'+
    '</div>'+
    '<section class="itn-panel"><div class="itn-panel-head"><h2>VERIFIED DATABASE CONNECTIONS</h2><small class="itn-muted">'+(d.relationships?.length||0)+' Foreign Key Paths จาก pg_constraint</small></div>'+(relationList||'<div class="itn-note">ไม่พบ Foreign Key paths</div>')+'</section>'+
    '<section class="itn-panel"><div class="itn-panel-head"><h2>LIVE DATA SOURCES</h2></div><div class="itn-source-list">'+sourceList+'</div><p class="itn-muted">Snapshot: '+itnEsc(new Date(d.generated_at).toLocaleString('th-TH'))+' · Read-only · ไม่มีการเขียนฐานข้อมูลหรือเปลี่ยนสิทธิ์</p></section>'+
  '</div>';
  setTimeout(itnBind,0);
  return html;
}
function itnBind() {
  const root=document.getElementById('oc-main');
  if(!root||root.dataset.itnBound==='1')return;
  root.dataset.itnBound='1';
  root.addEventListener('click',e=>{
    if(e.target.closest('[data-itn-refresh]')){ocNetworkLoad();return;}
    if(e.target.closest('[data-itn-open-ai]')){ocGo('ai');return;}\n    if(e.target.closest('[data-itn-show-incidents]')){document.getElementById('itn-incident-center')?.scrollIntoView({behavior:'smooth',block:'start'});return;}\n    const copyBtn=e.target.closest('[data-itn-copy-incident]');\n    if(copyBtn){const value=copyBtn.dataset.brief||'';navigator.clipboard?.writeText(value).then(()=>{copyBtn.textContent='คัดลอกแล้ว';}).catch(()=>{const ta=document.createElement('textarea');ta.value=value;document.body.appendChild(ta);ta.select();document.execCommand('copy');ta.remove();copyBtn.textContent='คัดลอกแล้ว';});return;}
    const person=e.target.closest('[data-itn-person]');
    if(person){
      const s=ITN.data.staff.find(x=>x.id===person.dataset.itnPerson);
      if(s)document.getElementById('itn-detail').innerHTML=itnPersonDetails(s);
      return;
    }
    const node=e.target.closest('[data-itn-kind]');
    if(!node)return;
    const kind=node.dataset.itnKind,id=node.dataset.itnId,detail=document.getElementById('itn-detail');
    if(kind==='owner'||kind==='ai')detail.innerHTML=itnDefaultDetails(ITN.data);
    if(kind==='domain'){const d=ITN.data.domains.find(x=>x.key===id);if(d)detail.innerHTML=itnDomainDetails(d);}
    if(kind==='app'){const app=ITN.data.applications.find(x=>x.application_key===id);if(app)detail.innerHTML=itnAppDetails(app);}
    if(kind==='code')detail.innerHTML=itnCodeDetails(id);
    if(kind==='data')detail.innerHTML=itnDataDetails(id);
  });
  root.addEventListener('keydown',e=>{
    if((e.key==='Enter'||e.key===' ')&&e.target.closest('[data-itn-kind]')){e.preventDefault();e.target.closest('[data-itn-kind]').dispatchEvent(new MouseEvent('click',{bubbles:true}));}
  });
}
