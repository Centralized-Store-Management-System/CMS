/* หัวข้อในหน้าจอ (ไม่ใช่เมนูซ้าย) ย่อ/ขยายได้ — หน้าที่ข้อมูลยาวไม่ต้องเลื่อนไกล (หลังร้าน: แอป/เว็บ)
 * - แตะหัวข้อ = ย่อ/ขยาย · ระบบจำไว้ทุกหน้า (เครื่องนี้)
 * - เปิดครั้งแรก: หัวข้อที่ยาวเกิน 6 รายการ ย่อไว้ก่อน (ยกเว้นหัวข้อแรกของหน้า) · หัวข้อสั้นเปิดไว้
 * - ทำบนหน้าที่วาดแล้ว ไม่ดึงข้อมูลเพิ่ม */
'use strict';
(function () {
  const KEY = 'amz.fold', LONG = 6;
  let st = {};
  try { st = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { st = {}; }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) { /* */ } };
  const css = document.createElement('style');
  css.textContent = '#view h3.h3.fold{cursor:pointer;user-select:none;display:flex;align-items:center;gap:8px;flex-wrap:wrap}'
    + '#view h3.h3.fold::after{content:"";margin-left:auto;width:9px;height:9px;border-right:2px solid currentColor;border-bottom:2px solid currentColor;transform:rotate(45deg);transition:transform .15s;opacity:.55;flex:none}'
    + '#view h3.h3.fold.shut::after{transform:rotate(-45deg)}'
    + '#view h3.h3.fold .fold-n{font-size:12px;font-weight:600;padding:1px 8px;border-radius:999px;background:var(--sunk);color:var(--muted)}'
    + '#view h3.h3.fold:focus-visible{outline:2px solid var(--accent,#17694A);outline-offset:2px;border-radius:6px}'
    + '#view .fold-hide{display:none!important}';
  document.head.appendChild(css);

  const page = () => (location.hash || '#').split('?')[0];
  const title = h => (h.dataset.ft || (h.dataset.ft = h.textContent.replace(/\d+/g, '#').trim().slice(0, 60)));
  const groupOf = h => { const n = h.nextElementSibling; return n && n.classList.contains('group') ? n : null; };
  const set = (h, g, shut) => { h.classList.toggle('shut', shut); g.classList.toggle('fold-hide', shut); h.setAttribute('aria-expanded', String(!shut)); };

  function apply() {
    const v = document.getElementById('view');
    if (!v) return;
    let first = true;
    v.querySelectorAll('h3.h3').forEach(h => {
      const g = groupOf(h);
      if (!g) return;
      const isFirst = first; first = false;
      if (h.classList.contains('fold')) return;
      if (g.querySelector('input:focus,select:focus,textarea:focus')) return;
      const n = g.querySelectorAll(':scope > .row, :scope > a.row, :scope > button.row').length;
      h.classList.add('fold'); h.tabIndex = 0; h.setAttribute('role', 'button');
      if (n && !h.querySelector('.chip,.fold-n')) h.insertAdjacentHTML('beforeend', `<span class="fold-n">${n}</span>`);
      const k = page() + '|' + title(h);
      const shut = k in st ? !!st[k] : (!isFirst && n > LONG);
      set(h, g, shut);
    });
  }
  function toggle(h) {
    const g = groupOf(h); if (!g) return;
    const shut = !h.classList.contains('shut');
    set(h, g, shut); st[page() + '|' + title(h)] = shut ? 1 : 0; save();
  }
  document.addEventListener('click', ev => {
    const h = ev.target.closest && ev.target.closest('#view h3.h3.fold');
    if (!h || ev.target.closest('a,button,input,select')) return;
    toggle(h);
  });
  document.addEventListener('keydown', ev => {
    if ((ev.key === 'Enter' || ev.key === ' ') && ev.target.matches && ev.target.matches('#view h3.h3.fold')) { ev.preventDefault(); toggle(ev.target); }
  });

  let raf = 0;
  const kick = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; try { apply(); } catch (e) { /* ไม่กระทบหน้าหลัก */ } }); };
  const start = () => { new MutationObserver(kick).observe(document.body, { childList: true, subtree: true }); kick(); };
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', start) : start();
})();
