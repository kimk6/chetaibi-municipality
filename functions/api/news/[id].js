// functions/api/news/[id].js
import { createResponse, handleOptions } from '../_utils.js';

export async function onRequestOptions() { return handleOptions(); }

export async function onRequestGet(context) {
    const { env, params } = context;
    const LOGO    = 'https://cdn.jsdelivr.net/gh/kimk6/chetaibi-assets-v1@main/ui/logo.webp';
    const FAVICON = 'https://cdn.jsdelivr.net/gh/kimk6/chetaibi-assets-v1@main/ui/favicon.png';
    try {
        const news = await env.DB.prepare('SELECT * FROM news WHERE id = ?').bind(params.id).first();
        if (!news) return new Response('الخبر غير موجود', { status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8' } });

        const catMap = {
            official: { label: 'إعلان رسمي', bg: 'bg-red-100 text-red-700',       grad: 'from-red-500 to-red-700'        },
            activity: { label: 'نشاط بلدي',  bg: 'bg-emerald-100 text-emerald-700', grad: 'from-emerald-500 to-emerald-700' },
            social:   { label: 'ركن المجتمع', bg: 'bg-purple-100 text-purple-700', grad: 'from-purple-500 to-purple-700'   },
        };
        const cat = catMap[news.category] || catMap.official;
        const displayLabel = (news.custom_label?.trim()) ? news.custom_label : cat.label;
        const pin = news.is_pinned ? '<span class="text-xs bg-emerald-50 text-emerald-600 px-3 py-1 rounded-full border border-emerald-200 font-bold">📌 مثبت</span>' : '';
        const isOfficial = news.category === 'official';

        // بناء ألبوم الصور
        let albumItems = [];
        try { albumItems = JSON.parse(news.album_urls || '[]'); } catch {}

        const albumGrid = albumItems.length
            ? `<div class="grid grid-cols-2 md:grid-cols-3 gap-3">` +
              albumItems.map(u =>
                  `<div class="rounded-xl overflow-hidden shadow cursor-pointer group relative" onclick="openLB('${u}')">` +
                  `<img src="${u}" class="w-full h-40 object-cover group-hover:scale-105 transition-transform duration-300">` +
                  `<div class="absolute inset-0 bg-black/0 group-hover:bg-black/20 flex items-center justify-center">` +
                  `<span class="iconify text-white opacity-0 group-hover:opacity-100 text-2xl" data-icon="lucide:zoom-in"></span></div></div>`
              ).join('') + `</div>`
            : '';

        // ── محتوى المقال حسب الصنف ──
        let articleBody = '';

        if (isOfficial) {
            // إعلانات رسمية: صور فقط بدون عنوان ولا نص
            const heroImg = news.image_url
                ? `<img src="${news.image_url}" alt="${news.title}" class="w-full h-64 md:h-96 object-cover">`
                : `<div class="h-48 bg-gradient-to-bl from-red-500 to-red-700 flex items-center justify-center"><span class="iconify text-white text-7xl" data-icon="lucide:megaphone"></span></div>`;

            const albumSection = albumItems.length
                ? `<div class="p-6"><h3 class="text-lg font-extrabold text-gray-800 mb-4 flex items-center gap-2"><span class="iconify text-red-500" data-icon="lucide:images"></span>صور الإعلان (${albumItems.length})</h3>${albumGrid}</div>`
                : '';

            articleBody = heroImg + albumSection;
        } else {
            // نشاطات بلدية + ركن المجتمع: كل شيء
            const heroImg = news.image_url
                ? `<img src="${news.image_url}" alt="${news.title}" class="w-full h-64 md:h-96 object-cover">`
                : `<div class="h-48 bg-gradient-to-bl ${cat.grad} flex items-center justify-center"><span class="iconify text-white text-7xl" data-icon="lucide:newspaper"></span></div>`;

            const albumSection = albumItems.length
                ? `<div class="mt-10 pt-8 border-t border-gray-100"><h3 class="text-lg font-extrabold text-gray-800 mb-4 flex items-center gap-2"><span class="iconify text-emerald-500" data-icon="lucide:images"></span>معرض الصور (${albumItems.length})</h3>${albumGrid}</div>`
                : '';

            articleBody = `${heroImg}
            <div class="p-6 md:p-10">
                <div class="flex items-center gap-3 mb-4 flex-wrap">
                    <span class="inline-block ${cat.bg} text-xs font-bold px-3 py-1 rounded-full">${displayLabel}</span>
                    ${pin}
                    <span class="text-xs text-gray-400 flex items-center gap-1">
                        <span class="iconify" data-icon="lucide:calendar"></span> ${news.date}
                    </span>
                </div>
                <h1 class="text-2xl md:text-4xl font-extrabold text-gray-900 mb-6 leading-tight">${news.title}</h1>
                <div class="text-gray-600 leading-loose text-base md:text-lg whitespace-pre-wrap">${news.content}</div>
                ${albumSection}
            </div>`;
        }

        const lightboxScript = albumItems.length ? `
<div id="lb" class="fixed inset-0 bg-black/90 z-50 hidden items-center justify-center p-4" onclick="closeLB()">
    <img id="lb-img" src="" class="max-w-full max-h-[90vh] rounded-xl shadow-2xl">
    <button class="absolute top-4 right-4 text-white text-3xl font-bold" onclick="event.stopPropagation();closeLB()">✕</button>
</div>
<script>
function openLB(src){const lb=document.getElementById('lb');document.getElementById('lb-img').src=src;lb.classList.remove('hidden');lb.classList.add('flex');}
function closeLB(){const lb=document.getElementById('lb');lb.classList.add('hidden');lb.classList.remove('flex');}
<\/script>` : '';

        const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width,initial-scale=1.0">
    <title>${news.title} — بلدية شطايبي</title>
    <link rel="icon" type="image/png" href="${FAVICON}">
    <script src="https://cdn.tailwindcss.com"><\/script>
    <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;600;700;800;900&display=swap" rel="stylesheet">
    <script src="https://code.iconify.design/3/3.1.0/iconify.min.js"><\/script>
    <style>*{font-family:'Cairo',sans-serif}::-webkit-scrollbar{width:8px}::-webkit-scrollbar-track{background:#f1f5f9}::-webkit-scrollbar-thumb{background:#059669;border-radius:4px}</style>
</head>
<body class="bg-gray-50 text-gray-800">
    <header class="bg-gradient-to-l from-emerald-800 via-emerald-700 to-emerald-900 text-white py-2 text-center">
        <h1 class="text-sm font-bold">الجمهورية الجزائرية الديمقراطية الشعبية</h1>
        <p class="text-[11px] text-emerald-200 mt-0.5">وزارة الداخلية والجماعات المحلية والتهيئة العمرانية</p>
    </header>
    <div class="bg-white border-b border-emerald-100 py-4 shadow-sm">
        <div class="max-w-4xl mx-auto px-4 flex items-center justify-center gap-4">
            <div class="w-14 h-14 rounded-full overflow-hidden shadow-lg flex-shrink-0">
                <img src="${LOGO}" alt="شعار" class="w-full h-full object-cover">
            </div>
            <div class="text-center">
                <h2 class="text-xl font-extrabold text-emerald-800">بلدية شطايبي</h2>
                <p class="text-xs text-emerald-600 font-medium">ولاية عنابة - الجزائر</p>
            </div>
        </div>
    </div>
    <nav class="bg-emerald-700 shadow-lg">
        <div class="max-w-4xl mx-auto px-4 h-12 flex items-center">
            <a href="/" class="text-white/90 hover:text-white text-sm font-semibold flex items-center gap-1">
                <span class="iconify" data-icon="lucide:arrow-right"></span> العودة للرئيسية
            </a>
        </div>
    </nav>
    <main class="max-w-4xl mx-auto px-4 py-12">
        <a href="/#news" class="inline-flex items-center gap-2 text-emerald-600 font-bold text-sm mb-8 hover:text-emerald-700">
            <span class="iconify" data-icon="lucide:arrow-right"></span> العودة للأخبار
        </a>
        <article class="bg-white rounded-2xl shadow-lg overflow-hidden border border-gray-100">
            ${articleBody}
        </article>
    </main>
    <footer class="bg-gray-900 text-white py-8">
        <div class="max-w-4xl mx-auto px-4 text-center">
            <p class="text-xs text-gray-500">© <span id="yr"></span> بلدية شطايبي — جميع الحقوق محفوظة</p>
        </div>
    </footer>
    <script>document.getElementById('yr').textContent=new Date().getFullYear()<\/script>
    ${lightboxScript}
</body>
</html>`;
        return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    } catch (e) {
        return new Response('حدث خطأ: ' + e.message, { status: 500, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    }
}
