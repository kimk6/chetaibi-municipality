// sw.js — شطايبي
// شبكة أولاً لـ API (بيانات حديثة دوماً)، تخزين مؤقت أولاً للصدفة الثابتة
const CACHE_NAME = 'chetaibi-shell-v1';
const SHELL_FILES = ['/', '/manifest.json'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // API: شبكة أولاً، بدون تخزين (بيانات حية دوماً)
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
    return;
  }

  // الصدفة الثابتة (HTML/manifest): تخزين مؤقت أولاً
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
