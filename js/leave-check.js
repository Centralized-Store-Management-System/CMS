/* ตรวจสิทธิ์ลารายครั้ง (หลังร้าน · เฉพาะผู้อนุมัติ/Time/HR) — คู่กับ 52_LeaveCheck.gs
 * ใบลาที่รออนุมัติ แสดงบรรทัดเพิ่ม: ใช้ไปกี่วันจากสิทธิ์ทั้งปี · ถ้าอนุมัติใบนี้ เหลือกี่วัน หรือเกินสิทธิ์กี่วัน (ไม่ได้รับค่าจ้าง)
 * Staff ไม่เห็นยอดสิทธิ์ลาที่ไหนเลย · คำนวณจากข้อมูลในเครื่อง ไม่ดึงเพิ่ม */
'use strict';
(function () {
  if (typeof leaveRow !== 'function') return;
  const Q = [['ลาป่วย', 'sickPaidDays', 30], ['ลากิจ', 'personalPaidDays', 3], ['ลาพักร้อน', 'annualDays', 6]];
  const canSee = () => can('approve_time', 'time', 'hr');
  function check(l) {
    const q = Q.find(x => x[0] === l.type); if (!q) return null;
    const st = S.settings || {}; let quota = st[q[1]] === undefined || st[q[1]] === '' ? q[2] : num(st[q[1]]), note = '';
    const y = String(l.dateFrom || '').slice(0, 4), e = empById(l.empId) || {};
    if (q[1] === 'annualDays' && e.startDate && addDays(String(e.startDate), 365) > String(l.dateFrom || '')) { quota = 0; note = 'ยังทำงานไม่ครบ 1 ปี'; }
    let used = 0, pend = 0;
    (S.t.leaves || []).forEach(x => {
      if (x.id === l.id || x.empId !== l.empId || x.type !== l.type || String(x.dateFrom || '').slice(0, 4) !== y) return;
      const d = num(x.days) || 1;
      if (x.status === 'อนุมัติ') used += d; else if (x.status === 'รออนุมัติ') pend += d;
    });
    const left = quota - used - (num(l.days) || 1);
    return { quota, used, pend, left: Math.max(0, left), over: Math.max(0, -left), note };
  }
  const orig = leaveRow;
  leaveRow = function (l) {
    const h = orig.apply(this, arguments);
    if (!l || l.status !== 'รออนุมัติ' || !canSee()) return h;
    const c = check(l); if (!c) return h;
    const line = `<span class="s lc">สิทธิ์ปีนี้ ใช้ไป ${fmtQ(c.used)}/${fmtQ(c.quota)}${c.pend ? ` · รออีก ${fmtQ(c.pend)}` : ''}${c.note ? ' · ' + c.note : ''} → ${c.over ? `<b class="lc-bad">เกินสิทธิ์ ${fmtQ(c.over)} วัน (ไม่ได้รับค่าจ้าง)</b>` : `<b class="lc-ok">รวมใบนี้แล้วเหลือ ${fmtQ(c.left)} วัน</b>`}</span>`;
    const i = h.indexOf('</span></span></button>');
    return i < 0 ? h : h.slice(0, i + 7) + line + h.slice(i + 7);
  };
  const css = document.createElement('style');
  css.textContent = '.row .s.lc .lc-bad{color:var(--bad)}.row .s.lc .lc-ok{color:var(--ok)}';
  document.head.appendChild(css);
})();
