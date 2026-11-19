/* เมนู Users: ปุ่ม "ลบ" ของผู้มีสิทธิ์ IT/Owner = ลบถาวร (เหมือนหน้า IT, 45_ITPurge.gs) ลบได้แม้มีประวัติ ไม่ต้องไปลบเองที่ชีต
 * ผู้ใช้อื่นใช้การลบแบบเดิม (บัญชีที่มีประวัติลบไม่ได้) */
function userPurgeDelete(u) {
  if (!can('it') || !u || !u.id || u.master || u.id === S.me.uid) return DB.remove('users', u.id);
  const e = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  return new Promise((resolve, reject) => {
    const sh = openSheet(`<h2 style="margin:0 0 6px;color:#B03535">ลบบัญชีถาวร</h2>
      <p style="margin:0 0 10px"><b>${e(u.name || '')}</b> <span class="muted">(${e(u.username)})</span></p>
      <div class="group pad" style="font-size:14px;line-height:1.7"><b>ลบ:</b> บัญชีผู้ใช้ + PIN + การผูก LINE · ตัดการเข้าระบบทุกเครื่อง<br><b>หลังลบ:</b> ลงทะเบียน LINE ใหม่ได้ทันที (ได้บัญชีเว็บ + PIN ใหม่)</div>
      ${S.me.role === 'owner' && u.empId ? `<label class="group pad" style="display:flex;gap:10px;align-items:flex-start;margin-top:10px;border-color:#E3B5B5;cursor:pointer"><input type="checkbox" id="up-all" style="margin-top:4px">
        <span><b style="color:#B03535">ลบทั้งหมดออกจากระบบ</b> (บัญชีทดสอบ)<br><span class="muted" style="font-size:13px">ลบพนักงานใน HR + ลงเวลา ตารางงาน ใบลา OT เงินเดือน ประวัติ Audit log ของชื่อนี้ และรูป · กู้คืนไม่ได้ (ยกเว้นจากสำรองข้อมูลรายวัน)</span></span></label>` : ''}
      <div class="field" style="margin-top:12px"><label for="up-c">พิมพ์ <b>${e(u.username)}</b> เพื่อยืนยัน</label><input id="up-c" autocomplete="off" autocapitalize="none" spellcheck="false"></div>
      <p class="err" id="up-err" role="alert"></p>
      <div class="actions"><span class="grow"></span><button class="btn" data-up-x>ยกเลิก</button><button class="btn primary" data-up-ok style="background:#B03535;border-color:#B03535">ลบถาวร</button></div>`);
    sh.querySelector('[data-up-x]').onclick = () => { closeSheet(); reject(new Error('ยกเลิกแล้ว')); };
    sh.querySelector('[data-up-ok]').onclick = async ev => {
      const all = !!(sh.querySelector('#up-all') || {}).checked;
      try {
        await busy(ev.target, () => API.call('it', { t: S.token, op: 'purge', id: u.id, confirm: sh.querySelector('#up-c').value, all: all ? '1' : '' }), 'กำลังลบ…');
        S.t.users = (S.t.users || []).filter(r => r.id !== u.id);
        if (all && u.empId && S.t.employees) S.t.employees = S.t.employees.filter(r => r.id !== u.empId);
        S.rev++; resolve();
        if (all) setTimeout(() => bootstrap().then(() => App.render()).catch(() => {}), 300);   // โหลดข้อมูลใหม่ทั้งหมด (ลงเวลา/ใบลา ของคนนี้หายแล้ว)
      } catch (err) { sh.querySelector('#up-err').textContent = err.message; }
    };
  });
}
