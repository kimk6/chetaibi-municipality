// Service Worker — بلدية شطايبي PWA v2
const CACHE = 'chetaibi-v2';
const STATIC = ['/', '/index.html', '/manifest.json'];

// ── تثبيت ──
self.addEventListener('install', e => {
    e.waitUntil(
        caches.open(CACHE).then(c => c.addAll(STATIC)).then(() => self.skipWaiting())
    );
});

// ── تفعيل ──
self.addEventListener('activate', e => {
    e.waitUntil(
        caches.keys()
            .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
            .then(() => self.clients.claim())
    );
});

// ── جلب ──
self.addEventListener('fetch', e => {
    const url = new URL(e.request.url);
    if (url.pathname.startsWith('/api/')) {
        e.respondWith(
            fetch(e.request).catch(() => new Response('{}', { headers: { 'Content-Type': 'application/json' } }))
        );
        return;
    }
    e.respondWith(
        fetch(e.request)
            .then(res => {
                if (res && res.status === 200 && e.request.method === 'GET') {
                    caches.open(CACHE).then(c => c.put(e.request, res.clone()));
                }
                return res;
            })
            .catch(() => caches.match(e.request))
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
            dir:     'rtl',
            lang:    'ar',
            tag:     'chetaibi-notif',
            renotify: true,
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
                if (c.url.includes(self.location.origin)) {
                    c.focus();
                    c.navigate(url);
                    return;
                }
            }
            return clients.openWindow(url);
        })
    );
});

// ── اشتراك Push ──
self.addEventListener('message', e => {
    if (e.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
