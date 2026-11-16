/* Schedule > สรุปวันหยุด (แท็บใหม่ ทุกคนที่ดูตารางได้)
 * - กำหนดวันหยุดต่อเดือน: ค่าปกติ + เดือนที่ต่างจากปกติ (เฉพาะผู้มีสิทธิ์จัดตาราง) · คนดูอย่างเดียวเห็นค่าที่ตั้ง
 * - สรุปรายคน: วันทำงาน · วันหยุดตามตาราง เทียบที่กำหนด · ลาพักร้อน / ลาป่วย / ลากิจ / อื่นๆ · รออนุมัติ
 * - คำนวณจากข้อมูลที่มีในเครื่องแล้ว ไม่ดึงข้อมูลเพิ่มจาก Apps Script */
'use strict';
(function () {
  const sched = MODS.find(m => m.key === 'sched');
  if (!sched || !sched.subs) return;
  const LT = [['ลาพักร้อน', 'พักร้อน'], ['ลาป่วย', 'ป่วย'], ['ลากิจ', 'กิจ']];

  function quotaMap() { try { return JSON.parse((S.settings || {}).offDaysMonth || '{}') || {}; } catch (e) { return {}; } }
  function quotaFor(m) {
    const mm = quotaMap();
    if (mm[m] !== undefined && mm[m] !== '') return { n: Number(mm[m]), month: true };
    const d = (S.settings || {}).offDays;
    return d !== undefined && d !== '' ? { n: Number(d), month: false } : null;
  }

  /** จำนวนวันลาในเดือน m แยกประเภท (อนุมัติแล้ว) + รออนุมัติ */
  function leaveSum(empId, m, dates) {
    const out = { pend: 0 }, first = dates[0], last = dates[dates.length - 1];
    (S.t.leaves || []).forEach(l => {
      if (l.empId !== empId) return;
      const a = String(l.dateFrom || ''), b = String(l.dateTo || l.dateFrom || '');
      if (!a || b < first || a > last) return;
      let n;
      if (a >= first && b <= last && num(l.days) > 0) n = num(l.days);
      else n = dates.filter(d => d >= a && d <= b).length;
      if (l.status === 'รออนุมัติ') { out.pend += n; return; }
      if (l.status !== 'อนุมัติ') return;
      const k = LT.some(([t]) => t === l.type) ? l.type : 'อื่น';
      out[k] = (out[k] || 0) + n;
    });
    return out;
  }

  function rowsFor(b, m) {
    const dates = monthDates(m), ctx = schedView(), emps = homeEmps(b, m);
    return emps.map(e => {
      let work = 0, off = 0, none = 0, outside = 0;
      dates.forEach(d => {
        if (!employed(e, d)) { outside++; return; }
        const lv = leaveOn(e.id, d, ['อนุมัติ']);
        if (lv) return;
        const p = Calc.planFor(e, d, ctx);
        if (p.off) off++;
        else if (p.source === 'ค่าตั้งต้น') none++;
        else work++;
      });
      const part = (e.payType && e.payType !== 'monthly') || /พาร์ท|part/i.test(String(e.position || '') + String(e.status || ''));
      return { e, work, off, none, outside, part, lv: leaveSum(e.id, m, dates) };
    });
  }

  const fq = n => (Math.round(n * 2) / 2).toString();
  function pOff() {
    const m = S.month, b = oneBranch();
    if (!b) return `<div class="group">${empty('ยังไม่มีสาขา')}</div>`;
    const edit = can('schedule_edit'), q = quotaFor(m), R = rowsFor(b, m);
    let h = branchSeg();
    // ---- กำหนดวันหยุด ----
    if (edit) {
      const def = (S.settings || {}).offDays || '', mm = quotaMap()[m];
      h += `<h3 class="h3">วันหยุดที่กำหนด</h3><div class="group pad"><div class="form">
        <div class="field half"><label for="od-m">${esc(thMonth(m))} (วัน/คน)</label><input id="od-m" type="number" inputmode="decimal" min="0" max="31" step="0.5" value="${esc(mm !== undefined ? mm : '')}" placeholder="${def ? 'ใช้ค่าปกติ ' + esc(def) : 'เช่น 4'}"><span class="help">เว้นว่าง = ใช้ค่าปกติ</span></div>
        <div class="field half"><label for="od-d">ค่าปกติทุกเดือน (วัน/คน)</label><input id="od-d" type="number" inputmode="decimal" min="0" max="31" step="0.5" value="${esc(def)}" placeholder="เช่น 4"></div>
      </div><div class="actions" style="margin-bottom:0"><button class="btn primary" data-a="odSave">บันทึก</button></div></div>`;
    } else {
      h += `<div class="group pad"><b>${esc(thMonth(m))}: ${q ? `หยุดได้ ${fq(q.n)} วัน/คน` : 'ยังไม่ได้กำหนดวันหยุดต่อเดือน'}</b><p class="muted" style="margin:4px 0 0">กำหนดโดยผู้จัดตารางงาน</p></div>`;
    }
    // ---- สรุปรายคน ----
    if (!R.length) return h + `<div class="group">${empty('ไม่มีพนักงานในสาขานี้')}</div>`;
    const short = R.filter(r => q && r.off < q.n && !r.outside && !r.part).length, over = R.filter(r => q && r.off > q.n && !r.outside && !r.part).length;
    h += `<h3 class="h3">สรุป${esc(thMonth(m))} ${q ? `${short ? `<span class="chip warn">หยุดไม่ครบ ${short}</span> ` : ''}${over ? `<span class="chip bad">หยุดเกิน ${over}</span>` : ''}${!short && !over ? '<span class="chip ok">ครบทุกคน</span>' : ''}` : ''}</h3>`;
    h += `<div class="group">${R.map(r => {
      const bits = [`ทำงาน ${r.work} วัน`];
      LT.forEach(([t, s]) => { if (r.lv[t]) bits.push(`${s} ${fq(r.lv[t])}`); });
      if (r.lv['อื่น']) bits.push(`ลา ${fq(r.lv['อื่น'])}`);
      if (r.lv.pend) bits.push(`<span class="chip warn">ลารออนุมัติ ${fq(r.lv.pend)}</span>`);
      if (r.none) bits.push(`<span class="chip">ยังไม่จัดตาราง ${r.none} วัน</span>`);
      if (r.outside) bits.push(`<span class="chip">ไม่ได้อยู่ทั้งเดือน</span>`);
      let st = '';
      if (r.part) st = '<span class="chip">พาร์ทไทม์</span>';
      else if (q && !r.outside) {
        const d = r.off - q.n;
        st = d === 0 ? '<span class="chip ok">ครบ</span>' : d < 0 ? `<span class="chip warn">ขาด ${fq(-d)}</span>` : `<span class="chip bad">เกิน ${fq(d)}</span>`;
      }
      return `<div class="row static">${avatar(r.e)}<span class="main"><span class="t">${esc(shortName(r.e))}</span><span class="s">${bits.join(' · ')}</span></span><span class="v" style="text-align:right;white-space:nowrap"><b style="font-size:17px">หยุด ${r.off}${q && !r.part ? `<small class="muted">/${fq(q.n)}</small>` : ''}</b><br>${st}</span></div>`;
    }).join('')}</div>`;
    // รวมทั้งสาขา
    const tot = k => R.reduce((s, r) => s + (r.lv[k] || 0), 0);
    h += `<div class="group">${statRow('รวมทั้งสาขา', `หยุด ${R.reduce((s, r) => s + r.off, 0)} วัน`, [`ทำงาน ${R.reduce((s, r) => s + r.work, 0)} วัน`, ...LT.map(([t, s]) => tot(t) ? `${s} ${fq(tot(t))}` : '').filter(Boolean), tot('อื่น') ? `ลาอื่นๆ ${fq(tot('อื่น'))}` : ''].filter(Boolean).join(' · '))}</div>`;
    h += '<p class="note">นับจากตารางงาน (หยุด = วันหยุดในตาราง ไม่รวมวันลา) และใบลาที่อนุมัติแล้ว' + (can('approve_time', 'hr') ? '' : ' · วันลาของคนอื่นแสดงเป็น "ลา" รวม') + '</p>';
    return h;
  }

  ACT.odSave = async (a, btn) => {
    const m = S.month, vm = $('#od-m').value.trim(), vd = $('#od-d').value.trim();
    try {
      await busy(btn, async () => {
        let r = null;
        if (vd !== String((S.settings || {}).offDays || '')) r = await API.write({ op: 'offDays', n: vd });
        const curM = quotaMap()[m];
        if (vm !== (curM === undefined ? '' : String(curM))) r = await API.write({ op: 'offDays', month: m, n: vm });
        if (r) { S.settings.offDays = r.offDays; S.settings.offDaysMonth = r.offDaysMonth; }
      }, 'กำลังบันทึก…');
      toast('บันทึกวันหยุดแล้ว'); App.render();
    } catch (e) { toast(e.message); }
  };

  const at = sched.subs.findIndex(s => s.key === 'month');
  sched.subs.splice(at + 1, 0, { key: 'off', label: 'Days Off', perm: ['schedule_view', 'schedule_edit', 'time'], month: true, view: pOff });
})();
