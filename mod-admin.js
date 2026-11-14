/* System Admin: ตรวจสุขภาพทุกระบบ (ไฟล์ ชีต สิทธิ์ สาขา HR ตารางงาน เวลา สต็อก บัญชี LINE ข้อผิดพลาด)
 * แต่ละปัญหามีคำอธิบาย และปุ่มแก้ไขเมื่อแก้อัตโนมัติได้ ทุกการแก้บันทึกใน Audit log
 * เครื่องมือ: ล้างแคช คิดเวลาทำงานใหม่ ปลดล็อก PIN ให้ทุกคนออกจากระบบ ซ่อมโครงสร้างไฟล์ */
const SEV = { error: ['bad', 'ต้องแก้'], warn: ['warn', 'ควรแก้'], info: ['', 'แจ้งให้ทราบ'] };
const AREA = { structure: 'ไฟล์และชีต', users: 'บัญชีและสิทธิ์', branch: 'สาขา', hr: 'HR', schedule: 'ตารางงาน', time: 'เวลาทำงาน', stock: 'Inventory', acct: 'Accounting', payroll: 'Payroll', settings: 'Settings', line: 'LINE', errors: 'ข้อผิดพลาดระบบ' };
async function runHealth(btn) {
  S.f.health = await busy(btn, () => API.call('adminHealth', { t: S.token }), 'กำลังตรวจ…');
  App.render();
}
function pHealth() {
  const h = S.f.health;
  if (!h) return `<div class="group pad"><p style="margin:0 0 10px">ตรวจทุกระบบในครั้งเดียว: ไฟล์และคอลัมน์ บัญชีผู้ใช้ สาขาและพิกัด ข้อมูลพนักงาน ตารางงาน เวลาทำงานที่คิดไม่ตรงกับตาราง สต็อกติดลบหรือโอนไม่ครบคู่ ยอดขายซ้ำ วันหยุด และข้อผิดพลาดของระบบ</p><button class="btn primary big" data-a="health">เริ่มตรวจระบบ</button></div>`;
  const n = s => h.issues.filter(i => i.sev === s).length;
  let out = `<div class="kpis"><div class="kpi ${n('error') ? 'bad' : 'ok'}"><b>${n('error')}</b><span>ต้องแก้</span></div><div class="kpi ${n('warn') ? 'warn' : 'ok'}"><b>${n('warn')}</b><span>ควรแก้</span></div><div class="kpi"><b>${n('info')}</b><span>แจ้งให้ทราบ</span></div><div class="kpi"><b>${(h.ms / 1000).toFixed(1)}s</b><span>ตรวจเมื่อ ${esc(new Date(h.at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }))}</span></div></div>
  <div class="actions" style="margin-top:0"><button class="btn primary" data-a="health">ตรวจอีกครั้ง</button>${h.issues.some(i => i.fix) ? '<button class="btn" data-a="fixAll">แก้ทุกข้อที่แก้อัตโนมัติได้</button>' : ''}</div>`;
  if (!h.issues.length) return out + `<div class="group">${statRow('ทุกระบบปกติ', '<span class="chip ok">ผ่าน</span>', 'ไม่พบปัญหา')}</div>`;
  ['error', 'warn', 'info'].forEach(sev => {
    const list = h.issues.filter(i => i.sev === sev);
    if (!list.length) return;
    out += `<h3 class="h3">${SEV[sev][1]} (${list.length})</h3><div class="group">${list.map(i => `<div class="row static issue"><span class="main"><span class="t">${esc(i.title)}</span><span class="s">${esc(AREA[i.area] || i.area)}${i.detail ? ' · ' + esc(i.detail) : ''}</span>${i.fix || i.link ? `<span class="acts">${i.fix ? `<button class="btn sm${sev === 'error' ? ' primary' : ''}" data-a="fix:${esc(i.id)}">${esc(i.fix.label)}</button>` : ''}${i.link ? `<a class="btn sm" href="${esc(i.link)}">ไปแก้ที่หน้านั้น</a>` : ''}</span>` : ''}</span><span class="chip ${SEV[sev][0]} sev">${SEV[sev][1]}</span></div>`).join('')}</div>`;
  });
  return out;
}
async function runFix(id, btn) {
  const i = (S.f.health && S.f.health.issues || []).find(x => x.id === id);
  if (!i || !i.fix) return;
  const r = await busy(btn, () => API.write({ op: 'adminFix', code: i.fix.code, args: i.fix.args || {} }), 'กำลังแก้…');
  toast(r.message || 'แก้แล้ว');
  await bootstrap();
  S.f.health = await API.call('adminHealth', { t: S.token });
  App.render();
}
async function fixAll(btn) {
  const seen = new Set(), list = (S.f.health.issues || []).filter(i => i.fix && !seen.has(JSON.stringify(i.fix)) && seen.add(JSON.stringify(i.fix)));
  await busy(btn, async () => { for (const i of list) await API.write({ op: 'adminFix', code: i.fix.code, args: i.fix.args || {} }); }, 'กำลังแก้…');
  toast(`แก้แล้ว ${list.length} รายการ`);
  await bootstrap();
  S.f.health = await API.call('adminHealth', { t: S.token });
  App.render();
}
const TOOLS = [
  ['clearCache', 'ล้างแคช', 'ใช้เมื่อแก้ค่าในชีตโดยตรงแล้วหน้าเว็บยังไม่เปลี่ยน'],
  ['recalc', 'คิดเวลาทำงานใหม่ 45 วันล่าสุด', 'คิดสาย OT ทำงานวันหยุด จากตารางงานและรูปแบบกะปัจจุบัน', { days: 45 }],
  ['unlockAll', 'ปลดล็อก PIN ทุกบัญชี', 'ใช้เมื่อมีคนใส่ PIN ผิดจนถูกล็อก'],
  ['logoutAll', 'ให้ทุกคนออกจากระบบ', 'ใช้หลังเปลี่ยนสิทธิ์ หรือสงสัยว่ามีคนใช้บัญชีคนอื่น (คุณยังอยู่ในระบบ)'],
  ['structure', 'ซ่อมไฟล์ ชีต และคอลัมน์', 'สร้างชีตหรือคอลัมน์ที่ขาด หลังอัปเดตโค้ดเวอร์ชันใหม่'],
  ['rebuildIndex', 'สร้างหน้าสารบัญใหม่', 'ลิงก์ไปทุกไฟล์ในชีต "สารบัญ" ของไฟล์ระบบหลัก'],
  ['installTriggers', 'ติดตั้งตัวตั้งเวลาสรุปรายวัน', 'ส่งสรุปประจำวันทาง LINE ตามเวลาที่ตั้ง']
];
function pTools() {
  return `<div class="group">${TOOLS.map(([k, t, d]) => `<div class="row static"><span class="main"><span class="t">${esc(t)}</span><span class="s">${esc(d)}</span></span><button class="btn sm" data-a="tool:${k}">ทำเลย</button></div>`).join('')}</div>
  <p class="note">ทุกเครื่องมือบันทึกใน Audit log ว่าใครกดเมื่อไร</p>`;
}
async function runTool(k, btn) {
  const t = TOOLS.find(x => x[0] === k); if (!t) return;
  if (['logoutAll', 'structure'].includes(k) && !btn.dataset.armed) return armed(btn, () => runTool(k, btn), 'แตะอีกครั้งเพื่อยืนยัน');
  const r = await busy(btn, () => API.write({ op: 'adminFix', code: k, args: t[3] || {} }), '…');
  toast(r.message || 'เสร็จแล้ว');
  if (k !== 'logoutAll') { await bootstrap(); App.render(); }
}
function pAudit() {
  const f = S.f.logUser || '', q = (S.f.logQ || '').toLowerCase(), only = S.f.logOnly || '';
  const users = [...new Set(S.t.log.map(l => l.code || l.user).filter(Boolean))].sort();
  const list = S.t.log.slice().reverse().filter(l => (!f || (l.code || l.user) === f) && (!only || (only === 'ERROR' ? l.action === 'ERROR' : (l.via || 'web') === only)) && (!q || [l.user, l.action, l.table, l.detail].join(' ').toLowerCase().includes(q))).slice(0, 400);
  return `<div class="toolbar"><select data-ch="logUser" aria-label="กรองผู้ใช้"><option value="">ทุกบัญชี</option>${users.map(u => `<option${u === f ? ' selected' : ''}>${esc(u)}</option>`).join('')}</select><select data-ch="logOnly" aria-label="กรองช่องทาง"><option value="">ทุกช่องทาง</option>${[['web', 'หน้าเว็บ'], ['clock', 'หน้าลงเวลา'], ['LINE', 'LINE'], ['admin', 'Admin'], ['ERROR', 'ข้อผิดพลาดระบบ']].map(([v, l]) => `<option value="${v}"${v === only ? ' selected' : ''}>${l}</option>`).join('')}</select><input type="search" data-ch="logQ" value="${esc(S.f.logQ || '')}" placeholder="ค้นหา" aria-label="ค้นหาใน log"></div>
  <div class="logwrap"><table class="logtbl"><thead><tr><th>เวลา</th><th>ผู้ใช้</th><th>การกระทำ</th><th>ข้อมูล</th><th>รายละเอียด</th></tr></thead><tbody>${list.map(l => `<tr class="${l.action === 'ERROR' ? 'err' : ''}"><td>${esc(l.at)}</td><td>${esc(l.user)}<br><small class="muted">${esc(l.code || '')} · ${esc(l.role || '')}${l.via && l.via !== 'web' ? ' · ' + esc(l.via) : ''}</small></td><td>${esc(l.action)}</td><td>${esc(l.table)}</td><td class="d">${esc(l.detail)}</td></tr>`).join('') || `<tr><td colspan="5">${empty('ไม่พบรายการ')}</td></tr>`}</tbody></table></div>
  <p class="note">แสดง 500 รายการล่าสุด ประวัติทั้งหมดอยู่ในชีต "บันทึกการใช้งาน" ของไฟล์ระบบหลัก (เก็บราว 5,000 รายการล่าสุด)</p>`;
}
function pInfo() {
  const h = S.f.health, counts = h ? Object.entries(h.stats || {}) : [];
  return `<div class="group">${statRow('เวอร์ชันหน้าเว็บ', esc(APP_VER))}${statRow('เวอร์ชัน Apps Script', esc((S.me && S.me.version) || '-'), S.me && S.me.version && S.me.version !== APP_VER ? '<span class="chip warn">ไม่ตรงกัน: อัปโหลดหน้าเว็บหรือ Deploy Apps Script เวอร์ชันใหม่</span>' : '')}${statRow('การเชื่อมต่อ', S.demo ? 'Demo mode' : 'Google Apps Script', S.demo ? 'ข้อมูลอยู่ในเบราว์เซอร์เครื่องนี้เท่านั้น' : esc(S.cfg.apiUrl))}${statRow('สาขา', String(S.t.branches.length))}${statRow('เข้าระบบเป็น', esc(S.me.name), esc((ROLE_NAME[S.me.role] || '') + ' · ' + (S.me.code || '')))}</div>
  ${counts.length ? `<h3 class="h3">จำนวนแถวในแต่ละชีต</h3><div class="group">${counts.map(([k, v]) => statRow(esc(k), fmt(v))).join('')}</div>` : '<p class="note">กดตรวจระบบที่แท็บ Health Check เพื่อดูจำนวนแถวในแต่ละชีต</p>'}`;
}

defMod({
  key: 'admin', mod: 'set', noBranch: true, label: 'System Admin', icon: 'admin', group: 'System', desc: 'ตรวจสุขภาพทุกระบบ แก้ไขปัญหา Audit log',
  perm: ['admin'],
  subs: [
    { key: 'health', label: 'Health Check', view: pHealth },
    { key: 'tools', label: 'Tools', view: pTools },
    { key: 'log', label: 'Audit Log', view: pAudit },
    { key: 'info', label: 'System Info', view: pInfo }
  ],
  summary: () => { const h = S.f.health; if (!h) return 'กดเพื่อตรวจสุขภาพระบบ'; const e = h.issues.filter(i => i.sev === 'error').length, w = h.issues.filter(i => i.sev === 'warn').length; return e || w ? `ต้องแก้ <em>${e}</em> ควรแก้ ${w}` : 'ทุกระบบปกติ'; },
  badge: () => (S.f.health ? S.f.health.issues.filter(i => i.sev === 'error').length : 0),
  acts: { health: (a, b) => runHealth(b), fix: (a, b) => runFix(a, b), fixAll: (a, b) => fixAll(b), tool: (a, b) => runTool(a, b) }
});
