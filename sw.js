// Service Worker — بلدية شطايبي PWA
const CACHE = 'chetaibi-v1';
const STATIC = [
    '/',
    '/index.html',
    '/manifest.json',
];

// تثبيت: تخزين الملفات الأساسية
self.addEventListener('install', e => {
    e.waitUntil(
        caches.open(CACHE).then(c => c.addAll(STATIC)).then(() => self.skipWaiting())
    );
});

// تفعيل: حذف الكاش القديم
self.addEventListener('activate', e => {
    e.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
        ).then(() => self.clients.claim())
    );
});

// جلب: Network First للـ API، Cache First للملفات الثابتة
self.addEventListener('fetch', e => {
    const url = new URL(e.request.url);

    // API دائماً من الشبكة
    if (url.pathname.startsWith('/api/')) {
        e.respondWith(fetch(e.request).catch(() => new Response('{}', { headers: { 'Content-Type': 'application/json' } })));
        return;
    }

    // باقي الطلبات: الشبكة أولاً ثم الكاش
    e.respondWith(
        fetch(e.request)
            .then(res => {
                if (res && res.status === 200 && e.request.method === 'GET') {
                    const clone = res.clone();
                    caches.open(CACHE).then(c => c.put(e.request, clone));
                }
                return res;
            })
            .catch(() => caches.match(e.request))
    );
});
