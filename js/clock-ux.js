/* หน้าลงเวลาแบบใหม่ สำหรับแอปและเว็บ (Staff / Manager / HR) — ไม่ใช้ใน LINE (LINE ใช้ liff-view.js)
 * - การ์ดลงเวลาด้านบน: กะวันนี้ตัวใหญ่ · สถานะ · GPS พร้อมไหม · ปุ่มใหญ่ "เข้างาน" (เขียว) / "ออกงาน" (ส้ม) · ช่องเวลาเข้า/ออก
 * - กดแล้ว: หน้าต่างเครื่องหมายถูก "ลงเวลาเข้างานเรียบร้อย" + เวลา + ตรงเวลา/สาย (ปิดเองใน 3 วิ)
 * - ออกก่อนเลิกกะ: ถามยืนยันก่อน · ทำรายการอื่น (ลา/OT/แก้เวลา/แลกกะ): แถบแจ้งผลพร้อมไอคอน (toast-ux.js)
 * - เปิดจากปุ่มในหน้า Today ของหลังร้าน (?auto=in|out): ลงเวลาให้ทันทีครั้งเดียว ไม่ต้องกดซ้ำ แล้วปิดหน้าต่างเอง */
'use strict';
(function () {
  if (typeof viewMe !== 'function' || typeof C === 'undefined') return;
  const Q = new URLSearchParams(location.search);
  const inLine = () => !!(C.liff || (C.via === 'line' && !window.AMZ_APP) || (typeof LFX !== 'undefined' && LFX.inLine));
  const AUTO = /^(in|out)$/.test(Q.get('auto') || '') ? Q.get('auto') : '';
  let autoDone = !AUTO, okEarly = false, tabInit = false, clocking = false, shownMsg = '';

  const st = document.createElement('style');
  st.textContent = [
    '.cux-hi{display:flex;align-items:center;gap:10px;margin:6px 0 14px}.cux-hi>div{flex:1;min-width:0}.cux-hi b{font:600 21px var(--display);display:block}.cux-hi small{color:var(--muted);font-size:13px}',
    '.cux-hero{background:#10392A;color:#fff;border-radius:24px;padding:18px;display:flex;flex-direction:column;gap:12px}',
    '.cux-top{display:flex;justify-content:space-between;align-items:flex-start;gap:10px}.cux-top small{color:#B8D2C3;font-size:13px}.cux-top b{display:block;font:700 30px var(--display);letter-spacing:.3px;line-height:1.2}',
    '.cux-pill{flex:none;padding:6px 10px;border-radius:999px;background:rgba(255,255,255,.13);font-size:12px;font-weight:700;white-space:nowrap}.cux-pill.go{background:#2FA66A}.cux-pill.done{background:#C29A3E;color:#10392A}',
    '.cux-tiles{display:grid;grid-template-columns:1fr 1fr;gap:10px}.cux-tile{border-radius:16px;padding:10px 12px;display:flex;flex-direction:column;gap:1px;background:rgba(255,255,255,.08);border:1px dashed rgba(255,255,255,.28)}',
    '.cux-tile small{font-size:12px;color:#B8D2C3}.cux-tile b{font:700 24px var(--display)}.cux-tile em{font-style:normal;font-size:12px;color:#B8D2C3}.cux-tile.on{background:#fff;color:#10392A;border:1px solid #fff}.cux-tile.on small,.cux-tile.on em{color:#3C5A4B}.cux-tile.on em.late{color:#B03535;font-weight:700}.cux-tile.on em.ok{color:#17694A;font-weight:700}',
    '.cux-gps{display:flex;align-items:center;gap:8px;padding:10px 12px;border-radius:14px;background:rgba(255,255,255,.08);font-size:14px}.cux-gps i{width:9px;height:9px;border-radius:50%;background:#C9D2CB;flex:none}.cux-gps.ok i{background:#7FD3A4}.cux-gps.bad i{background:#F08A7E}.cux-gps span{flex:1}',
    '.cux-go{height:88px;border:0;border-radius:22px;color:#fff;display:flex;align-items:center;justify-content:center;gap:12px;font:700 28px var(--display);cursor:pointer;-webkit-tap-highlight-color:transparent;transition:transform .1s}.cux-go:active{transform:scale(.98)}.cux-go[disabled]{opacity:.7}',
    '.cux-go.in{background:#2FA66A;box-shadow:0 10px 26px rgba(47,166,106,.45)}.cux-go.out{background:#B5562A;box-shadow:0 10px 26px rgba(181,86,42,.4)}.cux-go svg{width:32px;height:32px}',
    '.cux-hero #ck-msg{margin:0;background:transparent;color:#D3E3D9;text-align:center;font-size:13px;padding:0}.cux-hero #ck-msg.bad{color:#FFC7BF;font-weight:600}',
    '.cux-prog{height:8px;border-radius:999px;background:rgba(255,255,255,.15);overflow:hidden}.cux-prog i{display:block;height:8px;background:#7FD3A4;border-radius:999px}',
    '.cux-done{display:flex;align-items:center;gap:10px;padding:12px;border-radius:14px;background:rgba(255,255,255,.1);font-weight:600}',
    '.cux-hero .selfie-box{background:rgba(255,255,255,.08);border-radius:14px}.cux-hero .field.check label{color:#fff}',
    '.cux-acts{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:18px 0 6px}',
    '.cux-act{display:flex;flex-direction:column;align-items:center;gap:6px;padding:12px 4px;border-radius:18px;background:var(--surface,#fff);border:1px solid var(--line);color:var(--ink);text-decoration:none;font-size:13px;font-weight:600;text-align:center}',
    '.cux-act span{width:40px;height:40px;border-radius:12px;display:grid;place-items:center}.cux-act svg{width:20px;height:20px}.cux-act[aria-current="page"]{border-color:var(--brand,#17694A);box-shadow:0 0 0 2px color-mix(in srgb,var(--brand,#17694A) 25%,transparent)}',
    '.cux-seg{display:flex;gap:6px;margin:14px 0 8px}.cux-seg a{flex:1;text-align:center;padding:9px;border-radius:12px;border:1px solid var(--line);text-decoration:none;color:var(--muted);font-weight:600;font-size:14px}.cux-seg a[aria-current="page"]{background:var(--ink,#16211B);color:var(--bg,#fff);border-color:var(--ink,#16211B)}',
    '.cux-modal{position:fixed;inset:0;z-index:60;background:rgba(16,57,42,.55);display:grid;place-items:center;padding:20px;animation:cuxf .15s}@keyframes cuxf{from{opacity:0}}',
    '.cux-card{width:100%;max-width:360px;background:var(--surface,#fff);color:var(--ink);border-radius:28px;padding:28px 22px 20px;text-align:center;display:flex;flex-direction:column;align-items:center;gap:8px;box-shadow:0 24px 60px rgba(0,0,0,.25);animation:cuxp .25s cubic-bezier(.2,1.4,.4,1)}@keyframes cuxp{from{transform:scale(.85);opacity:0}}',
    '.cux-ring{width:96px;height:96px;border-radius:50%;display:grid;place-items:center;background:#E3F4EA}.cux-ring i{width:70px;height:70px;border-radius:50%;display:grid;place-items:center;background:#2FA66A;color:#fff}.cux-ring.out{background:#F7E6DC}.cux-ring.out i{background:#B5562A}.cux-ring.warn{background:#F6EEDC}.cux-ring.warn i{background:#C28A1E}.cux-ring svg{width:40px;height:40px}',
    '.cux-card h2{margin:6px 0 0;font:700 21px var(--display);color:#10392A}.cux-card .t{font:700 50px var(--display);line-height:1.05}.cux-card .chips{display:flex;gap:6px;flex-wrap:wrap;justify-content:center}.cux-card p{margin:4px 0;color:var(--muted);font-size:13px}',
    '.cux-card .btn{width:100%;min-height:50px;font-size:16px}.cux-card .row2{display:flex;gap:10px;width:100%}.cux-card .row2 .btn{flex:1}',
    '@media (min-width:760px){.cux-acts{max-width:640px}}',

    /* Prototype layout: clear hierarchy, larger tap targets and usable mobile cards */
    '.cux{max-width:720px!important;padding:14px 16px calc(34px + env(safe-area-inset-bottom))!important}',
    '.cux .clock-top{padding:10px 12px;margin:0 0 16px;border:1px solid #e5eee8;border-radius:17px;background:#fff;box-shadow:0 6px 20px rgba(16,61,45,.05)}',
    '.cux-hi{align-items:center;margin:8px 2px 16px}.cux-hi b{font-size:22px;color:#17211e}.cux-hi small{display:block;margin-top:3px}',
    '.cux-hero{background:linear-gradient(140deg,#064b37,#08734f)!important;border:0!important;border-radius:24px!important;padding:22px!important;gap:15px!important;box-shadow:0 14px 30px rgba(7,88,63,.2)!important}',
    '.cux-top{align-items:center}.cux-top>div{display:grid;gap:5px}.cux-top b{font-size:32px!important;letter-spacing:-.5px}.cux-pill{padding:7px 11px;background:#ffffff20!important;border:1px solid #ffffff28}',
    '.cux-pill.go{background:#dff5e8!important;color:#07583f!important}.cux-pill.done{background:#ff806e!important;color:#fff!important}',
    '.cux-tiles{gap:12px}.cux-tile{min-height:106px;padding:14px!important;border:1px solid #ffffff35!important;border-radius:17px!important;background:#ffffff12!important}.cux-tile.on{background:#fff!important;border-color:#fff!important}',
    '.cux-tile b{font-size:28px!important}.cux-gps{border:1px solid #ffffff2b;background:#ffffff14!important;border-radius:14px;padding:12px 14px}',
    '.cux-go{height:76px!important;border-radius:18px!important;font-size:25px!important;box-shadow:0 8px 18px rgba(0,0,0,.15)!important}.cux-go.in{background:#ff806e!important}.cux-go.out{background:#d96a4d!important}',
    '.cux-acts{grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:16px 0 18px!important}',
    '.cux-act{min-height:100px;justify-content:center;border:1px solid #e5eee8!important;border-radius:18px!important;background:#fff!important;box-shadow:0 7px 20px rgba(16,61,45,.06)!important;padding:13px 5px!important}',
    '.cux-act span{width:46px!important;height:46px!important;border-radius:15px!important}.cux-act[aria-current="page"]{border-color:#07583f!important;background:#f2faf5!important}',
    '.cux-seg{background:#eaf2ec;border:1px solid #e1ebe4;border-radius:16px;padding:5px;gap:5px}.cux-seg a{border:0;border-radius:11px}.cux-seg a[aria-current="page"]{background:#07583f!important;color:#fff!important;border-color:#07583f!important}',
    '.cux .group,.cux .group.pad,.cux .stats>div{border:1px solid #e5eee8!important;border-radius:18px!important;background:#fff!important;box-shadow:0 8px 24px rgba(16,61,45,.06)!important}',
    '.cux .group.pad{padding:17px!important}.cux .row{min-height:62px;padding:13px 15px}.cux .h3,.cux h3.h2{color:#07583f}',
    '.cux .btn.primary{background:#07583f!important;border-color:#07583f!important}',
    '@media(max-width:520px){.cux{padding:12px 13px calc(28px + env(safe-area-inset-bottom))!important}.cux-hero{padding:18px!important}.cux-top b{font-size:28px!important}.cux-tiles{gap:9px}.cux-tile{min-height:96px;padding:11px!important}.cux-acts{gap:8px}.cux-act{min-height:92px;font-size:12px!important}.cux-act span{width:40px!important;height:40px!important}.cux-go{height:70px!important}.cux .group.pad{padding:14px!important}}',

    /* Desktop Web only: compact timekeeping workspace for Manager and Staff.
       Native mobile app and customer LINE/LIFF layouts are intentionally untouched. */
    '@media(min-width:960px){html.embed body{background-color:#f2f6f2;background-image:radial-gradient(ellipse at 92% 8%,rgba(255,128,110,.12),transparent 27%),radial-gradient(ellipse at 4% 92%,rgba(7,115,79,.09),transparent 30%),linear-gradient(135deg,#f4f8f4,#eef4ef)}html.embed .clock-shell.cux{max-width:1120px!important;padding:14px 22px 28px!important}html.embed .cux-hi{margin:4px 2px 12px}html.embed .cux-hero{display:grid;grid-template-columns:minmax(0,1fr) minmax(250px,.82fr);align-items:center;gap:12px 16px;padding:18px 20px!important;border-radius:22px!important;background:radial-gradient(ellipse at 100% 0%,rgba(255,255,255,.12),transparent 34%),linear-gradient(125deg,#073f30 0%,#07583f 56%,#0d684b 100%)!important;box-shadow:0 12px 26px rgba(7,88,63,.14)!important;position:relative;overflow:hidden}html.embed .cux-top,html.embed .cux-tiles,html.embed .cux-done,html.embed .cux-hero .selfie-box,html.embed .cux-hero .field.check{grid-column:1/-1}html.embed .cux-top{align-items:center;margin-bottom:0}html.embed .cux-top b{font-size:27px!important}html.embed .cux-tiles{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}html.embed .cux-tile{min-height:78px;padding:10px 14px!important;border-radius:14px!important}html.embed .cux-tile b{font-size:23px!important}html.embed .cux-gps{grid-column:1;min-height:48px;padding:10px 12px;font-size:13px}html.embed .cux-go{grid-column:2;height:58px!important;border-radius:15px!important;font-size:21px!important}html.embed .cux-go svg{width:25px;height:25px}html.embed .cux-hero #ck-msg{grid-column:1/-1;text-align:left;font-size:12px;padding-left:2px}html.embed .cux-acts{max-width:none;gap:12px;margin:14px 0!important}html.embed .cux-act{min-height:82px;padding:10px!important;border-radius:16px!important;flex-direction:row;justify-content:flex-start;gap:12px;text-align:left;font-size:14px}html.embed .cux-act span{width:42px!important;height:42px!important;border-radius:13px!important}html.embed .cux-seg{margin:12px 0 8px}html.embed .cux .group,html.embed .cux .group.pad,html.embed .cux .stats>div{border-radius:16px!important;box-shadow:0 5px 16px rgba(16,61,45,.045)!important}html.embed .cux .row{min-height:52px;padding:10px 14px}html.embed .cux .group.pad{padding:14px!important}}',
    '@media(min-width:960px) and (max-width:1200px){html.embed .clock-shell.cux{padding-left:14px!important;padding-right:14px!important}html.embed .cux-hero{grid-template-columns:minmax(0,1fr) minmax(220px,.8fr);padding:16px!important}}',

    /* Desktop decorative companion card: fills freed layout space without adding fake actions */
    '.cux-web-feature{display:block}',
    '.cux-decor{display:none}',
    '@media(min-width:1200px){html.embed .cux-web-feature{display:grid;grid-template-columns:minmax(0,1.65fr) minmax(250px,.72fr);gap:16px;align-items:stretch}html.embed .cux-web-feature>.cux-hero{height:100%;min-height:100%}html.embed .cux-decor{display:flex;position:relative;min-height:260px;overflow:hidden;flex-direction:column;justify-content:space-between;padding:22px;border:1px solid #dce9df;border-radius:22px;background:radial-gradient(circle at 85% 15%,rgba(255,255,255,.88),transparent 33%),linear-gradient(145deg,#e7f2e9 0%,#f7f3e9 58%,#f4e2d9 100%);box-shadow:0 12px 26px rgba(16,61,45,.07)}html.embed .cux-decor-art{position:absolute;inset:0 0 35px;display:grid;place-items:center;overflow:hidden;background:radial-gradient(ellipse at 50% 55%,rgba(8,105,73,.13),transparent 56%)}html.embed .cux-decor-art svg{width:min(88%,260px);height:auto;filter:drop-shadow(0 14px 14px rgba(16,61,45,.12));z-index:1}html.embed .cux-decor-orbit{position:absolute;border:1px solid rgba(7,88,63,.13);border-radius:50%;width:220px;height:220px}html.embed .cux-decor-orbit.orbit-b{width:290px;height:290px;border-style:dashed}html.embed .cux-decor-copy{position:relative;z-index:2;margin-top:auto;display:grid;gap:8px}html.embed .cux-decor-copy span{font:700 10px var(--display);letter-spacing:1.8px;color:#658274}html.embed .cux-decor-copy strong{font:700 25px var(--display);line-height:1.25;color:#104b37}html.embed .cux-decor-copy small{font-size:11px;color:#718278}html.embed .cux-decor-mark{position:absolute;right:18px;top:14px;color:#0b6748;font-size:22px;opacity:.7}}',
    /* Contrast and visual polish: keep every label readable on every state */
    '.cux-hero .cux-top small,.cux-hero .cux-top b,.cux-hero .cux-top strong{color:#fff!important}',
    '.cux-hero .cux-top small{color:#d7eee3!important}',
    '.cux-hero .cux-pill{color:#fff!important}',
    '.cux-hero .cux-tile:not(.on),.cux-hero .cux-tile:not(.on) *{color:#f4fff8!important}',
    '.cux-hero .cux-tile.on,.cux-hero .cux-tile.on *{color:#10392a!important}',
    '.cux-hero .cux-gps,.cux-hero .cux-gps span,.cux-hero .cux-gps b{color:#f4fff8!important}',
    '.cux-hero #ck-msg{color:#e7f5ed!important}',
    '.cux-hi b,.cux-hi small,.cux-seg a,.cux-act{ text-shadow:none!important}',
    '.cux .group,.cux .group.pad,.cux .stats>div{color:#17211e}',
    '.cux .group small,.cux .group .muted,.cux .stats small{color:#61736a}',
    '.cux input,.cux select,.cux textarea{color:#17211e;background:#fff;border-color:#d8e5dc}',
    '.cux input::placeholder,.cux textarea::placeholder{color:#78877f;opacity:1}',
    '.cux-card,.cux-card *{color:#17211e}.cux-card h2{color:#07583f!important}.cux-card p{color:#61736a!important}',
    '@media(min-width:960px){html.embed .cux{position:relative}html.embed .cux:after{content:"CAFÉ AMAZON  •  STORE OPERATIONS";display:block;margin:18px 2px 0;padding:18px 22px;border-radius:18px;background:linear-gradient(110deg,#e4f1e8,#f8f4ed 58%,#f7e8e2);border:1px solid #e1eae2;color:#557365;font:600 12px var(--display);letter-spacing:2px;text-align:right}html.embed .cux-hi{padding:8px 4px 10px}html.embed .cux-hero{min-height:0}html.embed .cux-hero:after{content:"";position:absolute;right:-54px;bottom:-92px;width:220px;height:220px;border:1px solid rgba(255,255,255,.12);border-radius:50%;box-shadow:0 0 0 24px rgba(255,255,255,.025),0 0 0 48px rgba(255,255,255,.02);pointer-events:none}html.embed .cux-hero>*{position:relative;z-index:1}}',

    /* Desktop browser layout (not limited to embedded iframe): compact clock panel + decorative companion card */
    '@media(min-width:1200px) and (hover:hover){.clock-shell.cux{max-width:1240px!important;margin:0 auto!important;padding:16px 20px 28px!important}.cux-web-feature{display:grid!important;grid-template-columns:minmax(0,1.45fr) minmax(270px,.72fr)!important;gap:16px!important;align-items:stretch!important}.cux-web-feature>.cux-hero{display:grid!important;grid-template-columns:minmax(0,1fr) minmax(0,1fr)!important;align-content:center;align-items:center;gap:12px!important;min-height:300px!important;height:100%;padding:20px!important;border-radius:22px!important}.cux-web-feature>.cux-hero>.cux-top,.cux-web-feature>.cux-hero>.cux-tiles,.cux-web-feature>.cux-hero>.cux-done,.cux-web-feature>.cux-hero>.selfie-box,.cux-web-feature>.cux-hero>.field.check,.cux-web-feature>.cux-hero>#ck-msg{grid-column:1/-1}.cux-web-feature>.cux-hero>.cux-top b{font-size:27px!important}.cux-web-feature>.cux-hero>.cux-tiles{gap:10px}.cux-web-feature>.cux-hero>.cux-tile{min-height:74px;padding:10px 13px!important}.cux-web-feature>.cux-hero>.cux-gps{grid-column:1;min-height:48px;padding:10px 12px;font-size:12px}.cux-web-feature>.cux-hero>.cux-go{grid-column:2;height:58px!important;border-radius:14px!important;font-size:20px!important}.cux-web-feature>.cux-hero>#ck-msg{text-align:left;font-size:12px}.cux-web-feature>.cux-decor{display:flex!important;min-height:300px!important}.cux-acts{max-width:none!important;grid-template-columns:repeat(4,minmax(0,1fr))!important;gap:12px!important;margin:14px 0!important}.cux-act{min-height:76px!important;flex-direction:row!important;justify-content:flex-start!important;text-align:left!important;padding:10px 14px!important;font-size:14px!important}.cux-act span{width:42px!important;height:42px!important}}',
    '@media(min-width:960px) and (max-width:1199px){.clock-shell.cux{max-width:980px!important;margin:0 auto!important;padding:14px 18px 24px!important}.cux-web-feature{display:block!important}.cux-web-feature>.cux-hero{padding:18px!important;border-radius:20px!important}.cux-web-feature>.cux-hero>.cux-go{height:64px!important}.cux-decor{display:none!important}.cux-acts{grid-template-columns:repeat(4,minmax(0,1fr))!important}.cux-act{min-height:76px!important}}',
  ].join('');
  document.head.appendChild(st);

  const I = {
    in: '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><path d="m10 17 5-5-5-5"/><path d="M15 12H3"/></svg>',
    out: '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/></svg>',
    ok: '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
    wait: '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    leave: '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18M9 16l2 2 4-4"/></svg>',
    ot: '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2M5 3 2 6M22 6l-3-3"/></svg>',
    fix: '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>',
    swap: '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/></svg>'
  };
  const nowMin = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };

  function gpsState() {
    const m = C.my, tb = brOf(m.plan.branch || m.homeBranch) || {};
    if (S.demo && C.inside) return ['ok', 'ทดลอง: อยู่ในร้าน', 'พร้อมลงเวลา'];
    const p = C.pos;
    if (!p) return ['', 'กำลังหาตำแหน่ง GPS…', ''];
    const n = nearest(p.coords.latitude, p.coords.longitude);
    if (!n.near) return ['ok', 'ตำแหน่งพร้อม', 'พร้อมลงเวลา'];
    if (n.hit) return ['ok', `อยู่ในร้าน · ห่าง ${fmt(Math.round(n.near.d))} ม.`, 'พร้อมลงเวลา'];
    return ['bad', `อยู่นอกร้าน · ห่าง ${fmt(Math.round(n.near.d))} ม.`, `รัศมี ${n.near.b.radius || tb.radius || 80} ม.`];
  }
  function gpsHtml() { const [c, a, b] = gpsState(); return `<div class="cux-gps ${c}" id="cux-gps"><i></i><span>${esc(a)}</span><b>${esc(b)}</b></div>`; }
  function workedMin() { const o = C.my.open; if (!o || !o.inTime) return 0; let w = nowMin() - toMin(o.inTime); if (o.date && o.date !== C.my.today) w += 1440; return Math.max(0, w); }

  function hero() {
    const m = C.my, p = m.plan, s = m.state, tb = brOf(p.branch || m.homeBranch) || {}, lv = m.days && m.days[0] && m.days[0].leave;
    const chOff = C.via === 'line' ? tb.allowLine === false : tb.allowKiosk === false;
    const recIn = s === 'in' ? m.open : s === 'done' ? m.todayRec : null, recOut = s === 'done' ? m.todayRec : null;
    const pill = s === 'in' ? '<span class="cux-pill go">กำลังทำงาน</span>' : s === 'done' ? '<span class="cux-pill done">ครบแล้ววันนี้</span>' : lv ? `<span class="cux-pill">${esc(lv.type)}</span>` : p.off ? '<span class="cux-pill">วันหยุด</span>' : '<span class="cux-pill">ยังไม่เข้างาน</span>';
    let h = `<section class="cux-hero" aria-label="ลงเวลาวันนี้"><div class="cux-top"><div><small>กะวันนี้${multi() && !p.off ? ' · ' + esc(tb.name || p.branch) : ''}</small><b>${esc(p.off ? 'วันหยุด' : (p.start || '') + ' – ' + (p.end || ''))}</b><small>${esc(p.off ? (p.source || 'ตามตาราง') : (p.code ? p.code + ' · ' : '') + (p.source || ''))}${p.pubHoliday ? ' · ' + esc(p.pubHoliday) : ''}</small></div>${pill}</div>`;
    if (s === 'in') {
      const w = workedMin(), span = Math.max(60, toMin(p.end || '00:00') - toMin(p.start || '00:00')), pct = Math.min(100, Math.round(w / span * 100));
      h += `<div><small style="color:#B8D2C3;font-size:13px">ทำงานมาแล้ว</small><b id="cux-worked" style="display:block;font:700 26px var(--display)">${hrsShort(w)}</b></div><div class="cux-prog" role="img" aria-label="ผ่านไป ${pct}% ของกะ"><i id="cux-prog" style="width:${pct}%"></i></div>`;
    }
    h += `<div class="cux-tiles"><div class="cux-tile${recIn ? ' on' : ''}"><small>${recIn ? '✓ เข้างานแล้ว' : 'เข้างาน'}</small><b>${recIn ? esc(recIn.inTime) : '--:--'}</b><em class="${recIn ? (num(recIn.lateMin) ? 'late' : 'ok') : ''}">${recIn ? (num(recIn.lateMin) ? `สาย ${recIn.lateMin} นาที` : 'ตรงเวลา') + (recIn.date && recIn.date !== m.today ? ' (เมื่อวาน)' : '') : 'ยังไม่เข้า'}</em></div>
      <div class="cux-tile${recOut ? ' on' : ''}"><small>${recOut ? '✓ ออกงานแล้ว' : 'ออกงาน'}</small><b>${recOut ? esc(recOut.outTime) : '--:--'}</b><em>${recOut ? (num(recOut.workMin) ? 'ทำงาน ' + hrsShort(recOut.workMin) : '') + (num(recOut.otMin) ? ' · OT ' + recOut.otMin + ' น.' : '') : 'ยังไม่ออก'}</em></div></div>`;
    if (s === 'done') h += `<div class="cux-done">${I.ok.replace('<svg', '<svg width="22" height="22"')}ลงเวลาครบแล้ววันนี้ ขอบคุณที่ตั้งใจทำงาน</div>`;
    else if (chOff) h += `<p class="cux-done" style="font-weight:500">สาขา ${esc(tb.name || '')} ลงเวลาด้วยเครื่องสแกนนิ้วที่ร้าน</p>`;
    else {
      const type = s === 'in' ? 'out' : 'in';
      h += gpsHtml();
      if (tb.requireSelfie) h += `<div class="selfie-box"><button type="button" class="btn" data-a="cam">${C.selfie ? 'ถ่ายใหม่' : 'ถ่ายรูปยืนยันตัวตน'}</button><input id="ck-cam" type="file" accept="image/*" capture="user" class="vh" data-selfie="1" tabindex="-1" aria-hidden="true">${C.selfie ? `<img src="${C.selfie}" alt="รูปที่ถ่าย">` : '<span style="color:#D3E3D9">ต้องถ่ายรูปก่อนกดลงเวลา</span>'}</div>`;
      if (S.demo) h += `<div class="field check"><input type="checkbox" id="ck-inside"${C.inside ? ' checked' : ''}><label for="ck-inside">ทดลอง: สมมุติว่าอยู่ในร้าน</label></div>`;
      h += `<button class="cux-go ${type}" id="cux-go" data-a="clock:${type}">${I[type]}${type === 'in' ? 'เข้างาน' : 'ออกงาน'}</button>
        <p class="status" id="ck-msg">${p.off && type === 'in' ? 'วันนี้เป็นวันหยุด ถ้ามาทำงาน ระบบส่งให้ผู้อนุมัติ' : type === 'in' ? 'แตะครั้งเดียว ระบบล็อกเวลาทันทีที่แตะ' : 'ออกก่อนเลิกกะ ระบบจะถามยืนยันก่อน'}</p>`;
    }
    return h + '</section>';
  }
  function acts() {
    const list = [['leave', 'ขอลา', '#E6F1EA', '#17694A'], ['ot', 'ขอ OT', '#F6EEDC', '#8A6516'], ['fix', 'แก้เวลา', '#E8EEF6', '#2F5C8F']].concat(typeof tabSwap === 'function' ? [['swap', 'แลกกะ', '#F1E8F2', '#7A3E7F']] : []);
    return `<nav class="cux-acts" aria-label="ทำรายการ" style="grid-template-columns:repeat(${list.length},minmax(0,1fr))">${list.map(([k, l, bg, fg]) => `<a href="#" class="cux-act" data-a="tab:${k}"${C.tab === k ? ' aria-current="page"' : ''}><span style="background:${bg};color:${fg}">${I[k]}</span>${l}</a>`).join('')}</nav>`;
  }
  function webDecor() {
    return `<aside class="cux-decor" aria-label="Café Amazon decorative brand card">
      <div class="cux-decor-art" aria-hidden="true">
        <span class="cux-decor-orbit orbit-a"></span><span class="cux-decor-orbit orbit-b"></span>
        <svg viewBox="0 0 240 180" role="presentation">
          <path d="M55 65h112v54c0 25-19 43-43 43H98c-24 0-43-18-43-43Z" fill="#fff" opacity=".96"/>
          <path d="M167 78h18c19 0 25 13 21 29-4 16-16 24-39 22" fill="none" stroke="#fff" stroke-width="13" stroke-linecap="round"/>
          <path d="M70 62c-10-17 13-19 4-37M111 62c-10-17 13-19 4-37M148 62c-10-17 13-19 4-37" fill="none" stroke="#f3d9a2" stroke-width="6" stroke-linecap="round"/>
          <path d="M88 91c10-13 24-13 34 0-10 13-24 13-34 0Zm28 24c10-13 24-13 34 0-10 13-24 13-34 0Z" fill="#0b6748"/>
          <path d="M96 91h18M125 115h18" stroke="#d6a64b" stroke-width="3" stroke-linecap="round"/>
          <path d="M47 166h150" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".5"/>
        </svg>
      </div>
      <div class="cux-decor-copy"><span>CAFÉ AMAZON · STORE LIFE</span><strong>เติมพลัง<br>ให้ทุกวันทำงาน</strong><small>Every cup brings a little more joy.</small></div>
      <span class="cux-decor-mark" aria-hidden="true">☕</span>
    </aside>`;
  }

  function newView() {
    const m = C.my;
    if (!tabInit) { tabInit = true; const t = Q.get('tab'); if (t === 'swap' && typeof tabSwap === 'function') C.tab = 'swap'; }
    let h = `<div class="clock-shell cux">${header()}
      <div class="cux-hi"><div><b>สวัสดี ${esc(m.emp.name)}</b><small>${thDate(m.today, { weekday: 'long', day: 'numeric', month: 'short' })}</small></div>${C.via === 'line' || C.embed ? '' : '<button class="btn sm" data-a="lineLink">เชื่อม LINE</button>'}<button class="btn sm" data-a="done">${C.embed ? 'ปิด' : 'เสร็จแล้ว'}</button></div>`;
    if (C.result && !C.result.ok) h += `<p class="status bad" role="status">${C.result.msg}</p>`;
    else if (C.result && C.result.ok && /<b>link /.test(C.result.msg)) h += `<p class="status good" role="status">${C.result.msg}</p>`;   // รหัสเชื่อม LINE: ต้องอ่านนาน แสดงค้างไว้
    else if (C.result && C.result.ok && (clocking || C.result.msg === shownMsg)) { if (!clocking) C.result = null; }   // ข้อความลงเวลา: แสดงในหน้าต่างเครื่องหมายถูกแล้ว ไม่ซ้ำ
    else if (C.result && C.result.ok) { const msg = String(C.result.msg).replace(/<[^>]+>/g, ''); C.result = null; setTimeout(() => { if (typeof toast === 'function') toast(msg); }, 0); }   // ทำรายการสำเร็จ (แลกกะ ฯลฯ): แถบแจ้งผล ✓
    h += '<div class="cux-web-feature">' + hero() + webDecor() + '</div>' + acts();
    const T = { leave: 'ขอลา', ot: 'ขอ OT', fix: 'แจ้งแก้เวลา', swap: 'แลกกะ' }[C.tab];
    if (T) h += `<h3 class="h2" style="margin:8px 0 10px">${T}<span class="spacer"></span><a href="#" class="btn sm" data-a="tab:days">ปิด</a></h3>`;
    else h += `<div class="cux-seg" role="tablist"><a href="#" data-a="tab:days"${C.tab !== 'month' ? ' aria-current="page"' : ''}>ตารางของฉัน</a><a href="#" data-a="tab:month"${C.tab === 'month' ? ' aria-current="page"' : ''}>เดือนนี้</a></div>`;
    h += ({ days: tabDays, month: tabMonth, ot: tabOT, leave: tabLeave, fix: tabFix, swap: typeof tabSwap === 'function' ? tabSwap : tabDays }[C.tab] || tabDays)();
    return h + '</div>';
  }

  /* ---------- หน้าต่างแจ้งผล ---------- */
  function modal(html, onClose, ms) {
    const el = document.createElement('div'); el.className = 'cux-modal'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true');
    el.innerHTML = `<div class="cux-card">${html}</div>`;
    document.body.appendChild(el);
    let t = null;
    const close = v => { if (!el.isConnected) return; clearTimeout(t); el.remove(); if (onClose) onClose(v); };
    el.addEventListener('click', e => { const b = e.target.closest('[data-cux]'); if (b) { e.preventDefault(); e.stopPropagation(); close(b.dataset.cux); } else if (e.target === el && ms) close('ok'); });
    if (ms) t = setTimeout(() => close('ok'), ms);
    const f = el.querySelector('[data-cux="ok"],[data-cux="yes"]'); if (f) f.focus();
    return close;
  }
  function success(type) {
    const m = C.my, rec = type === 'in' ? m.open : m.todayRec; if (!rec) return;
    const t = type === 'in' ? rec.inTime : rec.outTime, late = type === 'in' && num(rec.lateMin);
    const chips = type === 'in' ? `<span class="chip ${late ? 'warn' : 'ok'}">${late ? `สาย ${rec.lateMin} นาที` : 'ตรงเวลา'}</span>` : `${num(rec.workMin) ? `<span class="chip ok">ทำงาน ${hrsShort(rec.workMin)}</span>` : ''}${num(rec.otMin) ? `<span class="chip warn">OT ${rec.otMin} นาที รออนุมัติ</span>` : ''}`;
    const where = multi() ? brName(m.plan.branch || m.homeBranch) : '';
    try { if (navigator.vibrate) navigator.vibrate(40); } catch (e) { /* */ }
    const note = (type === 'in' ? 'เข้างาน' : 'ออกงาน') + 'แล้ว ' + t + ' น.';
    modal(`<div class="cux-ring ${type === 'out' ? 'out' : late ? 'warn' : ''}"><i>${I.ok}</i></div><h2>ลงเวลา${type === 'in' ? 'เข้างาน' : 'ออกงาน'}เรียบร้อย</h2><div class="t">${esc(t)}</div><div class="chips">${chips}${where ? `<span class="chip">${esc(where)}</span>` : ''}</div><p>${type === 'in' ? 'ขอให้วันนี้เป็นวันที่ดี' : 'เดินทางกลับปลอดภัย'} · ปิดเองใน 3 วินาที</p><button class="btn primary" data-cux="ok">ตกลง</button>`,
      () => { if (C.embed && AUTO && typeof embedPost === 'function') { stopGeo(); embedPost('close', { note }); } }, 3000);
  }

  /* ---------- ต่อเข้ากับหน้าเดิม ---------- */
  const vm0 = viewMe;
  viewMe = function () { return inLine() || !C.my ? vm0() : newView(); };
  const dc0 = doClock;
  doClock = async function (type, btn) {
    if (inLine()) return dc0(type, btn);
    const p = C.my && C.my.plan;
    if (type === 'out' && !okEarly && p && !p.off && p.end && p.start && toMin(p.end) > toMin(p.start) && nowMin() < toMin(p.end) - 1) {
      return modal(`<div class="cux-ring warn"><i>${I.wait}</i></div><h2>ยังไม่ถึงเวลาเลิกกะ</h2><p style="font-size:15px">กะวันนี้เลิก <b>${esc(p.end)}</b> น. ต้องการออกงานตอนนี้ใช่ไหม</p><div class="row2"><button class="btn" data-cux="no">ยังก่อน</button><button class="btn primary" data-cux="yes" style="background:#B5562A;border-color:#B5562A">ออกงานเลย</button></div>`,
        v => { if (v === 'yes') { okEarly = true; const b = document.getElementById('cux-go'); doClock('out', b || btn).finally(() => { okEarly = false; }); } });
    }
    const before = C.my && C.my.state;
    clocking = true;
    try { await dc0(type, btn); } finally { clocking = false; }
    if (C.my && C.my.state !== before) { shownMsg = C.result ? C.result.msg : ''; C.result = null; render(); success(type); }
    else if (C.result && C.result.ok) render();
  };
  // ส่งคำขอสำเร็จ → แถบแจ้งผลพร้อมไอคอน แทนข้อความยาวบนหน้า
  ['sendReq', 'sendOT'].forEach(fn => {
    if (typeof window[fn] !== 'function') return;
    const f0 = window[fn];
    window[fn] = async function () {
      const out = await f0.apply(this, arguments);
      if (!inLine() && C.result && C.result.ok && typeof toast === 'function') { toast(String(C.result.msg).replace(/<[^>]+>/g, '')); C.result = null; C.tab = 'days'; render(); }
      return out;
    };
  });
  // อัปเดต GPS / เวลาทำงานบนหน้าโดยไม่วาดใหม่ทั้งหน้า (ไม่ทำให้ช่องที่กำลังพิมพ์หาย)
  setInterval(() => {
    if (inLine() || C.step !== 'me' || !C.my) return;
    const g = document.getElementById('cux-gps');
    if (g) { const [c, a, b] = gpsState(); g.className = 'cux-gps ' + c; g.querySelector('span').textContent = a; g.querySelector('b').textContent = b; }
    const w = document.getElementById('cux-worked');
    if (w && C.my.state === 'in') { const mm = workedMin(), p = C.my.plan, span = Math.max(60, toMin(p.end || '00:00') - toMin(p.start || '00:00')); w.textContent = hrsShort(mm); const pr = document.getElementById('cux-prog'); if (pr) pr.style.width = Math.min(100, Math.round(mm / span * 100)) + '%'; }
    if (!autoDone && C.my.state && document.getElementById('cux-go')) {
      autoDone = true;
      if ((AUTO === 'in' && C.my.state === 'out') || (AUTO === 'out' && C.my.state === 'in')) doClock(AUTO, document.getElementById('cux-go'));
    }
  }, 1500);
})();
