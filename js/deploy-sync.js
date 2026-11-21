/* CMS Instant Deployment Engine
 * Detects a published build, waits for safe UI state, then activates it.
 * Never forces a reload while a form/dialog or a write operation is in progress.
 */
(function () {
  'use strict';
  if (window.__CMS_DEPLOY_SYNC__) return;
  const D = window.__CMS_DEPLOY_SYNC__ = {
    version: null, latest: null, checking: false, pendingWrites: 0,
    reloadQueued: false, lastCheck: 0, pollMs: 15000, safeTimer: 0
  };
  const VERSION_URL = new URL('deploy-version.json', document.baseURI).href;
  const KEY = 'cms.deploy.current.v1';
  const $ = (s, r) => (r || document).querySelector(s);

  function currentVersion() {
    try { return localStorage.getItem(KEY) || document.documentElement.dataset.build || ''; }
    catch (_) { return document.documentElement.dataset.build || ''; }
  }
  function setCurrent(v) {
    D.version = String(v || '');
    try { localStorage.setItem(KEY, D.version); } catch (_) { /* private mode */ }
  }
  function busyUI() {
    if (D.pendingWrites > 0) return true;
    if ($('.sheet, .scrim, dialog[open], [aria-busy="true"]')) return true;
    const a = document.activeElement;
    if (a && a.matches && a.matches('input:not([type=button]):not([type=submit]),textarea,select,[contenteditable="true"]')) return true;
    const forms = Array.from(document.forms || []);
    return forms.some(f => f.dataset.deploySafe !== 'true' && f.querySelector('input:focus,textarea:focus,select:focus'));
  }
  function showNotice(v) {
    let bar = $('#cms-deploy-notice');
    if (!bar) {
      bar = document.createElement('aside');
      bar.id = 'cms-deploy-notice';
      bar.setAttribute('role', 'status');
      bar.innerHTML = '<span class="cms-deploy-copy">มีเวอร์ชันใหม่พร้อมใช้งาน</span><button type="button">อัปเดตตอนนี้</button><button type="button" aria-label="ปิด">×</button>';
      document.body.appendChild(bar);
      bar.querySelector('button').addEventListener('click', () => applyUpdate(true));
      bar.querySelectorAll('button')[1].addEventListener('click', () => { bar.hidden = true; });
    }
    bar.querySelector('.cms-deploy-copy').textContent = 'มีเวอร์ชันใหม่ ' + v + ' พร้อมใช้งาน';
    bar.hidden = false;
    if (!document.getElementById('cms-deploy-style')) {
      const st = document.createElement('style'); st.id = 'cms-deploy-style';
      st.textContent = '#cms-deploy-notice{position:fixed;z-index:10050;left:12px;right:12px;bottom:calc(12px + env(safe-area-inset-bottom));display:flex;align-items:center;gap:10px;padding:12px 14px;background:#103f2d;color:#fff;border:1px solid #64b78a;border-radius:14px;box-shadow:0 8px 28px #0003;font:500 14px system-ui}#cms-deploy-notice[hidden]{display:none}#cms-deploy-notice .cms-deploy-copy{flex:1}#cms-deploy-notice button{border:0;border-radius:9px;padding:9px 12px;background:#d9f4df;color:#103f2d;font:600 13px system-ui;white-space:nowrap}#cms-deploy-notice button:last-child{background:transparent;color:#fff;padding:4px 8px;font-size:20px}';
      document.head.appendChild(st);
    }
  }
  async function check(force) {
    if (D.checking || document.visibilityState === 'hidden' && !force) return;
    D.checking = true; D.lastCheck = Date.now();
    try {
      const r = await fetch(VERSION_URL + (VERSION_URL.includes('?') ? '&' : '?') + '_=' + Date.now(), { cache: 'no-store', credentials: 'same-origin' });
      if (!r.ok) return;
      const p = await r.json();
      if (!p || !p.version) return;
      if (!D.version) setCurrent(p.version);
      else if (String(p.version) !== D.version) {
        D.latest = p.version;
        showNotice(p.version);
        // Prepare latest shell in the background; never replace an active screen here.
        if ('serviceWorker' in navigator && navigator.serviceWorker.getRegistration) {
          navigator.serviceWorker.getRegistration().then(reg => reg && reg.update()).catch(() => {});
        }
        scheduleSafeApply();
      }
    } catch (_) { /* offline: keep current app running */ }
    finally { D.checking = false; }
  }
  function scheduleSafeApply() {
    clearTimeout(D.safeTimer);
    if (!D.latest) return;
    if (busyUI()) { D.safeTimer = setTimeout(scheduleSafeApply, 2500); return; }
    D.safeTimer = setTimeout(() => applyUpdate(false), 1800);
  }
  function applyUpdate(userInitiated) {
    if (!D.latest) return;
    if (busyUI() && !userInitiated) return scheduleSafeApply();
    if (busyUI() && userInitiated) {
      const copy = $('#cms-deploy-notice .cms-deploy-copy');
      if (copy) copy.textContent = 'กรุณาบันทึก/ปิดหน้าต่างที่กำลังแก้ไขก่อน แล้วกดอัปเดตอีกครั้ง';
      return;
    }
    setCurrent(D.latest);
    const u = new URL(location.href);
    u.searchParams.set('_deploy', String(D.latest));
    location.replace(u.href);
  }
  function trackPromise(owner, key) {
    if (!owner || typeof owner[key] !== 'function') return;
    const original = owner[key];
    owner[key] = function () {
      let result;
      try { result = original.apply(this, arguments); } catch (e) { throw e; }
      if (!result || typeof result.then !== 'function') return result;
      D.pendingWrites++;
      return Promise.resolve(result).finally(() => { D.pendingWrites = Math.max(0, D.pendingWrites - 1); if (!D.pendingWrites) scheduleSafeApply(); });
    };
  }
  // Wrap the shared write paths without changing their payloads or return values.
  trackPromise(window.API, 'write');
  trackPromise(window.DB, 'upsertMany');
  trackPromise(window.DB, 'remove');
  trackPromise(window.DB, 'bg');
  window.addEventListener('focus', () => check(true));
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) { check(true); scheduleSafeApply(); }
  });
  window.addEventListener('online', () => check(true));
  window.addEventListener('pageshow', () => check(true));
  setInterval(() => check(false), D.pollMs);
  setTimeout(() => check(true), 1200);
  // A new worker controls this tab only after installation; reload only when safe.
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (D._controllerReloaded) return;
      D._controllerReloaded = true;
      if (!busyUI()) location.reload();
      else { D.latest = D.latest || 'service-worker-update'; showNotice(D.latest); }
    });
  }
  window.CMSDeploy = { check: () => check(true), apply: () => applyUpdate(true), status: () => ({ current: D.version, latest: D.latest, pendingWrites: D.pendingWrites }) };
})();
