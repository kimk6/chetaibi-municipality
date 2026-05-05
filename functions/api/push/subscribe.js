// functions/api/push/subscribe.js
// يحفظ FCM Token من Firebase
import { withAuth, createResponse, handleOptions } from '../_utils.js';

export async function onRequestOptions() { return handleOptions(); }

export async function onRequestPost(context) {
    const { env, request } = context;
    try {
        const { fcm_token } = await request.json();
        if (!fcm_token) return createResponse({ success: false, error: 'fcm_token مطلوب' }, 400);

        await env.DB.prepare(`
            CREATE TABLE IF NOT EXISTS push_subscriptions (
                id        INTEGER PRIMARY KEY AUTOINCREMENT,
                fcm_token TEXT UNIQUE NOT NULL,
                created   DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `).run();

        await env.DB.prepare(`
            INSERT INTO push_subscriptions (fcm_token)
            VALUES (?)
            ON CONFLICT(fcm_token) DO NOTHING
        `).bind(fcm_token).run();

        return createResponse({ success: true });
    } catch (e) {
        return createResponse({ success: false, error: e.message }, 500);
    }
}

export async function onRequestDelete(context) {
    const { env, request } = context;
    try {
        const { fcm_token } = await request.json();
        await env.DB.prepare('DELETE FROM push_subscriptions WHERE fcm_token=?').bind(fcm_token).run();
        return createResponse({ success: true });
    } catch (e) {
        return createResponse({ success: false, error: e.message }, 500);
    }
}
