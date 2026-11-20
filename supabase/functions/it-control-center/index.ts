// IT Control Center (Owner only) — ตั้งค่า Theme / Policy แยกตามระบบ × ผู้ใช้ × อุปกรณ์ × ช่องทาง
// v2: GET ?public=1 (ไม่ต้องเข้าระบบ) คืนเฉพาะค่า Theme ที่หน้าเว็บต้องใช้ (js/app-scope.js) · บันทึก theme_package ได้
import postgres from "npm:postgres@3.4.5";

const SUPABASE_URL=(Deno.env.get("SUPABASE_URL")||"").replace(/\/$/,"");
const DB_URL=Deno.env.get("SUPABASE_DB_URL")||"";
const sql=DB_URL?postgres(DB_URL,{max:3,idle_timeout:10,connect_timeout:10}):null;
const BACKOFFICE_URL=SUPABASE_URL+"/functions/v1/backoffice";
const ORIGINS=new Set(["https://centralized-store-management.github.io","https://centralized-store-management-system.github.io"]);
const PACKAGES=new Set(["classic","prototype","owner"]);
class HttpError extends Error{status:number;constructor(status:number,message:string){super(message);this.status=status;}}
const cors=(origin:string)=>origin?{"access-control-allow-origin":origin,"access-control-allow-headers":"content-type, x-cms-session","access-control-allow-methods":"GET, POST, OPTIONS","access-control-max-age":"600"}:{};
const reply=(body:unknown,status=200,origin="",cache="no-store, private")=>new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":cache,"vary":"Origin",...cors(origin)}});
function parseJsonp(text:string){const t=text.trim();try{return JSON.parse(t);}catch(_){}const a=t.indexOf("("),b=t.lastIndexOf(")");if(a<0||b<=a)throw new HttpError(401,"ยืนยันบัญชี Owner ไม่สำเร็จ");try{return JSON.parse(t.slice(a+1,b));}catch(_){throw new HttpError(401,"ยืนยันบัญชี Owner ไม่สำเร็จ");}}
async function requireOwner(token:string){if(!token||token.length>4096)throw new HttpError(401,"กรุณาเข้าสู่ระบบ Owner ใหม่");const u=new URL(BACKOFFICE_URL);u.searchParams.set("action","bootstrap");u.searchParams.set("t",token);u.searchParams.set("callback","_it_control_auth");u.searchParams.set("_",String(Date.now()));const r=await fetch(u,{cache:"no-store"});if(!r.ok)throw new HttpError(401,"Session หมดอายุ กรุณาเข้าสู่ระบบ Owner ใหม่");const p=parseJsonp(await r.text());const boot=p.data||p;if(!boot.me||boot.me.role!=="owner")throw new HttpError(403,"เฉพาะ Owner เท่านั้น");return String(boot.me.name||boot.me.code||"owner");}
const SAFE_PROFILE_KEYS=new Set(["login","mfa","session","notes","rollout"]);
const COLS=["scope_key","app_key","app_label","user_class","surface","device_class","theme_enabled","theme_package","theme_version","rollout_locked","auth_profile","auth_enforcement_enabled","updated_by","updated_at","version"];
Deno.serve(async(req:Request)=>{
 const origin=req.headers.get("origin")||"";
 if(origin&&!ORIGINS.has(origin))return reply({ok:false,error:"origin_not_allowed"},403);
 if(req.method==="OPTIONS")return new Response("ok",{headers:{...cors(origin),"vary":"Origin"}});
 try{
  if(!sql||!SUPABASE_URL)throw new HttpError(503,"IT Control Center ยังไม่พร้อม");
  if(req.method!=="GET"&&req.method!=="POST")throw new HttpError(405,"Method not allowed");
  const url=new URL(req.url);
  if(req.method==="GET"&&url.searchParams.get("public")==="1"){
   // ค่าที่หน้าเว็บทุกคนต้องรู้เพื่อเลือก Theme (ไม่มีข้อมูลลับ / ไม่มี policy การเข้าระบบ)
   const rows=await sql`select scope_key,app_key,surface,device_class,theme_enabled,theme_package,theme_version,version from public.it_control_settings order by app_key,scope_key`;
   return reply({ok:true,rows},200,origin,"public, max-age=60");
  }
  const actor=await requireOwner(req.headers.get("x-cms-session")||"");
  if(req.method==="GET"){
   const rows=await sql`select ${sql(COLS)} from public.it_control_settings order by app_key, user_class, surface, device_class`;
   const audit=await sql`select scope_key,action,actor,created_at,after_state from public.it_control_audit order by created_at desc limit 30`;
   return reply({ok:true,rows,audit},200,origin);
  }
  const body=await req.json().catch(()=>({}));
  const key=String(body.scopeKey||"");
  if(!/^[a-z0-9_-]{1,80}$/.test(key))throw new HttpError(400,"scopeKey ไม่ถูกต้อง");
  const [before]=await sql`select * from public.it_control_settings where scope_key=${key}`;
  if(!before)throw new HttpError(404,"ไม่พบขอบเขตระบบ");
  const input=body.changes||{};
  const changes:Record<string,unknown>={};
  if(typeof input.theme_enabled==="boolean")changes.theme_enabled=input.theme_enabled;
  if(typeof input.rollout_locked==="boolean")changes.rollout_locked=input.rollout_locked;
  if(typeof input.theme_version==="string"&&/^[a-zA-Z0-9._-]{1,24}$/.test(input.theme_version))changes.theme_version=input.theme_version;
  if(typeof input.theme_package==="string"){if(!PACKAGES.has(input.theme_package))throw new HttpError(400,"ไม่รู้จัก Theme นี้");changes.theme_package=input.theme_package;}
  if(input.auth_profile&&typeof input.auth_profile==="object"&&!Array.isArray(input.auth_profile)){
   const profile:Record<string,string>={};
   for(const [k,v] of Object.entries(input.auth_profile)){if(SAFE_PROFILE_KEYS.has(k)&&typeof v==="string")profile[k]=v.slice(0,300);}
   changes.auth_profile=profile;
  }
  if(!Object.keys(changes).length)throw new HttpError(400,"ไม่มีค่าที่อนุญาตให้บันทึก");
  // ล็อกอยู่: เปลี่ยน Theme ไม่ได้ (ปลดล็อกก่อน) — กันเผลอกระทบระบบอื่น
  const themeChange=("theme_enabled" in changes)||("theme_package" in changes)||("theme_version" in changes);
  const willLock=typeof changes.rollout_locked==="boolean"?changes.rollout_locked:before.rollout_locked;
  if(themeChange&&willLock)throw new HttpError(409,"Scope นี้ล็อกอยู่ ปลดล็อกก่อนเปลี่ยน Theme");
  const [after]=await sql.begin(async(tx)=>{
   await tx`select pg_advisory_xact_lock(hashtext(${key}))`;
   const [current]=await tx`select * from public.it_control_settings where scope_key=${key} for update`;
   if(!current)throw new HttpError(404,"ไม่พบขอบเขตระบบ");
   const next={...current,...changes};
   const [saved]=await tx`update public.it_control_settings set
     theme_enabled=${Boolean(next.theme_enabled)}, theme_package=${String(next.theme_package)}, theme_version=${String(next.theme_version)},
     rollout_locked=${Boolean(next.rollout_locked)}, auth_profile=${sql.json(next.auth_profile||{})},
     updated_by=${actor},updated_at=now(),version=version+1
     where scope_key=${key} returning ${sql(COLS)}`;
   await tx`insert into public.it_control_audit(scope_key,action,before_state,after_state,actor)
     values(${key},'settings_update',${sql.json(before)},${sql.json(saved)},${actor})`;
   return [saved];
  });
  return reply({ok:true,row:after,notice:"บันทึกแล้ว · เครื่องที่อยู่ใน Scope นี้จะเปลี่ยนภายใน 1–2 นาที (เปิดหน้าใหม่)"},200,origin);
 }catch(e){const status=e instanceof HttpError?e.status:500;const message=e instanceof HttpError?e.message:"IT Control Center เกิดข้อผิดพลาด";if(!(e instanceof HttpError))console.error("it-control-center",e);return reply({ok:false,error:message},status,origin);}
});
