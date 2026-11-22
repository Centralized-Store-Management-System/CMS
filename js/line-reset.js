/* ลืม PIN: รับรหัส 6 หลักทาง LINE ที่ผูกไว้ แล้วตั้ง PIN ใหม่เอง (ฝั่งเซิร์ฟเวอร์ 61_LineReset.gs)
 * - ปุ่มขึ้นเฉพาะเมื่อรหัสพนักงาน / ชื่อผู้ใช้ที่พิมพ์ "ผูก LINE แล้ว" (ถามเซิร์ฟเวอร์ lineResetCheck) — ไม่ผูก = ไม่เห็นปุ่ม
 * - อยู่ทุกหน้าจอที่มีการเข้าระบบ: หลังร้าน (PC / มือถือ / iPad), หน้าลงเวลา (ใส่รหัส + ใส่ PIN)
 *   ปุ่ม "ลืมรหัส" ของแอปล็อกเครื่องพากลับมาหน้าเหล่านี้อยู่แล้ว จึงได้ปุ่มนี้ด้วย
 * - ไม่แสดงใน LINE / LIFF (พิมพ์ "ลืม PIN" ในแชตได้เลย) และเมื่อเปิดจากหน้าหลักเจ้าของร้าน (Owner ใช้ Authenticator)
 * - แทน email-otp.js (เลิกใช้แล้ว ไม่ต้องโหลด) */
(function () {
  const e = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const BTN = '<button type="button" class="linkbtn" data-lreset style="font-size:14px" hidden>ลืม PIN? ขอรหัสทาง LINE</button>';
  const can = new Map();        // รหัส(ตัวพิมพ์เล็ก) → true | false (เซิร์ฟเวอร์ตอบแล้ว)
  const asked = new Set();      // รหัสที่กำลังถาม/ถามแล้ว (ไม่ถามซ้ำ)
  let timer = 0;

  const hidden = () => {
    if (typeof C !== 'undefined' && C && C.liff) return true;                       // ใน LINE ไม่แสดง
    try { return sessionStorage.getItem('amz.fromOwner') === '1'; } catch (x) { return false; }
  };
  /** รหัสที่ใช้อยู่บนหน้าจอตอนนี้: หลังร้าน = ช่อง Username · หน้าลงเวลา = ช่องรหัสพนักงาน หรือรหัสที่เลือกแล้วในขั้นใส่ PIN */
  const curCode = () => {
    const v = id => { const el = document.getElementById(id); return el ? el.value.trim() : ''; };
    if (document.getElementById('lg-code')) return v('lg-code');
    if (typeof C !== 'undefined' && C && C.step === 'pin' && C.emp && C.emp.code) return String(C.emp.code).trim();
    return v('ck-code');
  };
  const key = c => String(c || '').trim().toLowerCase();
  const isSetup = () => typeof C !== 'undefined' && C && C.step === 'pin' && C.su;   // ตั้ง PIN ครั้งแรก: ใช้รหัสเปิดใช้งานจาก Owner/HR ไม่ใช่ปุ่มนี้

  function put() {
    if (hidden()) return;
    const alt = document.querySelector('.login-alt');
    if (alt && !alt.querySelector('[data-lreset]')) alt.insertAdjacentHTML('afterbegin', BTN);
    const who = document.querySelector('form.who-form');
    if (who && !document.querySelector('[data-lr-who]')) who.insertAdjacentHTML('afterend', `<p class="login-alt" data-lr-who style="text-align:center;margin-top:10px">${BTN}</p>`);
    const pin = document.getElementById('pin-input');
    if (pin && !isSetup() && !document.querySelector('[data-lr-pin]')) {
      const act = pin.closest('.clock-shell') && pin.closest('.clock-shell').querySelector('.actions');
      if (act) act.insertAdjacentHTML('afterend', `<p class="login-alt" data-lr-pin style="text-align:center;margin-top:6px">${BTN}</p>`);
    }
    refresh();
  }
  function show() {
    const c = key(curCode()), ok = can.get(c) === true && !isSetup();
    document.querySelectorAll('[data-lreset]').forEach(b => { b.hidden = !ok; });
  }
  function refresh() {
    show();
    const raw = curCode(), c = key(raw);
    if (c.length < 2 || can.has(c) || asked.has(c)) return;
    clearTimeout(timer);
    timer = setTimeout(async () => {          // รอให้พิมพ์เสร็จก่อน กันถามเซิร์ฟเวอร์ถี่
      if (key(curCode()) !== c || asked.has(c)) return;
      asked.add(c);
      try { const r = await API.call('lineResetCheck', { code: raw }); can.set(c, !!(r && r.can)); }
      catch (x) { asked.delete(c); }          // ถามไม่ได้ / ถามถี่เกิน → ไม่แสดงปุ่ม ไว้ลองใหม่เมื่อพิมพ์อีกครั้ง
      show();
    }, 600);
  }

  function open(code) {
    const sh = openSheet(`<h2 style="margin:0 0 6px">ลืม PIN</h2>
      <p class="muted" style="margin:0 0 12px">ระบบส่งรหัส 6 หลักไปที่ LINE ที่คุณผูกไว้กับร้าน แล้วตั้ง PIN ใหม่เอง · ใช้ได้เฉพาะคนที่ผูก LINE แล้ว</p>
      <div class="form"><div class="field"><label for="lr-code">รหัสพนักงาน หรือชื่อผู้ใช้</label><input id="lr-code" autocapitalize="none" spellcheck="false" value="${e(code || '')}" placeholder="เช่น A123"></div></div>
      <div id="lr-step2" hidden><p class="status good">ส่งรหัสไปที่ LINE ของคุณแล้ว <span id="lr-min"></span> เปิดแชต LINE ของร้านเพื่อดูรหัส</p><div class="form">
        <div class="field"><label for="lr-otp">รหัส 6 หลักจาก LINE</label><input id="lr-otp" inputmode="numeric" maxlength="6" autocomplete="one-time-code"></div>
        <div class="field"><label for="lr-p1">ตั้ง PIN ใหม่ 6 หลัก</label><input id="lr-p1" type="password" inputmode="numeric" maxlength="6" autocomplete="new-password"></div>
        <div class="field"><label for="lr-p2">ใส่ PIN อีกครั้ง</label><input id="lr-p2" type="password" inputmode="numeric" maxlength="6" autocomplete="new-password"></div></div></div>
      <p class="err" id="lr-err" role="alert"></p>
      <div class="actions"><button class="btn" data-lr-x>ปิด</button><span class="grow"></span><button class="btn" data-lr-send>ส่งรหัสทาง LINE</button><button class="btn primary" data-lr-ok hidden>ตั้ง PIN แล้วเข้าระบบ</button></div>`);
    const $s = q => sh.querySelector(q), err = m => { $s('#lr-err').textContent = m || ''; };
    $s('[data-lr-x]').onclick = () => closeSheet();
    $s('[data-lr-send]').onclick = async ev => {
      err();
      try {
        const r = await busy(ev.target, () => API.call('lineResetSend', { code: $s('#lr-code').value.trim() }), 'กำลังส่ง…');
        $s('#lr-step2').hidden = false; $s('[data-lr-ok]').hidden = false; ev.target.textContent = 'ส่งรหัสใหม่';
        $s('#lr-min').textContent = `(ใช้ได้ ${r.minutes} นาที)`; $s('#lr-otp').focus();
      } catch (x) { err(x.message); }
    };
    $s('[data-lr-ok]').onclick = async ev => {
      err();
      const c = $s('#lr-code').value.trim(), pin = $s('#lr-p1').value.trim();
      try {
        const r = await busy(ev.target, () => API.call('lineResetVerify', { code: c, otp: $s('#lr-otp').value.trim(), pin, pin2: $s('#lr-p2').value.trim() }), 'กำลังตรวจ…');
        closeSheet();
        const lc = document.getElementById('lg-code'), lp = document.getElementById('lg-pin'), go = document.querySelector('[data-a="login"]');
        if (lc && lp && go) { lc.value = r.username; lp.value = pin; go.click(); }   // หลังร้าน: เข้าระบบด้วย PIN ใหม่ทันที
        else {
          const ck = document.getElementById('ck-code'); if (ck) ck.value = c;
          if (typeof C !== 'undefined' && C && C.pinErr) C.pinErr = '';
          if (typeof toast === 'function') toast('ตั้ง PIN แล้ว ใช้รหัสพนักงาน + PIN ใหม่ได้เลย');
        }
      } catch (x) { err(x.message); }
    };
  }

  document.addEventListener('click', ev => { if (ev.target.closest('[data-lreset]')) { ev.preventDefault(); open(curCode()); } });
  document.addEventListener('input', ev => { if (ev.target && /^(lg-code|ck-code)$/.test(ev.target.id)) refresh(); });
  const go = () => { put(); new MutationObserver(put).observe(document.getElementById('root') || document.body, { childList: true, subtree: true }); };
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', go) : go();
})();
