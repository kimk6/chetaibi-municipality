// functions/api/facilities.js
import { withAuth, createResponse, handleOptions } from './_utils.js';

export async function onRequestOptions() { return handleOptions(); }

export async function onRequestGet(context) {
    try {
        const url = new URL(context.request.url);
        const cat = url.searchParams.get('cat');
        let query = 'SELECT * FROM facilities ORDER BY id';
        const args = [];
        if (cat) { query = 'SELECT * FROM facilities WHERE category=? ORDER BY id'; args.push(cat); }
        const { results } = await context.env.DB.prepare(query).bind(...args).all();
        // parse tags and albums
        const data = results.map(r => ({
            ...r,
            tags:   JSON.parse(r.tags   || '[]'),
            albums: JSON.parse(r.albums || '[]'),
        }));
        return createResponse({ success: true, data });
    } catch (e) { return createResponse({ success: false, error: e.message }, 500); }
}

export async function onRequestPost(context) {
    const auth = await withAuth(context); if (auth) return auth;
    try {
        const { name, sub_type, description, category, image_url, tags, albums } = await context.request.json();
        if (!name || !category) return createResponse({ success: false, error: 'name, category مطلوبان' }, 400);
        const result = await context.env.DB
            .prepare('INSERT INTO facilities (name,sub_type,description,category,image_url,tags,albums) VALUES (?,?,?,?,?,?,?)')
            .bind(name, sub_type||'', description||'', category, image_url||'', JSON.stringify(tags||[]), JSON.stringify(albums||[]))
            .run();
        return createResponse({ success: true, id: result.meta.last_row_id }, 201);
    } catch (e) { return createResponse({ success: false, error: e.message }, 500); }
}

export async function onRequestPut(context) {
    const auth = await withAuth(context); if (auth) return auth;
    try {
        const id = new URL(context.request.url).searchParams.get('id');
        if (!id) return createResponse({ success: false, error: 'id مطلوب' }, 400);
        const { name, sub_type, description, category, image_url, tags, albums } = await context.request.json();
        await context.env.DB
            .prepare('UPDATE facilities SET name=?,sub_type=?,description=?,category=?,image_url=?,tags=?,albums=? WHERE id=?')
            .bind(name, sub_type||'', description||'', category, image_url||'', JSON.stringify(tags||[]), JSON.stringify(albums||[]), id)
            .run();
        return createResponse({ success: true });
    } catch (e) { return createResponse({ success: false, error: e.message }, 500); }
}

export async function onRequestDelete(context) {
    const auth = await withAuth(context); if (auth) return auth;
    try {
        const id = new URL(context.request.url).searchParams.get('id');
        if (!id) return createResponse({ success: false, error: 'id مطلوب' }, 400);
        await context.env.DB.prepare('DELETE FROM facilities WHERE id=?').bind(id).run();
        return createResponse({ success: true });
    } catch (e) { return createResponse({ success: false, error: e.message }, 500); }
}
