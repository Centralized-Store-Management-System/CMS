/* ธีมและแบรนด์ของร้าน: สี ฟอนต์ ขนาดตัวอักษร มุมโค้ง ความหนาแน่น โลโก้ (ใช้ทั้งหลังร้านและหน้าลงเวลา)
 * Owner ตั้งค่าทั้งร้านที่ System > Design (เก็บใน settings.theme) แต่ละคนปรับโหมดมืด/ขนาดตัวอักษรเฉพาะเครื่องตัวเองได้ */
'use strict';
const THEME_PRESETS = {
  international: { name: 'International', th: 'เขียว Amazon · ครีม · ทอง', primary: '#0B6842', accent: '#C99A45', bg: '#F5F7F4', mods: 'multi' },
  forest: { name: 'Forest', th: 'เขียวเข้ม', primary: '#1E4D38', accent: '#2F7D55', bg: '#F1F4F1', mods: 'multi' },
  espresso: { name: 'Espresso', th: 'น้ำตาลกาแฟ', primary: '#5B3A29', accent: '#9A6B45', bg: '#F5F1EC', mods: 'multi' },
  ocean: { name: 'Ocean', th: 'น้ำเงิน', primary: '#1F4E79', accent: '#2E7BBF', bg: '#F0F3F7', mods: 'multi' },
  charcoal: { name: 'Charcoal', th: 'เรียบ ขาวดำ', primary: '#2B3035', accent: '#5C6670', bg: '#F2F3F4', mods: 'brand' },
  terracotta: { name: 'Terracotta', th: 'ส้มอิฐ', primary: '#9C3D23', accent: '#C8693F', bg: '#F6F1EE', mods: 'multi' }
};
const THEME_FONTS = {
  'IBM Plex Sans Thai': 'IBM+Plex+Sans+Thai:wght@400;500;600',
  'Sarabun': 'Sarabun:wght@400;500;600',
  'Noto Sans Thai': 'Noto+Sans+Thai:wght@400;500;600',
  'Anuphan': 'Anuphan:wght@400;500;600',
  'Prompt': 'Prompt:wght@500;600',
  'Kanit': 'Kanit:wght@500;600'
};
const THEME_DEFAULT = { preset: 'forest', primary: '#1E4D38', accent: '#2F7D55', bg: '#F1F4F1', mods: 'multi', font: 'IBM Plex Sans Thai', head: 'Prompt', scale: 'm', radius: 'round', density: 'normal', mode: 'auto', logo: '', title: '', tagline: '', ui: 'classic' };
const THEME_SCALE = { s: 0.93, m: 1, l: 1.08, xl: 1.16 };
const MOD_KEYS = ['dash', 'approve', 'hr', 'time', 'sched', 'pay', 'stock', 'acct', 'set'];

function parseTheme(v) {
  let o = {};
  try { o = typeof v === 'string' ? JSON.parse(v || '{}') : (v || {}); } catch (e) { o = {}; }
  return { ...THEME_DEFAULT, ...o };
}
const myThemePrefs = () => { try { return JSON.parse(localStorage.getItem('amz.mytheme') || '{}') || {}; } catch (e) { return {}; } };
function setMyThemePrefs(p) { try { localStorage.setItem('amz.mytheme', JSON.stringify(p)); } catch (e) { /* ignore */ } }

/* ผสมสี hex: mix('#000000', '#ffffff', 0.5) */
function hexMix(a, b, t) {
  const p = h => { h = String(h || '#000').replace('#', ''); if (h.length === 3) h = h.split('').map(c => c + c).join(''); return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16) || 0); };
  const x = p(a), y = p(b);
  return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join('');
}
const validHex = c => /^#[0-9a-fA-F]{6}$/.test(String(c || ''));
function fontStack(f, fallback) { return `"${f}",${fallback}`; }

/** ใช้ธีมกับหน้าเว็บทันที (preview ใช้ฟังก์ชันเดียวกัน) */
function applyTheme(raw, opts = {}) {
  const t = parseTheme(raw), me = opts.ignoreMine ? {} : myThemePrefs();
  const primary = validHex(t.primary) ? t.primary : THEME_DEFAULT.primary, accent = validHex(t.accent) ? t.accent : primary, bg = validHex(t.bg) ? t.bg : THEME_DEFAULT.bg;
  const darkP = hexMix(primary, '#ffffff', 0.38), darkA = hexMix(accent, '#ffffff', 0.45);
  const light = [`--brand:${primary}`, `--focus:${accent}`, `--bg:${bg}`, `--sunk:${hexMix(bg, primary, 0.07)}`, `--line:${hexMix(bg, primary, 0.15)}`, `--font:${fontStack(t.font, '"Leelawadee UI","Noto Sans Thai",Tahoma,sans-serif')}`, `--display:${fontStack(t.head, '"IBM Plex Sans Thai","Leelawadee UI",sans-serif')}`];
  const dark = [`--brand:${darkP}`, `--focus:${darkA}`];
  if (t.mods === 'brand') { MOD_KEYS.forEach(k => { light.push(`--m-${k}:${primary}`); dark.push(`--m-${k}:${darkP}`); }); light.push('--m-approve:#B0384A'); dark.push('--m-approve:#EE7F8C'); }
  const css = `:root{${light.join(';')}}@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){${dark.join(';')}}}:root[data-theme="dark"]{${dark.join(';')}}`;
  let st = document.getElementById('theme-css');
  if (!st) { st = document.createElement('style'); st.id = 'theme-css'; document.head.appendChild(st); }
  st.textContent = css;
  const need = [t.font, t.head].filter(f => THEME_FONTS[f] && !['IBM Plex Sans Thai', 'Prompt'].includes(f));
  let lk = document.getElementById('theme-font');
  if (need.length) {
    const href = 'https://fonts.googleapis.com/css2?' + need.map(f => 'family=' + THEME_FONTS[f]).join('&') + '&display=swap';
    if (!lk) { lk = document.createElement('link'); lk.id = 'theme-font'; lk.rel = 'stylesheet'; document.head.appendChild(lk); }
    if (lk.href !== href) lk.href = href;
  } else if (lk) lk.remove();
  const mode = me.mode || t.mode, root = document.documentElement;
  if (mode === 'light' || mode === 'dark') root.dataset.theme = mode; else delete root.dataset.theme;
  if ((me.ui || t.ui) === 'b') root.dataset.ui = 'b'; else delete root.dataset.ui; // หน้าตาแบบ B (css/theme-b.css) · เดิม = ไม่มี data-ui
  if (root.dataset.ui === 'b' && !document.getElementById('theme-font-b')) { const l = document.createElement('link'); l.id = 'theme-font-b'; l.rel = 'stylesheet'; l.href = 'https://fonts.googleapis.com/css2?family=Anuphan:wght@400;500;600&display=swap'; document.head.appendChild(l); }   // ฟอนต์แบบ B โหลดเฉพาะคนที่ใช้
  const scale = THEME_SCALE[me.scale || t.scale] || 1;
  document.body.style.zoom = scale === 1 ? '' : String(scale);
  document.body.classList.toggle('sq', t.radius === 'square');
  document.body.classList.toggle('compact', t.density === 'compact');
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = primary;
  if (!opts.preview) { try { localStorage.setItem('amz.theme', JSON.stringify(t)); } catch (e) { /* ignore */ } }
  return t;
}
/** ธีมที่จำไว้ในเครื่อง ใช้ตอนยังไม่ได้เข้าสู่ระบบ (หน้า login แสดงโลโก้และสีของร้านได้ทันที) */
const cachedTheme = () => { try { return parseTheme(localStorage.getItem('amz.theme') || '{}'); } catch (e) { return parseTheme({}); } };
/** โลโก้ของร้าน หรือไอคอนแก้วกาแฟ */
function themeLogo(t, fallbackSvg) {
  t = t || cachedTheme();
  return t.logo && /^data:image\/(png|jpeg|webp|svg\+xml);base64,/.test(t.logo) ? `<img src="${t.logo}" alt="" class="logo-img">` : fallbackSvg;
}
