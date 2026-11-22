/* Role ใหม่: Final Verifier (ผู้ตรวจสอบขั้นสุดท้าย) — ฝั่งหน้าเว็บ (เซิร์ฟเวอร์ 63_RoleVerifier.gs)
 * - เห็นทุกสาขา · ระดับอนุมัติ · ใช้คู่กับตำแหน่ง Final Verifier และบทบาท Finance ที่ตั้งที่ตำแหน่ง
 * - เพิ่มในช่อง Role ของฟอร์มพนักงานและฟอร์มบัญชีผู้ใช้ · เพิ่มคอลัมน์ในตาราง Settings › Permissions
 * - ค่าเริ่มต้นสิทธิ์ต้องตรงกับ DEFAULT_PERMS.verifier ฝั่งเซิร์ฟเวอร์ (กติกาใน AGENTS.md)
 * ต่อยอดของเดิมทั้งหมด ไม่แก้ core.js / mod-hr.js / mod-users.js / mod-settings.js */
(function () {
  if (typeof ROLE_NAME !== 'object' || typeof PERM_ROLES === 'undefined') return;
  const R = 'verifier', TH = 'Final Verifier', LONG = 'Final Verifier — ผู้ตรวจสอบขั้นสุดท้าย (อนุมัติ เห็นทุกสาขา)';

  ROLE_NAME[R] = TH;
  if (typeof UPREFIX === 'object') UPREFIX[R] = 'fv_';
  if (typeof DEFAULT_PERMS === 'object') DEFAULT_PERMS[R] = ['approve_time', 'approve_stock', 'time', 'schedule_view'];
  if (PERM_ROLES.indexOf(R) < 0) PERM_ROLES.push(R);          // คอลัมน์ในตารางสิทธิ์ (ต่อท้าย Staff)

  // บันทึกสิทธิ์: ของเดิมมีแค่ 4 ระดับตายตัว → สร้างจาก PERM_ROLES แทน จะได้ไม่ตกระดับใหม่
  if (typeof savePerms === 'function') {
    savePerms = async function (btn) {
      const P = {};
      PERM_ROLES.forEach(r => { P[r] = []; });
      document.querySelectorAll('[data-perm]').forEach(c => {
        if (!c.checked) return;
        const [r, k] = c.dataset.perm.split(':');
        if (P[r]) P[r].push(k);
      });
      S.settings.perms = JSON.stringify(P);
      await busy(btn, () => DB.saveSettings());
      toast('บันทึกสิทธิ์แล้ว มีผลตอนผู้ใช้เข้าสู่ระบบหรือรีเฟรชหน้า');
      App.render();
    };
  }

  /** เพิ่มตัวเลือกในช่อง Role ของฟอร์ม (ก่อน Owner ถ้ามี) — ฟอร์มพนักงาน + ฟอร์มบัญชีผู้ใช้ */
  function addOpt(f) {
    if (!f || !Array.isArray(f.options)) return;
    if (f.options.some(o => (Array.isArray(o) ? o[0] : o) === R)) return;
    const i = f.options.findIndex(o => (Array.isArray(o) ? o[0] : o) === 'owner');
    f.options.splice(i < 0 ? f.options.length : i, 0, [R, LONG]);
  }
  if (typeof openForm === 'function') {
    const of0 = openForm;
    openForm = function (o) {
      try {
        const ks = (o.fields || []).map(f => f.k);
        if (ks.includes('role') && (ks.includes('payType') || ks.includes('uname'))) addOpt(o.fields.find(f => f.k === 'role'));
      } catch (_) { /* ไม่ให้ส่วนเสริมทำฟอร์มพัง */ }
      return of0.apply(this, arguments);
    };
  }

  // ตารางสิทธิ์: เติมหัวคอลัมน์ให้ตรงกับช่องติ๊กที่ PERM_ROLES สร้างเพิ่ม + แถวขอบเขตสาขา
  const ms = typeof modBy === 'function' && modBy('set'), sub = ms && ms.subs && ms.subs.find(s => s.key === 'perms');
  if (sub && !sub.__rv) {
    const v0 = sub.view; sub.__rv = 1;
    sub.view = function () {
      let h = v0.apply(this, arguments);
      try {
        h = h.replace('<th>Staff</th></tr></thead>', `<th>Staff</th><th>${TH}</th></tr></thead>`);
        const mark = '</div>\n  <p class="note">เปลี่ยน Role', at = h.indexOf(mark);   // ท้ายกลุ่ม "เห็นข้อมูลสาขาไหน"
        if (at >= 0 && typeof statRow === 'function') {
          const who = [...(S.t.employees || []).filter(e => e.role === R && e.status !== 'ลาออก'), ...(S.t.users || []).filter(u => !u.master && u.role === R && u.status !== 'disabled')].map(x => x.name || x.nickname || x.username || x.code);
          h = h.slice(0, at) + statRow(TH, '', 'ทุกสาขา (ผู้ตรวจสอบขั้นสุดท้าย): ' + esc(who.join(', ') || 'ยังไม่มี')) + h.slice(at);
        }
      } catch (_) { /* ถ้าโครงหน้าเปลี่ยน ให้แสดงของเดิมไว้ก่อน */ }
      return h;
    };
  }
})();
