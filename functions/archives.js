// functions/archives.js
export async function onRequestGet(context) {
    const { env } = context;
    try {
        const { results: archives } = await env.DB.prepare('SELECT * FROM archives ORDER BY id').all();

        const comparison = archives.filter(a => a.image_old_url && a.image_new_url);
        const single     = archives.filter(a => !(a.image_old_url && a.image_new_url));

        const compHtml = comparison.map(a => `
            <div class="bg-white rounded-2xl overflow-hidden shadow-lg border border-gray-100">
                <div class="grid grid-cols-2">
                    <div class="relative">
                        <img src="${a.image_old_url}" alt="قديماً — ${a.title}" class="w-full h-52 object-cover" style="filter:sepia(0.7) contrast(1.1) brightness(0.9)">
                        <span class="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded-lg font-bold">قديماً</span>
                    </div>
                    <div class="relative">
                        <img src="${a.image_new_url}" alt="حديثاً — ${a.title}" class="w-full h-52 object-cover">
                        <span class="absolute bottom-2 right-2 bg-emerald-600/80 text-white text-xs px-2 py-1 rounded-lg font-bold">اليوم</span>
                    </div>
                </div>
                <div class="p-4">
                    <h4 class="font-extrabold text-gray-800 mb-1">${a.title}</h4>
                    ${a.description ? `<p class="text-sm text-gray-500">${a.description}</p>` : ''}
                </div>
            </div>`).join('');

        const singleHtml = single.map(a => {
            const imgUrl = a.image_old_url || a.image_new_url;
            return `
            <div class="bg-white rounded-2xl overflow-hidden shadow-lg border border-gray-100">
                ${imgUrl
                    ? `<img src="${imgUrl}" alt="${a.title}" class="w-full h-52 object-cover">`
                    : `<div class="h-40 bg-gradient-to-bl from-amber-400 to-amber-600 flex items-center justify-center"><span class="iconify text-white text-5xl" data-icon="lucide:image"></span></div>`
                }
                <div class="p-4">
                    <h4 class="font-extrabold text-gray-800 mb-1">${a.title}</h4>
                    ${a.description ? `<p class="text-sm text-gray-500">${a.description}</p>` : ''}
                </div>
            </div>`;
        }).join('');

        const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>أرشيف شطايبي — الأمس واليوم</title>
    <link rel="icon" type="image/png" href="https://cdn.jsdelivr.net/gh/kimk6/chetaibi-assets-v1@main/ui/favicon.png">
    <script src="https://cdn.tailwindcss.com"><\/script>
    <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
    <script src="https://code.iconify.design/3/3.1.0/iconify.min.js"><\/script>
    <style>
        *{font-family:'Cairo',sans-serif;}
        ::-webkit-scrollbar{width:8px}::-webkit-scrollbar-thumb{background:#059669;border-radius:4px}
        .pattern-bg{background-image:url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23059669' fill-opacity='0.04'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")}
    </style>
</head>
<body class="bg-gray-50 text-gray-800 pattern-bg">
    <header class="bg-gradient-to-l from-emerald-800 via-emerald-700 to-emerald-900 text-white py-2 text-center">
        <h1 class="text-sm font-bold">الجمهورية الجزائرية الديمقراطية الشعبية</h1>
        <p class="text-[11px] text-emerald-200 mt-0.5">وزارة الداخلية والجماعات المحلية والتهيئة العمرانية</p>
    </header>
    <div class="bg-white border-b border-emerald-100 py-4 shadow-sm">
        <div class="max-w-7xl mx-auto px-4 flex items-center justify-center gap-3">
            <div class="w-16 h-16 rounded-full overflow-hidden shadow-lg flex-shrink-0">
                <img src="https://cdn.jsdelivr.net/gh/kimk6/chetaibi-assets-v1@main/ui/logo.webp" alt="شعار" class="w-full h-full object-cover">
            </div>
            <div class="text-center">
                <h2 class="text-xl font-extrabold text-emerald-800">بلدية شطايبي</h2>
                <p class="text-xs text-emerald-600 font-medium">ولاية عنابة — الجزائر</p>
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
    <main class="max-w-7xl mx-auto px-4 py-14">
        <div class="text-center mb-14">
            <span class="inline-block bg-amber-100 text-amber-700 text-xs font-bold px-4 py-1.5 rounded-full mb-4">📜 تاريخ وهوية</span>
            <h2 class="text-3xl md:text-4xl font-extrabold text-gray-900 mb-3">أرشيف شطايبي — الأمس واليوم</h2>
            <p class="text-gray-500 max-w-2xl mx-auto">رحلة بصرية عبر الزمن تكشف تطور شطايبي من الماضي إلى الحاضر</p>
        </div>

        ${comparison.length ? `
        <div class="mb-16">
            <h3 class="text-2xl font-extrabold text-gray-800 mb-8 flex items-center gap-3">
                <div class="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center"><span class="iconify text-amber-600 text-xl" data-icon="lucide:split-square-horizontal"></span></div>
                مقارنة الأمس بالحاضر
            </h3>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-8">${compHtml}</div>
        </div>` : ''}

        ${single.length ? `
        <div>
            <h3 class="text-2xl font-extrabold text-gray-800 mb-8 flex items-center gap-3">
                <div class="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center"><span class="iconify text-emerald-600 text-xl" data-icon="lucide:images"></span></div>
                صور تاريخية
            </h3>
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">${singleHtml}</div>
        </div>` : ''}

        ${!archives.length ? `
        <div class="text-center py-20 text-gray-400">
            <span class="iconify text-6xl block mb-4" data-icon="lucide:image-off"></span>
            <p class="text-lg font-semibold">لا توجد صور أرشيفية بعد</p>
        </div>` : ''}
    </main>
    <footer class="bg-gray-900 text-white py-8 mt-4">
        <div class="max-w-7xl mx-auto px-4 text-center">
            <p class="text-xs text-gray-500">© <span id="yr"></span> بلدية شطايبي — جميع الحقوق محفوظة 🇩🇿</p>
        </div>
    </footer>
    <script>document.getElementById('yr').textContent=new Date().getFullYear()<\/script>
</body>
</html>`;
        return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    } catch (e) {
        return new Response('حدث خطأ: ' + e.message, { status: 500, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    }
}
