/* Super Advance IT > วิธีเข้าระบบ: ส่วน "แอปพนักงาน (รหัสปลดล็อก)" ดู/ยกเลิกเครื่องที่ผูกไว้ (48_AppLock.gs) — ไฟล์แยก ไม่แตะ owner.js */
(function () {
  const esc3 = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const ST = { active: ['ใช้งาน', 'ok'], locked: ['ถูกล็อก (ใส่ผิด)', 'bad'], revoked: ['ยกเลิกแล้ว', ''] };
  let loading = false;
  function html(rows) {
    const act = rows.filter(r => r.status === 'active').length;
    return `<h2 style="margin:26px 0 4px">แอปพนักงาน (รหัสปลดล็อก)</h2><p class="muted" style="margin:0 0 10px">Staff / Manager ที่ติดตั้งแอปบนมือถือ เข้าด้วยรหัส 6 หลักแบบแอปธนาคาร ใช้งาน ${act} เครื่อง · ยกเลิกแล้วเจ้าตัวต้องเข้าด้วยชื่อผู้ใช้ + PIN ใหม่</p>
      <div class="group">${rows.length ? rows.map(r => { const s = ST[r.status] || [r.status, '']; return `<div class="row static" data-dev="${esc3(r.id)}"><span class="main"><span class="t">${esc3(r.name)} <span class="muted">(${esc3(r.username)})</span> <span class="chip ${s[1]}">${esc3(s[0])}</span></span><span class="s">${esc3(r.device || 'อุปกรณ์')} · ผูกเมื่อ ${esc3(r.createdAt)} · ใช้ล่าสุด ${esc3(r.lastAt || '-')}${r.note ? ' · ' + esc3(r.note) : ''}</span></span>${r.status === 'active' || r.status === 'locked' ? '<button class="btn sm" data-devx style="color:#B03535;border-color:#E3B5B5">ยกเลิกเครื่อง</button>' : ''}</div>`; }).join('') : '<div class="row static"><span class="main"><span class="s">ยังไม่มีใครผูกแอป</span></span></div>'}</div>`;
  }
  async function load(box) {
    if (loading) return; loading = true;
    try { const r = await ocCall('devices'); box.innerHTML = html(r.rows || []); } catch (e) { box.innerHTML = `<p class="muted">แอปพนักงาน: ${esc3(e.message)}</p>`; }
    finally { loading = false; }
  }
  new MutationObserver(() => {
    if (typeof OC === 'undefined' || OC.view !== 'auth') return;
    const last = document.querySelector('[data-acc]'); if (!last || document.getElementById('oc-devs')) return;
    const main = last.closest('.group').parentElement, box = document.createElement('div'); box.id = 'oc-devs'; box.innerHTML = '<p class="muted">กำลังโหลดแอปพนักงาน…</p>';
    main.appendChild(box); load(box);
  }).observe(document.body, { childList: true, subtree: true });
  document.addEventListener('click', async e => {
    const b = e.target.closest('[data-devx]'); if (!b) return;
    if (!b.dataset.armed) { b.dataset.armed = '1'; b.textContent = 'แตะอีกครั้งเพื่อยกเลิก'; return; }
    try { const r = await busy(b, () => ocCall('devRevoke', { id: b.closest('[data-dev]').dataset.dev }), '…'); document.getElementById('oc-devs').innerHTML = html(r.rows || []); toast('ยกเลิกเครื่องแล้ว'); }
    catch (x) { toast(x.message); }
  });
})();
