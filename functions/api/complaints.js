// functions/api/complaints.js
// ══════════════════════════════════════════════════════
// الشكاوى والبلاغات — يرسلها المواطن بدون تسجيل دخول،
// ويديرها الأدمن (تغيير الحالة / الحذف) عبر withAuth
// ══════════════════════════════════════════════════════
import { withAuth, ok, err, handleOptions, getId, getParam } from './_utils.js';

export async function onRequestOptions() { return handleOptions(); }

// ينشئ الجدول تلقائياً إن لم يكن موجوداً (idempotent — آمن للاستدعاء دوماً)
async function ensureTable(DB) {
  await DB.prepare(`
    CREATE TABLE IF NOT EXISTS complaints (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      description TEXT NOT NULL,
      lat REAL,
      lng REAL,
      image_url TEXT,
      contact_phone TEXT,
      status TEXT NOT NULL DEFAULT 'جديد',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `).run();
}

// GET /api/complaints        — قائمة الشكاوى (محمي — لوحة التحكم فقط)
// GET /api/complaints?id=    — شكوى واحدة
export async function onRequestGet(context) {
  const auth = await withAuth(context); if (auth) return auth;
  try {
    await ensureTable(context.env.DB);
    const id = getId(context);

    if (id) {
      const row = await context.env.DB.prepare('SELECT * FROM complaints WHERE id=?').bind(id).first();
      if (!row) return err('البلاغ غير موجود', 404);
      return ok({ data: row });
    }

    const { results } = await context.env.DB
      .prepare('SELECT * FROM complaints ORDER BY id DESC').all();
    return ok({ data: results });
  } catch (e) { return err(e.message, 500); }
}

// POST /api/complaints — إرسال بلاغ جديد (عام — بدون تسجيل دخول)
export async function onRequestPost(context) {
  try {
    await ensureTable(context.env.DB);
    const { type, description, lat, lng, image_url, contact_phone } =
      await context.request.json();

    if (!type || !description)
      return err('نوع البلاغ ووصفه مطلوبان');
    if (description.length > 1000)
      return err('الوصف طويل جداً');

    const { meta } = await context.env.DB.prepare(`
      INSERT INTO complaints (type, description, lat, lng, image_url, contact_phone)
      VALUES (?,?,?,?,?,?)
    `).bind(
      type, description,
      lat ?? null, lng ?? null,
      image_url || '', contact_phone || '',
    ).run();

    return ok({ id: meta.last_row_id }, 201);
  } catch (e) { return err(e.message, 500); }
}

// PUT /api/complaints?id= — تحديث حالة البلاغ (محمي)
export async function onRequestPut(context) {
  const auth = await withAuth(context); if (auth) return auth;
  try {
    await ensureTable(context.env.DB);
    const id = getId(context);
    if (!id) return err('id مطلوب');

    const { status } = await context.request.json();
    const allowed = ['جديد', 'قيد المعالجة', 'منتهي'];
    if (!allowed.includes(status)) return err('حالة غير صالحة');

    await context.env.DB.prepare('UPDATE complaints SET status=? WHERE id=?')
      .bind(status, id).run();

    return ok();
  } catch (e) { return err(e.message, 500); }
}

// DELETE /api/complaints?id= — حذف بلاغ (محمي)
export async function onRequestDelete(context) {
  const auth = await withAuth(context); if (auth) return auth;
  try {
    const id = getId(context);
    if (!id) return err('id مطلوب');
    await context.env.DB.prepare('DELETE FROM complaints WHERE id=?').bind(id).run();
    return ok();
  } catch (e) { return err(e.message, 500); }
}
