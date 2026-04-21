/**
 * functions/api/beaches/[id].js
 * تعديل وحذف شاطئ محدد
 */
import { withAuth, createResponse, handleOptions } from '../_utils.js';

export async function onRequestOptions() { return handleOptions(); }

export async function onRequestPut(context) {
    const auth = await withAuth(context);
    if (auth) return auth;
    try {
        const { name, description, image_url, is_supervised, season } = await context.request.json();
        await context.env.DB
            .prepare('UPDATE beaches SET name=?, description=?, image_url=?, is_supervised=?, season=? WHERE id=?')
            .bind(name, description || '', image_url || '', is_supervised ?? 1, season || 'صيف', context.params.id)
            .run();
        return createResponse({ success: true });
    } catch (e) {
        return createResponse({ success: false, error: e.message }, 500);
    }
}

export async function onRequestDelete(context) {
    const auth = await withAuth(context);
    if (auth) return auth;
    try {
        await context.env.DB
            .prepare('DELETE FROM beaches WHERE id=?')
            .bind(context.params.id)
            .run();
        return createResponse({ success: true });
    } catch (e) {
        return createResponse({ success: false, error: e.message }, 500);
    }
}
