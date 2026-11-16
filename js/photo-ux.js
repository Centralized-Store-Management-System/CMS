/* รูปโปรไฟล์พนักงาน (แอป/เว็บเท่านั้น · ไม่ทำงานใน LINE LIFF เพื่อไม่ให้หน่วง)
 * - หลังร้าน: ข้างคำทักทาย "สวัสดี…", ปุ่มบัญชีมุมจอ, เมนู Users (ผูกกับพนักงาน)
 * - หน้าลงเวลา (แอป/เว็บ): ข้าง "สวัสดี…" · หน้าปลดล็อกแอป: แทนไอคอนแก้ว
 * - รูปโหลดจาก Google Drive โดยตรง ไม่ผ่าน Apps Script (ไม่ทำให้ข้อมูลโหลดช้า) · รูปเสียแสดงตัวอักษรแทน */
'use strict';
(function () {
  const PKEY = 'amz.me.ph';
  const get = () => { try { return localStorage.getItem(PKEY) || ''; } catch (e) { return ''; } };
  const put = v => { try { if (v) localStorage.setItem(PKEY, v); else localStorage.removeItem(PKEY); } catch (e) { /* */ } };
  const q = (s, r = document) => r.querySelector(s);
  const bad = new Set();
  const okUrl = u => /^https:\/\/|^data:image\//.test(String(u || '')) && !bad.has(u);
  const img = (u, cls, size) => `<img class="avatar ${cls}" src="${String(u).replace(/"/g, '&quot;')}" alt="" loading="lazy" referrerpolicy="no-referrer"${size ? ` style="width:${size}px;height:${size}px;flex:none;object-fit:cover"` : ''}>`;
  const clockPage = /clock\.html/.test(location.pathname);
  const inLine = () => {
    if (/[?&](lt|liff)=/.test(location.search) || /liff/i.test(location.search)) return true;
    if (typeof C === 'undefined') return false;
    return !!(C.liff || (C.via === 'line' && !window.AMZ_APP) || (window.LFX && LFX.inLine));
  };
  const empOf = id => (typeof S !== 'undefined' && S.t && S.t.employees || []).find(e => e.id === id);

  function mePhoto() {
    if (typeof C !== 'undefined' && C.my && C.my.emp) return C.my.emp.photo || '';
    if (typeof S !== 'undefined' && S.me && S.me.empId) { const e = empOf(S.me.empId); return e ? e.photo || '' : null; }
    return null;   // ยังไม่รู้
  }

  /* รูปเสีย (ไฟล์ถูกลบ/ไม่ได้แชร์) → ตัวอักษรแทน ไม่ขึ้นไอคอนรูปแตก */
  document.addEventListener('error', ev => {
    const t = ev.target;
    if (!t || t.tagName !== 'IMG' || !t.classList.contains('avatar')) return;
    bad.add(t.getAttribute('src'));
    const row = t.closest('.row,.hello,.cux-hi,.userbtn');
    const name = (row && (q('.t', row) || q('b', row) || q('h2', row)) || {}).textContent || '';
    const s = document.createElement('span');
    s.className = t.className.replace(/\bpx-\w+/g, ''); s.setAttribute('aria-hidden', 'true');
    s.textContent = name.replace(/^สวัสดี(ตอน\S+)?[, ]*/, '').trim().slice(0, 2) || '•';
    if (t.style.width) { s.style.width = t.style.width; s.style.height = t.style.height; s.style.flex = 'none'; }
    t.replaceWith(s);
  }, true);

  function swapSpan(sp, u) { if (sp && sp.tagName === 'SPAN' && okUrl(u)) sp.outerHTML = img(u, 'px-me'); }

  function backoffice() {
    const u = mePhoto();
    if (u !== null) put(u);
    if (okUrl(u)) {
      document.querySelectorAll('.userbtn > span.avatar').forEach(sp => swapSpan(sp, u));
      document.querySelectorAll('.row > span.avatar + [data-a="myAccount"]').forEach(b => swapSpan(b.previousElementSibling, u));
      const h = q('section.hello');
      if (h && !q('.px-hello', h)) {
        h.style.cssText += ';display:flex;align-items:center;gap:12px;flex-wrap:wrap';
        const wrap = document.createElement('div'); wrap.style.cssText = 'flex:1;min-width:0';
        while (h.firstChild) wrap.appendChild(h.firstChild);
        h.insertAdjacentHTML('afterbegin', img(u, 'px-hello', 52)); h.appendChild(wrap);
      }
    }
    // เมนู Users: บัญชีที่ผูกกับพนักงาน ใช้รูปพนักงาน
    const users = typeof S !== 'undefined' && S.t && S.t.users;
    if (users) document.querySelectorAll('button.row[data-a^="user:"] > span.avatar').forEach(sp => {
      const usr = users.find(x => 'user:' + x.id === sp.parentElement.dataset.a), e = usr && usr.empId && empOf(usr.empId);
      if (e && okUrl(e.photo)) sp.outerHTML = img(e.photo, 'px-u');
    });
  }

  function clockView() {
    if (inLine()) return;
    const u = mePhoto();
    if (u !== null) put(u);
    const hi = q('.cux-hi');
    if (hi && okUrl(u) && !q('.px-clock', hi)) { hi.style.alignItems = 'center'; hi.style.gap = '12px'; hi.insertAdjacentHTML('afterbegin', img(u, 'px-clock', 48)); }
  }

  function lockScreen() {
    const logo = q('#applock .al-logo'), u = get();
    if (logo && okUrl(u) && !q('img', logo)) { logo.style.padding = '0'; logo.style.overflow = 'hidden'; logo.style.borderRadius = '50%'; logo.innerHTML = `<img src="${u.replace(/"/g, '&quot;')}" alt="" style="width:100%;height:100%;object-fit:cover" onerror="this.remove()">`; }
  }

  let raf = 0;
  const run = () => { raf = 0; try { lockScreen(); clockPage ? clockView() : backoffice(); } catch (e) { /* ไม่กระทบหน้าหลัก */ } };
  const kick = () => { if (!raf) raf = requestAnimationFrame(run); };
  const start = () => {
    if (inLine()) return;   // LINE LIFF: ไม่ทำอะไรเลย
    new MutationObserver(ms => { for (const m of ms) if (m.addedNodes.length) return kick(); }).observe(document.body, { childList: true, subtree: true });
    kick();
  };
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', start) : start();
})();
