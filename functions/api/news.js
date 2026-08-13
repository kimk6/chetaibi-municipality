// functions/api/news.js
// ══════════════════════════════════════════════════════
// الأخبار والإعلانات — CRUD كامل مع دعم AR/FR
// ══════════════════════════════════════════════════════
import { withAuth, ok, err, handleOptions, getId, getParam } from './_utils.js';

export async function onRequestOptions() { return handleOptions(); }

// GET /api/news?cat=&page=&per=
export async function onRequestGet({ request, env }) {
  try {
    const url  = new URL(request.url);
    const cat  = url.searchParams.get('cat');
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
    const per  = parseInt(url.searchParams.get('per') || '0');

    const { results } = cat
      ? await env.DB.prepare('SELECT * FROM news WHERE category=? ORDER BY is_pinned DESC, id DESC').bind(cat).all()
      : await env.DB.prepare('SELECT * FROM news ORDER BY is_pinned DESC, id DESC').all();

    const total = results.length;
    const data  = per > 0 ? results.slice((page - 1) * per, page * per) : results;

    return ok({ data, total, page, per });
  } catch (e) {
    return err(e.message, 500);
  }
}

// POST /api/news
export async function onRequestPost(context) {
  const auth = await withAuth(context); if (auth) return auth;
  try {
    const {
      title, category, content, image_url, image_url_fr, album_urls, date,
      is_pinned, custom_label, title_fr, content_fr, custom_label_fr,
    } = await context.request.json();

    if (!category) return err('category مطلوبة');
    if (category !== 'poster' && category !== 'official' && !content) return err('content مطلوب');

    const { meta } = await context.env.DB.prepare(`
      INSERT INTO news
        (title, category, content, image_url, image_url_fr, album_urls, date,
         is_pinned, custom_label, title_fr, content_fr, custom_label_fr)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
    `).bind(
      title || '', category, content || '',
      image_url || '', image_url_fr || '',
      album_urls || '[]',
      date || new Date().toISOString().split('T')[0],
      is_pinned ? 1 : 0, custom_label || '',
      title_fr || '', content_fr || '', custom_label_fr || '',
    ).run();

    return ok({ id: meta.last_row_id }, 201);
  } catch (e) {
    return err(e.message, 500);
  }
}

// PUT /api/news?id=
export async function onRequestPut(context) {
  const auth = await withAuth(context); if (auth) return auth;
  try {
    const id = getId(context);
    if (!id) return err('id مطلوب');

    const {
      title, category, content, image_url, image_url_fr, album_urls, date,
      is_pinned, custom_label, title_fr, content_fr, custom_label_fr,
    } = await context.request.json();

    await context.env.DB.prepare(`
      UPDATE news SET
        title=?, category=?, content=?, image_url=?, image_url_fr=?, album_urls=?,
        date=?, is_pinned=?, custom_label=?, title_fr=?, content_fr=?, custom_label_fr=?
      WHERE id=?
    `).bind(
      title || '', category, content || '',
      image_url || '', image_url_fr || '',
      album_urls || '[]',
      date || new Date().toISOString().split('T')[0],
      is_pinned ? 1 : 0, custom_label || '',
      title_fr || '', content_fr || '', custom_label_fr || '',
      id,
    ).run();

    return ok();
  } catch (e) {
    return err(e.message, 500);
  }
}

// DELETE /api/news?id=
export async function onRequestDelete(context) {
  const auth = await withAuth(context); if (auth) return auth;
  try {
    const id = getId(context);
    if (!id) return err('id مطلوب');
    await context.env.DB.prepare('DELETE FROM news WHERE id=?').bind(id).run();
    return ok();
  } catch (e) {
    return err(e.message, 500);
  }
}
