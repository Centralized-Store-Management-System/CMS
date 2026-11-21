/* Finance & Accounting ในหน้าหลังร้าน (index.html) — ไฟล์แยก ไม่แก้ app.js (แทน finance-link.js เดิม)
 * - เมนูหลัก "Finance & Accounting" ในแถบซ้าย (กลุ่ม Finance) กดแล้วมีเมนูย่อยลงมา · มือถือ: เมนูย่อยอยู่บนสุดของหน้า
 * - แสดงผลในพื้นที่เดียวกับเมนูอื่น (#view) เส้นทาง #fin/<หน้า>  เช่น #fin/income, #fin/document/<id>
 * - หน้าต่างๆ มาจาก modules/finance/js/fin-*.js (โหลดเมื่อเปิดครั้งแรก) · CSS ครอบด้วย .fin-embed (css/fin-embed.css)
 * - แสดงเฉพาะผู้มีสิทธิ์ Finance: Owner ของ CMS มีสิทธิ์เสมอ · คนอื่นถาม finance-api?action=session ครั้งเดียวต่อการเข้าสู่ระบบ */
'use strict';
(function () {
  if (typeof defMod !== 'function' || typeof GROUPS === 'undefined' || typeof App !== 'object') return;
  const V = '1.1.2', BASE = 'modules/finance/';
  const API = 'https://ytxbnqosenolojifeikf.supabase.co/functions/v1/finance-api';
  const KEY = 'amz.fin.access', PERM = '__fin';
  if (typeof IC === 'object') IC.fin = '<path d="M4 19.5h16M6 16.5v-6M10 16.5v-9M14 16.5v-4M18 16.5v-7"/><path d="M5 7.5l4-3 4 2.5 6-3"/>';

  // ---------- เมนูย่อย ----------
  const MENU = [
    ['', [['dashboard', 'ภาพรวม'], ['approvals', 'รออนุมัติ', 'approve']]],
    ['รายรับ–รายจ่าย', [['income', 'รายรับ / ลูกหนี้'], ['expense', 'รายจ่าย / เจ้าหนี้'], ['payments', 'รับ–จ่ายเงิน'], ['partners', 'คู่ค้า']]],
    ['ภาษี', [['vat', 'ภาษีซื้อ–ภาษีขาย (VAT)'], ['wht', 'ภาษีหัก ณ ที่จ่าย'], ['filings', 'แบบภาษี (ภ.พ.30 / ภ.ง.ด.)']]],
    ['บัญชี', [['journals', 'สมุดรายวัน'], ['accounts', 'ผังบัญชี'], ['periods', 'รอบบัญชี']]],
    ['รายงาน', [['profit-loss', 'งบกำไรขาดทุน'], ['balance-sheet', 'งบแสดงฐานะการเงิน'], ['trial-balance', 'งบทดลอง'], ['ledger', 'บัญชีแยกประเภท'], ['aging', 'อายุลูกหนี้ / เจ้าหนี้']]],
    ['ตั้งค่า', [['company', 'ข้อมูลบริษัท'], ['users', 'ผู้ใช้งาน Finance', 'admin'], ['audit', 'ประวัติการทำรายการ', 'approve'], ['settings', 'ตั้งค่าระบบ', 'admin']]],
  ];
  const ST = { page: 'dashboard', title: 'ภาพรวม', pending: 0, open: null };   // open: null = ตามหน้าปัจจุบัน
  const FINX = () => window.FIN;
  const canSee = need => !need || (FINX() && FINX().session ? FINX().can(need) : false);
  const localHash = () => { const h = location.hash; return h.startsWith('#fin/') ? '#' + h.slice(5) : '#'; };
  const pageOf = () => (localHash().slice(1).split('/')[0] || 'dashboard');
  function subLinks(cls) {
    const cur = ST.page;
    return MENU.map(([g, items]) => {
      const vis = items.filter(i => canSee(i[2]));
      if (!vis.length) return '';
      return (g ? `<small class="${cls}-h">${g}</small>` : '') + vis.map(([k, label]) => {
        const n = k === 'approvals' && ST.pending ? `<b class="${cls}-n">${ST.pending > 99 ? '99+' : ST.pending}</b>` : '';
        return `<a href="#fin/${k}" data-fin-page="${k}"${k === cur ? ' aria-current="page"' : ''}>${esc(label)}${n}</a>`;
      }).join('');
    }).join('');
  }

  // ---------- สิทธิ์ ----------
  const tag = () => String(S.token || '').slice(-12);
  const read = () => { try { const v = JSON.parse(sessionStorage.getItem(KEY) || 'null'); return v && v.t === tag() ? v.ok : null; } catch (_) { return null; } };
  const grant = () => { if (S.me && read() === true && !(S.me.perms || []).includes(PERM)) S.me.perms = (S.me.perms || []).concat(PERM); };
  let busy = false;
  async function check() {
    if (busy || !S.token || S.demo || !S.me || read() !== null) return;
    busy = true;
    try {
      const r = await fetch(API + '?action=session', { headers: { 'x-cms-session': S.token }, cache: 'no-store' });
      const j = await r.json().catch(() => ({}));
      if (r.status === 200 || r.status === 403) {   // 401/5xx = ยังไม่แน่ใจ ไว้ถามใหม่รอบหน้า
        sessionStorage.setItem(KEY, JSON.stringify({ t: tag(), ok: r.ok && !!j.ok }));
        if (r.ok && j.ok && S.me && S.me.role !== 'owner') { grant(); App.render(); }
      }
    } catch (_) { /* ออฟไลน์: ลองใหม่ครั้งหน้า */ } finally { busy = false; }
  }

  // ---------- โหลดหน้า Finance (ครั้งแรกที่เปิด) ----------
  let ready = null;
  function load() {
    if (ready) return ready;
    if (!document.getElementById('fin-embed-css')) { const l = document.createElement('link'); l.id = 'fin-embed-css'; l.rel = 'stylesheet'; l.href = BASE + 'css/fin-embed.css?v=' + V; document.head.appendChild(l); }
    window.FIN_EMBED = {
      base: BASE, prefix: '#fin/',
      onNav(key, title) { ST.page = key || ST.page; ST.title = title || ''; decorate(); const s = document.querySelector('.mhead[data-header="fin"] h1 small'); if (s) s.textContent = desc(); },
      onBadge(n) { ST.pending = n || 0; decorate(); },
    };
    ready = new Promise((ok, no) => { const s = document.createElement('script'); s.src = BASE + 'js/fin-core.js?v=' + V; s.onload = ok; s.onerror = () => { ready = null; no(new Error('โหลด Finance ไม่สำเร็จ ตรวจสอบอินเทอร์เน็ตแล้วลองใหม่')); }; document.head.appendChild(s); });
    return ready;
  }
  // พื้นที่แสดงผลเก็บไว้ข้ามการวาดหน้าใหม่ (หน้าหลังร้านวาดใหม่เมื่อข้อมูลเปลี่ยน — ฟอร์มที่กรอกอยู่ต้องไม่หาย)
  const root = document.createElement('section');
  root.id = 'fmContent'; root.className = 'fin-content'; root.setAttribute('aria-live', 'polite');
  let shown = '';
  window.addEventListener('hashchange', () => { if (!location.hash.startsWith('#fin')) shown = ''; });
  function attach() {
    const slot = document.getElementById('finSlot');
    if (!slot) return;
    slot.replaceWith(root);
    const h = localHash();
    if (h === shown) return;   // หน้าเดิม (วาดใหม่เพราะข้อมูลหลังร้านเปลี่ยน) → คงของเดิมไว้
    shown = h;
    if (!root.childElementCount) root.innerHTML = '<div class="fm-panel fm-loading"><span class="fm-spin"></span>กำลังเปิด Finance…</div>';
    load().then(() => FINX().mount(h)).then(() => { if (!root.isConnected && shown === h) shown = ''; })
      .catch(e => { shown = ''; root.innerHTML = `<div class="fm-notice bad"><span>!</span><div><b>${esc(e.message)}</b></div></div>`; });
  }
  const desc = () => { const f = FINX(), co = f && f.session && f.session.company; return (ST.title ? ST.title + ' · ' : '') + (co ? (co.environment === 'production' ? 'ใช้งานจริง' : 'โหมดทดสอบ (UAT)') : 'การเงิน บัญชี และภาษี'); };
  function view() {
    ST.page = pageOf();
    queueMicrotask(attach);
    return `<div class="fin-embed fin-host"><details class="fin-mnav"><summary>เมนู Finance<span>${esc(ST.title || '')}</span></summary><nav aria-label="เมนู Finance">${subLinks('fin-mnav')}</nav></details><div id="finSlot"></div></div>`;
  }

  defMod({
    key: 'fin', mod: 'acct', label: 'Finance & Accounting', icon: 'fin', perm: [PERM], noBranch: true,
    get desc() { return desc(); },
    view, badge: () => ST.pending,
    summary: () => 'รายรับ รายจ่าย ภาษี บัญชี รายงาน',
  });
  const at = Math.max(GROUPS.findIndex(g => g[0] === 'Order System'), GROUPS.findIndex(g => g[0] === 'Operations'));
  GROUPS.splice(at + 1, 0, ['Finance', ['fin']]);
  NAV_ORDER.splice(0, NAV_ORDER.length, ...GROUPS.flatMap(g => g[1]));

  // ---------- แถบซ้าย: เมนูย่อยใต้ Finance ----------
  function decorate() {
    const a = document.querySelector('#nav a[href="#fin"]');
    if (!a) return;
    let box = document.getElementById('finSubnav');
    const onFin = (S.route && S.route.mod) === 'fin';
    const open = ST.open === null ? onFin : ST.open;
    a.classList.add('fin-main'); a.setAttribute('aria-expanded', String(open));
    if (!open) { if (box) box.remove(); return; }
    if (!box) { box = document.createElement('div'); box.id = 'finSubnav'; box.className = 'fin-subnav'; a.after(box); }
    if (!onFin) ST.page = '';
    box.innerHTML = subLinks('fin-subnav');
  }
  const r0 = renderNav;
  window.renderNav = renderNav = function () { const r = r0.apply(this, arguments); decorate(); check(); return r; };
  const ar = App.render;
  App.render = function () { grant(); if ((location.hash.split('/')[0]) !== '#fin') ST.open = null; return ar.apply(this, arguments); };
  document.addEventListener('click', e => {
    const a = e.target.closest('#nav a.fin-main');
    if (!a) return;
    if ((S.route && S.route.mod) === 'fin') {   // อยู่ใน Finance แล้ว: กดเมนูหลัก = ย่อ/ขยายเมนูย่อย
      e.preventDefault();
      ST.open = a.getAttribute('aria-expanded') !== 'true';
      decorate();
    }
  });

  const css = document.createElement('style');
  css.textContent = [
    '.nav a.fin-main::after{content:"";margin-left:auto;width:7px;height:7px;border-right:2px solid var(--muted);border-bottom:2px solid var(--muted);transform:rotate(45deg);transition:transform .15s;flex:none}',
    '.nav a.fin-main[aria-expanded="true"]::after{transform:rotate(-135deg)}',
    '.nav a.fin-main .dot{margin-left:auto}.nav a.fin-main .dot+*{margin-left:8px}',
    '.fin-subnav{margin:2px 0 10px 26px;padding-left:10px;border-left:2px solid color-mix(in srgb,currentColor 22%,transparent);display:flex;flex-direction:column}',
    '.fin-subnav-h{display:block;margin:10px 0 3px 10px;font-size:11px;opacity:.6;letter-spacing:.3px}',
    '.side .nav .fin-subnav a{display:flex;align-items:center;gap:8px;min-height:0;margin:1px 0;padding:6px 10px;border-radius:8px;text-decoration:none;font-size:13px;font-weight:500}',
    '.side .nav .fin-subnav a:not([aria-current]):hover{background:color-mix(in srgb,currentColor 10%,transparent)}',
    '.side .nav .fin-subnav a[aria-current="page"]{background:color-mix(in srgb,currentColor 16%,transparent);font-weight:700}',
    '.fin-subnav-n,.fin-mnav-n{margin-left:auto;background:var(--bad);color:#fff;border-radius:999px;font-size:11px;padding:1px 7px;font-weight:700}',
    '.fin-mnav{margin:0 0 14px;border:1px solid var(--line);border-radius:14px;background:var(--surface)}',
    '.fin-mnav summary{list-style:none;display:flex;align-items:center;gap:10px;padding:12px 14px;font-weight:600;cursor:pointer}',
    '.fin-mnav summary::-webkit-details-marker{display:none}',
    '.fin-mnav summary span{margin-left:auto;color:var(--muted);font-weight:500;font-size:13px}',
    '.fin-mnav summary::after{content:"";width:7px;height:7px;border-right:2px solid var(--muted);border-bottom:2px solid var(--muted);transform:rotate(45deg);margin:0 2px 3px 0}',
    '.fin-mnav[open] summary::after{transform:rotate(-135deg);margin:3px 2px 0 0}',
    '.fin-mnav nav{display:flex;flex-direction:column;padding:0 8px 10px;border-top:1px solid var(--line)}',
    '.fin-mnav-h{margin:10px 8px 2px;font-size:11.5px;color:var(--muted)}',
    '.fin-mnav a{display:flex;align-items:center;padding:10px 10px;border-radius:10px;color:var(--ink);text-decoration:none;font-size:14.5px}',
    '.fin-mnav a[aria-current="page"]{background:color-mix(in srgb,var(--m-acct) 12%,var(--surface));color:var(--m-acct);font-weight:600}',
    '@media (min-width:960px){.fin-mnav{display:none}}',
  ].join('\n');
  document.head.appendChild(css);
})();
