/* ไม่ขอ OT อัตโนมัติจากเวลาลงงาน (ทุกหน้าจอ): ออกงานเกินกะแล้ว ไม่สร้าง "OT รออนุมัติ" ให้เอง — พนักงานคีย์ขอ OT เอง (คำขอ OT)
 * คู่กับ 57_NoAutoOT.gs ฝั่งเซิร์ฟเวอร์ · OT ที่ตัดสินแล้ว (อนุมัติ/ไม่อนุมัติ) คงไว้เหมือนเดิม
 * เปิดกลับได้: ตั้งค่า autoOT = true */
'use strict';
(function () {
  if (typeof Calc !== 'object' || !Calc.applyPlan) return;
  const a0 = Calc.applyPlan;
  Calc.applyPlan = function (rec, plan, st) {
    const prev = rec ? rec.otStatus : '';
    const r = a0.apply(this, arguments);
    if (r && String((st || {}).autoOT) !== 'true' && r.otStatus === 'รออนุมัติ' && prev !== 'รออนุมัติ') { r.otMin = 0; r.otStatus = ''; }
    return r;
  };
})();
