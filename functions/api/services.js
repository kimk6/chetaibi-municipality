// functions/api/services.js — مع دعم اللغة الفرنسية
import { withAuth, createResponse, handleOptions } from './_utils.js';

export async function onRequestOptions() { return handleOptions(); }

async function migrateServicesTable(db) {
    try {
        const cols = await db.prepare("PRAGMA table_info(services)").all();
        const names = cols.results.map(c => c.name);
        if (!names.includes('name_fr'))        await db.prepare("ALTER TABLE services ADD COLUMN name_fr TEXT DEFAULT ''").run();
        if (!names.includes('description_fr')) await db.prepare("ALTER TABLE services ADD COLUMN description_fr TEXT DEFAULT ''").run();
    } catch(e) {}
}

export async function onRequestGet(context) {
    try {
        await migrateServicesTable(context.env.DB);
        const { results } = await context.env.DB.prepare('SELECT * FROM services ORDER BY id').all();
        return createResponse({ success: true, data: results });
    } catch (e) { return createResponse({ success: false, error: e.message }, 500); }
}

export async function onRequestPost(context) {
    const auth = await withAuth(context); if (auth) return auth;
    try {
        await migrateServicesTable(context.env.DB);
        const {
            service_name, name_fr, service_type, description, description_fr,
            required_docs, direct_link, form_links, image_url, color, icon
        } = await context.request.json();
        if (!service_name) return createResponse({ success: false, error: 'اسم الخدمة مطلوب' }, 400);
        const result = await context.env.DB
            .prepare(`INSERT INTO services
                (service_name, name_fr, service_type, description, description_fr, required_docs, direct_link, form_links, image_url, color, icon)
                VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
            .bind(
                service_name, name_fr||'', service_type||'service',
                description||'', description_fr||'', required_docs||'',
                direct_link||'', form_links||'[]', image_url||'', color||'blue', icon||'file-text'
            ).run();
        return createResponse({ success: true, id: result.meta.last_row_id }, 201);
    } catch (e) { return createResponse({ success: false, error: e.message }, 500); }
}

export async function onRequestPut(context) {
    const auth = await withAuth(context); if (auth) return auth;
    try {
        await migrateServicesTable(context.env.DB);
        const id = new URL(context.request.url).searchParams.get('id');
        if (!id) return createResponse({ success: false, error: 'id مطلوب' }, 400);
        const {
            service_name, name_fr, service_type, description, description_fr,
            required_docs, direct_link, form_links, image_url, color, icon
        } = await context.request.json();
        await context.env.DB
            .prepare(`UPDATE services SET
                service_name=?, name_fr=?, service_type=?, description=?, description_fr=?,
                required_docs=?, direct_link=?, form_links=?, image_url=?, color=?, icon=?
                WHERE id=?`)
            .bind(
                service_name, name_fr||'', service_type||'service',
                description||'', description_fr||'', required_docs||'',
                direct_link||'', form_links||'[]', image_url||'', color, icon, id
            ).run();
        return createResponse({ success: true });
    } catch (e) { return createResponse({ success: false, error: e.message }, 500); }
}

export async function onRequestDelete(context) {
    const auth = await withAuth(context); if (auth) return auth;
    try {
        const id = new URL(context.request.url).searchParams.get('id');
        if (!id) return createResponse({ success: false, error: 'id مطلوب' }, 400);
        await context.env.DB.prepare('DELETE FROM services WHERE id=?').bind(id).run();
        return createResponse({ success: true });
    } catch (e) { return createResponse({ success: false, error: e.message }, 500); }
}
