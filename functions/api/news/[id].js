// functions/api/news/[id].js
import { withAuth, createResponse, handleOptions } from '../_utils.js';

export async function onRequestOptions() { return handleOptions(); }

export async function onRequestGet(context) {
    try {
        const news = await context.env.DB
            .prepare('SELECT * FROM news WHERE id = ?')
            .bind(context.params.id).first();
        if (!news) return new Response('الخبر غير موجود', { status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8' } });

        const cm = {
            official: { label: 'إعلان رسمي', bg: 'bg-red-100 text-red-700' },
            activity: { label: 'نشاط بلدي', bg: 'bg-emerald-100 text-emerald-700' },
            social:   { label: 'ركن المجتمع', bg: 'bg-purple-100 text-purple-700' }
        };
        const cat = cm[news.category] || cm.official;
        const displayLabel = (news.custom_label && news.custom_label.trim()) ? news.custom_label : cat.label;
        const pin = news.is_pinned ? '<span class="text-xs bg-emerald-50 text-emerald-600 px-3 py-1 rounded-full border border-emerald-200 font-bold">📌 مثبت</span>' : '';

        const html = `<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>${news.title} — بلدية شطايبي</title><link rel="icon" type="image/png" href="https://cdn.jsdelivr.net/gh/kimk6/chetaibi-assets-v1@main/ui/favicon.png"><script src="https://cdn.tailwindcss.com"><\/script><link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap" rel="stylesheet"><script src="https://code.iconify.design/3/3.1.0/iconify.min.js"><\/script><style>*{font-family:'Cairo',sans-serif}::-webkit-scrollbar{width:8px}::-webkit-scrollbar-thumb{background:#059669;border-radius:4px}</style></head><body class="bg-gray-50"><header class="bg-gradient-to-l from-emerald-800 to-emerald-700 text-white py-3 text-center"><h1 class="text-sm font-bold">الجمهورية الجزائرية الديمقراطية الشعبية</h1></header><div class="bg-white border-b py-4 shadow-sm"><div class="max-w-4xl mx-auto px-4 flex items-center justify-center gap-3"><div class="w-14 h-14 rounded-full overflow-hidden shadow-md"><img src="https://cdn.jsdelivr.net/gh/kimk6/chetaibi-assets-v1@main/ui/logo.webp" class="w-full h-full object-cover"></div><div class="text-center"><h2 class="text-xl font-extrabold text-emerald-800">بلدية شطايبي</h2><p class="text-xs text-emerald-600">ولاية عنابة - الجزائر</p></div></div></div><nav class="bg-emerald-700 shadow-lg"><div class="max-w-4xl mx-auto px-4 h-12 flex items-center"><a href="/" class="text-white/90 hover:text-white text-sm font-semibold flex items-center gap-1"><span class="iconify" data-icon="lucide:arrow-right"></span> العودة للرئيسية</a></div></nav><main class="max-w-4xl mx-auto px-4 py-12"><a href="/#news" class="inline-flex items-center gap-2 text-emerald-600 font-bold text-sm mb-8 hover:text-emerald-700"><span class="iconify" data-icon="lucide:arrow-right"></span> العودة للأخبار</a><article class="bg-white rounded-2xl shadow-lg overflow-hidden border border-gray-100">${news.image_url ? `<img src="${news.image_url}" alt="${news.title}" class="w-full h-64 md:h-96 object-cover">` : `<div class="h-40 bg-gradient-to-bl from-emerald-500 to-emerald-700 flex items-center justify-center"><span class="iconify text-white text-7xl" data-icon="lucide:newspaper"></span></div>`}<div class="p-6 md:p-10"><div class="flex items-center gap-3 mb-4 flex-wrap"><span class="inline-block ${cat.bg} text-xs font-bold px-3 py-1 rounded-full">${displayLabel}</span>${pin}<span class="text-xs text-gray-400"><span class="iconify" data-icon="lucide:calendar"></span> ${news.date}</span></div><h1 class="text-2xl md:text-4xl font-extrabold text-gray-900 mb-6 leading-tight">${news.title}</h1><div class="text-gray-600 leading-loose whitespace-pre-wrap">${news.content}</div></div></article></main><footer class="bg-gray-900 text-white py-8 mt-4"><div class="max-w-4xl mx-auto px-4 text-center"><p class="text-xs text-gray-500">© 2025 بلدية شطايبي 🇩🇿</p></div></footer></body></html>`;
        return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    } catch (e) { return new Response('خطأ: ' + e.message, { status: 500, headers: { 'Content-Type': 'text/html; charset=utf-8' } }); }
}

export async function onRequestPut(context) {
    const auth = await withAuth(context); if (auth) return auth;
    try {
        const { title, category, content, image_url, date, is_pinned, custom_label } = await context.request.json();
        await context.env.DB
            .prepare('UPDATE news SET title=?,category=?,content=?,image_url=?,date=?,is_pinned=?,custom_label=? WHERE id=?')
            .bind(title, category, content, image_url || '', date || new Date().toISOString().split('T')[0], is_pinned ? 1 : 0, custom_label || '', context.params.id)
            .run();
        return createResponse({ success: true });
    } catch (e) { return createResponse({ success: false, error: e.message }, 500); }
}

export async function onRequestDelete(context) {
    const auth = await withAuth(context); if (auth) return auth;
    try {
        await context.env.DB.prepare('DELETE FROM news WHERE id=?').bind(context.params.id).run();
        return createResponse({ success: true });
    } catch (e) { return createResponse({ success: false, error: e.message }, 500); }
}
