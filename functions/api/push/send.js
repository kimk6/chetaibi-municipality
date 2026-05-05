// functions/api/push/send.js
// يستخدم Web Crypto API الصحيحة لـ Cloudflare Workers
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
            return createResponse({ success: false, error: 'VAPID_PUBLIC و VAPID_PRIVATE غير موجودين في Environment Variables في Cloudflare' }, 500);
        }

        const { results: subs } = await env.DB.prepare('SELECT * FROM push_subscriptions').all();
        if (!subs || subs.length === 0) {
            return createResponse({ success: true, sent: 0 });
        }

        const payload = JSON.stringify({
            title,
            body,
            url:   url || '/',
            icon:  'https://cdn.jsdelivr.net/gh/kimk6/chetaibi-assets-v1@main/ui/app-icon.png',
        });

        let sent = 0, failed = 0;
        const toDelete = [];

        // استيراد مفاتيح VAPID مرة واحدة
        const { privateJwk, publicRaw } = await importVapidKeys(VAPID_PUBLIC, VAPID_PRIVATE);

        for (const sub of subs) {
            try {
                const res = await webPush(sub, payload, privateJwk, publicRaw, VAPID_PUBLIC, VAPID_SUBJECT);
                if (res.status === 201 || res.status === 200 || res.status === 202) {
                    sent++;
                } else if (res.status === 404 || res.status === 410) {
                    toDelete.push(sub.endpoint);
                } else {
                    const txt = await res.text().catch(() => '');
                    console.error(`Push failed ${res.status}: ${txt}`);
                    failed++;
                }
            } catch (e) {
                console.error('Push error:', e.message);
                failed++;
            }
        }

        for (const ep of toDelete) {
            await env.DB.prepare('DELETE FROM push_subscriptions WHERE endpoint=?').bind(ep).run().catch(() => {});
        }

        return createResponse({ success: true, sent, failed, total: subs.length });
    } catch (e) {
        return createResponse({ success: false, error: e.message }, 500);
    }
}

// ══════════════════════════════════════════
// استيراد مفاتيح VAPID من Base64url
// ══════════════════════════════════════════
async function importVapidKeys(publicB64, privateB64) {
    const pubBytes  = b64decode(publicB64);   // 65 bytes uncompressed P-256
    const privBytes = b64decode(privateB64);  // 32 bytes scalar

    // بناء JWK من الـ bytes
    const x = pubBytes.slice(1, 33);
    const y = pubBytes.slice(33, 65);

    const privateJwk = await crypto.subtle.importKey(
        'jwk',
        {
            kty: 'EC', crv: 'P-256',
            x: b64encode(x),
            y: b64encode(y),
            d: b64encode(privBytes),
        },
        { name: 'ECDSA', namedCurve: 'P-256' },
        false, ['sign']
    );

    return { privateJwk, publicRaw: pubBytes };
}

// ══════════════════════════════════════════
// إرسال Push Notification واحد
// ══════════════════════════════════════════
async function webPush(sub, payload, privateJwk, publicRaw, vapidPublic, subject) {
    const endpoint = sub.endpoint;
    const origin   = new URL(endpoint).origin;
    const exp      = Math.floor(Date.now() / 1000) + 43200;

    // JWT
    const jwt = await makeJWT({ aud: origin, exp, sub: subject }, privateJwk);

    // تشفير Payload
    const encrypted = await encryptPayload(
        new TextEncoder().encode(payload),
        b64decode(sub.p256dh),
        b64decode(sub.auth),
    );

    return fetch(endpoint, {
        method:  'POST',
        headers: {
            'Authorization':    `vapid t=${jwt},k=${vapidPublic}`,
            'Content-Type':     'application/octet-stream',
            'Content-Encoding': 'aes128gcm',
            'TTL':              '86400',
        },
        body: encrypted,
    });
}

// ══════════════════════════════════════════
// JWT ES256
// ══════════════════════════════════════════
async function makeJWT(claims, privateKey) {
    const header  = b64encode(new TextEncoder().encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
    const body    = b64encode(new TextEncoder().encode(JSON.stringify(claims)));
    const input   = `${header}.${body}`;
    const sigBuf  = await crypto.subtle.sign(
        { name: 'ECDSA', hash: 'SHA-256' },
        privateKey,
        new TextEncoder().encode(input)
    );
    return `${input}.${b64encode(new Uint8Array(sigBuf))}`;
}

// ══════════════════════════════════════════
// تشفير aes128gcm (RFC 8291)
// ══════════════════════════════════════════
async function encryptPayload(plaintext, p256dh, auth) {
    // مفتاح محلي مؤقت
    const localKP = await crypto.subtle.generateKey(
        { name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']
    );
    const localPubRaw = new Uint8Array(await crypto.subtle.exportKey('raw', localKP.publicKey));

    // مفتاح العميل
    const clientPub = await crypto.subtle.importKey(
        'raw', p256dh, { name: 'ECDH', namedCurve: 'P-256' }, false, []
    );

    // ECDH shared secret
    const sharedBits = new Uint8Array(
        await crypto.subtle.deriveBits({ name: 'ECDH', public: clientPub }, localKP.privateKey, 256)
    );

    // Salt 16 bytes
    const salt = crypto.getRandomValues(new Uint8Array(16));

    // HKDF PRK
    const prkInfo = concat(new TextEncoder().encode('Content-Encoding: auth\0'), new Uint8Array(0));
    const prk = await hkdfExtract(auth, sharedBits);
    const prkExpanded = await hkdfExpand(prk, new TextEncoder().encode('Content-Encoding: auth\0'), 32);

    // keyInfo و nonceInfo
    const clientKeyArr = new Uint8Array(p256dh);
    const keyInfo   = buildInfo('aesgcm', localPubRaw, clientKeyArr);
    const nonceInfo = buildInfo('nonce',  localPubRaw, clientKeyArr);

    const contentKey = await hkdfExpand(await hkdfExtract(salt, prkExpanded), keyInfo, 16);
    const nonce      = await hkdfExpand(await hkdfExtract(salt, prkExpanded), nonceInfo, 12);

    const aesKey = await crypto.subtle.importKey('raw', contentKey, 'AES-GCM', false, ['encrypt']);

    // Padding: 2 bytes pad length + plaintext
    const padded = new Uint8Array(2 + plaintext.length);
    padded.set(plaintext, 2);

    const cipherBuf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aesKey, padded);
    const cipher    = new Uint8Array(cipherBuf);

    // رسالة aes128gcm النهائية
    const rs  = 4096;
    const out = new Uint8Array(16 + 4 + 1 + localPubRaw.length + cipher.length);
    let i = 0;
    out.set(salt, i);                                         i += 16;
    new DataView(out.buffer).setUint32(i, rs, false);         i += 4;
    out[i++] = localPubRaw.length;
    out.set(localPubRaw, i);                                  i += localPubRaw.length;
    out.set(cipher, i);

    return out.buffer;
}

async function hkdfExtract(salt, ikm) {
    const saltKey = await crypto.subtle.importKey('raw', salt, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    return new Uint8Array(await crypto.subtle.sign('HMAC', saltKey, ikm));
}

async function hkdfExpand(prk, info, len) {
    const prkKey = await crypto.subtle.importKey('raw', prk, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const t1Inp  = concat(info, new Uint8Array([1]));
    const t1     = new Uint8Array(await crypto.subtle.sign('HMAC', prkKey, t1Inp));
    return t1.slice(0, len);
}

function buildInfo(type, localKey, remoteKey) {
    const label = new TextEncoder().encode(`Content-Encoding: ${type}\0P-256\0`);
    const out   = new Uint8Array(label.length + 2 + localKey.length + 2 + remoteKey.length);
    let i = 0;
    out.set(label, i);                                              i += label.length;
    new DataView(out.buffer).setUint16(i, localKey.length, false);  i += 2;
    out.set(localKey, i);                                           i += localKey.length;
    new DataView(out.buffer).setUint16(i, remoteKey.length, false); i += 2;
    out.set(remoteKey, i);
    return out;
}

function concat(...arrays) {
    const total = arrays.reduce((s, a) => s + a.length, 0);
    const out = new Uint8Array(total);
    let i = 0;
    for (const a of arrays) { out.set(a, i); i += a.length; }
    return out;
}

function b64encode(data) {
    const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
    let bin = '';
    for (const b of bytes) bin += String.fromCharCode(b);
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function b64decode(str) {
    const pad = '='.repeat((4 - str.length % 4) % 4);
    const b64 = (str + pad).replace(/-/g, '+').replace(/_/g, '/');
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
}
