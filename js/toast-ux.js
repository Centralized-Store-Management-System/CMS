/* แถบแจ้งผลหลังทำรายการ (ทุกหน้า): ไอคอน ✓ สำเร็จ / 🕓 รออนุมัติ / ✕ ไม่สำเร็จ ดูออกทันที — มือถือขึ้นด้านบน คอมขึ้นด้านล่าง
 * ใช้ toast() เดิมทุกจุด ไม่ต้องแก้หน้าอื่น (เลือกไอคอนจากข้อความ หรือส่งชนิดเอง toast(msg, 'ok'|'wait'|'bad')) */
'use strict';
(function () {
  if (typeof toast !== 'function') return;
  const st = document.createElement('style');
  st.textContent = [
    '#toast.tux{display:flex;align-items:center;gap:12px;max-width:min(440px,calc(100vw - 32px));width:max-content;padding:12px 16px 12px 12px;border-radius:16px;background:var(--surface,#fff);color:var(--ink,#16211B);box-shadow:0 10px 30px rgba(0,0,0,.2);border:1px solid var(--line,#E1E6E1);font-size:14px;line-height:1.4;transform:translate(-50%,8px);transition:opacity .2s,transform .2s}',
    '#toast.tux.on{transform:translate(-50%,0)}',
    '#toast.tux .ti{flex:none;width:32px;height:32px;border-radius:50%;display:grid;place-items:center;color:#fff;background:#2FA66A}#toast.tux .ti svg{width:18px;height:18px}',
    '#toast.tux.wait .ti{background:#C28A1E}#toast.tux.bad .ti{background:#B03535}#toast.tux.info .ti{background:#2F5C8F}',
    '#toast.tux .tt{flex:1;min-width:0;font-weight:600}',
    '@media (max-width:760px){#toast.tux{top:calc(12px + env(safe-area-inset-top,0px));bottom:auto;transform:translate(-50%,-8px)}#toast.tux.on{transform:translate(-50%,0)}}'
  ].join('');
  document.head.appendChild(st);
  const IC = {
    ok: '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
    wait: '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    bad: '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>',
    info: '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg>'
  };
  const kindOf = m => /ไม่สำเร็จ|ผิดพลาด|ไม่ได้|ไม่ถูกต้อง|ไม่พบ|หมดเวลา|ล้มเหลว|error|failed|ปฏิเสธ|เกิน|ห้าม|ต้อง|กรุณา|ใส่.*ก่อน|ไม่ครบ/i.test(m) ? 'bad'
    : /รออนุมัติ/.test(m) ? 'wait' : /^กำลัง|แตะอีกครั้ง|หมายเหตุ/.test(m) ? 'info' : 'ok';
  let timer = null;
  const t0 = toast;
  toast = function (msg, kind) {
    const t = document.getElementById('toast'); if (!t) return t0(msg);
    const m = String(msg == null ? '' : msg), k = IC[kind] ? kind : kindOf(m);
    t.className = 'tux ' + k;
    t.setAttribute('role', k === 'bad' ? 'alert' : 'status');
    t.innerHTML = `<span class="ti">${IC[k]}</span><span class="tt"></span>`;
    t.querySelector('.tt').textContent = m;
    requestAnimationFrame(() => t.classList.add('on'));
    clearTimeout(timer); timer = setTimeout(() => t.classList.remove('on'), k === 'bad' ? 5000 : 3200);
  };
})();
