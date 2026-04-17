export async function onRequestGet(context) {
    const { env } = context;
    try {
        const result = await env.DB.prepare('SELECT * FROM mayors ORDER BY id DESC').all();
        const mayors = result.results;

        let cardsHtml = mayors.map(m => `
            <div class="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 text-center hover:shadow-xl transition-shadow">
                <div class="w-24 h-24 ${m.image_url ? '' : 'bg-emerald-100'} rounded-full mx-auto mb-4 overflow-hidden flex items-center justify-center border-4 border-emerald-200">
                    ${m.image_url
                        ? `<img src="${m.image_url}" alt="${m.name}" class="w-full h-full object-cover">`
                        : `<span class="iconify text-emerald-600 text-4xl" data-icon="lucide:user"></span>`}
                </div>
                <h4 class="text-lg font-extrabold text-gray-800 mb-1">${m.name}</h4>
                <span class="inline-block bg-emerald-100 text-emerald-700 text-xs font-bold px-3 py-1 rounded-full">${m.period}</span>
            </div>
        `).join('');

        const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>الرؤساء السابقون — بلدية شطايبي</title>
    <script src="https://cdn.tailwindcss.com"><\/script>
    <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
    <script src="https://code.iconify.design/3/3.1.0/iconify.min.js"><\/script>
    <style>*{font-family:'Cairo',sans-serif;}::-webkit-scrollbar{width:8px}::-webkit-scrollbar-track{background:#f1f5f9}::-webkit-scrollbar-thumb{background:#059669;border-radius:4px}</style>
</head>
<body class="bg-gray-50 text-gray-800 pattern-bg">
    <header class="bg-gradient-to-l from-emerald-800 via-emerald-700 to-emerald-900 text-white py-3">
        <div class="max-w-7xl mx-auto px-4 flex items-center justify-center gap-4">
            <span class="text-2xl">🇩🇿</span>
            <h1 class="text-sm md:text-lg font-bold tracking-wide">الجمهورية الجزائرية الديمقراطية الشعبية</h1>
            <span class="text-2xl">🇩🇿</span>
        </div>
    </header>
    <div class="bg-white border-b border-emerald-100 py-4 shadow-sm">
        <div class="max-w-7xl mx-auto px-4 flex items-center justify-center gap-4">
            <div class="w-14 h-14 rounded-full overflow-hidden border-4 border-emerald-600 shadow-lg flex-shrink-0">
                <img src="https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEhsuqarYy0w18IFNzodUCI9s5mzSJ6lpMF7gaPC-_Z6oSkS0-OCkQVFukxyFLliwuTNa03h2Qs-ZnzPAJZOsKw1vfFQGGNSXdi370duVtU1oo2H6dJ69Nnx8XgcrFRX8NgZWmf5usi_AHDwCD4BW-Nz1BNnD2OPTCQAQRvqk_iGt3tjrig/s1600/1000085786.png" alt="شعار" class="w-full h-full object-cover">
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
            <span class="inline-block bg-emerald-100 text-emerald-700 text-xs font-bold px-4 py-1.5 rounded-full mb-4 tracking-wide">🏛️ تاريخ القيادة</span>
            <h2 class="text-3xl md:text-4xl font-extrabold text-gray-900 mb-3">رؤساء المجلس الشعبي البلدي</h2>
            <p class="text-gray-500 max-w-xl mx-auto">قائمة الرؤساء الذين تعاقبوا على رئاسة المجلس الشعبي البلدي لشطايبي</p>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            ${cardsHtml}
        </div>
    </main>
    <footer class="bg-gray-900 text-white py-8">
        <div class="max-w-7xl mx-auto px-4 text-center">
            <p class="text-xs text-gray-500">© 2025 بلدية شطايبي — ولاية عنابة — الجمهورية الجزائرية الديمقراطية الشعبية 🇩🇿</p>
        </div>
    </footer>
    <style>.pattern-bg{background-image:url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23059669' fill-opacity='0.04'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")}</style>
</body>
</html>`;
        return new Response(html, {
            headers: { 'Content-Type': 'text/html;charset=utf-8' },
        });
    } catch (e) {
        return new Response('حدث خطأ: ' + e.message, { status: 500 });
    }
}
