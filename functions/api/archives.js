// functions/api/archives.js — مع دعم اللغة الفرنسية
import { withAuth, createResponse, handleOptions } from './_utils.js';

export async function onRequestOptions() { return handleOptions(); }

export async function onRequestGet(context) {
    try {
        const { results } = await context.env.DB.prepare('SELECT * FROM archives ORDER BY id').all();
        return createResponse({ success: true, data: results });
    } catch (e) { return createResponse({ success: false, error: e.message }, 500); }
}

export async function onRequestPost(context) {
    const auth = await withAuth(context); if (auth) return auth;
    try {
        const { title, description, image_old_url, image_new_url, title_fr, description_fr } = await context.request.json();
        if (!title) return createResponse({ success: false, error: 'العنوان مطلوب' }, 400);
        const result = await context.env.DB
            .prepare('INSERT INTO archives (title,description,image_old_url,image_new_url,title_fr,description_fr) VALUES (?,?,?,?,?,?)')
            .bind(title, description||'', image_old_url||'', image_new_url||'', title_fr||'', description_fr||'')
            .run();
        return createResponse({ success: true, id: result.meta.last_row_id }, 201);
    } catch (e) { return createResponse({ success: false, error: e.message }, 500); }
}

export async function onRequestPut(context) {
    const auth = await withAuth(context); if (auth) return auth;
    try {
        const id = new URL(context.request.url).searchParams.get('id');
        if (!id) return createResponse({ success: false, error: 'id مطلوب' }, 400);
        const { title, description, image_old_url, image_new_url, title_fr, description_fr } = await context.request.json();
        await context.env.DB
            .prepare('UPDATE archives SET title=?,description=?,image_old_url=?,image_new_url=?,title_fr=?,description_fr=? WHERE id=?')
            .bind(title, description||'', image_old_url||'', image_new_url||'', title_fr||'', description_fr||'', id)
            .run();
        return createResponse({ success: true });
    } catch (e) { return createResponse({ success: false, error: e.message }, 500); }
}

export async function onRequestDelete(context) {
    const auth = await withAuth(context); if (auth) return auth;
    try {
        const id = new URL(context.request.url).searchParams.get('id');
        if (!id) return createResponse({ success: false, error: 'id مطلوب' }, 400);
        await context.env.DB.prepare('DELETE FROM archives WHERE id=?').bind(id).run();
        return createResponse({ success: true });
    } catch (e) { return createResponse({ success: false, error: e.message }, 500); }
}
