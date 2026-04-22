// functions/api/beaches.js
import { withAuth, createResponse, handleOptions } from './_utils.js';

export async function onRequestOptions() { return handleOptions(); }

export async function onRequestGet(context) {
    try {
        const { results } = await context.env.DB
            .prepare('SELECT * FROM beaches ORDER BY id')
            .all();
        return createResponse({ success: true, data: results });
    } catch (e) {
        return createResponse({ success: false, error: e.message }, 500);
    }
}

export async function onRequestPost(context) {
    const auth = await withAuth(context);
    if (auth) return auth;
    try {
        const { name, description, image_url, album_urls, is_supervised, season } = await context.request.json();
        if (!name) return createResponse({ success: false, error: 'اسم الشاطئ مطلوب' }, 400);
        const result = await context.env.DB
            .prepare('INSERT INTO beaches (name, description, image_url, album_urls, is_supervised, season) VALUES (?,?,?,?,?,?)')
            .bind(name, description || '', image_url || '', album_urls || '[]', is_supervised ?? 1, season || 'صيف')
            .run();
        return createResponse({ success: true, data: { id: result.meta.last_row_id } }, 201);
    } catch (e) {
        return createResponse({ success: false, error: e.message }, 500);
    }
}
