import postgres from "npm:postgres@3.4.5";
const SUPABASE_URL=(Deno.env.get("SUPABASE_URL")||"").replace(/\/$/,"");
const DB_URL=Deno.env.get("SUPABASE_DB_URL")||"";
const sql=DB_URL?postgres(DB_URL,{max:2,idle_timeout:10,connect_timeout:10}):null;
const BACKOFFICE_URL=SUPABASE_URL+"/functions/v1/backoffice";
const ALLOWED_ORIGINS=new Set(["https://centralized-store-management.github.io","https://centralized-store-management-system.github.io"]);
class HttpError extends Error { status:number; constructor(status:number,message:string){super(message);this.status=status;} }
function out(body:unknown,status=200,origin=""){return new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store, private","vary":"Origin",...(origin?{"access-control-allow-origin":origin,"access-control-allow-headers":"content-type, x-cms-session","access-control-allow-methods":"GET, POST, OPTIONS","access-control-max-age":"600"}:{})}});}
function asJson(value:unknown,fallback:any){if(typeof value==="string"){try{return JSON.parse(value)}catch(_){return fallback}}return value??fallback;}
function parseJsonp(t:string){try{return JSON.parse(t)}catch(_){} const a=t.indexOf("("),b=t.lastIndexOf(")");if(a<0||b<=a)throw new HttpError(401,"Owner session ไม่ถูกต้อง");try{return JSON.parse(t.slice(a+1,b))}catch(_){throw new HttpError(401,"Owner session ไม่ถูกต้อง")}}
async function owner(token:string){if(!token||token.length>4096)throw new HttpError(401,"กรุณาเข้าสู่ระบบ Owner ใหม่");const u=new URL(BACKOFFICE_URL);u.searchParams.set("action","bootstrap");u.searchParams.set("t",token);u.searchParams.set("callback","_it_ops_orchestrator_auth");u.searchParams.set("_",String(Date.now()));const r=await fetch(u,{cache:"no-store"});if(!r.ok)throw new HttpError(401,"Session หมดอายุ");const p=parseJsonp(await r.text()),b=p.data||p;if(!b.me||b.me.role!=="owner")throw new HttpError(403,"เฉพาะ Owner เท่านั้น");return String(b.me.username||b.me.code||"owner"); /* ไม่เก็บอีเมลลง audit */}
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
  const metrics=asJson(latest?.metrics,{});
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


function metricValue(m:Record<string,any>,key:string){const n=Number(m?.[key]);return Number.isFinite(n)?n:null;}
function buildDiagnosis(findings:any[],metrics:Record<string,any>,history:any[]){
 const causes:any[]=[];
 const codes=new Set(findings.map(x=>String(x.code||"")));
 const add=(code:string,title:string,evidence:string[],next:string,confidence:"high"|"medium"|"low")=>causes.push({code,title,evidence,next,confidence});
 if(codes.has("OUTBOX_ERRORS")){
  const n=metricValue(metrics,"outboxErrors24h");
  add("OUTBOX_ERRORS","ความผิดพลาดเกิดใน Outbox / ช่องทางส่งข้อความ",["พบ Outbox errors "+(n??"ไม่ทราบ")+" รายการใน 24 ชั่วโมง","ยังไม่มีหลักฐานยืนยันว่าเป็นปัญหาผู้ให้บริการหรือการตั้งค่า SMTP"],"ตรวจ error category และ provider response แบบปกปิดข้อมูลผู้รับ ก่อนแก้ credential หรือ retry",n!==null&&n>0?"medium":"low");
 }
 if(codes.has("MAIL_NOT_CONFIGURED"))add("MAIL_NOT_CONFIGURED","การตั้งค่าอีเมลยังไม่ครบ",["Monitor ระบุว่า mail=false / ไม่พบ Resend configuration"],"ยืนยันผู้ให้บริการ, MAIL_FROM และ secret ใน Supabase ก่อนเปิดใช้งาน; อย่าส่งทดสอบไปยังลูกค้าจริง","high");
 if(codes.has("CRON_DISABLED")||codes.has("CRON_STALE")||codes.has("CRON_LAST_FAILED")||codes.has("CRON_FAILURES"))add("CRON_HEALTH","งานเบื้องหลังมีความเสี่ยงจาก scheduler หรือปลายทาง",["พบ Cron finding: "+[...codes].filter(x=>x.startsWith("CRON_")).join(", ")],"เทียบ job schedule, run history และ Edge Function logs เพื่อแยก scheduler failure จาก function failure","medium");
 if(codes.has("ORDER_HEARTBEAT_STALE")||codes.has("ORDER_SYNC_ERRORS")||codes.has("STALE_ORDERS"))add("ORDER_PIPELINE","Order pipeline อาจติดขัดที่ heartbeat, sync หรือขั้นตอนสถานะ",["พบ Order finding: "+[...codes].filter(x=>x.startsWith("ORDER_")||x==="STALE_ORDERS").join(", ")],"ตรวจ orderTick, sync cursor และอายุสถานะออเดอร์แบบ read-only ก่อนพิจารณา retry","medium");
 if(codes.has("SUPA_HEARTBEAT_STALE"))add("SUPABASE_HEARTBEAT","ข้อมูล heartbeat ของ Supabase ไม่สดใหม่",["supaHeartbeatAgeMinutes="+String(metrics.supaHeartbeatAgeMinutes??"unknown")],"ตรวจ scheduled health task, DB connectivity และ function logs โดยไม่ restart อัตโนมัติ","medium");
 const keys=["outboxErrors24h","staleOrders","supaHeartbeatAgeMinutes","orderHeartbeatAgeMinutes","orderSyncErrors","orderSsoFailures24h"];
 const trends=keys.map(key=>{
  const vals=history.map(x=>metricValue(asJson(x.metrics,{}),key)).filter((v:any)=>v!==null);
  const cur=metricValue(metrics,key);
  if(cur===null)return {metric:key,current:null,trend:"unknown",samples:vals.length,change:null};
  const prev=vals.length?vals[vals.length-1]:null;
  return {metric:key,current:cur,previous:prev,trend:prev===null?"baseline":cur>prev?"increasing":cur<prev?"decreasing":"stable",change:prev===null?null:Number((cur-prev).toFixed(2)),samples:vals.length+1};
 });
 const forecasts=trends.filter(x=>x.metric==="outboxErrors24h"||x.metric==="staleOrders").map(x=>({metric:x.metric,nextCheckEstimate:x.current,method:"latest-value baseline only",confidence:"low",warning:"ไม่ใช่การพยากรณ์เชิงสถิติ; ต้องมีข้อมูลหลายรอบก่อนประเมินแนวโน้ม"}));
 return {rootCauses:causes,trends,forecast:forecasts,confidence:causes.some(x=>x.confidence==="high")?"medium":causes.length?"low":"low"};
}
function median(values:number[]){const a=[...values].sort((x,y)=>x-y);if(!a.length)return 0;const m=Math.floor(a.length/2);return a.length%2?a[m]:(a[m-1]+a[m])/2;}
async function detectAnomalies(run:any,metrics:Record<string,any>){
 const keys=["outboxErrors24h","staleOrders","orderSyncErrors","orderSsoFailures24h","supaHeartbeatAgeMinutes","orderHeartbeatAgeMinutes"];
 const history=await sql`select metrics from public.it_ops_metric_history where monitor_run_id<>${run.id} order by captured_at desc limit 30`;
 const results:any[]=[];
 for(const key of keys){
  const current=metricValue(metrics,key); if(current===null)continue;
  const vals=history.map((h:any)=>metricValue(asJson(h.metrics,{}),key)).filter((v:any)=>v!==null);
  let abnormal=false,severity:"info"|"warning"|"critical"="info",baseline:number|null=null,confidence:"low"|"medium"|"high"="low",reason="";
  if(key.endsWith("AgeMinutes")&&current>10){abnormal=true;severity=current>30?"critical":"warning";baseline=10;confidence="medium";reason="Heartbeat age exceeded 10-minute threshold";}
  else if(vals.length>=5){
   baseline=median(vals);const delta=current-baseline;
   const threshold=Math.max(3,baseline*2);
   if(delta>threshold){abnormal=true;severity=delta>=Math.max(10,baseline*4)?"critical":"warning";confidence=vals.length>=20?"high":"medium";reason="Current value exceeds historical median threshold";}
  }
  if(abnormal){
   const anomalyKey="metric:"+key,deviation=baseline===null?current:Number((current-baseline).toFixed(2));
   const [event]=await sql`insert into public.it_ops_anomaly_events(anomaly_key,metric_key,severity,window_start,window_end,observed_value,baseline_value,deviation,sample_count,confidence,evidence,status)
    values(${anomalyKey},${key},${severity},now()-interval '24 hours',${run.checked_at},${current},${baseline},${deviation},${vals.length},${confidence},${JSON.stringify({reason,monitorRunId:run.id,baselineMethod:baseline===null?"fixed_threshold":"median_of_previous_samples"})}::jsonb,'open')
    on conflict(anomaly_key) do update set severity=excluded.severity,window_end=excluded.window_end,observed_value=excluded.observed_value,baseline_value=excluded.baseline_value,deviation=excluded.deviation,sample_count=excluded.sample_count,confidence=excluded.confidence,evidence=excluded.evidence,status=case when public.it_ops_anomaly_events.status='suppressed' then 'suppressed' else 'open' end,updated_at=now()
    returning id,metric_key,severity,observed_value,baseline_value,sample_count,confidence,status`;
   results.push(event);
  }else await sql`update public.it_ops_anomaly_events set status='resolved',updated_at=now() where anomaly_key=${"metric:"+key} and status in ('open','acknowledged')`;
 }
 return results;
}

async function analyzeRun(run:any){
 const metrics=asJson(run.metrics,{}), findings=asJson(run.findings,[]);
 await sql`insert into public.it_ops_metric_history(monitor_run_id,captured_at,status,risk_score,metrics)
 values(${run.id},${run.checked_at},${run.status},${run.risk_score},${JSON.stringify(metrics)}::jsonb)
 on conflict(monitor_run_id) do nothing`;
 const history=await sql`select metrics,captured_at from public.it_ops_metric_history where monitor_run_id<>${run.id} order by captured_at desc limit 5`;
 const analysis=buildDiagnosis(Array.isArray(findings)?findings:[],metrics,history);
 await sql`insert into public.it_ops_diagnostics(monitor_run_id,overall_status,root_causes,trends,forecast,confidence)
 values(${run.id},${run.status},${JSON.stringify(analysis.rootCauses)}::jsonb,${JSON.stringify(analysis.trends)}::jsonb,${JSON.stringify(analysis.forecast)}::jsonb,${analysis.confidence})
 on conflict(monitor_run_id) do update set overall_status=excluded.overall_status,root_causes=excluded.root_causes,trends=excluded.trends,forecast=excluded.forecast,confidence=excluded.confidence`;
 return analysis;
}

async function runCycle(){
 if(!sql)throw new HttpError(503,"Database connection ไม่พร้อม");
 const [run]=await sql`select id,checked_at,risk_score,status,findings,metrics from public.it_monitor_runs order by checked_at desc limit 1`;
 if(!run)throw new HttpError(409,"ยังไม่มีผลตรวจจาก IT Monitor");
 const parsedFindings=asJson(run.findings,[]); const findings=Array.isArray(parsedFindings)?parsedFindings:[];
 const diagnosis=await analyzeRun(run);
 const anomalies=await detectAnomalies(run,asJson(run.metrics,{}));
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
   // เสนอ 1 รายการต่อปัญหาที่ยังเปิดอยู่ — ถ้ายังมีรายการรออนุมัติ/อนุมัติแล้วที่ยังไม่หมดอายุ ไม่ต้องเสนอซ้ำทุก 5 นาที
   const actionCode="inspect_"+code.toLowerCase();
   const [openItem]=await sql`select id from public.it_ops_action_queue where incident_id=${incident.id} and action_code=${actionCode} and status in ('pending_approval','approved') and expires_at>now() limit 1`;
   if(openItem)continue;
   const idem=code.toLowerCase()+":"+String(run.id);
   const [q]=await sql`insert into public.it_ops_action_queue(incident_id,action_code,title,rationale,risk_level,status,requires_owner_approval,proposed_by,idempotency_key)
    values(${incident.id},${actionCode},${safe.title},${safe.why},${safe.risk},'pending_approval',true,'system',${idem})
    on conflict(idempotency_key) do nothing returning id`;
   if(q)proposals++;
  }
 }
 await sql`update public.it_ops_incidents set status='resolved',updated_at=now() where status in ('open','acknowledged') and last_seen_at < ${run.checked_at} - interval '15 minutes'`;
 await sql`insert into public.it_ops_audit(actor,event_type,entity_type,details) values('system','monitor_triaged','monitor_run',${JSON.stringify({runId:run.id,findings:findings.length,incidentsUpserted:upserts,proposalsCreated:proposals,mode:'observe_only'})}::jsonb)`;
 return {monitorRunId:run.id,findings:findings.length,incidentsUpserted:upserts,proposalsCreated:proposals,diagnosis,anomalies,mode:"observe_only"};
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
   if(body.type==="learning_feedback"){
    const diagnosticId=body.diagnosticId==null?null:Number(body.diagnosticId), anomalyId=body.anomalyEventId==null?null:Number(body.anomalyEventId);
    const allowed=["correct","incorrect","helpful","not_helpful","false_positive","missed_issue"], feedbackType=String(body.feedbackType||"");
    if(!allowed.includes(feedbackType))throw new HttpError(400,"ประเภท Feedback ไม่ถูกต้อง");
    if(diagnosticId!==null&&(!Number.isSafeInteger(diagnosticId)||diagnosticId<=0))throw new HttpError(400,"Diagnostic ID ไม่ถูกต้อง");
    if(anomalyId!==null&&(!Number.isSafeInteger(anomalyId)||anomalyId<=0))throw new HttpError(400,"Anomaly ID ไม่ถูกต้อง");
    const note=String(body.note||"").slice(0,500), corrected=String(body.correctedCategory||"").slice(0,80)||null;
    const [saved]=await sql`insert into public.it_ops_learning_feedback(diagnostic_id,anomaly_event_id,feedback_type,corrected_category,note,actor)
      values(${diagnosticId},${anomalyId},${feedbackType},${corrected},${note},${actor}) returning id,created_at,feedback_type`;
    await sql`insert into public.it_ops_audit(actor,event_type,entity_type,entity_id,details) values(${actor},'learning_feedback_submitted','it_ops_learning_feedback',${saved.id},${JSON.stringify({feedbackType,diagnosticId,anomalyId})}::jsonb)`;
    return out({ok:true,item:saved},200,origin);
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
   const [incidents,queue,audit,actionRuns,diagnostics,metricHistory,anomalyEvents,dependencies,learningFeedback]=await Promise.all([
    sql`select id,fingerprint,severity,code,title,detail,recommendation,status,first_seen_at,last_seen_at,occurrence_count from public.it_ops_incidents order by case severity when 'critical' then 0 when 'warning' then 1 else 2 end,last_seen_at desc limit 40`,
    sql`select q.id,q.incident_id,q.action_code,q.title,q.rationale,q.risk_level,q.status,q.requires_owner_approval,q.created_at,q.expires_at,i.code as incident_code from public.it_ops_action_queue q left join public.it_ops_incidents i on i.id=q.incident_id order by q.created_at desc limit 40`,
    sql`select id,actor,event_type,entity_type,entity_id,details,created_at from public.it_ops_audit order by created_at desc limit 30`,
    sql`select id,action_queue_id,action_code,status,executed_by,preflight,simulation,rollback_check,created_at from public.it_ops_action_runs order by created_at desc limit 20`,
    sql`select id,monitor_run_id,overall_status,root_causes,trends,forecast,confidence,created_at from public.it_ops_diagnostics order by created_at desc limit 12`,
    sql`select monitor_run_id,captured_at,status,risk_score,metrics from public.it_ops_metric_history order by captured_at desc limit 12`,
    sql`select id,anomaly_key,metric_key,severity,detected_at,observed_value,baseline_value,deviation,sample_count,confidence,status,evidence from public.it_ops_anomaly_events order by detected_at desc limit 30`,
    sql`select dependency_key,component,depends_on,dependency_type,criticality,description,verification_hint from public.it_ops_dependency_map where enabled=true order by criticality desc,component`,
    sql`select id,diagnostic_id,anomaly_event_id,feedback_type,corrected_category,note,actor,created_at from public.it_ops_learning_feedback order by created_at desc limit 20`
   ]);
   return out({ok:true,mode:"phase_2_3_observe_only",incidents,queue,audit,actionRuns,diagnostics,metricHistory,anomalyEvents,dependencies,learningFeedback},200,origin);
  }
  throw new HttpError(405,"Method not allowed");
 }catch(e){const status=e instanceof HttpError?e.status:500;if(!(e instanceof HttpError))console.error("it-ops-orchestrator",String(e).slice(0,240));return out({ok:false,error:e instanceof HttpError?e.message:"IT Ops Orchestrator error"},status,origin);}
});
