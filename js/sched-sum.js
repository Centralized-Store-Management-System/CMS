/* Schedule > Days Off (สรุปวันหยุด) + เชื่อมกับหน้า Roster
 * - กำหนดวันหยุดต่อเดือน: ค่าปกติ + เดือนที่ต่างจากปกติ (เฉพาะผู้มีสิทธิ์จัดตาราง) · คนดูอย่างเดียวเห็นค่าที่ตั้ง
 * - สรุปรายคน: วันทำงาน · วันหยุดตามตาราง เทียบที่กำหนด · ลาที่ใช้เดือนนี้ · สิทธิ์ลาคงเหลือทั้งปี · รออนุมัติ
 * - Roster: "หยุด 3/4" ใต้ชื่อ · ตรวจตาราง เตือนคนที่หยุดขาด/เกิน
 * - Staff (ดูอย่างเดียว) เห็นเฉพาะของตัวเอง: สรุปวันหยุด สิทธิ์ลา ชั่วโมงตามตาราง ป้ายหยุดใน Roster
 * - คำนวณจากข้อมูลที่มีในเครื่องแล้ว ไม่ดึงข้อมูลเพิ่มจาก Apps Script */
'use strict';
(function () {
  const sched = MODS.find(m => m.key === 'sched');
  if (!sched || !sched.subs) return;
  const LT = [['ลาพักร้อน', 'พักร้อน', 'annualDays'], ['ลาป่วย', 'ป่วย', 'sickPaidDays'], ['ลากิจ', 'กิจ', 'personalPaidDays']];
  const seeAll = () => can('schedule_edit', 'time', 'approve_time', 'hr');
  const meId = () => (S.me && S.me.empId) || '';

  function quotaMap() { try { return JSON.parse((S.settings || {}).offDaysMonth || '{}') || {}; } catch (e) { return {}; } }
  function quotaFor(m) {
    const mm = quotaMap();
    if (mm[m] !== undefined && mm[m] !== '') return { n: Number(mm[m]), month: true };
    const d = (S.settings || {}).offDays;
    return d !== undefined && d !== '' ? { n: Number(d), month: false } : null;
  }

  /** วันลาของใบลา l ที่ตกในช่วง a..b (ใช้จำนวนวันในใบลาถ้าอยู่ในช่วงทั้งใบ เช่น ลาครึ่งวัน) */
  function lvDays(l, a, b) {
    const f = String(l.dateFrom || ''), t = String(l.dateTo || l.dateFrom || '');
    if (!f || t < a || f > b) return 0;
    if (f >= a && t <= b && num(l.days) > 0) return num(l.days);
    let n = 0; for (let d = f > a ? f : a; d <= (t < b ? t : b); d = addDays(d, 1)) n++;
    return n;
  }
  /** เดือนนี้: ลาแยกประเภท (อนุมัติ) + รออนุมัติ */
  function leaveSum(empId, dates) {
    const out = { pend: 0 }, first = dates[0], last = dates[dates.length - 1];
    (S.t.leaves || []).forEach(l => {
      if (l.empId !== empId) return;
      const n = lvDays(l, first, last); if (!n) return;
      if (l.status === 'รออนุมัติ') { out.pend += n; return; }
      if (l.status !== 'อนุมัติ') return;
      const k = LT.some(([t]) => t === l.type) ? l.type : 'อื่น';
      out[k] = (out[k] || 0) + n;
    });
    return out;
  }
  /** สิทธิ์ลาคงเหลือทั้งปี (ถึงสิ้นเดือนที่ดู) · พักร้อนเกิดเมื่อทำงานครบ 1 ปี */
  function leaveLeft(e, m) {
    const y = m.slice(0, 4), a = y + '-01-01', b = y + '-12-31', st = S.settings || {};
    const typed = (S.t.leaves || []).some(l => l.empId === e.id && LT.some(([t]) => t === l.type));
    const own = e.id === meId();
    if (!typed && !own && !can('time', 'approve_time')) return null;   // ไม่เห็นประเภทลาของคนนี้
    const endM = m + '-' + pad(new Date(+y, +m.slice(5), 0).getDate());
    return LT.map(([t, s, k]) => {
      const quota = num(st[k]);
      if (!quota) return null;
      if (k === 'annualDays' && e.startDate && addDays(e.startDate, 365) > endM) return { s, txt: `${s} ยังไม่ครบ 1 ปี`, left: null };
      const used = (S.t.leaves || []).filter(l => l.empId === e.id && l.type === t && l.status === 'อนุมัติ').reduce((x, l) => x + lvDays(l, a, b), 0);
      return { s, left: Math.max(0, quota - used), quota };
    }).filter(Boolean);
  }

  const partOf = e => (e.payType && e.payType !== 'monthly') || /พาร์ท|part/i.test(String(e.position || '') + String(e.status || ''));
  function rowFor(e, dates, ctx) {
    let work = 0, off = 0, none = 0, outside = 0;
    dates.forEach(d => {
      if (!employed(e, d)) { outside++; return; }
      if (leaveOn(e.id, d, ['อนุมัติ'])) return;
      const p = Calc.planFor(e, d, ctx);
      if (p.off) off++; else if (p.source === 'ค่าตั้งต้น') none++; else work++;
    });
    return { e, work, off, none, outside, part: partOf(e), lv: leaveSum(e.id, dates) };
  }
  function rowsFor(b, m) {
    const dates = monthDates(m), ctx = schedView();
    let emps = homeEmps(b, m);
    if (!seeAll()) emps = emps.filter(e => e.id === meId());
    return emps.map(e => rowFor(e, dates, ctx));
  }
  const fq = n => (Math.round(n * 2) / 2).toString();
  const offState = (r, q) => {
    if (r.part) return { c: '', t: 'พาร์ทไทม์' };
    if (!q || r.outside) return null;
    const d = r.off - q.n;
    return d === 0 ? { c: 'ok', t: 'ครบ', d } : d < 0 ? { c: 'warn', t: `ขาด ${fq(-d)}`, d } : { c: 'bad', t: `เกิน ${fq(d)}`, d };
  };

  /* ---------------- แท็บ Days Off ---------------- */
  function pOff() {
    const m = S.month, b = oneBranch(), all = seeAll();
    if (!b) return `<div class="group">${empty('ยังไม่มีสาขา')}</div>`;
    const edit = can('schedule_edit'), q = quotaFor(m), R = rowsFor(b, m);
    let h = all ? branchSeg() : '';
    if (edit) {
      const def = (S.settings || {}).offDays || '', mm = quotaMap()[m];
      h += `<h3 class="h3">วันหยุดที่กำหนด</h3><div class="group pad"><div class="form">
        <div class="field half"><label for="od-m">${esc(thMonth(m))} (วัน/คน)</label><input id="od-m" type="number" inputmode="decimal" min="0" max="31" step="0.5" value="${esc(mm !== undefined ? mm : '')}" placeholder="${def ? 'ใช้ค่าปกติ ' + esc(def) : 'เช่น 4'}"><span class="help">เว้นว่าง = ใช้ค่าปกติ</span></div>
        <div class="field half"><label for="od-d">ค่าปกติทุกเดือน (วัน/คน)</label><input id="od-d" type="number" inputmode="decimal" min="0" max="31" step="0.5" value="${esc(def)}" placeholder="เช่น 4"></div>
      </div><div class="actions" style="margin-bottom:0"><button class="btn primary" data-a="odSave">บันทึก</button></div></div>`;
    } else {
      h += `<div class="group pad"><b>${esc(thMonth(m))}: ${q ? `หยุดได้ ${fq(q.n)} วัน/คน` : 'ยังไม่ได้กำหนดวันหยุดต่อเดือน'}</b><p class="muted" style="margin:4px 0 0">กำหนดโดยผู้จัดตารางงาน</p></div>`;
    }
    if (!R.length) return h + `<div class="group">${empty(all ? 'ไม่มีพนักงานในสาขานี้' : 'ไม่พบข้อมูลพนักงานของคุณในสาขานี้')}</div>`;
    const S2 = R.map(r => offState(r, q)), short = S2.filter(s => s && s.c === 'warn').length, over = S2.filter(s => s && s.c === 'bad').length;
    h += `<h3 class="h3">${all ? 'สรุป' : 'ของฉัน '}${esc(thMonth(m))} ${all && q ? `${short ? `<span class="chip warn">หยุดไม่ครบ ${short}</span> ` : ''}${over ? `<span class="chip bad">หยุดเกิน ${over}</span>` : ''}${!short && !over ? '<span class="chip ok">ครบทุกคน</span>' : ''}` : ''}</h3>`;
    h += `<div class="group">${R.map((r, i) => {
      const bits = [`ทำงาน ${r.work} วัน`];
      LT.forEach(([t, s]) => { if (r.lv[t]) bits.push(`ลา${s} ${fq(r.lv[t])}`); });
      if (r.lv['อื่น']) bits.push(`ลา ${fq(r.lv['อื่น'])}`);
      if (r.lv.pend) bits.push(`<span class="chip warn">ลารออนุมัติ ${fq(r.lv.pend)}</span>`);
      if (r.none) bits.push(`<span class="chip">ยังไม่จัดตาราง ${r.none} วัน</span>`);
      if (r.outside) bits.push('<span class="chip">ไม่ได้อยู่ทั้งเดือน</span>');
      const left = r.part ? null : leaveLeft(r.e, m);
      const leftLine = left && left.length ? `<span class="s">สิทธิ์ลาคงเหลือปีนี้: ${left.map(x => x.left === null ? esc(x.txt) : `${x.s} <b>${fq(x.left)}</b>/${fq(x.quota)}`).join(' · ')}</span>` : '';
      const s = S2[i];
      return `<div class="row static">${avatar(r.e)}<span class="main"><span class="t">${esc(shortName(r.e))}</span><span class="s">${bits.join(' · ')}</span>${leftLine}</span><span class="v" style="text-align:right;white-space:nowrap"><b style="font-size:17px">หยุด ${r.off}${q && !r.part ? `<small class="muted">/${fq(q.n)}</small>` : ''}</b><br>${s ? `<span class="chip ${s.c}">${s.t}</span>` : ''}</span></div>`;
    }).join('')}</div>`;
    if (all) {
      const tot = k => R.reduce((x, r) => x + (r.lv[k] || 0), 0);
      h += `<div class="group">${statRow('รวมทั้งสาขา', `หยุด ${R.reduce((x, r) => x + r.off, 0)} วัน`, [`ทำงาน ${R.reduce((x, r) => x + r.work, 0)} วัน`, ...LT.map(([t, s]) => tot(t) ? `ลา${s} ${fq(tot(t))}` : ''), tot('อื่น') ? `ลาอื่นๆ ${fq(tot('อื่น'))}` : ''].filter(Boolean).join(' · '))}</div>`;
    }
    h += '<p class="note">นับจากตารางงาน (หยุด = วันหยุดในตาราง ไม่รวมวันลา) และใบลาที่อนุมัติแล้ว · สิทธิ์ลานับทั้งปี ตามที่ตั้งไว้ใน Settings' + (all ? '' : ' · แสดงเฉพาะของคุณ') + '</p>';
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

  /* ---------------- Roster: ตรวจตาราง เตือนวันหยุดขาด/เกิน ---------------- */
  if (typeof rosterChecks === 'function') {
    const orig = rosterChecks;
    rosterChecks = function (b, dates, emps, home, ctx) {
      const items = orig.apply(this, arguments), q = quotaFor(String(dates[0]).slice(0, 7));
      if (q) home.forEach(e => {
        const r = rowFor(e, dates, ctx), s = offState(r, q);
        if (!s || !s.d || r.part) return;
        items.push({ t: shortName(e), s: `วันหยุดตามตาราง <b>${r.off} วัน</b> กำหนด ${fq(q.n)} วัน (${s.d < 0 ? 'ขาด ' + fq(-s.d) : 'เกิน ' + fq(s.d)})${r.none ? ` · ยังไม่จัดตาราง ${r.none} วัน` : ''}`, c: 'warn' });
      });
      return items;
    };
  }

  /* ---------------- Roster: ป้าย "หยุด 3/4" ใต้ชื่อ + Staff เห็นชั่วโมงของตัวเอง ---------------- */
  const rsub = sched.subs.find(s => s.key === 'month');
  if (rsub && rsub.view) {
    const view = rsub.view;
    rsub.view = function () {
      const h = view.apply(this, arguments), m = S.month, b = oneBranch();
      if (!b || h.indexOf('class="roster"') < 0) return h;
      try {
        const box = document.createElement('div'); box.innerHTML = h;
        const q = quotaFor(m), dates = monthDates(m), ctx = schedView(), all = seeAll(), mine = meId();
        const home = new Map(homeEmps(b, m).map(e => [e.id, e]));
        box.querySelectorAll('table.roster tbody tr').forEach(tr => {
          const nm = tr.querySelector('td.rname'), cell = tr.querySelector('[data-a^="cell:"], [data-cell]');
          if (!nm || !cell) return;
          const id = (cell.dataset.cell || cell.dataset.a.slice(5)).split('/')[0], e = home.get(id);
          if (!e || (!all && id !== mine)) return;
          const r = rowFor(e, dates, ctx), s = offState(r, q);
          nm.insertAdjacentHTML('beforeend', `<small class="rs-off${s && s.c ? ' ' + s.c : ''}">หยุด ${r.off}${q && !r.part ? '/' + fq(q.n) : ''}</small>`);
        });
        if (!all) {   // ชั่วโมงตามตาราง: เฉพาะของตัวเอง
          const h3 = [...box.querySelectorAll('h3.h3')].find(x => x.textContent.indexOf('ชั่วโมงตามตาราง') === 0);
          const g = h3 && h3.nextElementSibling, e = home.get(mine);
          if (g) {
            if (!e) { h3.remove(); g.remove(); }
            else { let mins = 0, days = 0; dates.forEach(d => { const p = Calc.planFor(e, d, ctx); if (working(p, e, d)) { days++; mins += Calc.planMinutes(p, S.settings); } }); g.innerHTML = statRow(esc(shortName(e)) + ' (ฉัน)', hrsShort(mins), `${days} วันทำงาน`); }
          }
        }
        return box.innerHTML;
      } catch (err) { return h; }
    };
  }
  const css = document.createElement('style');
  css.textContent = '.roster td.rname small.rs-off{display:block;font-weight:600;color:var(--muted)}.roster td.rname small.rs-off.ok{color:var(--ok)}.roster td.rname small.rs-off.warn{color:var(--warn)}.roster td.rname small.rs-off.bad{color:var(--bad)}';
  document.head.appendChild(css);

  const at = sched.subs.findIndex(s => s.key === 'month');
  sched.subs.splice(at + 1, 0, { key: 'off', label: 'Days Off', perm: ['schedule_view', 'schedule_edit', 'time'], month: true, view: pOff });
})();
