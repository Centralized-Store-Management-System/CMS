/* ระบบสต็อก (ทุกคนที่ได้รับสิทธิ์): รายการสินค้าใช้ร่วมกันทุกสาขา แต่ยอดคงเหลือแยกตามสาขา
 * รับเข้า เบิกใช้ ของเสีย ตรวจนับ โอนระหว่างสาขา จุดสั่งซื้อ ล็อตใกล้หมดอายุ
 * ปรับยอดจากการตรวจนับโดยคนที่ไม่มีสิทธิ์อนุมัติสต็อก ต้องรออนุมัติก่อนนับเข้ายอดคงเหลือและต้นทุน */
const ITEM_CATS = ['เมล็ดกาแฟ', 'นม/ครีม', 'ไซรัป/ซอส', 'ผงชา/โกโก้', 'ผลไม้/ท็อปปิ้ง', 'เบเกอรี่', 'แก้ว/ฝา/หลอด', 'บรรจุภัณฑ์อื่น', 'อุปกรณ์ทำความสะอาด', 'อื่นๆ'];
const MOVE_TYPES = ['รับเข้า', 'เบิกใช้', 'ของเสีย', 'ปรับยอด', 'โอนออก', 'โอนเข้า'];
const counted = m => !m.status || m.status === 'อนุมัติ';
const signed = m => ['รับเข้า', 'ปรับยอด', 'โอนเข้า'].includes(m.type) ? num(m.qty) : -num(m.qty);
const isTransfer = m => m.type === 'โอนออก' || m.type === 'โอนเข้า';
/** ยอดคงเหลือต่อสินค้า ของสาขา br ('' = รวมทุกสาขาที่เห็น) */
function balances(br = oneBranch()) {
  const b = {};
  // ยอดยกมาก่อนช่วงที่โหลด (คิดจากฝั่ง Apps Script) + รายการตั้งแต่ต้นเดือนก่อน; แถวเดือนเก่าที่โหลดทีหลัง (_h) รวมอยู่ในยอดยกมาแล้ว
  Object.entries(S.stockOpen || {}).forEach(([k, q]) => { const i = k.indexOf('|'), bb = k.slice(0, i), it = k.slice(i + 1); if (!br || bb === br) b[it] = (b[it] || 0) + num(q); });
  S.t.moves.filter(m => counted(m) && !m._h && (!br || m.branch === br)).forEach(m => { b[m.itemId] = (b[m.itemId] || 0) + signed(m); });
  return b;
}
function lowStock(br) {
  const list = br ? [br] : openBranches().filter(x => inBr(x.code)).map(x => x.code), out = [];
  list.forEach(code => { const b = balances(code); S.t.items.forEach(i => { if ((b[i.id] || 0) <= num(i.min)) out.push({ i, br: code }); }); });
  return out;
}
/** มูลค่าวัตถุดิบที่ใช้ในเดือน (โอนระหว่างสาขาไม่ใช่ต้นทุน แค่ย้ายของ) */
function usage(month, br = '') {
  const u = { issue: 0, waste: 0, adj: 0, purch: 0, tin: 0, tout: 0 };
  S.t.moves.filter(m => counted(m) && (m.date || '').startsWith(month) && (!br || m.branch === br)).forEach(m => {
    const v = num(m.qty) * num(m.unitCost);
    if (m.type === 'เบิกใช้') u.issue += v; else if (m.type === 'ของเสีย') u.waste += v; else if (m.type === 'ปรับยอด') u.adj -= v; else if (m.type === 'รับเข้า') u.purch += v;
    else if (m.type === 'โอนเข้า') u.tin += v; else if (m.type === 'โอนออก') u.tout += v;
  });
  return u;
}
function expiring(b, br) {
  const lim = addDays(today(), 3), from = addDays(today(), -3), out = [];
  const mv = S.t.moves.filter(m => m.branch === br);
  mv.filter(m => m.type === 'รับเข้า' && m.expiry && m.expiry <= lim && m.expiry >= from).forEach(m => {
    const later = sum(mv.filter(x => x.itemId === m.itemId && x.type === 'รับเข้า' && x.date > m.date), 'qty');
    const remain = Math.min(num(m.qty), (b[m.itemId] || 0) - later);
    if (remain > 0) out.push({ ...m, remain });
  });
  return out.sort((a, c) => a.expiry.localeCompare(c.expiry));
}
const itemOpts = () => S.t.items.map(i => [i.id, `${i.name} (${i.unit})`]);
const F_ITEM = () => [
  { k: 'sku', label: 'รหัสสินค้า', half: 1 }, { k: 'category', label: 'หมวด', half: 1, type: 'select', options: ITEM_CATS },
  { k: 'name', label: 'ชื่อสินค้า', req: 1 },
  { k: 'unit', label: 'หน่วยนับ', half: 1, req: 1, help: 'เช่น กก. ขวด แถว' }, { k: 'cost', label: 'ต้นทุนต่อหน่วย (บาท)', half: 1, type: 'number' },
  { k: 'min', label: 'จุดสั่งซื้อ (ต่อสาขา)', half: 1, type: 'number', help: 'เหลือเท่านี้ให้สั่งเพิ่ม' }, { k: 'supplier', label: 'ผู้ขาย', half: 1 },
  { k: 'note', label: 'บันทึก', type: 'textarea' }
];
const brField = () => myBranches().length > 1 ? [{ k: 'branch', label: 'สาขา', half: 1, type: 'select', options: branchOpts(), req: 1 }] : [];
const F_MOVE = t => [
  { k: 'type', label: 'รายการ', half: 1, type: 'select', options: t === 'ปรับยอด' || isTransfer({ type: t }) ? [t] : MOVE_TYPES.slice(0, 3) }, { k: 'date', label: 'วันที่', half: 1, type: 'date', req: 1 },
  ...brField(),
  { k: 'itemId', label: 'สินค้า', type: 'select', options: itemOpts(), req: 1 },
  { k: 'qty', label: 'จำนวน', half: 1, type: 'number', req: 1 }, { k: 'unitCost', label: 'ราคาต่อหน่วย (ตอนรับเข้า)', half: 1, type: 'number', help: 'เว้นว่างใช้ต้นทุนล่าสุด' },
  { k: 'expiry', label: 'วันหมดอายุ (ถ้ามี)', half: 1, type: 'date' }, { k: 'ref', label: 'เลขที่ใบส่งของ', half: 1 },
  { k: 'note', label: 'บันทึก', type: 'textarea' }
];
function stockBranchSum() {
  const list = openBranches();
  if (S.branch || list.length < 2) return '';
  return `<div class="group">${list.map(x => { const b = balances(x.code); const low = S.t.items.filter(i => (b[i.id] || 0) <= num(i.min)).length; return statRow(esc(x.name), baht(sum(S.t.items, i => Math.max(0, b[i.id] || 0) * num(i.cost))), low ? `ถึงจุดสั่งซื้อ ${low} รายการ` : 'ของครบ'); }).join('')}</div>`;
}
function pOnhand() {
  const br = oneBranch(), b = balances(br), low = i => (b[i.id] || 0) <= num(i.min);
  const items = S.t.items.slice().sort((x, y) => (low(x) ? 0 : 1) - (low(y) ? 0 : 1) || String(x.category || '').localeCompare(String(y.category || '')) || String(x.name).localeCompare(String(y.name)));
  const pend = S.t.moves.filter(m => m.status === 'รออนุมัติ' && m.branch === br).length;
  let h = stockBranchSum() + branchSeg();
  h += `<div class="sumbox"><p class="big">${baht(sum(items, i => Math.max(0, b[i.id] || 0) * num(i.cost)))}</p><p>มูลค่าวัตถุดิบคงเหลือ ${esc(branchName(br))} ${items.length} รายการ${items.some(low) ? `, ถึงจุดสั่งซื้อ ${items.filter(low).length} รายการ` : ''}</p></div>
    <div class="actions"><button class="btn primary" data-a="newMove:รับเข้า">รับของเข้า</button><button class="btn" data-a="newMove:เบิกใช้">เบิกใช้</button><button class="btn" data-a="newMove:ของเสีย">ของเสีย/หมดอายุ</button>${S.t.branches.filter(x => x.status !== 'ปิด').length > 1 ? '<button class="btn" data-a="newTransfer">โอนไปสาขาอื่น</button>' : ''}</div>`;
  if (pend) h += `<p class="note warn">ปรับยอดจากการตรวจนับ ${pend} รายการ รออนุมัติ ยังไม่นับรวมในคงเหลือ</p>`;
  const ex = expiring(b, br);
  if (ex.length) h += `<h3 class="h3">ล็อตใกล้หมดอายุ ตรวจของจริงที่ชั้นวาง</h3><div class="group">${ex.map(m => { const it = itemById(m.itemId) || {}; const gone = m.expiry < today(); return `<div class="row static"><span class="main"><span class="t">${esc(it.name)}</span><span class="s">ล็อตรับเข้า ${thDate(m.date)} น่าจะเหลือราว ${fmtQ(m.remain)} ${esc(it.unit || '')} (เข้าก่อนออกก่อน)</span></span><span class="chip ${gone ? 'bad' : 'warn'}">${gone ? 'หมดอายุแล้ว' : 'หมดอายุ'} ${thDate(m.expiry)}</span></div>`; }).join('')}</div>`;
  h += `<h3 class="h3">คงเหลือ</h3><div class="group">${items.map(i => {
    const q = b[i.id] || 0;
    const chip = q < 0 ? '<span class="chips"><span class="chip bad">ติดลบ ตรวจการรับเข้า</span></span>' : low(i) ? '<span class="chips"><span class="chip warn">ถึงจุดสั่งซื้อ</span></span>' : '';
    return `<button class="row" data-a="itemAct:${i.id}"><span class="main"><span class="t">${esc(i.name)}</span><span class="s">${esc(i.category || '')}, สั่งเมื่อเหลือ ${fmtQ(i.min)} ${esc(i.unit)}</span>${chip}</span><span class="v">${fmtQ(q)} <small>${esc(i.unit)}</small></span></button>`;
  }).join('') || empty('ยังไม่มีรายการสินค้า เพิ่มที่แท็บ “สินค้า”')}</div>`;
  return h;
}
function itemActions(id) {
  const i = itemById(id); if (!i) return;
  const br = oneBranch(), q = balances(br)[id] || 0;
  const others = openBranches().length > 1 ? openBranches().filter(x => x.code !== br).map(x => `${esc(x.name)} ${fmtQ(balances(x.code)[id] || 0)}`).join(', ') : '';
  openSheet(`<h3>${esc(i.name)}</h3><p class="muted">${esc(branchName(br))} คงเหลือ ${fmtQ(q)} ${esc(i.unit)}, ต้นทุนเฉลี่ย ${fmtMoney(i.cost)} บาทต่อ${esc(i.unit)}, มูลค่า ${baht(Math.max(0, q) * num(i.cost))}${others ? `<br>สาขาอื่น: ${others}` : ''}</p>
    <div class="stack"><button class="btn primary" data-a="newMove:รับเข้า/${id}">รับเข้า</button><button class="btn" data-a="newMove:เบิกใช้/${id}">เบิกใช้</button><button class="btn" data-a="newMove:ของเสีย/${id}">ของเสีย/หมดอายุ</button>${S.t.branches.filter(x => x.status !== 'ปิด').length > 1 ? `<button class="btn" data-a="newTransfer:${id}">โอนไปสาขาอื่น</button>` : ''}<button class="btn" data-a="item:${id}">แก้ไขข้อมูลสินค้า</button><button class="btn" data-a="close">ปิด</button></div>`);
}
function openMove(id, preset = {}) {
  const m = id ? S.t.moves.find(x => x.id === id) : { type: 'เบิกใช้', date: today(), branch: oneBranch(), ...preset };
  if (!S.t.items.length) return toast('เพิ่มรายการสินค้าก่อน ที่ สต็อก > สินค้า');
  const appr = can('approve_stock');
  const mine = !id || appr || (!isTransfer(m) && m.by === S.me.name && String(m.createdAt || m.updatedAt || '').slice(0, 10) >= addDays(today(), -1) && m.status !== 'อนุมัติ');
  const title = id ? (isTransfer(m) ? `${m.type} ${m.ref || ''}` : 'รายการสต็อก') : { รับเข้า: 'รับของเข้า', ของเสีย: 'บันทึกของเสีย', เบิกใช้: 'เบิกใช้' }[m.type] || 'รายการสต็อก';
  openForm({
    title, fields: F_MOVE(m.type), data: m, readOnly: !mine || (id && isTransfer(m)),
    sub: id ? `${esc(branchName(m.branch))}, บันทึกโดย ${esc(m.by || '-')}${m.status ? `, สถานะ ${esc(m.status)}` : ''}${isTransfer(m) ? `, ${m.type === 'โอนออก' ? 'ไปที่' : 'มาจาก'}${esc(branchName(m.toBranch))}` : ''}${mine ? '' : ' (แก้ไขได้เฉพาะผู้บันทึกในวันเดียวกัน หรือผู้มีสิทธิ์อนุมัติสต็อก)'}` : (myBranches().length > 1 ? '' : esc(branchName(m.branch))),
    onSave: async v => {
      const it = itemById(v.itemId); if (!it) throw new Error('เลือกสินค้า');
      if (!v.branch) v.branch = oneBranch();
      if (v.type !== 'ปรับยอด' && !(num(v.qty) > 0)) throw new Error('จำนวนต้องมากกว่า 0');
      if (v.type === 'รับเข้า') {
        if (v.unitCost === '' || v.unitCost == null) v.unitCost = num(it.cost);
        if (!id) {
          const q0 = Math.max(0, balances(v.branch)[it.id] || 0), q = num(v.qty);
          const avg = q0 + q > 0 ? (q0 * num(it.cost) + q * num(v.unitCost)) / (q0 + q) : num(v.unitCost);
          if (r2(avg) !== r2(num(it.cost))) await DB.upsert('items', { ...it, cost: r2(avg) });
        }
      } else if (!id || v.unitCost === '' || v.unitCost == null) v.unitCost = num(it.cost);
      await DB.upsert('moves', v);
    },
    onDelete: id && mine && (!isTransfer(m) || appr) ? async () => {
      const pair = isTransfer(m) ? S.t.moves.filter(x => x.ref === m.ref && x.itemId === m.itemId && isTransfer(x)) : [m];
      for (const x of pair) await DB.remove('moves', x.id);
    } : null
  });
}
/** โอนของไปสาขาอื่น: บันทึกโอนออกที่สาขาต้นทาง และโอนเข้าที่สาขาปลายทางพร้อมกัน */
function openTransfer(itemId) {
  const from = oneBranch(), open = S.t.branches.filter(x => x.status !== 'ปิด');
  const F = [
    ...(myBranches().length > 1 ? [{ k: 'branch', label: 'จากสาขา', half: 1, type: 'select', options: branchOpts(), req: 1 }] : []),
    { k: 'toBranch', label: 'ไปสาขา', half: 1, type: 'select', options: branchOpts(open), req: 1 },
    { k: 'itemId', label: 'สินค้า', type: 'select', options: itemOpts(), req: 1 },
    { k: 'qty', label: 'จำนวน', half: 1, type: 'number', req: 1 }, { k: 'date', label: 'วันที่', half: 1, type: 'date', req: 1 },
    { k: 'note', label: 'บันทึก', type: 'textarea' }
  ];
  openForm({
    title: 'โอนของไปสาขาอื่น', fields: F, data: { branch: from, toBranch: (open.find(x => x.code !== from) || {}).code, itemId: itemId || '', date: today() },
    sub: 'ยอดของสาขาต้นทางลดลง สาขาปลายทางเพิ่มขึ้นทันที ไม่นับเป็นต้นทุนของทั้งสองสาขาจนกว่าจะเบิกใช้',
    onSave: async v => {
      const it = itemById(v.itemId); if (!it) throw new Error('เลือกสินค้า');
      const b = v.branch || from;
      if (!v.toBranch || v.toBranch === b) throw new Error('เลือกสาขาปลายทางที่ไม่ใช่สาขาเดียวกัน');
      if (!(num(v.qty) > 0)) throw new Error('จำนวนต้องมากกว่า 0');
      const have = balances(b)[it.id] || 0;
      if (num(v.qty) > have + 0.001) throw new Error(`${branchName(b)} มี${it.name}เหลือ ${fmtQ(have)} ${it.unit}`);
      const ref = 'TR-' + Date.now().toString(36).toUpperCase().slice(-6);
      const base = { date: v.date, itemId: it.id, qty: num(v.qty), unitCost: num(it.cost), ref, note: v.note || '' };
      await DB.upsertMany('moves', [{ ...base, branch: b, type: 'โอนออก', toBranch: v.toBranch }, { ...base, branch: v.toBranch, type: 'โอนเข้า', toBranch: b }]);
    },
    savedMsg: 'โอนแล้ว'
  });
}
function pMoves() {
  const m = S.month, f = S.f.moveType || '', u = usage(m, S.branch);
  const list = S.t.moves.filter(x => (x.date || '').startsWith(m) && inBr(x.branch) && (!f || x.type === f)).sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
  return `<div class="toolbar"><select data-ch="moveType" aria-label="กรองประเภท"><option value="">ทุกประเภท</option>${MOVE_TYPES.map(t => `<option${t === f ? ' selected' : ''}>${t}</option>`).join('')}</select><button class="btn primary" data-a="newMove:รับเข้า">รับของเข้า</button></div>
  <div class="group">${statRow(thMonth(m) + (S.branch ? ' ' + esc(branchName(S.branch)) : ''), '', `รับเข้า ${baht(u.purch)}, เบิกใช้ ${baht(u.issue)}, ของเสีย ${baht(u.waste)}, ส่วนต่างตรวจนับ ${baht(u.adj)}${u.tin || u.tout ? `, โอนเข้า ${baht(u.tin)}, โอนออก ${baht(u.tout)}` : ''}`)}</div>
  <div class="group">${list.map(x => { const it = itemById(x.itemId) || {}, sg = signed(x); const st = x.status === 'รออนุมัติ' ? '<span class="chip warn">รออนุมัติ</span>' : x.status === 'ไม่อนุมัติ' ? '<span class="chip bad">ไม่อนุมัติ</span>' : ''; const ch = st + (S.branch ? '' : branchChip(x.branch)) + (isTransfer(x) ? `<span class="chip">${x.type === 'โอนออก' ? 'ไป' : 'จาก'}${esc(branchName(x.toBranch))}</span>` : ''); return `<button class="row" data-a="move:${x.id}"><span class="main"><span class="t">${esc(it.name || '(ลบสินค้าแล้ว)')}</span><span class="s">${thDate(x.date)} ${esc(x.type)}${x.ref ? ', ' + esc(x.ref) : ''}${x.by ? ', โดย ' + esc(x.by) : ''}${x.note ? ', ' + esc(x.note) : ''}</span>${ch ? `<span class="chips">${ch}</span>` : ''}</span><span class="v${sg < 0 ? ' neg' : ''}">${sg >= 0 ? '+' : '−'}${fmtQ(Math.abs(sg))} <small>${esc(it.unit || '')}</small></span></button>`; }).join('') || empty('ยังไม่มีรายการเดือนนี้')}</div>`;
}
function pCount() {
  const br = oneBranch(), b = balances(br);
  const items = S.t.items.slice().sort((x, y) => String(x.category || '').localeCompare(String(y.category || '')) || String(x.name).localeCompare(String(y.name)));
  return `${branchSeg()}<p class="note">นับของจริงตอนปิดร้านที่${esc(branchName(br))} ใส่เฉพาะรายการที่นับแล้ว ช่องว่างจะไม่ถูกปรับ${can('approve_stock') ? ' ส่วนต่างลงเป็นต้นทุนของวันนี้' : ' ส่วนต่างจะรออนุมัติก่อนปรับยอด'}</p>
  <div class="group">${items.map(i => `<div class="row static count"><span class="main"><span class="t">${esc(i.name)}</span><span class="s">ในระบบ ${fmtQ(b[i.id] || 0)} ${esc(i.unit)}</span></span><input type="number" inputmode="decimal" step="any" data-count="${esc(i.id)}" aria-label="จำนวนที่นับได้ ${esc(i.name)}" placeholder="นับได้"></div>`).join('') || empty('ยังไม่มีรายการสินค้า')}</div>
  <div class="actions"><button class="btn primary" data-a="saveCount">บันทึกผลตรวจนับ</button></div>`;
}
async function saveCount(btn) {
  const br = oneBranch(), b = balances(br), rows = [];
  $$('[data-count]').forEach(inp => {
    if (inp.value === '') return;
    const it = itemById(inp.dataset.count); if (!it) return;
    const sys = b[it.id] || 0, phys = num(inp.value), d = r2(phys - sys);
    if (Math.abs(d) < 0.001) return;
    rows.push({ date: today(), branch: br, itemId: it.id, type: 'ปรับยอด', qty: d, unitCost: num(it.cost), ref: 'ตรวจนับ', note: `ในระบบ ${fmtQ(sys)} นับได้ ${fmtQ(phys)}` });
  });
  if (!rows.length) return toast('ไม่มีส่วนต่าง หรือยังไม่ได้ใส่จำนวนที่นับได้');
  const res = await busy(btn, () => DB.upsertMany('moves', rows));
  const pend = res.rows.filter(r => r.status === 'รออนุมัติ').length;
  toast(`บันทึกส่วนต่าง ${rows.length} รายการ ${baht(sum(rows, r => r.qty * r.unitCost))}${pend ? ' รออนุมัติ' : ''}`); App.render();
}
function pItems() {
  const items = S.t.items.slice().sort((x, y) => String(x.category || '').localeCompare(String(y.category || '')) || String(x.name).localeCompare(String(y.name)));
  return `<div class="h2">${items.length} รายการ<span class="spacer"></span><button class="btn primary" data-a="newItem">เพิ่มสินค้า</button></div>
  <div class="group">${items.map(i => `<button class="row" data-a="item:${i.id}"><span class="main"><span class="t">${esc(i.name)}</span><span class="s">${esc(i.sku || '')} ${esc(i.category || '')}${i.supplier ? ', ' + esc(i.supplier) : ''}</span></span><span class="v">${fmtMoney(i.cost)} <small>ต่อ${esc(i.unit)}</small></span></button>`).join('') || empty('ยังไม่มีสินค้า')}</div>
  <p class="note">รายการสินค้าใช้ร่วมกันทุกสาขา ยอดคงเหลือแยกตามสาขา ต้นทุนเฉลี่ยปรับให้อัตโนมัติทุกครั้งที่รับของเข้าในราคาใหม่</p>`;
}
function openItem(id) {
  const i = id ? itemById(id) : { category: 'เมล็ดกาแฟ', supplier: 'OR / Café Amazon' };
  openForm({
    title: id ? i.name : 'เพิ่มสินค้า', fields: F_ITEM(), data: i,
    onSave: v => DB.upsert('items', v),
    onDelete: id && can('approve_stock') ? async () => { if (S.t.moves.some(m => m.itemId === id)) throw new Error('สินค้านี้มีประวัติรับ/เบิกแล้ว ลบไม่ได้'); await DB.remove('items', id); } : null
  });
}

defMod({
  key: 'stock', mod: 'stock', label: 'Inventory', icon: 'stock', group: 'Operations', desc: 'สินค้า รับเข้า เบิกใช้ ของเสีย ตรวจนับ โอนระหว่างสาขา', perm: ['stock'],
  subs: [
    { key: 'onhand', label: 'On Hand', view: pOnhand },
    { key: 'moves', label: 'Movements', month: true, view: pMoves },
    { key: 'count', label: 'Stock Count', view: pCount },
    { key: 'items', label: 'Items', view: pItems }
  ],
  summary: () => { const l = lowStock().length; return l ? `ถึงจุดสั่งซื้อ <em>${l}</em> รายการ` : `${S.t.items.length} รายการ ยังไม่มีของใกล้หมด`; },
  acts: {
    itemAct: id => itemActions(id), newItem: () => openItem(), item: id => openItem(id),
    newMove: a => { const [type, itemId] = a.split('/'); openMove(null, { type: type || 'เบิกใช้', itemId: itemId || '' }); }, move: id => openMove(id),
    newTransfer: a => openTransfer(a), saveCount: (a, b) => saveCount(b)
  }
});
