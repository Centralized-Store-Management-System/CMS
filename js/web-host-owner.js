/* ใยแมงมุมคน (แอป Owner › ระบบ IT) — ตัวเชื่อมข้อมูลให้ js/link-web.js ทำงานในแอป Owner ได้
 *
 * ทำไมต้องมีไฟล์นี้: แอป Owner ไม่ได้โหลด js/app.js และ js/mod-*.js ของเว็บหลังร้าน
 *   จึงยังไม่มี 1) ข้อมูลพนักงาน/ผู้ใช้ (S.t)  2) รายการเมนูหลังร้าน (MODS)
 *   3) ค่าเริ่มต้นสิทธิ์ตามระดับ  4) App.render  ไฟล์นี้เติมให้ครบก่อน แล้วค่อยวาดหน้า
 *   ทำแยกไฟล์เพื่อไม่ต้องแก้ของเดิมทั้งสองฝั่ง (ของเว็บหลังร้านไม่ถูกแตะเลย)
 *
 * ที่มาของข้อมูลที่ "ต้องตรงกับที่อื่น" — ไม่พิมพ์ซ้ำไว้ในไฟล์นี้:
 *   เมนูหลังร้าน  ← data/mod-manifest.json  (สร้างด้วย tools/mod-manifest.mjs จากหน้าเว็บจริง)
 *   สิทธิ์เริ่มต้น ← data/role-contract.json (ดึงจากโค้ดฝั่งเซิร์ฟเวอร์ด้วย tools/role-contract.mjs)
 *   คน/บัญชี/สาขา ← bootstrap ของเซิร์ฟเวอร์ (ชุดเดียวกับเว็บหลังร้าน)
 *   ตำแหน่ง       ← Position Master (js/positions-sync.js โหลดให้ทุกหน้าเท่ากัน)
 *   เครื่องที่ผูกไว้ ← ocCall('devices') — มีเฉพาะแอป Owner เว็บหลังร้านไม่มีข้อมูลนี้
 */
'use strict';
(function () {
  if (!document.body || document.body.dataset.app !== 'owner') return;

  const WH = { ready: false, loading: null, err: '', devices: [], manifest: null };
  window.WEB_HOST_OWNER = WH;

  /* ---------- 1) เติมของที่แอป Owner ยังไม่มี ---------- */
  if (typeof window.App === 'undefined') window.App = {};
  App.render = function () {
    const m = document.getElementById('oc-main');
    if (m && WH.ready) m.innerHTML = WH.html();
  };

  const jget = async p => {
    const r = await fetch(p + '?v=' + Date.now(), { cache: 'no-store' });
    if (!r.ok) throw new Error('โหลด ' + p + ' ไม่ได้ (' + r.status + ')');
    return r.json();
  };

  /* ค่าเริ่มต้นสิทธิ์: ห้ามพิมพ์ซ้ำ — อ่านจากสัญญาที่ดึงมาจากเซิร์ฟเวอร์ */
  async function loadContract() {
    const c = await jget('data/role-contract.json');
    window.PERM_ROLES = Object.keys(c.default_perms || {});
    window.DEFAULT_PERMS = c.default_perms || {};
    if (c.roles && typeof ROLE_NAME === 'object') Object.keys(c.roles).forEach(k => { if (!ROLE_NAME[k]) ROLE_NAME[k] = c.roles[k]; });
  }
  window.currentPerms = function () {
    let p = {};
    try { p = JSON.parse((S.settings && S.settings.perms) || '{}'); } catch (e) { p = {}; }
    const o = {};
    (window.PERM_ROLES || []).forEach(r => { o[r] = p[r] || (window.DEFAULT_PERMS || {})[r] || []; });
    return o;
  };

  /* เมนูหลังร้าน: ลงทะเบียนเข้า MODS เหมือนที่ไฟล์ mod-*.js ทำในเว็บหลังร้าน
   * ไม่มี view เพราะที่นี่ไม่ได้เปิดหน้านั้น ใช้แค่ชื่อกับสิทธิ์เพื่อตอบว่า "ใครเข้าเมนูไหนได้" */
  async function loadManifest() {
    const d = await jget('data/mod-manifest.json');
    WH.manifest = d;
    (d.mods || []).forEach(m => {
      if (m.key === 'web' || MODS.some(x => x.key === m.key)) return;
      MODS.push({ key: m.key, label: m.label, perm: m.perm || [], desc: m.desc || '', subs: m.subs || [], group: m.group || '', fromManifest: true });
    });
  }

  /* ---------- 2) ข้อมูลจริง ---------- */
  async function loadData() {
    /* bootstrap ของ core.js ใส่ S.me / S.settings / S.permList / S.t ให้ครบชุดเดียวกับเว็บหลังร้าน
     * กัน applyTheme ไว้ชั่วคราว: หน้าตาแอป Owner คุมด้วย IT Control Center (app-scope.js) ไม่ใช่ค่าในตั้งค่า */
    const keep = window.applyTheme;
    window.applyTheme = function () { /* แอป Owner คุมธีมเอง */ };
    try { await bootstrap(); } finally { window.applyTheme = keep; }

    /* เครื่องที่ผูกไว้ — มีเฉพาะแอป Owner (เว็บหลังร้านไม่มีตารางนี้) */
    try { const r = await ocCall('devices'); WH.devices = (r && r.rows) || []; }
    catch (e) { WH.devices = []; }
    S.t.devices = WH.devices;

    /* ตำแหน่ง: ใช้ตัวโหลดกลาง จะได้ชุดเดียวกับทุกหน้า */
    if (typeof posEnsure === 'function') { try { await posEnsure(); } catch (e) { /* แสดงต่อได้ แค่ไม่มีเส้นตำแหน่ง */ } }
  }

  WH.ensure = async function (force) {
    if (WH.ready && !force) return;
    if (WH.loading) return WH.loading;
    WH.loading = (async () => {
      WH.err = '';
      try {
        await Promise.all([loadContract(), loadManifest()]);
        await loadData();
        WH.ready = true;
      } catch (e) {
        WH.err = e.message || String(e);
        throw e;
      } finally { WH.loading = null; }
    })();
    return WH.loading;
  };

  WH.html = function () {
    const m = MODS.find(x => x.key === 'web');
    if (!m || typeof m.view !== 'function') return '<p class="status bad">ไม่พบส่วนใยแมงมุมคน (js/link-web.js)</p>';
    try { return m.view(); }
    catch (e) { return '<p class="status bad">' + esc(e.message || String(e)) + '</p>'; }
  };

  /* รหัสเปิดใช้งาน: เว็บหลังร้านมี showSetupCode อยู่ใน js/mod-users.js ซึ่งแอป Owner ไม่ได้โหลด
   * ถ้าไม่มีตัวนี้ ปุ่ม "ออกรหัสเปิดใช้งาน" จะทำงานแต่เจ้าของร้านไม่เห็นรหัส = ใช้ไม่ได้จริง
   * ทำกล่องของตัวเองแบบเบาๆ (สไตล์อยู่ในไฟล์นี้ ไม่แตะ CSS ที่ใช้ร่วมกัน) */
  if (typeof window.showSetupCode !== 'function') {
    window.showSetupCode = function (r, u) {
      const url = location.href.split(/[?#]/)[0].replace(/owner\.html$/, 'index.html');
      const msg = 'ชื่อผู้ใช้: ' + r.username + '\nรหัสเปิดใช้งาน: ' + r.setupCode
        + '\nเปิด ' + url + ' กด "เข้าใช้งานครั้งแรก" แล้วตั้ง PIN 6 หลักของตัวเอง'
        + '\nรหัสใช้ได้ครั้งเดียว หมดอายุใน ' + (r.days || 7) + ' วัน';
      const box = document.createElement('div');
      box.className = 'wso-wrap';
      box.innerHTML = '<style>'
        + '.wso-wrap{position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:rgba(14,32,24,.55);padding:16px}'
        + '.wso-card{background:#fff;border-radius:16px;max-width:460px;width:100%;padding:20px;box-shadow:0 18px 50px rgba(0,0,0,.28)}'
        + '.wso-card h3{margin:0 0 10px;font:700 17px Prompt;color:#174c35}'
        + '.wso-kv{display:grid;grid-template-columns:auto 1fr;gap:6px 12px;align-items:center;margin:12px 0}'
        + '.wso-kv span{color:#6b7d74;font-size:12.5px}.wso-kv b{font:700 15px ui-monospace,monospace;color:#103c29}'
        + '.wso-kv b.big{font-size:26px;letter-spacing:3px}'
        + '.wso-card ol{margin:10px 0;padding-left:20px;font-size:12.5px;color:#4a5b52;line-height:1.8}'
        + '.wso-note{font-size:11.5px;color:#8a9790;margin:8px 0 0}'
        + '.wso-act{display:flex;gap:8px;margin-top:14px}.wso-act .grow{flex:1}'
        + '</style><div class="wso-card" role="dialog" aria-modal="true">'
        + '<h3>รหัสเปิดใช้งานของ ' + esc(u && (u.name || u.username) || r.username) + '</h3>'
        + '<div class="wso-kv"><span>ชื่อผู้ใช้</span><b>' + esc(r.username) + '</b>'
        + '<span>รหัสเปิดใช้งาน</span><b class="big">' + esc(r.setupCode) + '</b></div>'
        + (r.sentLine ? '<p class="status ok">ส่งรหัสเข้า LINE ของเจ้าตัวแล้ว</p>' : '')
        + '<ol><li>ยื่นชื่อผู้ใช้และรหัสนี้ให้เจ้าตัว (บอกต่อหน้า หรือส่งข้อความส่วนตัว)</li>'
        + '<li>เจ้าตัวเปิดเว็บหลังร้าน กด <b>เข้าใช้งานครั้งแรก</b> แล้วตั้ง PIN 6 หลักของตัวเอง</li>'
        + '<li>เสร็จแล้วจะเข้าเว็บหลังร้าน แอปพนักงาน และลงเวลาได้</li></ol>'
        + '<p class="wso-note">รหัสนี้แสดงครั้งเดียว ใช้ได้ครั้งเดียว หมดอายุใน ' + (r.days || 7) + ' วัน ระบบไม่เก็บรหัสตัวจริงไว้</p>'
        + '<div class="wso-act"><button class="btn" data-wso="copy">คัดลอกข้อความ</button><span class="grow"></span><button class="btn primary" data-wso="close">ปิด</button></div>'
        + '</div>';
      document.body.appendChild(box);
      box.addEventListener('click', async e => {
        if (e.target === box || e.target.closest('[data-wso="close"]')) { box.remove(); return; }
        if (!e.target.closest('[data-wso="copy"]')) return;
        try { await navigator.clipboard.writeText(msg); toast('คัดลอกแล้ว วางในแชตส่วนตัวได้เลย'); }
        catch (_) { toast('คัดลอกไม่ได้ — จดรหัสจากหน้าจอนี้'); }
      });
    };
  }

  /* ---------- 3) ปุ่มในหน้า (data-a) — เว็บหลังร้านใช้ตัวส่งต่อใน app.js ที่นี่ต้องมีของตัวเอง ---------- */
  document.addEventListener('click', async e => {
    if (OC.view !== 'people') return;
    const el = e.target.closest('[data-a]'); if (!el) return;
    const [k, ...rest] = el.dataset.a.split(':');
    const fn = ACT[k]; if (!fn) return;
    e.preventDefault();
    try { await fn(rest.join(':'), el); }
    catch (err) { console.error(err); toast(err.message || 'เกิดข้อผิดพลาด'); }
  });

  /* ---------- 4) หน้าใน Owner Console ---------- */
  window.ocPeopleLoad = async function () {
    ocMain('<p class="loading">กำลังโหลดคน สิทธิ์ และการเชื่อมต่อ…</p>');
    try { await WH.ensure(); }
    catch (e) { ocMain('<p class="status bad">' + esc(WH.err || e.message) + '</p>'); return; }
    ocMain(WH.html());
  };
})();
