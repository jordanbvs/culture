/* Culture — service worker.
   · Coquille (HTML, CSS, JS, icônes) précachée → l'app s'ouvre hors ligne.
   · data.json et images/ : réseau d'abord, cache en secours → les nouvelles recos apparaissent tout de suite.
   · Polices Google : précachées au mieux à l'installation, puis stale-while-revalidate.
   Incrémenter VERSION à chaque modification de la coquille (CSS/JS/HTML/icônes). */
const VERSION = 'v1';
const SHELL_CACHE = `culture-shell-${VERSION}`;
const DATA_CACHE = 'culture-data';    // non versionné : garde les dernières données connues
const FONT_CACHE = 'culture-fonts-v1';

const SHELL = [
  './',
  'index.html',
  'css/style.css',
  'js/app.js',
  'manifest.webmanifest',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-192.png',
  'icons/icon-maskable-512.png',
  'icons/apple-touch-icon.png',
  'icons/favicon.ico',
  'icons/favicon-32.png',
];
const FONT_CSS = 'https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Inter+Tight:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap';

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const shell = await caches.open(SHELL_CACHE);
    // cache: 'reload' contourne le cache HTTP de GitHub Pages (max-age=600)
    await shell.addAll(SHELL.map((u) => new Request(u, { cache: 'reload' })));
    await precacheFonts().catch(() => {}); // au mieux : n'empêche jamais l'installation
    await self.skipWaiting();
  })());
});

async function precacheFonts() {
  const cache = await caches.open(FONT_CACHE);
  const res = await fetch(FONT_CSS, { mode: 'cors' });
  if (!res.ok) return;
  const css = await res.clone().text();
  await cache.put(FONT_CSS, res);
  // seulement les sous-ensembles latin / latin-ext (français)
  const urls = [];
  for (const block of css.split('/* ').slice(1)) {
    if (!/^latin(-ext)? \*\//.test(block)) continue;
    const m = block.match(/url\((https:[^)]+)\)/);
    if (m) urls.push(m[1]);
  }
  await Promise.all(urls.map(async (u) => {
    const r = await fetch(u, { mode: 'cors' });
    if (r.ok) await cache.put(u, r);
  }));
}

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keep = [SHELL_CACHE, DATA_CACHE, FONT_CACHE];
    for (const key of await caches.keys()) {
      if (key.startsWith('culture-') && !keep.includes(key)) await caches.delete(key);
    }
    if (self.registration.navigationPreload) await self.registration.navigationPreload.enable();
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Polices Google
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(staleWhileRevalidate(req, FONT_CACHE));
    return;
  }
  if (url.origin !== self.location.origin) return;

  const scope = new URL(self.registration.scope);
  const path = url.pathname.slice(scope.pathname.length);

  // Navigations : réseau d'abord (HTML toujours frais), coquille en secours hors ligne
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const preload = await event.preloadResponse;
        const res = preload || await fetch(req);
        if (res.ok) {
          const copy = res.clone();
          caches.open(SHELL_CACHE).then((c) => c.put('index.html', copy));
        }
        return res;
      } catch {
        return (await caches.match('index.html', { cacheName: SHELL_CACHE })) ||
               (await caches.match('./', { cacheName: SHELL_CACHE })) ||
               Response.error();
      }
    })());
    return;
  }

  // Données et images : réseau d'abord, cache en secours
  if (path === 'data.json' || path.startsWith('images/')) {
    event.respondWith(networkFirst(req, DATA_CACHE));
    return;
  }

  // Coquille : cache d'abord (versionné), réseau sinon
  event.respondWith((async () => {
    const hit = await caches.match(req, { cacheName: SHELL_CACHE, ignoreSearch: true });
    return hit || fetch(req);
  })());
});

async function networkFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  const key = req.url.split('?')[0];
  try {
    const res = await fetch(req);
    if (res.ok) await cache.put(key, res.clone());
    return res;
  } catch (err) {
    const hit = await cache.match(key);
    if (hit) return hit;
    throw err;
  }
}

async function staleWhileRevalidate(req, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req);
  const net = fetch(req).then((res) => {
    if (res.ok || res.type === 'opaque') cache.put(req, res.clone());
    return res;
  }).catch(() => hit);
  return hit || net;
}
