/* ระบบหลังร้าน Café Amazon — ส่วนกลางที่ทุกระบบใช้ร่วมกัน: เครื่องมือ, การเชื่อมต่อ, ข้อมูล, ฟอร์ม, ไอคอน */
'use strict';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const num = Calc.num, bool = Calc.bool, pad = n => String(n).padStart(2, '0');
const sum = (arr, k) => arr.reduce((a, r) => a + num(typeof k === 'function' ? k(r) : r[k]), 0);
const r2 = n => Math.round(n * 100) / 100;
const localDate = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const hhmm = d => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const today = () => localDate(new Date());
const addDays = Calc.addDays, daysIn = Calc.daysInMonth, toMin = Calc.toMin, minHM = Calc.minToHM;
const fmt = n => Math.round(num(n)).toLocaleString('th-TH');
const fmtQ = n => r2(num(n)).toLocaleString('th-TH', { maximumFractionDigits: 2 });
const fmtMoney = n => num(n).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const baht = n => fmt(n) + ' บาท';
const thDate = (s, o = { day: 'numeric', month: 'short' }) => s ? new Date(s + 'T00:00:00').toLocaleDateString('th-TH', o) : '';
const thMonth = m => new Date(m + '-01T00:00:00').toLocaleDateString('th-TH', { month: 'long', year: 'numeric' });
const hrsShort = m => { m = Math.round(num(m)); return `${Math.floor(m / 60)}:${pad(m % 60)} ชม.`; };
const WD = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];
const WD_FULL = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
const LS = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }
};
const SS = { get(k) { try { return sessionStorage.getItem(k) || ''; } catch (e) { return ''; } }, set(k, v) { try { v ? sessionStorage.setItem(k, v) : sessionStorage.removeItem(k); } catch (e) { /* ignore */ } } };

/* ===== สถานะแอป ===== */
const TABLES = ['branches', 'employees', 'applicants', 'shifts', 'patterns', 'staffing', 'schedule', 'attendance', 'leaves', 'timefix', 'otreq', 'payroll', 'items', 'moves', 'sales', 'expenses', 'pnl_monthly', 'log', 'users'];
const DEFAULTS = {
  shopName: 'Café Amazon',
  shiftStart: '07:00', shiftEnd: '16:00', hoursPerDay: 8, breakMin: 60, lateGrace: 5, otMinMinutes: 30,
  minWage: 400, sickPaidDays: 30, personalPaidDays: 3, annualDays: 6,
  ssoRate: 5, ssoFloor: 1650, ssoCeil: 17500, ssoIncludeOT: true,
  royaltyPct: 3, marketingPct: 3, posRentMonthly: 2000, vatRegistered: false, amortMonths: 72,
  holidays: '', perms: ''
};
const APP_VER = '4.2.2';
const ROLE_NAME = { owner: 'Owner', admin: 'Admin', hr: 'HR', manager: 'Manager', staff: 'Staff' };
const ROLE_DESC = { owner: 'ทุกระบบ ทุกสาขา', admin: 'ดูแลระบบและผู้ใช้', hr: 'บุคคล เงินเดือน อนุมัติเวลา', manager: 'บริหารสาขา', staff: 'พนักงานสาขา' };
const S = { cfg: { apiUrl: '' }, demo: true, token: '', me: null, settings: { ...DEFAULTS }, t: {}, permList: [], books: null, month: today().slice(0, 7), branch: '', f: {}, rev: 0 };
TABLES.forEach(n => { S.t[n] = []; });
const can = (...keys) => !!S.me && (S.me.role === 'owner' || keys.includes('*') || keys.some(k => (S.me.perms || []).includes(k)));

/* ===== สาขา: S.branch = สาขาที่กำลังดู ('' = ทุกสาขาที่ดูแล) ===== */
const allBranch = () => S.me && S.me.scope === '*';
const myBranches = () => S.t.branches.filter(b => allBranch() || (S.me && (S.me.scope || []).includes(b.code)));
const openBranches = () => myBranches().filter(b => b.status !== 'ปิด');
const branchBy = c => S.t.branches.find(b => b.code === c);
const branchName = c => c ? ((branchBy(c) || {}).name || c) : 'ส่วนกลาง';
const multiBranch = () => myBranches().length > 1;
/** แถวนี้อยู่ในสาขาที่กำลังดูไหม */
const inBr = c => !S.branch || c === S.branch;
/** สาขาเดียวสำหรับหน้าที่ต้องเลือกสาขา (ตารางงาน ตรวจนับสต็อก ปิดยอด) */
const oneBranch = () => S.branch || (openBranches()[0] || myBranches()[0] || {}).code || '';
const branchOpts = (list = openBranches()) => list.map(b => [b.code, `${b.name} (${b.code})`]);
const branchChip = c => multiBranch() && c ? `<span class="chip br">${esc(branchName(c))}</span>` : '';
function setBranch(c) { S.branch = c; LS.set('amz.branch.' + (S.me && (S.me.empId || S.me.role)), c); S.f.pending = {}; S.f.patPend = {}; S.rev++; }
function restoreBranch() {
  const c = LS.get('amz.branch.' + (S.me && (S.me.empId || S.me.role)), null);
  S.branch = c !== null && (c === '' ? multiBranch() : myBranches().some(b => b.code === c)) ? c : (multiBranch() ? '' : oneBranch());
}

/* ===== เชื่อมต่อ Apps Script (JSONP + POST) หรือโหมดทดลอง ===== */
const validUrl = u => /^https:\/\/script\.google\.com\/(a\/macros\/[^/]+|macros)\/s\/[\w-]+\/exec$/.test(u);
function loadCfg() {
  S.cfg = LS.get('amz.cfg', { apiUrl: '' });
  if (!S.cfg.apiUrl && window.AMZ_API && validUrl(window.AMZ_API)) S.cfg.apiUrl = window.AMZ_API;   // URL ของร้านจาก js/config.js
  const q = new URLSearchParams(location.search).get('api');
  if (q && validUrl(q)) { S.cfg.apiUrl = q; LS.set('amz.cfg', S.cfg); }
  S.demo = !S.cfg.apiUrl;
}
class ApiError extends Error { constructor(m, code) { super(m); this.code = code || ''; } }
function jsonp(params, url = S.cfg.apiUrl) {
  return new Promise((resolve, reject) => {
    const cb = '_amz' + uid().replace(/\W/g, '');
    const s = document.createElement('script');
    const timer = setTimeout(() => { done(); reject(new ApiError('เซิร์ฟเวอร์ไม่ตอบกลับภายใน 30 วินาที ลองใหม่อีกครั้ง')); }, 30000);
    function done() { clearTimeout(timer); delete window[cb]; s.remove(); }
    window[cb] = res => { done(); if (res && res.job) runJobLater(res.job, url); res && res.ok ? resolve(res.data) : reject(new ApiError((res && res.error) || 'เซิร์ฟเวอร์ตอบกลับผิดรูปแบบ', res && res.code)); };
    s.onerror = () => { done(); reject(new ApiError('เชื่อมต่อ Apps Script ไม่ได้ ตรวจ URL และการ Deploy (Who has access: Anyone)')); };
    s.src = url + '?' + new URLSearchParams({ ...params, callback: cb });
    document.head.appendChild(s);
  });
}
/** สั่งให้ Apps Script ส่งแจ้งเตือน LINE ต่อเบื้องหลัง (ปิดหน้าไปแล้วก็ยังส่ง) ถ้าไม่ได้ ตัวตั้งเวลาทุก 1 นาทีทำให้ */
function runJobLater(id, url) {
  const body = JSON.stringify({ op: 'runJob', id });
  try { if (navigator.sendBeacon && navigator.sendBeacon(url, new Blob([body], { type: 'text/plain' }))) return; } catch (e) { /* ใช้ fetch แทน */ }
  fetch(url, { method: 'POST', mode: 'no-cors', keepalive: true, headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body }).catch(() => {});
}
const loadScript = src => new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('โหลดไฟล์ไม่สำเร็จ: ' + src)); document.head.appendChild(s); });
let demoLoading = null;
async function ensureDemo() {
  if (!window.DemoServer) { demoLoading = demoLoading || loadScript('js/demo-server.js?v=' + APP_VER); await demoLoading; }
  if (!DemoServer.ready()) DemoServer.seed();
}
const API = {
  async call(action, params = {}) {
    if (S.demo) {
      await ensureDemo();
      await new Promise(r => setTimeout(r, 40));
      const r = DemoServer.get({ action, ...params });
      if (!r.ok) throw new ApiError(r.error, r.code);
      return r.data;
    }
    return jsonp({ action, ...params });
  },
  async write(payload) {
    const body = JSON.stringify(payload);
    if (S.demo || encodeURIComponent(body).length < 3500) return API.call('write', { t: S.token, p: body });
    const nonce = uid();
    await fetch(S.cfg.apiUrl, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ ...payload, t: S.token, nonce }) });
    return API.call('nonce', { t: S.token, nonce });
  },
  async post(body) {
    if (S.demo) { await ensureDemo(); const r = DemoServer.post(body); if (!r.ok) throw new ApiError(r.error, r.code); return r.data; }
    await fetch(S.cfg.apiUrl, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) });
    return true;
  }
};

/* ===== ข้อมูลในหน้าเว็บ (สำเนาจาก Google Sheet ตามสิทธิ์) ===== */
const DB = {
  local(table, row) { const arr = S.t[table]; const i = arr.findIndex(r => r.id === row.id); if (i >= 0) arr[i] = { ...arr[i], ...row }; else arr.push(row); S.rev++; },
  async upsertMany(table, rows) {
    if (!rows.length) return { rows: [] };
    rows.forEach(r => { r.id = r.id || uid(); });
    const res = await API.write({ op: 'upsertMany', table, rows });
    const back = res && Array.isArray(res.rows) && res.rows.length === rows.length ? res.rows : rows;
    back.forEach(r => this.local(table, r));
    return { rows: back, extra: res && res.extra };
  },
  async upsert(table, row) { return (await this.upsertMany(table, [row])).rows[0]; },
  async remove(table, id) { await API.write({ op: 'remove', table, id }); S.t[table] = S.t[table].filter(r => r.id !== id); S.rev++; },
  async saveSettings() { await API.write({ op: 'saveSettings', row: S.settings }); }
};
async function bootstrap(pre) {
  const d = pre || await API.call('bootstrap', { t: S.token });   // pre = ข้อมูลที่มากับการเข้าสู่ระบบแล้ว (speed)
  if (typeof rememberBoot === 'function' && !(pre && pre._cached)) rememberBoot(d);   // fast.js: เปิดซ้ำขึ้นทันที
  S.me = d.me;
  S.settings = { ...DEFAULTS, ...(d.settings || {}) };
  S.permList = d.permList || [];
  S.books = d.books;
  TABLES.forEach(n => { S.t[n] = (d.tables && d.tables[n]) || []; });
  S.win = d.window || ''; S.hist = {}; S.stockOpen = d.stockOpening || {}; S.frozen = d.frozen || '';   // โหลดเฉพาะช่วงล่าสุด (speed.js)
  restoreBranch();
  if (typeof applyTheme === 'function') applyTheme(S.settings.theme);
  S.rev++;
}

/* ===== UI พื้นฐาน ===== */
let toastTimer;
function toast(msg) { const t = $('#toast'); if (!t) return; t.textContent = msg; t.classList.add('on'); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('on'), 3600); }
async function busy(btn, fn, label = 'กำลังบันทึก…') {
  const old = btn ? btn.innerHTML : '';
  if (btn) { btn.disabled = true; btn.textContent = label; }
  try { return await fn(); } finally { if (btn && btn.isConnected) { btn.disabled = false; btn.innerHTML = old; } }
}
function armed(btn, fn, text = 'แตะอีกครั้งเพื่อยืนยัน') {
  if (!btn.dataset.armed) {
    btn.dataset.armed = '1'; btn.dataset.label = btn.innerHTML; btn.textContent = text;
    setTimeout(() => { if (btn.isConnected && btn.dataset.armed) { delete btn.dataset.armed; btn.innerHTML = btn.dataset.label; } }, 4500);
    return false;
  }
  delete btn.dataset.armed;
  return fn();
}
function openSheet(html) {
  closeSheet();
  const scrim = document.createElement('div');
  scrim.className = 'scrim';
  scrim.innerHTML = `<div class="sheet" role="dialog" aria-modal="true">${html}</div>`;
  scrim.addEventListener('click', e => { if (e.target === scrim) closeSheet(); });
  document.body.appendChild(scrim);
  const f = scrim.querySelector('input:not([type=hidden]):not([type=file]),select,textarea,button');
  if (f && matchMedia('(pointer:fine)').matches) f.focus({ preventScroll: true });
  return scrim.querySelector('.sheet');
}
function closeSheet() { const s = $('.scrim'); if (s) s.remove(); }
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeSheet(); });
const showErr = (sh, m) => { const p = sh && sh.querySelector('.err'); if (p) p.textContent = m; else toast(m); };
const empty = t => `<p class="empty">${t}</p>`;
const statRow = (t, v, s) => `<div class="row static"><span class="main"><span class="t">${t}</span>${s ? `<span class="s">${s}</span>` : ''}</span><span class="v">${v}</span></div>`;

const IC = {
  dash: '<path d="M3.5 11 12 4l8.5 7v9a1 1 0 0 1-1 1H15v-6H9v6H4.5a1 1 0 0 1-1-1z"/>',
  approve: '<path d="M7 3.5h10a1.5 1.5 0 0 1 1.5 1.5v15l-3-2-3 2-3-2-3 2V5A1.5 1.5 0 0 1 7 3.5z"/><path d="m9 11 2 2 4-4.5"/>',
  hr: '<circle cx="9" cy="8.5" r="3.5"/><path d="M2.5 20c.6-3.6 3.3-5.5 6.5-5.5s5.9 1.9 6.5 5.5"/><path d="M16 5.2a3.3 3.3 0 0 1 0 6.6M18 14.8c2 .7 3.2 2.4 3.5 5.2"/>',
  time: '<rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 9.5h17M8 3v4M16 3v4"/><path d="M12 12.5v3l2 1.2"/>',
  pay: '<rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="2.6"/><path d="M6.5 9.5v5M17.5 9.5v5"/>',
  stock: '<path d="M4 7.5 12 3.5l8 4v9l-8 4-8-4z"/><path d="m4 7.5 8 4 8-4M12 11.5v9"/>',
  acct: '<path d="M5 20.5V10M10 20.5V4M15 20.5v-7M20 20.5V7.5"/><path d="M3 20.5h18"/>',
  sched: '<rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 9.5h17M8 3v4M16 3v4M7.5 13h2M11 13h2M14.5 13h2M7.5 16.5h2M11 16.5h2"/>',
  branch: '<path d="M4 9.5 5.5 4h13L20 9.5"/><path d="M4 9.5c0 1.4 1.1 2.5 2.7 2.5S9.3 10.9 9.3 9.5c0 1.4 1.2 2.5 2.7 2.5s2.7-1.1 2.7-2.5c0 1.4 1.1 2.5 2.6 2.5S20 10.9 20 9.5"/><path d="M5.5 12v8.5h13V12M10 20.5v-5h4v5"/>',
  set: '<circle cx="12" cy="12" r="3"/><path d="M12 2.8v2.6M12 18.6v2.6M3.9 7.3l2.3 1.3M17.8 15.4l2.3 1.3M3.9 16.7l2.3-1.3M17.8 8.6l2.3-1.3"/>',
  menu: '<rect x="4" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  users: '<circle cx="12" cy="8" r="3.6"/><path d="M5 20c.7-3.7 3.5-5.8 7-5.8s6.3 2.1 7 5.8"/><path d="M18.5 4.5v4M16.5 6.5h4"/>',
  admin: '<path d="M12 3.2 19 6v5.6c0 4.3-3 7.7-7 9.2-4-1.5-7-4.9-7-9.2V6z"/><path d="m9 12 2 2 4-4.2"/>',
  notify: '<path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15z"/><path d="M10 20.5a2.2 2.2 0 0 0 4 0"/>',
  design: '<path d="M12 3.5a8.5 8.5 0 1 0 0 17c1.2 0 1.8-.8 1.8-1.7 0-1.3-1.1-1.6-1.1-2.7 0-.9.8-1.6 1.8-1.6h2.1a3.9 3.9 0 0 0 3.9-3.9C20.5 6.6 16.7 3.5 12 3.5z"/><circle cx="7.8" cy="11.2" r="1.1"/><circle cx="10.4" cy="7.5" r="1.1"/><circle cx="14.8" cy="7.6" r="1.1"/>',
  cup: '<path d="M5 8h11v5.5A5.5 5.5 0 0 1 10.5 19 5.5 5.5 0 0 1 5 13.5z"/><path d="M16 9.5h1.5a2.5 2.5 0 0 1 0 5H16M8 3.5c0 1 1 1.3 1 2.3M11.5 3.5c0 1 1 1.3 1 2.3"/>',
  out: '<path d="M14 4.5h4a1.5 1.5 0 0 1 1.5 1.5v12a1.5 1.5 0 0 1-1.5 1.5h-4M10 16.5 14.5 12 10 7.5M14.5 12H4"/>',
  upload: '<path d="M12 15.5V4M7.5 8.5 12 4l4.5 4.5M4.5 15.5v3a1.5 1.5 0 0 0 1.5 1.5h12a1.5 1.5 0 0 0 1.5-1.5v-3"/>',
  download: '<path d="M12 4v11.5M7.5 11 12 15.5l4.5-4.5M4.5 15.5v3a1.5 1.5 0 0 0 1.5 1.5h12a1.5 1.5 0 0 0 1.5-1.5v-3"/>'
};
const icon = n => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${IC[n] || ''}</svg>`;

/* ===== ฟอร์มจาก schema ===== */
function opts(list, val) {
  const has = list.some(o => String(Array.isArray(o) ? o[0] : o) === String(val));
  const all = (!has && val !== '' && val != null) ? [...list, val] : list;
  return all.map(o => { const [v, l] = Array.isArray(o) ? o : [o, o]; return `<option value="${esc(v)}"${String(v) === String(val) ? ' selected' : ''}>${esc(l)}</option>`; }).join('');
}
const SWATCHES = ['#2F7D55', '#B7791F', '#5A4A8C', '#1D6F72', '#B0384A', '#2F5D8F', '#7A4A2A', '#55615A'];
function fieldHTML(f, v) {
  const id = 'f_' + f.k + '_' + uid().slice(-4), val = v ?? '';
  const cls = 'field' + (f.half ? ' half' : '') + (f.type === 'check' ? ' check' : '');
  const help = f.help ? `<span class="help">${esc(f.help)}</span>` : '';
  if (f.type === 'check') return `<div class="${cls}"><input type="checkbox" id="${id}" data-k="${f.k}"${bool(val) ? ' checked' : ''}><label for="${id}">${esc(f.label)}</label></div>`;
  if (f.type === 'photo') return `<div class="field photo-field"><label for="${id}">${esc(f.label)}</label><div class="pv"><img alt=""${val ? ` src="${esc(val)}"` : ' hidden'}><input type="file" accept="image/*" id="${id}" data-photo="1"><input type="hidden" data-k="${f.k}" value="${esc(val)}"></div></div>`;
  if (f.type === 'multi') {
    const set = String(val).split(',').map(x => x.trim());
    return `<div class="${cls}"><span class="lbl">${esc(f.label)}</span><div class="days" data-k="${f.k}" data-type="multi">${f.options.map(([v, l]) => `<label><input type="checkbox" value="${esc(v)}"${set.includes(String(v)) ? ' checked' : ''}><span>${esc(l)}</span></label>`).join('')}</div>${help}</div>`;
  }
  if (f.type === 'color') {
    return `<div class="${cls}"><span class="lbl">${esc(f.label)}</span><div class="swatches" data-k="${f.k}" data-type="color">${SWATCHES.map(c => `<label style="background:${c}" title="${c}"><input type="radio" name="${id}" value="${c}"${c === val ? ' checked' : ''}><span class="vh">${c}</span></label>`).join('')}</div></div>`;
  }
  let input;
  if (f.type === 'select') input = `<select id="${id}" data-k="${f.k}">${f.req && val === '' ? '<option value="">เลือก</option>' : ''}${opts(f.options, val)}</select>`;
  else if (f.type === 'textarea') input = `<textarea id="${id}" data-k="${f.k}" rows="${f.rows || 3}">${esc(val)}</textarea>`;
  else {
    const type = { number: 'number', pin: 'password', tel: 'tel', date: 'date', time: 'time', url: 'url', month: 'month' }[f.type] || 'text';
    const extra = f.type === 'number' ? ' inputmode="decimal" step="any"' : f.type === 'pin' ? ' inputmode="numeric" pattern="[0-9]*" maxlength="6" autocomplete="new-password"' : f.inputmode ? ` inputmode="${f.inputmode}"` : '';
    input = `<input id="${id}" data-k="${f.k}" type="${type}" value="${esc(val)}"${extra}${f.ph ? ` placeholder="${esc(f.ph)}"` : ''}>`;
  }
  if (f.pre !== undefined) input = `<div class="inpre"><span class="pre" data-pre="${f.k}">${esc(f.pre)}</span>${input}</div>`;   // คำนำหน้าที่แก้ไม่ได้ เช่น staff_
  return `<div class="${cls}"><label for="${id}">${esc(f.label)}${f.req ? ' *' : ''}</label>${input}${help}</div>`;
}
function collect(root, fields, base) {
  const o = { ...base };
  fields.forEach(f => {
    const el = root.querySelector(`[data-k="${f.k}"]`);
    if (!el) return;
    if (el.dataset.type === 'multi') { const v = $$('input:checked', el).map(x => x.value); o[f.k] = v.includes('*') ? '*' : v.join(','); }
    else if (el.dataset.type === 'color') { const c = $('input:checked', el); o[f.k] = c ? c.value : (base[f.k] || ''); }
    else o[f.k] = f.type === 'check' ? el.checked : f.type === 'number' ? (el.value === '' ? '' : Number(el.value)) : el.value.trim();
  });
  return o;
}
function openForm(o) {
  const data = o.data || {};
  const extraBtns = (o.extra || []).map((x, i) => `<button class="btn" data-act="x${i}">${esc(x.label)}</button>`).join('');
  const sh = openSheet(`<h3>${esc(o.title)}</h3>${o.sub ? `<p class="muted">${o.sub}</p>` : ''}${o.topHTML || ''}<div class="form">${o.fields.map(f => fieldHTML(f, data[f.k])).join('')}</div>${o.extraHTML || ''}
    <div class="actions">${o.onDelete ? '<button class="btn danger" data-act="del">ลบ</button>' : ''}${extraBtns}<span class="grow"></span><button class="btn" data-act="cancel">${o.readOnly ? 'ปิด' : 'ยกเลิก'}</button>${o.readOnly ? '' : `<button class="btn primary" data-act="save">${o.saveLabel || 'บันทึก'}</button>`}</div><p class="err" role="alert"></p>`);
  if (o.readOnly) $$('input,select,textarea', sh).forEach(el => { el.disabled = true; });
  if (o.live) { sh.addEventListener('input', () => o.live(sh)); o.live(sh); }
  sh.addEventListener('click', async ev => {
    const b = ev.target.closest('[data-act]'); if (!b) return;
    const a = b.dataset.act;
    try {
      if (a === 'cancel') return closeSheet();
      if (a === 'del') {
        if (!b.dataset.armed) { b.dataset.armed = '1'; b.textContent = 'แตะอีกครั้งเพื่อลบ'; return; }
        await busy(b, () => o.onDelete(data)); closeSheet(); App.render(); toast('ลบแล้ว'); return;
      }
      if (a === 'save') {
        const v = collect(sh, o.fields, data);
        const miss = o.fields.filter(f => f.req && (v[f.k] === '' || v[f.k] == null));
        if (miss.length) return showErr(sh, 'กรอกให้ครบ: ' + miss.map(f => f.label).join(', '));
        await busy(b, () => o.onSave(v)); closeSheet(); App.render(); toast(o.savedMsg || 'บันทึกแล้ว'); return;
      }
      if (a[0] === 'x') { await o.extra[+a.slice(1)].fn(collect(sh, o.fields, data), b); return; }
      if (o.onAct && o.onAct[a]) await o.onAct[a](b, sh);
    } catch (e) { showErr(sh, e.message || String(e)); }
  });
  return sh;
}
function readPhoto(file, max) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onerror = () => reject(new Error('อ่านไฟล์รูปไม่ได้'));
    fr.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('ไฟล์นี้ไม่ใช่รูปภาพที่รองรับ'));
      img.onload = () => {
        let size = max, q = 0.78, out = '';
        for (let i = 0; i < 6; i++) {
          const sc = Math.min(1, size / Math.max(img.width, img.height));
          const c = document.createElement('canvas');
          c.width = Math.max(1, Math.round(img.width * sc)); c.height = Math.max(1, Math.round(img.height * sc));
          c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
          out = c.toDataURL('image/jpeg', q);
          if (out.length < 40000) break;
          q -= 0.1; size = Math.round(size * 0.85);
        }
        resolve(out);
      };
      img.src = fr.result;
    };
    fr.readAsDataURL(file);
  });
}
function download(filename, data, type) {
  const blob = data instanceof Blob ? data : new Blob([data], { type });
  const u = URL.createObjectURL(blob), l = document.createElement('a');
  l.href = u; l.download = filename; document.body.appendChild(l); l.click(); l.remove(); setTimeout(() => URL.revokeObjectURL(u), 3000);
}
function showText(title, text, filename) {
  const sh = openSheet(`<h3>${esc(title)}</h3><textarea class="code" readonly rows="10" aria-label="${esc(title)}">${esc(text)}</textarea><div class="actions"><button class="btn" data-act="copy">คัดลอก</button><button class="btn" data-act="dl">ดาวน์โหลด</button><span class="grow"></span><button class="btn primary" data-act="cancel">ปิด</button></div>`);
  sh.addEventListener('click', async e => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const a = b.dataset.act;
    if (a === 'cancel') closeSheet();
    if (a === 'copy') { try { await navigator.clipboard.writeText(text); toast('คัดลอกแล้ว'); } catch (_) { sh.querySelector('textarea').select(); toast('เลือกข้อความให้แล้ว กดคัดลอกจากเมนูของเครื่อง'); } }
    if (a === 'dl') download(filename, (filename.endsWith('.csv') ? '﻿' : '') + text, filename.endsWith('.csv') ? 'text/csv;charset=utf-8' : 'application/json');
  });
}
const csvCell = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
const toCsv = rows => rows.map(r => r.map(csvCell).join(',')).join('\n');

/* ===== ข้อมูลอ้างอิงที่หลายระบบใช้ ===== */
const fullName = e => (`${e.firstName || ''} ${e.lastName || ''}`.trim() || '(ไม่มีชื่อ)') + (e.nickname ? ` (${e.nickname})` : '');
const shortName = e => (e && (e.nickname || e.firstName)) || '(ไม่พบชื่อ)';
const empById = id => S.t.employees.find(e => e.id === id);
const itemById = id => S.t.items.find(i => i.id === id);
/** พนักงานที่ยังทำงานอยู่ ในสาขาที่กำลังดู (ไม่รวมคนสาขาอื่นที่ระบบส่งมาให้เห็นแค่ชื่อ) */
const myEmp = e => allBranch() || (S.me.scope || []).includes(e.branch);
const activeEmps = (all) => S.t.employees.filter(e => e.status !== 'ลาออก' && myEmp(e) && (all || inBr(e.branch)));
const empOpts = (all) => activeEmps(all).map(e => [e.id, `${shortName(e)}${e.code ? ' (' + e.code + ')' : ''}${multiBranch() && !S.branch ? ' ' + e.branch : ''}`]);
const initials = t => { try { return [...new Intl.Segmenter('th', { granularity: 'grapheme' }).segment(t)].slice(0, 3).map(x => x.segment).join(''); } catch (e) { return String(t).slice(0, 3); } };
const avatar = e => e && e.photo ? `<img class="avatar" src="${esc(e.photo)}" alt="">` : `<span class="avatar" aria-hidden="true">${esc(initials(shortName(e || {})))}</span>`;

/* ===== ตารางงานและแผนงานรายวัน (สูตรเดียวกับฝั่ง Google จาก calc.js) ===== */
let _ctx = null, _ctxRev = -1;
function timeCtx() {
  if (_ctxRev !== S.rev || !_ctx) { _ctx = { st: S.settings, hol: Calc.holidayMap(S.settings), shifts: Calc.shiftIndex(S.t.shifts), sched: Calc.scheduleIndex(S.t.schedule), patterns: Calc.patternIndex(S.t.patterns) }; _ctxRev = S.rev; }
  return _ctx;
}
const planOf = (emp, date) => Calc.planFor(emp, date, timeCtx());
const shiftByCode = code => timeCtx().shifts[Calc.upper(code)];
const shiftColor = code => (shiftByCode(code) || {}).color || 'var(--mc)';
const planLabel = p => p.off ? (p.pubHoliday && p.source === 'ตารางงาน' ? 'หยุด (' + p.pubHoliday + ')' : 'หยุด') : `${p.name ? p.name + ' ' : ''}${p.start}–${p.end}${multiBranch() && p.branch ? ' ที่' + branchName(p.branch) : ''}`;
/** กะที่ใช้ได้ในสาขา (กะที่ไม่ระบุสาขา ใช้ได้ทุกสาขา) */
const shiftsFor = b => S.t.shifts.filter(s => !s.branch || !b || s.branch === b);
const isLate = a => num(a.lateMin) > 0;
/** เวลาทำงานที่เกี่ยวกับสาขาที่กำลังดู: ทำงานที่สาขานี้ หรือเป็นพนักงานของสาขานี้ */
const attInBr = a => inBr(a.branch) || inBr((empById(a.empId) || {}).branch);
const leaveOn = (empId, date, statuses = ['อนุมัติ', 'รออนุมัติ']) => S.t.leaves.find(l => l.empId === empId && statuses.includes(l.status) && l.dateFrom <= date && (l.dateTo || l.dateFrom) >= date);

/* ===== ทะเบียนระบบย่อย (แต่ละไฟล์ mod-*.js ลงทะเบียนตัวเอง) ===== */
const MODS = [];
const ACT = {};
function defMod(m) { MODS.push(m); if (m.acts) Object.assign(ACT, m.acts); }
