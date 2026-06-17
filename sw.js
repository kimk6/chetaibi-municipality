// Service Worker — بلدية شطايبي PWA
// الإصدار يتغير تلقائياً عند كل نشر
const VERSION   = '__BUILD_DATE__'; // يُستبدل يدوياً عند كل رفع مثل: '2025-06-17'
const CACHE_PRE = 'chetaibi-v';
const CACHE     = CACHE_PRE + VERSION;

// ── Firebase Messaging ───────────────────────
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

firebase.initializeApp({
    apiKey:            "AIzaSyCWUUSEoz2zaz-0KVTWGbSmK_sVX1hyg8w",
    authDomain:        "chetaibi-71f80.firebaseapp.com",
    projectId:         "chetaibi-71f80",
    storageBucket:     "chetaibi-71f80.appspot.com",
    messagingSenderId: "314577571705",
    appId:             "1:314577571705:web:4063450187d6df202529a8",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(payload => {
    const { title, body, icon, click_action } = payload.notification || {};
    self.registration.showNotification(title || 'بلدية شطايبي', {
        body:     body || '',
        icon:     icon || 'https://cdn.jsdelivr.net/gh/kimk6/chetaibi-assets-v1@main/ui/app-icon.png',
        badge:    'https://cdn.jsdelivr.net/gh/kimk6/chetaibi-assets-v1@main/ui/app-icon.png',
        data:     { url: click_action || '/' },
        vibrate:  [200, 100, 200],
        dir:      'rtl',
        lang:     'ar',
        tag:      'chetaibi-notif',
        renotify: true,
    });
});

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

// ── Cache: الملفات الأساسية ──────────────────
const PRECACHE = ['/', '/index.html', '/manifest.json'];

self.addEventListener('install', e => {
    e.waitUntil(
        caches.open(CACHE)
            .then(c => c.addAll(PRECACHE))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', e => {
    e.waitUntil(
        caches.keys()
            .then(keys => Promise.all(
                // حذف كل الـ caches القديمة التي تبدأ بنفس البادئة
                keys.filter(k => k.startsWith(CACHE_PRE) && k !== CACHE)
                    .map(k => caches.delete(k))
            ))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', e => {
    const url = new URL(e.request.url);

    // ── API: دائماً من الشبكة (network only) ─
    if (url.pathname.startsWith('/api/')) return;

    // ── CDN الصور: cache first ────────────────
    if (url.hostname === 'cdn.jsdelivr.net' || url.hostname === 'fonts.gstatic.com') {
        e.respondWith(
            caches.match(e.request).then(cached => {
                if (cached) return cached;
                return fetch(e.request).then(res => {
                    if (res?.ok) caches.open(CACHE).then(c => c.put(e.request, res.clone()));
                    return res;
                });
            })
        );
        return;
    }

    // ── الملفات الأساسية: network first مع fallback ──
    if (e.request.method !== 'GET') return;
    e.respondWith(
        fetch(e.request)
            .then(res => {
                if (res?.ok) caches.open(CACHE).then(c => c.put(e.request, res.clone()));
                return res;
            })
            .catch(() => caches.match(e.request))
    );
});
