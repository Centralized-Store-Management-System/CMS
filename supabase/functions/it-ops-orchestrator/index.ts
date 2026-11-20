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
   const actor=await owner(req.headers.get("x-cms-session")||""),id=Number(body.id),decision=String(body.decision||"");
   if(!Number.isSafeInteger(id)||id<=0||!["approve","reject"].includes(decision))throw new HttpError(400,"คำขอไม่ถูกต้อง");
   const next=decision==="approve"?"approved":"rejected";
   const rows=await sql`update public.it_ops_action_queue set status=${next},reviewed_by=${actor},reviewed_at=now() where id=${id} and status='pending_approval' and expires_at>now() returning id,action_code,status`;
   if(!rows.length)throw new HttpError(409,"รายการนี้ถูกดำเนินการแล้วหรือหมดอายุ");
   await sql`insert into public.it_ops_audit(actor,event_type,entity_type,entity_id,details) values(${actor},${"approval_"+decision},'action_queue',${id},${JSON.stringify({actionCode:rows[0].action_code,note:"อนุมัติสำหรับแผนปฏิบัติงานโดยคนเท่านั้น; ไม่มีการรัน action อัตโนมัติ"})}::jsonb)`;
   return out({ok:true,item:rows[0],message:decision==="approve"?"อนุมัติแผนสำหรับดำเนินการโดยผู้ดูแลแล้ว (ยังไม่มีการรันคำสั่ง)":"ปฏิเสธรายการแล้ว"},200,origin);
  }
  if(req.method==="GET"){
   await owner(req.headers.get("x-cms-session")||"");
   const [incidents,queue,audit]=await Promise.all([
    sql`select id,fingerprint,severity,code,title,detail,recommendation,status,first_seen_at,last_seen_at,occurrence_count from public.it_ops_incidents order by case severity when 'critical' then 0 when 'warning' then 1 else 2 end,last_seen_at desc limit 40`,
    sql`select q.id,q.incident_id,q.action_code,q.title,q.rationale,q.risk_level,q.status,q.requires_owner_approval,q.created_at,q.expires_at,i.code as incident_code from public.it_ops_action_queue q left join public.it_ops_incidents i on i.id=q.incident_id order by q.created_at desc limit 40`,
    sql`select id,actor,event_type,entity_type,entity_id,details,created_at from public.it_ops_audit order by created_at desc limit 30`
   ]);
   return out({ok:true,mode:"observe_only",incidents,queue,audit},200,origin);
  }
  throw new HttpError(405,"Method not allowed");
 }catch(e){const status=e instanceof HttpError?e.status:500;if(!(e instanceof HttpError))console.error("it-ops-orchestrator",String(e).slice(0,240));return out({ok:false,error:e instanceof HttpError?e.message:"IT Ops Orchestrator error"},status,origin);}
});
