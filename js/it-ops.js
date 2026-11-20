/* Super Advance IT · AI Operations Assistant
 * Owner-only, read-only AI advisor. It never executes commands or changes production data.
 */
'use strict';
const IT_OPS_URL = 'https://ytxbnqosenolojifeikf.supabase.co/functions/v1/it-ai-ops';
const IT_OPS_QUEUE_URL = 'https://ytxbnqosenolojifeikf.supabase.co/functions/v1/it-ops-orchestrator';
let IT_OPS_STATE = { checked: false, configured: false, busy: false };
function ocOpsContext() {
  const s = OC.status || {}, bg = OC.aiData && OC.aiData.background || {}, m = bg.metrics || {};
  const perf = OC.aiData && OC.aiData.perf && OC.aiData.perf.rows || [];
  const analysis = typeof ocAiAnalyse === 'function' ? ocAiAnalyse() : {};
  return {
    healthScore: Number(s.score || bg.risk_score || 0), monitorStatus: bg.status || 'unknown',
    findings: (Array.isArray(bg.findings) ? bg.findings : []).slice(0, 12).map(x => ({
      code: String(x.code || '').slice(0, 60), level: String(x.level || '').slice(0, 20),
      title: String(x.title || '').slice(0, 120), action: String(x.action || '').slice(0, 180)
    })),
    metrics: {
      outboxErrors24h: Number(m.outboxErrors24h || 0), staleOrders: Number(m.staleOrders || 0), orders24h: Number(m.orders24h || 0),
      supaHeartbeatAgeMinutes: m.supaHeartbeatAgeMinutes == null ? null : Number(m.supaHeartbeatAgeMinutes),
      orderHeartbeatAgeMinutes: m.orderHeartbeatAgeMinutes == null ? null : Number(m.orderHeartbeatAgeMinutes),
      backofficeCronActive: !!m.backofficeCronActive, backofficeCronLastStatus: String(m.backofficeCronLastStatus || 'unknown')
    },
    performance: perf.slice(0, 8).map(x => ({
      action: String(x.action || 'unknown').slice(0, 60), p95ms: Number(x.p95 || 0),
      maxMs: Number(x.max || 0), failures: Number(x.fail || 0), samples: Number(x.n || 0)
    })),
    diagnosis: (analysis.insights || []).slice(0, 8).map(x => ({
      level: x.level, title: String(x.title || '').slice(0, 120),
      detail: String(x.detail || '').slice(0, 180), recommendation: String(x.action || '').slice(0, 180)
    }))
  };
}
function ocOpsPanelHtml() {
  const ready = IT_OPS_STATE.checked ? (IT_OPS_STATE.configured ? 'AI เชื่อมต่อพร้อมใช้งาน' : 'รอตั้งค่า API Key') : 'กำลังตรวจสอบการเชื่อมต่อ AI';
  const cls = IT_OPS_STATE.configured ? 'ok' : 'warn';
  return `<section class="oc-ops-panel" id="oc-ops-panel">
    <div class="oc-ops-head"><div><span class="oc-ops-kicker">AI OPERATIONS COPILOT</span><h2>ผู้ช่วยวิเคราะห์และดูแลระบบ</h2><p>ถามปัญหาจากข้อมูลสุขภาพระบบล่าสุด พร้อมแนวทางตรวจสอบและแผนแก้ไขที่มีหลักฐาน</p></div><span class="chip ${cls}" id="oc-ops-status">${ready}</span></div>
    <div class="oc-ops-prompts">
      <button type="button" data-ops-prompt="ตรวจสอบสุขภาพระบบทั้งหมด และสรุปความเสี่ยงที่สำคัญที่สุด">ตรวจสุขภาพระบบ</button>
      <button type="button" data-ops-prompt="วิเคราะห์ปัญหาที่ควรแก้ก่อน พร้อมจัดลำดับความเร่งด่วน">จัดลำดับปัญหา</button>
      <button type="button" data-ops-prompt="ตรวจสอบประสิทธิภาพและเสนอแผนลดเวลาโหลด">วิเคราะห์ความเร็ว</button>
      <button type="button" data-ops-prompt="เสนอแผน Automation ที่ปลอดภัยสำหรับระบบนี้ โดยระบุสิ่งที่ทำเองได้และสิ่งที่ต้องอนุมัติ">วางแผน Automation</button>
    </div>
    <form class="oc-ops-form" id="oc-ops-form">
      <label class="sr-only" for="oc-ops-question">คำถามถึง AI IT Assistant</label>
      <textarea id="oc-ops-question" maxlength="1500" rows="3" placeholder="เช่น ทำไมระบบออเดอร์ค้าง และควรตรวจอะไรเป็นลำดับแรก?" required></textarea>
      <div class="oc-ops-submit"><small>ส่งเฉพาะตัวเลขสถานะและข้อมูลวินิจฉัยที่ผ่านการคัดกรอง ไม่ส่งชื่อพนักงาน ลูกค้า หรือข้อความ LINE</small><button class="btn primary" id="oc-ops-send" type="submit" ${IT_OPS_STATE.busy || !IT_OPS_STATE.configured ? 'disabled' : ''}>วิเคราะห์ด้วย AI</button></div>
    </form>
    <div id="oc-ops-answer" class="oc-ops-answer" aria-live="polite"><span class="muted">AI จะช่วยวิเคราะห์เมื่อเชื่อมต่อ API Key แล้ว · ระบบ Monitor ปัจจุบันยังตรวจอัตโนมัติทุก 5 นาทีตามเดิม</span></div>
    <div class="oc-ops-queue" id="oc-ops-queue"><div class="oc-ops-queue-head"><h3>Incident & Approval Center</h3><button type="button" id="oc-ops-refresh">รีเฟรชสถานะ</button></div><p class="muted">กำลังโหลดเหตุการณ์จากรอบตรวจล่าสุด…</p></div>
    <div id="it-ops-control-center" class="oc-ops-queue"><div class="oc-ops-queue-head"><h3>IT Ops Control Center · Phase 2.4–2.9</h3><button type="button" id="itopscc-refresh">รีเฟรช</button></div><p class="muted">กำลังโหลด Governance / Alerts / Recovery Plans…</p></div>
    <div class="oc-ops-guard"><b>Safety Guard</b><span>โหมดเริ่มต้นเป็น Read-only: AI วิเคราะห์และเสนอแผนเท่านั้น ไม่สั่งแก้ฐานข้อมูล ไม่เปลี่ยนสิทธิ์ ไม่ Deploy และไม่สั่งซ่อม Production เอง</span></div>
  </section>`;
}
async function ocOpsCheck() {
  const badge = document.getElementById('oc-ops-status');
  try {
    const r = await fetch(IT_OPS_URL, { headers: { 'x-cms-session': S.token || '' }, cache: 'no-store' });
    const p = await r.json();
    IT_OPS_STATE = { ...IT_OPS_STATE, checked: true, configured: !!(r.ok && p.configured), model: p.model || '' };
    if (badge) { badge.textContent = IT_OPS_STATE.configured ? 'AI เชื่อมต่อพร้อมใช้งาน' : 'รอตั้งค่า API Key'; badge.className = 'chip ' + (IT_OPS_STATE.configured ? 'ok' : 'warn'); }
    const send = document.getElementById('oc-ops-send');
    if (send) send.disabled = !IT_OPS_STATE.configured || IT_OPS_STATE.busy;
    const answer = document.getElementById('oc-ops-answer');
    ocOpsLoadQueue();
    ocOpsControlLoad();
    if (answer && !IT_OPS_STATE.configured) answer.innerHTML = '<span class="muted">ยังไม่ได้ตั้งค่า OPENAI_API_KEY ใน Supabase Secrets · ส่วน AI Advisor จะเปิดใช้งานหลังตั้งค่าคีย์ โดยไม่กระทบระบบ Monitor เดิม</span>';
  } catch (_) {
    IT_OPS_STATE.checked = true;
    if (badge) { badge.textContent = 'ตรวจสอบการเชื่อมต่อไม่ได้'; badge.className = 'chip warn'; }
  }
}
async function ocOpsAsk(question) {
  const answer = document.getElementById('oc-ops-answer'), send = document.getElementById('oc-ops-send');
  if (!question || !answer || IT_OPS_STATE.busy) return;
  if (!IT_OPS_STATE.configured) { answer.textContent = 'AI Provider ยังไม่พร้อม · ต้องตั้งค่า OPENAI_API_KEY ใน Supabase Secrets ก่อน'; return; }
  IT_OPS_STATE.busy = true; if (send) send.disabled = true;
  answer.innerHTML = '<span class="muted">AI กำลังอ่านผลตรวจและวิเคราะห์…</span>';
  try {
    const r = await fetch(IT_OPS_URL, {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-cms-session': S.token || '' },
      body: JSON.stringify({ question, context: ocOpsContext() }), cache: 'no-store'
    });
    const p = await r.json();
    if (!r.ok || !p.ok) throw new Error(p.error || 'AI วิเคราะห์ไม่สำเร็จ');
    const article = document.createElement('article');
    article.className = 'oc-ops-response'; article.textContent = p.answer || 'AI ไม่ได้ส่งคำตอบกลับมา';
    answer.replaceChildren(article);
    if (p.model) { const meta = document.createElement('small'); meta.textContent = 'Model: ' + p.model + ' · คำตอบเป็นคำแนะนำแบบ Read-only'; answer.appendChild(meta); }
  } catch (e) { answer.textContent = e.message || 'เชื่อมต่อ AI ไม่สำเร็จ'; }
  finally { IT_OPS_STATE.busy = false; if (send) send.disabled = !IT_OPS_STATE.configured; }
}
document.addEventListener('click', e => {
  const prompt = e.target.closest('[data-ops-prompt]');
  if (prompt) { const input = document.getElementById('oc-ops-question'); if (input) { input.value = prompt.dataset.opsPrompt || ''; input.focus(); } }
});
document.addEventListener('submit', e => {
  if (e.target && e.target.id === 'oc-ops-form') {
    e.preventDefault(); const input = document.getElementById('oc-ops-question');
    const q = input && input.value.trim(); if (q) ocOpsAsk(q);
  }
});


function ocOpsParseArray(value) { if (Array.isArray(value)) return value; if (typeof value === 'string') { try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed : []; } catch (_) {} } return []; }
async function ocOpsLoadQueue() {
  const box = document.getElementById('oc-ops-queue');
  if (!box) return;
  box.innerHTML = '<div class="oc-ops-queue-head"><h3>Incident & Approval Center</h3><span class="muted">กำลังโหลด…</span></div>';
  try {
    const r = await fetch(IT_OPS_QUEUE_URL, { headers: { 'x-cms-session': S.token || '' }, cache: 'no-store' });
    const p = await r.json();
    if (!r.ok || !p.ok) throw new Error(p.error || 'โหลด Incident ไม่สำเร็จ');
    const head = document.createElement('div'); head.className = 'oc-ops-queue-head';
    const title = document.createElement('h3'); title.textContent = 'Incident & Approval Center'; head.appendChild(title);
    const refresh = document.createElement('button'); refresh.type = 'button'; refresh.id = 'oc-ops-refresh'; refresh.textContent = 'รีเฟรช'; head.appendChild(refresh);
    box.replaceChildren(head);
    const summary = document.createElement('p'); summary.className = 'oc-ops-queue-summary';
    const open = (p.incidents || []).filter(x => ['open','acknowledged'].includes(x.status));
    const pending = (p.queue || []).filter(x => x.status === 'pending_approval');
    summary.textContent = 'เหตุการณ์เปิด ' + open.length + ' · รออนุมัติ ' + pending.length + ' · โหมด Observe-only';
    box.appendChild(summary);
    const qTitle = document.createElement('h4'); qTitle.textContent = 'รายการรออนุมัติ'; box.appendChild(qTitle);
    if (!pending.length) { const empty = document.createElement('p'); empty.className = 'muted'; empty.textContent = 'ไม่มีรายการรออนุมัติ'; box.appendChild(empty); }
    pending.forEach(item => {
      const card = document.createElement('article'); card.className = 'oc-ops-queue-card';
      const h = document.createElement('b'); h.textContent = item.title; card.appendChild(h);
      const d = document.createElement('p'); d.textContent = (item.incident_code || '') + ' · ' + item.rationale + ' · ความเสี่ยง ' + item.risk_level; card.appendChild(d);
      const note = document.createElement('small'); note.textContent = 'การอนุมัติเป็นการรับรองแผนเท่านั้น ยังไม่มีการรันคำสั่งอัตโนมัติ'; card.appendChild(note);
      const actions = document.createElement('div'); actions.className = 'oc-ops-queue-actions';
      [['approve','อนุมัติแผน'],['reject','ปฏิเสธ']].forEach(([decision,label]) => {
        const btn = document.createElement('button'); btn.type = 'button'; btn.textContent = label; btn.dataset.opsDecision = decision; btn.dataset.opsId = item.id;
        if (decision === 'approve') btn.className = 'btn primary'; actions.appendChild(btn);
      });
      card.appendChild(actions); box.appendChild(card);
    });
    const approved = (p.queue || []).filter(x => x.status === 'approved');
    const dryAllow = new Set(['inspect_outbox_errors','inspect_cron_disabled','inspect_cron_stale','inspect_cron_last_failed','inspect_cron_failures','inspect_supa_heartbeat','inspect_order_heartbeat','inspect_order_sync_errors','inspect_order_sso_failures']);
    const aTitle = document.createElement('h4'); aTitle.textContent = 'รายการอนุมัติ · ทดสอบจำลองเท่านั้น'; box.appendChild(aTitle);
    if (!approved.length) { const emptyA = document.createElement('p'); emptyA.className = 'muted'; emptyA.textContent = 'ยังไม่มีแผนที่อนุมัติ'; box.appendChild(emptyA); }
    approved.forEach(item => {
      const card = document.createElement('article'); card.className = 'oc-ops-queue-card';
      const h = document.createElement('b'); h.textContent = item.title; card.appendChild(h);
      const d = document.createElement('p'); d.textContent = (item.incident_code || '') + ' · ' + item.action_code + ' · อนุมัติโดย Owner'; card.appendChild(d);
      if (dryAllow.has(item.action_code)) {
        const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'btn primary'; btn.textContent = 'ทดสอบ Dry-run'; btn.dataset.opsDryrun = item.id; card.appendChild(btn);
      } else {
        const note = document.createElement('small'); note.textContent = 'Action นี้ยังไม่อยู่ใน Allowlist สำหรับ Dry-run'; card.appendChild(note);
      }
      box.appendChild(card);
    });
    const runsTitle = document.createElement('h4'); runsTitle.textContent = 'ประวัติการจำลองล่าสุด'; box.appendChild(runsTitle);
    (p.actionRuns || []).slice(0,5).forEach(run => {
      const row = document.createElement('div'); row.className = 'oc-ops-incident-row';
      const label = document.createElement('b'); label.textContent = '[DRY-RUN] ' + run.action_code + ' · ' + run.status; row.appendChild(label);
      const detail = document.createElement('small'); detail.textContent = 'ผู้ดำเนินการ: ' + run.executed_by + ' · ' + new Date(run.created_at).toLocaleString('th-TH'); row.appendChild(detail);
      box.appendChild(row);
    });
    const diagTitle = document.createElement('h4'); diagTitle.textContent = 'AI Root Cause & Predictive Signals'; box.appendChild(diagTitle);
    const latestDiag = (p.diagnostics || [])[0];
    if (latestDiag) {
      const causes = ocOpsParseArray(latestDiag.root_causes);
      if (!causes.length) { const none = document.createElement('p'); none.className = 'muted'; none.textContent = 'ยังไม่มี Root Cause ที่ยืนยันได้จาก Finding รอบล่าสุด'; box.appendChild(none); }
      causes.forEach(cause => {
        const card = document.createElement('article'); card.className = 'oc-ops-queue-card';
        const h = document.createElement('b'); h.textContent = cause.title + ' · ความเชื่อมั่น ' + cause.confidence; card.appendChild(h);
        const d = document.createElement('p'); d.textContent = (cause.evidence || []).join(' · '); card.appendChild(d);
        const next = document.createElement('small'); next.textContent = 'ขั้นตอนตรวจสอบ: ' + cause.next; card.appendChild(next);
        box.appendChild(card);
      });
      const trends = ocOpsParseArray(latestDiag.trends);
      const trendTitle = document.createElement('h4'); trendTitle.textContent = 'Metric Trends · รอบตรวจล่าสุด'; box.appendChild(trendTitle);
      trends.forEach(t => {
        const row = document.createElement('div'); row.className = 'oc-ops-incident-row';
        const label = document.createElement('b'); label.textContent = t.metric + ': ' + (t.current == null ? 'N/A' : t.current) + ' · ' + t.trend; row.appendChild(label);
        const detail = document.createElement('small'); detail.textContent = 'เปลี่ยนจากรอบก่อน: ' + (t.change == null ? 'ยังไม่มี baseline' : t.change); row.appendChild(detail);
        box.appendChild(row);
      });
      const forecasts = ocOpsParseArray(latestDiag.forecast);
      forecasts.forEach(fc => {
        const note = document.createElement('small'); note.className = 'oc-ops-forecast-note';
        note.textContent = 'แนวโน้ม ' + fc.metric + ': ' + fc.warning; box.appendChild(note);
      });
      const confidence = document.createElement('small'); confidence.className = 'oc-ops-forecast-note';
      confidence.textContent = 'ระดับความเชื่อมั่นโดยรวม: ' + latestDiag.confidence + ' · วิเคราะห์จากกฎและข้อมูลย้อนหลัง ไม่ใช่การยืนยันสาเหตุจาก AI ภายนอก';
      box.appendChild(confidence);
    } else {
      const waiting = document.createElement('p'); waiting.className = 'muted'; waiting.textContent = 'รอผล Orchestrator รอบถัดไปเพื่อสร้าง Root Cause และ Trend'; box.appendChild(waiting);
    }

    const anomalyTitle = document.createElement('h4'); anomalyTitle.textContent = 'Anomaly Detection · ตรวจจับความผิดปกติ'; box.appendChild(anomalyTitle);
    const anomalies = (p.anomalyEvents || []).filter(x => ['open','acknowledged'].includes(x.status));
    if (!anomalies.length) { const empty = document.createElement('p'); empty.className = 'muted'; empty.textContent = 'ยังไม่พบ Anomaly ที่เข้าเกณฑ์ หรือข้อมูลย้อนหลังยังไม่ครบ 5 ตัวอย่าง'; box.appendChild(empty); }
    anomalies.forEach(a => {
      const card = document.createElement('article'); card.className = 'oc-ops-queue-card';
      const h = document.createElement('b'); h.textContent = '[' + String(a.severity).toUpperCase() + '] ' + a.metric_key; card.appendChild(h);
      const d = document.createElement('p'); d.textContent = 'ค่าปัจจุบัน ' + a.observed_value + ' · Baseline ' + (a.baseline_value == null ? 'fixed threshold' : a.baseline_value) + ' · Samples ' + a.sample_count + ' · Confidence ' + a.confidence; card.appendChild(d);
      [['correct','ยืนยันว่าถูกต้อง'],['false_positive','แจ้ง False Positive']].forEach(([kind,label]) => {
        const b = document.createElement('button'); b.type='button'; b.className='btn'; b.textContent=label; b.dataset.opsFeedback=kind; b.dataset.opsAnomalyId=a.id; card.appendChild(b);
      });
      box.appendChild(card);
    });
    const depTitle = document.createElement('h4'); depTitle.textContent = 'System Dependency Map'; box.appendChild(depTitle);
    (p.dependencies || []).forEach(dep => {
      const row=document.createElement('div'); row.className='oc-ops-incident-row';
      const label=document.createElement('b'); label.textContent=dep.component+' → '+dep.depends_on+' · '+dep.criticality; row.appendChild(label);
      const detail=document.createElement('small'); detail.textContent=dep.description+' · ตรวจสอบ: '+dep.verification_hint; row.appendChild(detail); box.appendChild(row);
    });
    const learnTitle=document.createElement('h4'); learnTitle.textContent='Owner Learning Feedback'; box.appendChild(learnTitle);
    const learnNote=document.createElement('p'); learnNote.className='muted'; learnNote.textContent='Feedback จะถูกเก็บเป็นข้อมูลสำหรับประเมินคุณภาพการวิเคราะห์ ยังไม่ใช้ฝึกโมเดลหรือเปลี่ยนกฎโดยอัตโนมัติ'; box.appendChild(learnNote);
    (p.learningFeedback || []).slice(0,5).forEach(f => {
      const row=document.createElement('div'); row.className='oc-ops-incident-row';
      const label=document.createElement('b'); label.textContent=f.feedback_type+' · '+f.actor; row.appendChild(label);
      const detail=document.createElement('small'); detail.textContent=f.note || 'ไม่มีหมายเหตุ'; row.appendChild(detail); box.appendChild(row);
    });

    const iTitle = document.createElement('h4'); iTitle.textContent = 'เหตุการณ์ล่าสุด'; box.appendChild(iTitle);
    (p.incidents || []).slice(0,8).forEach(item => {
      const row = document.createElement('div'); row.className = 'oc-ops-incident-row';
      const label = document.createElement('b'); label.textContent = '[' + String(item.severity).toUpperCase() + '] ' + item.title; row.appendChild(label);
      const detail = document.createElement('small'); detail.textContent = item.detail + ' · พบ ' + item.occurrence_count + ' ครั้ง'; row.appendChild(detail);
      box.appendChild(row);
    });
  } catch (e) {
    box.textContent = 'ไม่สามารถโหลด Incident Center: ' + (e.message || 'connection error');
  }
}
async function ocOpsDecision(id, decision) {
  if (!confirm(decision === 'approve' ? 'ยืนยันอนุมัติแผนสำหรับผู้ดูแล? ระบบจะยังไม่รันคำสั่งใด ๆ' : 'ยืนยันปฏิเสธรายการนี้?')) return;
  try {
    const r = await fetch(IT_OPS_QUEUE_URL, { method: 'POST', headers: { 'content-type': 'application/json', 'x-cms-session': S.token || '' }, body: JSON.stringify({ id: Number(id), decision }), cache: 'no-store' });
    const p = await r.json(); if (!r.ok || !p.ok) throw new Error(p.error || 'บันทึกไม่สำเร็จ');
    ocOpsLoadQueue();
  } catch (e) { alert(e.message || 'บันทึกไม่สำเร็จ'); }
}
async function ocOpsSubmitFeedback(type, anomalyId) {
  try {
    const r=await fetch(IT_OPS_QUEUE_URL,{method:'POST',headers:{'content-type':'application/json','x-cms-session':S.token||''},body:JSON.stringify({type:'learning_feedback',feedbackType:type,anomalyEventId:Number(anomalyId)}),cache:'no-store'});
    const p=await r.json(); if(!r.ok||!p.ok) throw new Error(p.error||'บันทึก Feedback ไม่สำเร็จ');
    ocOpsLoadQueue();
  } catch(err) { alert(err.message||'บันทึก Feedback ไม่สำเร็จ'); }
}
document.addEventListener('click', e => {
  const refresh = e.target.closest('#oc-ops-refresh');
  if (refresh) ocOpsLoadQueue();
  const decision = e.target.closest('[data-ops-decision]');
  if (decision) ocOpsDecision(decision.dataset.opsId, decision.dataset.opsDecision);
  const feedback = e.target.closest('[data-ops-feedback]');
  if (feedback) ocOpsSubmitFeedback(feedback.dataset.opsFeedback, feedback.dataset.opsAnomalyId);
});

/* Phase 2.4–2.9 Owner-governed control center. No remediation execution. */
const IT_OPS_CONTROL_URL='https://ytxbnqosenolojifeikf.supabase.co/functions/v1/it-ops-control-center';
async function ocOpsControlRequest(method='GET',body=null){
 const r=await fetch(IT_OPS_CONTROL_URL,{method,headers:{'content-type':'application/json','x-cms-session':S.token||''},body:body?JSON.stringify(body):undefined,cache:'no-store'});
 const p=await r.json().catch(()=>({}));if(!r.ok||!p.ok)throw new Error(p.error||'Control Center request failed');return p;
}
async function ocOpsControlLoad(){
 const box=document.getElementById('it-ops-control-center');if(!box)return;
 box.innerHTML='<p class="muted">กำลังโหลด Control Center…</p>';
 try{
  const p=await ocOpsControlRequest();box.replaceChildren();
  const head=document.createElement('div');head.className='oc-ops-queue-head';
  const title=document.createElement('h3');title.textContent='IT Ops Control Center · Governance / Alerts / Recovery';head.appendChild(title);
  const refresh=document.createElement('button');refresh.type='button';refresh.id='itopscc-refresh';refresh.textContent='รีเฟรช';head.appendChild(refresh);box.appendChild(head);
  const note=document.createElement('p');note.className='muted';note.textContent='Owner-governed · Observe-only · ไม่มีคำสั่งแก้ไข Production อัตโนมัติ';box.appendChild(note);
  const stats=document.createElement('p');stats.textContent='Alerts '+p.alerts.length+' · Recovery Plans '+p.plans.length+' · Anomalies '+p.anomalies.length+' · Tests '+p.tests.length;box.appendChild(stats);
  function section(label,items){const h=document.createElement('h4');h.textContent=label;box.appendChild(h);if(!items.length){const e=document.createElement('p');e.className='muted';e.textContent='ไม่มีรายการ';box.appendChild(e);}return items;}
  section('Governance Controls',p.governance).forEach(x=>{const r=document.createElement('div');r.className='oc-ops-incident-row';const b=document.createElement('b');b.textContent=x.control_key+' · '+(x.enabled?'ON':'OFF');r.appendChild(b);const d=document.createElement('small');d.textContent=(x.config&&x.config.reason)||'ควบคุมโดย Owner';r.appendChild(d);box.appendChild(r);});
  section('Alerts',p.alerts).forEach(x=>{const c=document.createElement('article');c.className='oc-ops-queue-card';const h=document.createElement('b');h.textContent=x.severity.toUpperCase()+' · '+x.title;c.appendChild(h);const d=document.createElement('p');d.textContent=x.message||'';c.appendChild(d);const st=document.createElement('small');st.textContent='สถานะ: '+x.status;c.appendChild(st);if(x.status!=='resolved'){const a=document.createElement('div');a.className='oc-ops-queue-actions';[['acknowledged','รับทราบ'],['resolved','ปิด Alert']].forEach(([v,t])=>{const b=document.createElement('button');b.type='button';b.textContent=t;b.dataset.ccAlert=x.id;b.dataset.ccStatus=v;a.appendChild(b);});c.appendChild(a);}box.appendChild(c);});
  section('Recovery Plans · Approval only',p.plans).forEach(x=>{const c=document.createElement('article');c.className='oc-ops-queue-card';const h=document.createElement('b');h.textContent=x.component+' · '+x.recovery_type;c.appendChild(h);const d=document.createElement('p');d.textContent='สถานะ '+x.status+' · ต้องมี Backup และ Rollback evidence ก่อนดำเนินการ';c.appendChild(d);if(x.status==='proposed'){const b=document.createElement('button');b.type='button';b.className='btn primary';b.textContent='อนุมัติแผน (ไม่ Execute)';b.dataset.ccApprove=x.id;c.appendChild(b);}box.appendChild(c);});
  section('Anomaly Events',p.anomalies).forEach(x=>{const r=document.createElement('div');r.className='oc-ops-incident-row';const b=document.createElement('b');b.textContent=x.metric_key+' · '+x.severity+' · '+x.status;r.appendChild(b);const d=document.createElement('small');d.textContent='Observed '+x.observed_value+' / baseline '+x.baseline_value+' · samples '+x.sample_count+' · '+x.confidence;r.appendChild(d);box.appendChild(r);});
  section('Integration Test History',p.tests).forEach(x=>{const r=document.createElement('div');r.className='oc-ops-incident-row';const b=document.createElement('b');b.textContent=x.suite_key+' · '+x.status;r.appendChild(b);const d=document.createElement('small');d.textContent=new Date(x.created_at).toLocaleString('th-TH')+' · '+x.executed_by;r.appendChild(d);box.appendChild(r);});
  section('Forecast Snapshots',p.forecasts).forEach(x=>{const r=document.createElement('div');r.className='oc-ops-incident-row';r.textContent=x.metric_key+' · '+x.confidence+' · '+x.method;box.appendChild(r);});
 }catch(e){box.textContent=e.message||'โหลด Control Center ไม่สำเร็จ';}
}
document.addEventListener('click',async e=>{
 const refresh=e.target.closest('#itopscc-refresh');if(refresh){ocOpsControlLoad();return;}
 const alert=e.target.closest('[data-cc-alert]'),approve=e.target.closest('[data-cc-approve]');
 try{
  if(alert){alert.disabled=true;await ocOpsControlRequest('POST',{type:'alert_status',id:Number(alert.dataset.ccAlert),status:alert.dataset.ccStatus});await ocOpsControlLoad();}
  if(approve){approve.disabled=true;if(!confirm('ยืนยันอนุมัติแผนนี้? การอนุมัติไม่ใช่การสั่ง Execute')){approve.disabled=false;return;}await ocOpsControlRequest('POST',{type:'approve_recovery',id:Number(approve.dataset.ccApprove)});await ocOpsControlLoad();}
 }catch(err){toast(err.message);}
});
