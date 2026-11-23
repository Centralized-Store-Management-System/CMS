/* ใยแมงมุมระบบ (มุมเจ้าของร้าน) — กดพนักงาน บัญชี ตำแหน่ง เมนู หรือสาขา
 * แล้วเห็นว่า "สิ่งนี้เชื่อมกับอะไรบ้าง" และ "ตรงไหนยังไม่เชื่อม ต้องไปแก้ที่หน้าไหน"
 * ต่างจาก Owner › ใยแมงมุม (js/it-linkmap.js) ที่เป็นใยของไฟล์โปรแกรมสำหรับคนเขียนระบบ
 * ใช้ข้อมูลที่หน้าเว็บโหลดไว้แล้วทั้งหมด ไม่เรียกเซิร์ฟเวอร์เพิ่ม · ไม่แก้ไฟล์เดิม ไม่แตะ CSS ที่ใช้ร่วม */
'use strict';
(function () {
  if (typeof defMod !== 'function' || typeof MODS === 'undefined') return;
  const WB = { kind: 'emp', id: '', q: '' };
  const KINDS = [['emp', 'พนักงาน'], ['user', 'บัญชีผู้ใช้'], ['pos', 'ตำแหน่ง'], ['menu', 'เมนู / ระบบ'], ['branch', 'สาขา']];
  const esc2 = s => esc(String(s == null ? '' : s));

  /* ---------- อ่านข้อมูลที่โหลดไว้แล้ว ---------- */
  const emps = () => (S.t.employees || []).filter(e => e.status !== 'ลาออก' || WB.id === e.id);
  const users = () => (S.t.users || []);
  const devs = () => (S.t.devices || []);
  const posList = () => (typeof HR_POSITIONS !== 'undefined' ? HR_POSITIONS : []);
  const menus = () => MODS.filter(m => m.key !== 'web' && m.label);
  const userOf = e => users().find(u => u.empId === e.id);
  const empOfUser = u => u.empId ? (S.t.employees || []).find(e => e.id === u.empId) : null;
  const posOf = e => e ? posList().find(p => (e.positionId && p.id === e.positionId) || (e.positionCode && p.position_code === e.positionCode) || (!e.positionId && !e.positionCode && e.position && p.name_th === e.position)) : null;
  const permsOfUser = u => {
    if (!u) return [];
    if (u.role === 'owner') return (S.permList || []).map(x => x[0]);
    try { const p = JSON.parse(u.perms || 'null'); if (Array.isArray(p) && p.length) return p; } catch (_) { /* ใช้สิทธิ์ตามระดับ */ }
    const byRole = typeof currentPerms === 'function' ? currentPerms() : {};
    return byRole[u.role] || [];
  };
  const canSee = (m, perms, role) => role === 'owner' || !m.perm || !m.perm.length || m.perm.some(k => k === '*' || perms.includes(k));
  const title = (kind, id) => {
    if (kind === 'emp') { const e = empById(id); return e ? shortName(e) + ' · ' + (e.code || '') : ''; }
    if (kind === 'user') { const u = users().find(x => x.id === id); return u ? (u.name || u.username) : ''; }
    if (kind === 'pos') { const p = posList().find(x => x.id === id); return p ? (p.name_th || p.name_en) : ''; }
    if (kind === 'menu') { const m = menus().find(x => x.key === id); return m ? m.label : ''; }
    if (kind === 'branch') return branchName(id);
    return '';
  };

  /* ---------- หัวใจ: สิ่งนี้เชื่อมกับอะไร และอะไรยังไม่เชื่อม ---------- */
  function spokes(kind, id) {
    const out = [];
    const add = (o) => out.push({ status: 'ok', ...o });
    if (kind === 'emp') {
      const e = empById(id); if (!e) return out;
      const u = userOf(e), p = posOf(e), d = u ? devs().filter(x => x.uid === u.id && x.status === 'active') : [];
      const perms = permsOfUser(u), seen = menus().filter(m => u && canSee(m, perms, u.role));
      add(typeof branchBy === 'function' && branchBy(e.branch)
        ? { label: 'สาขา', note: branchName(e.branch), to: { kind: 'branch', id: e.branch } }
        : { status: 'miss', label: 'สาขา', note: e.branch ? 'รหัสสาขา ' + e.branch + ' ไม่มีในทะเบียนสาขา' : 'ยังไม่ได้ระบุสาขา', fix: 'แก้ที่ HR › พนักงาน หรือเพิ่มสาขาในแอป Owner', href: '#hr' });
      /* ตำแหน่ง: จับคู่ด้วยชื่อได้ก็จริง แต่ถ้าไม่มี "รหัสตำแหน่ง" ระบบออเดอร์และสิทธิ์ตามตำแหน่งจะไม่เห็น
       * (นี่คือต้นเหตุเดียวกับที่ตำแหน่งไม่ซิงก์ไประบบออเดอร์) จึงต้องแยกจากกรณีที่ผูกครบจริง */
      if (p && e.positionId) add({ label: 'ตำแหน่ง', note: p.name_th + (p.department ? ' · ' + p.department : ''), to: { kind: 'pos', id: p.id } });
      else if (p) add({ status: 'warn', label: 'ตำแหน่ง', note: p.name_th + ' · ผูกด้วยชื่อเท่านั้น ยังไม่มีรหัสตำแหน่ง', fix: 'ระบบออเดอร์และสิทธิ์ตามตำแหน่งจะยังไม่เห็นตำแหน่งนี้ · เปิด HR › พนักงาน แล้วบันทึกใหม่ หรือกด "ซ่อมการเชื่อมตำแหน่ง"', href: '#hr', to: { kind: 'pos', id: p.id } });
      else if (e.position) add({ status: 'warn', label: 'ตำแหน่ง', note: '"' + e.position + '" ไม่มีในทะเบียนตำแหน่ง', fix: 'เปิด HR › พนักงาน แล้วเลือกตำแหน่งจากรายการ หรือเพิ่มตำแหน่งนี้ที่ HR › Positions', href: '#hr' });
      else add({ status: 'miss', label: 'ตำแหน่ง', note: 'ยังไม่กำหนดตำแหน่ง', fix: 'เปิด HR › พนักงาน แล้วเลือกตำแหน่ง', href: '#hr' });
      if (u) add({ label: 'บัญชีเข้าใช้งาน', note: u.username + ' · ' + (u.status === 'active' ? 'เปิดใช้งาน' : 'ปิดอยู่'), status: u.status === 'active' ? 'ok' : 'warn', to: { kind: 'user', id: u.id }, fix: u.status === 'active' ? '' : 'เปิดใช้งานที่ Users', href: '#users' });
      else add({ status: 'miss', label: 'บัญชีเข้าใช้งาน', note: 'ยังไม่มีบัญชี — เข้าเว็บหลังร้านและแอปไม่ได้', fix: 'สร้างบัญชีที่เมนู Users แล้วผูกกับพนักงานคนนี้', href: '#users' });
      /* ของที่ต่อจากบัญชี: ถ้ายังไม่มีบัญชี ก็ยังแสดงไว้ให้เห็นว่าติดเป็นลูกโซ่ ไม่ใช่ซ่อนหายไป */
      add(!u ? { status: 'miss', label: 'รหัส PIN', note: 'ยังไม่มีบัญชี จึงยังตั้ง PIN ไม่ได้', fix: 'สร้างบัญชีก่อนที่เมนู Users', href: '#users' }
        : u.pinHash ? { label: 'รหัส PIN', note: 'ตั้งแล้ว' + (u.pinSetAt ? ' · ' + String(u.pinSetAt).slice(0, 10) : '') }
          : { status: 'miss', label: 'รหัส PIN', note: 'ยังไม่ได้ตั้ง PIN เข้าใช้งาน', fix: 'ส่งรหัสเปิดใช้งานให้พนักงานตั้ง PIN ที่หน้าเข้าสู่ระบบ', href: '#users' });
      add(e.lineUserId ? { label: 'LINE', note: 'ผูกแล้ว' + (e.lineName ? ' · ' + e.lineName : '') }
        : { status: 'warn', label: 'LINE', note: 'ยังไม่ผูก — ลงเวลา ขอลา ดูตารางงานผ่าน LINE ไม่ได้', fix: 'ให้พนักงานขอรหัสผูก LINE ในแอปพนักงาน', href: '#me' });
      add(!u ? { status: 'warn', label: 'เครื่องที่ผูกไว้', note: 'ยังไม่มีบัญชี จึงผูกเครื่องไม่ได้', fix: 'สร้างบัญชีก่อนที่เมนู Users', href: '#users' }
        : d.length ? { label: 'เครื่องที่ผูกไว้', note: d.length + ' เครื่อง (เปิดแอปไม่ต้องพิมพ์ชื่อผู้ใช้)' }
          : { status: 'warn', label: 'เครื่องที่ผูกไว้', note: 'ยังไม่มีเครื่องที่ตั้งรหัสปลดล็อก', fix: 'เปิดแอปในเครื่องของพนักงานแล้วตั้งรหัสปลดล็อก 6 หลัก' });
      const ord = perms.includes('orders') || perms.includes('catalog');
      add(!u ? { status: 'warn', label: 'ระบบออเดอร์', note: 'ยังไม่มีบัญชี จึงเข้าระบบออเดอร์ไม่ได้', fix: 'สร้างบัญชีก่อนที่เมนู Users', href: '#users' }
        : ord && u.status === 'active' && u.pinHash
          ? { label: 'ระบบออเดอร์', note: 'ใช้งานได้ · ' + [perms.includes('orders') ? 'Live Orders' : '', perms.includes('catalog') ? 'Web Admin Portal' : ''].filter(Boolean).join(' · ') }
          : { status: 'warn', label: 'ระบบออเดอร์', note: !ord ? 'ระดับนี้ยังไม่มีสิทธิ์ orders/catalog' : 'ต้องเปิดใช้งานบัญชีและตั้ง PIN ก่อน', fix: 'ตั้งสิทธิ์ที่ Settings › Permissions', href: '#set/perms' });
      add(!u ? { status: 'miss', label: 'เมนูที่เข้าได้', note: 'ยังไม่มีบัญชี จึงเข้าเมนูใดไม่ได้เลย', fix: 'สร้างบัญชีที่เมนู Users', href: '#users' }
        : { label: 'เมนูที่เข้าได้', note: seen.length + ' เมนู · ' + seen.slice(0, 4).map(m => m.label).join(', ') + (seen.length > 4 ? ' …' : ''), status: seen.length ? 'ok' : 'miss', fix: seen.length ? '' : 'ระดับนี้ยังไม่ได้รับสิทธิ์เมนูใดเลย', href: '#set/perms' });
      if (e.status === 'ลาออก') add({ status: 'warn', label: 'สถานะ', note: 'ลาออกแล้ว — ควรปิดบัญชีและยกเลิกเครื่องที่ผูกไว้', fix: 'ปิดบัญชีที่ Users', href: '#users' });
      return out;
    }
    if (kind === 'user') {
      const u = users().find(x => x.id === id); if (!u) return out;
      const e = empOfUser(u), perms = permsOfUser(u), seen = menus().filter(m => canSee(m, perms, u.role));
      const d = devs().filter(x => x.uid === u.id && x.status === 'active');
      add(e ? { label: 'พนักงาน', note: shortName(e) + ' · ' + (e.code || ''), to: { kind: 'emp', id: e.id } }
        : { status: u.role === 'owner' ? 'ok' : 'miss', label: 'พนักงาน', note: u.role === 'owner' ? 'บัญชีเจ้าของร้าน ไม่ต้องผูกพนักงาน' : 'ยังไม่ผูกกับพนักงานคนไหน — ตารางงาน เวลาทำงาน และ LINE จะไม่รู้ว่าเป็นใคร', fix: 'แก้บัญชีที่ Users แล้วเลือกพนักงาน', href: '#users' });
      add({ label: 'ระดับสิทธิ์', note: (typeof ROLE_NAME === 'object' && ROLE_NAME[u.role]) || u.role });
      add({ label: 'สิทธิ์ที่ได้', note: perms.length + ' สิทธิ์' + (perms.length ? ' · ' + perms.slice(0, 5).join(', ') : ''), status: perms.length ? 'ok' : 'miss', fix: perms.length ? '' : 'ตั้งสิทธิ์ที่ Settings › Permissions', href: '#set/perms' });
      add({ label: 'เมนูที่เข้าได้', note: seen.length + ' เมนู', status: seen.length ? 'ok' : 'miss', href: '#set/perms' });
      add(u.pinHash ? { label: 'รหัส PIN', note: 'ตั้งแล้ว' } : { status: 'miss', label: 'รหัส PIN', note: 'ยังไม่ได้ตั้ง', fix: 'ส่งรหัสเปิดใช้งานให้ตั้ง PIN', href: '#users' });
      add(d.length ? { label: 'เครื่องที่ผูกไว้', note: d.length + ' เครื่อง' } : { status: 'warn', label: 'เครื่องที่ผูกไว้', note: 'ยังไม่มี' });
      add(u.branch || u.branchAccess ? { label: 'ขอบเขตสาขา', note: u.branchAccess === '*' ? 'ทุกสาขา' : branchName(u.branch) } : { status: 'warn', label: 'ขอบเขตสาขา', note: 'ยังไม่ระบุ', href: '#users' });
      return out;
    }
    if (kind === 'pos') {
      const p = posList().find(x => x.id === id); if (!p) return out;
      const hold = (S.t.employees || []).filter(e => posOf(e) && posOf(e).id === p.id);
      add(p.department ? { label: 'แผนก', note: p.department } : { status: 'warn', label: 'แผนก', note: 'ยังไม่ผูกแผนก', fix: 'กำหนดแผนกที่ HR › Positions', href: '#hr' });
      add({ label: 'ระดับ', note: p.level || 'ยังไม่ระบุ', status: p.level ? 'ok' : 'warn' });
      add({ label: 'สถานะ', note: p.status === 'active' ? 'เปิดใช้งาน' : 'ปิดอยู่', status: p.status === 'active' ? 'ok' : 'warn' });
      add(hold.length ? { label: 'พนักงานที่ถือตำแหน่งนี้', note: hold.length + ' คน · ' + hold.slice(0, 4).map(shortName).join(', '), to: hold.length === 1 ? { kind: 'emp', id: hold[0].id } : null }
        : { status: 'warn', label: 'พนักงานที่ถือตำแหน่งนี้', note: 'ยังไม่มีใครถือตำแหน่งนี้', fix: 'กำหนดตำแหน่งให้พนักงานที่ HR › พนักงาน', href: '#hr' });
      add({ label: 'สิทธิ์ตามตำแหน่ง', note: 'ตั้งได้ที่ Settings › Permissions (ตารางที่สอง)', href: '#set/perms' });
      return out;
    }
    if (kind === 'menu') {
      const m = menus().find(x => x.key === id); if (!m) return out;
      const need = m.perm || [], byRole = typeof currentPerms === 'function' ? currentPerms() : {};
      const roles = Object.keys(byRole).filter(r => !need.length || need.some(k => (byRole[r] || []).includes(k)));
      const who = users().filter(u => canSee(m, permsOfUser(u), u.role));
      add({ label: 'สิทธิ์ที่ต้องมี', note: need.length ? need.join(' หรือ ') : 'ทุกคนเข้าได้' });
      add(roles.length || !need.length ? { label: 'ระดับที่เข้าได้', note: (roles.map(r => (typeof ROLE_NAME === 'object' && ROLE_NAME[r]) || r).join(', ')) || 'ทุกระดับ' }
        : { status: 'miss', label: 'ระดับที่เข้าได้', note: 'ยังไม่มีระดับไหนได้สิทธิ์นี้เลย — เมนูนี้ไม่มีใครเห็นนอกจากเจ้าของร้าน', fix: 'ติ๊กสิทธิ์ให้ระดับที่ต้องใช้ที่ Settings › Permissions', href: '#set/perms' });
      add(who.length ? { label: 'ผู้ใช้ที่เข้าได้จริง', note: who.length + ' บัญชี · ' + who.slice(0, 4).map(u => u.name || u.username).join(', '), to: who.length === 1 ? { kind: 'user', id: who[0].id } : null }
        : { status: 'miss', label: 'ผู้ใช้ที่เข้าได้จริง', note: 'ไม่มีบัญชีไหนเข้าเมนูนี้ได้', fix: 'ตรวจสิทธิ์ที่ Settings › Permissions', href: '#set/perms' });
      if (m.subs && m.subs.length) add({ label: 'หน้าย่อย', note: m.subs.length + ' หน้า · ' + m.subs.map(s => s.label).slice(0, 4).join(', ') });
      add({ label: 'เปิดเมนูนี้', note: m.desc || '', href: '#' + m.key });
      return out;
    }
    if (kind === 'branch') {
      const es = (S.t.employees || []).filter(e => e.branch === id && e.status !== 'ลาออก');
      const us = users().filter(u => u.branch === id);
      const b = typeof branchBy === 'function' ? branchBy(id) : null;
      add(b ? { label: 'ทะเบียนสาขา', note: (b.name || id) + ' · ' + (b.status || '') } : { status: 'miss', label: 'ทะเบียนสาขา', note: 'ไม่พบรหัสสาขานี้ในทะเบียน', fix: 'เพิ่มสาขาในแอป Owner › ระบบ IT › สาขา' });
      add(es.length ? { label: 'พนักงาน', note: es.length + ' คน · ' + es.slice(0, 4).map(shortName).join(', ') } : { status: 'warn', label: 'พนักงาน', note: 'ยังไม่มีพนักงานในสาขานี้', href: '#hr' });
      add(us.length ? { label: 'บัญชีผู้ใช้', note: us.length + ' บัญชี' } : { status: 'warn', label: 'บัญชีผู้ใช้', note: 'ยังไม่มีบัญชีผูกกับสาขานี้', href: '#users' });
      if (b) add(b.lat && b.lng ? { label: 'พิกัดลงเวลา', note: 'ตั้งแล้ว · รัศมี ' + (b.radius || '-') + ' ม.' } : { status: 'warn', label: 'พิกัดลงเวลา', note: 'ยังไม่ตั้งพิกัด — ลงเวลาด้วย GPS ไม่ได้' });
      return out;
    }
    return out;
  }

  const broken = (kind, id) => spokes(kind, id).filter(s => s.status !== 'ok');
  function allBroken() {
    const rows = [];
    emps().forEach(e => broken('emp', e.id).filter(s => s.status === 'miss').forEach(s => rows.push({ kind: 'emp', id: e.id, who: shortName(e), s })));
    users().forEach(u => broken('user', u.id).filter(s => s.status === 'miss').forEach(s => rows.push({ kind: 'user', id: u.id, who: u.name || u.username, s })));
    menus().forEach(m => broken('menu', m.key).filter(s => s.status === 'miss').forEach(s => rows.push({ kind: 'menu', id: m.key, who: m.label, s })));
    return rows;
  }

  /* ---------- วาดใยแมงมุม (ศูนย์กลาง + วงรอบ) ---------- */
  function web(kind, id) {
    const sp = spokes(kind, id); if (!sp.length) return '';
    const n = sp.length, W = 980, R = Math.min(300, 170 + n * 8), H = 2 * R + 150, cx = W / 2, cy = H / 2;
    const col = s => s === 'miss' ? '#c32929' : s === 'warn' ? '#b5790f' : '#168250';
    let g = '';
    sp.forEach((s, i) => {
      const a = -Math.PI / 2 + (i * 2 * Math.PI / n);
      const x = cx + Math.cos(a) * R, y = cy + Math.sin(a) * R;
      const bw = 210, bh = 54, bx = Math.max(8, Math.min(W - bw - 8, x - bw / 2)), by = y - bh / 2;
      g += '<path class="wb-e ' + s.status + '" d="M ' + (cx + Math.cos(a) * 92) + ' ' + (cy + Math.sin(a) * 46) + ' L ' + (bx + bw / 2) + ' ' + (by + (y > cy ? 0 : bh)) + '"/>';
      g += '<g class="wb-n" data-wb-spoke="' + i + '" tabindex="0" role="button" aria-label="' + esc2(s.label + ' ' + s.note) + '">'
        + '<rect x="' + bx + '" y="' + by + '" width="' + bw + '" height="' + bh + '" rx="12" fill="#fff" stroke="' + col(s.status) + '" stroke-width="' + (s.status === 'ok' ? 1.5 : 2.4) + '"/>'
        + '<circle cx="' + (bx + 14) + '" cy="' + (by + 16) + '" r="5" fill="' + col(s.status) + '"/>'
        + '<text class="wb-l" x="' + (bx + 26) + '" y="' + (by + 20) + '">' + esc2(s.label) + '</text>'
        + '<text class="wb-s" x="' + (bx + 12) + '" y="' + (by + 40) + '">' + esc2(s.note.length > 34 ? s.note.slice(0, 33) + '…' : s.note) + '</text></g>';
    });
    const bad = sp.filter(s => s.status !== 'ok').length;
    return '<svg class="wb-svg" viewBox="0 0 ' + W + ' ' + H + '" style="width:' + W + 'px" role="img" aria-label="ความเชื่อมโยงของ ' + esc2(title(kind, id)) + '">' + g
      + '<g><ellipse cx="' + cx + '" cy="' + cy + '" rx="92" ry="46" fill="#07583f"/>'
      + '<text class="wb-ct" x="' + cx + '" y="' + (cy - 4) + '">' + esc2((title(kind, id) || '').slice(0, 18)) + '</text>'
      + '<text class="wb-cs" x="' + cx + '" y="' + (cy + 16) + '">' + esc2((KINDS.find(k => k[0] === kind) || [])[1] || '') + (bad ? ' · ค้าง ' + bad : '') + '</text></g></svg>';
  }

  /* ---------- หน้าเว็บ ---------- */
  const CSS = '<style>'
    + '.wb-top{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:10px}.wb-top input{flex:1;min-width:150px;margin:0}'
    + '.wb-tabs{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px}.wb-tab{padding:7px 13px;border:1px solid var(--line);border-radius:999px;background:#fff;cursor:pointer;font-size:13px}'
    + '.wb-tab.on{background:#07583f;color:#fff;border-color:#07583f}'
    + '.wb-grid{display:grid;grid-template-columns:minmax(240px,.8fr) minmax(0,2fr);gap:12px}@media(max-width:900px){.wb-grid{grid-template-columns:1fr}}'
    + '.wb-list{max-height:560px;overflow:auto}'
    + '.wb-item{display:flex;align-items:center;gap:8px;width:100%;padding:9px 11px;margin:4px 0;border:1px solid var(--line);border-radius:10px;background:#fff;cursor:pointer;text-align:left;font-size:13px}'
    + '.wb-item i{width:9px;height:9px;border-radius:50%;flex:none;background:#168250}.wb-item i.miss{background:#c32929}.wb-item i.warn{background:#d28a20}'
    + '.wb-item.on{border-color:#07583f;box-shadow:inset 0 0 0 1px #07583f}.wb-item small{color:var(--muted);margin-left:auto;white-space:nowrap}'
    + '.wb-canvas{overflow:auto;border:1px solid var(--line);border-radius:14px;background:radial-gradient(#dde7e1 1px,transparent 1px),#fafcfb;background-size:22px 22px}'
    + '.wb-svg{display:block;height:auto;max-width:none}.wb-e{fill:none;stroke:#9cc3ad;stroke-width:2}.wb-e.miss{stroke:#c32929;stroke-dasharray:7 6}.wb-e.warn{stroke:#d9a441;stroke-dasharray:7 6}'
    + '.wb-n{cursor:pointer}.wb-n:hover rect,.wb-n:focus rect{stroke-width:3.2;outline:none}'
    + '.wb-l{font:700 12.5px sans-serif;fill:#20382c}.wb-s{font:11px sans-serif;fill:#5c7268}'
    + '.wb-ct{font:700 15px sans-serif;fill:#fff;text-anchor:middle}.wb-cs{font:11px sans-serif;fill:#bfe3cf;text-anchor:middle}'
    + '.wb-fix{border:1px solid var(--line);border-left:4px solid #c32929;border-radius:10px;padding:10px 12px;margin:8px 0;background:#fff7f6}'
    + '.wb-fix.warn{border-left-color:#d28a20;background:#fffaf1}.wb-fix b{font-size:13px}.wb-fix p{margin:4px 0;font-size:12px;color:#4a5b52;line-height:1.6}'
    + '</style>';

  function view() {
    const rows = allBroken();
    let list = [];
    const q = WB.q.trim().toLowerCase();
    if (WB.kind === 'emp') list = emps().map(e => ({ id: e.id, label: shortName(e) + ' · ' + (e.code || ''), sub: e.position || '' }));
    if (WB.kind === 'user') list = users().map(u => ({ id: u.id, label: u.name || u.username, sub: (typeof ROLE_NAME === 'object' && ROLE_NAME[u.role]) || u.role }));
    if (WB.kind === 'pos') list = posList().map(p => ({ id: p.id, label: p.name_th || p.name_en, sub: p.department || '' }));
    if (WB.kind === 'menu') list = menus().map(m => ({ id: m.key, label: m.label, sub: (m.perm || []).join(', ') }));
    if (WB.kind === 'branch') list = (S.t.branches || []).map(b => ({ id: b.code, label: b.name || b.code, sub: b.status || '' }));
    if (q) list = list.filter(x => (x.label + ' ' + x.sub).toLowerCase().includes(q));
    list.forEach(x => { const b = broken(WB.kind, x.id); x.st = b.some(s => s.status === 'miss') ? 'miss' : b.length ? 'warn' : 'ok'; x.n = b.length; });
    if (!WB.id || !list.some(x => x.id === WB.id)) WB.id = (list.find(x => x.st === 'miss') || list[0] || {}).id || '';
    const sp = WB.id ? spokes(WB.kind, WB.id) : [];
    const bad = sp.filter(s => s.status !== 'ok');
    const needPos = (WB.kind === 'pos' || WB.kind === 'emp') && !posList().length;
    return CSS
      + '<p class="note">กดชื่อพนักงาน บัญชี ตำแหน่ง เมนู หรือสาขา แล้วดูว่าสิ่งนั้นเชื่อมกับอะไรบ้าง · เส้นประแดง = ยังไม่เชื่อม กดที่กล่องเพื่อดูว่าต้องไปแก้ที่ไหน</p>'
      + (rows.length ? '<div class="wb-fix"><b>ทั้งระบบมีจุดที่ยังไม่เชื่อม ' + rows.length + ' จุด</b><p>'
        + rows.slice(0, 6).map(r => esc2(r.who) + ': ' + esc2(r.s.label)).join(' · ') + (rows.length > 6 ? ' และอีก ' + (rows.length - 6) + ' จุด' : '') + '</p></div>'
        : '<div class="note" style="background:#e8f7ef;color:#17673f">ทุกจุดที่ตรวจได้เชื่อมกันครบแล้ว</div>')
      + '<div class="wb-tabs">' + KINDS.map(k => '<button class="wb-tab' + (WB.kind === k[0] ? ' on' : '') + '" data-a="wbKind:' + k[0] + '">' + k[1] + '</button>').join('') + '</div>'
      + (needPos ? '<p class="note">ยังไม่ได้โหลดทะเบียนตำแหน่ง — เปิด HR › Positions หนึ่งครั้งแล้วกลับมา จะเห็นเส้นตำแหน่งครบ</p>' : '')
      + '<div class="wb-grid"><div><div class="wb-top"><input class="field" id="wb-q" placeholder="ค้นหา" value="' + esc2(WB.q) + '"></div>'
      + '<div class="wb-list">' + (list.length ? list.map(x => '<button class="wb-item' + (x.id === WB.id ? ' on' : '') + '" data-a="wbPick:' + esc2(x.id) + '"><i class="' + x.st + '"></i><span>' + esc2(x.label) + (x.sub ? ' <span class="muted">· ' + esc2(x.sub) + '</span>' : '') + '</span>' + (x.n ? '<small>ค้าง ' + x.n + '</small>' : '') + '</button>').join('') : '<p class="note">ไม่พบรายการ</p>') + '</div></div>'
      + '<div><div class="wb-canvas">' + (WB.id ? web(WB.kind, WB.id) : '') + '</div>'
      + (bad.length ? '<h3 class="h3">สิ่งที่ยังไม่เชื่อมของ ' + esc2(title(WB.kind, WB.id)) + '</h3>'
        + bad.map(s => '<div class="wb-fix' + (s.status === 'warn' ? ' warn' : '') + '"><b>' + esc2(s.label) + ' — ' + esc2(s.note) + '</b>'
          + (s.fix ? '<p>' + esc2(s.fix) + '</p>' : '') + (s.href ? '<a class="btn sm" href="' + esc2(s.href) + '">ไปหน้าที่แก้ได้</a>' : '') + '</div>').join('')
        : (WB.id ? '<div class="note" style="background:#e8f7ef;color:#17673f">รายการนี้เชื่อมครบแล้ว</div>' : ''))
      + '</div></div>';
  }

  defMod({
    key: 'web', mod: 'web', label: 'ใยแมงมุมระบบ', icon: 'admin', group: 'System',
    desc: 'กดพนักงาน บัญชี ตำแหน่ง เมนู หรือสาขา แล้วเห็นว่าเชื่อมกับอะไร และตรงไหนยังไม่เชื่อม',
    perm: ['admin', 'users'],
    view,
    summary: () => { const n = allBroken().length; return n ? 'ยังไม่เชื่อม ' + n + ' จุด' : 'เชื่อมครบ'; },
    acts: {
      wbKind: k => { WB.kind = k; WB.id = ''; App.render(); },
      wbPick: id => { WB.id = id; App.render(); },
      wbSpoke: i => { const s = spokes(WB.kind, WB.id)[Number(i)]; if (s && s.to) { WB.kind = s.to.kind; WB.id = s.to.id; App.render(); } }
    }
  });

  /* กดกล่องในภาพ: ถ้าเป็นสิ่งที่เปิดดูต่อได้ ให้ย้ายศูนย์กลางไปที่นั่น */
  document.addEventListener('click', e => {
    const g = e.target.closest && e.target.closest('[data-wb-spoke]');
    if (!g || !WB.id) return;
    const s = spokes(WB.kind, WB.id)[Number(g.dataset.wbSpoke)];
    if (s && s.to) { WB.kind = s.to.kind; WB.id = s.to.id; App.render(); }
    else if (s && s.href) location.hash = s.href;
  });
  document.addEventListener('input', e => { if (e.target.id === 'wb-q') { WB.q = e.target.value; App.render(); const n = document.getElementById('wb-q'); if (n) { n.focus(); n.setSelectionRange(n.value.length, n.value.length); } } });
})();
