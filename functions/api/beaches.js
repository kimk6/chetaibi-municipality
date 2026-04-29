// functions/api/beaches.js — مع lat/lng
import { withAuth, createResponse, handleOptions } from './_utils.js';

export async function onRequestOptions() { return handleOptions(); }

export async function onRequestGet(context) {
    const url = new URL(context.request.url);
    const id  = url.searchParams.get('id');
    try {
        if (id) {
            const beach = await context.env.DB.prepare('SELECT * FROM beaches WHERE id=?').bind(id).first();
            if (!beach) return createResponse({ success: false, error: 'غير موجود' }, 404);
            const { results: albums } = await context.env.DB
                .prepare('SELECT * FROM beach_albums WHERE beach_id=? ORDER BY id').bind(id).all();
            return createResponse({ success: true, data: { ...beach, albums } });
        }
        const { results } = await context.env.DB.prepare('SELECT * FROM beaches ORDER BY id').all();
        return createResponse({ success: true, data: results });
    } catch (e) { return createResponse({ success: false, error: e.message }, 500); }
}

export async function onRequestPost(context) {
    const auth = await withAuth(context); if (auth) return auth;
    const url  = new URL(context.request.url);
    if (url.searchParams.get('action') === 'album') {
        try {
            const { beach_id, image_url, caption } = await context.request.json();
            if (!beach_id || !image_url) return createResponse({ success: false, error: 'beach_id و image_url مطلوبان' }, 400);
            const r = await context.env.DB
                .prepare('INSERT INTO beach_albums (beach_id,image_url,caption) VALUES (?,?,?)')
                .bind(beach_id, image_url, caption || '').run();
            return createResponse({ success: true, id: r.meta.last_row_id }, 201);
        } catch (e) { return createResponse({ success: false, error: e.message }, 500); }
    }
    try {
        const { name, description, image_url, is_supervised, season, lat, lng } = await context.request.json();
        if (!name) return createResponse({ success: false, error: 'الاسم مطلوب' }, 400);
        const r = await context.env.DB
            .prepare('INSERT INTO beaches (name,description,image_url,is_supervised,season,lat,lng) VALUES (?,?,?,?,?,?,?)')
            .bind(name, description||'', image_url||'', is_supervised??1, season||'صيف',
                  lat||null, lng||null).run();
        return createResponse({ success: true, id: r.meta.last_row_id }, 201);
    } catch (e) { return createResponse({ success: false, error: e.message }, 500); }
}

export async function onRequestPut(context) {
    const auth = await withAuth(context); if (auth) return auth;
    try {
        const id = new URL(context.request.url).searchParams.get('id');
        if (!id) return createResponse({ success: false, error: 'id مطلوب' }, 400);
        const { name, description, image_url, is_supervised, season, lat, lng } = await context.request.json();
        await context.env.DB
            .prepare('UPDATE beaches SET name=?,description=?,image_url=?,is_supervised=?,season=?,lat=?,lng=? WHERE id=?')
            .bind(name, description||'', image_url||'', is_supervised??1, season||'صيف',
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
            await context.env.DB.prepare('DELETE FROM beach_albums WHERE id=?').bind(albumId).run();
            return createResponse({ success: true });
        } catch (e) { return createResponse({ success: false, error: e.message }, 500); }
    }
    try {
        const id = url.searchParams.get('id');
        if (!id) return createResponse({ success: false, error: 'id مطلوب' }, 400);
        await context.env.DB.prepare('DELETE FROM beaches WHERE id=?').bind(id).run();
        return createResponse({ success: true });
    } catch (e) { return createResponse({ success: false, error: e.message }, 500); }
}
