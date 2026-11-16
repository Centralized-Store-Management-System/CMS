/* ลดการเรียก Apps Script เบื้องหลัง (หลังร้าน: แอป/เว็บ) — โหลดหลัง live.js
 * เดิม: ทุกคนถามข้อมูลใหม่ทุก 5 วินาที (ซ่อนแท็บ 15 วินาที) → คนเปิดแอปพร้อมกันหลายคน Apps Script แน่น ทุกอย่างช้า
 * ใหม่:  ผู้อนุมัติ (Owner/Manager/HR) ทุก 15 วินาที · ซ่อนแอป 60 วินาที
 *        Staff ทุก 60 วินาที · ซ่อนแอปไม่ถามเลย (กลับมาเปิดถามทันที 1 ครั้ง)
 * บันทึกเอง/อนุมัติ: ข้อมูลขึ้นทันทีเหมือนเดิม (ไม่ต้องรอรอบถาม) */
'use strict';
(function () {
  if (typeof LIVE === 'undefined') return;
  const tune = () => {
    if (typeof S === 'undefined' || !S.me) return;
    const appr = S.me.role === 'owner' || (typeof can === 'function' && can('approve_time', 'approve_stock', 'hr'));
    LIVE.fast = appr ? 15000 : 60000;
    LIVE.slow = appr ? 60000 : 864e5;
  };
  const ob = window.bootstrap;
  if (typeof ob === 'function') window.bootstrap = async function () { const r = await ob.apply(this, arguments); try { tune(); } catch (e) { /* */ } return r; };
  tune();
})();
