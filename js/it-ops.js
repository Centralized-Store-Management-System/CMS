/* Super Advance IT · AI Operations Assistant
 * Owner-only, read-only AI advisor. It never executes commands or changes production data.
 */
'use strict';
const IT_OPS_URL = 'https://ytxbnqosenolojifeikf.supabase.co/functions/v1/it-ai-ops';
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
