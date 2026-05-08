// functions/api/municipality.js
// API لإدارة معلومات مقر البلدية (وصف + ألبوم صور + ترجمة فرنسية)
import { withAuth, createResponse, handleOptions } from './_utils.js';

export async function onRequestOptions() { return handleOptions(); }

// GET — يُرجع بيانات البلدية (سجل واحد id=1)
export async function onRequestGet(context) {
    try {
        const row = await context.env.DB
            .prepare('SELECT * FROM municipality WHERE id=1')
            .first();
        if (!row) return createResponse({ success: true, data: { description:'', description_fr:'', albums:'[]' } });
        return createResponse({
            success: true,
            data: { ...row, albums: JSON.parse(row.albums || '[]') }
        });
    } catch(e) { return createResponse({ success: false, error: e.message }, 500); }
}

// PUT — يُحدِّث البيانات (لوحة التحكم)
export async function onRequestPut(context) {
    const auth = await withAuth(context); if (auth) return auth;
    try {
        const { description, description_fr, albums } = await context.request.json();
        // تأكد من وجود الجدول والسجل
        await context.env.DB.prepare(`
            CREATE TABLE IF NOT EXISTS municipality (
                id INTEGER PRIMARY KEY,
                description TEXT DEFAULT '',
                description_fr TEXT DEFAULT '',
                albums TEXT DEFAULT '[]'
            )
        `).run();
        await context.env.DB.prepare(`
            INSERT INTO municipality (id, description, description_fr, albums)
            VALUES (1, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                description    = excluded.description,
                description_fr = excluded.description_fr,
                albums         = excluded.albums
        `).bind(description||'', description_fr||'', JSON.stringify(albums||[])).run();
        return createResponse({ success: true });
    } catch(e) { return createResponse({ success: false, error: e.message }, 500); }
}
