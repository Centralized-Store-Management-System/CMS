/*
 * โหมดทดลอง (ไฟล์นี้สร้างอัตโนมัติจาก apps-script/*.gs ด้วย build.js อย่าแก้ไฟล์นี้โดยตรง)
 * รันโค้ด Apps Script ตัวจริงในเบราว์เซอร์ แทน Google Sheet ด้วยข้อมูลใน localStorage ของเครื่องนี้
 * หน้าเว็บจึงทำงานเหมือนตอนต่อ Google จริงทุกอย่าง รวมถึงการตรวจสิทธิ์
 * ใช้เฉพาะตอนยังไม่ได้ใส่ URL ของ Apps Script
 */
(function (global) {
  'use strict';
  var KEY = 'amz.demo.v2', CKEY = 'amz.demo.cache';
  var store, cacheMem, memFiles = {};
  function loadStore() {
    try { store = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { store = null; }
    if (!store || !store.books) store = { seq: 1, props: {}, books: {}, folders: {} };
    try { cacheMem = JSON.parse(localStorage.getItem(CKEY) || '{}'); } catch (e) { cacheMem = {}; }
  }
  function saveStore() {
    try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) { console.warn('พื้นที่เก็บข้อมูลโหมดทดลองเต็ม', e); }
    try { localStorage.setItem(CKEY, JSON.stringify(cacheMem)); } catch (e) { /* ignore */ }
  }
  loadStore();
  function nid(p) { return p + (store.seq++) + Math.random().toString(36).slice(2, 7); }

  /* ---------- SHA-256 แบบ synchronous (แทน Utilities.computeDigest) ---------- */
  var K = [0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2];
  function sha256(str) {
    var b = Array.from(new TextEncoder().encode(str)), l = b.length * 8;
    b.push(0x80); while (b.length % 64 !== 56) b.push(0);
    for (var s = 56; s >= 0; s -= 8) b.push(s >= 32 ? 0 : (l >>> s) & 255);
    var H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19], W = new Array(64);
    var r = function (x, n) { return (x >>> n) | (x << (32 - n)); };
    for (var i = 0; i < b.length; i += 64) {
      for (var t = 0; t < 16; t++) W[t] = (b[i + 4 * t] << 24) | (b[i + 4 * t + 1] << 16) | (b[i + 4 * t + 2] << 8) | b[i + 4 * t + 3];
      for (t = 16; t < 64; t++) {
        var s0 = r(W[t - 15], 7) ^ r(W[t - 15], 18) ^ (W[t - 15] >>> 3), s1 = r(W[t - 2], 17) ^ r(W[t - 2], 19) ^ (W[t - 2] >>> 10);
        W[t] = (W[t - 16] + s0 + W[t - 7] + s1) | 0;
      }
      var a = H[0], c = H[1], d = H[2], e = H[3], f = H[4], g = H[5], h = H[6], k = H[7];
      for (t = 0; t < 64; t++) {
        var S1 = r(f, 6) ^ r(f, 11) ^ r(f, 25), ch = (f & g) ^ (~f & h), T1 = (k + S1 + ch + K[t] + W[t]) | 0;
        var S0 = r(a, 2) ^ r(a, 13) ^ r(a, 22), mj = (a & c) ^ (a & d) ^ (c & d), T2 = (S0 + mj) | 0;
        k = h; h = g; g = f; f = (e + T1) | 0; e = d; d = c; c = a; a = (T1 + T2) | 0;
      }
      H[0] = (H[0] + a) | 0; H[1] = (H[1] + c) | 0; H[2] = (H[2] + d) | 0; H[3] = (H[3] + e) | 0; H[4] = (H[4] + f) | 0; H[5] = (H[5] + g) | 0; H[6] = (H[6] + h) | 0; H[7] = (H[7] + k) | 0;
    }
    var out = [];
    H.forEach(function (x) { for (var s = 24; s >= 0; s -= 8) { var v = (x >>> s) & 255; out.push(v > 127 ? v - 256 : v); } });
    return out;
  }
  function b64enc(arr) { var s = ''; for (var i = 0; i < arr.length; i++) s += String.fromCharCode(arr[i] < 0 ? arr[i] + 256 : arr[i]); return btoa(s); }
  function b64dec(str) { var s = atob(str), out = new Array(s.length); for (var i = 0; i < s.length; i++) { var v = s.charCodeAt(i); out[i] = v > 127 ? v - 256 : v; } return out; }

  /* ---------- Google Sheets จำลอง ---------- */
  function sheetData(bookId, name) { var bk = store.books[bookId]; return bk && bk.sheets.filter(function (s) { return s.name === name; })[0]; }
  function Range(sh, r, c, nr, nc) { this.sh = sh; this.r = r; this.c = c; this.nr = nr; this.nc = nc; }
  Range.prototype.setValues = function (v) {
    if (v.length !== this.nr) throw new Error('จำนวนแถวไม่ตรงกับช่วงข้อมูล');
    for (var i = 0; i < v.length; i++) for (var j = 0; j < this.nc; j++) this.sh._set(this.r + i, this.c + j, v[i][j]);
    return this;
  };
  Range.prototype.getDisplayValues = function () {
    var out = [];
    for (var i = 0; i < this.nr; i++) { var row = []; for (var j = 0; j < this.nc; j++) row.push(this.sh._get(this.r + i, this.c + j)); out.push(row); }
    return out;
  };
  Range.prototype.getValues = Range.prototype.getDisplayValues;
  Range.prototype.clearContent = function () { for (var i = 0; i < this.nr; i++) for (var j = 0; j < this.nc; j++) this.sh._set(this.r + i, this.c + j, ''); return this; };
  ['setNumberFormat', 'setFontWeight', 'setBackground', 'setFontColor', 'setFontSize', 'setWrap', 'setNote'].forEach(function (m) { Range.prototype[m] = function () { return this; }; });

  function Sheet(bookId, name) { this.bookId = bookId; this.name = name; }
  Sheet.prototype._d = function () { return sheetData(this.bookId, this.name); };
  Sheet.prototype._set = function (r, c, v) {
    var rows = this._d().rows;
    while (rows.length < r) rows.push([]);
    var row = rows[r - 1];
    while (row.length < c) row.push('');
    row[c - 1] = v === null || v === undefined ? '' : String(v);
  };
  Sheet.prototype._get = function (r, c) { var row = this._d().rows[r - 1]; var v = row ? row[c - 1] : ''; return v === undefined ? '' : v; };
  Sheet.prototype.getName = function () { return this.name; };
  Sheet.prototype.getLastRow = function () { var rows = this._d().rows; for (var i = rows.length; i > 0; i--) { if (rows[i - 1].some(function (x) { return x !== '' && x !== undefined && x !== null; })) return i; } return 0; };
  Sheet.prototype.getLastColumn = function () { var m = 0; this._d().rows.forEach(function (r) { for (var j = r.length; j > m; j--) { if (r[j - 1] !== '' && r[j - 1] !== undefined) { m = j; break; } } }); return m; };
  Sheet.prototype.getMaxRows = function () { return Math.max(1000, this._d().rows.length); };
  Sheet.prototype.getMaxColumns = function () { return Math.max(26, this.getLastColumn()); };
  Sheet.prototype.getRange = function (r, c, nr, nc) { return new Range(this, r, c, nr || 1, nc || 1); };
  Sheet.prototype.getDataRange = function () { return new Range(this, 1, 1, Math.max(1, this.getLastRow()), Math.max(1, this.getLastColumn())); };
  Sheet.prototype.deleteRow = function (r) { this._d().rows.splice(r - 1, 1); };
  Sheet.prototype.deleteRows = function (r, n) { this._d().rows.splice(r - 1, n); };
  Sheet.prototype.appendRow = function (a) { var r = this.getLastRow() + 1, self = this; a.forEach(function (v, j) { self._set(r, j + 1, v); }); return this; };
  Sheet.prototype.clear = function () { this._d().rows = []; return this; };
  ['setFrozenRows', 'setTabColor', 'setColumnWidth'].forEach(function (m) { Sheet.prototype[m] = function () { return this; }; });

  function Book(id) { this.id = id; }
  Book.prototype.getId = function () { return this.id; };
  Book.prototype.getUrl = function () { return '#demo-' + this.id; };
  Book.prototype.getName = function () { return store.books[this.id].name; };
  Book.prototype.getSheets = function () { var id = this.id; return store.books[id].sheets.map(function (s) { return new Sheet(id, s.name); }); };
  Book.prototype.getSheetByName = function (n) { return sheetData(this.id, n) ? new Sheet(this.id, n) : null; };
  Book.prototype.insertSheet = function (n, idx) { var arr = store.books[this.id].sheets, d = { name: n, rows: [] }; if (idx === undefined) arr.push(d); else arr.splice(idx, 0, d); return new Sheet(this.id, n); };
  Book.prototype.deleteSheet = function (sh) { var bk = store.books[this.id]; bk.sheets = bk.sheets.filter(function (s) { return s.name !== sh.name; }); };

  function Folder(id) { this.id = id; }
  Folder.prototype.getId = function () { return this.id; };
  Folder.prototype.createFolder = function (n) { var id = nid('folder'); store.folders[id] = { name: n }; return new Folder(id); };
  Folder.prototype.createFile = function (blob) {
    var f = { name: blob.name, type: blob.type, bytes: blob.bytes };
    (memFiles[this.id] = memFiles[this.id] || []).push(f);
    return { setDescription: function () { return this; } };
  };
  Folder.prototype.getFilesByName = function (n) {
    var list = (memFiles[this.id] || []).filter(function (f) { return f.name === n; }), i = 0;
    return { hasNext: function () { return i < list.length; }, next: function () { var f = list[i++]; return { getBlob: function () { return { getContentType: function () { return f.type; }, getBytes: function () { return f.bytes; } }; } }; } };
  };

  var pad2 = function (n) { return (n < 10 ? '0' : '') + n; };
  var SpreadsheetApp = {
    create: function (n) { var id = nid('book'); store.books[id] = { name: n, sheets: [{ name: 'Sheet1', rows: [] }] }; return new Book(id); },
    openById: function (id) { if (!store.books[id]) throw new Error('ไม่พบไฟล์'); return new Book(id); }
  };
  var DriveApp = {
    createFolder: function (n) { var id = nid('folder'); store.folders[id] = { name: n }; return new Folder(id); },
    getFolderById: function (id) { if (!store.folders[id]) throw new Error('ไม่พบโฟลเดอร์'); return new Folder(id); },
    getFileById: function () { return { moveTo: function () {} }; }
  };
  var PropertiesService = { getScriptProperties: function () { return {
    getProperty: function (k) { return Object.prototype.hasOwnProperty.call(store.props, k) ? store.props[k] : null; },
    setProperty: function (k, v) { store.props[k] = String(v); },
    deleteProperty: function (k) { delete store.props[k]; }
  }; } };
  var CacheService = { getScriptCache: function () { return {
    get: function (k) { var e = cacheMem[k]; if (!e) return null; if (e.x < Date.now()) { delete cacheMem[k]; return null; } return e.v; },
    put: function (k, v, ttl) { cacheMem[k] = { v: String(v), x: Date.now() + (ttl || 600) * 1000 }; },
    remove: function (k) { delete cacheMem[k]; },
    removeAll: function (ks) { ks.forEach(function (k) { delete cacheMem[k]; }); }
  }; } };
  var LockService = { getScriptLock: function () { return { waitLock: function () {}, tryLock: function () { return true; }, releaseLock: function () {} }; } };
  var Utilities = {
    getUuid: function () { return global.crypto && global.crypto.randomUUID ? global.crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) { var r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); }); },
    formatDate: function (d, tz, fmt) {
      var x = new Date(d.getTime() + 7 * 3600000);
      var m = { yyyy: x.getUTCFullYear(), MM: pad2(x.getUTCMonth() + 1), dd: pad2(x.getUTCDate()), HH: pad2(x.getUTCHours()), mm: pad2(x.getUTCMinutes()), ss: pad2(x.getUTCSeconds()) };
      return fmt.replace(/yyyy|MM|dd|HH|mm|ss/g, function (k) { return m[k]; });
    },
    DigestAlgorithm: { SHA_256: 'sha256', MD5: 'md5' }, Charset: { UTF_8: 'utf8' },
    computeDigest: function (alg, s) { return sha256(String(s)); },
    base64Encode: b64enc, base64Decode: b64dec,
    newBlob: function (bytes, type, name) { return { bytes: bytes, type: type, name: name }; }
  };
  var ContentService = { MimeType: { JAVASCRIPT: 'js', JSON: 'json' }, createTextOutput: function (s) { return { content: s, setMimeType: function () { return this; } }; } };
  var HtmlService = { createHtmlOutput: function (h) { return { html: h, setTitle: function () { return this; }, addMetaTag: function () { return this; }, getContent: function () { return h; } }; } };
  /* โหมดทดลอง: ไม่ส่ง LINE จริง เก็บข้อความไว้แสดงตัวอย่างในหน้า LINE Notifications */
  var UrlFetchApp = { fetch: function (url, o) {
    var body = JSON.parse(o.payload);
    store.linePushes = (store.linePushes || []).concat([{ at: new Date().toISOString(), url: url, to: body.to, messages: body.messages }]).slice(-40);
    return { getResponseCode: function () { return 200; }, getContentText: function () { return '{}'; } };
  } };
  var ScriptApp = {
    getService: function () { return { getUrl: function () { return 'https://script.google.com/macros/s/DEMO/exec'; } }; },
    getProjectTriggers: function () { return (store.triggers || []).map(function (fn) { return { getHandlerFunction: function () { return fn; } }; }); },
    deleteTrigger: function (t) { store.triggers = (store.triggers || []).filter(function (f) { return f !== t.getHandlerFunction(); }); },
    newTrigger: function (fn) { var b = { timeBased: function () { return b; }, atHour: function () { return b; }, everyDays: function () { return b; }, inTimezone: function () { return b; }, create: function () { store.triggers = (store.triggers || []).concat([fn]); return {}; } }; return b; }
  };
  var Logger = { log: function () {} };

  /* ===================== โค้ด Apps Script ตัวจริง ===================== */

  /* ----- 00_Config.gs ----- */
/**
 * ระบบหลังร้าน Café Amazon — ค่าตั้งต้น
 * แต่ละระบบแยกไฟล์ .gs ของตัวเอง แก้ระบบไหนให้แก้เฉพาะไฟล์นั้น
 *   00_Config.gs    ไฟล์ Google Sheet แต่ละระบบ ชีตและคอลัมน์ สิทธิ์เริ่มต้น
 *   01_Setup.gs     สร้างไฟล์ Google Sheet แยกตามระบบ ตั้งรหัส Owner (รันครั้งเดียว)
 *   02_Api.gs       รับคำสั่งจากหน้าเว็บ
 *   03_Calc.gs      สูตรเวลาทำงาน (เหมือน js/calc.js ทุกตัวอักษร)
 *   04_Db.gs        อ่าน/เขียนชีตข้ามไฟล์ บันทึกการใช้งาน
 *   05_Auth.gs      เข้าสู่ระบบ สิทธิ์ PIN
 *   06_HR.gs        กฎข้อมูลพนักงาน
 *   07_Time.gs      ลงเวลา คำขอของพนักงาน ซิงก์ตารางงานกับการลงเวลา
 *   08_Stock.gs     กฎสต็อก โอนสต็อกระหว่างสาขา
 *   09_Photo.gs     รูปถ่ายตอนลงเวลา
 *   10_Branch.gs    สาขา และการจำกัดข้อมูลตามสาขาที่แต่ละคนดูแล
 *   11_Schedule.gs  รูปแบบกะรายสัปดาห์ จำนวนคนที่ต้องการต่อกะ
 *   12_Users.gs     บัญชีผู้ใช้ที่ Owner สร้าง (ไม่ต้องเป็นพนักงาน) เพื่อแยก log รายคน
 *   13_Admin.gs     System Admin: ตรวจสุขภาพระบบทุกระบบ และปุ่มแก้ไขปัญหา
 *   14_Line.gs      แจ้งเตือน LINE (Messaging API): อนุมัติจาก LINE แจ้งลงเวลา สรุปรายวัน
 *   15_Account.gs   ชื่อผู้ใช้ขึ้นต้นตาม Role (mgr_ staff_ …) รหัสเปิดใช้งาน เจ้าตัวตั้ง/เปลี่ยน PIN 6 หลักเอง
 */
var APP_VERSION = '3.1.0';
var TZ = 'Asia/Bangkok';
var ROOT_FOLDER_NAME = 'Amazon Cafe ระบบหลังร้าน';
var PHOTO_FOLDER_NAME = 'รูปลงเวลา';
var HEADER_ROWS = 2;          // แถว 1 ชื่อภาษาไทย, แถว 2 ชื่อคอลัมน์ที่ระบบใช้ (ห้ามแก้แถว 2)
var SESSION_SECONDS = 21600;  // เข้าสู่ระบบครั้งหนึ่งใช้ได้ 6 ชั่วโมง

/** แต่ละระบบเก็บในไฟล์ Google Sheet ของตัวเอง ข้อมูลที่เป็นของสาขามีคอลัมน์ "สาขา" กำกับทุกแถว */
var BOOKS = {
  core:    { title: 'Amazon Cafe 0 ระบบหลัก',  color: '#1E4D38', about: 'สาขา ตั้งค่า สิทธิ์การใช้งาน บันทึกการใช้งาน' },
  hr:      { title: 'Amazon Cafe 1 HR บุคคล',  color: '#1D6F72', about: 'ข้อมูลพนักงานทุกสาขา ผู้สมัคร' },
  time:    { title: 'Amazon Cafe 2 เวลาทำงาน', color: '#A86A12', about: 'กะ รูปแบบกะ คนที่ต้องการต่อกะ ตารางงาน ลงเวลา การลา คำขอแก้เวลา' },
  payroll: { title: 'Amazon Cafe 3 เงินเดือน', color: '#5A4A8C', about: 'งวดเงินเดือนที่ปิดแล้ว' },
  stock:   { title: 'Amazon Cafe 4 สต็อก',     color: '#7A4A2A', about: 'รายการสินค้า (ใช้ร่วมทุกสาขา) รับเข้า เบิกใช้ ของเสีย ตรวจนับ โอนระหว่างสาขา' },
  acct:    { title: 'Amazon Cafe 5 บัญชี',     color: '#2F5D8F', about: 'ยอดขายรายวัน รายจ่าย สรุปงบรายเดือน แยกสาขา' }
};

/**
 * ตาราง: book = ไฟล์, tab = ชื่อชีต, read/write = สิทธิ์ที่ต้องมี ('*' = ทุกคนที่เข้าสู่ระบบ)
 * scope = วิธีจำกัดข้อมูลตามสาขา: 'branch' ดูคอลัมน์ branch ของแถว, 'emp' ดูสาขาประจำของพนักงานในแถว
 * central = แถวที่ branch ว่าง หมายถึงส่วนกลาง (เห็นเฉพาะคนที่ดูแลทุกสาขา)
 * dual = เห็นได้ทั้งสาขาที่ทำงานวันนั้นและสาขาประจำของพนักงาน (ใช้กับการยืมคนข้ามสาขา)
 * cols = [ชื่อคอลัมน์ที่ระบบใช้, ชื่อภาษาไทยที่แสดงในชีต]
 */
var TABLES = {
  settings: { book: 'core', tab: 'ตั้งค่า', cols: [['key', 'รายการ'], ['value', 'ค่า']] },
  branches: { book: 'core', tab: 'สาขา', read: ['*'], write: ['settings'], cols: [['id', 'รหัสระบบ'], ['code', 'รหัสสาขา'], ['name', 'ชื่อสาขา'], ['status', 'สถานะ'], ['openDate', 'วันเปิด'], ['address', 'ที่อยู่'], ['phone', 'โทร'], ['lat', 'ละติจูด'], ['lng', 'ลองจิจูด'], ['radius', 'รัศมีลงเวลา (ม.)'], ['maxAccuracy', 'GPS คลาดเคลื่อนได้ (ม.)'], ['requireSelfie', 'ต้องถ่ายรูป'], ['royaltyPct', 'Royalty %'], ['marketingPct', 'Marketing %'], ['posRentMonthly', 'ค่าเช่า POS/เดือน'], ['investment', 'เงินลงทุน'], ['amortMonths', 'ตัดจำหน่าย (เดือน)'], ['note', 'บันทึก'], ['by', 'แก้ไขโดย'], ['updatedAt', 'แก้ไขล่าสุด']] },
  log: { book: 'core', tab: 'บันทึกการใช้งาน', read: ['settings', 'admin'], cols: [['id', 'รหัส'], ['at', 'เวลา'], ['user', 'ผู้ใช้'], ['role', 'สิทธิ์'], ['action', 'การกระทำ'], ['table', 'ข้อมูล'], ['detail', 'รายละเอียด'], ['code', 'บัญชีผู้ใช้'], ['via', 'ช่องทาง']] },
  users: { book: 'core', tab: 'ผู้ใช้ระบบ (Users)', read: ['users'], write: ['users'], cols: [['id', 'รหัสระบบ'], ['username', 'ชื่อเข้าระบบ'], ['name', 'ชื่อที่แสดง'], ['role', 'ระดับ (Role)'], ['empId', 'ผูกกับพนักงาน'], ['branch', 'สาขาหลัก'], ['branchAccess', 'ดูแลสาขา'], ['perms', 'สิทธิ์เฉพาะคน (ว่าง = ตาม Role)'], ['status', 'สถานะ'], ['pinHash', 'PIN (เข้ารหัส เจ้าตัวตั้งเอง)'], ['lineUserId', 'LINE ID'], ['lineEvents', 'แจ้งเตือน LINE'], ['lastLogin', 'เข้าระบบล่าสุด'], ['note', 'บันทึก'], ['by', 'แก้ไขโดย'], ['updatedAt', 'แก้ไขล่าสุด'], ['setupHash', 'รหัสเปิดใช้งาน (เข้ารหัส)'], ['setupExpires', 'รหัสเปิดใช้งานหมดอายุ'], ['pinSetAt', 'ตั้ง PIN เมื่อ']] },
  notify: { book: 'core', tab: 'แจ้งเตือน LINE', read: ['settings', 'admin'], cols: [['id', 'รหัส/โทเคน'], ['at', 'ส่งเมื่อ'], ['kind', 'ประเภท'], ['refTable', 'ข้อมูล'], ['refId', 'รายการ'], ['refField', 'ช่อง'], ['branch', 'สาขา'], ['to', 'ผู้รับ (บัญชี)'], ['toName', 'ชื่อผู้รับ'], ['title', 'หัวข้อ'], ['status', 'สถานะ'], ['error', 'ข้อผิดพลาด'], ['expiresAt', 'หมดอายุ'], ['usedAt', 'ใช้เมื่อ'], ['result', 'ผล']] },

  employees: { book: 'hr', tab: 'พนักงาน', read: ['hr'], write: ['hr'], scope: 'emp', cols: [['id', 'รหัสระบบ'], ['code', 'รหัสพนักงาน'], ['role', 'สิทธิ์ใช้งาน'], ['branch', 'สาขาประจำ'], ['branchAccess', 'ดูแลสาขาเพิ่ม'], ['firstName', 'ชื่อ'], ['lastName', 'นามสกุล'], ['nickname', 'ชื่อเล่น'], ['phone', 'เบอร์โทร'], ['idCard', 'เลขบัตรประชาชน'], ['birthDate', 'วันเกิด'], ['address', 'ที่อยู่'], ['position', 'ตำแหน่ง'], ['status', 'สถานะ'], ['startDate', 'วันเริ่มงาน'], ['endDate', 'วันสุดท้าย'], ['payType', 'รูปแบบค่าจ้าง'], ['rate', 'อัตราค่าจ้าง'], ['ssoEnrolled', 'ประกันสังคม'], ['bank', 'ธนาคาร'], ['bankAcct', 'เลขบัญชี'], ['emergency', 'ผู้ติดต่อฉุกเฉิน'], ['pdpaConsent', 'ยินยอม PDPA'], ['photo', 'รูปถ่าย'], ['pinHash', 'PIN (เข้ารหัส)'], ['lineUserId', 'LINE ID'], ['lineEvents', 'แจ้งเตือน LINE'], ['note', 'บันทึก'], ['by', 'แก้ไขโดย'], ['updatedAt', 'แก้ไขล่าสุด']] },
  applicants: { book: 'hr', tab: 'ผู้สมัคร', read: ['hr'], write: ['hr'], scope: 'branch', central: true, cols: [['id', 'รหัสระบบ'], ['branch', 'สาขาที่สมัคร'], ['name', 'ชื่อ-นามสกุล'], ['phone', 'เบอร์โทร'], ['position', 'ตำแหน่ง'], ['appliedDate', 'วันที่สมัคร'], ['source', 'ช่องทาง'], ['status', 'สถานะ'], ['interviewDate', 'วันสัมภาษณ์'], ['interviewTime', 'เวลาสัมภาษณ์'], ['expectedPay', 'ค่าจ้างที่คาดหวัง'], ['availability', 'เวลาที่ทำงานได้'], ['photo', 'รูปถ่าย'], ['note', 'ผลสัมภาษณ์'], ['by', 'แก้ไขโดย'], ['updatedAt', 'แก้ไขล่าสุด']] },

  shifts: { book: 'time', tab: 'กะทำงาน', read: ['*'], write: ['schedule_edit'], cols: [['id', 'รหัสระบบ'], ['code', 'รหัสกะ'], ['name', 'ชื่อกะ'], ['start', 'เวลาเข้า'], ['end', 'เวลาออก'], ['breakMin', 'พัก (นาที)'], ['color', 'สี'], ['branch', 'ใช้ที่สาขา (ว่าง = ทุกสาขา)'], ['by', 'แก้ไขโดย'], ['updatedAt', 'แก้ไขล่าสุด']] },
  patterns: { book: 'time', tab: 'รูปแบบกะ', read: ['schedule_view', 'schedule_edit', 'time'], write: ['schedule_edit'], scope: 'emp', cols: [['id', 'รหัสระบบ'], ['empId', 'พนักงาน'], ['d1', 'จันทร์'], ['d2', 'อังคาร'], ['d3', 'พุธ'], ['d4', 'พฤหัสบดี'], ['d5', 'ศุกร์'], ['d6', 'เสาร์'], ['d0', 'อาทิตย์'], ['note', 'หมายเหตุ'], ['by', 'แก้ไขโดย'], ['updatedAt', 'แก้ไขล่าสุด']] },
  staffing: { book: 'time', tab: 'คนที่ต้องการต่อกะ', read: ['schedule_view', 'schedule_edit', 'time'], write: ['schedule_edit'], scope: 'branch', cols: [['id', 'รหัสระบบ'], ['branch', 'สาขา'], ['shift', 'กะ'], ['d1', 'จันทร์'], ['d2', 'อังคาร'], ['d3', 'พุธ'], ['d4', 'พฤหัสบดี'], ['d5', 'ศุกร์'], ['d6', 'เสาร์'], ['d0', 'อาทิตย์'], ['by', 'แก้ไขโดย'], ['updatedAt', 'แก้ไขล่าสุด']] },
  schedule: { book: 'time', tab: 'ตารางงาน', read: ['schedule_view', 'schedule_edit', 'time'], write: ['schedule_edit'], scope: 'branch', dual: true, cols: [['id', 'รหัสระบบ'], ['date', 'วันที่'], ['empId', 'พนักงาน'], ['branch', 'สาขาที่ทำงาน'], ['shift', 'กะ'], ['start', 'เข้า (กำหนดเอง)'], ['end', 'ออก (กำหนดเอง)'], ['note', 'หมายเหตุ'], ['by', 'แก้ไขโดย'], ['updatedAt', 'แก้ไขล่าสุด']] },
  attendance: { book: 'time', tab: 'ลงเวลา', read: ['time', 'approve_time'], write: ['time', 'approve_time'], scope: 'branch', dual: true, cols: [['id', 'รหัสระบบ'], ['empId', 'พนักงาน'], ['date', 'วันที่'], ['branch', 'สาขา'], ['inTime', 'เข้า'], ['outTime', 'ออก'], ['inDist', 'ห่างร้านตอนเข้า (ม.)'], ['outDist', 'ห่างร้านตอนออก (ม.)'], ['inPhoto', 'รูปตอนเข้า'], ['outPhoto', 'รูปตอนออก'], ['planCode', 'กะตามแผน'], ['planStart', 'เข้าตามแผน'], ['planEnd', 'ออกตามแผน'], ['holiday', 'วันหยุด'], ['offWork', 'ทำงานวันหยุดของตัวเอง'], ['lateMin', 'สาย (นาที)'], ['workMin', 'ทำงาน (นาที)'], ['otMin', 'OT (นาที)'], ['otStatus', 'สถานะ OT'], ['offStatus', 'สถานะทำงานวันหยุด'], ['source', 'ที่มา'], ['note', 'หมายเหตุ'], ['by', 'แก้ไขโดย'], ['decidedBy', 'อนุมัติโดย'], ['updatedAt', 'แก้ไขล่าสุด']] },
  leaves: { book: 'time', tab: 'การลา', read: ['time', 'approve_time'], write: ['time', 'approve_time'], scope: 'emp', cols: [['id', 'รหัสระบบ'], ['empId', 'พนักงาน'], ['type', 'ประเภท'], ['dateFrom', 'ตั้งแต่'], ['dateTo', 'ถึง'], ['days', 'จำนวนวัน'], ['status', 'สถานะ'], ['reason', 'เหตุผล'], ['by', 'บันทึกโดย'], ['decidedBy', 'อนุมัติโดย'], ['decidedAt', 'อนุมัติเมื่อ'], ['createdAt', 'สร้างเมื่อ'], ['updatedAt', 'แก้ไขล่าสุด']] },
  timefix: { book: 'time', tab: 'คำขอแก้เวลา', read: ['time', 'approve_time'], write: ['time', 'approve_time'], scope: 'emp', cols: [['id', 'รหัสระบบ'], ['empId', 'พนักงาน'], ['date', 'วันที่'], ['inTime', 'เวลาเข้าที่ขอ'], ['outTime', 'เวลาออกที่ขอ'], ['reason', 'เหตุผล'], ['status', 'สถานะ'], ['by', 'ขอโดย'], ['decidedBy', 'อนุมัติโดย'], ['decidedAt', 'อนุมัติเมื่อ'], ['createdAt', 'สร้างเมื่อ'], ['updatedAt', 'แก้ไขล่าสุด']] },

  payroll: { book: 'payroll', tab: 'เงินเดือน', read: ['payroll'], write: ['payroll'], scope: 'emp', cols: [['id', 'รหัสระบบ'], ['period', 'งวด'], ['empId', 'พนักงาน'], ['branch', 'สาขาประจำ'], ['status', 'สถานะ'], ['payType', 'รูปแบบค่าจ้าง'], ['rate', 'อัตรา'], ['workDays', 'วันทำงาน'], ['workMin', 'นาทีทำงาน'], ['lateMin', 'สาย (นาที)'], ['otMin', 'OT (นาที)'], ['absent', 'ขาดงาน (วัน)'], ['unpaid', 'ลาไม่รับค่าจ้าง (วัน)'], ['paidLeave', 'ลาได้ค่าจ้าง (วัน)'], ['base', 'ค่าจ้างฐาน'], ['absentDed', 'หักวันไม่ได้ทำงาน'], ['lateDed', 'หักเวลาสาย'], ['otPay', 'ค่าล่วงเวลา'], ['holPay', 'ค่าทำงานวันหยุด'], ['allowance', 'เบี้ยเลี้ยง'], ['bonus', 'โบนัส'], ['otherDed', 'หักอื่นๆ'], ['gross', 'รวมเงินได้'], ['sso', 'ประกันสังคมลูกจ้าง'], ['employerSso', 'ประกันสังคมนายจ้าง'], ['tax', 'ภาษีหัก ณ ที่จ่าย'], ['net', 'สุทธิ'], ['branchSplit', 'ปันค่าแรงตามสาขา'], ['note', 'หมายเหตุ'], ['closedAt', 'ปิดงวดเมื่อ'], ['by', 'แก้ไขโดย'], ['updatedAt', 'แก้ไขล่าสุด']] },

  items: { book: 'stock', tab: 'สินค้า', read: ['stock'], write: ['stock'], cols: [['id', 'รหัสระบบ'], ['sku', 'รหัสสินค้า'], ['name', 'ชื่อสินค้า'], ['category', 'หมวด'], ['unit', 'หน่วย'], ['cost', 'ต้นทุนเฉลี่ย'], ['min', 'จุดสั่งซื้อ (ต่อสาขา)'], ['supplier', 'ผู้ขาย'], ['note', 'บันทึก'], ['by', 'แก้ไขโดย'], ['updatedAt', 'แก้ไขล่าสุด']] },
  moves: { book: 'stock', tab: 'รับเบิก', read: ['stock'], write: ['stock'], scope: 'branch', cols: [['id', 'รหัสระบบ'], ['date', 'วันที่'], ['branch', 'สาขา'], ['itemId', 'สินค้า'], ['type', 'รายการ'], ['qty', 'จำนวน'], ['unitCost', 'ต้นทุนต่อหน่วย'], ['expiry', 'วันหมดอายุ'], ['ref', 'เลขที่เอกสาร'], ['toBranch', 'โอนไป/รับจากสาขา'], ['note', 'บันทึก'], ['status', 'สถานะ'], ['by', 'บันทึกโดย'], ['decidedBy', 'อนุมัติโดย'], ['createdAt', 'สร้างเมื่อ'], ['updatedAt', 'แก้ไขล่าสุด']] },

  sales: { book: 'acct', tab: 'ยอดขายรายวัน', read: ['sales', 'pnl'], write: ['sales'], scope: 'branch', cols: [['id', 'รหัสระบบ'], ['date', 'วันที่'], ['branch', 'สาขา'], ['cups', 'จำนวนแก้ว'], ['cash', 'เงินสด'], ['qr', 'โอน/QR'], ['card', 'บัตร'], ['delivery', 'เดลิเวอรี่'], ['other', 'อื่นๆ'], ['total', 'รวม'], ['cashCounted', 'เงินสดนับได้'], ['overShort', 'ขาด/เกิน'], ['note', 'บันทึก'], ['by', 'บันทึกโดย'], ['updatedAt', 'แก้ไขล่าสุด']] },
  expenses: { book: 'acct', tab: 'รายจ่าย', read: ['sales', 'pnl'], write: ['sales'], scope: 'branch', central: true, cols: [['id', 'รหัสระบบ'], ['date', 'วันที่'], ['branch', 'สาขา (ว่าง = ส่วนกลาง)'], ['category', 'หมวด'], ['amount', 'จำนวนเงิน'], ['vendor', 'จ่ายให้'], ['payMethod', 'จ่ายโดย'], ['ref', 'เลขที่ใบเสร็จ'], ['note', 'บันทึก'], ['by', 'บันทึกโดย'], ['updatedAt', 'แก้ไขล่าสุด']] },
  pnl_monthly: { book: 'acct', tab: 'สรุปงบรายเดือน', read: ['pnl'], write: ['pnl'], scope: 'branch', central: true, cols: [['id', 'รหัสระบบ'], ['month', 'เดือน'], ['branch', 'สาขา (ว่าง = รวมทุกสาขา)'], ['gross', 'ยอดขาย'], ['revenue', 'รายได้สุทธิ'], ['cups', 'แก้ว'], ['cogs', 'ต้นทุนขาย'], ['labor', 'ค่าแรง'], ['royalty', 'Royalty'], ['mkt', 'Marketing'], ['occupancy', 'ค่าเช่า น้ำ ไฟ'], ['otherExp', 'รายจ่ายอื่น'], ['pos', 'ค่าเช่า POS'], ['amort', 'ตัดจำหน่าย'], ['profit', 'กำไรสุทธิ'], ['by', 'บันทึกโดย'], ['updatedAt', 'แก้ไขล่าสุด']] }
};

/** สิทธิ์การใช้งาน: [รหัส, คำอธิบาย, เฉพาะ Owner] */
var PERMS = [
  ['dash', 'Dashboard — ภาพรวมร้านและตัวเลขกำไร', true],
  ['pnl', 'P&L — กำไรขาดทุน', true],
  ['settings', 'Settings — สาขา กฎ สิทธิ์ ดีไซน์', true],
  ['users', 'User Management — สร้าง/ปิดบัญชีผู้ใช้', false],
  ['admin', 'System Admin — ตรวจสอบและแก้ไขระบบ แจ้งเตือน LINE', false],
  ['hr', 'HR — ข้อมูลพนักงานและผู้สมัคร', false],
  ['payroll', 'Payroll — เงินเดือน', false],
  ['approve_time', 'Approve Time — ลา OT แก้เวลา ขาดงาน', false],
  ['approve_stock', 'Approve Stock — ปรับยอดสต็อก', false],
  ['time', 'Time Attendance — ดูเวลาทำงานและการลาทุกคน', false],
  ['schedule_edit', 'Schedule (Edit) — จัดตาราง รูปแบบกะ คนที่ต้องการ', false],
  ['schedule_view', 'Schedule (View) — ดูตารางงานของสาขา', false],
  ['stock', 'Inventory — สต็อก', false],
  ['sales', 'Sales & Expenses — ปิดยอดขาย บันทึกรายจ่าย', false]
];
var DEFAULT_PERMS = {
  admin: ['users', 'admin'],
  hr: ['hr', 'payroll', 'approve_time', 'time', 'schedule_edit', 'schedule_view'],
  manager: ['time', 'schedule_edit', 'schedule_view', 'stock', 'sales'],
  staff: ['stock', 'schedule_view']
};
var ROLES = { owner: 'Owner', admin: 'Admin', hr: 'HR', manager: 'Manager', staff: 'Staff' };

/** ค่าตั้งต้นที่ใช้ตอนยังไม่ได้ตั้งค่าในหน้าเว็บ */
var SETTING_DEFAULTS = { shiftStart: '07:00', shiftEnd: '16:00', hoursPerDay: 8, lateGrace: 5, otMinMinutes: 30, breakMin: 60, sickPaidDays: 30, personalPaidDays: 3, annualDays: 6, royaltyPct: 3, marketingPct: 3, posRentMonthly: 2000, amortMonths: 72 };
/** การตั้งค่าที่ทุกคนเห็นได้ */
var PUBLIC_SETTINGS = ['shopName', 'theme', 'holidays', 'shiftStart', 'shiftEnd', 'hoursPerDay', 'breakMin', 'lateGrace', 'otMinMinutes', 'sickPaidDays', 'personalPaidDays', 'annualDays'];

/** สาขาแรกและกะเริ่มต้นที่สร้างตอน setup */
var FIRST_BRANCH = { id: 'branch_B01', code: 'B01', name: 'สาขาแรก', status: 'เปิด', radius: 80, maxAccuracy: 100, requireSelfie: 'true' };
var DEFAULT_SHIFTS = [
  { code: 'M', name: 'กะเช้า', start: '07:00', end: '16:00', breakMin: 60, color: '#2F7D55', branch: '' },
  { code: 'L', name: 'กะบ่าย', start: '11:00', end: '20:00', breakMin: 60, color: '#B7791F', branch: '' },
  { code: 'P', name: 'พาร์ทไทม์เย็น', start: '16:00', end: '20:00', breakMin: 0, color: '#5A4A8C', branch: '' }
];


  /* ----- 01_Setup.gs ----- */
/**
 * ขั้นที่ 1: เลือกฟังก์ชัน setup แล้วกด Run (อนุญาตสิทธิ์ครั้งแรก)
 * ระบบจะสร้างโฟลเดอร์ "Amazon Cafe ระบบหลังร้าน" ใน Google Drive และไฟล์ Google Sheet แยกตามระบบ 6 ไฟล์
 * พร้อมสาขาแรก (B01) แก้ชื่อและพิกัดได้ที่เมนู สาขา ในหน้าเว็บ
 * รันซ้ำได้ ไฟล์และข้อมูลเดิมไม่ถูกลบ (จะเติมชีตหรือคอลัมน์ที่ขาดให้)
 */
function setup() {
  rootFolder_();
  Object.keys(BOOKS).forEach(function (k) { book_(k, true); });
  Object.keys(TABLES).forEach(function (t) { sheet_(t); });
  Object.keys(BOOKS).forEach(function (k) { removeBlankDefaultSheet_(book_(k)); });
  if (!readTable_('shifts').length) upsertMany_('shifts', DEFAULT_SHIFTS.map(function (s) { return Object.assign({ id: 'shift_' + s.code, by: 'setup' }, s); }));
  if (!readTable_('branches').length) {
    // อัปเกรดจากรุ่นสาขาเดียว: ใช้พิกัดร้านเดิมเป็นพิกัดของสาขาแรก
    var old = getSettings_(), geo = {};
    ['lat', 'lng', 'radius', 'maxAccuracy', 'requireSelfie', 'investment'].forEach(function (k) { if (old[k] !== undefined && old[k] !== '') geo[k] = old[k]; });
    upsertMany_('branches', [Object.assign({ by: 'setup' }, FIRST_BRANCH, geo)]);
  }
  buildIndex_();
  photoFolder_();
  salt_();
  Logger.log('สร้างไฟล์ครบแล้ว:\n' + Object.keys(BOOKS).map(function (k) { return BOOKS[k].title + '  ' + book_(k).getUrl(); }).join('\n'));
  Logger.log('ขั้นต่อไป: ใส่ตัวเลขใน NEW_OWNER_PIN ด้านล่าง แล้วรัน setOwnerPin');
}

/**
 * ขั้นที่ 2: รหัส Owner (ตัวเลข 4–8 หลัก) ใส่แล้วรัน setOwnerPin จากนั้นลบตัวเลขออก
 * เข้าสู่ระบบด้วยรหัสผู้ใช้ owner และรหัสนี้
 */
var NEW_OWNER_PIN = '';
function setOwnerPin() {
  if (!/^\d{4,8}$/.test(NEW_OWNER_PIN)) throw new Error('ใส่ NEW_OWNER_PIN เป็นตัวเลข 4–8 หลักก่อน');
  PropertiesService.getScriptProperties().setProperty('OWNER_PIN_HASH', hashPin_('owner', NEW_OWNER_PIN));
  CacheService.getScriptCache().remove('fail_owner');
  Logger.log('ตั้งรหัส Owner แล้ว ลบตัวเลขใน NEW_OWNER_PIN ออกจากโค้ดได้เลย');
}

/**
 * ขั้นที่ 3 (ถ้าใช้ LINE): ใส่ Channel access token ที่หน้าเว็บ System > LINE Alerts แล้วรัน testLinePermission ครั้งเดียว
 * เพื่ออนุญาตสิทธิ์ "เชื่อมต่อบริการภายนอก" และ "ตั้งเวลา" จากนั้น Deploy > Manage deployments > New version
 */
function testLinePermission() {
  UrlFetchApp.fetch('https://api.line.me/v2/bot/info', { headers: { Authorization: 'Bearer ' + (lineToken_() || 'x') }, muteHttpExceptions: true });
  Logger.log(installTriggers_());
}

/** ปลดล็อกกรณีใส่รหัสผิดเกินกำหนด */
function unlockLogin() {
  var c = CacheService.getScriptCache();
  c.remove('fail_owner');
  readTable_('employees').forEach(function (e) { c.remove('fail_' + e.id); });
  readTable_('users').forEach(function (u) { c.remove('fail_' + u.id); c.remove('fail_setup_' + u.id); });
  Logger.log('ปลดล็อกแล้ว');
}

/** ลิงก์ไฟล์ทั้งหมด (ดูใน Execution log) */
function showFileLinks() {
  Logger.log(Object.keys(BOOKS).map(function (k) { return BOOKS[k].title + '  ' + book_(k).getUrl(); }).join('\n'));
}

function rootFolder_() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('ROOT_FOLDER_ID');
  if (id) { try { return DriveApp.getFolderById(id); } catch (e) { /* ถูกลบ สร้างใหม่ */ } }
  var f = DriveApp.createFolder(ROOT_FOLDER_NAME);
  props.setProperty('ROOT_FOLDER_ID', f.getId());
  return f;
}

function removeBlankDefaultSheet_(ss) {
  ss.getSheets().forEach(function (sh) {
    if (ss.getSheets().length > 1 && /^(Sheet1|แผ่น1|ชีต1)$/.test(sh.getName()) && sh.getLastRow() === 0) ss.deleteSheet(sh);
  });
}

/** ชีต "สารบัญ" ในไฟล์ระบบหลัก มีลิงก์ไปทุกไฟล์ */
function buildIndex_() {
  var ss = book_('core');
  var sh = ss.getSheetByName('สารบัญ') || ss.insertSheet('สารบัญ', 0);
  sh.clear();
  var rows = [['ระบบ', 'ไฟล์', 'เก็บข้อมูลอะไร', 'ชีตในไฟล์']];
  Object.keys(BOOKS).forEach(function (k) {
    var tabs = Object.keys(TABLES).filter(function (t) { return TABLES[t].book === k; }).map(function (t) { return TABLES[t].tab; });
    rows.push([BOOKS[k].title, '=HYPERLINK("' + book_(k).getUrl() + '","เปิดไฟล์")', BOOKS[k].about, tabs.join(', ')]);
  });
  sh.getRange(1, 1, rows.length, 4).setValues(rows);
  sh.getRange(1, 1, 1, 4).setFontWeight('bold').setBackground('#E8EDE9');
  sh.setColumnWidth(1, 220); sh.setColumnWidth(3, 320); sh.setColumnWidth(4, 360);
  sh.setFrozenRows(1);
  sh.setTabColor(BOOKS.core.color);
}


  /* ----- 02_Api.gs ----- */
/**
 * ประตูรับคำสั่งจากหน้าเว็บ (GitHub Pages)
 * อ่านผ่าน JSONP (GET) / ข้อมูลใหญ่ เช่น รูป หรือบันทึกหลายแถว ส่งผ่าน POST แล้วรับผลด้วย nonce
 */
function doGet(e) {
  var p = (e && e.parameter) || {};
  if (p.action === 'lineAct') return lineActPage_(p);
  var res = handle_(function () { return route_(p); }, p.action);
  var json = JSON.stringify(res);
  if (p.callback && /^[A-Za-z_$][\w$]*$/.test(p.callback)) {
    return ContentService.createTextOutput(p.callback + '(' + json + ')').setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  var p = {};
  if (e && e.parameter && e.parameter.action === 'lineAct') return lineActPage_(e.parameter);
  var raw = (e && e.postData && e.postData.contents) || '';
  if (raw.indexOf('"destination"') >= 0 && raw.indexOf('"events"') >= 0) { try { return lineWebhook_(JSON.parse(raw)); } catch (err) { logError_('lineWebhook', err); return ContentService.createTextOutput('OK'); } }
  var res = handle_(function () {
    p = JSON.parse(raw);
    if (p.op === 'clockPhoto') return saveClockPhoto_(session_(p.t), p);
    return write_(session_(p.t), p);
  }, 'post');
  if (p && p.nonce && /^[\w-]{6,40}$/.test(p.nonce)) {
    var s = JSON.stringify(res);
    if (s.length > 95000) s = JSON.stringify({ ok: res.ok, error: res.error, data: res.ok ? { count: res.data && res.data.count } : null });
    CacheService.getScriptCache().put('n_' + p.nonce, s, 600);
  }
  return ContentService.createTextOutput(JSON.stringify(res)).setMimeType(ContentService.MimeType.JSON);
}

function handle_(fn, action) {
  try { return { ok: true, data: fn() }; }
  catch (err) {
    if (!err || !err.user) logError_(action, err);
    return { ok: false, error: String((err && err.message) || err), code: (err && err.code) || '' };
  }
}

/** ข้อความเตือนผู้ใช้ (ไม่ใช่ข้อผิดพลาดของระบบ จึงไม่ถูกบันทึกเป็น ERROR) */
function fail_(msg, code) { var e = new Error(msg); e.user = true; if (code) e.code = code; throw e; }

function route_(p) {
  switch (p.action) {
    case 'ping': return { time: Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm:ss') };
    case 'staff': return staffPublic_(p.branch);
    case 'login': return login_(p);
    case 'setupPin': return setupPin_(p);
    case 'logout': return logout_(p.t);
    case 'me': return sessionInfo_(session_(p.t));
    case 'bootstrap': return bootstrap_(session_(p.t));
    case 'write': return write_(session_(p.t), JSON.parse(p.p));
    case 'nonce': {
      session_(p.t);
      var v = CacheService.getScriptCache().get('n_' + p.nonce);
      if (!v) fail_('ไม่พบผลการบันทึก ลองกดบันทึกอีกครั้ง');
      var r = JSON.parse(v);
      if (!r.ok) fail_(r.error, r.code);
      return r.data;
    }
    case 'clock': return clock_(session_(p.t), p);
    case 'my': return my_(session_(p.t));
    case 'myRequest': return myRequest_(session_(p.t), JSON.parse(p.p));
    case 'photo': { var s = session_(p.t); requirePerm_(s, ['time', 'approve_time']); return getPhoto_(p.id); }
    case 'adminHealth': return healthCheck_(session_(p.t));
    case 'lineStatus': return lineStatus_(session_(p.t));
    case 'lineLinkCode': return lineLinkCode_(session_(p.t), p.ref);
    case 'myLine': return myLine_(session_(p.t));
    default: fail_('ไม่รู้จักคำสั่ง: ' + p.action);
  }
}

/**
 * ข้อมูลตั้งต้นตามสิทธิ์และสาขาของผู้ใช้
 * ตารางที่ไม่มีสิทธิ์ และแถวของสาขาที่ไม่ได้ดูแล จะไม่ถูกส่งออกจาก Google เลย
 */
function bootstrap_(sess) {
  var perms = permsOf_(sess);
  var tables = {}, empB = empBranches_();
  Object.keys(TABLES).forEach(function (t) {
    var def = TABLES[t];
    if (t === 'settings' || t === 'employees' || t === 'log' || t === 'branches' || t === 'users' || t === 'notify') return;
    if (hasAny_(perms, def.read)) tables[t] = scopeRows_(sess, t, readTable_(t), empB);
  });
  if (hasAny_(perms, ['users'])) tables.users = [ownerRow_()].concat(usersAll_().map(stripUser_));
  var full = hasAny_(perms, ['hr']);
  var acct = {};
  if (full) usersAll_().forEach(function (u) { if (u.empId) acct[u.empId] = u.username + (u.pinHash ? '' : ' (รอตั้ง PIN)'); });
  tables.employees = readTable_('employees').map(function (e) { var o = full && inScope_(sess, e.branch) ? stripEmp_(e) : publicEmp_(e); if (full && acct[e.id]) o.account = acct[e.id]; return o; });
  tables.branches = hasAny_(perms, ['settings']) ? branchesAll_() : branchesAll_().map(branchPublic_);
  if (hasAny_(perms, ['settings', 'admin'])) tables.log = readTable_('log').slice(-500);
  var st = getSettings_();
  if (!hasAny_(perms, ['settings'])) {
    var pub = {};
    PUBLIC_SETTINGS.forEach(function (k) { if (st[k] !== undefined) pub[k] = st[k]; });
    st = pub;
  }
  return { me: sessionInfo_(sess), settings: st, tables: tables, permList: PERMS, books: hasAny_(perms, ['settings']) ? bookLinks_() : null };
}

/** บันทึกข้อมูล: ตรวจสิทธิ์ของตาราง แล้วผ่านกฎของแต่ละระบบก่อนเขียน */
function write_(sess, p) {
  if (p.op === 'saveSettings') {
    requirePerm_(sess, ['settings']);
    var n = saveSettings_(p.row || {});
    log_(sess, 'แก้การตั้งค่า', 'settings', n + ' รายการ');
    return { count: n };
  }
  if (p.op === 'saveSetting') {
    // แก้ค่าบางรายการ (ไม่ต้องส่งทั้งหมด) เช่น ดีไซน์ และการแจ้งเตือน LINE
    var allow = { theme: ['settings'], webUrl: ['settings', 'admin'], lineApprovals: ['settings', 'admin'], lineClock: ['settings', 'admin'], lineDaily: ['settings', 'admin'], lineDailyHour: ['settings', 'admin'], lineRequirePin: ['settings', 'admin'] };
    var cur = getSettings_(), keys = Object.keys(p.row || {});
    keys.forEach(function (k) { if (!allow[k]) fail_('แก้ค่า ' + k + ' ที่นี่ไม่ได้'); requirePerm_(sess, allow[k]); cur[k] = p.row[k]; });
    if (cur.theme && String(cur.theme).length > 48000) fail_('รูปโลโก้ใหญ่เกินไป ใช้รูปเล็กกว่านี้');
    saveSettings_(cur);
    log_(sess, 'แก้การตั้งค่า', 'settings', keys.join(', '));
    if (keys.some(function (k) { return k === 'lineDaily' || k === 'lineDailyHour'; })) { try { installTriggers_(); } catch (e) { logError_('installTriggers', e, sess); } }
    return { count: keys.length };
  }
  if (p.op === 'adminFix') return adminFix_(sess, p.code, p.args);
  if (p.op === 'lineToken') return saveLineToken_(sess, p.token);
  if (p.op === 'lineTest') return lineTest_(sess, p.ref);
  if (p.op === 'myLine') return saveMyLine_(sess, p.row || {});
  if (p.op === 'ownerProfile') return saveOwnerProfile_(sess, p.row || {});
  if (p.op === 'changePin') return changePin_(sess, p);
  if (p.op === 'resetUserPin') return resetUserPin_(sess, p.id);
  var def = TABLES[p.table];
  if (!def || p.table === 'settings' || p.table === 'log' || p.table === 'notify') fail_('ไม่มีตาราง ' + p.table);
  requirePerm_(sess, def.write);
  if (p.op === 'remove') {
    guardScopeRemove_(sess, p.table, p.id);
    var rg = removeGuards_()[p.table];
    if (rg) rg(sess, p.id);
    var ok = remove_(p.table, p.id);
    log_(sess, 'ลบ', p.table, p.id);
    return { removed: ok };
  }
  if (p.op !== 'upsertMany') fail_('ไม่รู้จักคำสั่งบันทึก: ' + p.op);
  var rows = (p.rows || []).map(function (r) { return Object.assign({}, r); });
  rows.forEach(function (r) { if (!r.id) r.id = Utilities.getUuid(); r.by = sess.name; });
  guardScope_(sess, p.table, rows);
  var oldRows = APPROVE_FIELDS[p.table] ? byId_(readTable_(p.table)) : null;
  var g = writeGuards_()[p.table];
  if (g) rows = g(sess, rows);
  var count = upsertMany_(p.table, rows);
  var after = afterWrite_()[p.table];
  var extra = after ? after(sess, rows) : null;
  if (oldRows) afterWriteNotify_(p.table, rows, oldRows);
  log_(sess, 'บันทึก', p.table, count + ' แถว' + (rows.length === 1 ? ' ' + String(rows[0].id).slice(0, 24) : ''));
  var out = p.table === 'employees' ? rows.map(stripEmp_) : p.table === 'users' ? rows.map(stripUser_) : rows;
  return { count: count, rows: out, extra: extra };
}

/** กฎก่อนบันทึกของแต่ละระบบ (อยู่ในไฟล์ของระบบนั้น) */
function writeGuards_() {
  return { employees: guardEmployees_, attendance: guardAttendance_, leaves: guardLeaves_, timefix: guardTimefix_, moves: guardMoves_, branches: guardBranches_, schedule: guardSchedule_, patterns: guardPatterns_, staffing: guardStaffing_, shifts: guardShifts_, users: guardUsers_ };
}
function removeGuards_() {
  return { moves: guardRemoveMove_, employees: guardRemoveEmployee_, branches: guardRemoveBranch_, users: guardRemoveUser_ };
}
/** สิ่งที่ต้องทำต่อหลังบันทึก เช่น ตารางงานเปลี่ยน ให้คำนวณเวลาทำงานใหม่ */
function afterWrite_() {
  return { schedule: afterSchedule_, shifts: afterShifts_, timefix: afterTimefix_, patterns: afterPatterns_ };
}

function bookLinks_() {
  var out = {};
  Object.keys(BOOKS).forEach(function (k) {
    var id = PropertiesService.getScriptProperties().getProperty('BOOK_' + k);
    out[k] = { title: BOOKS[k].title, url: id ? 'https://docs.google.com/spreadsheets/d/' + id + '/edit' : '' };
  });
  return out;
}


  /* ----- 03_Calc.gs ----- */
/**
 * สูตรกลางของระบบเวลาทำงาน ใช้ร่วมกัน 2 ที่:
 *   apps-script/03_Calc.gs  (ฝั่ง Google)
 *   js/calc.js              (หน้าเว็บ)
 * สองไฟล์นี้ต้องเหมือนกันทุกตัวอักษร ถ้าแก้สูตร ให้คัดลอกทั้งไฟล์ไปวางอีกที่
 */
var Calc = (function () {
  function num(v) { var n = parseFloat(v); return isFinite(n) ? n : 0; }
  function bool(v) { return v === true || v === 'true' || v === 'TRUE' || v === 1 || v === '1'; }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function toMin(t) {
    if (t === null || t === undefined || t === '') return null;
    var p = String(t).split(':');
    var h = Number(p[0]), m = Number(p[1] || 0);
    return p[0] !== '' && isFinite(h) && isFinite(m) ? h * 60 + m : null;
  }
  function minToHM(m) { m = ((Math.round(m) % 1440) + 1440) % 1440; return pad(Math.floor(m / 60)) + ':' + pad(m % 60); }
  function ymdParts(d) { var p = String(d).split('-'); return [Number(p[0]), Number(p[1]), Number(p[2])]; }
  function weekday(d) { var p = ymdParts(d); return new Date(Date.UTC(p[0], p[1] - 1, p[2])).getUTCDay(); }
  function addDays(d, n) {
    var p = ymdParts(d), x = new Date(Date.UTC(p[0], p[1] - 1, p[2] + n));
    return x.getUTCFullYear() + '-' + pad(x.getUTCMonth() + 1) + '-' + pad(x.getUTCDate());
  }
  function daysInMonth(m) { var p = String(m).split('-'); return new Date(Date.UTC(Number(p[0]), Number(p[1]), 0)).getUTCDate(); }
  function upper(s) { return String(s || '').trim().toUpperCase(); }

  /** วันหยุดตามประเพณีจากการตั้งค่า (บรรทัดละวัน ขึ้นต้นด้วย yyyy-mm-dd) */
  function holidayMap(st) {
    var out = {};
    String((st && st.holidays) || '').split('\n').forEach(function (l) {
      var d = l.trim().slice(0, 10);
      if (/^\d{4}-\d{2}-\d{2}$/.test(d)) out[d] = l.trim().slice(10).trim() || 'วันหยุด';
    });
    return out;
  }
  function shiftIndex(shifts) { var o = {}; (shifts || []).forEach(function (s) { if (s.code) o[upper(s.code)] = s; }); return o; }
  function scheduleIndex(rows) { var o = {}; (rows || []).forEach(function (r) { if (r.date && r.empId) o[r.date + '|' + r.empId] = r; }); return o; }
  function isOffCode(code) { var c = upper(code); return c === 'OFF' || c === 'หยุด' || c === 'X'; }

  function patternIndex(rows) { var o = {}; (rows || []).forEach(function (r) { if (r.empId) o[r.empId] = r; }); return o; }

  /**
   * แผนงานของพนักงานในวันหนึ่ง เรียงลำดับความสำคัญ:
   * 1) ตารางงานของวันนั้น  2) รูปแบบกะรายสัปดาห์ของพนักงาน  3) เวลาตั้งต้นของร้าน
   * ctx = { sched: scheduleIndex(), patterns: patternIndex(), shifts: shiftIndex(), hol: holidayMap(), st: settings }
   * ผลลัพธ์มี branch = สาขาที่ทำงานวันนั้น (ตารางงานกำหนดสาขาอื่นได้ เช่น ยืมตัว)
   */
  function planFor(emp, date, ctx) {
    var st = ctx.st || {}, hol = ctx.hol || {};
    var row = ctx.sched[date + '|' + emp.id];
    var base = { date: date, pubHoliday: hol[date] || '', branch: (row && row.branch) || emp.branch || '' };
    function make(o) { for (var k in o) base[k] = o[k]; return base; }
    function fromShift(code, source, note) {
      if (isOffCode(code)) return make({ code: 'OFF', name: 'วันหยุด', off: true, source: source, note: note || '' });
      var s = ctx.shifts[code];
      return s ? make({ code: code, name: s.name || code, start: s.start, end: s.end, breakMin: s.breakMin, off: false, source: source, note: note || '' }) : null;
    }
    if (row && row.shift !== undefined && String(row.shift).trim() !== '') {
      var code = upper(row.shift);
      if (!isOffCode(code) && row.start && row.end) return make({ code: code, name: 'กำหนดเวลาเอง', start: row.start, end: row.end, breakMin: row.breakMin, off: false, source: 'ตารางงาน', note: row.note || '' });
      var r1 = fromShift(code, 'ตารางงาน', row.note);
      if (r1) return r1;
    }
    var pat = ctx.patterns && ctx.patterns[emp.id];
    var pc = pat ? upper(pat['d' + weekday(date)]) : '';
    if (pc) { var r2 = fromShift(pc, 'รูปแบบกะ'); if (r2) return r2; }
    return make({ code: '', name: 'เวลาปกติของร้าน', start: st.shiftStart || '07:00', end: st.shiftEnd || '16:00', breakMin: st.breakMin, off: false, source: 'ค่าตั้งต้น' });
  }

  /** ชั่วโมงตามแผน (หักพักถ้ากะยาวเกิน 5 ชม.) */
  function planMinutes(plan, st) {
    if (!plan || plan.off) return 0;
    var s = toMin(plan.start), e = toMin(plan.end);
    if (s === null || e === null) return 0;
    var len = ((e - s + 1440) % 1440) || 1440;
    var brk = plan.breakMin === undefined || plan.breakMin === null || plan.breakMin === '' ? num(st && st.breakMin) : num(plan.breakMin);
    return Math.max(0, len - (len > 300 ? brk : 0));
  }

  /** สาย ชั่วโมงทำงาน และ OT ของการลงเวลา 1 ครั้ง เทียบกับแผนของวันนั้น */
  function calcAtt(rec, plan, st) {
    st = st || {};
    var out = { lateMin: 0, workMin: 0, otMin: 0 };
    var i = toMin(rec.inTime), o0 = toMin(rec.outTime);
    if (i === null) return out;
    var brk = plan.breakMin === undefined || plan.breakMin === null || plan.breakMin === '' ? num(st.breakMin) : num(plan.breakMin);
    var otMinMin = st.otMinMinutes === '' || st.otMinMinutes === undefined || st.otMinMinutes === null ? 30 : num(st.otMinMinutes);
    var hpd = num(st.hoursPerDay) || 8;
    var s = toMin(plan.start), e = toMin(plan.end);
    if (plan.off || s === null) {
      if (o0 === null) return out;
      var oo = o0 < i ? o0 + 1440 : o0, sp = oo - i;
      out.workMin = Math.max(0, sp - (sp > 300 ? brk : 0));
      var extra = out.workMin - hpd * 60;
      out.otMin = plan.off && extra > 0 && extra >= otMinMin ? Math.floor(extra / 15) * 15 : 0;
      return out;
    }
    var sAbs = s;
    if (i - s > 720) sAbs += 1440; else if (s - i > 720) sAbs -= 1440;
    var late = i - sAbs;
    out.lateMin = late > num(st.lateGrace) ? late : 0;
    if (o0 === null) return out;
    var o = o0; if (o < i) o += 1440;
    var span = o - i;
    out.workMin = Math.max(0, span - (span > 300 ? brk : 0));
    var len = e === null ? 540 : (((e - s + 1440) % 1440) || 1440);
    var otRaw = o - (sAbs + len);
    out.otMin = otRaw > 0 && otRaw >= otMinMin ? Math.floor(otRaw / 15) * 15 : 0;
    return out;
  }

  /** ใส่แผนและผลคำนวณลงในรายการลงเวลา (คงสถานะอนุมัติเดิมไว้) */
  function applyPlan(rec, plan, st) {
    var r = calcAtt(rec, plan, st);
    if (!rec.branch) rec.branch = plan.branch || '';
    rec.planCode = plan.code || '';
    rec.planStart = plan.off ? '' : (plan.start || '');
    rec.planEnd = plan.off ? '' : (plan.end || '');
    rec.offWork = plan.off ? 'true' : 'false';
    rec.holiday = plan.off || plan.pubHoliday ? 'true' : 'false';
    rec.lateMin = r.lateMin; rec.workMin = r.workMin; rec.otMin = r.otMin;
    var decided = function (s) { return s === 'อนุมัติ' || s === 'ไม่อนุมัติ'; };
    rec.otStatus = r.otMin > 0 ? (decided(rec.otStatus) ? rec.otStatus : 'รออนุมัติ') : '';
    rec.offStatus = plan.off ? (decided(rec.offStatus) ? rec.offStatus : 'รออนุมัติ') : '';
    return rec;
  }

  /** จำนวนวันระหว่างสองวัน (นับทั้งสองฝั่ง) */
  function dayCount(from, to) {
    var a = ymdParts(from), b = ymdParts(to || from);
    return Math.round((Date.UTC(b[0], b[1] - 1, b[2]) - Date.UTC(a[0], a[1] - 1, a[2])) / 86400000) + 1;
  }

  return {
    num: num, bool: bool, pad: pad, toMin: toMin, minToHM: minToHM, weekday: weekday, addDays: addDays, daysInMonth: daysInMonth,
    upper: upper, holidayMap: holidayMap, shiftIndex: shiftIndex, scheduleIndex: scheduleIndex, patternIndex: patternIndex, isOffCode: isOffCode,
    planFor: planFor, planMinutes: planMinutes, calcAtt: calcAtt, applyPlan: applyPlan, dayCount: dayCount
  };
})();


  /* ----- 04_Db.gs ----- */
/**
 * อ่าน/เขียนชีตข้ามไฟล์ ทุกเซลล์เก็บเป็นข้อความ (กันชีตแปลงวันที่ เวลา และเบอร์โทรเอง)
 * แถว 1 = ชื่อภาษาไทย, แถว 2 = ชื่อคอลัมน์ที่ระบบใช้, ข้อมูลเริ่มแถว 3
 */
var _bookCache = {};

function book_(key, create) {
  if (_bookCache[key]) return _bookCache[key];
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('BOOK_' + key);
  var ss = null;
  if (id) { try { ss = SpreadsheetApp.openById(id); } catch (e) { ss = null; } }
  if (!ss) {
    if (!create) fail_('ยังไม่ได้สร้างไฟล์ ' + (BOOKS[key] ? BOOKS[key].title : key) + ' ให้รัน setup ใน Apps Script ก่อน');
    ss = SpreadsheetApp.create(BOOKS[key].title);
    props.setProperty('BOOK_' + key, ss.getId());
    try { DriveApp.getFileById(ss.getId()).moveTo(rootFolder_()); } catch (e) { /* ย้ายไม่ได้ก็ใช้งานได้ตามปกติ */ }
  }
  _bookCache[key] = ss;
  return ss;
}

function sheet_(table) {
  var def = TABLES[table];
  if (!def) fail_('ไม่มีตาราง ' + table);
  var ss = book_(def.book, true);
  var sh = ss.getSheetByName(def.tab);
  if (!sh) {
    sh = ss.insertSheet(def.tab);
    var keys = def.cols.map(function (c) { return c[0]; }), labels = def.cols.map(function (c) { return c[1]; });
    sh.getRange(1, 1, sh.getMaxRows(), Math.max(sh.getMaxColumns(), keys.length)).setNumberFormat('@');
    sh.getRange(1, 1, 2, keys.length).setValues([labels, keys]);
    sh.getRange(1, 1, 1, keys.length).setFontWeight('bold').setBackground(BOOKS[def.book].color).setFontColor('#FFFFFF');
    sh.getRange(2, 1, 1, keys.length).setFontColor('#8A948E').setFontSize(8).setBackground('#F3F5F3');
    sh.setFrozenRows(HEADER_ROWS);
    sh.setTabColor(BOOKS[def.book].color);
  } else {
    var have = keysOf_(sh);
    var miss = def.cols.filter(function (c) { return have.indexOf(c[0]) < 0; });
    if (miss.length) {
      var at = have.length + 1;
      sh.getRange(1, at, 2, miss.length).setValues([miss.map(function (c) { return c[1]; }), miss.map(function (c) { return c[0]; })]);
    }
  }
  return sh;
}

function keysOf_(sh) {
  var c = sh.getLastColumn();
  return c && sh.getLastRow() >= 2 ? sh.getRange(2, 1, 1, c).getDisplayValues()[0] : [];
}

function cell_(v) {
  if (v === null || v === undefined) return '';
  return typeof v === 'object' ? JSON.stringify(v) : String(v);
}

function readTable_(table) {
  var sh = sheet_(table);
  var last = sh.getLastRow(), cols = sh.getLastColumn();
  if (last <= HEADER_ROWS || !cols) return [];
  var v = sh.getRange(2, 1, last - 1, cols).getDisplayValues();
  var keys = v[0];
  return v.slice(1).filter(function (r) { return r[0] !== ''; }).map(function (r) {
    var o = {};
    keys.forEach(function (k, i) { if (k) o[k] = r[i]; });
    return o;
  });
}

function upsertMany_(table, rows) {
  var uniq = {};
  rows.forEach(function (r) { if (!r.id) r.id = Utilities.getUuid(); uniq[String(r.id)] = r; });
  rows = Object.keys(uniq).map(function (k) { return uniq[k]; });
  rows.forEach(function (r) {
    Object.keys(r).forEach(function (k) {
      if (typeof r[k] === 'string' && r[k].length > 49000) fail_('ข้อมูลช่อง ' + k + ' ยาวเกินที่ชีตเก็บได้ (รูปใหญ่เกินไป)');
    });
  });
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var sh = sheet_(table);
    var keys = keysOf_(sh);
    var need = { updatedAt: 1 };
    rows.forEach(function (r) { Object.keys(r).forEach(function (k) { need[k] = 1; }); });
    var missing = Object.keys(need).filter(function (k) { return keys.indexOf(k) < 0; });
    if (missing.length) {
      sh.getRange(1, keys.length + 1, 2, missing.length).setValues([missing, missing]);
      keys = keys.concat(missing);
    }
    var last = sh.getLastRow();
    var data = last > HEADER_ROWS ? sh.getRange(HEADER_ROWS + 1, 1, last - HEADER_ROWS, keys.length).getDisplayValues() : [];
    var index = {};
    data.forEach(function (r, i) { index[String(r[0])] = i; });
    var now = new Date().toISOString();
    var appended = [];
    rows.forEach(function (row) {
      row.updatedAt = now;
      var i = index[String(row.id)];
      var base = i !== undefined ? data[i] : keys.map(function () { return ''; });
      var out = keys.map(function (k, c) { return Object.prototype.hasOwnProperty.call(row, k) ? cell_(row[k]) : base[c]; });
      if (i !== undefined) { sh.getRange(i + HEADER_ROWS + 1, 1, 1, keys.length).setNumberFormat('@').setValues([out]); data[i] = out; }
      else { appended.push(out); index[String(row.id)] = -1; }
    });
    if (appended.length) sh.getRange(Math.max(last, HEADER_ROWS) + 1, 1, appended.length, keys.length).setNumberFormat('@').setValues(appended);
    return rows.length;
  } finally {
    lock.releaseLock();
  }
}

function remove_(table, id) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var sh = sheet_(table), last = sh.getLastRow();
    if (last <= HEADER_ROWS) return false;
    var ids = sh.getRange(HEADER_ROWS + 1, 1, last - HEADER_ROWS, 1).getDisplayValues().map(function (r) { return r[0]; });
    var i = ids.indexOf(String(id));
    if (i < 0) return false;
    sh.deleteRow(i + HEADER_ROWS + 1);
    return true;
  } finally {
    lock.releaseLock();
  }
}

function getSettings_() {
  var cache = CacheService.getScriptCache();
  var c = cache.get('settings');
  if (c) return JSON.parse(c);
  var o = {};
  readTable_('settings').forEach(function (r) { if (r.key) o[r.key] = r.value; });
  Object.keys(SETTING_DEFAULTS).forEach(function (k) { if (o[k] === undefined || o[k] === '') o[k] = String(SETTING_DEFAULTS[k]); });
  try { cache.put('settings', JSON.stringify(o), 300); } catch (e) { /* ใหญ่เกิน cache ก็อ่านจากชีตทุกครั้ง */ }
  return o;
}

function saveSettings_(obj) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var sh = sheet_('settings');
    var rows = Object.keys(obj).filter(function (k) { return ['apiUrl', 'hasGeo'].indexOf(k) < 0; }).map(function (k) { return [k, cell_(obj[k])]; });
    if (sh.getLastRow() > HEADER_ROWS) sh.getRange(HEADER_ROWS + 1, 1, sh.getLastRow() - HEADER_ROWS, 2).clearContent();
    if (rows.length) sh.getRange(HEADER_ROWS + 1, 1, rows.length, 2).setNumberFormat('@').setValues(rows);
    CacheService.getScriptCache().remove('settings');
    return rows.length;
  } finally {
    lock.releaseLock();
  }
}

/** บันทึกการใช้งาน (Audit log) เก็บล่าสุดราว 5,000 รายการ ระบุบัญชีผู้ใช้และช่องทาง (web / clock / LINE / system) */
function log_(sess, action, table, detail) {
  try {
    var sh = sheet_('log');
    sh.appendRow([Utilities.getUuid().slice(0, 8), Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm:ss'), (sess && sess.name) || '-', (sess && ROLES[sess.role]) || '-', action, (TABLES[table] && TABLES[table].tab) || table || '', String(detail || '').slice(0, 1000), (sess && sess.code) || '', (sess && sess.via) || 'web']);
    if (sh.getLastRow() > 5200) sh.deleteRows(HEADER_ROWS + 1, 1000);
  } catch (e) { /* บันทึก log ไม่ได้ไม่ควรทำให้งานหลักล้ม */ }
}


  /* ----- 05_Auth.gs ----- */
/**
 * เข้าสู่ระบบด้วย ชื่อผู้ใช้ (Users ที่ Owner สร้าง) หรือรหัสพนักงาน + PIN (บัญชีหลักของ Owner ใช้ owner)
 * พนักงานที่มีบัญชีผู้ใช้ผูกอยู่ ใช้ PIN ที่เจ้าตัวตั้งเอง (15_Account.gs) ทั้งหลังร้านและหน้าลงเวลา log จึงขึ้นชื่อผู้ใช้ เช่น staff_aabb
 * PIN เก็บแบบเข้ารหัสทางเดียว (SHA-256 + salt) ไม่มีใครเปิดดู PIN จริงในชีตได้
 * สิทธิ์ตรวจที่ฝั่ง Google ทุกคำสั่ง หน้าเว็บซ่อนเมนูเพื่อความสะดวกเท่านั้น
 */
function salt_() {
  var props = PropertiesService.getScriptProperties();
  var s = props.getProperty('PIN_SALT');
  if (!s) { s = Utilities.getUuid(); props.setProperty('PIN_SALT', s); }
  return s;
}

function hashPin_(empId, pin) {
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, salt_() + '|' + empId + '|' + pin, Utilities.Charset.UTF_8);
  return Utilities.base64Encode(bytes);
}

function normRole_(r) { r = String(r || '').toLowerCase(); return ROLES[r] ? r : 'staff'; }

function login_(p) {
  var pin = String(p.pin || '').trim();
  if (!/^\d{4,8}$/.test(pin)) fail_('ใส่ PIN เป็นตัวเลข 4–8 หลัก');
  var cache = CacheService.getScriptCache();
  var code = String(p.code || '').trim();
  var sess;
  if (!p.empId && code.toLowerCase() === 'owner') {
    var h = PropertiesService.getScriptProperties().getProperty('OWNER_PIN_HASH');
    if (!h) fail_('ยังไม่ได้ตั้งรหัส Owner: รัน setOwnerPin ใน Apps Script');
    var f = Number(cache.get('fail_owner') || 0);
    if (f >= 10) fail_('ใส่รหัสผิดหลายครั้ง ระบบล็อก 15 นาที');
    if (hashPin_('owner', pin) !== h) { cache.put('fail_owner', String(f + 1), 900); fail_('รหัสผู้ใช้หรือ PIN ไม่ถูกต้อง'); }
    cache.remove('fail_owner');
    sess = ownerSession_();
  } else if (!p.empId && userByName_(code)) {
    sess = userLogin_(userByName_(code), pin);
  } else {
    var emps = readTable_('employees');
    var emp = p.empId ? emps.filter(function (e) { return e.id === p.empId; })[0]
      : emps.filter(function (e) { return String(e.code).toLowerCase() === code.toLowerCase(); })[0];
    if (!emp || emp.status === 'ลาออก') fail_('ไม่พบรหัสพนักงานนี้ หรือพนักงานลาออกแล้ว');
    var linked = linkedUser_(emp);
    if (linked) sess = userLogin_(linked, pin);
    else { checkPin_(emp, pin); sess = empSession_(emp); }
  }
  sess.ep = sessionEpoch_();
  var token = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '').slice(0, 8);
  cache.put('s_' + token, JSON.stringify(sess), SESSION_SECONDS);
  if (!p.quiet) log_(sess, 'เข้าสู่ระบบ', '', p.from || '');
  var info = sessionInfo_(sess);
  info.token = token;
  return info;
}

function empSession_(emp) {
  var role = normRole_(emp.role);
  return { role: role, empId: emp.id, name: emp.nickname || emp.firstName || emp.code, code: emp.code, branch: emp.branch || '', scope: scopeFor_(role, emp) };
}
function ownerSession_() {
  var pr = ownerProfile_();
  return { role: 'owner', empId: '', uid: 'owner', name: pr.name || 'Owner', code: 'owner', branch: '', scope: '*' };
}
/** เปลี่ยนเลขนี้ = ทุกคนต้องเข้าสู่ระบบใหม่ (ใช้ในหน้า Admin) */
function sessionEpoch_() { return PropertiesService.getScriptProperties().getProperty('SESSION_EPOCH') || '1'; }

function checkPin_(emp, pin) {
  var cache = CacheService.getScriptCache(), key = 'fail_' + emp.id;
  var f = Number(cache.get(key) || 0);
  if (f >= 5) fail_('ใส่ PIN ผิดหลายครั้ง รอ 10 นาทีแล้วลองใหม่ หรือแจ้ง Owner/Admin');
  if (!emp.pinHash) fail_('ยังไม่ได้ตั้ง PIN ให้บัญชีนี้ แจ้ง Owner/Admin');
  if (hashPin_(emp.id, pin) !== emp.pinHash) { cache.put(key, String(f + 1), 600); fail_('PIN ไม่ถูกต้อง'); }
  cache.remove(key);
}

function logout_(t) { if (t) CacheService.getScriptCache().remove('s_' + t); return true; }

function session_(t) {
  if (!t) fail_('กรุณาเข้าสู่ระบบ', 'SESSION');
  var cache = CacheService.getScriptCache();
  var v = cache.get('s_' + t);
  if (!v) fail_('หมดเวลาการใช้งาน กรุณาเข้าสู่ระบบใหม่', 'SESSION');
  var sess = JSON.parse(v);
  if (String(sess.ep || '1') !== sessionEpoch_()) { cache.remove('s_' + t); fail_('Admin ให้ทุกคนออกจากระบบ กรุณาเข้าสู่ระบบใหม่', 'SESSION'); }
  cache.put('s_' + t, v, SESSION_SECONDS);
  sess.token = t;
  return sess;
}

function sessionInfo_(sess) {
  return { role: sess.role, roleName: ROLES[sess.role], name: sess.name, empId: sess.empId, uid: sess.uid || '', code: sess.code, branch: sess.branch || '', scope: sess.scope || [], perms: permsOf_(sess), version: APP_VERSION };
}

/** สิทธิ์ของผู้ใช้: บัญชีที่ Owner ตั้ง "สิทธิ์เฉพาะคน" ไว้ ใช้ตามนั้น ไม่งั้นใช้ตาม Role */
function permsOf_(sess) {
  if (!sess) return [];
  if (sess.role === 'owner') return permsFor_('owner');
  if (sess.perms && sess.perms.length) {
    var ownerOnly = PERMS.filter(function (x) { return x[2]; }).map(function (x) { return x[0]; });
    return sess.perms.filter(function (k) { return ownerOnly.indexOf(k) < 0 && PERMS.some(function (x) { return x[0] === k; }); });
  }
  return permsFor_(sess.role);
}

/** สิทธิ์ของแต่ละ Role: Owner ได้ทุกอย่าง Role อื่นตามที่ Owner ตั้งในหน้า Settings > Permissions */
function permsFor_(role) {
  if (role === 'owner') return PERMS.map(function (x) { return x[0]; });
  var stored = {};
  try { stored = JSON.parse(getSettings_().perms || '{}'); } catch (e) { stored = {}; }
  var list = stored[role] || DEFAULT_PERMS[role] || [];
  var ownerOnly = PERMS.filter(function (x) { return x[2]; }).map(function (x) { return x[0]; });
  return list.filter(function (k) { return ownerOnly.indexOf(k) < 0 && PERMS.some(function (x) { return x[0] === k; }); });
}

function hasAny_(perms, keys) {
  if (!keys) return false;
  if (keys.indexOf('*') >= 0) return true;
  return keys.some(function (k) { return perms.indexOf(k) >= 0; });
}

function can_(sess, keys) { return hasAny_(permsOf_(sess), keys); }

function requirePerm_(sess, keys) {
  if (!can_(sess, keys)) fail_('บัญชี ' + sess.name + ' (' + ROLES[sess.role] + ') ไม่มีสิทธิ์ทำรายการนี้', 'PERM');
}


  /* ----- 06_HR.gs ----- */
/** กฎข้อมูลพนักงาน: ตั้ง PIN แบบเข้ารหัส รหัสพนักงานห้ามซ้ำ สาขาประจำ สิทธิ์ใช้งาน และข้อมูลที่คนทั่วไปเห็นได้ */

/** ข้อมูลพนักงานที่ทุกคนเห็นได้ (ใช้แสดงชื่อในตารางงานและสต็อก) ไม่มีค่าจ้าง บัตรประชาชน บัญชีธนาคาร */
function publicEmp_(e) {
  return { id: e.id, code: e.code, role: normRole_(e.role), branch: e.branch || '', firstName: e.firstName, nickname: e.nickname, position: e.position, status: e.status, startDate: e.startDate, endDate: e.endDate };
}

/** ข้อมูลเต็มสำหรับผู้มีสิทธิ์ HR (ตัด PIN ออก บอกแค่ว่าตั้งแล้วหรือยัง) */
function stripEmp_(e) {
  var o = Object.assign({}, e);
  o.hasPin = !!e.pinHash;
  delete o.pinHash; delete o.pin;
  return o;
}

function guardEmployees_(sess, rows) {
  var all = readTable_('employees'), old = byId_(all), codes = {};
  branchesAll_().forEach(function (b) { codes[b.code] = 1; });
  rows.forEach(function (r) {
    var o = old[r.id];
    if (sess.role !== 'owner') {
      if (o && normRole_(o.role) === 'owner') fail_('แก้ข้อมูลบัญชีระดับ Owner ได้เฉพาะ Owner', 'PERM');
      if (r.role !== undefined && normRole_(r.role) === 'owner') fail_('ให้สิทธิ์ระดับ Owner ได้เฉพาะ Owner', 'PERM');
      if (r.role !== undefined && normRole_(r.role) === 'hr' && sess.scope !== '*' && (!o || normRole_(o.role) !== 'hr')) fail_('ตั้งคนเป็น HR ได้เฉพาะคนที่ดูแลทุกสาขา', 'PERM');
      if (o && o.id === sess.empId && ((r.role !== undefined && normRole_(r.role) !== normRole_(o.role)) || (r.branchAccess !== undefined && r.branchAccess !== (o.branchAccess || '')))) fail_('เปลี่ยนสิทธิ์หรือสาขาที่ดูแลของตัวเองไม่ได้', 'PERM');
    }
    if (r.branch !== undefined && r.branch && !codes[r.branch]) fail_('ไม่พบสาขา ' + r.branch);
    if (r.branchAccess !== undefined) {
      var acc = String(r.branchAccess || '').trim();
      r.branchAccess = acc === '*' ? '*' : acc.split(/[,\s]+/).filter(function (c) { return c && codes[c]; }).join(',');
      var grant = r.branchAccess === '*' ? ['*'] : r.branchAccess.split(',').filter(function (c) { return c; });
      if (sess.scope !== '*' && grant.some(function (c) { return !inScope_(sess, c); })) fail_('ให้สิทธิ์ดูแลสาขาที่คุณเองไม่ได้ดูแลไม่ได้', 'PERM');
    }
    if (r.code !== undefined) {
      r.code = String(r.code).trim();
      if (!r.code) fail_('ใส่รหัสพนักงาน');
      if (r.code.toLowerCase() === 'owner') fail_('รหัส owner สงวนไว้สำหรับ Owner');
      var dup = all.filter(function (e) { return e.id !== r.id && String(e.code).toLowerCase() === r.code.toLowerCase(); })[0];
      if (dup) fail_('รหัสพนักงาน ' + r.code + ' ซ้ำกับ ' + (dup.nickname || dup.firstName));
    }
    if (r.role !== undefined) r.role = normRole_(r.role);
    if (r.pin !== undefined) {
      var pin = String(r.pin).trim();
      if (pin) {
        if (!/^\d{4,6}$/.test(pin)) fail_('PIN ต้องเป็นตัวเลข 4–6 หลัก');
        r.pinHash = hashPin_(r.id, pin);
      }
    }
    delete r.pin; delete r.hasPin;
  });
  return rows;
}

function guardRemoveEmployee_(sess, id) {
  var used = readTable_('attendance').some(function (a) { return a.empId === id; }) || readTable_('payroll').some(function (p) { return p.empId === id; });
  if (used) fail_('พนักงานคนนี้มีประวัติเวลาทำงานหรือเงินเดือนแล้ว เปลี่ยนสถานะเป็น "ลาออก" แทนการลบ');
}


  /* ----- 07_Time.gs ----- */
/**
 * ระบบเวลาทำงาน: ลงเวลา (ใช้เวลาของเซิร์ฟเวอร์ + GPS + รูป), ข้อมูลของฉัน, คำขอลา/แก้เวลา,
 * และการซิงก์ตารางงานกับการลงเวลา (แก้ตารางย้อนหลัง ระบบคิดสาย/OT ของวันนั้นใหม่ให้เอง)
 */
function today_() { return Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd'); }
function activeEmps_() { return readTable_('employees').filter(function (e) { return e.status !== 'ลาออก'; }); }
function byId_(rows) { var o = {}; rows.forEach(function (r) { o[r.id] = r; }); return o; }

function timeCtx_() {
  var st = getSettings_();
  return { st: st, hol: Calc.holidayMap(st), shifts: Calc.shiftIndex(readTable_('shifts')), sched: Calc.scheduleIndex(readTable_('schedule')), patterns: Calc.patternIndex(readTable_('patterns')) };
}

/**
 * รายชื่อสำหรับหน้าลงเวลา (ไม่มีข้อมูลส่วนตัว)
 * เปิดด้วย clock.html?branch=B01 จะเห็นเฉพาะคนสาขานั้น + คนที่ตารางงานวันนี้/เมื่อวานอยู่สาขานั้น
 */
function staffPublic_(branch) {
  var st = getSettings_(), emps = activeEmps_();
  if (branch) {
    var t = today_(), y = Calc.addDays(t, -1), here = {};
    readTable_('schedule').forEach(function (r) { if (r.branch === branch && (r.date === t || r.date === y) && String(r.shift || '').trim() && !Calc.isOffCode(r.shift)) here[r.empId] = 1; });
    emps = emps.filter(function (e) { return e.branch === branch || here[e.id]; });
  }
  var pend = pendingEmpIds_();
  var staff = emps.map(function (e) { return { id: e.id, code: e.code, nickname: e.nickname, firstName: e.firstName, position: e.position, branch: e.branch || '', setup: !!pend[e.id] }; });
  return { staff: staff, shopName: st.shopName || '', theme: st.theme || '', branch: branch || '', branches: branchesActive_().map(branchPublic_) };
}

function haversine_(a, b, c, d) {
  var R = 6371000, rad = function (x) { return x * Math.PI / 180; };
  var h = Math.pow(Math.sin(rad(c - a) / 2), 2) + Math.cos(rad(a)) * Math.cos(rad(c)) * Math.pow(Math.sin(rad(d - b) / 2), 2);
  return 2 * R * Math.asin(Math.sqrt(h));
}

function planBrief_(p) { return { code: p.code, name: p.name, start: p.start || '', end: p.end || '', off: !!p.off, source: p.source, pubHoliday: p.pubHoliday || '', note: p.note || '', branch: p.branch || '' }; }

function clock_(sess, p) {
  if (!sess.empId) fail_('บัญชีนี้ไม่ได้ผูกกับพนักงาน ลงเวลาไม่ได้ ใช้บัญชีพนักงาน');
  sess = Object.assign({}, sess, { via: 'clock' });
  if (p.type !== 'in' && p.type !== 'out') fail_('คำสั่งลงเวลาไม่ถูกต้อง');
  var cache = CacheService.getScriptCache(), busyKey = 'clk_' + sess.empId;
  if (cache.get(busyKey)) fail_('กำลังบันทึกเวลาอยู่ รอสักครู่แล้วกดดูใหม่');
  cache.put(busyKey, '1', 20);
  try {
    var ctx = timeCtx_(), st = ctx.st;
    var emp = readTable_('employees').filter(function (e) { return e.id === sess.empId; })[0];
    if (!emp || emp.status === 'ลาออก') fail_('ไม่พบข้อมูลพนักงาน');
    var now = new Date();
    var date = Utilities.formatDate(now, TZ, 'yyyy-MM-dd'), time = Utilities.formatDate(now, TZ, 'HH:mm');
    var at = locateBranch_(Number(p.lat), Number(p.lng), Number(p.acc), Calc.planFor(emp, date, ctx).branch), dist = at.dist;
    if (Calc.bool(at.branch.requireSelfie) && (!p.photoId || !photoExists_(p.photoId))) fail_('ไม่พบรูปถ่ายยืนยันตัวตน ถ่ายรูปแล้วกดอีกครั้ง');
    var yest = Calc.addDays(date, -1);
    var mine = readTable_('attendance').filter(function (a) { return a.empId === emp.id; });
    var rec;
    if (p.type === 'in') {
      var done = mine.filter(function (a) { return a.date === date && a.inTime; })[0];
      if (done) fail_('วันนี้ลงเวลาเข้างานแล้วเมื่อ ' + done.inTime + (done.outTime ? ' และออกงานเมื่อ ' + done.outTime : ''));
      rec = { id: Utilities.getUuid(), empId: emp.id, date: date, branch: at.branch.code, inTime: time, outTime: '', inDist: dist, inPhoto: p.photoId || '', source: 'gps', by: sess.name };
    } else {
      rec = mine.filter(function (a) { return a.inTime && !a.outTime && (a.date === date || a.date === yest); })
        .sort(function (a, b) { return (b.date + b.inTime).localeCompare(a.date + a.inTime); })[0];
      if (!rec) fail_('ยังไม่ได้ลงเวลาเข้างาน ถ้าลืมกดเข้างาน ให้ส่งคำขอแก้เวลา');
      rec.outTime = time; rec.outDist = dist; rec.outPhoto = p.photoId || ''; rec.by = sess.name;
    }
    var plan = Calc.planFor(emp, rec.date, ctx), before = {};
    before[rec.id] = { otStatus: rec.otStatus || '', offStatus: rec.offStatus || '' };
    Calc.applyPlan(rec, plan, st);
    var other = p.type === 'in' && !plan.off && plan.branch && plan.branch !== at.branch.code;
    if (other) rec.note = 'ลงเวลาที่ ' + at.branch.name + ' แต่ตารางงานอยู่สาขา ' + plan.branch;
    upsertMany_('attendance', [rec]);
    log_(sess, p.type === 'in' ? 'ลงเวลาเข้า' : 'ลงเวลาออก', 'attendance', rec.date + ' ' + time + ' ' + at.branch.code + ' ห่างร้าน ' + dist + ' ม.');
    afterWriteNotify_('attendance', [rec], before);
    notifyClock_(emp, rec, p.type, at, plan, other);
    return { type: p.type, date: rec.date, time: time, name: emp.nickname || emp.firstName, lateMin: rec.lateMin, otMin: rec.otMin, workMin: rec.workMin, dist: dist, branch: at.branch.code, branchName: at.branch.name, otherBranch: other ? plan.branch : '', plan: planBrief_(plan), offWork: rec.offWork === 'true' };
  } finally {
    cache.remove(busyKey);
  }
}

var ATT_FIELDS = ['id', 'date', 'branch', 'inTime', 'outTime', 'planCode', 'planStart', 'planEnd', 'lateMin', 'workMin', 'otMin', 'otStatus', 'offWork', 'offStatus', 'holiday', 'source'];
function pick_(o, keys) { var r = {}; keys.forEach(function (k) { if (o[k] !== undefined) r[k] = o[k]; }); return r; }

/** ข้อมูลของพนักงานที่เข้าสู่ระบบ: กะวันนี้ ตาราง 14 วัน การลงเวลาเดือนนี้ สิทธิ์ลาคงเหลือ คำขอที่รออนุมัติ */
function my_(sess) {
  if (!sess.empId) fail_('บัญชีนี้ไม่ใช่พนักงาน');
  var ctx = timeCtx_(), st = ctx.st;
  var emp = readTable_('employees').filter(function (e) { return e.id === sess.empId; })[0];
  if (!emp) fail_('ไม่พบข้อมูลพนักงาน');
  var today = today_(), month = today.slice(0, 7), year = today.slice(0, 4);
  var att = readTable_('attendance').filter(function (a) { return a.empId === emp.id; });
  var open = att.filter(function (a) { return a.inTime && !a.outTime && (a.date === today || a.date === Calc.addDays(today, -1)); })
    .sort(function (a, b) { return (b.date + b.inTime).localeCompare(a.date + a.inTime); })[0];
  var todayRec = att.filter(function (a) { return a.date === today; })[0];
  var leaves = readTable_('leaves').filter(function (l) { return l.empId === emp.id && (String(l.dateFrom).slice(0, 4) === year || String(l.dateTo).slice(0, 4) === year); });
  var live = leaves.filter(function (l) { return l.status === 'อนุมัติ' || l.status === 'รออนุมัติ'; });
  var days = [];
  for (var i = 0; i < 14; i++) {
    var d = Calc.addDays(today, i);
    var lv = live.filter(function (l) { return l.dateFrom <= d && (l.dateTo || l.dateFrom) >= d; })[0];
    days.push({ date: d, plan: planBrief_(Calc.planFor(emp, d, ctx)), leave: lv ? { type: lv.type, status: lv.status } : null });
  }
  var monthAtt = att.filter(function (a) { return String(a.date).slice(0, 7) === month; }).sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); });
  var sum = function (arr, f) { return arr.reduce(function (s, x) { return s + f(x); }, 0); };
  var used = function (t) { return sum(leaves.filter(function (l) { return l.type === t && l.status === 'อนุมัติ'; }), function (l) { return Number(l.days) || 0; }); };
  var fixes = readTable_('timefix').filter(function (f) { return f.empId === emp.id && (f.status === 'รออนุมัติ' || String(f.date) >= Calc.addDays(today, -31)); });
  return {
    emp: { id: emp.id, code: emp.code, name: emp.nickname || emp.firstName, firstName: emp.firstName, position: emp.position },
    today: today, plan: planBrief_(Calc.planFor(emp, today, ctx)),
    state: open ? 'in' : (todayRec && todayRec.outTime ? 'done' : 'out'),
    open: open ? pick_(open, ATT_FIELDS) : null, todayRec: todayRec ? pick_(todayRec, ATT_FIELDS) : null,
    days: days,
    month: monthAtt.map(function (a) { return pick_(a, ATT_FIELDS); }),
    summary: {
      days: monthAtt.filter(function (a) { return a.inTime; }).length,
      lateMin: sum(monthAtt, function (a) { return Number(a.lateMin) || 0; }),
      otApproved: sum(monthAtt.filter(function (a) { return a.otStatus === 'อนุมัติ'; }), function (a) { return Number(a.otMin) || 0; }),
      otPending: sum(monthAtt.filter(function (a) { return a.otStatus === 'รออนุมัติ'; }), function (a) { return Number(a.otMin) || 0; })
    },
    quota: [['ลาป่วย', Number(st.sickPaidDays) || 30], ['ลากิจ', Number(st.personalPaidDays) || 3], ['ลาพักร้อน', Number(st.annualDays) || 6]].map(function (q) { return { type: q[0], quota: q[1], used: used(q[0]) }; }),
    leaves: leaves.sort(function (a, b) { return String(b.dateFrom).localeCompare(String(a.dateFrom)); }).map(function (l) { return pick_(l, ['id', 'type', 'dateFrom', 'dateTo', 'days', 'status', 'reason']); }),
    fixes: fixes.map(function (f) { return pick_(f, ['id', 'date', 'inTime', 'outTime', 'reason', 'status']); }),
    shopName: st.shopName || '', homeBranch: emp.branch || '',
    branches: branchesActive_().map(branchPublic_)
  };
}

var SELF_LEAVE_TYPES = ['ลาป่วย', 'ลากิจ', 'ลาพักร้อน', 'ลาไม่รับค่าจ้าง'];
var DATE_RE = /^\d{4}-\d{2}-\d{2}$/, TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/** คำขอของพนักงานเอง: ลา, แก้เวลา/ลืมลงเวลา, ยกเลิกคำขอที่ยังไม่อนุมัติ */
function myRequest_(sess, q) {
  if (!sess.empId) fail_('บัญชีนี้ไม่ใช่พนักงาน');
  var now = new Date().toISOString(), today = today_(), row;
  if (q.kind === 'leave') {
    if (SELF_LEAVE_TYPES.indexOf(q.type) < 0) fail_('เลือกประเภทการลา');
    if (!DATE_RE.test(q.dateFrom || '') || !DATE_RE.test(q.dateTo || q.dateFrom || '')) fail_('เลือกวันที่ลา');
    var to = q.dateTo || q.dateFrom;
    if (to < q.dateFrom) fail_('วันสิ้นสุดต้องไม่ก่อนวันเริ่ม');
    var days = q.days !== undefined && q.days !== '' ? Number(q.days) : Calc.dayCount(q.dateFrom, to);
    if (!(days > 0) || days > 60) fail_('จำนวนวันลาไม่ถูกต้อง');
    var clash = readTable_('leaves').filter(function (l) { return l.empId === sess.empId && (l.status === 'อนุมัติ' || l.status === 'รออนุมัติ') && l.dateFrom <= to && (l.dateTo || l.dateFrom) >= q.dateFrom; })[0];
    if (clash) fail_('มีใบลาช่วงวันนี้อยู่แล้ว (' + clash.type + ' ' + clash.status + ')');
    row = { id: Utilities.getUuid(), empId: sess.empId, type: q.type, dateFrom: q.dateFrom, dateTo: to, days: days, status: 'รออนุมัติ', reason: String(q.reason || '').slice(0, 300), by: sess.name, createdAt: now };
    upsertMany_('leaves', [row]);
    log_(sess, 'ขอลา', 'leaves', q.type + ' ' + q.dateFrom + (to !== q.dateFrom ? ' ถึง ' + to : ''));
    notifyApproval_('leaves', row, 'status');
  } else if (q.kind === 'fix') {
    if (!DATE_RE.test(q.date || '') || q.date > today) fail_('เลือกวันที่ที่ต้องการแก้');
    if (q.date < Calc.addDays(today, -31)) fail_('ขอแก้เวลาย้อนหลังได้ไม่เกิน 31 วัน');
    if (!q.inTime && !q.outTime) fail_('ใส่เวลาเข้าหรือเวลาออกอย่างน้อยหนึ่งช่อง');
    if ((q.inTime && !TIME_RE.test(q.inTime)) || (q.outTime && !TIME_RE.test(q.outTime))) fail_('รูปแบบเวลาไม่ถูกต้อง');
    if (!String(q.reason || '').trim()) fail_('ใส่เหตุผล');
    row = { id: Utilities.getUuid(), empId: sess.empId, date: q.date, inTime: q.inTime || '', outTime: q.outTime || '', reason: String(q.reason).slice(0, 300), status: 'รออนุมัติ', by: sess.name, createdAt: now };
    upsertMany_('timefix', [row]);
    log_(sess, 'ขอแก้เวลา', 'timefix', q.date);
    notifyApproval_('timefix', row, 'status');
  } else if (q.kind === 'cancel') {
    var table = q.table === 'timefix' ? 'timefix' : 'leaves';
    var cur = readTable_(table).filter(function (x) { return x.id === q.id && x.empId === sess.empId; })[0];
    if (!cur) fail_('ไม่พบคำขอ');
    if (cur.status !== 'รออนุมัติ') fail_('คำขอนี้ได้รับการพิจารณาแล้ว ยกเลิกไม่ได้');
    row = { id: cur.id, status: 'ยกเลิก', by: sess.name };
    upsertMany_(table, [row]);
    closeTokens_(table, cur.id, 'status', 'พนักงานยกเลิกคำขอ');
    log_(sess, 'ยกเลิกคำขอ', table, cur.id);
  } else fail_('ไม่รู้จักคำขอ');
  return row;
}

var DECIDED = ['อนุมัติ', 'ไม่อนุมัติ'];
function decide_(sess, row, old, field, perm) {
  var nv = row[field] !== undefined ? row[field] : (old ? old[field] : '');
  var ov = old ? old[field] : '';
  if (DECIDED.indexOf(nv) >= 0 && nv !== ov) {
    if (!can_(sess, [perm || 'approve_time'])) {
      if (!old) { row[field] = 'รออนุมัติ'; return false; }
      fail_('บัญชีนี้ไม่มีสิทธิ์อนุมัติรายการนี้', 'PERM');
    }
    row.decidedBy = sess.name;
    return true;
  }
  return false;
}

/** แก้เวลาทำงานจากหลังร้าน: คิดสาย/OT ใหม่ตามตารางงานทุกครั้ง และให้เฉพาะผู้มีสิทธิ์อนุมัติเปลี่ยนสถานะ OT */
function guardAttendance_(sess, rows) {
  var ctx = timeCtx_(), emps = byId_(readTable_('employees')), old = byId_(readTable_('attendance'));
  rows.forEach(function (r) {
    var o = old[r.id];
    var m = Object.assign({}, o || {}, r);
    if (m.inTime && m.date && m.empId) {
      var emp = emps[m.empId];
      if (!emp) fail_('ไม่พบพนักงานของรายการลงเวลา');
      Calc.applyPlan(m, Calc.planFor(emp, m.date, ctx), ctx.st);
      ['planCode', 'planStart', 'planEnd', 'holiday', 'offWork', 'lateMin', 'workMin', 'otMin'].forEach(function (k) { r[k] = m[k]; });
      if (!r.branch && !(o && o.branch)) r.branch = m.branch;
      if (r.otStatus === undefined || DECIDED.indexOf(r.otStatus) < 0) r.otStatus = m.otStatus;
      if (r.offStatus === undefined || DECIDED.indexOf(r.offStatus) < 0) r.offStatus = m.offStatus;
      if (!(Number(m.otMin) > 0)) r.otStatus = '';
      if (m.offWork !== 'true') r.offStatus = '';
    }
    decide_(sess, r, o, 'otStatus');
    decide_(sess, r, o, 'offStatus');
  });
  return rows;
}

function guardLeaves_(sess, rows) {
  var old = byId_(readTable_('leaves')), now = new Date().toISOString();
  rows.forEach(function (r) {
    var o = old[r.id];
    if (!o && !r.createdAt) r.createdAt = now;
    var from = r.dateFrom || (o && o.dateFrom), to = r.dateTo || (o && o.dateTo) || from;
    if (from && to && to < from) fail_('วันสิ้นสุดต้องไม่ก่อนวันเริ่ม');
    if (r.dateFrom && (r.days === '' || r.days === undefined || r.days === null)) r.days = Calc.dayCount(from, to);
    if (!o && !r.status) r.status = 'รออนุมัติ';
    if (decide_(sess, r, o, 'status')) r.decidedAt = now;
  });
  return rows;
}

var _fixToApply = [];
/** คำขอแก้เวลา: เมื่อ Owner กดอนุมัติ ระบบแก้รายการลงเวลาให้อัตโนมัติ */
function guardTimefix_(sess, rows) {
  var old = byId_(readTable_('timefix')), now = new Date().toISOString();
  _fixToApply = []; _fixApplied = [];
  rows.forEach(function (r) {
    var o = old[r.id];
    if (!o && !r.createdAt) r.createdAt = now;
    if (!o && !r.status) r.status = 'รออนุมัติ';
    if (decide_(sess, r, o, 'status')) {
      r.decidedAt = now;
      if (r.status === 'อนุมัติ') _fixToApply.push(Object.assign({}, o || {}, r));
    }
  });
  if (_fixToApply.length) applyFixes_(sess, _fixToApply);
  return rows;
}

var _fixApplied = [];
function applyFixes_(sess, fixes) {
  var att = readTable_('attendance');
  var out = fixes.map(function (f) {
    var cur = att.filter(function (a) { return a.empId === f.empId && a.date === f.date; })[0];
    var rec = cur ? Object.assign({}, cur) : { id: Utilities.getUuid(), empId: f.empId, date: f.date, inTime: '', outTime: '' };
    if (f.inTime) rec.inTime = f.inTime;
    if (f.outTime) rec.outTime = f.outTime;
    if (!rec.inTime) fail_('คำขอวันที่ ' + f.date + ' ไม่มีเวลาเข้างาน และไม่พบการลงเวลาเข้าเดิม แก้คำขอหรือเพิ่มเวลาเองที่หน้าเวลาทำงาน');
    rec.source = 'แก้ตามคำขอ';
    rec.note = ((cur && cur.note ? cur.note + ' / ' : '') + 'คำขอ: ' + (f.reason || '')).slice(0, 300);
    rec.by = sess.name;
    return rec;
  });
  _fixApplied = guardAttendance_(sess, out);
  upsertMany_('attendance', _fixApplied);
}

/** ส่งรายการลงเวลาที่ถูกแก้ตามคำขอกลับไปให้หน้าเว็บ */
function afterTimefix_() {
  var rows = _fixApplied; _fixApplied = [];
  return rows.length ? { attendance: rows } : null;
}

/** ตารางงานเปลี่ยน → คิดสาย/OT/วันหยุดของการลงเวลาในวันเหล่านั้นใหม่ทันที */
function afterSchedule_(sess, rows) {
  var keys = {};
  rows.forEach(function (r) { keys[r.date + '|' + r.empId] = 1; });
  return recalcAttendance_(sess, function (a) { return keys[a.date + '|' + a.empId]; });
}

/** แก้เวลาของกะ → คิดใหม่เฉพาะรายการของเดือนนี้และเดือนก่อนที่ใช้กะนั้น */
function afterShifts_(sess, rows) {
  var codes = {};
  rows.forEach(function (r) { codes[Calc.upper(r.code)] = 1; });
  var from = Calc.addDays(today_().slice(0, 7) + '-01', -31);
  return recalcAttendance_(sess, function (a) { return a.date >= from && codes[Calc.upper(a.planCode)]; });
}

function recalcAttendance_(sess, filter) {
  var att = readTable_('attendance').filter(function (a) { return a.inTime && filter(a); });
  if (!att.length) return { recalc: 0 };
  var ctx = timeCtx_(), emps = byId_(readTable_('employees'));
  var changed = att.filter(function (a) {
    var emp = emps[a.empId];
    if (!emp) return false;
    var before = [a.planCode, a.lateMin, a.workMin, a.otMin, a.offWork, a.holiday].join('|');
    Calc.applyPlan(a, Calc.planFor(emp, a.date, ctx), ctx.st);
    return before !== [a.planCode, a.lateMin, a.workMin, a.otMin, a.offWork, a.holiday].join('|');
  });
  if (changed.length) upsertMany_('attendance', changed);
  return { recalc: changed.length };
}


  /* ----- 08_Stock.gs ----- */
/**
 * กฎสต็อก (แยกยอดตามสาขา รายการสินค้าใช้ร่วมกันทุกสาขา):
 * ทุกคนที่มีสิทธิ์สต็อกรับเข้า เบิกใช้ บันทึกของเสีย และโอนไปสาขาอื่นได้ทันที
 * ส่วนต่างจากการตรวจนับ (ปรับยอด) ของคนที่ไม่มีสิทธิ์อนุมัติสต็อก ต้องรออนุมัติก่อนนับเข้ายอดคงเหลือ
 * คนที่ไม่มีสิทธิ์อนุมัติ แก้หรือลบได้เฉพาะรายการของตัวเองที่บันทึกวันนี้
 */
var MOVE_TYPES = ['รับเข้า', 'เบิกใช้', 'ของเสีย', 'ปรับยอด', 'โอนออก', 'โอนเข้า'];
function guardMoves_(sess, rows) {
  var approver = can_(sess, ['approve_stock']);
  var old = byId_(readTable_('moves')), today = today_(), now = new Date().toISOString(), codes = {};
  branchesAll_().forEach(function (b) { codes[b.code] = 1; });
  rows.forEach(function (r) {
    var o = old[r.id];
    if (!o) r.createdAt = now;
    var t = r.type || (o && o.type);
    if (MOVE_TYPES.indexOf(t) < 0) fail_('ประเภทรายการสต็อกไม่ถูกต้อง');
    if (!o && !r.branch) fail_('ระบุสาขาของรายการสต็อก');
    if ((t === 'โอนออก' || t === 'โอนเข้า') && (!codes[r.toBranch || (o && o.toBranch)] || (r.toBranch || (o && o.toBranch)) === (r.branch || (o && o.branch)))) fail_('เลือกสาขาปลายทางของการโอน');
    if (!approver) {
      if (o && (o.by !== sess.name || String(o.createdAt || o.updatedAt).slice(0, 10) < Calc.addDays(today, -1) || o.status === 'อนุมัติ')) {
        fail_('แก้ไขได้เฉพาะรายการของคุณที่บันทึกวันนี้ ติดต่อ Owner');
      }
      var type = r.type || (o && o.type);
      if (type === 'ปรับยอด') r.status = 'รออนุมัติ';
      else if (r.status !== undefined && r.status !== '') r.status = '';
    } else {
      if (decide_(sess, r, o, 'status', 'approve_stock')) r.decidedBy = sess.name;
    }
  });
  return rows;
}

function guardRemoveMove_(sess, id) {
  if (can_(sess, ['approve_stock'])) return;
  var o = readTable_('moves').filter(function (m) { return m.id === id; })[0];
  if (!o) return;
  if (o.by !== sess.name || String(o.createdAt || o.updatedAt).slice(0, 10) < Calc.addDays(today_(), -1)) fail_('ลบได้เฉพาะรายการของคุณที่บันทึกวันนี้ ติดต่อ Owner');
}


  /* ----- 09_Photo.gs ----- */
/** รูปถ่ายตอนลงเวลา เก็บใน Google Drive ของเจ้าของสคริปต์ โฟลเดอร์ "รูปลงเวลา" (ไม่แชร์สาธารณะ) */
function photoFolder_() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('PHOTO_FOLDER_ID');
  if (id) { try { return DriveApp.getFolderById(id); } catch (e) { /* ถูกลบ สร้างใหม่ */ } }
  var f = rootFolder_().createFolder(PHOTO_FOLDER_NAME);
  props.setProperty('PHOTO_FOLDER_ID', f.getId());
  return f;
}

function saveClockPhoto_(sess, p) {
  if (!sess.empId) fail_('บัญชีนี้ไม่ใช่พนักงาน');
  if (!/^[\w-]{6,40}$/.test(p.id || '')) fail_('รหัสรูปไม่ถูกต้อง');
  var m = String(p.data || '').match(/^data:image\/(jpeg|png);base64,(.+)$/);
  if (!m) fail_('ไฟล์รูปไม่ถูกต้อง');
  var bytes = Utilities.base64Decode(m[2]);
  if (bytes.length > 400000) fail_('รูปใหญ่เกินไป');
  photoFolder_().createFile(Utilities.newBlob(bytes, 'image/' + m[1], p.id + '.jpg'))
    .setDescription((sess.code || '') + ' ' + sess.name + ' ' + Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm'));
  return { saved: true };
}

function photoExists_(id) { return photoFolder_().getFilesByName(id + '.jpg').hasNext(); }

function getPhoto_(id) {
  if (!/^[\w-]{6,40}$/.test(id || '')) fail_('รหัสรูปไม่ถูกต้อง');
  var it = photoFolder_().getFilesByName(id + '.jpg');
  if (!it.hasNext()) fail_('ไม่พบรูป');
  var b = it.next().getBlob();
  return 'data:' + b.getContentType() + ';base64,' + Utilities.base64Encode(b.getBytes());
}


  /* ----- 10_Branch.gs ----- */
/**
 * สาขา: ข้อมูลสาขา (พิกัดลงเวลา ค่าแฟรนไชส์ของแต่ละสัญญา) และการจำกัดข้อมูลตามสาขาที่แต่ละคนดูแล
 * Owner เห็นทุกสาขา, HR เห็นทุกสาขาถ้าไม่ได้ระบุ, Manager/Staff เห็นสาขาประจำ + สาขาที่ได้รับมอบหมายเพิ่ม
 * ตรวจที่ฝั่ง Google ทั้งตอนอ่านและตอนบันทึก
 */
function branchesAll_() { return readTable_('branches'); }
function branchesActive_() { return branchesAll_().filter(function (b) { return b.status !== 'ปิด'; }); }
function branchByCode_(code) { return branchesAll_().filter(function (b) { return b.code === code; })[0]; }

/** ข้อมูลสาขาที่ทุกคนเห็นได้ (ไม่มีเงินลงทุนและค่าแฟรนไชส์) */
function branchPublic_(b) {
  return { id: b.id, code: b.code, name: b.name, status: b.status || 'เปิด', address: b.address || '', phone: b.phone || '', lat: Number(b.lat) || 0, lng: Number(b.lng) || 0, radius: Number(b.radius) || 80, maxAccuracy: Number(b.maxAccuracy) || 100, requireSelfie: Calc.bool(b.requireSelfie), hasGeo: !!(Number(b.lat) && Number(b.lng)) };
}

/** สาขาที่ผู้ใช้ดูแล: '*' = ทุกสาขา หรือรายการรหัสสาขา */
function scopeFor_(role, emp) {
  if (role === 'owner' || role === 'admin') return '*';
  var acc = String((emp && emp.branchAccess) || '').trim();
  if (acc === '*') return '*';
  if (role === 'hr' && !acc) return '*';
  var list = [emp && emp.branch].concat(acc.split(/[,\s]+/)).filter(function (x) { return x; });
  return list.filter(function (x, i) { return list.indexOf(x) === i; });
}
function inScope_(sess, branch) {
  var s = sess.scope;
  return s === '*' || (Array.isArray(s) && !!branch && s.indexOf(String(branch)) >= 0);
}
function empBranches_() { var o = {}; readTable_('employees').forEach(function (e) { o[e.id] = e.branch || ''; }); return o; }

/** สาขาของแถวข้อมูล (แถวที่ผูกกับพนักงาน ใช้สาขาประจำของพนักงาน) */
function rowBranch_(table, row, empB) {
  var def = TABLES[table];
  if (table === 'employees') return row.branch || '';
  if (def.scope === 'emp') return empB[row.empId] || '';
  return row.branch || '';
}

/** แถวนี้ผู้ใช้เห็นได้ไหม (ตาราง dual เห็นได้ทั้งจากสาขาที่ทำงานและสาขาประจำของพนักงาน) */
function rowVisible_(sess, table, r, empB) {
  if (inScope_(sess, rowBranch_(table, r, empB))) return true;
  return !!TABLES[table].dual && inScope_(sess, empB[r.empId] || '');
}

/** กรองแถวที่ผู้ใช้เห็นได้ */
function scopeRows_(sess, table, rows, empB) {
  var def = TABLES[table];
  if (!def.scope || sess.scope === '*') return rows;
  return rows.filter(function (r) { return rowVisible_(sess, table, r, empB); });
}

/**
 * ยืมคนข้ามสาขา: Manager สาขาต้นทาง (สาขาประจำของพนักงาน) เป็นคนส่งไปช่วยสาขาอื่น
 * Manager สาขาปลายทางแก้กะของคนที่ถูกส่งมาแล้วได้ หรือส่งกลับสาขาประจำ แต่ดึงคนจากสาขาอื่นเองไม่ได้
 */
function guardDualRow_(sess, table, r, o, empB) {
  var home = empB[r.empId || (o && o.empId)] || '';
  if (inScope_(sess, home)) return;
  if (o && !inScope_(sess, o.branch)) fail_('รายการนี้เป็นของสาขา ' + (o.branch || home) + ' ซึ่งคุณไม่ได้ดูแล', 'PERM');
  if (table === 'schedule') {
    if (!o) fail_('จัดตารางได้เฉพาะพนักงานสาขาที่คุณดูแล ถ้าต้องการยืมคน ให้ Manager สาขา ' + home + ' เป็นคนส่งมาช่วย', 'PERM');
    if (r.branch !== undefined && r.branch && r.branch !== o.branch && r.branch !== home) fail_('ส่งต่อคนที่ยืมมาไปสาขาอื่นไม่ได้', 'PERM');
    return;
  }
  var b = r.branch !== undefined ? r.branch : o && o.branch;
  if (!inScope_(sess, b)) fail_(b ? 'คุณไม่ได้ดูแลสาขา ' + b : 'เลือกสาขาก่อนบันทึก', 'PERM');
}

/** โอนเข้าสาขาปลายทาง ที่มาคู่กับรายการโอนออกจากสาขาของผู้บันทึกเอง */
function isTransferIn_(sess, r, rows) {
  return r.type === 'โอนเข้า' && rows.some(function (x) {
    return x.type === 'โอนออก' && x.ref === r.ref && x.itemId === r.itemId && Number(x.qty) === Number(r.qty) && x.branch === r.toBranch && x.toBranch === r.branch && inScope_(sess, x.branch);
  });
}

/** ตรวจก่อนบันทึก: แถวเดิมและแถวใหม่ต้องอยู่ในสาขาที่ผู้ใช้ดูแล */
function guardScope_(sess, table, rows) {
  var def = TABLES[table];
  if (!def.scope || sess.scope === '*') return;
  var empB = empBranches_(), old = byId_(readTable_(table));
  var single = Array.isArray(sess.scope) && sess.scope.length === 1 ? sess.scope[0] : '';
  rows.forEach(function (r) {
    if (table === 'schedule' && r.date && r.empId) r.id = r.date + '_' + r.empId;
    var o = old[r.id];
    if (def.dual) return guardDualRow_(sess, table, r, o, empB);
    if (o && !inScope_(sess, rowBranch_(table, o, empB))) fail_('รายการนี้เป็นของ' + (rowBranch_(table, o, empB) ? 'สาขา ' + rowBranch_(table, o, empB) : 'ส่วนกลาง') + ' ซึ่งคุณไม่ได้ดูแล', 'PERM');
    if (def.scope === 'branch' || table === 'employees') {
      if (r.branch === undefined && o) return;
      if (!r.branch && single) r.branch = single;
      if (table === 'moves' && isTransferIn_(sess, r, rows)) return;
      if (!inScope_(sess, r.branch)) fail_(r.branch ? 'คุณไม่ได้ดูแลสาขา ' + r.branch : 'เลือกสาขาก่อนบันทึก', 'PERM');
    } else {
      var eb = empB[r.empId || (o && o.empId)];
      if (!inScope_(sess, eb)) fail_('พนักงานคนนี้อยู่สาขาที่คุณไม่ได้ดูแล', 'PERM');
    }
  });
}
function guardScopeRemove_(sess, table, id) {
  var def = TABLES[table];
  if (!def.scope || sess.scope === '*') return;
  var o = readTable_(table).filter(function (x) { return x.id === id; })[0];
  if (o && !rowVisible_(sess, table, o, empBranches_())) fail_('รายการนี้เป็นของสาขาที่คุณไม่ได้ดูแล', 'PERM');
}

/** กฎข้อมูลสาขา: รหัสห้ามซ้ำ ห้ามลบสาขาที่มีข้อมูลแล้ว (เปลี่ยนสถานะเป็น "ปิด" แทน) */
function guardBranches_(sess, rows) {
  var all = branchesAll_();
  rows.forEach(function (r) {
    if (r.code !== undefined) {
      r.code = String(r.code).trim().toUpperCase();
      if (!/^[A-Z0-9-]{2,10}$/.test(r.code)) fail_('รหัสสาขาใช้ตัวอักษรอังกฤษหรือตัวเลข 2–10 ตัว เช่น B01');
      var dup = all.filter(function (b) { return b.id !== r.id && b.code === r.code; })[0];
      if (dup) fail_('รหัสสาขา ' + r.code + ' ซ้ำกับ ' + dup.name);
      var cur = all.filter(function (b) { return b.id === r.id; })[0];
      if (cur && cur.code !== r.code) fail_('เปลี่ยนรหัสสาขาที่สร้างแล้วไม่ได้ เพราะข้อมูลเดิมอ้างอิงรหัสนี้');
    }
  });
  return rows;
}
function guardRemoveBranch_(sess, id) {
  var b = branchesAll_().filter(function (x) { return x.id === id; })[0];
  if (!b) return;
  var used = readTable_('employees').some(function (e) { return e.branch === b.code; }) || readTable_('sales').some(function (s) { return s.branch === b.code; }) || readTable_('attendance').some(function (a) { return a.branch === b.code; });
  if (used) fail_('สาขานี้มีพนักงานหรือข้อมูลแล้ว เปลี่ยนสถานะเป็น "ปิด" แทนการลบ');
}

/**
 * หาสาขาจากตำแหน่ง GPS: เลือกสาขาที่ใกล้ที่สุดในรัศมี
 * ถ้าไม่อยู่ในรัศมีสาขาใดเลย แจ้งระยะห่างจากสาขาที่ใกล้ที่สุด (หรือสาขาตามตาราง)
 */
function locateBranch_(lat, lng, acc, preferCode) {
  if (!isFinite(lat) || !isFinite(lng)) fail_('ไม่ได้รับพิกัดจากมือถือ');
  var list = branchesActive_().filter(function (b) { return Number(b.lat) && Number(b.lng); });
  if (!list.length) fail_('ยังไม่ได้ตั้งพิกัดสาขา Owner ต้องตั้งที่เมนู สาขา ก่อน');
  var ds = list.map(function (b) { return { b: b, d: haversine_(Number(b.lat), Number(b.lng), lat, lng) }; }).sort(function (x, y) { return x.d - y.d; });
  var hit = ds.filter(function (x) { return x.d <= (Number(x.b.radius) || 80); })[0];
  if (!hit) {
    var ref = ds.filter(function (x) { return x.b.code === preferCode; })[0] || ds[0];
    fail_('อยู่นอกพื้นที่ร้าน ห่าง' + ref.b.name + ' ' + Math.round(ref.d) + ' ม. (ลงเวลาได้ในรัศมี ' + (Number(ref.b.radius) || 80) + ' ม.)');
  }
  var maxAcc = Number(hit.b.maxAccuracy) || 100;
  if (!(acc > 0) || acc > maxAcc) fail_('สัญญาณ GPS ยังไม่แม่นพอ (คลาดเคลื่อน ±' + Math.round(acc || 0) + ' ม.) เปิด Wi-Fi และตำแหน่งแบบแม่นยำสูง แล้วกดใหม่');
  return { branch: hit.b, dist: Math.round(hit.d) };
}


  /* ----- 11_Schedule.gs ----- */
/**
 * ตั้งตารางงานในระบบ: รูปแบบกะรายสัปดาห์ของแต่ละคน, จำนวนคนที่ต้องการต่อกะของแต่ละสาขา, ตรวจตารางงานก่อนบันทึก
 * แก้รูปแบบกะ → การลงเวลาย้อนหลังที่ยังไม่มีตารางงานกำกับ ถูกคิดสาย/OT ใหม่ให้ทันที
 */
var DAY_KEYS = ['d0', 'd1', 'd2', 'd3', 'd4', 'd5', 'd6'];

function validShiftCode_(code, shifts) { var c = Calc.upper(code); return c === '' || Calc.isOffCode(c) || !!shifts[c]; }

function guardPatterns_(sess, rows) {
  var shifts = Calc.shiftIndex(readTable_('shifts'));
  rows.forEach(function (r) {
    if (!r.empId) fail_('ไม่ระบุพนักงานของรูปแบบกะ');
    r.id = 'pat_' + r.empId;
    DAY_KEYS.forEach(function (k) {
      if (r[k] === undefined) return;
      var c = Calc.upper(r[k]);
      if (!validShiftCode_(c, shifts)) fail_('ไม่รู้จักรหัสกะ "' + r[k] + '"');
      r[k] = Calc.isOffCode(c) ? 'OFF' : c;
    });
  });
  return rows;
}

function afterPatterns_(sess, rows) {
  var emps = {};
  rows.forEach(function (r) { emps[r.empId] = 1; });
  var sched = Calc.scheduleIndex(readTable_('schedule')), from = Calc.addDays(today_(), -45);
  return recalcAttendance_(sess, function (a) {
    var s = sched[a.date + '|' + a.empId];
    return emps[a.empId] && a.date >= from && !(s && String(s.shift || '').trim());
  });
}

function guardStaffing_(sess, rows) {
  var shifts = Calc.shiftIndex(readTable_('shifts'));
  rows.forEach(function (r) {
    if (!r.branch || !r.shift) fail_('ระบุสาขาและกะ');
    r.shift = Calc.upper(r.shift);
    if (!shifts[r.shift]) fail_('ไม่รู้จักรหัสกะ ' + r.shift);
    r.id = 'need_' + r.branch + '_' + r.shift;
    DAY_KEYS.forEach(function (k) {
      if (r[k] === undefined || r[k] === '') return;
      var n = Number(r[k]);
      if (!(n >= 0 && n <= 50)) fail_('จำนวนคนต้องเป็น 0–50');
      r[k] = Math.round(n);
    });
  });
  return rows;
}

/** ตารางงาน: 1 คน 1 แถวต่อวัน รหัสกะต้องมีจริง สาขาต้องมีจริง */
function guardSchedule_(sess, rows) {
  var shifts = Calc.shiftIndex(readTable_('shifts')), codes = {};
  branchesAll_().forEach(function (b) { codes[b.code] = 1; });
  rows.forEach(function (r) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(r.date || '') || !r.empId) fail_('ตารางงานต้องมีวันที่และพนักงาน');
    r.id = r.date + '_' + r.empId;
    var c = Calc.upper(r.shift);
    if (c && !Calc.isOffCode(c) && !(r.start && r.end) && !shifts[c]) fail_('ไม่รู้จักรหัสกะ ' + r.shift);
    if (r.branch && !codes[r.branch]) fail_('ไม่พบสาขา ' + r.branch);
  });
  return rows;
}

/** กะใหม่หรือแก้กะ: รหัสห้ามซ้ำ */
function guardShifts_(sess, rows) {
  var all = readTable_('shifts');
  rows.forEach(function (r) {
    if (r.code === undefined) return;
    r.code = Calc.upper(r.code);
    if (!/^[A-Z0-9ก-๙]{1,4}$/.test(r.code) || ['OFF', 'X', 'H', 'C'].indexOf(r.code) >= 0) fail_('รหัสกะ 1–4 ตัวอักษร และห้ามใช้ OFF X H C');
    if (all.some(function (s) { return s.id !== r.id && Calc.upper(s.code) === r.code; })) fail_('รหัสกะ ' + r.code + ' ซ้ำ');
  });
  return rows;
}


  /* ----- 12_Users.gs ----- */
/**
 * บัญชีผู้ใช้ (Users) ที่ Owner สร้างเอง — ไม่ต้องเป็นพนักงาน เช่น Owner ร่วม, Admin ดูแลระบบ, นักบัญชี, HR ภายนอก
 * ทุกบัญชีมีชื่อเข้าระบบของตัวเอง ทุกการกระทำถูกบันทึกใน Audit log ด้วยชื่อบัญชีนั้น
 * บัญชีหลัก "owner" (PIN อยู่ใน Script Properties) ยังใช้ได้เสมอ เผื่อกู้ระบบ
 * กันการเพิ่มสิทธิ์ตัวเอง: คนที่ไม่ใช่ Owner สร้างบัญชีระดับ Owner ไม่ได้ ให้สิทธิ์เฉพาะ Owner ไม่ได้ และแก้ Role/สิทธิ์ของตัวเองไม่ได้
 */
var USER_RE = /^[A-Za-z0-9._-]{3,20}$/;
var LINE_ID_RE = /^[UCR][0-9a-f]{32}$/;
var LINE_EVENTS = ['approvals', 'clock', 'clockEx', 'daily'];

function usersAll_() { return readTable_('users'); }
function userByName_(name) {
  var n = String(name || '').trim().toLowerCase();
  if (!n || n === 'owner') return null;
  return usersAll_().filter(function (u) { return String(u.username).toLowerCase() === n; })[0] || null;
}
function stripUser_(u) { var o = Object.assign({}, u); o.hasPin = !!u.pinHash; delete o.pinHash; delete o.pin; return setupInfo_(u, o); }
function splitList_(v) { return String(v || '').split(/[,\s]+/).filter(function (x) { return x; }); }

function userSession_(u) {
  var role = normRole_(u.role), sess = { role: role, uid: u.id, empId: u.empId || '', name: u.name || u.username, code: u.username, branch: u.branch || '', scope: scopeFor_(role, u) };
  var perms = splitList_(u.perms);
  if (perms.length && role !== 'owner') sess.perms = perms;
  return sess;
}

function userLogin_(u, pin) {
  if (u.status === 'disabled') fail_('บัญชี ' + u.username + ' ถูกปิดใช้งาน ติดต่อ Manager หรือ Owner/Admin');
  if (!u.pinHash) fail_('บัญชี ' + u.username + ' ยังไม่ได้ตั้ง PIN ใส่รหัสเปิดใช้งานที่ได้จาก Owner/Admin แล้วตั้ง PIN 6 หลักของคุณ', 'SETUP');
  checkPin_(u, pin);
  try { upsertMany_('users', [{ id: u.id, lastLogin: Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm') }]); } catch (e) { /* ไม่สำคัญ */ }
  return userSession_(u);
}

/** ข้อมูลของบัญชีหลัก owner (ชื่อที่แสดง และ LINE) เก็บใน Script Properties */
function ownerProfile_() {
  try { return JSON.parse(PropertiesService.getScriptProperties().getProperty('OWNER_PROFILE') || '{}'); } catch (e) { return {}; }
}
function saveOwnerProfile_(sess, v) {
  if (sess.role !== 'owner') fail_('แก้บัญชีหลักได้เฉพาะ Owner', 'PERM');
  var pr = ownerProfile_();
  if (v.name !== undefined) pr.name = String(v.name || '').slice(0, 40) || 'Owner';
  if (v.lineUserId !== undefined) { if (v.lineUserId && !LINE_ID_RE.test(v.lineUserId)) fail_('LINE ID ต้องขึ้นต้นด้วย U, C หรือ R ตามด้วยตัวอักษร 32 ตัว'); pr.lineUserId = v.lineUserId; }
  if (v.lineEvents !== undefined) pr.lineEvents = splitList_(v.lineEvents).filter(function (x) { return LINE_EVENTS.indexOf(x) >= 0; }).join(',');
  PropertiesService.getScriptProperties().setProperty('OWNER_PROFILE', JSON.stringify(pr));
  log_(sess, 'แก้ข้อมูลบัญชีหลัก owner', 'users', '');
  return ownerRow_();
}
function ownerRow_() {
  var pr = ownerProfile_();
  return { id: 'owner', username: 'owner', name: pr.name || 'Owner', role: 'owner', status: 'active', hasPin: !!PropertiesService.getScriptProperties().getProperty('OWNER_PIN_HASH'), lineUserId: pr.lineUserId || '', lineEvents: pr.lineEvents !== undefined ? pr.lineEvents : 'approvals,clockEx,daily', master: true };
}

function guardUsers_(sess, rows) {
  var all = usersAll_(), old = byId_(all), owner = sess.role === 'owner';
  var empCodes = {}, emps = byId_(readTable_('employees')), codes = {};
  Object.keys(emps).forEach(function (id) { empCodes[String(emps[id].code).toLowerCase()] = 1; });
  branchesAll_().forEach(function (b) { codes[b.code] = 1; });
  var ownerOnly = PERMS.filter(function (x) { return x[2]; }).map(function (x) { return x[0]; });
  rows.forEach(function (r) {
    if (r.id === 'owner') fail_('แก้บัญชีหลัก owner ที่ปุ่มของบัญชีนั้น');
    var o = old[r.id], role = normRole_(r.role !== undefined ? r.role : (o && o.role));
    if (!owner) {
      if ((o && normRole_(o.role) === 'owner') || role === 'owner') fail_('สร้างหรือแก้บัญชีระดับ Owner ได้เฉพาะ Owner', 'PERM');
      if (o && o.id === sess.uid && (role !== normRole_(o.role) || (r.perms !== undefined && r.perms !== (o.perms || '')) || (r.branchAccess !== undefined && r.branchAccess !== (o.branchAccess || '')) || r.status === 'disabled')) fail_('แก้ Role สิทธิ์ หรือสาขาของบัญชีตัวเองไม่ได้', 'PERM');
      if (r.perms !== undefined) {
        var mine = permsOf_(sess);
        if (splitList_(r.perms).some(function (k) { return ownerOnly.indexOf(k) >= 0 || mine.indexOf(k) < 0; })) fail_('ให้สิทธิ์ที่คุณเองไม่มี หรือสิทธิ์เฉพาะ Owner ไม่ได้', 'PERM');
      }
    }
    if (r.role !== undefined) r.role = role;
    if (!o && !r.username) fail_('ใส่ชื่อเข้าระบบ');
    if (o && r.username === undefined && role !== normRole_(o.role)) checkUserPrefix_(o.username, role);
    if (r.username !== undefined) {
      r.username = String(r.username).trim().toLowerCase();
      if (!USER_RE.test(r.username)) fail_('ชื่อเข้าระบบใช้ a-z 0-9 . _ - ยาว 3–20 ตัว');
      if (!o || r.username !== String(o.username).toLowerCase() || role !== normRole_(o.role)) checkUserPrefix_(r.username, role);
      var low = r.username.toLowerCase();
      if (low === 'owner') fail_('ชื่อ owner สงวนไว้สำหรับบัญชีหลัก');
      if (empCodes[low]) fail_('ชื่อ ' + r.username + ' ซ้ำกับรหัสพนักงาน');
      if (all.some(function (u) { return u.id !== r.id && String(u.username).toLowerCase() === low; })) fail_('ชื่อเข้าระบบ ' + r.username + ' มีคนใช้แล้ว');
    }
    if (r.name !== undefined) r.name = String(r.name || '').trim().slice(0, 40);
    if (!o && !r.name) r.name = r.username;
    if (r.empId !== undefined && r.empId) {
      if (!emps[r.empId]) fail_('ไม่พบพนักงานที่ผูกไว้');
      if (all.some(function (u) { return u.id !== r.id && u.empId === r.empId; })) fail_('พนักงานคนนี้มีบัญชีผู้ใช้อยู่แล้ว');
    }
    if (r.branch !== undefined && r.branch && !codes[r.branch]) fail_('ไม่พบสาขา ' + r.branch);
    if (r.branchAccess !== undefined) {
      var acc = String(r.branchAccess || '').trim();
      r.branchAccess = acc === '*' ? '*' : splitList_(acc).filter(function (c) { return codes[c]; }).join(',');
      if (sess.scope !== '*' && (r.branchAccess === '*' || splitList_(r.branchAccess).some(function (c) { return !inScope_(sess, c); }))) fail_('ให้ดูแลสาขาที่คุณเองไม่ได้ดูแลไม่ได้', 'PERM');
    }
    if (r.perms !== undefined) r.perms = splitList_(r.perms).filter(function (k) { return PERMS.some(function (x) { return x[0] === k; }); }).join(',');
    if (r.status !== undefined) r.status = r.status === 'disabled' ? 'disabled' : 'active';
    if (!o && !r.status) r.status = 'active';
    if (r.lineUserId !== undefined && r.lineUserId && !LINE_ID_RE.test(r.lineUserId)) fail_('LINE ID ต้องขึ้นต้นด้วย U, C หรือ R ตามด้วยตัวอักษร 32 ตัว');
    if (r.lineEvents !== undefined) r.lineEvents = splitList_(r.lineEvents).filter(function (x) { return LINE_EVENTS.indexOf(x) >= 0; }).join(',');
    // Owner ไม่ตั้ง PIN ให้ใคร: บัญชีใหม่ได้รหัสเปิดใช้งาน เจ้าตัวตั้ง PIN เอง (15_Account.gs)
    ['pin', 'pinHash', 'setupHash', 'setupExpires', 'pinSetAt', 'hasPin', 'pending', 'setupCode', 'lastLogin'].forEach(function (k) { delete r[k]; });
    if (!o) prepareSetup_(r);
  });
  return rows;
}
function guardRemoveUser_(sess, id) {
  if (id === 'owner') fail_('ลบบัญชีหลักไม่ได้');
  if (id === sess.uid) fail_('ลบบัญชีตัวเองไม่ได้');
  var o = usersAll_().filter(function (u) { return u.id === id; })[0];
  if (o && normRole_(o.role) === 'owner' && sess.role !== 'owner') fail_('ลบบัญชีระดับ Owner ได้เฉพาะ Owner', 'PERM');
  if (o && readTable_('log').some(function (l) { return l.code === o.username; })) fail_('บัญชีนี้มีประวัติใน Audit log แล้ว เปลี่ยนสถานะเป็น "ปิดใช้งาน" แทนการลบ เพื่อเก็บประวัติ');
}

/**
 * ทุกบัญชีที่รับแจ้งเตือน LINE ได้: บัญชีหลัก owner + Users + พนักงาน (ที่ผูก LINE แล้ว)
 * ref = 'owner' | 'u:<id>' | 'e:<id>'
 */
function accounts_() {
  var out = [], o = ownerRow_();
  out.push({ ref: 'owner', name: o.name, lineUserId: o.lineUserId, lineEvents: o.lineEvents, sess: ownerSession_() });
  var emps = readTable_('employees'), E = byId_(emps), linked = {};
  usersAll_().filter(function (u) { return u.status !== 'disabled'; }).forEach(function (u) {
    var e = (u.empId && E[u.empId]) || {};
    if (u.empId) linked[u.empId] = 1;
    out.push({ ref: 'u:' + u.id, name: u.name || u.username, lineUserId: u.lineUserId || e.lineUserId || '', lineEvents: u.lineUserId ? (u.lineEvents || '') : (u.lineEvents || e.lineEvents || ''), sess: userSession_(u) });
  });
  emps.filter(function (e) { return e.status !== 'ลาออก' && !linked[e.id]; }).forEach(function (e) { out.push({ ref: 'e:' + e.id, name: e.nickname || e.firstName || e.code, lineUserId: e.lineUserId || '', lineEvents: e.lineEvents || '', sess: empSession_(e) }); });
  return out;
}
function accountByRef_(ref) { return accounts_().filter(function (a) { return a.ref === ref; })[0] || null; }
/** บัญชีของคนที่เข้าระบบอยู่ */
function selfRef_(sess) { return sess.role === 'owner' && sess.uid === 'owner' ? 'owner' : sess.uid ? 'u:' + sess.uid : sess.empId ? 'e:' + sess.empId : ''; }

/** บันทึก LINE และเหตุการณ์ที่อยากรับ ของบัญชีตัวเอง */
function saveMyLine_(sess, v) {
  var ref = selfRef_(sess);
  if (!ref) fail_('บัญชีนี้ตั้ง LINE ไม่ได้');
  var row = {};
  if (v.lineUserId !== undefined) { if (v.lineUserId && !LINE_ID_RE.test(v.lineUserId)) fail_('LINE ID ไม่ถูกต้อง'); row.lineUserId = v.lineUserId; }
  if (v.lineEvents !== undefined) row.lineEvents = splitList_(v.lineEvents).filter(function (x) { return LINE_EVENTS.indexOf(x) >= 0; }).join(',');
  setAccountLine_(ref, row);
  log_(sess, 'ตั้งค่า LINE ของตัวเอง', 'users', row.lineEvents || '');
  return myLine_(sess);
}
function setAccountLine_(ref, row) {
  if (ref === 'owner') {
    var pr = ownerProfile_();
    Object.keys(row).forEach(function (k) { pr[k] = row[k]; });
    PropertiesService.getScriptProperties().setProperty('OWNER_PROFILE', JSON.stringify(pr));
  } else if (ref.indexOf('u:') === 0) upsertMany_('users', [Object.assign({ id: ref.slice(2) }, row)]);
  else if (ref.indexOf('e:') === 0) upsertMany_('employees', [Object.assign({ id: ref.slice(2) }, row)]);
  else fail_('ไม่พบบัญชี');
}
function myLine_(sess) {
  var a = accountByRef_(selfRef_(sess));
  return { ref: a ? a.ref : '', name: a ? a.name : sess.name, linked: !!(a && a.lineUserId), lineEvents: a ? a.lineEvents : '', hasToken: !!PropertiesService.getScriptProperties().getProperty('LINE_TOKEN') };
}
/** รหัส 6 หลักสำหรับผูก LINE: ส่ง "link 123456" หา LINE OA ของร้านภายใน 10 นาที */
function lineLinkCode_(sess, ref) {
  ref = ref || selfRef_(sess);
  if (ref !== selfRef_(sess)) requirePerm_(sess, ['users']);
  if (!accountByRef_(ref)) fail_('ไม่พบบัญชี');
  var code = String(Math.floor(100000 + Math.random() * 900000));
  CacheService.getScriptCache().put('lnk_' + code, ref, 600);
  return { code: code, minutes: 10 };
}


  /* ----- 13_Admin.gs ----- */
/**
 * System Admin: ตรวจสุขภาพทุกระบบในครั้งเดียว และปุ่มแก้ไขปัญหาที่แก้ได้อัตโนมัติ
 * ทุกการแก้ไขถูกบันทึกใน Audit log (ช่องทาง admin) ใช้สิทธิ์ 'admin' (Owner ได้เสมอ)
 * ระดับปัญหา: error = ต้องแก้ ระบบบางส่วนทำงานผิด, warn = ควรแก้, info = แจ้งให้ทราบ
 */
var ADMIN_CHECK_DAYS = 45;

function issue_(list, sev, area, title, detail, fix, link) {
  list.push({ id: area + '-' + list.length, sev: sev, area: area, title: title, detail: detail || '', fix: fix || null, link: link || '' });
}

function healthCheck_(sess) {
  requirePerm_(sess, ['admin']);
  var t0 = Date.now(), I = [], T = today_(), stats = {};
  var props = PropertiesService.getScriptProperties();

  // 1) โครงสร้างไฟล์และชีต
  Object.keys(BOOKS).forEach(function (k) {
    var id = props.getProperty('BOOK_' + k), ss = null;
    try { ss = id ? SpreadsheetApp.openById(id) : null; } catch (e) { ss = null; }
    if (!ss) return issue_(I, 'error', 'structure', 'เปิดไฟล์ ' + BOOKS[k].title + ' ไม่ได้', 'ไฟล์ถูกลบ ย้าย หรือบัญชีที่ Deploy ไม่มีสิทธิ์ กดแก้ไขเพื่อสร้างไฟล์ใหม่ (ข้อมูลเดิมในไฟล์ที่หายไปจะไม่กลับมา)', { code: 'structure', label: 'สร้างไฟล์/ชีตที่ขาด' });
    var cells = 0;
    Object.keys(TABLES).filter(function (t) { return TABLES[t].book === k; }).forEach(function (t) {
      var sh = ss.getSheetByName(TABLES[t].tab);
      if (!sh) return issue_(I, 'error', 'structure', 'ไม่มีชีต ' + TABLES[t].tab, BOOKS[k].title, { code: 'structure', label: 'สร้างชีตที่ขาด' });
      var keys = keysOf_(sh), miss = TABLES[t].cols.filter(function (c) { return keys.indexOf(c[0]) < 0; });
      if (miss.length) issue_(I, 'warn', 'structure', 'ชีต ' + TABLES[t].tab + ' ขาดคอลัมน์ ' + miss.length + ' คอลัมน์', miss.map(function (c) { return c[1]; }).join(', ') + ' (มักเกิดหลังอัปเดตโค้ด)', { code: 'structure', label: 'เติมคอลัมน์' });
      var rows = Math.max(0, sh.getLastRow() - HEADER_ROWS);
      stats[t] = rows; cells += sh.getMaxRows() * sh.getMaxColumns();
    });
    if (cells > 7000000) issue_(I, 'warn', 'structure', BOOKS[k].title + ' ใช้พื้นที่ ' + Math.round(cells / 100000) / 10 + ' ล้านเซลล์', 'Google Sheet รับได้ 10 ล้านเซลล์ต่อไฟล์ ควรสำรองและย้ายข้อมูลเก่าออก');
  });
  if (I.some(function (x) { return x.sev === 'error' && x.area === 'structure'; })) return { version: APP_VERSION, at: new Date().toISOString(), ms: Date.now() - t0, stats: stats, issues: I, errors: [] };

  // 2) บัญชีและสิทธิ์
  if (!props.getProperty('OWNER_PIN_HASH')) issue_(I, 'error', 'users', 'ยังไม่ได้ตั้ง PIN ของบัญชีหลัก owner', 'รัน setOwnerPin ใน Apps Script');
  var st = getSettings_();
  try { JSON.parse(st.perms || '{}'); } catch (e) { issue_(I, 'error', 'users', 'ค่าสิทธิ์การใช้งานเสีย', 'อ่านค่า perms ไม่ได้ ทุก Role จะได้สิทธิ์ตามค่าเริ่มต้น', { code: 'resetPerms', label: 'คืนค่าสิทธิ์เริ่มต้น' }, '#set/perms'); }
  var branches = branchesAll_(), bcode = {};
  branches.forEach(function (b) { bcode[b.code] = b; });
  if (!branches.length) issue_(I, 'error', 'branch', 'ยังไม่มีสาขา', 'ลงเวลาไม่ได้จนกว่าจะมีสาขา', { code: 'structure', label: 'สร้างสาขาแรก' });
  branches.filter(function (b) { return b.status !== 'ปิด' && !(Number(b.lat) && Number(b.lng)); }).forEach(function (b) { issue_(I, 'warn', 'branch', b.name + ' ยังไม่ได้ตั้งพิกัด', 'พนักงานลงเวลาที่สาขานี้ไม่ได้', null, '#set/shop'); });

  var emps = readTable_('employees'), E = byId_(emps), users = usersAll_();
  var seen = {};
  emps.forEach(function (e) {
    var c = String(e.code || '').toLowerCase();
    if (c && seen[c]) issue_(I, 'error', 'hr', 'รหัสพนักงานซ้ำ: ' + e.code, (seen[c].nickname || seen[c].firstName) + ' และ ' + (e.nickname || e.firstName) + ' เข้าระบบได้แค่คนเดียว', null, '#hr/emp');
    seen[c] = e;
  });
  var active = emps.filter(function (e) { return e.status !== 'ลาออก'; });
  var noPin = active.filter(function (e) { return !e.pinHash && !users.some(function (u) { return u.empId === e.id; }); });
  if (noPin.length) issue_(I, 'warn', 'hr', 'พนักงาน ' + noPin.length + ' คนยังไม่มี PIN หรือชื่อผู้ใช้', noPin.map(function (e) { return e.nickname || e.code; }).join(', ') + ' ลงเวลาไม่ได้ สร้างชื่อผู้ใช้ให้ที่หน้า Users (เจ้าตัวตั้ง PIN เอง)', null, '#users');
  var badBr = active.filter(function (e) { return !bcode[e.branch]; });
  if (badBr.length) issue_(I, 'error', 'hr', 'พนักงาน ' + badBr.length + ' คนอยู่ในสาขาที่ไม่มีในระบบ', badBr.map(function (e) { return (e.nickname || e.code) + ' (' + (e.branch || 'ว่าง') + ')'; }).join(', ') + ' Manager จะไม่เห็นคนเหล่านี้ (มักเป็นข้อมูลจากรุ่นที่ยังมีสาขาเดียว)', branches.length === 1 ? { code: 'assignBranch', args: { table: 'employees', branch: branches[0].code }, label: 'ใส่เป็นสาขา ' + branches[0].code } : null, '#hr/emp');
  var badAcc = emps.filter(function (e) { return e.branchAccess && e.branchAccess !== '*' && splitList_(e.branchAccess).some(function (c) { return !bcode[c]; }); });
  if (badAcc.length) issue_(I, 'warn', 'hr', 'สาขาที่ดูแลเพิ่มอ้างถึงสาขาที่ไม่มี ' + badAcc.length + ' คน', badAcc.map(function (e) { return e.nickname || e.code; }).join(', '), { code: 'cleanAccess', label: 'ลบรหัสสาขาที่ไม่มีออก' });
  var resignedNoEnd = emps.filter(function (e) { return e.status === 'ลาออก' && !e.endDate; });
  if (resignedNoEnd.length) issue_(I, 'info', 'hr', 'ลาออกแต่ไม่มีวันสุดท้าย ' + resignedNoEnd.length + ' คน', 'เงินเดือนเดือนสุดท้ายอาจคิดไม่ถูก', null, '#hr/emp');
  users.forEach(function (u) {
    if (seen[String(u.username).toLowerCase()]) issue_(I, 'error', 'users', 'ชื่อผู้ใช้ ' + u.username + ' ซ้ำกับรหัสพนักงาน', 'คนหนึ่งจะเข้าระบบไม่ได้ เปลี่ยนชื่อผู้ใช้', null, '#users');
    if (u.status !== 'disabled' && u.empId && E[u.empId] && E[u.empId].status === 'ลาออก') issue_(I, 'warn', 'users', 'บัญชี ' + u.username + ' ผูกกับพนักงานที่ลาออกแล้ว', 'ควรปิดใช้งาน', { code: 'disableUser', args: { id: u.id }, label: 'ปิดใช้งานบัญชี' });
    var pre = ROLE_PREFIX[normRole_(u.role)];
    if (pre && String(u.username).toLowerCase().indexOf(pre) !== 0) issue_(I, 'info', 'users', 'ชื่อผู้ใช้ ' + u.username + ' ไม่ได้ขึ้นต้นด้วย ' + pre, 'Audit log จะดู Role จากชื่อไม่ออก เปลี่ยนชื่อเป็น ' + pre + '… ที่หน้า Users', null, '#users');
    if (u.status !== 'disabled' && !u.pinHash && u.setupExpires && new Date(u.setupExpires) < new Date()) issue_(I, 'warn', 'users', 'รหัสเปิดใช้งานของ ' + u.username + ' หมดอายุแล้ว', 'เจ้าตัวยังไม่ได้ตั้ง PIN กด "รีเซ็ตรหัส" ที่หน้า Users เพื่อออกรหัสใหม่', null, '#users');
  });

  // 3) ตารางงาน รูปแบบกะ
  var shifts = Calc.shiftIndex(readTable_('shifts')), okCode = function (c) { c = Calc.upper(c); return !c || Calc.isOffCode(c) || c === 'C' || !!shifts[c]; };
  var sched = readTable_('schedule');
  var orphS = sched.filter(function (r) { return !E[r.empId]; });
  if (orphS.length) issue_(I, 'warn', 'schedule', 'ตารางงานของพนักงานที่ถูกลบ ' + orphS.length + ' แถว', 'ไม่มีผลกับใคร แต่ทำให้ไฟล์ใหญ่', { code: 'orphans', args: { table: 'schedule' }, label: 'ลบแถวที่ไม่มี Owner' });
  var badCode = sched.filter(function (r) { return !okCode(r.shift); });
  if (badCode.length) issue_(I, 'warn', 'schedule', 'ตารางงานใช้รหัสกะที่ไม่มีแล้ว ' + badCode.length + ' ช่อง', 'วันเหล่านั้นระบบใช้เวลาปกติของร้านแทน เช่น ' + badCode.slice(0, 3).map(function (r) { return r.date + ' ' + r.shift; }).join(', '), null, '#sched/shifts');
  var badSB = sched.filter(function (r) { return r.branch && !bcode[r.branch]; });
  if (badSB.length) issue_(I, 'warn', 'schedule', 'ตารางงานอ้างถึงสาขาที่ไม่มี ' + badSB.length + ' ช่อง', '', null, '#sched/month');
  var pats = readTable_('patterns'), orphP = pats.filter(function (r) { return !E[r.empId]; });
  if (orphP.length) issue_(I, 'info', 'schedule', 'รูปแบบกะของพนักงานที่ถูกลบ ' + orphP.length + ' แถว', '', { code: 'orphans', args: { table: 'patterns' }, label: 'ลบแถวที่ไม่มี Owner' });
  var badP = pats.filter(function (r) { return ['d0', 'd1', 'd2', 'd3', 'd4', 'd5', 'd6'].some(function (k) { return !okCode(r[k]); }); });
  if (badP.length) issue_(I, 'warn', 'schedule', 'รูปแบบกะใช้รหัสกะที่ไม่มีแล้ว ' + badP.length + ' คน', '', null, '#sched/pattern');

  // 4) ลงเวลา การลา
  var att = readTable_('attendance'), from = Calc.addDays(T, -ADMIN_CHECK_DAYS);
  var orphA = att.filter(function (a) { return !E[a.empId]; });
  if (orphA.length) issue_(I, 'warn', 'time', 'เวลาทำงานของพนักงานที่ถูกลบ ' + orphA.length + ' แถว', 'ไม่ถูกนำไปคิดเงินเดือน', { code: 'orphans', args: { table: 'attendance' }, label: 'ลบแถวที่ไม่มี Owner' });
  var open = att.filter(function (a) { return a.inTime && !a.outTime && a.date < Calc.addDays(T, -1); });
  if (open.length) issue_(I, 'warn', 'time', 'ลืมลงเวลาออก ' + open.length + ' รายการ', open.slice(0, 5).map(function (a) { return ((E[a.empId] || {}).nickname || a.empId) + ' ' + a.date; }).join(', ') + ' ยังไม่นับชั่วโมงทำงาน ให้แก้เวลาหรือให้พนักงานส่งคำขอแก้เวลา', null, '#time/att');
  var ctx = timeCtx_(), stale = 0;
  att.filter(function (a) { return a.inTime && a.date >= from && E[a.empId]; }).forEach(function (a) {
    var b = Object.assign({}, a), before = [a.planCode, a.lateMin, a.workMin, a.otMin, a.offWork].join('|');
    Calc.applyPlan(b, Calc.planFor(E[a.empId], a.date, ctx), ctx.st);
    if (before !== [b.planCode, b.lateMin, b.workMin, b.otMin, b.offWork].join('|')) stale++;
  });
  if (stale) issue_(I, 'warn', 'time', 'เวลาทำงาน ' + stale + ' รายการไม่ตรงกับตารางงานปัจจุบัน', 'สาย/OT ที่บันทึกไว้คิดจากตารางเดิม (' + ADMIN_CHECK_DAYS + ' วันล่าสุด)', { code: 'recalc', args: { days: ADMIN_CHECK_DAYS }, label: 'คิดเวลาทำงานใหม่' });
  ['leaves', 'timefix'].forEach(function (t) {
    var rows = readTable_(t), orph = rows.filter(function (r) { return !E[r.empId]; });
    if (orph.length) issue_(I, 'info', 'time', TABLES[t].tab + ' ของพนักงานที่ถูกลบ ' + orph.length + ' แถว', '', { code: 'orphans', args: { table: t }, label: 'ลบแถวที่ไม่มี Owner' });
    var old = rows.filter(function (r) { return r.status === 'รออนุมัติ' && String(r.createdAt || r.updatedAt).slice(0, 10) < Calc.addDays(T, -7); });
    if (old.length) issue_(I, 'info', 'time', TABLES[t].tab + ' รออนุมัติเกิน 7 วัน ' + old.length + ' รายการ', '', null, '#approve');
  });

  // 5) สต็อก
  var items = byId_(readTable_('items')), moves = readTable_('moves');
  var orphM = moves.filter(function (m) { return !items[m.itemId]; });
  if (orphM.length) issue_(I, 'warn', 'stock', 'รายการสต็อกของสินค้าที่ถูกลบ ' + orphM.length + ' แถว', 'มูลค่าเหล่านี้ไม่ถูกนับในต้นทุน', { code: 'orphans', args: { table: 'moves' }, label: 'ลบแถวที่ไม่มีสินค้า' });
  var badMB = moves.filter(function (m) { return !bcode[m.branch]; });
  if (badMB.length) issue_(I, 'warn', 'stock', 'รายการสต็อกที่ไม่มีสาขา ' + badMB.length + ' แถว', 'ยอดคงเหลือของสาขาจะไม่ครบ (มักเป็นข้อมูลจากรุ่นก่อนหลายสาขา)', bcode.B01 || branches[0] ? { code: 'assignBranch', args: { table: 'moves', branch: (branches[0] || {}).code }, label: 'ใส่เป็นสาขา ' + (branches[0] || {}).code } : null);
  var tr = {};
  moves.filter(function (m) { return m.type === 'โอนออก' || m.type === 'โอนเข้า'; }).forEach(function (m) { var k = m.ref + '|' + m.itemId; (tr[k] = tr[k] || {})[m.type] = m; });
  var unpaired = Object.keys(tr).filter(function (k) { return !tr[k]['โอนออก'] || !tr[k]['โอนเข้า']; });
  if (unpaired.length) issue_(I, 'warn', 'stock', 'การโอนสต็อกไม่ครบคู่ ' + unpaired.length + ' รายการ', 'ของหายจากสาขาหนึ่งแต่ไม่เข้าอีกสาขา: ' + unpaired.slice(0, 4).map(function (k) { return k.split('|')[0]; }).join(', '), { code: 'pairTransfers', label: 'สร้างรายการคู่ที่ขาด' });
  var bal = {};
  moves.filter(function (m) { return !m.status || m.status === 'อนุมัติ'; }).forEach(function (m) {
    var k = m.branch + '|' + m.itemId, q = Number(m.qty) || 0;
    bal[k] = (bal[k] || 0) + (['รับเข้า', 'ปรับยอด', 'โอนเข้า'].indexOf(m.type) >= 0 ? q : -q);
  });
  var neg = Object.keys(bal).filter(function (k) { return bal[k] < -0.001 && items[k.split('|')[1]]; });
  if (neg.length) issue_(I, 'warn', 'stock', 'สต็อกติดลบ ' + neg.length + ' รายการ', neg.slice(0, 5).map(function (k) { var p = k.split('|'); return p[0] + ' ' + items[p[1]].name + ' ' + Math.round(bal[k] * 100) / 100; }).join(', ') + ' มักเกิดจากลืมบันทึกรับเข้า', null, '#stock/onhand');

  // 6) บัญชี
  var sales = readTable_('sales'), sk = {}, dup = 0;
  sales.forEach(function (s) { var k = s.date + '|' + s.branch; if (sk[k]) dup++; sk[k] = 1; });
  if (dup) issue_(I, 'error', 'acct', 'ปิดยอดขายซ้ำวันเดียวกัน ' + dup + ' รายการ', 'ยอดขายและกำไรจะสูงเกินจริง', { code: 'dedupeSales', label: 'เก็บรายการล่าสุด ลบรายการซ้ำ' });
  var noBrSales = sales.filter(function (x) { return !bcode[x.branch]; });
  if (noBrSales.length) issue_(I, 'warn', 'acct', 'ยอดขายที่ไม่มีสาขา ' + noBrSales.length + ' วัน', 'ไม่ถูกนับในงบของสาขาใด (มักเป็นข้อมูลจากรุ่นที่ยังมีสาขาเดียว)', branches[0] ? { code: 'assignBranch', args: { table: 'sales', branch: branches[0].code }, label: 'ใส่เป็นสาขา ' + branches[0].code } : null, '#acct/sales');
  var miss = [];
  branches.filter(function (b) { return b.status !== 'ปิด'; }).forEach(function (b) {
    for (var i = 1; i <= 7; i++) { var d = Calc.addDays(T, -i); if ((!b.openDate || b.openDate <= d) && !sk[d + '|' + b.code]) miss.push(b.code + ' ' + d); }
  });
  if (miss.length) issue_(I, 'info', 'acct', 'ยังไม่ปิดยอดขาย ' + miss.length + ' วัน (7 วันล่าสุด)', miss.slice(0, 6).join(', '), null, '#acct/sales');
  var badEB = readTable_('expenses').filter(function (x) { return x.branch && !bcode[x.branch]; });
  if (badEB.length) issue_(I, 'warn', 'acct', 'รายจ่ายอ้างถึงสาขาที่ไม่มี ' + badEB.length + ' แถว', 'ไม่ถูกนับในงบของสาขาใด', null, '#acct/exp');
  var prev = Calc.addDays(T.slice(0, 7) + '-01', -1).slice(0, 7);
  if (Number(T.slice(8)) > 5 && !readTable_('payroll').some(function (p) { return p.period === prev && p.status === 'ปิดงวดแล้ว'; })) issue_(I, 'info', 'payroll', 'ยังไม่ปิดงวดเงินเดือน ' + prev, 'ค่าแรงในงบกำไรขาดทุนยังเป็นประมาณการ', null, '#pay');

  // 7) ตั้งค่า
  var badHol = String(st.holidays || '').split(/\n/).map(function (x) { return x.trim(); }).filter(function (x) { return x && !/^\d{4}-\d{2}-\d{2}/.test(x); });
  if (badHol.length) issue_(I, 'warn', 'settings', 'วันหยุดอ่านไม่ได้ ' + badHol.length + ' บรรทัด', badHol.slice(0, 3).join(' / ') + ' ใช้รูปแบบ 2026-12-05 ชื่อวันหยุด', null, '#set/holidays');
  var y = T.slice(0, 4);
  if (!String(st.holidays || '').split(/\n/).some(function (x) { return x.trim().indexOf(String(Number(y) + (T.slice(5) > '11-15' ? 1 : 0))) === 0; })) issue_(I, 'info', 'settings', 'ยังไม่ได้ใส่วันหยุดตามประเพณีปี ' + (Number(y) + (T.slice(5) > '11-15' ? 1 : 0)), 'ค่าทำงานวันหยุดจะไม่ถูกคิด', null, '#set/holidays');
  if (!Number(st.minWage)) issue_(I, 'info', 'settings', 'ยังไม่ได้ใส่ค่าแรงขั้นต่ำ', 'ระบบเตือนค่าจ้างต่ำกว่าขั้นต่ำไม่ได้', null, '#set/rules');

  // 8) LINE
  var hasToken = !!props.getProperty('LINE_TOKEN'), lineOn = Calc.bool(st.lineApprovals) || (st.lineClock && st.lineClock !== 'off') || Calc.bool(st.lineDaily);
  if (hasToken) {
    var rec = accounts_().filter(function (a) { return a.lineUserId; });
    if (!rec.length) issue_(I, 'warn', 'line', 'มี LINE token แต่ยังไม่มีใครผูก LINE', 'แจ้งเตือนจะไม่ถูกส่ง', null, '#notify');
    var fails = readTable_('notify').filter(function (n) { return n.status === 'failed' && String(n.at).slice(0, 10) >= Calc.addDays(T, -3); });
    if (fails.length) issue_(I, 'warn', 'line', 'ส่ง LINE ไม่สำเร็จ ' + fails.length + ' ครั้ง (3 วันล่าสุด)', fails[fails.length - 1].error, null, '#notify');
    if (Calc.bool(st.lineDaily) && !hasTrigger_('dailySummary')) issue_(I, 'warn', 'line', 'เปิดสรุปรายวันแต่ยังไม่มีตัวตั้งเวลา', '', { code: 'installTriggers', label: 'ติดตั้งตัวตั้งเวลา' });
  } else if (lineOn) issue_(I, 'info', 'line', 'เปิดแจ้งเตือน LINE แต่ยังไม่ได้ใส่ Channel access token', '', null, '#notify');

  // 9) ข้อผิดพลาดของระบบ
  var errs = readTable_('log').filter(function (l) { return l.action === 'ERROR'; }).slice(-30).reverse();
  var recent = errs.filter(function (l) { return String(l.at).slice(0, 10) >= Calc.addDays(T, -7); });
  if (recent.length) issue_(I, 'warn', 'errors', 'ระบบเกิดข้อผิดพลาด ' + recent.length + ' ครั้ง (7 วันล่าสุด)', recent[0].detail, null, '');
  return { version: APP_VERSION, at: new Date().toISOString(), ms: Date.now() - t0, stats: stats, issues: I, errors: errs, sessionEpoch: sessionEpoch_() };
}

function hasTrigger_(fn) {
  try { return ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === fn; }); } catch (e) { return false; }
}

/** ลบแถวที่ตรงเงื่อนไข เขียนข้อมูลที่เหลือกลับทั้งชีตครั้งเดียว */
function removeWhere_(table, pred) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var sh = sheet_(table), last = sh.getLastRow(), cols = sh.getLastColumn();
    if (last <= HEADER_ROWS) return 0;
    var keys = keysOf_(sh), data = sh.getRange(HEADER_ROWS + 1, 1, last - HEADER_ROWS, cols).getDisplayValues();
    var keep = data.filter(function (r) { var o = {}; keys.forEach(function (k, i) { o[k] = r[i]; }); return r[0] === '' || !pred(o); });
    var n = data.length - keep.length;
    if (!n) return 0;
    sh.getRange(HEADER_ROWS + 1, 1, data.length, cols).clearContent();
    if (keep.length) sh.getRange(HEADER_ROWS + 1, 1, keep.length, cols).setNumberFormat('@').setValues(keep);
    return n;
  } finally { lock.releaseLock(); }
}

var ORPHAN_KEY = { schedule: 'empId', patterns: 'empId', attendance: 'empId', leaves: 'empId', timefix: 'empId', moves: 'itemId' };
function adminFix_(sess, code, args) {
  requirePerm_(sess, ['admin']);
  args = args || {};
  var msg = '', s = Object.assign({}, sess, { via: 'admin' });
  switch (code) {
    case 'structure':
      Object.keys(BOOKS).forEach(function (k) { book_(k, true); });
      Object.keys(TABLES).forEach(function (t) { sheet_(t); });
      if (!readTable_('branches').length) upsertMany_('branches', [Object.assign({ by: 'admin' }, FIRST_BRANCH)]);
      if (!readTable_('shifts').length) upsertMany_('shifts', DEFAULT_SHIFTS.map(function (x) { return Object.assign({ id: 'shift_' + x.code, by: 'admin' }, x); }));
      buildIndex_();
      msg = 'สร้าง/เติมไฟล์ ชีต และคอลัมน์ครบแล้ว'; break;
    case 'orphans': {
      var key = ORPHAN_KEY[args.table];
      if (!key) fail_('ตารางนี้ล้างไม่ได้');
      var ref = byId_(readTable_(key === 'itemId' ? 'items' : 'employees'));
      var n = removeWhere_(args.table, function (r) { return !ref[r[key]]; });
      msg = 'ลบ ' + n + ' แถวใน ' + TABLES[args.table].tab; break;
    }
    case 'recalc': {
      var from = Calc.addDays(today_(), -(Number(args.days) || ADMIN_CHECK_DAYS));
      var r = recalcAttendance_(s, function (a) { return a.date >= from; });
      msg = 'คิดเวลาทำงานใหม่ ' + r.recalc + ' รายการ'; break;
    }
    case 'dedupeSales': {
      var latest = {};
      readTable_('sales').forEach(function (x) { var k = x.date + '|' + x.branch; if (!latest[k] || String(x.updatedAt) > String(latest[k].updatedAt)) latest[k] = x; });
      var keepIds = {};
      Object.keys(latest).forEach(function (k) { keepIds[latest[k].id] = 1; });
      msg = 'ลบยอดขายซ้ำ ' + removeWhere_('sales', function (x) { return !keepIds[x.id]; }) + ' รายการ'; break;
    }
    case 'pairTransfers': {
      var tr = {}, add = [];
      readTable_('moves').filter(function (m) { return m.type === 'โอนออก' || m.type === 'โอนเข้า'; }).forEach(function (m) { var k = m.ref + '|' + m.itemId; (tr[k] = tr[k] || {})[m.type] = m; });
      Object.keys(tr).forEach(function (k) {
        var o = tr[k]['โอนออก'], i = tr[k]['โอนเข้า'], src = o || i;
        if (o && i) return;
        add.push({ date: src.date, branch: src.toBranch, toBranch: src.branch, itemId: src.itemId, qty: src.qty, unitCost: src.unitCost, ref: src.ref, type: o ? 'โอนเข้า' : 'โอนออก', note: 'สร้างโดย Admin ให้ครบคู่', by: s.name, createdAt: new Date().toISOString() });
      });
      if (add.length) upsertMany_('moves', add);
      msg = 'สร้างรายการคู่ ' + add.length + ' รายการ'; break;
    }
    case 'assignBranch': {
      if (!branchByCode_(args.branch)) fail_('ไม่พบสาขา ' + args.branch);
      var rows = readTable_(args.table).filter(function (x) { return !branchByCode_(x.branch); }).map(function (x) { return { id: x.id, branch: args.branch }; });
      if (rows.length) upsertMany_(args.table, rows);
      msg = 'ใส่สาขา ' + args.branch + ' ให้ ' + rows.length + ' แถว'; break;
    }
    case 'cleanAccess': {
      var codes = {};
      branchesAll_().forEach(function (b) { codes[b.code] = 1; });
      var fixRows = readTable_('employees').filter(function (e) { return e.branchAccess && e.branchAccess !== '*'; }).map(function (e) { return { id: e.id, branchAccess: splitList_(e.branchAccess).filter(function (c) { return codes[c]; }).join(','), old: e.branchAccess }; }).filter(function (x) { return x.branchAccess !== x.old; });
      fixRows.forEach(function (x) { delete x.old; });
      if (fixRows.length) upsertMany_('employees', fixRows);
      msg = 'แก้สาขาที่ดูแลของ ' + fixRows.length + ' คน'; break;
    }
    case 'disableUser':
      upsertMany_('users', [{ id: args.id, status: 'disabled' }]);
      msg = 'ปิดใช้งานบัญชีแล้ว'; break;
    case 'resetPerms': {
      var all = getSettings_(); all.perms = JSON.stringify(DEFAULT_PERMS); saveSettings_(all);
      msg = 'คืนค่าสิทธิ์เริ่มต้นแล้ว'; break;
    }
    case 'clearCache':
      CacheService.getScriptCache().removeAll(['settings']);
      _bookCache = {};
      msg = 'ล้างแคชแล้ว'; break;
    case 'unlockAll': unlockLogin(); msg = 'ปลดล็อกการเข้าสู่ระบบทุกบัญชีแล้ว'; break;
    case 'logoutAll': {
      var ep = String(Number(sessionEpoch_()) + 1);
      PropertiesService.getScriptProperties().setProperty('SESSION_EPOCH', ep);
      if (sess.token) { var c = CacheService.getScriptCache(), v = c.get('s_' + sess.token); if (v) { var o = JSON.parse(v); o.ep = ep; c.put('s_' + sess.token, JSON.stringify(o), SESSION_SECONDS); } }
      msg = 'ทุกคนต้องเข้าสู่ระบบใหม่ (ยกเว้นคุณ)'; break;
    }
    case 'rebuildIndex': buildIndex_(); msg = 'สร้างหน้าสารบัญใหม่แล้ว'; break;
    case 'installTriggers': msg = installTriggers_(); break;
    default: fail_('ไม่รู้จักคำสั่งแก้ไข: ' + code);
  }
  log_(s, 'แก้ไขระบบ', code, msg + (args.table ? ' (' + args.table + ')' : ''));
  return { code: code, message: msg };
}

/** บันทึกข้อผิดพลาดของระบบ (ไม่ใช่ข้อความเตือนผู้ใช้) ลง Audit log ไม่เกิน 1 ครั้งต่อ 5 นาทีต่อข้อความ */
function logError_(action, err, sess) {
  try {
    var m = String((err && err.message) || err).slice(0, 300), key = 'err_' + Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, m)).slice(0, 20);
    var c = CacheService.getScriptCache();
    if (c.get(key)) return;
    c.put(key, '1', 300);
    log_(sess || { name: 'system', role: '', code: 'system', via: 'system' }, 'ERROR', action || '', m + (err && err.stack ? ' | ' + String(err.stack).split('\n').slice(0, 3).join(' ') : ''));
  } catch (e) { /* ignore */ }
}


  /* ----- 14_Line.gs ----- */
/**
 * แจ้งเตือน LINE ผ่าน LINE Messaging API (LINE Notify ปิดบริการแล้วตั้งแต่ 31 มี.ค. 2025)
 * - รายการรออนุมัติ (ลา OT ทำงานวันหยุด แก้เวลา ปรับสต็อก) ส่งหาคนที่มีสิทธิ์อนุมัติของสาขานั้น พร้อมปุ่ม อนุมัติ / ไม่อนุมัติ
 *   กดแล้วเปิดหน้ายืนยันของ Apps Script (ลิงก์ใช้ได้ครั้งเดียว ของคนนั้นคนเดียว หมดอายุ 72 ชม.) ระบบตรวจสิทธิ์และสาขาเหมือนกดในเว็บ
 * - ลงเวลาเข้า/ออก: ส่งทุกครั้ง หรือเฉพาะที่ผิดปกติ (สาย ทำงานวันหยุด ต่างสาขา OT ออกก่อนเวลา)
 * - สรุปรายวัน: ตั้งเวลาส่งทุกวัน
 * Channel access token เก็บใน Script Properties (LINE_TOKEN) ไม่อยู่ในชีตและไม่ส่งกลับไปหน้าเว็บ
 * Webhook (URL เดียวกับ /exec) ใช้ผูกบัญชี: ส่ง "link 123456" หา LINE OA (หรือในกลุ่ม) ระบบจำ LINE ID ให้
 */
var LINE_API = 'https://api.line.me/v2/bot/message/';
var LINE_TTL_H = 72;
var PENDING = 'รออนุมัติ';
/** ช่องสถานะที่ต้องอนุมัติของแต่ละตาราง และสิทธิ์ที่ใช้ */
var APPROVE_FIELDS = { leaves: [['status', 'approve_time']], timefix: [['status', 'approve_time']], attendance: [['otStatus', 'approve_time'], ['offStatus', 'approve_time']], moves: [['status', 'approve_stock']] };

function lineToken_() { return PropertiesService.getScriptProperties().getProperty('LINE_TOKEN') || ''; }
function execUrl_() { try { return ScriptApp.getService().getUrl() || ''; } catch (e) { return ''; } }

function lineCall_(path, body) {
  var token = lineToken_();
  if (!token) return { ok: false, error: 'ยังไม่ได้ใส่ Channel access token' };
  try {
    var res = UrlFetchApp.fetch(LINE_API + path, { method: 'post', contentType: 'application/json', headers: { Authorization: 'Bearer ' + token }, payload: JSON.stringify(body), muteHttpExceptions: true });
    var code = res.getResponseCode();
    return { ok: code >= 200 && code < 300, code: code, error: code >= 200 && code < 300 ? '' : ('LINE ' + code + ': ' + res.getContentText()).slice(0, 300) };
  } catch (e) { return { ok: false, error: String(e.message || e).slice(0, 300) }; }
}
function linePush_(to, messages) { return lineCall_('push', { to: to, messages: messages }); }
function lineReply_(replyToken, text) { return lineCall_('reply', { replyToken: replyToken, messages: [{ type: 'text', text: text }] }); }

function notifyLog_(row) {
  try { row.id = row.id || Utilities.getUuid(); row.at = row.at || new Date().toISOString(); upsertMany_('notify', [row]); } catch (e) { /* ไม่ให้การแจ้งเตือนทำให้งานหลักล้ม */ }
}
function wants_(acct, ev) { return !!acct.lineUserId && splitList_(acct.lineEvents).indexOf(ev) >= 0; }

/* ---------------- อนุมัติจาก LINE ---------------- */
function approvalText_(table, row, field, emps) {
  var e = emps[row.empId] || {}, who = e.nickname || e.firstName || '';
  if (table === 'leaves') return { title: row.type || 'ใบลา', who: who, lines: [row.dateFrom + (row.dateTo && row.dateTo !== row.dateFrom ? ' ถึง ' + row.dateTo : '') + ' (' + (row.days || 1) + ' วัน)', row.reason ? 'เหตุผล: ' + row.reason : ''] };
  if (table === 'timefix') return { title: 'ขอแก้เวลา', who: who, lines: [row.date + (row.inTime ? ' เข้า ' + row.inTime : '') + (row.outTime ? ' ออก ' + row.outTime : ''), row.reason ? 'เหตุผล: ' + row.reason : ''] };
  if (table === 'attendance' && field === 'otStatus') return { title: 'OT ' + row.otMin + ' นาที', who: who, lines: [row.date + ' ออก ' + (row.outTime || '-') + ' (กะเลิก ' + (row.planEnd || '-') + ')'] };
  if (table === 'attendance') return { title: 'ทำงานวันหยุด', who: who, lines: [row.date + ' เข้า ' + (row.inTime || '-') + ' ตารางงานวันนี้เป็นวันหยุด'] };
  if (table === 'moves') { var it = byId_(readTable_('items'))[row.itemId] || {}; return { title: 'ปรับยอดสต็อก', who: it.name || '', lines: [(Number(row.qty) > 0 ? '+' : '') + row.qty + ' ' + (it.unit || '') + ' มูลค่า ' + Math.round(Number(row.qty) * Number(row.unitCost || it.cost || 0)) + ' บาท', row.note || '', 'บันทึกโดย ' + (row.by || '')] }; }
  return { title: 'รออนุมัติ', who: who, lines: [] };
}
function branchOfRow_(table, row, emps) { return row.branch || (emps[row.empId] || {}).branch || ''; }

function approvalFlex_(info, branchName, token) {
  var url = execUrl_(), web = getSettings_().webUrl || '';
  var btn = function (label, d, style) { return { type: 'button', style: style, height: 'sm', action: { type: 'uri', label: label, uri: url + '?action=lineAct&t=' + token + '&d=' + d } }; };
  var footer = [btn('อนุมัติ', 'a', 'primary'), btn('ไม่อนุมัติ', 'r', 'secondary')];
  if (web) footer.push({ type: 'button', style: 'link', height: 'sm', action: { type: 'uri', label: 'เปิดในระบบ', uri: web.split('#')[0] + '#approve' } });
  return { type: 'flex', altText: 'รออนุมัติ: ' + info.who + ' ' + info.title, contents: { type: 'bubble', size: 'kilo',
    header: { type: 'box', layout: 'vertical', backgroundColor: '#B0384A', paddingAll: '12px', contents: [{ type: 'text', text: 'รออนุมัติ · ' + info.title, color: '#FFFFFF', weight: 'bold', size: 'md', wrap: true }] },
    body: { type: 'box', layout: 'vertical', spacing: 'sm', contents: [{ type: 'text', text: info.who || '-', weight: 'bold', size: 'lg', wrap: true }, { type: 'text', text: branchName || '', size: 'sm', color: '#58655D' }].concat(info.lines.filter(function (l) { return l; }).map(function (l) { return { type: 'text', text: String(l).slice(0, 200), size: 'sm', wrap: true }; })) },
    footer: { type: 'box', layout: 'vertical', spacing: 'sm', contents: footer } } };
}

/** ส่งแจ้งเตือนรายการรออนุมัติหาทุกคนที่อนุมัติได้ (ตามสิทธิ์และสาขา) และขอรับแจ้งเตือนนี้ */
function notifyApproval_(table, row, field) {
  try {
    var st = getSettings_();
    if (!Calc.bool(st.lineApprovals) || !lineToken_()) return 0;
    var perm = (APPROVE_FIELDS[table].filter(function (f) { return f[0] === field; })[0] || [])[1];
    var emps = byId_(readTable_('employees')), branch = branchOfRow_(table, row, emps), b = branchByCode_(branch) || {};
    var info = approvalText_(table, row, field, emps), sent = 0;
    accounts_().filter(function (a) { return wants_(a, 'approvals') && can_(a.sess, [perm]) && inScope_(a.sess, branch) && a.sess.empId !== row.empId; }).forEach(function (a) {
      var token = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '').slice(0, 8);
      var r = linePush_(a.lineUserId, [approvalFlex_(info, b.name || branch, token)]);
      notifyLog_({ id: token, kind: 'approval', refTable: table, refId: row.id, refField: field, branch: branch, to: a.ref, toName: a.name, title: info.who + ' ' + info.title, status: r.ok ? 'sent' : 'failed', error: r.error, expiresAt: new Date(Date.now() + LINE_TTL_H * 3600000).toISOString() });
      if (r.ok) sent++;
    });
    return sent;
  } catch (e) { logError_('notifyApproval', e); return 0; }
}

/** หลังบันทึก: หารายการที่เพิ่งกลายเป็น "รออนุมัติ" แล้วส่งแจ้งเตือน / รายการที่ตัดสินแล้วปิดลิงก์ใน LINE */
function afterWriteNotify_(table, rows, old) {
  var fields = APPROVE_FIELDS[table];
  if (!fields) return;
  rows.forEach(function (r) {
    var o = old[r.id] || {}, m = Object.assign({}, o, r);
    fields.forEach(function (f) {
      var k = f[0];
      if (m[k] === PENDING && o[k] !== PENDING && (table !== 'attendance' || k !== 'otStatus' || Number(m.otMin) > 0)) notifyApproval_(table, m, k);
      if (o[k] === PENDING && m[k] && m[k] !== PENDING) closeTokens_(table, r.id, k, m[k] + ' โดย ' + (m.decidedBy || r.by || ''));
    });
  });
}
function closeTokens_(table, id, field, result) {
  try {
    var rows = readTable_('notify').filter(function (n) { return n.kind === 'approval' && n.refTable === table && n.refId === id && n.refField === field && n.status === 'sent'; });
    if (rows.length) upsertMany_('notify', rows.map(function (n) { return { id: n.id, status: 'closed', result: result }; }));
  } catch (e) { /* ignore */ }
}

/** หน้าที่เปิดจากปุ่มใน LINE: ตรวจโทเคนแล้วอนุมัติในนามคนที่ได้รับข้อความ */
function lineActPage_(p) {
  var t = String(p.t || ''), d = p.d === 'r' ? 'ไม่อนุมัติ' : 'อนุมัติ';
  var n = t ? readTable_('notify').filter(function (x) { return x.id === t && x.kind === 'approval'; })[0] : null;
  if (!n) return linePage_('ลิงก์ไม่ถูกต้อง', 'ไม่พบรายการนี้ อาจถูกลบไปแล้ว', 'bad');
  if (n.status === 'used' || n.status === 'closed') return linePage_('รายการนี้พิจารณาแล้ว', n.result || '', 'info');
  if (new Date(n.expiresAt) < new Date()) { upsertMany_('notify', [{ id: n.id, status: 'expired' }]); return linePage_('ลิงก์หมดอายุ', 'เปิดระบบเพื่ออนุมัติในหน้า Approvals', 'bad'); }
  var acct = accountByRef_(n.to);
  if (!acct) return linePage_('บัญชีผู้รับถูกปิดใช้งาน', '', 'bad');
  var st = getSettings_();
  if (Calc.bool(st.lineRequirePin) && !p.pin) return linePinPage_(n, p.d);
  if (Calc.bool(st.lineRequirePin)) {
    try { verifyAccountPin_(acct, String(p.pin)); } catch (e) { return linePinPage_(n, p.d, e.message); }
  }
  var cur = readTable_(n.refTable).filter(function (x) { return x.id === n.refId; })[0];
  if (!cur) return linePage_('ไม่พบรายการ', 'รายการถูกลบไปแล้ว', 'bad');
  if (cur[n.refField] !== PENDING) { upsertMany_('notify', [{ id: n.id, status: 'closed', result: cur[n.refField] + ' โดย ' + (cur.decidedBy || '') }]); return linePage_('รายการนี้พิจารณาแล้ว', cur[n.refField] + ' โดย ' + (cur.decidedBy || '-'), 'info'); }
  var sess = Object.assign({}, acct.sess, { via: 'LINE' }), row = { id: n.refId };
  row[n.refField] = d;
  try { write_(sess, { op: 'upsertMany', table: n.refTable, rows: [row] }); }
  catch (e) { return linePage_('ทำรายการไม่ได้', e.message, 'bad'); }
  upsertMany_('notify', [{ id: n.id, status: 'used', usedAt: new Date().toISOString(), result: d + ' โดย ' + acct.name }]);
  closeTokens_(n.refTable, n.refId, n.refField, d + ' โดย ' + acct.name);
  return linePage_(d === 'อนุมัติ' ? 'อนุมัติแล้ว' : 'ไม่อนุมัติแล้ว', n.title + '\nโดย ' + acct.name + ' ผ่าน LINE', d === 'อนุมัติ' ? 'ok' : 'info');
}
function verifyAccountPin_(acct, pin) {
  if (acct.ref === 'owner') { if (hashPin_('owner', pin) !== PropertiesService.getScriptProperties().getProperty('OWNER_PIN_HASH')) fail_('PIN ไม่ถูกต้อง'); return; }
  var kind = acct.ref.slice(0, 2), id = acct.ref.slice(2);
  var row = readTable_(kind === 'u:' ? 'users' : 'employees').filter(function (x) { return x.id === id; })[0];
  if (!row) fail_('ไม่พบบัญชี');
  checkPin_(row, pin);
}
function esc_(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function linePageHtml_(title, body, tone, inner) {
  var c = { ok: '#25744A', bad: '#B03535', info: '#55615A' }[tone] || '#55615A', web = getSettings_().webUrl || '';
  return '<!doctype html><html lang="th"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + esc_(title) + '</title>' +
    '<style>body{margin:0;font:16px/1.6 system-ui,-apple-system,"Noto Sans Thai",sans-serif;background:#F1F4F1;color:#14201A;display:grid;place-items:center;min-height:100vh;padding:16px;box-sizing:border-box}main{background:#fff;border-radius:16px;padding:28px 22px;max-width:380px;width:100%;text-align:center;box-shadow:0 1px 3px rgba(0,0,0,.08)}h1{font-size:22px;margin:8px 0;color:' + c + '}p{white-space:pre-line;color:#58655D;margin:6px 0}.i{width:56px;height:56px;border-radius:50%;background:' + c + ';color:#fff;display:inline-grid;place-items:center;font-size:30px}a,button{display:inline-block;margin-top:16px;padding:12px 18px;border-radius:12px;border:1px solid #D4DDD6;background:#fff;color:#14201A;text-decoration:none;font:inherit}button{background:#1E4D38;color:#fff;border:0;width:100%}input{font:inherit;font-size:24px;letter-spacing:8px;text-align:center;width:100%;padding:10px;border:1px solid #D4DDD6;border-radius:12px;box-sizing:border-box;margin-top:12px}</style></head><body><main>' +
    '<div class="i">' + (tone === 'ok' ? '✓' : tone === 'bad' ? '!' : 'i') + '</div><h1>' + esc_(title) + '</h1><p>' + esc_(body) + '</p>' + (inner || '') + (web ? '<a href="' + esc_(web.split('#')[0] + '#approve') + '" target="_top">เปิดระบบ</a>' : '') + '</main></body></html>';
}
function linePage_(title, body, tone) { return HtmlService.createHtmlOutput(linePageHtml_(title, body, tone)).setTitle(title).addMetaTag('viewport', 'width=device-width, initial-scale=1'); }
function linePinPage_(n, d, err) {
  var form = '<form method="post" action="' + esc_(execUrl_()) + '" target="_top"><input type="hidden" name="action" value="lineAct"><input type="hidden" name="t" value="' + esc_(n.id) + '"><input type="hidden" name="d" value="' + (d === 'r' ? 'r' : 'a') + '"><input name="pin" type="password" inputmode="numeric" autocomplete="off" maxlength="8" placeholder="PIN" required>' + (err ? '<p style="color:#B03535">' + esc_(err) + '</p>' : '') + '<button type="submit">ยืนยัน' + (d === 'r' ? 'ไม่อนุมัติ' : 'อนุมัติ') + '</button></form>';
  return HtmlService.createHtmlOutput(linePageHtml_('ใส่ PIN เพื่อยืนยัน', n.title, 'info', form)).setTitle('ยืนยันด้วย PIN').addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/* ---------------- แจ้งลงเวลา ---------------- */
function notifyClock_(emp, rec, type, at, plan, other) {
  try {
    var st = getSettings_(), mode = st.lineClock || 'off';
    if (mode === 'off' || !lineToken_()) return 0;
    var flags = [];
    if (type === 'in' && Number(rec.lateMin) > 0) flags.push('สาย ' + rec.lateMin + ' นาที');
    if (type === 'in' && rec.offWork === 'true') flags.push('ทำงานวันหยุด');
    if (other) flags.push('ตารางงานอยู่สาขา ' + plan.branch);
    if (type === 'out' && Number(rec.otMin) > 0) flags.push('OT ' + rec.otMin + ' นาที');
    if (type === 'out' && plan && !plan.off && plan.end && Calc.toMin(rec.outTime) < Calc.toMin(plan.end) - 15 && Calc.toMin(rec.outTime) > Calc.toMin(rec.inTime)) flags.push('ออกก่อนเวลา (กะเลิก ' + plan.end + ')');
    var ex = flags.length > 0;
    if (mode === 'exceptions' && !ex) return 0;
    var who = emp.nickname || emp.firstName || emp.code, time = type === 'in' ? rec.inTime : rec.outTime;
    var text = (type === 'in' ? '🟢 เข้างาน ' : '🔵 ออกงาน ') + time + ' · ' + who + '\n' + at.branch.name + (plan && !plan.off && plan.start ? ' · กะ ' + (plan.code || '') + ' ' + plan.start + '–' + plan.end : plan && plan.off ? ' · วันหยุดตามตาราง' : '') + (type === 'out' && rec.workMin ? '\nทำงาน ' + Math.floor(rec.workMin / 60) + ' ชม. ' + (rec.workMin % 60) + ' นาที' : '') + (ex ? '\n⚠️ ' + flags.join(' · ') : '');
    var sent = 0;
    accounts_().filter(function (a) { return (wants_(a, 'clock') || (ex && wants_(a, 'clockEx'))) && can_(a.sess, ['time', 'approve_time']) && inScope_(a.sess, at.branch.code) && a.sess.empId !== emp.id; }).forEach(function (a) {
      var r = linePush_(a.lineUserId, [{ type: 'text', text: text }]);
      notifyLog_({ kind: 'clock', refTable: 'attendance', refId: rec.id, branch: at.branch.code, to: a.ref, toName: a.name, title: who + (type === 'in' ? ' เข้างาน ' : ' ออกงาน ') + time + (ex ? ' (' + flags.join(', ') + ')' : ''), status: r.ok ? 'sent' : 'failed', error: r.error });
      if (r.ok) sent++;
    });
    return sent;
  } catch (e) { logError_('notifyClock', e); return 0; }
}

/* ---------------- สรุปรายวัน (ตั้งเวลา) ---------------- */
function dailySummary() {
  var st = getSettings_();
  if (!Calc.bool(st.lineDaily) || !lineToken_()) return 0;
  var T = today_(), ctx = timeCtx_(), emps = activeEmps_(), att = readTable_('attendance').filter(function (a) { return a.date === T; });
  var sales = readTable_('sales').filter(function (s) { return s.date === T; }), leaves = readTable_('leaves');
  var pend = { leaves: readTable_('leaves'), timefix: readTable_('timefix'), attendance: readTable_('attendance'), moves: readTable_('moves') };
  var E = byId_(emps), sent = 0;
  var perBranch = {};
  branchesActive_().forEach(function (b) {
    var plan = emps.map(function (e) { return { e: e, p: Calc.planFor(e, T, ctx) }; }).filter(function (x) { return !x.p.off && x.p.source !== 'ค่าตั้งต้น' && x.p.branch === b.code && !leaves.some(function (l) { return l.empId === x.e.id && l.status === 'อนุมัติ' && l.dateFrom <= T && (l.dateTo || l.dateFrom) >= T; }); });
    var came = plan.filter(function (x) { return att.some(function (a) { return a.empId === x.e.id; }); });
    var late = att.filter(function (a) { return a.branch === b.code && Number(a.lateMin) > 0; });
    var s = sales.filter(function (x) { return x.branch === b.code; })[0];
    perBranch[b.code] = '📍 ' + b.name + '\nมาทำงาน ' + came.length + '/' + plan.length + ' คน' + (late.length ? ' · สาย ' + late.length : '') + (plan.length > came.length ? '\nไม่พบการลงเวลา: ' + plan.filter(function (x) { return came.indexOf(x) < 0; }).map(function (x) { return x.e.nickname || x.e.code; }).join(', ') : '') + '\nยอดขาย: ' + (s ? Number(s.total || 0).toLocaleString('en-US') + ' บาท (' + (s.cups || 0) + ' แก้ว)' : 'ยังไม่ปิดยอด');
  });
  accounts_().filter(function (a) { return wants_(a, 'daily'); }).forEach(function (a) {
    var codes = Object.keys(perBranch).filter(function (c) { return inScope_(a.sess, c); });
    if (!codes.length) return;
    var np = 0;
    Object.keys(APPROVE_FIELDS).forEach(function (t) { if (!pend[t]) return; APPROVE_FIELDS[t].forEach(function (f) { if (!can_(a.sess, [f[1]])) return; np += pend[t].filter(function (r) { return r[f[0]] === PENDING && inScope_(a.sess, branchOfRow_(t, r, E)) && (f[0] !== 'otStatus' || Number(r.otMin) > 0); }).length; }); });
    var text = 'สรุปวันนี้ ' + T + '\n\n' + codes.map(function (c) { return perBranch[c]; }).join('\n\n') + (np ? '\n\n📝 รออนุมัติ ' + np + ' รายการ' : '');
    var r = linePush_(a.lineUserId, [{ type: 'text', text: text.slice(0, 4900) }]);
    notifyLog_({ kind: 'daily', to: a.ref, toName: a.name, title: 'สรุปวันนี้ ' + T, status: r.ok ? 'sent' : 'failed', error: r.error });
    if (r.ok) sent++;
  });
  return sent;
}
function installTriggers_() {
  var st = getSettings_(), h = Math.min(23, Math.max(0, Number(st.lineDailyHour) || 21));
  ScriptApp.getProjectTriggers().filter(function (t) { return t.getHandlerFunction() === 'dailySummary'; }).forEach(function (t) { ScriptApp.deleteTrigger(t); });
  if (!Calc.bool(st.lineDaily)) return 'ปิดสรุปรายวันแล้ว';
  ScriptApp.newTrigger('dailySummary').timeBased().atHour(h).everyDays(1).inTimezone(TZ).create();
  return 'ตั้งเวลาสรุปรายวัน ' + h + ':00 น. ทุกวันแล้ว';
}

/* ---------------- ตั้งค่าและทดสอบ ---------------- */
function lineStatus_(sess) {
  requirePerm_(sess, ['settings', 'admin']);
  var token = lineToken_(), month = today_().slice(0, 7), log = readTable_('notify');
  var mine = log.filter(function (n) { return String(n.at).slice(0, 7) === month; });
  return {
    hasToken: !!token, tokenTail: token ? token.slice(-4) : '', webhookUrl: execUrl_(),
    sentThisMonth: mine.filter(function (n) { return n.status !== 'failed'; }).length, failedThisMonth: mine.filter(function (n) { return n.status === 'failed'; }).length,
    recipients: accounts_().filter(function (a) { return a.lineUserId; }).map(function (a) { return { ref: a.ref, name: a.name, role: ROLES[a.sess.role], events: a.lineEvents, scope: a.sess.scope }; }),
    recent: log.slice(-40).reverse().map(function (n) { return { at: n.at, kind: n.kind, toName: n.toName, title: n.title, status: n.status, error: n.error, result: n.result }; }),
    trigger: hasTrigger_('dailySummary')
  };
}
function saveLineToken_(sess, token) {
  requirePerm_(sess, ['settings', 'admin']);
  token = String(token || '').trim();
  if (token && token.length < 40) fail_('Channel access token สั้นเกินไป คัดลอกจาก LINE Developers > Messaging API > Channel access token (long-lived)');
  if (token) PropertiesService.getScriptProperties().setProperty('LINE_TOKEN', token);
  else PropertiesService.getScriptProperties().deleteProperty('LINE_TOKEN');
  log_(sess, token ? 'ตั้ง LINE token' : 'ลบ LINE token', 'notify', token ? '…' + token.slice(-4) : '');
  return { hasToken: !!token, tokenTail: token ? token.slice(-4) : '' };
}
function lineTest_(sess, ref) {
  requirePerm_(sess, ['settings', 'admin']);
  var a = accountByRef_(ref || selfRef_(sess));
  if (!a || !a.lineUserId) fail_('บัญชีนี้ยังไม่ได้ผูก LINE');
  var r = linePush_(a.lineUserId, [{ type: 'text', text: '✅ ทดสอบแจ้งเตือนจาก ' + (getSettings_().shopName || 'Café Amazon') + '\nถึง ' + a.name + ' ใช้งานได้แล้ว' }]);
  notifyLog_({ kind: 'test', to: a.ref, toName: a.name, title: 'ทดสอบ', status: r.ok ? 'sent' : 'failed', error: r.error });
  if (!r.ok) fail_('ส่งไม่สำเร็จ: ' + r.error);
  return { ok: true };
}

/** Webhook จาก LINE: ผูกบัญชีด้วยรหัส 6 หลัก (Apps Script อ่าน header ลายเซ็นไม่ได้ จึงทำได้แค่ผูกบัญชีด้วยรหัสใช้ครั้งเดียว) */
function lineWebhook_(body) {
  (body.events || []).forEach(function (ev) {
    try {
      var src = ev.source || {}, id = src.groupId || src.roomId || src.userId || '';
      if (ev.type === 'follow') return lineReply_(ev.replyToken, 'สวัสดีค่ะ ผูก LINE กับบัญชีในระบบหลังร้าน: เปิดระบบ > ชื่อของคุณ > เชื่อม LINE แล้วส่งข้อความ link ตามด้วยรหัส 6 หลัก เช่น link 123456');
      if (ev.type === 'join') return lineReply_(ev.replyToken, 'ใช้กลุ่มนี้รับแจ้งเตือน: ส่ง link ตามด้วยรหัส 6 หลักจากหน้า Users ของบัญชีที่ต้องการ');
      if (ev.type !== 'message' || !ev.message || ev.message.type !== 'text') return;
      var txt = String(ev.message.text || '').trim(), m = txt.match(/^(?:link|เชื่อม|ลงทะเบียน)\s*(\d{6})$/i);
      if (/^(?:myid|id)$/i.test(txt)) return lineReply_(ev.replyToken, 'LINE ID: ' + id);
      if (!m) return;
      var c = CacheService.getScriptCache(), ref = c.get('lnk_' + m[1]);
      if (!ref) return lineReply_(ev.replyToken, 'รหัสไม่ถูกต้องหรือหมดอายุ ขอรหัสใหม่ในระบบ (ใช้ได้ 10 นาที)');
      c.remove('lnk_' + m[1]);
      var a = accountByRef_(ref);
      setAccountLine_(ref, { lineUserId: id, lineEvents: a && a.lineEvents ? a.lineEvents : 'approvals,clockEx,daily' });
      log_({ name: a ? a.name : ref, role: a ? a.sess.role : '', code: a ? a.sess.code : '', via: 'LINE' }, 'ผูก LINE', 'notify', src.type || '');
      lineReply_(ev.replyToken, '✅ ผูก LINE กับบัญชี ' + (a ? a.name : '') + ' แล้ว จะได้รับแจ้งเตือนรายการรออนุมัติและการลงเวลาตามที่ตั้งไว้');
    } catch (e) { logError_('lineWebhook', e); }
  });
  return ContentService.createTextOutput('OK');
}


  /* ----- 15_Account.gs ----- */
/**
 * บัญชีที่เจ้าตัวตั้งรหัสเอง
 * - Owner ตั้งชื่อ user ให้แต่ละคน โดยขึ้นต้นตาม Role: owner_ admin_ hr_ mgr_ staff_ (เช่น mgr_narong, staff_aabb)
 *   Audit log จึงบอกได้ทันทีว่าใครทำ และเป็น Role อะไร
 * - Owner ไม่ตั้งรหัสให้ใคร ระบบออก "รหัสเปิดใช้งาน" 6 หลักให้ครั้งเดียว (หมดอายุ 7 วัน) Owner ยื่นให้เจ้าตัว
 *   เจ้าตัวใช้รหัสนี้ตั้ง PIN 6 หลักของตัวเองตอนเข้าใช้งานครั้งแรก ใช้ทั้งเข้าหลังร้านและลงเวลา
 * - เปลี่ยน PIN เองได้ตลอด (ต้องใส่ PIN เดิม) ลืม PIN: Owner/Admin กดรีเซ็ต ได้รหัสเปิดใช้งานใหม่ (ส่งเข้า LINE ให้ด้วยถ้าผูกไว้)
 * - Owner ไม่รู้ PIN จริงของใคร log จึงยืนยันได้ว่าเจ้าของบัญชีทำเอง
 */
var ROLE_PREFIX = { owner: 'owner_', admin: 'admin_', hr: 'hr_', manager: 'mgr_', staff: 'staff_' };
var SETUP_DAYS = 7;
var _setupCodes = {};   // รหัสเปิดใช้งานที่เพิ่งออก ส่งกลับให้ Owner เห็นครั้งเดียว (ไม่เก็บตัวรหัสจริงในชีต)

/** ชื่อ user ต้องขึ้นต้นตาม Role */
function checkUserPrefix_(username, role) {
  var pre = ROLE_PREFIX[role] || '';
  if (pre && String(username).toLowerCase().indexOf(pre) !== 0) fail_('ชื่อผู้ใช้ของ Role ' + ROLES[role] + ' ต้องขึ้นต้นด้วย ' + pre + ' เช่น ' + pre + 'narong');
}
function setupHash_(id, code) { return hashPin_('setup:' + id, code); }
function newSetupCode_() { return String(Math.floor(100000 + Math.random() * 900000)); }

/** บัญชีใหม่ / รีเซ็ต: ล้าง PIN แล้วออกรหัสเปิดใช้งาน */
function prepareSetup_(r) {
  var code = newSetupCode_();
  r.pinHash = '';
  r.setupHash = setupHash_(r.id, code);
  r.setupExpires = new Date(Date.now() + SETUP_DAYS * 86400000).toISOString();
  r.pinSetAt = '';
  _setupCodes[r.id] = code;
  return code;
}
/** สถานะที่ส่งให้หน้าเว็บ (ไม่มีรหัสจริง) */
function setupInfo_(u, o) {
  o.pending = !u.pinHash;
  o.setupExpires = !u.pinHash ? (u.setupExpires || '') : '';
  if (_setupCodes[u.id]) { o.setupCode = _setupCodes[u.id]; delete _setupCodes[u.id]; }  // แสดงครั้งเดียว
  delete o.setupHash;
  return o;
}
/** PIN 6 หลักที่เดาง่ายเกินไป */
function weakPin_(p) {
  if (/^(\d)\1{5}$/.test(p)) return true;
  var up = '0123456789012', down = '9876543210987';
  return up.indexOf(p) >= 0 || down.indexOf(p) >= 0 || p === '112233' || p === '121212';
}
function checkNewPin_(pin, pin2) {
  pin = String(pin || '').trim();
  if (!/^\d{6}$/.test(pin)) fail_('PIN ต้องเป็นตัวเลข 6 หลัก');
  if (pin2 !== undefined && String(pin2).trim() !== pin) fail_('PIN ทั้ง 2 ช่องไม่ตรงกัน');
  if (weakPin_(pin)) fail_('PIN นี้เดาง่ายเกินไป (เลขเรียง หรือเลขซ้ำ) ตั้งเลขอื่น');
  return pin;
}

/** บัญชีผู้ใช้ที่ผูกกับพนักงาน (ลงเวลาด้วย PIN ที่เจ้าตัวตั้งเอง) บัญชีที่ถูกปิดก็คืนค่า เพื่อให้เข้าระบบไม่ได้จริง */
function linkedUser_(emp) {
  return usersAll_().filter(function (u) { return u.empId === emp.id; })[0] || null;
}
/** พนักงานที่บัญชียังไม่ได้ตั้ง PIN (หน้าลงเวลาแสดงหน้าตั้งรหัสให้เลย) */
function pendingEmpIds_() {
  var o = {};
  usersAll_().forEach(function (u) { if (u.empId && u.status !== 'disabled' && !u.pinHash) o[u.empId] = 1; });
  return o;
}

/** ตั้ง PIN ครั้งแรกด้วยรหัสเปิดใช้งาน แล้วเข้าสู่ระบบให้เลย (เรียกได้โดยไม่ต้องมีเซสชัน) */
function setupPin_(p) {
  var u = p.empId ? usersAll_().filter(function (x) { return x.empId === p.empId; })[0] : userByName_(p.code);
  if (!u || u.status === 'disabled') fail_('ไม่พบชื่อผู้ใช้นี้ หรือบัญชีถูกปิดใช้งาน');
  if (u.pinHash) fail_('บัญชีนี้ตั้ง PIN แล้ว ใช้ PIN ของคุณเข้าระบบ ถ้าลืมให้ Owner/Admin รีเซ็ต');
  var cache = CacheService.getScriptCache(), key = 'fail_setup_' + u.id, f = Number(cache.get(key) || 0);
  if (f >= 5) fail_('ใส่รหัสเปิดใช้งานผิดหลายครั้ง รอ 10 นาทีแล้วลองใหม่');
  if (!u.setupHash || setupHash_(u.id, String(p.setup || '').trim()) !== u.setupHash) { cache.put(key, String(f + 1), 600); fail_('รหัสเปิดใช้งานไม่ถูกต้อง'); }
  if (!u.setupExpires || new Date(u.setupExpires) < new Date()) fail_('รหัสเปิดใช้งานหมดอายุ ขอรหัสใหม่จาก Owner/Admin');
  var pin = checkNewPin_(p.pin, p.pin2);
  cache.remove(key);
  var now = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm');
  upsertMany_('users', [{ id: u.id, pinHash: hashPin_(u.id, pin), setupHash: '', setupExpires: '', pinSetAt: now, lastLogin: now }]);
  var sess = userSession_(u);
  sess.via = p.from === 'clock' ? 'clock' : 'web';
  log_(sess, 'ตั้ง PIN ครั้งแรก', 'users', u.username);
  return issueSession_(sess);
}
function issueSession_(sess) {
  sess.ep = sessionEpoch_();
  var token = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '').slice(0, 8);
  CacheService.getScriptCache().put('s_' + token, JSON.stringify(sess), SESSION_SECONDS);
  var info = sessionInfo_(sess);
  info.token = token;
  return info;
}

/** เปลี่ยน PIN ของตัวเอง (บัญชีผู้ใช้ หรือพนักงานที่ยังไม่มีบัญชีผู้ใช้) */
function changePin_(sess, p) {
  if (sess.role === 'owner' && sess.uid === 'owner') fail_('PIN ของบัญชีหลัก owner เปลี่ยนที่ Apps Script (setOwnerPin)');
  var table = sess.uid ? 'users' : 'employees', id = sess.uid || sess.empId;
  var row = readTable_(table).filter(function (x) { return x.id === id; })[0];
  if (!row) fail_('ไม่พบบัญชี');
  checkPin_(row, String(p.old || '').trim());
  var pin = checkNewPin_(p.pin, p.pin2);
  if (pin === String(p.old).trim()) fail_('PIN ใหม่ต้องไม่ซ้ำกับ PIN เดิม');
  var upd = { id: id, pinHash: hashPin_(id, pin) };
  if (table === 'users') upd.pinSetAt = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm');
  upsertMany_(table, [upd]);
  log_(sess, 'เปลี่ยน PIN ของตัวเอง', table, '');
  return { ok: true };
}

/** Owner/Admin รีเซ็ต: ล้าง PIN ออกรหัสเปิดใช้งานใหม่ และส่งเข้า LINE ของเจ้าตัวถ้าผูกไว้ */
function resetUserPin_(sess, id) {
  requirePerm_(sess, ['users']);
  var u = usersAll_().filter(function (x) { return x.id === id; })[0];
  if (!u) fail_('ไม่พบบัญชี');
  if (normRole_(u.role) === 'owner' && sess.role !== 'owner') fail_('รีเซ็ตบัญชีระดับ Owner ได้เฉพาะ Owner', 'PERM');
  if (u.id === sess.uid) fail_('รีเซ็ตบัญชีตัวเองไม่ได้ ใช้ "เปลี่ยน PIN" ที่บัญชีของฉัน');
  var r = { id: u.id }, code = prepareSetup_(r);
  upsertMany_('users', [r]);
  var line = false;
  if (u.lineUserId) {
    var res = linePush_(u.lineUserId, [{ type: 'text', text: '🔑 รหัสเปิดใช้งานของ ' + u.username + ': ' + code + '\nเปิดระบบ ใส่ชื่อผู้ใช้ แล้วใช้รหัสนี้ตั้ง PIN 6 หลักใหม่ของคุณ (หมดอายุใน ' + SETUP_DAYS + ' วัน)' }]);
    line = res.ok;
  }
  log_(sess, 'รีเซ็ต PIN', 'users', u.username + (line ? ' (ส่งรหัสทาง LINE)' : ''));
  return { id: u.id, username: u.username, setupCode: code, days: SETUP_DAYS, sentLine: line };
}

  /* ===================== ข้อมูลตัวอย่างสำหรับโหมดทดลอง (2 สาขา) ===================== */
  function demoHolidays_(y) {
    return [y + '-01-01 วันขึ้นปีใหม่', y + '-04-06 วันจักรี', y + '-04-13 วันสงกรานต์', y + '-04-14 วันสงกรานต์', y + '-04-15 วันสงกรานต์', y + '-05-01 วันแรงงานแห่งชาติ', y + '-05-04 วันฉัตรมงคล', y + '-06-03 วันเฉลิมพระชนมพรรษาสมเด็จพระราชินี', y + '-07-28 วันเฉลิมพระชนมพรรษา ร.10', y + '-08-12 วันแม่แห่งชาติ', y + '-10-13 วันนวมินทรมหาราช', y + '-10-23 วันปิยมหาราช', y + '-12-05 วันพ่อแห่งชาติ', y + '-12-10 วันรัฐธรรมนูญ', y + '-12-31 วันสิ้นปี'];
  }

  function seedDemo_() {
    store = { seq: 1, props: {}, books: {}, folders: {} }; cacheMem = {}; memFiles = {}; _bookCache = {};
    var seed = 20261114;
    var rnd = function () { seed = seed * 16807 % 2147483647; return seed / 2147483647; };
    setup();
    store.props.OWNER_PIN_HASH = hashPin_('owner', '1234');
    var T = today_(), y = Number(T.slice(0, 4)), start = Calc.addDays(T, -45), now = new Date().toISOString();
    saveSettings_({
      shopName: 'Café Amazon',
      shiftStart: '07:00', shiftEnd: '16:00', hoursPerDay: '8', breakMin: '60', lateGrace: '5', otMinMinutes: '30',
      minWage: '372', sickPaidDays: '30', personalPaidDays: '3', annualDays: '6', ssoRate: '5', ssoFloor: '1650', ssoCeil: '17500', ssoIncludeOT: 'true',
      royaltyPct: '3', marketingPct: '3', posRentMonthly: '2000', vatRegistered: 'false', amortMonths: '72',
      holidays: demoHolidays_(y).concat(demoHolidays_(y + 1).slice(0, 1)).join('\n'),
      perms: JSON.stringify(DEFAULT_PERMS),
      lineApprovals: 'true', lineClock: 'exceptions', lineDaily: 'true', lineDailyHour: '21', lineRequirePin: 'false'
    });
    upsertMany_('branches', [
      { id: 'branch_B01', code: 'B01', name: 'สาขาตัวเมือง', status: 'เปิด', openDate: Calc.addDays(T, -400), lat: '7.006900', lng: '100.474700', radius: '80', maxAccuracy: '100', requireSelfie: 'false', royaltyPct: '3', marketingPct: '3', posRentMonthly: '2000', investment: '3041000', amortMonths: '72', by: 'ข้อมูลตัวอย่าง' },
      { id: 'branch_B02', code: 'B02', name: 'สาขาริมถนนใหญ่', status: 'เปิด', openDate: Calc.addDays(T, -120), lat: '7.030000', lng: '100.470000', radius: '100', maxAccuracy: '100', requireSelfie: 'false', royaltyPct: '3', marketingPct: '3', posRentMonthly: '2000', investment: '3350000', amortMonths: '72', by: 'ข้อมูลตัวอย่าง' }
    ]);
    upsertMany_('shifts', [{ id: 'shift_N', code: 'N', name: 'กะเย็นสาขาริมถนน', start: '14:00', end: '22:00', breakMin: 60, color: '#1D6F72', branch: 'B02', by: 'ข้อมูลตัวอย่าง' }]);
    var E = [
      { code: 'A01', role: 'manager', branch: 'B01', pin: '1111', firstName: 'สุดารัตน์', lastName: 'ใจดี', nickname: 'แนน', position: 'ผู้จัดการร้าน', status: 'ประจำ', payType: 'monthly', rate: 18000, bank: 'กสิกรไทย', bankAcct: '000-0-00001-0', pat: 'OFF,M,M,M,M,M,M' },
      { code: 'A02', role: 'staff', branch: 'B01', pin: '2222', firstName: 'ธนากร', lastName: 'ศรีสุข', nickname: 'ต้น', position: 'บาริสต้า', status: 'ประจำ', payType: 'monthly', rate: 13000, bank: 'กรุงไทย', bankAcct: '000-0-00002-0', pat: 'M,M,OFF,M,M,L,L' },
      { code: 'A03', role: 'staff', branch: 'B01', pin: '3333', firstName: 'พิมพ์ชนก', lastName: 'แก้วมณี', nickname: 'ฝ้าย', position: 'บาริสต้า', status: 'ทดลองงาน', payType: 'daily', rate: 400, bank: 'ไทยพาณิชย์', bankAcct: '000-0-00003-0', pat: 'L,OFF,L,L,L,L,M' },
      { code: 'P01', role: 'staff', branch: 'B01', pin: '4444', firstName: 'กิตติพัฒน์', lastName: 'ทองดี', nickname: 'บอส', position: 'พาร์ทไทม์', status: 'ประจำ', payType: 'hourly', rate: 55, bank: 'กรุงเทพ', bankAcct: '000-0-00004-0', pat: 'P,P,P,OFF,P,P,OFF' },
      { code: 'B11', role: 'manager', branch: 'B02', pin: '5555', firstName: 'โอภาส', lastName: 'สุขใจ', nickname: 'โอ๊ต', position: 'ผู้จัดการร้าน', status: 'ประจำ', payType: 'monthly', rate: 17000, bank: 'กสิกรไทย', bankAcct: '000-0-00005-0', pat: 'M,OFF,M,M,M,M,M' },
      { code: 'B12', role: 'staff', branch: 'B02', pin: '6666', firstName: 'มินตรา', lastName: 'ชัยวงศ์', nickname: 'มิ้นท์', position: 'บาริสต้า', status: 'ประจำ', payType: 'monthly', rate: 12500, bank: 'ออมสิน', bankAcct: '000-0-00006-0', pat: 'N,N,N,N,OFF,N,N' },
      { code: 'P02', role: 'staff', branch: 'B02', pin: '7777', firstName: 'ณัฐพล', lastName: 'มีสุข', nickname: 'เจมส์', position: 'พาร์ทไทม์', status: 'ประจำ', payType: 'hourly', rate: 55, bank: 'กรุงไทย', bankAcct: '000-0-00007-0', pat: 'OFF,OFF,P,P,P,P,P' },
      { code: 'H01', role: 'hr', branch: 'B01', pin: '8888', firstName: 'จิราภรณ์', lastName: 'ดีงาม', nickname: 'จอย', position: 'HR', status: 'ประจำ', payType: 'monthly', rate: 22000, bank: 'กสิกรไทย', bankAcct: '000-0-00008-0', pat: '' }
    ];
    var patterns = [];
    E.forEach(function (e, i) {
      e.id = 'emp' + (i + 1);
      e.pinHash = hashPin_(e.id, e.pin); delete e.pin;
      e.startDate = Calc.addDays(T, i === 2 ? -70 : i >= 4 && i <= 6 ? -125 : -220);
      e.ssoEnrolled = e.payType === 'hourly' ? 'false' : 'true'; e.pdpaConsent = i === 2 ? 'false' : 'true';
      e.phone = '08' + String(10000000 + i * 1111111).slice(0, 8); e.by = 'ข้อมูลตัวอย่าง';
      if (e.pat) { var p = e.pat.split(','), row = { id: 'pat_' + e.id, empId: e.id, by: 'ข้อมูลตัวอย่าง' }; [1, 2, 3, 4, 5, 6, 0].forEach(function (wd, j) { row['d' + wd] = p[j]; }); patterns.push(row); }
      delete e.pat;
    });
    upsertMany_('employees', E);
    upsertMany_('patterns', patterns);
    // จำนวนคนที่ต้องการ จ อ พ พฤ ศ ส อา (ตั้งให้เสาร์ต้องการกะเช้า 2 คน เพื่อให้เห็นการเตือนคนไม่พอและการยืมคน)
    var need = function (b, s, v) { var r = { id: 'need_' + b + '_' + s, branch: b, shift: s, by: 'ข้อมูลตัวอย่าง' }; [1, 2, 3, 4, 5, 6, 0].forEach(function (wd, j) { r['d' + wd] = v[j]; }); return r; };
    upsertMany_('staffing', [need('B01', 'M', [1, 1, 1, 1, 1, 2, 2]), need('B01', 'L', [1, 0, 1, 1, 1, 1, 1]), need('B01', 'P', [1, 1, 1, 0, 1, 1, 0]),
      need('B02', 'M', [1, 0, 1, 1, 1, 2, 1]), need('B02', 'N', [1, 1, 1, 1, 0, 1, 1]), need('B02', 'P', [0, 0, 1, 1, 1, 1, 1])]);
    upsertMany_('applicants', [
      { branch: 'B02', name: 'วรรณิภา สายทอง', phone: '0800000011', position: 'บาริสต้า', appliedDate: Calc.addDays(T, -3), source: 'Facebook', status: 'นัดสัมภาษณ์', interviewDate: Calc.addDays(T, 2), interviewTime: '10:00', expectedPay: '13000', availability: 'ทุกวัน ยกเว้นวันอาทิตย์' },
      { branch: 'B01', name: 'ณัฐวุฒิ คงมั่น', phone: '0800000022', position: 'พาร์ทไทม์', appliedDate: Calc.addDays(T, -6), source: 'หน้าร้าน', status: 'ใหม่', expectedPay: '55', availability: 'เย็นวันธรรมดา และเสาร์อาทิตย์' }
    ]);

    // ตารางงานที่สร้างจากรูปแบบกะไว้แล้ว: 45 วันก่อนถึงสิ้นเดือนนี้ (เดือนหน้ายังว่าง ใช้ทดลองกด "สร้างตาราง")
    var sched = [], monthEnd = T.slice(0, 7) + '-' + Calc.pad(Calc.daysInMonth(T.slice(0, 7)));
    var ctx0 = { st: getSettings_(), hol: {}, shifts: Calc.shiftIndex(readTable_('shifts')), sched: {}, patterns: Calc.patternIndex(patterns) };
    var lastSat = T; while (Calc.weekday(lastSat) !== 6) lastSat = Calc.addDays(lastSat, -1);
    var offWorkDay = Calc.addDays(T, -3);
    for (var d = start; d <= monthEnd; d = Calc.addDays(d, 1)) {
      E.forEach(function (e) {
        if (e.role === 'hr') return;
        var p = Calc.planFor(e, d, ctx0), row = { id: d + '_' + e.id, date: d, empId: e.id, branch: e.branch, shift: p.off ? 'OFF' : p.code, by: e.branch === 'B01' ? 'แนน' : 'โอ๊ต' };
        if (e.id === 'emp3' && (d === lastSat || d === Calc.addDays(lastSat, -14))) { row.branch = 'B02'; row.shift = 'M'; row.note = 'ไปช่วยสาขาริมถนนใหญ่'; }
        if (e.id === 'emp3' && d === offWorkDay) row.shift = 'OFF';
        sched.push(row);
      });
    }
    upsertMany_('schedule', sched);

    // ประวัติการลงเวลา ยอดขาย
    var ctx = timeCtx_(), att = [], salesRows = [], salesDel = {}, cups = { B01: {}, B02: {} };
    var lastWork = function (e, back) { for (var i = back; i < back + 10; i++) { var dd = Calc.addDays(T, -i); if (!Calc.planFor(e, dd, ctx).off) return dd; } return Calc.addDays(T, -back); };
    var sickDay = lastWork(E[1], 20), missDay = lastWork(E[1], 2), forgotDay = lastWork(E[3], 1);
    for (d = start; d < T; d = Calc.addDays(d, 1)) {
      var dow = Calc.weekday(d), wk = dow === 0 || dow === 6;
      ['B01', 'B02'].forEach(function (b) {
        var c = Math.round((b === 'B01' ? 195 : 120) + rnd() * 55 + (wk ? 30 : 0)), total = c * (60 + rnd() * 6);
        var delivery = Math.round(total * 0.18), qr = Math.round(total * 0.47), card = Math.round(total * 0.05), cash = Math.round(total) - delivery - qr - card;
        var short = rnd() < 0.12 ? -Math.round(20 + rnd() * 100) : 0;
        salesRows.push({ id: 'sale_' + b + '_' + d, date: d, branch: b, cups: c, cash: cash, qr: qr, card: card, delivery: delivery, other: 0, total: cash + qr + card + delivery, cashCounted: cash + short, overShort: short, by: b === 'B01' ? 'แนน' : 'โอ๊ต' });
        salesDel[b + d] = delivery; cups[b][d] = c;
      });
      E.forEach(function (e) {
        if (e.role === 'hr') return;
        var p = Calc.planFor(e, d, ctx);
        var workedOff = d === offWorkDay && e.id === 'emp3';
        if (p.off && !workedOff) return;
        if (e.id === 'emp2' && (d === sickDay || d === missDay)) return;
        var s = Calc.toMin(p.start || '11:00'), en = Calc.toMin(p.end || '20:00');
        var late = rnd() < 0.15 ? Math.round(6 + rnd() * 20) : -Math.round(rnd() * 10);
        var ot = e.payType !== 'hourly' && rnd() < 0.15 ? Math.round(40 + rnd() * 80) : Math.round(rnd() * 8);
        var rec = { id: 'att_' + d + '_' + e.id, empId: e.id, date: d, branch: p.branch || e.branch, inTime: Calc.minToHM(s + late), outTime: Calc.minToHM(en + ot), inDist: Math.round(5 + rnd() * 40), outDist: Math.round(5 + rnd() * 40), source: 'gps', by: e.nickname };
        if (e.id === 'emp4' && d === forgotDay) rec.outTime = '';
        Calc.applyPlan(rec, p, ctx.st);
        if (d < Calc.addDays(T, -7)) { if (rec.otStatus) rec.otStatus = 'อนุมัติ'; if (rec.offStatus) rec.offStatus = 'อนุมัติ'; rec.decidedBy = 'จอย'; }
        att.push(rec);
      });
    }
    ['emp1', 'emp5'].forEach(function (id) {
      var e = E.filter(function (x) { return x.id === id; })[0], p = Calc.planFor(e, T, ctx);
      if (!p.off) att.push(Calc.applyPlan({ id: 'att_' + T + '_' + id, empId: id, date: T, branch: e.branch, inTime: Calc.minToHM(Calc.toMin(p.start) - 6), outTime: '', inDist: 12, source: 'gps', by: e.nickname }, p, ctx.st));
    });
    upsertMany_('attendance', att);
    upsertMany_('sales', salesRows);
    upsertMany_('leaves', [
      { id: 'lv1', empId: 'emp2', type: 'ลาป่วย', dateFrom: sickDay, dateTo: sickDay, days: 1, status: 'อนุมัติ', reason: 'ไข้หวัด', by: 'ต้น', decidedBy: 'จอย', createdAt: now },
      { id: 'lv2', empId: 'emp3', type: 'ลากิจ', dateFrom: Calc.addDays(T, 3), dateTo: Calc.addDays(T, 3), days: 1, status: 'รออนุมัติ', reason: 'ไปทำบัตรประชาชน', by: 'ฝ้าย', createdAt: now },
      { id: 'lv3', empId: 'emp6', type: 'ลาพักร้อน', dateFrom: Calc.addDays(T, 6), dateTo: Calc.addDays(T, 7), days: 2, status: 'รออนุมัติ', reason: 'กลับบ้านต่างจังหวัด', by: 'มิ้นท์', createdAt: now }
    ]);
    upsertMany_('timefix', [{ id: 'fx1', empId: 'emp4', date: forgotDay, inTime: '', outTime: '20:05', reason: 'ลืมกดออกงาน รีบกลับบ้าน', status: 'รออนุมัติ', by: 'บอส', createdAt: now }]);

    // สต็อก: รายการสินค้าใช้ร่วมกัน ยอดแยกสาขา
    var I = [['CF01', 'เมล็ดกาแฟคั่ว เบลนด์ร้าน', 'เมล็ดกาแฟ', 'กก.', 520, 3, 0.0108, 0], ['MK01', 'นมสดพาสเจอร์ไรส์ 2 ลิตร', 'นม/ครีม', 'แกลลอน', 98, 8, 0.05, 10],
      ['MK02', 'นมข้นหวาน', 'นม/ครีม', 'กระป๋อง', 27, 12, 0.05, 0], ['MK03', 'ครีมเทียมข้นจืด', 'นม/ครีม', 'กระป๋อง', 22, 12, 0.04, 0],
      ['SY01', 'ไซรัปคาราเมล', 'ไซรัป/ซอส', 'ขวด', 185, 2, 0.004, 0], ['PW01', 'ผงโกโก้', 'ผงชา/โกโก้', 'ถุง', 240, 2, 0.006, 0],
      ['PW02', 'ผงชาไทย', 'ผงชา/โกโก้', 'ถุง', 210, 2, 0.005, 0], ['PW03', 'ผงมัทฉะ', 'ผงชา/โกโก้', 'ถุง', 390, 1, 0.003, 0],
      ['CP01', 'แก้วพลาสติก 22 ออนซ์', 'แก้ว/ฝา/หลอด', 'แถว 50 ใบ', 95, 6, 0.02, 0], ['CP02', 'ฝาโดม', 'แก้ว/ฝา/หลอด', 'แถว 50 ใบ', 55, 6, 0.02, 0],
      ['CP03', 'หลอด', 'แก้ว/ฝา/หลอด', 'แพ็ค', 35, 4, 0.01, 0], ['BK01', 'ครัวซองต์', 'เบเกอรี่', 'ชิ้น', 28, 12, 0.08, 3]];
    var items = I.map(function (x, i) { return { id: 'item' + i, sku: x[0], name: x[1], category: x[2], unit: x[3], cost: x[4], min: x[5], supplier: 'OR / Café Amazon', by: 'แนน' }; });
    upsertMany_('items', items);
    var mv = [], mseq = 0;
    var add = function (b, date, it, type, qty, extra) { var r = { id: 'mv' + (mseq++), date: date, branch: b, itemId: it.id, type: type, qty: Math.round(qty * 100) / 100, unitCost: it.cost, by: b === 'B01' ? 'ต้น' : 'มิ้นท์', createdAt: date + 'T10:00:00.000Z' }; for (var k in extra) r[k] = extra[k]; mv.push(r); };
    ['B01', 'B02'].forEach(function (b) {
      var acc = 0, n = 0, inv = 2, scale = b === 'B01' ? 1.25 : 0.8;
      items.forEach(function (it, i) { add(b, start, it, 'รับเข้า', Math.ceil(I[i][6] * 175 * 10 * scale + it.min * 2), { ref: b + '-INV-0001', expiry: I[i][7] ? Calc.addDays(start, I[i][7]) : '' }); });
      for (d = start; d < T; d = Calc.addDays(d, 1)) {
        acc += cups[b][d] || 0; n++;
        var next = Calc.addDays(d, 1);
        if (n === 7 || next.slice(0, 7) !== d.slice(0, 7) || next >= T) {
          items.forEach(function (it, i) { add(b, d, it, 'เบิกใช้', I[i][6] * acc, { note: 'เบิกใช้ตามยอดขาย ' + n + ' วัน' }); });
          acc = 0; n = 0;
        }
        if (Calc.dayCount(start, d) % 7 === 0 && next < T) {
          items.forEach(function (it, i) { add(b, next, it, 'รับเข้า', Math.ceil(I[i][6] * 175 * 7 * scale), { ref: b + '-INV-' + ('000' + inv).slice(-4), expiry: I[i][7] ? Calc.addDays(next, I[i][7]) : '' }); });
          inv++;
        }
      }
    });
    add('B01', Calc.addDays(T, -9), items[1], 'ของเสีย', 2, { note: 'นมเสียก่อนกำหนด' });
    add('B02', Calc.addDays(T, -4), items[11], 'ของเสีย', 6, { note: 'ครัวซองต์หมดอายุ' });
    add('B01', Calc.addDays(T, -5), items[1], 'โอนออก', 4, { ref: 'TR-0001', toBranch: 'B02', note: 'โอนนมไปช่วยสาขาริมถนนใหญ่' });
    add('B02', Calc.addDays(T, -5), items[1], 'โอนเข้า', 4, { ref: 'TR-0001', toBranch: 'B01', by: 'ต้น' });
    add('B01', Calc.addDays(T, -1), items[0], 'ปรับยอด', -0.4, { ref: 'ตรวจนับ', note: 'ในระบบมากกว่าที่นับได้', status: 'รออนุมัติ' });
    upsertMany_('moves', mv);

    // รายจ่าย: แยกสาขา + ส่วนกลาง
    var ex = [], exSeq = 0;
    var addEx = function (b, date, category, amount, extra) { if (date >= start && date < T) { var r = { id: 'ex' + (exSeq++), date: date, branch: b, category: category, amount: Math.round(amount), payMethod: 'โอน', by: b === 'B02' ? 'โอ๊ต' : 'แนน' }; for (var k in extra) r[k] = extra[k]; ex.push(r); } };
    for (var k = -2; k <= 0; k++) {
      var p0 = T.split('-').map(Number), dm = new Date(Date.UTC(p0[0], p0[1] - 1 + k, 1));
      var m = dm.getUTCFullYear() + '-' + Calc.pad(dm.getUTCMonth() + 1) + '-';
      addEx('B01', m + '01', 'ค่าเช่าพื้นที่', 25000, { vendor: 'เจ้าของพื้นที่' });
      addEx('B02', m + '01', 'ค่าเช่าพื้นที่', 18000, { vendor: 'เจ้าของที่ดิน' });
      addEx('B01', m + '05', 'ค่าไฟ', 9200 + rnd() * 1200, { vendor: 'การไฟฟ้าส่วนภูมิภาค' });
      addEx('B02', m + '05', 'ค่าไฟ', 7800 + rnd() * 1200, { vendor: 'การไฟฟ้าส่วนภูมิภาค' });
      addEx('B01', m + '05', 'ค่าน้ำ', 580 + rnd() * 120, { vendor: 'การประปาส่วนภูมิภาค' });
      addEx('B02', m + '05', 'ค่าน้ำ', 450 + rnd() * 120, { vendor: 'การประปาส่วนภูมิภาค' });
      addEx('B01', m + '06', 'อินเทอร์เน็ต/โทรศัพท์', 599, {});
      addEx('B02', m + '06', 'อินเทอร์เน็ต/โทรศัพท์', 599, {});
      addEx('', m + '25', 'ค่าทำบัญชี/สำนักงาน', 3500, { vendor: 'สำนักงานบัญชี', note: 'ส่วนกลาง ไม่แยกสาขา' });
    }
    for (d = Calc.addDays(start, 6); d < T; d = Calc.addDays(d, 7)) {
      ['B01', 'B02'].forEach(function (b) {
        var del = 0;
        for (var x = Calc.addDays(d, -6); x <= d; x = Calc.addDays(x, 1)) del += salesDel[b + x] || 0;
        if (del) addEx(b, d, 'GP เดลิเวอรี่', del * 0.3, { vendor: 'แพลตฟอร์มเดลิเวอรี่', note: 'ตัวเลขตัวอย่าง' });
        addEx(b, d, 'วัสดุสิ้นเปลือง', 300 + rnd() * 150, { payMethod: 'เงินสด', note: 'น้ำยาทำความสะอาด ทิชชู่' });
      });
    }
    upsertMany_('expenses', ex);

    // ชื่อผู้ใช้ที่ Owner สร้าง ขึ้นต้นตาม Role (PIN ในตัวอย่างนี้ = PIN ที่เจ้าตัว "ตั้งเอง" แล้ว) + LINE ตัวอย่าง (โหมดทดลองไม่ได้ส่งจริง)
    var U = [
      { id: 'usr_admin', username: 'admin_somchai', name: 'สมชาย (IT)', role: 'admin', status: 'active', lineEvents: '', note: 'ดูแลระบบ ไม่ใช่พนักงานสาขา', pin: '246810' },
      { id: 'usr_acc', username: 'mgr_nok', name: 'นก (บัญชี)', role: 'manager', branch: 'B01', branchAccess: '*', perms: 'sales,stock', status: 'active', note: 'สำนักงานบัญชี บันทึกรายจ่ายทุกสาขา', pin: '135790' },
      { id: 'usr_owner2', username: 'owner_co', name: 'Owner ร่วม', role: 'owner', status: 'active', lineEvents: 'approvals,daily', pin: '975310' },
      { id: 'usr_nan', username: 'mgr_nan', name: 'แนน', role: 'manager', empId: 'emp1', branch: 'B01', status: 'active', lineEvents: 'approvals,clockEx', pin: '111111' },
      { id: 'usr_oat', username: 'mgr_oat', name: 'โอ๊ต', role: 'manager', empId: 'emp5', branch: 'B02', status: 'active', lineEvents: 'approvals,clockEx', pin: '555555' },
      { id: 'usr_joy', username: 'hr_joy', name: 'จอย', role: 'hr', empId: 'emp8', branch: 'B01', status: 'active', lineUserId: 'U' + new Array(33).join('e'), lineEvents: 'approvals', pin: '888888' },
      { id: 'usr_ton', username: 'staff_ton', name: 'ต้น', role: 'staff', empId: 'emp2', branch: 'B01', status: 'active', pin: '222222' },
      { id: 'usr_fai', username: 'staff_fai', name: 'ฝ้าย', role: 'staff', empId: 'emp3', branch: 'B01', status: 'active', note: 'สร้างแล้ว รอเจ้าตัวตั้ง PIN (รหัสเปิดใช้งานตัวอย่าง 123456)' }
    ];
    U.forEach(function (u) {
      if (u.pin) { u.pinHash = hashPin_(u.id, u.pin); u.pinSetAt = Calc.addDays(T, -30) + ' 09:00'; }
      else { u.setupHash = setupHash_(u.id, '123456'); u.setupExpires = new Date(Date.now() + SETUP_DAYS * 86400000).toISOString(); }
      delete u.pin; u.by = 'Owner';
    });
    upsertMany_('users', U);
    store.props.LINE_TOKEN = 'demo-' + new Array(50).join('x');
    store.props.OWNER_PROFILE = JSON.stringify({ name: 'Owner', lineUserId: 'U' + new Array(33).join('d'), lineEvents: 'approvals,clockEx,daily' });
    var ownerS = ownerSession_(), accS = userSession_(U[1]), admS = userSession_(U[0]);
    log_(Object.assign({ via: 'web' }, accS), 'บันทึก', 'expenses', '1 แถว ค่าน้ำ');
    log_(Object.assign({ via: 'web' }, ownerS), 'บันทึก', 'users', '1 แถว usr_fai (สร้าง staff_fai รอตั้ง PIN)');
    log_(Object.assign({ via: 'clock' }, userSession_(U[6])), 'ตั้ง PIN ครั้งแรก', 'users', 'staff_ton');
    log_(Object.assign({ via: 'admin' }, admS), 'แก้ไขระบบ', 'clearCache', 'ล้างแคชแล้ว');
    log_({ name: 'system', role: '', code: 'system', via: 'system' }, 'ERROR', 'post', 'Exception: Service Spreadsheets timed out while accessing document (ตัวอย่างข้อผิดพลาด)');
    ['lv2', 'lv3'].forEach(function (id) { notifyApproval_('leaves', readTable_('leaves').filter(function (l) { return l.id === id; })[0], 'status'); });
    notifyApproval_('timefix', readTable_('timefix')[0], 'status');
    var lateRec = att.filter(function (a) { return Number(a.lateMin) > 0 && a.outTime; }).slice(-1)[0];
    if (lateRec) { var le = E.filter(function (e) { return e.id === lateRec.empId; })[0]; notifyClock_(le, lateRec, 'in', { branch: branchByCode_(lateRec.branch) }, Calc.planFor(le, lateRec.date, timeCtx_()), false); }
    log_({ name: 'ระบบ', role: 'owner', code: 'system', via: 'system' }, 'สร้างข้อมูลตัวอย่าง', '', '');
    store.props.DEMO_VER = '3.2';
    saveStore();
    return true;
  }

  global.DemoServer = {
    get: function (p) { loadStore(); _bookCache = {}; var out = doGet({ parameter: p }); saveStore(); return JSON.parse(out.content); },
    post: function (b) { loadStore(); _bookCache = {}; var out = doPost({ postData: { contents: JSON.stringify(b) } }); saveStore(); return JSON.parse(out.content); },
    ready: function () { loadStore(); return !!store.props.BOOK_core && store.props.DEMO_VER === '3.2'; },
    seed: function () { return seedDemo_(); },
    pushes: function () { loadStore(); return store.linePushes || []; },
    page: function (p) { loadStore(); _bookCache = {}; var out = doGet({ parameter: p }); saveStore(); return out.getContent ? out.getContent() : out.content; },
    reset: function () { try { localStorage.removeItem(KEY); localStorage.removeItem(CKEY); } catch (e) { /* ignore */ } loadStore(); _bookCache = {}; }
  };
})(typeof window !== 'undefined' ? window : globalThis);
