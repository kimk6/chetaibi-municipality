// functions/api/tourism.js
// ══════════════════════════════════════════════════════
// المعالم السياحية + الألبومات — CRUD مع دعم AR/FR
// ══════════════════════════════════════════════════════
import { withAuth, ok, err, handleOptions, getId, getParam } from './_utils.js';

export async function onRequestOptions() { return handleOptions(); }

// GET /api/tourism       — قائمة المعالم
// GET /api/tourism?id=   — معلم واحد مع الألبوم
export async function onRequestGet({ request, env }) {
  try {
    const id = new URL(request.url).searchParams.get('id');

    if (id) {
      const item = await env.DB.prepare('SELECT * FROM tourism WHERE id=?').bind(id).first();
      if (!item) return err('المعلم غير موجود', 404);
      const { results: albums } = await env.DB
        .prepare('SELECT * FROM tourism_albums WHERE tourism_id=? ORDER BY id').bind(id).all();
      return ok({ data: { ...item, albums } });
    }

    const { results } = await env.DB.prepare('SELECT * FROM tourism ORDER BY id').all();
    return ok({ data: results });
  } catch (e) { return err(e.message, 500); }
}

// POST /api/tourism              — إضافة معلم
// POST /api/tourism?action=album — إضافة صورة
export async function onRequestPost(context) {
  const auth = await withAuth(context); if (auth) return auth;

  if (getParam(context, 'action') === 'album') {
    try {
      const { tourism_id, image_url, caption } = await context.request.json();
      if (!tourism_id || !image_url) return err('tourism_id و image_url مطلوبان');
      const { meta } = await context.env.DB
        .prepare('INSERT INTO tourism_albums (tourism_id, image_url, caption) VALUES (?,?,?)')
        .bind(tourism_id, image_url, caption || '').run();
      return ok({ id: meta.last_row_id }, 201);
    } catch (e) { return err(e.message, 500); }
  }

  try {
    const {
      name, subtitle, description, image_url, rating, distance_info,
      badge_text, badge_color, lat, lng,
      name_fr, subtitle_fr, description_fr, distance_info_fr, badge_text_fr,
    } = await context.request.json();

    if (!name) return err('اسم المعلم مطلوب');

    const { meta } = await context.env.DB.prepare(`
      INSERT INTO tourism
        (name, subtitle, description, image_url, rating, distance_info,
         badge_text, badge_color, lat, lng,
         name_fr, subtitle_fr, description_fr, distance_info_fr, badge_text_fr)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).bind(
      name, subtitle || '', description || '', image_url || '',
      rating || '4.5', distance_info || '',
      badge_text || '', badge_color || 'emerald',
      lat ?? null, lng ?? null,
      name_fr || '', subtitle_fr || '', description_fr || '',
      distance_info_fr || '', badge_text_fr || '',
    ).run();

    return ok({ id: meta.last_row_id }, 201);
  } catch (e) { return err(e.message, 500); }
}

// PUT /api/tourism?id=
export async function onRequestPut(context) {
  const auth = await withAuth(context); if (auth) return auth;
  try {
    const id = getId(context);
    if (!id) return err('id مطلوب');

    const {
      name, subtitle, description, image_url, rating, distance_info,
      badge_text, badge_color, lat, lng,
      name_fr, subtitle_fr, description_fr, distance_info_fr, badge_text_fr,
    } = await context.request.json();

    await context.env.DB.prepare(`
      UPDATE tourism SET
        name=?, subtitle=?, description=?, image_url=?, rating=?,
        distance_info=?, badge_text=?, badge_color=?, lat=?, lng=?,
        name_fr=?, subtitle_fr=?, description_fr=?, distance_info_fr=?, badge_text_fr=?
      WHERE id=?
    `).bind(
      name, subtitle || '', description || '', image_url || '',
      rating || '4.5', distance_info || '',
      badge_text || '', badge_color || 'emerald',
      lat ?? null, lng ?? null,
      name_fr || '', subtitle_fr || '', description_fr || '',
      distance_info_fr || '', badge_text_fr || '',
      id,
    ).run();

    return ok();
  } catch (e) { return err(e.message, 500); }
}

// DELETE /api/tourism?id=
// DELETE /api/tourism?action=album&album_id=
export async function onRequestDelete(context) {
  const auth = await withAuth(context); if (auth) return auth;

  if (getParam(context, 'action') === 'album') {
    try {
      const albumId = getParam(context, 'album_id');
      if (!albumId) return err('album_id مطلوب');
      await context.env.DB.prepare('DELETE FROM tourism_albums WHERE id=?').bind(albumId).run();
      return ok();
    } catch (e) { return err(e.message, 500); }
  }

  try {
    const id = getId(context);
    if (!id) return err('id مطلوب');
    await context.env.DB.prepare('DELETE FROM tourism WHERE id=?').bind(id).run();
    return ok();
  } catch (e) { return err(e.message, 500); }
}
