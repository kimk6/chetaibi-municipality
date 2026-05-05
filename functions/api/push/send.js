// functions/api/push/send.js
// يرسل Push Notification لجميع المشتركين
import { withAuth, createResponse, handleOptions } from '../_utils.js';

export async function onRequestOptions() { return handleOptions(); }

export async function onRequestPost(context) {
    const auth = await withAuth(context);
    if (auth) return auth;

    const { env, request } = context;
    try {
        const { title, body, url, icon } = await request.json();
        if (!title || !body) return createResponse({ success: false, error: 'title و body مطلوبان' }, 400);

        // جلب كل المشتركين
        const { results: subs } = await env.DB.prepare('SELECT * FROM push_subscriptions').all();
        if (!subs || subs.length === 0) return createResponse({ success: true, sent: 0, message: 'لا يوجد مشتركون' });

        // VAPID keys — يجب تخزينها في Cloudflare env variables
        const VAPID_PUBLIC  = env.VAPID_PUBLIC  || '';
        const VAPID_PRIVATE = env.VAPID_PRIVATE || '';
        const VAPID_SUBJECT = env.VAPID_SUBJECT || 'mailto:apc.chetaibi.officiel@gmail.com';

        if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
            return createResponse({ success: false, error: 'VAPID keys غير مُعرَّفة في البيئة. أضف VAPID_PUBLIC و VAPID_PRIVATE في Cloudflare.' }, 500);
        }

        const payload = JSON.stringify({ title, body, url: url || '/', icon: icon || '' });

        let sent = 0, failed = 0;
        const toDelete = [];

        for (const sub of subs) {
            try {
                const res = await sendWebPush({
                    endpoint: sub.endpoint,
                    p256dh:   sub.p256dh,
                    auth:     sub.auth,
                    payload,
                    vapidPublic:  VAPID_PUBLIC,
                    vapidPrivate: VAPID_PRIVATE,
                    vapidSubject: VAPID_SUBJECT,
                });
                if (res.status === 201 || res.status === 200) {
                    sent++;
                } else if (res.status === 404 || res.status === 410) {
                    // الاشتراك منتهي — نحذفه
                    toDelete.push(sub.endpoint);
                    failed++;
                } else {
                    failed++;
                }
            } catch {
                failed++;
            }
        }

        // حذف الاشتراكات المنتهية
        for (const ep of toDelete) {
            await env.DB.prepare('DELETE FROM push_subscriptions WHERE endpoint=?').bind(ep).run().catch(()=>{});
        }

        return createResponse({ success: true, sent, failed, total: subs.length });
    } catch (e) {
        return createResponse({ success: false, error: e.message }, 500);
    }
}

// ── دالة إرسال Web Push بدون مكتبات خارجية (Web Crypto API) ──
async function sendWebPush({ endpoint, p256dh, auth, payload, vapidPublic, vapidPrivate, vapidSubject }) {
    const origin = new URL(endpoint).origin;
    const audience = origin;
    const expiration = Math.floor(Date.now() / 1000) + 43200; // 12 ساعة

    // بناء VAPID JWT
    const header  = b64url(JSON.stringify({ typ: 'JWT', alg: 'ES256' }));
    const claims  = b64url(JSON.stringify({ aud: audience, exp: expiration, sub: vapidSubject }));
    const toSign  = `${header}.${claims}`;

    const privKeyBytes = b64decode(vapidPrivate);
    const privKey = await crypto.subtle.importKey(
        'pkcs8', privKeyBytes,
        { name: 'ECDSA', namedCurve: 'P-256' },
        false, ['sign']
    );
    const sigBytes  = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, privKey, new TextEncoder().encode(toSign));
    const signature = b64url(sigBytes);
    const jwt = `${toSign}.${signature}`;

    // تشفير الـ payload
    const encrypted = await encryptPayload(payload, p256dh, auth);

    return fetch(endpoint, {
        method: 'POST',
        headers: {
            'Authorization': `vapid t=${jwt},k=${vapidPublic}`,
            'Content-Type':  'application/octet-stream',
            'Content-Encoding': 'aes128gcm',
            'TTL': '86400',
        },
        body: encrypted,
    });
}

// ── تشفير AES-GCM للـ Web Push ──
async function encryptPayload(payload, p256dhB64, authB64) {
    const encoder = new TextEncoder();
    const payloadBytes = encoder.encode(payload);

    const p256dh = b64decode(p256dhB64);
    const authBytes = b64decode(authB64);

    // مفتاح ECDH مؤقت
    const localKey = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveKey', 'deriveBits']);
    const localPubKeyRaw = await crypto.subtle.exportKey('raw', localKey.publicKey);

    // استيراد مفتاح المستخدم
    const remoteKey = await crypto.subtle.importKey('raw', p256dh, { name: 'ECDH', namedCurve: 'P-256' }, false, []);

    // ECDH shared secret
    const sharedBits = await crypto.subtle.deriveBits({ name: 'ECDH', public: remoteKey }, localKey.privateKey, 256);

    // salt عشوائي 16 byte
    const salt = crypto.getRandomValues(new Uint8Array(16));

    // HKDF
    const ikm = await hkdf(authBytes, new Uint8Array(sharedBits), encoder.encode('Content-Encoding: auth\0'), 32);
    const keyInfo = buildInfo('aesgcm', new Uint8Array(localPubKeyRaw), p256dh);
    const nonceInfo = buildInfo('nonce', new Uint8Array(localPubKeyRaw), p256dh);

    const contentKey = await hkdfKey(salt, new Uint8Array(ikm), keyInfo, 16);
    const nonce = await hkdf(salt, new Uint8Array(ikm), nonceInfo, 12);

    const aesKey = await crypto.subtle.importKey('raw', contentKey, 'AES-GCM', false, ['encrypt']);
    const padded = new Uint8Array([0, 0, ...payloadBytes]);
    const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aesKey, padded);

    // بناء رسالة aes128gcm
    const rs = 4096;
    const result = new Uint8Array(21 + localPubKeyRaw.byteLength + ciphertext.byteLength);
    result.set(salt, 0);
    new DataView(result.buffer).setUint32(16, rs, false);
    result[20] = localPubKeyRaw.byteLength;
    result.set(new Uint8Array(localPubKeyRaw), 21);
    result.set(new Uint8Array(ciphertext), 21 + localPubKeyRaw.byteLength);

    return result.buffer;
}

async function hkdf(salt, ikm, info, length) {
    const keyMaterial = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, keyMaterial, length * 8);
    return new Uint8Array(bits);
}

async function hkdfKey(salt, ikm, info, length) {
    return hkdf(salt, ikm, info, length);
}

function buildInfo(type, clientKey, serverKey) {
    const enc = new TextEncoder();
    const prefix = enc.encode(`Content-Encoding: ${type}\0P-256\0`);
    const result = new Uint8Array(prefix.length + 2 + clientKey.length + 2 + serverKey.length);
    let offset = 0;
    result.set(prefix, offset); offset += prefix.length;
    new DataView(result.buffer).setUint16(offset, clientKey.length, false); offset += 2;
    result.set(clientKey, offset); offset += clientKey.length;
    new DataView(result.buffer).setUint16(offset, serverKey.length, false); offset += 2;
    result.set(serverKey, offset);
    return result;
}

function b64url(data) {
    const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : new Uint8Array(data);
    return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function b64decode(str) {
    const s = str.replace(/-/g, '+').replace(/_/g, '/');
    const bin = atob(s);
    const buf = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
    return buf.buffer;
}
