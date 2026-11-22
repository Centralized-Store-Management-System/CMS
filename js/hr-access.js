/* HR → Users → รหัสเปิดใช้งาน ให้ต่อกันจริง (ฝั่งเซิร์ฟเวอร์ 62_HrAccess.gs)
 * 1) เพิ่มพนักงานใหม่ → ระบบสร้างบัญชีผู้ใช้ให้เอง แล้วออกรหัสเปิดใช้งาน 6 หลักขึ้นจอทันที (ยื่นให้เจ้าตัว / ส่งเข้า LINE ถ้าผูกไว้)
 * 2) หน้า Users: แผง "ต้องทำต่อ" บนสุด — บัญชีที่ยังไม่มีรหัส (ปุ่มออกรหัส) · พนักงานที่ยังไม่มีบัญชี (ปุ่มสร้าง + ออกรหัส) · ปุ่มซิงก์ทั้งหมด
 * - พนักงาน Role Owner / ลาออก / ใช้ PIN เดิมของ HR: สร้างบัญชีให้ไม่ได้ (บอกเหตุผลไว้)
 * ต่อยอด: DB.upsertMany + view หน้า Users — ไม่แก้ mod-hr.js / mod-users.js */
(function () {
  if (typeof DB !== 'object' || typeof API !== 'object' || typeof S !== 'object') return;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const canIssue = () => typeof can === 'function' && (can('users') || can('hr'));
  const nm = e => (typeof shortName === 'function' ? shortName(e) : e.nickname || e.firstName || e.code);

  /** บัญชีที่เพิ่งออกรหัส → ใส่ในรายการหน้าเว็บทันที (ถ้าเครื่องนี้เห็นรายการ Users) */
  function localUser(r, role) {
    if (!Array.isArray(S.t.users)) return;
    DB.local('users', { id: r.id, username: r.username, name: r.name, role, empId: r.empId, status: 'active', pending: true, noCode: false, setupExpires: new Date(Date.now() + (r.days || 7) * 864e5).toISOString() });
  }
  const showCode = (r, name) => { if (typeof showSetupCode === 'function') showSetupCode(r, { name, username: r.username }); };

  async function issue(empId, btn) {
    const e = typeof empById === 'function' ? empById(empId) : null;
    const r = await (btn && typeof busy === 'function' ? busy(btn, () => API.write({ op: 'hrEmpAccess', empId }), '…') : API.write({ op: 'hrEmpAccess', empId }));
    localUser(r, e ? e.role : 'staff');
    if (typeof App !== 'undefined' && App.render) App.render();
    showCode(r, e ? nm(e) : r.name);
    return r;
  }

  // ---------- 1) เพิ่มพนักงานใหม่ → ออกรหัสให้ทันที ----------
  const um0 = DB.upsertMany;
  DB.upsertMany = async function (table, rows) {
    const fresh = table === 'employees' && Array.isArray(rows) ? rows.filter(r => !(typeof empById === 'function' && r.id && empById(r.id))).map(r => ({ id: r.id, pin: String(r.pin || '').trim() })) : [];
    const res = await um0.apply(this, arguments);
    if (fresh.length && canIssue()) {
      const back = (res && res.rows) || [];
      back.forEach(row => {
        const f = fresh.find(x => !x.id || x.id === row.id) || null;
        if (!f || f.pin || row.status === 'ลาออก') return;      // ตั้ง PIN ให้เองที่ HR = ใช้รหัสพนักงาน + PIN เดิม ไม่ต้องมีบัญชี
        if (String(row.role) === 'owner') { setTimeout(() => typeof toast === 'function' && toast('เพิ่มแล้ว แต่ Role Owner สร้างบัญชีเข้าระบบให้เองไม่ได้ ตั้ง Role เป็น Manager / Staff ที่ตำแหน่ง แล้วเปิดหน้า Users'), 500); return; }
        setTimeout(async () => {
          try { await issue(row.id); }
          catch (x) { if (typeof toast === 'function') toast('เพิ่มพนักงานแล้ว แต่ยังออกรหัสเข้าระบบไม่ได้: ' + (x && x.message || x) + ' (ออกรหัสที่หน้า Users)'); }
        }, 400);
      });
    }
    return res;
  };

  // ---------- 2) หน้า Users: แผง "ต้องทำต่อ" ----------
  function panel() {
    if (typeof can !== 'function' || !can('users')) return '';
    const noCode = (S.t.users || []).filter(u => u.pending && u.noCode && u.status !== 'disabled');
    const inBr = e => typeof allBranch === 'function' && (allBranch() || (typeof myBranches === 'function' && myBranches().some(b => b.code === e.branch)));
    const none = (S.t.employees || []).filter(e => e.status !== 'ลาออก' && !e.account && !(S.t.users || []).some(u => u.empId === e.id) && inBr(e));
    const legacy = e => e.hasPin === true;
    const ownerRole = e => e.role === 'owner';
    const can2 = none.filter(e => !legacy(e) && !ownerRole(e));
    const blocked = none.filter(e => ownerRole(e));
    if (!noCode.length && !can2.length && !blocked.length) return '';
    const hasLine = u => !!(u.lineUserId || (u.empId && (S.t.employees || []).some(e => e.id === u.empId && e.lineUserId)));
    const row = (t, s, btn) => `<div class="row static"><span class="main"><span class="t">${esc(t)}</span><span class="s">${esc(s)}</span></span>${btn || ''}</div>`;
    return `<h3 class="h3">ต้องทำต่อ <span class="muted">(พนักงานจาก HR ที่ยังเข้าระบบไม่ได้)</span></h3><div class="group">
      ${noCode.map(u => row(u.username + ' · ' + u.name, 'บัญชีสร้างแล้ว แต่ยังไม่มีรหัสเปิดใช้งาน (หรือหมดอายุ)' + (hasLine(u) ? ' · ผูก LINE แล้ว เจ้าตัวพิมพ์ "ขอรหัสเข้าเว็บ" ในแชต LINE ของร้านได้เอง' : ''), `<button class="btn primary sm" data-a="hrCode:${esc(u.id)}">ออกรหัส</button>`)).join('')}
      ${can2.map(e => row(nm(e) + ' ' + (e.code || ''), 'ยังไม่มีบัญชีผู้ใช้' + (e.lineUserId ? ' · ผูก LINE แล้ว เจ้าตัวพิมพ์ "ขอรหัสเข้าเว็บ" ในแชต LINE ของร้านได้เอง' : ''), `<button class="btn primary sm" data-a="hrAcc:${esc(e.id)}">สร้างบัญชี + ออกรหัส</button>`)).join('')}
      ${blocked.map(e => row(nm(e) + ' ' + (e.code || ''), 'Role Owner — สร้างบัญชีให้อัตโนมัติไม่ได้ ตั้ง Role เป็น Manager / Staff ที่ HR (หรือที่ตำแหน่ง) ก่อน', '')).join('')}
    </div>${can2.length ? '<p class="actions" style="margin:6px 0 14px"><button class="btn" data-a="hrSync">สร้างบัญชีให้ทุกคนที่ยังไม่มี</button></p>' : ''}`;
  }
  const mu = typeof modBy === 'function' && modBy('users');
  if (mu && !mu.__ha) {
    const v0 = mu.view; mu.__ha = 1;
    mu.view = function () {
      const h = v0.apply(this, arguments); let p = '';
      try { p = panel(); } catch (_) { /* แผงเสริมไม่ให้หน้าหลักพัง */ }
      if (!p) return h;
      const i = h.indexOf('<div class="h2">');           // วางก่อนหัวข้อ User accounts (ใต้ตัวเลขสรุป)
      return i < 0 ? p + h : h.slice(0, i) + p + h.slice(i);
    };
    mu.acts = mu.acts || {};
    Object.assign(ACT, {
      hrAcc: async (id, b) => { try { await issue(id, b); } catch (x) { toast(x.message); } },
      hrCode: async (id, b) => {
        // บัญชีที่ผูกกับพนักงาน → ใช้ hrEmpAccess เพื่อให้เซิร์ฟเวอร์ปฏิเสธถ้าเจ้าตัวเพิ่งตั้ง PIN เอง (เช่น ลงทะเบียนทาง LINE) จะได้ไม่ทับ PIN ที่ใช้อยู่
        const u = (S.t.users || []).find(x => x.id === id) || {};
        try {
          const r = u.empId
            ? await busy(b, () => API.write({ op: 'hrEmpAccess', empId: u.empId }), '…')
            : await busy(b, () => API.write({ op: 'resetUserPin', id }), '…');
          DB.local('users', { id, pending: true, hasPin: false, pinSetAt: '', noCode: false, setupExpires: new Date(Date.now() + r.days * 864e5).toISOString() });
          App.render(); showSetupCode(r, u);
        } catch (x) {
          toast(x.message);
          if (/ตั้ง PIN แล้ว/.test(x.message || '')) { try { await bootstrap(); App.render(); } catch (_) { /* ไว้โหลดรอบหน้า */ } }   // ข้อมูลในเครื่องเก่า → โหลดใหม่ให้รายการตรง
        }
      },
      hrSync: async (a, b) => {
        try {
          const r = await busy(b, () => API.write({ op: 'hrSyncUsers' }), 'กำลังสร้าง…');
          await bootstrap(); App.render();
          toast(r.created ? `สร้างบัญชีให้ ${r.created} คนแล้ว กด "ออกรหัส" ให้แต่ละคน` : 'ไม่มีพนักงานที่ต้องสร้างบัญชีเพิ่ม');
        } catch (x) { toast(x.message); }
      }
    });
  }
})();
