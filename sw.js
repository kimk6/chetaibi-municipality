// Service Worker — بلدية شطايبي PWA v3
const CACHE = 'chetaibi-v3';
const STATIC = ['/', '/index.html', '/app/', '/app/index.html', '/manifest.json'];

// ── تثبيت ──
self.addEventListener('install', e => {
    e.waitUntil(
        caches.open(CACHE)
            .then(c => c.addAll(STATIC))
            .then(() => self.skipWaiting())
    );
});

// ── تفعيل: احذف كل الكاشات القديمة فوراً ──
self.addEventListener('activate', e => {
    e.waitUntil(
        caches.keys()
            .then(keys => Promise.all(
                keys.filter(k => k !== CACHE).map(k => caches.delete(k))
            ))
            .then(() => self.clients.claim())
            // أجبر كل النوافذ المفتوحة على إعادة التحميل
            .then(() => self.clients.matchAll({ type: 'window' }))
            .then(clients => clients.forEach(c => c.navigate(c.url)))
    );
});

// ── جلب: Network First لـ HTML، Cache First للباقي ──
self.addEventListener('fetch', e => {
    const url = new URL(e.request.url);

    // API: دائماً من الشبكة
    if (url.pathname.startsWith('/api/')) {
        e.respondWith(
            fetch(e.request).catch(() =>
                new Response('{}', { headers: { 'Content-Type': 'application/json' } })
            )
        );
        return;
    }

    // HTML pages: Network First (يضمن دائماً أحدث نسخة)
    if (e.request.mode === 'navigate' || e.request.destination === 'document') {
        e.respondWith(
            fetch(e.request)
                .then(res => {
                    if (res && res.status === 200) {
                        caches.open(CACHE).then(c => c.put(e.request, res.clone()));
                    }
                    return res;
                })
                .catch(() => caches.match(e.request))
        );
        return;
    }

    // باقي الموارد: Cache First ثم شبكة
    e.respondWith(
        caches.match(e.request).then(cached => {
            if (cached) return cached;
            return fetch(e.request).then(res => {
                if (res && res.status === 200 && e.request.method === 'GET') {
                    caches.open(CACHE).then(c => c.put(e.request, res.clone()));
                }
                return res;
            });
        })
    );
});

// ── Push Notifications ──
self.addEventListener('push', e => {
    let data = { title: 'بلدية شطايبي', body: 'إشعار جديد', url: '/' };
    try { if (e.data) data = { ...data, ...e.data.json() }; } catch {}
    e.waitUntil(
        self.registration.showNotification(data.title, {
            body:    data.body,
            icon:    'https://cdn.jsdelivr.net/gh/kimk6/chetaibi-assets-v1@main/ui/app-icon.png',
            badge:   'https://cdn.jsdelivr.net/gh/kimk6/chetaibi-assets-v1@main/ui/app-icon.png',
            data:    { url: data.url || '/' },
            vibrate: [200, 100, 200],
            dir:     'rtl', lang: 'ar',
            tag:     'chetaibi-notif', renotify: true,
        })
    );
});

// ── النقر على الإشعار ──
self.addEventListener('notificationclick', e => {
    e.notification.close();
    const url = e.notification.data?.url || '/';
    e.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cls => {
            for (const c of cls) {
                if (c.url.includes(self.location.origin)) { c.focus(); c.navigate(url); return; }
            }
            return clients.openWindow(url);
        })
    );
});

self.addEventListener('message', e => {
    if (e.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
