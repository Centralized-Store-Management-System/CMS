/* หน้าลงเวลาแบบฝังในหลังร้าน (เปิดเป็นหน้าต่างซ้อนจากหน้าเว็บ Staff)
 * ใช้การเข้าสู่ระบบเดิมของหน้าเว็บ ไม่ต้องใส่รหัสพนักงาน/PIN ซ้ำ: หลังร้านส่งโทเคนมาทาง #t=… (ไม่ถูกส่งไปที่เซิร์ฟเวอร์ ลบออกจาก URL ทันที)
 * ทำได้ครบเหมือนใน LINE: ลงเวลา ขอ OT ลา แก้เวลา ดูตาราง/สรุปเดือน (+ แจ้ง LINE ตามปกติ)
 * ทำรายการเสร็จ → บอกหลังร้านให้อัปเดตข้อมูลทันที / ปิด → กลับหน้าเดิม (ไม่ออกจากระบบ) */
'use strict';
window.AMZ_EMBED = (function () {
  const q = new URLSearchParams(location.search);
  if (q.get('embed') !== '1' || window.parent === window) return null;
  const m = location.hash.match(/[#&]t=([\w-]+)/);
  history.replaceState(null, '', location.pathname + location.search);
  return m ? { t: m[1], tab: q.get('tab') || '' } : null;
})();
function embedPost(type, extra) { try { window.parent.postMessage(Object.assign({ amz: type }, extra || {}), location.origin); } catch (e) { /* ignore */ } }

async function embedBoot() {
  const E = window.AMZ_EMBED;
  document.documentElement.classList.add('embed');
  const st = document.createElement('style');
  st.textContent = '.embed .clock-top{display:none}.embed body{background:transparent}.embed .clock-shell{padding-top:8px}';
  document.head.appendChild(st);
  // ทำรายการสำเร็จ → หลังร้านอัปเดตทันที
  const oc = API.call.bind(API);
  API.call = async (a, p) => { const r = await oc(a, p); if (a === 'clock' || a === 'myRequest') embedPost('changed'); return r; };
  // ปุ่ม "เสร็จ" / หมดเวลา: ปิดหน้าต่าง ไม่ออกจากระบบของหลังร้าน
  backToWho = function (note) { stopGeo(); embedPost('close', { note: note || '', expired: /หมดเวลา/.test(note || '') }); };
  $('#root').innerHTML = '<p class="loading">กำลังโหลดข้อมูลของคุณ…</p>';
  try {
    S.token = E.t;
    setMy(await API.call('my', { t: E.t }));
    C.via = 'web'; C.embed = true;
    C.shopName = C.my.shopName || C.shopName;
    C.emp = { id: C.my.emp.id, nickname: C.my.emp.name, code: C.my.emp.code };
    C.step = 'me'; C.tab = { leave: 'leave', fix: 'fix', month: 'month', ot: 'ot' }[E.tab] || 'days'; C.result = null; C.selfie = '';
    render();
    if (C.my.state !== 'done') startGeo();
    embedPost('ready');
  } catch (e) {
    embedPost('close', { note: e.code === 'SESSION' ? 'หมดเวลาการใช้งาน เข้าสู่ระบบใหม่' : e.message, expired: e.code === 'SESSION' });
  }
}
