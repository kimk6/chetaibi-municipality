// functions/api/push/subscribe.js
// يحفظ اشتراكات Web Push في D1
import { createResponse, handleOptions } from '../_utils.js';

export async function onRequestOptions() { return handleOptions(); }

async function ensureTable(db) {
    await db.prepare(`
        CREATE TABLE IF NOT EXISTS push_subscriptions (
            id        INTEGER PRIMARY KEY AUTOINCREMENT,
            endpoint  TEXT UNIQUE NOT NULL,
            p256dh    TEXT NOT NULL,
            auth      TEXT NOT NULL,
            created_at TEXT DEFAULT (datetime('now'))
        )
    `).run().catch(() => {});
}

export async function onRequestPost(context) {
    try {
        await ensureTable(context.env.DB);
        const sub = await context.request.json();
        const { endpoint, keys } = sub;
        if (!endpoint || !keys?.p256dh || !keys?.auth) {
            return createResponse({ success: false, error: 'بيانات الاشتراك غير مكتملة' }, 400);
        }
        await context.env.DB
            .prepare(`INSERT OR REPLACE INTO push_subscriptions (endpoint, p256dh, auth)
                      VALUES (?, ?, ?)`)
            .bind(endpoint, keys.p256dh, keys.auth)
            .run();
        return createResponse({ success: true });
    } catch (e) {
        return createResponse({ success: false, error: e.message }, 500);
    }
}

// حذف اشتراك منتهي
export async function onRequestDelete(context) {
    try {
        const { endpoint } = await context.request.json();
        if (!endpoint) return createResponse({ success: false, error: 'endpoint مطلوب' }, 400);
        await context.env.DB
            .prepare('DELETE FROM push_subscriptions WHERE endpoint = ?')
            .bind(endpoint).run();
        return createResponse({ success: true });
    } catch (e) {
        return createResponse({ success: false, error: e.message }, 500);
    }
}
