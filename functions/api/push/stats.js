// functions/api/push/stats.js
import { withAuth, createResponse, handleOptions } from '../_utils.js';

export async function onRequestOptions() { return handleOptions(); }

export async function onRequestGet(context) {
    const auth = await withAuth(context);
    if (auth) return auth;
    try {
        const row = await context.env.DB
            .prepare('SELECT COUNT(*) as count FROM push_subscriptions')
            .first().catch(() => ({ count: 0 }));
        return createResponse({ success: true, count: row?.count ?? 0 });
    } catch (e) {
        return createResponse({ success: true, count: 0 });
    }
}
