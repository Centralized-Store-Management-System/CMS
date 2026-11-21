import postgres from "npm:postgres@3.4.5";
// อย่าตั้งชื่อตัวแปรว่า URL — จะทับคำสั่ง new URL() ของระบบ (เคยทำให้ฟังก์ชันตอบ 500 ทุกครั้ง)
const SUPABASE_URL=(Deno.env.get("SUPABASE_URL")||"").replace(/\/$/,"");
const DB=Deno.env.get("SUPABASE_DB_URL")||"";
const sql=DB?postgres(DB,{max:3,idle_timeout:10,connect_timeout:10}):null;
const ORIGINS=new Set(["https://centralized-store-management.github.io","https://centralized-store-management-system.github.io"]);
class HttpError extends Error{status:number;constructor(status:number,message:string){super(message);this.status=status;}}
const reply=(x:unknown,s=200,o="")=>new Response(JSON.stringify(x),{status:s,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store, private","vary":"Origin",...(o?{"access-control-allow-origin":o,"access-control-allow-headers":"content-type, x-cms-session","access-control-allow-methods":"GET, POST, OPTIONS"}:{})}});
function parse(t:string){try{return JSON.parse(t)}catch(_){const a=t.indexOf("("),b=t.lastIndexOf(")");if(a<0||b<=a)throw new HttpError(401,"Owner session ไม่ถูกต้อง");return JSON.parse(t.slice(a+1,b));}}
async function owner(token:string){if(!token||token.length>4096)throw new HttpError(401,"กรุณาเข้าสู่ระบบ Owner ใหม่");const u=new URL(SUPABASE_URL+"/functions/v1/backoffice");u.searchParams.set("action","bootstrap");u.searchParams.set("t",token);u.searchParams.set("callback","_it_ops_control_auth");u.searchParams.set("_",String(Date.now()));const r=await fetch(u,{cache:"no-store"});if(!r.ok)throw new HttpError(401,"Session หมดอายุ");const p=parse(await r.text()),b=p.data||p;if(!b.me||b.me.role!=="owner")throw new HttpError(403,"เฉพาะ Owner เท่านั้น");return String(b.me.username||b.me.code||"owner"); /* ไม่เก็บอีเมลลง audit */}
const arr=(v:any)=>typeof v==="string"?JSON.parse(v):v;
Deno.serve(async(req:Request)=>{
 const origin=req.headers.get("origin")||"";
 if(origin&&!ORIGINS.has(origin))return reply({ok:false,error:"origin_not_allowed"},403);
 if(req.method==="OPTIONS")return reply({ok:true},200,origin);
 try{
  if(!sql)throw new HttpError(503,"Database unavailable");
  const actor=await owner(req.headers.get("x-cms-session")||"");
  if(req.method==="GET"){
   const [alerts,plans,governance,tests,forecasts,anomalies]=await Promise.all([
    sql`select id,alert_key,source_type,source_id,severity,title,message,status,acknowledged_by,acknowledged_at,resolved_at,escalation_level,created_at from public.it_ops_alerts order by created_at desc limit 50`,
    sql`select id,incident_id,anomaly_event_id,plan_key,component,recovery_type,status,preflight,backup_evidence,rollback_plan,idempotency_key,requires_owner_approval,approved_by,approved_at,expires_at,created_at from public.it_ops_recovery_plans order by created_at desc limit 40`,
    sql`select control_key,enabled,config,updated_by,updated_at from public.it_ops_governance order by control_key`,
    sql`select id,suite_key,status,checks,duration_ms,executed_by,created_at from public.it_ops_integration_test_runs order by created_at desc limit 20`,
    sql`select id,metric_key,horizon_minutes,method,prediction,confidence,sample_count,created_at from public.it_ops_forecast_snapshots order by created_at desc limit 20`,
    sql`select id,anomaly_key,metric_key,severity,observed_value,baseline_value,deviation,sample_count,confidence,status,detected_at from public.it_ops_anomaly_events order by detected_at desc limit 30`
   ]);
   return reply({ok:true,mode:"owner_governed_observe_only",alerts,plans,governance,tests,forecasts,anomalies},200,origin);
  }
  if(req.method!=="POST")throw new HttpError(405,"Method not allowed");
  const b=await req.json().catch(()=>({})),type=String(b.type||"");
  if(type==="alert_status"){
   const id=Number(b.id),status=String(b.status||"");
   if(!Number.isSafeInteger(id)||id<1||!["acknowledged","resolved","open"].includes(status))throw new HttpError(400,"ข้อมูล Alert ไม่ถูกต้อง");
   const rows=await sql`update public.it_ops_alerts set status=${status},acknowledged_by=case when ${status}='acknowledged' then ${actor} else acknowledged_by end,acknowledged_at=case when ${status}='acknowledged' then now() else acknowledged_at end,resolved_at=case when ${status}='resolved' then now() else null end,updated_at=now() where id=${id} returning id,status`;
   if(!rows.length)throw new HttpError(404,"ไม่พบ Alert");
   await sql`insert into public.it_ops_audit(actor,event_type,entity_type,entity_id,details) values(${actor},'alert_status_changed','it_ops_alerts',${id},${JSON.stringify({status})}::jsonb)`;
   return reply({ok:true,item:rows[0]},200,origin);
  }
  if(type==="propose_recovery"){
   const incidentId=b.incidentId==null?null:Number(b.incidentId),anomalyId=b.anomalyEventId==null?null:Number(b.anomalyEventId);
   const component=String(b.component||"").slice(0,100),recovery=String(b.recoveryType||"");
   const allowed=["inspect","retry_candidate","restore_candidate","rollback_candidate","configuration_check"];
   if(!component||!allowed.includes(recovery))throw new HttpError(400,"Recovery plan ไม่ถูกต้อง");
   const key=String(b.planKey||"").slice(0,100)||"owner:"+recovery+":"+component.toLowerCase().replace(/[^a-z0-9_-]/g,"-");
   const idem="plan:"+key;
   const [row]=await sql`insert into public.it_ops_recovery_plans(incident_id,anomaly_event_id,plan_key,component,recovery_type,status,preflight,backup_evidence,rollback_plan,idempotency_key,requires_owner_approval,expires_at)
    values(${incidentId},${anomalyId},${key},${component},${recovery},'proposed',${JSON.stringify({ownerProposed:true,productionMutation:false,preflightRequired:true})}::jsonb,${JSON.stringify({verified:false,required:true})}::jsonb,${JSON.stringify({verified:false,required:true})}::jsonb,${idem},true,now()+interval '24 hours')
    on conflict(idempotency_key) do update set updated_at=now() returning id,plan_key,status,expires_at`;
   await sql`insert into public.it_ops_audit(actor,event_type,entity_type,entity_id,details) values(${actor},'recovery_plan_proposed','it_ops_recovery_plans',${row.id},${JSON.stringify({component,recoveryType:recovery})}::jsonb)`;
   return reply({ok:true,item:row,note:"เสนอแผนเท่านั้น ยังไม่มีการดำเนินการกับ Production"},200,origin);
  }
  if(type==="approve_recovery"){
   const id=Number(b.id);if(!Number.isSafeInteger(id)||id<1)throw new HttpError(400,"ID ไม่ถูกต้อง");
   const rows=await sql`update public.it_ops_recovery_plans set status='owner_approved',approved_by=${actor},approved_at=now(),updated_at=now() where id=${id} and status='proposed' and expires_at>now() and requires_owner_approval=true returning id,status,approved_by,approved_at`;
   if(!rows.length)throw new HttpError(409,"แผนไม่อยู่ในสถานะเสนออนุมัติหรือหมดอายุ");
   await sql`insert into public.it_ops_audit(actor,event_type,entity_type,entity_id,details) values(${actor},'recovery_plan_approved','it_ops_recovery_plans',${id},'{"execution":"disabled"}'::jsonb)`;
   return reply({ok:true,item:rows[0],note:"อนุมัติแผนแล้ว แต่ระบบไม่ execute remediation"},200,origin);
  }
  if(type==="record_test"){
   const suite=String(b.suiteKey||"").slice(0,80),status=String(b.status||"");
   if(!suite||!["passed","failed","blocked","partial"].includes(status))throw new HttpError(400,"ผลทดสอบไม่ถูกต้อง");
   const checks=Array.isArray(b.checks)?b.checks.slice(0,30):[];
   const [row]=await sql`insert into public.it_ops_integration_test_runs(suite_key,status,checks,duration_ms,executed_by) values(${suite},${status},${JSON.stringify(checks)}::jsonb, greatest(0,least(600000,coalesce(${Number(b.durationMs)||0},0))),${actor}) returning id,suite_key,status,created_at`;
   await sql`insert into public.it_ops_audit(actor,event_type,entity_type,entity_id,details) values(${actor},'integration_test_recorded','it_ops_integration_test_runs',${row.id},${JSON.stringify({suite,status})}::jsonb)`;
   return reply({ok:true,item:row},200,origin);
  }
  throw new HttpError(400,"ไม่รู้จักคำสั่ง");
 }catch(e){const s=e instanceof HttpError?e.status:500;if(!(e instanceof HttpError))console.error("it-ops-control-center",String(e).slice(0,300));return reply({ok:false,error:e instanceof HttpError?e.message:"IT Ops Control Center error"},s,origin);}
});