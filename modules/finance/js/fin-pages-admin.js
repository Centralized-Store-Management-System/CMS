/* Finance: ข้อมูลบริษัท, คู่ค้า, ผู้ใช้งาน Finance, ประวัติ, ตั้งค่าระบบ (ตั้งค่าเริ่มต้น / ล้างข้อมูลทดสอบ / เริ่มใช้งานจริง) */
(function () {
  'use strict';
  const F = window.FIN, { esc, thDate, table, L, api, run } = F;

  F.page('company', {
    title: 'ข้อมูลบริษัท',
    async render(el) {
      const c = (await api.get('company')).company, admin = F.can('admin'), dis = admin ? '' : 'disabled';
      el.innerHTML = F.head('COMPANY', 'ข้อมูลบริษัท', 'ใช้ในเอกสาร รายงาน และการคำนวณภาษี' + (admin ? '' : ' · แก้ไขได้เฉพาะ Owner')) +
        `<form class="fm-panel" id="fmCo"><div class="fm-form-grid">
          <label class="fm-field fm-field-full"><span>ชื่อบริษัท / กิจการ *</span><input name="legal_name" required maxlength="200" value="${esc(c.legal_name)}" ${dis}></label>
          <label class="fm-field"><span>เลขประจำตัวผู้เสียภาษี (13 หลัก)</span><input name="tax_id" inputmode="numeric" maxlength="13" value="${esc(c.tax_id || '')}" ${dis}></label>
          <label class="fm-field"><span>สำนักงาน</span><span style="display:flex;gap:6px"><select name="branch_type" ${dis}><option value="head_office">สำนักงานใหญ่</option><option value="branch" ${c.branch_type === 'branch' ? 'selected' : ''}>สาขา</option></select><input name="branch_number" placeholder="เลขสาขา" maxlength="5" style="width:110px" value="${esc(c.branch_number || '')}" ${dis}></span></label>
          <label class="fm-field fm-field-full"><span>ที่อยู่</span><textarea name="address" rows="2" maxlength="500" ${dis}>${esc((c.address && c.address.text) || '')}</textarea></label>
          <label class="fm-field"><span>เดือนเริ่มรอบปีบัญชี</span><select name="fiscal_year_start_month" ${dis}>${Array.from({ length: 12 }, (_, i) => `<option value="${i + 1}" ${Number(c.fiscal_year_start_month) === i + 1 ? 'selected' : ''}>${new Date(2026, i, 1).toLocaleDateString('th-TH', { month: 'long' })}</option>`).join('')}</select></label>
          <label class="fm-check" style="align-self:end"><input type="checkbox" name="vat_registered" ${c.vat_registered ? 'checked' : ''} ${dis}> จดทะเบียนภาษีมูลค่าเพิ่ม (VAT)</label>
          <label class="fm-check fm-field-full"><input type="checkbox" name="allow_self_approval" ${c.allow_self_approval ? 'checked' : ''} ${dis}> <span>ให้ Owner อนุมัติรายการที่ตัวเองบันทึกได้ <small class="fm-muted" style="display:block">สำหรับช่วงที่มีผู้ใช้ Finance คนเดียว · ทุกครั้งจะถูกบันทึกในประวัติว่า "อนุมัติตนเอง" · แนะนำให้ปิดเมื่อมีผู้บันทึกบัญชีแยกต่างหาก</small></span></label>
        </div>${admin ? '<div class="fm-form-actions"><button class="fm-btn fm-btn-primary">บันทึก</button></div>' : ''}</form>
        <section class="fm-panel"><dl class="fm-dl"><dt>สถานะ</dt><dd>${c.environment === 'production' ? '<span class="fm-badge ok">ใช้งานจริง</span> ตั้งแต่ ' + F.thDateTime(c.go_live_at) : '<span class="fm-badge warn">โหมดทดสอบ (UAT)</span>'}</dd><dt>สกุลเงิน</dt><dd>${esc(c.currency_code)}</dd></dl></section>`;
      const f = el.querySelector('#fmCo');
      if (admin) f.onsubmit = async e => {
        e.preventDefault();
        const v = Object.fromEntries(new FormData(f));
        const r = await run(f.querySelector('.fm-btn-primary'), () => api.post('company.update', { ...v, fiscal_year_start_month: Number(v.fiscal_year_start_month), vat_registered: f.vat_registered.checked, allow_self_approval: f.allow_self_approval.checked }), 'บันทึกแล้ว');
        if (r) { await F.refreshSession(); F.reload(); }
      };
    },
  });

  F.page('partners', {
    title: 'คู่ค้า',
    async render(el) {
      el.innerHTML = F.head('PARTNERS', 'คู่ค้า', 'ลูกค้า ผู้ขาย และหน่วยงานที่ทำธุรกรรมด้วย', F.can('write') ? '<button class="fm-btn fm-btn-primary" id="fmNewP">＋ เพิ่มคู่ค้า</button>' : '') +
        `<div class="fm-toolbar"><input type="search" id="fmPQ" placeholder="ค้นหาชื่อ / เลขผู้เสียภาษี" style="flex:1;min-width:200px"><select id="fmPT"><option value="">ทุกประเภท</option>${Object.entries(L.partnerType).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select><label class="fm-check"><input type="checkbox" id="fmPAll"> แสดงที่ปิดใช้งาน</label></div><div id="fmPL">${F.loading()}</div>`;
      let rows = [];
      const load = async () => {
        rows = (await api.get('partners', { q: el.querySelector('#fmPQ').value, type: el.querySelector('#fmPT').value, all: el.querySelector('#fmPAll').checked ? 1 : '' })).items;
        el.querySelector('#fmPL').innerHTML = table([{ h: 'ชื่อ', f: p => `<b>${esc(p.display_name)}</b>${p.legal_name ? `<span class="sub">${esc(p.legal_name)}</span>` : ''}` }, { h: 'ประเภท', f: p => esc(L.partnerType[p.partner_type]) }, { h: 'เลขผู้เสียภาษี', f: p => esc(p.tax_id || '–') + (p.branch_number ? `<span class="sub">สาขา ${esc(p.branch_number)}</span>` : '') },
          { h: 'ติดต่อ', f: p => esc(p.phone || '') + (p.email ? `<span class="sub">${esc(p.email)}</span>` : '') }, { h: 'หัก ณ ที่จ่าย', f: p => p.default_wht_type ? esc(p.default_wht_type === 'pnd3' ? 'ภ.ง.ด.3' : 'ภ.ง.ด.53') + (p.default_wht_rate ? ' ' + Number(p.default_wht_rate) + '%' : '') : '–' },
          { h: '', f: p => p.is_active ? '' : '<span class="fm-badge mute">ปิด</span>' }], rows, { empty: 'ยังไม่มีคู่ค้า', rowAttr: p => F.can('write') ? `data-open="${p.id}"` : '' }).replace('class="fm-table"', 'class="fm-table cards"');
      };
      const edit = p => {
        const a = (p && p.address && p.address.text) || '';
        const m = F.modal(p ? 'แก้ไขคู่ค้า' : 'เพิ่มคู่ค้า', `<form id="fmP" class="fm-form-grid">
          <label class="fm-field fm-field-full"><span>ชื่อที่ใช้เรียก *</span><input name="display_name" required maxlength="200" value="${esc(p ? p.display_name : '')}"></label>
          <label class="fm-field fm-field-full"><span>ชื่อตามกฎหมาย (ใช้ในใบกำกับ/หนังสือรับรอง)</span><input name="legal_name" maxlength="200" value="${esc(p ? p.legal_name || '' : '')}"></label>
          <label class="fm-field"><span>ประเภท</span><select name="partner_type">${Object.entries(L.partnerType).map(([k, v]) => `<option value="${k}" ${p && p.partner_type === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
          <label class="fm-field"><span>เลขผู้เสียภาษี (13 หลัก)</span><input name="tax_id" inputmode="numeric" maxlength="13" value="${esc(p ? p.tax_id || '' : '')}"></label>
          <label class="fm-field"><span>เลขสาขา</span><input name="branch_number" maxlength="5" placeholder="00000 = สำนักงานใหญ่" value="${esc(p ? p.branch_number || '' : '')}"></label>
          <label class="fm-field"><span>โทร</span><input name="phone" maxlength="40" value="${esc(p ? p.phone || '' : '')}"></label>
          <label class="fm-field fm-field-full"><span>อีเมล</span><input name="email" type="email" maxlength="254" value="${esc(p ? p.email || '' : '')}"></label>
          <label class="fm-field fm-field-full"><span>ที่อยู่</span><textarea name="address" rows="2" maxlength="500">${esc(a)}</textarea></label>
          <label class="fm-field"><span>แบบหัก ณ ที่จ่าย (เมื่อเราหักเขา)</span><select name="default_wht_type"><option value="">—</option><option value="pnd53" ${p && p.default_wht_type === 'pnd53' ? 'selected' : ''}>ภ.ง.ด.53 — นิติบุคคล</option><option value="pnd3" ${p && p.default_wht_type === 'pnd3' ? 'selected' : ''}>ภ.ง.ด.3 — บุคคลธรรมดา</option></select></label>
          <label class="fm-field"><span>อัตราหักปกติ (%)</span><input name="default_wht_rate" type="number" step="0.5" min="0" max="15" value="${esc(p && p.default_wht_rate != null ? Number(p.default_wht_rate) : '')}"></label>
          ${p ? `<label class="fm-check fm-field-full"><input type="checkbox" name="is_active" ${p.is_active ? 'checked' : ''}> ใช้งาน</label>` : ''}
          <div class="fm-form-actions fm-field-full"><button type="button" class="fm-btn fm-btn-light" data-close>ยกเลิก</button><button class="fm-btn fm-btn-primary">บันทึก</button></div></form>`);
        const f = m.el.querySelector('#fmP');
        f.onsubmit = async e => { e.preventDefault(); const v = Object.fromEntries(new FormData(f)); v.id = p ? p.id : null; v.is_active = p ? f.is_active.checked : true; if (await run(f.querySelector('.fm-btn-primary'), () => api.post('partner.save', v), 'บันทึกแล้ว')) { m.close(); F.bust('partners'); load(); } };
      };
      const nb = el.querySelector('#fmNewP'); if (nb) nb.onclick = () => edit(null);
      let t; el.querySelector('#fmPQ').oninput = () => { clearTimeout(t); t = setTimeout(load, 300); };
      el.querySelector('#fmPT').onchange = load; el.querySelector('#fmPAll').onchange = load;
      el.querySelector('#fmPL').onclick = e => { const tr = e.target.closest('[data-open]'); if (tr) edit(rows.find(p => p.id === tr.dataset.open)); };
      await load();
    },
  });

  F.page('users', {
    title: 'ผู้ใช้งาน Finance', need: 'admin',
    async render(el) {
      const users = (await api.get('users')).items;
      el.innerHTML = F.head('ACCESS CONTROL', 'ผู้ใช้งาน Finance', 'กำหนดสิทธิ์ในระบบ Finance ให้ผู้ใช้ CMS (ไม่เปลี่ยนสิทธิ์ในระบบหลังร้าน) · Owner ของ CMS เป็นเจ้าของ Finance อัตโนมัติ', '<button class="fm-btn fm-btn-primary" id="fmAddU">＋ ให้สิทธิ์ผู้ใช้</button>') +
        `<section class="fm-panel"><div class="fm-form-grid three" style="font-size:12.5px">
          <div><b>ผู้อนุมัติ</b><br><span class="fm-muted">อนุมัติเอกสาร การรับ/จ่ายเงิน สมุดรายวัน แบบภาษี + บันทึกได้ทุกอย่าง (อนุมัติรายการที่ตัวเองบันทึกไม่ได้)</span></div>
          <div><b>ผู้บันทึกบัญชี</b><br><span class="fm-muted">บันทึกรายรับ รายจ่าย รับ/จ่ายเงิน สมุดรายวัน คู่ค้า จัดทำแบบภาษี — อนุมัติไม่ได้</span></div>
          <div><b>ดูอย่างเดียว</b><br><span class="fm-muted">ดูข้อมูลและรายงาน ไม่บันทึก ไม่อนุมัติ</span></div></div></section>` +
        table([{ h: 'ผู้ใช้', f: u => `<b>${esc(u.display_name || u.cms_actor_ref)}</b><span class="sub">${esc(u.cms_actor_ref)}</span>` }, { h: 'สิทธิ์', f: u => esc(L.role[u.role_code]) }, { h: 'สถานะ', f: u => u.is_active ? '<span class="fm-badge ok">ใช้งาน</span>' : '<span class="fm-badge mute">ปิด</span>' }, { h: 'ปรับล่าสุด', f: u => F.thDateTime(u.updated_at) },
          { h: '', cls: 'acts', f: u => u.role_code === 'owner' ? '' : `<button class="fm-btn fm-btn-sm" data-u="${esc(u.cms_actor_ref)}">แก้ไข</button>` }], users, { empty: 'ยังไม่มีผู้ใช้' });
      const edit = async (cur) => {
        let cms = [];
        if (!cur) { try { cms = (await api.get('cms-users', {}, { timeout: 30000 })).items; } catch (e) { F.toast(e.message, 'bad'); return; } }
        const taken = new Set(users.map(u => u.cms_actor_ref));
        const m = F.modal(cur ? 'แก้ไขสิทธิ์' : 'ให้สิทธิ์ผู้ใช้ CMS', `<form id="fmU" class="fm-form-grid">
          ${cur ? `<div class="fm-field fm-field-full"><span>ผู้ใช้</span><b>${esc(cur.display_name)}</b></div>` : `<label class="fm-field fm-field-full"><span>ผู้ใช้ CMS *</span><select name="actor_ref" required><option value="">— เลือก —</option>${cms.filter(c => !taken.has(c.actor_ref)).map(c => `<option value="${esc(c.actor_ref)}" data-name="${esc(c.name)}">${esc(c.name)}${c.username ? ' (' + esc(c.username) + ')' : ''}${c.branch ? ' · ' + esc(c.branch) : ''}</option>`).join('')}</select><small class="fm-muted">รายชื่อจากระบบหลังร้าน (บัญชีที่ใช้งานอยู่)</small></label>`}
          <label class="fm-field"><span>สิทธิ์ใน Finance</span><select name="role">${['approver', 'accountant', 'viewer'].map(r => `<option value="${r}" ${cur && cur.role_code === r ? 'selected' : ''}>${L.role[r]}</option>`).join('')}</select></label>
          <label class="fm-check" style="align-self:end"><input type="checkbox" name="is_active" ${!cur || cur.is_active ? 'checked' : ''}> ใช้งาน</label>
          <div class="fm-form-actions fm-field-full"><button type="button" class="fm-btn fm-btn-light" data-close>ยกเลิก</button><button class="fm-btn fm-btn-primary">บันทึก</button></div></form>`);
        const f = m.el.querySelector('#fmU');
        f.onsubmit = async e => {
          e.preventDefault();
          const ref = cur ? cur.cms_actor_ref : f.actor_ref.value, name = cur ? cur.display_name : (f.actor_ref.selectedOptions[0] || {}).dataset.name;
          if (await run(f.querySelector('.fm-btn-primary'), () => api.post('user.set', { actor_ref: ref, role: f.role.value, is_active: f.is_active.checked, display_name: name }), 'บันทึกสิทธิ์แล้ว')) { m.close(); F.reload(); }
        };
      };
      el.querySelector('#fmAddU').onclick = e => run(e.currentTarget, () => edit(null));
      el.onclick = e => { const b = e.target.closest('[data-u]'); if (b) edit(users.find(u => u.cms_actor_ref === b.dataset.u)); };
    },
  });

  F.page('audit', {
    title: 'ประวัติการทำรายการ', need: 'approve',
    async render(el) {
      const A = { create: 'สร้าง', update: 'แก้ไข', submit: 'ส่งอนุมัติ', approve: 'อนุมัติ', approve_self: 'อนุมัติตนเอง', return: 'ตีกลับ', void: 'ยกเลิก', reverse: 'กลับรายการ', post: 'ลงบัญชี', post_self: 'ลงบัญชี (ตนเอง)', reject: 'ปฏิเสธ', cancel: 'ยกเลิก', mark_paid: 'บันทึกรับ/จ่ายแล้ว', close: 'ปิดรอบ', reopen: 'เปิดรอบใหม่', grant: 'ให้สิทธิ์', prepare: 'จัดทำแบบ', reprepare: 'จัดทำแบบใหม่', mark_submitted: 'บันทึกยื่นแบบ', setup_defaults: 'ตั้งค่าเริ่มต้น', create_periods: 'สร้างรอบบัญชี', purge_test_data: 'ล้างข้อมูลทดสอบ', go_live: 'เริ่มใช้งานจริง', delete_draft: 'ลบร่าง' };
      const E = { document: 'เอกสาร', payment: 'รับ/จ่ายเงิน', journal: 'สมุดรายวัน', partner: 'คู่ค้า', chart_of_account: 'ผังบัญชี', accounting_period: 'รอบบัญชี', tax_filing: 'แบบภาษี', company: 'บริษัท', user_role: 'สิทธิ์ผู้ใช้' };
      el.innerHTML = F.head('AUDIT TRAIL', 'ประวัติการทำรายการ', 'บันทึกทุกการเปลี่ยนแปลง ลบหรือแก้ไขไม่ได้') + `<div class="fm-toolbar"><select id="fmAE"><option value="">ทุกประเภท</option>${Object.entries(E).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></div><div id="fmAL">${F.loading()}</div><div class="fm-center"><button class="fm-btn fm-btn-light" id="fmMore">โหลดเพิ่ม</button></div>`;
      let off = 0, rows = [];
      const load = async (more) => {
        off = more ? off + 100 : 0;
        const r = await api.get('audit', { entity: el.querySelector('#fmAE').value, limit: 100, offset: off });
        rows = more ? rows.concat(r.items) : r.items;
        el.querySelector('#fmMore').hidden = r.items.length < 100;
        el.querySelector('#fmAL').innerHTML = table([{ h: 'เวลา', f: x => F.thDateTime(x.created_at) }, { h: 'ผู้ใช้', f: x => esc(x.actor_name || '') }, { h: 'การกระทำ', f: x => `<b>${esc(A[x.action] || x.action)}</b>` }, { h: 'รายการ', f: x => esc(E[x.entity_type] || x.entity_type) + `<span class="sub">${esc((x.after_data && (x.after_data.document_number || x.after_data.journal_number || x.after_data.display_name || x.after_data.account_code || x.after_data.period_code || x.after_data.form)) || '')}</span>` }], rows, { compact: true, empty: 'ยังไม่มีประวัติ' });
      };
      el.querySelector('#fmAE').onchange = () => load(false);
      el.querySelector('#fmMore').onclick = () => load(true);
      await load(false);
    },
  });

  F.page('settings', {
    title: 'ตั้งค่าระบบ', need: 'admin',
    async render(el) {
      const s = await api.get('summary'), uat = F.session.company.environment !== 'production';
      el.innerHTML = F.head('SETTINGS', 'ตั้งค่าระบบ', '') +
        `<section class="fm-panel"><div class="fm-panel-head"><div><h2>ตั้งค่าเริ่มต้น</h2><p>สร้างผังบัญชีมาตรฐาน (29 บัญชี) และรอบบัญชีรายเดือนของปีที่เลือก — กดซ้ำได้ ไม่สร้างซ้ำ</p></div></div>
          <div class="fm-toolbar"><span class="fm-muted">ตอนนี้: ${s.setup.accounts} บัญชี · ${s.setup.periods} รอบบัญชี</span><select id="fmSY">${[0, 1].map(i => { const y = Number(F.today().slice(0, 4)) + i; return `<option>${y}</option>`; }).join('')}</select><button class="fm-btn fm-btn-primary" id="fmSetup">ตั้งค่าเริ่มต้น</button></div></section>` +
        (uat ? `<section class="fm-panel fm-dz"><div class="fm-panel-head"><div><h2>ล้างข้อมูลทดสอบ</h2><p>ลบเอกสาร รับ/จ่ายเงิน สมุดรายวัน ภาษี และประวัติ ของโหมดทดสอบ — ใช้ได้เฉพาะโหมดทดสอบ</p></div></div>
            <label class="fm-check"><input type="checkbox" id="fmKeep" checked> เก็บการตั้งค่าไว้ (ผังบัญชี คู่ค้า รอบบัญชี ผู้ใช้)</label>
            <div class="fm-form-actions"><button class="fm-btn fm-btn-danger" id="fmPurge">ล้างข้อมูลทดสอบ</button></div></section>
          <section class="fm-panel fm-dz"><div class="fm-panel-head"><div><h2>เริ่มใช้งานจริง</h2><p>เมื่อบริษัทเปิดจริง: ระบบจะล้างรายการทดสอบทั้งหมด (เก็บผังบัญชี คู่ค้า รอบบัญชี ผู้ใช้) แล้วเปลี่ยนเป็น "ใช้งานจริง" <b>ถาวร — ย้อนกลับไม่ได้ และล้างข้อมูลไม่ได้อีก</b></p></div></div>
            <ul class="fm-muted" style="font-size:13px;margin:0 0 10px;padding-left:20px"><li>ตรวจชื่อบริษัท เลขผู้เสียภาษี และสถานะ VAT ให้ถูกต้องก่อน</li><li>ถ้ามียอดยกมา (เงินสด ธนาคาร ทุน) ให้บันทึกเป็นสมุดรายวัน "ยอดยกมา" หลังเริ่มใช้งานจริง</li></ul>
            <div class="fm-form-actions"><button class="fm-btn fm-btn-danger" id="fmLive">เริ่มใช้งานจริง</button></div></section>` :
          `<section class="fm-panel"><div class="fm-panel-head"><div><h2>ใช้งานจริง</h2><p>เริ่มใช้งานจริงแล้ว — ข้อมูลทุกรายการถูกเก็บถาวร แก้ไขได้ด้วยการกลับรายการ/ปรับปรุงเท่านั้น</p></div><span class="fm-badge ok">Production</span></div></section>`);
      el.querySelector('#fmSetup').onclick = e => run(e.currentTarget, () => api.post('setup.defaults', { year: Number(el.querySelector('#fmSY').value) }), r => `สร้างผังบัญชี ${r.accounts_created} บัญชี · รอบบัญชี ${r.periods_created} รอบ`).then(r => { if (r) { F.bust(''); F.reload(); } });
      const pg = el.querySelector('#fmPurge');
      if (pg) pg.onclick = async () => {
        const v = await F.ask('ล้างข้อมูลทดสอบ', 'ลบรายการทดสอบทั้งหมดของบริษัทนี้ — <b>กู้คืนไม่ได้</b><br>พิมพ์ <b>ล้างข้อมูลทดสอบ</b> เพื่อยืนยัน', { input: true, required: true, label: 'พิมพ์ยืนยัน', expect: 'ล้างข้อมูลทดสอบ', danger: true, ok: 'ล้างข้อมูล' });
        if (v && await run(pg, () => api.post('company.purge-test-data', { confirm: v, keep_setup: el.querySelector('#fmKeep').checked }), 'ล้างข้อมูลทดสอบแล้ว')) { F.bust(''); F.refreshBadges(); F.nav('#dashboard'); }
      };
      const lv = el.querySelector('#fmLive');
      if (lv) lv.onclick = async () => {
        const v = await F.ask('เริ่มใช้งานจริง', 'รายการทดสอบทั้งหมดจะถูกลบ และเปลี่ยนเป็นบริษัทจริง <b>ถาวร</b><br>พิมพ์ <b>เริ่มใช้งานจริง</b> เพื่อยืนยัน', { input: true, required: true, label: 'พิมพ์ยืนยัน', expect: 'เริ่มใช้งานจริง', danger: true, ok: 'เริ่มใช้งานจริง' });
        if (v && await run(lv, () => api.post('company.go-live', { confirm: v }), 'เริ่มใช้งานจริงแล้ว')) { F.bust(''); await F.refreshSession(); F.nav('#dashboard'); }
      };
    },
  });
})();
