/* Settings › Permissions: เพิ่มส่วน "สิทธิ์ตามตำแหน่ง" รวมบทบาท Finance (เช่น ผู้ตรวจสุดท้าย) ไว้ที่เดียว
 * - ตารางสรุปทุกตำแหน่ง: Role หลังร้าน · บทบาท Finance · สิทธิ์เมนู · ปุ่มแก้ไข (ใช้ฟอร์มตำแหน่งเดิม)
 * - ฟอร์มเพิ่ม/แก้พนักงาน: ใต้ช่อง Role แสดงบทบาท Finance ตามตำแหน่งที่เลือก (อ่านอย่างเดียว)
 * ต่อยอดจาก hr-position-perms.js (ต้องโหลดหลังไฟล์นั้น) — ไม่แก้ mod-settings.js / mod-hr.js */
(function () {
  if (typeof modBy !== 'function' || typeof S !== 'object' || !window.PosPerms) return;
  const P = window.PosPerms;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const finTxt = f => f ? (P.FIN_TH[f] || f) : '';

  /** โหลดข้อมูลตำแหน่งเองถ้ายังไม่เคยโหลด (เดิมต้องเปิดหน้า HR ก่อน ตารางนี้จึงขึ้น) */
  function needLoad() {
    if (typeof HR_POSITION_LOADED === 'undefined' || typeof hrLoadPositions !== 'function') return false;
    if (HR_POSITION_LOADED || HR_POSITION_LOADING) return false;
    HR_POSITION_LOADING = true;
    hrLoadPositions().catch(() => { }).finally(() => { HR_POSITION_LOADED = true; HR_POSITION_LOADING = false; if (typeof App !== 'undefined') App.render(); });
    return true;
  }
  const posReady = () => typeof HR_POSITION_LOADED !== 'undefined' && HR_POSITION_LOADED && !HR_POSITION_ERROR;

  function section() {
    const H = '<h3 class="h3">สิทธิ์ตามตำแหน่ง (รวม Finance)</h3>';
    const loading = needLoad() || (typeof HR_POSITION_LOADING !== 'undefined' && HR_POSITION_LOADING);
    if (loading) return H + '<p class="loading">กำลังโหลดข้อมูลตำแหน่ง…</p>';
    if (typeof HR_POSITION_ERROR !== 'undefined' && HR_POSITION_ERROR) return H + `<p class="status bad">โหลดข้อมูลตำแหน่งไม่สำเร็จ: ${esc(HR_POSITION_ERROR)} <button class="btn sm" data-a="posReload">ลองใหม่</button></p>`;
    const list = (typeof HR_POSITIONS !== 'undefined' ? HR_POSITIONS : []).filter(p => p.status !== 'inactive');
    if (!posReady()) return H + '<p class="note">ยังไม่มีข้อมูลตำแหน่ง เปิด HR › Positions หนึ่งครั้งแล้วกลับมา</p>';
    const off = new Set(String((S.settings && S.settings.noSchedPos) || '').split(',').map(x => x.trim()).filter(Boolean));
    const rows = list.map(p => {
      const t = P.tmpl(p.id);
      return `<tr><td>${esc(p.name_th)}</td><td>${t.role ? esc(P.ROLE_TH[t.role] || t.role) : '<span class="muted">คง Role เดิม</span>'}</td><td>${t.finance ? esc(finTxt(t.finance)) : '<span class="muted">ไม่ใช้ Finance</span>'}</td><td>${t.perms.length ? t.perms.length + ' เมนู' : '<span class="muted">ตามค่าเริ่มต้นของ Role</span>'}</td><td><input type="checkbox" data-sched="${esc(p.id)}"${off.has(p.id) ? '' : ' checked'} aria-label="จัดตารางงาน: ${esc(p.name_th)}"></td><td><button class="btn" data-a="posEdit:${esc(p.id)}">แก้ไข</button></td></tr>`;
    }).join('');
    return H + `
      <p class="note" style="margin-top:0">Role ของพนักงานและบัญชีผู้ใช้ตั้งตามตำแหน่ง · บทบาท Finance (ผู้อนุมัติ / ผู้ตรวจสุดท้าย / บัญชี) ตั้งที่ตำแหน่งเช่นกัน กด "แก้ไข" เพื่อเปลี่ยน ทุกคนในตำแหน่งนั้นเปลี่ยนตาม</p>
      <div class="group"><table class="perm"><thead><tr><th>ตำแหน่ง</th><th>Role หลังร้าน</th><th>บทบาท Finance</th><th>สิทธิ์เมนู</th><th>จัดตารางงาน</th><th></th></tr></thead><tbody>${rows || '<tr><td colspan="6">ยังไม่มีตำแหน่ง</td></tr>'}</tbody></table></div>
      <p class="note">"จัดตารางงาน" ติ๊กไว้ = ตำแหน่งนี้ขึ้นในตารางงาน (เฉพาะ Role Manager / Staff) · เอาติ๊กออก = ไม่ต้องจัดตาราง (คนที่มีกะอยู่แล้วยังแสดง)</p>
      <div class="actions"><button class="btn primary" data-a="posSaveSched">บันทึกตำแหน่งที่จัดตารางงาน</button></div>
      ${menuTable(list)}`;
  }

  /** ตารางที่ 2: ติ๊กสิทธิ์เมนูให้แต่ละตำแหน่งได้ที่นี่เลย (แถว = เมนู, คอลัมน์ = ตำแหน่ง) */
  function menuTable(list) {
    const menus = (S.permList || []).filter(x => !x[2]);        // ตัดสิทธิ์ที่เป็นของ Owner เท่านั้น
    if (!list.length || !menus.length) return '';
    const T = {}; list.forEach(p => { T[p.id] = P.tmpl(p.id); });
    const head = list.map(p => `<th>${esc(p.name_th)}</th>`).join('');
    const body = menus.map(([k, label]) => `<tr><td>${esc(label)}</td>${list.map(p => `<td><input type="checkbox" data-pperm="${esc(p.id)}:${esc(k)}"${T[p.id].perms.includes(k) ? ' checked' : ''} aria-label="${esc(p.name_th)}: ${esc(label)}"></td>`).join('')}</tr>`).join('');
    return `<h3 class="h3">สิทธิ์เมนูตามตำแหน่ง</h3>
      <p class="note" style="margin-top:0">ติ๊กให้ตำแหน่งไหน คนในตำแหน่งนั้นได้สิทธิ์ชุดนี้แทนค่าเริ่มต้นของ Role · ไม่ติ๊กเลยทั้งคอลัมน์ = ใช้ค่าเริ่มต้นของ Role ตามตารางข้างบน</p>
      <div class="group" style="overflow-x:auto"><table class="perm"><thead><tr><th>ระบบ</th>${head}</tr></thead><tbody>${body}</tbody></table></div>
      <div class="actions"><button class="btn primary" data-a="posSavePerms">บันทึกสิทธิ์เมนูตามตำแหน่ง</button></div>${queue()}`;
  }

  /** คิวส่งต่อข้อมูลตำแหน่งไประบบอื่น (iam_sync_outbox) — ตอนนี้ยังไม่มีตัวรับ จึงแสดงให้เห็นว่าค้างเท่าไร */
  function queue() {
    const q = (typeof HR_POSITION_SYNC !== 'undefined' && HR_POSITION_SYNC) || [];
    const pend = q.filter(x => String(x.status || '') === 'pending').reduce((n, x) => n + Number(x.count || 0), 0);
    if (!pend) return '';
    return `<p class="note">คิวส่งต่อข้อมูลตำแหน่งไประบบอื่น: ค้าง ${pend} รายการ — ยังไม่มีระบบปลายทางมารับ (ไม่กระทบการใช้งานในระบบนี้) ถ้าไม่ได้จะต่อระบบอื่น ปล่อยไว้ได้</p>`;
  }

  const ms = modBy('set'), sub = ms && ms.subs && ms.subs.find(s => s.key === 'perms');
  if (sub && !sub.__pp) {
    const v0 = sub.view; sub.__pp = 1;
    sub.view = function () { let h = ''; try { h = section(); } catch (_) { /* ส่วนเสริมไม่ให้หน้าหลักพัง */ } return v0.apply(this, arguments) + h; };
    ms.acts = ms.acts || {};
    ms.acts.posEdit = id => { if (typeof openPosition === 'function') openPosition(id); };
    ms.acts.posReload = async () => { HR_POSITION_LOADED = false; HR_POSITION_ERROR = ''; App.render(); };
    // Owner เท่านั้น (หน้า Settings เป็นของ Owner อยู่แล้ว) — เก็บเฉพาะตำแหน่งที่ "ไม่ติ๊ก"
    ms.acts.posSaveSched = async (a, b) => {
      try {
        const off = [...document.querySelectorAll('[data-sched]')].filter(c => !c.checked).map(c => c.dataset.sched);
        S.settings.noSchedPos = off.join(',');
        await busy(b, () => DB.saveSettings());
        toast(off.length ? 'บันทึกแล้ว · ' + off.length + ' ตำแหน่งไม่ขึ้นในตารางงาน' : 'บันทึกแล้ว · ทุกตำแหน่งขึ้นในตารางงาน');
        App.render();
      } catch (x) { toast(x.message); }
    };
    // บันทึกเฉพาะตำแหน่งที่เปลี่ยน · คง Role และบทบาท Finance ของตำแหน่งไว้เหมือนเดิม
    ms.acts.posSavePerms = async (a, b) => {
      try {
        const want = {};
        document.querySelectorAll('[data-pperm]').forEach(c => {
          const i = c.dataset.pperm.indexOf(':'), id = c.dataset.pperm.slice(0, i), k = c.dataset.pperm.slice(i + 1);
          (want[id] = want[id] || []).push(...(c.checked ? [k] : []));
        });
        const same = (x, y) => x.slice().sort().join(',') === y.slice().sort().join(',');
        const changed = Object.keys(want).filter(id => !same(want[id], P.tmpl(id).perms));
        if (!changed.length) return toast('ไม่มีอะไรเปลี่ยน');
        await busy(b, async () => {
          for (const id of changed) {
            const t = P.tmpl(id);
            await hrPositionRequest('POST', { action: 'save-template', position_id: id, cms_role: t.role || '', cms_perms: want[id], finance_role: t.finance || '' });
          }
          HR_POSITION_LOADED = false; HR_POSITION_ERROR = '';
          await hrLoadPositions().catch(() => { });
          HR_POSITION_LOADED = true;
        }, 'กำลังบันทึก…');
        toast(`บันทึกสิทธิ์ของ ${changed.length} ตำแหน่งแล้ว · กำลังปรับสิทธิ์ของคนในตำแหน่งนั้น`);
        App.render();
      } catch (x) { toast(x.message); }
    };
    Object.assign(ACT, { posEdit: ms.acts.posEdit, posReload: ms.acts.posReload, posSaveSched: ms.acts.posSaveSched, posSavePerms: ms.acts.posSavePerms });   // ACT ถูกคัดลอกตอน defMod แล้ว ต้องใส่เองด้วย
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
              const p = (typeof HR_POSITIONS !== 'undefined' ? HR_POSITIONS : []).find(x => x.name_th === ps.value), t = p && posReady() ? P.tmpl(p.id) : null;
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
