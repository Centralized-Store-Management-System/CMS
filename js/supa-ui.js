/* ข้อความในหน้าจอหลังย้ายมา Supabase (19 พ.ย.): ไม่ให้เห็น "Google Sheet / Apps Script" ที่ไม่จริงแล้ว
 * - Settings > Data & Connection: แสดงที่เก็บข้อมูล Supabase แทนลิงก์ Google Sheet เดิม (ไฟล์เดิมหยุดอัปเดตแล้ว เปิดไปจะเห็นข้อมูลเก่า)
 * - ข้อความอื่นๆ: เปลี่ยนคำในหน้าจอ (เว็บหลังร้าน / แอป Owner) โดยไม่แก้ไฟล์เดิม
 * ไฟล์แยก: ลบไฟล์นี้ = กลับเป็นข้อความเดิม */
'use strict';
(function () {
  const REP = [
    [/ตรวจสิทธิ์ที่ฝั่ง Google ทุกครั้ง/g, 'ตรวจสิทธิ์ที่เซิร์ฟเวอร์ทุกครั้ง'],
    [/URL ของ Apps Script ด้านล่าง[^)]*\)?/g, 'ที่อยู่ระบบด้านล่าง (Supabase) แล้วเปิด Use webhook และกด Verify ได้'],
    [/URL ของ Apps Script \/exec/g, 'ที่อยู่ระบบ (Supabase)'],
    [/URL ของ Apps Script Web App/g, 'ที่อยู่ระบบ (API)'],
    [/PIN ตั้งใน Apps Script \(setOwnerPin\)/g, 'PIN ตั้งที่เซิร์ฟเวอร์ (ผู้ดูแลระบบ)'],
    [/เปลี่ยน PIN ที่ Apps Script \(setOwnerPin\)/g, 'เปลี่ยน PIN ได้ที่เซิร์ฟเวอร์ (ผู้ดูแลระบบ)'],
    [/เวอร์ชัน Apps Script/g, 'เวอร์ชันเซิร์ฟเวอร์'],
    [/อัปโหลดหน้าเว็บหรือ Deploy Apps Script เวอร์ชันใหม่/g, 'รีเฟรชหน้าเว็บ หรืออัปโค้ดเซิร์ฟเวอร์ใหม่'],
    [/^Google Apps Script$/g, 'Supabase'],
    [/\(เปิดดูใน Google Sheet ได้\)/g, '(เก็บในฐานข้อมูล Supabase)'],
    [/POST ไปที่ URL Apps Script/g, 'POST ไปที่ที่อยู่ระบบ (Supabase)'],
    [/ทั้งฝั่ง Google และที่หน้าเว็บรอจริง/g, 'ทั้งฝั่งเซิร์ฟเวอร์และที่หน้าเว็บรอจริง'],
    [/เปิด Apps Script แล้วรัน /g, 'ให้ผู้ดูแลระบบรันคำสั่ง '],
    [/เชื่อมต่อ Apps Script ไม่ได้/g, 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้'],
    [/เชื่อม Google Sheet แล้ว 6 ไฟล์/g, 'เชื่อม Supabase แล้ว'],
    /* เพิ่ม 19 พ.ย. (รอบ 2): ข้อความจากเซิร์ฟเวอร์ / หน้า Admin / Owner IT */
    [/(?:ยังไม่ได้ตั้งรหัส Owner: )?รัน setOwnerPin ใน Apps Script/g, 'ยังไม่ได้ตั้งรหัส Owner (ให้ผู้ดูแลระบบตั้ง setOwnerPin)'],
    [/เปลี่ยนที่ Apps Script \(setOwnerPin\)/g, 'เปลี่ยนได้ที่ผู้ดูแลระบบ (setOwnerPin)'],
    [/ให้รัน setup ใน Apps Script ก่อน/g, 'ให้ผู้ดูแลระบบรัน setup ก่อน'],
    [/Apps Script นี้ไม่รองรับ/g, 'เซิร์ฟเวอร์นี้ไม่รองรับ'],
    [/URL ต้องเป็นลิงก์ Web App ของ Apps Script ที่ลงท้ายด้วย \/exec/g, 'ที่อยู่ระบบไม่ถูกต้อง (ต้องเป็นที่อยู่ Supabase /functions/v1/…)'],
    [/เก็บที่ฝั่ง Google ไม่แสดงในหน้าเว็บ/g, 'เก็บที่เซิร์ฟเวอร์ ไม่แสดงในหน้าเว็บ'],
    [/ตรวจใน Google Drive/g, 'ตรวจในที่เก็บไฟล์ (Supabase)'],
    [/ย้ายไป Drive/g, 'ย้ายไปที่เก็บไฟล์'],
    [/^Google$/g, 'เซิร์ฟเวอร์'],
    [/ชีต/g, 'ตาราง']   // ข้อมูลอยู่ในตารางของ Supabase แล้ว (ชื่อตารางเดิมคงไว้)
  ];
  const HINT = /Google|Apps Script|ชีต|Drive/;
  function fixNode(n) {
    if (n.nodeType === 3) { if (!HINT.test(n.nodeValue)) return; let v = n.nodeValue; REP.forEach(([a, b]) => { v = v.replace(a, b); }); if (v !== n.nodeValue) n.nodeValue = v; return; }
    if (n.nodeType !== 1 || n.closest('script,style,textarea,input,[contenteditable]')) return;
    const w = document.createTreeWalker(n, NodeFilter.SHOW_TEXT); let t; while ((t = w.nextNode())) fixNode(t);
  }
  new MutationObserver(ms => ms.forEach(m => { m.addedNodes.forEach(fixNode); if (m.type === 'characterData') fixNode(m.target); })).observe(document.documentElement, { childList: true, subtree: true, characterData: true });
  fixNode(document.body);

  /* ---------- Settings > Data & Connection ---------- */
  const set = typeof MODS !== 'undefined' && MODS.find(m => m.key === 'set');
  const sub = set && set.subs && set.subs.find(s => s.key === 'data');
  if (!sub) return;
  const v0 = sub.view;
  sub.view = function () {
    if (S.demo) return v0.apply(this, arguments);
    const api = (S.cfg && S.cfg.apiUrl) || window.AMZ_API || '';
    const books = S.books || {}, names = { core: 'ระบบหลัก', hr: 'HR', time: 'เวลาทำงานและตารางงาน', payroll: 'เงินเดือน', stock: 'สต็อก', acct: 'บัญชี' };
    let h = `<h3 class="h3" style="margin-top:4px">ที่เก็บข้อมูล</h3><div class="group">
      ${statRow('ฐานข้อมูล', '<span class="chip ok">Supabase</span>', 'ข้อมูลสดทุกระบบอยู่ที่นี่ · โปรเจกต์ cafe-amazon-order-management')}
      ${Object.keys(names).map(k => statRow(esc((books[k] && books[k].title) || 'Amazon Cafe ' + names[k]), '', 'เก็บใน Supabase (ข้อมูลสด)')).join('')}</div>
      <p class="note">ไฟล์ Google Sheet เดิมหยุดอัปเดตตั้งแต่ 19 พ.ย. 2569 เวลา 09:28 (ย้ายมา Supabase) เก็บไว้เป็นสำเนาเก่าเท่านั้น อย่าแก้ข้อมูลในไฟล์นั้น เพราะจะไม่เข้าระบบ</p>`;
    h += `<h3 class="h3">การเชื่อมต่อ</h3><div class="group">${statRow('ที่อยู่ระบบ (API)', '', esc(api))}${statRow('สำรองข้อมูลอัตโนมัติ', '', 'ทุกคืน เก็บใน Supabase Storage')}</div>
      <input type="hidden" id="c-api" value="${esc(api)}"><div class="actions"><button class="btn" data-a="testApi">ทดสอบการเชื่อมต่อ</button></div>`;
    h += `<h3 class="h3">ข้อมูล</h3><div class="group pad"><div class="actions" style="margin:0"><button class="btn" data-a="exportJson">สำรองข้อมูลทั้งหมด (JSON) ลงเครื่องนี้</button></div></div>`;
    return h;
  };
})();
