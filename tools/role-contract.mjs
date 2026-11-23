#!/usr/bin/env node
/* สร้าง "สัญญาสิทธิ์" (role contract) จากซอร์สเซิร์ฟเวอร์จริง เพื่อให้ตัวตรวจเทียบกับฝั่งหน้าเว็บได้
 *
 * ทำไมต้องมีไฟล์กลาง: โค้ดเซิร์ฟเวอร์อยู่ใน server/gas.enc ซึ่งเข้ารหัสไว้ (ห้ามแก้ด้วยมือ ตาม AGENTS.md)
 * และต้นฉบับ .gs อยู่นอก repo → CI อ่านเองไม่ได้ จึงถอดค่าที่ "ต้องตรงกันสองฝั่ง" ออกมาเก็บเป็นไฟล์
 * ที่ commit ไว้ แล้วให้ tools/link-check.mjs เทียบฝั่งหน้าเว็บกับไฟล์นี้ทุก PR
 *
 * ใช้งาน:  node tools/role-contract.mjs --src /path/to/cms-server-src/gas
 * ค่าเริ่มต้นของ --src คือ ../cms-server-src/gas
 * แก้ค่าฝั่งเซิร์ฟเวอร์เมื่อไหร่ ต้องรันคำสั่งนี้ใหม่แล้ว commit data/role-contract.json ด้วย
 */
'use strict';
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

const argv = process.argv.slice(2);
const srcDir = (argv.includes('--src') ? argv[argv.indexOf('--src') + 1] : '') || join(process.cwd(), '..', 'cms-server-src', 'gas');
if (!existsSync(srcDir)) {
  console.error('ไม่พบซอร์สเซิร์ฟเวอร์ที่ ' + srcDir + '\nสั่งใหม่โดยระบุที่อยู่: node tools/role-contract.mjs --src <โฟลเดอร์ .gs>');
  process.exit(2);
}
const files = readdirSync(srcDir).filter(f => f.endsWith('.gs')).sort();
const ctx = { ROLES: {}, ROLE_PREFIX: {}, DEFAULT_PERMS: {}, APP_LOCK_ROLES: {} };
const NAMES = Object.keys(ctx);
const lit = s => Function('"use strict";return (' + s + ')')();

for (const f of files) {
  const src = readFileSync(join(srcDir, f), 'utf8');
  // var NAME={...}
  for (const m of src.matchAll(new RegExp('var (' + NAMES.join('|') + ')\\s*=\\s*(\\{[^{}]*\\})', 'g'))) ctx[m[1]] = lit(m[2]);
  // NAME.key = <ค่าคงที่>
  for (const m of src.matchAll(new RegExp('(' + NAMES.join('|') + ')\\.([A-Za-z_$][\\w$]*)\\s*=\\s*(\\[[^\\]]*\\]|"[^"]*"|\'[^\']*\'|\\d+|true|false)', 'g'))) ctx[m[1]][m[2]] = lit(m[3]);
  // DEFAULT_PERMS.key = (DEFAULT_PERMS.key||[]).concat([...])
  for (const m of src.matchAll(/(DEFAULT_PERMS)\.([A-Za-z_$][\w$]*)\s*=\s*\(\s*DEFAULT_PERMS\.\2\s*\|\|\s*\[\]\s*\)\.concat\((\[[^\]]*\])\)/g)) {
    ctx[m[1]][m[2]] = (ctx[m[1]][m[2]] || []).concat(lit(m[3]));
  }
}

const bundle = files.map(f => readFileSync(join(srcDir, f), 'utf8')).join('\n');
const out = {
  note: 'ค่าที่ต้องตรงกันระหว่างเซิร์ฟเวอร์ (.gs ใน server/gas.enc) กับหน้าเว็บ · สร้างด้วย tools/role-contract.mjs · แก้ฝั่งเซิร์ฟเวอร์แล้วต้องสร้างใหม่',
  generated_at: new Date().toISOString(),
  source: { files: files.length, sha256: createHash('sha256').update(bundle).digest('hex').slice(0, 16) },
  roles: ctx.ROLES,
  role_prefix: ctx.ROLE_PREFIX,
  default_perms: Object.fromEntries(Object.entries(ctx.DEFAULT_PERMS).map(([k, v]) => [k, [...v].sort()])),
  app_lock_roles_note: 'เซิร์ฟเวอร์คำนวณเองจาก ROLES ทั้งหมด (67_AppLockRoles.gs) หน้าเว็บจึงไม่ต้องมีรายชื่อ — ห้ามเพิ่มรายชื่อตายตัวฝั่งหน้าเว็บอีก'
};
writeFileSync(join(process.cwd(), 'data/role-contract.json'), JSON.stringify(out, null, 1) + '\n');
console.log('อ่าน ' + files.length + ' ไฟล์จาก ' + srcDir);
console.log('ROLES: ' + Object.keys(out.roles).join(', '));
console.log('DEFAULT_PERMS: ' + Object.entries(out.default_perms).map(([k, v]) => k + '(' + v.length + ')').join(' · '));
console.log('เขียน data/role-contract.json แล้ว');
