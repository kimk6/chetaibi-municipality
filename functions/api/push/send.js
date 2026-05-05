// functions/api/push/send.js
import { withAuth, createResponse, handleOptions } from '../_utils.js';

export async function onRequestOptions() { return handleOptions(); }

export async function onRequestPost(context) {
    const auth = await withAuth(context);
    if (auth) return auth;

    const { env, request } = context;
    try {
        const { title, body, url } = await request.json();
        if (!title || !body) return createResponse({ success: false, error: 'title و body مطلوبان' }, 400);

        const VAPID_PUBLIC  = env.VAPID_PUBLIC;
        const VAPID_PRIVATE = env.VAPID_PRIVATE;
        const VAPID_SUBJECT = env.VAPID_SUBJECT || 'mailto:apc.chetaibi.officiel@gmail.com';

        if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
            return createResponse({ success: false, error: 'VAPID_PUBLIC و VAPID_PRIVATE غير موجودين في Environment Variables' }, 500);
        }

        const { results: subs } = await env.DB.prepare('SELECT * FROM push_subscriptions').all();
        if (!subs || subs.length === 0) {
            return createResponse({ success: true, sent: 0, message: 'لا يوجد مشتركون' });
        }

        const payload = JSON.stringify({
            title,
            body,
            url:   url || '/',
            icon:  'https://cdn.jsdelivr.net/gh/kimk6/chetaibi-assets-v1@main/ui/app-icon.png',
            badge: 'https://cdn.jsdelivr.net/gh/kimk6/chetaibi-assets-v1@main/ui/app-icon.png',
        });

        let sent = 0, failed = 0;
        const toDelete = [];

        for (const sub of subs) {
            try {
                const result = await sendPush(sub, payload, VAPID_PUBLIC, VAPID_PRIVATE, VAPID_SUBJECT);
                if (result.ok) {
                    sent++;
                } else if (result.status === 404 || result.status === 410) {
                    toDelete.push(sub.endpoint);
                    failed++;
                } else {
                    failed++;
                }
            } catch (e) {
                failed++;
            }
        }

        // حذف الاشتراكات المنتهية
        for (const ep of toDelete) {
            await env.DB.prepare('DELETE FROM push_subscriptions WHERE endpoint=?').bind(ep).run().catch(() => {});
        }

        return createResponse({ success: true, sent, failed, total: subs.length });
    } catch (e) {
        return createResponse({ success: false, error: e.message }, 500);
    }
}

// ══════════════════════════════════════════════════════
// Web Push باستخدام Web Crypto API الأصلية في Cloudflare
// ══════════════════════════════════════════════════════
async function sendPush(sub, payload, vapidPublic, vapidPrivate, subject) {
    const endpoint = sub.endpoint;
    const origin   = new URL(endpoint).origin;
    const now      = Math.floor(Date.now() / 1000);
    const exp      = now + 43200;

    // ── بناء JWT للـ VAPID ──
    const header  = urlB64Encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' }));
    const claims  = urlB64Encode(JSON.stringify({ aud: origin, exp, sub: subject }));
    const msg     = `${header}.${claims}`;

    // استيراد المفتاح الخاص
    const privBytes = urlB64Decode(vapidPrivate);
    const privKey   = await crypto.subtle.importKey(
        'raw', privBytes,
        { name: 'ECDSA', namedCurve: 'P-256' },
        false, ['sign']
    ).catch(async () => {
        // جرب pkcs8 إذا فشل raw
        const pkcs8 = buildPkcs8(privBytes);
        return crypto.subtle.importKey('pkcs8', pkcs8, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
    });

    const sigBuf  = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, privKey, new TextEncoder().encode(msg));
    const sig     = urlB64EncodeBuffer(sigBuf);
    const jwt     = `${msg}.${sig}`;

    // ── تشفير الـ payload ──
    const encrypted = await encryptPayload(payload, sub.p256dh, sub.auth);

    return fetch(endpoint, {
        method: 'POST',
        headers: {
            'Authorization':    `vapid t=${jwt},k=${vapidPublic}`,
            'Content-Type':     'application/octet-stream',
            'Content-Encoding': 'aes128gcm',
            'TTL':              '86400',
        },
        body: encrypted,
    });
}

// ── تشفير Payload بـ aes128gcm ──
async function encryptPayload(plaintext, p256dhB64, authB64) {
    const enc      = new TextEncoder();
    const authInfo = enc.encode('Content-Encoding: auth\0');

    const p256dh   = urlB64Decode(p256dhB64);
    const authBytes = urlB64Decode(authB64);

    // مفتاح محلي مؤقت
    const localKP  = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
    const localPub = await crypto.subtle.exportKey('raw', localKP.publicKey);

    // مفتاح العميل
    const remotePub = await crypto.subtle.importKey('raw', p256dh, { name: 'ECDH', namedCurve: 'P-256' }, false, []);

    // ECDH
    const sharedBits = await crypto.subtle.deriveBits({ name: 'ECDH', public: remotePub }, localKP.privateKey, 256);

    // Salt
    const salt = crypto.getRandomValues(new Uint8Array(16));

    // PRK
    const prk = await hkdf(authBytes, new Uint8Array(sharedBits), authInfo, 32);

    // Content key + nonce
    const localPubArr  = new Uint8Array(localPub);
    const remotePubArr = new Uint8Array(p256dh);
    const keyInfo   = buildKeyInfo('aesgcm', localPubArr, remotePubArr);
    const nonceInfo = buildKeyInfo('nonce',  localPubArr, remotePubArr);

    const contentKey  = await hkdf(salt, new Uint8Array(prk), keyInfo,   16);
    const nonceBytes  = await hkdf(salt, new Uint8Array(prk), nonceInfo, 12);

    const aesKey = await crypto.subtle.importKey('raw', contentKey, 'AES-GCM', false, ['encrypt']);

    // Padding
    const text    = enc.encode(plaintext);
    const padded  = new Uint8Array(2 + text.length);
    padded.set(text, 2);

    const cipherBuf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonceBytes }, aesKey, padded);
    const cipher    = new Uint8Array(cipherBuf);

    // بناء الرسالة النهائية
    const rs       = 4096;
    const keyIdLen = localPubArr.length;
    const out      = new Uint8Array(16 + 4 + 1 + keyIdLen + cipher.length);
    let   off      = 0;

    out.set(salt, off);                    off += 16;
    new DataView(out.buffer).setUint32(off, rs, false); off += 4;
    out[off++] = keyIdLen;
    out.set(localPubArr, off);             off += keyIdLen;
    out.set(cipher, off);

    return out.buffer;
}

// ── HKDF ──
async function hkdf(salt, ikm, info, len) {
    const key  = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, len * 8);
    return new Uint8Array(bits);
}

function buildKeyInfo(type, clientKey, serverKey) {
    const label  = new TextEncoder().encode(`Content-Encoding: ${type}\0P-256\0`);
    const result = new Uint8Array(label.length + 2 + clientKey.length + 2 + serverKey.length);
    let i = 0;
    result.set(label, i);                                                       i += label.length;
    new DataView(result.buffer).setUint16(i, clientKey.length, false);          i += 2;
    result.set(clientKey, i);                                                   i += clientKey.length;
    new DataView(result.buffer).setUint16(i, serverKey.length, false);          i += 2;
    result.set(serverKey, i);
    return result;
}

// ── بناء PKCS8 من raw key (fallback) ──
function buildPkcs8(rawKey) {
    const header = new Uint8Array([
        0x30, 0x41, 0x02, 0x01, 0x00, 0x30, 0x13,
        0x06, 0x07, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02, 0x01,
        0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03, 0x01, 0x07,
        0x04, 0x27, 0x30, 0x25, 0x02, 0x01, 0x01, 0x04, 0x20,
    ]);
    const pkcs8 = new Uint8Array(header.length + rawKey.byteLength);
    pkcs8.set(header);
    pkcs8.set(new Uint8Array(rawKey), header.length);
    return pkcs8.buffer;
}

// ── Base64url helpers ──
function urlB64Encode(str) {
    return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}
function urlB64EncodeBuffer(buf) {
    const bytes = new Uint8Array(buf);
    let bin = '';
    for (const b of bytes) bin += String.fromCharCode(b);
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}
function urlB64Decode(str) {
    const s = (str + '===').slice(0, str.length + (4 - str.length % 4) % 4)
        .replace(/-/g, '+').replace(/_/g, '/');
    const bin = atob(s);
    const buf = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
    return buf.buffer;
}
