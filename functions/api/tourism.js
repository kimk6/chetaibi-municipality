import { verifyAuth, json, handleOptions } from './_utils.js';
export async function onRequestOptions(context) { return handleOptions(); }

export async function onRequestGet(context) {
    try {
        const result = await context.env.DB.prepare('SELECT * FROM tourism ORDER BY id').all();
        return json({ success: true, data: result.results });
    } catch (e) { return json({ error: e.message }, 500); }
}

export async function onRequestPost(context) {
    const user = await verifyAuth(context.request, context.env);
    if (!user) return json({ error: 'غير مصرح' }, 401);
    try {
        const { name, subtitle, description, image_url, rating, distance_info, badge_text, badge_color } = await context.request.json();
        const result = await context.env.DB.prepare(
            'INSERT INTO tourism (name,subtitle,description,image_url,rating,distance_info,badge_text,badge_color) VALUES (?,?,?,?,?,?,?,?)'
        ).bind(name, subtitle||'', description, image_url||'', rating||'4.5', distance_info||'', badge_text||'', badge_color||'emerald').run();
        return json({ success: true, id: result.meta.last_row_id }, 201);
    } catch (e) { return json({ error: e.message }, 500); }
}

export async function onRequestPut(context) {
    const user = await verifyAuth(context.request, context.env);
    if (!user) return json({ error: 'غير مصرح' }, 401);
    try {
        const url = new URL(context.request.url);
        const id = url.searchParams.get('id');
        const { name, subtitle, description, image_url, rating, distance_info, badge_text, badge_color } = await context.request.json();
        await context.env.DB.prepare(
            'UPDATE tourism SET name=?,subtitle=?,description=?,image_url=?,rating=?,distance_info=?,badge_text=?,badge_color=? WHERE id=?'
        ).bind(name,subtitle,description,image_url,rating,distance_info,badge_text,badge_color,id).run();
        return json({ success: true });
    } catch (e) { return json({ error: e.message }, 500); }
}

export async function onRequestDelete(context) {
    const user = await verifyAuth(context.request, context.env);
    if (!user) return json({ error: 'غير مصرح' }, 401);
    try {
        const url = new URL(context.request.url);
        const id = url.searchParams.get('id');
        await context.env.DB.prepare('DELETE FROM tourism WHERE id=?').bind(id).run();
        return json({ success: true });
    } catch (e) { return json({ error: e.message }, 500); }
}
