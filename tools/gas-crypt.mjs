#!/usr/bin/env node
/* ถอดรหัส / เข้ารหัส server/gas.enc (โค้ดฝั่งเซิร์ฟเวอร์ทั้งหมด) — ไม่มีกุญแจอยู่ในไฟล์นี้
 *   ถอดรหัส:   CODE_KEY=<base64> node tools/gas-crypt.mjs decrypt server/gas.enc /ที่ปลอดภัย/นอก-repo/all.gs
 *   เข้ารหัส:  CODE_KEY=<base64> node tools/gas-crypt.mjs encrypt /ที่ปลอดภัย/นอก-repo/all.gs server/gas.enc
 * CODE_KEY = ค่า k='CODE_KEY' ใน backoffice.kv (ns 'props') ห้ามพิมพ์ลง log / commit / แชต
 * รูปแบบไฟล์: base64( IV 12 ไบต์ + tag 16 ไบต์ + AES-256-GCM( gzip(ซอร์สทุกไฟล์ต่อกัน คั่นด้วย "// ===== ชื่อไฟล์ =====") ) )
 * ห้าม commit ซอร์สที่ถอดแล้วลง repo นี้ (Public) · เข้ารหัสแล้วต้องถอดกลับมาเทียบก่อนส่ง PR (คำสั่ง encrypt ทำให้เอง) */
import { readFileSync, writeFileSync } from 'node:fs';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { gunzipSync, gzipSync } from 'node:zlib';

export function encrypt(src, keyB64) {
  const key = Buffer.from(keyB64, 'base64'); if (key.length !== 32) throw new Error('CODE_KEY ต้องเป็น base64 ของ 32 ไบต์');
  const iv = randomBytes(12), c = createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([c.update(gzipSync(Buffer.from(src, 'utf8'), { level: 9 })), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), ct]).toString('base64');
}
export function decrypt(text, keyB64) {
  const key = Buffer.from(keyB64, 'base64'), b = Buffer.from(String(text).trim(), 'base64');
  const d = createDecipheriv('aes-256-gcm', key, b.subarray(0, 12)); d.setAuthTag(b.subarray(12, 28));
  return gunzipSync(Buffer.concat([d.update(b.subarray(28)), d.final()])).toString('utf8');
}
if (import.meta.url === `file://${process.argv[1]}`) {
  const [cmd, from, to] = process.argv.slice(2), key = process.env.CODE_KEY || '';
  if (!/^(en|de)crypt$/.test(cmd || '') || !from || !to || !key) { console.error('ใช้: CODE_KEY=… node tools/gas-crypt.mjs decrypt|encrypt <จาก> <ไป>'); process.exit(2); }
  if (cmd === 'decrypt') { const s = decrypt(readFileSync(from, 'utf8'), key); writeFileSync(to, s, { mode: 0o600 }); console.log('ถอดรหัสแล้ว', s.length, 'ตัวอักษร →', to); }
  else {
    const src = readFileSync(from, 'utf8'), out = encrypt(src, key);
    if (decrypt(out, key) !== src) throw new Error('ถอดกลับมาไม่ตรงซอร์ส — ไม่เขียนไฟล์');
    try { new Function(src); } catch (e) { throw new Error('ซอร์สมี syntax ผิด: ' + e.message); }
    writeFileSync(to, out); console.log('เข้ารหัสแล้ว ถอดกลับตรงซอร์ส · syntax ผ่าน →', to);
  }
}
