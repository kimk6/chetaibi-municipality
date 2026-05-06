// functions/api/mayors.js — مع دعم اللغة الفرنسية
import { withAuth, createResponse, handleOptions } from './_utils.js';

export async function onRequestOptions() { return handleOptions(); }

export async function onRequestGet(context) {
    try {
        const { results } = await context.env.DB.prepare('SELECT * FROM mayors').all();

        function extractYears(period) {
            const str = period || '';
            const isCurrent = /الآن|الحالي/i.test(str);
            const years = [...str.matchAll(/(\d{4})/g)].map(m => parseInt(m[1], 10));
            const startYear = years[0] || 0;
            const endYear = isCurrent ? 9999 : (years[years.length - 1] || startYear);
            return { startYear, endYear };
        }

        const sorted = [...results].sort((a, b) => {
            const ya = extractYears(a.period);
            const yb = extractYears(b.period);
            if (yb.endYear !== ya.endYear) return yb.endYear - ya.endYear;
            return yb.startYear - ya.startYear;
        });

        return createResponse({ success: true, data: sorted });
    } catch (e) { return createResponse({ success: false, error: e.message }, 500); }
}

export async function onRequestPost(context) {
    const auth = await withAuth(context); if (auth) return auth;
    try {
        const { name, period, image_url, name_fr, period_fr } = await context.request.json();
        if (!name || !period) return createResponse({ success: false, error: 'الاسم والفترة مطلوبان' }, 400);
        const result = await context.env.DB
            .prepare('INSERT INTO mayors (name,period,image_url,name_fr,period_fr) VALUES (?,?,?,?,?)')
            .bind(name, period, image_url||'', name_fr||'', period_fr||'')
            .run();
        return createResponse({ success: true, id: result.meta.last_row_id }, 201);
    } catch (e) { return createResponse({ success: false, error: e.message }, 500); }
}

export async function onRequestPut(context) {
    const auth = await withAuth(context); if (auth) return auth;
    try {
        const id = new URL(context.request.url).searchParams.get('id');
        if (!id) return createResponse({ success: false, error: 'id مطلوب' }, 400);
        const { name, period, image_url, name_fr, period_fr } = await context.request.json();
        await context.env.DB
            .prepare('UPDATE mayors SET name=?,period=?,image_url=?,name_fr=?,period_fr=? WHERE id=?')
            .bind(name, period, image_url||'', name_fr||'', period_fr||'', id)
            .run();
        return createResponse({ success: true });
    } catch (e) { return createResponse({ success: false, error: e.message }, 500); }
}

export async function onRequestDelete(context) {
    const auth = await withAuth(context); if (auth) return auth;
    try {
        const id = new URL(context.request.url).searchParams.get('id');
        if (!id) return createResponse({ success: false, error: 'id مطلوب' }, 400);
        await context.env.DB.prepare('DELETE FROM mayors WHERE id=?').bind(id).run();
        return createResponse({ success: true });
    } catch (e) { return createResponse({ success: false, error: e.message }, 500); }
}
