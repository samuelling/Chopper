// Offline play for the web build (and an iPad or phone home-screen install): network first, so an update is picked up
// whenever there is a connection, with everything the game has loaded kept as a fallback for when there is not.
// Bump VERSION to drop old caches.  Packaged desktop apps load the game from disk and do not register this.
const VERSION = 'ashland-1';
self.addEventListener('install', (e) => { self.skipWaiting(); e.waitUntil(caches.open(VERSION).then((c) => c.addAll(['./', './index.html', './manifest.webmanifest']))); });
self.addEventListener('activate', (e) => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k !== VERSION) await caches.delete(k);
  await self.clients.claim();
})()));
self.addEventListener('fetch', (e) => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  e.respondWith((async () => {
    try {
      const res = await fetch(req);
      if (res.ok && res.type === 'basic') { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); }
      return res;
    } catch {
      return (await caches.match(req)) || (await caches.match(req, { ignoreSearch: true })) || (req.mode === 'navigate' ? caches.match('./index.html') : Response.error());
    }
  })());
});
