/* แอป Owner (Owner & IT) > สาขา: ดูทุกสาขา เปลี่ยนชื่อสาขา + สถานะซิงก์กับระบบออเดอร์ (56_BranchSync.gs) — ไฟล์แยก ไม่แตะ owner.js
 * แก้แล้วซิงก์ไประบบออเดอร์ (Line-Order) อัตโนมัติภายใน 1 นาที */
(function () {
  const esc4 = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  let data = null, edit = '', loading = false;
  function html() {
    if (!data) return '<p class="loading">กำลังโหลด…</p>';
    const rows = data.rows || [];
    return `<h2 style="margin:0 0 4px">สาขา</h2><p class="muted" style="margin:0 0 12px">ชื่อสาขายึดจากที่นี่ แก้แล้วซิงก์ไประบบออเดอร์ (Live Orders / Web Admin Portal / LINE สั่งอาหาร) เองภายใน 1 นาที</p>
      <div class="group">${rows.map(b => edit === b.id
        ? `<div class="row static" data-br="${esc4(b.id)}"><span class="main" style="flex:1"><span class="t">${esc4(b.code)}</span><input id="br-name" class="field" style="width:100%;margin-top:6px" maxlength="80" value="${esc4(b.name)}" aria-label="ชื่อสาขาใหม่"></span><span class="mini"><button class="btn sm" data-brx="cancel">ยกเลิก</button><button class="btn sm primary" data-brx="save">บันทึก</button></span></div>`
        : `<div class="row static" data-br="${esc4(b.id)}"><span class="main"><span class="t">${esc4(b.name)} <span class="muted">${esc4(b.code)}</span>${b.status === 'ปิด' ? ' <span class="chip">ปิด</span>' : ''}</span><span class="s">${b.synced ? '<span class="chip ok">ซิงก์แล้ว</span> ระบบออเดอร์: ' + esc4(b.orderName) : b.orderCode ? '<span class="chip warn">รอซิงก์</span> ระบบออเดอร์ยังเป็น: ' + esc4(b.orderName) : '<span class="chip warn">รอสร้างในระบบออเดอร์</span>'}</span></span><span class="mini"><button class="btn sm" data-brx="edit">เปลี่ยนชื่อ</button></span></div>`).join('') || '<p class="empty">ยังไม่มีสาขา</p>'}</div>
      <p class="muted" style="margin-top:10px">ตรวจระบบออเดอร์ล่าสุด ${data.at ? new Date(data.at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : '-'} · <button class="linkbtn" data-brx="reload">รีเฟรช</button></p>`;
  }
  const paint = () => { const m = document.getElementById('oc-main'); if (m && OC.view === 'branches') m.innerHTML = html(); };
  async function load() {
    if (loading) return; loading = true;
    try { data = await ocCall('branchList'); paint(); }
    catch (e) { if (e.code === 'SESSION' || e.code === 'PERM') { OC.after = 'branches'; return ocLogin(e.message); } const m = document.getElementById('oc-main'); if (m) m.innerHTML = `<p class="status bad">${esc4(e.message)}</p>`; }
    finally { loading = false; }
  }
  new MutationObserver(() => {
    if (typeof OC === 'undefined' || !OC.me) return;
    const side = document.querySelector('.oc-side'), home = side && side.querySelector('a[data-oc="home"]');
    if (home && !side.querySelector('a[data-oc="branches"]')) home.insertAdjacentHTML('afterend', `<a href="#branches" data-oc="branches"${OC.view === 'branches' ? ' aria-current="page"' : ''}>${icon('branch')}<span class="l">สาขา</span><span class="sh">สาขา</span></a>`);
    if (OC.view !== 'branches') return;
    const t = document.querySelector('.oc-top .t b'); if (t && t.textContent !== 'สาขา') t.textContent = 'สาขา';
    const m = document.getElementById('oc-main');
    if (m && m.querySelector('.loading') && !loading) { if (data) paint(); load(); }
  }).observe(document.body, { childList: true, subtree: true });
  document.addEventListener('click', async e => {
    const b = e.target.closest('[data-brx]'); if (!b || OC.view !== 'branches') return;
    const a = b.dataset.brx, id = (b.closest('[data-br]') || {}).dataset?.br;
    if (a === 'reload') return load();
    if (a === 'edit') { edit = id; paint(); const i = document.getElementById('br-name'); if (i) { i.focus(); i.select(); } return; }
    if (a === 'cancel') { edit = ''; return paint(); }
    if (a === 'save') {
      const name = document.getElementById('br-name').value.trim();
      try { data = await busy(b, () => ocCall('branchRename', { id, name }), 'กำลังบันทึก…'); edit = ''; paint(); toast('เปลี่ยนชื่อแล้ว · ซิงก์ระบบออเดอร์ภายใน 1 นาที'); setTimeout(load, 75000); }
      catch (x) { toast(x.message); }
    }
  });
  // หน้าหลักแอป Owner (ก่อนเข้าระบบ): ปุ่ม "สาขา" → เข้าระบบแล้วไปหน้าสาขาเลย
  const tile = () => {
    const m = document.querySelector('.oc-land-menu');
    if (m && !m.querySelector('[data-brland]')) m.insertAdjacentHTML('beforeend', `<button class="oc-big" type="button" data-brland="1"><span class="ic">${icon('branch')}</span><b>สาขา</b><small>เปลี่ยนชื่อสาขา · ซิงก์ระบบออเดอร์อัตโนมัติ</small></button>`);
  };
  if (typeof ocLanding === 'function') { const l0 = ocLanding; window.ocLanding = ocLanding = function () { l0.apply(this, arguments); tile(); }; tile(); }
  document.addEventListener('click', e => {
    if (!e.target.closest('[data-brland]')) return;
    e.preventDefault(); e.stopPropagation();
    if (OC.me) return ocGo('branches');
    OC.after = 'branches'; ocLogin();
  }, true);
  // มือถือ: แถบเมนูล่างมี 7 ปุ่ม
  const st = document.createElement('style'); st.textContent = '@media (max-width:860px){.oc-side{grid-template-columns:repeat(7,1fr)!important}}'; document.head.appendChild(st);
  document.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.id === 'br-name') { const s = document.querySelector('[data-brx="save"]'); if (s) s.click(); } });
})();
