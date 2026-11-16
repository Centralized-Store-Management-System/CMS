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
    '.group.pad.my.tux{padding:0;background:transparent;border:0;box-shadow:none}.my.tux .mystats{padding:0 4px}'
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
    let h = `<div class="tux-hero"><div class="tux-top"><div><small>กะวันนี้${p.branch && p.branch !== e.branch ? ' · ไปช่วย' + esc(branchName(p.branch)) : ''}</small><b>${p.off ? 'วันหยุด' : esc(p.start) + ' – ' + esc(p.end)}</b><small>${esc(p.code || '')}</small></div>${pill}</div>
      <div class="tux-tiles"><div class="tux-tile${a ? ' on' : ''}"><small>${a ? '✓ เข้างานแล้ว' : 'เข้างาน'}</small><b>${a ? esc(a.inTime) : '--:--'}</b><em class="${late ? 'late' : ''}">${a ? (late ? `สาย ${a.lateMin} นาที` : 'ตรงเวลา') : 'ยังไม่เข้า'}</em></div>
      <div class="tux-tile${a && a.outTime ? ' on' : ''}"><small>${a && a.outTime ? '✓ ออกงานแล้ว' : 'ออกงาน'}</small><b>${a && a.outTime ? esc(a.outTime) : '--:--'}</b><em>${a && a.outTime ? (num(a.workMin) ? 'ทำงาน ' + hrsShort(a.workMin) : '') + (num(a.otMin) > 0 ? ` · OT ${a.otMin} น.${a.otStatus ? ' ' + esc(a.otStatus) : ''}` : '') : 'ยังไม่ออก'}</em></div></div>`;
    if (st === 'done') h += '<div class="tux-done">ลงเวลาครบแล้ววันนี้ ✓</div>';
    else if (st === 'in') h += `<a class="tux-go out" href="${esc(withQ(link, 'auto', 'out'))}">${I.out}ออกงาน</a><p class="tux-note">แตะครั้งเดียว ระบบตรวจ GPS แล้วลงเวลาให้</p>`;
    else if (!lvT || lvT.status !== 'อนุมัติ') h += `<a class="tux-go in" href="${esc(withQ(link, 'auto', 'in'))}">${I.in}เข้างาน</a><p class="tux-note">${p.off ? 'วันนี้วันหยุด ถ้ามาทำงาน ระบบส่งให้ผู้อนุมัติ' : 'แตะครั้งเดียว ระบบตรวจ GPS แล้วลงเวลาให้'}</p>`;
    h += '</div>';
    const list = [['leave', 'ขอลา', '#E6F1EA', '#17694A'], ['ot', 'ขอ OT', '#F6EEDC', '#8A6516'], ['fix', 'แก้เวลา', '#E8EEF6', '#2F5C8F'], ['swap', 'แลกกะ', '#F1E8F2', '#7A3E7F']];
    h += `<nav class="tux-acts" aria-label="ทำรายการ" style="grid-template-columns:repeat(4,minmax(0,1fr))">${list.map(([k, l, bg, fg]) => `<a class="tux-act" href="${esc(withQ(link, 'tab', k))}"><span style="background:${bg};color:${fg}">${I[k]}</span>${l}</a>`).join('')}</nav>`;
    return h;
  };
})();
