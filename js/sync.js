/* ซิงก์กับ LINE/LIFF และผู้ใช้อื่น (23_Sync.gs)
 * ทุก 20 วินาที (และทุกครั้งที่กลับมาที่แท็บนี้) ถามเลขเวอร์ชันข้อมูลแบบเบาๆ ถ้ามีคนบันทึกอะไรใหม่ เช่น พนักงานลงเวลา/ขอ OT/ยื่นลาใน LINE
 * หรือมีการอนุมัติจาก LINE ระบบโหลดข้อมูลใหม่ให้เอง ไม่ต้องกดรีเฟรช (ถ้ากำลังกรอกฟอร์มอยู่ จะรอให้ปิดฟอร์มก่อน) */
'use strict';
const SYNC = { v: '', busy: false, pending: false, every: 20000 };
async function syncNow() {
  if (!S.token || !S.me || S.demo || SYNC.busy || document.hidden) return;
  SYNC.busy = true;
  try {
    const r = await API.call('sync', { t: S.token });
    if (SYNC.v && r.v !== SYNC.v) SYNC.pending = true;
    SYNC.v = r.v;
    if (SYNC.pending && !document.querySelector('.sheet') && !document.activeElement?.matches('input,textarea,select')) {
      SYNC.pending = false;
      await bootstrap();
      App.render();
      toast('มีข้อมูลใหม่ (LINE / ผู้ใช้อื่น) อัปเดตแล้ว');
    }
  } catch (e) { /* เน็ตหลุดชั่วคราว รอบหน้าค่อยลองใหม่ */ }
  finally { SYNC.busy = false; }
}
// บันทึกเองแล้วจำเวอร์ชันใหม่ไว้ ไม่ต้องโหลดซ้ำเพราะของตัวเอง
(function () {
  const w = API.write.bind(API);
  API.write = async payload => { const r = await w(payload); if (!S.demo && S.token) API.call('sync', { t: S.token }).then(x => { if (!SYNC.pending) SYNC.v = x.v; }).catch(() => {}); return r; };
})();
setInterval(syncNow, SYNC.every);
document.addEventListener('visibilitychange', () => { if (!document.hidden) syncNow(); });
