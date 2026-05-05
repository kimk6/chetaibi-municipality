// functions/api/push/subscribe.js
import { createResponse, handleOptions } from '../_utils.js';

export async function onRequestOptions() { return handleOptions(); }

async function ensureTable(db) {
    await db.prepare(`
        CREATE TABLE IF NOT EXISTS push_subscriptions (
            id        INTEGER PRIMARY KEY AUTOINCREMENT,
            fcm_token TEXT UNIQUE NOT NULL,
            created   DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `).run();
}

export async function onRequestPost(context) {
    const { env, request } = context;
    try {
        const body = await request.json().catch(() => ({}));
        const fcm_token = body?.fcm_token;

        if (!fcm_token || typeof fcm_token !== 'string' || fcm_token.length < 10)
            return createResponse({ success: false, error: 'fcm_token غير صالح' }, 400);

        await ensureTable(env.DB);

        await env.DB
            .prepare('INSERT INTO push_subscriptions (fcm_token) VALUES (?) ON CONFLICT(fcm_token) DO NOTHING')
            .bind(fcm_token)
            .run();

        const row = await env.DB
            .prepare('SELECT COUNT(*) as count FROM push_subscriptions')
            .first();

        return createResponse({ success: true, total: row?.count ?? 0 });
    } catch (e) {
        return createResponse({ success: false, error: e.message }, 500);
    }
}

export async function onRequestDelete(context) {
    const { env, request } = context;
    try {
        const body = await request.json().catch(() => ({}));
        const fcm_token = body?.fcm_token;
        if (!fcm_token) return createResponse({ success: false, error: 'fcm_token مطلوب' }, 400);

        await env.DB
            .prepare('DELETE FROM push_subscriptions WHERE fcm_token=?')
            .bind(fcm_token).run();

        return createResponse({ success: true });
    } catch (e) {
        return createResponse({ success: false, error: e.message }, 500);
    }
}
