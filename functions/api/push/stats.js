// functions/api/push/stats.js
import { withAuth, createResponse, handleOptions } from '../_utils.js';

export async function onRequestOptions() { return handleOptions(); }

export async function onRequestGet(context) {
    const auth = await withAuth(context);
    if (auth) return auth;
    try {
        const row = await context.env.DB
            .prepare('SELECT COUNT(*) as count FROM push_subscriptions')
            .first();
        return createResponse({ success: true, count: row?.count ?? 0 });
    } catch (e) {
        // إذا الجدول غير موجود → شغّل push_migration.sql
        return createResponse({
            success: false,
            count: 0,
            error: 'جدول push_subscriptions غير موجود — شغّل push_migration.sql',
        });
    }
}
