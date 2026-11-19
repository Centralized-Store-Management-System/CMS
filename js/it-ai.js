/* Super Advance IT · automated diagnostic assistant
 * Uses live status, performance samples, event history and 7-day incident aggregates.
 * v1 is transparent rule-based/anomaly scoring; it does not call an external LLM or send data outside Supabase.
 */
'use strict';
async function ocAiCollect() {
  const tasks = await Promise.allSettled([
    ocCall('perf'),
    ocCall('events'),
    ocCall('dash', { days: 7 })
  ]);
  return {
    at: new Date().toISOString(),
    perf: tasks[0].status === 'fulfilled' ? tasks[0].value : null,
    events: tasks[1].status === 'fulfilled' ? tasks[1].value : null,
    dash: tasks[2].status === 'fulfilled' ? tasks[2].value : null,
    errors: tasks.map((x, i) => x.status === 'rejected' ? ['perf','events','dash'][i] : null).filter(Boolean)
  };
}
function ocAiAnalyse() {
  const data = OC.aiData || {}, checks = (OC.status && OC.status.checks) || [];
  const perf = data.perf && data.perf.rows || [], events = data.events && data.events.events || [];
  const logs = data.dash && data.dash.logs || [];
  const insights = [];
  let risk = 0;
  const bad = checks.filter(x => x.status === 'bad'), warn = checks.filter(x => x.status === 'warn');
  bad.forEach(x => { risk += 22; insights.push({ level: 'bad', title: x.name || 'ระบบผิดปกติ', detail: x.detail || 'ตรวจพบสถานะผิดปกติ', action: 'ตรวจสอบสถานะและใช้คำสั่งซ่อมเฉพาะรายการที่ระบุ' }); });
  warn.forEach(x => { risk += 8; insights.push({ level: 'warn', title: x.name || 'ควรตรวจสอบ', detail: x.detail || 'พบสัญญาณเตือน', action: 'ติดตามผลและตรวจซ้ำหลังดำเนินการ' }); });
  perf.forEach(x => {
    const p95 = Number(x.p95 || 0), max = Number(x.max || 0), fail = Number(x.fail || 0);
    if (fail > 0 || p95 >= 8000 || max >= 15000) {
      risk += Math.min(18, (fail ? 6 : 0) + (p95 >= 8000 ? 8 : 0) + (max >= 15000 ? 4 : 0));
      insights.push({ level: fail > 0 ? 'bad' : 'warn', title: 'ประสิทธิภาพคำสั่ง ' + (x.action || 'ไม่ระบุ'), detail: 'P95 ' + (p95 / 1000).toFixed(1) + 's · สูงสุด ' + (max / 1000).toFixed(1) + 's · ผิดพลาด ' + fail, action: 'ตรวจช่วงเวลาที่ช้าและดู Event Log ของระบบที่เกี่ยวข้อง' });
    }
  });
  const errEvents = [...events, ...logs].filter(x => ['error','alert'].includes(String(x.kind || '').toLowerCase()));
  const tally = new Map();
  errEvents.forEach(x => { const k = String(x.title || x.name || x.menu || 'เหตุการณ์ผิดพลาด'); tally.set(k, (tally.get(k) || 0) + Number(x.count || 1)); });
  [...tally.entries()].filter(([,n]) => n >= 3).sort((a,b) => b[1]-a[1]).slice(0,4).forEach(([title,n]) => {
    risk += 6;
    insights.push({ level: 'warn', title: 'พบเหตุการณ์ซ้ำ: ' + title, detail: 'บันทึกซ้ำ ' + n + ' ครั้งในข้อมูลที่รวบรวม', action: 'ตรวจ Event Log และหาสาเหตุที่เกิดซ้ำก่อนสั่งซ่อม' });
  });
  const score = Math.max(0, Math.min(100, Math.round(100 - risk)));
  const unique = [];
  const seen = new Set();
  insights.forEach(x => { const k = x.level + '|' + x.title; if (!seen.has(k)) { seen.add(k); unique.push(x); } });
  unique.sort((a,b) => (a.level === 'bad' ? 0 : 1) - (b.level === 'bad' ? 0 : 1));
  return { score, insights: unique.slice(0,8), bad: bad.length, warn: warn.length, perfRows: perf.length, eventRows: errEvents.length };
}
function ocAiPanelHtml() {
  const d = OC.aiData;
  if (!d) return `<section class="group pad" style="margin-top:16px"><div class="h2">🧠 AI Monitoring · Advanced <span class="spacer"></span><span class="chip warn">กำลังรวบรวมข้อมูล</span></div><p class="muted">กำลังอ่าน Status, Performance, Event Log และ Incident ย้อนหลัง 7 วัน…</p></section>`;
  const a = ocAiAnalyse();
  const color = a.score >= 85 ? '#1D7A4E' : a.score >= 60 ? '#B7791F' : '#A23B2A';
  const status = d.errors && d.errors.length ? 'ข้อมูลบางส่วนเชื่อมต่อไม่ได้: ' + d.errors.join(', ') : 'รวบรวมข้อมูลครบ 4 แหล่ง';
  return `<section class="group pad" style="margin-top:16px">
    <div class="h2">🧠 AI Monitoring · Advanced <span class="spacer"></span><span class="chip ${a.score >= 85 ? 'ok' : a.score >= 60 ? 'warn' : 'bad'}">Risk Score ${a.score}/100</span></div>
    <p class="muted" style="margin:4px 0 10px">Diagnostic Engine v1 · วิเคราะห์แนวโน้มและความผิดปกติจากข้อมูลจริง · ตรวจล่าสุด ${esc(d.at || '')}</p>
    <div class="kpis" style="margin:8px 0 12px">
      <div class="kpi ${a.bad ? 'bad' : 'ok'}"><b>${a.bad}</b><span>ระบบผิดปกติ</span></div>
      <div class="kpi ${a.warn ? 'warn' : 'ok'}"><b>${a.warn}</b><span>สัญญาณเตือน</span></div>
      <div class="kpi"><b>${a.perfRows}</b><span>Performance samples</span></div>
      <div class="kpi"><b>${a.eventRows}</b><span>เหตุการณ์ผิดพลาด</span></div>
    </div>
    <p class="note">${esc(status)} · วิเคราะห์จาก IT Status, Performance, Event History และ Incident 7 วัน</p>
    <div class="group">${a.insights.map(x => `<div class="row static">${ocDot(x.level)}<span class="main"><span class="t">${esc(x.title)}</span><span class="s">${esc(x.detail)} · แนวทาง: ${esc(x.action)}</span></span>${ocChip(x.level === 'bad' ? 'bad' : x.level === 'warn' ? 'warn' : 'ok')}</div>`).join('') || empty('ไม่พบความผิดปกติจากข้อมูลที่รวบรวม')}</div>
    <div class="actions" style="margin:10px 0 0"><button class="btn" type="button" data-ai-refresh>วิเคราะห์ข้อมูลใหม่</button><span class="grow"></span><span class="muted" style="font-size:12px">อัปเดตอัตโนมัติทุก 5 นาทีขณะเปิดหน้าระบบ IT</span></div>
    <p class="note">หมายเหตุ: รุ่นนี้เป็น Diagnostic Engine แบบวิเคราะห์กฎ/แนวโน้ม ไม่ใช่ Generative AI/ChatGPT และไม่ส่งข้อมูลพนักงานออกไปยังผู้ให้บริการ AI ภายนอก</p>
  </section>`;
}
