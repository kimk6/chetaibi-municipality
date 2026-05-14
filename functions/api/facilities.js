// functions/api/facilities.js — مع دعم اللغة الفرنسية
import { withAuth, createResponse, handleOptions } from './_utils.js';

export async function onRequestOptions() { return handleOptions(); }

export async function onRequestGet(context) {
    try {
        const url = new URL(context.request.url);
        const cat = url.searchParams.get('cat');
        const id  = url.searchParams.get('id');

        if (id) {
            const row = await context.env.DB.prepare('SELECT * FROM facilities WHERE id=?').bind(id).first();
            if (!row) return createResponse({ success: false, error: 'غير موجود' }, 404);
            return createResponse({ success: true, data: {
                ...row,
                tags:   JSON.parse(row.tags   || '[]'),
                albums: JSON.parse(row.albums || '[]'),
            }});
        }

        let query = 'SELECT * FROM facilities ORDER BY id';
        const args = [];
        if (cat) { query = 'SELECT * FROM facilities WHERE category=? ORDER BY id'; args.push(cat); }
        const { results } = await context.env.DB.prepare(query).bind(...args).all();
        return createResponse({ success: true, data: results.map(r => ({
            ...r,
            tags:   JSON.parse(r.tags   || '[]'),
            albums: JSON.parse(r.albums || '[]'),
        }))});
    } catch (e) { return createResponse({ success: false, error: e.message }, 500); }
}

export async function onRequestPost(context) {
    const auth = await withAuth(context); if (auth) return auth;
    try {
        const {
            name, sub_type, description, category, image_url, tags, albums, lat, lng,
            name_fr, sub_type_fr, description_fr, tags_fr
        } = await context.request.json();
        if (!name || !category) return createResponse({ success: false, error: 'name, category مطلوبان' }, 400);
        const r = await context.env.DB
            .prepare(`INSERT INTO facilities
                (name,sub_type,description,category,image_url,tags,albums,lat,lng,
                 name_fr,sub_type_fr,description_fr,tags_fr)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`)
            .bind(
                name, sub_type||'', description||'', category, image_url||'',
                JSON.stringify(tags||[]), JSON.stringify(albums||[]),
                lat||null, lng||null,
                name_fr||'', sub_type_fr||'', description_fr||'', tags_fr||''
            ).run();
        return createResponse({ success: true, id: r.meta.last_row_id }, 201);
    } catch (e) { return createResponse({ success: false, error: e.message }, 500); }
}

export async function onRequestPut(context) {
    const auth = await withAuth(context); if (auth) return auth;
    try {
        const id = new URL(context.request.url).searchParams.get('id');
        if (!id) return createResponse({ success: false, error: 'id مطلوب' }, 400);
        const {
            name, sub_type, description, category, image_url, tags, albums, lat, lng,
            name_fr, sub_type_fr, description_fr, tags_fr
        } = await context.request.json();
        await context.env.DB
            .prepare(`UPDATE facilities SET
                name=?,sub_type=?,description=?,category=?,image_url=?,tags=?,albums=?,lat=?,lng=?,
                name_fr=?,sub_type_fr=?,description_fr=?,tags_fr=?
                WHERE id=?`)
            .bind(
                name, sub_type||'', description||'', category, image_url||'',
                JSON.stringify(tags||[]), JSON.stringify(albums||[]),
                lat||null, lng||null,
                name_fr||'', sub_type_fr||'', description_fr||'', tags_fr||'',
                id
            ).run();
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
