/* แอป Owner > ระบบ IT: ย่อหัวข้อที่ยาวไว้ก่อน แตะหัวข้อเพื่อขยาย (ทุกหน้า · มือถือ / PC / เว็บ)
 * - หัวข้อแสดงสถานะในกลุ่ม: ผิดปกติ N · ควรดู N · ปกติ N (นับจากจุดสี/ป้ายสถานะในแต่ละแถว)
 * - มีผิดปกติหรือควรดู → กระดิ่งสั่น ให้รู้ว่าต้องเข้าไปดู · เมนู "ตรวจ/ซ่อม" มีกระดิ่ง + จำนวนเช่นกัน
 * - จำว่าหัวข้อไหนเปิดไว้ (ระหว่างใช้งานรอบนี้) · ปุ่ม "ขยายทั้งหมด / ย่อทั้งหมด" ด้านบนของหน้า
 * - ไม่แก้โค้ดหน้าเดิม: จัดรูปหลังหน้าวาดเสร็จ (owner.js / it-ai.js / it-ops.js / it-control-center.js วาดเหมือนเดิม)
 * - ส่วนสรุปบนสุดของหน้า (หัวเรื่อง คะแนน ปุ่มเครื่องมือ) ไม่ย่อ */
(function () {
  'use strict';
  const KEY = 'ocf.open.v1';
  const st = document.createElement('style');
  st.textContent = [
    '.ocf{margin:10px 0;border:1px solid var(--line,#e3e9e4);border-radius:16px;background:var(--surface,#fff);overflow:hidden}',
    '.ocf>.ocf-head{display:flex;align-items:center;gap:10px;padding:12px 14px;cursor:pointer;user-select:none;-webkit-tap-highlight-color:transparent;min-height:52px}',
    '.ocf>.ocf-head:hover{background:color-mix(in srgb,var(--sunk,#f1f4f1) 70%,transparent)}',
    '.ocf>.ocf-head:focus-visible{outline:2px solid var(--brand,#1d7a4e);outline-offset:-2px}',
    '.ocf-title{flex:1;min-width:0}.ocf-title>*{margin:0!important;padding:0!important;border:0!important;background:none!important;box-shadow:none!important}',
    '.ocf-title .h3,.ocf-title h3,.ocf-title .h2,.ocf-title h2{font-size:16px!important;line-height:1.3}',
    '.ocf-badges{display:flex;flex-wrap:wrap;gap:6px;justify-content:flex-end;align-items:center;flex:none;max-width:58%}',
    '.ocf-b{font-size:12px;font-weight:600;padding:3px 9px;border-radius:999px;white-space:nowrap;line-height:1.4}',
    '.ocf-b.bad{background:#fde8e6;color:#a23b2a}.ocf-b.warn{background:#fdf1d9;color:#8a5a00}.ocf-b.ok{background:#e4f3ea;color:#1d6b45}.ocf-b.n{background:var(--sunk,#eef2ee);color:var(--muted,#5b6a60)}',
    '.ocf-bell{flex:none;font-size:18px;line-height:1;display:inline-block;transform-origin:50% 10%}',
    '.ocf-bell.on{animation:ocfring 1.6s ease-in-out infinite}',
    '@keyframes ocfring{0%,55%,100%{transform:rotate(0)}5%{transform:rotate(16deg)}10%{transform:rotate(-14deg)}15%{transform:rotate(12deg)}20%{transform:rotate(-10deg)}25%{transform:rotate(6deg)}30%{transform:rotate(-4deg)}35%{transform:rotate(0)}}',
    '.ocf-chev{flex:none;width:22px;height:22px;display:grid;place-items:center;color:var(--muted,#5b6a60);transition:transform .18s}',
    '.ocf.open>.ocf-head .ocf-chev{transform:rotate(180deg)}',
    '.ocf>.ocf-body{padding:0 14px 14px}.ocf>.ocf-body[hidden]{display:none!important}',
    '.ocf>.ocf-body>.group:first-child,.ocf>.ocf-body>.group{margin-top:0}',
    '.ocf-tools{display:flex;justify-content:flex-end;gap:8px;margin:8px 0 2px}',
    '.ocf-nb{display:inline-flex;align-items:center;gap:2px;margin-left:6px;font-size:11px;font-weight:700;color:#a23b2a;background:#fde8e6;border-radius:999px;padding:1px 6px;line-height:1.4;vertical-align:middle}',
    '.ocf-nb.warn{color:#8a5a00;background:#fdf1d9}.ocf-nb .ocf-bell{font-size:12px}',
    '[data-oc]:has(>.ocf-nb){position:relative}',
    '@media (max-width:899px){.ocf-nb{position:absolute;top:2px;left:calc(50% + 6px);margin:0;box-shadow:0 0 0 2px var(--surface,#fff)}}',
    '@media (max-width:600px){.ocf>.ocf-head{padding:11px 12px;gap:8px;flex-wrap:wrap}.ocf-title{flex:1 1 60%}.ocf-badges{max-width:none;flex:1 1 100%;justify-content:flex-start;order:3}.ocf>.ocf-body{padding:0 10px 12px}}',
    '@media (prefers-reduced-motion:reduce){.ocf-bell.on{animation:none}}'
  ].join('');
  document.head.appendChild(st);

  const opened = () => { try { return new Set(JSON.parse(sessionStorage.getItem(KEY) || '[]')); } catch (e) { return new Set(); } };
  const saveOpen = s => { try { sessionStorage.setItem(KEY, JSON.stringify([...s].slice(-200))); } catch (e) { /* */ } };
  const oc = () => (typeof OC !== 'undefined' ? OC : null);   // OC ประกาศด้วย const ใน owner.js (ไม่อยู่ใน window)
  const view = () => (oc() && oc().view) || (location.hash.slice(1) || 'page');
  // คีย์จำสถานะ: หน้า + คำแรกของหัวข้อ (หัวข้อที่มีวันที่ต่อท้ายยังจำได้)
  const keyOf = el => view() + ':' + String((el.innerText || el.textContent || '').trim()).split(/\s+/)[0].slice(0, 40);
  const chev = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';

  /** นับสถานะ: ทีละแถว (แถวละ 1 สถานะ) ถ้าไม่มีแถว ใช้ป้ายสถานะ */
  function count(body) {
    const c = { bad: 0, warn: 0, ok: 0, rows: 0 };
    const rows = body.querySelectorAll('.row, .itcc-row, tr');
    rows.forEach(r => {
      if (r.closest('.ocf-head')) return;
      c.rows++;
      if (r.querySelector('.oc-dot.bad, .chip.bad')) c.bad++;
      else if (r.querySelector('.oc-dot.warn, .chip.warn')) c.warn++;
      else if (r.querySelector('.oc-dot.ok, .chip.ok')) c.ok++;
    });
    if (!c.bad && !c.warn && !c.ok) body.querySelectorAll('.chip').forEach(ch => { if (ch.classList.contains('bad')) c.bad++; else if (ch.classList.contains('warn')) c.warn++; else if (ch.classList.contains('ok')) c.ok++; });
    return c;
  }
  function badges(f) {
    const body = f.querySelector(':scope>.ocf-body'), box = f.querySelector(':scope>.ocf-head>.ocf-badges'), bell = f.querySelector(':scope>.ocf-head>.ocf-bell');
    if (!body || !box) return;
    const c = count(body);
    const h = [];
    if (c.bad) h.push(`<span class="ocf-b bad">ผิดปกติ ${c.bad}</span>`);
    if (c.warn) h.push(`<span class="ocf-b warn">ควรดู ${c.warn}</span>`);
    if (c.ok) h.push(`<span class="ocf-b ok">ปกติ ${c.ok}</span>`);
    if (!h.length && c.rows) h.push(`<span class="ocf-b n">${c.rows} รายการ</span>`);
    const html = h.join('');
    if (box.innerHTML !== html) box.innerHTML = html;
    const alert = c.bad + c.warn > 0;
    bell.classList.toggle('on', alert); bell.hidden = !alert;
    bell.setAttribute('aria-label', alert ? 'มีรายการต้องตรวจ' : '');
  }
  function setOpen(f, open, remember) {
    f.classList.toggle('open', open);
    const head = f.querySelector(':scope>.ocf-head'), body = f.querySelector(':scope>.ocf-body');
    head.setAttribute('aria-expanded', String(open)); body.hidden = !open;
    if (remember) { const s = opened(); open ? s.add(f.dataset.key) : s.delete(f.dataset.key); saveOpen(s); }
  }
  function build(titleEl, bodyNodes, host) {
    const f = document.createElement('section');
    f.className = 'ocf'; f.dataset.key = keyOf(titleEl);
    const head = document.createElement('div');
    head.className = 'ocf-head'; head.setAttribute('role', 'button'); head.tabIndex = 0;
    const t = document.createElement('div'); t.className = 'ocf-title';
    const body = document.createElement('div'); body.className = 'ocf-body';
    host.parentNode.insertBefore(f, host);
    t.appendChild(titleEl);
    head.appendChild(t);
    head.insertAdjacentHTML('beforeend', '<span class="ocf-badges"></span><span class="ocf-bell" hidden>🔔</span><span class="ocf-chev">' + chev + '</span>');
    bodyNodes.forEach(n => body.appendChild(n));
    f.appendChild(head); f.appendChild(body);
    setOpen(f, opened().has(f.dataset.key), false);
    badges(f);
    return f;
  }
  const STOP = el => el.matches('h1, h3.h3, .oc-it-section-head, section, .ocf, .oc-it-hero, .oc-it-summary, .oc-it-actions, style, script');

  function process(main) {
    // ก) หัวข้อ h3 ระดับบนสุดของหน้า → หัวข้อ + เนื้อหาถัดไปจนถึงหัวข้อถัดไป
    [...main.querySelectorAll(':scope > h3.h3')].forEach(h => {
      const nodes = []; let n = h.nextElementSibling;
      while (n && !STOP(n) && !n.matches('p.note:last-child')) { nodes.push(n); n = n.nextElementSibling; }
      if (!nodes.length) return;
      build(h, nodes, h);
    });
    // ข) การ์ดที่มีหัวข้อในตัว (AI Monitoring, IT Control Center, Copilot) → หัวการ์ด + เนื้อหาที่เหลือ
    main.querySelectorAll('section.group.pad, section.oc-ops-panel, .itcc-grid > section').forEach(sec => {
      if (sec.closest('.ocf') || sec.querySelector(':scope > .ocf-wrapped')) return;
      const title = sec.querySelector(':scope > .h2, :scope > h2, :scope > .oc-ops-head, :scope > h3');
      if (!title) return;
      const rest = [...sec.children].filter(x => x !== title);
      if (!rest.length) return;
      sec.classList.add('ocf-host');
      const marker = document.createElement('span'); marker.className = 'ocf-wrapped'; marker.hidden = true;
      sec.insertBefore(marker, sec.firstChild);
      const f = build(title, rest, marker);
      f.style.cssText = 'margin:0;border:0;border-radius:0;background:none';
    });
    // ปุ่มขยาย/ย่อทั้งหมด
    const all = main.querySelectorAll('.ocf');
    let tools = main.querySelector(':scope > .ocf-tools');
    if (all.length > 1 && !tools) {
      tools = document.createElement('div'); tools.className = 'ocf-tools';
      tools.innerHTML = '<button type="button" class="btn sm" data-ocf-all="1">ขยายทั้งหมด</button><button type="button" class="btn sm" data-ocf-all="0">ย่อทั้งหมด</button>';
      const first = all[0].closest('#oc-main > *') || all[0];
      main.insertBefore(tools, first);
    }
  }
  function navBadge() {
    const o = oc(), s = o && o.status && o.status.checks;
    document.querySelectorAll('[data-oc="it"]').forEach(a => {
      let b = a.querySelector('.ocf-nb');
      if (!s) { if (b) b.remove(); return; }
      const bad = s.filter(c => c.status === 'bad').length, warn = s.filter(c => c.status === 'warn').length;
      if (!bad && !warn) { if (b) b.remove(); return; }
      if (!b) { b = document.createElement('span'); b.className = 'ocf-nb'; a.appendChild(b); }
      b.className = 'ocf-nb' + (bad ? '' : ' warn');
      const html = `<span class="ocf-bell on">🔔</span>${bad || warn}`;
      if (b.innerHTML !== html) b.innerHTML = html;
      b.title = (bad ? `ผิดปกติ ${bad} ` : '') + (warn ? `ควรดู ${warn}` : '');
    });
  }

  let busy = false, queued = false;
  function run() {
    if (busy) { queued = true; return; }
    busy = true;
    try {
      const main = document.getElementById('oc-main');
      if (main) { process(main); main.querySelectorAll('.ocf').forEach(badges); }
      navBadge();
    } finally {
      busy = false;
      if (queued) { queued = false; requestAnimationFrame(run); }
    }
  }
  let raf = 0;
  new MutationObserver(() => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; run(); }); })
    .observe(document.getElementById('root') || document.body, { childList: true, subtree: true });

  document.addEventListener('click', e => {
    const all = e.target.closest('[data-ocf-all]');
    if (all) { document.querySelectorAll('#oc-main .ocf').forEach(f => setOpen(f, all.dataset.ocfAll === '1', true)); return; }
    const head = e.target.closest('.ocf-head');
    if (!head) return;
    // ปุ่ม/ลิงก์/ช่องกรอกที่อยู่ในหัวข้อเดิม ทำงานตามเดิม ไม่ย่อ/ขยาย
    if (e.target.closest('button, a, input, select, textarea, label, [data-oc], [data-heal]') && !e.target.closest('.ocf-chev, .ocf-badges, .ocf-bell')) return;
    const f = head.parentElement; setOpen(f, !f.classList.contains('open'), true);
  });
  document.addEventListener('keydown', e => {
    const head = e.target.closest && e.target.closest('.ocf-head');
    if (head && e.target === head && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); const f = head.parentElement; setOpen(f, !f.classList.contains('open'), true); }
  });
  window.OC_FOLD = { run };
})();
