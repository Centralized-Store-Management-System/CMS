/* HR ↔ Users (34_HrUserSync.gs) ฝั่งหน้าเว็บ
 * - ประวัติตำแหน่งในหน้าข้อมูลพนักงาน (ตำแหน่ง / Role / สาขา / สถานะ / รหัส เปลี่ยนเมื่อไร โดยใคร)
 * - บันทึกที่ HR แล้ว หน้า Users เห็นค่าใหม่ทันที (และกลับกัน) ไม่ต้องรีเฟรช */
'use strict';
if (!TABLES.includes('emphist')) TABLES.push('emphist');
if (!S.t.emphist) S.t.emphist = [];
function empHistHTML(id) {
  const list = (S.t.emphist || []).filter(h => h.empId === id).sort((a, b) => String(b.at || b.date).localeCompare(String(a.at || a.date)));
  const nice = (f, v) => f === 'Role' ? (ROLE_NAME[v] || v) : f === 'สาขาประจำ' ? branchName(v) || v : f === 'ดูแลสาขาเพิ่ม' ? (v === '*' ? 'ทุกสาขา' : v || '–') : v || '–';
  return `<div class="h3" style="margin-top:16px">ประวัติตำแหน่ง / สิทธิ์</div>${list.length ? `<div class="group">${list.slice(0, 30).map(h => `<div class="row static"><span class="main"><span class="t">${esc(h.field)}: ${esc(nice(h.field, h.fromVal))} → <b>${esc(nice(h.field, h.toVal))}</b></span><span class="s">${thDate(h.date, { day: 'numeric', month: 'short', year: '2-digit' })} · ${esc(h.by || '')}${h.via === 'Users' ? ' (หน้า Users)' : ''}</span></span></div>`).join('')}</div>` : '<p class="note">ยังไม่มีการเปลี่ยนแปลง (เริ่มบันทึกตั้งแต่อัปเดตนี้)</p>'}<p class="note">เปลี่ยน Role / สาขา / สถานะ ที่นี่ บัญชีผู้ใช้เปลี่ยนตามอัตโนมัติ ชื่อเข้าระบบ PIN และ LINE เดิมใช้ต่อได้ ลาออก = ปิดบัญชีอัตโนมัติ</p>`;
}
(function () {
  const up = DB.upsertMany.bind(DB);
  DB.upsertMany = async function (table, rows) {
    const res = await up(table, rows);
    try {
      if (table === 'employees') (rows || []).forEach(r => {
        const e = empById(r.id); if (!e) return;
        (S.t.users || []).filter(u => u.empId === e.id).forEach(u => {
          const ch = { id: u.id, branch: e.branch || '', branchAccess: e.branchAccess || '' };
          if (e.role && e.role !== 'owner' && e.role !== u.role) {
            ch.role = e.role; ch.perms = '';
            const pre = (typeof UPREFIX !== 'undefined' && UPREFIX[e.role]) || '';
            let base = String(u.username || '').toLowerCase();
            for (let c = true; c;) { c = false; for (const p of ['owner_', 'admin_', 'hr_', 'mgr_', 'staff_']) if (base.startsWith(p) && base.length > p.length) { base = base.slice(p.length); c = true; } }
            if (pre && !String(u.username).toLowerCase().startsWith(pre) && !(S.t.users || []).some(x => x.id !== u.id && String(x.username).toLowerCase() === pre + base)) ch.username = pre + base;
          }
          if (e.status === 'ลาออก') ch.status = 'disabled'; else if (u.status === 'disabled' && r.status !== undefined) ch.status = 'active';
          DB.local('users', ch);
        });
      });
      if (table === 'users') (rows || []).forEach(r => {
        if (!r.empId) return;
        const ch = { id: r.empId };
        ['role', 'branch', 'branchAccess'].forEach(k => { if (r[k] !== undefined) ch[k] = r[k]; });
        if (Object.keys(ch).length > 1 && empById(r.empId)) DB.local('employees', ch);
      });
    } catch (e) { /* แสดงค่าใหม่ตอนโหลดรอบถัดไป */ }
    return res;
  };
})();
