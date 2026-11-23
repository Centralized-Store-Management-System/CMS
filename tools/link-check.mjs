#!/usr/bin/env node
/* ตัวตรวจเส้นใย (Link Check) — ตรวจว่า "ของที่ต้องตรงกัน ตรงกันจริงไหม" ก่อน merge
 *
 * ทำไมต้องมี: บั๊กที่เจอซ้ำๆ ในระบบนี้มีรูปแบบเดียวกันหมด — ของอยู่คนละที่ 2 จุด
 * แล้วไม่มีใครตรวจว่าตรงกัน (รายชื่อ Role ฝั่งเว็บ vs ฝั่งเซิร์ฟเวอร์, ไฟล์ js เปลี่ยน
 * แต่ไม่ bump ?v=, ปุ่มเรียก action ที่ไม่มีใครรับ, ซอร์ส Edge Function ใน repo
 * ไม่ตรงกับของที่ deploy จริง) การไล่แก้ทีละอาการคือแก้ที่ปลายเหตุ
 *
 * ใช้งาน:
 *   node tools/link-check.mjs            ตรวจ + เขียน data/link-graph.json
 *   node tools/link-check.mjs --check    ตรวจอย่างเดียว ไม่เขียนไฟล์ (ใช้ใน CI)
 *   LINK_BASE=origin/main node tools/link-check.mjs   กำหนดฐานเทียบของกฎ ?v=
 *
 * คืนค่า exit 1 เมื่อพบปัญหาระดับ error · ระดับ warn ไม่บล็อก
 * ผลลัพธ์ data/link-graph.json คือ "ใยแมงมุม" ที่หน้า Owner › ใยแมงมุม เอาไปวาดและกดดูได้
 */
'use strict';
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execSync } from 'node:child_process';
import { dirname, join, normalize, relative } from 'node:path';

const ROOT = process.cwd();
const WRITE = !process.argv.includes('--check');
const rd = p => readFileSync(join(ROOT, p), 'utf8');
const sha = s => createHash('sha256').update(s).digest('hex');
const esc = s => String(s == null ? '' : s);

/* ---------- เก็บผล ---------- */
const nodes = new Map();   // id -> node
const edges = [];
const issues = [];
const node = (id, o) => { if (!nodes.has(id)) nodes.set(id, { id, status: 'ok', issues: 0, ...o }); return nodes.get(id); };
const link = (from, to, kind, note) => { if (nodes.has(from) && nodes.has(to)) edges.push({ from, to, kind, note }); };
function issue(o) {
  issues.push(o);
  (o.at || []).forEach(id => { const n = nodes.get(id); if (n) { n.issues++; if (o.level === 'error' || n.status === 'ok') n.status = o.level === 'error' ? 'bad' : 'warn'; } });
}

/* ---------- หาไฟล์ ---------- */
function walk(dir, out = []) {
  if (!existsSync(join(ROOT, dir))) return out;
  for (const name of readdirSync(join(ROOT, dir))) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const p = join(dir, name);
    if (statSync(join(ROOT, p)).isDirectory()) walk(p, out); else out.push(p.split('\\').join('/'));
  }
  return out;
}
const allFiles = walk('.');
const htmlFiles = allFiles.filter(f => f.endsWith('.html') && !f.startsWith('supabase/') && !f.includes('/test'));
const jsFiles = allFiles.filter(f => f.endsWith('.js') && (f.startsWith('js/') || f.includes('/js/')) && !f.startsWith('supabase/'));
const fnDirs = existsSync(join(ROOT, 'supabase/functions'))
  ? readdirSync(join(ROOT, 'supabase/functions')).filter(d => statSync(join(ROOT, 'supabase/functions', d)).isDirectory()) : [];

/* ---------- ขั้นที่ 1: หน้าเว็บ → ไฟล์ js ---------- */
const SCRIPT_RE = /<script[^>]*\ssrc=["']([^"']+)["']/gi;
const loadedBy = new Map();   // js path -> [html]
const verOf = new Map();      // html|js -> ?v=
for (const h of htmlFiles) {
  const src = rd(h);
  node(h, { kind: 'page', label: h, layer: 'หน้าเว็บ / แอป' });
  for (const m of src.matchAll(SCRIPT_RE)) {
    const raw = m[1];
    if (/^https?:|^\/\//.test(raw)) { const id = 'ext:' + raw.split('?')[0]; node(id, { kind: 'external', label: raw.split('?')[0], layer: 'ภายนอก' }); link(h, id, 'script'); continue; }
    const file = normalize(join(dirname(h), raw.split('?')[0])).split('\\').join('/').replace(/^\.\//, '');
    const v = (raw.split('?v=')[1] || '').split('&')[0];
    verOf.set(h + '|' + file, v);
    (loadedBy.get(file) || loadedBy.set(file, []).get(file)).push(h);
    if (!existsSync(join(ROOT, file))) {
      node(file, { kind: 'script', label: file, layer: 'ไฟล์โปรแกรม', missing: true });
      issue({ key: `script-missing|${h}|${file}`, code: 'script-missing', level: 'error', at: [h, file], title: 'หน้าเว็บโหลดไฟล์ที่ไม่มีอยู่จริง', detail: `${h} สั่งโหลด ${file} แต่ไม่พบไฟล์นี้ใน repo`, fix: 'แก้ชื่อไฟล์ใน <script src> หรือเพิ่มไฟล์ที่หายไป', where: h });
    } else node(file, { kind: 'script', label: file, layer: 'ไฟล์โปรแกรม' });
    link(h, file, 'script', v ? 'v=' + v : '');
  }
}
for (const f of jsFiles) node(f, { kind: 'script', label: f, layer: 'ไฟล์โปรแกรม' });

/* ไฟล์ js ที่ไม่มีหน้าไหนโหลด (อาจถูกโหลดแบบไดนามิกจากไฟล์อื่น จึงเช็คการอ้างชื่อในโค้ดด้วย) */
const allJsText = jsFiles.map(f => rd(f)).join('\n');
for (const f of jsFiles) {
  if (loadedBy.has(f)) continue;
  const base = f.split('/').pop();
  if (allJsText.includes(base)) continue;
  issue({ key: `script-orphan|${f}`, code: 'script-orphan', level: 'warn', at: [f], title: 'ไฟล์ที่ไม่มีใครโหลด', detail: `${f} ไม่ถูกโหลดจากหน้า html ใดเลย และไม่มีไฟล์อื่นอ้างถึง`, fix: 'เพิ่ม <script src> ในหน้าที่ต้องใช้ หรือลบไฟล์ทิ้งถ้าเลิกใช้แล้ว', where: f });
}

/* ---------- ขั้นที่ 2: ปุ่ม (data-a) ต้องมีคนรับ ----------
 * ระบบนี้มีตัวรับปุ่มหลายแบบ: ACT ของหลังร้าน · acts ของโมดูล · ตารางคำสั่งของ clock.js
 * · โมดูล Finance เทียบ dataset.a เอง · liff-view ใช้ selector [data-a="…"]
 * กฎจึงถามแค่คำถามเดียวที่ตอบได้แน่นอน: ชื่อนี้ปรากฏที่อื่นนอกจากบนปุ่มหรือเปล่า
 * ถ้าไม่ปรากฏเลย = ไม่มีใครรับแน่นอน (ปุ่มตาย) ซึ่งจับได้โดยไม่ตีความผิด */
const usedAt = new Map();
const bodyOf = new Map();   // ไฟล์ -> เนื้อโค้ดที่ตัด data-a="…" ออกแล้ว
function blockKeys(text, startIdx) {           // อ่านคีย์ชั้นบนสุดของบล็อก { ... }
  let i = text.indexOf('{', startIdx); if (i < 0) return [];
  let depth = 0, end = i;
  for (; end < text.length; end++) {
    const c = text[end];
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (!depth) break; }
  }
  const body = text.slice(i + 1, end), keys = [];
  let d = 0;
  for (let j = 0; j < body.length; j++) {
    const c = body[j];
    if ('{[('.includes(c)) d++;
    else if ('}])'.includes(c)) d--;
    else if (d === 0 && c === ':') {
      const before = body.slice(Math.max(0, j - 60), j);
      const m = before.match(/([A-Za-z_$][\w$]*)\s*$/);
      if (m) keys.push(m[1]);
    }
  }
  return keys;
}
for (const f of [...jsFiles, ...htmlFiles]) {
  const src = rd(f);
  bodyOf.set(f, src.replace(/data-a=["'][^"']*["']/g, ' '));
  for (const m of src.matchAll(/data-a=["']([A-Za-z_$][\w$]*)(?::[^"']*)?["']/g)) {
    (usedAt.get(m[1]) || usedAt.set(m[1], []).get(m[1])).push(f);
  }
}
const everywhere = [...bodyOf.values()].join('\n');
for (const [name, files] of usedAt) {
  if (new RegExp('[^\\w$]' + name + '[^\\w$]').test(everywhere)) continue;
  issue({ key: 'action-missing|' + name, code: 'action-missing', level: 'error', at: [...new Set(files)], title: 'ปุ่มที่กดแล้วไม่มีอะไรเกิดขึ้น', detail: `มีปุ่ม data-a="${name}" แต่ชื่อนี้ไม่ปรากฏที่อื่นในโปรแกรมเลย จึงไม่มีตัวรับ`, fix: `ประกาศ ACT.${name} หรือใส่ใน acts ของโมดูล · ถ้าเพิ่ม action หลัง defMod ต้อง Object.assign(ACT, {…}) ด้วย`, where: [...new Set(files)][0] });
}

/* ---------- ขั้นที่ 3: ชื่อซ้ำข้ามไฟล์ในหน้าเดียวกัน (classic script ใช้ขอบเขตร่วมกัน) ---------- */
const DECL_RE = /^(?:const|let|var|function|class)\s+([A-Za-z_$][\w$]*)/gm;
const declIn = new Map();      // name -> Set(file)
for (const f of jsFiles) {
  for (const m of rd(f).matchAll(DECL_RE)) {
    (declIn.get(m[1]) || declIn.set(m[1], new Set()).get(m[1])).add(f);
  }
}
for (const h of htmlFiles) {
  const files = (edges.filter(e => e.from === h && e.kind === 'script').map(e => e.to)).filter(f => jsFiles.includes(f));
  const seen = new Map();
  for (const f of files) for (const [name, set] of declIn) {
    if (!set.has(f)) continue;
    if (seen.has(name)) {
      issue({ key: `dup-global|${h}|${name}`, code: 'dup-global', level: 'error', at: [h, f, seen.get(name)], title: 'ประกาศชื่อซ้ำในหน้าเดียวกัน', detail: `${h} โหลดทั้ง ${seen.get(name)} และ ${f} ซึ่งประกาศ "${name}" ทั้งคู่ · สคริปต์แบบนี้ใช้ขอบเขตร่วมกัน หน้าจะพังทั้งหน้า`, fix: `เปลี่ยนชื่อตัวแปร/ฟังก์ชันใน ${f} หรือรวมไว้ไฟล์เดียว`, where: f });
    } else seen.set(name, f);
  }
}

/* ---------- ขั้นที่ 4: Edge Function — ซอร์สใน repo ต้องตรงกับที่ deploy จริง ---------- */
const STATE_PATH = 'data/deploy-state.json';
const state = existsSync(join(ROOT, STATE_PATH)) ? JSON.parse(rd(STATE_PATH)) : { functions: {} };
for (const slug of fnDirs) {
  const entry = join('supabase/functions', slug, 'index.ts').split('\\').join('/');
  const id = 'fn:' + slug;
  node(id, { kind: 'fn', label: slug, layer: 'เซิร์ฟเวอร์ (Edge Function)', file: existsSync(join(ROOT, entry)) ? entry : null });
  if (!existsSync(join(ROOT, entry))) {
    issue({ key: `fn-no-source|${slug}`, code: 'fn-no-source', level: 'error', at: [id], title: 'ฟังก์ชันไม่มีซอร์สใน repo', detail: `supabase/functions/${slug} ไม่มี index.ts`, fix: 'นำซอร์สที่ deploy จริงกลับเข้า repo', where: 'supabase/functions/' + slug });
    continue;
  }
  const src = rd(entry), h = sha(src);
  node(entry, { kind: 'script', label: entry, layer: 'ไฟล์โปรแกรม' });
  link(id, entry, 'source');
  const rec = (state.functions || {})[slug];
  if (!rec) {
    issue({ key: `fn-unregistered|${slug}`, code: 'fn-unregistered', level: 'warn', at: [id], title: 'ยังไม่มีบันทึกการ deploy', detail: `ฟังก์ชัน ${slug} ไม่มีลายเซ็นใน ${STATE_PATH} จึงบอกไม่ได้ว่าของที่รันอยู่ตรงกับ repo หรือไม่`, fix: `deploy แล้วบันทึกลายเซ็นด้วย node tools/link-check.mjs --stamp ${slug}`, where: entry });
  } else if (rec.verified === false) {
    issue({ key: `fn-unverified|${slug}`, code: 'fn-unverified', level: 'warn', at: [id], title: 'ยังไม่เคยเทียบกับของที่ deploy จริง', detail: `ลายเซ็นของ ${slug} ใน ${STATE_PATH} บันทึกจากไฟล์ใน repo แต่ยังไม่เคยอ่านซอร์สที่รันอยู่จริงมาเทียบ`, fix: 'อ่านซอร์สที่ deploy อยู่จาก Supabase มาเทียบกับไฟล์ใน repo แล้วตั้ง verified: true', where: entry });
  } else if (rec.sha256 !== h) {
    issue({ key: `fn-drift|${slug}`, code: 'fn-drift', level: 'error', at: [id, entry], title: 'ซอร์สใน repo ไม่ตรงกับที่ deploy จริง', detail: `${entry} เปลี่ยนไปจากตอนที่บันทึกไว้ (deployed version ${rec.version ?? '-'} เมื่อ ${rec.deployed_at ?? '-'}) · ของที่รันอยู่จริงอาจเป็นคนละรุ่น`, fix: 'deploy ฟังก์ชันนี้ใหม่ แล้วอัปเดตลายเซ็นใน ' + STATE_PATH, where: entry });
  }
  for (const m of src.matchAll(/\b(public|finance|backoffice)\.([a-z_][a-z0-9_]*)/g)) {
    const t = 'tbl:' + m[1] + '.' + m[2];
    node(t, { kind: 'table', label: m[1] + '.' + m[2], layer: 'ฐานข้อมูล' });
    link(id, t, 'sql');
  }
}
/* ไฟล์หน้าเว็บเรียกฟังก์ชันตัวไหนบ้าง */
for (const f of jsFiles) {
  const src = rd(f);
  for (const slug of fnDirs) {
    if (!new RegExp("['\"/]" + slug + "['\"?]").test(src)) continue;
    link(f, 'fn:' + slug, 'call');
  }
}

/* ---------- ขั้นที่ 5: ที่อยู่ API ต้องมาจาก config ---------- */
const CONFIG_OK = new Set(['js/config.js', 'modules/finance/js/fin-config.js', 'tools/link-check.mjs']);
for (const f of [...jsFiles, ...htmlFiles]) {
  if (CONFIG_OK.has(f)) continue;
  const src = rd(f);
  const m = src.match(/https:\/\/[a-z0-9]{10,}\.supabase\.co/);
  if (!m) continue;
  const fallbackOnly = /AMZ_API|FIN_API/.test(src.slice(Math.max(0, src.indexOf(m[0]) - 400), src.indexOf(m[0])));
  issue({ key: `api-hardcoded|${f}`, code: 'api-hardcoded', level: fallbackOnly ? 'warn' : 'error', at: [f], title: 'ฝังที่อยู่เซิร์ฟเวอร์ไว้ในไฟล์', detail: `${f} มี ${m[0]} เขียนไว้ตรงๆ${fallbackOnly ? ' (เป็นค่าสำรองหลังอ่านจาก config)' : ''}`, fix: 'อ่านจาก AMZ_API ใน js/config.js ตามกติกาใน AGENTS.md', where: f });
}

/* ---------- ขั้นที่ 6: ไฟล์ js เปลี่ยนแล้วต้อง bump ?v= ---------- */
let gitBase = process.env.LINK_BASE || '';
let versionRuleRan = false;
try {
  if (!gitBase) {
    const remote = execSync('git rev-parse --verify --quiet origin/main', { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    gitBase = remote ? 'origin/main' : '';
  }
  if (gitBase) {
    const merge = execSync(`git merge-base ${gitBase} HEAD`, { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    const changed = execSync(`git diff --name-only ${merge} -- '*.js'`, { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim().split('\n').filter(Boolean);
    versionRuleRan = true;
    for (const f of changed) {
      for (const h of (loadedBy.get(f) || [])) {
        let before = '';
        try { before = execSync(`git show ${merge}:${h}`, { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] }).toString(); } catch (_) { continue; }
        const re = new RegExp('src=["\']' + f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/^js\//, '(?:\\./)?js/') + '\\?v=([^"\'&]+)');
        const old = (before.match(re) || [])[1];
        const now = verOf.get(h + '|' + f);
        if (old && now && old === now) {
          issue({ key: `version-stale|${h}|${f}`, code: 'version-stale', level: 'error', at: [h, f], title: 'แก้ไฟล์แล้วไม่ได้เปลี่ยนเลขเวอร์ชัน', detail: `${f} เปลี่ยนไปจาก ${gitBase} แต่ ${h} ยังโหลด ?v=${now} เท่าเดิม · เครื่องผู้ใช้จะยังใช้ไฟล์เก่า`, fix: `เพิ่มเลข ?v= ของ ${f} ใน ${h}`, where: h });
        }
      }
    }
  }
} catch (_) { /* ไม่มี git หรือไม่มีฐานเทียบ: ข้ามกฎนี้ */ }

/* ---------- หนี้เก่า (baseline) ----------
 * ระบบนี้มีของค้างมาก่อนมีตัวตรวจ ถ้าให้ CI แดงตั้งแต่วันแรกเดี๋ยวก็โดนปิดทิ้ง
 * จึงบันทึกของเดิมไว้ใน data/link-baseline.json แล้ว **บล็อกเฉพาะปัญหาที่เกิดใหม่**
 * ยกเว้น 2 กฎที่ห้ามเข้า baseline เพราะเป็นหัวใจ: ซอร์สไม่ตรงกับที่ deploy และลืม bump ?v=
 */
const BASE_PATH = 'data/link-baseline.json';
const NEVER_BASELINE = new Set(['fn-drift', 'version-stale']);
const baseline = new Set(existsSync(join(ROOT, BASE_PATH)) ? (JSON.parse(rd(BASE_PATH)).keys || []) : []);
if (process.argv.includes('--baseline')) {
  const keys = issues.filter(i => !NEVER_BASELINE.has(i.code)).map(i => i.key).sort();
  writeFileSync(join(ROOT, BASE_PATH), JSON.stringify({ note: 'ของค้างที่มีอยู่ก่อนเริ่มใช้ตัวตรวจ · ทยอยแก้แล้วลบออกทีละบรรทัด · ปัญหาใหม่จะไม่เข้าที่นี่เอง', updated_at: new Date().toISOString().slice(0, 10), keys }, null, 1) + '\n');
  console.log('บันทึกหนี้เก่า ' + keys.length + ' รายการลง ' + BASE_PATH);
}
issues.forEach(i => { i.baselined = !NEVER_BASELINE.has(i.code) && baseline.has(i.key); });

/* ---------- สรุป ---------- */
const order = { error: 0, warn: 1, info: 2 };
issues.sort((a, b) => (a.baselined ? 1 : 0) - (b.baselined ? 1 : 0) || order[a.level] - order[b.level] || a.code.localeCompare(b.code));
const fresh = issues.filter(i => !i.baselined);
const errors = fresh.filter(i => i.level === 'error').length;
const warns = fresh.filter(i => i.level === 'warn').length;
const debt = issues.length - fresh.length;
const graph = {
  generated_at: new Date().toISOString(),
  rules: [
    { code: 'script-missing', level: 'error', title: 'หน้าเว็บโหลดไฟล์ที่ไม่มีอยู่จริง' },
    { code: 'script-orphan', level: 'warn', title: 'ไฟล์ที่ไม่มีใครโหลด' },
    { code: 'action-missing', level: 'error', title: 'ปุ่มที่กดแล้วไม่มีอะไรเกิดขึ้น' },
    { code: 'dup-global', level: 'error', title: 'ประกาศชื่อซ้ำในหน้าเดียวกัน' },
    { code: 'fn-drift', level: 'error', title: 'ซอร์สใน repo ไม่ตรงกับที่ deploy จริง' },
    { code: 'fn-unregistered', level: 'warn', title: 'ยังไม่มีบันทึกการ deploy' },
    { code: 'fn-no-source', level: 'error', title: 'ฟังก์ชันไม่มีซอร์สใน repo' },
    { code: 'api-hardcoded', level: 'error', title: 'ฝังที่อยู่เซิร์ฟเวอร์ไว้ในไฟล์' },
    { code: 'version-stale', level: 'error', title: 'แก้ไฟล์แล้วไม่ได้เปลี่ยนเลขเวอร์ชัน' }
  ],
  summary: {
    pages: [...nodes.values()].filter(n => n.kind === 'page').length,
    scripts: [...nodes.values()].filter(n => n.kind === 'script').length,
    functions: [...nodes.values()].filter(n => n.kind === 'fn').length,
    tables: [...nodes.values()].filter(n => n.kind === 'table').length,
    edges: edges.length, errors, warns, debt,
    version_rule: versionRuleRan ? 'ตรวจแล้วเทียบกับ ' + gitBase : 'ข้าม (ไม่มีฐานเทียบใน git)'
  },
  nodes: [...nodes.values()].sort((a, b) => a.kind.localeCompare(b.kind) || a.label.localeCompare(b.label)),
  edges,
  issues
};

const GRAPH_PATH = 'data/link-graph.json';
let stale = false;
if (WRITE) {
  if (!existsSync(join(ROOT, 'data'))) mkdirSync(join(ROOT, 'data'));
  writeFileSync(join(ROOT, GRAPH_PATH), JSON.stringify(graph, null, 1) + '\n');
} else {
  /* โหมด --check (ใช้ใน CI): ผลตรวจที่ commit ไว้ต้องเป็นรุ่นเดียวกับที่เพิ่งคำนวณ
   * ไม่งั้นหน้า Owner จะโชว์ภาพเก่า · เทียบโดยไม่นับเวลาที่ตรวจ */
  const same = o => JSON.stringify({ ...o, generated_at: '' });
  if (!existsSync(join(ROOT, GRAPH_PATH))) stale = true;
  else { try { stale = same(JSON.parse(rd(GRAPH_PATH))) !== same(graph); } catch (_) { stale = true; } }
  if (stale) console.log('✖ [graph-stale] ผลตรวจใน repo ไม่ใช่รุ่นล่าสุด — รัน `node tools/link-check.mjs` แล้ว commit ' + GRAPH_PATH + ' ด้วย');
}
const S = graph.summary;
console.log(`ใยแมงมุม: ${S.pages} หน้า · ${S.scripts} ไฟล์ · ${S.functions} ฟังก์ชัน · ${S.tables} ตาราง · ${S.edges} เส้นเชื่อม`);
console.log(`กฎ ?v= : ${S.version_rule}`);
for (const i of fresh) console.log(`${i.level === 'error' ? '✖' : '⚠'} [${i.code}] ${i.title} — ${i.detail}`);
if (debt) console.log(`(หนี้เก่าใน baseline อีก ${debt} รายการ — ไม่บล็อก ทยอยแก้ได้)`);
console.log(`\nรวมของใหม่: ผิดพลาด ${errors} · เตือน ${warns}`);
process.exit(errors || stale ? 1 : 0);
