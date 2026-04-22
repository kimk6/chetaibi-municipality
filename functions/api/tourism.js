// functions/api/tourism.js
import { withAuth, createResponse, handleOptions } from './_utils.js';

export async function onRequestOptions() { return handleOptions(); }

export async function onRequestGet(context) {
    try {
        const { results } = await context.env.DB.prepare('SELECT * FROM tourism ORDER BY id').all();
        return createResponse({ success: true, data: results });
    } catch (e) { return createResponse({ success: false, error: e.message }, 500); }
}

export async function onRequestPost(context) {
    const auth = await withAuth(context); if (auth) return auth;
    try {
        const { name, subtitle, description, image_url, rating, distance_info, badge_text, badge_color } = await context.request.json();
        if (!name) return createResponse({ success: false, error: 'الاسم مطلوب' }, 400);
        const result = await context.env.DB
            .prepare('INSERT INTO tourism (name,subtitle,description,image_url,rating,distance_info,badge_text,badge_color) VALUES (?,?,?,?,?,?,?,?)')
            .bind(name, subtitle || '', description || '', image_url || '', rating || '4.5', distance_info || '', badge_text || '', badge_color || 'emerald')
            .run();
        return createResponse({ success: true, id: result.meta.last_row_id }, 201);
    } catch (e) { return createResponse({ success: false, error: e.message }, 500); }
}

export async function onRequestPut(context) {
    const auth = await withAuth(context); if (auth) return auth;
    try {
        const id = new URL(context.request.url).searchParams.get('id');
        if (!id) return createResponse({ success: false, error: 'id مطلوب' }, 400);
        const { name, subtitle, description, image_url, rating, distance_info, badge_text, badge_color } = await context.request.json();
        await context.env.DB
            .prepare('UPDATE tourism SET name=?,subtitle=?,description=?,image_url=?,rating=?,distance_info=?,badge_text=?,badge_color=? WHERE id=?')
            .bind(name, subtitle || '', description || '', image_url || '', rating || '4.5', distance_info || '', badge_text || '', badge_color || 'emerald', id)
            .run();
        return createResponse({ success: true });
    } catch (e) { return createResponse({ success: false, error: e.message }, 500); }
}

export async function onRequestDelete(context) {
    const auth = await withAuth(context); if (auth) return auth;
    try {
        const id = new URL(context.request.url).searchParams.get('id');
        if (!id) return createResponse({ success: false, error: 'id مطلوب' }, 400);
        await context.env.DB.prepare('DELETE FROM tourism WHERE id=?').bind(id).run();
        return createResponse({ success: true });
    } catch (e) { return createResponse({ success: false, error: e.message }, 500); }
}
