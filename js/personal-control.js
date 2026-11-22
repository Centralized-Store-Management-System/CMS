/* Personal Business Control — private Owner entry point.
 * Uses the existing CMS login/session and links to existing source modules.
 * No duplicate database, no privileged client-side database writes.
 */
'use strict';
(() => {
  const root = document.getElementById('pc-root');
  const h = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const tokKeys = ['amz.tok','amz.it.tok'];
  const token = () => { try { return sessionStorage.getItem('amz.it.tok') || sessionStorage.getItem('amz.tok') || ''; } catch (_) { return ''; } };
  const setToken = t => { try { tokKeys.forEach(k => t ? sessionStorage.setItem(k,t) : sessionStorage.removeItem(k)); } catch (_) {} };
  const showError = msg => { const el=document.getElementById('pc-error'); if(el) el.textContent=msg||''; };
  const brand = `<div class="pc-brand"><span class="pc-mark">BC</span><span><strong>Business Control</strong><small>Personal · Owner access only</small></span></div>`;
  function renderLogin(message='') {
    root.innerHTML = `<section class="pc-auth"><form class="pc-card" id="pc-login" autocomplete="on">
      ${brand}<div class="pc-kicker">SECURE OWNER ACCESS</div><h1>ศูนย์ควบคุมธุรกิจ</h1>
      <p class="pc-sub">เข้าสู่ระบบด้วยบัญชี Owner เดิมของ CMS ระบบจะใช้สิทธิ์และเงื่อนไขการเข้าถึงจากต้นฉบับ</p>
      <div class="pc-field"><label for="pc-code">ชื่อผู้ใช้</label><input id="pc-code" name="username" autocomplete="username" autocapitalize="none" required></div>
      <div class="pc-field"><label for="pc-pin">PIN</label><input id="pc-pin" name="password" type="password" inputmode="numeric" autocomplete="current-password" required></div>
      <p class="pc-error" id="pc-error" role="alert">${h(message)}</p>
      <div class="pc-actions"><button class="pc-btn" id="pc-submit" type="submit">เข้าสู่ระบบ</button></div><button class="pc-btn secondary" data-pwa="1" type="button" hidden style="width:100%;margin-top:10px">ติดตั้งแอปบนอุปกรณ์นี้</button>
      <p class="pc-note">แอปนี้ไม่สร้างบัญชีหรือสิทธิ์ใหม่ หากบัญชีไม่ใช่ Owner ระบบจะไม่อนุญาตให้เข้าใช้งาน</p>
    </form></section>`;
    document.getElementById('pc-login').addEventListener('submit', login);
  }
  async function login(ev) {
    ev.preventDefault();
    const btn=document.getElementById('pc-submit'), code=document.getElementById('pc-code').value.trim(), pin=document.getElementById('pc-pin').value.trim();
    btn.disabled=true; btn.textContent='กำลังตรวจสอบ…'; showError('');
    try {
      const r=await API.call('login',{code,pin,from:'Personal Business Control'});
      if (!r || r.role !== 'owner' || !r.token) {
        if (r && r.token) API.call('logout',{t:r.token}).catch(()=>{});
        throw new Error('บัญชีนี้ไม่มีสิทธิ์ Owner สำหรับแอปส่วนตัว');
      }
      setToken(r.token);
      renderHome(r.name || 'Owner');
    } catch(e) {
      btn.disabled=false; btn.textContent='เข้าสู่ระบบ';
      showError(e && e.message ? e.message : 'เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่');
    }
  }
  const modules = [
    ['▦','ภาพรวมและ Dashboard','ดูภาพรวมการดำเนินงานและสถานะระบบ','owner.html#dash'],
    ['⌂','จัดการธุรกิจ / CMS','พนักงาน สาขา ตารางงาน และงานหลังร้าน','index.html?from=owner'],
    ['฿','Finance Center','รายรับ รายจ่าย การชำระเงิน และบัญชี','index.html?from=owner#fin'],
    ['♙','HR Management','พนักงาน ตำแหน่ง และสิทธิ์ตามโครงสร้างเดิม','index.html?from=owner#hr'],
    ['▤','Order Management','ติดตามและจัดการออเดอร์จากระบบต้นฉบับ','index.html?from=owner'],
    ['◈','System & AI Monitoring','ตรวจสอบระบบและเหตุการณ์ผ่าน Owner Console','owner.html#it'],
    ['⚙','System Control','การตั้งค่าและควบคุมระบบที่บัญชี Owner มีสิทธิ์','owner.html#control']
  ];
  function renderHome(name) {
    root.innerHTML = `<header class="pc-top"><div class="pc-top-brand"><span class="pc-mark">BC</span><span><strong>Business Control</strong><small>Personal Business Command Center</small></span></div><div style="display:flex;gap:8px;align-items:center"><button class="pc-out" data-pwa="1" type="button" hidden>ติดตั้งแอป</button><button class="pc-out" id="pc-logout">ออกจากระบบ</button></div></header>
      <section class="pc-hero"><div class="pc-kicker">PERSONAL EXECUTIVE ACCESS</div><h1>สวัสดี, ${h(name)}</h1><p>ศูนย์ควบคุมส่วนตัวสำหรับเข้าถึงระบบธุรกิจจากจุดเดียว ข้อมูลและสิทธิ์ยังคงยึดระบบต้นฉบับ</p><div class="pc-hero-foot"><i class="pc-dot"></i> Owner session active <span>·</span> ${new Date().toLocaleString('th-TH',{dateStyle:'medium',timeStyle:'short'})}</div></section>
      <div class="pc-section-head"><h2>Business Modules</h2><span>เลือกโมดูลเพื่อเปิดระบบต้นฉบับ</span></div>
      <section class="pc-grid">${modules.map(([ic,title,desc,url])=>`<a class="pc-module" href="${url}"><span class="pc-ic">${ic}</span><span><strong>${title}</strong><small>${desc}</small></span><span class="pc-arrow">›</span></a>`).join('')}</section>
      <footer class="pc-footer">One App · Existing Source Systems · Centralized Access<br>การแก้ไขข้อมูลจะดำเนินการในระบบต้นฉบับตาม Permission เดิม</footer>`;
    document.getElementById('pc-logout').addEventListener('click', logout);
  }
  async function logout() {
    const t=token(); setToken('');
    if(t) { try { await API.call('logout',{t}); } catch(_) {} }
    renderLogin('ออกจากระบบแล้ว');
  }
  async function boot() {
    loadCfg();
    if (S.demo) { renderLogin('ไม่พบการเชื่อมต่อระบบต้นฉบับ กรุณาตรวจสอบการตั้งค่า API'); return; }
    const t=token();
    if (t) {
      try {
        const b=await API.call('bootstrap',{t});
        if (b && b.me && b.me.role==='owner') { renderHome(b.me.name || 'Owner'); return; }
      } catch(_) {}
      setToken('');
    }
    renderLogin();
  }
  boot();
})();
