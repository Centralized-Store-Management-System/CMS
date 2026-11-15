/* แท็บ "แลกกะ" ในหน้าลงเวลา / LINE (39_ShiftSwap.gs)
 * เลือกเพื่อนสาขาเดียวกัน + 1–2 วัน → ดูตัวอย่างก่อน/หลังแลก → ส่งให้ผู้จัดการอนุมัติ (ผลแจ้งใน LINE) */
'use strict';
const SW = { opts: null, loading: false, with: '', d1: '', d2: '', err: '' };
const swLabel = c => { if (c === 'OFF') return 'หยุด'; if (/^C:/.test(c || '')) return c.slice(2); const s = SW.opts && SW.opts.shifts[String(c || '').toUpperCase()]; return c ? c + (s ? ' ' + s.start.replace(/^0/, '') + '–' + s.end.replace(/^0/, '') : '') : 'เวลาปกติ'; };
async function swLoad(force) {
  if ((SW.opts && !force) || SW.loading) return;
  SW.loading = true;
  try { SW.opts = await API.call('myRequest', { t: S.token, p: JSON.stringify({ kind: 'swapOpts' }) }); SW.err = ''; }
  catch (e) { SW.err = e.message; if (e.code === 'SESSION') return backToWho('หมดเวลาการใช้งาน'); }
  finally { SW.loading = false; if (C.step === 'me' && C.tab === 'swap') render(); }
}
function tabSwap() {
  if (!SW.opts) { swLoad(); return `<p class="loading" style="margin:18px 0">กำลังโหลดตารางของเพื่อน…</p>${SW.err ? `<p class="status bad">${esc(SW.err)}</p>` : ''}`; }
  const o = SW.opts, T = o.team, idx = d => o.dates.indexOf(d), mate = T.find(x => x.id === SW.with);
  const dOpt = (sel, skip) => o.dates.map((d, i) => d === skip ? '' : `<option value="${d}"${d === sel ? ' selected' : ''}>${esc(thDate(d, { weekday: 'short', day: 'numeric', month: 'short' }))} · ฉัน ${esc(swLabel(o.me.plan[i]))}${mate ? ' / ' + esc(mate.name) + ' ' + esc(swLabel(mate.plan[i])) : ''}</option>`).join('');
  let prev = '';
  if (mate && SW.d1) {
    const ds = [SW.d1, SW.d2].filter(Boolean);
    prev = `<div class="group" style="margin-top:10px">${ds.map(d => { const i = idx(d), a = o.me.plan[i], b = mate.plan[i]; return `<div class="row static"><span class="main"><span class="t">${esc(thDate(d, { weekday: 'short', day: 'numeric', month: 'short' }))}</span><span class="s">ฉัน: ${esc(swLabel(a))} → <b>${esc(swLabel(b))}</b> · ${esc(mate.name)}: ${esc(swLabel(b))} → <b>${esc(swLabel(a))}</b></span></span>${a === b ? '<span class="chip warn">กะเหมือนกัน</span>' : ''}</div>`; }).join('')}</div>`;
  }
  const st = { 'รออนุมัติ': 'warn', 'อนุมัติ': 'ok', 'ไม่อนุมัติ': 'bad' };
  const mine = (o.mine || []).map(r => {
    let before = []; try { before = JSON.parse(r.before || '[]'); } catch (e) { /* */ }
    const lines = before.map(x => `${thDate(x.d)} ${r.mine ? swLabel(x.a) + ' ↔ ' + swLabel(x.b) : swLabel(x.b) + ' ↔ ' + swLabel(x.a)}`).join(' · ');
    return `<div class="row static"><span class="main"><span class="t">${r.mine ? 'ขอแลกกับ ' : 'ถูกขอแลกโดย '}${esc(r.other)}</span><span class="s">${esc(lines)}${r.decideNote ? ' · ' + esc(r.decideNote) : ''}</span></span><span class="chip ${st[r.status] || ''}">${esc(r.status)}</span>${r.mine && r.status === 'รออนุมัติ' ? `<button class="btn sm" data-a="swCancel:${esc(r.id)}">ยกเลิก</button>` : ''}</div>`;
  }).join('');
  return `<p class="note" style="margin-top:0">ตกลงกับเพื่อนก่อน แล้วส่งคำขอให้ผู้จัดการอนุมัติ เมื่ออนุมัติ ตารางงานของทั้งสองคนเปลี่ยนให้เอง · แลกวันหยุดเลือก 2 วัน</p>
  ${T.length ? `<div class="group pad"><div class="form">
    <div class="field"><label for="sw-with">แลกกับ</label><select id="sw-with" data-sw="with"><option value="">เลือกเพื่อน</option>${T.map(x => `<option value="${esc(x.id)}"${x.id === SW.with ? ' selected' : ''}>${esc(x.name)}</option>`).join('')}</select></div>
    <div class="field"><label for="sw-d1">วันที่ 1</label><select id="sw-d1" data-sw="d1"><option value="">เลือกวัน</option>${dOpt(SW.d1)}</select></div>
    <div class="field"><label for="sw-d2">วันที่ 2 (ถ้าแลกวันหยุด)</label><select id="sw-d2" data-sw="d2"><option value="">ไม่มี</option>${dOpt(SW.d2, SW.d1)}</select></div>
    <div class="field"><label for="sw-r">เหตุผล</label><input id="sw-r" placeholder="เช่น ไปหาหมอ / ธุระที่บ้าน" maxlength="200"></div></div>${prev}
    <div class="actions" style="margin-bottom:0"><button class="btn primary" data-a="swSend"${mate && SW.d1 ? '' : ' disabled'}>ส่งคำขอแลกกะ</button></div><p class="err" id="sw-err" role="alert"></p></div>`
    : '<div class="group">' + empty('ยังไม่มีเพื่อนร่วมสาขาที่แลกกะได้') + '</div>'}
  <h3 class="h3">คำขอแลกกะ</h3><div class="group">${mine || empty('ยังไม่มีคำขอ')}</div>`;
}
document.addEventListener('change', e => {
  const k = e.target && e.target.dataset && e.target.dataset.sw;
  if (!k) return;
  SW[k] = e.target.value; if (k === 'd1' && SW.d2 === SW.d1) SW.d2 = '';
  const r = ($('#sw-r') || {}).value || ''; render(); if ($('#sw-r')) $('#sw-r').value = r;
});
Object.assign(CACT, {
  swSend: async (a, btn) => {
    const q = { kind: 'swap', withEmpId: SW.with, dates: [SW.d1, SW.d2].filter(Boolean).join(','), reason: (($('#sw-r') || {}).value || '').trim(), reqId: C.reqId = C.reqId || uid() };
    try {
      await busy(btn, () => API.call('myRequest', { t: S.token, p: JSON.stringify(q) }), 'กำลังส่ง…');
      C.reqId = ''; SW.with = ''; SW.d1 = ''; SW.d2 = '';
      C.result = { ok: true, msg: 'ส่งคำขอแลกกะแล้ว รอผู้จัดการอนุมัติ ระบบแจ้งผลใน LINE' };
      swLoad(true); render(); window.scrollTo(0, 0);
    } catch (e) { if (e.code === 'SESSION') return backToWho('หมดเวลาการใช้งาน'); const el = $('#sw-err'); if (el) el.textContent = e.message; }
  },
  swCancel: async (id, btn) => {
    try { await busy(btn, () => API.call('myRequest', { t: S.token, p: JSON.stringify({ kind: 'cancel', table: 'swaps', id }) }), '…'); toast('ยกเลิกคำขอแล้ว'); swLoad(true); }
    catch (e) { toast(e.message); }
  }
});
