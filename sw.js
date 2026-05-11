// Service Worker — بلدية شطايبي PWA v3
const CACHE_STATIC  = 'chetaibi-static-v3';
const CACHE_DYNAMIC = 'chetaibi-dynamic-v3';
const CACHE_IMAGES  = 'chetaibi-images-v3';

const STATIC_ASSETS = ['/', '/index.html', '/manifest.json'];

// ── Offline fallback HTML ──
const OFFLINE_HTML = `<!DOCTYPE html><html lang="ar" dir="rtl">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>غير متصل — بلدية شطايبي</title>
<style>*{font-family:'Cairo',sans-serif}body{background:#f0fdf4;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;flex-direction:column;gap:16px;text-align:center;padding:20px}img{width:90px;height:90px;border-radius:50%;box-shadow:0 4px 16px rgba(0,0,0,.12)}.title{font-size:22px;font-weight:900;color:#064e3b}.sub{font-size:14px;color:#6b7280;max-width:280px}.btn{background:#059669;color:white;border:none;padding:12px 28px;border-radius:12px;font-size:15px;font-weight:700;cursor:pointer;font-family:inherit}</style>
</head><body>
<img src="https://cdn.jsdelivr.net/gh/kimk6/chetaibi-assets-v1@main/ui/logo.webp" alt="شعار">
<p class="title">أنت غير متصل</p>
<p class="sub">يرجى التحقق من اتصالك بالإنترنت للوصول إلى محتوى بلدية شطايبي</p>
<button class="btn" onclick="location.reload()">إعادة المحاولة</button>
</body></html>`;

// ── Install ──
self.addEventListener('install', e => {
    e.waitUntil(
        caches.open(CACHE_STATIC)
            .then(c => c.addAll(STATIC_ASSETS))
            .then(() => self.skipWaiting())
    );
});

// ── Activate ──
self.addEventListener('activate', e => {
    const allowed = [CACHE_STATIC, CACHE_DYNAMIC, CACHE_IMAGES];
    e.waitUntil(
        caches.keys()
            .then(keys => Promise.all(keys.filter(k => !allowed.includes(k)).map(k => caches.delete(k))))
            .then(() => self.clients.claim())
    );
});

// ── Fetch ──
self.addEventListener('fetch', e => {
    const url = new URL(e.request.url);

    // API — Network first, no cache
    if (url.pathname.startsWith('/api/')) {
        e.respondWith(
            fetch(e.request)
                .then(res => {
                    if (res.ok) {
                        const clone = res.clone();
                        caches.open(CACHE_DYNAMIC).then(c => c.put(e.request, clone));
                    }
                    return res;
                })
                .catch(() => caches.match(e.request)
                    .then(cached => cached || new Response('{"success":false,"offline":true}',
                        { headers: { 'Content-Type': 'application/json' } }))
                )
        );
        return;
    }

    // Fonts / CDN — Cache first
    if (url.hostname.includes('fonts.') || url.hostname.includes('cdn.jsdelivr') || url.hostname.includes('gstatic')) {
        e.respondWith(
            caches.match(e.request).then(cached => {
                if (cached) return cached;
                return fetch(e.request).then(res => {
                    caches.open(CACHE_IMAGES).then(c => c.put(e.request, res.clone()));
                    return res;
                });
            })
        );
        return;
    }

    // Images — Cache first with fallback
    if (e.request.destination === 'image') {
        e.respondWith(
            caches.match(e.request).then(cached => {
                if (cached) return cached;
                return fetch(e.request).then(res => {
                    if (res.ok) caches.open(CACHE_IMAGES).then(c => c.put(e.request, res.clone()));
                    return res;
                }).catch(() => new Response('', { status: 404 }));
            })
        );
        return;
    }

    // HTML — Network first, offline fallback
    if (e.request.mode === 'navigate') {
        e.respondWith(
            fetch(e.request)
                .then(res => {
                    if (res.ok) caches.open(CACHE_STATIC).then(c => c.put(e.request, res.clone()));
                    return res;
                })
                .catch(() => caches.match(e.request)
                    .then(cached => cached || new Response(OFFLINE_HTML,
                        { headers: { 'Content-Type': 'text/html; charset=utf-8' } }))
                )
        );
        return;
    }

    // الباقي — Stale while revalidate
    e.respondWith(
        caches.match(e.request).then(cached => {
            const fetchPromise = fetch(e.request).then(res => {
                if (res.ok && e.request.method === 'GET')
                    caches.open(CACHE_DYNAMIC).then(c => c.put(e.request, res.clone()));
                return res;
            }).catch(() => cached);
            return cached || fetchPromise;
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
            data:    { url: data.url },
            vibrate: [200, 100, 200],
            dir:     'rtl', lang: 'ar',
            tag:     'chetaibi-notif', renotify: true,
        })
    );
});

self.addEventListener('notificationclick', e => {
    e.notification.close();
    const url = e.notification.data?.url || '/';
    e.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cls => {
            for (const c of cls) if (c.url.includes(self.location.origin)) { c.focus(); c.navigate(url); return; }
            return clients.openWindow(url);
        })
    );
});

self.addEventListener('message', e => {
    if (e.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
