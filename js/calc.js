/**
 * สูตรกลางของระบบเวลาทำงาน ใช้ร่วมกัน 2 ที่:
 *   apps-script/03_Calc.gs  (ฝั่ง Google)
 *   js/calc.js              (หน้าเว็บ)
 * สองไฟล์นี้ต้องเหมือนกันทุกตัวอักษร ถ้าแก้สูตร ให้คัดลอกทั้งไฟล์ไปวางอีกที่
 */
var Calc = (function () {
  function num(v) { var n = parseFloat(v); return isFinite(n) ? n : 0; }
  function bool(v) { return v === true || v === 'true' || v === 'TRUE' || v === 1 || v === '1'; }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function toMin(t) {
    if (t === null || t === undefined || t === '') return null;
    var p = String(t).split(':');
    var h = Number(p[0]), m = Number(p[1] || 0);
    return p[0] !== '' && isFinite(h) && isFinite(m) ? h * 60 + m : null;
  }
  function minToHM(m) { m = ((Math.round(m) % 1440) + 1440) % 1440; return pad(Math.floor(m / 60)) + ':' + pad(m % 60); }
  function ymdParts(d) { var p = String(d).split('-'); return [Number(p[0]), Number(p[1]), Number(p[2])]; }
  function weekday(d) { var p = ymdParts(d); return new Date(Date.UTC(p[0], p[1] - 1, p[2])).getUTCDay(); }
  function addDays(d, n) {
    var p = ymdParts(d), x = new Date(Date.UTC(p[0], p[1] - 1, p[2] + n));
    return x.getUTCFullYear() + '-' + pad(x.getUTCMonth() + 1) + '-' + pad(x.getUTCDate());
  }
  function daysInMonth(m) { var p = String(m).split('-'); return new Date(Date.UTC(Number(p[0]), Number(p[1]), 0)).getUTCDate(); }
  function upper(s) { return String(s || '').trim().toUpperCase(); }

  /** วันหยุดตามประเพณีจากการตั้งค่า (บรรทัดละวัน ขึ้นต้นด้วย yyyy-mm-dd) */
  function holidayMap(st) {
    var out = {};
    String((st && st.holidays) || '').split('\n').forEach(function (l) {
      var d = l.trim().slice(0, 10);
      if (/^\d{4}-\d{2}-\d{2}$/.test(d)) out[d] = l.trim().slice(10).trim() || 'วันหยุด';
    });
    return out;
  }
  function shiftIndex(shifts) { var o = {}; (shifts || []).forEach(function (s) { if (s.code) o[upper(s.code)] = s; }); return o; }
  function scheduleIndex(rows) { var o = {}; (rows || []).forEach(function (r) { if (r.date && r.empId) o[r.date + '|' + r.empId] = r; }); return o; }
  function isOffCode(code) { var c = upper(code); return c === 'OFF' || c === 'หยุด' || c === 'X'; }

  function patternIndex(rows) { var o = {}; (rows || []).forEach(function (r) { if (r.empId) o[r.empId] = r; }); return o; }

  /**
   * แผนงานของพนักงานในวันหนึ่ง เรียงลำดับความสำคัญ:
   * 1) ตารางงานของวันนั้น  2) รูปแบบกะรายสัปดาห์ของพนักงาน  3) เวลาตั้งต้นของร้าน
   * ctx = { sched: scheduleIndex(), patterns: patternIndex(), shifts: shiftIndex(), hol: holidayMap(), st: settings }
   * ผลลัพธ์มี branch = สาขาที่ทำงานวันนั้น (ตารางงานกำหนดสาขาอื่นได้ เช่น ยืมตัว)
   */
  function planFor(emp, date, ctx) {
    var st = ctx.st || {}, hol = ctx.hol || {};
    var row = ctx.sched[date + '|' + emp.id];
    var base = { date: date, pubHoliday: hol[date] || '', branch: (row && row.branch) || emp.branch || '' };
    function make(o) { for (var k in o) base[k] = o[k]; return base; }
    function fromShift(code, source, note) {
      if (isOffCode(code)) return make({ code: 'OFF', name: 'วันหยุด', off: true, source: source, note: note || '' });
      var s = ctx.shifts[code];
      return s ? make({ code: code, name: s.name || code, start: s.start, end: s.end, breakMin: s.breakMin, off: false, source: source, note: note || '' }) : null;
    }
    if (row && row.shift !== undefined && String(row.shift).trim() !== '') {
      var code = upper(row.shift);
      if (!isOffCode(code) && row.start && row.end) return make({ code: code, name: 'กำหนดเวลาเอง', start: row.start, end: row.end, breakMin: row.breakMin, off: false, source: 'ตารางงาน', note: row.note || '' });
      var r1 = fromShift(code, 'ตารางงาน', row.note);
      if (r1) return r1;
    }
    var pat = ctx.patterns && ctx.patterns[emp.id];
    var pc = pat ? upper(pat['d' + weekday(date)]) : '';
    if (pc) { var r2 = fromShift(pc, 'รูปแบบกะ'); if (r2) return r2; }
    return make({ code: '', name: 'เวลาปกติของร้าน', start: st.shiftStart || '07:00', end: st.shiftEnd || '16:00', breakMin: st.breakMin, off: false, source: 'ค่าตั้งต้น' });
  }

  /** ชั่วโมงตามแผน (หักพักถ้ากะยาวเกิน 5 ชม.) */
  function planMinutes(plan, st) {
    if (!plan || plan.off) return 0;
    var s = toMin(plan.start), e = toMin(plan.end);
    if (s === null || e === null) return 0;
    var len = ((e - s + 1440) % 1440) || 1440;
    var brk = plan.breakMin === undefined || plan.breakMin === null || plan.breakMin === '' ? num(st && st.breakMin) : num(plan.breakMin);
    return Math.max(0, len - (len > 300 ? brk : 0));
  }

  /** สาย ชั่วโมงทำงาน และ OT ของการลงเวลา 1 ครั้ง เทียบกับแผนของวันนั้น */
  function calcAtt(rec, plan, st) {
    st = st || {};
    var out = { lateMin: 0, workMin: 0, otMin: 0 };
    var i = toMin(rec.inTime), o0 = toMin(rec.outTime);
    if (i === null) return out;
    var brk = plan.breakMin === undefined || plan.breakMin === null || plan.breakMin === '' ? num(st.breakMin) : num(plan.breakMin);
    var otMinMin = st.otMinMinutes === '' || st.otMinMinutes === undefined || st.otMinMinutes === null ? 30 : num(st.otMinMinutes);
    var hpd = num(st.hoursPerDay) || 8;
    var s = toMin(plan.start), e = toMin(plan.end);
    if (plan.off || s === null) {
      if (o0 === null) return out;
      var oo = o0 < i ? o0 + 1440 : o0, sp = oo - i;
      out.workMin = Math.max(0, sp - (sp > 300 ? brk : 0));
      var extra = out.workMin - hpd * 60;
      out.otMin = plan.off && extra > 0 && extra >= otMinMin ? Math.floor(extra / 15) * 15 : 0;
      return out;
    }
    var sAbs = s;
    if (i - s > 720) sAbs += 1440; else if (s - i > 720) sAbs -= 1440;
    var late = i - sAbs;
    out.lateMin = late > num(st.lateGrace) ? late : 0;
    if (o0 === null) return out;
    var o = o0; if (o < i) o += 1440;
    var span = o - i;
    out.workMin = Math.max(0, span - (span > 300 ? brk : 0));
    var len = e === null ? 540 : (((e - s + 1440) % 1440) || 1440);
    var otRaw = o - (sAbs + len);
    out.otMin = otRaw > 0 && otRaw >= otMinMin ? Math.floor(otRaw / 15) * 15 : 0;
    return out;
  }

  /** ใส่แผนและผลคำนวณลงในรายการลงเวลา (คงสถานะอนุมัติเดิมไว้) */
  function applyPlan(rec, plan, st) {
    var r = calcAtt(rec, plan, st);
    if (!rec.branch) rec.branch = plan.branch || '';
    rec.planCode = plan.code || '';
    rec.planStart = plan.off ? '' : (plan.start || '');
    rec.planEnd = plan.off ? '' : (plan.end || '');
    rec.offWork = plan.off ? 'true' : 'false';
    rec.holiday = plan.off || plan.pubHoliday ? 'true' : 'false';
    rec.lateMin = r.lateMin; rec.workMin = r.workMin; rec.otMin = r.otMin;
    var decided = function (s) { return s === 'อนุมัติ' || s === 'ไม่อนุมัติ'; };
    rec.otStatus = r.otMin > 0 ? (decided(rec.otStatus) ? rec.otStatus : 'รออนุมัติ') : '';
    rec.offStatus = plan.off ? (decided(rec.offStatus) ? rec.offStatus : 'รออนุมัติ') : '';
    return rec;
  }

  /** จำนวนวันระหว่างสองวัน (นับทั้งสองฝั่ง) */
  function dayCount(from, to) {
    var a = ymdParts(from), b = ymdParts(to || from);
    return Math.round((Date.UTC(b[0], b[1] - 1, b[2]) - Date.UTC(a[0], a[1] - 1, a[2])) / 86400000) + 1;
  }

  return {
    num: num, bool: bool, pad: pad, toMin: toMin, minToHM: minToHM, weekday: weekday, addDays: addDays, daysInMonth: daysInMonth,
    upper: upper, holidayMap: holidayMap, shiftIndex: shiftIndex, scheduleIndex: scheduleIndex, patternIndex: patternIndex, isOffCode: isOffCode,
    planFor: planFor, planMinutes: planMinutes, calcAtt: calcAtt, applyPlan: applyPlan, dayCount: dayCount
  };
})();
