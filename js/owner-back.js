/* ปุ่มกลับหน้าหลักเจ้าของร้าน (owner.html) ในหลังร้าน: หน้าเข้าระบบ + เมนูซ้าย
 * แสดงเมื่อเปิดมาจากหน้าหลักเจ้าของร้าน (?from=owner) หรือผู้ใช้เป็น Owner — ไม่แตะไฟล์อื่น */
(function () {
  const K = 'amz.fromOwner';
  try { if (/[?&]from=owner/.test(location.search)) sessionStorage.setItem(K, '1'); } catch (e) { /* */ }
  const from = () => { try { return sessionStorage.getItem(K) === '1'; } catch (e) { return false; } };
  const isOwner = () => typeof S !== 'undefined' && S.me && S.me.role === 'owner';
  const ic = (typeof icon === 'function') ? icon('dash') : '';
  const link = cls => `<a class="${cls}" href="owner.html" data-ob><span class="ob-ic">${ic}</span><span class="ob-tx"><b>หน้าหลักเจ้าของร้าน</b><small>จัดการร้าน · ระบบ IT</small></span><span class="ob-go" aria-hidden="true">›</span></a>`;
  let blocking = false;
  function put() {
    // แอป Owner: บัญชีพนักงานเข้า "จัดการร้าน" จากทางนี้ไม่ได้ (ใช้แอปพนักงาน)
    if (from() && !blocking && typeof S !== 'undefined' && S.token && S.me && S.me.role !== 'owner') {
      blocking = true; const t = S.token;
      try { API.call('logout', { t }).catch(() => {}); } catch (e) { /* */ }
      S.token = ''; S.me = null; try { SS.set('amz.tok', ''); } catch (e) { /* */ }
      const msg = 'แอป Owner ใช้ได้เฉพาะบัญชี Owner · พนักงานใช้แอปพนักงาน (หลังร้าน / ลงเวลา / LINE)';
      if (typeof renderLogin === 'function') { renderLogin(msg); setTimeout(() => { if (!S.token) renderLogin(msg); }, 150); }   // หลังขั้นตอนเข้าระบบเดิมวาดหน้าเสร็จ แสดงข้อความซ้ำ
      setTimeout(() => { blocking = false; }, 600);
      return;
    }
    if (!from() && !isOwner()) return;
    const alt = document.querySelector('.login-alt');
    if (alt && !document.querySelector('.login-card [data-ob]')) alt.insertAdjacentHTML('afterend', link('ob-card ob-login'));
    const ub = document.getElementById('userbox');
    if (ub && !document.querySelector('.side [data-ob]')) ub.insertAdjacentHTML('beforebegin', link('ob-card ob-side'));
  }
  const st = document.createElement('style');
  st.textContent = [
    '.ob-card{display:flex;align-items:center;gap:12px;text-decoration:none;color:var(--ink);background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:10px 12px;transition:border-color .15s,background .15s,transform .15s}',
    '.ob-card:hover{border-color:var(--brand);background:color-mix(in srgb,var(--brand) 6%,var(--surface))}',
    '.ob-card:active{transform:scale(.99)}',
    '.ob-ic{flex:none;width:36px;height:36px;border-radius:10px;display:grid;place-items:center;background:color-mix(in srgb,var(--brand) 12%,transparent);color:var(--brand)}',
    '.ob-ic svg{width:20px;height:20px}',
    '.ob-tx{flex:1;min-width:0;display:flex;flex-direction:column;line-height:1.3;text-align:left}',
    '.ob-tx b{font-size:14px;font-weight:600}.ob-tx small{font-size:12px;color:var(--muted)}',
    '.ob-go{font-size:22px;line-height:1;color:var(--muted)}',
    '.ob-login{margin-top:18px;position:relative}',
    '.ob-login:before{content:"";position:absolute;left:0;right:0;top:-10px;border-top:1px solid var(--line)}',
    '.ob-side{margin:6px 12px;padding:8px 10px;background:transparent;color:inherit;border-color:rgba(127,127,127,.35)}',
    '.ob-side .ob-ic{width:30px;height:30px;background:rgba(127,127,127,.18);color:inherit}',
    '.ob-side .ob-tx small{display:none}.ob-side .ob-tx b{font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.ob-side .ob-go{color:inherit;opacity:.6}',
    'body:has(.ob-side) [data-oclink]{display:none}',   /* ปุ่มเดิม Owner Console ไปหน้าเดียวกัน ไม่แสดงซ้ำ */
    '.ob-side:hover{background:rgba(127,127,127,.12);border-color:rgba(127,127,127,.5)}'
  ].join('');
  document.head.appendChild(st);
  const go = () => { put(); new MutationObserver(put).observe(document.getElementById('root') || document.body, { childList: true, subtree: true }); };
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', go) : go();
})();
