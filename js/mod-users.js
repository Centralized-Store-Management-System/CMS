/* User Management: Owner (และ Admin ที่ได้รับสิทธิ์) สร้างชื่อผู้ใช้ให้ทุกคน ขึ้นต้นตาม Role เช่น mgr_somchaij, staff_somchaij
 * Audit log จึงบอกได้ทันทีว่าใครทำ และเป็น Role อะไร
 * Owner ไม่ตั้ง PIN ให้ใคร: ระบบออกรหัสเปิดใช้งาน 6 หลัก (ครั้งเดียว 7 วัน) เจ้าตัวใช้รหัสนี้ตั้ง PIN 6 หลักของตัวเอง
 * ลืม PIN: กด "รีเซ็ตรหัส" ได้รหัสเปิดใช้งานใหม่ */
const UPREFIX = { owner: 'owner_', admin: 'admin_', hr: 'hr_', manager: 'mgr_', staff: 'staff_' };
const setupExpired = u => u.pending && u.setupExpires && new Date(u.setupExpires) < new Date();
const empHasUser = id => userRows().some(u => u.empId === id);
const fmtDT = s => { const d = new Date(s); return isNaN(d) ? String(s || '') : d.toLocaleString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); };
const USER_ROLES = () => [...(S.me.role === 'owner' ? [['owner', 'Owner — ทุกระบบ ทุกสาขา']] : []), ['admin', 'Admin — ดูแลระบบ ผู้ใช้ แก้ปัญหา'], ['hr', 'HR — บุคคล เงินเดือน อนุมัติเวลา'], ['manager', 'Manager — บริหารสาขา'], ['staff', 'Staff — พนักงาน']];
const LINE_EV_OPTS = [['approvals', 'รออนุมัติ'], ['clockEx', 'ลงเวลาผิดปกติ'], ['clock', 'ลงเวลาทุกครั้ง'], ['daily', 'สรุปรายวัน']];
const userRows = () => S.t.users || [];
const lastSeen = u => { const l = S.t.log.filter(x => x.code === u.username).slice(-1)[0]; return l ? l.at : ''; };
function permOptsFor() {
  const ownerOnly = new Set((S.permList || []).filter(p => p[2]).map(p => p[0]));
  return (S.permList || []).filter(p => !ownerOnly.has(p[0]) && (S.me.role === 'owner' || (S.me.perms || []).includes(p[0]))).map(p => [p[0], p[1]]);
}
const F_USER = (isNew, role) => [
  { k: 'uname', label: 'ชื่อผู้ใช้ (Username)', half: 1, req: 1, pre: UPREFIX[role] || '', ph: 'เช่น somchaij', help: 'คำนำหน้าเปลี่ยนตาม Role ให้เอง พิมพ์แค่ชื่อต่อท้าย (a-z 0-9 . _ -)' + (isNew ? '' : ' ประวัติเดิมใน log ยังเป็นชื่อเก่า') },
  { k: 'name', label: 'ชื่อที่แสดง', half: 1, req: 1 },
  { k: 'role', label: 'Role', half: 1, type: 'select', options: USER_ROLES() },
  { k: 'status', label: 'สถานะ', half: 1, type: 'select', options: [['active', 'Active ใช้งานได้'], ['disabled', 'Disabled ปิดใช้งาน']] },
  ...(typeof AUTH_FIELDS === 'function' ? AUTH_FIELDS(isNew) : []),   // วิธีเข้าระบบ (auth-web.js)
  { k: 'empId', label: 'ผูกกับพนักงาน (ถ้ามี)', half: 1, type: 'select', options: [['', 'ไม่ผูก'], ...S.t.employees.filter(e => e.status !== 'ลาออก').map(e => [e.id, `${shortName(e)} (${e.code})`])], help: 'ผูกแล้วลงเวลาด้วย PIN ที่เจ้าตัวตั้ง และ log ขึ้นชื่อผู้ใช้นี้' },
  ...(S.t.branches.length > 1 ? [
    { k: 'branch', label: 'สาขาหลัก', half: 1, type: 'select', options: [['', 'ไม่ระบุ'], ...branchOpts(S.t.branches)] },
    { k: 'branchAccess', label: 'ดูแลสาขา', type: 'multi', options: [...(allBranch() ? [['*', 'ทุกสาขา']] : []), ...myBranches().map(b => [b.code, b.name])], help: 'Owner และ Admin เห็นทุกสาขาเสมอ HR ที่ไม่เลือก = ทุกสาขา' }
  ] : [{ k: 'branch', label: 'สาขาหลัก', half: 1, type: 'select', options: [['', 'ไม่ระบุ'], ...branchOpts(S.t.branches)] }]),
  { k: 'perms', label: 'สิทธิ์เฉพาะคน (ไม่เลือก = ใช้ตาม Role ที่ตั้งใน Settings > Permissions)', type: 'multi', options: permOptsFor() },
  { k: 'lineEvents', label: 'แจ้งเตือน LINE ที่รับ', type: 'multi', options: LINE_EV_OPTS },
  { k: 'lineUserId', label: 'LINE ID (ถ้ารู้) ', help: 'ปกติไม่ต้องใส่ ใช้ปุ่ม "รหัสผูก LINE" แล้วให้เจ้าตัวส่งรหัสหา LINE OA' },
  { k: 'note', label: 'บันทึก', type: 'textarea', rows: 2 }
];
function userRow(u) {
  const ch = [`<span class="chip">${esc(ROLE_NAME[u.role] || u.role)}</span>`];
  if (u.status === 'disabled') ch.push('<span class="chip bad">Disabled</span>');
  else if (setupExpired(u)) ch.push('<span class="chip bad">รหัสเปิดใช้งานหมดอายุ</span>');
  else if (u.pending) ch.push('<span class="chip warn">รอเจ้าตัวตั้ง PIN</span>');
  if (u.master) ch.push('<span class="chip ok">บัญชีหลัก</span>');
  if (u.lineUserId) ch.push('<span class="chip ok">LINE</span>');
  if (typeof authChip === 'function') ch.push(authChip(u));
  if (u.perms) ch.push('<span class="chip warn">สิทธิ์เฉพาะคน</span>');
  if (!u.master && u.role !== 'owner' && u.role !== 'admin' && S.t.branches.length > 1) ch.push(`<span class="chip br">${u.branchAccess === '*' || (u.role === 'hr' && !u.branchAccess) ? 'ทุกสาขา' : esc([u.branch, ...String(u.branchAccess || '').split(',').filter(Boolean)].filter(Boolean).join('+') || 'ไม่ระบุสาขา')}</span>`);
  const emp = u.empId && empById(u.empId);
  const seen = u.lastLogin || lastSeen(u);
  return `<button class="row" data-a="user:${esc(u.id)}">${avatar({ nickname: u.name })}<span class="main"><span class="t"><b>${esc(u.username)}</b> <span class="muted">${esc(u.name)}</span></span><span class="s">${emp ? 'ผูกกับ ' + esc(shortName(emp)) + ', ' : ''}${seen ? 'ใช้งานล่าสุด ' + esc(seen) : 'ยังไม่เคยเข้าระบบ'}</span><span class="chips">${ch.join('')}</span></span></button>`;
}
function pUsers() {
  const list = userRows().slice().sort((a, b) => (b.master ? 1 : 0) - (a.master ? 1 : 0) || (a.status === 'disabled') - (b.status === 'disabled') || String(a.name).localeCompare(String(b.name)));
  const emps = S.t.employees.filter(e => e.status !== 'ลาออก' && !empHasUser(e.id) && (allBranch() || myBranches().some(b => b.code === e.branch)));
  return `<div class="kpis"><div class="kpi"><b>${list.filter(u => u.status !== 'disabled').length}</b><span>บัญชีผู้ใช้ที่ใช้งาน</span></div><div class="kpi"><b>${list.filter(u => u.pending && u.status !== 'disabled').length}</b><span>รอเจ้าตัวตั้ง PIN</span></div><div class="kpi"><b>${list.filter(u => u.lineUserId).length}</b><span>ผูก LINE แล้ว</span></div><div class="kpi"><b>${emps.length}</b><span>พนักงานที่ยังไม่มีชื่อผู้ใช้</span></div></div>
  <div class="h2">User accounts<span class="spacer"></span><button class="btn primary" data-a="newUser">สร้างบัญชีผู้ใช้</button></div>
  <div class="group">${list.map(userRow).join('') || empty('ยังไม่มีบัญชีผู้ใช้')}</div>
  <p class="note">ขั้นตอน: 1) สร้างชื่อผู้ใช้ตาม Role เช่น <b>mgr_somchaij</b>, <b>staff_somchaij</b> 2) ระบบออกรหัสเปิดใช้งาน 6 หลัก ยื่นให้เจ้าตัว (หรือส่งเข้า LINE) 3) เจ้าตัวกด "เข้าใช้งานครั้งแรก" แล้วตั้ง PIN 6 หลักเอง Owner ไม่รู้ PIN ของใคร Audit log จึงยืนยันได้ว่าเจ้าของบัญชีทำเอง บัญชีที่มีประวัติแล้วลบไม่ได้ ให้เปลี่ยนเป็น Disabled</p>
  ${emps.length ? `<h3 class="h3">พนักงานที่ยังไม่มีชื่อผู้ใช้ <span class="muted">(ยังเข้าด้วยรหัสพนักงาน + PIN ที่ HR ตั้ง)</span></h3><div class="group">${emps.map(e => `<div class="row">${avatar(e)}<span class="main"><span class="t">${esc(shortName(e))} <span class="muted">${esc(e.code)}</span></span><span class="s">${esc(ROLE_NAME[e.role] || 'Staff')} · ${esc(branchName(e.branch))}</span></span><button class="btn sm" data-a="newUserFor:${esc(e.id)}">สร้างชื่อผู้ใช้</button></div>`).join('')}</div>` : ''}`;
}
function openUser(id, empId) {
  const e0 = empId && empById(empId), r0 = e0 && UPREFIX[e0.role] ? e0.role : 'staff';
  const u = id ? userRows().find(x => x.id === id) : e0 ? { role: r0, status: 'active', empId, name: shortName(e0), branch: e0.branch || oneBranch(), branchAccess: e0.branchAccess || '', lineEvents: r0 === 'staff' ? '' : 'approvals,clockEx' }
    : { role: 'manager', status: 'active', branch: oneBranch(), branchAccess: '', lineEvents: 'approvals,clockEx,daily' };
  if (!u) return;
  if (u.master) return openOwnerProfile(u);
  const canEdit = S.me.role === 'owner' || u.role !== 'owner';
  const pre0 = UPREFIX[u.role] || '', un0 = String(u.username || '');
  u.uname = un0; for (let ch = true; ch;) { ch = false; for (const p of Object.values(UPREFIX)) if (u.uname.toLowerCase().startsWith(p) && u.uname.length > p.length) { u.uname = u.uname.slice(p.length); ch = true; } }   // ตัดคำนำหน้าทุกแบบ (กัน staff_mgr_somchaij)
  const pinState = u.pending ? (setupExpired(u) ? 'รหัสเปิดใช้งานหมดอายุ กด "รีเซ็ตรหัส" เพื่อออกรหัสใหม่' : 'รอเจ้าตัวตั้ง PIN' + (u.setupExpires ? ' (รหัสเปิดใช้งานหมดอายุ ' + esc(fmtDT(u.setupExpires)) + ')' : '')) : 'เจ้าตัวตั้ง PIN แล้ว' + (u.pinSetAt ? ' เมื่อ ' + esc(u.pinSetAt) : '');
  openForm({
    title: id ? u.name : 'สร้างบัญชีผู้ใช้', fields: F_USER(!id, u.role), data: u, readOnly: !canEdit, live: userLive,
    sub: id ? `${esc(ROLE_NAME[u.role])}, ${pinState}${u.lastLogin ? ', เข้าระบบล่าสุด ' + esc(u.lastLogin) : ''}` : 'Owner ไม่ต้องตั้ง PIN: บันทึกแล้วระบบออกรหัสเปิดใช้งาน 6 หลัก ยื่นให้เจ้าตัวไปตั้ง PIN 6 หลักของตัวเอง',
    saveLabel: id ? 'บันทึก' : 'สร้าง และออกรหัสเปิดใช้งาน',
    extra: id && canEdit ? [
      ...(id !== S.me.uid ? [{ label: u.pending ? 'ออกรหัสเปิดใช้งานใหม่' : 'รีเซ็ตรหัส', fn: async (v, b) => {
        if (!b.dataset.armed) { b.dataset.armed = '1'; b.textContent = u.pending ? 'แตะอีกครั้งเพื่อออกรหัสใหม่' : 'แตะอีกครั้ง: PIN เดิมจะใช้ไม่ได้'; return; }
        const r = await busy(b, () => API.write({ op: 'resetUserPin', id }), '…');
        DB.local('users', { id, pending: true, hasPin: false, pinSetAt: '', setupExpires: new Date(Date.now() + r.days * 864e5).toISOString() });
        App.render(); showSetupCode(r, u);
      } }] : []),
      { label: 'รหัสผูก LINE', fn: async (v, b) => { const r = await busy(b, () => API.call('lineLinkCode', { t: S.token, ref: 'u:' + id }), '…'); showLinkCode(r, u.name); } },
      { label: 'ดู Audit log', fn: () => { closeSheet(); S.f.logUser = u.username; location.hash = 'admin/log'; } }] : [],
    onSave: async v => {
      ['pin', 'hasPin', 'lastLogin', 'pending', 'setupCode', 'setupExpires', 'pinSetAt'].forEach(k => delete v[k]);
      const pre = UPREFIX[v.role] || '', nm = String(v.uname || '').trim().toLowerCase().replace(/\s+/g, '');
      if (!nm) throw new Error('ใส่ชื่อต่อท้าย ' + pre);
      v.username = id && nm === String(u.uname).toLowerCase() && v.role === u.role ? un0.toLowerCase() : (nm.startsWith(pre) ? nm : pre + nm);
      delete v.uname;
      const r = await DB.upsert('users', v);
      if (r && r.setupCode) {
        const code = r.setupCode, row = userRows().find(x => x.id === r.id);
        if (row) delete row.setupCode;   // แสดงครั้งเดียว ไม่เก็บไว้ในหน้าเว็บ
        setTimeout(() => showSetupCode({ username: r.username, setupCode: code, days: 7 }, r), 0);
      }
    },
    onDelete: id && canEdit ? () => (typeof userPurgeDelete === 'function' ? userPurgeDelete(u) : DB.remove('users', id)) : null   // ลบถาวร (users-purge.js)
  });
}
/** เติมคำนำหน้าชื่อผู้ใช้ตาม Role อัตโนมัติ และดึงชื่อ/สาขาจากพนักงานที่ผูก */
function userLive(sh) {
  const q = k => sh.querySelector(`[data-k="${k}"]`), role = q('role'), pre = sh.querySelector('[data-pre="uname"]'), emp = q('empId');
  if (role && pre) pre.textContent = UPREFIX[role.value] || '';
  if (emp && emp.value && emp.dataset.last !== emp.value) {
    const first = emp.dataset.last === undefined; emp.dataset.last = emp.value;
    const e = empById(emp.value); if (!e || first) return;
    if (q('name') && !q('name').value) q('name').value = shortName(e);
    if (q('branch') && !q('branch').value) q('branch').value = e.branch || '';
  }
}
/** รหัสเปิดใช้งาน: แสดงครั้งเดียว ให้ Owner ยื่นหรือส่งให้เจ้าตัว */
function showSetupCode(r, u) {
  const url = location.href.split(/[?#]/)[0];
  const msg = `ชื่อผู้ใช้: ${r.username}\nรหัสเปิดใช้งาน: ${r.setupCode}\nเปิด ${url} กด "เข้าใช้งานครั้งแรก" แล้วตั้ง PIN 6 หลักของคุณเอง (ใช้ทั้งเข้าระบบและลงเวลา)\nรหัสใช้ได้ครั้งเดียว หมดอายุใน ${r.days || 7} วัน`;
  const sh = openSheet(`<h3>รหัสเปิดใช้งานของ ${esc(u.name || r.username)}</h3>
    <div class="setup-code"><span class="muted">ชื่อผู้ใช้</span><b>${esc(r.username)}</b><span class="muted">รหัสเปิดใช้งาน</span><b class="kcode big">${esc(r.setupCode)}</b></div>
    ${r.sentLine ? '<p class="status ok">ส่งรหัสเข้า LINE ของเจ้าตัวแล้ว</p>' : ''}
    <ol class="steps"><li>ยื่นชื่อผู้ใช้และรหัสนี้ให้เจ้าตัว (บอกต่อหน้า หรือส่งข้อความส่วนตัว)</li><li>เจ้าตัวเปิดระบบ กด <b>เข้าใช้งานครั้งแรก</b> ${u.empId ? 'หรือแตะชื่อที่หน้าลงเวลา ' : ''}แล้วตั้ง PIN 6 หลักของตัวเอง</li><li>เสร็จ ทุกการกระทำใน Audit log จะขึ้นชื่อ ${esc(r.username)}</li></ol>
    <p class="note">รหัสนี้แสดงครั้งเดียว ใช้ได้ครั้งเดียว หมดอายุใน ${r.days || 7} วัน ระบบไม่เก็บรหัสตัวจริงไว้ ถ้าหายให้กด "ออกรหัสเปิดใช้งานใหม่"</p>
    <div class="actions"><button class="btn" data-act="copy">คัดลอกข้อความ</button><span class="grow"></span><button class="btn primary" data-a="close">ปิด</button></div>`);
  sh.addEventListener('click', async e => {
    if (!e.target.closest('[data-act="copy"]')) return;
    try { await navigator.clipboard.writeText(msg); toast('คัดลอกแล้ว วางในแชตส่วนตัวได้เลย'); } catch (_) { showText('ข้อความสำหรับส่งให้ ' + r.username, msg, 'setup.txt'); }
  });
}
function showLinkCode(r, name) {
  openSheet(`<h3>ผูก LINE ให้ ${esc(name)}</h3><ol class="steps"><li>เพิ่มเพื่อน LINE OA ของร้าน</li><li>ส่งข้อความ <b class="kcode">link ${esc(r.code)}</b> ในแชตกับ LINE OA (หรือในกลุ่มที่มี LINE OA อยู่ ถ้าอยากให้แจ้งเตือนเข้ากลุ่ม)</li><li>LINE OA ตอบกลับว่าผูกแล้ว เสร็จ</li></ol><p class="note">รหัสใช้ได้ครั้งเดียว ภายใน ${r.minutes} นาที</p><div class="actions"><span class="grow"></span><button class="btn primary" data-a="close">ปิด</button></div>`);
}
function openOwnerProfile(u) {
  openForm({
    title: 'บัญชีหลัก owner', data: u, readOnly: S.me.role !== 'owner',
    sub: 'บัญชีสำหรับกู้ระบบ PIN ตั้งใน Apps Script (setOwnerPin) แนะนำให้ Owner สร้างบัญชีชื่อของตัวเองไว้ใช้ประจำ',
    fields: [{ k: 'name', label: 'ชื่อที่แสดงใน log', req: 1 }, ...(typeof AUTH_FIELDS === 'function' ? AUTH_FIELDS(false) : []), { k: 'lineEvents', label: 'แจ้งเตือน LINE ที่รับ', type: 'multi', options: LINE_EV_OPTS }, { k: 'lineUserId', label: 'LINE ID (ถ้ารู้)', help: 'ดูได้ที่ LINE Developers > Basic settings > Your user ID หรือใช้ปุ่มรหัสผูก LINE' }],
    extra: S.me.role === 'owner' ? [{ label: 'รหัสผูก LINE', fn: async (v, b) => { const r = await busy(b, () => API.call('lineLinkCode', { t: S.token, ref: 'owner' }), '…'); showLinkCode(r, 'owner'); } }] : [],
    onSave: async v => { const r = await API.write({ op: 'ownerProfile', row: { name: v.name, lineEvents: v.lineEvents, lineUserId: v.lineUserId, authMethod: v.authMethod, authReset: v.authReset } }); DB.local('users', r); }
  });
}

defMod({
  key: 'users', mod: 'set', noBranch: true, label: 'Users', icon: 'users', group: 'System', desc: 'สร้างบัญชีผู้ใช้ กำหนด Role สาขา สิทธิ์ และ LINE ของแต่ละคน',
  perm: ['users'],
  view: pUsers,
  summary: () => `${userRows().filter(u => u.status !== 'disabled').length} บัญชี, ผูก LINE ${userRows().filter(u => u.lineUserId).length}`,
  acts: { newUser: () => openUser(), newUserFor: id => openUser(null, id), user: id => openUser(id) }
});
