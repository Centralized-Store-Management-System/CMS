/* สร้าง modules/finance/css/fin-embed.css จาก finance.css + fin-ui.css
 * ใช้ตอนแสดง Finance ในหน้าหลังร้าน (index.html): ครอบทุก selector ด้วย .fin-embed ไม่ให้กระทบ CSS ของ CMS
 * ตัดส่วนโครงหน้าแยก (sidebar/topbar ของหน้า finance.html) ทิ้ง · สีใช้ตัวแปรของ CMS
 * รัน: NODE_PATH=<ที่ติดตั้ง postcss> node tests/finance/build-embed-css.cjs */
'use strict';
const fs = require('fs'), path = require('path'), postcss = require('postcss');
const dir = path.join(__dirname, '../../modules/finance/css');
const SHELL = /\.fm-(app|sidebar|main|topbar|brand|company|backdrop|menu-btn|sidebar-foot|nav|subnav|breadcrumb|top-actions|help|chevron|icon|avatar|footer|preview-tag)\b/;
const S = '.fin-embed';
function scope(sel) {
  sel = sel.trim();
  if (sel === ':root' || sel === 'body' || sel === 'html') return S;
  let m = sel.match(/^(html(?:\[[^\]]*\]|:not\([^)]*\))*)\s+(.*)$/);   // html[data-theme=dark] body / .x
  if (m) { const rest = m[2].replace(/^body\b/, '').trim(); return m[1] + ' ' + S + (rest ? ' ' + rest : ''); }
  if (/^body\./.test(sel)) return S + sel.slice(4);                    // body.fm-noscroll → .fin-embed.fm-noscroll
  return S + ' ' + sel;
}
const out = postcss.root();
for (const f of ['finance.css', 'fin-ui.css', 'fin-flow.css']) {
  const root = postcss.parse(fs.readFileSync(path.join(dir, f), 'utf8'), { from: f });
  root.walkRules(rule => {
    if (rule.parent && rule.parent.type === 'atrule' && /keyframes/.test(rule.parent.name)) return;
    const sels = rule.selectors.filter(s => !SHELL.test(s));
    if (!sels.length) { rule.remove(); return; }
    rule.selectors = sels.map(scope);
  });
  root.walkAtRules('media', at => { if (!at.nodes || !at.nodes.length) at.remove(); });
  root.walkComments(c => c.remove());
  out.append(root.nodes);
}
const head = `/* สร้างอัตโนมัติจาก finance.css + fin-ui.css โดย tests/finance/build-embed-css.cjs — อย่าแก้ไฟล์นี้ตรงๆ
 * Finance ในหน้าหลังร้าน: ทุกอย่างอยู่ใต้ .fin-embed · สีตามธีม CMS */
.fin-embed{--green:var(--brand);--dark:var(--ink);--fm-radius:14px;font-family:var(--font);color:var(--ink)}
.fin-embed h1,.fin-embed h2{font-family:var(--display)}
`;
const tail = `
body.fm-noscroll{overflow:hidden}
.fin-embed .fin-content{min-height:240px}
.fin-embed .fm-eyebrow{display:none}
.fin-embed .fm-page-head h1{font-size:21px;margin-top:0}
.fin-embed .fm-table th{top:0}
@media (max-width:959px){.fin-embed .fm-page-head h1{font-size:19px}}
`;
const css = head + out.toString().replace(/\n{2,}/g, '\n') + tail;
fs.writeFileSync(path.join(dir, 'fin-embed.css'), css);
console.log('fin-embed.css', css.length, 'bytes');
