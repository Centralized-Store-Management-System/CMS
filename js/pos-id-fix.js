/* ซ่อมการเชื่อมพนักงาน ↔ ตำแหน่ง ให้ผูกด้วย "รหัส" ไม่ใช่ "ชื่อ" (เซิร์ฟเวอร์ 66_PositionId.gs)
 * - เดิมคอลัมน์ positionId / positionCode ไม่ถูกประกาศฝั่งเซิร์ฟเวอร์ ค่าที่ส่งไปจึงถูกทิ้งทุกครั้ง
 *   ตำแหน่งเลยผูกกันด้วยชื่อ ถ้าเปลี่ยนชื่อตำแหน่ง สิทธิ์/Role ตามตำแหน่งจะหลุดเงียบๆ
 * - ไฟล์นี้: เติมรหัสให้อัตโนมัติทุกครั้งที่บันทึกพนักงาน + ปุ่มซ่อมข้อมูลเก่าที่ Settings › Permissions
 * - เทียบด้วยชื่อตำแหน่งที่บันทึกไว้ (ของเดิมใช้ชื่ออยู่แล้ว) → เติม positionId / positionCode ให้ตรงกัน
 * ต่อยอด DB.upsertMany และ view ของหน้า Permissions — ไม่แก้ mod-hr.js / mod-settings.js */
(function () {
  if (typeof DB !== 'object' || typeof S !== 'object' || !window.PosPerms) return;
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const posList = () => (typeof HR_POSITIONS !== 'undefined' ? HR_POSITIONS : []);
  const ready = () => typeof HR_POSITION_LOADED !== 'undefined' && HR_POSITION_LOADED && !HR_POSITION_ERROR && posList().length > 0;
  /** ตำแหน่งของพนักงานคนนี้ตามข้อมูลที่มี (รหัส → รหัสตำแหน่ง → ชื่อ) */
  const posOf = e => e && posList().find(p => (e.positionId && p.id === e.positionId) || (e.positionCode && p.position_code === e.positionCode) || (e.position && p.name_th === e.position));
  /** ต้องเติมอะไรให้แถวนี้ไหม ({} = ไม่ต้อง) */
  function want(e) {
    if (!ready() || !e || !String(e.position || '').trim()) return null;
    const p = posOf(e);
    if (!p) return null;
    const ch = {};
    if (UUID.test(String(p.id || '')) && e.positionId !== p.id) ch.positionId = p.id;
    if (p.position_code && e.positionCode !== p.position_code) ch.positionCode = p.position_code;
    return Object.keys(ch).length ? ch : null;
  }

  // บันทึกพนักงานครั้งต่อไป เติมรหัสให้เองเสมอ (ทุกช่องทางที่ผ่าน DB)
  const um0 = DB.upsertMany;
  DB.upsertMany = async function (table, rows) {
    if (table === 'employees' && Array.isArray(rows)) rows.forEach(r => {
      try {
        const cur = (typeof empById === 'function' && r.id && empById(r.id)) || {};
        const ch = want({ ...cur, ...r });
        if (ch) Object.assign(r, ch);
      } catch (_) { /* ไม่ให้การบันทึกพัง */ }
    });
    return um0.apply(this, arguments);
  };

  // แผงซ่อมข้อมูลเก่าในหน้า Settings › Permissions (ต่อท้ายส่วนสิทธิ์ตามตำแหน่ง)
  function panel() {
    if (!ready()) return '';
    const bad = (S.t.employees || []).filter(e => e.status !== 'ลาออก' && want(e));
    const noPos = (S.t.employees || []).filter(e => e.status !== 'ลาออก' && !String(e.position || '').trim());
    const unknown = (S.t.employees || []).filter(e => e.status !== 'ลาออก' && String(e.position || '').trim() && !posOf(e));
    if (!bad.length && !unknown.length && !noPos.length) return '<p class="note">พนักงานทุกคนผูกกับตำแหน่งด้วยรหัสเรียบร้อย</p>';
    const nm = e => (typeof shortName === 'function' ? shortName(e) : e.nickname || e.code);
    let h = '';
    if (bad.length) h += `<p class="status warn" style="margin:8px 0">พนักงาน ${bad.length} คนยังผูกตำแหน่งด้วยชื่อ (${bad.slice(0, 5).map(e => esc(nm(e))).join(', ')}${bad.length > 5 ? ' …' : ''}) ถ้าเปลี่ยนชื่อตำแหน่ง สิทธิ์ตามตำแหน่งของคนเหล่านี้จะหลุด</p>
      <div class="actions" style="margin-top:0"><button class="btn primary" data-a="posFixLinks">ซ่อมการเชื่อมตำแหน่ง (${bad.length} คน)</button></div>`;
    if (unknown.length) h += `<p class="note">ไม่พบตำแหน่งที่ตรงกับที่บันทึกไว้ของ ${unknown.length} คน (${unknown.slice(0, 5).map(e => esc(nm(e)) + ' = ' + esc(e.position)).join(', ')}) — แก้ตำแหน่งของคนเหล่านี้ที่ HR › Employees</p>`;
    if (noPos.length) h += `<p class="note">ยังไม่ได้ระบุตำแหน่ง ${noPos.length} คน</p>`;
    return h;
  }

  const ms = typeof modBy === 'function' && modBy('set'), sub = ms && ms.subs && ms.subs.find(s => s.key === 'perms');
  if (sub && !sub.__pif) {
    const v0 = sub.view; sub.__pif = 1;
    sub.view = function () {
      const h = v0.apply(this, arguments);
      let p = ''; try { p = panel(); } catch (_) { /* ส่วนเสริมไม่ให้หน้าหลักพัง */ }
      if (!p) return h;
      const mark = '<h3 class="h3">สิทธิ์เมนูตามตำแหน่ง</h3>', at = h.indexOf(mark);
      return at < 0 ? h + p : h.slice(0, at) + p + h.slice(at);
    };
    ms.acts = ms.acts || {};
    ms.acts.posFixLinks = async (a, b) => {
      try {
        const rows = (S.t.employees || []).filter(e => e.status !== 'ลาออก' && want(e)).map(e => ({ id: e.id, ...want(e) }));
        if (!rows.length) return toast('ไม่มีอะไรต้องซ่อม');
        await busy(b, () => DB.upsertMany('employees', rows), 'กำลังซ่อม…');
        toast(`ซ่อมแล้ว ${rows.length} คน · ตำแหน่งผูกด้วยรหัสแล้ว เปลี่ยนชื่อตำแหน่งได้โดยสิทธิ์ไม่หลุด`);
        App.render();
      } catch (x) { toast(x.message); }
    };
    Object.assign(ACT, { posFixLinks: ms.acts.posFixLinks });
  }
})();
