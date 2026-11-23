#!/usr/bin/env node
/* สร้าง data/mod-manifest.json = รายการเมนูของเว็บหลังร้าน (key / label / perm / desc / หน้าย่อย)
 * ทำไมต้องมี: แอป Owner ไม่ได้โหลดไฟล์ mod-*.js ของเว็บหลังร้าน จึงไม่รู้จักเมนูเหล่านั้น
 *             ใยแมงมุมคนในแอป Owner ต้องใช้รายการนี้เพื่อบอกว่า "ใครเข้าเมนูไหนได้บ้าง"
 * วิธีสร้าง: เปิด index.html จริงด้วย Chromium แล้วอ่าน MODS ที่ไฟล์ทุกตัวลงทะเบียนไว้
 *            (ไม่ใช่การเดาด้วย regex จึงตรงกับของจริงเสมอ) — ยังไม่ต้องเข้าสู่ระบบ
 * ใช้: node tools/mod-manifest.mjs          → เขียนไฟล์ใหม่
 *      node tools/mod-manifest.mjs --check  → เทียบเฉยๆ ไม่เขียน (ออก 1 ถ้าไม่ตรง)
 */
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const { chromium } = createRequire(import.meta.url)('playwright');
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(ROOT, 'data/mod-manifest.json');
const check = process.argv.includes('--check');

const br = await chromium.launch();
const pg = await br.newPage();
const errs = [];
pg.on('pageerror', e => errs.push(String(e.message || e)));
await pg.goto('file://' + resolve(ROOT, 'index.html'));
await pg.waitForFunction('typeof MODS !== "undefined" && MODS.length > 3', null, { timeout: 15000 });

const mods = await pg.evaluate(() => MODS.map(m => ({
  key: m.key,
  label: m.label || '',
  group: m.group || '',
  perm: Array.isArray(m.perm) ? m.perm.slice() : [],
  desc: m.desc || '',
  subs: (m.subs || []).map(s => ({ key: s.key || '', label: s.label || '', perm: Array.isArray(s.perm) ? s.perm.slice() : [] }))
})));
const nav = await pg.evaluate(() => (typeof GROUPS === 'undefined' ? [] : GROUPS.map(g => [g[0], g[1].slice()])));
await br.close();

if (errs.length) { console.error('หน้าเว็บมี error ตอนโหลด:\n' + errs.map(e => ' - ' + e).join('\n')); process.exit(2); }
if (!mods.length) { console.error('ไม่พบเมนูเลย — index.html โหลดไม่ครบ'); process.exit(2); }

mods.sort((a, b) => a.key.localeCompare(b.key));
const out = JSON.stringify({
  note: 'เมนูของเว็บหลังร้าน (index.html) สำหรับให้แอป Owner ใช้ · สร้างด้วย tools/mod-manifest.mjs · แก้ไฟล์ mod-*.js แล้วต้องสร้างใหม่',
  generated_at: new Date().toISOString(),
  nav, mods
}, null, 1) + '\n';

let old = '';
try { old = readFileSync(OUT, 'utf8'); } catch (e) { /* ยังไม่มีไฟล์ */ }
const same = old.replace(/"generated_at":[^,]*,/, '') === out.replace(/"generated_at":[^,]*,/, '');

if (check) {
  if (same) { console.log('ตรงกัน · ' + mods.length + ' เมนู'); process.exit(0); }
  console.error('data/mod-manifest.json ไม่ตรงกับเมนูจริง — รัน: node tools/mod-manifest.mjs');
  process.exit(1);
}
if (same) { console.log('ไม่มีอะไรเปลี่ยน · ' + mods.length + ' เมนู'); process.exit(0); }
writeFileSync(OUT, out);
console.log('เขียน data/mod-manifest.json แล้ว · ' + mods.length + ' เมนู');
