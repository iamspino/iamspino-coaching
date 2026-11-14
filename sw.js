// Service worker dell'app cliente: permette di aprire l'app e le schede anche offline.
const CACHE = 'iamspino-cliente-v1';
const SHELL = ['cliente.html', 'manifest.webmanifest', 'icon.png', 'icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // I dati di Firestore li gestisce l'SDK (con la sua cache offline): non toccarli.
  if (url.hostname.endsWith('googleapis.com') && !url.hostname.startsWith('fonts')) return;

  const cacheable = url.origin === location.origin || url.hostname === 'www.gstatic.com' ||
                    url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (!cacheable) return;

  // Rete prima (così gli aggiornamenti arrivano subito), cache se offline.
  e.respondWith(
    fetch(req).then(res => {
      if (res.ok || res.type === 'opaque') {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
      }
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: true }))
  );
});
