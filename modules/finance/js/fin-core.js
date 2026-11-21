/* Finance & Accounting — แกนหน้าเว็บ: เรียก API, Session, จัดรูปแบบตัวเลข/วันที่, หน้าต่าง/ยืนยัน/แจ้งเตือน, ตาราง, เส้นทางหน้า
 * ใช้ CMS Session เดิม (sessionStorage amz.tok หรือ amz.it.tok จากแอป Owner) ส่งใน header x-cms-session — ไม่แตะระบบ Login/PIN ของ CMS
 * 2 โหมด: หน้าแยก finance.html (เส้นทาง #income) · ฝังในหน้าหลังร้าน index.html ผ่าน js/finance-embed.js (W.FIN_EMBED, เส้นทาง #fin/income) */
(function (W) {
  'use strict';
  const EMB = W.FIN_EMBED || null;                 // { base: 'modules/finance/', prefix: '#fin/' }
  const PFX = EMB ? EMB.prefix : '#';
  const toLocal = h => { h = String(h || ''); if (!EMB) return h; if (h.startsWith(PFX)) return '#' + h.slice(PFX.length); return h === PFX.slice(0, -1) ? '#' : h; };
  const toGlobal = h => (EMB ? PFX + String(h || '').replace(/^#/, '') : h);
  const inScope = el => !EMB || !!(el && el.closest('.fin-embed'));
  const API_URL = 'https://ytxbnqosenolojifeikf.supabase.co/functions/v1/finance-api';
  const $ = (s, el) => (el || document).querySelector(s);
  const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const token = () => { try { return sessionStorage.getItem('amz.tok') || sessionStorage.getItem('amz.it.tok') || ''; } catch (_) { return ''; } };
  const idem = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now() + '-' + Math.random().toString(36).slice(2));

  class ApiError extends Error { constructor(status, msg) { super(msg); this.status = status; } }
  async function req(method, action, data, opt = {}) {
    const t = token();
    if (!t) throw new ApiError(401, 'ไม่พบ CMS Session');
    const url = new URL(API_URL);
    const headers = { 'x-cms-session': t, accept: 'application/json' };
    let body;
    if (method === 'GET') { url.searchParams.set('action', action); Object.entries(data || {}).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v); }); }
    else { headers['content-type'] = 'application/json'; body = JSON.stringify({ ...(data || {}), action }); if (opt.idem) headers['idempotency-key'] = opt.idem; }
    const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), opt.timeout || 25000);
    let res, json;
    try { res = await fetch(url, { method, headers, body, cache: 'no-store', signal: ctl.signal }); json = await res.json().catch(() => ({})); }
    catch (e) { throw new ApiError(0, e.name === 'AbortError' ? 'เชื่อมต่อนานเกินไป ลองใหม่อีกครั้ง' : 'เชื่อมต่อระบบไม่ได้ ตรวจสอบอินเทอร์เน็ต'); }
    finally { clearTimeout(timer); }
    if (!res.ok || !json.ok) {
      const err = new ApiError(res.status, json.error || 'ทำรายการไม่สำเร็จ');
      if (res.status === 401) FIN.onAuthLost(err.message);
      throw err;
    }
    return json.data;
  }
  const api = { get: (a, q, o) => req('GET', a, q, o), post: (a, b, o) => req('POST', a, b, o) };
  async function upload(action, fields, file) {
    const t = token();
    if (!t) throw new ApiError(401, 'ไม่พบ CMS Session');
    const form = new FormData();
    form.append('action', action);
    Object.entries(fields || {}).forEach(([k, v]) => form.append(k, String(v)));
    form.append('file', file);
    let res, json;
    try {
      res = await fetch(API_URL, { method: 'POST', headers: { 'x-cms-session': t, accept: 'application/json' }, body: form, cache: 'no-store' });
      json = await res.json().catch(() => ({}));
    } catch (_) { throw new ApiError(0, 'อัปโหลดไฟล์ไม่สำเร็จ ตรวจสอบอินเทอร์เน็ตแล้วลองใหม่'); }
    if (!res.ok || !json.ok) {
      const err = new ApiError(res.status, json.error || 'อัปโหลดไฟล์ไม่สำเร็จ');
      if (res.status === 401) FIN.onAuthLost(err.message);
      throw err;
    }
    return json.data;
  }

  // ---------- รูปแบบ ----------
  const nf = new Intl.NumberFormat('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const money = v => nf.format(Number(v) || 0);
  const baht = v => '฿' + money(v);
  const d10 = v => v ? String(v).slice(0, 10) : '';
  const thDate = v => { if (!v) return '–'; const d = new Date(String(v).length <= 10 ? v + 'T00:00:00' : v); return isNaN(d) ? esc(v) : d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' }); };
  const thDateTime = v => { if (!v) return '–'; const d = new Date(v); return isNaN(d) ? esc(v) : d.toLocaleString('th-TH', { day: 'numeric', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' }); };
  const today = () => { const d = new Date(Date.now() + 7 * 3600e3); return d.toISOString().slice(0, 10); };
  const thisMonth = () => today().slice(0, 7);
  const monthName = p => { if (!p) return ''; const [y, m] = p.split('-'); return new Date(+y, +m - 1, 1).toLocaleDateString('th-TH', { month: 'long', year: 'numeric' }); };

  const L = {
    docType: { tax_invoice: 'ใบกำกับภาษี', invoice: 'ใบแจ้งหนี้', receipt: 'ใบเสร็จรับเงิน', credit_note: 'ใบลดหนี้', debit_note: 'ใบเพิ่มหนี้', expense: 'ค่าใช้จ่าย', bill: 'บิล/ใบแจ้งหนี้ผู้ขาย', payment_voucher: 'ใบสำคัญจ่าย', other: 'อื่นๆ' },
    status: {
      draft: ['ร่าง', 'n'], pending_review: ['รออนุมัติ', 'warn'], approved: ['อนุมัติแล้ว', 'info'], posted: ['ลงบัญชีแล้ว', 'ok'], voided: ['ยกเลิก', 'mute'], reversed: ['กลับรายการ', 'mute'],
      pending: ['รออนุมัติ', 'warn'], paid: ['รับ/จ่ายแล้ว', 'ok'], rejected: ['ปฏิเสธ', 'bad'], cancelled: ['ยกเลิก', 'mute'],
      open: ['เปิด', 'ok'], reopened: ['เปิดใหม่', 'warn'], closed: ['ปิดแล้ว', 'mute'], closing: ['กำลังปิด', 'warn'],
      preparing: ['กำลังจัดทำ', 'n'], review: ['รอตรวจ', 'warn'], submitted: ['ยื่นแล้ว', 'info'], amended: ['ยื่นเพิ่มเติม', 'info'],
      reviewed: ['รอยื่น', 'n'], filed: ['ยื่นแล้ว', 'ok'], adjusted: ['ปรับปรุง', 'mute'], unreviewed: ['ยังไม่ตรวจ', 'n'],
    },
    role: { owner: 'เจ้าของ (Owner)', approver: 'ผู้อนุมัติ', manager: 'Manager', staff: 'Staff', verifier: 'Final Verifier', accountant: 'ผู้บันทึกบัญชี', viewer: 'ดูอย่างเดียว' },
    method: { cash: 'เงินสด', bank_transfer: 'โอนเงิน', credit_card: 'บัตรเครดิต', cheque: 'เช็ค', other: 'อื่นๆ' },
    payType: { receipt: 'รับเงิน', disbursement: 'จ่ายเงิน', refund: 'คืนเงิน' },
    acType: { asset: 'สินทรัพย์', liability: 'หนี้สิน', equity: 'ส่วนของเจ้าของ', revenue: 'รายได้', expense: 'ค่าใช้จ่าย' },
    partnerType: { customer: 'ลูกค้า', vendor: 'ผู้ขาย', both: 'ลูกค้า/ผู้ขาย', employee: 'พนักงาน', government: 'หน่วยงานรัฐ' },
    source: { manual: 'บันทึกเอง', document: 'จากเอกสาร', payment: 'รับ/จ่ายเงิน', reversal: 'กลับรายการ', tax: 'ภาษี', opening: 'ยอดยกมา' },
    form: { PP30: 'ภ.พ.30', PND3: 'ภ.ง.ด.3', PND53: 'ภ.ง.ด.53' },
  };
  const badge = s => { const x = L.status[s] || [s, 'n']; return `<span class="fm-badge ${x[1]}">${esc(x[0])}</span>`; };

  // ---------- หน้าต่าง / แจ้งเตือน ----------
  function toast(msg, type) {
    let box = $('#fmToasts'); if (!box) { box = document.createElement('div'); box.id = 'fmToasts'; box.className = 'fm-toasts'; layer().appendChild(box); }
    const t = document.createElement('div'); t.className = 'fm-toast ' + (type || 'ok'); t.setAttribute('role', 'status'); t.textContent = msg;
    box.appendChild(t); setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 300); }, type === 'bad' ? 6000 : 3200);
  }
  function modal(title, html, opt = {}) {
    const wrap = document.createElement('div'); wrap.className = 'fm-overlay';
    wrap.innerHTML = `<div class="fm-dialog${opt.wide ? ' wide' : ''}" role="dialog" aria-modal="true" aria-label="${esc(title)}"><header><h2>${esc(title)}</h2><button type="button" class="fm-x" aria-label="ปิด">×</button></header><div class="fm-dialog-body">${html}</div></div>`;
    layer().appendChild(wrap); document.body.classList.add('fm-noscroll');
    const close = () => { wrap.remove(); if (!$('.fm-overlay')) document.body.classList.remove('fm-noscroll'); if (opt.onClose) opt.onClose(); };
    wrap.addEventListener('click', e => { if (e.target === wrap || e.target.closest('.fm-x') || e.target.closest('[data-close]')) close(); });
    const first = wrap.querySelector('input,select,textarea,button:not(.fm-x)'); if (first && !opt.noFocus) setTimeout(() => first.focus(), 30);
    return { el: wrap.querySelector('.fm-dialog-body'), close };
  }
  function ask(title, message, opt = {}) {
    return new Promise(resolve => {
      const input = opt.input ? `<label class="fm-field fm-field-full"><span>${esc(opt.label || 'เหตุผล')}${opt.required ? ' *' : ''}</span>${opt.type === 'date' ? `<input type="date" id="fmAskIn" value="${esc(opt.value || today())}">` : `<textarea id="fmAskIn" rows="3" maxlength="500" placeholder="${esc(opt.placeholder || '')}">${esc(opt.value || '')}</textarea>`}</label>` : '';
      const m = modal(title, `<p class="fm-ask-msg">${message}</p>${input}<div class="fm-form-actions"><button type="button" class="fm-btn fm-btn-light" data-close>ยกเลิก</button><button type="button" class="fm-btn ${opt.danger ? 'fm-btn-danger' : 'fm-btn-primary'}" id="fmAskOk">${esc(opt.ok || 'ยืนยัน')}</button></div>`, { onClose: () => resolve(null) });
      $('#fmAskOk', m.el).onclick = () => {
        const v = opt.input ? $('#fmAskIn', m.el).value.trim() : true;
        if (opt.input && opt.required && !v) { toast('กรุณากรอก' + (opt.label || 'เหตุผล'), 'bad'); return; }
        if (opt.expect && v !== opt.expect) { toast('พิมพ์ "' + opt.expect + '" ให้ตรงเพื่อยืนยัน', 'bad'); return; }
        resolve(v); m.close();
      };
    });
  }
  // ปุ่มทำรายการ: กันกดซ้ำ + แสดงผล
  async function run(btn, fn, okMsg) {
    if (btn && btn.disabled) return;
    const label = btn && btn.innerHTML;
    if (btn) { btn.disabled = true; btn.innerHTML = '<span class="fm-spin"></span>' + label; }
    try { const r = await fn(); if (okMsg) toast(typeof okMsg === 'function' ? okMsg(r) : okMsg, 'ok'); return r; }
    catch (e) { toast(e.message || 'ทำรายการไม่สำเร็จ', 'bad'); return undefined; }
    finally { if (btn && btn.isConnected) { btn.disabled = false; btn.innerHTML = label; } }
  }

  // ---------- ตาราง ----------
  // cols: [{h, k|f, cls, num}] · rows: array · opt.onRow(row) → data-id
  function table(cols, rows, opt = {}) {
    if (!rows || !rows.length) return `<div class="fm-empty"><b>${esc(opt.empty || 'ยังไม่มีรายการ')}</b>${opt.emptyHint ? '<small>' + opt.emptyHint + '</small>' : ''}</div>`;
    const th = cols.map(c => `<th class="${c.num ? 'num ' : ''}${c.cls || ''}">${c.h}</th>`).join('');
    const tr = rows.map((r, i) => `<tr${opt.rowAttr ? ' ' + opt.rowAttr(r, i) : ''}>${cols.map(c => `<td class="${c.num ? 'num ' : ''}${c.cls || ''}" data-label="${esc(String(c.h).replace(/<[^>]+>/g, ''))}">${c.f ? c.f(r, i) : esc(r[c.k])}</td>`).join('')}</tr>`).join('');
    const foot = opt.foot ? `<tfoot><tr>${opt.foot.map(x => `<td class="${x && x.num ? 'num' : ''}">${x ? (x.v !== undefined ? x.v : x) : ''}</td>`).join('')}</tr></tfoot>` : '';
    return `<div class="fm-table-wrap"><table class="fm-table${opt.compact ? ' compact' : ''}"><thead><tr>${th}</tr></thead><tbody>${tr}</tbody>${foot}</table></div>`;
  }
  function csv(name, rows) {
    const s = '﻿' + rows.map(r => r.map(v => { const t = String(v == null ? '' : v); return /[",\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t; }).join(',')).join('\r\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([s], { type: 'text/csv;charset=utf-8' })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  const head = (eyebrow, title, sub, actions) => `<div class="fm-page-head"><div><div class="fm-eyebrow">${esc(eyebrow)}</div><h1>${esc(title)}</h1>${sub ? `<p>${sub}</p>` : ''}</div>${actions ? `<div class="fm-head-actions">${actions}</div>` : ''}</div>`;
  const loading = (msg) => `<div class="fm-panel fm-loading"><span class="fm-spin"></span>${esc(msg || 'กำลังโหลด…')}</div>`;
  const errorBox = (msg) => `<div class="fm-notice bad"><span>!</span><div><b>โหลดข้อมูลไม่สำเร็จ</b><small>${esc(msg)}</small></div></div>`;

  // ---------- เส้นทางหน้า + โหลดโมดูลตามต้องใช้ ----------
  const PAGES = {};
  const MODULES = {
    'js/fin-pages-main.js?v=1.1.0': ['dashboard', 'approvals'],
    'js/fin-pages-docs.js?v=1.2.0': ['income', 'expense', 'document', 'payments'],
    'js/fin-pages-acct.js?v=1.0.0': ['journals', 'journal', 'accounts', 'periods'],
    'js/fin-pages-tax.js?v=1.0.0': ['vat', 'wht', 'filings'],
    'js/fin-pages-reports.js?v=1.0.0': ['trial-balance', 'profit-loss', 'balance-sheet', 'ledger', 'aging'],
    'js/fin-pages-admin.js?v=1.0.1': ['company', 'partners', 'users', 'audit', 'settings'],
    'js/fin-pages-verification.js?v=1.0.0': ['verification'],
    'js/fin-pages-flow.js?v=1.1.0': ['expflow'],
    'js/fin-pages-wht.js?v=1.0.0': ['wht50'],
  };
  const loaded = {};
  function loadFor(key) {
    const file = Object.keys(MODULES).find(f => MODULES[f].includes(key));
    if (!file || PAGES[key]) return Promise.resolve();
    if (!loaded[file]) loaded[file] = new Promise((ok, no) => { const s = document.createElement('script'); s.src = (EMB ? EMB.base : '') + file; s.onload = ok; s.onerror = () => { delete loaded[file]; no(new Error('โหลดหน้าไม่สำเร็จ ลองใหม่อีกครั้ง')); }; document.head.appendChild(s); });
    return loaded[file];
  }
  let current = '';
  async function go(hash, opt0 = {}) {
    const [key0, arg] = String(hash || '').replace(/^#/, '').split('/');
    let key = key0 || 'dashboard';
    const content = $('#fmContent');
    if (!content) return;
    const role = FIN.session && FIN.session.actor && FIN.session.actor.role;
    const rolePages = {
      manager: ['dashboard', 'expflow', 'wht50', 'income', 'expense', 'document', 'payments', 'verification'],
      staff: ['expflow', 'wht50', 'income', 'expense', 'document', 'payments', 'verification'],
      verifier: ['expflow', 'wht50', 'verification'],
    };
    // Staff / ผู้ตรวจสุดท้าย เริ่มที่หน้าเบิก–เคลียร์ (งานหลักของบทบาท)
    if ((role === 'staff' || role === 'verifier') && key === 'dashboard') { key = 'expflow'; W.location.hash = EMB ? '#fin/expflow' : '#expflow'; return go('#' + key, opt0); }
    if (rolePages[role] && !rolePages[role].includes(key)) {
      content.innerHTML = head('FINANCE', 'ไม่มีสิทธิ์เข้าถึง') + errorBox('บทบาทของคุณไม่มีสิทธิ์เข้าถึงหน้านี้');
      return;
    }
    current = key + (arg ? '/' + arg : '');
    try { await loadFor(key); } catch (e) { content.innerHTML = errorBox(e.message); return; }
    const p = PAGES[key] || PAGES.dashboard;
    if (!p) { content.innerHTML = errorBox('ไม่พบหน้า'); return; }
    if (p.need && !FIN.can(p.need)) { content.innerHTML = head('FINANCE', p.title) + `<div class="fm-notice"><span>ⓘ</span><div><b>สิทธิ์ไม่พอ</b><small>หน้านี้สำหรับ ${esc(p.need === 'admin' ? 'Owner' : p.need === 'approve' ? 'ผู้อนุมัติ' : 'ผู้บันทึกบัญชี')} เท่านั้น</small></div></div>`; markNav(p.nav || key, p.title); return; }
    markNav(p.nav || key, p.title);
    // แต่ละหน้าวาดลงกล่องใหม่ของตัวเอง (.fm-host):
    // - หน้าเดิมยังแสดงอยู่ (จางลง) จนหน้าใหม่พร้อม → ไม่กระพริบเป็นหน้าโหลดทุกครั้งที่กดเมนู (เกิน 0.7 วิ ค่อยสลับให้เห็นสถานะโหลด)
    // - ตัวดักคลิกของหน้าเก่าหายไปพร้อมกล่องเก่า → ไม่ซ้อนกันจนกดครั้งเดียวทำงานหลายรอบ
    const my = ++navSeq;
    const host = document.createElement('div'); host.className = 'fm-host'; host.innerHTML = loading();
    const prev = content.querySelector(':scope > .fm-host:not([hidden])');
    let shown = false;
    const show = () => {
      if (shown || my !== navSeq) return; shown = true;
      [...content.children].forEach(n => { if (n !== host) n.remove(); });
      host.hidden = false; content.classList.remove('fm-busy');
      content.scrollTop = 0; if (!EMB || !opt0.keepScroll) W.scrollTo(0, 0);
    };
    if (prev) { content.querySelectorAll(':scope > .fm-host[hidden]').forEach(n => n.remove()); host.hidden = true; content.appendChild(host); content.classList.add('fm-busy'); }
    else { content.innerHTML = ''; content.appendChild(host); show(); }
    const timer = setTimeout(show, 700);
    try { await p.render(host, arg ? decodeURIComponent(arg) : ''); }
    catch (e) { if (e.status !== 401) host.innerHTML = head('FINANCE', p.title) + errorBox(e.message); }
    finally { clearTimeout(timer); if (my === navSeq) show(); else if (!shown) host.remove(); }
  }
  let navSeq = 0;
  function markNav(key, title) {
    FIN.title = title || '';
    if (EMB) { if (EMB.onNav) EMB.onNav(key, title); return; }
    document.querySelectorAll('[data-page]').forEach(el => el.classList.toggle('active', el.dataset.page === key));
    const c = $('#fmCrumb'); if (c) c.textContent = title || '';
    document.title = (title ? title + ' · ' : '') + 'Finance · CMS';
    const sb = $('#fmSidebar'); if (sb) sb.classList.remove('open'); const bd = $('#fmBackdrop'); if (bd) bd.classList.remove('show');
  }
  const nav = (hash) => { const g = toGlobal(hash); if (location.hash === g) go(toLocal(g)); else location.hash = g; };
  // ชั้นสำหรับหน้าต่าง/แจ้งเตือน (โหมดฝัง: อยู่ใต้ .fin-embed เพื่อให้ CSS ที่ครอบไว้ใช้ได้)
  const layer = () => { if (!EMB) return document.body; let l = $('#finLayer'); if (!l) { l = document.createElement('div'); l.id = 'finLayer'; l.className = 'fin-embed fin-layer'; document.body.appendChild(l); } return l; };

  const FIN = W.FIN = {
    api, upload, idem, esc, $, money, baht, d10, thDate, thDateTime, today, thisMonth, monthName, L, badge,
    toast, modal, ask, run, table, csv, head, loading, errorBox, nav, go,
    load: loadFor,   // โหลดไฟล์ของหน้าล่วงหน้า (เช่น ใช้ฟังก์ชันพิมพ์ของหน้าอื่น)
    session: null,
    page(key, def) { PAGES[key] = def; },
    can(cap) { return !!(FIN.session && FIN.session.capabilities && FIN.session.capabilities[cap]); },
    reload() { go(toLocal(location.hash), { keepScroll: true }); },
    embedded: !!EMB, toLocal, toGlobal,
    crumb: (key, title) => markNav(key, title),
    current: () => current,
    onAuthLost(msg) { renderLogin(msg); },
    // ช่องเลือกบัญชี/คู่ค้า (เก็บไว้ใช้ซ้ำ 60 วิ)
    cache: {},
    async cached(key, fn, ms = 60000) { const c = FIN.cache[key]; if (c && Date.now() - c.at < ms) return c.v; const v = await fn(); FIN.cache[key] = { at: Date.now(), v }; return v; },
    bust(prefix) { Object.keys(FIN.cache).forEach(k => { if (k.startsWith(prefix)) delete FIN.cache[k]; }); },
    accounts: (all) => FIN.cached('accounts' + (all ? ':all' : ''), () => api.get('accounts', all ? { all: 1 } : {}).then(r => r.items)),
    partners: () => FIN.cached('partners', () => api.get('partners').then(r => r.items)),
  };

  function renderLogin(msg) {
    const c = $('#fmContent'); if (!c) return;
    if (EMB) { markNav('', 'เข้าสู่ระบบ'); c.innerHTML = `<div class="fm-notice bad"><span>!</span><div><b>${esc(msg || 'ไม่พบ CMS Session')}</b><small>กดออกจากระบบแล้วเข้าสู่ระบบใหม่ หรือกดลองใหม่</small></div></div><div class="fm-panel fm-center"><button class="fm-btn fm-btn-light" type="button" onclick="location.reload()">ลองใหม่</button></div>`; return; }
    markNav('', 'เข้าสู่ระบบ');
    c.innerHTML = head('FINANCE ACCESS', 'เข้าสู่ระบบ CMS ก่อนใช้งาน Finance', 'Finance ใช้บัญชีเดียวกับระบบหลังร้าน — ไม่ต้องตั้งรหัสใหม่') +
      `<div class="fm-notice"><span>ⓘ</span><div><b>${esc(msg || 'ไม่พบ CMS Session')}</b><small>เข้าสู่ระบบที่ "จัดการร้าน" หรือแอป Owner แล้วกลับมาที่เมนู Finance อีกครั้ง (ใช้แท็บเดิม)</small></div></div>
       <div class="fm-panel fm-center"><a class="fm-btn fm-btn-primary" href="../../index.html">เข้าสู่ระบบหลังร้าน (จัดการร้าน)</a><a class="fm-btn fm-btn-light" href="../../owner.html">แอป Owner</a><button class="fm-btn fm-btn-light" type="button" onclick="location.reload()">ลองใหม่</button></div>`;
  }

  function applySession(s) {
    FIN.session = s;
    const co = s.company || {}, me = s.actor || {};
    const set = (sel, v) => { const el = $(sel); if (el) el.textContent = v; };
    set('#fmCompanyName', co.name || 'บริษัท');
    set('#fmCompanyEnv', co.environment === 'production' ? 'ใช้งานจริง' : 'โหมดทดสอบ (UAT)');
    set('#fmUserName', me.displayName || 'ผู้ใช้');
    set('#fmUserRole', L.role[me.role] || me.role || '');
    document.querySelectorAll('.fm-avatar').forEach(a => a.textContent = String(me.displayName || 'U').trim().charAt(0).toUpperCase());
    const mode = $('#fmMode'); if (mode) { mode.className = 'fm-mode ' + (co.environment === 'production' ? 'live' : 'uat'); mode.innerHTML = '<i></i>' + (co.environment === 'production' ? 'ใช้งานจริง' : 'ทดสอบ (UAT)'); }
    if (!EMB) document.body.classList.toggle('fm-uat', co.environment !== 'production');
    document.querySelectorAll(EMB ? '.fin-embed [data-need]' : '[data-need]').forEach(el => { el.hidden = !FIN.can(el.dataset.need); });
  }
  FIN.refreshSession = async () => { const s = await api.get('session'); applySession(s); return s; };
  FIN.refreshBadges = async () => {
    try {
      const s = await api.get('summary');
      const p = s.pending || {}, n = (p.documents || 0) + (p.payments || 0) + (p.to_pay || 0) + (p.journals || 0) + (p.filings || 0);
      const b = $('#fmApprovalsBadge'); if (b) { b.textContent = n > 99 ? '99+' : n; b.hidden = !n || !FIN.can('approve'); }
      if (EMB && EMB.onBadge) EMB.onBadge(FIN.can('approve') ? n : 0);
      return s;
    } catch (_) { return null; }
    finally {   // งานเบิก–เคลียร์ที่ต้องทำ (ทุกบทบาท — Staff/ผู้ตรวจดูภาพรวมไม่ได้แต่ต้องเห็นงานของตัวเอง)
      api.get('expense-flow', { tab: 'todo' }).then(f => { FIN.flowTodo = (f.counts && f.counts.todo) || 0; if (EMB && EMB.onFlowBadge) EMB.onFlowBadge(FIN.flowTodo); }).catch(() => {});
    }
  };

  // โหมดฝัง: หน้าหลังร้านเรียก FIN.mount(พื้นที่แสดงผล) ทุกครั้งที่เปิดเมนู Finance
  let sess = null;
  FIN.mount = async (hash, opt = {}) => {
    const c = $('#fmContent'); if (!c) return;
    if (!FIN.session) {
      c.innerHTML = loading('กำลังตรวจสอบสิทธิ์…');
      if (!sess) sess = FIN.refreshSession().then(s => { FIN.refreshBadges(); return s; }).catch(e => { sess = null; throw e; });
      try { await sess; }
      catch (e) { if (e.status === 401) return; c.innerHTML = `<div class="fm-notice bad"><span>!</span><div><b>${esc(e.message)}</b><small>${e.status === 403 ? 'ให้ Owner เพิ่มสิทธิ์ที่ Finance › ตั้งค่า › ผู้ใช้งาน Finance' : 'ลองใหม่อีกครั้ง'}</small></div></div><div class="fm-panel fm-center"><button class="fm-btn fm-btn-light" type="button" onclick="location.reload()">ลองใหม่</button></div>`; return; }
    }
    return go(hash, opt);
  };

  async function boot() {
    const c = $('#fmContent');
    c.innerHTML = loading('กำลังตรวจสอบสิทธิ์…');
    if (!token()) { renderLogin(); return; }
    try { await FIN.refreshSession(); }
    catch (e) { if (e.status === 401) return; c.innerHTML = head('FINANCE ACCESS', 'ยังเข้า Finance ไม่ได้') + `<div class="fm-notice bad"><span>!</span><div><b>${esc(e.message)}</b><small>${e.status === 403 ? 'ให้ Owner เพิ่มสิทธิ์ที่ Finance › ตั้งค่า › ผู้ใช้งาน Finance' : 'ลองใหม่อีกครั้ง'}</small></div></div><div class="fm-panel fm-center"><button class="fm-btn fm-btn-light" type="button" onclick="location.reload()">ลองใหม่</button><a class="fm-btn fm-btn-light" href="../../index.html">กลับหลังร้าน</a></div>`; return; }
    W.addEventListener('hashchange', () => go(location.hash));
    go(location.hash);
    FIN.refreshBadges();
  }

  document.addEventListener('click', e => {
    if (!inScope(e.target)) return;
    if (EMB) {   // ลิงก์ภายใน (#journal/…) → #fin/journal/…
      const a = e.target.closest('a[href^="#"]');
      if (a && !a.getAttribute('href').startsWith(PFX)) { e.preventDefault(); if (a.closest('.fm-overlay')) { document.querySelectorAll('.fm-overlay').forEach(o => o.remove()); document.body.classList.remove('fm-noscroll'); } nav(a.getAttribute('href')); return; }
    }
    const t = e.target.closest('.fm-group-toggle');
    if (t) { const g = document.getElementById(t.getAttribute('aria-controls')); const open = t.getAttribute('aria-expanded') === 'true'; t.setAttribute('aria-expanded', String(!open)); g.hidden = open; return; }
    const p = e.target.closest('[data-page]');
    if (p && !p.closest('.fm-dialog')) { e.preventDefault(); nav('#' + p.dataset.page); return; }
    const g = e.target.closest('[data-go]');
    if (g) { e.preventDefault(); nav(g.dataset.go); }
  });
  if (!EMB) document.addEventListener('DOMContentLoaded', () => {
    const mb = $('#fmMenuBtn'), sb = $('#fmSidebar'), bd = $('#fmBackdrop');
    if (mb) mb.onclick = () => { sb.classList.add('open'); bd.classList.add('show'); };
    if (bd) bd.onclick = () => { sb.classList.remove('open'); bd.classList.remove('show'); };
    document.addEventListener('keydown', e => { if (e.key === 'Escape') { const x = document.querySelector('.fm-overlay:last-of-type .fm-x'); if (x) x.click(); } });
    boot();
  });
})(window);
