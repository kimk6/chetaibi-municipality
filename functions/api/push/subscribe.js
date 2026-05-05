// functions/api/push/subscribe.js
// يحفظ FCM Token من Firebase في D1
import { withAuth, createResponse, handleOptions } from '../_utils.js';

export async function onRequestOptions() { return handleOptions(); }

export async function onRequestPost(context) {
    const { env, request } = context;
    try {
        const body = await request.json().catch(() => ({}));
        const fcm_token = body?.fcm_token;

        if (!fcm_token || typeof fcm_token !== 'string' || fcm_token.length < 10) {
            return createResponse({ success: false, error: 'fcm_token غير صالح' }, 400);
        }

        // الجدول مُنشأ مسبقاً عبر migration — لا نُنشئه هنا
        await env.DB
            .prepare('INSERT INTO push_subscriptions (fcm_token) VALUES (?) ON CONFLICT(fcm_token) DO NOTHING')
            .bind(fcm_token)
            .run();

        // التحقق من الإدراج
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
            .bind(fcm_token)
            .run();

        return createResponse({ success: true });
    } catch (e) {
        return createResponse({ success: false, error: e.message }, 500);
    }
}

export async function onRequestGet(context) {
    // للتشخيص فقط — يعرض عدد المشتركين بدون auth
    try {
        const row = await context.env.DB
            .prepare('SELECT COUNT(*) as count FROM push_subscriptions')
            .first();
        return createResponse({ success: true, count: row?.count ?? 0 });
    } catch (e) {
        return createResponse({ success: false, error: e.message }, 500);
    }
}
