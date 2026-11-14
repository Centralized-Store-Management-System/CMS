/* Design: เปลี่ยนหน้าตาเว็บของร้าน (สีแบรนด์ ฟอนต์ ขนาด มุม ความหนาแน่น โหมดมืด โลโก้ ชื่อบนหน้าเข้าสู่ระบบ)
 * เห็นผลทันทีขณะปรับ (live preview) กดบันทึกแล้วใช้กับทุกคนทั้งหลังร้านและหน้าลงเวลา (เฉพาะ Owner)
 * ทุกคนปรับโหมดสีและขนาดตัวอักษรเฉพาะเครื่องตัวเองได้ */
const FONT_BODY = ['IBM Plex Sans Thai', 'Sarabun', 'Noto Sans Thai', 'Anuphan'];
const FONT_HEAD = ['Prompt', 'Kanit', 'Anuphan', 'IBM Plex Sans Thai'];
const draftTheme = () => S.f.theme || (S.f.theme = parseTheme(S.settings.theme));
function setDraft(patch) { S.f.theme = { ...draftTheme(), ...patch }; applyTheme(S.f.theme, { preview: true }); App.render(); }
function pDesign() {
  const t = draftTheme(), org = can('settings'), dirty = JSON.stringify(t) !== JSON.stringify(parseTheme(S.settings.theme)), me = myThemePrefs();
  let h = '';
  if (org) {
    if (dirty) h += `<div class="group pad" style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;position:sticky;top:8px;z-index:5"><span class="main">กำลังดูตัวอย่าง ยังไม่ได้บันทึก</span><button class="btn" data-a="themeCancel">ยกเลิก</button><button class="btn primary" data-a="themeSave">บันทึกให้ทุกคน</button></div>`;
    h += `<h3 class="h3">ธีมสำเร็จรูป</h3><div class="presets">${Object.entries(THEME_PRESETS).map(([k, p]) => `<button class="preset" aria-pressed="${t.preset === k}" data-a="themePreset:${k}"><span class="sw"><i style="background:${p.primary}"></i><i style="background:${p.accent}"></i><i style="background:${p.bg}"></i></span><b>${esc(p.name)}</b><small>${esc(p.th)}</small></button>`).join('')}</div>`;
    h += `<h3 class="h3">สีและตัวอักษร</h3><div class="group pad"><div class="form">
      <div class="field half"><label for="th-p">สีหลัก (ปุ่ม เมนู)</label><input id="th-p" type="color" data-th="primary" value="${esc(t.primary)}"></div>
      <div class="field half"><label for="th-a">สีเน้น</label><input id="th-a" type="color" data-th="accent" value="${esc(t.accent)}"></div>
      <div class="field half"><label for="th-b">สีพื้นหลัง</label><input id="th-b" type="color" data-th="bg" value="${esc(t.bg)}"></div>
      <div class="field half"><label for="th-m">สีของแต่ละระบบ</label><select id="th-m" data-th="mods">${opts([['multi', 'แยกสีตามระบบ (HR สต็อก บัญชี…)'], ['brand', 'ใช้สีหลักสีเดียวทั้งเว็บ']], t.mods)}</select></div>
      <div class="field half"><label for="th-f">ฟอนต์เนื้อหา</label><select id="th-f" data-th="font">${opts(FONT_BODY, t.font)}</select></div>
      <div class="field half"><label for="th-h">ฟอนต์หัวข้อ</label><select id="th-h" data-th="head">${opts(FONT_HEAD, t.head)}</select></div>
      <div class="field half"><label for="th-s">ขนาดตัวอักษร</label><select id="th-s" data-th="scale">${opts([['s', 'เล็ก'], ['m', 'ปกติ'], ['l', 'ใหญ่'], ['xl', 'ใหญ่มาก']], t.scale)}</select></div>
      <div class="field half"><label for="th-r">มุม</label><select id="th-r" data-th="radius">${opts([['round', 'โค้งมน'], ['square', 'เหลี่ยม เรียบ']], t.radius)}</select></div>
      <div class="field half"><label for="th-d">ความหนาแน่น</label><select id="th-d" data-th="density">${opts([['normal', 'ปกติ (เหมาะกับมือถือ)'], ['compact', 'กระชับ (เห็นข้อมูลมากขึ้น)']], t.density)}</select></div>
      <div class="field half"><label for="th-o">โหมดสีตั้งต้น</label><select id="th-o" data-th="mode">${opts([['auto', 'ตามเครื่องของแต่ละคน'], ['light', 'สว่างเสมอ'], ['dark', 'มืดเสมอ']], t.mode)}</select></div>
    </div></div>`;
    h += `<h3 class="h3">แบรนด์</h3><div class="group pad"><div class="logo-box"><span class="logo">${themeLogo(t, icon('cup'))}</span><span class="main"><b>${esc(t.title || 'Café Amazon')}</b><br><small class="muted">${esc(t.tagline || 'Back Office')}</small></span></div>
      <div class="form" style="margin-top:12px"><div class="field half"><label for="th-t">ชื่อบนเมนูและหน้าเข้าสู่ระบบ</label><input id="th-t" data-th="title" value="${esc(t.title)}" placeholder="Café Amazon" maxlength="40"></div>
      <div class="field half"><label for="th-g">คำบรรยายใต้ชื่อ</label><input id="th-g" data-th="tagline" value="${esc(t.tagline)}" placeholder="Back Office" maxlength="60"></div>
      <div class="field"><label for="th-logo">โลโก้ร้าน (PNG/JPG สี่เหลี่ยมจัตุรัส ระบบย่อเหลือ 160 px)</label><input id="th-logo" type="file" accept="image/png,image/jpeg,image/webp" data-logo="1"></div></div>
      ${t.logo ? '<div class="actions" style="margin-bottom:0"><button class="btn" data-a="themeLogoDel">ลบโลโก้</button></div>' : ''}
      <p class="note">ใช้โลโก้ที่ร้านมีสิทธิ์ใช้ ถ้าเป็นโลโก้แฟรนไชส์ ตรวจข้อกำหนดการใช้แบรนด์ในสัญญาก่อน</p></div>`;
    h += `<h3 class="h3">ตัวอย่าง</h3><div class="group pad"><div class="prev-card"><button class="btn primary">ปุ่มหลัก</button><button class="btn">ปุ่มรอง</button><span class="chip ok">อนุมัติ</span><span class="chip warn">รออนุมัติ</span><span class="chip bad">ไม่อนุมัติ</span><span class="chip br">สาขาตัวเมือง</span></div>
      <div class="kpis" style="margin:12px 0 0"><div class="kpi ok"><b>12,450</b><span>ยอดขายวันนี้</span></div><div class="kpi"><b>186</b><span>แก้ว</span></div><div class="kpi warn"><b>2</b><span>รออนุมัติ</span></div></div></div>
      <div class="actions"><button class="btn" data-a="themeReset">กลับเป็นค่าเริ่มต้น</button><span class="grow"></span>${dirty ? '<button class="btn" data-a="themeCancel">ยกเลิก</button><button class="btn primary" data-a="themeSave">บันทึกให้ทุกคน</button>' : '<span class="muted">บันทึกแล้ว</span>'}</div>`;
  }
  h += `<h3 class="h3">เฉพาะเครื่องนี้</h3><div class="group pad"><div class="form">
    <div class="field half"><label for="my-mode">โหมดสี</label><select id="my-mode" data-my="mode">${opts([['', 'ตามร้าน'], ['auto', 'ตามเครื่อง'], ['light', 'สว่าง'], ['dark', 'มืด']], me.mode || '')}</select></div>
    <div class="field half"><label for="my-scale">ขนาดตัวอักษร</label><select id="my-scale" data-my="scale">${opts([['', 'ตามร้าน'], ['s', 'เล็ก'], ['m', 'ปกติ'], ['l', 'ใหญ่'], ['xl', 'ใหญ่มาก']], me.scale || '')}</select></div>
  </div><p class="note" style="margin-bottom:0">ใช้กับเบราว์เซอร์เครื่องนี้เท่านั้น ไม่กระทบคนอื่น</p></div>`;
  return h;
}
async function themeSave(btn) {
  const t = draftTheme(), v = JSON.stringify(t);
  if (v.length > 47000) throw new Error('โลโก้ใหญ่เกินไป ใช้รูปที่เล็กกว่านี้');
  await busy(btn, () => API.write({ op: 'saveSetting', row: { theme: v } }));
  S.settings.theme = v; S.f.theme = null;
  applyTheme(v);
  toast('บันทึกดีไซน์แล้ว ทุกคนจะเห็นเมื่อเปิดหน้าเว็บครั้งถัดไป');
  App.render();
}
/** ย่อโลโก้เป็น 160px เก็บเป็นข้อความในชีตได้ */
function shrinkLogo(file) {
  return new Promise((res, rej) => {
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => {
      const n = 160, c = document.createElement('canvas'), r = Math.min(n / img.width, n / img.height, 1);
      c.width = Math.round(img.width * r); c.height = Math.round(img.height * r);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      let out = c.toDataURL('image/png');
      if (out.length > 40000) out = c.toDataURL('image/webp', 0.9);
      if (!/^data:image\/webp/.test(out) || out.length > 40000) out = c.toDataURL('image/jpeg', 0.85);
      if (out.length > 40000) return rej(new Error('โลโก้ใหญ่เกินไปหลังย่อ ใช้รูปที่เรียบกว่านี้'));
      res(out);
    };
    img.onerror = () => rej(new Error('อ่านรูปไม่ได้'));
    img.src = url;
  });
}
document.addEventListener('change', async e => {
  const el = e.target;
  try {
    if (el.dataset.th && S.route && S.route.mod === 'design') { setDraft({ [el.dataset.th]: el.value, ...(el.dataset.th === 'primary' || el.dataset.th === 'accent' || el.dataset.th === 'bg' ? { preset: 'custom' } : {}) }); return; }
    if (el.dataset.my) { const p = myThemePrefs(); p[el.dataset.my] = el.value; setMyThemePrefs(p); applyTheme(S.f.theme || S.settings.theme, { preview: !!S.f.theme }); return; }
    if (el.dataset.logo && el.files && el.files[0]) setDraft({ logo: await shrinkLogo(el.files[0]) });
  } catch (err) { toast(err.message); }
});
document.addEventListener('input', e => { const el = e.target; if (el.type === 'color' && el.dataset.th && S.route && S.route.mod === 'design') { S.f.theme = { ...draftTheme(), [el.dataset.th]: el.value, preset: 'custom' }; applyTheme(S.f.theme, { preview: true }); } });
window.addEventListener('hashchange', () => { if (S.f.theme && !location.hash.startsWith('#design')) { S.f.theme = null; applyTheme(S.settings.theme); } });

defMod({
  key: 'design', mod: 'set', noBranch: true, label: 'Design', icon: 'design', group: 'System', desc: 'สีแบรนด์ ฟอนต์ ขนาด โลโก้ โหมดมืด ดูผลทันที',
  perm: ['*'],
  view: pDesign,
  summary: () => { const t = parseTheme(S.settings.theme); return `ธีม ${esc((THEME_PRESETS[t.preset] || { name: 'กำหนดเอง' }).name)}, ฟอนต์ ${esc(t.font)}`; },
  acts: {
    themePreset: k => { const p = THEME_PRESETS[k]; if (p) setDraft({ preset: k, primary: p.primary, accent: p.accent, bg: p.bg, mods: p.mods }); },
    themeSave: (a, b) => themeSave(b),
    themeCancel: () => { S.f.theme = null; applyTheme(S.settings.theme); App.render(); },
    themeReset: () => setDraft({ ...THEME_DEFAULT }),
    themeLogoDel: () => setDraft({ logo: '' })
  }
});
