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
  const roleName = r => (typeof ROLE_NAME === 'object' && ROLE_NAME[r]) || r;

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
      else if (p) add({ status: 'warn', label: 'ตำแหน่ง', note: p.name_th + ' · ผูกด้วยชื่อเท่านั้น ยังไม่มีรหัสตำแหน่ง', fix: 'ระบบออเดอร์และสิทธิ์ตามตำแหน่งจะยังไม่เห็นตำแหน่งนี้', href: '#hr', to: { kind: 'pos', id: p.id }, do: 'posid', doLabel: 'เติมรหัสตำแหน่งให้', doNote: 'บันทึก positionId และ positionCode ของ "' + p.name_th + '" ลงในประวัติพนักงาน' });
      else if (e.position) add({ status: 'warn', label: 'ตำแหน่ง', note: '"' + e.position + '" ไม่มีในทะเบียนตำแหน่ง', fix: 'เปิด HR › พนักงาน แล้วเลือกตำแหน่งจากรายการ หรือเพิ่มตำแหน่งนี้ที่ HR › Positions', href: '#hr' });
      else add({ status: 'miss', label: 'ตำแหน่ง', note: 'ยังไม่กำหนดตำแหน่ง', fix: 'เปิด HR › พนักงาน แล้วเลือกตำแหน่ง', href: '#hr' });
      if (u) add({ label: 'บัญชีเข้าใช้งาน', note: u.username + ' · ' + (u.status === 'active' ? 'เปิดใช้งาน' : 'ปิดอยู่'), status: u.status === 'active' ? 'ok' : 'warn', to: { kind: 'user', id: u.id }, fix: u.status === 'active' ? '' : 'เปิดใช้งานบัญชีคืนเพื่อให้เข้าระบบได้', href: '#users', ...(u.status === 'active' ? {} : { do: 'enable', doLabel: 'เปิดใช้งานบัญชี' }) });
      else add({ status: 'miss', label: 'บัญชีเข้าใช้งาน', note: 'ยังไม่มีบัญชี — เข้าเว็บหลังร้านและแอปไม่ได้', fix: 'สร้างบัญชีแล้วผูกกับพนักงานคนนี้', href: '#users', do: 'mkuser', doLabel: 'สร้างบัญชีให้เลย' });
      /* ของที่ต่อจากบัญชี: ถ้ายังไม่มีบัญชี ก็ยังแสดงไว้ให้เห็นว่าติดเป็นลูกโซ่ ไม่ใช่ซ่อนหายไป */
      add(!u ? { status: 'miss', label: 'รหัส PIN', note: 'ยังไม่มีบัญชี จึงยังตั้ง PIN ไม่ได้', fix: 'สร้างบัญชีก่อนที่เมนู Users', href: '#users' }
        : u.pinHash ? { label: 'รหัส PIN', note: 'ตั้งแล้ว' + (u.pinSetAt ? ' · ' + String(u.pinSetAt).slice(0, 10) : '') }
          : { status: 'miss', label: 'รหัส PIN', note: 'ยังไม่ได้ตั้ง PIN เข้าใช้งาน', fix: 'ระบบตั้ง PIN แทนใครไม่ได้ — ออกรหัสเปิดใช้งานให้เจ้าตัวไปตั้งเอง', href: '#users', do: 'pin', doLabel: 'ออกรหัสเปิดใช้งาน' });
      add(e.lineUserId ? { label: 'LINE', note: 'ผูกแล้ว' + (e.lineName ? ' · ' + e.lineName : '') }
        : { status: 'warn', label: 'LINE', note: 'ยังไม่ผูก — ลงเวลา ขอลา ดูตารางงานผ่าน LINE ไม่ได้', fix: 'ให้พนักงานขอรหัสผูก LINE ในแอปพนักงาน', href: '#me' });
      /* ตาราง "เครื่อง" ไม่ได้โหลดมาที่เว็บหลังร้าน (อยู่ในแอป Owner) จึงบอกได้แค่ว่าดูที่ไหน ไม่เดาว่ามีหรือไม่มี */
      add(!u ? { status: 'warn', label: 'เครื่องที่ผูกไว้', note: 'ยังไม่มีบัญชี จึงผูกเครื่องไม่ได้', fix: 'สร้างบัญชีก่อน', do: 'mkuser', doLabel: 'สร้างบัญชีให้เลย' }
        : d.length ? { label: 'เครื่องที่ผูกไว้', note: d.length + ' เครื่อง (เปิดแอปไม่ต้องพิมพ์ชื่อผู้ใช้)' }
          : { label: 'เครื่องที่ผูกไว้', note: 'ดูรายการเครื่องได้ในแอป Owner › อุปกรณ์' });
      const ord = perms.includes('orders') || perms.includes('catalog');
      add(!u ? { status: 'warn', label: 'ระบบออเดอร์', note: 'ยังไม่มีบัญชี จึงเข้าระบบออเดอร์ไม่ได้', fix: 'สร้างบัญชีก่อนที่เมนู Users', href: '#users' }
        : ord && u.status === 'active' && u.pinHash
          ? { label: 'ระบบออเดอร์', note: 'ใช้งานได้ · ' + [perms.includes('orders') ? 'Live Orders' : '', perms.includes('catalog') ? 'Web Admin Portal' : ''].filter(Boolean).join(' · ') }
          : { status: 'warn', label: 'ระบบออเดอร์', note: !ord ? 'ระดับ ' + roleName(u.role) + ' ยังไม่มีสิทธิ์ orders' : 'ต้องเปิดใช้งานบัญชีและตั้ง PIN ก่อน', fix: 'ตั้งสิทธิ์ที่ Settings › Permissions', href: '#set/perms', ...(ord ? {} : { do: 'perm:orders:' + u.role, doLabel: 'ให้สิทธิ์ orders กับระดับนี้', doNote: 'ติ๊กสิทธิ์ orders ให้ทุกบัญชีระดับ ' + roleName(u.role) + ' (มีผลตอนเข้าสู่ระบบครั้งถัดไป)' }) });
      add(!u ? { status: 'miss', label: 'เมนูที่เข้าได้', note: 'ยังไม่มีบัญชี จึงเข้าเมนูใดไม่ได้เลย', fix: 'สร้างบัญชีที่เมนู Users', href: '#users' }
        : { label: 'เมนูที่เข้าได้', note: seen.length + ' เมนู · ' + seen.slice(0, 4).map(m => m.label).join(', ') + (seen.length > 4 ? ' …' : ''), status: seen.length ? 'ok' : 'miss', fix: seen.length ? '' : 'ระดับนี้ยังไม่ได้รับสิทธิ์เมนูใดเลย', href: '#set/perms' });
      if (e.status === 'ลาออก' && u && u.status === 'active') add({ status: 'miss', label: 'สถานะ', note: 'ลาออกแล้วแต่บัญชียังเปิดอยู่ — ยังเข้าระบบได้', fix: 'ปิดบัญชีเพื่อตัดการเข้าถึง แล้วไปยกเลิกเครื่องที่ผูกไว้ในแอป Owner', href: '#users', do: 'disable', doLabel: 'ปิดบัญชีให้' });
      else if (e.status === 'ลาออก') add({ status: 'warn', label: 'สถานะ', note: 'ลาออกแล้ว · บัญชีปิดแล้ว — เหลือยกเลิกเครื่องที่ผูกไว้ในแอป Owner' });
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
      add(u.pinHash ? { label: 'รหัส PIN', note: 'ตั้งแล้ว' } : { status: 'miss', label: 'รหัส PIN', note: 'ยังไม่ได้ตั้ง', fix: 'ออกรหัสเปิดใช้งานให้เจ้าตัวไปตั้งเอง', href: '#users', do: 'pin', doLabel: 'ออกรหัสเปิดใช้งาน' });
      add(d.length ? { label: 'เครื่องที่ผูกไว้', note: d.length + ' เครื่อง' } : { label: 'เครื่องที่ผูกไว้', note: 'ดูรายการเครื่องได้ในแอป Owner › อุปกรณ์' });
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


  /* ---------- ซ่อมให้ ----------
   * ทำได้เฉพาะงานที่ระบบทำแทนได้จริงและย้อนกลับได้ · ทุกปุ่มต้องกดยืนยันสองครั้ง (armed)
   * ของที่ระบบทำแทนไม่ได้ (ตั้ง PIN แทนเจ้าตัว ผูก LINE แทน ผูกเครื่องแทน) ไม่มีปุ่มซ่อม
   * — ออกให้ได้แค่ "รหัสเปิดใช้งาน" กับข้อความสั่งงานให้เอาไปส่งต่อ */
  const canFix = () => !!S.me && (S.me.role === 'owner' || (S.me.perms || []).includes('users'));
  const ctxUser = () => WB.kind === 'user' ? users().find(x => x.id === WB.id) : userOf(empById(WB.id) || {});
  const OPS = {
    async posid(b) {
      const e = empById(WB.id), p = posOf(e); if (!e || !p) throw new Error('ไม่พบตำแหน่งที่จะผูก');
      await busy(b, () => DB.upsert('employees', { ...e, positionId: p.id, positionCode: p.position_code || '' }), 'กำลังเติมรหัสตำแหน่ง…');
      toast('เติมรหัสตำแหน่งของ ' + shortName(e) + ' แล้ว · ระบบออเดอร์จะเห็นตำแหน่งนี้ในรอบซิงก์ถัดไป');
    },
    async mkuser(b) {
      const e = empById(WB.id); if (!e) throw new Error('ไม่พบพนักงาน');
      if (userOf(e)) throw new Error('พนักงานคนนี้มีบัญชีอยู่แล้ว');
      const role = e.role || 'staff', pre = (typeof UPREFIX === 'object' && UPREFIX[role]) || '';
      const seed = String(e.code || e.nickname || 'user').toLowerCase().replace(/[^a-z0-9_]/g, '') || 'user';
      let un = pre + seed, i = 1;
      while (users().some(x => String(x.username).toLowerCase() === un)) un = pre + seed + (++i);
      const r = await busy(b, () => DB.upsert('users', { username: un, name: shortName(e), role, empId: e.id, branch: e.branch || '', branchAccess: '', perms: '', status: 'active' }), 'กำลังสร้างบัญชี…');
      toast('สร้างบัญชี ' + un + ' ให้ ' + shortName(e) + ' แล้ว');
      if (r && r.setupCode && typeof showSetupCode === 'function') {
        const code = r.setupCode, row = users().find(x => x.id === r.id); if (row) delete row.setupCode;
        setTimeout(() => showSetupCode({ username: r.username || un, setupCode: code, days: 7 }, { name: shortName(e), empId: e.id }), 0);
      }
    },
    async pin(b) {
      const u = ctxUser(); if (!u) throw new Error('ยังไม่มีบัญชี');
      const r = await busy(b, () => API.write({ op: 'resetUserPin', id: u.id }), 'กำลังออกรหัส…');
      DB.local('users', { id: u.id, pending: true, hasPin: false, pinSetAt: '' });
      if (typeof showSetupCode === 'function') showSetupCode(r, u);
    },
    async enable(b) { const u = ctxUser(); if (!u) throw new Error('ไม่พบบัญชี'); await busy(b, () => DB.upsert('users', { ...u, status: 'active' }), '…'); toast('เปิดใช้งานบัญชี ' + u.username + ' แล้ว'); },
    async disable(b) { const u = ctxUser(); if (!u) throw new Error('ไม่พบบัญชี'); await busy(b, () => DB.upsert('users', { ...u, status: 'disabled' }), '…'); toast('ปิดบัญชี ' + u.username + ' แล้ว'); },
    async perm(b, arg) {
      const [key, role] = String(arg).split(':'); if (!key || !role) throw new Error('ไม่รู้ว่าจะให้สิทธิ์อะไร');
      const P = typeof currentPerms === 'function' ? currentPerms() : {}, out = {};
      (typeof PERM_ROLES !== 'undefined' ? PERM_ROLES : Object.keys(P)).forEach(r => { out[r] = (P[r] || []).slice(); });
      if (!out[role]) out[role] = [];
      if (!out[role].includes(key)) out[role].push(key);
      S.settings.perms = JSON.stringify(out);
      await busy(b, () => DB.saveSettings(), 'กำลังบันทึกสิทธิ์…');
      toast('ให้สิทธิ์ ' + key + ' กับระดับ ' + roleName(role) + ' แล้ว · มีผลตอนเข้าสู่ระบบครั้งถัดไป');
    }
  };
  async function runFix(code, btn) {
    const [op, ...rest] = String(code).split(':');
    if (!OPS[op]) return;
    if (!canFix()) { toast('ต้องมีสิทธิ์ Users ถึงจะซ่อมให้ได้'); return; }
    try { await OPS[op](btn, rest.join(':')); App.render(); } catch (e) { toast(e.message); }
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

  /* ---------- คำตอบหลักที่เจ้าของร้านถาม: คนนี้ใช้ฟังก์ชันอะไรได้บ้าง และอะไรยังใช้ไม่ได้ ----------
   * แปลงเรื่องเทคนิค (บัญชี / PIN / สิทธิ์ / LINE) เป็นรายการงานที่ใช้ตัดสินใจได้ทันที */
  function features(kind, id) {
    const u = kind === 'user' ? users().find(x => x.id === id) : userOf(empById(id) || {});
    const e = kind === 'emp' ? empById(id) : empOfUser(u || {});
    const perms = permsOfUser(u), role = u && u.role;
    const live = !!u && u.status === 'active', ready = live && !!u.pinHash;
    const out = [], mkuser = kind === 'emp' && !u ? { do: 'mkuser', doLabel: 'สร้างบัญชีให้เลย' } : null;
    const b = !u ? { why: 'ยังไม่มีบัญชีเข้าใช้งาน', fix: mkuser }
      : !live ? { why: 'บัญชีถูกปิดอยู่', fix: { do: 'enable', doLabel: 'เปิดใช้งานบัญชี' } }
        : { why: 'ยังไม่ได้ตั้ง PIN', fix: { do: 'pin', doLabel: 'ออกรหัสเปิดใช้งาน' } };
    const add = (ok, name, why, fix) => out.push({ ok, name, why: ok ? '' : why, ...(ok ? {} : (fix || {})) });
    add(ready, 'เข้าเว็บหลังร้าน / แอปพนักงาน', b.why, b.fix);
    add(ready, 'ลงเวลาเข้า–ออกด้วย PIN', b.why, b.fix);
    if (e) add(!!e.lineUserId, 'ลงเวลา · ขอลา · ดูกะ ผ่าน LINE', 'ยังไม่ผูก LINE — ต้องให้เจ้าตัวขอรหัสผูกเอง');
    const ord = perms.includes('orders') || perms.includes('catalog');
    add(ready && ord, 'ระบบออเดอร์ (Live Orders / Catalog)', !ready ? b.why : 'ระดับ ' + roleName(role) + ' ยังไม่มีสิทธิ์ orders',
      !ready ? b.fix : { do: 'perm:orders:' + role, doLabel: 'ให้สิทธิ์ orders กับระดับ ' + roleName(role), doNote: 'ทุกบัญชีระดับ ' + roleName(role) + ' จะเข้าระบบออเดอร์ได้' });
    menus().forEach(m => {
      const ok = live && canSee(m, perms, role), need = (m.perm || []).filter(k => k !== '*');
      add(ok, m.label, !u || !live ? b.why : 'ระดับ ' + roleName(role) + ' ไม่มีสิทธิ์ ' + need.join(' / '),
        !u || !live ? b.fix : (need.length && role && role !== 'owner'
          ? { do: 'perm:' + need[0] + ':' + role, doLabel: 'ให้สิทธิ์ ' + need[0] + ' กับระดับ ' + roleName(role), doNote: 'ทุกบัญชีระดับ ' + roleName(role) + ' จะเห็นเมนู ' + m.label + ' (มีผลตอนเข้าสู่ระบบครั้งถัดไป)' } : null));
    });
    return out;
  }

  /* รวมสิ่งที่ใช้ไม่ได้ตาม "ต้นเหตุ" — ไม่มีบัญชี 1 อย่าง ทำให้ใช้ไม่ได้ 20 อย่าง
   * ถ้าแยกเป็นใบละอย่างจะยาวจนอ่านไม่ไหว และมองไม่เห็นว่าแก้จุดเดียวจบ */
  function groupByCause(list) {
    const g = new Map();
    list.forEach(x => {
      const k = x.why + '|' + (x.do || '');
      if (!g.has(k)) g.set(k, { why: x.why, do: x.do, doLabel: x.doLabel, doNote: x.doNote, names: [] });
      g.get(k).names.push(x.name);
    });
    return [...g.values()].sort((a, b) => b.names.length - a.names.length).map(c => {
      const show = c.names.slice(0, 8).join(' · ') + (c.names.length > 8 ? ' และอีก ' + (c.names.length - 8) : '');
      return fixCard({ status: 'miss', fix: 'ทำให้ใช้ไม่ได้ ' + c.names.length + ' อย่าง: ' + show, do: c.do, doLabel: c.doLabel, doNote: c.doNote }, c.why);
    }).join('');
  }

  function fixCard(s, head) {
    return '<div class="wb-fix' + (s.status === 'warn' ? ' warn' : '') + '"><b>' + esc2(head) + '</b>'
      + (s.fix ? '<p>' + esc2(s.fix) + '</p>' : '')
      + (s.do && s.doNote ? '<p class="wb-pre">สิ่งที่จะเกิดขึ้น: ' + esc2(s.doNote) + '</p>' : '')
      + '<div class="wb-act">'
      + (s.do && canFix() ? '<button class="btn sm primary" data-a="wbDo:' + esc2(s.do) + '">' + esc2(s.doLabel || 'ซ่อมให้') + '</button>' : '')
      + (s.href ? '<a class="btn sm" href="' + esc2(s.href) + '">ไปหน้าที่แก้ได้</a>' : '')
      + (!s.do ? '<span class="wb-manual">ระบบทำแทนไม่ได้ ต้องให้คนทำ</span>' : '')
      + '</div></div>';
  }

  /* แผงด้านขวา: ตอบคำถามก่อน (ใช้อะไรได้ / อะไรยังใช้ไม่ได้) แผนผังเก็บไว้ท้ายสุด */
  function panel() {
    if (!WB.id) return '<p class="note">เลือกรายการทางซ้าย</p>';
    const name = title(WB.kind, WB.id), sp = spokes(WB.kind, WB.id), bad = sp.filter(x => x.status !== 'ok');
    const person = WB.kind === 'emp' || WB.kind === 'user';
    const F = person ? features(WB.kind, WB.id) : [], okF = F.filter(x => x.ok), noF = F.filter(x => !x.ok);
    return '<div class="wb-head"><h3>' + esc2(name) + '</h3>'
      + (person ? '<p>ใช้งานได้ <b class="g">' + okF.length + '</b> อย่าง · ยังใช้ไม่ได้ <b class="r">' + noF.length + '</b> อย่าง</p>'
        : '<p>เชื่อมครบ <b class="g">' + (sp.length - bad.length) + '</b> · ยังไม่เชื่อม <b class="r">' + bad.length + '</b></p>') + '</div>'
      + (person ? '<h4 class="wb-h4">ตอนนี้ใช้งานได้</h4>'
        + (okF.length ? '<div class="wb-chips">' + okF.map(x => '<span class="wb-chip">' + esc2(x.name) + '</span>').join('') + '</div>' : '<div class="note">ยังใช้อะไรไม่ได้เลย</div>')
        + '<h4 class="wb-h4">ยังใช้ไม่ได้ · แก้ที่ต้นเหตุ</h4>'
        + (noF.length ? groupByCause(noF) : '<div class="note" style="background:#e8f7ef;color:#17673f">ใช้ได้ครบทุกอย่างแล้ว</div>')
        : '<h4 class="wb-h4">เชื่อมอยู่กับ</h4>'
        + (sp.length - bad.length ? '<div class="wb-chips">' + sp.filter(x => x.status === 'ok').map(x => '<span class="wb-chip">' + esc2(x.label) + ': ' + esc2(x.note) + '</span>').join('') + '</div>' : '<div class="note">ยังไม่เชื่อมกับอะไรเลย</div>')
        + (bad.length ? '<h4 class="wb-h4">ยังไม่เชื่อม</h4>' + bad.map(x => fixCard(x, x.label + ' — ' + x.note)).join('') : '<div class="note" style="background:#e8f7ef;color:#17673f">เชื่อมครบแล้ว</div>'))
      + (person ? '<details class="wb-more"><summary>รายละเอียดการเชื่อมต่อ (' + sp.length + ' เส้น · ยังไม่เชื่อม ' + bad.length + ')</summary>'
        + (bad.length ? bad.map(x => fixCard(x, x.label + ' — ' + x.note)).join('') : '<div class="note" style="background:#e8f7ef;color:#17673f">ทุกเส้นเชื่อมครบแล้ว</div>') + '</details>' : '')
      + '<details class="wb-more"><summary>ดูเป็นแผนผังใยแมงมุม</summary><div class="wb-canvas">' + web(WB.kind, WB.id) + '</div></details>';
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
    + '.wb-pre{background:#eef4f0;border-radius:8px;padding:7px 9px;font-size:11.5px;color:#2f4a3c}'
    + '.wb-act{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-top:6px}.wb-manual{font-size:11px;color:#8a9790}'
    + '.wb-fix.warn{border-left-color:#d28a20;background:#fffaf1}.wb-fix b{font-size:13px}.wb-fix p{margin:4px 0;font-size:12px;color:#4a5b52;line-height:1.6}'
    + '.wb-head h3{margin:0;font:700 17px Prompt;color:#174c35}.wb-head p{margin:3px 0 10px;font-size:12.5px;color:var(--muted)}'
    + '.wb-head b.g{color:#17673f}.wb-head b.r{color:#b42318}'
    + '.wb-h4{margin:14px 0 6px;font:700 13px Prompt;color:#174c35}'
    + '.wb-chips{display:flex;gap:6px;flex-wrap:wrap}'
    + '.wb-chip{display:inline-flex;align-items:center;gap:5px;padding:6px 11px;border-radius:999px;background:#e8f5ed;border:1px solid #bcdcc8;font-size:12.5px;color:#17673f}'
    + '.wb-chip::before{content:"\\2713";font-weight:700}'
    + '.wb-more{margin-top:14px;border:1px solid var(--line);border-radius:12px;background:#fff;padding:8px 12px}'
    + '.wb-more>summary{cursor:pointer;font:700 13px Prompt;color:#174c35;padding:4px 0}'
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
      + '<p class="note">กดชื่อพนักงาน บัญชี ตำแหน่ง เมนู หรือสาขา แล้วดูว่าสิ่งนั้นเชื่อมกับอะไรบ้าง · เส้นประแดง = ยังไม่เชื่อม กดที่กล่องเพื่อดูว่าต้องไปแก้ที่ไหน'
      + (S.me && S.me.role === 'owner' ? ' · ส่วนใยของ<b>ไฟล์โปรแกรม</b> (ไว้กันโค้ดพังก่อนขึ้นระบบ) อยู่ที่ <a href="owner.html#links">แอป Owner › ใยแมงมุมโค้ด</a>' : '') + '</p>'
      + (rows.length ? '<div class="wb-fix"><b>ทั้งระบบมีจุดที่ยังไม่เชื่อม ' + rows.length + ' จุด · ระบบซ่อมให้ได้เอง ' + rows.filter(r => r.s.do).length + ' จุด</b><p>'
        + rows.slice(0, 6).map(r => esc2(r.who) + ': ' + esc2(r.s.label)).join(' · ') + (rows.length > 6 ? ' และอีก ' + (rows.length - 6) + ' จุด' : '') + '</p></div>'
        : '<div class="note" style="background:#e8f7ef;color:#17673f">ทุกจุดที่ตรวจได้เชื่อมกันครบแล้ว</div>')
      + '<div class="wb-tabs">' + KINDS.map(k => '<button class="wb-tab' + (WB.kind === k[0] ? ' on' : '') + '" data-a="wbKind:' + k[0] + '">' + k[1] + '</button>').join('') + '</div>'
      + (needPos ? '<p class="note">ยังไม่ได้โหลดทะเบียนตำแหน่ง — เปิด HR › Positions หนึ่งครั้งแล้วกลับมา จะเห็นเส้นตำแหน่งครบ</p>' : '')
      + '<div class="wb-grid"><div><div class="wb-top"><input class="field" id="wb-q" placeholder="ค้นหา" value="' + esc2(WB.q) + '"></div>'
      + '<div class="wb-list">' + (list.length ? list.map(x => '<button class="wb-item' + (x.id === WB.id ? ' on' : '') + '" data-a="wbPick:' + esc2(x.id) + '"><i class="' + x.st + '"></i><span>' + esc2(x.label) + (x.sub ? ' <span class="muted">· ' + esc2(x.sub) + '</span>' : '') + '</span>' + (x.n ? '<small>ค้าง ' + x.n + '</small>' : '') + '</button>').join('') : '<p class="note">ไม่พบรายการ</p>') + '</div></div>'
      + '<div>' + panel()
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
      wbDo: (code, b) => armed(b, () => runFix(code, b), 'แตะอีกครั้งเพื่อยืนยัน'),
      wbSpoke: i => { const s = spokes(WB.kind, WB.id)[Number(i)]; if (s && s.to) { WB.kind = s.to.kind; WB.id = s.to.id; App.render(); } }
    }
  });

  /* ใส่เมนูเข้ากลุ่ม System — ถ้าไม่ทำตรงนี้ โมดูลจะมีอยู่แต่ไม่โผล่ในเมนูเลย
   * (js/app.js ไล่คีย์ไว้ใน GROUPS ตายตัว แล้ว NAV_ORDER คำนวณครั้งเดียวตอนโหลด) */
  if (typeof GROUPS !== 'undefined') {
    const g = GROUPS.find(x => x[0] === 'System') || GROUPS[GROUPS.length - 1];
    if (g && !g[1].includes('web')) {
      g[1].push('web');
      if (typeof NAV_ORDER !== 'undefined') NAV_ORDER.splice(0, NAV_ORDER.length, ...GROUPS.flatMap(x => x[1]));
    }
  }


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
