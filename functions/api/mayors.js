// functions/api/mayors.js
// ══════════════════════════════════════════════════════
// رؤساء المجلس الشعبي البلدي — CRUD مع ترتيب زمني
// ══════════════════════════════════════════════════════
import { withAuth, ok, err, handleOptions, getId } from './_utils.js';

export async function onRequestOptions() { return handleOptions(); }

// استخراج السنوات من نص الفترة مثل "2002 – الآن"
function extractYears(period = '') {
  const isCurrent = /الآن|الحالي/i.test(period);
  const years     = [...period.matchAll(/(\d{4})/g)].map(m => +m[1]);
  return {
    start: years[0] || 0,
    end:   isCurrent ? 9999 : (years[years.length - 1] || years[0] || 0),
  };
}

// GET /api/mayors — مرتبون من الأحدث للأقدم
export async function onRequestGet({ env }) {
  try {
    const { results } = await env.DB.prepare('SELECT * FROM mayors').all();
    const sorted = results.sort((a, b) => {
      const ya = extractYears(a.period);
      const yb = extractYears(b.period);
      return yb.end !== ya.end ? yb.end - ya.end : yb.start - ya.start;
    });
    return ok({ data: sorted });
  } catch (e) {
    return err(e.message, 500);
  }
}

// POST /api/mayors
export async function onRequestPost(context) {
  const auth = await withAuth(context); if (auth) return auth;
  try {
    const { name, period, image_url, name_fr, period_fr, is_dec } =
      await context.request.json();

    if (!name || !period) return err('الاسم والفترة مطلوبان');

    const { meta } = await context.env.DB.prepare(`
      INSERT INTO mayors (name, period, image_url, name_fr, period_fr, is_dec)
      VALUES (?,?,?,?,?,?)
    `).bind(name, period, image_url || '', name_fr || '', period_fr || '', is_dec ? 1 : 0).run();

    return ok({ id: meta.last_row_id }, 201);
  } catch (e) {
    return err(e.message, 500);
  }
}

// PUT /api/mayors?id=
export async function onRequestPut(context) {
  const auth = await withAuth(context); if (auth) return auth;
  try {
    const id = getId(context);
    if (!id) return err('id مطلوب');

    const { name, period, image_url, name_fr, period_fr, is_dec } =
      await context.request.json();

    await context.env.DB.prepare(`
      UPDATE mayors
      SET name=?, period=?, image_url=?, name_fr=?, period_fr=?, is_dec=?
      WHERE id=?
    `).bind(name, period, image_url || '', name_fr || '', period_fr || '', is_dec ? 1 : 0, id).run();

    return ok();
  } catch (e) {
    return err(e.message, 500);
  }
}

// DELETE /api/mayors?id=
export async function onRequestDelete(context) {
  const auth = await withAuth(context); if (auth) return auth;
  try {
    const id = getId(context);
    if (!id) return err('id مطلوب');
    await context.env.DB.prepare('DELETE FROM mayors WHERE id=?').bind(id).run();
    return ok();
  } catch (e) {
    return err(e.message, 500);
  }
}
