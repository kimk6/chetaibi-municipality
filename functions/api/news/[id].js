import { verifyAuth, json, handleOptions } from '../_utils.js';

export async function onRequestOptions(context) { return handleOptions(); }

// GET /api/news/:id
export async function onRequestGet(context) {
    const { env, params } = context;
    const id = params.id;
    try {
        const result = await env.DB.prepare('SELECT * FROM news WHERE id = ?').bind(id).first();
        if (!result) return json({ error: 'الخبر غير موجود' }, 404);
        return json({ success: true, data: result });
    } catch (e) {
        return json({ error: e.message }, 500);
    }
}

// PUT /api/news/:id
export async function onRequestPut(context) {
    const { request, env, params } = context;
    const user = await verifyAuth(request, env);
    if (!user) return json({ error: 'غير مصرح' }, 401);

    try {
        const { title, category, content, image_url, date } = await request.json();
        await env.DB.prepare(
            'UPDATE news SET title=?, category=?, content=?, image_url=?, date=? WHERE id=?'
        ).bind(title, category, content, image_url || '', date, params.id).run();
        return json({ success: true });
    } catch (e) {
        return json({ error: e.message }, 500);
    }
}

// DELETE /api/news/:id
export async function onRequestDelete(context) {
    const { request, env, params } = context;
    const user = await verifyAuth(request, env);
    if (!user) return json({ error: 'غير مصرح' }, 401);

    try {
        await env.DB.prepare('DELETE FROM news WHERE id = ?').bind(params.id).run();
        return json({ success: true });
    } catch (e) {
        return json({ error: e.message }, 500);
    }
}
