// Only explicit public resources can enter the offline cache.
const CACHE_NAME = 'ekavyu-cache-v24';
const POS_SHELL = '/pharmacy-offline.html';
const POS_FILES = ["/pharmacy-offline.html","/pharmacy-offline.css","/pharmacy-offline/pharmacyDrafts.js","/pharmacy-offline/pharmacyCatalogue.js","/pharmacy-offline/pharmacyBranchCatalogue.js","/pharmacy-offline/pharmacyBackgroundWork.js","/pharmacy-offline/authScope.js","/pharmacy-offline/entry.js","/pharmacy-offline/pharmacyFinal.js","/pharmacy-offline/pharmacyOfflineLedger.js","/pharmacy-offline/pharmacyOfflineCrypto.js","/pharmacy-offline/pharmacyOfflineGrant.js","/pharmacy-offline/pharmacyOfflineSession.js","/pharmacy-offline/pharmacyOfflineIdentity.js","/pharmacy-offline/pharmacyOfflinePrint.js","/pharmacy-offline/pharmacyOfflinePricing.js","/pharmacy-offline/pharmacyInvoice.js","/pharmacy-offline/pharmacyInvoiceNumberFormat.js","/pharmacy-offline/pharmacyCalculation.js","/pharmacy-offline/pharmacyOfflineDocument.js","/pharmacy-offline/manifest.json"];
const PUBLIC_PAGES = new Set(['/browse', '/pricing']);
const PUBLIC_FILES = new Set(['/manifest.json', '/brand/ekavyu-symbol-black.svg', '/brand/ekavyu-symbol-white.svg', '/brand/ekavyu-wordmark-black.svg', '/brand/ekavyu-wordmark-white.svg', '/brand/ekavyu-stacked-black.svg', '/brand/ekavyu-stacked-white.svg', '/brand/ekavyu-stacked-without-descriptor-black.svg', '/brand/ekavyu-stacked-without-descriptor-white.svg', '/ekavyu-home-social.png', '/favicon.ico', '/favicon-16.png', '/favicon-32.png', '/favicon-dark-16.png', '/favicon-dark-32.png', '/app-icon-180.png', '/app-icon-192.png', '/app-icon-512.png', '/app-icon-maskable-512.png']);
function allowed(url) {
  return url.origin === self.location.origin && (PUBLIC_PAGES.has(url.pathname) || PUBLIC_FILES.has(url.pathname) || POS_FILES.includes(url.pathname) || url.pathname.startsWith('/_next/static/'));
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
  let excess = Math.max(0, keys.length - 200);
  for (const key of keys) {
    if (!excess) break;
    if (POS_FILES.includes(new URL(key.url).pathname)) continue;
    await cache.delete(key); excess--;
  }
}
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    for (const path of [...PUBLIC_FILES, ...POS_FILES]) {
      try { const response = await fetch(path, { cache: 'reload' }); await store(cache, path, response); } catch {}
    }
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(name => /^(ekavyu|healthos|jk)-cache-/.test(name) && name !== CACHE_NAME).map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method === 'GET' && request.mode === 'navigate' && new URL(request.url).origin === self.location.origin && new URL(request.url).pathname === '/dashboard/pharmacy') {
    // Cache a public unlock/draft shell, never authenticated dashboard HTML or API responses.
    event.respondWith(fetch(request).catch(async () => {
      try { return (await (await caches.open(CACHE_NAME)).match(POS_SHELL)) || new Response('Offline preparation is not installed yet.', { status: 503 }); }
      catch { return new Response('Offline preparation is not installed yet.', { status: 503 }); }
    }));
    return;
  }
  if (request.method !== 'GET' || !allowed(new URL(request.url))) return;
  event.respondWith((async () => {
    try {
      const response = await fetch(request);
      try {
        const cache = await caches.open(CACHE_NAME);
        await store(cache, request, response);
      } catch { /* Cache storage must not replace a successful network response. */ }
      return response;
    } catch {
      try {
        const cache = await caches.open(CACHE_NAME);
        const cached = await cache.match(request);
        if (cached) return cached;
      } catch { /* Storage can be unavailable in private or restricted contexts. */ }
      return new Response('Offline', { status: 503 });
    }
  })());
});
self.addEventListener('message', event => {
  if (event.data?.action === 'CLEAR_USER_CACHE') {
    event.waitUntil(caches.keys().then(names => Promise.all(names.filter(name => /^(ekavyu|healthos|jk)-cache-/.test(name)).map(async name => {
      if (name !== CACHE_NAME) return caches.delete(name);
      // These credential-free static modules are needed to unlock the durable
      // financial ledger after restart. Logout must not strand issued bills.
      const cache = await caches.open(name);
      await Promise.all((await cache.keys()).filter(request => !POS_FILES.includes(new URL(request.url).pathname)).map(request => cache.delete(request)));
    }))));
  }
});
