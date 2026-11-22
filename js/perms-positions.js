/* Settings › Permissions: เพิ่มส่วน "สิทธิ์ตามตำแหน่ง" รวมบทบาท Finance (เช่น ผู้ตรวจสุดท้าย) ไว้ที่เดียว
 * - ตารางสรุปทุกตำแหน่ง: Role หลังร้าน · บทบาท Finance · สิทธิ์เมนู · ปุ่มแก้ไข (ใช้ฟอร์มตำแหน่งเดิม)
 * - ฟอร์มเพิ่ม/แก้พนักงาน: ใต้ช่อง Role แสดงบทบาท Finance ตามตำแหน่งที่เลือก (อ่านอย่างเดียว)
 * ต่อยอดจาก hr-position-perms.js (ต้องโหลดหลังไฟล์นั้น) — ไม่แก้ mod-settings.js / mod-hr.js */
(function () {
  if (typeof modBy !== 'function' || typeof S !== 'object' || !window.PosPerms) return;
  const P = window.PosPerms;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const finTxt = f => f ? (P.FIN_TH[f] || f) : '';

  function section() {
    const list = (typeof HR_POSITIONS !== 'undefined' ? HR_POSITIONS : []).filter(p => p.status !== 'inactive');
    if (!P.ready()) return '<h3 class="h3">สิทธิ์ตามตำแหน่ง (รวม Finance)</h3><p class="note">กำลังโหลดข้อมูลตำแหน่ง… ถ้าไม่ขึ้น ให้เปิด HR › Positions หนึ่งครั้งแล้วกลับมา</p>';
    const rows = list.map(p => {
      const t = P.tmpl(p.id);
      return `<tr><td>${esc(p.name_th)}</td><td>${t.role ? esc(P.ROLE_TH[t.role] || t.role) : '<span class="muted">คง Role เดิม</span>'}</td><td>${t.finance ? esc(finTxt(t.finance)) : '<span class="muted">ไม่ใช้ Finance</span>'}</td><td>${t.perms.length ? t.perms.length + ' เมนู' : '<span class="muted">ตามค่าเริ่มต้นของ Role</span>'}</td><td><button class="btn" data-a="posEdit:${esc(p.id)}">แก้ไข</button></td></tr>`;
    }).join('');
    return `<h3 class="h3">สิทธิ์ตามตำแหน่ง (รวม Finance)</h3>
      <p class="note" style="margin-top:0">Role ของพนักงานและบัญชีผู้ใช้ตั้งตามตำแหน่ง · บทบาท Finance (ผู้อนุมัติ / ผู้ตรวจสุดท้าย / บัญชี) ตั้งที่ตำแหน่งเช่นกัน กด "แก้ไข" เพื่อเปลี่ยน ทุกคนในตำแหน่งนั้นเปลี่ยนตาม</p>
      <div class="group"><table class="perm"><thead><tr><th>ตำแหน่ง</th><th>Role หลังร้าน</th><th>บทบาท Finance</th><th>สิทธิ์เมนู</th><th></th></tr></thead><tbody>${rows || '<tr><td colspan="5">ยังไม่มีตำแหน่ง</td></tr>'}</tbody></table></div>`;
  }

  const ms = modBy('set'), sub = ms && ms.subs && ms.subs.find(s => s.key === 'perms');
  if (sub && !sub.__pp) {
    const v0 = sub.view; sub.__pp = 1;
    sub.view = function () { let h = ''; try { h = section(); } catch (_) { /* ส่วนเสริมไม่ให้หน้าหลักพัง */ } return v0.apply(this, arguments) + h; };
    ms.acts = ms.acts || {};
    ms.acts.posEdit = id => { if (typeof openPosition === 'function') openPosition(id); };
  }

  // ฟอร์มพนักงาน: แสดงบทบาท Finance ใต้ช่อง Role
  if (typeof openForm === 'function') {
    const of0 = openForm;
    openForm = function (o) {
      try {
        const ks = (o.fields || []).map(f => f.k);
        if (ks.includes('position') && ks.includes('payType') && ks.includes('role')) {
          const live0 = o.live;
          o.live = sh => {
            if (live0) live0(sh);
            const ps = sh.querySelector('[data-k="position"]'), rs = sh.querySelector('[data-k="role"]');
            const fld = rs && rs.closest('.field');
            if (!ps || !fld) return;
            let el = fld.querySelector('[data-pp-fin]');
            if (!el) { el = document.createElement('span'); el.className = 'help'; el.setAttribute('data-pp-fin', ''); fld.appendChild(el); }
            const draw = () => {
              const p = (typeof HR_POSITIONS !== 'undefined' ? HR_POSITIONS : []).find(x => x.name_th === ps.value), t = p && P.ready() ? P.tmpl(p.id) : null;
              el.textContent = t && t.finance ? 'บทบาท Finance: ' + finTxt(t.finance) + ' (ตามตำแหน่ง · แก้ที่ Settings › Permissions)' : 'บทบาท Finance: ตั้งที่ตำแหน่ง (Settings › Permissions)';
            };
            if (!ps.__pp) { ps.__pp = 1; ps.addEventListener('change', draw); }
            draw();
          };
        }
      } catch (_) { /* ไม่ให้ส่วนเสริมทำฟอร์มพัง */ }
      return of0.apply(this, arguments);
    };
  }
})();
