/* ยืนยันตัวตนขั้นที่ 2 ตอนเข้าหลังร้าน (41_Auth2.gs) — Authenticator / LINE / สแกนนิ้ว-Face ID (Passkey)
 * ทำงานต่อจากการใส่ PIN: ถ้าบัญชีนั้นถูกกำหนดวิธีเพิ่ม จะขึ้นหน้าต่างยืนยัน แล้วค่อยเข้าระบบตามปกติ
 * (ตั้งค่ารายบัญชีที่ Owner Console > Super Advance IT) */
'use strict';
const AUTH_OPTS = [['pin', 'PIN อย่างเดียว'], ['totp', 'PIN + แอป Authenticator (รหัส 6 หลัก)'], ['line', 'PIN + กดยืนยันใน LINE'], ['passkey', 'PIN + สแกนนิ้ว / Face ID (Passkey)']];
// ตั้งวิธีเข้าระบบย้ายไปที่ Owner Console > Super Advance IT > วิธีเข้าระบบ (owner.html) — หน้า Users แสดงแค่สถานะ
function authChip(u) {
  const m = u.authMethod || 'pin';
  if (m === 'pin') return '';
  const t = { totp: 'Authenticator', line: 'ยืนยัน LINE', passkey: 'Passkey' }[m];
  const ready = m === 'totp' ? u.hasTotp : m === 'passkey' ? u.passkeyN > 0 : true;
  return `<span class="chip ${ready ? 'ok' : 'warn'}">🔐 ${t}${ready ? '' : ' (รอผูกครั้งแรก)'}</span>`;
}

/* ---------- ตัวช่วย ---------- */
const auB = s => { const t = String(s).replace(/-/g, '+').replace(/_/g, '/'); const b = atob(t + '==='.slice((t.length + 3) % 4)); return Uint8Array.from(b, c => c.charCodeAt(0)); };
const auS = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const auDev = () => { const u = navigator.userAgent; return /iPhone|iPad/.test(u) ? 'iPhone/iPad' : /Android/.test(u) ? 'Android' : /Windows/.test(u) ? 'Windows' : /Mac/.test(u) ? 'Mac' : 'อุปกรณ์'; };

function authFlow(r) {
  return new Promise((resolve, reject) => {
    let done = false, timer = 0;
    const finish = (x, err) => { if (done) return; done = true; clearTimeout(timer); closeSheet(); err ? reject(err) : resolve(x); };
    const cancel = () => finish(null, new Error('ยกเลิกการเข้าสู่ระบบ'));
    const step = async (q, btn) => {
      const msg = $('#au-msg');
      try {
        const x = await (btn ? busy(btn, () => API.call('auth2', { pt: r.pt, ...q }), 'กำลังตรวจ…') : API.call('auth2', { pt: r.pt, ...q }));
        if (x && x.token) finish(x); return x;
      } catch (e) { if (e.code === 'AUTH_EXPIRED') return finish(null, e); if (msg) { msg.textContent = e.message; msg.className = 'status bad'; } return null; }
    };
    const head = (t, s) => `<h3>${esc(t)}</h3><p class="muted" style="margin-top:0">${esc(r.name || '')}${s ? ' · ' + s : ''}</p>`;
    const otpBox = `<div class="field"><label for="au-otp">รหัส 6 หลักจากแอป</label><input id="au-otp" inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="[0-9]*" style="font:600 26px var(--display);letter-spacing:.3em;text-align:center"></div>`;
    const foot = btn => `<style>#au-msg:empty{display:none}</style><p id="au-msg" class="status" role="status" aria-live="polite"></p><div class="actions">${btn || ''}<span class="grow"></span><button class="btn" id="au-x">ยกเลิก</button></div>`;
    let html = '';
    if (r.auth === 'totp_setup') {
      html = head('ผูกแอป Authenticator', 'ครั้งแรกครั้งเดียว') + `<ol class="steps"><li>ติดตั้ง <b>Google Authenticator</b> หรือ <b>Microsoft Authenticator</b></li><li>ในแอปกด + แล้วสแกน QR นี้ (บนมือถือเครื่องเดียวกันกด "เปิดในแอป")</li><li>ใส่รหัส 6 หลักที่แอปแสดง</li></ol>
        <div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap"><div id="au-qr" style="background:#fff;padding:8px;border-radius:8px;line-height:0"></div><div><a class="btn sm" href="${esc(r.uri)}">เปิดในแอป</a><p class="muted" style="margin:8px 0 0;font-size:13px">หรือพิมพ์รหัสตั้งค่า:<br><b style="font-family:monospace;font-size:14px;word-break:break-all">${esc(r.secret.replace(/(.{4})/g, '$1 ').trim())}</b></p></div></div>${otpBox}` + foot('<button class="btn primary" id="au-go">ยืนยัน</button>');
    } else if (r.auth === 'totp') {
      html = head('ใส่รหัสจากแอป Authenticator') + otpBox + foot('<button class="btn primary" id="au-go">ยืนยัน</button>');
    } else if (r.auth === 'line') {
      html = head('ยืนยันใน LINE') + `<p>ระบบส่งข้อความไปที่ LINE ของคุณแล้ว เปิด LINE แล้วกด <b>"ใช่ ฉันเอง"</b> หน้านี้จะเข้าระบบให้เอง</p><p class="loading" style="margin:8px 0">กำลังรอการยืนยัน…</p>` + foot();
    } else if (r.auth === 'passkey_setup' || r.auth === 'passkey') {
      const ok = !!(window.PublicKeyCredential && navigator.credentials);
      html = head(r.auth === 'passkey' ? 'ยืนยันด้วยสแกนนิ้ว / Face ID' : 'ลงทะเบียนเครื่องนี้', r.auth === 'passkey' ? '' : 'ครั้งแรกครั้งเดียว')
        + (ok ? `<p>${r.auth === 'passkey' ? 'กดปุ่มแล้วสแกนนิ้ว ใบหน้า หรือใส่รหัสปลดล็อกเครื่อง' : 'บัญชีนี้ต้องยืนยันด้วยเครื่องของคุณ กดปุ่มแล้วสแกนนิ้ว/ใบหน้าเพื่อผูกเครื่องนี้ ครั้งต่อไปใช้เครื่องนี้เข้าได้เลย'}</p>` : '<p class="status bad">เบราว์เซอร์นี้ไม่รองรับ Passkey ใช้ Chrome / Safari / Edge รุ่นใหม่</p>')
        + foot(ok ? `<button class="btn primary" id="au-go">${r.auth === 'passkey' ? 'สแกนเพื่อเข้าระบบ' : 'ลงทะเบียนเครื่องนี้'}</button>` : '');
    } else return reject(new Error('วิธียืนยันตัวตนไม่รู้จัก'));
    openSheet(html);
    $('#au-x').onclick = cancel;
    const sc = document.querySelector('.scrim'); if (sc) sc.addEventListener('click', e => { if (e.target === sc) cancel(); });
    if (r.auth === 'totp_setup') {
      (window.QRCode ? Promise.resolve() : loadScript('https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js')).then(() => { const el = $('#au-qr'); if (el && window.QRCode) new QRCode(el, { text: r.uri, width: 168, height: 168, correctLevel: QRCode.CorrectLevel.M }); }).catch(() => { const el = $('#au-qr'); if (el) el.remove(); });
    }
    if (r.auth === 'totp' || r.auth === 'totp_setup') {
      const inp = $('#au-otp'), go = $('#au-go');
      const send = () => { const v = inp.value.replace(/\D/g, ''); if (v.length === 6) step({ step: 'otp', otp: v }, go).then(x => { if (!x) { inp.value = ''; inp.focus(); } }); };
      go.onclick = send; inp.addEventListener('input', () => { if (inp.value.replace(/\D/g, '').length === 6) send(); }); setTimeout(() => inp.focus(), 50);
    }
    if (r.auth === 'line') {
      const t0 = Date.now();
      const poll = async () => { if (done) return; if (Date.now() - t0 > 290000) return finish(null, new Error('หมดเวลารอการยืนยันใน LINE กรุณาเข้าสู่ระบบใหม่')); const x = await step({ step: 'poll' }); if (!done && (!x || x.wait)) timer = setTimeout(poll, 2000); };
      timer = setTimeout(poll, 1500);
    }
    if ((r.auth === 'passkey' || r.auth === 'passkey_setup') && $('#au-go')) {
      $('#au-go').onclick = async ev => {
        const msg = $('#au-msg');
        try {
          if (r.auth === 'passkey_setup') {
            const c = await navigator.credentials.create({ publicKey: { challenge: auB(r.ch), rp: { name: r.rp || 'Cafe' }, user: { id: auB(r.user.id), name: r.user.name, displayName: r.user.displayName || r.user.name },
              pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }], authenticatorSelection: { userVerification: 'required', residentKey: 'preferred' }, attestation: 'none', timeout: 120000 } });
            await step({ step: 'pk', cd: auS(c.response.clientDataJSON), ao: auS(c.response.attestationObject), nm: auDev() }, ev.target);
          } else {
            const c = await navigator.credentials.get({ publicKey: { challenge: auB(r.ch), allowCredentials: (r.allow || []).map(id => ({ type: 'public-key', id: auB(id) })), userVerification: 'required', timeout: 120000 } });
            await step({ step: 'pk', id: auS(c.rawId), cd: auS(c.response.clientDataJSON), ad: auS(c.response.authenticatorData), sig: auS(c.response.signature) }, ev.target);
          }
        } catch (e) { if (msg) { msg.textContent = e && e.name === 'NotAllowedError' ? 'ยกเลิกหรือหมดเวลา กดอีกครั้ง' : (e.message || 'ทำไม่สำเร็จ'); msg.className = 'status bad'; } }
      };
    }
  });
}
/* เข้าสู่ระบบ: ได้ขั้นยืนยันเพิ่ม → ทำให้เสร็จ แล้วส่งผลแบบเดียวกับการเข้าระบบปกติ (app.js ทำต่อเหมือนเดิม) */
(function () {
  const call = API.call;
  API.call = async function (action, params = {}) {
    const r = await call.call(API, action, params);
    if (action === 'login' && r && r.auth && !r.token) return authFlow(r);
    return r;
  };
})();
