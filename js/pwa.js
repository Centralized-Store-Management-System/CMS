/* ติดตั้งเป็นแอป (Android / iPhone / Windows / Mac) — ปุ่ม "ติดตั้งแอป" + ลงทะเบียน sw.js
 * ไม่มีผลกับการทำงานของระบบ: ถ้าเบราว์เซอร์ไม่รองรับก็ใช้เป็นเว็บตามเดิม */
'use strict';
const PWA = { prompt: null, standalone: matchMedia('(display-mode: standalone)').matches || navigator.standalone === true };
PWA.ios = /iPhone|iPad|iPod/.test(navigator.userAgent) && !/CriOS|FxiOS|Line\//.test(navigator.userAgent);
PWA.inLine = /\bLine\//i.test(navigator.userAgent);
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
  window.addEventListener('load', () => { try { navigator.serviceWorker.register('sw.js').catch(() => {}); } catch (e) { /* */ } });
}
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); PWA.prompt = e; pwaButtons(); });
window.addEventListener('appinstalled', () => { PWA.prompt = null; PWA.standalone = true; pwaButtons(); });
function pwaCan() { return !PWA.standalone && !PWA.inLine && (PWA.prompt || PWA.ios); }
function pwaInstall() {
  if (PWA.prompt) { PWA.prompt.prompt(); PWA.prompt.userChoice.finally(() => { PWA.prompt = null; pwaButtons(); }); return; }
  if (PWA.ios) {
    const html = '<h3>ติดตั้งแอปบน iPhone / iPad</h3><ol class="steps"><li>เปิดหน้านี้ใน <b>Safari</b></li><li>กดปุ่ม <b>แชร์</b> (สี่เหลี่ยมมีลูกศรขึ้น) ด้านล่าง</li><li>เลือก <b>"เพิ่มไปยังหน้าจอโฮม"</b> แล้วกด เพิ่ม</li></ol><p class="muted">ไอคอนจะอยู่บนหน้าจอเหมือนแอปทั่วไป เปิดแล้วเต็มจอ</p><div class="actions"><span class="grow"></span><button class="btn primary" onclick="closeSheet()">เข้าใจแล้ว</button></div>';
    if (typeof openSheet === 'function') openSheet(html); else alert('กดปุ่มแชร์ แล้วเลือก "เพิ่มไปยังหน้าจอโฮม"');
  }
}
function pwaButtons() {
  document.querySelectorAll('[data-pwa]').forEach(b => { b.hidden = !pwaCan(); });
  if (!pwaCan()) return;
  const ub = document.getElementById('userbox');
  if (ub && !ub.querySelector('[data-pwa]')) { const b = document.createElement('button'); b.className = 'btn sm'; b.dataset.pwa = '1'; b.textContent = '📲 ติดตั้งแอป'; b.style.marginTop = '6px'; ub.appendChild(b); }
  const lg = document.querySelector('.login-card, .login, #lg-code');
  const box = lg && (lg.closest('.login-card') || lg.closest('form') || lg.parentElement);
  if (box && !document.querySelector('#pwa-login')) { const b = document.createElement('button'); b.className = 'btn'; b.id = 'pwa-login'; b.dataset.pwa = '1'; b.type = 'button'; b.textContent = '📲 ติดตั้งเป็นแอปบนเครื่องนี้'; b.style.marginTop = '12px'; box.appendChild(b); }
  const ck = document.querySelector('.clock-shell header, .clock-shell .brand');
  if (ck && !document.querySelector('#pwa-clock')) { const b = document.createElement('button'); b.className = 'btn sm'; b.id = 'pwa-clock'; b.dataset.pwa = '1'; b.type = 'button'; b.textContent = '📲 ติดตั้งแอป'; ck.after(b); }
}
document.addEventListener('click', e => { if (e.target.closest && e.target.closest('[data-pwa]')) { e.preventDefault(); pwaInstall(); } });
new MutationObserver(() => { if (pwaCan()) pwaButtons(); }).observe(document.documentElement, { childList: true, subtree: true });
