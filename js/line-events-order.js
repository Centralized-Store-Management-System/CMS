/* เพิ่มตัวเลือก "แจ้งเตือน LINE" ที่มาจากระบบออเดอร์ — ต่อท้ายรายการเดิม ไม่แก้ mod-users.js ทับ
 *
 * คีย์ 'pay' ถูกอ่านฝั่งเซิร์ฟเวอร์โดย Edge Function payment-portal และ line-webhook
 * ผ่าน view public.cms_staff_notify (อ่านคอลัมน์ "แจ้งเตือน LINE" ในชีตผู้ใช้ตรงๆ)
 * >> ถ้าเปลี่ยนคีย์ตรงนี้ ต้องไปแก้ทั้งสองฟังก์ชันด้วย ไม่งั้นแจ้งเตือนจะเงียบ
 *
 * ต้องโหลดไฟล์นี้ "หลัง" js/mod-users.js เพราะ LINE_EV_OPTS ประกาศไว้ที่นั่น
 */
(function () {
  var OPT = ['pay', 'ชำระเงินลูกค้า สำเร็จ/ไม่สำเร็จ'];
  try {
    if (typeof LINE_EV_OPTS === 'undefined' || !Array.isArray(LINE_EV_OPTS)) return;
    if (LINE_EV_OPTS.some(function (o) { return o && o[0] === OPT[0]; })) return;
    LINE_EV_OPTS.push(OPT);
  } catch (e) {
    /* mod-users.js ยังไม่โหลด (ลำดับสคริปต์เพี้ยน) — ไม่ให้หน้าเว็บพังเพราะเรื่องนี้ */
    console.warn('line-events-order: เพิ่มตัวเลือกแจ้งเตือนไม่สำเร็จ', e && e.message);
  }
})();
