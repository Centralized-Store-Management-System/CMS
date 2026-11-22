/* อนุมัติแล้วหน้าจอเปลี่ยนทันที ไม่ต้องรอเซิร์ฟเวอร์ตอบกลับ
 * วัดจากข้อมูลจริง: ฝั่งเซิร์ฟเวอร์ใช้เวลา 1–3 มิลลิวินาที แต่เวลาที่วัดจากเครื่องผู้ใช้ 0.4–23 วินาที
 * ของที่ช้าคือการเดินทางไป–กลับของเน็ต ไม่ใช่เซิร์ฟเวอร์ → ทางแก้คือไม่ยืนรอผลกลับ
 * - "ขอแก้เวลา" (apFix) และ "อนุมัติทั้งหมด" (apAll) ของเดิมยืนรอผลจริง (busy + await) จึงรู้สึกช้าบนมือถือ
 *   เปลี่ยนเป็น DB.bg: ใส่ผลในหน้าจอก่อน ส่งเบื้องหลัง · ถ้าเซิร์ฟเวอร์ไม่รับ DB.bg จะคืนค่าเดิมและเตือนให้เอง
 *   เวลาทำงานที่เซิร์ฟเวอร์คำนวณกลับมา (extra.attendance) ยังเอามาลงเหมือนเดิม แค่ลงทีหลังเมื่อผลมาถึง
 * - ทุกการอนุมัติ อัปเดตเลขบนกระดิ่งให้ด้วย (work-inbox.js)
 * ไม่แก้ mod-approve.js — ทับเฉพาะ action ที่ช้า */
'use strict';
(function () {
  if (typeof ACT !== 'object' || typeof DB !== 'object' || typeof DB.bg !== 'function') return;
  const useExtra = res => { const x = res && res.extra; if (x && x.attendance) { x.attendance.forEach(a => DB.local('attendance', a)); App.render(); } };
  const bell = () => { if (window.WorkInbox) WorkInbox.refresh(false); };   // false = ใช้ค่าที่จำไว้ถ้ายังสด ไม่ยิงเซิร์ฟเวอร์ทุกครั้ง

  // อนุมัติ/ไม่อนุมัติ คำขอแก้เวลา — เดิมรอผลกลับก่อนค่อยเปลี่ยนหน้าจอ
  ACT.apFix = (arg, btn) => {
    const [id, st] = String(arg).split('/'), f = (S.t.timefix || []).find(x => x.id === id);
    if (!f) return;
    DB.bg('timefix', [{ ...f, status: st }], useExtra);
    toast(st === 'อนุมัติ' ? 'อนุมัติแล้ว กำลังแก้เวลาทำงานให้' : 'บันทึกว่าไม่อนุมัติ');
    App.render(); bell();
  };

  // อนุมัติทั้งหมดในหมวดเดียว — ของเดิมหมวดแก้เวลายังรอผลกลับ
  ACT.apAll = async (kind, btn) => {
    const A = approvals();
    const run = () => {
      if (kind === 'L') DB.bg('leaves', A.L.map(l => ({ ...l, status: 'อนุมัติ' })));
      if (kind === 'OT') DB.bg('attendance', A.OT.map(a => ({ ...a, otStatus: 'อนุมัติ' })));
      if (kind === 'OTR') DB.bg('otreq', A.OTR.map(r => ({ ...r, status: 'อนุมัติ' })));
      if (kind === 'OFF') DB.bg('attendance', A.OFF.map(a => ({ ...a, offStatus: 'อนุมัติ' })));
      if (kind === 'MV') DB.bg('moves', A.MV.map(m => ({ ...m, status: 'อนุมัติ' })));
      if (kind === 'FIX') DB.bg('timefix', A.FIX.map(f => ({ ...f, status: 'อนุมัติ' })), useExtra);
      toast('อนุมัติทั้งหมดแล้ว'); App.render(); bell();
    };
    if (typeof armed === 'function') await armed(btn, async () => run(), 'แตะอีกครั้งเพื่ออนุมัติทั้งหมด');
    else run();
  };

  // ที่เหลือเร็วอยู่แล้ว (DB.bg) — แค่ให้กระดิ่งอัปเดตตามด้วย
  ['apLeave', 'apOT', 'apOTR', 'apOff', 'apMove'].forEach(k => {
    const f0 = ACT[k];
    if (typeof f0 !== 'function' || f0.__fast) return;
    const f = async (a, b) => { const r = await f0(a, b); bell(); return r; };
    f.__fast = 1; ACT[k] = f;
  });
})();
