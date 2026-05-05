// functions/api/push/send.js
// Firebase Cloud Messaging (FCM) v1 API
import { withAuth, createResponse, handleOptions } from '../_utils.js';

export async function onRequestOptions() { return handleOptions(); }

export async function onRequestPost(context) {
    const auth = await withAuth(context);
    if (auth) return auth;

    const { env, request } = context;
    try {
        const { title, body, url } = await request.json();
        if (!title || !body) return createResponse({ success: false, error: 'title و body مطلوبان' }, 400);

        // جلب FCM Access Token
        const accessToken = await getFCMToken(env);
        if (!accessToken) return createResponse({ success: false, error: 'تعذر الحصول على FCM token — تحقق من FIREBASE_PRIVATE_KEY و FIREBASE_CLIENT_EMAIL' }, 500);

        // جلب كل الـ FCM tokens من D1
        const { results: subs } = await env.DB.prepare('SELECT * FROM push_subscriptions').all();
        if (!subs || subs.length === 0) return createResponse({ success: true, sent: 0 });

        const PROJECT_ID = 'chetaibi-71f80';
        let sent = 0, failed = 0;
        const toDelete = [];

        for (const sub of subs) {
            if (!sub.fcm_token) continue;
            try {
                const res = await fetch(
                    `https://fcm.googleapis.com/v1/projects/${PROJECT_ID}/messages:send`,
                    {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${accessToken}`,
                            'Content-Type':  'application/json',
                        },
                        body: JSON.stringify({
                            message: {
                                token: sub.fcm_token,
                                notification: { title, body },
                                webpush: {
                                    notification: {
                                        title, body,
                                        icon:  'https://cdn.jsdelivr.net/gh/kimk6/chetaibi-assets-v1@main/ui/app-icon.png',
                                        badge: 'https://cdn.jsdelivr.net/gh/kimk6/chetaibi-assets-v1@main/ui/app-icon.png',
                                        click_action: url || '/',
                                    },
                                    fcm_options: { link: url || '/' },
                                },
                            }
                        }),
                    }
                );
                const d = await res.json();
                if (res.ok) {
                    sent++;
                } else if (d?.error?.details?.some(e => e.errorCode === 'UNREGISTERED')) {
                    toDelete.push(sub.fcm_token);
                } else {
                    failed++;
                }
            } catch { failed++; }
        }

        for (const t of toDelete) {
            await env.DB.prepare('DELETE FROM push_subscriptions WHERE fcm_token=?').bind(t).run().catch(() => {});
        }

        return createResponse({ success: true, sent, failed, total: subs.length });
    } catch (e) {
        return createResponse({ success: false, error: e.message }, 500);
    }
}

// ══════════════════════════════════════════════════════
// الحصول على FCM Access Token عبر JWT + Google OAuth2
// ══════════════════════════════════════════════════════
async function getFCMToken(env) {
    try {
        const privateKeyPEM = (env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
        const clientEmail   = env.FIREBASE_CLIENT_EMAIL || 'firebase-adminsdk-fbsvc@chetaibi-71f80.iam.gserviceaccount.com';

        if (!privateKeyPEM) return null;

        const now = Math.floor(Date.now() / 1000);
        const claims = {
            iss:   clientEmail,
            scope: 'https://www.googleapis.com/auth/firebase.messaging',
            aud:   'https://oauth2.googleapis.com/token',
            iat:   now,
            exp:   now + 3600,
        };

        // استيراد المفتاح الخاص RSA
        const privKey = await importRSAPrivateKey(privateKeyPEM);
        if (!privKey) return null;

        // JWT
        const header  = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
        const payload = b64url(JSON.stringify(claims));
        const input   = `${header}.${payload}`;

        const sigBuf = await crypto.subtle.sign(
            { name: 'RSASSA-PKCS1-v1_5' },
            privKey,
            new TextEncoder().encode(input)
        );
        const jwt = `${input}.${b64urlBuf(new Uint8Array(sigBuf))}`;

        // طلب Access Token
        const res = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
        });
        const d = await res.json();
        return d.access_token || null;
    } catch { return null; }
}

async function importRSAPrivateKey(pem) {
    try {
        const b64 = pem.replace(/-----BEGIN PRIVATE KEY-----/, '')
                       .replace(/-----END PRIVATE KEY-----/, '')
                       .replace(/\s/g, '');
        const bin = atob(b64);
        const buf = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
        return await crypto.subtle.importKey(
            'pkcs8', buf.buffer,
            { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
            false, ['sign']
        );
    } catch { return null; }
}

function b64url(str) {
    return btoa(unescape(encodeURIComponent(str))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');
}
function b64urlBuf(buf) {
    let bin = '';
    for (const b of buf) bin += String.fromCharCode(b);
    return btoa(bin).replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');
}
