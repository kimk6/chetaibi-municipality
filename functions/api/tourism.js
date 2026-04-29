// functions/api/tourism.js — مع lat/lng
import { withAuth, createResponse, handleOptions } from './_utils.js';

export async function onRequestOptions() { return handleOptions(); }

export async function onRequestGet(context) {
    const url = new URL(context.request.url);
    const id  = url.searchParams.get('id');
    try {
        if (id) {
            const item = await context.env.DB.prepare('SELECT * FROM tourism WHERE id=?').bind(id).first();
            if (!item) return createResponse({ success: false, error: 'غير موجود' }, 404);
            const { results: albums } = await context.env.DB
                .prepare('SELECT * FROM tourism_albums WHERE tourism_id=? ORDER BY id').bind(id).all();
            return createResponse({ success: true, data: { ...item, albums } });
        }
        const { results } = await context.env.DB.prepare('SELECT * FROM tourism ORDER BY id').all();
        return createResponse({ success: true, data: results });
    } catch (e) { return createResponse({ success: false, error: e.message }, 500); }
}

export async function onRequestPost(context) {
    const auth = await withAuth(context); if (auth) return auth;
    const url  = new URL(context.request.url);
    if (url.searchParams.get('action') === 'album') {
        try {
            const { tourism_id, image_url, caption } = await context.request.json();
            if (!tourism_id || !image_url) return createResponse({ success: false, error: 'tourism_id و image_url مطلوبان' }, 400);
            const r = await context.env.DB
                .prepare('INSERT INTO tourism_albums (tourism_id,image_url,caption) VALUES (?,?,?)')
                .bind(tourism_id, image_url, caption||'').run();
            return createResponse({ success: true, id: r.meta.last_row_id }, 201);
        } catch (e) { return createResponse({ success: false, error: e.message }, 500); }
    }
    try {
        const { name, subtitle, description, image_url, rating, distance_info, badge_text, badge_color, lat, lng } = await context.request.json();
        if (!name) return createResponse({ success: false, error: 'الاسم مطلوب' }, 400);
        const r = await context.env.DB
            .prepare('INSERT INTO tourism (name,subtitle,description,image_url,rating,distance_info,badge_text,badge_color,lat,lng) VALUES (?,?,?,?,?,?,?,?,?,?)')
            .bind(name, subtitle||'', description||'', image_url||'', rating||'4.5',
                  distance_info||'', badge_text||'', badge_color||'emerald',
                  lat||null, lng||null).run();
        return createResponse({ success: true, id: r.meta.last_row_id }, 201);
    } catch (e) { return createResponse({ success: false, error: e.message }, 500); }
}

export async function onRequestPut(context) {
    const auth = await withAuth(context); if (auth) return auth;
    try {
        const id = new URL(context.request.url).searchParams.get('id');
        if (!id) return createResponse({ success: false, error: 'id مطلوب' }, 400);
        const { name, subtitle, description, image_url, rating, distance_info, badge_text, badge_color, lat, lng } = await context.request.json();
        await context.env.DB
            .prepare('UPDATE tourism SET name=?,subtitle=?,description=?,image_url=?,rating=?,distance_info=?,badge_text=?,badge_color=?,lat=?,lng=? WHERE id=?')
            .bind(name, subtitle||'', description||'', image_url||'', rating||'4.5',
                  distance_info||'', badge_text||'', badge_color||'emerald',
                  lat||null, lng||null, id).run();
        return createResponse({ success: true });
    } catch (e) { return createResponse({ success: false, error: e.message }, 500); }
}

export async function onRequestDelete(context) {
    const auth = await withAuth(context); if (auth) return auth;
    const url = new URL(context.request.url);
    if (url.searchParams.get('action') === 'album') {
        try {
            const albumId = url.searchParams.get('album_id');
            if (!albumId) return createResponse({ success: false, error: 'album_id مطلوب' }, 400);
            await context.env.DB.prepare('DELETE FROM tourism_albums WHERE id=?').bind(albumId).run();
            return createResponse({ success: true });
        } catch (e) { return createResponse({ success: false, error: e.message }, 500); }
    }
    try {
        const id = url.searchParams.get('id');
        if (!id) return createResponse({ success: false, error: 'id مطلوب' }, 400);
        await context.env.DB.prepare('DELETE FROM tourism WHERE id=?').bind(id).run();
        return createResponse({ success: true });
    } catch (e) { return createResponse({ success: false, error: e.message }, 500); }
}
