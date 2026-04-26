export async function onRequestGet(context) {
    const { env } = context;
    try {
        // جلب كل الرؤساء
        const { results: rawMayors } = await env.DB
            .prepare('SELECT * FROM mayors').all();

        // ── ترتيب حسب سنة بداية الفترة (الأحدث أولاً) ──
        // نستخرج أول 4 أرقام من حقل period كسنة للترتيب
        // مثال: "2021 — الآن" → 2021 | "2019 - 2021" → 2019
        function extractStartYear(period) {
            const match = (period || '').match(/(\d{4})/);
            return match ? parseInt(match[1], 10) : 0;
        }

        const mayors = [...rawMayors].sort(
            (a, b) => extractStartYear(b.period) - extractStartYear(a.period)
        );

        // الرئيس الحالي = أول عنصر بعد الترتيب (الأحدث)
        const current = mayors[0] || null;

        // ── بطاقة الرئيس الحالي (كبيرة ومميزة) ──
        const currentCardHtml = current ? `
        <div class="bg-gradient-to-l from-emerald-700 to-emerald-800 rounded-2xl p-8 shadow-2xl text-white mb-14 flex flex-col md:flex-row items-center gap-8">
            <div class="flex-shrink-0">
                <div class="w-32 h-32 rounded-full overflow-hidden border-4 border-white/30 shadow-xl flex items-center justify-center
                    ${current.image_url ? '' : 'bg-white/20'}">
                    ${current.image_url
                        ? `<img src="${current.image_url}" alt="${current.name}" class="w-full h-full object-cover">`
                        : `<span class="iconify text-white text-6xl" data-icon="lucide:user-circle"></span>`}
                </div>
            </div>
            <div class="text-center md:text-right flex-1">
                <span class="inline-block bg-white/20 text-white text-xs font-bold px-3 py-1 rounded-full mb-3">
                    🏛️ الرئيس الحالي
                </span>
                <h3 class="text-2xl md:text-3xl font-extrabold mb-1">${current.name}</h3>
                <p class="text-emerald-200 text-sm font-semibold mb-4">${current.period}</p>
                <p class="text-white/80 text-sm leading-relaxed max-w-xl">
                    يتولى السيد ${current.name} رئاسة المجلس الشعبي البلدي لبلدية شطايبي، حيث يعمل على تطوير البلدية وتحسين الخدمات المقدمة للمواطنين ضمن رؤية تنموية شاملة.
                </p>
            </div>
        </div>` : '';

        // ── بطاقات الرؤساء السابقين (بدون الأول) ──
        const pastMayors = mayors.slice(1);
        const pastCardsHtml = pastMayors.map(m => `
            <div class="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 text-center hover:shadow-xl transition-shadow">
                <div class="w-24 h-24 ${m.image_url ? '' : 'bg-emerald-100'} rounded-full mx-auto mb-4 overflow-hidden flex items-center justify-center border-4 border-emerald-200">
                    ${m.image_url
                        ? `<img src="${m.image_url}" alt="${m.name}" class="w-full h-full object-cover">`
                        : `<span class="iconify text-emerald-600 text-4xl" data-icon="lucide:user"></span>`}
                </div>
                <h4 class="text-lg font-extrabold text-gray-800 mb-1">${m.name}</h4>
                <span class="inline-block bg-emerald-100 text-emerald-700 text-xs font-bold px-3 py-1 rounded-full">${m.period}</span>
            </div>`).join('');

        const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>رؤساء المجلس الشعبي البلدي — بلدية شطايبي</title>
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
        <div class="max-w-7xl mx-auto px-4 flex items-center justify-center gap-4">
            <div class="w-16 h-16 rounded-full overflow-hidden shadow-lg flex-shrink-0">
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
    <main class="max-w-5xl mx-auto px-4 py-16">
        <div class="text-center mb-12">
            <span class="inline-block bg-emerald-100 text-emerald-700 text-xs font-bold px-4 py-1.5 rounded-full mb-4">🏛️ تاريخ القيادة</span>
            <h2 class="text-3xl md:text-4xl font-extrabold text-gray-900 mb-3">رؤساء المجلس الشعبي البلدي</h2>
            <p class="text-gray-500 max-w-xl mx-auto">قائمة الرؤساء الذين تعاقبوا على رئاسة المجلس الشعبي البلدي لشطايبي</p>
        </div>

        ${mayors.length === 0
            ? '<div class="text-center py-16 text-gray-400"><span class="iconify text-6xl block mb-4" data-icon="lucide:users"></span><p>لا توجد بيانات بعد</p></div>'
            : `
            ${currentCardHtml}
            ${pastMayors.length > 0 ? `
            <div class="mb-8">
                <h3 class="text-xl font-extrabold text-gray-700 mb-6 flex items-center gap-2">
                    <span class="iconify text-emerald-500" data-icon="lucide:history"></span>
                    الرؤساء السابقون
                </h3>
                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">${pastCardsHtml}</div>
            </div>` : ''}
            `
        }
    </main>
    <footer class="bg-gray-900 text-white py-8">
        <div class="max-w-7xl mx-auto px-4 text-center">
            <p class="text-xs text-gray-500">© <span id="yr"></span> بلدية شطايبي — جميع الحقوق محفوظة</p>
        </div>
    </footer>
    <script>document.getElementById('yr').textContent=new Date().getFullYear()<\/script>
</body>
</html>`;

        return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    } catch (e) {
        return new Response('حدث خطأ: ' + e.message, { status: 500 });
    }
}
