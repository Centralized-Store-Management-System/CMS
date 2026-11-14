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

  /* ================= เงินเดือน (สูตรเดียวทั้งหน้าเว็บและ Apps Script ตัวเลขตรงกันทุกสตางค์) ================= */
  function r2(n) { return Math.round((Number(n) || 0) * 100 + (n >= 0 ? 1e-7 : -1e-7)) / 100; }
  /** ภาษีหัก ณ ที่จ่ายโดยประมาณ (หักค่าใช้จ่าย 50% ไม่เกิน 100,000 ลดหย่อนส่วนตัว 60,000 และประกันสังคม) */
  function estTax(gross, sso) {
    var annual = gross * 12, net = annual - Math.min(annual * 0.5, 100000) - 60000 - sso * 12;
    if (net <= 0) return 0;
    var B = [[150000, 0], [300000, 0.05], [500000, 0.10], [750000, 0.15], [1000000, 0.20], [2000000, 0.25], [5000000, 0.30], [Infinity, 0.35]], tax = 0, prev = 0;
    for (var i = 0; i < B.length; i++) { if (net > prev) tax += (Math.min(net, B[i][0]) - prev) * B[i][1]; prev = B[i][0]; }
    return Math.round(tax / 12);
  }
  /** จำนวนวันลาที่ตกในช่วง [from, to] ของใบลา (ใบลาข้ามเดือนแบ่งตามวัน ครึ่งวันคิด 0.5) */
  function leaveDaysIn(l, from, to) {
    var a = l.dateFrom, b = l.dateTo || l.dateFrom;
    if (!a || b < from || a > to) return 0;
    var span = dayCount(a, b), days = num(l.days) || span, s = a < from ? from : a, e = b > to ? to : b;
    return days * dayCount(s, e) / span;
  }
  /**
   * เงินเดือน 1 คน 1 งวด
   * x = { emp, month, f (สัดส่วนเดือน 1 = ทั้งเดือน), today, st (ตั้งค่า), att (ลงเวลาของเดือนนี้), leaves (ใบลาอนุมัติแล้วของปีนี้),
   *       otreq (คำขอ OT อนุมัติแล้วของเดือนนี้), saved (แถวเงินเดือนที่บันทึกไว้: เบี้ยเลี้ยง โบนัส หักอื่น หมายเหตุ) }
   * กติกา:
   * - รายเดือน: เงินเดือนเต็ม (เริ่มงาน/ลาออกกลางเดือน คิดตามวันที่เป็นพนักงาน /30) หักขาดงาน + ลาไม่รับค่าจ้าง + ลาเกินสิทธิ์ (ค่าจ้างรายวัน = เดือน/30) หักสายตามนาที
   * - รายวัน: วันที่มาทำงาน (ไม่รวมวันหยุด) + ลาได้ค่าจ้าง + วันหยุดตามประเพณีที่ไม่ได้มาทำงาน
   * - รายชั่วโมง: ชั่วโมงทำงานจริง (ไม่รวมวันหยุด)
   * - ทำงานวันหยุดของตัวเองที่ยังไม่อนุมัติ: ยังไม่คิดเงิน
   * - ทำงานในวันหยุด: รายเดือนเพิ่ม 1 เท่า รายวัน/รายชั่วโมง 2 เท่า (ไม่เกินชั่วโมงทำงานปกติต่อวัน)
   * - OT: เฉพาะที่อนุมัติ (ใช้นาทีที่ผู้อนุมัติแก้ถ้ามี) อัตราคงที่ st.otRate บาท/ชม. (0 = 1.5 เท่า / วันหยุด 3 เท่า ของค่าจ้างรายชั่วโมง)
   * - สิทธิ์ลาได้ค่าจ้างนับรวมทั้งปี ลาเกินสิทธิ์ = ไม่ได้ค่าจ้าง
   */
  function payroll(x) {
    var e = x.emp, st = x.st || {}, month = x.month, f = x.f === undefined ? 1 : x.f, sv = x.saved || null;
    var hpd = num(st.hoursPerDay) || 8, hol = holidayMap(st), dim = daysInMonth(month), first = month + '-01', last = month + '-' + pad(dim);
    var rate = num(e.rate), type = e.payType || 'monthly';
    var daily = type === 'monthly' ? rate / 30 : type === 'daily' ? rate : rate * hpd, hourly = type === 'hourly' ? rate : daily / hpd;
    // ใบลา
    var lv = (x.leaves || []).filter(function (l) { return l.empId === e.id && l.status === 'อนุมัติ'; });
    var inRange = function (t, a, b) { return lv.filter(function (l) { return l.type === t; }).reduce(function (s, l) { return s + leaveDaysIn(l, a, b); }, 0); };
    var yearStart = month.slice(0, 4) + '-01-01', before = addDays(first, -1);
    var split = function (t, quota) { var used = first > yearStart ? inRange(t, yearStart, before) : 0, now = inRange(t, first, last), remain = Math.max(0, quota - used); return [Math.min(now, remain), Math.max(0, now - remain)]; };
    var sk = split('ลาป่วย', num(st.sickPaidDays)), ps = split('ลากิจ', num(st.personalPaidDays)), an = split('ลาพักร้อน', num(st.annualDays));
    var absent = inRange('ขาดงาน', first, last), unpaid = inRange('ลาไม่รับค่าจ้าง', first, last) + sk[1] + ps[1] + an[1], paidLeave = sk[0] + ps[0] + an[0];
    // ลงเวลา
    var workMin = 0, normMin = 0, lateMin = 0, otN = 0, otH = 0, holMin = 0, holDays = 0, normDays = 0, worked = {}, skipped = 0;
    (x.att || []).forEach(function (a) {
      if (a.empId !== e.id || !a.inTime || String(a.date).slice(0, 7) !== month) return;
      if (a.offWork === 'true' && a.offStatus !== 'อนุมัติ') { skipped++; return; }
      var wm = num(a.workMin), ot = a.otStatus === 'อนุมัติ' ? (a.otOk !== '' && a.otOk !== undefined && a.otOk !== null ? num(a.otOk) : num(a.otMin)) : 0;
      worked[a.date] = 1; workMin += wm;
      if (bool(a.holiday)) { holDays++; holMin += Math.min(wm, hpd * 60); otH += ot; }
      else { normDays++; normMin += wm; lateMin += num(a.lateMin); otN += ot; }
    });
    (x.otreq || []).forEach(function (r) {
      if (r.empId !== e.id || r.status !== 'อนุมัติ' || String(r.date).slice(0, 7) !== month) return;
      var m = r.otOk !== '' && r.otOk !== undefined && r.otOk !== null ? num(r.otOk) : num(r.minutes);
      if (hol[r.date]) otH += m; else otN += m;
    });
    // วันที่เป็นพนักงานในเดือนนี้
    var s0 = e.startDate && e.startDate > first ? e.startDate : first, e0 = e.endDate && e.endDate < last && e.status === 'ลาออก' ? e.endDate : last;
    var empDays = e0 < s0 ? 0 : dayCount(s0, e0), fullMonth = s0 === first && e0 === last;
    var base;
    if (type === 'monthly') base = fullMonth ? rate * f : Math.min(rate, daily * empDays) * f;
    else if (type === 'daily') {
      var paidHol = Object.keys(hol).filter(function (d) { return d >= s0 && d <= e0 && !worked[d] && (!x.today || d <= x.today); }).length;
      base = (normDays + paidLeave + paidHol) * rate;
    } else base = normMin / 60 * rate;
    var absentDed = type === 'monthly' ? Math.min(base, (absent + unpaid) * daily) : 0;
    var lateDed = lateMin / 60 * hourly;
    var otFlat = st.otRate === '' || st.otRate === undefined || st.otRate === null ? 50 : num(st.otRate);
    var otPay = otFlat > 0 ? (otN + otH) / 60 * otFlat : otN / 60 * hourly * 1.5 + otH / 60 * hourly * 3;
    var holPay = holMin / 60 * hourly * (type === 'monthly' ? 1 : 2);
    var allowance = num(sv && sv.allowance), bonus = num(sv && sv.bonus), otherDed = num(sv && sv.otherDed);
    var gross = Math.max(0, r2(base) - r2(absentDed) - r2(lateDed) + r2(otPay) + r2(holPay) + allowance + bonus);
    var ssoBase = bool(st.ssoIncludeOT) ? gross : gross - r2(otPay) - r2(holPay);
    var sso = bool(e.ssoEnrolled) && gross > 0 ? Math.round(Math.min(Math.max(ssoBase, num(st.ssoFloor)), num(st.ssoCeil) || Infinity) * num(st.ssoRate) / 100) : 0;
    var tax = estTax(gross, sso);
    return {
      id: month + '_' + e.id, period: month, empId: e.id, branch: e.branch || '', status: (sv && sv.status) || 'ร่าง', payType: type, rate: rate,
      workDays: normDays + holDays, workMin: workMin, lateMin: lateMin, otMin: otN + otH, absent: r2(absent), unpaid: r2(unpaid), paidLeave: r2(paidLeave),
      base: r2(base), absentDed: r2(absentDed), lateDed: r2(lateDed), otPay: r2(otPay), holPay: r2(holPay),
      allowance: allowance, bonus: bonus, otherDed: otherDed, gross: r2(gross), sso: sso, employerSso: sso, tax: tax, net: r2(gross - sso - tax - otherDed),
      note: (sv && sv.note) || '', skippedOff: skipped, empDays: empDays
    };
  }
  /** พนักงานที่ต้องอยู่ในงวดนี้ */
  function payrollEmps(emps, month, saved) {
    var first = month + '-01', last = month + '-' + pad(daysInMonth(month));
    return (emps || []).filter(function (e) { return (!e.startDate || e.startDate <= last) && (e.status !== 'ลาออก' || (e.endDate || '') >= first || (saved && saved[e.id])); });
  }

  return {
    num: num, bool: bool, pad: pad, toMin: toMin, minToHM: minToHM, weekday: weekday, addDays: addDays, daysInMonth: daysInMonth,
    upper: upper, holidayMap: holidayMap, shiftIndex: shiftIndex, scheduleIndex: scheduleIndex, patternIndex: patternIndex, isOffCode: isOffCode,
    planFor: planFor, planMinutes: planMinutes, calcAtt: calcAtt, applyPlan: applyPlan, dayCount: dayCount,
    r2: r2, estTax: estTax, leaveDaysIn: leaveDaysIn, payroll: payroll, payrollEmps: payrollEmps
  };
})();
