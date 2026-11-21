/* แอปพนักงาน: ปลดล็อกด้วยรหัส 6 หลักแบบแอปธนาคาร (48_AppLock.gs) — ทำงานเฉพาะเมื่อเปิดเป็นแอปที่ติดตั้ง (Staff / Manager) เว็บปกติไม่เปลี่ยน
 * - ครั้งแรก: เข้าด้วย ชื่อผู้ใช้ + PIN → ระบบชวนตั้งรหัสปลดล็อก 6 หลัก (ผูกเครื่องนี้)
 * - ครั้งต่อไป: เปิดแอป → หน้าล็อก → ใส่รหัส → เข้าได้ทันที · ตรวจรหัสในเครื่องก่อน (ไม่ต้องรอ) แล้วขอสิทธิ์จาก Google เบื้องหลัง
 * - ไม่หมดเวลา: การเข้าระบบหมดอายุ ต่ออายุเงียบๆ · ออกจากแอปเกิน 1 นาทีแล้วกลับมา → ล็อก (ใส่รหัสใหม่)
 * - ใส่ผิด 5 ครั้ง / Owner ยกเลิกเครื่องที่ระบบ IT → กลับไปเข้าด้วยชื่อผู้ใช้ + PIN
 * ทดสอบบนคอม: เปิดหน้าเว็บต่อท้าย ?app=1 */
'use strict';
(function () {
  const KEY = 'amz.dev', ASK = 'amz.devAsk', LOCK_AFTER = 60e3, ITER = 120000, ROLES = { staff: 1, manager: 1 };
  try { if (/[?&]app=1/.test(location.search)) sessionStorage.setItem('amz.appmode', '1'); } catch (e) { /* */ }
  const forced = (() => { try { return sessionStorage.getItem('amz.appmode') === '1'; } catch (e) { return false; } })();
  const isApp = forced || (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
  const fromOwner = (() => { try { return sessionStorage.getItem('amz.fromOwner') === '1' || /[?&]from=owner/.test(location.search); } catch (e) { return false; } })();
  if (!isApp || fromOwner || /[?&](lt|liff)=/.test(location.search)) return;   // เปิดจากแอป Owner: ไม่ใช้รหัสปลดล็อก
  window.AMZ_APP = true;   // ให้หน้าลงเวลารู้ว่าเปิดในแอป (clock-ux.js)
  const clockPage = typeof enterMe === 'function' && typeof C !== 'undefined';
  const dev = () => { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { return null; } };
  const setDev = d => { try { d ? localStorage.setItem(KEY, JSON.stringify(d)) : localStorage.removeItem(KEY); } catch (e) { /* */ } };
  const h = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  let mem = '', code = '', mode = '', working = false, fails = 0, hiddenAt = 0, unlocked = false;

  async function derive(pin, salt) {
    const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: new TextEncoder().encode(salt), iterations: ITER }, k, 256);
    return btoa(String.fromCharCode(...new Uint8Array(bits)));
  }
  const devName = () => { const u = navigator.userAgent; return (/iPhone/.test(u) ? 'iPhone' : /iPad/.test(u) ? 'iPad' : /Android/.test(u) ? 'Android' : /Windows/.test(u) ? 'Windows' : /Mac/.test(u) ? 'Mac' : 'อุปกรณ์') + ' · ' + (clockPage ? 'แอปลงเวลา' : 'แอปหลังร้าน'); };

  /* ---------- หน้าล็อก ---------- */
  const st = document.createElement('style');
  st.textContent = [
    '#applock{position:fixed;inset:0;z-index:9999;isolation:isolate;overflow:hidden;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:clamp(10px,1.8vh,18px);padding:24px 16px calc(24px + env(safe-area-inset-bottom));background:radial-gradient(ellipse at 82% 70%,rgba(77,174,112,.28),transparent 35%),linear-gradient(160deg,var(--brand),color-mix(in srgb,var(--brand) 70%,#000));color:#fff;font-family:var(--font);-webkit-user-select:none;user-select:none}#applock:before{content:"";position:absolute;z-index:-1;left:-8%;right:-8%;bottom:-3%;height:34%;opacity:.6;pointer-events:none;background:radial-gradient(ellipse at 12% 100%,rgba(116,190,88,.65) 0 8%,transparent 34%),radial-gradient(ellipse at 88% 88%,rgba(130,194,83,.58) 0 9%,transparent 33%),radial-gradient(ellipse at 58% 100%,rgba(25,113,72,.85) 0 12%,transparent 42%);filter:blur(2px);mask-image:linear-gradient(to top,#000 8%,transparent 100%)}#applock>*{position:relative;z-index:1}',
    '#applock .al-logo{width:76px;height:76px;border-radius:50%;overflow:hidden;background:rgba(255,255,255,.18);border:2px solid rgba(255,255,255,.45);display:grid;place-items:center;box-shadow:0 8px 26px rgba(0,25,15,.18)}#applock .al-logo img{width:100%;height:100%;object-fit:cover}#applock .al-logo .al-initial{font-size:24px;font-weight:600;color:#fff}',
    '#applock .al-hi{font-size:20px;font-weight:600;text-align:center}#applock .al-sub{font-size:14px;opacity:.85;margin-top:-10px;text-align:center}',
    '#applock .al-dots{display:flex;gap:16px;margin:6px 0}#applock .al-dots i{width:14px;height:14px;border-radius:50%;border:2px solid rgba(255,255,255,.85);transition:background .12s}#applock .al-dots i.on{background:#fff}',
    '#applock .al-msg{min-height:20px;font-size:14px;color:#FFE1A8;text-align:center}',
    '#applock .al-pad{display:grid;grid-template-columns:repeat(3,minmax(68px,72px));justify-content:center;gap:clamp(10px,1.8vh,16px) clamp(14px,4vw,24px);width:min(100%,290px)}',
    '#applock .al-pad button{width:100%;height:clamp(60px,8vh,72px);min-height:60px;border-radius:50%;border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.17);box-shadow:inset 0 1px 0 rgba(255,255,255,.22),0 7px 18px rgba(0,30,18,.12);color:#fff;font-size:clamp(27px,4vh,34px);font-family:inherit;font-weight:500;cursor:pointer;-webkit-tap-highlight-color:transparent;touch-action:manipulation;display:grid;place-items:center}',
    '#applock .al-pad button:active{background:rgba(255,255,255,.34);transform:scale(.96)}#applock .al-pad button.al-t{width:100%;height:clamp(60px,8.2vh,76px);min-height:60px;border-radius:22px;background:rgba(255,255,255,.13);border:1px solid rgba(255,255,255,.2);font-size:clamp(12px,1.8vh,14px);font-weight:500}#applock .al-pad button[data-al="back"]{font-size:clamp(22px,3vh,28px);font-weight:600}',
    '#applock.al-shake .al-dots{animation:alshake .35s}@keyframes alshake{25%{transform:translateX(-10px)}50%{transform:translateX(10px)}75%{transform:translateX(-6px)}}',
    '#applock .al-spin{width:28px;height:28px;border:3px solid rgba(255,255,255,.35);border-top-color:#fff;border-radius:50%;animation:alspin .8s linear infinite}@keyframes alspin{to{transform:rotate(360deg)}}'
  ].join('');
  st.textContent += '@media(max-height:700px){#applock{gap:8px;padding-top:12px;padding-bottom:calc(12px + env(safe-area-inset-bottom))}#applock .al-pad{gap:8px 18px}#applock .al-pad button{height:clamp(52px,7vh,62px);min-height:52px}#applock .al-pad button.al-t{height:54px;min-height:54px}}@media(min-width:700px){#applock .al-pad{width:300px;grid-template-columns:repeat(3,76px);gap:14px 22px}#applock .al-pad button{height:76px}}';
  document.head.appendChild(st);

  function show(m, msg) {
    const d = dev(); if (!d) return;
    mode = m; code = ''; unlocked = false;
    let el = document.getElementById('applock');
    if (!el) { el = document.createElement('div'); el.id = 'applock'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'ปลดล็อกแอป'); document.body.appendChild(el); }
    const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'forget', '0', 'back'];
    const profile = d.photo ? `<img src="${h(d.photo)}" alt="รูปโปรไฟล์">` : `<span class="al-initial">${h(String(d.name || d.username || 'U').trim().split(/\s+/).slice(0,2).map(x=>x[0]||'').join('').toUpperCase())}</span>`;
    el.innerHTML = `<div class="al-logo">${profile}</div><div class="al-hi">สวัสดี ${h(d.name || d.username)}</div><div class="al-sub">ใส่รหัสปลดล็อกแอป 6 หลัก</div>
      <div class="al-dots">${'<i></i>'.repeat(6)}</div><div class="al-msg" id="al-msg">${h(msg || '')}</div>
      <div class="al-pad">${keys.map(k => k === 'forget' ? '<button class="al-t" data-al="forget">ลืมรหัส</button>' : k === 'back' ? '<button class="al-t" data-al="back" aria-label="ลบ">⌫</button>' : `<button data-al="${k}">${k}</button>`).join('')}</div>`;
    if (typeof API !== 'undefined') API.call('ping').catch(() => {});   // ปลุก Google ระหว่างพิมพ์รหัส
  }
  function hide() { const el = document.getElementById('applock'); if (el) el.remove(); mode = ''; unlocked = true; }
  function dots() { document.querySelectorAll('#applock .al-dots i').forEach((x, i) => x.classList.toggle('on', i < code.length)); }
  function say(m) { const x = document.getElementById('al-msg'); if (x) x.textContent = m || ''; }
  function shake() { const el = document.getElementById('applock'); if (!el) return; el.classList.remove('al-shake'); void el.offsetWidth; el.classList.add('al-shake'); }
  function spinning(on) { const p = document.querySelector('#applock .al-pad'); if (p) p.style.visibility = on ? 'hidden' : ''; if (on) say(''); const d = document.querySelector('#applock .al-dots'); if (d) d.innerHTML = on ? '<div class="al-spin"></div>' : '<i></i>'.repeat(6); }

  async function key(k) {
    if (working) return;
    if (k === 'forget') return forget();
    if (k === 'back') { code = code.slice(0, -1); return dots(); }
    if (code.length >= 6) return;
    code += k; dots();
    if (code.length === 6) setTimeout(submit, 60);
  }
  async function submit() {
    const d = dev(), c = code; if (!d) return hide();
    working = true;
    try {
      const ok = (await derive(c, d.salt)) === d.ph;
      if (!ok) {
        fails++; code = ''; dots(); shake();
        if (fails >= 5) { await forget(true, 'ใส่รหัสผิด 5 ครั้ง เข้าด้วยชื่อผู้ใช้ + PIN'); return; }
        return say('รหัสไม่ถูกต้อง (เหลือ ' + (5 - fails) + ' ครั้ง)');
      }
      fails = 0; mem = c;
      if (mode === 'resume' && S.token) return hide();   // ยังเข้าระบบอยู่: เปิดทันที ไม่ต้องรอ Google
      spinning(true);
      await open(c);
    } catch (e) {
      if (e && e.code === 'DEVICE') { working = false; return forget(true, e.message); }
      if (!document.getElementById('applock')) { working = false; return show('lock', e && e.message ? e.message : 'เชื่อมต่อไม่ได้ ลองใหม่'); }   // เปิดหน้าไปแล้วแต่รับสิทธิ์ไม่สำเร็จ → ล็อกใหม่
      spinning(false); code = ''; dots();
      say(e && e.message ? e.message : 'เชื่อมต่อไม่ได้ ลองใหม่');
    } finally { working = false; }
  }
  /** ขอสิทธิ์จาก Google ด้วยกุญแจเครื่อง + รหัส แล้วเข้าหน้าเดิม */
  /* ข้อมูลล่าสุดที่จำไว้ในเครื่อง (เปิดแอปครั้งถัดไปขึ้นทันที แล้วค่อยอัปเดตเฉพาะที่เปลี่ยน) */
  const BKEY = 'amz.dev.boot', MKEY = 'amz.dev.my';
  function memGet(k, maxAge) { try { const o = JSON.parse(localStorage.getItem(k) || 'null'), d = dev(); return o && d && o.dev === d.id && Date.now() - o.at < maxAge ? o.d : null; } catch (e) { return null; } }
  function memSet(k, v) { try { const d = dev(); if (d && v) localStorage.setItem(k, JSON.stringify({ dev: d.id, at: Date.now(), d: v })); } catch (e) { /* เต็ม: ข้าม */ } }
  function saveNow() {
    if (!dev() || !unlocked) return;
    if (clockPage) { if (C.my && C.step === 'me') { const m = { ...C.my }; delete m.tk; memSet(MKEY, m); } return; }
    try { const o = JSON.parse(sessionStorage.getItem('amz.boot') || 'null'); if (o && o.d) memSet(BKEY, o.d); } catch (e) { /* */ }
  }
  window.addEventListener('pagehide', saveNow);
  async function open(c) {
    const d = dev();
    if (clockPage) {
      const m = memGet(MKEY, 12 * 3600e3);
      if (m) {   // ขึ้นหน้าของฉันทันที แล้วรับสิทธิ์ + ข้อมูลล่าสุดเบื้องหลัง
        hide(); enterMe({ token: '', my: { ...m, lite: false } }); C.via = 'app';
        const r = await API.call('devUnlock', { id: d.id, secret: d.secret, code: c, my: 1 });
        S.token = r.token; setMy(r.my); if (C.step === 'me') render(); saveNow();
        return;
      }
      const r = await API.call('devUnlock', { id: d.id, secret: d.secret, code: c, my: 1 });
      hide(); enterMe({ token: r.token, my: r.my }); C.via = 'app'; saveNow();
      return;
    }
    const lb = memGet(BKEY, 24 * 3600e3);
    if (lb) {   // หลังร้าน: แสดงข้อมูลที่จำไว้ทันที → รับสิทธิ์ → ถามเฉพาะตารางที่เปลี่ยน
      hide(); await bootstrap({ ...lb, _cached: true });
      if (!location.hash || location.hash === '#') location.hash = visibleMods()[0] ? visibleMods()[0].key : 'menu';
      App.render();
      const r = await API.call('devUnlock', { id: d.id, secret: d.secret, code: c });
      S.token = r.token; SS.set('amz.tok', r.token);
      await (typeof fastResume === 'function' ? fastResume(lb) : bootstrap());
      if (!document.querySelector('.sheet')) App.render();
      saveNow();
      return;
    }
    const cached = typeof cachedBoot === 'function' ? cachedBoot() : null;
    const r = await API.call('devUnlock', { id: d.id, secret: d.secret, code: c, boot: cached ? '' : 1 });
    const b = r.boot; delete r.boot;
    S.token = r.token; S.me = r; SS.set('amz.tok', r.token);
    if (b) { await bootstrap(b); if (!location.hash || location.hash === '#') location.hash = visibleMods()[0] ? visibleMods()[0].key : 'menu'; App.render(); hide(); }
    else { const pb = boot(); hide(); await pb; }   // ข้อมูลที่จำไว้ขึ้นก่อน ไม่ต้องรออัปเดต
    saveNow();
  }
  async function renew() {   // หมดอายุระหว่างใช้งาน: ต่ออายุเงียบๆ ด้วยรหัสที่ใส่ไว้แล้ว
    if (working || !mem || !dev()) return show('lock');
    working = true;
    try { await open(mem); } catch (e) { if (e && e.code === 'DEVICE') { working = false; return forget(true, e.message); } show('lock', e && e.message); }
    finally { working = false; }
  }
  async function forget(silent, msg) {
    const d = dev();
    if (!silent && !confirmForget()) return;
    setDev(null); mem = ''; hide();
    if (d) API.call('devForget', { id: d.id, secret: d.secret }).catch(() => {});
    if (clockPage) { if (typeof backToWho === 'function' && C.step !== 'who') origBack(msg); else render(); }
    else origLogin(msg || 'เข้าด้วยชื่อผู้ใช้ + PIN แล้วตั้งรหัสปลดล็อกใหม่');
    if (msg && typeof toast === 'function') toast(msg);
  }
  let armed = 0;
  function confirmForget() { if (Date.now() - armed < 4000) return true; armed = Date.now(); say('แตะ "ลืมรหัส" อีกครั้ง เพื่อเข้าด้วยชื่อผู้ใช้ + PIN'); return false; }

  document.addEventListener('click', e => { const b = e.target.closest('#applock [data-al]'); if (b) { e.preventDefault(); key(b.dataset.al); } });
  document.addEventListener('keydown', e => { if (!document.getElementById('applock')) return; if (/^\d$/.test(e.key)) key(e.key); else if (e.key === 'Backspace') key('back'); });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { hiddenAt = Date.now(); saveNow(); return; }
    if (dev() && unlocked && hiddenAt && Date.now() - hiddenAt > LOCK_AFTER) show(S.token ? 'resume' : 'lock');
  });

  /* ---------- ต่อเข้ากับหน้าเดิม ---------- */
  const origLogin = typeof renderLogin === 'function' ? renderLogin : null;
  const origBack = typeof backToWho === 'function' ? backToWho : null;
  if (!clockPage && origLogin) {
    renderLogin = function (msg) { if (dev() && working) return; origLogin(msg); if (dev() && !document.getElementById('applock')) { if (mem) renew(); else show('lock'); } };   // ระหว่างปลดล็อก ไม่สลับไปหน้าเข้าระบบ
    if (typeof sessionLost === 'function') { const origLost = sessionLost; sessionLost = function (msg) { if (dev() && working) return; return origLost(msg); }; }
  }
  if (clockPage && origBack) {
    backToWho = function (note) { origBack(note); if (dev() && C.via !== 'line') show('lock'); };
    setInterval(() => { if (dev() && C.via === 'app' && !document.getElementById('applock')) C.idle = 0; }, 1000);   // แอป: ไม่ออกเองเพราะไม่มีการใช้งาน (ล็อกเมื่อออกจากแอปแทน)
  }
  // เปิดแอป: มีเครื่องที่ผูกไว้ → หน้าล็อกทันที
  if (dev()) show(S.token ? 'resume' : 'lock');

  /* ---------- ชวนตั้งรหัสปลดล็อกหลังเข้าด้วยชื่อผู้ใช้ + PIN ---------- */
  let asked = false;
  const later = () => { try { return Date.now() - Number(localStorage.getItem(ASK) || 0) < 3 * 864e5; } catch (e) { return false; } };
  setInterval(async () => {
    if (asked || dev() || !S.token || document.getElementById('applock') || document.querySelector('.sheet') || later()) return;
    if (clockPage) { if (C.step !== 'me' || C.via === 'line' || C.liff) return; }
    else if (!S.me || !ROLES[S.me.role] || !S.me.uid) return;
    asked = true;
    try { if (!(await API.call('devReg', { t: S.token, check: 1 })).allowed) return; }
    catch (e) { if (typeof toast === 'function') toast(/ไม่รู้จักคำสั่ง/.test(e.message || '') ? 'ตั้งรหัสปลดล็อกแอปไม่ได้: ระบบหลังบ้านยังไม่อัปเดต (Deploy เป็น New version)' : 'ตั้งรหัสปลดล็อกแอปไม่ได้: ' + (e.message || '')); return; }
    setup();
  }, 1500);
  function setup() {
    const sh = openSheet(`<h2 style="margin:0 0 6px">🔒 ตั้งรหัสปลดล็อกแอป</h2>
      <p class="muted" style="margin:0 0 12px">ครั้งต่อไปเปิดแอปแล้วใส่รหัส 6 หลักนี้ เข้าได้ทันทีเหมือนแอปธนาคาร ไม่ต้องพิมพ์ชื่อผู้ใช้ และไม่หมดเวลา · ใช้กับเครื่องนี้เท่านั้น</p>
      <div class="form"><div class="field"><label for="al-c1">รหัส 6 หลัก</label><input id="al-c1" type="password" inputmode="numeric" maxlength="6" autocomplete="off"></div>
      <div class="field"><label for="al-c2">ใส่อีกครั้ง</label><input id="al-c2" type="password" inputmode="numeric" maxlength="6" autocomplete="off"></div></div>
      <p class="err" id="al-err" role="alert"></p>
      <div class="actions"><button class="btn" data-al-later>ไว้ทีหลัง</button><span class="grow"></span><button class="btn primary" data-al-save>ตั้งรหัส</button></div>`);
    sh.querySelector('[data-al-later]').onclick = () => { try { localStorage.setItem(ASK, String(Date.now())); } catch (e) { /* */ } closeSheet(); };
    sh.querySelector('[data-al-save]').onclick = async ev => {
      const c1 = sh.querySelector('#al-c1').value.trim(), c2 = sh.querySelector('#al-c2').value.trim(), err = sh.querySelector('#al-err');
      if (!/^\d{6}$/.test(c1)) return (err.textContent = 'ใส่ตัวเลข 6 หลัก');
      if (c1 !== c2) return (err.textContent = 'รหัสทั้ง 2 ช่องไม่ตรงกัน');
      try {
        const r = await busy(ev.target, () => API.call('devReg', { t: S.token, code: c1, device: devName() }), 'กำลังตั้ง…');
        const salt = r.id + ':' + Math.random().toString(36).slice(2);
        setDev({ id: r.id, secret: r.secret, name: r.name, username: r.username, photo: (S.me && S.me.photo) || (C.my && C.my.photo) || '', salt, ph: await derive(c1, salt), at: Date.now() });
        mem = c1; unlocked = true; closeSheet();
        if (typeof toast === 'function') toast('ตั้งรหัสปลดล็อกแล้ว ครั้งต่อไปเปิดแอปใส่รหัสนี้ได้เลย');
      } catch (x) { err.textContent = x.message; }
    };
  }
})();
