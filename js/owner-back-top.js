/* หน้าจัดการร้าน (เปิดจากแอป Owner) บนมือถือ: ปุ่มมุมขวาบน กลับหน้าหลักเจ้าของร้าน (owner.html) แบบเดียวกับระบบ IT
 * จอกว้าง (≥960px) มีปุ่มในเมนูซ้ายอยู่แล้ว (owner-back.js) จึงซ่อน · ไม่ออกจากระบบ (กลับไปหน้าหลักแล้วกดเมนูได้เลย) */
(function () {
  const from = () => { try { return sessionStorage.getItem('amz.fromOwner') === '1' || /[?&]from=owner/.test(location.search); } catch (e) { return false; } };
  const st = document.createElement('style');
  st.textContent = '.obt{flex:none;width:40px;height:40px;border-radius:12px;border:1px solid var(--line);background:transparent;color:var(--muted);display:grid;place-items:center;text-decoration:none}.obt svg{width:18px;height:18px}@media (min-width:960px){.obt{display:none}}';
  document.head.appendChild(st);
  function put() {
    if (!from() || typeof S === 'undefined' || !S.me || S.me.role !== 'owner') return;
    const tb = document.querySelector('.topbar');
    if (!tb || tb.querySelector('.obt')) return;
    tb.insertAdjacentHTML('beforeend', `<a class="obt" href="owner.html" aria-label="กลับหน้าหลักเจ้าของร้าน" title="หน้าหลักเจ้าของร้าน">${typeof icon === 'function' ? icon('out') : '⌂'}</a>`);
  }
  const go = () => { put(); new MutationObserver(put).observe(document.getElementById('root') || document.body, { childList: true, subtree: true }); };
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', go) : go();
})();
