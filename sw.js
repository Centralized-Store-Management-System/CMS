/* แอปติดตั้งจากเว็บ (PWA): เปิดเร็วขึ้นจากไฟล์ที่จำไว้ในเครื่อง
 * - หน้าเว็บ (html): ถามเน็ตก่อนเสมอ (ได้เวอร์ชันล่าสุด) เน็ตหลุดค่อยใช้ที่จำไว้
 * - ไฟล์ js/css/รูป ของเว็บนี้: ใช้ที่จำไว้ทันที แล้วอัปเดตเบื้องหลัง (ชื่อไฟล์มี ?v= เปลี่ยนทุกเวอร์ชันอยู่แล้ว)
 * - ข้อมูลจาก Google (Apps Script), LINE, ฟอนต์: ไม่แตะ ไม่เก็บ (ข้อมูลสดเสมอ) */
const CACHE = 'amz-app-v1';
self.addEventListener('install', e => { self.skipWaiting(); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('amz-app-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then(res => { const c = res.clone(); caches.open(CACHE).then(ca => ca.put(url.pathname, c)); return res; })
      .catch(() => caches.match(url.pathname).then(r => r || caches.match(url.pathname.replace(/[^/]*$/, 'index.html')))));
    return;
  }
  if (!/\.(js|css|png|svg|webmanifest|woff2?)$/.test(url.pathname)) return;
  e.respondWith(caches.open(CACHE).then(ca => ca.match(req).then(hit => {
    const net = fetch(req).then(res => { if (res.ok) ca.put(req, res.clone()); return res; }).catch(() => hit);
    return hit || net;
  })));
});
