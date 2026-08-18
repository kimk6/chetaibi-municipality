// functions/api/archives.js
// ══════════════════════════════════════════════════════
// أرشيف شطايبي — CRUD مع دعم AR/FR
// ══════════════════════════════════════════════════════
import { withAuth, ok, err, handleOptions, getId } from './_utils.js';

export async function onRequestOptions() { return handleOptions(); }

// GET /api/archives
export async function onRequestGet({ env }) {
  try {
    const { results } = await env.DB.prepare('SELECT * FROM archives ORDER BY id DESC').all();
    return ok({ data: results });
  } catch (e) { return err(e.message, 500); }
}

// POST /api/archives
export async function onRequestPost(context) {
  const auth = await withAuth(context); if (auth) return auth;
  try {
    const { title, description, image_old_url, image_new_url, title_fr, description_fr } =
      await context.request.json();

    if (!title) return err('العنوان مطلوب');

    const { meta } = await context.env.DB.prepare(`
      INSERT INTO archives
        (title, description, image_old_url, image_new_url, title_fr, description_fr)
      VALUES (?,?,?,?,?,?)
    `).bind(
      title, description || '',
      image_old_url || '', image_new_url || '',
      title_fr || '', description_fr || '',
    ).run();

    return ok({ id: meta.last_row_id }, 201);
  } catch (e) { return err(e.message, 500); }
}

// PUT /api/archives?id=
export async function onRequestPut(context) {
  const auth = await withAuth(context); if (auth) return auth;
  try {
    const id = getId(context);
    if (!id) return err('id مطلوب');

    const { title, description, image_old_url, image_new_url, title_fr, description_fr } =
      await context.request.json();

    await context.env.DB.prepare(`
      UPDATE archives SET
        title=?, description=?, image_old_url=?, image_new_url=?,
        title_fr=?, description_fr=?
      WHERE id=?
    `).bind(
      title, description || '',
      image_old_url || '', image_new_url || '',
      title_fr || '', description_fr || '',
      id,
    ).run();

    return ok();
  } catch (e) { return err(e.message, 500); }
}

// DELETE /api/archives?id=
export async function onRequestDelete(context) {
  const auth = await withAuth(context); if (auth) return auth;
  try {
    const id = getId(context);
    if (!id) return err('id مطلوب');
    await context.env.DB.prepare('DELETE FROM archives WHERE id=?').bind(id).run();
    return ok();
  } catch (e) { return err(e.message, 500); }
}
