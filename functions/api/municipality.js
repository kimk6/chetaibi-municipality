// functions/api/municipality.js
// ══════════════════════════════════════════════════════
// معلومات البلدية — سجل واحد (id=1)
// ══════════════════════════════════════════════════════
import { withAuth, ok, err, handleOptions, safeJson } from './_utils.js';

export async function onRequestOptions() { return handleOptions(); }

// GET /api/municipality
export async function onRequestGet({ env }) {
  try {
    const row = await env.DB.prepare('SELECT * FROM municipality WHERE id=1').first();
    if (!row) return ok({ data: { description: '', description_fr: '', albums: [] } });
    return ok({ data: { ...row, albums: safeJson(row.albums) } });
  } catch (e) { return err(e.message, 500); }
}

// PUT /api/municipality
export async function onRequestPut(context) {
  const auth = await withAuth(context); if (auth) return auth;
  try {
    const { description, description_fr, albums } = await context.request.json();

    await context.env.DB.prepare(`
      INSERT INTO municipality (id, description, description_fr, albums)
      VALUES (1, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        description    = excluded.description,
        description_fr = excluded.description_fr,
        albums         = excluded.albums
    `).bind(
      description || '',
      description_fr || '',
      JSON.stringify(albums || []),
    ).run();

    return ok();
  } catch (e) { return err(e.message, 500); }
}
