/* โครงหน้าหลังร้าน: เข้าสู่ระบบ, เมนูจัดกลุ่มตามระบบ, สิทธิ์การมองเห็น, เส้นทางหน้า, บัญชีของฉัน */
'use strict';
const GROUPS = [['', ['today', 'dash', 'approve']], ['People', ['hr', 'sched', 'time', 'pay']], ['Operations', ['stock', 'acct']], ['System', ['users', 'admin', 'notify', 'design', 'set']]];
const SHORT = { today: 'Today', dash: 'Dashboard', approve: 'Approvals', sched: 'Schedule', time: 'Time', stock: 'Inventory', acct: 'Accounting', hr: 'HR', pay: 'Payroll' };
const NAV_ORDER = GROUPS.flatMap(g => g[1]);
const modBy = k => MODS.find(m => m.key === k);
const allowedSubs = m => (m.subs ? m.subs.filter(s => !s.perm || can(...s.perm)) : null);
const allowed = m => !!m && can(...m.perm) && (!m.subs || allowedSubs(m).length > 0);
const visibleMods = () => NAV_ORDER.map(modBy).filter(allowed);
const clockLink = (b = S.branch) => { const q = new URLSearchParams(); if (S.cfg.apiUrl) q.set('api', S.cfg.apiUrl); if (b) q.set('branch', b); const s = q.toString(); return 'clock.html' + (s ? '?' + s : ''); };
const branchPick = () => multiBranch() ? `<select class="brpick" aria-label="เลือกสาขา">${allBranch() || myBranches().length > 1 ? `<option value=""${!S.branch ? ' selected' : ''}>All branches</option>` : ''}${myBranches().map(b => `<option value="${esc(b.code)}"${S.branch === b.code ? ' selected' : ''}>${esc(b.name)}${b.status === 'ปิด' ? ' (ปิด)' : ''}</option>`).join('')}</select>` : '';

const App = {
  shellReady: false,
  render() {
    if (!S.me) return renderLogin();
    ensureShell();
    const [mk, sk] = location.hash.replace('#', '').split('/');
    const vis = visibleMods();
    let mod = mk === 'menu' ? { key: 'menu', mod: 'menu', label: 'All Menus', icon: 'menu', desc: 'ทุกระบบที่คุณมีสิทธิ์ใช้งาน' } : (vis.find(m => m.key === mk) || vis[0]);
    if (!mod) mod = { key: 'menu', mod: 'menu', label: 'All Menus', icon: 'menu', desc: '' };
    const subs = mod.key === 'menu' ? null : allowedSubs(mod);
    const sub = subs ? (subs.find(s => s.key === sk) || subs[0]) : null;
    S.route = { mod: mod.key, sub: sub && sub.key };
    document.body.dataset.mod = mod.mod;
    const showMonth = !!((sub && sub.month) || (!sub && mod.month));
    $('#tb-ic').innerHTML = icon(mod.icon);
    $('#tb-title').textContent = mod.label;
    $('#tb-shop').textContent = shopLabel();
    $$('.monthpick').forEach(i => { i.hidden = !showMonth; i.value = S.month; });
    const bp = mod.noBranch || mod.key === 'menu' ? '' : branchPick();
    $('#tb-br').innerHTML = bp;
    renderNav(mod.key);
    let h = `<div class="mhead"><span class="mi">${icon(mod.icon)}</span><h1>${esc(mod.label)}<small>${esc(mod.desc || '')}</small></h1>${bp}<input type="month" class="month monthpick" aria-label="เลือกเดือน" value="${S.month}"${showMonth ? '' : ' hidden'}></div>`;
    if (subs && subs.length > 1) h += `<nav class="tabs" aria-label="หมวดย่อย">${subs.map(s => `<a href="#${mod.key}/${s.key}"${s === sub ? ' aria-current="page"' : ''}>${esc(s.label)}</a>`).join('')}</nav>`;
    if (showMonth && typeof frozenMonth === 'function' && frozenMonth(S.month)) h += `<p class="frozen-note"><b>Freeze แล้ว</b><span>ข้อมูลเดือนนี้ปิดแล้ว ดูได้อย่างเดียว ถ้าจำเป็นต้องแก้ ให้ Owner กด Unfreeze ที่ System Admin > Freeze</span></p>`;
    try { h += mod.key === 'menu' ? viewMenu() : (sub ? sub.view() : mod.view()); }
    catch (e) { console.error(e); h += `<p class="note bad">แสดงหน้านี้ไม่ได้: ${esc(e.message)}</p>`; }
    $('#view').innerHTML = h;
  }
};
const shopLabel = () => (S.settings.shopName || 'Café Amazon') + (S.branch ? ' · ' + branchName(S.branch) : multiBranch() ? ' · All branches' : '') + (S.demo ? ' (Demo)' : '');
const brandTitle = () => parseTheme(S.settings.theme).title || 'Café Amazon';

function ensureShell() {
  if (App.shellReady && $('#view')) return;
  $('#root').innerHTML = `<div class="shell">
    <aside class="side" aria-label="เมนูระบบ"><div class="brand"><span class="logo" id="sb-logo"></span><span><b id="sb-title"></b><small id="sb-shop"></small></span></div><nav class="nav" id="nav"></nav><div class="userbox" id="userbox"></div></aside>
    <div class="col"><header class="topbar"><span class="mi" id="tb-ic"></span><div class="ttl"><small id="tb-shop"></small><h1 id="tb-title"></h1></div><span class="tools"><span id="tb-br"></span><input type="month" class="month monthpick" aria-label="เลือกเดือน"></span></header><main id="view"></main></div>
    <nav class="bottom" id="bottom" aria-label="เมนูหลัก"></nav></div>`;
  App.shellReady = true;
}
function navItem(m, cur, bottom) {
  const b = m.badge ? m.badge() : 0;
  const dot = b ? `<span class="dot" aria-label="${b} รายการ">${b > 99 ? '99+' : b}</span>` : '';
  if (bottom) return `<a href="#${m.key}" data-mod="${m.mod}"${cur === m.key ? ' aria-current="page"' : ''}>${icon(m.icon)}<span>${esc(m.short || m.label)}</span>${dot}</a>`;
  return `<a href="#${m.key}" data-mod="${m.mod}"${cur === m.key ? ' aria-current="page"' : ''}><span class="ic">${icon(m.icon)}</span>${esc(m.label)}${dot}</a>`;
}
function renderNav(cur) {
  const vis = visibleMods();
  $('#sb-shop').textContent = (S.branch ? branchName(S.branch) : multiBranch() ? 'All branches' : 'Back Office') + (S.demo ? ' (Demo)' : '');   // ชื่อร้านอยู่บรรทัดบนแล้ว แสดงแค่สาขา
  const th = parseTheme(S.settings.theme);
  $('#sb-logo').innerHTML = themeLogo(th, icon('cup'));
  $('#sb-logo').classList.toggle('has-img', !!th.logo);
  $('#sb-title').textContent = brandTitle();
  $('#nav').innerHTML = GROUPS.map(([g, keys]) => {
    const items = keys.map(modBy).filter(allowed);
    if (!items.length) return '';
    return (g ? `<h4>${g}</h4>` : '') + items.map(m => navItem(m, cur)).join('');
  }).join('') + (S.me.empId ? `<h4>My Workspace</h4><a href="${esc(clockLink())}" data-mod="time"><span class="ic">${icon('clock')}</span>Time Clock · ตารางของฉัน · ขอลา</a>` : '');
  $('#userbox').innerHTML = `<button class="userbtn" data-a="myAccount" title="บัญชีของฉัน">${avatar({ nickname: S.me.name })}<span class="main"><span class="t">${esc(S.me.name)}</span><span class="s">${esc(ROLE_NAME[S.me.role] || '')}${S.me.branch ? ' · ' + esc(branchName(S.me.branch)) : ''}</span></span></button><span class="mini"><button class="btn sm" data-a="refresh" title="โหลดข้อมูลล่าสุด">Refresh</button><button class="btn sm" data-a="logout">Sign out</button></span>`;
  const pri = ['today', 'approve', 'sched', 'time', 'stock', 'acct', 'hr', 'pay', 'dash'];
  const bottom = pri.map(k => vis.find(m => m.key === k)).filter(Boolean).slice(0, 4);
  let bh = bottom.map(m => navItem({ ...m, short: SHORT[m.key] }, cur, true)).join('');
  if (bottom.length < 4 && S.me.empId) bh += `<a href="${esc(clockLink())}" data-mod="time">${icon('clock')}<span>Clock</span></a>`;
  bh += `<a href="#menu" data-mod="menu"${cur === 'menu' ? ' aria-current="page"' : ''}>${icon('menu')}<span>Menu</span></a>`;
  $('#bottom').innerHTML = bh;
}
function viewMenu() {
  const vis = visibleMods();
  let h = GROUPS.map(([g, keys]) => {
    const items = keys.map(modBy).filter(allowed);
    if (!items.length) return '';
    return `<h3 class="h3">${g || 'Overview'}</h3><div class="tiles">${items.map(m => { let s = ''; try { s = m.summary ? m.summary() : m.desc; } catch (e) { s = m.desc; } return `<a class="tile" href="#${m.key}" data-mod="${m.mod}"><span class="mi">${icon(m.icon)}</span><span><b>${esc(m.label)}</b><span>${s}</span></span></a>`; }).join('')}</div>`;
  }).join('');
  if (!vis.length) h += '<p class="note">บัญชีนี้ยังไม่ได้รับสิทธิ์ใช้ระบบหลังร้าน ติดต่อ Owner หรือ Admin</p>';
  if (S.me.empId) h += `<h3 class="h3">My Workspace</h3><div class="tiles"><a class="tile" href="${esc(clockLink())}" data-mod="time"><span class="mi">${icon('clock')}</span><span><b>Time Clock</b><span>เข้า-ออกงาน ตารางของฉัน ขอลา แจ้งลืมลงเวลา</span></span></a></div>`;
  h += `<h3 class="h3">My Account</h3><div class="group"><div class="row">${avatar({ nickname: S.me.name })}<button class="rowmain" data-a="myAccount"><span class="main"><span class="t">${esc(S.me.name)} <span class="muted">${esc(S.me.code || '')}</span></span><span class="s">${esc(ROLE_NAME[S.me.role] || '')}${S.me.branch ? ' · ' + esc(branchName(S.me.branch)) : ''}, ดูแล${allBranch() ? 'ทุกสาขา' : myBranches().map(b => esc(b.name)).join(', ')}${S.demo ? ', Demo mode' : ''}</span></span></button><span class="mini"><button class="btn sm" data-a="refresh">Refresh</button><button class="btn sm" data-a="logout">Sign out</button></span></div></div>`;
  return h;
}

/* ===== เข้าสู่ระบบ ===== */
function renderLogin(msg) {
  App.shellReady = false;
  document.body.dataset.mod = 'dash';
  const th = applyTheme(cachedTheme());
  $('#root').innerHTML = `<section class="login"><div class="login-card">
    <div class="brand"><span class="logo${th.logo ? ' has-img' : ''}">${themeLogo(th, icon('cup'))}</span><span><b>${esc(th.title || 'Café Amazon')}</b><small>${esc(th.tagline || 'Back Office')}</small></span></div>
    <h2>Sign in</h2>
    <div class="form">
      <div class="field"><label for="lg-code">Username</label><input id="lg-code" autocomplete="username" autocapitalize="none" autocorrect="off" spellcheck="false" placeholder="เช่น staff_narong" value="${esc(LS.get('amz.lastCode', ''))}"></div>
      <div class="field"><label for="lg-pin">PIN</label><input id="lg-pin" type="password" inputmode="numeric" autocomplete="current-password" placeholder="PIN 6 หลัก"></div>
    </div>
    <p class="err" id="lg-err" role="alert">${esc(msg || '')}</p>
    <button class="btn primary big block" data-a="login">Sign in</button>
    <p class="login-alt"><button class="linkbtn" data-a="firstTime">เข้าใช้งานครั้งแรก</button></p>
    ${S.demo ? `<details class="demo-box" open><summary><span class="demo-flag">Demo</span> บัญชีทดลอง (ยังไม่ได้เชื่อม Google Sheet)</summary><div class="demo-pick"><button data-a="demoLogin:owner/1234"><b>Owner</b>ทุกระบบ</button><button data-a="demoLogin:admin_somchai/246810"><b>Admin</b>ดูแลระบบ</button><button data-a="demoLogin:hr_joy/888888"><b>HR</b>จอย</button><button data-a="demoLogin:mgr_nan/111111"><b>Manager</b>แนน B01</button><button data-a="demoLogin:mgr_oat/555555"><b>Manager</b>โอ๊ต B02</button><button data-a="demoLogin:staff_ton/222222"><b>Staff</b>ต้น</button><button data-a="demoSetup:staff_fai/123456"><b>ครั้งแรก</b>staff_fai</button></div></details>` : ''}
    ${/[?&]setup=1/.test(location.search) ? `<div class="group pad" style="margin-top:16px"><div class="form"><div class="field"><label for="c-api">URL ของ Apps Script Web App</label><input id="c-api" type="url" value="${esc(S.cfg.apiUrl || '')}" placeholder="https://script.google.com/macros/s/…/exec"><span class="help">เว้นว่าง = โหมดทดลอง</span></div></div><div class="actions" style="margin-bottom:0"><button class="btn" data-a="testApi">ทดสอบ</button><button class="btn primary" data-a="saveApi">บันทึก</button></div></div>` : ''}
  </div></section>`;
}
async function doLogin(code, pin, btn) {
  code = (code ?? $('#lg-code').value).trim(); pin = (pin ?? $('#lg-pin').value).trim();
  const err = $('#lg-err');
  if (!code || !pin) { err.textContent = 'ใส่ชื่อผู้ใช้หรือรหัสพนักงาน และ PIN'; return; }
  try {
    await busy(btn || $('[data-a="login"]'), async () => {
      const r = await API.call('login', { code, pin, from: 'หลังร้าน', boot: 1 });
      const boot = r.boot; delete r.boot;
      S.token = r.token; S.me = r;
      SS.set('amz.tok', r.token); LS.set('amz.lastCode', code);
      await bootstrap(boot);
    }, 'กำลังเข้าสู่ระบบ…');
    if (!location.hash || location.hash === '#') location.hash = visibleMods()[0] ? visibleMods()[0].key : 'menu';
    App.render();
  } catch (e) {
    S.token = ''; S.me = null;
    if (e.code === 'SETUP') return renderSetup(code, /^\d{6}$/.test(pin) ? pin : '', e.message);
    if (err.isConnected) err.textContent = e.message; else renderLogin(e.message);
  }
}
/* ตั้ง PIN ครั้งแรก: Owner/Admin สร้างชื่อผู้ใช้ให้ + รหัสเปิดใช้งาน เจ้าตัวตั้ง PIN 6 หลักเอง (Owner ไม่รู้ PIN) */
function renderSetup(code, setup, msg) {
  App.shellReady = false;
  const th = applyTheme(cachedTheme());
  $('#root').innerHTML = `<section class="login">
    <div class="brand"><span class="logo${th.logo ? ' has-img' : ''}">${themeLogo(th, icon('cup'))}</span><span><b>${esc(th.title || 'Café Amazon')}</b><small>${esc(th.tagline || 'Back Office')}</small></span></div>
    <h2>ตั้ง PIN ครั้งแรก</h2><p class="muted" style="margin:0 0 14px">ใส่ชื่อผู้ใช้ และรหัสเปิดใช้งาน 6 หลักที่ได้จาก Owner/Admin แล้วตั้ง PIN 6 หลักของคุณเอง PIN นี้ใช้ทั้งเข้าหลังร้านและลงเวลา ไม่มีใครรู้นอกจากคุณ</p>
    <div class="form">
      <div class="field half"><label for="su-code">ชื่อผู้ใช้</label><input id="su-code" autocomplete="username" autocapitalize="none" value="${esc(code || '')}" placeholder="เช่น staff_aabb"></div>
      <div class="field half"><label for="su-setup">รหัสเปิดใช้งาน</label><input id="su-setup" inputmode="numeric" maxlength="6" autocomplete="one-time-code" value="${esc(setup || '')}"></div>
      <div class="field half"><label for="su-pin">PIN ใหม่ 6 หลัก</label><input id="su-pin" type="password" inputmode="numeric" maxlength="6" autocomplete="new-password"></div>
      <div class="field half"><label for="su-pin2">ใส่ PIN ใหม่อีกครั้ง</label><input id="su-pin2" type="password" inputmode="numeric" maxlength="6" autocomplete="new-password"><span class="help">ห้ามเลขเรียง (123456) หรือเลขซ้ำ (111111)</span></div>
    </div>
    <div class="actions"><button class="btn primary big" data-a="doSetup">ตั้ง PIN และเข้าสู่ระบบ</button><button class="btn" data-a="backLogin">กลับไปหน้า Sign in</button></div><p class="err" id="lg-err" role="alert">${esc(msg || '')}</p>
    <p class="note">รหัสเปิดใช้งานใช้ได้ครั้งเดียว หมดอายุใน 7 วัน ถ้าหมดอายุหรือลืม PIN ให้ Owner/Admin กด "รีเซ็ตรหัส" ที่หน้า Users</p>
  </section>`;
  const first = ['#su-code', '#su-setup', '#su-pin'].map(x => $(x)).find(x => !x.value);
  if (first && matchMedia('(pointer:fine)').matches) first.focus();
}
async function doSetup(btn) {
  const v = id => $('#' + id).value.trim(), err = $('#lg-err');
  const code = v('su-code'), setup = v('su-setup'), pin = v('su-pin'), pin2 = v('su-pin2');
  if (!code || !/^\d{6}$/.test(setup)) { err.textContent = 'ใส่ชื่อผู้ใช้ และรหัสเปิดใช้งาน 6 หลัก'; return; }
  if (!/^\d{6}$/.test(pin)) { err.textContent = 'PIN ต้องเป็นตัวเลข 6 หลัก'; return; }
  if (pin !== pin2) { err.textContent = 'PIN ทั้ง 2 ช่องไม่ตรงกัน'; return; }
  try {
    await busy(btn, async () => {
      const r = await API.call('setupPin', { code, setup, pin, pin2, from: 'web' });
      S.token = r.token; S.me = r;
      SS.set('amz.tok', r.token); LS.set('amz.lastCode', code);
      await bootstrap();
    }, 'กำลังตั้ง PIN…');
    location.hash = visibleMods()[0] ? visibleMods()[0].key : 'menu';
    App.render(); toast('ตั้ง PIN เรียบร้อย ครั้งต่อไปเข้าด้วย ' + code + ' + PIN ของคุณ');
  } catch (e) { S.token = ''; S.me = null; err.textContent = e.message; }
}
async function logout() {
  const t = S.token;
  S.token = ''; S.me = null; SS.set('amz.tok', '');
  if (typeof forgetBoot === 'function') forgetBoot();
  TABLES.forEach(n => { S.t[n] = []; });
  location.hash = '';
  renderLogin();
  if (t) API.call('logout', { t }).catch(() => {});
}
function sessionLost(msg) { S.token = ''; S.me = null; SS.set('amz.tok', ''); closeSheet(); renderLogin(msg || 'หมดเวลาการใช้งาน กรุณาเข้าสู่ระบบใหม่'); }

/* ===== คำสั่งระดับแอป ===== */
Object.assign(ACT, {
  close: () => closeSheet(),
  login: (a, b) => doLogin(null, null, b),
  demoLogin: (a, b) => { const [c, p] = a.split('/'); $('#lg-code').value = c; $('#lg-pin').value = p; doLogin(c, p, b); },
  demoSetup: a => { const [c, s] = a.split('/'); renderSetup(c, s, 'Demo: รหัสเปิดใช้งานของ ' + c + ' คือ ' + s + ' ลองตั้ง PIN 6 หลักของคุณเอง'); },
  firstTime: () => renderSetup(($('#lg-code') || {}).value || '', '', ''),
  backLogin: () => renderLogin(),
  doSetup: (a, b) => doSetup(b),
  changePin: () => openChangePin(),
  logout: () => logout(),
  refresh: async (a, b) => { await busy(b, bootstrap, '…'); App.render(); toast('โหลดข้อมูลล่าสุดแล้ว'); },
  connToggle: () => { const c = $('#conn'); c.hidden = !c.hidden; },
  testApi: (a, b) => testApi(b), saveApi: () => saveApi(),
  myAccount: () => openMyAccount()
});

/* ===== บัญชีของฉัน: ข้อมูลบัญชี ผูก LINE รับแจ้งเตือน และการแสดงผลเฉพาะเครื่องนี้ ===== */
const LINE_EV = [['approvals', 'รายการรออนุมัติ (กดอนุมัติใน LINE ได้)', ['approve_time', 'approve_stock']], ['clockEx', 'ลงเวลาที่ผิดปกติ (สาย OT วันหยุด ต่างสาขา)', ['time', 'approve_time']], ['clock', 'ลงเวลาเข้า-ออกทุกครั้ง', ['time', 'approve_time']], ['daily', 'สรุปประจำวัน', ['*']]];
async function openMyAccount() {
  const me = S.me, pref = myThemePrefs();
  let line = null;
  try { line = await API.call('myLine', { t: S.token }); } catch (e) { line = null; }
  const ev = new Set(String((line && line.lineEvents) || '').split(',').filter(Boolean));
  const evs = LINE_EV.filter(x => can(...x[2]));
  const sh = openSheet(`<h3>My Account</h3>
    <div class="group"><div class="row static">${avatar({ nickname: me.name })}<span class="main"><span class="t">${esc(me.name)} <span class="muted">${esc(me.code || '')}</span></span><span class="s">${esc(ROLE_NAME[me.role] || '')} — ${esc(ROLE_DESC[me.role] || '')}, ดูแล${allBranch() ? 'ทุกสาขา' : myBranches().map(b => esc(b.name)).join(', ')}</span></span></div>
      ${me.uid === 'owner' ? '<div class="row static"><span class="main"><span class="t">PIN</span><span class="s">บัญชีหลัก owner เปลี่ยน PIN ที่ Apps Script (setOwnerPin)</span></span></div>' : '<button class="row" data-a="changePin"><span class="main"><span class="t">เปลี่ยน PIN</span><span class="s">PIN 6 หลักของคุณ ใช้ทั้งเข้าหลังร้านและลงเวลา</span></span><span class="v" aria-hidden="true">›</span></button>'}</div>
    ${line && line.ref ? `<h3 class="h3">LINE แจ้งเตือน</h3><div class="group pad">
      <p style="margin:0 0 8px">${line.linked ? '<span class="chip ok">ผูก LINE แล้ว</span>' : '<span class="chip warn">ยังไม่ได้ผูก LINE</span>'}${line.hasToken ? '' : ' <span class="chip">ร้านยังไม่ได้ตั้งค่า LINE OA</span>'}</p>
      ${evs.length ? `<div class="form"><div class="field"><span class="lbl">รับแจ้งเตือน</span><div class="days" id="ma-ev">${evs.map(([k, l]) => `<label><input type="checkbox" value="${k}"${ev.has(k) ? ' checked' : ''}><span>${l}</span></label>`).join('')}</div></div></div>` : ''}
      <div class="actions" style="margin-bottom:0"><button class="btn" data-act="code">${line.linked ? 'ผูก LINE ใหม่' : 'ขอรหัสผูก LINE'}</button>${evs.length ? '<button class="btn primary" data-act="saveEv">บันทึกการแจ้งเตือน</button>' : ''}${line.linked && can('settings', 'admin') ? '<button class="btn" data-act="test">ทดสอบส่ง</button>' : ''}</div>
      <p class="note ma-code" hidden></p></div>` : ''}
    <h3 class="h3">การแสดงผลเฉพาะเครื่องนี้</h3><div class="form">
      <div class="field half"><label for="ma-mode">โหมดสี</label><select id="ma-mode">${opts([['', 'ตามร้าน'], ['auto', 'ตามเครื่อง'], ['light', 'สว่าง'], ['dark', 'มืด']], pref.mode || '')}</select></div>
      <div class="field half"><label for="ma-scale">ขนาดตัวอักษร</label><select id="ma-scale">${opts([['', 'ตามร้าน'], ['s', 'เล็ก'], ['m', 'ปกติ'], ['l', 'ใหญ่'], ['xl', 'ใหญ่มาก']], pref.scale || '')}</select></div></div>
    <div class="actions"><span class="grow"></span><button class="btn" data-a="logout">Sign out</button><button class="btn primary" data-a="close">ปิด</button></div><p class="err" role="alert"></p>`);
  sh.addEventListener('change', e => { if (e.target.id === 'ma-mode' || e.target.id === 'ma-scale') { const p = { mode: $('#ma-mode', sh).value, scale: $('#ma-scale', sh).value }; setMyThemePrefs(p); applyTheme(S.settings.theme); } });
  sh.addEventListener('click', async e => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    try {
      if (b.dataset.act === 'code') {
        const r = await busy(b, () => API.call('lineLinkCode', { t: S.token }), '…');
        const box = $('.ma-code', sh); box.hidden = false;
        box.innerHTML = `เพิ่มเพื่อน LINE OA ของร้าน แล้วส่งข้อความ <b class="kcode">link ${esc(r.code)}</b> ภายใน ${r.minutes} นาที ระบบจะผูกบัญชีนี้ให้อัตโนมัติ (ส่งในกลุ่ม LINE ก็ได้ ถ้าอยากให้แจ้งเตือนเข้ากลุ่ม)`;
      }
      if (b.dataset.act === 'saveEv') { await busy(b, () => API.write({ op: 'myLine', row: { lineEvents: $$('#ma-ev input:checked', sh).map(x => x.value).join(',') } })); toast('บันทึกการแจ้งเตือนแล้ว'); }
      if (b.dataset.act === 'test') { await busy(b, () => API.write({ op: 'lineTest' }), 'กำลังส่ง…'); toast('ส่งข้อความทดสอบแล้ว ดูใน LINE'); }
    } catch (err) { showErr(sh, err.message); }
  });
}
function openChangePin() {
  const sh = openSheet(`<h3>เปลี่ยน PIN</h3><p class="muted">PIN ใหม่เป็นตัวเลข 6 หลัก ใช้ทั้งเข้าหลังร้านและลงเวลา ห้ามเลขเรียงหรือเลขซ้ำ</p>
    <div class="form"><div class="field"><label for="cp-old">PIN ปัจจุบัน</label><input id="cp-old" type="password" inputmode="numeric" maxlength="8" autocomplete="current-password"></div>
    <div class="field half"><label for="cp-pin">PIN ใหม่</label><input id="cp-pin" type="password" inputmode="numeric" maxlength="6" autocomplete="new-password"></div>
    <div class="field half"><label for="cp-pin2">ใส่ PIN ใหม่อีกครั้ง</label><input id="cp-pin2" type="password" inputmode="numeric" maxlength="6" autocomplete="new-password"></div></div>
    <div class="actions"><span class="grow"></span><button class="btn" data-a="close">ยกเลิก</button><button class="btn primary" data-act="save">เปลี่ยน PIN</button></div><p class="err" role="alert"></p>`);
  sh.addEventListener('click', async e => {
    const b = e.target.closest('[data-act="save"]'); if (!b) return;
    const v = id => $('#' + id, sh).value.trim();
    if (!/^\d{6}$/.test(v('cp-pin'))) return showErr(sh, 'PIN ใหม่ต้องเป็นตัวเลข 6 หลัก');
    if (v('cp-pin') !== v('cp-pin2')) return showErr(sh, 'PIN ใหม่ทั้ง 2 ช่องไม่ตรงกัน');
    try { await busy(b, () => API.write({ op: 'changePin', old: v('cp-old'), pin: v('cp-pin'), pin2: v('cp-pin2') })); closeSheet(); toast('เปลี่ยน PIN แล้ว ครั้งต่อไปใช้ PIN ใหม่'); }
    catch (err) { showErr(sh, err.message); }
  });
}
document.addEventListener('click', async e => {
  const el = e.target.closest('[data-a]'); if (!el) return;
  const [k, ...rest] = el.dataset.a.split(':'); const fn = ACT[k]; if (!fn) return;
  e.preventDefault();
  try { await fn(rest.join(':'), el); }
  catch (err) { console.error(err); if (err.code === 'SESSION') return sessionLost(err.message); toast(err.message || 'เกิดข้อผิดพลาด'); }
});
document.addEventListener('change', async e => {
  const t = e.target;
  try {
    if (t.classList.contains('monthpick')) { if (/^\d{4}-\d{2}$/.test(t.value)) await goMonth(t.value); return; }
    if (t.classList.contains('brpick')) { setBranch(t.value); App.render(); return; }
    if (t.dataset.ch) { S.f[t.dataset.ch] = t.value; App.render(); return; }
    if (t.dataset.file === 'roster' && t.files && t.files[0]) { await rosterFileChosen(t.files[0]); return; }
    if (t.dataset.photo && t.files && t.files[0]) {
      const url = await readPhoto(t.files[0], 256), box = t.closest('.photo-field');
      box.querySelector('input[type=hidden]').value = url;
      const img = box.querySelector('img'); img.src = url; img.hidden = false;
    }
  } catch (err) { toast(err.message); }
});
document.addEventListener('keydown', e => {
  if (e.key !== 'Enter') return;
  if (e.target.id === 'lg-pin' || e.target.id === 'lg-code') { const b = $('[data-a="login"]'); if (b) b.click(); }
  if (/^su-/.test(e.target.id)) { const b = $('[data-a="doSetup"]'); if (b) b.click(); }
});
window.addEventListener('hashchange', () => { closeSheet(); if (S.me) App.render(); });
window.addEventListener('unhandledrejection', e => { if (e.reason && e.reason.code === 'SESSION') sessionLost(e.reason.message); });

async function boot() {
  loadCfg();
  applyTheme(cachedTheme());
  S.token = SS.get('amz.tok');
  if (S.token) {
    const c = cachedBoot();
    if (c) {
      // ขึ้นทันทีจากข้อมูลที่จำไว้ แล้วโหลดของใหม่เบื้องหลัง
      await bootstrap({ ...c, _cached: true }); App.render();
      try { await (typeof fastResume === 'function' ? fastResume(c) : bootstrap()); if (!document.querySelector('.sheet')) App.render(); }   // fastload.js: ถามเฉพาะที่เปลี่ยน
      catch (e) { if (e.code === 'SESSION') { forgetBoot(); S.token = ''; S.me = null; SS.set('amz.tok', ''); return renderLogin('หมดเวลาการใช้งาน กรุณาเข้าสู่ระบบใหม่'); } }
      return;
    }
    $('#root').innerHTML = '<p class="loading">กำลังโหลดข้อมูล…</p>';
    try { await bootstrap(); }
    catch (e) { S.token = ''; S.me = null; SS.set('amz.tok', ''); return renderLogin(e.code === 'SESSION' ? 'หมดเวลาการใช้งาน กรุณาเข้าสู่ระบบใหม่' : e.message); }
  }
  App.render();
}
boot();
