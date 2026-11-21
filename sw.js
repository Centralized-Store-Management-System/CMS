/* แอปติดตั้งจากเว็บ (PWA): เปิดเร็วจากไฟล์ที่จำไว้ในเครื่อง และได้เวอร์ชันใหม่ทันทีหลัง deploy
 * - ข้อมูลจากเซิร์ฟเวอร์ (Supabase), LINE, ฟอนต์: ไม่แตะ ไม่เก็บ (ข้อมูลสดเสมอ) */
const CACHE = 'amz-app-v4';
/* v4 (21 พ.ย. 2569 · Claude): แอปได้เวอร์ชันใหม่ทันทีหลัง deploy
 * - GitHub Pages ให้เบราว์เซอร์จำไฟล์ 10 นาที (max-age=600) → เดิมแอปเห็นหน้าเก่าได้นานสุด ~10 นาที
 * - หน้า html: ถามเซิร์ฟเวอร์ทุกครั้ง (cache:'no-cache' = เช็ค ETag ถ้าไม่เปลี่ยนได้ 304 เบามาก)
 * - js/css ที่มี ?v= (ชื่อเปลี่ยนทุกครั้งที่แก้): ใช้ที่จำไว้ทันที ไม่ต้องรอเน็ต → เปิดเร็วขึ้น · เก็บรุ่นล่าสุดรุ่นเดียว
 * - ไฟล์ ?v= ยังโหลดใหม่เบื้องหลังทุกครั้ง (กันลืมเปลี่ยนเลข) · ไฟล์อื่นของเว็บ: ถามเซิร์ฟเวอร์ก่อน (no-cache) เน็ตช้าเกิน 3 วิ/หลุด ใช้ที่จำไว้ */
self.addEventListener('install', e => { self.skipWaiting(); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('amz-app-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
function putLatest(ca, req, res) {   // เก็บไฟล์ ?v= ใหม่ แล้วลบรุ่นเก่าของไฟล์เดียวกัน
  const u = new URL(req.url);
  return ca.keys().then(ks => Promise.all(ks.filter(k => { const x = new URL(k.url); return x.pathname === u.pathname && x.search !== u.search; }).map(k => ca.delete(k))))
    .then(() => ca.put(req, res));
}
self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  if (req.mode === 'navigate') {
    e.respondWith(fetch(new Request(req.url, { cache: 'no-cache', credentials: 'same-origin' })).then(res => { const c = res.clone(); if (res.ok) caches.open(CACHE).then(ca => ca.put(url.pathname, c)); return res; })
      .catch(() => caches.match(url.pathname).then(r => r || caches.match(url.pathname.replace(/[^/]*$/, 'index.html')))));
    return;
  }
  if (!/\.(js|css|png|svg|webmanifest|woff2?)$/.test(url.pathname) || url.pathname.endsWith('/sw.js')) return;
  if (/[?&]v=/.test(url.search)) {   // มีเลขเวอร์ชัน: ไฟล์นี้ไม่เปลี่ยนอีก ใช้ที่จำไว้ได้เลย
    // ใช้ที่จำไว้ทันที + โหลดใหม่เบื้องหลังเผื่อมีคนแก้ไฟล์แต่ลืมเปลี่ยน ?v= (ครั้งถัดไปได้ไฟล์ล่าสุด)
    e.respondWith(caches.open(CACHE).then(ca => ca.match(req).then(hit => {
      const net = fetch(req, { cache: 'no-cache' }).then(res => { if (res.ok) putLatest(ca, req, res.clone()); return res; });
      if (hit) { e.waitUntil(net.catch(() => {})); return hit; }
      return net;
    })));
    return;
  }
  e.respondWith(caches.open(CACHE).then(ca => {
    const net = fetch(req, { cache: 'no-cache' }).then(res => { if (res.ok) ca.put(req, res.clone()); return res; });
    const slow = new Promise(r => setTimeout(r, 3000)).then(() => ca.match(req)).then(hit => hit || net);
    return Promise.race([net.catch(() => ca.match(req)), slow]).then(r => r || net);
  }));
});
