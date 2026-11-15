/* ปุ่มกลับหน้าหลักเจ้าของร้าน (owner.html) ในหลังร้าน: หน้าเข้าระบบ + เมนูซ้าย
 * แสดงเมื่อเปิดมาจากหน้าหลักเจ้าของร้าน (?from=owner) หรือผู้ใช้เป็น Owner — ไม่แตะไฟล์อื่น */
(function () {
  const K = 'amz.fromOwner';
  try { if (/[?&]from=owner/.test(location.search)) sessionStorage.setItem(K, '1'); } catch (e) { /* */ }
  const from = () => { try { return sessionStorage.getItem(K) === '1'; } catch (e) { return false; } };
  const isOwner = () => typeof S !== 'undefined' && S.me && S.me.role === 'owner';
  const link = cls => `<a class="${cls}" href="owner.html" data-ob>← หน้าหลักเจ้าของร้าน</a>`;
  function put() {
    if (!from() && !isOwner()) return;
    const alt = document.querySelector('.login-alt');
    if (alt && !alt.querySelector('[data-ob]')) alt.insertAdjacentHTML('beforeend', '<br>' + link('linkbtn ob-login'));
    const ub = document.getElementById('userbox');
    if (ub && !document.querySelector('.side [data-ob]')) ub.insertAdjacentHTML('beforebegin', link('ob-side'));
  }
  const st = document.createElement('style');
  st.textContent = '.ob-login{display:inline-block;margin-top:10px;font-size:14px}.ob-side{display:block;margin:6px 12px;padding:8px 12px;border-radius:10px;font-size:13px;color:inherit;opacity:.85;text-decoration:none;border:1px solid rgba(127,127,127,.3)}.ob-side:hover{opacity:1}';
  document.head.appendChild(st);
  const go = () => { put(); new MutationObserver(put).observe(document.getElementById('root') || document.body, { childList: true, subtree: true }); };
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', go) : go();
})();
