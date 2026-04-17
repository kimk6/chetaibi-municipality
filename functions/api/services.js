import { verifyAuth, json, handleOptions } from './_utils.js';
export async function onRequestOptions(context) { return handleOptions(); }

export async function onRequestGet(context) {
    try {
        const result = await context.env.DB.prepare('SELECT * FROM services ORDER BY id').all();
        return json({ success: true, data: result.results });
    } catch (e) { return json({ error: e.message }, 500); }
}

export async function onRequestPost(context) {
    const user = await verifyAuth(context.request, context.env);
    if (!user) return json({ error: 'غير مصرح' }, 401);
    try {
        const { service_name, required_docs, pdf_link, color, icon } = await context.request.json();
        const result = await context.env.DB.prepare(
            'INSERT INTO services (service_name, required_docs, pdf_link, color, icon) VALUES (?,?,?,?,?)'
        ).bind(service_name, required_docs, pdf_link || '', color || 'blue', icon || 'file-text').run();
        return json({ success: true, id: result.meta.last_row_id }, 201);
    } catch (e) { return json({ error: e.message }, 500); }
}

export async function onRequestPut(context) {
    const user = await verifyAuth(context.request, context.env);
    if (!user) return json({ error: 'غير مصرح' }, 401);
    try {
        const url = new URL(context.request.url);
        const id = url.searchParams.get('id');
        const { service_name, required_docs, pdf_link, color, icon } = await context.request.json();
        await context.env.DB.prepare(
            'UPDATE services SET service_name=?, required_docs=?, pdf_link=?, color=?, icon=? WHERE id=?'
        ).bind(service_name, required_docs, pdf_link, color, icon, id).run();
        return json({ success: true });
    } catch (e) { return json({ error: e.message }, 500); }
}

export async function onRequestDelete(context) {
    const user = await verifyAuth(context.request, context.env);
    if (!user) return json({ error: 'غير مصرح' }, 401);
    try {
        const url = new URL(context.request.url);
        const id = url.searchParams.get('id');
        await context.env.DB.prepare('DELETE FROM services WHERE id=?').bind(id).run();
        return json({ success: true });
    } catch (e) { return json({ error: e.message }, 500); }
}
