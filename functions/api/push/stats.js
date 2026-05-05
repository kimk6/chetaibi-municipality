// functions/api/push/stats.js — مؤقت للتشخيص
import { withAuth, createResponse, handleOptions } from '../_utils.js';

export async function onRequestOptions() { return handleOptions(); }

export async function onRequestGet(context) {
    const auth = await withAuth(context);
    if (auth) return auth;

    try {
        // تحقق أولاً من وجود الجدول
        const tables = await context.env.DB
            .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='push_subscriptions'")
            .first();

        if (!tables) {
            // الجدول غير موجود — أنشئه الآن
            await context.env.DB.prepare(`
                CREATE TABLE IF NOT EXISTS push_subscriptions (
                    id        INTEGER PRIMARY KEY AUTOINCREMENT,
                    fcm_token TEXT UNIQUE NOT NULL,
                    created   DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `).run();

            return createResponse({
                success: true,
                count: 0,
                note: 'تم إنشاء الجدول تلقائياً'
            });
        }

        const row = await context.env.DB
            .prepare('SELECT COUNT(*) as count FROM push_subscriptions')
            .first();

        return createResponse({ success: true, count: row?.count ?? 0 });

    } catch (e) {
        return createResponse({ success: false, error: e.message }, 500);
    }
}
