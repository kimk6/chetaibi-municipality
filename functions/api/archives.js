import { verifyAuth, json, handleOptions } from './_utils.js';
export async function onRequestOptions(context) { return handleOptions(); }

export async function onRequestGet(context) {
    try {
        const result = await context.env.DB.prepare('SELECT * FROM archives ORDER BY id').all();
        return json({ success: true, data: result.results });
    } catch (e) { return json({ error: e.message }, 500); }
}

export async function onRequestPost(context) {
    const user = await verifyAuth(context.request, context.env);
    if (!user) return json({ error: 'غير مصرح' }, 401);
    try {
        const { title, description, image_old_url, image_new_url } = await context.request.json();
        const result = await context.env.DB.prepare(
            'INSERT INTO archives (title, description, image_old_url, image_new_url) VALUES (?,?,?,?)'
        ).bind(title, description || '', image_old_url || '', image_new_url || '').run();
        return json({ success: true, id: result.meta.last_row_id }, 201);
    } catch (e) { return json({ error: e.message }, 500); }
}

export async function onRequestPut(context) {
    const user = await verifyAuth(context.request, context.env);
    if (!user) return json({ error: 'غير مصرح' }, 401);
    try {
        const url = new URL(context.request.url);
        const id = url.searchParams.get('id');
        const { title, description, image_old_url, image_new_url } = await context.request.json();
        await context.env.DB.prepare(
            'UPDATE archives SET title=?, description=?, image_old_url=?, image_new_url=? WHERE id=?'
        ).bind(title, description, image_old_url, image_new_url, id).run();
        return json({ success: true });
    } catch (e) { return json({ error: e.message }, 500); }
}

export async function onRequestDelete(context) {
    const user = await verifyAuth(context.request, context.env);
    if (!user) return json({ error: 'غير مصرح' }, 401);
    try {
        const url = new URL(context.request.url);
        const id = url.searchParams.get('id');
        await context.env.DB.prepare('DELETE FROM archives WHERE id=?').bind(id).run();
        return json({ success: true });
    } catch (e) { return json({ error: e.message }, 500); }
}
