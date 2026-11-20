/* ตัวเลือก Theme ตาม Scope (IT Control Center) — โหลดใน <head> ของทุกหน้า ก่อน CSS อื่นของ Theme
 * แต่ละหน้าบอกระบบของตัวเองด้วย data-app ที่แท็ก script นี้: owner | backoffice | staff
 * Scope = ระบบ × ช่องทาง (เว็บ / แอปที่ติดตั้ง) × อุปกรณ์ (PC / มือถือ / iPad) · หน้าจัดการร้านที่เปิดจากแอป Owner = backoffice_owner (แยกจากพนักงาน)
 * ค่าอ่านจาก it-control-center?public=1 (ตั้งที่ แอป Owner > ระบบ IT > IT Control Center) จำไว้ในเครื่องเพื่อไม่ให้หน้ากระพริบ
 * ถ้ายังไม่เคยโหลด / เน็ตหลุด ใช้ค่าตั้งต้นด้านล่าง (ตรงกับหน้าตาปัจจุบัน)
 * เพิ่ม/แก้ไฟล์ CSS ของ Theme → แก้ที่ THEMES ด้านล่างที่เดียว (อย่าใส่ <link> ของ Theme ตรงในหน้า html อีก) */
(function () {
  'use strict';
  var THEMES = {
    classic: [],
    prototype: ['css/prototype-theme.css?v=1.7.2', 'css/module-headers.css?v=1.0.4', 'css/prototype-fix.css?v=1.0.0'],
    owner: ['css/owner-theme.css?v=1.0.0']
  };
  var DEFAULTS = { owner: 'owner', backoffice: 'prototype', backoffice_owner: 'prototype', staff: 'classic' };
  var API = 'https://ytxbnqosenolojifeikf.supabase.co/functions/v1/it-control-center?public=1';
  var CACHE = 'amz.itcc.pub.v1';
  var me = document.currentScript;
  var page = (me && me.getAttribute('data-app')) || 'backoffice';
  var ua = navigator.userAgent;
  var ipad = /iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) || (/Android/.test(ua) && !/Mobile/.test(ua));
  var device = ipad ? 'ipad' : (/iPhone|iPod|Android|Mobile/.test(ua) ? 'mobile' : 'pc');
  var installed = false;
  try { installed = (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true; } catch (e) { /* */ }
  var surface = /\bLine\//i.test(ua) ? 'line_liff' : installed ? 'installed_app' : 'web';
  var app = page;
  try { if (page === 'backoffice' && (sessionStorage.getItem('amz.fromOwner') === '1' || /[?&]from=owner/.test(location.search))) app = 'backoffice_owner'; } catch (e) { /* */ }

  function pick(rows) {   // หา scope ที่ตรงที่สุด: ระบบ+ช่องทาง+อุปกรณ์ → ระบบ+เว็บ+อุปกรณ์ → ระบบเดียวกันแถวแรก
    var mine = (rows || []).filter(function (r) { return r.app_key === app; });
    var has = function (r) { return String(r.device_class || '').split('_').indexOf(device) >= 0; };
    return mine.filter(function (r) { return r.surface === surface && has(r); })[0]
      || mine.filter(function (r) { return r.surface === 'web' && has(r); })[0]
      || mine.filter(has)[0] || mine[0] || null;
  }
  function pkgOf(row) { return row ? (row.theme_enabled ? (THEMES[row.theme_package] ? row.theme_package : 'classic') : 'classic') : (DEFAULTS[app] || 'classic'); }
  var cached = null;
  try { cached = JSON.parse(localStorage.getItem(CACHE) || 'null'); } catch (e) { /* */ }
  var row = pick(cached && cached.rows);
  var pkg = pkgOf(row);
  // ใส่ CSS แบบ parser-inserted (บล็อกการวาดเหมือน <link> ปกติ → ไม่กระพริบ)
  THEMES[pkg].forEach(function (href) { document.write('<link rel="stylesheet" data-itcc href="' + href + '">'); });

  function apply(next) {
    if (next === pkg) return;
    var old = document.querySelectorAll('link[data-itcc]');
    THEMES[next].forEach(function (href) { var l = document.createElement('link'); l.rel = 'stylesheet'; l.setAttribute('data-itcc', ''); l.href = href; document.head.appendChild(l); });
    for (var i = 0; i < old.length; i++) old[i].parentNode.removeChild(old[i]);
    pkg = next; S.pkg = next;
    try { document.documentElement.setAttribute('data-theme-pkg', next); } catch (e) { /* */ }
  }
  var S = window.AMZ_SCOPE = { page: page, app: app, device: device, surface: surface, scope: row ? row.scope_key : '', pkg: pkg, themes: Object.keys(THEMES) };
  document.documentElement.setAttribute('data-theme-pkg', pkg);
  document.documentElement.setAttribute('data-scope', S.scope || (app + '_default'));

  function refresh() {
    if (!window.fetch) return;
    fetch(API, { cache: 'no-cache' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (p) {
      if (!p || !p.ok || !Array.isArray(p.rows)) return;
      try { localStorage.setItem(CACHE, JSON.stringify({ at: Date.now(), rows: p.rows })); } catch (e) { /* */ }
      var r2 = pick(p.rows); S.scope = r2 ? r2.scope_key : ''; document.documentElement.setAttribute('data-scope', S.scope || (app + '_default'));
      apply(pkgOf(r2));
    }).catch(function () { /* เน็ตหลุด: ใช้ค่าที่จำไว้ */ });
  }
  // โหลดค่าใหม่หลังหน้าเสร็จ (ไม่แย่งการโหลดหน้า) และทุกครั้งที่กลับเข้าแอป
  window.addEventListener('load', function () { setTimeout(refresh, 300); });
  document.addEventListener('visibilitychange', function () { if (!document.hidden) refresh(); });
  S.refresh = refresh;
})();
