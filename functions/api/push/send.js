// functions/api/push/send.js
// يرسل عبر FCM HTTP v1 API — يدعم /fcm/send/ و /wp/ endpoints
import { withAuth, createResponse, handleOptions } from '../_utils.js';

export async function onRequestOptions() { return handleOptions(); }

export async function onRequestPost(context) {
    const auth = await withAuth(context);
    if (auth) return auth;

    try {
        const { title, body, url = '/', icon } = await context.request.json();
        if (!title || !body)
            return createResponse({ success: false, error: 'العنوان والرسالة مطلوبان' }, 400);

        // ── 1. جلب الاشتراكات ──
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
                success: true, sent: 0,
                message: tableExists
                    ? 'لا يوجد مشتركون — تأكد أن المستخدم قبل الإشعارات'
                    : 'جدول push_subscriptions غير موجود'
            });
        }

        // ── 2. الحصول على FCM Access Token ──
        const fcmToken = await getFCMAccessToken(context.env);

        // ── 3. بيانات الإشعار ──
        const iconUrl = icon || 'https://cdn.jsdelivr.net/gh/kimk6/chetaibi-assets-v1@main/ui/app-icon.png';

        // ── 4. إرسال لكل مشترك ──
        let sent = 0;
        const expired = [];
        const errors  = [];

        await Promise.allSettled(subs.map(async (sub) => {
            try {
                // استخرج FCM registration token من endpoint
                const fcmToken_reg = extractFCMToken(sub.endpoint);

                let result;
                if (fcmToken_reg) {
                    // إرسال عبر FCM HTTP v1 API
                    result = await sendViaFCMv1({
                        registrationToken: fcmToken_reg,
                        title, body, url, icon: iconUrl,
                        accessToken: fcmToken,
                        projectId: 'chetaibi-71f80',
                    });
                } else {
                    // إرسال عبر Web Push Protocol (للـ /wp/ endpoints)
                    const vapidPublic  = (context.env.VAPID_PUBLIC_KEY  || context.env.VAPID_PUBLIC  || '').trim();
                    const vapidPrivate = (context.env.VAPID_PRIVATE_KEY || context.env.VAPID_PRIVATE || '').trim();
                    const vapidSubject = 'mailto:apc.chetaibi.officiel@gmail.com';
                    result = await sendWebPush({
                        endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth,
                        payload: JSON.stringify({ title, body, icon: iconUrl, badge: iconUrl, url, data: { url } }),
                        vapidPublic, vapidPrivate: normalizePrivateKey(vapidPrivate), vapidSubject,
                    });
                }

                if (result.ok) {
                    sent++;
                } else if (result.status === 404 || result.status === 410) {
                    expired.push(sub.endpoint);
                } else {
                    const txt = await result.text().catch(() => '');
                    errors.push(`[${result.status}] ${txt.slice(0, 150)}`);
                }
            } catch (err) {
                errors.push(`exception: ${err.message}`);
            }
        }));

        // حذف الاشتراكات المنتهية
        if (expired.length > 0) {
            await Promise.allSettled(expired.map(ep =>
                context.env.DB.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').bind(ep).run()
            ));
        }

        return createResponse({
            success: true, sent, total: subs.length, expired: expired.length,
            ...(errors.length > 0 && { errors }),
        });

    } catch (e) {
        return createResponse({ success: false, error: e.message }, 500);
    }
}

// ════════════════════════════════════════════════════════
// FCM HTTP v1 API
// ════════════════════════════════════════════════════════
function extractFCMToken(endpoint) {
    // /fcm/send/TOKEN  أو  /wp/TOKEN
    const m = endpoint.match(/\/fcm\/send\/(.+)$/) || endpoint.match(/\/wp\/(.+)$/);
    return m ? m[1] : null;
}

async function sendViaFCMv1({ registrationToken, title, body, url, icon, accessToken, projectId }) {
    const message = {
        message: {
            token: registrationToken,
            notification: { title, body },
            webpush: {
                notification: {
                    title, body, icon,
                    badge: icon,
                    vibrate: [200, 100, 200],
                    requireInteraction: false,
                    data: { url },
                },
                fcm_options: { link: url },
            },
            data: { url },
        }
    };

    const res = await fetch(
        `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
        {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(message),
        }
    );
    return res;
}

// ════════════════════════════════════════════════════════
// Google OAuth2 — Service Account → Access Token
// باستخدام Web Crypto فقط (بدون مكتبات)
// ════════════════════════════════════════════════════════
async function getFCMAccessToken(env) {
    // المفاتيح من Cloudflare env أو مضمّنة
    const SA_EMAIL = env.FCM_CLIENT_EMAIL   || 'firebase-adminsdk-fbsvc@chetaibi-71f80.iam.gserviceaccount.com';
    const SA_KEY   = env.FCM_PRIVATE_KEY    || `-----BEGIN PRIVATE KEY-----\nMIIEvwIBADANBgkqhkiG9w0BAQEFAASCBKkwggSlAgEAAoIBAQDrY1+oqiCex+2H\nMCkCKi6VZ2fUUzLbfVznf/nBA9R1StGGKReaPtVGS5vL7y4tZwQT9ohj12LP75GG\n0r4duAKG9fAAEbQBeDt5OEQIwBbWw2HOldKJhBuJoQnJaNRdPEaRondMN5iJNRvm\nnVtc35SoMyMatj9dHpPOsWbiQr3Ex5zMonGODU6+Pb5/nli+WJvopsdDNEDR7E1i\npoxgpPDL3KtcRlje/RhFQG0j+AUiiZ0tKojah+iyK3IasW3NGiJpo6z6ZlosXpE6\niz28vSdigwOvB4vs6u4UQCq/g0qArTUZlL+mbqpPS6gEEbEFBVnVQPGwokUggT2H\nd8j5wOsRAgMBAAECggEAB/Gj3BGXxbwKEl6n96R8S3sAqEwBgqJNtRtezqqGLEow\n3YX7/67grD1nfd+tz4bzPog6rKHregiEAQiSNXcNEMhyh9IRIN6RpULmmuP+sVNJ\nNPtd7lmow0GNzsAMsLPUztvsikQzD+hcr3D+kRkTj4SgSem+JDKguuBGUFr/xAkG\n+gI/btu/2TthLkwkzOO0D0HFR2Pg53OlYQiXbtbHDNqfRmK/621DLOuCFI8L5rAy\nC78QQK+QTE/RP6y3m3mmcvHigPxJchKVlRBlXF2U3x7jtdV4w+W3fbrCt65RgX+Q\nxQXeuChr0CbIHTe6SAS20X+J6b4ZAmIIpNGq5wEMsQKBgQD3/plyIMY97JGZaRqJ\nDMaG0v4KxWIl2OpUhWOPW9DD6u0zZlQeJFkZEIyxelxzvon3j5sxis4TE/2S7Ldp\nhmvyk9oVDTkjXT21rvbPg3u/nWDKkn554O3pleYSh26FIe8itSsmtzsM+GOzoKGx\njkqX4cMXJqTbUnBOvddquewjeQKBgQDy/JjCpfFcdfnDJZUEYgYuUlu7hJpAyIEq\nwj0PbjDQPPZIXAfldk0AmkbCOSzcr08M1pSxxD62S1IuD6BW1pSACSPLRku/+9Th\nuG8GSGzA5kshNo6dY/xk1DS3B1G34MYzbWVCAZ4pYhCFiIX18bWnn5e7qQmQ/K15\nsv24XcHGWQKBgQC5AGuEIkMBSwvLAAdVmfw39AqkCl+PkGQvLVr6RSpWHVlacMnr\nun3lHt12QKvbhJbz4WOK79uPi+gsxP6GcErzKa0U60pmwVYZxS5F2/ZjGYptVB+Z\n2FxjVvnNdM7T7l6w66oHNcWNhXcLN5eoF1g6OacKDEALhVJWy3R6H7yzMQKBgQDr\nnqGK7lsTq5rb7s+Hhn4z4MzvEvB5LXSDQALxuYpAAz1WgVdu3L5ifTdsEwE7pgtj\niZh6oK+nGXbBD4oNatppJXO+I5ZEvjB6CNwwHX7HtwjXVg4I9PHD3DqZ2NEXGzFW\noRf1X5g8zMj0k6RDD3V06764zHtoSnz1a+m4I8JJUQKBgQC1x/aKaTq+Xcx7Y3s2\ni13gvk3Qb4y2Q5m547R09iBLCpboYOtpiAHHMnlqyNADcXHMAJQxUjsv7cKGdOmL\n3XUVgHOGPOlLATnmK5I0QqVCyk5d3vSdP28CqcoYW7zNK7q5J5hlm8tDWVeU7tUS\nnw+5tGmD4bD4PTohBW5VWWR24Q==\n-----END PRIVATE KEY-----\n`;

    const now = Math.floor(Date.now() / 1000);
    const claim = { iss: SA_EMAIL, scope: 'https://www.googleapis.com/auth/firebase.messaging', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 };

    // بناء JWT
    const b64u = s => btoa(unescape(encodeURIComponent(JSON.stringify(s)))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');
    const header  = b64u({ alg: 'RS256', typ: 'JWT' });
    const payload = b64u(claim);
    const toSign  = `${header}.${payload}`;

    // استيراد المفتاح الخاص RSA
    const pemBody = SA_KEY.replace(/-----[^-]+-----/g,'').replace(/\s/g,'');
    const derBuf  = Uint8Array.from(atob(pemBody), c => c.charCodeAt(0));
    const key = await crypto.subtle.importKey(
        'pkcs8', derBuf,
        { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
        false, ['sign']
    );

    const sig = await crypto.subtle.sign(
        'RSASSA-PKCS1-v1_5', key,
        new TextEncoder().encode(toSign)
    );
    const jwt = `${toSign}.${btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'')}`;

    // تبادل JWT بـ Access Token
    const resp = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
    });
    const data = await resp.json();
    if (!data.access_token) throw new Error(`OAuth2 failed: ${JSON.stringify(data)}`);
    return data.access_token;
}

// ════════════════════════════════════════════════════════
// Web Push Protocol — للـ endpoints غير FCM
// ════════════════════════════════════════════════════════
async function sendWebPush({ endpoint, p256dh, auth, payload, vapidPublic, vapidPrivate, vapidSubject }) {
    const cry = globalThis.crypto;
    const pubRaw = b64uToBytes(vapidPublic);
    const vapidKey = await cry.subtle.importKey('jwk',
        { kty:'EC', crv:'P-256', ext:true, key_ops:['sign'],
          x: bytesToB64u(pubRaw.slice(1,33)), y: bytesToB64u(pubRaw.slice(33,65)), d: vapidPrivate },
        { name:'ECDSA', namedCurve:'P-256' }, false, ['sign']
    );
    const origin = new URL(endpoint);
    const aud    = `${origin.protocol}//${origin.host}`;
    const exp    = Math.floor(Date.now()/1000) + 43200;
    const enc    = o => bytesToB64u(new TextEncoder().encode(JSON.stringify(o)));
    const hdr    = enc({ typ:'JWT', alg:'ES256' });
    const pld    = enc({ aud, exp, sub: vapidSubject });
    const sig    = await cry.subtle.sign({ name:'ECDSA', hash:'SHA-256' }, vapidKey, new TextEncoder().encode(`${hdr}.${pld}`));
    const jwt    = `${hdr}.${pld}.${bytesToB64u(new Uint8Array(sig))}`;
    const encrypted = await encryptPayload(payload, p256dh, auth);
    return fetch(endpoint, {
        method:'POST',
        headers: { 'Authorization':`vapid t=${jwt},k=${vapidPublic}`, 'Content-Type':'application/octet-stream', 'Content-Encoding':'aes128gcm', 'TTL':'86400' },
        body: encrypted,
    });
}

function normalizePrivateKey(key) {
    key = key.trim();
    if (key.startsWith('{')) { try { const j=JSON.parse(key); if(j.d) return j.d; } catch {} }
    if (key.includes('-----')) {
        const der = Uint8Array.from(atob(key.replace(/-----[^-]+-----/g,'').replace(/\s/g,'')), c=>c.charCodeAt(0));
        for (let i=0;i<der.length-33;i++) if(der[i]===0x04&&der[i+1]===0x20) return bytesToB64u(der.slice(i+2,i+34));
    }
    return key.replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'').replace(/\s/g,'');
}

async function encryptPayload(plaintext, p256dhB64, authB64) {
    const cry = globalThis.crypto;
    const receiverPub = b64uToBytes(p256dhB64);
    const authSecret  = b64uToBytes(authB64);
    const salt        = cry.getRandomValues(new Uint8Array(16));
    const senderKP    = await cry.subtle.generateKey({ name:'ECDH', namedCurve:'P-256' }, true, ['deriveBits']);
    const senderPub   = new Uint8Array(await cry.subtle.exportKey('raw', senderKP.publicKey));
    const receiverKey = await cry.subtle.importKey('raw', receiverPub, { name:'ECDH', namedCurve:'P-256' }, false, []);
    const ecdhBits    = new Uint8Array(await cry.subtle.deriveBits({ name:'ECDH', public:receiverKey }, senderKP.privateKey, 256));
    const hkdf = async (ikm,salt,info,len) => {
        const k = await cry.subtle.importKey('raw',ikm,{name:'HKDF'},false,['deriveBits']);
        return new Uint8Array(await cry.subtle.deriveBits({name:'HKDF',hash:'SHA-256',salt,info},k,len*8));
    };
    const ikm   = await hkdf(ecdhBits, authSecret, concat(new TextEncoder().encode('WebPush: info\0'), receiverPub, senderPub), 32);
    const cek   = await hkdf(ikm, salt, concat(new TextEncoder().encode('Content-Encoding: aes128gcm\0'), new Uint8Array([0])), 16);
    const nonce = await hkdf(ikm, salt, concat(new TextEncoder().encode('Content-Encoding: nonce\0'), new Uint8Array([0])), 12);
    const cekKey = await cry.subtle.importKey('raw', cek, {name:'AES-GCM'}, false, ['encrypt']);
    const ct     = new Uint8Array(await cry.subtle.encrypt({name:'AES-GCM',iv:nonce,tagLength:128}, cekKey, concat(new TextEncoder().encode(plaintext), new Uint8Array([2]))));
    const rs = new Uint8Array(4); new DataView(rs.buffer).setUint32(0,4096,false);
    return concat(salt, rs, new Uint8Array([senderPub.length]), senderPub, ct);
}

function b64uToBytes(s) {
    s = s.trim().replace(/=/g,'');
    const pad = s+'='.repeat((4-s.length%4)%4);
    return Uint8Array.from(atob(pad.replace(/-/g,'+').replace(/_/g,'/')), c=>c.charCodeAt(0));
}
function bytesToB64u(buf) {
    return btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');
}
function concat(...arrs) {
    const out = new Uint8Array(arrs.reduce((n,a)=>n+a.length,0)); let off=0;
    for (const a of arrs) { out.set(a,off); off+=a.length; } return out;
}
