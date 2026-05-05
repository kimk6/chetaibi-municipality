// Service Worker — بلدية شطايبي PWA + FCM
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

// استقبال الإشعارات في الخلفية
messaging.onBackgroundMessage(payload => {
    const { title, body, icon, click_action } = payload.notification || {};
    self.registration.showNotification(title || 'بلدية شطايبي', {
        body:    body || '',
        icon:    icon || 'https://cdn.jsdelivr.net/gh/kimk6/chetaibi-assets-v1@main/ui/app-icon.png',
        badge:   'https://cdn.jsdelivr.net/gh/kimk6/chetaibi-assets-v1@main/ui/app-icon.png',
        data:    { url: click_action || '/' },
        vibrate: [200, 100, 200],
        dir:     'rtl',
        lang:    'ar',
        tag:     'chetaibi-notif',
        renotify: true,
    });
});

// النقر على الإشعار
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

// Cache
const CACHE = 'chetaibi-v3';
self.addEventListener('install', e => {
    e.waitUntil(
        caches.open(CACHE).then(c => c.addAll(['/', '/index.html', '/manifest.json']))
            .then(() => self.skipWaiting())
    );
});
self.addEventListener('activate', e => {
    e.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
        ).then(() => self.clients.claim())
    );
});
self.addEventListener('fetch', e => {
    const url = new URL(e.request.url);
    if (url.pathname.startsWith('/api/')) return;
    e.respondWith(
        fetch(e.request).then(res => {
            if (res?.status === 200 && e.request.method === 'GET')
                caches.open(CACHE).then(c => c.put(e.request, res.clone()));
            return res;
        }).catch(() => caches.match(e.request))
    );
});
