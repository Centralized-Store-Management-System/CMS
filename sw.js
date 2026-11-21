/* CMS PWA update strategy
 * Navigation: network-first, cached fallback.
 * Same-origin static assets: network-first with a short cache fallback.
 * Retain two prior caches to keep already-open clients resilient during rollout.
 */
const CACHE = 'cms-app-v4';
const CACHE_PREFIX = 'cms-app-';
self.addEventListener('install', event => { self.skipWaiting(); });
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = (await caches.keys()).filter(k => k.startsWith(CACHE_PREFIX)).sort().reverse();
    const keep = new Set([CACHE, ...keys.filter(k => k !== CACHE).slice(0, 2)]);
    await Promise.all(keys.filter(k => !keep.has(k)).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  const req = event.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const res = await fetch(req, { cache: 'no-store' });
        if (res && res.ok) { const c = await caches.open(CACHE); c.put(url.pathname, res.clone()).catch(() => {}); }
        return res;
      } catch (_) {
        return (await caches.match(url.pathname)) || (await caches.match(url.pathname.replace(/[^/]*$/, 'index.html'))) || Response.error();
      }
    })());
    return;
  }
  if (!/\.(js|css|png|svg|webmanifest|woff2?|json)$/.test(url.pathname)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(req);
    try {
      const res = await Promise.race([
        fetch(req, { cache: 'no-store' }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('network-timeout')), 2500))
      ]);
      if (res && res.ok) cache.put(req, res.clone()).catch(() => {});
      return res;
    } catch (_) {
      return cached || (await caches.match(req)) || Response.error();
    }
  })());
});
