export async function onRequestGet(context) {
    const { env, params } = context;
    const id = params.id;

    try {
        const news = await env.DB.prepare('SELECT * FROM news WHERE id = ?').bind(id).first();
        if (!news) return new Response('الخبر غير موجود', { 
            status: 404,
            headers: { 'Content-Type': 'text/html; charset=utf-8' }
        });

        const categoryMap = {
            official: { label: 'إعلان رسمي', color: 'red', bg: 'bg-red-100 text-red-700' },
            activity: { label: 'نشاط بلدي', color: 'emerald', bg: 'bg-emerald-100 text-emerald-700' },
            social: { label: 'ركن المجتمع', color: 'purple', bg: 'bg-purple-100 text-purple-700' },
        };
        const cat = categoryMap[news.category] || categoryMap.official;
        const displayLabel = (news.custom_label && news.custom_label.trim()) ? news.custom_label : cat.label;
        const pin = news.is_pinned ? '<span class="text-xs bg-emerald-50 text-emerald-600 px-3 py-1 rounded-full border border-emerald-200 font-bold">📌 مثبت</span>' : '';

        // بناء ألبوم الصور
        let albumHtml = '';
        try {
            const albums = JSON.parse(news.album_urls || '[]');
            if (albums.length > 0) {
                const thumbs = albums.map(u =>
                    `<div class="rounded-xl overflow-hidden shadow cursor-pointer" onclick="openLightbox('${u}')">` +
                    `<img src="${u}" class="w-full h-40 object-cover hover:scale-105 transition-transform duration-300"></div>`
                ).join('');
                albumHtml = `<div class="mt-10 pt-8 border-t border-gray-100">
                    <h3 class="text-lg font-extrabold text-gray-800 mb-4 flex items-center gap-2">
                        <span class="iconify text-emerald-500" data-icon="lucide:images"></span> معرض الصور
                    </h3>
                    <div class="grid grid-cols-2 md:grid-cols-3 gap-3">${thumbs}</div>
                </div>
                <div id="lightbox" class="fixed inset-0 bg-black/90 z-50 hidden items-center justify-center p-4" onclick="closeLightbox()">
                    <img id="lightbox-img" src="" class="max-w-full max-h-[90vh] rounded-xl shadow-2xl">
                    <button class="absolute top-4 right-4 text-white text-3xl font-bold" onclick="event.stopPropagation();closeLightbox()">✕</button>
                </div>
                <script>
                    function openLightbox(src){const lb=document.getElementById('lightbox');document.getElementById('lightbox-img').src=src;lb.classList.remove('hidden');lb.classList.add('flex');}
                    function closeLightbox(){const lb=document.getElementById('lightbox');lb.classList.add('hidden');lb.classList.remove('flex');}
                <\/script>`;
            }
        } catch(e) {}

        const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${news.title} — بلدية شطايبي</title>
    <link rel="icon" type="image/png" href="https://cdn.jsdelivr.net/gh/kimk6/chetaibi-assets-v1@main/ui/favicon.png">
    <script src="https://cdn.tailwindcss.com"><\/script>
    <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
    <script src="https://code.iconify.design/3/3.1.0/iconify.min.js"><\/script>
    <style>*{font-family:'Cairo',sans-serif;}::-webkit-scrollbar{width:8px}::-webkit-scrollbar-track{background:#f1f5f9}::-webkit-scrollbar-thumb{background:#059669;border-radius:4px}</style>
</head>
<body class="bg-gray-50 text-gray-800">
    <header class="bg-gradient-to-l from-emerald-800 via-emerald-700 to-emerald-900 text-white py-2 text-center">
        <h1 class="text-sm font-bold">الجمهورية الجزائرية الديمقراطية الشعبية</h1>
        <p class="text-[11px] text-emerald-200 mt-0.5">وزارة الداخلية والجماعات المحلية والتهيئة العمرانية</p>
    </header>
    <div class="bg-white border-b border-emerald-100 py-4 shadow-sm">
        <div class="max-w-7xl mx-auto px-4 flex items-center justify-center gap-4">
            <div class="w-14 h-14 rounded-full overflow-hidden shadow-lg flex-shrink-0">
                <img src="https://cdn.jsdelivr.net/gh/kimk6/chetaibi-assets-v1@main/ui/logo.webp" alt="شعار" class="w-full h-full object-cover">
            </div>
            <div class="text-center">
                <h2 class="text-xl font-extrabold text-emerald-800">بلدية شطايبي</h2>
                <p class="text-xs text-emerald-600 font-medium">ولاية عنابة - الجزائر</p>
            </div>
        </div>
    </div>
    <nav class="bg-emerald-700 shadow-lg">
        <div class="max-w-7xl mx-auto px-4 h-12 flex items-center">
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
            ${news.image_url ? `<img src="${news.image_url}" alt="${news.title}" class="w-full h-64 md:h-96 object-cover">` : `
            <div class="h-48 bg-gradient-to-bl from-emerald-500 to-emerald-700 flex items-center justify-center">
                <span class="iconify text-white text-7xl" data-icon="lucide:newspaper"></span>
            </div>`}
            <div class="p-6 md:p-10">
                <div class="flex items-center gap-3 mb-4 flex-wrap">
                    <span class="inline-block ${cat.bg} text-xs font-bold px-3 py-1 rounded-full">${displayLabel}</span>
                    ${pin}
                    <span class="text-xs text-gray-400 flex items-center gap-1">
                        <span class="iconify" data-icon="lucide:calendar"></span> ${news.date}
                    </span>
                </div>
                <h1 class="text-2xl md:text-4xl font-extrabold text-gray-900 mb-6 leading-tight">${news.title}</h1>
                <div class="prose prose-lg text-gray-600 leading-loose text-base md:text-lg whitespace-pre-wrap">${news.content}</div>
                ${albumHtml}
            </div>
        </article>
    </main>
    <footer class="bg-gray-900 text-white py-8">
        <div class="max-w-7xl mx-auto px-4 text-center">
            <p class="text-xs text-gray-500">© <span id="yr"></span> بلدية شطايبي — جميع الحقوق محفوظة 🇩🇿</p>
        </div>
    </footer>
    <script>document.getElementById('yr').textContent=new Date().getFullYear()<\/script>
</body>
</html>`;
        return new Response(html, {
            headers: { 'Content-Type': 'text/html; charset=utf-8' },
        });
    } catch (e) {
        return new Response('حدث خطأ: ' + e.message, { 
            status: 500,
            headers: { 'Content-Type': 'text/html; charset=utf-8' }
        });
    }
}
