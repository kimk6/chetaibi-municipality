import { withAuth, createResponse, handleOptions } from './_utils.js';

export async function onRequestGet(context) {
    const { env } = context;
    try {
        const { results } = await env.DB.prepare('SELECT * FROM news ORDER BY is_pinned DESC, created_at DESC').all();
        return createResponse({ success: true, data: results });
    } catch (e) {
        return createResponse({ success: false, error: e.message }, 500);
    }
}

export async function onRequestPost(context) {
    const auth = await withAuth(context);
    if (auth) return auth;
    try {
        const body = await context.request.json();
        const { title, category, content, image_url, date, is_pinned } = body;
        if (!title || !category || !content) {
            return createResponse({ success: false, error: 'title, category, content مطلوبة' }, 400);
        }
        const result = await env.DB.prepare(
            'INSERT INTO news (title, category, content, image_url, date, is_pinned) VALUES (?, ?, ?, ?, ?, ?)'
        ).bind(title, category, content, image_url || '', date || new Date().toISOString().split('T')[0], is_pinned ? 1 : 0).run();
        return createResponse({ success: true, data: { id: result.meta.last_row_id } });
    } catch (e) {
        return createResponse({ success: false, error: e.message }, 500);
    }
}

export async function onRequestOptions() {
    return handleOptions();
}
