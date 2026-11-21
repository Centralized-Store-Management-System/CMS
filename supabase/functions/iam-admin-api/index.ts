import postgres from "npm:postgres@3.4.5";
const DB_URL=Deno.env.get("SUPABASE_DB_URL")||"";
const AUTH_API=(Deno.env.get("SUPABASE_URL")||"").replace(/\/$/,"")+"/functions/v1/backoffice";
const sql=DB_URL?postgres(DB_URL,{max:4,idle_timeout:10,connect_timeout:10}):null;
const ORIGINS=new Set(["https://centralized-store-management.github.io","https://centralized-store-management-system.github.io"]);
class HttpError extends Error{status:number;constructor(status:number,message:string){super(message);this.status=status;}}
const cors=(o:string)=>o?{"access-control-allow-origin":o,"access-control-allow-headers":"content-type,x-cms-session","access-control-allow-methods":"GET,POST,OPTIONS","vary":"Origin"}:{};
const reply=(x:unknown,s=200,o="")=>new Response(JSON.stringify(x),{status:s,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store",...cors(o)}});
function parse(t:string){try{return JSON.parse(t)}catch{const a=t.indexOf("("),b=t.lastIndexOf(")");if(a<0||b<=a)throw new HttpError(401,"Session ไม่ถูกต้อง");return JSON.parse(t.slice(a+1,b));}}
async function actor(token:string){
 if(!token||token.length>4096)throw new HttpError(401,"กรุณาเข้าสู่ระบบใหม่");
 const u=new URL(AUTH_API);u.searchParams.set("action","bootstrap");u.searchParams.set("t",token);u.searchParams.set("callback","_iam_admin_auth");
 const r=await fetch(u,{cache:"no-store"});if(!r.ok)throw new HttpError(401,"Session หมดอายุ");
 const p=parse(await r.text()),me=(p.data||p).me;if(!me)throw new HttpError(401,"ไม่พบผู้ใช้");
 if(!["owner","admin"].includes(me.role))throw new HttpError(403,"เฉพาะ Owner / IT Admin เท่านั้น");
 return {name:String(me.name||me.code||me.role),role:String(me.role)};
}
const key=(v:string,max=60)=>/^[a-zA-Z0-9._:-]{2,120}$/.test(v)&&v.length<=max;
Deno.serve(async(req)=>{
 const origin=req.headers.get("origin")||"";
 if(origin&&!ORIGINS.has(origin))return reply({ok:false,error:"origin_not_allowed"},403,origin);
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors(origin)});
 try{
  if(!sql)throw new HttpError(503,"IAM API ยังไม่พร้อม");
  if(!["GET","POST"].includes(req.method))throw new HttpError(405,"Method not allowed");
  const who=await actor(req.headers.get("x-cms-session")||"");
  if(req.method==="GET"){
   const [applications,permissions,roles,rolePermissions,bindings,positions,outbox]=await Promise.all([
    sql`select * from public.iam_applications order by application_key`,
    sql`select p.*,a.application_key,a.display_name as application_name from public.iam_permissions p join public.iam_applications a on a.id=p.application_id order by a.application_key,p.permission_code`,
    sql`select * from public.iam_roles order by role_key`,
    sql`select rp.role_id,rp.permission_id,rp.constraints from public.iam_role_permissions rp`,
    sql`select b.*,p.position_code,p.name_th,r.role_key,r.display_name as role_name from public.iam_position_role_bindings b join public.hr_positions p on p.id=b.position_id join public.iam_roles r on r.id=b.role_id order by p.name_th,r.role_key`,
    sql`select id,position_code,name_th,status from public.hr_positions order by name_th`,
    sql`select status,count(*)::int as count from public.iam_sync_outbox group by status`
   ]);
   return reply({ok:true,applications,permissions,roles,rolePermissions,bindings,positions,outbox},200,origin);
  }
  const b=await req.json().catch(()=>({}));
  if(b.action==="save-application"){
   const application_key=String(b.application_key||"").trim().toLowerCase(),display_name=String(b.display_name||"").trim();
   if(!/^[a-z0-9_-]{2,60}$/.test(application_key)||!display_name)throw new HttpError(400,"Application Key หรือชื่อระบบไม่ถูกต้อง");
   const [row]=await sql`insert into public.iam_applications(application_key,display_name,status,owner_key) values(${application_key},${display_name},'draft',${who.name}) on conflict(application_key) do update set display_name=excluded.display_name,updated_at=now() returning *`;
   await audit(who.name,"iam.application.saved","application",row.id,row);return reply({ok:true,row},200,origin);
  }
  if(b.action==="save-permission"){
   const appKey=String(b.application_key||""),code=String(b.permission_code||""),resource=String(b.resource_key||""),action=String(b.action_key||"");
   if(!key(code)||!key(resource)||!key(action))throw new HttpError(400,"Permission Code / Resource / Action ไม่ถูกต้อง");
   const app=(await sql`select id from public.iam_applications where application_key=${appKey}`)[0];if(!app)throw new HttpError(404,"ไม่พบ Application");
   const [row]=await sql`insert into public.iam_permissions(application_id,permission_code,resource_key,action_key,description,risk_level,status) values(${app.id},${code},${resource},${action},${String(b.description||"")},${["normal","sensitive","critical"].includes(b.risk_level)?b.risk_level:"normal"},'draft') on conflict(application_id,permission_code) do update set resource_key=excluded.resource_key,action_key=excluded.action_key,description=excluded.description,risk_level=excluded.risk_level,updated_at=now() returning *`;
   await audit(who.name,"iam.permission.saved","permission",row.id,row);return reply({ok:true,row},200,origin);
  }
  if(b.action==="save-role"){
   const role_key=String(b.role_key||"").trim(),display_name=String(b.display_name||"").trim();
   if(!/^[A-Za-z0-9_-]{2,80}$/.test(role_key)||!display_name)throw new HttpError(400,"Role Key หรือชื่อ Role ไม่ถูกต้อง");
   const [row]=await sql`insert into public.iam_roles(role_key,display_name,description,status) values(${role_key},${display_name},${String(b.description||"")},'draft') on conflict(role_key) do update set display_name=excluded.display_name,description=excluded.description,version=iam_roles.version+1,updated_at=now() returning *`;
   await audit(who.name,"iam.role.saved","role",row.id,row);return reply({ok:true,row},200,origin);
  }
  if(b.action==="set-role-permissions"){
   const roleId=String(b.role_id||""),ids=Array.isArray(b.permission_ids)?[...new Set(b.permission_ids.map(String))]:[];
   if(!/^[0-9a-f-]{36}$/i.test(roleId)||ids.some(x=>!/^[0-9a-f-]{36}$/i.test(x)))throw new HttpError(400,"Role หรือ Permission ID ไม่ถูกต้อง");
   const row=await sql.begin(async tx=>{
    const role=(await tx`select * from public.iam_roles where id=${roleId}::uuid for update`)[0];if(!role)throw new HttpError(404,"ไม่พบ Role");
    const valid=await tx`select id from public.iam_permissions where id=any(${ids}::uuid[]) and status<>'inactive'`;
    if(valid.length!==ids.length)throw new HttpError(400,"มี Permission ที่ไม่พบหรือปิดใช้งาน");
    const before=await tx`select permission_id from public.iam_role_permissions where role_id=${roleId}::uuid`;
    await tx`delete from public.iam_role_permissions where role_id=${roleId}::uuid`;
    if(ids.length)await tx`insert into public.iam_role_permissions(role_id,permission_id) select ${roleId}::uuid,x from unnest(${ids}::uuid[]) x`;
    await tx`update public.iam_roles set version=version+1,updated_at=now() where id=${roleId}::uuid`;
    await tx`insert into public.iam_audit_log(actor_ref,action_key,target_type,target_id,before_state,after_state) values(${who.name},'iam.role_permissions.updated','role',${roleId},${sql.json(before)},${sql.json(ids)})`;
    return {role_id:roleId,permission_ids:ids};
   });
   return reply({ok:true,row},200,origin);
  }
  if(b.action==="bind-position-role"){
   const positionId=String(b.position_id||""),roleId=String(b.role_id||"");
   if(!/^[0-9a-f-]{36}$/i.test(positionId)||!/^[0-9a-f-]{36}$/i.test(roleId))throw new HttpError(400,"Position / Role ID ไม่ถูกต้อง");
   if(b.status==="active")throw new HttpError(409,"ยังเปิดใช้ Binding ไม่ได้: ต้องเชื่อมและทดสอบ Server-side Authorization ของระบบปลายทางก่อน");
   const scope=b.scope&&typeof b.scope==="object"?b.scope:{branch:"assigned"};
   const row=await sql.begin(async tx=>{
    const existing=(await tx`select * from public.iam_position_role_bindings where position_id=${positionId}::uuid and role_id=${roleId}::uuid and valid_from is null for update`)[0];
    if(existing)return (await tx`update public.iam_position_role_bindings set scope_template=${sql.json(scope)},status='draft',updated_by=${who.name},updated_at=now() where id=${existing.id} returning *`)[0];
    return (await tx`insert into public.iam_position_role_bindings(position_id,role_id,scope_template,status,created_by,updated_by) values(${positionId}::uuid,${roleId}::uuid,${sql.json(scope)},'draft',${who.name},${who.name}) returning *`)[0];
   });
   await audit(who.name,"iam.position_role_binding.draft","position_role_binding",row.id,row);return reply({ok:true,row},200,origin);
  }
  if(b.action==="retry-outbox"){
   const id=String(b.id||"");if(!/^[0-9a-f-]{36}$/i.test(id))throw new HttpError(400,"Outbox ID ไม่ถูกต้อง");
   const [row]=await sql`update public.iam_sync_outbox set status='pending',attempt_count=0,next_attempt_at=now(),last_error=null where id=${id}::uuid and status in ('failed','dead_letter') returning id,status`;
   if(!row)throw new HttpError(409,"รายการนี้ไม่อยู่ในสถานะที่ Retry ได้");
   await audit(who.name,"iam.outbox.retry","outbox",row.id,row);return reply({ok:true,row},200,origin);
  }
  throw new HttpError(400,"ไม่รู้จัก action");
 }catch(e){const code=(e as {code?:string})?.code;const status=e instanceof HttpError?e.status:code==="23505"?409:500;if(status===500)console.error("iam-admin-api",e);return reply({ok:false,error:status===409?"ข้อมูลซ้ำหรือชนกับรายการเดิม":e instanceof Error?e.message:"เกิดข้อผิดพลาด"},status,origin);}
});
async function audit(actor:string,action:string,target:string,id:string,state:unknown){
 if(!sql)throw new Error("IAM database connection unavailable");
 await sql`insert into public.iam_audit_log(actor_ref,action_key,target_type,target_id,after_state) values(${actor},${action},${target},${id},${sql.json(state)})`;
}
