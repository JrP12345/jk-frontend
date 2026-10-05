// Only explicit public resources can enter the offline cache.
const CACHE_NAME = 'ekavyu-cache-v10';
const PUBLIC_PAGES = new Set(['/browse', '/pricing']);
const PUBLIC_FILES = new Set(['/manifest.json', '/ekavyu-leaf.png', '/ekavyu-home-social.png', '/favicon.ico', '/favicon-16.png', '/favicon-32.png', '/app-icon-180.png', '/app-icon-192.png', '/app-icon-512.png', '/app-icon-maskable-512.png', '/logo-d.png', '/logo-w.png']);
function allowed(url) {
  return url.origin === self.location.origin && (PUBLIC_PAGES.has(url.pathname) || PUBLIC_FILES.has(url.pathname) || url.pathname.startsWith('/_next/static/'));
}
function cacheable(response) {
  if (!response || response.status !== 200 || response.redirected) return false;
  if (/private|no-store/i.test(response.headers.get('cache-control') || '')) return false;
  return allowed(new URL(response.url));
}
async function store(cache, request, response) {
  if (!cacheable(response)) return;
  await cache.put(request, response.clone());
  const keys = await cache.keys();
  for (const key of keys.slice(0, Math.max(0, keys.length - 200))) await cache.delete(key);
}
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    for (const path of PUBLIC_FILES) {
      try { const response = await fetch(path, { cache: 'reload' }); await store(cache, path, response); } catch {}
    }
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(name => /^(ekavyu|ananta|jk)-cache-/.test(name) && name !== CACHE_NAME).map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET' || !allowed(new URL(request.url))) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    try {
      const response = await fetch(request);
      await store(cache, request, response);
      return response;
    } catch { return (await cache.match(request)) || new Response('Offline', { status: 503 }); }
  })());
});
self.addEventListener('message', event => {
  if (event.data?.action === 'CLEAR_USER_CACHE') {
    event.waitUntil(caches.keys().then(names => Promise.all(names.filter(name => /^(ekavyu|ananta|jk)-cache-/.test(name)).map(name => caches.delete(name)))));
  }
});
