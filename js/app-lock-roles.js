/* Settings › Permissions: เลือกว่าระดับไหนตั้ง "รหัสปลดล็อกแอป" บนมือถือ/iPad ได้บ้าง (เซิร์ฟเวอร์ 67_AppLockRoles.gs)
 * - ค่าเริ่มต้น: ทุกระดับตั้งได้ · เอาติ๊กออก = ระดับนั้นต้องเข้าด้วยชื่อผู้ใช้ + PIN ทุกครั้ง
 * - เก็บที่ settings.appLockOff (รายชื่อ Role ที่ "ปิด" คั่นด้วย , — ว่าง = เปิดทุกระดับ)
 * - บัญชีหลัก owner ใช้รหัสปลดล็อกของแอป Owner แยกต่างหาก ไม่เกี่ยวกับตารางนี้
 * ต่อท้าย view ของหน้า Permissions — ไม่แก้ mod-settings.js */
'use strict';
(function () {
  if (typeof modBy !== 'function' || typeof PERM_ROLES === 'undefined') return;
  const esc2 = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const off = () => new Set(String((S.settings && S.settings.appLockOff) || '').split(',').map(x => x.trim()).filter(Boolean));

  function section() {
    const O = off(), roles = PERM_ROLES.slice();
    const n = (S.t.devices || []).filter(d => d.status === 'active').length;
    return `<h3 class="h3">รหัสปลดล็อกแอป (มือถือ / iPad)</h3>
      <p class="note" style="margin-top:0">ติ๊กไว้ = ระดับนั้นตั้งรหัสปลดล็อก 6 หลักผูกกับเครื่องได้ เปิดแอปครั้งต่อไปไม่ต้องพิมพ์ชื่อผู้ใช้ + PIN · เอาติ๊กออก = ต้องเข้าด้วยชื่อผู้ใช้ + PIN ทุกครั้ง และเครื่องที่ผูกไว้ของระดับนั้นจะถูกยกเลิก${n ? ` · ตอนนี้ผูกไว้ ${n} เครื่อง` : ''}</p>
      <div class="group pad"><div class="days">${roles.map(r => `<label><input type="checkbox" data-alr="${esc2(r)}"${O.has(r) ? '' : ' checked'}><span>${esc2(ROLE_NAME[r] || r)}</span></label>`).join('')}</div></div>
      <div class="actions"><button class="btn primary" data-a="saveAppLock">บันทึกรหัสปลดล็อกแอป</button></div>`;
  }

  const ms = modBy('set'), sub = ms && ms.subs && ms.subs.find(s => s.key === 'perms');
  if (!sub || sub.__alr) return;
  const v0 = sub.view; sub.__alr = 1;
  sub.view = function () {
    const h = v0.apply(this, arguments);
    let p = ''; try { p = section(); } catch (_) { /* ส่วนเสริมไม่ให้หน้าหลักพัง */ }
    return h + p;
  };
  ms.acts = ms.acts || {};
  ms.acts.saveAppLock = async (a, b) => {
    try {
      const outList = [...document.querySelectorAll('[data-alr]')].filter(c => !c.checked).map(c => c.dataset.alr);
      S.settings.appLockOff = outList.join(',');
      await busy(b, () => DB.saveSettings());
      toast(outList.length ? `บันทึกแล้ว · ปิดรหัสปลดล็อก ${outList.length} ระดับ` : 'บันทึกแล้ว · ทุกระดับตั้งรหัสปลดล็อกได้');
      App.render();
    } catch (x) { toast(x.message); }
  };
  Object.assign(ACT, { saveAppLock: ms.acts.saveAppLock });
})();
