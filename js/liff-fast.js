/* เปิดหน้าลงเวลาใน LINE (LIFF) ให้เร็ว — แทนลำดับเดิมที่ต้องรอทีละขั้น (ถาม LIFF ID → โหลด LINE SDK → liff.init → ตรวจกับ LINE → ข้อมูลของฉัน)
 * 1) จำ LIFF ID ไว้ในเครื่อง: ครั้งถัดไปไม่ต้องถาม Google ก่อน
 * 2) เคยเข้าแล้ว (ไม่เกิน 5 ชม.): แสดงหน้าของฉันทันทีจากข้อมูลที่จำไว้ แล้วโหลดข้อมูลล่าสุดพร้อมกับ LINE SDK เบื้องหลัง
 *    เมื่อ LINE ยืนยันตัวตนเสร็จ ถ้าไม่ใช่บัญชี LINE เดิม (สลับบัญชี/เครื่องใช้ร่วม) → ล้างทิ้งแล้วเข้าระบบใหม่ทันที
 * 3) ตั๋วเวลาเก่าไม่ถูกนำมาใช้ (เวลาที่กดลงเวลายังยึดเวลาของ Google เหมือนเดิม) และ Google ยังตรวจทุกอย่างตอนบันทึกเหมือนเดิม */
'use strict';
const LF = { key: 'amz.liff', sdk: 'https://static.line-scdn.net/liff/edge/2/sdk.js', maxAge: 5 * 3600e3 };
function lfGet() { try { return JSON.parse(localStorage.getItem(LF.key) || 'null'); } catch (e) { return null; } }
function lfSet(o) { try { localStorage.setItem(LF.key, JSON.stringify(o)); } catch (e) { /* เต็ม/ปิดไว้ ใช้แบบปกติ */ } }
function lfForget() { const c = lfGet(); lfSet(c && c.liffId ? { liffId: c.liffId } : null); }
function lfTab() {
  const qs = new URLSearchParams(location.search);
  if (qs.get('tab')) return qs.get('tab');
  const st = qs.get('liff.state');   // เปิดจาก liff.line.me/…?tab=… ครั้งแรก LINE ส่งมาใน liff.state
  if (st) { try { return new URLSearchParams(decodeURIComponent(st).split('?')[1] || '').get('tab'); } catch (e) { /* */ } }
  return null;
}
function lfSave(r, uid, liffId) {
  if (!r || !r.token || !r.my || !uid) return;
  const my = { ...r.my }; delete my.tk;
  lfSet({ liffId, uid, token: r.token, my, at: Date.now() });
}

async function liffFastBoot() {
  const tab = lfTab(), c = lfGet() || {};
  const sdk = window.liff ? Promise.resolve() : loadScript(LF.sdk);
  const knownId = window.AMZ_LIFF || c.liffId || '';
  const infoP = API.call('liffInfo').catch(() => null);   // ปลุก Apps Script + ธีม/ชื่อร้านล่าสุด (ไม่ต้องรอถ้ารู้ LIFF ID แล้ว)
  // 1) แสดงทันทีจากข้อมูลที่จำไว้
  let shown = false, fresh = null;
  if (knownId && c.token && c.my && c.uid && Date.now() - (c.at || 0) < LF.maxAge) {
    const my = { ...c.my, lite: false }; delete my.tk;
    enterMe({ token: c.token, my }, tab); shown = true;
    fresh = API.call('my', { t: c.token }).then(m => { setMy(m); if (C.step === 'me') render(); return true; }, e => (e && e.code === 'SESSION' ? 'expired' : false));
    // บัญชีถูกลบ/ปิด/หมดเวลา: ซ่อนหน้าที่จำไว้ทันที ไม่ต้องรอ LINE SDK (เดิมค้างหน้าเก่า ~5 วิ ก่อนไปหน้าลงทะเบียน)
    fresh.then(v => { if (v === 'expired') { lfForget(); S.token = ''; C.my = null; $('#root').innerHTML = '<p class="loading">กำลังเข้าสู่ระบบด้วย LINE…</p>'; } });
  }
  const info = knownId ? { liffId: knownId } : await infoP;
  if (!info || !info.liffId) { if (shown) lfForget(); return shown || false; }
  infoP.then(i => { if (i && i.theme) applyTheme(i.theme); if (i && i.shopName) C.shopName = i.shopName; if (i && i.liffId && i.liffId !== knownId) lfSet({ ...(lfGet() || {}), liffId: i.liffId }); });
  await sdk;
  await liff.init({ liffId: info.liffId });
  if (!liff.isLoggedIn()) { lfForget(); liff.login({ redirectUri: location.href }); return true; }
  C.liff = true;
  let uid = '';
  try { uid = (liff.getDecodedIDToken() || {}).sub || ''; } catch (e) { /* */ }
  if (shown && uid && uid === c.uid) {
    const ok = await fresh;
    if (ok !== 'expired') { lfSet({ ...c, liffId: info.liffId, at: ok === true ? Date.now() : c.at }); return true; }
  }
  // 2) เข้าระบบใหม่ด้วย LINE (ครั้งแรก / หมดเวลา / คนละบัญชี)
  if (shown && uid !== c.uid) { S.token = ''; C.my = null; }
  if (!shown || uid !== c.uid) $('#root').innerHTML = '<p class="loading">กำลังเข้าสู่ระบบด้วย LINE…</p>';
  const r = await API.call('liffLogin', { idToken: liff.getIDToken() });
  if (r.registered) {
    lfSave(r, uid, info.liffId);
    if (shown && uid === c.uid) { S.token = r.token; setMy(r.my); loadFull(); }
    else enterMe(r, tab === 'clock' ? 'days' : tab);
    return true;
  }
  lfForget();
  try { C.lineProfile = await liff.getProfile(); } catch (e) { C.lineProfile = { displayName: r.lineName }; }
  C.step = 'reg'; C.regTab = tab; render(); return true;
}
/** ลงทะเบียนสำเร็จ/ลงเวลาแล้ว: จำข้อมูลล่าสุดไว้เปิดครั้งหน้า */
function lfRemember() {
  try { if (C.liff && S.token && C.my && window.liff) { const uid = (liff.getDecodedIDToken() || {}).sub; const c = lfGet() || {}; if (uid) lfSave({ token: S.token, my: C.my }, uid, c.liffId || window.AMZ_LIFF || ''); } } catch (e) { /* */ }
}
document.addEventListener('visibilitychange', () => { if (document.hidden) lfRemember(); });
window.addEventListener('pagehide', lfRemember);
