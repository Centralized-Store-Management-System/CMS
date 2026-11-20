/* หน้า Today (หลังร้าน) การ์ด "ของฉัน" แบบใหม่: ปุ่มลงเวลาใหญ่ กดครั้งเดียวลงเวลาเลย (เปิดหน้าต่างลงเวลาแล้วลงให้ทันที ?auto=in|out)
 * ช่องเวลาเข้า/ออกทึบเมื่อทำแล้ว · ปุ่มทำรายการ ขอลา / ขอ OT / แก้เวลา / แลกกะ เป็นไอคอน · เรียกจาก mod-today.js */
'use strict';
(function () {
  const st = document.createElement('style');
  st.textContent = [
    '.tux-hero{background:#10392A;color:#fff;border-radius:22px;padding:18px;display:flex;flex-direction:column;gap:12px}',
    '.tux-top{display:flex;justify-content:space-between;align-items:flex-start;gap:10px}.tux-top small{color:#B8D2C3;font-size:13px}.tux-top b{display:block;font:700 28px var(--display);line-height:1.2}',
    '.tux-pill{flex:none;padding:6px 10px;border-radius:999px;background:rgba(255,255,255,.13);font-size:12px;font-weight:700;white-space:nowrap}.tux-pill.go{background:#2FA66A}.tux-pill.done{background:#C29A3E;color:#10392A}.tux-pill.late{background:#B03535}',
    '.tux-tiles{display:grid;grid-template-columns:1fr 1fr;gap:10px}.tux-tile{border-radius:14px;padding:10px 12px;display:flex;flex-direction:column;background:rgba(255,255,255,.08);border:1px dashed rgba(255,255,255,.28)}',
    '.tux-tile small{font-size:12px;color:#B8D2C3}.tux-tile b{font:700 22px var(--display)}.tux-tile em{font-style:normal;font-size:12px;color:#B8D2C3}',
    '.tux-tile.on{background:#fff;color:#10392A;border:1px solid #fff}.tux-tile.on small{color:#3C5A4B}.tux-tile.on em{color:#17694A;font-weight:700}.tux-tile.on em.late{color:#B03535}',
    '.tux-go{display:flex;align-items:center;justify-content:center;gap:12px;height:80px;border-radius:20px;color:#fff!important;text-decoration:none;font:700 26px var(--display);-webkit-tap-highlight-color:transparent}.tux-go svg{width:30px;height:30px}',
    '.tux-go.in{background:#2FA66A;box-shadow:0 10px 26px rgba(47,166,106,.45)}.tux-go.out{background:#B5562A;box-shadow:0 10px 26px rgba(181,86,42,.4)}.tux-go:active{transform:scale(.98)}',
    '.tux-note{margin:-4px 0 0;text-align:center;font-size:12px;color:#B8D2C3}.tux-done{padding:12px;border-radius:14px;background:rgba(255,255,255,.1);font-weight:600;text-align:center}',
    '.tux-acts{display:grid;gap:10px;margin:14px 0 4px}.tux-act{display:flex;flex-direction:column;align-items:center;gap:6px;padding:12px 4px;border-radius:16px;background:var(--surface,#fff);border:1px solid var(--line);color:var(--ink)!important;text-decoration:none;font-size:13px;font-weight:600}',
    '.tux-act span{width:40px;height:40px;border-radius:12px;display:grid;place-items:center}.tux-act svg{width:20px;height:20px}',
    '.group.pad.my.tux{padding:0;background:transparent;border:0;box-shadow:none}.my.tux .mystats{padding:0 4px}',
    /* Compact Today layout: equal-height attendance and visual companion cards on desktop */
    '.tux-layout{display:grid;grid-template-columns:minmax(0,1fr);gap:12px;align-items:stretch;width:100%}',
    '.tux-hero{min-width:0;min-height:0;padding:16px;border-radius:20px;gap:10px}',
    '.tux-top b{font-size:24px}.tux-go{height:58px;font-size:21px;border-radius:15px}',
    '.tux-tiles{gap:8px}.tux-tile{padding:9px 11px}.tux-tile b{font-size:19px}',
    '.tux-decor{display:none;position:relative;overflow:hidden;min-width:0;border:1px solid #e0ebe4;border-radius:20px;background:linear-gradient(145deg,#fff 0%,#f3f8f3 60%,#e6f1e9 100%);color:#174d3b;padding:20px;flex-direction:column;justify-content:space-between}',
    '.tux-decor:before,.tux-decor:after{content:"";position:absolute;border:1px solid rgba(15,100,70,.12);border-radius:50%;pointer-events:none}',
    '.tux-decor:before{width:210px;height:210px;right:-65px;top:-65px}.tux-decor:after{width:145px;height:145px;right:-32px;top:-32px}',
    '.tux-decor{padding:18px 20px 14px;background:radial-gradient(circle at 90% 5%,#e8f4e5 0,transparent 34%),linear-gradient(145deg,#fffdf3 0%,#f4f8ee 58%,#e5f1e7 100%)}',
    '.tux-decor .deco-copy{position:relative;z-index:2}',
    '.tux-decor strong{display:block;font:800 clamp(22px,2.2vw,30px)/1.18 var(--display);letter-spacing:-.5px;color:#104b38;margin:2px 0 5px}',
    '.tux-decor p{margin:0;color:#71847a;font-size:13px;line-height:1.55;max-width:30ch}',
    '.tux-drinks{position:absolute;right:3%;bottom:9%;width:66%;height:64%;display:flex;align-items:flex-end;justify-content:center;gap:3%;z-index:1}',
    '.tux-cup{height:88%;width:28%;position:relative;filter:drop-shadow(0 8px 7px rgba(24,66,44,.14))}',
    '.tux-cup:nth-child(2){height:100%;width:31%}.tux-cup svg{width:100%;height:100%;overflow:visible}',
    '.tux-decor .deco-foot{position:relative;z-index:2;font-size:10px;letter-spacing:.12em;color:#87998f;text-transform:uppercase}',
    '.tux-decor .deco-leaf{position:absolute;width:90px;height:90px;border-radius:100% 0 100% 0;background:linear-gradient(135deg,#a9ce8e,#e4efd9);opacity:.45;right:-20px;top:-24px;transform:rotate(24deg)}',
    '@media(min-width:760px){.tux-layout{grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:14px}.tux-hero,.tux-decor{min-height:246px}.tux-decor{display:flex}.tux-hero{justify-content:space-between}.tux-go{height:56px}.tux-note{margin-top:-2px}}',
    '@media(min-width:1100px){.tux-layout{grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:16px}.tux-hero,.tux-decor{min-height:260px}.tux-top b{font-size:25px}}',
    '@media(max-width:759px){.tux-hero{padding:15px;border-radius:18px}.tux-go{height:56px;font-size:20px}.tux-tiles{gap:8px}}',
    /* Owner / executive dashboard KPI cards: compact, icon-led and touch-friendly */
    '.kpis.exec{grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin:14px 0 20px}',
    '.kpis.exec .exec-kpi{display:flex;flex-direction:column;align-items:flex-start;gap:8px;min-width:0;min-height:142px;padding:15px 15px 13px;border:1px solid #e1ebe4;border-radius:22px;background:linear-gradient(155deg,#fff 0%,#fbfdfb 100%);box-shadow:0 8px 22px rgba(18,61,43,.055);text-decoration:none;transition:transform .15s ease,box-shadow .15s ease}',
    '.kpis.exec .exec-kpi:active{transform:scale(.985)}',
    '.exec-kpi-head{display:flex;align-items:center;gap:9px;width:100%;min-width:0}',
    '.exec-kpi-head small{font-size:12px;line-height:1.3;color:#65766d;font-weight:600}',
    '.exec-kpi-icon{width:38px;height:38px;border-radius:13px;display:grid;place-items:center;flex:none;background:#e5f2e9;color:#08734f}',
    '.exec-kpi-icon svg{width:21px;height:21px}',
    '.exec-kpi.labor .exec-kpi-icon{background:#f7efdd;color:#987018}',
    '.exec-kpi.waste .exec-kpi-icon{background:#f8e9e4;color:#b45a3d}',
    '.exec-kpi.late .exec-kpi-icon{background:#e9eef7;color:#426d9e}',
    '.kpis.exec .exec-kpi>b{display:block;font:700 clamp(23px,5.8vw,30px)/1.15 var(--display);letter-spacing:-.4px;color:#17251e;overflow-wrap:anywhere}',
    '.kpis.exec .exec-kpi>em{font-style:normal;font-size:11.5px;line-height:1.35;color:#16815a;font-weight:600}',
    '.kpis.exec .exec-kpi.labor>em{color:#987018}.kpis.exec .exec-kpi.waste>em{color:#b45a3d}.kpis.exec .exec-kpi.late>em{color:#426d9e}',
    '.kpis.exec .exec-kpi>em.exec-kpi-hint{color:#84938b;font-weight:500}',
    '@media(min-width:760px){.kpis.exec{grid-template-columns:repeat(4,minmax(0,1fr));gap:14px}.kpis.exec .exec-kpi{min-height:154px;padding:17px}}',
    '@media(max-width:360px){.kpis.exec{gap:8px}.kpis.exec .exec-kpi{min-height:132px;padding:12px;border-radius:18px}.exec-kpi-head{gap:7px}.exec-kpi-icon{width:34px;height:34px}.kpis.exec .exec-kpi>b{font-size:22px}}'
    /* Owner Today visual refresh — content area only; sidebar/navigation untouched */,
    '#view:has(.kpis.exec) .hello{position:relative;isolation:isolate;overflow:hidden;min-height:178px;margin:0 0 18px;padding:24px 28px;border:1px solid #dce9df;border-radius:26px;background:linear-gradient(100deg,rgba(255,255,255,.98) 0%,rgba(250,253,246,.94) 42%,rgba(244,249,232,.45) 66%,rgba(226,241,218,.15) 100%),radial-gradient(ellipse at 88% 18%,#c6e6a4 0%,#e8f3d9 35%,transparent 62%),linear-gradient(135deg,#f9fbf5,#e7f1e8);box-shadow:0 12px 30px rgba(16,61,43,.07)}',
    '#view:has(.kpis.exec) .hello:before{content:"";position:absolute;z-index:-1;right:0;top:0;width:58%;height:100%;background:radial-gradient(ellipse at 72% 82%,rgba(255,255,255,.8) 0 8%,transparent 9%),radial-gradient(ellipse at 80% 92%,rgba(109,157,68,.2) 0 18%,transparent 19%),radial-gradient(ellipse at 62% 12%,rgba(130,180,86,.24) 0 18%,transparent 19%),linear-gradient(120deg,transparent 0 25%,rgba(111,165,66,.12) 26% 28%,transparent 29% 100%);pointer-events:none}',
    '#view:has(.kpis.exec) .hello:after{content:"";position:absolute;z-index:-1;right:7%;bottom:9px;width:112px;height:145px;border-radius:24px 24px 30px 30px;background:linear-gradient(180deg,rgba(255,255,255,.95) 0 16%,#9a542e 17% 78%,#6d3c25 79% 100%);border:5px solid rgba(255,255,255,.82);box-shadow:0 13px 24px rgba(38,72,44,.16);transform:rotate(4deg);clip-path:polygon(10% 0,90% 0,100% 100%,0 100%)}',
    '#view:has(.kpis.exec) .hello h2{position:relative;z-index:1;margin:0 0 7px;font:700 clamp(24px,2.4vw,32px)/1.25 var(--display);color:#173c2d;letter-spacing:-.5px}',
    '#view:has(.kpis.exec) .hello p{position:relative;z-index:1;margin:0;color:#60786b;font-size:14px;line-height:1.5}',
    '#view:has(.kpis.exec) .kpis.exec{grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;margin:0 0 22px}',
    '#view:has(.kpis.exec) .kpis.exec .exec-kpi{position:relative;isolation:isolate;overflow:hidden;min-height:164px;padding:17px 18px 15px;border-radius:22px;border:1px solid transparent;box-shadow:0 9px 22px rgba(18,61,43,.07)}',
    '#view:has(.kpis.exec) .kpis.exec .exec-kpi:after{content:"";position:absolute;z-index:-1;right:-20px;bottom:-48px;width:138px;height:112px;border-radius:60% 40% 0 0;opacity:.42;transform:rotate(-12deg)}',
    '#view:has(.kpis.exec) .exec-kpi.sales{background:linear-gradient(145deg,#f5fbea,#fff 72%)!important;border-color:#d7e9c8!important}.#view:has(.kpis.exec) .exec-kpi.sales:after{background:#8fce45}',
    '#view:has(.kpis.exec) .exec-kpi.labor{background:linear-gradient(145deg,#fff9e9,#fff 72%)!important;border-color:#f0e3bd!important}.#view:has(.kpis.exec) .exec-kpi.labor:after{background:#e5bd42}',
    '#view:has(.kpis.exec) .exec-kpi.waste{background:linear-gradient(145deg,#fff1ef,#fff 72%)!important;border-color:#f0d9d3!important}.#view:has(.kpis.exec) .exec-kpi.waste:after{background:#ee9aab}',
    '#view:has(.kpis.exec) .exec-kpi.late{background:linear-gradient(145deg,#eff7ff,#fff 72%)!important;border-color:#d9e7f5!important}.#view:has(.kpis.exec) .exec-kpi.late:after{background:#79b8ed}',
    '#view:has(.kpis.exec) .exec-kpi>b{font-size:clamp(25px,2.3vw,34px);color:#182820}',
    '#view:has(.kpis.exec)>.h3{margin:20px 2px 10px;color:#60786b;font-weight:700}',
    '#view:has(.kpis.exec) .group{border-radius:22px;border-color:#e0eae3;box-shadow:0 8px 22px rgba(18,61,43,.05);overflow:hidden}',
    '@media(max-width:1050px){#view:has(.kpis.exec) .kpis.exec{grid-template-columns:repeat(2,minmax(0,1fr))}}',
    '@media(max-width:759px){#view:has(.kpis.exec) .hello{min-height:150px;padding:20px 18px;border-radius:20px}#view:has(.kpis.exec) .hello:before{width:62%}#view:has(.kpis.exec) .hello:after{right:5%;width:76px;height:105px;bottom:8px;border-width:4px}#view:has(.kpis.exec) .kpis.exec{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-bottom:18px}#view:has(.kpis.exec) .kpis.exec .exec-kpi{min-height:138px;padding:13px;border-radius:18px}#view:has(.kpis.exec) .exec-kpi-head small{font-size:11px}}',
    '@media(max-width:380px){#view:has(.kpis.exec) .hello{padding:16px;min-height:136px}#view:has(.kpis.exec) .hello:after{width:60px;height:86px;right:4%}#view:has(.kpis.exec) .kpis.exec .exec-kpi{min-height:128px;padding:11px}}'
  ].join('');
  document.head.appendChild(st);
  const I = {
    in: '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><path d="m10 17 5-5-5-5"/><path d="M15 12H3"/></svg>',
    out: '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/></svg>',
    leave: '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18M9 16l2 2 4-4"/></svg>',
    ot: '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2M5 3 2 6M22 6l-3-3"/></svg>',
    fix: '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>',
    swap: '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/></svg>'
  };
  const withQ = (h, k, v) => h + (h.includes('?') ? '&' : '?') + k + '=' + v;
  window.myCardUx = function (e, p, a, lvT) {
    const link = clockLink(p.branch || e.branch), st = a ? (a.outTime ? 'done' : 'in') : 'out';
    const late = a && num(a.lateMin) > 0;
    const pill = st === 'in' ? `<span class="tux-pill go">กำลังทำงาน</span>` : st === 'done' ? '<span class="tux-pill done">ครบแล้ววันนี้</span>' : lvT ? `<span class="tux-pill">${esc(lvT.type || 'ลา')}${lvT.status === 'รออนุมัติ' ? ' (รออนุมัติ)' : ''}</span>` : p.off ? '<span class="tux-pill">วันหยุด</span>' : '<span class="tux-pill late">ยังไม่เข้างาน</span>';
    let h = `<div class="tux-layout"><div class="tux-hero"><div class="tux-top"><div><small>กะวันนี้${p.branch && p.branch !== e.branch ? ' · ไปช่วย' + esc(branchName(p.branch)) : ''}</small><b>${p.off ? 'วันหยุด' : esc(p.start) + ' – ' + esc(p.end)}</b><small>${esc(p.code || '')}</small></div>${pill}</div>
      <div class="tux-tiles"><div class="tux-tile${a ? ' on' : ''}"><small>${a ? '✓ เข้างานแล้ว' : 'เข้างาน'}</small><b>${a ? esc(a.inTime) : '--:--'}</b><em class="${late ? 'late' : ''}">${a ? (late ? `สาย ${a.lateMin} นาที` : 'ตรงเวลา') : 'ยังไม่เข้า'}</em></div>
      <div class="tux-tile${a && a.outTime ? ' on' : ''}"><small>${a && a.outTime ? '✓ ออกงานแล้ว' : 'ออกงาน'}</small><b>${a && a.outTime ? esc(a.outTime) : '--:--'}</b><em>${a && a.outTime ? (num(a.workMin) ? 'ทำงาน ' + hrsShort(a.workMin) : '') + (num(a.otMin) > 0 ? ` · OT ${a.otMin} น.${a.otStatus ? ' ' + esc(a.otStatus) : ''}` : '') : 'ยังไม่ออก'}</em></div></div>`;
    if (st === 'done') h += '<div class="tux-done">ลงเวลาครบแล้ววันนี้ ✓</div>';
    else if (st === 'in') h += `<a class="tux-go out" href="${esc(withQ(link, 'auto', 'out'))}">${I.out}ออกงาน</a><p class="tux-note">แตะครั้งเดียว ระบบตรวจ GPS แล้วลงเวลาให้</p>`;
    else if (!lvT || lvT.status !== 'อนุมัติ') h += `<a class="tux-go in" href="${esc(withQ(link, 'auto', 'in'))}">${I.in}เข้างาน</a><p class="tux-note">${p.off ? 'วันนี้วันหยุด ถ้ามาทำงาน ระบบส่งให้ผู้อนุมัติ' : 'แตะครั้งเดียว ระบบตรวจ GPS แล้วลงเวลาให้'}</p>`;
    h += '</div><aside class="tux-decor" aria-label="ข้อความสร้างแรงบันดาลใจ"><span class="deco-leaf" aria-hidden="true"></span><div class="deco-copy"><strong>เติมพลัง<br>ทุกวันทำงาน</strong><p>พักสักนิด เติมความสดชื่น<br>แล้วไปต่อให้เต็มที่ในทุกวัน</p></div><div class="tux-drinks" aria-hidden="true"><div class="tux-cup"><svg viewBox="0 0 100 180"><path d="M48 8h5v34" stroke="#16734f" stroke-width="5" stroke-linecap="round"/><path d="M18 48h66l-7 113q-1 10-11 10H36q-10 0-11-10Z" fill="#fff" stroke="#d8e5d9" stroke-width="2"/><path d="M23 77h56l-5 83q0 7-8 7H37q-8 0-8-7Z" fill="#a95c2d"/><path d="M18 48q5-14 13-14h38q10 0 15 14" fill="#f6e8d6" stroke="#d8e5d9" stroke-width="2"/><path d="M24 78h54" stroke="#e8b77c" stroke-width="3" opacity=".7"/><circle cx="38" cy="59" r="4" fill="#fff" opacity=".8"/><circle cx="51" cy="58" r="4" fill="#fff" opacity=".8"/><circle cx="64" cy="59" r="4" fill="#fff" opacity=".8"/></svg></div><div class="tux-cup"><svg viewBox="0 0 100 190"><path d="M49 6h5v39" stroke="#16734f" stroke-width="5" stroke-linecap="round"/><path d="M16 48h68l-8 125q-1 10-11 10H35q-10 0-11-10Z" fill="#fff" stroke="#d8e5d9" stroke-width="2"/><path d="M21 83h58l-5 89q0 6-9 6H36q-9 0-9-6Z" fill="#7a9d4a"/><path d="M16 48q5-14 13-14h42q8 0 13 14" fill="#f5f0dc" stroke="#d8e5d9" stroke-width="2"/><path d="M26 80q23-13 48 0" fill="none" stroke="#d7e6a7" stroke-width="5"/><circle cx="36" cy="58" r="4" fill="#fff"/><circle cx="50" cy="57" r="4" fill="#fff"/><circle cx="64" cy="58" r="4" fill="#fff"/></svg></div><div class="tux-cup"><svg viewBox="0 0 100 180"><path d="M48 8h5v34" stroke="#16734f" stroke-width="5" stroke-linecap="round"/><path d="M18 48h66l-7 113q-1 10-11 10H36q-10 0-11-10Z" fill="#fff" stroke="#eadde5" stroke-width="2"/><path d="M23 78h56l-5 83q0 7-8 7H37q-8 0-8-7Z" fill="#e88da9"/><path d="M18 48q5-14 13-14h38q10 0 15 14" fill="#fff0f4" stroke="#eadde5" stroke-width="2"/><path d="M25 77q25-10 50 0" fill="none" stroke="#ffc9d7" stroke-width="4"/><circle cx="37" cy="57" r="4" fill="#fff"/><circle cx="51" cy="56" r="4" fill="#fff"/><circle cx="65" cy="57" r="4" fill="#fff"/></svg></div></div><span class="deco-foot">Take a break · Refresh · Go further</span></aside></div>';
    const list = [['leave', 'ขอลา', '#E6F1EA', '#17694A'], ['ot', 'ขอ OT', '#F6EEDC', '#8A6516'], ['fix', 'แก้เวลา', '#E8EEF6', '#2F5C8F'], ['swap', 'แลกกะ', '#F1E8F2', '#7A3E7F']];
    h += `<nav class="tux-acts" aria-label="ทำรายการ" style="grid-template-columns:repeat(4,minmax(0,1fr))">${list.map(([k, l, bg, fg]) => `<a class="tux-act" href="${esc(withQ(link, 'tab', k))}"><span style="background:${bg};color:${fg}">${I[k]}</span>${l}</a>`).join('')}</nav>`;
    return h;
  };
})();
