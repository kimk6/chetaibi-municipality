// functions/api/beaches.js
// ══════════════════════════════════════════════════════
// الشواطئ + ألبومات الصور — CRUD مع دعم AR/FR
// ══════════════════════════════════════════════════════
import { withAuth, ok, err, handleOptions, getId, getParam } from './_utils.js';

export async function onRequestOptions() { return handleOptions(); }

// GET /api/beaches        — قائمة الشواطئ
// GET /api/beaches?id=    — شاطئ واحد مع الألبوم
export async function onRequestGet({ request, env }) {
  try {
    const id = new URL(request.url).searchParams.get('id');

    if (id) {
      const beach = await env.DB.prepare('SELECT * FROM beaches WHERE id=?').bind(id).first();
      if (!beach) return err('الشاطئ غير موجود', 404);
      const { results: albums } = await env.DB
        .prepare('SELECT * FROM beach_albums WHERE beach_id=? ORDER BY id').bind(id).all();
      return ok({ data: { ...beach, albums } });
    }

    const { results } = await env.DB.prepare('SELECT * FROM beaches ORDER BY id').all();
    return ok({ data: results });
  } catch (e) {
    return err(e.message, 500);
  }
}

// POST /api/beaches              — إضافة شاطئ
// POST /api/beaches?action=album — إضافة صورة للألبوم
export async function onRequestPost(context) {
  const auth = await withAuth(context); if (auth) return auth;

  // إضافة صورة للألبوم
  if (getParam(context, 'action') === 'album') {
    try {
      const { beach_id, image_url, caption } = await context.request.json();
      if (!beach_id || !image_url) return err('beach_id و image_url مطلوبان');
      const { meta } = await context.env.DB
        .prepare('INSERT INTO beach_albums (beach_id, image_url, caption) VALUES (?,?,?)')
        .bind(beach_id, image_url, caption || '').run();
      return ok({ id: meta.last_row_id }, 201);
    } catch (e) { return err(e.message, 500); }
  }

  // إضافة شاطئ جديد
  try {
    const { name, description, image_url, is_supervised, season, lat, lng, name_fr, description_fr } =
      await context.request.json();
    if (!name) return err('اسم الشاطئ مطلوب');

    const { meta } = await context.env.DB.prepare(`
      INSERT INTO beaches
        (name, description, image_url, is_supervised, season, lat, lng, name_fr, description_fr)
      VALUES (?,?,?,?,?,?,?,?,?)
    `).bind(
      name, description || '', image_url || '',
      is_supervised ?? 1, season || 'صيف',
      lat ?? null, lng ?? null,
      name_fr || '', description_fr || '',
    ).run();

    return ok({ id: meta.last_row_id }, 201);
  } catch (e) { return err(e.message, 500); }
}

// PUT /api/beaches?id=
export async function onRequestPut(context) {
  const auth = await withAuth(context); if (auth) return auth;
  try {
    const id = getId(context);
    if (!id) return err('id مطلوب');

    const { name, description, image_url, is_supervised, season, lat, lng, name_fr, description_fr } =
      await context.request.json();

    await context.env.DB.prepare(`
      UPDATE beaches SET
        name=?, description=?, image_url=?, is_supervised=?, season=?,
        lat=?, lng=?, name_fr=?, description_fr=?
      WHERE id=?
    `).bind(
      name, description || '', image_url || '',
      is_supervised ?? 1, season || 'صيف',
      lat ?? null, lng ?? null,
      name_fr || '', description_fr || '',
      id,
    ).run();

    return ok();
  } catch (e) { return err(e.message, 500); }
}

// DELETE /api/beaches?id=              — حذف شاطئ
// DELETE /api/beaches?action=album&album_id= — حذف صورة
export async function onRequestDelete(context) {
  const auth = await withAuth(context); if (auth) return auth;

  if (getParam(context, 'action') === 'album') {
    try {
      const albumId = getParam(context, 'album_id');
      if (!albumId) return err('album_id مطلوب');
      await context.env.DB.prepare('DELETE FROM beach_albums WHERE id=?').bind(albumId).run();
      return ok();
    } catch (e) { return err(e.message, 500); }
  }

  try {
    const id = getId(context);
    if (!id) return err('id مطلوب');
    await context.env.DB.prepare('DELETE FROM beaches WHERE id=?').bind(id).run();
    return ok();
  } catch (e) { return err(e.message, 500); }
}
