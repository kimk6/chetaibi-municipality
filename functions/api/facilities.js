// functions/api/facilities.js
// ══════════════════════════════════════════════════════
// دليل شطايبي (المرافق) — CRUD مع دعم AR/FR
// ══════════════════════════════════════════════════════
import { withAuth, ok, err, handleOptions, getId, getParam, safeJson } from './_utils.js';

export async function onRequestOptions() { return handleOptions(); }

function parseRow(r) {
  return { ...r, tags: safeJson(r.tags), albums: safeJson(r.albums) };
}

// GET /api/facilities?cat=&id=
export async function onRequestGet({ request, env }) {
  try {
    const url = new URL(request.url);
    const id  = url.searchParams.get('id');
    const cat = url.searchParams.get('cat');

    if (id) {
      const row = await env.DB.prepare('SELECT * FROM facilities WHERE id=?').bind(id).first();
      if (!row) return err('المرفق غير موجود', 404);
      return ok({ data: parseRow(row) });
    }

    const { results } = cat
      ? await env.DB.prepare('SELECT * FROM facilities WHERE category=? ORDER BY id').bind(cat).all()
      : await env.DB.prepare('SELECT * FROM facilities ORDER BY id').all();

    return ok({ data: results.map(parseRow) });
  } catch (e) { return err(e.message, 500); }
}

// POST /api/facilities
export async function onRequestPost(context) {
  const auth = await withAuth(context); if (auth) return auth;
  try {
    const {
      name, sub_type, description, category, image_url, tags, albums, lat, lng,
      name_fr, sub_type_fr, description_fr, tags_fr,
    } = await context.request.json();

    if (!name || !category) return err('name و category مطلوبان');

    const { meta } = await context.env.DB.prepare(`
      INSERT INTO facilities
        (name, sub_type, description, category, image_url, tags, albums, lat, lng,
         name_fr, sub_type_fr, description_fr, tags_fr)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).bind(
      name, sub_type || '', description || '', category,
      image_url || '',
      JSON.stringify(tags || []), JSON.stringify(albums || []),
      lat ?? null, lng ?? null,
      name_fr || '', sub_type_fr || '', description_fr || '', tags_fr || '',
    ).run();

    return ok({ id: meta.last_row_id }, 201);
  } catch (e) { return err(e.message, 500); }
}

// PUT /api/facilities?id=
export async function onRequestPut(context) {
  const auth = await withAuth(context); if (auth) return auth;
  try {
    const id = getId(context);
    if (!id) return err('id مطلوب');

    const {
      name, sub_type, description, category, image_url, tags, albums, lat, lng,
      name_fr, sub_type_fr, description_fr, tags_fr,
    } = await context.request.json();

    await context.env.DB.prepare(`
      UPDATE facilities SET
        name=?, sub_type=?, description=?, category=?, image_url=?,
        tags=?, albums=?, lat=?, lng=?,
        name_fr=?, sub_type_fr=?, description_fr=?, tags_fr=?
      WHERE id=?
    `).bind(
      name, sub_type || '', description || '', category,
      image_url || '',
      JSON.stringify(tags || []), JSON.stringify(albums || []),
      lat ?? null, lng ?? null,
      name_fr || '', sub_type_fr || '', description_fr || '', tags_fr || '',
      id,
    ).run();

    return ok();
  } catch (e) { return err(e.message, 500); }
}

// DELETE /api/facilities?id=
export async function onRequestDelete(context) {
  const auth = await withAuth(context); if (auth) return auth;
  try {
    const id = getId(context);
    if (!id) return err('id مطلوب');
    await context.env.DB.prepare('DELETE FROM facilities WHERE id=?').bind(id).run();
    return ok();
  } catch (e) { return err(e.message, 500); }
}
