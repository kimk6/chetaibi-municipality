// functions/api/push/stats.js
import { withAuth, createResponse, handleOptions } from '../_utils.js';

export async function onRequestOptions() { return handleOptions(); }

export async function onRequestGet(context) {
    const auth = await withAuth(context);
    if (auth) return auth;
    try {
        const { results } = await context.env.DB.prepare('SELECT COUNT(*) as count FROM push_subscriptions').all();
        return createResponse({ success: true, count: results[0]?.count ?? 0 });
    } catch {
        return createResponse({ success: true, count: 0 });
    }
}
