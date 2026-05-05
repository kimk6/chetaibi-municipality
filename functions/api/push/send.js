// functions/api/push/send.js
import { withAuth, createResponse, handleOptions } from '../_utils.js';

export async function onRequestOptions() { return handleOptions(); }

export async function onRequestPost(context) {
    const auth = await withAuth(context);
    if (auth) return auth;

    try {
        const { title, body, url = '/', icon } = await context.request.json();
        if (!title || !body)
            return createResponse({ success: false, error: 'العنوان والرسالة مطلوبان' }, 400);

        // ── 1. تحميل المفاتيح ──
        const vapidPublic  = (context.env.VAPID_PUBLIC_KEY  || context.env.VAPID_PUBLIC  || '').trim();
        const vapidPrivate = (context.env.VAPID_PRIVATE_KEY || context.env.VAPID_PRIVATE || '').trim();
        const rawSubject   = (context.env.VAPID_SUBJECT || 'apc.chetaibi.officiel@gmail.com').trim();
        const vapidSubject = rawSubject.startsWith('mailto:') ? rawSubject : `mailto:${rawSubject}`;

        if (!vapidPublic && !vapidPrivate)
            return createResponse({ success: false, error: 'VAPID_PUBLIC_KEY و VAPID_PRIVATE_KEY غير موجودَين في env' }, 500);
        if (!vapidPublic)
            return createResponse({ success: false, error: 'VAPID_PUBLIC_KEY غير موجود في env' }, 500);
        if (!vapidPrivate)
            return createResponse({ success: false, error: 'VAPID_PRIVATE_KEY غير موجود في env' }, 500);

        // ── تحقق من صحة المفتاح الخاص قبل الإرسال ──
        const normalizedPriv = normalizePrivateKey(vapidPrivate);
        const privBytes = b64uToBytes(normalizedPriv);
        if (privBytes.length !== 32)
            return createResponse({
                success: false,
                error: `VAPID_PRIVATE_KEY غير صالح: الطول ${privBytes.length} byte (المطلوب 32 byte). تأكد أنه base64url للـ raw private key فقط (مثال: استخدم npx web-push generate-vapid-keys).`
            }, 500);

        // ── 2. جلب الاشتراكات ──
        const { results: subs } = await context.env.DB
            .prepare('SELECT * FROM push_subscriptions')
            .all().catch(() => ({ results: [] }));

        if (!subs || subs.length === 0) {
            let tableExists = false;
            try {
                await context.env.DB.prepare('SELECT 1 FROM push_subscriptions LIMIT 1').all();
                tableExists = true;
            } catch {}
            return createResponse({
                success: true,
                sent: 0,
                message: tableExists
                    ? 'الجدول موجود لكن لا يوجد مشتركون — تأكد أن المستخدم قبل الإشعارات في المتصفح'
                    : 'جدول push_subscriptions غير موجود — يجب تشغيل migrate أو إنشاء الجدول'
            });
        }

        // ── 3. بيانات الإشعار ──
        const payload = JSON.stringify({
            title, body,
            icon:  icon || 'https://cdn.jsdelivr.net/gh/kimk6/chetaibi-assets-v1@main/ui/app-icon.png',
            badge: 'https://cdn.jsdelivr.net/gh/kimk6/chetaibi-assets-v1@main/ui/app-icon.png',
            url, data: { url }
        });

        // ── 4. إرسال لكل مشترك ──
        let sent = 0;
        const expired = [];
        const errors  = [];

        await Promise.allSettled(subs.map(async (sub) => {
            try {
                const result = await sendWebPush({
                    endpoint:     sub.endpoint,
                    p256dh:       sub.p256dh,
                    auth:         sub.auth,
                    payload,
                    vapidPublic,
                    vapidPrivate: normalizedPriv,
                    vapidSubject,
                });
                if (result.ok) {
                    sent++;
                } else if (result.status === 404 || result.status === 410) {
                    expired.push(sub.endpoint);
                } else {
                    const txt = await result.text().catch(() => '');
                    errors.push(`[${result.status}] ${sub.endpoint.slice(0, 50)}… — ${txt.slice(0, 150)}`);
                }
            } catch (err) {
                errors.push(`exception: ${err.message}`);
            }
        }));

        // حذف الاشتراكات المنتهية
        if (expired.length > 0) {
            await Promise.allSettled(expired.map(ep =>
                context.env.DB
                    .prepare('DELETE FROM push_subscriptions WHERE endpoint = ?')
                    .bind(ep).run()
            ));
        }

        return createResponse({
            success: true,
            sent,
            total:   subs.length,
            expired: expired.length,
            ...(errors.length > 0 && { errors }),
        });

    } catch (e) {
        return createResponse({ success: false, error: e.message }, 500);
    }
}

// ════════════════════════════════════════════════════════
// Web Push — VAPID + AES-128-GCM
// ════════════════════════════════════════════════════════
async function sendWebPush({ endpoint, p256dh, auth, payload, vapidPublic, vapidPrivate, vapidSubject }) {
    const cry = globalThis.crypto;

    const pubRaw = b64uToBytes(vapidPublic);

    const vapidKey = await cry.subtle.importKey(
        'jwk',
        {
            kty:     'EC',
            crv:     'P-256',
            ext:     true,
            key_ops: ['sign'],
            x: bytesToB64u(pubRaw.slice(1, 33)),
            y: bytesToB64u(pubRaw.slice(33, 65)),
            d: vapidPrivate,   // already normalized to 32-byte b64u
        },
        { name: 'ECDSA', namedCurve: 'P-256' },
        false,
        ['sign']
    );

    const origin = new URL(endpoint);
    const aud    = `${origin.protocol}//${origin.host}`;
    const exp    = Math.floor(Date.now() / 1000) + 43200;

    const enc = (obj) => bytesToB64u(new TextEncoder().encode(JSON.stringify(obj)));
    const hdr = enc({ typ: 'JWT', alg: 'ES256' });
    const pld = enc({ aud, exp, sub: vapidSubject });
    const sig  = await cry.subtle.sign(
        { name: 'ECDSA', hash: 'SHA-256' },
        vapidKey,
        new TextEncoder().encode(`${hdr}.${pld}`)
    );
    const jwt = `${hdr}.${pld}.${bytesToB64u(new Uint8Array(sig))}`;

    const encrypted = await encryptPayload(payload, p256dh, auth);

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

// ── تعيير المفتاح الخاص — يقبل عدة صيغ ──
function normalizePrivateKey(key) {
    key = key.trim();

    // JWK string
    if (key.startsWith('{')) {
        try { const j = JSON.parse(key); if (j.d) return j.d; } catch {}
    }

    // PEM — استخرج d من DER
    if (key.includes('-----')) {
        const b64 = key.replace(/-----[^-]+-----/g, '').replace(/\s/g, '');
        const der = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
        // ECPrivateKey DER: ... 04 20 [32 bytes d] ...
        for (let i = 0; i < der.length - 33; i++) {
            if (der[i] === 0x04 && der[i + 1] === 0x20) {
                return bytesToB64u(der.slice(i + 2, i + 34));
            }
        }
    }

    // base64 standard → base64url
    if (key.includes('+') || key.includes('/')) {
        key = key.replace(/\+/g, '-').replace(/\//g, '_');
    }

    // أزل padding
    return key.replace(/=/g, '').replace(/\s/g, '');
}

// ── تشفير AES-128-GCM (RFC 8291) ──
async function encryptPayload(plaintext, p256dhB64, authB64) {
    const cry = globalThis.crypto;

    const receiverPub = b64uToBytes(p256dhB64);
    const authSecret  = b64uToBytes(authB64);
    const salt        = cry.getRandomValues(new Uint8Array(16));

    const senderKP  = await cry.subtle.generateKey(
        { name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']
    );
    const senderPub = new Uint8Array(await cry.subtle.exportKey('raw', senderKP.publicKey));
    const receiverKey = await cry.subtle.importKey(
        'raw', receiverPub, { name: 'ECDH', namedCurve: 'P-256' }, false, []
    );
    const ecdhBits = new Uint8Array(
        await cry.subtle.deriveBits({ name: 'ECDH', public: receiverKey }, senderKP.privateKey, 256)
    );

    const hkdf = async (ikm, salt, info, len) => {
        const ikmKey = await cry.subtle.importKey('raw', ikm, { name: 'HKDF' }, false, ['deriveBits']);
        return new Uint8Array(await cry.subtle.deriveBits(
            { name: 'HKDF', hash: 'SHA-256', salt, info }, ikmKey, len * 8
        ));
    };

    const ikm = await hkdf(
        ecdhBits,
        authSecret,
        concat(new TextEncoder().encode('WebPush: info\0'), receiverPub, senderPub),
        32
    );
    const cek   = await hkdf(ikm, salt, concat(new TextEncoder().encode('Content-Encoding: aes128gcm\0'), new Uint8Array([0])), 16);
    const nonce = await hkdf(ikm, salt, concat(new TextEncoder().encode('Content-Encoding: nonce\0'),     new Uint8Array([0])), 12);

    const cekKey = await cry.subtle.importKey('raw', cek, { name: 'AES-GCM' }, false, ['encrypt']);
    const padded = concat(new TextEncoder().encode(plaintext), new Uint8Array([2]));
    const ct     = new Uint8Array(
        await cry.subtle.encrypt({ name: 'AES-GCM', iv: nonce, tagLength: 128 }, cekKey, padded)
    );

    const rs = new Uint8Array(4);
    new DataView(rs.buffer).setUint32(0, 4096, false);
    return concat(salt, rs, new Uint8Array([senderPub.length]), senderPub, ct);
}

// ── مساعدات Base64url ──
function b64uToBytes(s) {
    s = s.trim().replace(/=/g, '');
    const pad = s + '='.repeat((4 - (s.length % 4)) % 4);
    return Uint8Array.from(atob(pad.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
}
function bytesToB64u(buf) {
    return btoa(String.fromCharCode(...new Uint8Array(buf)))
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}
function concat(...arrs) {
    const out = new Uint8Array(arrs.reduce((n, a) => n + a.length, 0));
    let off = 0;
    for (const a of arrs) { out.set(a, off); off += a.length; }
    return out;
}
