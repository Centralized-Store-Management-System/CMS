/* แอป Owner (ติดตั้งบนมือถือ): ปลดล็อกด้วยรหัส 6 หลักแบบแอปธนาคาร — ใช้กลไกเดียวกับแอปพนักงาน (ผูกเครื่องที่เซิร์ฟเวอร์ 60_OwnerAppLock.gs)
 * - ครั้งแรก: เข้าด้วย owner + PIN + Authenticator (ตามเดิม) → ตั้งรหัส 6 หลัก → เซิร์ฟเวอร์ออกกุญแจเครื่อง (devReg app=owner)
 * - กุญแจเครื่องเก็บในเครื่องแบบเข้ารหัส AES-256-GCM (key จาก PBKDF2-SHA256 310,000 รอบ + salt/IV สุ่ม) · ไม่เก็บรหัส/PIN ตัวจริง
 * - ครั้งต่อไป: เปิดแอป → ใส่รหัส → ถอดกุญแจในเครื่อง → devUnlock (เซิร์ฟเวอร์ตรวจกุญแจ + รหัสอีกชั้น) → ได้ session ใหม่ ไม่ต้อง Authenticator
 * - ไม่หมดเวลา: session หมดอายุระหว่างใช้ → ขอใหม่เงียบๆ ด้วยรหัสที่ใส่ไว้ (ถ้าเปลี่ยนหน้าแล้วไม่มีในหน่วยความจำ → ถามรหัสอีกครั้ง)
 * - ออกจากแอปเกิน 1 นาทีแล้วกลับมา → ล็อก · ผิด 5 ครั้ง พัก 5 นาที · ผิดรวม 10 ครั้ง ลบกุญแจในเครื่อง (เข้าด้วยชื่อผู้ใช้ใหม่)
 * - เน็ตหลุด: แจ้งเตือน ไม่ลบกุญแจ · Owner ยกเลิกเครื่องได้ที่ ระบบ IT > วิธีเข้าระบบ
 * ทำงานเฉพาะแอปที่ติดตั้ง (หรือ ?app=1 ทดสอบบนคอม): owner.html และหน้า "จัดการร้าน" ที่เปิดจากแอป Owner · เว็บปกติ / Staff / Mgr / LINE ไม่เปลี่ยน */
'use strict';
const OWNER_PWA_LOCK = (() => {
  const KEY = 'amz.owner.pwa.v2', OLD = 'amz.owner.pwa.v1', FAIL = 'amz.owner.pwa.fail.v2', UNL = 'amz.owner.unlocked';
  const ITER = 310000, LOCK_AFTER = 60e3, COOL = 5 * 60e3, WIPE = 10;
  try { localStorage.removeItem(OLD); localStorage.removeItem('amz.owner.pwa.fail.v1'); } catch (_) { /* กุญแจรุ่นเก่า (เก็บ token) เลิกใช้ */ }
  try { if (/[?&]app=1/.test(location.search)) sessionStorage.setItem('amz.appmode', '1'); } catch (_) { /* */ }
  const onOwnerPage = /owner\.html$/.test(location.pathname);
  const fromOwner = () => { try { return sessionStorage.getItem('amz.fromOwner') === '1' || /[?&]from=owner/.test(location.search); } catch (_) { return false; } };
  const standalone = () => { try { if (sessionStorage.getItem('amz.appmode') === '1') return true; } catch (_) { /* */ }
    return (typeof PWA !== 'undefined' && !!PWA.standalone) || (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true; };
  const b64 = a => btoa(String.fromCharCode(...new Uint8Array(a)));
  const un64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  const enc = new TextEncoder(), dec = new TextDecoder();
  const read = () => { try { const v = JSON.parse(localStorage.getItem(KEY) || 'null'); return v && v.v === 2 ? v : null; } catch (_) { return null; } };
  const hasVault = () => !!read();
  const cryptoOk = () => !!(window.crypto && crypto.subtle);
  const active = () => standalone() && cryptoOk() && hasVault();   // กุญแจนี้มีเฉพาะเครื่องที่ Owner ผูกไว้
  const fails = () => { try { return JSON.parse(localStorage.getItem(FAIL) || 'null') || { n: 0, until: 0 }; } catch (_) { return { n: 0, until: 0 }; } };
  const setFails = f => { try { f && (f.n || f.until) ? localStorage.setItem(FAIL, JSON.stringify(f)) : localStorage.removeItem(FAIL); } catch (_) { /* */ } };
  const devName = () => { const u = navigator.userAgent; return (/iPhone/.test(u) ? 'iPhone' : /iPad/.test(u) ? 'iPad' : /Android/.test(u) ? 'Android' : /Windows/.test(u) ? 'Windows' : /Mac/.test(u) ? 'Mac' : 'อุปกรณ์') + ' · แอป Owner'; };
  const h = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  let mem = null, hiddenAt = 0, renewing = null, busyUnlock = false;
  const call0 = API.call.bind(API);   // เรียกตรง (ไม่ผ่านตัวต่ออายุด้านล่าง)

  /* ---------- เข้ารหัสกุญแจเครื่อง ---------- */
  async function derive(pin, salt) {
    const base = await crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: ITER, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  }
  async function seal(creds, pin, name) {
    const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
    const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await derive(pin, salt), enc.encode(JSON.stringify(creds)));
    localStorage.setItem(KEY, JSON.stringify({ v: 2, kdf: 'PBKDF2-SHA256-' + ITER, salt: b64(salt), iv: b64(iv), data: b64(data), name: name || 'Owner', at: Date.now() }));
  }
  async function unseal(pin) {   // รหัสผิด → AES-GCM ถอดไม่ได้ (throw)
    const v = read(); if (!v) throw new Error('ไม่พบกุญแจในเครื่อง');
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: un64(v.iv) }, await derive(pin, un64(v.salt)), un64(v.data));
    const c = JSON.parse(dec.decode(plain)); c.pin = pin; return c;
  }
  function setTok(t) {
    S.token = t;
    SS.set('amz.it.tok', t); SS.set('amz.tok', t);   // หน้า Owner และหน้าจัดการร้าน ใช้ session เดียวกัน
    SS.set(UNL, t ? '1' : '');
  }
  function wipe(msg) {   // ลบกุญแจในเครื่อง (+ ยกเลิกที่เซิร์ฟเวอร์ถ้ารู้กุญแจ)
    if (mem) call0('devForget', { id: mem.id, secret: mem.secret }).catch(() => {});
    mem = null;
    try { localStorage.removeItem(KEY); localStorage.removeItem(FAIL); } catch (_) { /* */ }
    SS.set(UNL, '');
    if (msg && typeof toast === 'function') toast(msg);
  }

  /* ---------- หน้าจอรหัส (เต็มจอ) ---------- */
  const st = document.createElement('style');
  st.textContent = [
    '#owner-lock{position:fixed;inset:0;z-index:10000;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;padding:24px 16px calc(24px + env(safe-area-inset-bottom));background:linear-gradient(160deg,#17694A,#0E3F2C);color:#fff;font-family:var(--font,system-ui);-webkit-user-select:none;user-select:none}',
    '#owner-lock .ol-mark{width:56px;height:56px;border-radius:16px;background:#C29A3E;color:#10392A;display:grid;place-items:center;font:600 20px var(--display,system-ui)}',
    '#owner-lock .ol-t{font-size:20px;font-weight:600;text-align:center}#owner-lock .ol-s{font-size:14px;opacity:.85;margin-top:-8px;text-align:center;max-width:320px}',
    '#owner-lock .ol-dots{display:flex;gap:16px;margin:6px 0;min-height:18px;align-items:center}#owner-lock .ol-dots i{width:14px;height:14px;border-radius:50%;border:2px solid rgba(255,255,255,.85)}#owner-lock .ol-dots i.on{background:#fff}',
    '#owner-lock .ol-msg{min-height:20px;font-size:14px;color:#FFE1A8;text-align:center;max-width:320px}',
    '#owner-lock .ol-pad{display:grid;grid-template-columns:repeat(3,72px);gap:12px 24px}',
    '#owner-lock .ol-pad button{width:72px;height:72px;border-radius:50%;border:0;background:rgba(255,255,255,.14);color:#fff;font-size:27px;font-family:inherit;cursor:pointer;-webkit-tap-highlight-color:transparent;touch-action:manipulation}',
    '#owner-lock .ol-pad button:active{background:rgba(255,255,255,.32)}#owner-lock .ol-pad button.ol-x{background:transparent;font-size:14px}#owner-lock .ol-pad button:disabled{opacity:.35}',
    '#owner-lock .ol-alt{background:transparent;border:1px solid rgba(255,255,255,.4);color:#fff;border-radius:999px;padding:8px 16px;font:inherit;font-size:14px;cursor:pointer}',
    '#owner-lock.ol-shake .ol-dots{animation:olshake .35s}@keyframes olshake{25%{transform:translateX(-10px)}50%{transform:translateX(10px)}75%{transform:translateX(-6px)}}',
    '#owner-lock .ol-spin{width:26px;height:26px;border:3px solid rgba(255,255,255,.35);border-top-color:#fff;border-radius:50%;animation:olspin .8s linear infinite}@keyframes olspin{to{transform:rotate(360deg)}}'
  ].join('');
  document.head.appendChild(st);

  /** แสดงหน้ารหัส: onCode(code) คืน true = ปิด, ข้อความ = แสดงแล้วให้ใส่ใหม่ · alt = ปุ่มล่าง [ข้อความ, fn] */
  function pad({ title, sub, msg, left, alt, onCode }) {
    let el = document.getElementById('owner-lock');
    if (!el) { el = document.createElement('div'); el.id = 'owner-lock'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); document.body.appendChild(el); }
    let code = '', working = false;
    const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'L', '0', 'del'];
    el.innerHTML = `<div class="ol-mark">CA</div><div class="ol-t">${h(title)}</div><div class="ol-s">${h(sub || '')}</div>
      <div class="ol-dots" aria-hidden="true">${'<i></i>'.repeat(6)}</div><div class="ol-msg" role="status" aria-live="polite">${h(msg || '')}</div>
      <div class="ol-pad">${keys.map(k => k === 'L' ? (left ? `<button class="ol-x" data-ol="L">${h(left[0])}</button>` : '<span></span>') : k === 'del' ? '<button class="ol-x" data-ol="del" aria-label="ลบ">⌫</button>' : `<button data-ol="${k}">${k}</button>`).join('')}</div>
      ${alt ? `<button class="ol-alt" data-ol="alt">${h(alt[0])}</button>` : ''}`;
    const dots = () => el.querySelectorAll('.ol-dots i').forEach((x, i) => x.classList.toggle('on', i < code.length));
    const say = m => { const x = el.querySelector('.ol-msg'); if (x) x.textContent = m || ''; };
    const spin = on => { el.querySelector('.ol-pad').style.visibility = on ? 'hidden' : ''; el.querySelector('.ol-dots').innerHTML = on ? '<div class="ol-spin"></div>' : '<i></i>'.repeat(6); };
    const shake = () => { el.classList.remove('ol-shake'); void el.offsetWidth; el.classList.add('ol-shake'); };
    const ctl = { el, say, disable: on => el.querySelectorAll('.ol-pad button').forEach(b => { if (!b.classList.contains('ol-x')) b.disabled = on; }) };
    const press = async k => {
      if (working) return;
      if (k === 'L') return left && left[1](ctl);
      if (k === 'alt') return alt && alt[1](ctl);
      if (k === 'del') { code = code.slice(0, -1); return dots(); }
      if (!/^\d$/.test(k) || code.length >= 6) return;
      code += k; dots();
      if (code.length < 6) return;
      working = true; spin(true);
      let r; try { r = await onCode(code, ctl); } catch (e) { r = (e && e.message) || 'ทำไม่สำเร็จ'; }
      working = false;
      if (r === true) return;
      if (!document.getElementById('owner-lock')) return;
      spin(false); code = ''; dots(); if (r) { say(r); shake(); }
    };
    el.onclick = e => { const b = e.target.closest('[data-ol]'); if (b && !b.disabled) { e.preventDefault(); press(b.dataset.ol); } };
    el._key = e => { if (/^\d$/.test(e.key)) press(e.key); else if (e.key === 'Backspace') press('del'); };
    return ctl;
  }
  document.addEventListener('keydown', e => { const el = document.getElementById('owner-lock'); if (el && el._key) el._key(e); });
  const close = () => { const el = document.getElementById('owner-lock'); if (el) el.remove(); };

  /* ---------- ถามรหัสแล้วถอดกุญแจในเครื่อง (ไม่ต้องใช้เน็ต) ---------- */
  function askUnlock(msg, opts = {}) {
    return new Promise(resolve => {
      const v = read();
      const lockedMsg = f => 'ใส่รหัสผิดหลายครั้ง รออีก ' + Math.ceil((f.until - Date.now()) / 60e3) + ' นาที';
      const ctl = pad({
        title: (opts.title || 'ปลดล็อกแอป Owner'), sub: 'สวัสดี ' + ((v && v.name) || 'Owner') + ' · ใส่รหัส 6 หลัก', msg,
        left: ['ลืมรหัส', () => { close(); wipe('ลบรหัสปลดล็อกในเครื่องแล้ว เข้าด้วยชื่อผู้ใช้ + PIN แล้วตั้งรหัสใหม่'); resolve({ forgot: true }); }],
        alt: opts.cancel ? ['เข้าด้วยชื่อผู้ใช้ + PIN', () => { close(); resolve(null); }] : null,
        onCode: async code => {
          const f = fails();
          if (f.until > Date.now()) return lockedMsg(f);
          try {
            const c = await unseal(code);
            setFails(null);
            if (opts.keepOpen) return opts.keepOpen(c, ctl, () => resolve(c));
            close(); resolve(c); return true;
          } catch (_) {
            f.n = (f.n || 0) + 1;
            if (f.n >= WIPE) { setFails(null); close(); wipe('ใส่รหัสผิด ' + WIPE + ' ครั้ง ลบรหัสปลดล็อกในเครื่องแล้ว เข้าด้วยชื่อผู้ใช้ + PIN'); resolve({ forgot: true }); return true; }
            if (f.n % 5 === 0) { f.until = Date.now() + COOL; setFails(f); ctl.disable(true); setTimeout(() => { ctl.disable(false); ctl.say(''); }, COOL); return lockedMsg(f); }
            setFails(f);
            return 'รหัสไม่ถูกต้อง (เหลือ ' + (5 - f.n % 5) + ' ครั้งก่อนพัก 5 นาที)';
          }
        }
      });
      const f = fails(); if (f.until > Date.now()) { ctl.say(lockedMsg(f)); ctl.disable(true); setTimeout(() => { ctl.disable(false); ctl.say(''); }, f.until - Date.now()); }
    });
  }
  /** ถอดกุญแจแล้วขอ session จากเซิร์ฟเวอร์ — เน็ตหลุดแจ้งในหน้าเดิม ไม่ลบกุญแจ */
  function unlockFlow(msg, opts = {}) {
    if (busyUnlock) return Promise.resolve(false);
    busyUnlock = true;
    return askUnlock(msg, { ...opts, keepOpen: async (c, ctl, done) => {
      try {
        const r = await call0('devUnlock', { id: c.id, secret: c.secret, code: c.pin });
        if (!r || r.role !== 'owner' || !r.token) throw new Error('บัญชีนี้ไม่ใช่ Owner');
        mem = c; setTok(r.token); close(); done(c); return true;
      } catch (e) {
        if (e && e.code === 'DEVICE') { close(); wipe(e.message); done({ forgot: true }); return true; }
        return e && e.code ? e.message : 'เชื่อมต่อไม่ได้ ตรวจอินเทอร์เน็ตแล้วใส่รหัสอีกครั้ง (รหัสยังอยู่ในเครื่อง)';
      }
    } }).then(c => { busyUnlock = false; return !!(c && !c.forgot && S.token); });
  }
  async function renew() {   // session หมดอายุ: ขอใหม่เงียบๆ ถ้าจำรหัสไว้ ไม่งั้นถามรหัส
    if (renewing) return renewing;
    renewing = (async () => {
      if (mem) {
        try { const r = await call0('devUnlock', { id: mem.id, secret: mem.secret, code: mem.pin }); setTok(r.token); return r.token; }
        catch (e) { if (e && e.code === 'DEVICE') { wipe(e.message); return ''; } if (e && e.code !== 'SESSION' && !/รหัส/.test(e.message || '')) throw e; mem = null; }
      }
      return (await unlockFlow('หมดเวลาการใช้งาน ใส่รหัสเพื่อใช้งานต่อ', { cancel: true })) ? S.token : '';
    })();
    try { return await renewing; } finally { renewing = null; }
  }

  /* ---------- ต่อเข้ากับระบบเดิม ---------- */
  const NO_RENEW = { login: 1, auth2: 1, devUnlock: 1, devReg: 1, devForget: 1, logout: 1, ping: 1 };
  API.call = async function (action, params = {}) {
    try { return await call0(action, params); }
    catch (e) {
      if (!e || e.code !== 'SESSION' || NO_RENEW[action] || !params || !params.t || !active()) throw e;
      const t = await renew();
      if (!t) throw e;
      return call0(action, { ...params, t });
    }
  };
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { hiddenAt = Date.now(); return; }
    if (!active() || !S.token || !hiddenAt || Date.now() - hiddenAt < LOCK_AFTER || document.getElementById('owner-lock')) return;
    hiddenAt = 0;
    askUnlock('', { title: 'แอปถูกล็อก' }).then(c => { if (c && c.forgot) { setTok(''); location.reload(); } else if (c) mem = c; });
  });
  // หน้า Owner → จัดการร้าน: ส่ง session ไปด้วย ไม่ต้องเข้าระบบซ้ำ
  if (onOwnerPage) document.addEventListener('click', e => { const a = e.target.closest('a[href^="index.html"]'); if (a && S.token && SS.get(UNL) === '1') SS.set('amz.tok', S.token); }, true);

  // หน้าจัดการร้าน (เปิดจากแอป Owner): ไม่มี session → ปลดล็อกด้วยรหัส แทนหน้าเข้าระบบ
  if (!onOwnerPage && typeof renderLogin === 'function') {
    const login0 = renderLogin;
    let skip = false;
    const tryUnlock = msg => unlockFlow(msg, { cancel: true }).then(ok => { if (ok) location.reload(); else skip = true; });
    renderLogin = function (msg) { login0(msg); if (!skip && active() && !busyUnlock) tryUnlock(/หมดเวลา/.test(msg || '') ? 'หมดเวลาการใช้งาน ใส่รหัสเพื่อใช้งานต่อ' : ''); };
    if (active() && !S.token) tryUnlock('');
    // Owner เข้าหน้าจัดการร้านในแอปที่ติดตั้ง (ยังไม่มีรหัส) → ชวนตั้งรหัสหลังเข้าระบบสำเร็จ ครั้งเดียวต่อการเปิดแอป
    const it = setInterval(() => {
      if (!standalone() || !cryptoOk() || hasVault()) return;
      if (!S.token || !S.me || S.me.role !== 'owner' || document.querySelector('.scrim') || document.getElementById('owner-lock')) return;
      if (SS.get('amz.owner.ask') === '1') return clearInterval(it);
      SS.set('amz.owner.ask', '1'); clearInterval(it);
      enroll(S.token);
    }, 1500);
  }

  /* ---------- สำหรับ owner.js ---------- */
  /** เปิดแอป: ปลดล็อกแล้วในรอบนี้ (ยังไม่ปิดแอป) → ใช้ต่อ · ไม่งั้นต้องใส่รหัส */
  async function boot() {
    if (SS.get(UNL) === '1' && S.token) return true;
    setTok('');
    return unlockFlow('', { cancel: true });
  }
  /** หลังเข้าด้วยชื่อผู้ใช้ + PIN + Authenticator สำเร็จ: ชวนตั้งรหัส 6 หลัก */
  async function enroll(token) {
    if (!standalone() || !cryptoOk()) return false;
    try { if (!(await call0('devReg', { t: token, check: 1, app: 'owner' })).allowed) { if (typeof toast === 'function') toast('ยังตั้งรหัสปลดล็อกไม่ได้ (เซิร์ฟเวอร์ยังไม่อัปเดต) ลองปิดแอปแล้วเข้าใหม่'); return false; } }
    catch (e) { if (typeof toast === 'function') toast('ตั้งรหัสปลดล็อกไม่ได้: ' + (e.message || '')); return false; }
    return new Promise(resolve => {
      let first = '';
      const sub = 'ครั้งต่อไปเปิดแอปใส่รหัสนี้ เข้าได้ทันที ไม่ต้องใส่ชื่อผู้ใช้หรือ Authenticator';
      const ctl = pad({
        title: 'ตั้งรหัสปลดล็อกแอป Owner', sub, alt: ['ไว้ทีหลัง', () => { close(); resolve(false); }],
        onCode: async code => {
          if (!first) { first = code; ctl.el.querySelector('.ol-t').textContent = 'ใส่รหัสอีกครั้ง'; return ''; }
          if (code !== first) { first = ''; ctl.el.querySelector('.ol-t').textContent = 'ตั้งรหัสปลดล็อกแอป Owner'; return 'รหัสไม่ตรงกัน ตั้งใหม่'; }
          try {
            const r = await call0('devReg', { t: token, code, device: devName(), app: 'owner' });
            await seal({ id: r.id, secret: r.secret }, code, r.name);
            mem = { id: r.id, secret: r.secret, pin: code }; setFails(null); setTok(token);
            close(); if (typeof toast === 'function') toast('ตั้งรหัสแล้ว ครั้งต่อไปเปิดแอปใส่รหัสนี้ได้เลย'); resolve(true); return true;
          } catch (e) { first = ''; ctl.el.querySelector('.ol-t').textContent = 'ตั้งรหัสปลดล็อกแอป Owner'; return e && e.message ? e.message : 'ตั้งรหัสไม่สำเร็จ'; }
        }
      });
    });
  }
  /** ออกจากระบบ: ลบกุญแจในเครื่อง + ยกเลิกเครื่องที่เซิร์ฟเวอร์ */
  function clear() { wipe(''); }
  const restore = () => unlockFlow('', { cancel: true });
  return { standalone, hasVault, active, boot, enroll, restore, clear };
})();
