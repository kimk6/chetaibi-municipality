// sw.js — شطايبي
// الصفحة الرئيسية: الشبكة أولاً دوماً (يرى المستخدم آخر تحديث فوراً)، والكاش احتياطي فقط عند انعدام الاتصال
// API: نفس المبدأ — شبكة أولاً، بيانات حية
const CACHE_NAME = 'chetaibi-shell-v2';
const SHELL_FILES = ['/manifest.json'];

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

  // التنقل (تحميل الصفحة نفسها) والـ API: الشبكة أولاً دوماً، الكاش فقط عند فشل الاتصال
  if (event.request.mode === 'navigate' || url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          if (event.request.mode === 'navigate') {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(event.request, clone));
          }
          return res;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // بقية الملفات الثابتة: تخزين مؤقت أولاً
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
