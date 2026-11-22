/* ตารางงาน: ตำแหน่งที่ "ไม่ต้องจัดตารางงาน" ไม่ขึ้นในตาราง (ตั้งที่ Settings › Permissions › สิทธิ์ตามตำแหน่ง)
 * - เดิม Role Manager / Staff ทุกคนขึ้นในตารางทุกตำแหน่ง → ตำแหน่งที่ไม่ต้องลงกะ (เช่น ผู้ตรวจสุดท้าย) ก็โผล่
 * - ค่าเก็บที่ settings.noSchedPos = id ตำแหน่งที่ไม่ต้องจัดตาราง คั่นด้วย ,  (ว่าง = จัดทุกตำแหน่งเหมือนเดิม)
 * - คนที่มีรูปแบบกะ หรือมีกะในเดือนนั้นอยู่แล้ว ยังแสดง (ไม่ทำข้อมูลเดิมหาย)
 * - เป็นการกรองรายชื่อเท่านั้น ไม่แก้ข้อมูล · ต่อยอด homeEmps ของ mod-schedule.js */
(function () {
  if (typeof homeEmps !== 'function' || !window.PosPerms) return;
  const ids = () => new Set(String((S.settings && S.settings.noSchedPos) || '').split(',').map(x => x.trim()).filter(Boolean));
  const skip = (e, m, off) => {
    const p = window.PosPerms.posOfEmp(e);
    if (!p || !off.has(p.id)) return false;
    if (typeof hasPattern === 'function' && hasPattern(e)) return false;
    return !(S.t.schedule || []).some(r => r.empId === e.id && String(r.date || '').startsWith(m) && String(r.shift || '').trim() && !(typeof Calc !== 'undefined' && Calc.isOffCode(r.shift)));
  };
  window.schedSkip = (e, m) => skip(e, m || (S.month || ''), ids());
  const h0 = homeEmps;
  homeEmps = function (b, m) {
    const list = h0.apply(this, arguments), off = ids();
    return off.size ? list.filter(e => !skip(e, m, off)) : list;
  };
})();
