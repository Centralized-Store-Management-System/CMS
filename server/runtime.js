// ตัวรันโค้ด Google Apps Script (gas/*.gs) บน Supabase — ใช้ได้ทั้ง Node (เทส) และ Deno (Edge Function)
// หลักการ: โค้ด .gs ชุดเดิมทุกบรรทัด แทนบริการของ Google ด้วยข้อมูลในหน่วยความจำที่โหลดจาก Postgres
//  - โหลดเฉพาะแผ่นงานที่คำขอนั้นใช้จริง: เจอแผ่นที่ยังไม่โหลด → โหลดแล้วรันคำขอใหม่ตั้งแต่ต้น (ยังไม่มีอะไรถูกบันทึก จึงรันซ้ำได้ปลอดภัย)
//  - จำแผ่นงานไว้ในเครื่อง (isolate) เทียบเลขเวอร์ชันทุกคำขอ ไม่โหลดซ้ำถ้าไม่เปลี่ยน
//  - จบคำขอ: เขียนกลับเฉพาะแถวที่เปลี่ยนในธุรกรรมเดียว ถ้ามีคำขออื่นแก้แผ่นเดียวกันตัดหน้า → รันใหม่ด้วยข้อมูลล่าสุด
//  - ส่ง LINE / อีเมล / อัปโหลดไฟล์ ทำหลังบันทึกสำเร็จเท่านั้น (รันซ้ำไม่ส่งซ้ำ)
import { Buffer } from 'node:buffer';
import crypto from 'node:crypto';
import zlib from 'node:zlib';

const SERVICES = ['SpreadsheetApp', 'PropertiesService', 'CacheService', 'LockService', 'Utilities', 'DriveApp', 'MailApp', 'UrlFetchApp', 'ScriptApp', 'ContentService', 'HtmlService', 'Logger', 'Session', 'Date', 'SUPA', 'Math'];
const BIG_CACHE = 8 * 1024;          // ค่าแคชใหญ่กว่านี้เก็บในเครื่องอย่างเดียว (เป็นแคชข้อมูล หายได้)
const MAX_RUNS = 60;

// สุ่มแบบกำหนดเมล็ด: รันซ้ำได้ค่าเดิมทุกครั้ง (ข้อความ LINE ที่ส่งไปแล้วตรงกับข้อมูลที่บันทึก)
function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const hexOf = (rand, n) => { let s = ''; for (let i = 0; i < n; i++) s += Math.floor(rand() * 16).toString(16); return s; };
const uuidOf = rand => { const h = hexOf(rand, 32); return h.slice(0, 8) + '-' + h.slice(8, 12) + '-4' + h.slice(13, 16) + '-' + ((parseInt(h[16], 16) & 3) | 8).toString(16) + h.slice(17, 20) + '-' + h.slice(20, 32); };

class Need extends Error { constructor(kind, key, arg) { super('need ' + kind + ' ' + key); this.need = { kind, key, arg }; } }

const toSigned = buf => Array.from(buf, b => (b > 127 ? b - 256 : b));
const fromSigned = arr => Buffer.from(Array.from(arr, b => (b < 0 ? b + 256 : b)));
const pad = n => String(n).padStart(2, '0');
const cellStr = v => (v === null || v === undefined ? '' : typeof v === 'string' ? v : v instanceof Date ? v.toISOString() : String(v));

function tzOffset(tz, d) {
  if (!tz || /^(GMT|UTC|Etc\/UTC)$/i.test(tz)) return 0;
  if (tz === 'Asia/Bangkok') return 7 * 3600000;
  const m = String(tz).match(/^(?:GMT|UTC)([+-])(\d{1,2})(?::?(\d{2}))?$/);
  if (m) return (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 3600000 + Number(m[3] || 0) * 60000);
  try {
    const s = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(d);
    const g = t => Number(s.find(x => x.type === t).value);
    return Date.UTC(g('year'), g('month') - 1, g('day'), g('hour'), g('minute'), g('second')) - Math.floor(d.getTime() / 1000) * 1000;
  } catch (e) { return 0; }
}
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function formatDate(d, tz, fmt) {
  const x = new Date(d.getTime() + tzOffset(tz, d));
  const map = { yyyy: x.getUTCFullYear(), yy: String(x.getUTCFullYear()).slice(2), MMM: MON[x.getUTCMonth()], MM: pad(x.getUTCMonth() + 1), dd: pad(x.getUTCDate()), EEE: DOW[x.getUTCDay()], HH: pad(x.getUTCHours()), mm: pad(x.getUTCMinutes()), ss: pad(x.getUTCSeconds()), SSS: String(x.getUTCMilliseconds()).padStart(3, '0'), u: x.getUTCDay() || 7, Z: (o => (o >= 0 ? '+' : '-') + pad(Math.floor(Math.abs(o) / 3600000)) + pad(Math.abs(o) % 3600000 / 60000))(tzOffset(tz, d)) };
  return String(fmt).replace(/'([^']*)'|yyyy|yy|MMM|MM|dd|EEE|HH|mm|ss|SSS|u|Z/g, (k, lit) => (lit !== undefined ? lit : map[k]));
}
function newBlob(data, type, name) {
  const buf = data === undefined || data === null ? Buffer.alloc(0) : typeof data === 'string' ? Buffer.from(data, 'utf8') : fromSigned(data);
  const b = { _buf: buf, type: type || 'application/octet-stream', name: name || '',
    getBytes: () => toSigned(buf), getDataAsString: () => buf.toString('utf8'), getContentType: () => b.type,
    setContentType(t) { b.type = t; return b; }, getName: () => b.name, setName(n) { b.name = n; return b; }, copyBlob: () => newBlob(toSigned(buf), b.type, b.name) };
  return b;
}

/** คอมไพล์โค้ด .gs ครั้งเดียวต่อเครื่อง · เรียก factory ทุกคำขอ = ตัวแปรโกลบอลเริ่มใหม่เหมือน Apps Script */
export function compileGas(src) {
  // eslint-disable-next-line no-new-func
  return new Function(...SERVICES, src + '\n;return { fn: function (n) { if (!/^[A-Za-z_$][\\w$]*$/.test(n)) return undefined; try { return eval(n); } catch (e) { return undefined; } }, set: function (n, v) { if (/^[A-Za-z_$][\\w$]*$/.test(n)) eval(n + " = v"); } };');
}

/**
 * store: { meta(), loadSheet(book, name), fileMeta(id), filesByName(folder, name), fileBytes(file), fetch(url, opts), commit(ch), afterCommit(fx) }
 * env:   { execUrl, publicFileUrl(id), now?() }
 */
export function createRuntime({ factory, store, env = {} }) {
  const sheetCache = new Map();   // 'book|name' → { ver, rows }
  const bigCache = new Map();     // k → { v, exp }
  const fetchMemo = new Map();    // key → { code, text, bytes, headers }
  const fileMemo = new Map();     // 'id:<id>' / 'name:<folder>/<name>' / 'bytes:<id>' → …
  let seq = 0;
  const now = () => (env.now ? env.now() : Date.now());

  function resolveSync(need) {
    const { kind, key, arg } = need;
    if (kind === 'sheet') sheetCache.set(key, store.loadSheet(arg[0], arg[1]));
    else if (kind === 'fetch') fetchMemo.set(key, store.fetch(arg.url, arg.opts));
    else if (kind === 'file') fileMemo.set(key, store.fileMeta(arg));
    else if (kind === 'byname') fileMemo.set(key, store.filesByName(arg[0], arg[1]));
    else if (kind === 'bytes') fileMemo.set(key, store.fileBytes(arg));
  }
  async function resolve(need, meta) {
    const { kind, key, arg } = need;
    if (kind === 'sheet') {
      // โหลดทุกแผ่นที่ยังไม่มี/เก่า ในคำสั่งเดียว (คำขอแรกของเครื่อง รันซ้ำแค่ 1 รอบ)
      if (store.loadSheets && meta) {
        const stale = meta.sheets.filter(x => { const c = sheetCache.get(x.book + '|' + x.name); return !c || c.ver < x.ver; }).map(x => [x.book, x.name]);
        if (!stale.some(x => x[0] + '|' + x[1] === key)) stale.push(arg);
        const got = await store.loadSheets(stale);
        for (const k of Object.keys(got)) sheetCache.set(k, got[k]);
        if (!got[key]) sheetCache.set(key, { ver: 0, rows: [] });
      } else { const [b, n] = arg; sheetCache.set(key, await store.loadSheet(b, n)); }
    }
    else if (kind === 'fetch') fetchMemo.set(key, await store.fetch(arg.url, arg.opts));
    else if (kind === 'file') fileMemo.set(key, await store.fileMeta(arg));
    else if (kind === 'byname') fileMemo.set(key, await store.filesByName(arg[0], arg[1]));
    else if (kind === 'bytes') fileMemo.set(key, await store.fileBytes(arg));
  }

  /** รัน fn(gas) หนึ่งครั้งบนข้อมูลชุดปัจจุบัน */
  function runOnce(meta, body, ctl) {
    const rand = rng(ctl.seed);
    let clock = ctl.t0;
    const tick = () => (clock += 1);   // นาฬิกาเดินทีละ 1 มิลลิวินาทีต่อการอ่าน (รันซ้ำได้เวลาเดิม และลูปที่จับเวลาไม่ค้าง)
    const BaseDate = env.Date || Date;
    const RunDate = env.Date ? env.Date : class extends Date { constructor(...a) { if (a.length === 0) super(tick()); else super(...a); } static now() { return tick(); } };
    const RunMath = Object.create(Math); RunMath.random = rand;
    let lineIdx = 0;
    void BaseDate;
    const st = { need: null, dirty: new Set(), books: new Map(), sheetsIdx: new Map(), props: { ...meta.props }, propsDirty: new Map(), cache: new Map(meta.cache.map(c => [c.k, { v: c.v, exp: c.exp }])), cacheDirty: new Map(),
      folders: new Map(meta.folders.map(f => [f.id, { ...f }])), newFolders: [], files: new Map(), fileOps: [], triggers: meta.triggers.map(t => ({ ...t })), trigDirty: false,
      out: { line: [], mail: [] }, logs: [] };
    // store.sync (เทสในเครื่อง): โหลดทันทีไม่ต้องรันซ้ำ · ของจริง: โยน Need แล้วรันใหม่
    const need = (kind, key, arg) => { if (store.sync) { resolveSync({ kind, key, arg }); return; } const e = new Need(kind, key, arg); if (!st.need) st.need = e.need; throw e; };
    const nid = p => p + ctl.t0.toString(36) + hexOf(rand, 24);

    // ---------- Spreadsheet ----------
    class Range {
      constructor(sh, r, c, nr, nc) { Object.assign(this, { sh, r, c, nr, nc }); }
      setValues(v) {
        if (v.length !== this.nr || v.some(row => row.length !== this.nc)) throw new Error('The number of rows or columns in the data does not match the range');
        this.sh._w(); v.forEach((row, i) => row.forEach((x, j) => this.sh._set(this.r + i, this.c + j, x))); return this;
      }
      setValue(x) { this.sh._w(); this.sh._set(this.r, this.c, x); return this; }
      getValue() { return this.sh._get(this.r, this.c); }
      getDisplayValues() { const out = []; for (let i = 0; i < this.nr; i++) { const row = []; for (let j = 0; j < this.nc; j++) row.push(this.sh._get(this.r + i, this.c + j)); out.push(row); } return out; }
      getValues() { return this.getDisplayValues(); }
      getDisplayValue() { return this.getValue(); }
      clearContent() { this.sh._w(); for (let i = 0; i < this.nr; i++) for (let j = 0; j < this.nc; j++) this.sh._set(this.r + i, this.c + j, ''); return this; }
      getNumRows() { return this.nr; } getNumColumns() { return this.nc; } getRow() { return this.r; } getColumn() { return this.c; } getSheet() { return this.sh; }
    }
    ['setNumberFormat', 'setNumberFormats', 'setFontWeight', 'setFontWeights', 'setBackground', 'setBackgrounds', 'setFontColor', 'setFontColors', 'setFontSize', 'setWrap', 'setNote', 'setHorizontalAlignment', 'setVerticalAlignment', 'setBorder', 'setDataValidation', 'clearFormat', 'clearDataValidations', 'protect', 'setFontFamily'].forEach(m => { Range.prototype[m] = function () { return this; }; });

    class Sheet {
      constructor(book, name, rec) { this.book = book; this.name = name; this._rec = rec; this._rows = null; }
      _load() {
        if (this._rows) return this._rows;
        const key = this.book.id + '|' + this.name;
        if (this._rec.fresh) { this._rows = []; this._orig = []; return this._rows; }
        let c = sheetCache.get(key);
        if (!c || c.ver < this._rec.ver) { need('sheet', key, [this.book.id, this.name]); c = sheetCache.get(key); }
        this._rec.ver = c.ver;
        this._orig = c.rows; this._rows = c.rows.map(r => r.slice()); return this._rows;
      }
      _w() { this._load(); st.dirty.add(this); }
      _set(r, c, v) { const rows = this._rows; while (rows.length < r) rows.push([]); const row = rows[r - 1]; while (row.length < c) row.push(''); row[c - 1] = cellStr(v); }
      _get(r, c) { const row = this._load()[r - 1]; return row && row[c - 1] !== undefined ? row[c - 1] : ''; }
      _lastRow() { const rows = this._load(); for (let i = rows.length; i > 0; i--) if (rows[i - 1].some(x => x !== '' && x !== undefined)) return i; return 0; }
      getName() { return this.name; }
      setName(n) { st.dirty.add(this); this._rename = this._rename || this.name; this.name = n; return this; }
      getParent() { return this.book; }
      getLastRow() { return this._lastRow(); }
      getLastColumn() { let m = 0; this._load().forEach(r => { for (let j = r.length; j > m; j--) if (r[j - 1] !== '' && r[j - 1] !== undefined) { m = j; break; } }); return m; }
      getMaxRows() { return Math.max(1000, this._load().length); }
      getMaxColumns() { return Math.max(26, this._load().reduce((m, r) => Math.max(m, r.length), 0)); }
      getRange(r, c, nr = 1, nc = 1) {
        if (typeof r === 'string') { const m = r.match(/^([A-Z]+)(\d+)(?::([A-Z]+)(\d+))?$/); if (!m) throw new Error('Range not found'); const col = s => s.split('').reduce((a, ch) => a * 26 + ch.charCodeAt(0) - 64, 0); const r1 = +m[2], c1 = col(m[1]); return new Range(this, r1, c1, m[4] ? +m[4] - r1 + 1 : 1, m[3] ? col(m[3]) - c1 + 1 : 1); }
        if (r < 1 || c < 1 || nr < 1 || nc < 1) throw new Error('The coordinates of the range are outside the dimensions of the sheet.');
        return new Range(this, r, c, nr, nc);
      }
      getDataRange() { const rows = this._load(); return new Range(this, 1, 1, Math.max(1, this._lastRow()), Math.max(1, rows.reduce((m, r) => Math.max(m, r.length), 0))); }
      deleteRow(r) { this._w(); this._rows.splice(r - 1, 1); return this; }
      deleteRows(r, n) { this._w(); this._rows.splice(r - 1, n); return this; }
      insertRowsAfter() { return this; } insertRowAfter() { return this; } insertRowsBefore(r, n) { this._w(); this._rows.splice(r - 1, 0, ...Array.from({ length: n }, () => [])); return this; }
      insertColumnsAfter() { return this; } insertColumnAfter() { return this; }
      appendRow(a) { this._w(); const r = this._lastRow() + 1; a.forEach((v, j) => this._set(r, j + 1, v)); return this; }
      clear() { this._w(); this._rows.length = 0; return this; }
      clearContents() { return this.clear(); }
      setFrozenRows() { return this; } setFrozenColumns() { return this; } setTabColor() { return this; } setColumnWidth() { return this; } setColumnWidths() { return this; } setRowHeight() { return this; }
      hideSheet() { return this; } showSheet() { return this; } autoResizeColumns() { return this; } activate() { return this; } protect() { return { setWarningOnly() { return this; }, setDescription() { return this; } }; }
      getSheetId() { return this._rec.ord; }
    }

    class Spreadsheet {
      constructor(id, name, fresh) { this.id = id; this.name = name; this.fresh = !!fresh; this._sheets = null; }
      _list() {
        if (this._sheets) return this._sheets;
        const recs = this.fresh ? [{ name: 'Sheet1', ver: 0, ord: 0, fresh: true }] : (meta.sheets.filter(s => s.book === this.id).sort((a, b) => a.ord - b.ord));
        this._sheets = recs.map(r => new Sheet(this, r.name, { ...r }));
        if (this.fresh) this._sheets.forEach(s => st.dirty.add(s));
        return this._sheets;
      }
      getId() { return this.id; } getName() { return this.name; } rename(n) { this.name = n; st.bookRename = st.bookRename || []; st.bookRename.push(this); }
      getUrl() { return 'https://docs.google.com/spreadsheets/d/' + this.id + '/edit'; }
      getSheets() { return this._list().slice(); }
      getSheetByName(n) { return this._list().find(s => s.name === n) || null; }
      insertSheet(n, idx) {
        if (this.getSheetByName(n)) throw new Error('A sheet with the name "' + n + '" already exists. Please enter another name.');
        const list = this._list();
        const ord = idx === undefined || !list[idx] ? list.reduce((m, s) => Math.max(m, s._rec.ord), 0) + 1 : list[idx]._rec.ord - 1;
        const s = new Sheet(this, n, { name: n, ver: 0, ord, fresh: true }); s._rows = []; s._orig = [];
        if (idx === undefined) this._sheets.push(s); else this._sheets.splice(idx, 0, s);
        st.dirty.add(s); return s;
      }
      deleteSheet(s) { this._list(); this._sheets = this._sheets.filter(x => x !== s); st.deleted = st.deleted || []; st.deleted.push(s); st.dirty.delete(s); }
      getSheetId() { return this.id; }
    }
    const openBook = id => {
      if (st.books.has(id)) return st.books.get(id);
      const rec = meta.books.find(b => b.id === id);
      if (!rec) throw new Error('Unexpected error while getting the method or property openById on object SpreadsheetApp.');
      const b = new Spreadsheet(rec.id, rec.name); st.books.set(id, b); return b;
    };

    // ---------- Drive ----------
    const fileObj = rec => {
      const f = {
        _rec: rec,
        getId: () => rec.id, getName: () => rec.name, getMimeType: () => rec.mime, getSize: () => rec.size || 0,
        getUrl: () => (rec.shared && env.publicFileUrl ? env.publicFileUrl(rec.id) : ''),
        setSharing() { if (!rec.shared) { rec.shared = true; st.fileOps.push({ op: 'share', rec }); } return f; },
        setTrashed(v) { rec.trashed = !!v; st.fileOps.push({ op: 'trash', rec }); return f; },
        isTrashed: () => !!rec.trashed,
        setDescription(d) { rec.description = d; return f; }, getDescription: () => rec.description || '',
        moveTo(folder) { rec.folder = folder.getId(); st.fileOps.push({ op: 'meta', rec }); return f; },
        makeCopy(name, folder) { const c = { id: nid('f'), folder: folder ? folder.getId() : rec.folder, name: name || rec.name, mime: rec.mime, size: rec.size, shared: false, trashed: false }; st.fileOps.push({ op: 'copy', rec: c, from: rec }); st.files.set(c.id, c); return fileObj(c); },
        getBlob() {
          if (rec._blob) return rec._blob;
          const k = 'bytes:' + rec.id;
          if (!fileMemo.has(k)) need('bytes', k, rec);
          const bytes = fileMemo.get(k); return newBlob(bytes ? toSigned(bytes) : [], rec.mime, rec.name);
        },
        getAs() { return f.getBlob(); }
      };
      return f;
    };
    const iter = list => { let i = 0; return { hasNext: () => i < list.length, next: () => list[i++] }; };
    const folderObj = rec => ({
      _rec: rec, getId: () => rec.id, getName: () => rec.name,
      createFolder(n) { const c = { id: nid('d'), name: n, parent: rec.id }; st.folders.set(c.id, c); st.newFolders.push(c); return folderObj(c); },
      createFile(a, b, c) {
        const blob = typeof a === 'string' ? newBlob(b || '', c || 'text/plain', a) : a;
        const r = { id: nid('f'), folder: rec.id, name: blob.name || blob.getName?.() || 'file', mime: blob.type || 'application/octet-stream', size: (blob._buf || Buffer.alloc(0)).length, shared: false, trashed: false, _blob: blob };
        st.files.set(r.id, r); st.fileOps.push({ op: 'create', rec: r, bytes: blob._buf || Buffer.alloc(0) });
        return fileObj(r);
      },
      getFilesByName(n) {
        const fresh = [...st.files.values()].filter(f => f.folder === rec.id && f.name === n && !f.trashed);
        const k = 'name:' + rec.id + '/' + n;
        if (!fileMemo.has(k)) need('byname', k, [rec.id, n]);
        const stored = (fileMemo.get(k) || []).filter(f => !fresh.some(x => x.id === f.id)).map(f => (st.files.get(f.id) || (st.files.set(f.id, { ...f }), st.files.get(f.id))));
        return iter(fresh.concat(stored).filter(f => !f.trashed).map(fileObj));
      },
      getFolders: () => iter([...st.folders.values()].filter(f => f.parent === rec.id).map(folderObj)),
      setSharing() { return this; }, setTrashed() { return this; }, addFile() { return this; }
    });
    // ไฟล์ข้อมูล (book) ถูกขอเป็นไฟล์ Drive เช่น สำรองข้อมูล/ย้ายโฟลเดอร์ → สำเนา = ไฟล์ JSON ทุกแผ่นงานใน Storage
    const bookFile = id => {
      const b = openBook(id);
      return {
        getId: () => id, getName: () => b.getName(), moveTo() { return this; }, setTrashed() { return this; }, setSharing() { return this; }, setDescription() { return this; },
        makeCopy(name, folder) {
          const data = { book: id, name: b.getName(), sheets: b.getSheets().map(sh => ({ name: sh.getName(), rows: sh._load() })) };
          const buf = Buffer.from(JSON.stringify(data), 'utf8');
          const r = { id: nid('f'), folder: folder ? folder.getId() : null, name: (name || b.getName()) + '.json', mime: 'application/json', size: buf.length, shared: false, trashed: false };
          st.files.set(r.id, r); st.fileOps.push({ op: 'create', rec: r, bytes: buf }); return fileObj(r);
        }
      };
    };
    const getFile = id => {
      if (meta.books.some(b => b.id === id) || st.books.has(id)) return bookFile(id);
      if (st.files.has(id)) return fileObj(st.files.get(id));
      const k = 'id:' + id;
      if (!fileMemo.has(k)) need('file', k, id);
      const rec = fileMemo.get(k);
      if (!rec) throw new Error('No item with the given ID could be found. Access is denied');
      const copy = { ...rec }; st.files.set(id, copy); return fileObj(copy);
    };

    // ---------- Cache / Props ----------
    const cacheGet = k => {
      const t = now();
      if (st.cacheDirty.has(k)) { const e = st.cacheDirty.get(k); return e && (!e.exp || e.exp > t) ? e.v : null; }
      const e = st.cache.get(k) || bigCache.get(k);
      if (!e) return null;
      if (e.exp && e.exp <= t) return null;
      return e.v;
    };
    const cachePut = (k, v, ttl) => {
      v = String(v);
      if (Buffer.byteLength(v, 'utf8') > 100 * 1024) throw new Error('Argument too large: value');
      st.cacheDirty.set(k, { v, exp: now() + Math.min(Number(ttl) || 600, 21600) * 1000 });
    };
    const Cache = {
      get: k => cacheGet(String(k)),
      getAll: ks => { const o = {}; ks.forEach(k => { const v = cacheGet(String(k)); if (v !== null) o[k] = v; }); return o; },
      put: (k, v, ttl) => cachePut(String(k), v, ttl),
      putAll: (o, ttl) => Object.keys(o).forEach(k => cachePut(k, o[k], ttl)),
      remove: k => { st.cacheDirty.set(String(k), null); },
      removeAll: ks => ks.forEach(k => st.cacheDirty.set(String(k), null))
    };
    const Props = {
      getProperty: k => (k in st.props ? st.props[k] : null),
      getProperties: () => ({ ...st.props }),
      getKeys: () => Object.keys(st.props),
      setProperty: (k, v) => { st.props[k] = String(v); st.propsDirty.set(k, String(v)); return Props; },
      setProperties: (o, del) => { if (del) Object.keys(st.props).forEach(k => { if (!(k in o)) { delete st.props[k]; st.propsDirty.set(k, null); } }); Object.keys(o).forEach(k => Props.setProperty(k, o[k])); return Props; },
      deleteProperty: k => { delete st.props[k]; st.propsDirty.set(k, null); return Props; },
      deleteAllProperties: () => { Object.keys(st.props).forEach(k => st.propsDirty.set(k, null)); st.props = {}; return Props; }
    };

    // ---------- UrlFetch ----------
    const resp = r => ({ getResponseCode: () => r.code, getContentText: () => r.text || '', getBlob: () => newBlob(r.bytes ? toSigned(r.bytes) : [], (r.headers && r.headers['content-type']) || 'application/octet-stream'), getContent: () => toSigned(r.bytes || []), getHeaders: () => r.headers || {}, getAllHeaders: () => r.headers || {} });
    const UrlFetch = {
      fetch(url, o = {}) {
        const method = String(o.method || 'get').toLowerCase();
        let payload = o.payload;
        if (payload && typeof payload === 'object' && !(payload._buf)) { payload = new URLSearchParams(Object.entries(payload).map(([k, v]) => [k, String(v)])).toString(); o = { ...o, contentType: o.contentType || 'application/x-www-form-urlencoded' }; }
        const opts = { method, headers: { ...(o.headers || {}) }, contentType: o.contentType, payload: payload === undefined ? undefined : String(payload) };
        // ส่งข้อความ LINE = ผลข้างเคียง: รอบแรกบันทึกไว้ → ส่งจริงก่อนบันทึกข้อมูล → รันซ้ำโดยได้ผลจริงตามลำดับ (ไม่ส่งซ้ำ)
        if (method === 'post' && /^https:\/\/api\.line\.me\/v2\/bot\/(message\/(push|reply|multicast|broadcast|narrowcast)|richmenu|user\/.+\/richmenu)/.test(url)) {
          const i = lineIdx++, m = ctl.lineMemo[i];
          if (m) { if (m.code >= 400 && !o.muteHttpExceptions) throw new Error('Request failed for ' + url + ' returned code ' + m.code); return resp(m); }
          st.out.line.push({ i, url, opts }); return resp({ code: 200, text: '{}' });
        }
        const key = method + ' ' + url + ' ' + (opts.payload || '') + ' ' + (opts.headers.Authorization || '');
        if (!fetchMemo.has(key)) need('fetch', key, { url, opts });
        const r = fetchMemo.get(key);
        if (r.code >= 400 && !o.muteHttpExceptions) throw new Error('Request failed for ' + url + ' returned code ' + r.code + '. Truncated server response: ' + String(r.text || '').slice(0, 200));
        return resp(r);
      },
      fetchAll(reqs) { return reqs.map(q => UrlFetch.fetch(q.url, q)); }
    };

    // ---------- ScriptApp ----------
    const trigObj = t => ({ getHandlerFunction: () => t.fn, getUniqueId: () => t.id, getTriggerSourceId: () => (t.spec && t.spec.source) || '', getEventType: () => (t.spec && t.spec.kind) || 'CLOCK', _t: t });
    const Script = {
      getService: () => ({ getUrl: () => env.execUrl || '' }),
      getProjectTriggers: () => st.triggers.map(trigObj),
      deleteTrigger: t => { st.triggers = st.triggers.filter(x => x.id !== t.getUniqueId()); st.trigDirty = true; },
      newTrigger: fn => {
        const spec = {};
        const b = {
          timeBased: () => { spec.kind = 'CLOCK'; return b; }, atHour: h => { spec.atHour = h; return b; }, nearMinute: m => { spec.minute = m; return b; },
          everyDays: n => { spec.everyDays = n; return b; }, everyHours: n => { spec.everyHours = n; return b; }, everyMinutes: n => { spec.everyMinutes = n; return b; },
          everyWeeks: n => { spec.everyWeeks = n; return b; }, onWeekDay: d => { spec.weekDay = String(d); return b; }, onMonthDay: d => { spec.monthDay = d; return b; },
          inTimezone: z => { spec.tz = z; return b; }, at: d => { spec.at = new Date(d).toISOString(); return b; }, after: ms => { spec.at = new Date(now() + ms).toISOString(); return b; },
          forSpreadsheet: id => { spec.source = id; return b; }, onEdit: () => { spec.kind = 'ON_EDIT'; return b; }, onChange: () => { spec.kind = 'ON_CHANGE'; return b; }, onFormSubmit: () => { spec.kind = 'ON_FORM'; return b; },
          create: () => { const t = { id: nid('t'), fn, spec }; st.triggers.push(t); st.trigDirty = true; return trigObj(t); }
        };
        return b;
      },
      getScriptId: () => 'supabase', getOAuthToken: () => '', getIdentityToken: () => '',
      EventType: { CLOCK: 'CLOCK', ON_EDIT: 'ON_EDIT' }, WeekDay: { MONDAY: 'MONDAY', TUESDAY: 'TUESDAY', WEDNESDAY: 'WEDNESDAY', THURSDAY: 'THURSDAY', FRIDAY: 'FRIDAY', SATURDAY: 'SATURDAY', SUNDAY: 'SUNDAY' }
    };

    const services = {
      SpreadsheetApp: {
        openById: openBook,
        create: n => { const id = nid('b'); const b = new Spreadsheet(id, n, true); st.books.set(id, b); st.newBooks = st.newBooks || []; st.newBooks.push(b); b._list(); return b; },
        flush: () => {}, getActive: () => null, getActiveSpreadsheet: () => null
      },
      PropertiesService: { getScriptProperties: () => Props, getUserProperties: () => Props, getDocumentProperties: () => Props },
      CacheService: { getScriptCache: () => Cache, getUserCache: () => Cache, getDocumentCache: () => Cache },
      LockService: { getScriptLock: () => ({ waitLock() {}, tryLock: () => true, releaseLock() {}, hasLock: () => true }), getUserLock: () => ({ waitLock() {}, tryLock: () => true, releaseLock() {} }), getDocumentLock: () => ({ waitLock() {}, tryLock: () => true, releaseLock() {} }) },
      Utilities: {
        getUuid: () => uuidOf(rand), formatDate, sleep: ms => { clock += Number(ms) || 0; },
        DigestAlgorithm: { SHA_256: 'sha256', MD5: 'md5', SHA_1: 'sha1', SHA_512: 'sha512' }, Charset: { UTF_8: 'utf8' },
        MacAlgorithm: { HMAC_SHA_1: 'sha1', HMAC_SHA_256: 'sha256', HMAC_SHA_512: 'sha512' },
        computeDigest: (alg, s) => toSigned(crypto.createHash(alg).update(Array.isArray(s) ? fromSigned(s) : Buffer.from(String(s), 'utf8')).digest()),
        computeHmacSignature: (alg, v, k) => toSigned(crypto.createHmac(alg, Array.isArray(k) ? fromSigned(k) : String(k)).update(Array.isArray(v) ? fromSigned(v) : Buffer.from(String(v), 'utf8')).digest()),
        computeHmacSha256Signature: (v, k) => toSigned(crypto.createHmac('sha256', Array.isArray(k) ? fromSigned(k) : String(k)).update(Array.isArray(v) ? fromSigned(v) : Buffer.from(String(v), 'utf8')).digest()),
        base64Encode: b => (typeof b === 'string' ? Buffer.from(b, 'utf8') : fromSigned(b)).toString('base64'),
        base64EncodeWebSafe: b => (typeof b === 'string' ? Buffer.from(b, 'utf8') : fromSigned(b)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_'),
        base64Decode: s => toSigned(Buffer.from(String(s), 'base64')),
        base64DecodeWebSafe: s => toSigned(Buffer.from(String(s).replace(/-/g, '+').replace(/_/g, '/'), 'base64')),
        newBlob,
        gzip: (b, name) => newBlob(toSigned(zlib.gzipSync(fromSigned(b.getBytes()))), 'application/x-gzip', name),
        ungzip: b => newBlob(toSigned(zlib.gunzipSync(fromSigned(b.getBytes()))), 'application/octet-stream'),
        jsonStringify: JSON.stringify, jsonParse: JSON.parse
      },
      DriveApp: {
        getFolderById: id => { const f = st.folders.get(id); if (!f) throw new Error('No item with the given ID could be found.'); return folderObj(f); },
        createFolder: n => { const c = { id: nid('d'), name: n, parent: null }; st.folders.set(c.id, c); st.newFolders.push(c); return folderObj(c); },
        getFileById: getFile,
        getRootFolder: () => folderObj({ id: 'root', name: 'root' }),
        Access: { ANYONE_WITH_LINK: 'ANYONE_WITH_LINK', ANYONE: 'ANYONE', PRIVATE: 'PRIVATE' }, Permission: { VIEW: 'VIEW', EDIT: 'EDIT' }
      },
      MailApp: { sendEmail: (a, b, c, d) => { st.out.mail.push(typeof a === 'object' ? a : { to: a, subject: b, body: c, ...(d || {}) }); }, getRemainingDailyQuota: () => (env.mailQuota !== undefined ? env.mailQuota : 100) },
      UrlFetchApp: UrlFetch,
      ScriptApp: Script,
      ContentService: { MimeType: { JAVASCRIPT: 'application/javascript', JSON: 'application/json', TEXT: 'text/plain', CSV: 'text/csv' }, createTextOutput: s => { const o = { content: s === undefined ? '' : String(s), mime: 'text/plain', setMimeType(m) { o.mime = m; return o; }, getContent: () => o.content, setContent(c) { o.content = c; return o; } }; return o; } },
      HtmlService: { createHtmlOutput: h => { const o = { html: String(h || ''), title: '', setTitle(t) { o.title = t; return o; }, addMetaTag() { return o; }, setXFrameOptionsMode() { return o; }, setSandboxMode() { return o; }, getContent: () => o.html, append(x) { o.html += x; return o; } }; return o; }, XFrameOptionsMode: { ALLOWALL: 'ALLOWALL', DEFAULT: 'DEFAULT' }, SandboxMode: { IFRAME: 'IFRAME' } },
      Logger: { log: m => { st.logs.push(String(m)); return services.Logger; } },
      Date: RunDate,
      Math: RunMath,
      SUPA: env.supa || {},
      Session: { getScriptTimeZone: () => 'Asia/Bangkok', getActiveUser: () => ({ getEmail: () => '' }), getEffectiveUser: () => ({ getEmail: () => env.ownerEmail || '' }), getTemporaryActiveUserKey: () => '' }
    };

    const gas = factory(...SERVICES.map(n => services[n]));
    let value, error = null;
    try { value = body(gas, services); } catch (e) { error = e; }
    return { st, value, error };
  }

  /** สรุปสิ่งที่ต้องบันทึก */
  function changesOf(st) {
    const ch = { books: [], sheets: [], deleteSheets: [], props: [...st.propsDirty], cache: [], files: [], folders: st.newFolders.slice(), triggers: st.trigDirty ? st.triggers : null };
    (st.newBooks || []).forEach(b => ch.books.push({ id: b.id, name: b.name }));
    (st.bookRename || []).forEach(b => ch.books.push({ id: b.id, name: b.name }));
    for (const s of st.dirty) {
      const rows = s._rows || [];
      let n = rows.length; while (n > 0 && !rows[n - 1].some(x => x !== '' && x !== undefined)) n--;
      const orig = s._orig || [];
      const upd = [];
      for (let i = 0; i < n; i++) { const a = rows[i]; let m = a.length; while (m > 0 && (a[m - 1] === '' || a[m - 1] === undefined)) m--; const v = a.slice(0, m).map(x => (x === undefined ? '' : x)); const o = orig[i]; if (!o || JSON.stringify(o) !== JSON.stringify(v)) upd.push([i + 1, v]); }
      const origN = orig.length;
      if (!upd.length && n === origN && !s._rec.fresh && !s._rename) continue;
      ch.sheets.push({ book: s.book.id, name: s.name, oldName: s._rename || null, ord: s._rec.ord, fresh: !!s._rec.fresh, ver: s._rec.ver, rows: upd, nrows: n, trimFrom: n < origN ? n + 1 : null, full: rows.slice(0, n) });
    }
    (st.deleted || []).forEach(s => { if (!s._rec.fresh) ch.deleteSheets.push({ book: s.book.id, name: s.name, ver: s._rec.ver }); });
    const t = now();
    for (const [k, e] of st.cacheDirty) {
      if (e && Buffer.byteLength(e.v, 'utf8') > BIG_CACHE) { bigCache.set(k, e); ch.cache.push({ k, v: null }); continue; }   // ใหญ่: เก็บในเครื่อง ลบค่าเก่าในฐาน
      if (!e) bigCache.delete(k);
      ch.cache.push({ k, v: e ? e.v : null, exp: e ? new Date(e.exp).toISOString() : null });
    }
    void t;
    for (const op of st.fileOps) ch.files.push(op);
    return ch;
  }
  const hasWrites = ch => ch.books.length || ch.sheets.length || ch.deleteSheets.length || ch.props.length || ch.cache.length || ch.files.length || ch.folders.length || ch.triggers;

  /**
   * รันงาน: body(gas, services) → ค่าที่คืน · รันซ้ำจนข้อมูลครบ แล้วบันทึก
   * คืน { value, error, logs }
   */
  async function run(body) {
    let meta = await store.meta();
    const ctl = { seed: crypto.randomBytes(4).readUInt32LE(0), t0: now(), lineMemo: [] };
    for (let attempt = 0, runs = 0; ; ) {
      const { st, value, error } = runOnce(meta, body, ctl);
      if (st.need) {
        if (++runs > MAX_RUNS) throw new Error('runtime: too many reloads (' + st.need.kind + ' ' + st.need.key + ')');
        await resolve(st.need, meta); continue;
      }
      if (st.out.line.length) {   // ส่ง LINE ที่ค้าง แล้วรันซ้ำด้วยผลจริง
        if (++runs > MAX_RUNS) throw new Error('runtime: too many LINE rounds');
        for (const q of st.out.line) ctl.lineMemo[q.i] = await store.sendLine(q.url, q.opts);
        continue;
      }
      const ch = changesOf(st);
      if (hasWrites(ch)) {
        const r = await store.commit(ch);
        if (r && r.conflict) {
          if (++attempt > 4) throw new Error('runtime: write conflict ' + r.conflict.join(','));
          r.conflict.forEach(k => sheetCache.delete(k));
          meta = await store.meta(); continue;
        }
        // จำข้อมูลใหม่ไว้ในเครื่อง (คำขอถัดไปไม่ต้องโหลดซ้ำ)
        const vers = (r && r.vers) || {};
        ch.sheets.forEach(s => { const k = s.book + '|' + s.name; if (vers[k] !== undefined) sheetCache.set(k, { ver: vers[k], rows: s.full.map(x => { let m = x.length; while (m > 0 && (x[m - 1] === '' || x[m - 1] === undefined)) m--; return x.slice(0, m).map(y => (y === undefined ? '' : y)); }) }); if (s.oldName) sheetCache.delete(s.book + '|' + s.oldName); });
      }
      if (st.out.mail.length) await store.afterCommit(st.out);
      return { value, error, logs: st.logs };
    }
  }

  /** โหมดเทส (store.sync): รันและบันทึกทันที */
  function runSync(body) {
    const meta = store.meta();
    const ctl = { seed: crypto.randomBytes(4).readUInt32LE(0), t0: now(), lineMemo: [] };
    let res = runOnce(meta, body, ctl);
    for (let k = 0; res.st.out.line.length && k < MAX_RUNS; k++) {
      for (const q of res.st.out.line) ctl.lineMemo[q.i] = store.sendLine(q.url, q.opts);
      res = runOnce(store.meta(), body, ctl);
    }
    const { st, value, error } = res;
    const ch = changesOf(st);
    if (hasWrites(ch)) {
      const r = store.commit(ch);
      if (r && r.conflict) throw new Error('conflict ' + r.conflict);
      const vers = (r && r.vers) || {};
      ch.sheets.forEach(s => { const k = s.book + '|' + s.name; sheetCache.delete(k); if (s.oldName) sheetCache.delete(s.book + '|' + s.oldName); void vers; });
    }
    if (st.out.mail.length) store.afterCommit(st.out);
    return { value, error, logs: st.logs };
  }

  return { run, runSync, _caches: { sheetCache, bigCache, fetchMemo, fileMemo } };
}

/** แปลงคำขอ HTTP เป็นเหตุการณ์แบบ Apps Script (e.parameter / e.postData) */
export function gasEvent(url, method, bodyText, contentType) {
  const u = new URL(url);
  const parameter = {}, parameters = {};
  u.searchParams.forEach((v, k) => { if (!(k in parameter)) parameter[k] = v; (parameters[k] = parameters[k] || []).push(v); });
  const e = { parameter, parameters, queryString: u.search.slice(1), contextPath: '', contentLength: -1 };
  if (method === 'POST') {
    e.postData = { contents: bodyText || '', type: contentType || 'text/plain', length: (bodyText || '').length, name: 'postData' };
    if (/application\/x-www-form-urlencoded/.test(contentType || '')) new URLSearchParams(bodyText || '').forEach((v, k) => { if (!(k in parameter)) parameter[k] = v; (parameters[k] = parameters[k] || []).push(v); });
    e.contentLength = (bodyText || '').length;
  }
  return e;
}
