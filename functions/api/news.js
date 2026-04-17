import { verifyAuth, json, handleOptions } from './_utils.js';

export async function onRequestOptions(context) { return handleOptions(); }

// GET /api/news — جلب كل الأخبار (عام)
export async function onRequestGet(context) {
    const { env, request } = context;
    const url = new URL(request.url);
    const category = url.searchParams.get('category');

    let query = 'SELECT * FROM news ORDER BY date DESC';
    const params = [];
    if (category) {
        query = 'SELECT * FROM news WHERE category = ? ORDER BY date DESC';
        params.push(category);
    }

    try {
        const result = await env.DB.prepare(query).bind(...params).all();
        return json({ success: true, data: result.results });
    } catch (e) {
        return json({ success: false, error: e.message }, 500);
    }
}

// POST /api/news — إضافة خبر (محمي)
export async function onRequestPost(context) {
    const { request, env } = context;
    const user = await verifyAuth(request, env);
    if (!user) return json({ error: 'غير مصرح' }, 401);

    try {
        const { title, category, content, image_url, date } = await request.json();
        if (!title || !category || !content) {
            return json({ error: 'حقول مطلوبة ناقصة' }, 400);
        }
        const result = await env.DB.prepare(
            'INSERT INTO news (title, category, content, image_url, date) VALUES (?, ?, ?, ?, ?)'
        ).bind(title, category, content, image_url || '', date || new Date().toISOString().split('T')[0]).run();

        return json({ success: true, id: result.meta.last_row_id }, 201);
    } catch (e) {
        return json({ success: false, error: e.message }, 500);
    }
}
