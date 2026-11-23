/* Owner Console (owner.html) — สำหรับบัญชี Owner เท่านั้น (พนักงานทุกระดับใช้แอปพนักงาน)
 * เมนู: 1) ระบบเข้าร้าน  2) Super Advance IT (ภาพรวม/ซ่อม · ความเร็ว · เหตุการณ์ · วิธีเข้าระบบ) — ฝั่ง Google: 42_SuperIT.gs */
'use strict';
const OC = { tok: 'amz.it.tok', me: null, view: 'home', status: null, perf: null, events: null, auth: null, branches: [], busy: false, timer: 0 };
const ocDot = s => `<span class="oc-dot ${s}"></span>`;
const ocChip = s => `<span class="chip ${s === 'ok' ? 'ok' : s === 'warn' ? 'warn' : 'bad'}">${s === 'ok' ? 'ปกติ' : s === 'warn' ? 'ควรดู' : 'ผิดปกติ'}</span>`;
const ocCall = (op, x = {}) => API.call('it', { t: S.token, op, ...x });
const ocCan = me => !!me && me.role === 'owner';   // แอป Owner: บัญชี Owner เท่านั้น

/** หน้าหลัก (ยังไม่ต้องเข้าระบบ): จัดการร้าน / ระบบ IT — กดแล้วจึงใส่รหัส */
function ocLanding(msg) {
  clearInterval(OC.timer);
  if (location.hash) history.replaceState(null, '', location.pathname + location.search);
  const th = (() => { try { return cachedTheme(); } catch (e) { return {}; } })();
  $('#root').innerHTML = `<section class="oc-land"><div class="oc-land-in">
    <div class="oc-land-head"><span class="logo">${icon('cup')}</span><div><b>${esc(th.title || 'Café Amazon')}</b><small>หน้าหลักเจ้าของร้าน</small></div></div>
    ${msg ? `<p class="status">${esc(msg)}</p>` : ''}
    <div class="oc-land-menu">
      <a class="oc-big" href="index.html?from=owner"><span class="ic">${icon('stock')}</span><b>จัดการร้าน</b><small>อนุมัติ ตารางงาน เวลาทำงาน เงินเดือน สต็อก บัญชี</small></a>
      <button class="oc-big" type="button" data-land="it"><span class="ic">${icon('admin')}</span><b>ระบบ IT</b><small>Super Advance IT · ตรวจ ซ่อม เร่งความเร็ว วิธีเข้าระบบ</small></button>
    </div>
    <button class="btn" type="button" data-pwa="1" hidden style="margin-top:18px">📲 ติดตั้งแอป Owner บนเครื่องนี้</button>
  </div></section>`;
  if (typeof pwaButtons === 'function') pwaButtons();
}
function ocLogin(msg) {
  S.token = ''; OC.me = null; SS.set(OC.tok, '');
  $('#root').innerHTML = `<section class="login"><div class="login-card">
    <div class="brand"><span class="logo">${icon('cup')}</span><span><b>ระบบ IT</b><small>Super Advance IT</small></span></div>
    <h2>เข้าสู่ระบบ</h2><p class="muted" style="margin-top:0">สำหรับบัญชี Owner เท่านั้น</p>
    <div class="form"><div class="field"><label for="oc-code">ชื่อผู้ใช้</label><input id="oc-code" autocomplete="username" value="${esc(LS.get('amz.lastCode', '') || '')}"></div>
    <div class="field"><label for="oc-pin">PIN</label><input id="oc-pin" type="password" inputmode="numeric" autocomplete="current-password"></div></div>
    <p class="err" id="oc-err" role="alert">${esc(msg || '')}</p>
    <div class="actions"><button class="btn" id="oc-back" type="button">← หน้าหลัก</button><span class="grow"></span><button class="btn primary big" id="oc-go">เข้าสู่ระบบ</button></div></div></section>`;
  $('#oc-back').onclick = () => ocLanding();
  const go = async () => {
    const code = $('#oc-code').value.trim(), pin = $('#oc-pin').value.trim();
    if (!code || !pin) { $('#oc-err').textContent = 'ใส่ชื่อผู้ใช้และ PIN'; return; }
    try {
      const r = await busy($('#oc-go'), () => API.call('login', { code, pin, from: 'Owner Console' }), 'กำลังเข้าสู่ระบบ…');
      if (!ocCan(r)) { API.call('logout', { t: r.token }).catch(() => {}); $('#oc-err').textContent = 'แอปนี้ใช้ได้เฉพาะบัญชี Owner · พนักงานใช้แอปพนักงาน (หลังร้าน / ลงเวลา / LINE)'; return; }
      S.token = r.token; OC.me = r; SS.set(OC.tok, r.token); LS.set('amz.lastCode', code);
      if (typeof OWNER_PWA_LOCK !== 'undefined') await OWNER_PWA_LOCK.enroll(r.token);
      const af = OC.after; OC.after = '';
      if (af === '__land') return ocLanding();   // แอป: ครั้งแรก → ตั้งรหัสแล้วกลับหน้าหลัก
      if (af === '__shop') { SS.set('amz.tok', r.token); location.href = 'index.html?from=owner'; return; }
      ocGo(af || 'dash');
    } catch (e) { const el = $('#oc-err'); if (el) el.textContent = e.message; }
  };
  $('#oc-go').onclick = go; $('#oc-pin').onkeydown = e => { if (e.key === 'Enter') go(); };
}
function ocShell(main) {
  const nav = [['dash', 'แดชบอร์ดปัญหารายวัน', 'acct', 'แดชบอร์ด'], ['it', 'ตรวจ & ซ่อมอัตโนมัติ', 'admin', 'ตรวจ/ซ่อม'], ['ai', 'AI Monitoring · Advanced', 'admin', 'AI Monitor'], ['perf', 'ความเร็ว', 'time', 'ความเร็ว'], ['events', 'เหตุการณ์', 'notify', 'เหตุการณ์'], ['auth', 'วิธีเข้าระบบ', 'users', 'เข้าระบบ'], ['control', 'IT Control Center', 'admin', 'IT Control'], ['network', 'AI Intelligence Network', 'admin', 'AI Network'], ['links', 'ใยแมงมุมโค้ด · ตรวจก่อนขึ้นระบบ', 'admin', 'ใยแมงมุมโค้ด']];
  const cur = nav.find(n => n[0] === OC.view) || nav[0];
  $('#root').innerHTML = `<div class="oc"><header class="oc-top"><span class="logo">${icon('cup')}</span><span class="t"><small>Owner Console</small><b>${esc(cur[1])}</b></span><button class="oc-top-out" id="oc-out2" aria-label="ออกจากระบบ">${icon('out')}</button></header><aside class="oc-side"><div class="brand"><span class="logo">${icon('cup')}</span><span><b>Owner Console</b><small>${esc((S.settings && S.settings.shopName) || 'Café Amazon')}</small></span></div>
    <h4>Super Advance IT · ระบบหลังร้าน</h4>${nav.map(ocNav).join('')}
    <div class="who">${esc(OC.me.name)} · ${esc(OC.me.roleName || OC.me.role)}<br><button class="btn sm" id="oc-out" style="margin-top:8px">ออกจากระบบ</button></div></aside>
    <main class="oc-main" id="oc-main">${main}</main></div>`;
  $('#oc-out').onclick = $('#oc-out2').onclick = () => { API.call('logout', { t: S.token }).catch(() => {}); if (typeof OWNER_PWA_LOCK !== 'undefined') OWNER_PWA_LOCK.logout(); S.token = ''; OC.me = null; SS.set(OC.tok, ''); ocLanding('ออกจากระบบแล้ว'); };
  function ocNav([k, l, ic, sh]) { return `<a href="#${k}" data-oc="${k}"${OC.view === k ? ' aria-current="page"' : ''}>${icon(ic)}<span class="l">${esc(l)}</span><span class="sh">${esc(sh)}</span></a>`; }
}
async function ocGo(view) {
  OC.view = view; clearInterval(OC.timer);
  if (location.hash !== '#' + view) history.replaceState(null, '', '#' + view);
  ocShell('<p class="loading">กำลังโหลด…</p>');
  try {
    if (view === 'home') { if (!OC.branches.length) { try { OC.branches = ((await API.call('staff', {})).branches || []); } catch (e) { /* */ } } ocMain(ocHome()); }
    if (view === 'it') {
      try { const c = JSON.parse(localStorage.getItem('amz.it.st') || 'null'); if (c && c.checks) { OC.status = c; ocMain(ocIt() + '<p class="muted">กำลังตรวจล่าสุด…</p>'); } } catch (e) { /* */ }
      OC.status = await ocCall('status'); try { localStorage.setItem('amz.it.st', JSON.stringify(OC.status)); } catch (e) { /* */ }
      if (OC.view === 'it') ocMain(ocIt());
      OC.aiData = typeof ocAiCollect === 'function' ? await ocAiCollect() : null;
      if (OC.view === 'it') ocMain(ocIt());
      OC.timer = setInterval(async () => {
        if (document.hidden || OC.view !== 'it' || OC.busy) return;
        try {
          OC.status = await ocCall('status');
          OC.aiData = typeof ocAiCollect === 'function' ? await ocAiCollect() : null;
          if (OC.view === 'it') ocMain(ocIt());
        } catch (e) { /* คงข้อมูลเดิมไว้เมื่อระบบสะดุด */ }
      }, 300000);
    }
    if (view === 'ai') {
      OC.status = await ocCall('status');
      OC.aiData = typeof ocAiCollect === 'function' ? await ocAiCollect() : null;
      if (OC.view === 'ai') ocMain(ocAiPage());
      OC.timer = setInterval(async () => {
        if (document.hidden || OC.view !== 'ai' || OC.busy) return;
        try {
          OC.status = await ocCall('status');
          OC.aiData = typeof ocAiCollect === 'function' ? await ocAiCollect() : null;
          if (OC.view === 'ai') ocMain(ocAiPage());
        } catch (e) { /* keep last successful snapshot */ }
      }, 300000);
    }
    if (view === 'dash') { OC.dash = await ocCall('dash', { days: OC.days || 30 }); ocMain(ocDash()); }
    if (view === 'perf') { OC.perf = await ocCall('perf'); ocMain(ocPerf()); }
    if (view === 'events') { OC.events = (await ocCall('events')).events; ocMain(ocEvents()); }
    if (view === 'auth') { OC.auth = await ocCall('authList'); ocMain(ocAuth()); }
    if (view === 'control') { await ocControlLoad(); }
    if (view === 'network') {
      if (typeof ocNetworkLoad === 'function') {
        await ocNetworkLoad();
        OC.timer = setInterval(async () => {
          if (document.hidden || OC.view !== 'network' || OC.busy || !ITN.data) return;
          // itnAutoRefresh เก็บสิ่งที่กำลังดูอยู่และตำแหน่งเลื่อนจอไว้ และคงภาพเดิมเมื่อเน็ตสะดุด
          try { await itnAutoRefresh(); } catch (e) { /* retain last verified snapshot on temporary monitor failure */ }
        }, 300000);
      } else ocMain('<p class="status bad">ไม่พบ AI Network module</p>');
    }
    if (view === 'links') { if (typeof ocLinksLoad === 'function') await ocLinksLoad(); else ocMain('<p class="status bad">ไม่พบ Link Map module</p>'); }
  } catch (e) {
    if (e.code === 'SESSION') {
      // คงหน้า Owner Console ไว้ ไม่เปลี่ยนไปหน้า Login อัตโนมัติระหว่างงานกำลังทำงาน
      const isApp = typeof OWNER_PWA_LOCK !== 'undefined' && OWNER_PWA_LOCK.active();
      ocMain(`<div class="status bad"><b>การเชื่อมต่อเซสชันสะดุด</b><p>หน้านี้ยังไม่ถูกปิด ระบบไม่ได้พาไปหน้าเข้าสู่ระบบอัตโนมัติ</p><button class="btn primary" type="button" data-oc-session-retry="${esc(view)}">${isApp ? 'ปลดล็อกและเชื่อมต่อใหม่' : 'เข้าสู่ระบบอีกครั้ง'}</button></div>`);
      return;
    }
    if (e.code === 'PERM') {
      ocMain(`<p class="status bad">บัญชีนี้ไม่มีสิทธิ์ดำเนินการในเมนูนี้ กรุณาตรวจสอบสิทธิ์กับผู้ดูแลระบบ</p>`);
      return;
    }
    ocMain(`<p class="status bad">${esc(e.message)}</p>`);
  }
}
const ocMain = h => { const m = $('#oc-main'); if (m) m.innerHTML = h; };

/* ---------- 1) ระบบเข้าร้าน ---------- */
function ocHome() {
  const brs = (OC.branches || []).filter(b => b.code);
  return `<h1>ระบบเข้าร้าน</h1><p class="muted">ทางเข้าทุกระบบของร้าน</p>
  <div class="oc-cards" style="margin-top:14px">
    <a class="oc-card" href="index.html?from=owner"><b>หลังร้าน (Back Office)</b><span>อนุมัติ ตารางงาน เวลาทำงาน เงินเดือน สต็อก บัญชี ตั้งค่า</span></a>
    <a class="oc-card" href="clock.html"><b>ลงเวลา (Time Clock)</b><span>พนักงานลงเวลา ขอลา ขอ OT แลกกะ</span></a>
    <a class="oc-card" href="index.html?from=owner#fin"><b>Finance & Accounting</b><span>รายรับ รายจ่าย คู่ค้า การชำระเงิน ภาษี และบัญชี</span></a>
    <a class="oc-card" href="#it" data-oc="it"><b>Super Advance IT</b><span>ตรวจ ซ่อม และเร่งความเร็วทุกระบบอัตโนมัติ</span></a>
  </div>
  ${brs.length ? `<h3 class="h3">แท็บเล็ตประจำสาขา (เปิดค้างไว้ที่ร้าน)</h3><div class="oc-cards">${brs.map(b => `<a class="oc-card" href="clock.html?branch=${encodeURIComponent(b.code)}"><b>${esc(b.name || b.code)}</b><span>clock.html?branch=${esc(b.code)}</span></a>`).join('')}</div>` : ''}`;
}
/* ---------- 2) Super Advance IT ---------- */
function ocIt() {
  if (!OC.status || !OC.status.checks) return '<p class="loading">กำลังตรวจ…</p>';
  const s = OC.status, bad = s.checks.filter(c => c.status === 'bad').length, warn = s.checks.filter(c => c.status === 'warn').length;
  const ok = s.checks.length - bad - warn, areas = [...new Set(s.checks.map(c => c.area))];
  const col = s.score >= 85 ? '#1D7A4E' : s.score >= 60 ? '#C29A3E' : '#A23B2A';
  return `<section class="oc-it-hero">
    <div class="oc-it-hero-copy"><span class="oc-it-eyebrow">OWNER CONSOLE · IT OPERATIONS</span>
      <h1>Super Advance IT</h1>
      <p>ศูนย์ควบคุมและดูแลระบบหลังร้าน ตรวจสอบสุขภาพระบบ ซ่อมแซมอัตโนมัติ และติดตามประสิทธิภาพจากทุกอุปกรณ์</p>
      <div class="oc-it-meta"><span>อัปเดตล่าสุด ${esc(s.at)}</span><span>เวลาตรวจ ${s.ms} ms</span><span>ตรวจซ้ำอัตโนมัติทุก 5 นาที</span></div>
    </div>
    <div class="oc-it-orbit"><span class="oc-it-orbit-label">SYSTEM HEALTH</span><strong>${s.score}</strong><small>/ 100</small><span class="oc-it-health">${s.score >= 85 ? 'ระบบทำงานปกติ' : s.score >= 60 ? 'ควรตรวจสอบบางรายการ' : 'พบรายการผิดปกติ'}</span></div>
  </section>
  <section class="oc-it-summary" aria-label="สรุปสถานะระบบ">
    <article class="oc-it-stat"><span class="oc-it-stat-icon good">✓</span><div><strong>${ok}</strong><span>รายการปกติ</span></div></article>
    <article class="oc-it-stat"><span class="oc-it-stat-icon warn">!</span><div><strong>${warn}</strong><span>ควรตรวจสอบ</span></div></article>
    <article class="oc-it-stat"><span class="oc-it-stat-icon bad">×</span><div><strong>${bad}</strong><span>ผิดปกติ</span></div></article>
    <article class="oc-it-stat"><span class="oc-it-stat-icon total">⌁</span><div><strong>${s.checks.length}</strong><span>รายการตรวจทั้งหมด</span></div></article>
  </section>
  <section class="oc-it-actions"><div><b>เครื่องมือดูแลระบบ</b><span>สั่งตรวจ ซ่อม และเพิ่มความเร็วได้จากหน้านี้</span></div>
    <div class="actions"><button class="btn primary" data-heal="__all">ซ่อมทั้งหมดอัตโนมัติ</button><button class="btn" data-oc="it">ตรวจใหม่</button><button class="btn" data-heal="warm">เร่งความเร็วระบบ</button><button class="btn" data-heal="cacheReset">ล้างแคชทั้งหมด</button></div>
  </section>
  <div class="oc-it-section-head"><div><span>LIVE DIAGNOSTICS</span><h2>ผลการตรวจสอบระบบ</h2><p>แสดงรายละเอียดแยกตามหมวดงาน พร้อมสถานะและคำแนะนำการแก้ไข</p></div><span class="oc-it-live"><i></i> AUTO MONITORING</span></div>
  ${areas.map(a => `<h3 class="h3">${esc(a)}</h3><div class="group">${s.checks.filter(c => c.area === a).map(c => `<div class="row static">${ocDot(c.status)}<span class="main"><span class="t">${esc(c.name)}</span><span class="s">${esc(c.detail)}</span></span>${ocChip(c.status)}${c.fix && c.status !== 'ok' ? `<button class="btn sm" data-heal="${esc(c.fix.code)}"${c.fix.arg ? ` data-arg='${esc(JSON.stringify(c.fix.arg))}'` : ''}>${esc(c.fix.label)}</button>` : ''}</div>`).join('')}</div>`).join('')}
  <h3 class="h3">เหตุการณ์ล่าสุด</h3>${ocEventList(s.events)}`;
}
function ocAiPage() {
  const html = '<h1>🧠 AI Monitoring · Advanced</h1><p class="muted">วิเคราะห์สุขภาพระบบจาก 4 แหล่งข้อมูล: IT Status, Performance, Event History และ Incident Dashboard ย้อนหลัง 7 วัน · รีเฟรชอัตโนมัติทุก 5 นาทีขณะเปิดหน้านี้</p>' + (typeof ocAiPanelHtml === 'function' ? ocAiPanelHtml() : '<p class="status bad">ไม่พบ Diagnostic Engine</p>') + (typeof ocOpsPanelHtml === 'function' ? ocOpsPanelHtml() : '');
  setTimeout(() => { if (typeof ocOpsCheck === 'function' && OC.view === 'ai') ocOpsCheck(); }, 0);
  return html;
}
function ocEventList(L) {
  return `<div class="group">${(L || []).map(e => `<div class="row static">${ocDot(e.kind === 'alert' ? 'bad' : e.kind === 'heal' ? 'ok' : 'warn')}<span class="main"><span class="t">${esc(e.title)}</span><span class="s">${esc(e.at)}${e.auto ? ' · อัตโนมัติ' : ''}${e.detail ? ' · ' + esc(e.detail) : ''}</span></span></div>`).join('') || empty('ยังไม่มีเหตุการณ์')}</div>`;
}
function ocPerf() {
  const r = OC.perf.rows;
  return `<h1>ความเร็ว</h1><p class="muted">คำสั่งที่ใช้เวลานาน (เก็บทุกครั้งที่ช้าเกิน 4 วินาที และสุ่มคำสั่งปกติ) · ทั้งฝั่ง Google และที่หน้าเว็บรอจริง · ${OC.perf.samples} ตัวอย่างใน 6 ชม.</p>
  <div class="actions"><button class="btn primary" data-heal="warm">เร่งความเร็วตอนนี้</button><button class="btn" data-oc="perf">โหลดใหม่</button></div>
  <div class="group" style="overflow:auto"><table class="oc-tbl"><thead><tr><th>คำสั่ง</th><th>วัดที่</th><th class="n">ครั้ง</th><th class="n">เฉลี่ย</th><th class="n">95%</th><th class="n">ช้าสุด</th><th class="n">ผิดพลาด</th></tr></thead><tbody>
  ${r.map(x => `<tr><td>${esc(ocName(x.action))}</td><td>${esc(x.via)}</td><td class="n">${x.n}</td><td class="n">${(x.avg / 1000).toFixed(1)} วิ</td><td class="n"${x.p95 > 4000 ? ' style="color:#A23B2A;font-weight:600"' : ''}>${(x.p95 / 1000).toFixed(1)} วิ</td><td class="n">${(x.max / 1000).toFixed(1)} วิ</td><td class="n">${x.fail || ''}</td></tr>`).join('') || `<tr><td colspan="7">${empty('ยังไม่มีข้อมูล')}</td></tr>`}</tbody></table></div>`;
}
const OC_NAMES = { bootstrap: 'เปิดหน้าหลังร้าน', delta: 'อัปเดตสด', resume: 'เปิดซ้ำ (F5)', login: 'เข้าสู่ระบบ', clock: 'ลงเวลา', my: 'ข้อมูลของฉัน', myRequest: 'ส่งคำขอ (ลา/OT/แก้เวลา/แลกกะ)', write: 'บันทึกข้อมูล', liffLogin: 'เข้าผ่าน LINE', 'post:write': 'บันทึกข้อมูลใหญ่', history: 'ดูเดือนเก่า' };
const ocName = a => OC_NAMES[a] ? `${OC_NAMES[a]} (${a})` : a;
function ocEvents() { return `<h1>เหตุการณ์</h1><p class="muted">ทุกการตรวจ/ซ่อม/แจ้งเตือน ทั้งที่ระบบทำเองและที่คนกด (6 ชม. ล่าสุด · รายการซ่อมบันทึกใน Audit log ถาวร)</p>${ocEventList(OC.events)}`; }
function ocAuth() {
  const A = OC.auth, opts = Object.entries(A.methods);
  const ready = r => r.authMethod === 'totp' ? (r.hasTotp ? 'ผูกแอปแล้ว' : 'รอผูกครั้งแรก') : r.authMethod === 'passkey' ? (r.passkeyN ? `ลงทะเบียน ${r.passkeyN} เครื่อง` : 'รอลงทะเบียนเครื่อง') : r.authMethod === 'line' ? (r.line ? 'ผูก LINE แล้ว' : 'ยังไม่ผูก LINE (เข้าไม่ได้)') : '';
  return `<h1>วิธีเข้าระบบ</h1><p class="muted">กำหนดรายบัญชี ใช้กับการเข้าผ่านลิงก์เว็บ (หลังร้าน / หน้าลงเวลาบนเบราว์เซอร์) · เปิดจาก LINE ไม่ต้องใส่รหัส · เปลี่ยนแล้วเจ้าตัวต้องเข้าระบบใหม่ด้วยวิธีใหม่</p>
  <div class="group">${A.rows.map(r => `<div class="row static" data-acc="${esc(r.id)}"><span class="main"><span class="t">${esc(r.name)} <span class="muted">(${esc(r.username)})</span>${r.status === 'disabled' ? ' <span class="chip bad">ปิดใช้งาน</span>' : ''}</span><span class="s">${esc(ready(r))}</span></span>
    <select data-am aria-label="วิธีเข้าระบบของ ${esc(r.name)}"${r.id === 'owner' && OC.me.role !== 'owner' ? ' disabled' : ''}>${opts.map(([k, l]) => `<option value="${k}"${r.authMethod === k ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select>
    <label class="muted" style="font-size:12px;display:flex;gap:4px;align-items:center"><input type="checkbox" data-ar>ล้างการผูก</label>
    <button class="btn sm" data-as${r.id === 'owner' && OC.me.role !== 'owner' ? ' disabled' : ''}>บันทึก</button></div>`).join('')}</div>
  <p class="note">ลืม/เครื่องหาย: ติ๊ก "ล้างการผูก" แล้วบันทึก เข้าครั้งถัดไปผูกใหม่ · Owner ล็อกตัวเอง: เปิด Apps Script แล้วรัน <b>resetOwnerAuth</b></p>`;
}

/* ---------- แดชบอร์ดปัญหารายวัน ---------- */
const OC_KIND = { error: ['ข้อผิดพลาด', 'bad'], alert: ['แจ้งเตือน Owner', 'bad'], heal: ['ซ่อมแล้ว', 'ok'], speed: ['เร่งความเร็ว', 'ok'], auth: ['วิธีเข้าระบบ', 'warn'], detect: ['พบปัญหา', 'warn'] };
function ocDays(from, to) { const out = []; for (let d = from; d <= to; d = addDays(d, 1)) out.push(d); return out; }
function ocDayStat(D, d) {
  const L = D.logs.filter(x => x.date === d), day = D.daily.find(x => x.date === d);
  const prob = L.filter(x => x.kind === 'error' || x.kind === 'alert').reduce((s, x) => s + x.count, 0) + (day ? day.bad + day.warn : 0);
  const fixed = L.filter(x => x.kind === 'heal' || x.kind === 'speed').reduce((s, x) => s + x.count, 0);
  return { d, L, day, prob, fixed, score: day ? day.score : null };
}
function ocMenuCount(D, d, k) {
  const L = D.logs.filter(x => x.date === d && x.menu === k && x.kind !== 'heal' && x.kind !== 'speed').reduce((s, x) => s + x.count, 0);
  const day = D.daily.find(x => x.date === d), m = day && day.menus[k];
  return L + (m ? (m.bad || 0) + (m.warn || 0) : 0);
}
function ocDash() {
  const D = OC.dash, days = ocDays(D.from, D.to), stats = days.map(d => ocDayStat(D, d)), T = stats[stats.length - 1];
  const sel = OC.dsel || D.to, S0 = stats.find(x => x.d === sel) || T, menu = OC.dmenu || '';
  const maxV = Math.max(1, ...stats.map(x => x.prob + x.fixed)), W = 720, H = 150, bw = W / days.length;
  const bars = stats.map((x, i) => { const hp = x.prob / maxV * (H - 20), hf = x.fixed / maxV * (H - 20), X = i * bw + 2;
    return `<g data-dday="${x.d}" style="cursor:pointer"><rect x="${X}" y="0" width="${bw - 4}" height="${H}" fill="${x.d === sel ? '#E3EEE7' : 'transparent'}"/><rect x="${X}" y="${H - hp - hf}" width="${bw - 4}" height="${hf}" fill="#7FB89A"/><rect x="${X}" y="${H - hp}" width="${bw - 4}" height="${hp}" fill="${x.prob ? '#C0563F' : 'transparent'}"/><title>${thDate(x.d)}: ปัญหา ${x.prob} · ซ่อมเอง ${x.fixed}${x.score != null ? ' · คะแนน ' + x.score : ''}</title></g>`; }).join('');
  const pts = stats.map((x, i) => x.score == null ? null : `${i * bw + bw / 2},${H - x.score / 100 * (H - 10)}`).filter(Boolean).join(' ');
  const last14 = days.slice(-14);
  const heat = D.menus.map(m => { const cells = last14.map(d => ocMenuCount(D, d, m.key)), tot = cells.reduce((a, b) => a + b, 0);
    return { m, cells, tot }; }).filter(r => r.tot || OC.dall);
  const items = [...S0.L.filter(x => !menu || x.menu === menu).map(x => ({ t: x.title, s: `${x.at} · ${(OC_KIND[x.kind] || [x.kind])[0]}${x.count > 1 ? ' · ' + x.count + ' ครั้ง' : ''}${x.auto ? ' · ระบบทำเอง' : ''}${x.detail ? ' · ' + x.detail : ''}`, st: (OC_KIND[x.kind] || [0, 'warn'])[1], menu: x.menu })),
    ...((S0.day && S0.day.problems) || []).filter(x => !menu || x.menu === menu).map(x => ({ t: x.name, s: 'ตรวจพบตอนสรุป ' + (S0.day.at || '') + (x.detail ? ' · ' + x.detail : ''), st: x.status, menu: x.menu }))];
  const mName = k => (D.menus.find(m => m.key === k) || { name: k }).name;
  return `<h1>แดชบอร์ดปัญหารายวัน</h1><p class="muted">ทุกปัญหาที่พบ ซ่อมเอง และแจ้งเตือน แยกตามเมนูของร้าน (ระบบที่เพิ่มในอนาคตขึ้นเอง) · ${thDate(D.from)} – ${thDate(D.to)}</p>
  <div class="actions" style="margin-top:6px">${[7, 30, 90].map(n => `<button class="btn sm${(OC.days || 30) === n ? ' primary' : ''}" data-drange="${n}">${n} วัน</button>`).join('')}<span class="grow"></span><button class="btn sm" data-dcopy>📋 คัดลอกรายงาน (ส่งให้ผู้พัฒนา/Claude)</button></div>
  <div class="kpis" style="margin:10px 0"><div class="kpi ${T.score == null ? '' : T.score >= 85 ? 'ok' : T.score >= 60 ? 'warn' : 'bad'}"><b>${T.score == null ? '–' : T.score}</b><span>คะแนนวันนี้</span></div>
    <div class="kpi ${T.prob ? 'warn' : 'ok'}"><b>${T.prob}</b><span>ปัญหาวันนี้</span></div><div class="kpi ok"><b>${T.fixed}</b><span>ระบบซ่อมเองวันนี้</span></div>
    <div class="kpi"><b>${stats.reduce((s, x) => s + x.prob, 0)}</b><span>ปัญหา ${D.days} วัน</span></div></div>
  <h3 class="h3">ปัญหา (แดง) · ซ่อมเอง (เขียว) · คะแนน (เส้น) — แตะวันเพื่อดูรายละเอียด</h3>
  <div class="group pad" style="overflow-x:auto"><svg viewBox="0 0 ${W} ${H + 18}" style="width:100%;min-width:480px;height:auto" role="img" aria-label="กราฟปัญหารายวัน">${bars}${pts ? `<polyline points="${pts}" fill="none" stroke="#17694A" stroke-width="2"/>` : ''}
    ${stats.map((x, i) => (i % Math.ceil(days.length / 10) === 0 || i === days.length - 1) ? `<text x="${i * bw + bw / 2}" y="${H + 14}" font-size="10" text-anchor="middle" fill="#5B675F">${+x.d.slice(8)}/${+x.d.slice(5, 7)}</text>` : '').join('')}</svg></div>
  <h3 class="h3">แยกตามเมนู (14 วันล่าสุด) <button class="btn sm" data-dall style="margin-left:8px">${OC.dall ? 'ซ่อนเมนูที่ไม่มีปัญหา' : 'แสดงทุกเมนู'}</button></h3>
  <div class="group" style="overflow-x:auto"><table class="oc-tbl"><thead><tr><th>เมนู</th>${last14.map(d => `<th class="n" style="font-weight:500">${+d.slice(8)}</th>`).join('')}<th class="n">รวม</th></tr></thead><tbody>
  ${heat.map(r => `<tr data-dmenu="${r.m.key}" style="cursor:pointer${menu === r.m.key ? ';background:#E3EEE7' : ''}"><td>${esc(r.m.name)}</td>${r.cells.map(v => `<td class="n" style="background:${v ? `rgba(192,86,63,${Math.min(0.85, 0.15 + v / 8)})` : 'transparent'};color:${v > 4 ? '#fff' : 'inherit'}">${v || ''}</td>`).join('')}<td class="n"><b>${r.tot}</b></td></tr>`).join('') || `<tr><td colspan="16">${empty('ไม่พบปัญหาในช่วงนี้ 🎉')}</td></tr>`}</tbody></table></div>
  <h3 class="h3">รายละเอียด ${thDate(S0.d, { weekday: 'long', day: 'numeric', month: 'short' })}${menu ? ' · ' + esc(mName(menu)) + ' <button class="btn sm" data-dmenu="">ทุกเมนู</button>' : ''}</h3>
  <div class="group">${items.map(x => `<div class="row static">${ocDot(x.st)}<span class="main"><span class="t">${esc(x.t)} <span class="chip">${esc(mName(x.menu))}</span></span><span class="s">${esc(x.s)}</span></span></div>`).join('') || empty('ไม่มีปัญหาในวันนี้')}</div>
  <p class="note">ข้อมูลเก็บถาวรในไฟล์ระบบหลัก ชีต "IT เหตุการณ์" และ "IT สรุปรายวัน" (ย้อนหลัง 180 วัน) · สรุปเองทุกวัน 23:00 และทุกครั้งที่เปิดหน้า "ตรวจ & ซ่อม"</p>`;
}
function ocReport() {
  const D = OC.dash, days = ocDays(Calc.addDays(D.to, -6), D.to), mName = k => (D.menus.find(m => m.key === k) || { name: k }).name;
  let t = `รายงานปัญหาระบบ ${(S.settings && S.settings.shopName) || 'Café Amazon'} ${days[0]} ถึง ${D.to} (Super Advance IT)\n`;
  days.forEach(d => {
    const x = ocDayStat(D, d); if (!x.L.length && !(x.day && x.day.problems.length)) return;
    t += `\n[${d}] คะแนน ${x.score == null ? '-' : x.score} · ปัญหา ${x.prob} · ซ่อมเอง ${x.fixed}\n`;
    x.L.forEach(l => { t += `- ${l.at} ${mName(l.menu)} | ${(OC_KIND[l.kind] || [l.kind])[0]} | ${l.title}${l.count > 1 ? ' x' + l.count : ''}${l.detail ? ' | ' + l.detail : ''}\n`; });
    (x.day ? x.day.problems : []).forEach(p => { t += `- ตรวจพบ ${mName(p.menu)} | ${p.status === 'bad' ? 'ผิดปกติ' : 'ควรดู'} | ${p.name}${p.detail ? ' | ' + p.detail : ''}\n`; });
  });
  return t;
}

/* ---------- ปุ่ม ---------- */
document.addEventListener('click', async e => {
  const aiRunNow = e.target.closest('[data-ai-run-now]');
  if (aiRunNow) {
    aiRunNow.disabled = true;
    const oldLabel = aiRunNow.textContent;
    aiRunNow.textContent = 'กำลังตรวจระบบ…';
    try {
      await ocAiRunBackgroundNow();
      OC.aiData = typeof ocAiCollect === 'function' ? await ocAiCollect() : null;
      if (OC.view === 'ai') ocMain(ocAiPage()); else if (OC.view === 'it') ocMain(ocIt());
      toast('ตรวจระบบเบื้องหลังและบันทึกผลแล้ว');
    } catch (err) { toast(err.message || 'ตรวจระบบไม่สำเร็จ'); }
    finally { aiRunNow.disabled = false; aiRunNow.textContent = oldLabel; }
    return;
  }
  const aiRefresh = e.target.closest('[data-ai-refresh]');
  if (aiRefresh) {
    aiRefresh.disabled = true;
    try {
      OC.aiData = typeof ocAiCollect === 'function' ? await ocAiCollect() : null;
      if (OC.view === 'ai') ocMain(ocAiPage()); else if (OC.view === 'it') ocMain(ocIt());
      toast('วิเคราะห์ข้อมูลระบบล่าสุดแล้ว');
    } catch (err) { toast(err.message || 'วิเคราะห์ข้อมูลไม่สำเร็จ'); }
    return;
  }
  const sessionRetry = e.target.closest('[data-oc-session-retry]');
  if (sessionRetry) {
    e.preventDefault();
    const view = sessionRetry.dataset.ocSessionRetry || OC.view || 'dash';
    if (typeof OWNER_PWA_LOCK !== 'undefined' && OWNER_PWA_LOCK.active()) {
      if (await OWNER_PWA_LOCK.restore()) return ocGo(view);
      return; // ยกเลิกปลดล็อกแล้วคงหน้าเดิม
    }
    OC.after = view;
    return ocLogin('เซสชันหมดอายุ กรุณาเข้าสู่ระบบเพื่อทำงานต่อ');
  }
  const land = e.target.closest('[data-land]');
  if (land) { e.preventDefault(); if (OC.me) return ocGo('dash'); if (typeof OWNER_PWA_LOCK !== 'undefined' && OWNER_PWA_LOCK.active()) { if (await OWNER_PWA_LOCK.restore()) { try { OC.me = await API.call('me', { t: S.token }); return ocGo('dash'); } catch (x) { /* */ } } return; } OC.after = 'dash'; return ocLogin(); }
  const dd = e.target.closest('[data-dday]'); if (dd) { OC.dsel = dd.dataset.dday; return ocMain(ocDash()); }
  const dm = e.target.closest('[data-dmenu]'); if (dm) { OC.dmenu = dm.dataset.dmenu; return ocMain(ocDash()); }
  if (e.target.closest('[data-dall]')) { OC.dall = !OC.dall; return ocMain(ocDash()); }
  const dr = e.target.closest('[data-drange]'); if (dr) { OC.days = Number(dr.dataset.drange); OC.dsel = ''; return ocGo('dash'); }
  if (e.target.closest('[data-dcopy]')) { const txt = ocReport(); try { await navigator.clipboard.writeText(txt); toast('คัดลอกรายงานแล้ว วางในแชตกับผู้พัฒนา/Claude ได้เลย'); } catch (x) { openSheet(`<h3>รายงานปัญหา</h3><textarea style="width:100%;height:50vh">${esc(txt)}</textarea><div class="actions"><span class="grow"></span><button class="btn" onclick="closeSheet()">ปิด</button></div>`); } return; }
  const nav = e.target.closest('[data-oc]');
  if (nav) { e.preventDefault(); return ocGo(nav.dataset.oc); }
  const h = e.target.closest('[data-heal]');
  if (h) {
    OC.busy = true;
    try {
      if (h.dataset.heal === '__all') {
        const r = await busy(h, () => ocCall('healAll'), 'กำลังซ่อม…');
        toast(r.done.length ? 'ทำแล้ว: ' + r.done.join(' · ') : 'ไม่มีอะไรต้องซ่อม');
        OC.status = await ocCall('status'); ocMain(ocIt());
        if (r.queued) setTimeout(() => { if (OC.view === 'it') ocGo('it'); }, 75000);
      } else {
        const r = await busy(h, () => ocCall('heal', { code: h.dataset.heal, arg: h.dataset.arg || '' }), 'กำลังทำ…');
        toast(r.message);
        if (r.queued) setTimeout(() => { if (OC.view === 'it' || OC.view === 'perf') ocGo(OC.view); }, 75000);
        if (OC.view === 'it') { OC.status = await ocCall('status'); ocMain(ocIt()); }
        if (OC.view === 'perf') { OC.perf = await ocCall('perf'); ocMain(ocPerf()); }
      }
    } catch (err) { toast(err.message); } finally { OC.busy = false; }
    return;
  }
  const sv = e.target.closest('[data-as]');
  if (sv) {
    const row = sv.closest('[data-acc]'), id = row.dataset.acc, m = row.querySelector('[data-am]').value, reset = row.querySelector('[data-ar]').checked;
    try { OC.auth = await busy(sv, () => ocCall('authSet', { row: JSON.stringify({ id, authMethod: m, reset }) }), '…'); ocMain(ocAuth()); toast('บันทึกวิธีเข้าระบบแล้ว'); }
    catch (err) { toast(err.message); }
  }
});
window.addEventListener('hashchange', () => { const v = location.hash.slice(1); if (OC.me && v && v !== OC.view) ocGo(v); else if (!OC.me && !v) ocLanding(); });

(async function ocBoot() {
  loadCfg();
  try { applyTheme(cachedTheme()); } catch (e) { /* */ }
  S.token = SS.get(OC.tok);
  // แอป Owner ที่ตั้งรหัสปลดล็อกแล้ว: เปิดแอปใส่รหัส 6 หลักก่อน (owner-pwa-lock.js) ไม่ต้องเข้าระบบ/Authenticator ซ้ำ
  if (typeof OWNER_PWA_LOCK !== 'undefined' && OWNER_PWA_LOCK.active()) await OWNER_PWA_LOCK.boot();
  const want = location.hash.slice(1);
  const app = typeof OWNER_PWA_LOCK !== 'undefined' && OWNER_PWA_LOCK.standalone();
  if (!S.token && app && OWNER_PWA_LOCK.needSetup()) { OC.after = '__land'; return ocLogin('ครั้งแรกบนเครื่องนี้: เข้าสู่ระบบ แล้วตั้งรหัส 6 หลัก ครั้งต่อไปใช้รหัสอย่างเดียว'); }
  if (!S.token) { if (want && want !== 'home') { OC.after = want; return ocLogin(); } return ocLanding(); }   // หน้าหลักไม่ต้องเข้าระบบ
  try { const me = await API.call('me', { t: S.token }); if (!ocCan(me)) return ocLanding('แอปนี้ใช้ได้เฉพาะบัญชี Owner'); OC.me = me; if (app && !want) return ocLanding(); ocGo(want || 'dash'); }
  catch (e) { S.token = ''; SS.set(OC.tok, ''); ocLanding(e.code === 'SESSION' ? 'หมดเวลาการใช้งาน กดเมนูเพื่อเข้าสู่ระบบใหม่' : e.message); }
})();
