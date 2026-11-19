/* Owner PWA: ล็อกการเปิดแอปด้วย PIN บนอุปกรณ์ที่ติดตั้งเท่านั้น
 * PIN ใช้ถอดรหัส session token ที่เข้ารหัสในเครื่อง; เซิร์ฟเวอร์ยังเป็นผู้ตรวจ session/สิทธิ์ทุกครั้ง */
'use strict';
const OWNER_PWA_LOCK = (() => {
  const KEY = 'amz.owner.pwa.v1';
  const FAIL = 'amz.owner.pwa.fail.v1';
  const standalone = () => !!(window.PWA && PWA.standalone) ||
    (window.matchMedia && matchMedia('(display-mode: standalone)').matches) ||
    navigator.standalone === true;
  const b64 = a => btoa(String.fromCharCode(...new Uint8Array(a)));
  const un64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  const enc = new TextEncoder(), dec = new TextDecoder();
  const read = () => { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (_) { return null; } };
  const write = v => localStorage.setItem(KEY, JSON.stringify(v));
  const clear = () => { try { localStorage.removeItem(KEY); localStorage.removeItem(FAIL); } catch (_) {} };
  async function derive(pin, salt) {
    const base = await crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 310000, hash: 'SHA-256' }, base,
      { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  }
  async function seal(token, pin) {
    const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await derive(pin, salt);
    const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(token));
    write({ v: 1, kdf: 'PBKDF2-SHA256-310000', salt: b64(salt), iv: b64(iv), data: b64(cipher), at: Date.now() });
  }
  async function unseal(pin) {
    const v = read();
    if (!v || v.v !== 1) throw new Error('ไม่พบข้อมูล PIN');
    const key = await derive(pin, un64(v.salt));
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: un64(v.iv) }, key, un64(v.data));
    return dec.decode(plain);
  }
  function pinDialog(title, subtitle, confirm) {
    return new Promise(resolve => {
      let value = '', first = '';
      const render = () => {
        const sh = document.querySelector('.scrim .owner-pin');
        if (!sh) return;
        sh.querySelector('[data-dots]').textContent = '● '.repeat(value.length) + '○ '.repeat(6 - value.length);
        sh.querySelector('[data-pin-msg]').textContent = '';
      };
      const html = `<div class="owner-pin"><div class="owner-pin-mark">CA</div><h3>${title}</h3><p class="muted">${subtitle}</p>
        <div class="owner-pin-dots" data-dots>○ ○ ○ ○ ○ ○</div><p class="owner-pin-msg" data-pin-msg role="status"></p>
        <div class="owner-pin-pad">${['1','2','3','4','5','6','7','8','9','del','0','cancel'].map(k => k === 'del' ? '<button type="button" data-key="del">ลบ</button>' : k === 'cancel' ? '<button type="button" data-key="cancel">ยกเลิก</button>' : `<button type="button" data-key="${k}">${k}</button>`).join('')}</div>
      </div>`;
      const sh = openSheet(html), root = sh.querySelector('.owner-pin');
      const finish = v => { closeSheet(); resolve(v); };
      root.addEventListener('click', async e => {
        const b = e.target.closest('[data-key]'); if (!b) return;
        const k = b.dataset.key;
        if (k === 'cancel') return finish(null);
        if (k === 'del') { value = value.slice(0, -1); render(); return; }
        if (value.length >= 6) return;
        value += k; render();
        if (value.length !== 6) return;
        if (!confirm) return finish(value);
        if (!first) {
          first = value; value = '';
          root.querySelector('h3').textContent = 'ยืนยัน PIN อีกครั้ง';
          root.querySelector('.muted').textContent = 'กรอก PIN 6 หลักเดิมอีกครั้ง';
          render(); return;
        }
        if (value !== first) {
          first = ''; value = '';
          root.querySelector('[data-pin-msg]').textContent = 'PIN ไม่ตรงกัน กรุณาตั้งใหม่';
          root.querySelector('h3').textContent = title;
          root.querySelector('.muted').textContent = subtitle;
          render(); return;
        }
        finish(value);
      });
    });
  }
  async function enroll(token) {
    if (!standalone() || !window.crypto || !crypto.subtle) return false;
    const pin = await pinDialog('ตั้ง PIN สำหรับ Owner App', 'ตั้ง PIN 6 หลักเพื่อปลดล็อกแอปบนเครื่องนี้', true);
    if (!pin) return false;
    try { await seal(token, pin); toast('ตั้ง PIN สำหรับ Owner App แล้ว'); return true; }
    catch (e) { clear(); toast('อุปกรณ์นี้ไม่รองรับการเข้ารหัส PIN'); return false; }
  }
  async function restore() {
    if (!standalone() || !read()) return false;
    if (!window.crypto || !crypto.subtle) { clear(); return false; }
    let fails = 0, warning = '';
    try {
      const lockout = JSON.parse(localStorage.getItem(FAIL) || 'null');
      if (lockout && lockout.until > Date.now()) {
        const seconds = Math.ceil((lockout.until - Date.now()) / 1000);
        await pinDialog('พักการปลดล็อกชั่วคราว', 'ใส่ PIN ผิดหลายครั้ง กรุณารออีก ' + seconds + ' วินาทีแล้วเปิดแอปใหม่', false);
        return false;
      }
      if (lockout) localStorage.removeItem(FAIL);
    } catch (_) {}
    for (;;) {
      const pin = await pinDialog(warning ? 'PIN ไม่ถูกต้อง' : 'ปลดล็อก Owner App',
        warning || 'กรอก PIN 6 หลักเพื่อเข้าใช้งาน', false);
      if (!pin) return false;
      let token;
      try { token = await unseal(pin); }
      catch (_) {
        fails++;
        if (fails >= 5) {
          localStorage.setItem(FAIL, JSON.stringify({ n: 0, until: Date.now() + 30000 }));
          await pinDialog('พักการปลดล็อก 30 วินาที', 'ใส่ PIN ไม่ถูกต้อง 5 ครั้ง กรุณารอ 30 วินาทีแล้วเปิดแอปใหม่', false);
          return false;
        }
        warning = 'PIN ไม่ถูกต้อง · เหลือโอกาสอีก ' + (5 - fails) + ' ครั้ง';
        continue;
      }
      try {
        const me = await API.call('me', { t: token });
        if (!me || me.role !== 'owner') { clear(); return false; }
        SS.set('amz.it.tok', token); S.token = token;
        localStorage.removeItem(FAIL);
        return true;
      } catch (e) {
        if (e && e.code === 'SESSION') { clear(); toast('Session หมดอายุ กรุณาเข้าสู่ระบบและยืนยันตัวตนใหม่'); }
        else toast('ตรวจสอบ Session ไม่สำเร็จ กรุณาตรวจอินเทอร์เน็ตแล้วเข้าสู่ระบบใหม่');
        return false;
      }
    }
  }
  return { standalone, enroll, restore, clear };
})();
