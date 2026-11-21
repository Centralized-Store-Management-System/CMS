import postgres from "npm:postgres@3.4.5";
const DB_URL=Deno.env.get("SUPABASE_DB_URL")||"";
const API=(Deno.env.get("SUPABASE_URL")||"").replace(/\/$/,"")+"/functions/v1/backoffice";
const sql=DB_URL?postgres(DB_URL,{max:4,idle_timeout:10,connect_timeout:10}):null;
const ORIGINS=new Set(["https://centralized-store-management.github.io","https://centralized-store-management-system.github.io"]);
class HttpError extends Error{status:number;constructor(status:number,message:string){super(message);this.status=status;}}
const cors=(o:string)=>o?{"access-control-allow-origin":o,"access-control-allow-headers":"content-type,x-cms-session","access-control-allow-methods":"GET,POST,OPTIONS","vary":"Origin"}:{};
const reply=(x:unknown,s=200,o="")=>new Response(JSON.stringify(x),{status:s,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store",...cors(o)}});
function parse(t:string){try{return JSON.parse(t)}catch{const a=t.indexOf("("),b=t.lastIndexOf(")");if(a<0||b<=a)throw new HttpError(401,"Session ไม่ถูกต้อง");return JSON.parse(t.slice(a+1,b));}}
async function actor(token:string){if(!token||token.length>4096)throw new HttpError(401,"กรุณาเข้าสู่ระบบใหม่");const u=new URL(API);u.searchParams.set("action","bootstrap");u.searchParams.set("t",token);u.searchParams.set("callback","_hr_position_auth");const r=await fetch(u,{cache:"no-store"});if(!r.ok)throw new HttpError(401,"Session หมดอายุ");const p=parse(await r.text()),me=(p.data||p).me;if(!me)throw new HttpError(401,"ไม่พบผู้ใช้");if(!["owner","hr","admin"].includes(me.role))throw new HttpError(403,"ไม่มีสิทธิ์ HR");return {name:String(me.name||me.code||me.role),role:String(me.role)};}
Deno.serve(async(req)=>{
 const origin=req.headers.get("origin")||"";
 if(origin&&!ORIGINS.has(origin))return reply({ok:false,error:"origin_not_allowed"},403,origin);
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors(origin)});
 try{
  if(!sql)throw new HttpError(503,"Position API ยังไม่พร้อม");
  if(!["GET","POST"].includes(req.method))throw new HttpError(405,"Method not allowed");
  const who=await actor(req.headers.get("x-cms-session")||"");
  if(req.method==="GET"){
   const positions=await sql`select * from public.hr_positions order by status desc,name_th`;
   const permissions=await sql`select p.position_id,p.application_key,p.permission_codes,p.branch_scope,p.status,p.version from public.it_position_permissions p`;
   return reply({ok:true,positions,permissions},200,origin);
  }
  const b=await req.json().catch(()=>({}));
  if(b.action==="save-position"){
   if(who.role!=="owner"&&who.role!=="hr"&&who.role!=="admin")throw new HttpError(403,"ไม่มีสิทธิ์จัดการตำแหน่ง");
   const name=String(b.name_th||"").trim(),code=String(b.position_code||"").trim().toUpperCase();
   if(!name||!/^[A-Z0-9_-]{2,24}$/.test(code))throw new HttpError(400,"กรุณาระบุชื่อตำแหน่งและรหัสตำแหน่งให้ถูกต้อง");
   const id=b.id?String(b.id):null;
   const saved=await sql.begin(async tx=>{
    const old=id?(await tx`select * from public.hr_positions where id=${id}::uuid for update`)[0]:null;
    if(id&&!old)throw new HttpError(404,"ไม่พบตำแหน่ง");
    const [row]=id?await tx`update public.hr_positions set position_code=${code},name_th=${name},name_en=${String(b.name_en||"")},department=${String(b.department||"")},level=${String(b.level||"")},description=${String(b.description||"")},status=${b.status==="inactive"?"inactive":"active"},updated_by=${who.name},updated_at=now() where id=${id}::uuid returning *`:await tx`insert into public.hr_positions(position_code,name_th,name_en,department,level,description,created_by,updated_by) values(${code},${name},${String(b.name_en||"")},${String(b.department||"")},${String(b.level||"")},${String(b.description||"")},${who.name},${who.name}) returning *`;
    await tx`insert into public.hr_position_audit(position_id,action,before_state,after_state,actor) values(${row.id},${id?"update":"create"},${old?sql.json(old):null},${sql.json(row)},${who.name})`;
    return row;
   });
   return reply({ok:true,position:saved},200,origin);
  }
  if(b.action==="set-permissions"){
   if(who.role!=="owner"&&who.role!=="admin")throw new HttpError(403,"เฉพาะ Owner / IT Admin กำหนดสิทธิ์ได้");
   const positionId=String(b.position_id||"");if(!/^[0-9a-f-]{36}$/i.test(positionId))throw new HttpError(400,"position_id ไม่ถูกต้อง");
   const app=String(b.application_key||"");if(!/^[a-z0-9_-]{2,40}$/.test(app))throw new HttpError(400,"application_key ไม่ถูกต้อง");
   const codes=Array.isArray(b.permission_codes)?[...new Set(b.permission_codes.map((x:unknown)=>String(x)).filter((x:string)=>/^[a-z0-9._:-]{2,100}$/.test(x)))]:[];
   const status=b.status==="active"?"active":"draft";
   const [row]=await sql`insert into public.it_position_permissions(position_id,application_key,permission_codes,branch_scope,status,updated_by) values(${positionId}::uuid,${app},${codes},${b.branch_scope==="all"?"all":"assigned"},${status},${who.name}) on conflict(position_id,application_key) do update set permission_codes=excluded.permission_codes,branch_scope=excluded.branch_scope,status=excluded.status,version=it_position_permissions.version+1,updated_by=excluded.updated_by,updated_at=now() returning *`;
   await sql`insert into public.hr_position_audit(position_id,action,after_state,actor) values(${positionId}::uuid,'permission_mapping_update',${sql.json(row)},${who.name})`;
   return reply({ok:true,permission:row},200,origin);
  }
  throw new HttpError(400,"ไม่รู้จัก action");
 }catch(e){const s=e instanceof HttpError?e.status:500;if(s===500)console.error("hr-position-api",e);return reply({ok:false,error:e instanceof Error?e.message:"เกิดข้อผิดพลาด"},s,origin);}
});
