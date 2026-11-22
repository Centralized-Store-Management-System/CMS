/* ตำแหน่งงาน = แม่แบบสิทธิ์ (ต่อยอด mod-hr.js โดยไม่แก้ไฟล์เดิม)
 * - แต่ละตำแหน่งกำหนด: Role ของบัญชีผู้ใช้ + สิทธิ์เมนู + บทบาท Finance (เก็บที่ hr-position-api → it_position_permissions)
 * - HR เลือกตำแหน่งให้พนักงาน (HR › Employees) → Role พนักงาน / บัญชีผู้ใช้ที่ผูก / บทบาท Finance ปรับตามเอง
 *   แก้สิทธิ์ของตำแหน่ง → ทุกคนในตำแหน่งนั้นเปลี่ยนตาม · ระบบออเดอร์ (Line-Order) ซิงก์ต่อจากบัญชีผู้ใช้ภายใน 1 นาที (order-link)
 * - บัญชีผู้ใช้ปรับได้เฉพาะคนที่มีสิทธิ์ Users (Owner/Admin หรือ HR ที่ Owner เปิดสิทธิ์ให้) — ถ้ายังไม่มีสิทธิ์ ระบบจะปรับให้เองเมื่อ Owner/Admin เปิดระบบ
 * - HR ให้สิทธิ์ได้ไม่เกินสิทธิ์ที่ตัวเองมี (เซิร์ฟเวอร์ตรวจซ้ำ) · Owner/บัญชีหลัก ไม่ถูกปรับ · ชื่อผู้ใช้เดิมไม่เปลี่ยน (เข้าระบบได้เหมือนเดิม) */
(function () {
  if (typeof defMod !== 'function' || typeof hrLoadPositions !== 'function' || typeof S !== 'object') return;
  const UUIDRE = /^[0-9a-f-]{36}$/i;
  let PERM = [];
  const load0 = hrLoadPositions;
  hrLoadPositions = async function () {
    const p = await load0.apply(this, arguments);
    PERM = Array.isArray(p.permissions) ? p.permissions : [];
    schedule();
    return p;
  };

  // ---------- แม่แบบ ----------
  const tmpl = pid => {
    const rows = PERM.filter(r => r.position_id === pid && r.status === 'active');
    const cms = rows.find(r => r.application_key === 'cms'), fin = rows.find(r => r.application_key === 'finance');
    const c = (cms && cms.permission_codes) || [];
    const role = (c.find(x => x.startsWith('role:')) || '').slice(5), perms = c.filter(x => !x.startsWith('role:'));
    // ตั้งสิทธิ์จริงเมื่อมี Role หรือสิทธิ์เมนู (ตำแหน่งที่ยังว่างไม่ไปล้างสิทธิ์เฉพาะคนของใคร)
    return { set: !!cms && !!(role || perms.length), role, perms, finance: (((fin && fin.permission_codes) || []).find(x => x.startsWith('role:')) || '').slice(5) };
  };
  const posOfEmp = e => e ? HR_POSITIONS.find(p => (e.positionId && p.id === e.positionId) || (e.positionCode && p.position_code === e.positionCode) || (!e.positionId && !e.positionCode && e.position && p.name_th === e.position)) : null;
  const EMP_ROLES = ['staff', 'manager', 'hr', 'verifier'];   // Role ที่ตำแหน่งตั้งให้พนักงานได้ (ไม่รวม owner/admin)
  const ROLE_TH = { admin: 'Admin', hr: 'HR', manager: 'Manager', staff: 'Staff', verifier: 'Final Verifier' };
  const FIN_TH = { approver: 'ผู้อนุมัติ', manager: 'Manager', staff: 'Staff', verifier: 'ผู้ตรวจสุดท้าย', accountant: 'บัญชี', viewer: 'ดูอย่างเดียว' };
  const permName = k => ((S.permList || []).find(p => p[0] === k) || [k, k])[1];
  const sortJoin = a => a.slice().sort().join(',');
  const ready = () => HR_POSITION_LOADED && !HR_POSITION_ERROR && PERM.length > 0;
  const fixable = u => u && u.empId && !u.master && u.role !== 'owner' && u.status !== 'disabled';

  function wantEmp(e) {
    if (!e || e.status === 'ลาออก' || e.role === 'owner') return null;
    const p = posOfEmp(e), t = p && tmpl(p.id);
    return t && t.role && EMP_ROLES.includes(t.role) && e.role !== t.role ? t.role : null;
  }
  function wantUser(u) {
    if (!fixable(u)) return null;
    const p = posOfEmp(empById(u.empId)), t = p && tmpl(p.id);
    if (!t || !t.set) return null;
    const role = t.role || u.role, perms = t.perms.join(',');
    return u.role !== role || sortJoin(String(u.perms || '').split(',').filter(Boolean)) !== sortJoin(t.perms) ? { role, perms, pos: p } : null;
  }
  function diffs() {
    return {
      emps: (S.t.employees || []).filter(wantEmp),
      users: (S.t.users || []).filter(wantUser)
    };
  }

  // ---------- ปรับตามตำแหน่งตอนบันทึก (พนักงาน / บัญชีผู้ใช้) ----------
  const um0 = DB.upsertMany;
  DB.upsertMany = async function (table, rows) {
    if (ready() && Array.isArray(rows)) {
      if (table === 'employees') rows.forEach(v => { const r = wantEmp(v); if (r) v.role = r; });
      if (table === 'users') rows.forEach(v => {
        const w = wantUser(v); if (!w) return;
        const isNew = !v.id || !(S.t.users || []).some(x => x.id === v.id);
        if (isNew && w.role !== v.role && typeof UPREFIX === 'object') {   // บัญชีใหม่: คำนำหน้าชื่อผู้ใช้ตาม Role ของตำแหน่ง
          let n = String(v.username || ''); for (const pre of Object.values(UPREFIX)) if (n.startsWith(pre)) { n = n.slice(pre.length); break; }
          v.username = (UPREFIX[w.role] || '') + n;
        }
        v.role = w.role; v.perms = w.perms;
      });
    }
    const r = await um0.apply(this, arguments);
    if (table === 'employees' || table === 'users') schedule();
    return r;
  };

  // ---------- ซิงก์เบื้องหลัง: พนักงาน / บัญชีผู้ใช้ / Finance ----------
  let timer = 0, running = false, finSig = '', lastErr = '';
  function schedule() { clearTimeout(timer); timer = setTimeout(run, 900); }
  const finItems = () => (S.t.users || []).filter(u => u.empId && !u.master && u.role !== 'owner').map(u => { const p = posOfEmp(empById(u.empId)); return { uid: u.id, position_id: p && UUIDRE.test(p.id) ? p.id : null, name: u.name || '' }; });
  async function run() {
    if (running || !S.me || S.demo || !ready()) return;
    running = true;
    let n = 0;
    try {
      const d = diffs();
      if (d.emps.length && can('hr')) {
        const rows = d.emps.map(e => { const v = { ...e, role: wantEmp(e) }; ['pin', 'hasPin', 'account', 'pinSet'].forEach(k => delete v[k]); return v; });
        for (let i = 0; i < rows.length; i += 10) await um0.call(DB, 'employees', rows.slice(i, i + 10));
        n += rows.length;
      }
      if (d.users.length && can('users')) {
        const rows = d.users.map(u => { const w = wantUser(u), v = { ...u, role: w.role, perms: w.perms }; ['pin', 'hasPin', 'lastLogin', 'pending', 'setupCode', 'setupExpires', 'pinSetAt'].forEach(k => delete v[k]); return v; });
        for (let i = 0; i < rows.length; i += 10) await um0.call(DB, 'users', rows.slice(i, i + 10));
        n += rows.length;
      }
      if ((S.t.users || []).length && (can('hr') || can('users'))) {
        const items = finItems();
        const sig = JSON.stringify(items) + JSON.stringify(PERM.map(r => [r.position_id, r.application_key, r.version]));
        if (items.length && sig !== finSig) {
          const r = await hrPositionRequest('POST', { action: 'sync-finance', items });
          finSig = sig; n += (r.granted || 0) + (r.updated || 0) + (r.revoked || 0);
        }
      }
      lastErr = '';
      if (n) { toast(`ปรับสิทธิ์ตามตำแหน่งแล้ว ${n} รายการ`); if (typeof App === 'object') App.render(); }
    } catch (e) {
      lastErr = e.message || 'ซิงก์สิทธิ์ตามตำแหน่งไม่สำเร็จ';
      console.warn('hr-position-perms', lastErr);
    } finally { running = false; }
  }
  // โหลดตำแหน่งเบื้องหลัง (เฉพาะคนที่ดูแล HR / ผู้ใช้) เพื่อให้ซิงก์ได้แม้ไม่ได้เปิดหน้า HR
  function ensure() {
    if (!S.me || S.demo || !(can('hr') || can('users'))) return;
    if (!HR_POSITION_LOADED && !HR_POSITION_LOADING) {
      HR_POSITION_LOADING = true;
      hrLoadPositions().catch(() => {}).finally(() => { HR_POSITION_LOADED = true; HR_POSITION_LOADING = false; if ((location.hash || '').startsWith('#hr')) App.render(); });
    } else schedule();
  }
  if (typeof App === 'object' && typeof App.render === 'function') {
    const r0 = App.render;
    let ensureT = 0;
    App.render = function () { const x = r0.apply(this, arguments); clearTimeout(ensureT); ensureT = setTimeout(ensure, 300); return x; };
  }

  // ---------- หน้า ตำแหน่ง (HR › Positions) ----------
  const isUuid = id => UUIDRE.test(String(id || ''));
  const members = p => (S.t.employees || []).filter(e => e.status !== 'ลาออก' && posOfEmp(e) === p);
  function chips(p) {
    const t = tmpl(p.id), c = [];
    c.push(`<span class="chip ${p.status === 'active' ? 'ok' : 'warn'}">${p.status === 'active' ? 'ใช้งาน' : 'ปิดใช้งาน'}</span>`);
    if (!t.set) c.push('<span class="chip warn">ยังไม่ตั้งสิทธิ์</span>');
    else {
      c.push(`<span class="chip mc">Role: ${esc(ROLE_TH[t.role] || 'ตามเดิม')}</span>`);
      c.push(`<span class="chip">${t.perms.length ? 'สิทธิ์ ' + t.perms.length + ' รายการ' : 'สิทธิ์ตาม Role'}</span>`);
      if (t.finance) c.push(`<span class="chip">Finance: ${esc(FIN_TH[t.finance] || t.finance)}</span>`);
    }
    c.push(`<span class="chip br">${members(p).length} คน</span>`);
    return c.join('');
  }
  function view() {
    if (!HR_POSITION_LOADED) { ensure(); return '<p class="loading">กำลังโหลดตำแหน่งงาน…</p>'; }
    const own = S.me.role === 'owner' || S.me.role === 'admin';
    const rows = HR_POSITIONS.slice().sort((a, b) => (a.status !== 'active') - (b.status !== 'active') || String(a.name_th).localeCompare(String(b.name_th), 'th'));
    const d = ready() ? diffs() : { emps: [], users: [] };
    let sync = '';
    if (HR_POSITION_ERROR) sync = `<div class="group pad"><p class="status bad" style="margin:0">เชื่อมต่อข้อมูลตำแหน่งไม่สำเร็จ: ${esc(HR_POSITION_ERROR)} — แสดงรายการสำรองเพื่อดูเท่านั้น <button class="btn sm" data-a="reloadPositions">ลองใหม่</button></p></div>`;
    else if (lastErr) sync = `<div class="group pad"><p class="status bad" style="margin:0">ปรับสิทธิ์ตามตำแหน่งไม่สำเร็จ: ${esc(lastErr)} <button class="btn sm" data-a="posSyncNow">ลองใหม่</button></p></div>`;
    else if (d.users.length && !can('users')) sync = `<div class="group pad"><p class="status warn" style="margin:0">บัญชีผู้ใช้ ${d.users.length} คนรอปรับสิทธิ์ตามตำแหน่ง — ระบบจะปรับให้เองเมื่อ Owner/Admin เปิดระบบ (หรือให้ Owner เปิดสิทธิ์ "Users" ให้ HR ที่ Settings › Permissions)</p></div>`;
    else if (d.emps.length || d.users.length) sync = `<div class="group pad"><p class="status warn" style="margin:0">กำลังปรับสิทธิ์ตามตำแหน่ง ${d.emps.length + d.users.length} รายการ… <button class="btn sm" data-a="posSyncNow">ปรับตอนนี้</button></p></div>`;
    else if (ready() && !can('users')) sync = '<p class="note">Role ของพนักงานปรับตามตำแหน่งทันที · สิทธิ์เมนูของบัญชีผู้ใช้ ระบบปรับให้เมื่อ Owner/Admin เปิดระบบ (หรือให้ Owner เปิดสิทธิ์ "Users" ให้ HR)</p>';
    else if (ready()) sync = '<p class="chips"><span class="chip ok">Role และสิทธิ์ของทุกคนตรงตามตำแหน่งแล้ว</span></p>';
    return `<div class="h2">ตำแหน่งงาน ${rows.length} ตำแหน่ง<span class="spacer"></span>${own ? `<button class="btn" data-a="newDepartment"${HR_POSITION_ERROR ? ' disabled' : ''}>+ แผนก</button>` : ''}<button class="btn primary" data-a="newPosition"${HR_POSITION_ERROR ? ' disabled' : ''}>+ เพิ่มตำแหน่ง</button></div>
      <p class="note">ตำแหน่ง = แม่แบบสิทธิ์: ตั้ง Role, สิทธิ์เมนู และบทบาท Finance ไว้ที่ตำแหน่ง แล้วเลือกตำแหน่งให้พนักงานที่ Employees — บัญชีผู้ใช้ที่ผูกกับพนักงานได้สิทธิ์ตามนั้นเอง แก้สิทธิ์ของตำแหน่งแล้วทุกคนในตำแหน่งเปลี่ยนตาม ระบบออเดอร์ซิงก์ต่อภายใน 1 นาที</p>
      ${sync}
      <div class="group">${rows.map(p => `<button class="row" data-a="position:${esc(p.id)}"><span class="main"><span class="t">${esc(p.name_th)}</span><span class="s">${esc(p.position_code || '')}${p.department ? ' · ' + esc(p.department) : ''}</span><span class="chips">${chips(p)}</span></span></button>`).join('') || empty('ยังไม่มีตำแหน่ง')}</div>`;
  }
  const m = typeof modBy === 'function' && modBy('hr');
  const sub = m && (m.subs || []).find(s => s.key === 'positions');
  if (sub) sub.view = view;
  if (m && m.acts) m.acts.posSyncNow = async () => { finSig = ''; await run(); App.render(); };

  // ฟอร์มตำแหน่ง + สิทธิ์ของตำแหน่ง (แทน openPosition เดิม)
  openPosition = function (id) {
    if (HR_POSITION_ERROR) throw new Error('ยังเชื่อมต่อข้อมูลตำแหน่งไม่ได้ จึงปิดการแก้ไขชั่วคราวเพื่อกันข้อมูลไม่ตรงกัน');
    const p = id ? HR_POSITIONS.find(x => x.id === id) : { status: 'active' };
    if (id && !p) return;
    const t = id ? tmpl(id) : { set: false, role: 'staff', perms: [], finance: '' };
    const own = S.me.role === 'owner', adm = S.me.role === 'admin', mine = S.me.perms || [];
    const permOpts = (S.permList || []).filter(x => !x[2] && (own || adm || mine.includes(x[0]) || t.perms.includes(x[0]))).map(x => [x[0], x[1]]);
    const roleOpts = [['', 'ไม่กำหนด (คง Role เดิมของแต่ละคน)'], ['staff', 'Staff — พนักงาน'], ['manager', 'Manager — บริหารสาขา'], ['hr', 'HR — บุคคล เงินเดือน'], ['verifier', 'Final Verifier — ผู้ตรวจสอบขั้นสุดท้าย (เห็นทุกสาขา)'], ...(own || adm || t.role === 'admin' ? [['admin', 'Admin — ดูแลระบบ ผู้ใช้']] : [])];
    const high = ['approver', 'verifier', 'accountant'];
    const finOpts = [['', 'ไม่ใช้ Finance'], ['staff', 'Staff — สร้างคำขอเบิก'], ['manager', 'Manager — สาขาที่ดูแล'], ['viewer', 'ดูอย่างเดียว'], ...high.filter(r => own || t.finance === r).map(r => [r, FIN_TH[r] + (own ? '' : ' (Owner ตั้งไว้)')])];
    const ms = id ? members(p) : [];
    openForm({
      title: id ? 'แก้ไขตำแหน่ง ' + p.name_th : 'เพิ่มตำแหน่ง',
      fields: [
        { k: 'position_code', label: 'รหัสตำแหน่ง', half: 1, req: 1, help: 'อังกฤษ ตัวเลข _ หรือ - เช่น SHIFT_LEAD' },
        { k: 'name_th', label: 'ชื่อตำแหน่ง', half: 1, req: 1 },
        { k: 'name_en', label: 'ชื่อตำแหน่ง (อังกฤษ)', half: 1 },
        { k: 'department_id', label: 'แผนก', half: 1, type: 'select', options: [['', 'ไม่ระบุแผนก'], ...HR_DEPARTMENTS.map(x => [x.id, x.name])] },
        { k: 'level', label: 'ระดับ', half: 1 },
        { k: 'status', label: 'สถานะ', half: 1, type: 'select', options: [['active', 'ใช้งาน'], ['inactive', 'ปิดใช้งาน']] },
        { k: 'description', label: 'หน้าที่ของตำแหน่ง', type: 'textarea', rows: 2 },
        { k: 't_role', label: 'Role ของบัญชีผู้ใช้ในตำแหน่งนี้', half: 1, type: 'select', options: roleOpts },
        { k: 't_fin', label: 'บทบาทใน Finance', half: 1, type: 'select', options: finOpts, help: own ? '' : 'ผู้อนุมัติ / ผู้ตรวจสุดท้าย / บัญชี ให้ Owner เป็นผู้กำหนด' },
        { k: 't_perms', label: 'สิทธิ์เมนู (ไม่เลือก = ตามค่าเริ่มต้นของ Role ที่ Settings › Permissions)', type: 'multi', options: permOpts }
      ],
      data: { ...p, t_role: t.role, t_fin: t.finance, t_perms: t.perms.join(',') },
      extraHTML: `${own || adm ? '' : '<p class="note">ให้สิทธิ์ได้เฉพาะสิทธิ์ที่คุณมีอยู่</p>'}<p class="note">บันทึกแล้ว Role / สิทธิ์ / บทบาท Finance ของทุกคนในตำแหน่งนี้ปรับตามอัตโนมัติ (บัญชี Owner และชื่อผู้ใช้เดิมไม่เปลี่ยน)</p>
        ${id ? `<h3 class="h3">พนักงานในตำแหน่งนี้ (${ms.length})</h3><div class="group">${ms.map(e => `<div class="row static">${typeof avatar === 'function' ? avatar(e) : ''}<span class="main"><span class="t">${esc(fullName(e))}</span><span class="s">${esc(e.code || '')} · ${esc(ROLE_NAME[e.role] || 'Staff')}${multiBranch() ? ' · ' + esc(branchName(e.branch)) : ''}</span></span></div>`).join('') || empty('ยังไม่มีพนักงานในตำแหน่งนี้')}</div>` : ''}`,
      onSave: async v => {
        const tm = { cms_role: v.t_role || '', cms_perms: String(v.t_perms || '').split(',').filter(Boolean), finance_role: v.t_fin || '' };
        ['t_role', 't_fin', 't_perms'].forEach(k => delete v[k]);
        const dept = HR_DEPARTMENTS.find(x => x.id === v.department_id);
        v.department = dept ? dept.name : (v.department_id ? p.department || '' : '');
        const x = await hrPositionRequest('POST', { action: 'save-position', ...v, id: id || undefined });
        const i = HR_POSITIONS.findIndex(z => z.id === x.position.id);
        if (i < 0) HR_POSITIONS.push(x.position); else HR_POSITIONS[i] = x.position;
        const r = await hrPositionRequest('POST', { action: 'save-template', position_id: x.position.id, ...tm });
        PERM = PERM.filter(z => z.position_id !== x.position.id).concat(r.permissions || []);
        finSig = '';
        toast('บันทึกตำแหน่งแล้ว · กำลังปรับสิทธิ์ของพนักงานในตำแหน่งนี้');
        schedule();
      },
      onDelete: null
    });
  };

  // ---------- แสดงตำแหน่งในหน้าอื่น ----------
  // User Management: ป้ายตำแหน่ง + สิทธิ์มาจากตำแหน่ง
  if (typeof userRow === 'function') {
    const ur0 = userRow;
    userRow = function (u) {
      const h = ur0.apply(this, arguments);
      const p = u.empId && posOfEmp(empById(u.empId));
      if (!p) return h;
      const w = ready() && wantUser(u);
      const tag = `<span class="chip mc">${esc(p.name_th)}</span>${w ? '<span class="chip warn">รอปรับสิทธิ์ตามตำแหน่ง</span>' : ''}`;
      const at = h.lastIndexOf('</span></span></button>');
      return at < 0 ? h : h.slice(0, at) + tag + h.slice(at);
    };
  }
  // ฟอร์มพนักงาน: Role ตามตำแหน่งที่เลือก
  function lockRole(sh) {
    const ps = sh.querySelector('[data-k="position"]'), rs = sh.querySelector('[data-k="role"]');
    if (!ps || !rs || rs.value === 'owner') return;
    const p = HR_POSITIONS.find(x => x.name_th === ps.value), t = p && tmpl(p.id);
    const r = t && t.role && EMP_ROLES.includes(t.role) ? t.role : '';
    const help = rs.closest('.field') && rs.closest('.field').querySelector('.help');
    if (r) {
      if (![...rs.options].some(x => x.value === r)) rs.add(new Option(ROLE_TH[r] || r, r));
      rs.value = r; rs.disabled = true;
      if (help) help.textContent = 'ตามตำแหน่ง ' + p.name_th + ' (แก้ที่ HR › Positions)';
    } else {
      rs.disabled = false;
      if (help) help.textContent = p ? 'ตำแหน่งนี้ยังไม่ได้ตั้ง Role — เลือกเองได้' : 'เลือกตำแหน่งแล้ว Role จะตั้งให้เอง';
    }
  }
  // ฟอร์มพนักงาน / ผู้ใช้: บอกว่า Role และสิทธิ์มาจากตำแหน่ง
  if (typeof openForm === 'function') {
    const of0 = openForm;
    openForm = function (o) {
      try {
        const ks = (o.fields || []).map(f => f.k);
        if (ks.includes('position') && ks.includes('payType')) {
          o.topHTML = (o.topHTML || '') + '<p class="note">Role และสิทธิ์ใช้งานเป็นไปตามตำแหน่ง (ตั้งที่ HR › Positions) — เลือกตำแหน่งแล้วบัญชีผู้ใช้ที่ผูกจะปรับตามเอง</p>';
          // ช่องตำแหน่งมาก่อน Role · ตำแหน่งที่ตั้ง Role ไว้ → Role ตั้งให้เองและล็อก (เลือกเองได้เฉพาะตำแหน่งที่ยังไม่ตั้ง)
          const fi = o.fields.findIndex(f => f.k === 'position'), ri = o.fields.findIndex(f => f.k === 'role');
          if (ri >= 0 && fi > ri) { const [f] = o.fields.splice(fi, 1); o.fields.splice(ri, 0, f); }
          const rf = o.fields.find(f => f.k === 'role');
          if (rf) rf.help = 'ตั้งตามตำแหน่งให้อัตโนมัติ';
          const live0 = o.live;
          o.live = sh => { if (live0) live0(sh); lockRole(sh); };
        } else if (ks.includes('uname') && ks.includes('perms')) {
          const e = o.data && o.data.empId && empById(o.data.empId), p = e && posOfEmp(e), t = p && tmpl(p.id);
          o.topHTML = (o.topHTML || '') + (t && t.set
            ? `<p class="note">ผูกกับพนักงานตำแหน่ง <b>${esc(p.name_th)}</b> — Role${t.role ? ' (' + esc(ROLE_TH[t.role] || t.role) + ')' : ''} และสิทธิ์${t.perms.length ? ' (' + esc(t.perms.map(permName).join(', ')) + ')' : ' ตาม Role'} มาจากตำแหน่ง แก้ที่ HR › Positions</p>`
            : '<p class="note">ผูกกับพนักงานที่มีตำแหน่งแล้ว Role และสิทธิ์จะตั้งตามตำแหน่งให้อัตโนมัติ</p>');
        }
      } catch (_) { /* ไม่ให้หมายเหตุทำฟอร์มพัง */ }
      return of0.apply(this, arguments);
    };
  }
  // ให้ไฟล์อื่น (perms-positions.js) อ่านแม่แบบตำแหน่งได้ — อ่านอย่างเดียว
  window.PosPerms = { tmpl, posOfEmp, FIN_TH, ROLE_TH, permName, ready: () => ready() };
})();
