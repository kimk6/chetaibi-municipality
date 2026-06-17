// functions/api/services.js
// ══════════════════════════════════════════════════════
// الخدمات الإدارية — CRUD مع دعم AR/FR
// ══════════════════════════════════════════════════════
import { withAuth, ok, err, handleOptions, getId } from './_utils.js';

export async function onRequestOptions() { return handleOptions(); }

// GET /api/services
export async function onRequestGet({ env }) {
  try {
    const { results } = await env.DB.prepare('SELECT * FROM services ORDER BY id').all();
    return ok({ data: results });
  } catch (e) { return err(e.message, 500); }
}

// POST /api/services
export async function onRequestPost(context) {
  const auth = await withAuth(context); if (auth) return auth;
  try {
    const {
      service_name, name_fr, service_type, description, description_fr,
      required_docs, required_docs_fr, direct_link, form_links, image_url, color, icon,
    } = await context.request.json();

    if (!service_name) return err('اسم الخدمة مطلوب');

    const { meta } = await context.env.DB.prepare(`
      INSERT INTO services
        (service_name, name_fr, service_type, description, description_fr,
         required_docs, required_docs_fr, direct_link, form_links, image_url, color, icon)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
    `).bind(
      service_name, name_fr || '', service_type || 'service',
      description || '', description_fr || '',
      required_docs || '', required_docs_fr || '',
      direct_link || '', form_links || '[]',
      image_url || '', color || 'blue', icon || 'file-text',
    ).run();

    return ok({ id: meta.last_row_id }, 201);
  } catch (e) { return err(e.message, 500); }
}

// PUT /api/services?id=
export async function onRequestPut(context) {
  const auth = await withAuth(context); if (auth) return auth;
  try {
    const id = getId(context);
    if (!id) return err('id مطلوب');

    const {
      service_name, name_fr, service_type, description, description_fr,
      required_docs, required_docs_fr, direct_link, form_links, image_url, color, icon,
    } = await context.request.json();

    await context.env.DB.prepare(`
      UPDATE services SET
        service_name=?, name_fr=?, service_type=?, description=?, description_fr=?,
        required_docs=?, required_docs_fr=?, direct_link=?, form_links=?,
        image_url=?, color=?, icon=?
      WHERE id=?
    `).bind(
      service_name, name_fr || '', service_type || 'service',
      description || '', description_fr || '',
      required_docs || '', required_docs_fr || '',
      direct_link || '', form_links || '[]',
      image_url || '', color || 'blue', icon || 'file-text',
      id,
    ).run();

    return ok();
  } catch (e) { return err(e.message, 500); }
}

// DELETE /api/services?id=
export async function onRequestDelete(context) {
  const auth = await withAuth(context); if (auth) return auth;
  try {
    const id = getId(context);
    if (!id) return err('id مطلوب');
    await context.env.DB.prepare('DELETE FROM services WHERE id=?').bind(id).run();
    return ok();
  } catch (e) { return err(e.message, 500); }
}
