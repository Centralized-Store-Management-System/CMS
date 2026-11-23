/* ใยแมงมุม · ตรวจความเชื่อมโยง (Owner › ระบบ IT)
 * อ่านผลจาก data/link-graph.json ที่ tools/link-check.mjs สร้างไว้ (รันทุก PR ใน GitHub Actions)
 * - บอกว่า "จุดไหนยังไม่เชื่อมกัน" พร้อมบอกว่าต้องไปแก้ที่ไฟล์ไหน
 * - กดที่ปัญหาแล้วกระโดดไปยังจุดนั้นในใยแมงมุม · กดต่อไปยังจุดข้างเคียงได้เรื่อยๆ
 * - ไม่เรียกเซิร์ฟเวอร์ ไม่ใช้สิทธิ์เพิ่ม (ไฟล์เดียวกับที่เว็บโหลดอยู่แล้ว)
 * ไม่แก้ CSS ที่ใช้ร่วม — หน้าตาอยู่ในไฟล์นี้ทั้งหมด (กติกาใน AGENTS.md) */
'use strict';
const LK = { g: null, sel: null, only: true, q: '' };
const LK_REPO = 'https://github.com/Centralized-Store-Management-System/CMS/blob/main/';
const LK_KIND = { page: 'หน้าเว็บ / แอป', script: 'ไฟล์โปรแกรม', fn: 'เซิร์ฟเวอร์ (Edge Function)', table: 'ตารางฐานข้อมูล', external: 'ภายนอก' };
const lkEsc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const lkNode = id => (LK.g ? (LK.g.nodes || []).find(n => n.id === id) : null);
const lkIn = id => (LK.g.edges || []).filter(e => e.to === id);
const lkOut = id => (LK.g.edges || []).filter(e => e.from === id);
const lkIssuesOf = id => (LK.g.issues || []).filter(i => (i.at || []).includes(id));

async function ocLinksLoad() {
  ocMain('<div class="lk-load"><b>กำลังอ่านผลตรวจความเชื่อมโยง</b><small>data/link-graph.json · สร้างโดย tools/link-check.mjs</small></div>');
  try {
    const r = await fetch('data/link-graph.json?ts=' + Date.now(), { cache: 'no-store' });
    if (!r.ok) throw new Error('ยังไม่มีผลตรวจในเว็บ (HTTP ' + r.status + ')');
    LK.g = await r.json();
    LK.sel = LK.sel && lkNode(LK.sel) ? LK.sel : ((LK.g.issues || [])[0]?.at || [])[0] || (LK.g.nodes || [])[0]?.id || null;
    ocMain(lkPage());
  } catch (e) {
    ocMain('<div class="status bad"><b>อ่านผลตรวจไม่สำเร็จ</b><p>' + lkEsc(e.message) + '</p>'
      + '<p class="muted">ผลตรวจถูกสร้างตอน merge โดย GitHub Actions · สร้างเองได้ด้วยคำสั่ง <code>node tools/link-check.mjs</code> แล้ว commit ไฟล์ data/link-graph.json</p>'
      + '<button class="btn primary" data-lk-reload>ลองใหม่</button></div>');
  }
}

/* ---------- ใยแมงมุมรอบจุดที่เลือก (1 ชั้น ซ้าย=ใครเรียกเรา ขวา=เราเรียกใคร) ---------- */
function lkWeb(id) {
  const me = lkNode(id); if (!me) return '';
  const CAP = 14;
  const up = lkIn(id).slice(0, CAP), down = lkOut(id).slice(0, CAP);
  const upMore = lkIn(id).length - up.length, downMore = lkOut(id).length - down.length;
  const rows = Math.max(up.length, down.length, 1);
  const H = Math.max(260, rows * 56 + 90), W = 1180, cx = W / 2, cy = H / 2;
  const colY = n => (i) => Math.round((H - (n * 56 - 16)) / 2 + i * 56 + 20);
  const yUp = colY(up.length || 1), yDown = colY(down.length || 1);
  const dot = st => st === 'bad' ? '#c32929' : st === 'warn' ? '#a9660e' : '#168250';
  const box = (x, y, w, nd, anchor) => {
    const st = nd ? nd.status : 'ok';
    return '<g class="lk-n" data-lk-go="' + lkEsc(nd.id) + '" tabindex="0" role="button" aria-label="' + lkEsc(nd.label) + '">'
      + '<rect x="' + x + '" y="' + (y - 18) + '" width="' + w + '" height="36" rx="10" fill="#fff" stroke="' + dot(st) + '" stroke-width="' + (st === 'ok' ? 1.4 : 2.2) + '"/>'
      + '<circle cx="' + (x + 14) + '" cy="' + y + '" r="5" fill="' + dot(st) + '"/>'
      + '<text x="' + (x + 26) + '" y="' + (y + 4) + '" class="lk-t" text-anchor="' + anchor + '">' + lkEsc(nd.label.length > 42 ? '…' + nd.label.slice(-41) : nd.label) + '</text></g>';
  };
  const line = (x1, y1, x2, y2, st, label) => '<g><path class="lk-e ' + (st || 'ok') + '" d="M ' + x1 + ' ' + y1 + ' C ' + ((x1 + x2) / 2) + ' ' + y1 + ', ' + ((x1 + x2) / 2) + ' ' + y2 + ', ' + x2 + ' ' + y2 + '"/>'
    + (label ? '<text class="lk-el" x="' + ((x1 + x2) / 2) + '" y="' + ((y1 + y2) / 2 - 6) + '">' + lkEsc(label) + '</text>' : '') + '</g>';
  let s = '';
  up.forEach((e, i) => { const n = lkNode(e.from); if (!n) return; s += line(300, yUp(i), cx - 160, cy, n.status === 'ok' ? 'ok' : 'bad', e.kind === 'script' ? (e.note || 'โหลด') : e.kind); });
  down.forEach((e, i) => { const n = lkNode(e.to); if (!n) return; s += line(cx + 160, cy, W - 300, yDown(i), n.status === 'ok' ? 'ok' : 'bad', e.kind); });
  up.forEach((e, i) => { const n = lkNode(e.from); if (n) s += box(20, yUp(i), 280, n, 'start'); });
  down.forEach((e, i) => { const n = lkNode(e.to); if (n) s += box(W - 300, yDown(i), 280, n, 'start'); });
  s += '<g><rect x="' + (cx - 160) + '" y="' + (cy - 30) + '" width="320" height="60" rx="14" fill="#07583f" stroke="#07583f"/>'
    + '<text x="' + cx + '" y="' + (cy - 6) + '" class="lk-ct">' + lkEsc(me.label.length > 36 ? '…' + me.label.slice(-35) : me.label) + '</text>'
    + '<text x="' + cx + '" y="' + (cy + 14) + '" class="lk-cs">' + lkEsc(LK_KIND[me.kind] || me.kind) + '</text></g>';
  const more = (n, side) => n > 0 ? '<text class="lk-more" x="' + (side === 'l' ? 160 : W - 160) + '" y="' + (H - 18) + '">และอีก ' + n + ' จุด</text>' : '';
  return '<svg class="lk-svg" viewBox="0 0 ' + W + ' ' + H + '" style="width:' + W + 'px" role="img" aria-label="ความเชื่อมโยงรอบ ' + lkEsc(me.label) + '">'
    + '<text class="lk-side" x="20" y="22">สิ่งที่เรียกจุดนี้ (' + lkIn(id).length + ')</text>'
    + '<text class="lk-side" x="' + (W - 300) + '" y="22">จุดนี้เรียกต่อไปที่ (' + lkOut(id).length + ')</text>'
    + s + more(upMore, 'l') + more(downMore, 'r') + '</svg>';
}

function lkDetail(id) {
  const n = lkNode(id); if (!n) return '<div class="lk-note">เลือกจุดที่ต้องการดู</div>';
  const mine = lkIssuesOf(id);
  const file = n.kind === 'script' || n.kind === 'page' ? n.label : (n.file || '');
  return '<div class="lk-kick">' + lkEsc(LK_KIND[n.kind] || n.kind) + '</div><h3 class="lk-h">' + lkEsc(n.label) + '</h3>'
    + '<div class="lk-mini"><div><small>สถานะ</small><b class="' + n.status + '">' + (n.status === 'bad' ? 'มีปัญหา' : n.status === 'warn' ? 'ควรดู' : 'ปกติ') + '</b></div>'
    + '<div><small>ถูกเรียกโดย</small><b>' + lkIn(id).length + '</b></div><div><small>เรียกต่อไปที่</small><b>' + lkOut(id).length + '</b></div></div>'
    + (file ? '<div class="lk-row"><b>ไฟล์</b><a href="' + LK_REPO + lkEsc(file) + '" target="_blank" rel="noopener">เปิดดูโค้ดบน GitHub</a></div>' : '')
    + (mine.length ? mine.map(lkIssueCard).join('') : '<div class="lk-note good">จุดนี้ไม่มีปัญหาค้างอยู่</div>');
}

function lkIssueCard(i) {
  return '<article class="lk-i ' + (i.baselined ? 'old' : i.level) + '">'
    + '<div class="lk-i-top"><b>' + lkEsc(i.title) + '</b><span>' + (i.baselined ? 'หนี้เก่า' : i.level === 'error' ? 'ต้องแก้' : 'ควรดู') + '</span></div>'
    + '<p>' + lkEsc(i.detail) + '</p>'
    + '<p class="lk-fix"><b>วิธีแก้:</b> ' + lkEsc(i.fix) + '</p>'
    + '<div class="lk-i-act">' + (i.where ? '<a class="btn sm" href="' + LK_REPO + lkEsc(i.where) + '" target="_blank" rel="noopener">เปิดไฟล์</a>' : '')
    + ((i.at || []).map(id => '<button class="btn sm" data-lk-go="' + lkEsc(id) + '">ดู ' + lkEsc((lkNode(id) || {}).label || id) + ' ในใยแมงมุม</button>').join(''))
    + '<span class="lk-code">' + lkEsc(i.code) + '</span></div></article>';
}

function lkPage() {
  setTimeout(lkBind, 0);
  const g = LK.g, s = g.summary || {}, q = LK.q.toLowerCase();
  const fresh = (g.issues || []).filter(i => !i.baselined), old = (g.issues || []).filter(i => i.baselined);
  const list = (g.nodes || []).filter(n => (!LK.only || n.status !== 'ok') && (!q || n.label.toLowerCase().includes(q)));
  const byKind = {};
  list.forEach(n => (byKind[n.kind] = byKind[n.kind] || []).push(n));
  const css = '<style>'
    + '.lk-load{padding:34px;text-align:center;background:#fff;border:1px solid var(--line);border-radius:14px}.lk-load b,.lk-load small{display:block}.lk-load small{color:var(--muted);margin-top:5px}'
    + '.lk-head{display:flex;justify-content:space-between;gap:14px;flex-wrap:wrap;padding:18px;background:linear-gradient(115deg,#f4fbf6,#fff);border:1px solid var(--line);border-radius:17px}'
    + '.lk-head-act{display:flex;gap:8px;flex-wrap:wrap;align-items:flex-start}'
    + '.lk-head h1{margin:0;color:#064d37;font:700 23px Prompt}.lk-head p{margin:6px 0 0;color:var(--muted);font-size:12px}'
    + '.lk-kpis{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:9px;margin:13px 0}'
    + '.lk-kpi{background:#fff;border:1px solid var(--line);border-radius:14px;padding:12px}.lk-kpi small{display:block;color:var(--muted);font-size:10px}.lk-kpi strong{font:700 22px Prompt;color:#07583f}'
    + '.lk-kpi.bad strong{color:#b42318}.lk-kpi.warn strong{color:#a9660e}'
    + '.lk-panel{background:#fff;border:1px solid var(--line);border-radius:14px;padding:14px;margin:12px 0}'
    + '.lk-panel h2{margin:0 0 4px;font:700 15px Prompt;color:#174c35}.lk-panel>p.lk-sub{margin:0 0 10px;color:var(--muted);font-size:11.5px}'
    + '.lk-i{border:1px solid var(--line);border-left:4px solid #889a90;border-radius:10px;padding:11px;margin:8px 0;background:#fff}'
    + '.lk-i.error{border-left-color:#b42318;background:#fff7f6}.lk-i.warn{border-left-color:#d28a20;background:#fffaf1}.lk-i.old{border-left-color:#9aa8a0;background:#f7f9f8}'
    + '.lk-i-top{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}.lk-i-top b{font-size:13px}.lk-i-top span{font-size:10px;color:#8b5a12;white-space:nowrap}'
    + '.lk-i p{margin:5px 0;font-size:11.5px;line-height:1.6;color:#3d4f46}.lk-fix{color:#17673f}'
    + '.lk-i-act{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-top:7px}.lk-code{font-size:9.5px;color:var(--muted);margin-left:auto}'
    + '.lk-canvas{overflow:auto;border:1px solid var(--line);border-radius:12px;background:radial-gradient(#d9e4dd 1px,transparent 1px),#f8fbf9;background-size:22px 22px}'
    + '.lk-svg{display:block;height:auto;max-width:none}.lk-e{fill:none;stroke-width:2;stroke:#9cc3ad}.lk-e.bad{stroke:#c32929;stroke-dasharray:7 6}'
    + '.lk-el{font:9.5px sans-serif;fill:#6b7d72;text-anchor:middle;paint-order:stroke;stroke:#f8fbf9;stroke-width:4}'
    + '.lk-t{font:11.5px sans-serif;fill:#20382c}.lk-ct{font:700 13px sans-serif;fill:#fff;text-anchor:middle}.lk-cs{font:10px sans-serif;fill:#bfe3cf;text-anchor:middle}'
    + '.lk-side{font:700 10px sans-serif;fill:#6b7d72}.lk-more{font:10px sans-serif;fill:#6b7d72;text-anchor:middle}'
    + '.lk-n{cursor:pointer}.lk-n:hover rect,.lk-n:focus rect{stroke-width:3;outline:none}'
    + '.lk-kick{font-size:9px;font-weight:700;letter-spacing:.08em;color:#0d8052}.lk-h{margin:3px 0 9px;font:700 15px Prompt;color:#174c35;overflow-wrap:anywhere}'
    + '.lk-mini{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;margin-bottom:10px}'
    + '.lk-mini>div{padding:8px;background:#f5f8f6;border:1px solid #e7eee9;border-radius:9px}.lk-mini small{display:block;color:var(--muted);font-size:9px}.lk-mini b{font:700 14px Prompt;color:#07583f}'
    + '.lk-mini b.bad{color:#b42318}.lk-mini b.warn{color:#a9660e}'
    + '.lk-row{display:flex;justify-content:space-between;gap:10px;padding:7px 0;border-bottom:1px solid var(--line);font-size:11px}'
    + '.lk-note{padding:10px 12px;margin:8px 0;background:#f4f8f5;border-radius:10px;color:#607369;font-size:11px}.lk-note.good{background:#e8f7ef;color:#17673f}'
    + '.lk-tools{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:10px}.lk-tools input{flex:1;min-width:150px;margin:0}'
    + '.lk-list{max-height:520px;overflow:auto;padding-right:4px}'
    + '.lk-group{margin-top:10px}.lk-group h4{margin:0 0 5px;font:700 11px Prompt;color:#174c35}'
    + '.lk-item{display:flex;align-items:center;gap:8px;width:100%;padding:8px 10px;margin:4px 0;border:1px solid var(--line);border-radius:9px;background:#fff;cursor:pointer;text-align:left;font-size:11.5px;overflow-wrap:anywhere}'
    + '.lk-item i{width:8px;height:8px;border-radius:50%;flex:none;background:#168250}.lk-item i.bad{background:#c32929}.lk-item i.warn{background:#d28a20}'
    + '.lk-item.on{border-color:#07583f;box-shadow:inset 0 0 0 1px #07583f}'
    + '.lk-two{display:grid;grid-template-columns:minmax(0,1.3fr) minmax(280px,.7fr);gap:12px}'
    + '@media(max-width:900px){.lk-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}.lk-two{grid-template-columns:1fr}}'
    + '</style>';
  return css + '<div class="lk-wrap">'
    + '<section class="lk-head"><div><h1>ใยแมงมุม · ตรวจความเชื่อมโยง</h1>'
    + '<p>ตรวจว่า "ของที่ต้องตรงกัน ตรงกันจริงไหม" — หน้าเว็บ ↔ ไฟล์ ↔ ปุ่ม ↔ Edge Function ↔ ตาราง · ตรวจล่าสุด ' + lkEsc(new Date(g.generated_at).toLocaleString('th-TH')) + '</p>'
    + '<p>' + lkEsc(s.version_rule || '') + '</p></div>'
    + '<div class="lk-head-act"><a class="btn primary" href="index.html?from=owner#web">ใยแมงมุมของคนและระบบ ›</a><button class="btn" data-lk-reload>อ่านผลล่าสุด</button></div></section>'
    + '<div class="lk-note">หน้านี้คือใยของ <b>ไฟล์โปรแกรม</b> — ใช้กันไม่ให้โค้ดพังก่อนขึ้นระบบ · ถ้าต้องการดูว่า <b>พนักงาน ตำแหน่ง เมนู สาขา</b> เชื่อมกันครบหรือยัง และซ่อมให้ได้ในที่เดียว ให้กดปุ่มเขียวด้านบน (อยู่ในเว็บหลังร้าน › Menu › System › ใยแมงมุมระบบ)</div>'
    + '<section class="lk-kpis">'
    + '<div class="lk-kpi ' + (s.errors ? 'bad' : '') + '"><small>ต้องแก้ (ของใหม่)</small><strong>' + (s.errors || 0) + '</strong></div>'
    + '<div class="lk-kpi ' + (s.warns ? 'warn' : '') + '"><small>ควรดู</small><strong>' + (s.warns || 0) + '</strong></div>'
    + '<div class="lk-kpi"><small>หนี้เก่า</small><strong>' + (s.debt || 0) + '</strong></div>'
    + '<div class="lk-kpi"><small>จุดทั้งหมด</small><strong>' + (g.nodes || []).length + '</strong></div>'
    + '<div class="lk-kpi"><small>เส้นเชื่อม</small><strong>' + (g.edges || []).length + '</strong></div></section>'
    + '<section class="lk-panel"><h2>จุดที่ยังไม่เชื่อมกัน</h2><p class="lk-sub">กดปุ่มในแต่ละใบเพื่อกระโดดไปดูจุดนั้นในใยแมงมุม หรือเปิดไฟล์ดูโค้ดได้เลย</p>'
    + (fresh.length ? fresh.map(lkIssueCard).join('') : '<div class="lk-note good">ไม่มีปัญหาใหม่ · ทุกเส้นที่ตรวจได้ตรงกันหมด</div>')
    + (old.length ? '<details class="lk-note"><summary>หนี้เก่าที่ยกยอดไว้ ' + old.length + ' รายการ (ไม่บล็อกการ merge)</summary>' + old.map(lkIssueCard).join('') + '</details>' : '')
    + '</section>'
    + '<section class="lk-panel"><h2>ใยแมงมุมรอบจุดที่เลือก</h2><p class="lk-sub">กดกล่องข้างๆ เพื่อเดินต่อไปทีละจุด · เส้นประแดง = ปลายทางมีปัญหา</p>'
    + '<div class="lk-canvas">' + (LK.sel ? lkWeb(LK.sel) : '') + '</div></section>'
    + '<div class="lk-two">'
    + '<section class="lk-panel"><h2>ทุกจุดในระบบ</h2>'
    + '<div class="lk-tools"><input class="field" id="lk-q" placeholder="ค้นหาไฟล์ / ฟังก์ชัน / ตาราง" value="' + lkEsc(LK.q) + '">'
    + '<label class="chk"><input type="checkbox" id="lk-only"' + (LK.only ? ' checked' : '') + '> เฉพาะจุดที่มีปัญหา</label></div>'
    + '<div class="lk-list">' + (list.length ? Object.keys(byKind).map(k => '<div class="lk-group"><h4>' + lkEsc(LK_KIND[k] || k) + ' (' + byKind[k].length + ')</h4>'
      + byKind[k].map(n => '<button class="lk-item' + (n.id === LK.sel ? ' on' : '') + '" data-lk-go="' + lkEsc(n.id) + '"><i class="' + n.status + '"></i><span>' + lkEsc(n.label) + '</span></button>').join('') + '</div>').join('')
      : '<div class="lk-note good">ไม่มีจุดที่ตรงกับเงื่อนไข</div>') + '</div>'
    + '</section>'
    + '<section class="lk-panel"><h2>รายละเอียดจุดที่เลือก</h2><div id="lk-detail">' + (LK.sel ? lkDetail(LK.sel) : '') + '</div></section>'
    + '</div></div>';
}

function lkBind() {
  const root = document.getElementById('oc-main');
  if (!root || root.dataset.lkBound === '1') return;
  root.dataset.lkBound = '1';
  root.addEventListener('click', e => {
    if (e.target.closest('[data-lk-reload]')) { ocLinksLoad(); return; }
    const go = e.target.closest('[data-lk-go]');
    if (!go) return;
    LK.sel = go.dataset.lkGo;
    ocMain(lkPage());
    document.querySelector('.lk-canvas')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
  root.addEventListener('keydown', e => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.closest('[data-lk-go]')) { e.preventDefault(); e.target.closest('[data-lk-go]').dispatchEvent(new MouseEvent('click', { bubbles: true })); }
  });
  root.addEventListener('input', e => { if (e.target.id === 'lk-q') { LK.q = e.target.value; const el = document.activeElement === e.target; ocMain(lkPage()); if (el) { const n = document.getElementById('lk-q'); if (n) { n.focus(); n.setSelectionRange(n.value.length, n.value.length); } } } });
  root.addEventListener('change', e => { if (e.target.id === 'lk-only') { LK.only = e.target.checked; ocMain(lkPage()); } });
}
