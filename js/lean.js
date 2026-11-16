/* ลดการเรียก Apps Script เบื้องหลัง (หลังร้าน: แอป/เว็บ) — โหลดหลัง live.js
 * 1) ความถี่ถามข้อมูลใหม่ (เดิมทุกคนทุก 5 วินาที)
 *    ผู้อนุมัติ (Owner/Manager/HR) ทุก 15 วินาที · ย่อแอป 60 วินาที
 *    Staff ทุก 60 วินาที · ย่อแอปไม่ถาม (กลับมาเปิดถามทันที 1 ครั้ง)
 * 2) เปิดแอปค้างไว้ไม่มีใครแตะเกิน 5 นาที: ผู้อนุมัติถามทุก 3 นาที · Staff หยุดถาม → แตะจอเมื่อไรถามทันที
 * 3) บันทึกแล้วไม่ต้องยิงคำสั่ง "sync" ซ้ำอีกครั้ง (live.js ดูแลเวอร์ชันให้แล้ว) → ประหยัด 1 คำสั่งต่อการบันทึก
 * บันทึกเอง/อนุมัติ: ข้อมูลขึ้นทันทีเหมือนเดิม */
'use strict';
(function () {
  if (typeof LIVE === 'undefined') return;
  const IDLE = 5 * 60000;
  let appr = false, lastAct = Date.now(), idle = false;
  const tune = () => {
    if (typeof S === 'undefined' || !S.me) return;
    appr = S.me.role === 'owner' || (typeof can === 'function' && can('approve_time', 'approve_stock', 'hr'));
    LIVE.fast = idle ? (appr ? 180000 : 864e5) : (appr ? 15000 : 60000);
    LIVE.slow = appr ? 60000 : 864e5;
  };
  const ob = window.bootstrap;
  if (typeof ob === 'function') window.bootstrap = async function () { const r = await ob.apply(this, arguments); try { tune(); } catch (e) { /* */ } return r; };
  tune();

  // ไม่มีใครแตะจอ → ถามห่างลง · แตะอีกครั้ง → ถามทันที
  const wake = () => {
    lastAct = Date.now();
    if (!idle) return;
    idle = false; tune();
    if (typeof liveTick === 'function') { LIVE.last = 0; try { liveTick(); } catch (e) { /* */ } }
  };
  ['pointerdown', 'keydown', 'wheel', 'touchstart'].forEach(t => document.addEventListener(t, wake, { passive: true, capture: true }));
  setInterval(() => { if (!idle && Date.now() - lastAct > IDLE) { idle = true; tune(); } }, 30000);

  // คำสั่ง sync หลังบันทึก (sync.js) ไม่จำเป็นเมื่อ live.js ทำงาน
  if (typeof API !== 'undefined' && API.call) {
    const call = API.call;
    API.call = function (action, params) {
      if (action === 'sync' && LIVE.on && !S.demo) return Promise.resolve({ v: (typeof SYNC !== 'undefined' && SYNC.v) || '' });
      return call.apply(this, arguments);
    };
  }
})();
