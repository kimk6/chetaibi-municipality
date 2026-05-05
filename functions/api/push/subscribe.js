// functions/api/push/subscribe.js
import { withAuth, createResponse, handleOptions } from '../_utils.js';

export async function onRequestOptions() { return handleOptions(); }

// المستخدم يشترك → يُحفظ الـ subscription في D1
export async function onRequestPost(context) {
    const { env, request } = context;
    try {
        const sub = await request.json();
        if (!sub?.endpoint) return createResponse({ success: false, error: 'endpoint مطلوب' }, 400);

        const endpoint = sub.endpoint;
        const p256dh   = sub.keys?.p256dh || '';
        const auth     = sub.keys?.auth || '';

        // إنشاء الجدول إن لم يكن موجوداً (يُنفَّذ مرة واحدة)
        await env.DB.prepare(`
            CREATE TABLE IF NOT EXISTS push_subscriptions (
                id       INTEGER PRIMARY KEY AUTOINCREMENT,
                endpoint TEXT UNIQUE NOT NULL,
                p256dh   TEXT DEFAULT '',
                auth     TEXT DEFAULT '',
                created  DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `).run();

        await env.DB.prepare(`
            INSERT INTO push_subscriptions (endpoint, p256dh, auth)
            VALUES (?, ?, ?)
            ON CONFLICT(endpoint) DO UPDATE SET p256dh=excluded.p256dh, auth=excluded.auth
        `).bind(endpoint, p256dh, auth).run();

        return createResponse({ success: true });
    } catch (e) {
        return createResponse({ success: false, error: e.message }, 500);
    }
}

// إلغاء الاشتراك
export async function onRequestDelete(context) {
    const { env, request } = context;
    try {
        const { endpoint } = await request.json();
        await env.DB.prepare('DELETE FROM push_subscriptions WHERE endpoint=?').bind(endpoint).run();
        return createResponse({ success: true });
    } catch (e) {
        return createResponse({ success: false, error: e.message }, 500);
    }
}
