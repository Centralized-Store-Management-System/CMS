/* ระบบบัญชี: ปิดยอดรายวัน + รายจ่าย (ผู้มีสิทธิ์ แยกสาขา) และงบกำไรขาดทุน (เฉพาะ Owner)
 * กำไรขาดทุนดึงจากทุกระบบ: ยอดขาย − ต้นทุนวัตถุดิบ (สต็อก) − ค่าแรง (เงินเดือน แบ่งตามชั่วโมงที่ทำงานในแต่ละสาขา) − ค่าแฟรนไชส์ (ตามสัญญาของแต่ละสาขา) − รายจ่าย
 * รายจ่ายส่วนกลาง (ไม่ระบุสาขา) ปันส่วนให้แต่ละสาขาตามยอดขาย ดูได้ทั้งรายสาขาและรวมทุกสาขา */
const EXP_CATS = ['ค่าเช่าพื้นที่', 'ค่าไฟ', 'ค่าน้ำ', 'อินเทอร์เน็ต/โทรศัพท์', 'GP เดลิเวอรี่', 'ค่าธรรมเนียมบัตร/QR', 'วัสดุสิ้นเปลือง', 'ซ่อมบำรุงเครื่อง', 'การตลาดของร้าน', 'ค่าขนส่ง', 'ภาษี/ใบอนุญาต', 'อื่นๆ'];
const OCC_CATS = ['ค่าเช่าพื้นที่', 'ค่าไฟ', 'ค่าน้ำ'];
const FIXED_CATS = ['ค่าเช่าพื้นที่', 'อินเทอร์เน็ต/โทรศัพท์'];
const VAR_CATS = ['GP เดลิเวอรี่', 'ค่าธรรมเนียมบัตร/QR'];
const saleTotal = s => num(s.cash) + num(s.qr) + num(s.card) + num(s.delivery) + num(s.other);
const F_SALE = () => [
  ...(myBranches().length > 1 ? [{ k: 'branch', label: 'สาขา', type: 'select', options: branchOpts(), req: 1 }] : []),
  { k: 'date', label: 'วันที่', half: 1, type: 'date', req: 1 }, { k: 'cups', label: 'จำนวนแก้ว', half: 1, type: 'number' },
  { k: 'cash', label: 'เงินสด', half: 1, type: 'number' }, { k: 'qr', label: 'โอน/QR', half: 1, type: 'number' },
  { k: 'card', label: 'บัตร', half: 1, type: 'number' }, { k: 'delivery', label: 'เดลิเวอรี่', half: 1, type: 'number', help: 'Grab, LINE MAN, Robinhood ฯลฯ' },
  { k: 'other', label: 'อื่นๆ', half: 1, type: 'number', help: 'เช่น คูปอง แอปสมาชิก' }, { k: 'cashCounted', label: 'เงินสดที่นับได้จริง', half: 1, type: 'number', help: 'ไม่รวมเงินทอนตั้งต้น' },
  { k: 'note', label: 'บันทึก', type: 'textarea' }
];
const F_EXP = () => [
  ...(myBranches().length > 1 || allBranch() ? [{ k: 'branch', label: 'สาขา', type: 'select', options: [...branchOpts(), ...(allBranch() ? [['', 'ส่วนกลาง (ปันส่วนให้ทุกสาขาตามยอดขาย)']] : [])] }] : []),
  { k: 'date', label: 'วันที่', half: 1, type: 'date', req: 1 }, { k: 'category', label: 'หมวด', half: 1, type: 'select', options: EXP_CATS },
  { k: 'amount', label: 'จำนวนเงิน (บาท)', half: 1, type: 'number', req: 1 }, { k: 'payMethod', label: 'จ่ายโดย', half: 1, type: 'select', options: ['เงินสด', 'โอน', 'บัตร'] },
  { k: 'vendor', label: 'จ่ายให้', half: 1 }, { k: 'ref', label: 'เลขที่ใบเสร็จ', half: 1 },
  { k: 'note', label: 'บันทึก', type: 'textarea' }
];
/** ค่าแฟรนไชส์และเงินลงทุนตามสัญญาของแต่ละสาขา (ไม่ได้ใส่ ใช้ค่าตั้งต้นในตั้งค่า) */
function brFees(code) {
  const x = branchBy(code) || {}, st = S.settings, v = k => x[k] !== undefined && x[k] !== '' ? num(x[k]) : num(st[k]);
  return { royaltyPct: v('royaltyPct'), marketingPct: v('marketingPct'), pos: v('posRentMonthly'), investment: num(x.investment), amortMonths: v('amortMonths') || 72 };
}
const brOpenBy = (code, month) => { const x = branchBy(code) || {}; return !x.openDate || x.openDate <= month + '-' + pad(daysIn(month)); };
/** งบของสาขาเดียว (ยังไม่รวมส่วนกลาง) */
function pnlPart(month, code, f, isCur) {
  const vat = bool(S.settings.vatRegistered), fe = brFees(code), live = brOpenBy(code, month);
  const sales = S.t.sales.filter(s => (s.date || '').startsWith(month) && s.branch === code);
  const gross = sum(sales, saleTotal), cups = sum(sales, 'cups'), revenue = vat ? gross / 1.07 : gross;
  const u = usage(month, code);
  const byCat = {};
  S.t.expenses.filter(x => (x.date || '').startsWith(month) && x.branch === code).forEach(x => { byCat[x.category] = (byCat[x.category] || 0) + num(x.amount) * (isCur && FIXED_CATS.includes(x.category) ? f : 1); });
  return {
    code, gross, cups, revenue, ...u, cogs: u.issue + u.waste + u.adj,
    royalty: revenue * fe.royaltyPct / 100, mkt: revenue * fe.marketingPct / 100,
    labor: can('payroll') ? laborCost(month, f, code) : 0,
    byCat, pos: live ? fe.pos * f : 0, amort: live && fe.amortMonths > 0 ? fe.investment / fe.amortMonths * f : 0, fe
  };
}
function pnl(month, b = S.branch) {
  const st = S.settings, dim = daysIn(month), isCur = month === today().slice(0, 7);
  const elapsed = isCur ? new Date().getDate() : dim, f = elapsed / dim;
  const codes = S.t.branches.filter(x => brOpenBy(x.code, month) || S.t.sales.some(s => s.branch === x.code && (s.date || '').startsWith(month))).map(x => x.code);
  const parts = codes.map(c => pnlPart(month, c, f, isCur));
  const use = b ? parts.filter(x => x.code === b) : parts;
  const add = k => sum(use, k);
  const p = { month, isCur, elapsed, dim, f, branch: b, parts };
  ['gross', 'cups', 'revenue', 'issue', 'waste', 'adj', 'purch', 'tin', 'tout', 'cogs', 'royalty', 'mkt', 'labor', 'pos', 'amort'].forEach(k => { p[k] = add(k); });
  p.vatOut = p.gross - p.revenue;
  p.byCat = {}; use.forEach(x => Object.entries(x.byCat).forEach(([k, v]) => { p.byCat[k] = (p.byCat[k] || 0) + v; }));
  const central = {}; S.t.expenses.filter(x => (x.date || '').startsWith(month) && !x.branch).forEach(x => { central[x.category] = (central[x.category] || 0) + num(x.amount) * (isCur && FIXED_CATS.includes(x.category) ? f : 1); });
  const centralTot = Object.values(central).reduce((a, v) => a + v, 0), allRev = sum(parts, 'revenue');
  p.share = b ? (allRev > 0 ? p.revenue / allRev : 1 / Math.max(1, parts.length)) : 1;
  p.central = b ? {} : central; p.centralAlloc = b ? centralTot * p.share : 0; p.centralTot = centralTot;
  p.laborEst = can('payroll') && payAll(month, f).some(r => !r.closed);
  const occupancy = OCC_CATS.reduce((a, k) => a + (p.byCat[k] || 0), 0);
  const otherExp = Object.entries(p.byCat).filter(([k]) => !OCC_CATS.includes(k)).reduce((a, [, v]) => a + v, 0) + (b ? p.centralAlloc : centralTot);
  p.occupancy = occupancy; p.otherExp = otherExp;
  p.fees = b ? brFees(b) : null;
  p.totalCost = p.cogs + p.labor + p.royalty + p.mkt + occupancy + otherExp + p.pos + p.amort;
  p.profit = p.revenue - p.totalCost;
  const variable = p.cogs + p.royalty + p.mkt + VAR_CATS.reduce((a, k) => a + (p.byCat[k] || 0), 0);
  const varRatio = p.revenue > 0 ? variable / p.revenue : 1;
  const fixedFull = (p.totalCost - variable) / (f || 1);
  const beRev = p.revenue > 0 && varRatio < 0.95 ? fixedFull / (1 - varRatio) / dim : 0;
  p.be = bool(st.vatRegistered) ? beRev * 1.07 : beRev;
  p.beCups = p.be && p.cups ? p.be / (p.gross / p.cups) : 0;
  p.annualized = elapsed ? p.gross / elapsed * 365 : 0;
  p.annualAll = elapsed ? sum(parts, 'gross') / elapsed * 365 : 0;
  return p;
}
function pnlLines(p) {
  const st = S.settings, vat = bool(st.vatRegistered), L = [];
  const add = (l, v, c = 'ind', src = '') => L.push([l, v, c, src]);
  add('รายได้', null, 'sub');
  add(vat ? 'ยอดขายรวม VAT' : 'ยอดขาย', p.gross, 'ind', 'บัญชี');
  if (vat) add('หัก ภาษีขาย 7%', -p.vatOut);
  add('รายได้สุทธิ', p.revenue, 'sub');
  add('ต้นทุนขาย', null, 'sub');
  add('วัตถุดิบที่เบิกใช้', p.issue, 'ind', 'สต็อก'); add('ของเสีย/หมดอายุ', p.waste, 'ind', 'สต็อก'); add('ส่วนต่างจากการตรวจนับ', p.adj, 'ind', 'สต็อก');
  add('กำไรขั้นต้น', p.revenue - p.cogs, 'sub');
  add('ค่าใช้จ่ายดำเนินงาน', null, 'sub');
  add('เงินเดือน ค่าแรง และประกันสังคมส่วนนายจ้าง' + (p.laborEst ? ' (ประมาณการ)' : ''), p.labor, 'ind', 'เงินเดือน');
  add(p.fees ? `ค่า Royalty ${p.fees.royaltyPct}% ของยอดขาย` : 'ค่า Royalty ตามสัญญาแต่ละสาขา', p.royalty, 'ind', 'แฟรนไชส์'); add(p.fees ? `ค่าการตลาด ${p.fees.marketingPct}% ของยอดขาย` : 'ค่าการตลาดตามสัญญาแต่ละสาขา', p.mkt, 'ind', 'แฟรนไชส์');
  Object.entries(p.byCat).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => add(k + (p.isCur && FIXED_CATS.includes(k) ? ' (ปันส่วน)' : ''), v, 'ind', 'รายจ่าย'));
  Object.entries(p.central).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => add('ส่วนกลาง: ' + k, v, 'ind', 'รายจ่าย'));
  if (p.centralAlloc) add(`ค่าใช้จ่ายส่วนกลาง ปันส่วน ${Math.round(p.share * 100)}% ตามยอดขาย`, p.centralAlloc, 'ind', 'รายจ่าย');
  if (p.pos) add('ค่าเช่าเครื่อง POS' + (p.isCur ? ' (ปันส่วน)' : ''), p.pos, 'ind', 'แฟรนไชส์');
  if (p.amort) add('ตัดจำหน่ายเงินลงทุนเปิดร้าน' + (p.isCur ? ' (ปันส่วน)' : ''), p.amort, 'ind', 'สาขา');
  add('รวมค่าใช้จ่ายดำเนินงาน', p.totalCost - p.cogs, 'sub');
  add(p.profit >= 0 ? 'กำไรสุทธิ' : 'ขาดทุนสุทธิ', p.profit, 'total');
  return L;
}
function pSales() {
  const m = S.month, list = S.t.sales.filter(s => (s.date || '').startsWith(m) && inBr(s.branch)).sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(a.branch).localeCompare(String(b.branch)));
  const tot = sum(list, saleTotal), cups = sum(list, 'cups');
  const ch = [['เงินสด', sum(list, 'cash'), 's-rent'], ['โอน/QR', sum(list, 'qr'), 's-labor'], ['บัตร', sum(list, 'card'), 's-other'], ['เดลิเวอรี่', sum(list, 'delivery'), 's-cogs'], ['อื่นๆ', sum(list, 'other'), 's-fr']].filter(c => c[1] > 0);
  let h = `<div class="sumbox"><p class="big">${baht(tot)}</p><p>ยอดขาย${thMonth(m)}${S.branch ? ' ' + esc(branchName(S.branch)) : multiBranch() ? ' ทุกสาขา' : ''} ปิดยอดแล้ว ${list.length} ${S.branch || !multiBranch() ? 'วัน' : 'รายการ'}${cups ? `, ${fmt(cups)} แก้ว เฉลี่ย ${fmt(tot / cups)} บาทต่อแก้ว` : ''}</p></div>`;
  if (tot > 0) h += `<div class="bar slim" role="img" aria-label="สัดส่วนช่องทางชำระเงิน">${ch.map(c => `<span style="width:${(c[1] / tot * 100).toFixed(2)}%;background:var(--${c[2]})"></span>`).join('')}</div><div class="legend">${ch.map(c => `<div><i style="background:var(--${c[2]})"></i><span>${c[0]}</span><b>${(c[1] / tot * 100).toFixed(0)}%</b></div>`).join('')}</div>`;
  if (!S.branch && multiBranch()) h += `<div class="group">${openBranches().map(b => { const l = list.filter(s => s.branch === b.code), t = sum(l, saleTotal); return statRow(esc(b.name), fmt(t), `${l.length} วัน, เฉลี่ยวันละ ${fmt(l.length ? t / l.length : 0)} บาท`); }).join('')}</div>`;
  const T = today(), notYet = openBranches().filter(b => brOpenBy(b.code, m) && !S.t.sales.some(s => s.date === addDays(T, -1) && s.branch === b.code) && inBr(b.code));
  if (m === T.slice(0, 7) && notYet.length) h += `<p class="note warn">เมื่อวานยังไม่ปิดยอด: ${notYet.map(b => esc(b.name)).join(', ')}</p>`;
  h += `<div class="actions"><button class="btn primary" data-a="newSale">ปิดยอดวันนี้</button></div><div class="group">${list.map(s => {
    const os = s.cashCounted === '' || s.cashCounted == null ? 0 : num(s.cashCounted) - num(s.cash);
    return `<button class="row" data-a="sale:${s.id}"><span class="main"><span class="t">${thDate(s.date, { weekday: 'short', day: 'numeric', month: 'short' })} ${S.branch ? '' : branchChip(s.branch)}</span><span class="s">${fmt(s.cups)} แก้ว, เงินสด ${fmt(s.cash)}, โอน ${fmt(s.qr)}, เดลิเวอรี่ ${fmt(s.delivery)}${s.by ? `, ปิดยอดโดย ${esc(s.by)}` : ''}</span>${Math.abs(os) >= 1 ? `<span class="chips"><span class="chip ${os < 0 ? 'bad' : 'warn'}">เงินสด${os < 0 ? 'ขาด' : 'เกิน'} ${fmt(Math.abs(os))} บาท</span></span>` : ''}</span><span class="v">${fmt(saleTotal(s))}</span></button>`;
  }).join('') || empty('ยังไม่มียอดขายเดือนนี้ กด “ปิดยอดวันนี้” หลังปิดร้านทุกวัน')}</div>`;
  return h;
}
function saleLive(sh) {
  const v = collect(sh, F_SALE(), {}), t = saleTotal(v), out = sh.querySelector('.live');
  const os = v.cashCounted === '' ? null : num(v.cashCounted) - num(v.cash);
  out.innerHTML = `ยอดรวม <b>${baht(t)}</b>${os == null ? '' : Math.abs(os) < 1 ? ', เงินสดตรง' : `, เงินสด${os < 0 ? 'ขาด' : 'เกิน'} ${baht(Math.abs(os))}`}`;
}
function openSale(id) {
  const br = oneBranch();
  const s = id ? S.t.sales.find(x => x.id === id) : (S.t.sales.find(x => x.date === today() && x.branch === br) || { date: today(), branch: br });
  const sid = s.id;
  openForm({
    title: 'ปิดยอดขาย ' + thDate(s.date, { day: 'numeric', month: 'long' }), sub: myBranches().length > 1 ? '' : esc(branchName(s.branch)), fields: F_SALE(), data: s, live: saleLive,
    extraHTML: '<p class="live"></p><p class="note">ใส่ตัวเลขจากรายงานปิดกะของเครื่อง POS ให้ตรงกัน แล้วนับเงินสดจริงในลิ้นชัก</p>',
    onSave: async v => {
      if (!v.branch) v.branch = br;
      if (S.t.sales.some(x => x.date === v.date && x.branch === v.branch && x.id !== sid)) throw new Error(`${branchName(v.branch)} วันที่นี้ปิดยอดไปแล้ว แก้ไขรายการเดิมแทน`);
      v.total = r2(saleTotal(v)); v.overShort = v.cashCounted === '' ? '' : r2(num(v.cashCounted) - num(v.cash));
      await DB.upsert('sales', v);
    },
    onDelete: sid ? () => DB.remove('sales', sid) : null
  });
}
function pExp() {
  const m = S.month, list = S.t.expenses.filter(x => (x.date || '').startsWith(m) && (x.branch ? inBr(x.branch) : !S.branch)).sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const by = {}; list.forEach(x => { by[x.category] = (by[x.category] || 0) + num(x.amount); });
  return `<div class="sumbox"><p class="big">${baht(sum(list, 'amount'))}</p><p>รายจ่ายที่บันทึกใน${thMonth(m)}</p><p class="muted">เงินเดือน วัตถุดิบ ค่า Royalty ค่าการตลาด และค่าเช่า POS ระบบดึงจากระบบอื่นให้เอง ไม่ต้องบันทึกซ้ำที่นี่</p></div>
  <div class="actions"><button class="btn primary" data-a="newExp">บันทึกรายจ่าย</button></div>
  ${list.length ? `<div class="group">${Object.entries(by).sort((a, b) => b[1] - a[1]).map(([k, v]) => statRow(esc(k), fmt(v), '')).join('')}</div>` : ''}
  <h3 class="h3">รายการ</h3><div class="group">${list.map(x => `<button class="row" data-a="exp:${x.id}"><span class="main"><span class="t">${esc(x.category)}${x.vendor ? ', ' + esc(x.vendor) : ''} ${x.branch ? (S.branch ? '' : branchChip(x.branch)) : '<span class="chip br">ส่วนกลาง</span>'}</span><span class="s">${thDate(x.date)}${x.payMethod ? ', ' + esc(x.payMethod) : ''}${x.note ? ', ' + esc(x.note) : ''}</span></span><span class="v">${fmt(x.amount)}</span></button>`).join('') || empty('ยังไม่มีรายจ่ายเดือนนี้')}</div>`;
}
async function syncExpenseToFinance(row) {
  const token = String(S.token || '');
  if (!token) throw new Error('ไม่พบรหัสเข้าใช้งาน จึงยังส่งรายการเข้า Finance ไม่ได้');
  const url = 'https://ytxbnqosenolojifeikf.supabase.co/functions/v1/finance-api';
  const payload = {
    action: 'document.create',
    document_type: 'expense',
    document_date: row.date || today(),
    lines: [{ description: [row.category || 'รายจ่าย', row.note || '', row.vendor ? 'ผู้รับเงิน: ' + row.vendor : ''].filter(Boolean).join(' · '), quantity: 1, unit_price: num(row.amount), account_code: null }],
    vat_rate: 0,
    wht_rate: 0,
    notes: 'นำเข้าจาก Manager > Accounting > Expenses · สาขา: ' + (row.branch || 'ส่วนกลาง') + ' · วิธีจ่าย: ' + (row.payMethod || 'ไม่ระบุ') + (row.ref ? ' · เลขที่ใบเสร็จ: ' + row.ref : ''),
    reference: row.ref || ('MANAGER-' + row.id),
    source_system: 'manager_expenses',
    source_record_id: String(row.id),
    submit: true
  };
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-cms-session': token, 'idempotency-key': 'manager-expense-' + row.id },
    body: JSON.stringify(payload),
    cache: 'no-store'
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) throw new Error(data.error || 'ส่งข้อมูลเข้า Finance ไม่สำเร็จ');
  return data.data;
}
function openExp(id) {
  const x = id ? S.t.expenses.find(e => e.id === id) : { date: today(), category: 'วัสดุสิ้นเปลือง', payMethod: 'เงินสด', branch: oneBranch() };
  openForm({ title: id ? 'แก้ไขรายจ่าย' : 'บันทึกรายจ่าย', sub: myBranches().length > 1 || allBranch() ? '' : esc(branchName(x.branch)), fields: F_EXP(), data: x, onSave: async v => {
    if (v.branch === undefined) v.branch = oneBranch();
    const saved = await DB.upsert('expenses', v);
    try {
      const financeDoc = await syncExpenseToFinance(saved);
      toast('บันทึกรายจ่ายและส่ง Finance แล้ว' + (financeDoc.document_number ? ' · ' + financeDoc.document_number : ''));
    } catch (err) {
      toast('บันทึกรายจ่ายแล้ว แต่ยังส่ง Finance ไม่สำเร็จ: ' + err.message);
    }
    return saved;
  }, onDelete: id ? () => DB.remove('expenses', id) : null });
}
function pPnl() {
  const p = pnl(S.month), st = S.settings;
  const snap = S.t.pnl_monthly.find(x => x.month === S.month && (x.branch || '') === (S.branch || ''));
  let h = '';
  if (!S.branch && p.parts.length > 1) h += pnlCompare(p);
  h += `<h3 class="h3">${S.branch ? esc(branchName(S.branch)) : p.parts.length > 1 ? 'รวมทุกสาขา' : ''}</h3><div class="group"><table class="stmt"><caption class="vh">งบกำไรขาดทุน ${thMonth(S.month)}</caption>${pnlLines(p).map(([l, v, c, src]) => `<tr class="${c}"><td>${esc(l)}${src ? ` <span class="chip">${src}</span>` : ''}</td><td>${v == null ? '' : fmt(v)}</td></tr>`).join('')}</table></div>`;
  const n = [];
  n.push(`ซื้อวัตถุดิบเข้าร้านเดือนนี้ ${baht(p.purch)} เป็นเงินที่จ่ายออกจริง แต่ต้นทุนในงบคิดจากของที่เบิกใช้และของเสีย`);
  if (p.isCur) n.push(`เดือนนี้ยังไม่จบ เงินเดือนรายเดือน ค่าเช่า ค่า POS และค่าตัดจำหน่ายปันส่วนตามวันที่ผ่านไป ${p.elapsed}/${p.dim} วัน`);
  if (S.branch && p.parts.length > 1) n.push('ค่าแรงของสาขานี้ คิดจากชั่วโมงที่พนักงาน (รวมคนที่ยืมมาจากสาขาอื่น) ทำงานที่สาขานี้จริง');
  if (p.tin || p.tout) n.push(`โอนของเข้า ${baht(p.tin)} ออก ${baht(p.tout)} ไม่นับเป็นต้นทุน จนกว่าจะเบิกใช้`);
  if (p.laborEst) n.push('ค่าแรงเป็นประมาณการจากการลงเวลา จนกว่าจะปิดงวดเงินเดือน');
  if (p.be) n.push(`จุดคุ้มทุนประมาณวันละ ${baht(p.be)}${p.beCups ? ` หรือราว ${fmt(p.beCups)} แก้ว` : ''}`);
  if (!bool(st.vatRegistered) && p.annualAll > 1800000) n.push(`ยอดขายรวมทุกสาขาคิดเป็นปีละประมาณ ${baht(p.annualAll)} เกิน 1.8 ล้านบาท (นับรวมทุกสาขาของผู้ประกอบการเดียวกัน) ต้องจดทะเบียนภาษีมูลค่าเพิ่ม ปรึกษานักบัญชี`);
  if (snap) n.push(`บันทึกงบเดือนนี้ลงไฟล์บัญชีไว้แล้วเมื่อ ${thDate(String(snap.updatedAt || '').slice(0, 10))} (กำไร ${baht(snap.profit)})`);
  h += n.map(t => `<p class="note">${t}</p>`).join('');
  return h + `<div class="actions"><button class="btn primary" data-a="pnlSnap">${snap ? 'บันทึกงบเดือนนี้ใหม่' : 'บันทึกงบเดือนนี้ลงไฟล์บัญชี'}</button><button class="btn" data-a="pnlCsv">ส่งออก CSV</button></div>`;
}
/** เปรียบเทียบกำไรแต่ละสาขา (ก่อนและหลังปันส่วนส่วนกลาง) */
function pnlCompare(p) {
  const rows = p.parts.map(x => { const q = pnl(p.month, x.code); return { x, q }; });
  const col = (l, fn, cls = '') => `<tr class="${cls}"><td class="rname">${l}</td>${rows.map(r => `<td>${fn(r)}</td>`).join('')}</tr>`;
  const pct = (a, b) => b > 0 ? Math.round(a / b * 100) + '%' : '–';
  return `<h3 class="h3">เปรียบเทียบสาขา ${thMonth(p.month)}</h3><div class="roster-wrap" style="max-height:none"><table class="roster cmp"><thead><tr><th class="rname"></th>${rows.map(r => `<th>${esc(branchName(r.x.code))}</th>`).join('')}</tr></thead><tbody>
    ${col('ยอดขาย', r => fmt(r.q.gross))}${col('แก้ว/วัน', r => fmt(r.q.cups / (p.elapsed || 1)))}
    ${col('ต้นทุนวัตถุดิบ', r => `${fmt(r.q.cogs)} <small>${pct(r.q.cogs, r.q.revenue)}</small>`)}
    ${col('ค่าแรง', r => `${fmt(r.q.labor)} <small>${pct(r.q.labor, r.q.revenue)}</small>`)}
    ${col('ค่าแฟรนไชส์ + POS', r => fmt(r.q.royalty + r.q.mkt + r.q.pos))}
    ${col('ค่าเช่า น้ำ ไฟ', r => fmt(r.q.occupancy))}
    ${col('อื่นๆ + ตัดจำหน่าย', r => fmt(r.q.otherExp - r.q.centralAlloc + r.q.amort))}
    ${col('กำไรก่อนส่วนกลาง', r => fmt(r.q.profit + r.q.centralAlloc), 'sub')}
    ${p.centralTot ? col('ส่วนกลางที่ปันส่วน', r => fmt(r.q.centralAlloc)) : ''}
    ${col('กำไรสุทธิ', r => `<b class="${r.q.profit < 0 ? 'neg' : ''}">${fmt(r.q.profit)}</b> <small>${pct(r.q.profit, r.q.revenue)}</small>`, 'sub')}
    ${col('จุดคุ้มทุน/วัน', r => r.q.be ? fmt(r.q.be) : '–')}
  </tbody></table></div><p class="note">แตะเลือกสาขาที่มุมบนเพื่อดูงบเต็มของสาขานั้น ค่าแรงแบ่งตามชั่วโมงที่ทำงานจริงในแต่ละสาขา ส่วนกลางปันส่วนตามยอดขาย</p>`;
}
function pnlCsv() {
  const p = pnl(S.month);
  showText('งบกำไรขาดทุน ' + thMonth(S.month) + (S.branch ? ' ' + branchName(S.branch) : ''), toCsv(pnlLines(p).map(([l, v]) => [l, v == null ? '' : r2(v)])), `pnl-${S.month}${S.branch ? '-' + S.branch : ''}.csv`);
}
async function pnlSnap(btn) {
  const p = pnl(S.month), k = ['gross', 'revenue', 'cups', 'cogs', 'labor', 'royalty', 'mkt', 'occupancy', 'otherExp', 'pos', 'amort', 'profit'];
  const row = { id: 'pnl_' + S.month + (S.branch ? '_' + S.branch : ''), month: S.month, branch: S.branch || '' };
  k.forEach(x => { row[x] = r2(p[x]); });
  await busy(btn, () => DB.upsert('pnl_monthly', row));
  toast('บันทึกงบลงชีต "สรุปงบรายเดือน" ในไฟล์บัญชีแล้ว'); App.render();
}

defMod({
  key: 'acct', mod: 'acct', label: 'Accounting', icon: 'acct', group: 'Operations', desc: 'ปิดยอดรายวัน รายจ่าย กำไรขาดทุน', perm: ['sales', 'pnl'],
  subs: [
    { key: 'sales', label: 'Daily Sales', perm: ['sales'], month: true, view: pSales },
    { key: 'exp', label: 'Expenses', perm: ['sales'], month: true, view: pExp },
    { key: 'pnl', label: 'P&L', perm: ['pnl'], month: true, view: pPnl }
  ],
  summary: () => { const l = S.t.sales.filter(x => x.date === today() && inBr(x.branch)); return l.length ? `วันนี้ปิดยอดแล้ว ${baht(sum(l, saleTotal))}` : 'วันนี้ยังไม่ปิดยอด'; },
  acts: { newSale: () => openSale(), sale: id => openSale(id), newExp: () => openExp(), exp: id => openExp(id), pnlCsv: () => pnlCsv(), pnlSnap: (a, b) => pnlSnap(b) }
});
