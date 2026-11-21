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
    /* แบบ ก) หัวข้อ h3 ระดับหน้า: หัวข้อเป็นการ์ด · ขยายแล้วเนื้อหาเดิม (การ์ดเดิม) ต่อด้านล่าง ไม่ซ้อนการ์ด */
    '.ocf{margin:10px 0;min-width:0;max-width:100%;white-space:normal}.ocf>.ocf-body{min-width:0;max-width:100%}',   /* อยู่ในการ์ดแบบ grid/flex ห้ามกว้างเกินการ์ด */
    '.ocf>.ocf-head{display:flex;align-items:center;gap:10px;padding:11px 14px;cursor:pointer;user-select:none;-webkit-tap-highlight-color:transparent;min-height:50px;border-radius:14px}',
    '.ocf.ocf-card>.ocf-head{background:var(--surface,#fff);border:1px solid var(--line,#e3e9e4);box-shadow:0 6px 18px rgba(16,57,42,.06);padding:16px 18px;min-height:76px;border-radius:20px;gap:12px}',
    /* ไอคอนสถานะซ้ายของหัวข้อ (แบบเดียวกับกล่องสรุปด้านบน) */
    '.ocf-ico{flex:none;width:40px;height:40px;border-radius:12px;display:grid;place-items:center;font-weight:800;font-size:18px;background:#e4f3ea;color:#1d7a4e}',
    '.ocf-ico.warn{background:#fdf1d9;color:#b07a00}.ocf-ico.bad{background:#fde8e6;color:#c0392b}.ocf-ico.n{background:var(--sunk,#eef2ee);color:var(--muted,#5b6a60)}',
    /* บรรทัดสรุปใต้ชื่อหัวข้อ: ระบบไหนผิดปกติ / ควรดู */
    '.ocf-sub{display:block;margin-top:3px;font-size:13px;line-height:1.45;color:var(--muted,#5b6a60);overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;word-break:break-word}',
    '.ocf-sub b{font-weight:600}.ocf-sub .bad b{color:#a23b2a}.ocf-sub .warn b{color:#8a5a00}',
    '.ocf.ocf-card.open>.ocf-head{border-color:color-mix(in srgb,var(--brand,#1d7a4e) 35%,var(--line,#e3e9e4))}',
    '.ocf>.ocf-head:hover{background:color-mix(in srgb,var(--sunk,#f1f4f1) 75%,var(--surface,#fff))}',
    '.ocf>.ocf-head:focus-visible{outline:2px solid var(--brand,#1d7a4e);outline-offset:2px}',
    '.ocf.ocf-card>.ocf-body{padding:8px 0 0}.ocf.ocf-card>.ocf-body>:first-child{margin-top:0}',
    /* แบบ ข) การ์ดที่มีหัวข้อในตัว: หัวข้ออยู่ในการ์ดเดิม ไม่มีกรอบเพิ่ม */
    '.ocf.ocf-inner{margin:0}.ocf.ocf-inner>.ocf-head{padding:2px 0;min-height:40px;border-radius:10px}.ocf.ocf-inner>.ocf-head:hover{background:none}.ocf.ocf-inner>.ocf-body{padding:10px 0 0}',
    '.ocf-title{flex:1;min-width:0}.ocf-title>:not(.ocf-sub){margin:0!important;border:0!important;background:none!important;box-shadow:none!important}',
    '.ocf.ocf-card .ocf-title>:not(.ocf-sub){padding:0!important}.ocf-sub[hidden]{display:none!important}',
    '.ocf-title .h3,.ocf-title h3{font-size:16px!important;line-height:1.35}',
    '.ocf-side{display:flex;align-items:center;gap:8px;flex:none;margin-left:auto}',
    '.ocf-badges{display:flex;flex-wrap:wrap;gap:6px;justify-content:flex-end;align-items:center}',
    '.ocf-b{font-size:12px;font-weight:600;padding:3px 9px;border-radius:999px;white-space:nowrap;line-height:1.45}',
    '.ocf-b.bad{background:#fde8e6;color:#a23b2a}.ocf-b.warn{background:#fdf1d9;color:#8a5a00}.ocf-b.ok{background:#e4f3ea;color:#1d6b45}.ocf-b.n{background:var(--sunk,#eef2ee);color:var(--muted,#5b6a60)}',
    /* กระดิ่ง: ไอคอนเส้น ในวงกลมสีอ่อน + จุดแดง · สั่นเบาๆ */
    '.ocf-bell{flex:none;position:relative;width:30px;height:30px;border-radius:50%;display:grid;place-items:center;background:#fdf1d9;color:#b07a00}',
    '.ocf-bell.bad{background:#fde8e6;color:#c0392b}',
    '.ocf-bell svg{width:17px;height:17px;transform-origin:50% 12%}',
    '.ocf-bell:after{content:"";position:absolute;top:4px;right:5px;width:7px;height:7px;border-radius:50%;background:currentColor;box-shadow:0 0 0 2px var(--surface,#fff)}',
    '.ocf-bell.on svg{animation:ocfring 2.4s ease-in-out infinite}',
    '@keyframes ocfring{0%,40%,100%{transform:rotate(0)}4%{transform:rotate(14deg)}8%{transform:rotate(-12deg)}12%{transform:rotate(9deg)}16%{transform:rotate(-6deg)}20%{transform:rotate(3deg)}24%{transform:rotate(0)}}',
    '.ocf-chev{flex:none;width:24px;height:24px;display:grid;place-items:center;color:var(--muted,#5b6a60);transition:transform .18s}',
    '.ocf.open>.ocf-head .ocf-chev{transform:rotate(180deg)}',
    '.ocf>.ocf-body[hidden]{display:none!important}',
    '.ocf-solo>.ocf-body>.oc-ops-queue{margin-top:0}.ocf-solo .oc-ops-queue-head h3{display:none}.ocf-solo .oc-ops-queue-head{justify-content:flex-end}',
    '.ocf-tools{display:flex;justify-content:flex-end;gap:8px;margin:10px 0 4px}',
    /* เมนู: กระดิ่ง + จำนวน */
    '.ocf-nb{display:inline-flex;align-items:center;gap:3px;margin-left:auto;font-size:11px;font-weight:700;color:#c0392b;background:#fde8e6;border-radius:999px;padding:2px 7px 2px 5px;line-height:1.3;flex:none}',
    '.ocf-nb.warn{color:#8a5a00;background:#fdf1d9}.ocf-nb svg{width:12px;height:12px;transform-origin:50% 12%;animation:ocfring 2.4s ease-in-out infinite}',
    '[data-oc]:has(>.ocf-nb){position:relative}',
    '@media (max-width:899px){.ocf-nb{position:absolute;top:2px;left:calc(50% + 8px);margin:0;box-shadow:0 0 0 2px var(--surface,#fff)}}',
    '@media (max-width:600px){.ocf>.ocf-head{flex-wrap:wrap;row-gap:6px;padding:10px 12px}.ocf.ocf-card>.ocf-head{padding:14px 14px;column-gap:10px}.ocf-title{flex:1 1 auto;min-width:40%}.ocf-badges{justify-content:flex-start}.ocf-side{gap:6px}.ocf-ico{width:36px;height:36px;font-size:16px}}',
    '@media (prefers-reduced-motion:reduce){.ocf-bell.on svg,.ocf-nb svg{animation:none}}'
  ].join('');
  document.head.appendChild(st);

  const opened = () => { try { return new Set(JSON.parse(sessionStorage.getItem(KEY) || '[]')); } catch (e) { return new Set(); } };
  const saveOpen = s => { try { sessionStorage.setItem(KEY, JSON.stringify([...s].slice(-200))); } catch (e) { /* */ } };
  const oc = () => (typeof OC !== 'undefined' ? OC : null);   // OC ประกาศด้วย const ใน owner.js (ไม่อยู่ใน window)
  const view = () => (oc() && oc().view) || (location.hash.slice(1) || 'page');
  // คีย์จำสถานะ: หน้า + คำแรกของหัวข้อ (หัวข้อที่มีวันที่ต่อท้ายยังจำได้)
  const keyOf = el => view() + ':' + String((el.innerText || el.textContent || '').trim()).split(/\s+/)[0].slice(0, 40);
  const BELL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>';
  const esc = x => String(x).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
  const chev = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';

  /** นับสถานะ: ทีละแถว (แถวละ 1 สถานะ) ถ้าไม่มีแถว ใช้ป้ายสถานะ */
  function count(body) {
    const c = { bad: 0, warn: 0, ok: 0, rows: 0, list: [] };
    const nm = r => { const t = r.querySelector('.t, td'); return String((t || r).innerText || '').replace(/\s+/g, ' ').trim().slice(0, 60); };
    const rows = body.querySelectorAll('.row, .itcc-row, tr');
    rows.forEach(r => {
      if (r.closest('.ocf-head')) return;
      c.rows++;
      const dt = () => { const d = r.querySelector('.s'); return d ? String(d.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 90) : ''; };
      if (r.querySelector('.oc-dot.bad, .chip.bad')) { c.bad++; c.list.push(['bad', nm(r), dt()]); }
      else if (r.querySelector('.oc-dot.warn, .chip.warn')) { c.warn++; c.list.push(['warn', nm(r), dt()]); }
      else if (r.querySelector('.oc-dot.ok, .chip.ok')) c.ok++;
    });
    if (!c.bad && !c.warn && !c.ok) body.querySelectorAll('.chip').forEach(ch => { if (ch.classList.contains('bad')) c.bad++; else if (ch.classList.contains('warn')) c.warn++; else if (ch.classList.contains('ok')) c.ok++; });
    return c;
  }
  function badges(f) {
    const body = f.querySelector(':scope>.ocf-body'), box = f.querySelector(':scope>.ocf-head>.ocf-badges'), bell = f.querySelector(':scope>.ocf-head .ocf-bell');
    if (!body || !box) return;
    const c = count(body);
    const qs = body.querySelector('.oc-ops-queue-summary');   // Incident & Approval Center: "เหตุการณ์เปิด N · รออนุมัติ M"
    if (qs) {
      const m = String(qs.textContent).match(/เปิด\s*(\d+).*?อนุมัติ\s*(\d+)/), o = m ? +m[1] : 0, q = m ? +m[2] : 0;
      const h = (o ? `<span class="ocf-b warn">เหตุการณ์เปิด ${o}</span>` : '') + (q ? `<span class="ocf-b warn">รออนุมัติ ${q}</span>` : '') + (!o && !q ? '<span class="ocf-b ok">ไม่มีรายการค้าง</span>' : '');
      if (box.innerHTML !== h) box.innerHTML = h;
      const sub = f.querySelector(':scope>.ocf-head .ocf-sub'), st = o + q ? 'warn' : 'ok';
      const names = [...body.querySelectorAll('.oc-ops-queue-card [data-ops-decision]')].map(x => x.closest('.oc-ops-queue-card').querySelector('b')).filter((x, i, a) => x && a.indexOf(x) === i).map(x => '<span class="warn"><b>● ' + esc(String(x.textContent).trim().slice(0, 60)) + '</b></span>');
      const txt = names.length ? names.slice(0, 2).join(' &nbsp;') + (names.length > 2 ? ` และอีก ${names.length - 2} รายการ` : '') : (o ? 'มีเหตุการณ์เปิดอยู่ · ไม่มีแผนรออนุมัติ' : 'ไม่มีรายการรออนุมัติ · โหมด Observe-only'); if (sub && sub.innerHTML !== txt) sub.innerHTML = txt; if (sub) sub.hidden = false;
      const ico = f.querySelector(':scope>.ocf-head .ocf-ico'); if (ico) { ico.className = 'ocf-ico ' + st; ico.textContent = st === 'ok' ? '✓' : '!'; }
      bell.classList.toggle('on', o + q > 0); bell.classList.remove('bad'); bell.hidden = !(o + q);
      return;
    }
    const h = [];
    if (c.bad) h.push(`<span class="ocf-b bad">ผิดปกติ ${c.bad}</span>`);
    if (c.warn) h.push(`<span class="ocf-b warn">ควรดู ${c.warn}</span>`);
    if (c.ok) h.push(`<span class="ocf-b ok">ปกติ ${c.ok}</span>`);
    if (!h.length && c.rows) h.push(`<span class="ocf-b n">${c.rows} รายการ</span>`);
    const html = h.join('');
    if (box.innerHTML !== html) box.innerHTML = html;
    // บรรทัดสรุป: ชื่อรายการที่ผิดปกติ / ควรดู (สูงสุด 2) หรือ "ปกติทั้งหมด"
    const sub = f.querySelector(':scope>.ocf-head .ocf-sub');
    if (sub) {
      const one = c.list.length === 1;   // มีปัญหารายการเดียว → แสดงรายละเอียดสั้นๆ ด้วย
      const pick = st => c.list.filter(x => x[0] === st).map(x => '<b>● ' + esc(x[1]) + '</b>' + (one && x[2] ? ' — ' + esc(x[2]) : ''));
      const bads = pick('bad'), warns = pick('warn'), items = bads.map(t => `<span class="bad">${t}</span>`).concat(warns.map(t => `<span class="warn">${t}</span>`));
      let txt = items.slice(0, 2).join(' &nbsp;') + (items.length > 2 ? ` และอีก ${items.length - 2} รายการ` : '');
      if (!txt && f.classList.contains('ocf-card')) txt = c.ok ? `ตรวจ ${c.rows} รายการ · ปกติทั้งหมด` : (c.rows ? `${c.rows} รายการ` : '');
      if (sub.innerHTML !== txt) sub.innerHTML = txt;
      sub.hidden = !txt;
    }
    const ico = f.querySelector(':scope>.ocf-head .ocf-ico');
    if (ico) { const k = c.bad ? 'bad' : c.warn ? 'warn' : c.ok ? 'ok' : 'n'; ico.className = 'ocf-ico ' + k; ico.textContent = k === 'bad' ? '×' : k === 'warn' ? '!' : k === 'ok' ? '✓' : '•'; }
    const alert = c.bad + c.warn > 0;
    bell.classList.toggle('on', alert); bell.classList.toggle('bad', c.bad > 0); bell.hidden = !alert;
    bell.setAttribute('aria-label', alert ? 'มีรายการต้องตรวจ' : '');
  }
  function setOpen(f, open, remember) {
    f.classList.toggle('open', open);
    const head = f.querySelector(':scope>.ocf-head'), body = f.querySelector(':scope>.ocf-body');
    head.setAttribute('aria-expanded', String(open)); body.hidden = !open;
    if (remember) { const s = opened(); open ? s.add(f.dataset.key) : s.delete(f.dataset.key); saveOpen(s); }
  }
  function build(titleEl, bodyNodes, host, kind) {
    const f = document.createElement('section');
    f.className = 'ocf ' + (kind === 'a' ? 'ocf-card' : 'ocf-inner');   /* อย่าใช้ ocf-b: ชื่อชนกับป้ายสถานะ */
    const g = groupOf(titleEl); f.dataset.key = g ? view() + ':grp:' + g : keyOf(titleEl); if (g) f.dataset.grp = g;
    const head = document.createElement('div');
    head.className = 'ocf-head'; head.setAttribute('role', 'button'); head.tabIndex = 0;
    const t = document.createElement('div'); t.className = 'ocf-title';
    const body = document.createElement('div'); body.className = 'ocf-body';
    host.parentNode.insertBefore(f, host);
    t.appendChild(titleEl);
    const sub = document.createElement('span'); sub.className = 'ocf-sub'; sub.hidden = true; t.appendChild(sub);
    if (kind === 'a') head.insertAdjacentHTML('beforeend', '<span class="ocf-ico n" aria-hidden="true">•</span>');
    head.appendChild(t);
    head.insertAdjacentHTML('beforeend', '<span class="ocf-badges"></span><span class="ocf-side"><span class="ocf-bell" hidden role="img">' + BELL + '</span><span class="ocf-chev">' + chev + '</span></span>');
    bodyNodes.forEach(n => body.appendChild(n));
    f.appendChild(head); f.appendChild(body);
    setOpen(f, opened().has(f.dataset.key), false);
    badges(f);
    return f;
  }
  const STOP = el => el.matches('h1, h3.h3, .oc-it-section-head, section, .ocf, .oc-it-hero, .oc-it-summary, .oc-it-actions, style, script');

  // กลุ่มที่ย่อ/ขยายพร้อมกัน (เจ้าของขอ 21 พ.ย.): IT Control Center การ์ด Theme Rollout + Owner Theme Preview
  const GROUPS = [['theme', /^(Theme Rollout|Owner Theme Preview)/]];
  const groupOf = el => { const t = String(el.textContent || '').trim(); const g = GROUPS.find(x => x[1].test(t)); return g ? g[0] : ''; };
  const SKIP = { dash: 1 };
  const SOLO = [['oc-ops-queue', 'Incident & Approval Center']];   // หน้าที่ไม่ย่อ: แดชบอร์ด (กราฟ + แตะวันดูรายละเอียด) แสดงแบบเดิม
  function process(main) {
    if (SKIP[view()]) return;
    // ก) หัวข้อ h3 ระดับบนสุดของหน้า → หัวข้อ + เนื้อหาถัดไปจนถึงหัวข้อถัดไป
    [...main.querySelectorAll(':scope > h3.h3')].forEach(h => {
      const nodes = []; let n = h.nextElementSibling;
      while (n && !STOP(n) && !n.matches('p.note:last-child')) { nodes.push(n); n = n.nextElementSibling; }
      if (!nodes.length) return;
      build(h, nodes, h, 'a');
    });
    // ค) แยกออกมาเป็นการ์ดของตัวเอง (เจ้าของขอ 21 พ.ย.): Incident & Approval Center อยู่ในการ์ด AI Copilot เดิม
    //    ย้ายกล่องไปไว้ใต้การ์ด Copilot (id เดิม it-ops.js ยังหาเจอ/วาดใหม่ได้ตามปกติ)
    SOLO.forEach(([id, label]) => {
      const box = main.querySelector('#' + id), panel = main.querySelector('#oc-ops-panel');
      if (!box || !panel || box.closest('.ocf-solo')) return;
      const t = document.createElement('h3'); t.className = 'h3'; t.textContent = label;
      const mark = document.createElement('span'); panel.after(mark);
      const f = build(t, [box], mark, 'a'); f.classList.add('ocf-solo'); mark.remove();
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
      build(title, rest, marker, 'b');
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
    document.querySelectorAll('.btn .ocf-nb, .oc-card .ocf-nb').forEach(b => b.remove());   // ปุ่ม "ตรวจใหม่" / การ์ดหน้าแรก ใช้ data-oc="it" เหมือนเมนู → ไม่ใส่กระดิ่ง
    document.querySelectorAll('[data-oc="it"]:not(.btn):not(.oc-card)').forEach(a => {
      let b = a.querySelector('.ocf-nb');
      if (!s) { if (b) b.remove(); return; }
      const bad = s.filter(c => c.status === 'bad').length, warn = s.filter(c => c.status === 'warn').length;
      if (!bad && !warn) { if (b) b.remove(); return; }
      if (!b) { b = document.createElement('span'); b.className = 'ocf-nb'; a.appendChild(b); }
      b.className = 'ocf-nb' + (bad ? '' : ' warn');
      const html = BELL + (bad || warn);
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
    if (e.target.closest('button, a, input, select, textarea, label, [data-oc], [data-heal]') && !e.target.closest('.ocf-side, .ocf-badges')) return;
    toggle(head.parentElement);
  });
  // ย่อ/ขยาย: ถ้าอยู่ในกลุ่ม ทำพร้อมกันทั้งกลุ่ม
  function toggle(f) {
    const open = !f.classList.contains('open');
    const list = f.dataset.grp ? document.querySelectorAll('#oc-main .ocf[data-grp="' + f.dataset.grp + '"]') : [f];
    list.forEach(x => setOpen(x, open, true));
  }
  document.addEventListener('keydown', e => {
    const head = e.target.closest && e.target.closest('.ocf-head');
    if (head && e.target === head && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); toggle(head.parentElement); }
  });
  window.OC_FOLD = { run };
})();
