// functions/api/push/send.js
// إرسال Web Push باستخدام VAPID عبر Web Crypto API (متوافق مع Cloudflare Workers)
import { withAuth, createResponse, handleOptions } from '../_utils.js';

export async function onRequestOptions() { return handleOptions(); }

export async function onRequestPost(context) {
    const auth = await withAuth(context);
    if (auth) return auth;

    try {
        const { title, body, url = '/', icon } = await context.request.json();
        if (!title || !body) {
            return createResponse({ success: false, error: 'العنوان والرسالة مطلوبان' }, 400);
        }

        // ── 1. تحميل المفاتيح من env ──
        const vapidPublic  = context.env.VAPID_PUBLIC;
        const vapidPrivate = context.env.VAPID_PRIVATE;
        const vapidSubject = context.env.VAPID_SUBJECT || 'mailto:apc.chetaibi.officiel@gmail.com';

        if (!vapidPublic || !vapidPrivate) {
            return createResponse({ success: false, error: 'VAPID keys غير مضبوطة في Cloudflare env' }, 500);
        }

        // ── 2. جلب الاشتراكات ──
        const { results: subs } = await context.env.DB
            .prepare('SELECT * FROM push_subscriptions')
            .all().catch(() => ({ results: [] }));

        if (!subs || subs.length === 0) {
            return createResponse({ success: true, sent: 0, message: 'لا يوجد مشتركون' });
        }

        // ── 3. بيانات الإشعار ──
        const payload = JSON.stringify({
            title,
            body,
            icon:  icon || 'https://cdn.jsdelivr.net/gh/kimk6/chetaibi-assets-v1@main/ui/app-icon.png',
            badge: 'https://cdn.jsdelivr.net/gh/kimk6/chetaibi-assets-v1@main/ui/app-icon.png',
            url,
            data:  { url }
        });

        // ── 4. إرسال لكل مشترك ──
        let sent = 0;
        const expired = [];

        await Promise.allSettled(subs.map(async (sub) => {
            try {
                const result = await sendWebPush({
                    endpoint:  sub.endpoint,
                    p256dh:    sub.p256dh,
                    auth:      sub.auth,
                    payload,
                    vapidPublic,
                    vapidPrivate,
                    vapidSubject,
                });
                if (result.ok) {
                    sent++;
                } else if (result.status === 404 || result.status === 410) {
                    expired.push(sub.endpoint);
                }
            } catch {}
        }));

        // حذف الاشتراكات المنتهية
        if (expired.length > 0) {
            await Promise.allSettled(expired.map(ep =>
                context.env.DB.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').bind(ep).run()
            ));
        }

        return createResponse({ success: true, sent, total: subs.length, expired: expired.length });

    } catch (e) {
        return createResponse({ success: false, error: e.message }, 500);
    }
}

// ════════════════════════════════════════════════════════
// Web Push VAPID — تنفيذ كامل بـ Web Crypto API
// بدون أي مكتبة خارجية (متوافق 100% مع Cloudflare Workers)
// ════════════════════════════════════════════════════════
async function sendWebPush({ endpoint, p256dh, auth, payload, vapidPublic, vapidPrivate, vapidSubject }) {
    const crypto = globalThis.crypto;

    // ── import VAPID private key (raw d value, base64url) ──
    const privRaw = base64urlToBytes(vapidPrivate);
    const pubRaw  = base64urlToBytes(vapidPublic);

    const vapidKey = await crypto.subtle.importKey(
        'jwk',
        {
            kty: 'EC', crv: 'P-256', ext: true,
            key_ops: ['sign'],
            x: bytesToBase64url(pubRaw.slice(1, 33)),
            y: bytesToBase64url(pubRaw.slice(33, 65)),
            d: vapidPrivate,
        },
        { name: 'ECDSA', namedCurve: 'P-256' },
        false,
        ['sign']
    );

    // ── VAPID JWT ──
    const urlObj   = new URL(endpoint);
    const audience = `${urlObj.protocol}//${urlObj.host}`;
    const expiry   = Math.floor(Date.now() / 1000) + 12 * 3600;

    const jwtHeader  = bytesToBase64url(new TextEncoder().encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
    const jwtPayload = bytesToBase64url(new TextEncoder().encode(JSON.stringify({ aud: audience, exp: expiry, sub: vapidSubject })));
    const jwtData    = `${jwtHeader}.${jwtPayload}`;

    const sig    = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, vapidKey, new TextEncoder().encode(jwtData));
    const jwtSig = bytesToBase64url(new Uint8Array(sig));
    const jwt    = `${jwtData}.${jwtSig}`;

    // ── تشفير الرسالة (ECDH + AES-128-GCM) ──
    const encrypted = await encryptPayload(payload, p256dh, auth);

    // ── إرسال ──
    return fetch(endpoint, {
        method: 'POST',
        headers: {
            'Authorization':  `vapid t=${jwt},k=${vapidPublic}`,
            'Content-Type':   'application/octet-stream',
            'Content-Encoding': 'aes128gcm',
            'TTL':            '86400',
        },
        body: encrypted,
    });
}

async function encryptPayload(plaintext, p256dhBase64, authBase64) {
    const crypto = globalThis.crypto;

    const receiverPub  = base64urlToBytes(p256dhBase64);
    const authSecret   = base64urlToBytes(authBase64);
    const plaintextBuf = new TextEncoder().encode(plaintext);

    // توليد مفتاح ECDH مؤقت
    const senderKeyPair = await crypto.subtle.generateKey(
        { name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveKey', 'deriveBits']
    );

    const senderPubRaw = new Uint8Array(await crypto.subtle.exportKey('raw', senderKeyPair.publicKey));

    const receiverKey = await crypto.subtle.importKey(
        'raw', receiverPub, { name: 'ECDH', namedCurve: 'P-256' }, true, []
    );

    const sharedBits = await crypto.subtle.deriveBits(
        { name: 'ECDH', public: receiverKey }, senderKeyPair.privateKey, 256
    );

    // salt عشوائي 16 bytes
    const salt = crypto.getRandomValues(new Uint8Array(16));

    // HKDF لاشتقاق مفتاح PRK
    const ikm = await hkdf(
        new Uint8Array(sharedBits),
        authSecret,
        concat(new TextEncoder().encode('WebPush: info\0'), receiverPub, senderPubRaw),
        32
    );

    const cek  = await hkdf(ikm, salt, labelCEK(),  16);
    const nonce = await hkdf(ikm, salt, labelNonce(), 12);

    const cekKey = await crypto.subtle.importKey('raw', cek, { name: 'AES-GCM' }, false, ['encrypt']);

    // padding: byte واحد 0x02 + plaintext
    const padded = concat(plaintextBuf, new Uint8Array([2]));
    const ct     = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce, tagLength: 128 }, cekKey, padded));

    // بناء الـ header بصيغة aes128gcm
    const rs     = new Uint8Array(4);
    new DataView(rs.buffer).setUint32(0, 4096, false);
    const keyid  = new Uint8Array([senderPubRaw.length]);
    const header = concat(salt, rs, keyid, senderPubRaw);

    return concat(header, ct);
}

// ── HKDF (P-256 / SHA-256) ──
async function hkdf(ikm, salt, info, length) {
    const crypto = globalThis.crypto;
    const saltKey = await crypto.subtle.importKey('raw', salt, { name: 'HKDF' }, false, ['deriveBits']);
    // Extract
    const prk = await crypto.subtle.deriveBits(
        { name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(32), info: new Uint8Array(0) },
        await crypto.subtle.importKey('raw', ikm, { name: 'HKDF' }, false, ['deriveBits']),
        256
    ).catch(() => null);
    // Simple HKDF expand
    const key = await crypto.subtle.importKey('raw', ikm, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const prk2Buf = await crypto.subtle.sign('HMAC', await crypto.subtle.importKey('raw', salt.length > 0 ? salt : new Uint8Array(32), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']), ikm);
    const prkKey  = await crypto.subtle.importKey('raw', new Uint8Array(prk2Buf), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const okmBuf  = await crypto.subtle.sign('HMAC', prkKey, concat(info, new Uint8Array([1])));
    return new Uint8Array(okmBuf).slice(0, length);
}

function labelCEK()   { return concat(new TextEncoder().encode('Content-Encoding: aes128gcm\0'), new Uint8Array([0])); }
function labelNonce() { return concat(new TextEncoder().encode('Content-Encoding: nonce\0'),      new Uint8Array([0])); }

function concat(...arrays) {
    const total = arrays.reduce((n, a) => n + a.length, 0);
    const out   = new Uint8Array(total);
    let offset  = 0;
    for (const a of arrays) { out.set(a, offset); offset += a.length; }
    return out;
}

function base64urlToBytes(s) {
    const pad = s + '='.repeat((4 - s.length % 4) % 4);
    return Uint8Array.from(atob(pad.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
}

function bytesToBase64url(buf) {
    return btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}
