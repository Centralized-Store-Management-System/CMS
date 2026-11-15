/* Super Advance IT > วิธีเข้าระบบ: ปุ่ม "ลบถาวร" ต่อบัญชี (45_ITPurge.gs) — ไฟล์แยก ไม่แตะ owner.js */
(function () {
  const esc2 = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  function addBtns() {
    document.querySelectorAll('[data-acc]').forEach(row => {
      const id = row.dataset.acc;
      if (id === 'owner' || row.querySelector('[data-purge]')) return;
      if (typeof OC !== 'undefined' && OC.me && id === OC.me.uid) return;
      row.insertAdjacentHTML('beforeend', '<button class="btn sm" data-purge style="color:#B03535;border-color:#E3B5B5">ลบถาวร</button>');
    });
  }
  new MutationObserver(addBtns).observe(document.body, { childList: true, subtree: true });
  document.addEventListener('click', async e => {
    const b = e.target.closest('[data-purge]');
    if (!b) return;
    const row = b.closest('[data-acc]'), id = row.dataset.acc, r = (OC.auth && OC.auth.rows || []).find(x => x.id === id) || {};
    const sh = openSheet(`<h2 style="margin:0 0 6px;color:#B03535">ลบบัญชีถาวร</h2>
      <p style="margin:0 0 10px"><b>${esc2(r.name || '')}</b> <span class="muted">(${esc2(r.username || id)})</span></p>
      <div class="group pad" style="font-size:14px;line-height:1.7">
        <b>ลบ:</b> บัญชีผู้ใช้ + PIN + Authenticator/Passkey · การผูก LINE · ตัดการเข้าระบบที่เปิดอยู่ทุกเครื่อง<br>
        <b>คงไว้:</b> ข้อมูลพนักงาน HR · เวลาทำงาน · ใบลา · เงินเดือน · Audit log<br>
        <b>หลังลบ:</b> ลงทะเบียน LINE ใหม่ได้ทันที (ได้บัญชีเว็บ + PIN ใหม่)</div>
      <div class="field" style="margin-top:12px"><label for="pg-c">พิมพ์ <b>${esc2(r.username || '')}</b> เพื่อยืนยัน</label><input id="pg-c" autocomplete="off" autocapitalize="none" spellcheck="false"></div>
      <p class="err" id="pg-err" role="alert"></p>
      <div class="actions"><span class="grow"></span><button class="btn" data-pg-x>ยกเลิก</button><button class="btn primary" data-pg-ok style="background:#B03535;border-color:#B03535">ลบถาวร</button></div>`);
    sh.querySelector('[data-pg-x]').onclick = () => closeSheet();
    sh.querySelector('[data-pg-ok]').onclick = async ev => {
      try {
        const res = await busy(ev.target, () => ocCall('purge', { id, confirm: sh.querySelector('#pg-c').value }), 'กำลังลบ…');
        closeSheet(); OC.auth = res; ocMain(ocAuth()); toast('ลบถาวรแล้ว: ' + (res.purged || r.username));
      } catch (err) { sh.querySelector('#pg-err').textContent = err.message; }
    };
  });
})();
