// functions/api/news.js
import { withAuth, createResponse, handleOptions } from './_utils.js';

export async function onRequestOptions() { return handleOptions(); }

// دالة مساعدة: ترقية جدول news لإضافة تصنيف poster إن لم يكن مدعوماً
async function ensurePosterCategory(db) {
    try {
        // نحاول إدراج صف وهمي لمعرفة إن كان الـ constraint يمنع poster
        // الطريقة الأضمن: إعادة بناء الجدول بـ constraint مُحدَّث
        // نتحقق أولاً من بنية الجدول
        const info = await db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='news'").first();
        if (info && info.sql && info.sql.includes("category IN") && !info.sql.includes("'poster'")) {
            // نُعيد بناء الجدول بـ constraint جديد يشمل poster
            await db.batch([
                db.prepare(`CREATE TABLE IF NOT EXISTS news_new (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    title TEXT NOT NULL DEFAULT '',
                    category TEXT NOT NULL CHECK(category IN ('official','activity','social','poster')),
                    content TEXT NOT NULL DEFAULT '',
                    image_url TEXT DEFAULT '',
                    album_urls TEXT DEFAULT '[]',
                    date TEXT,
                    is_pinned INTEGER DEFAULT 0,
                    custom_label TEXT DEFAULT ''
                )`),
                db.prepare(`INSERT INTO news_new SELECT id,title,category,content,image_url,album_urls,date,is_pinned,custom_label FROM news`),
                db.prepare(`DROP TABLE news`),
                db.prepare(`ALTER TABLE news_new RENAME TO news`),
            ]);
        }
    } catch(e) {
        // إذا فشل التحقق نكمل — الـ migration اختياري
    }
}

export async function onRequestGet(context) {
    try {
        const url  = new URL(context.request.url);
        const cat  = url.searchParams.get('cat');
        const page = parseInt(url.searchParams.get('page') || '1');
        const per  = parseInt(url.searchParams.get('per')  || '0');

        let query, args;
        if (cat) {
            query = 'SELECT * FROM news WHERE category=? ORDER BY is_pinned DESC, created_at DESC';
            args  = [cat];
        } else {
            query = 'SELECT * FROM news ORDER BY is_pinned DESC, created_at DESC';
            args  = [];
        }

        const { results: all } = await context.env.DB.prepare(query).bind(...args).all();
        const total = all.length;
        let data;
        if (per > 0) {
            const offset = (page - 1) * per;
            data = all.slice(offset, offset + per);
        } else {
            data = all;
        }
        return createResponse({ success: true, data, total, page, per });
    } catch (e) { return createResponse({ success: false, error: e.message }, 500); }
}

export async function onRequestPost(context) {
    const auth = await withAuth(context);
    if (auth) return auth;
    try {
        await ensurePosterCategory(context.env.DB);
        const { title, category, content, image_url, album_urls, date, is_pinned, custom_label } = await context.request.json();
        if (!category)
            return createResponse({ success: false, error: 'category مطلوبة' }, 400);
        // content اختياري للملصقات
        if (category !== 'poster' && !content)
            return createResponse({ success: false, error: 'content مطلوب' }, 400);
        const result = await context.env.DB
            .prepare('INSERT INTO news (title,category,content,image_url,album_urls,date,is_pinned,custom_label) VALUES (?,?,?,?,?,?,?,?)')
            .bind(title || '', category, content || '', image_url || '', album_urls || '[]', date || new Date().toISOString().split('T')[0], is_pinned ? 1 : 0, custom_label || '')
            .run();
        return createResponse({ success: true, data: { id: result.meta.last_row_id } });
    } catch (e) { return createResponse({ success: false, error: e.message }, 500); }
}

export async function onRequestPut(context) {
    const auth = await withAuth(context);
    if (auth) return auth;
    try {
        await ensurePosterCategory(context.env.DB);
        const url = new URL(context.request.url);
        const id  = url.searchParams.get('id');
        if (!id) return createResponse({ success: false, error: 'id مطلوب' }, 400);
        const { title, category, content, image_url, album_urls, date, is_pinned, custom_label } = await context.request.json();
        await context.env.DB
            .prepare('UPDATE news SET title=?,category=?,content=?,image_url=?,album_urls=?,date=?,is_pinned=?,custom_label=? WHERE id=?')
            .bind(title || '', category, content || '', image_url || '', album_urls || '[]', date || new Date().toISOString().split('T')[0], is_pinned ? 1 : 0, custom_label || '', id)
            .run();
        return createResponse({ success: true });
    } catch (e) { return createResponse({ success: false, error: e.message }, 500); }
}

export async function onRequestDelete(context) {
    const auth = await withAuth(context);
    if (auth) return auth;
    try {
        const url = new URL(context.request.url);
        const id  = url.searchParams.get('id');
        if (!id) return createResponse({ success: false, error: 'id مطلوب' }, 400);
        await context.env.DB.prepare('DELETE FROM news WHERE id=?').bind(id).run();
        return createResponse({ success: true });
    } catch (e) { return createResponse({ success: false, error: e.message }, 500); }
}
