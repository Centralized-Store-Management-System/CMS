/* ไม่มี LINE / ลืม PIN: รับรหัสทางอีเมล แล้วตั้ง PIN เอง (47_EmailOtp.gs) — หน้า Sign in หลังร้าน และหน้าลงเวลา (เว็บ) ไม่แสดงใน LINE */
(function () {
  const e = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const LINK = '<button type="button" class="linkbtn" data-otp style="font-size:14px">ไม่มี LINE / ลืม PIN? รับรหัสทางอีเมล</button>';
  function put() {
    if (typeof C !== 'undefined' && C.liff) return;
    const alt = document.querySelector('.login-alt');
    if (alt && !alt.querySelector('[data-otp]')) alt.insertAdjacentHTML('afterbegin', LINK);
    const who = document.querySelector('form.who-form');
    if (who && !document.querySelector('[data-otp-clock]')) who.insertAdjacentHTML('afterend', `<p class="login-alt" data-otp-clock style="text-align:center;margin-top:10px">${LINK}</p>`);
  }
  function open(code) {
    const sh = openSheet(`<h2 style="margin:0 0 6px">รับรหัสทางอีเมล</h2>
      <p class="muted" style="margin:0 0 12px">สำหรับคนที่ไม่มี LINE หรือลืม PIN · ระบบส่งรหัส 6 หลักไปที่อีเมลที่ HR บันทึกไว้ แล้วตั้ง PIN ใหม่เอง</p>
      <div class="form"><div class="field"><label for="ot-code">รหัสพนักงาน หรือชื่อผู้ใช้</label><input id="ot-code" autocapitalize="none" spellcheck="false" value="${e(code || '')}" placeholder="เช่น E001"></div></div>
      <div id="ot-step2" hidden><p class="status good" id="ot-to"></p><div class="form">
        <div class="field"><label for="ot-otp">รหัส 6 หลักจากอีเมล</label><input id="ot-otp" inputmode="numeric" maxlength="6" autocomplete="one-time-code"></div>
        <div class="field"><label for="ot-p1">ตั้ง PIN ใหม่ 6 หลัก</label><input id="ot-p1" type="password" inputmode="numeric" maxlength="6" autocomplete="new-password"></div>
        <div class="field"><label for="ot-p2">ใส่ PIN อีกครั้ง</label><input id="ot-p2" type="password" inputmode="numeric" maxlength="6" autocomplete="new-password"></div></div></div>
      <p class="err" id="ot-err" role="alert"></p>
      <div class="actions"><button class="btn" data-ot-x>ปิด</button><span class="grow"></span><button class="btn" data-ot-send>ส่งรหัสไปที่อีเมล</button><button class="btn primary" data-ot-ok hidden>ตั้ง PIN แล้วเข้าระบบ</button></div>`);
    const $s = q => sh.querySelector(q), err = m => { $s('#ot-err').textContent = m || ''; };
    $s('[data-ot-x]').onclick = () => closeSheet();
    $s('[data-ot-send]').onclick = async ev => {
      err();
      try {
        const r = await busy(ev.target, () => API.call('otpSend', { code: $s('#ot-code').value.trim() }), 'กำลังส่ง…');
        $s('#ot-step2').hidden = false; $s('[data-ot-ok]').hidden = false; ev.target.textContent = 'ส่งรหัสใหม่';
        $s('#ot-to').textContent = `ส่งรหัสไปที่ ${r.to} แล้ว ใช้ได้ ${r.minutes} นาที (ไม่เห็น ดูในกล่องสแปม)`; $s('#ot-otp').focus();
      } catch (x) { err(x.message); }
    };
    $s('[data-ot-ok]').onclick = async ev => {
      err();
      const code = $s('#ot-code').value.trim(), pin = $s('#ot-p1').value.trim();
      try {
        const r = await busy(ev.target, () => API.call('otpVerify', { code, otp: $s('#ot-otp').value.trim(), pin, pin2: $s('#ot-p2').value.trim() }), 'กำลังตรวจ…');
        closeSheet();
        const lc = document.getElementById('lg-code'), lp = document.getElementById('lg-pin'), go = document.querySelector('[data-a="login"]');
        if (lc && lp && go) { lc.value = r.username; lp.value = pin; go.click(); }   // หลังร้าน: เข้าระบบด้วย PIN ใหม่ทันที
        else if (typeof toast === 'function') toast('ตั้ง PIN แล้ว ใช้รหัสพนักงาน + PIN ใหม่ได้เลย');
      } catch (x) { err(x.message); }
    };
  }
  document.addEventListener('click', ev => { if (ev.target.closest('[data-otp]')) { ev.preventDefault(); open(((document.getElementById('lg-code') || document.getElementById('ck-code') || {}).value || '').trim()); } });
  const go = () => { put(); new MutationObserver(put).observe(document.getElementById('root') || document.body, { childList: true, subtree: true }); };
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', go) : go();
})();
