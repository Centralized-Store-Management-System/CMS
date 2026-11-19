/* HR Employee Documents — private files + short-lived signed preview URLs */
(function () {
  'use strict';
  const ENDPOINT = 'https://ytxbnqosenolojifeikf.supabase.co/functions/v1/hr-documents';
  const LABELS = {
    resume: 'Resume / ประวัติส่วนตัว',
    id_card: 'บัตรประชาชน',
    education: 'วุฒิการศึกษา',
    contract: 'สัญญาจ้าง',
    bank: 'เอกสารธนาคาร',
    medical: 'ใบรับรองแพทย์',
    social_security: 'ประกันสังคม',
    pdpa: 'เอกสาร PDPA',
    other: 'เอกสารอื่น ๆ'
  };
  const fmtSize = n => n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB';
  const fmtDate = v => { try { return new Date(v).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' }); } catch (_) { return ''; } };
  const escHtml = v => typeof esc === 'function' ? esc(String(v ?? '')) : String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const css = document.createElement('style');
  css.textContent = [
    '.hr-doc-panel{margin:14px 0 18px;padding:14px;border:1px solid var(--line);border-radius:14px;background:var(--surface)}',
    '.hr-doc-panel h4{margin:0 0 5px;font-size:16px}.hr-doc-note{font-size:12px;color:var(--muted);margin:0 0 12px}',
    '.hr-doc-upload{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;margin-bottom:12px}',
    '.hr-doc-upload input,.hr-doc-upload select{min-width:0;width:100%}.hr-doc-upload .wide{grid-column:1/-1}',
    '.hr-doc-list{display:grid;gap:8px}.hr-doc-item{display:flex;align-items:center;gap:10px;padding:10px;border:1px solid var(--line);border-radius:11px;min-width:0}',
    '.hr-doc-item .main{flex:1;min-width:0}.hr-doc-item .t{font-weight:600;overflow-wrap:anywhere}.hr-doc-item .s{font-size:12px;color:var(--muted)}',
    '.hr-doc-item .mini{display:flex;gap:5px;flex-shrink:0}.hr-doc-status{font-size:13px;color:var(--muted);padding:8px 0}',
    '.hr-doc-viewer{position:fixed;inset:0;z-index:11000;background:rgba(0,0,0,.76);display:flex;flex-direction:column;padding:12px;gap:10px}',
    '.hr-doc-viewer header{display:flex;align-items:center;gap:10px;color:#fff}.hr-doc-viewer header strong{flex:1;min-width:0;overflow-wrap:anywhere}',
    '.hr-doc-viewer .body{flex:1;min-height:0;background:#fff;border-radius:12px;overflow:auto;display:grid;place-items:center}',
    '.hr-doc-viewer iframe{width:100%;height:100%;border:0}.hr-doc-viewer img{max-width:100%;max-height:100%;object-fit:contain}',
    '@media(max-width:480px){.hr-doc-upload{grid-template-columns:1fr}.hr-doc-upload .wide{grid-column:auto}.hr-doc-item{align-items:flex-start;flex-wrap:wrap}.hr-doc-item .mini{margin-left:auto}}'
  ].join('');
  document.head.appendChild(css);

  async function api(path, options = {}) {
    const headers = { ...(options.headers || {}), 'x-cms-session': S.token || '' };
    const response = await fetch(ENDPOINT + path, { ...options, headers, cache: 'no-store' });
    let result;
    try { result = await response.json(); } catch (_) { throw new Error('เซิร์ฟเวอร์เอกสารตอบกลับผิดรูปแบบ'); }
    if (!response.ok || !result.ok) throw new Error(result.error || 'ดำเนินการไม่สำเร็จ');
    return result;
  }
  function mount(employeeId) {
    const sh = document.querySelector('.scrim .sheet');
    if (!sh || sh.querySelector('.hr-doc-panel')) return;
    const actions = sh.querySelector('.actions');
    if (!actions) return;
    const panel = document.createElement('section');
    panel.className = 'hr-doc-panel';
    panel.dataset.employeeId = employeeId;
    panel.innerHTML = `
      <h4>📁 เอกสารประจำตัวพนักงาน</h4>
      <p class="hr-doc-note">จัดเก็บใน Private Storage · ดูเอกสารได้เฉพาะ Owner / HR ที่มีสิทธิ์สาขานี้ · ลิงก์ดูไฟล์หมดอายุภายใน 5 นาที</p>
      <div class="hr-doc-upload">
        <div class="field"><label>ประเภทเอกสาร</label><select data-doc-category>${Object.entries(LABELS).map(([k,v]) => `<option value="${k}">${escHtml(v)}</option>`).join('')}</select></div>
        <div class="field"><label>ชื่อเอกสาร</label><input type="text" data-doc-label maxlength="120" placeholder="เช่น Resume 2026"></div>
        <div class="field wide"><label>เลือกไฟล์ (PDF / JPG / PNG / WEBP · ไม่เกิน 20 MB)</label><input type="file" data-doc-file accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp" multiple></div>
        <button type="button" class="btn primary wide" data-doc-upload>อัปโหลดเอกสาร</button>
      </div>
      <div class="hr-doc-status" data-doc-status>กำลังโหลดรายการเอกสาร…</div>
      <div class="hr-doc-list" data-doc-list></div>`;
    sh.insertBefore(panel, actions);
    panel.addEventListener('click', async ev => {
      const view = ev.target.closest('[data-doc-view]');
      const del = ev.target.closest('[data-doc-delete]');
      const upload = ev.target.closest('[data-doc-upload]');
      if (upload) { ev.preventDefault(); await uploadFiles(panel, upload); }
      if (view) { ev.preventDefault(); await viewFile(panel, view.dataset.docView); }
      if (del) {
        ev.preventDefault();
        if (!confirm('ยืนยันลบเอกสารนี้? ไฟล์จะถูกลบจากที่เก็บเอกสารด้วย')) return;
        const status = panel.querySelector('[data-doc-status]');
        status.textContent = 'กำลังลบเอกสาร…';
        try { await api('', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'delete', id: del.dataset.docDelete }) }); await load(panel); }
        catch (e) { status.textContent = e.message; }
      }
    });
    load(panel);
  }
  async function load(panel) {
    const status = panel.querySelector('[data-doc-status]'), list = panel.querySelector('[data-doc-list]');
    status.textContent = 'กำลังโหลดรายการเอกสาร…'; list.innerHTML = '';
    try {
      const id = encodeURIComponent(panel.dataset.employeeId);
      const result = await api('?action=list&employeeId=' + id);
      const docs = result.documents || [];
      status.textContent = docs.length ? 'เอกสารทั้งหมด ' + docs.length + ' รายการ' : 'ยังไม่มีเอกสารของพนักงานคนนี้';
      list.innerHTML = docs.map(d => `
        <div class="hr-doc-item">
          <span aria-hidden="true">${d.mime_type === 'application/pdf' ? '📄' : '🖼️'}</span>
          <span class="main"><span class="t">${escHtml(d.label)}</span><span class="s">${escHtml(LABELS[d.category] || d.category)} · ${escHtml(d.original_name)} · ${fmtSize(Number(d.size_bytes))}</span><span class="s">อัปโหลด ${escHtml(fmtDate(d.created_at))}</span></span>
          <span class="mini"><button type="button" class="btn sm" data-doc-view="${escHtml(d.id)}">View</button><button type="button" class="btn sm danger" data-doc-delete="${escHtml(d.id)}">ลบ</button></span>
        </div>`).join('');
    } catch (e) { status.textContent = e.message; }
  }
  async function uploadFiles(panel, button) {
    const input = panel.querySelector('[data-doc-file]'), files = Array.from(input.files || []);
    const labelInput = panel.querySelector('[data-doc-label]');
    if (!files.length) { panel.querySelector('[data-doc-status]').textContent = 'กรุณาเลือกไฟล์ก่อนอัปโหลด'; return; }
    const status = panel.querySelector('[data-doc-status]');
    button.disabled = true;
    try {
      for (let i = 0; i < files.length; i++) {
        status.textContent = `กำลังอัปโหลด ${i + 1}/${files.length}: ${files[i].name}`;
        const fd = new FormData();
        fd.append('employeeId', panel.dataset.employeeId);
        fd.append('category', panel.querySelector('[data-doc-category]').value);
        fd.append('label', labelInput.value.trim() || files[i].name.replace(/\.[^.]+$/, ''));
        fd.append('file', files[i], files[i].name);
        await api('', { method: 'POST', body: fd });
      }
      input.value = ''; labelInput.value = '';
      await load(panel);
    } catch (e) { status.textContent = e.message; }
    finally { button.disabled = false; }
  }
  async function viewFile(panel, id) {
    const status = panel.querySelector('[data-doc-status]');
    status.textContent = 'กำลังเปิดเอกสาร…';
    try {
      const r = await api('?action=view&id=' + encodeURIComponent(id));
      const d = document.createElement('div');
      d.className = 'hr-doc-viewer';
      const body = r.mimeType === 'application/pdf'
        ? `<iframe title="Document preview" src="${escHtml(r.url)}#toolbar=1"></iframe>`
        : `<img src="${escHtml(r.url)}" alt="เอกสารพนักงาน">`;
      d.innerHTML = `<header><strong>ตัวอย่างเอกสาร</strong><a class="btn sm" href="${escHtml(r.url)}" target="_blank" rel="noopener noreferrer">เปิดเต็มจอ</a><button type="button" class="btn sm" data-view-close>ปิด</button></header><div class="body">${body}</div><p style="margin:0;color:#fff;text-align:center;font-size:12px">ลิงก์ดูเอกสารมีอายุ 5 นาที</p>`;
      d.querySelector('[data-view-close]').onclick = () => d.remove();
      d.addEventListener('click', e => { if (e.target === d) d.remove(); });
      document.body.appendChild(d);
      status.textContent = 'เปิดเอกสารแล้ว';
    } catch (e) { status.textContent = e.message; }
  }

  // Documents tab: employee directory first, then each employee's uploads newest-first.
  const directory = { employeeId: '', documents: [], loading: false, error: '' };
  function renderDirectory() {
    const employees = (S.t.employees || [])
      .filter(e => myEmp(e) && inBr(e.branch))
      .sort((a, b) => String(a.firstName || '').localeCompare(String(b.firstName || ''), 'th') || String(a.lastName || '').localeCompare(String(b.lastName || ''), 'th'));
    const emp = employees.find(e => String(e.id) === String(directory.employeeId));
    if (!emp) {
      directory.employeeId = '';
      return `
        <div class="h2">Documents <span class="spacer"></span><span class="chip">${employees.length} employees</span></div>
        <p class="note">เลือกชื่อพนักงานเพื่อดูเอกสารที่อัปโหลดไว้ เรียงจากรายการที่อัปโหลดล่าสุด</p>
        <div class="group hr-doc-directory">
          ${employees.map(e => `<button type="button" class="row" data-hrdocs-open="${escHtml(e.id)}">
            ${typeof avatar === 'function' ? avatar(e) : '<span class="avatar">👤</span>'}
            <span class="main"><span class="t">${escHtml(fullName(e))}</span><span class="s">${escHtml(e.code || '')}${e.position ? ' · ' + escHtml(e.position) : ''}${multiBranch() ? ' · ' + escHtml(branchName(e.branch)) : ''}</span></span>
            <span class="v" aria-hidden="true">›</span>
          </button>`).join('') || empty('ยังไม่มีรายชื่อพนักงานในขอบเขตที่คุณดูแล')}
        </div>`;
    }
    return `
      <div class="h2"><button type="button" class="btn sm" data-hrdocs-back>‹ พนักงานทั้งหมด</button><span class="spacer"></span><button type="button" class="btn primary" data-hrdocs-upload="${escHtml(emp.id)}">จัดการ / เพิ่มเอกสาร</button></div>
      <div class="group pad" style="margin-bottom:12px">
        <div class="row static">${typeof avatar === 'function' ? avatar(emp) : '<span class="avatar">👤</span>'}<span class="main"><span class="t">${escHtml(fullName(emp))}</span><span class="s">${escHtml(emp.code || '')}${emp.position ? ' · ' + escHtml(emp.position) : ''}${multiBranch() ? ' · ' + escHtml(branchName(emp.branch)) : ''}</span></span></div>
      </div>
      <div class="h2">เอกสารพนักงาน <span class="spacer"></span><span class="chip">${directory.documents.length} รายการ</span></div>
      <p class="note">เรียงตามเวลาอัปโหลด โดยรายการล่าสุดอยู่ด้านบน · ลิงก์ดูเอกสารมีอายุ 5 นาที</p>
      ${directory.loading ? '<div class="hr-doc-status">กำลังโหลดเอกสาร…</div>' : ''}
      ${directory.error ? `<p class="note bad">${escHtml(directory.error)}</p>` : ''}
      <div class="hr-doc-list">${directory.documents.map(d => `
        <div class="hr-doc-item">
          <span aria-hidden="true">${d.mime_type === 'application/pdf' ? '📄' : '🖼️'}</span>
          <span class="main"><span class="t"><button type="button" class="linkbtn" data-hrdocs-view="${escHtml(d.id)}" style="padding:0;text-align:left;font-weight:600">${escHtml(d.original_name)}</button></span><span class="s">${escHtml(d.label)} · ${escHtml(LABELS[d.category] || d.category)} · ${fmtSize(Number(d.size_bytes))}</span><span class="s">อัปโหลด ${escHtml(fmtDate(d.created_at))}</span></span>
          <span class="mini"><button type="button" class="btn sm" data-hrdocs-view="${escHtml(d.id)}">View</button><button type="button" class="btn sm danger" data-hrdocs-delete="${escHtml(d.id)}">ลบ</button></span>
        </div>`).join('') || (!directory.loading ? '<div class="group pad"><p class="muted" style="margin:0">ยังไม่มีเอกสารของพนักงานคนนี้</p></div>' : '')}</div>`;
  }
  async function selectDirectoryEmployee(id) {
    directory.employeeId = String(id);
    directory.documents = [];
    directory.loading = true;
    directory.error = '';
    App.render();
    try {
      const result = await api('?action=list&employeeId=' + encodeURIComponent(id));
      directory.documents = (result.documents || []).slice().sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    } catch (e) { directory.error = e.message || 'โหลดเอกสารไม่สำเร็จ'; }
    finally { directory.loading = false; App.render(); }
  }
  async function previewDirectoryDocument(id) {
    try {
      const r = await api('?action=view&id=' + encodeURIComponent(id));
      const d = document.createElement('div');
      d.className = 'hr-doc-viewer';
      const body = r.mimeType === 'application/pdf'
        ? `<iframe title="Document preview" src="${escHtml(r.url)}#toolbar=1"></iframe>`
        : `<img src="${escHtml(r.url)}" alt="เอกสารพนักงาน">`;
      d.innerHTML = `<header><strong>ตัวอย่างเอกสาร</strong><a class="btn sm" href="${escHtml(r.url)}" target="_blank" rel="noopener noreferrer">เปิดเต็มจอ</a><button type="button" class="btn sm" data-view-close>ปิด</button></header><div class="body">${body}</div><p style="margin:0;color:#fff;text-align:center;font-size:12px">ลิงก์ดูเอกสารมีอายุ 5 นาที</p>`;
      d.querySelector('[data-view-close]').onclick = () => d.remove();
      d.addEventListener('click', e => { if (e.target === d) d.remove(); });
      document.body.appendChild(d);
    } catch (e) { toast(e.message || 'เปิดเอกสารไม่สำเร็จ'); }
  }
  document.addEventListener('click', async ev => {
    const open = ev.target.closest('[data-hrdocs-open]');
    const back = ev.target.closest('[data-hrdocs-back]');
    const view = ev.target.closest('[data-hrdocs-view]');
    const del = ev.target.closest('[data-hrdocs-delete]');
    const upload = ev.target.closest('[data-hrdocs-upload]');
    if (open) { ev.preventDefault(); await selectDirectoryEmployee(open.dataset.hrdocsOpen); }
    else if (back) { ev.preventDefault(); directory.employeeId = ''; directory.documents = []; directory.error = ''; App.render(); }
    else if (view) { ev.preventDefault(); await previewDirectoryDocument(view.dataset.hrdocsView); }
    else if (del) {
      ev.preventDefault();
      if (!confirm('ยืนยันลบเอกสารนี้? ไฟล์จะถูกลบจาก Private Storage ด้วย')) return;
      try {
        await api('', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'delete', id: del.dataset.hrdocsDelete }) });
        directory.documents = directory.documents.filter(d => String(d.id) !== String(del.dataset.hrdocsDelete));
        App.render();
        toast('ลบเอกสารเรียบร้อยแล้ว');
      } catch (e) { toast(e.message || 'ลบเอกสารไม่สำเร็จ'); }
    }
    else if (upload) { ev.preventDefault(); openEmp(upload.dataset.hrdocsUpload); }
  });
  window.HRDocuments = { view: renderDirectory };

  if (typeof openEmp === 'function') {
    const originalOpenEmp = openEmp;
    openEmp = function (id, draft) {
      const result = originalOpenEmp.apply(this, arguments);
      if (id) setTimeout(() => mount(String(id)), 0);
      return result;
    };
  }
})();
