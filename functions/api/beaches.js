// functions/api/beaches.js
import { withAuth, createResponse, handleOptions } from './_utils.js';

export async function onRequestOptions() { return handleOptions(); }

async function migrateBeachesTable(db) {
    try {
        const cols = await db.prepare("PRAGMA table_info(beaches)").all();
        const names = cols.results.map(c => c.name);
        if (!names.includes('name_fr'))        await db.prepare("ALTER TABLE beaches ADD COLUMN name_fr TEXT DEFAULT ''").run();
        if (!names.includes('description_fr')) await db.prepare("ALTER TABLE beaches ADD COLUMN description_fr TEXT DEFAULT ''").run();
    } catch(e) {}
}

export async function onRequestGet(context) {
    try {
        await migrateBeachesTable(context.env.DB);
        const url = new URL(context.request.url);
        const id  = url.searchParams.get('id');
        if (id) {
            const row = await context.env.DB.prepare('SELECT * FROM beaches WHERE id=?').bind(id).first();
            if (!row) return createResponse({ success: false, error: 'not found' }, 404);
            let albums = [];
            try {
                const { results } = await context.env.DB.prepare('SELECT * FROM beach_albums WHERE beach_id=? ORDER BY id ASC').bind(id).all();
                albums = results;
            } catch(e) {}
            return createResponse({ success: true, data: { ...row, albums } });
        }
        const { results } = await context.env.DB.prepare('SELECT * FROM beaches ORDER BY id ASC').all();
        return createResponse({ success: true, data: results });
    } catch (e) { return createResponse({ success: false, error: e.message }, 500); }
}

export async function onRequestPost(context) {
    const auth = await withAuth(context);
    if (auth) return auth;
    try {
        await migrateBeachesTable(context.env.DB);
        const { name, name_fr, description, description_fr, image_url, is_supervised, season, lat, lng } = await context.request.json();
        if (!name) return createResponse({ success: false, error: 'name مطلوب' }, 400);
        const result = await context.env.DB
            .prepare('INSERT INTO beaches (name,name_fr,description,description_fr,image_url,is_supervised,season,lat,lng) VALUES (?,?,?,?,?,?,?,?,?)')
            .bind(name, name_fr||'', description||'', description_fr||'', image_url||'', is_supervised?1:0, season||'صيف', lat||null, lng||null)
            .run();
        return createResponse({ success: true, data: { id: result.meta.last_row_id } });
    } catch (e) { return createResponse({ success: false, error: e.message }, 500); }
}

export async function onRequestPut(context) {
    const auth = await withAuth(context);
    if (auth) return auth;
    try {
        await migrateBeachesTable(context.env.DB);
        const url = new URL(context.request.url);
        const id  = url.searchParams.get('id');
        if (!id) return createResponse({ success: false, error: 'id مطلوب' }, 400);
        const { name, name_fr, description, description_fr, image_url, is_supervised, season, lat, lng } = await context.request.json();
        await context.env.DB
            .prepare('UPDATE beaches SET name=?,name_fr=?,description=?,description_fr=?,image_url=?,is_supervised=?,season=?,lat=?,lng=? WHERE id=?')
            .bind(name, name_fr||'', description||'', description_fr||'', image_url||'', is_supervised?1:0, season||'صيف', lat||null, lng||null, id)
            .run();
        return createResponse({ success: true });
    } catch (e) { return createResponse({ success: false, error: e.message }, 500); }
}

export async function onRequestDelete(context) {
    const auth = await withAuth(context);
    if (auth) return auth;
    try {
        const url = new URL(context.request.url);
        const id  = url.searchParams.get('id');
        if (!id) return createResponse({ success: false, error: 'id مطلوب' }, 400);
        await context.env.DB.prepare('DELETE FROM beaches WHERE id=?').bind(id).run();
        try { await context.env.DB.prepare('DELETE FROM beach_albums WHERE beach_id=?').bind(id).run(); } catch(e){}
        return createResponse({ success: true });
    } catch (e) { return createResponse({ success: false, error: e.message }, 500); }
}
