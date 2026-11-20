import postgres from "npm:postgres@3.4.5";
const SUPABASE_URL=(Deno.env.get("SUPABASE_URL")||"").replace(/\/$/,"");
const DB_URL=Deno.env.get("SUPABASE_DB_URL")||"";
const sql=DB_URL?postgres(DB_URL,{max:2,idle_timeout:10,connect_timeout:10}):null;
const BACKOFFICE_URL=SUPABASE_URL+"/functions/v1/backoffice";
const ALLOWED_ORIGINS=new Set(["https://centralized-store-management.github.io","https://centralized-store-management-system.github.io"]);
class HttpError extends Error { status:number; constructor(status:number,message:string){super(message);this.status=status;} }
function out(body:unknown,status=200,origin=""){return new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store, private","vary":"Origin",...(origin?{"access-control-allow-origin":origin,"access-control-allow-headers":"content-type, x-cms-session","access-control-allow-methods":"GET, POST, OPTIONS","access-control-max-age":"600"}:{})}});}
function parseJsonp(t:string){try{return JSON.parse(t)}catch(_){} const a=t.indexOf("("),b=t.lastIndexOf(")");if(a<0||b<=a)throw new HttpError(401,"Owner session ไม่ถูกต้อง");try{return JSON.parse(t.slice(a+1,b))}catch(_){throw new HttpError(401,"Owner session ไม่ถูกต้อง")}}
async function owner(token:string){if(!token||token.length>4096)throw new HttpError(401,"กรุณาเข้าสู่ระบบ Owner ใหม่");const u=new URL(BACKOFFICE_URL);u.searchParams.set("action","bootstrap");u.searchParams.set("t",token);u.searchParams.set("callback","_it_ops_orchestrator_auth");u.searchParams.set("_",String(Date.now()));const r=await fetch(u,{cache:"no-store"});if(!r.ok)throw new HttpError(401,"Session หมดอายุ");const p=parseJsonp(await r.text()),b=p.data||p;if(!b.me||b.me.role!=="owner")throw new HttpError(403,"เฉพาะ Owner เท่านั้น");return String(b.me.email||b.me.username||"owner");}
const SAFE_ACTIONS:Record<string,{title:string,risk:"low"|"medium",why:string}>={
 CRON_DISABLED:{title:"ตรวจสอบและกู้คืน Backoffice Cron",risk:"medium",why:"ต้องตรวจ job history และปลายทางก่อนเปิด Cron"},
 CRON_STALE:{title:"ตรวจสอบ Backoffice heartbeat",risk:"medium",why:"ตรวจ pg_cron และ Edge Function logs ก่อน restart"},
 CRON_LAST_FAILED:{title:"ตรวจสอบ Cron รอบล่าสุด",risk:"low",why:"เป็นงานตรวจสอบแบบไม่เปลี่ยนข้อมูล"},
 CRON_FAILURES:{title:"วิเคราะห์ Cron failures 24 ชั่วโมง",risk:"low",why:"รวบรวม log และหาสาเหตุ ไม่สั่ง retry อัตโนมัติ"},
 SUPA_HEARTBEAT_STALE:{title:"ตรวจสอบ Supabase heartbeat",risk:"low",why:"ตรวจสุขภาพและ log โดยไม่แก้ config"},
 ORDER_HEARTBEAT_STALE:{title:"ตรวจสอบ Order heartbeat",risk:"low",why:"ตรวจ orderTick และ sync status แบบ read-only"},
 OUTBOX_ERRORS:{title:"ตรวจสอบ Outbox errors",risk:"medium",why:"ตรวจ payload และ retry policy ก่อน resend"},
 ORDER_SYNC_ERRORS:{title:"วิเคราะห์ Order sync errors",risk:"medium",why:"ตรวจ sync error ก่อนเริ่ม sync ใหม่"},
 ORDER_SSO_FAILURES:{title:"ตรวจสอบ Order SSO failures",risk:"low",why:"ตรวจ authentication logs และสิทธิ์โดยไม่เปลี่ยนสิทธิ์"},
 STALE_ORDERS:{title:"ตรวจสอบออเดอร์ค้าง",risk:"low",why:"ตรวจสถานะและ timeline ไม่แก้สถานะออเดอร์"}
};

const DRY_RUN_ALLOWLIST = new Set([
 "inspect_outbox_errors","inspect_cron_disabled","inspect_cron_stale",
 "inspect_cron_last_failed","inspect_cron_failures","inspect_supa_heartbeat",
 "inspect_order_heartbeat","inspect_order_sync_errors","inspect_order_sso_failures"
]);
async function simulateApprovedAction(id:number,actor:string){
 const [item]=await sql`select q.id,q.incident_id,q.action_code,q.status,q.expires_at,i.code as incident_code
  from public.it_ops_action_queue q left join public.it_ops_incidents i on i.id=q.incident_id
  where q.id=${id} limit 1`;
 if(!item)throw new HttpError(404,"ไม่พบรายการ");
 if(item.status!=="approved")throw new HttpError(409,"ต้องอนุมัติรายการก่อนจึงจำลองได้");
 if(new Date(item.expires_at).getTime()<=Date.now())throw new HttpError(409,"รายการอนุมัติหมดอายุแล้ว");
 if(!DRY_RUN_ALLOWLIST.has(item.action_code))throw new HttpError(403,"Action นี้ยังไม่อยู่ใน Dry-run Allowlist");
 const [recent]=await sql`select id,created_at from public.it_ops_action_runs where action_queue_id=${id} and created_at>now()-interval '30 minutes' order by created_at desc limit 1`;
 if(recent)throw new HttpError(429,"รายการนี้อยู่ในช่วง Cooldown 30 นาที");
 let simulation:Record<string,unknown>={};
 if(item.action_code==="inspect_outbox_errors"){
  const [counts]=await sql`select count(*)::int as total_24h,count(*) filter(where kind='mail')::int as mail_24h,count(*) filter(where kind<>'mail')::int as other_24h from backoffice.outbox_errors where at>=now()-interval '24 hours'`;
  const groups=await sql`select kind,count(*)::int as count from backoffice.outbox_errors where at>=now()-interval '24 hours' group by kind order by count desc`;
  simulation={description:"ตรวจเฉพาะจำนวน Outbox errors แบบ aggregate; ไม่อ่านผู้รับหรือเนื้อหาข้อความ",counts,groups};
 } else if(["inspect_cron_disabled","inspect_cron_stale","inspect_cron_last_failed","inspect_cron_failures"].includes(item.action_code)){
  const jobs=await sql`select jobname,active,schedule from cron.job where jobname in ('backoffice-tick','it-monitor-every-5-minutes','it-ops-orchestrator-every-5-minutes') order by jobname`;
  const failures=await sql`select jobid,count(*)::int as failures,max(start_time) as latest_failure from cron.job_run_details where start_time>=now()-interval '24 hours' and status<>'succeeded' group by jobid order by failures desc`;
  const last=await sql`select jobid,status,start_time,return_message from cron.job_run_details where start_time>=now()-interval '24 hours' order by start_time desc limit 10`;
  simulation={description:"ตรวจสถานะ Cron และประวัติการรันแบบอ่านอย่างเดียว",jobs,failures,lastRuns:last};
 } else {
  const [latest]=await sql`select id,checked_at,status,risk_score,metrics from public.it_monitor_runs order by checked_at desc limit 1`;
  const metrics=latest?.metrics||{};
  const map:Record<string,string>={inspect_supa_heartbeat:"supaHeartbeatAgeMinutes",inspect_order_heartbeat:"orderHeartbeatAgeMinutes",inspect_order_sync_errors:"orderSyncErrors",inspect_order_sso_failures:"orderSsoFailures24h"};
  simulation={description:"ใช้เฉพาะตัวชี้วัดสรุปจาก IT Monitor ล่าสุด ไม่อ่านข้อมูลลูกค้าหรือข้อมูลพนักงาน",monitorRunId:latest?.id??null,checkedAt:latest?.checked_at??null,monitorStatus:latest?.status??"unknown",riskScore:latest?.risk_score??null,metric:map[item.action_code]||"unknown",value:metrics[map[item.action_code]]??null};
 }
 const preflight={ownerAuthenticated:true,approved:item.status==="approved",notExpired:true,allowlisted:true,cooldownPassed:true,readOnly:true,productionMutation:false};
 const rollback={required:false,readiness:"not_applicable",reason:"Dry-run ไม่มีการเปลี่ยนแปลง Production จึงไม่มี state ให้ rollback",futureGate:"ก่อนเปิด remediation จริงต้องมี snapshot/backup, rollback command ที่ทดสอบแล้ว และ post-check"};
 const idempotencyKey="dryrun:"+id+":"+new Date().toISOString().slice(0,16);
 const [saved]=await sql`insert into public.it_ops_action_runs(action_queue_id,incident_id,mode,action_code,status,executed_by,idempotency_key,preflight,simulation,rollback_check)
  values(${id},${item.incident_id},'dry_run',${item.action_code},'passed',${actor},${idempotencyKey},${JSON.stringify(preflight)}::jsonb,${JSON.stringify(simulation)}::jsonb,${JSON.stringify(rollback)}::jsonb)
  returning id,created_at,status,action_code`;
 await sql`insert into public.it_ops_audit(actor,event_type,entity_type,entity_id,details)
  values(${actor},'dry_run_completed','action_queue',${id},${JSON.stringify({actionRunId:saved.id,actionCode:item.action_code,mode:"dry_run",productionMutation:false})}::jsonb)`;
 return {run:saved,preflight,simulation,rollback,mode:"dry_run"};
}

async function runCycle(){
 if(!sql)throw new HttpError(503,"Database connection ไม่พร้อม");
 const [run]=await sql`select id,checked_at,risk_score,status,findings,metrics from public.it_monitor_runs order by checked_at desc limit 1`;
 if(!run)throw new HttpError(409,"ยังไม่มีผลตรวจจาก IT Monitor");
 const findings=Array.isArray(run.findings)?run.findings:[];
 let upserts=0,proposals=0;
 for(const f of findings){
  const code=String(f.code||"UNKNOWN").slice(0,60); if(code==="ALL_CLEAR") continue; const level=["critical","warning","info"].includes(f.level)?f.level:"info";
  const title=String(f.title||code).slice(0,160),detail=String(f.detail||"").slice(0,500),recommendation=String(f.action||"").slice(0,300),fingerprint=code.toLowerCase();
  const [incident]=await sql`insert into public.it_ops_incidents(fingerprint,severity,code,title,detail,recommendation,source_monitor_run_id,evidence)
   values(${fingerprint},${level},${code},${title},${detail},${recommendation},${run.id},${JSON.stringify({riskScore:run.risk_score,monitorStatus:run.status,checkedAt:run.checked_at})}::jsonb)
   on conflict(fingerprint) do update set severity=excluded.severity,title=excluded.title,detail=excluded.detail,recommendation=excluded.recommendation,last_seen_at=case when public.it_ops_incidents.source_monitor_run_id is distinct from excluded.source_monitor_run_id then now() else public.it_ops_incidents.last_seen_at end,occurrence_count=public.it_ops_incidents.occurrence_count+case when public.it_ops_incidents.source_monitor_run_id is distinct from excluded.source_monitor_run_id then 1 else 0 end,status=case when public.it_ops_incidents.status='muted' then 'muted' when public.it_ops_incidents.source_monitor_run_id is distinct from excluded.source_monitor_run_id then 'open' else public.it_ops_incidents.status end,source_monitor_run_id=excluded.source_monitor_run_id,evidence=excluded.evidence,updated_at=now()
   returning id,fingerprint,status`;
  upserts++;
  const safe=SAFE_ACTIONS[code];
  if(safe && incident.status!=="muted" && incident.status!=="resolved"){
   const idem=code.toLowerCase()+":"+String(run.id);
   const [q]=await sql`insert into public.it_ops_action_queue(incident_id,action_code,title,rationale,risk_level,status,requires_owner_approval,proposed_by,idempotency_key)
    values(${incident.id},${"inspect_"+code.toLowerCase()},${safe.title},${safe.why},${safe.risk},'pending_approval',true,'system',${idem})
    on conflict(idempotency_key) do nothing returning id`;
   if(q)proposals++;
  }
 }
 await sql`update public.it_ops_incidents set status='resolved',updated_at=now() where status in ('open','acknowledged') and last_seen_at < ${run.checked_at} - interval '15 minutes'`;
 await sql`insert into public.it_ops_audit(actor,event_type,entity_type,details) values('system','monitor_triaged','monitor_run',${JSON.stringify({runId:run.id,findings:findings.length,incidentsUpserted:upserts,proposalsCreated:proposals,mode:'observe_only'})}::jsonb)`;
 return {monitorRunId:run.id,findings:findings.length,incidentsUpserted:upserts,proposalsCreated:proposals,mode:"observe_only"};
}
Deno.serve(async(req:Request)=>{
 const origin=req.headers.get("origin")||"";
 if(origin&&!ALLOWED_ORIGINS.has(origin))return out({ok:false,error:"origin_not_allowed"},403);
 if(req.method==="OPTIONS")return out({ok:true},200,origin);
 try{
  if(!sql)throw new HttpError(503,"Database connection ไม่พร้อม");
  if(req.method==="POST"){
   const body=await req.json().catch(()=>({}));
   if(new URL(req.url).searchParams.get("__cron")==="1"){
    const [k]=await sql`select v from backoffice.kv where ns='props' and k='CRON_KEY'`;
    if(!k?.v||body.k!==k.v)throw new HttpError(403,"Invalid scheduler key");
    return out({ok:true,result:await runCycle()},200,origin);
   }
   const actor=await owner(req.headers.get("x-cms-session")||"");
   if(new URL(req.url).searchParams.get("dry_run")==="1"){
    const id=Number(body.id); if(!Number.isSafeInteger(id)||id<=0)throw new HttpError(400,"รหัสรายการไม่ถูกต้อง");
    return out({ok:true,result:await simulateApprovedAction(id,actor)},200,origin);
   }
   const id=Number(body.id),decision=String(body.decision||"");
   if(!Number.isSafeInteger(id)||id<=0||!["approve","reject"].includes(decision))throw new HttpError(400,"คำขอไม่ถูกต้อง");
   const next=decision==="approve"?"approved":"rejected";
   const rows=await sql`update public.it_ops_action_queue set status=${next},reviewed_by=${actor},reviewed_at=now() where id=${id} and status='pending_approval' and expires_at>now() returning id,action_code,status`;
   if(!rows.length)throw new HttpError(409,"รายการนี้ถูกดำเนินการแล้วหรือหมดอายุ");
   await sql`insert into public.it_ops_audit(actor,event_type,entity_type,entity_id,details) values(${actor},${"approval_"+decision},'action_queue',${id},${JSON.stringify({actionCode:rows[0].action_code,note:"อนุมัติสำหรับแผนปฏิบัติงานโดยคนเท่านั้น; ไม่มีการรัน action อัตโนมัติ"})}::jsonb)`;
   return out({ok:true,item:rows[0],message:decision==="approve"?"อนุมัติแผนสำหรับดำเนินการโดยผู้ดูแลแล้ว (ยังไม่มีการรันคำสั่ง)":"ปฏิเสธรายการแล้ว"},200,origin);
  }
  if(req.method==="GET"){
   await owner(req.headers.get("x-cms-session")||"");
   const [incidents,queue,audit,actionRuns]=await Promise.all([
    sql`select id,fingerprint,severity,code,title,detail,recommendation,status,first_seen_at,last_seen_at,occurrence_count from public.it_ops_incidents order by case severity when 'critical' then 0 when 'warning' then 1 else 2 end,last_seen_at desc limit 40`,
    sql`select q.id,q.incident_id,q.action_code,q.title,q.rationale,q.risk_level,q.status,q.requires_owner_approval,q.created_at,q.expires_at,i.code as incident_code from public.it_ops_action_queue q left join public.it_ops_incidents i on i.id=q.incident_id order by q.created_at desc limit 40`,
    sql`select id,actor,event_type,entity_type,entity_id,details,created_at from public.it_ops_audit order by created_at desc limit 30`,
    sql`select id,action_queue_id,action_code,status,executed_by,preflight,simulation,rollback_check,created_at from public.it_ops_action_runs order by created_at desc limit 20`
   ]);
   return out({ok:true,mode:"dry_run_only",incidents,queue,audit,actionRuns},200,origin);
  }
  throw new HttpError(405,"Method not allowed");
 }catch(e){const status=e instanceof HttpError?e.status:500;if(!(e instanceof HttpError))console.error("it-ops-orchestrator",String(e).slice(0,240));return out({ok:false,error:e instanceof HttpError?e.message:"IT Ops Orchestrator error"},status,origin);}
});
