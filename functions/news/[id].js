export async function onRequestGet(context) {
    const { env, params } = context;
    const id = params.id;

    try {
        const news = await env.DB.prepare('SELECT * FROM news WHERE id = ?').bind(id).first();
        if (!news) return new Response('Ø§Ù„Ø®Ø¨Ø± ØºÙŠØ± Ù…ÙˆØ¬ÙˆØ¯', { status: 404 });

        const categoryMap = {
            official: { label: 'Ø¥Ø¹Ù„Ø§Ù† Ø±Ø³Ù…ÙŠ', color: 'red', bg: 'bg-red-100 text-red-700' },
            activity: { label: 'Ù†Ø´Ø§Ø· Ø¨Ù„Ø¯ÙŠ', color: 'emerald', bg: 'bg-emerald-100 text-emerald-700' },
            social: { label: 'Ø±ÙƒÙ† Ø§Ù„Ù…Ø¬ØªÙ…Ø¹', color: 'purple', bg: 'bg-purple-100 text-purple-700' },
        };
        const cat = categoryMap[news.category] || categoryMap.official;

        const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${news.title} â€” Ø¨Ù„Ø¯ÙŠØ© Ø´Ø·Ø§ÙŠØ¨ÙŠ</title>
    <script src="https://cdn.tailwindcss.com"><\/script>
    <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
    <script src="https://code.iconify.design/3/3.1.0/iconify.min.js"><\/script>
    <style>*{font-family:'Cairo',sans-serif;}::-webkit-scrollbar{width:8px}::-webkit-scrollbar-track{background:#f1f5f9}::-webkit-scrollbar-thumb{background:#059669;border-radius:4px}</style>
</head>
<body class="bg-gray-50 text-gray-800">
    <header class="bg-gradient-to-l from-emerald-800 via-emerald-700 to-emerald-900 text-white py-3">
        <div class="max-w-7xl mx-auto px-4 flex items-center justify-center gap-4">
            <span class="text-2xl">ðŸ‡©ðŸ‡¿</span>
            <h1 class="text-sm md:text-lg font-bold tracking-wide">Ø§Ù„Ø¬Ù…Ù‡ÙˆØ±ÙŠØ© Ø§Ù„Ø¬Ø²Ø§Ø¦Ø±ÙŠØ© Ø§Ù„Ø¯ÙŠÙ…Ù‚Ø±Ø§Ø·ÙŠØ© Ø§Ù„Ø´Ø¹Ø¨ÙŠØ©</h1>
            <span class="text-2xl">ðŸ‡©ðŸ‡¿</span>
        </div>
    </header>
    <div class="bg-white border-b border-emerald-100 py-4 shadow-sm">
        <div class="max-w-7xl mx-auto px-4 flex items-center justify-center gap-4">
            <div class="w-14 h-14 rounded-full overflow-hidden border-4 border-emerald-600 shadow-lg flex-shrink-0">
                <img src="https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEhsuqarYy0w18IFNzodUCI9s5mzSJ6lpMF7gaPC-_Z6oSkS0-OCkQVFukxyFLliwuTNa03h2Qs-ZnzPAJZOsKw1vfFQGGNSXdi370duVtU1oo2H6dJ69Nnx8XgcrFRX8NgZWmf5usi_AHDwCD4BW-Nz1BNnD2OPTCQAQRvqk_iGt3tjrig/s1600/1000085786.png" alt="Ø´Ø¹Ø§Ø±" class="w-full h-full object-cover">
            </div>
            <div class="text-center">
                <h2 class="text-xl font-extrabold text-emerald-800">Ø¨Ù„Ø¯ÙŠØ© Ø´Ø·Ø§ÙŠØ¨ÙŠ</h2>
                <p class="text-xs text-emerald-600 font-medium">ÙˆÙ„Ø§ÙŠØ© Ø¹Ù†Ø§Ø¨Ø© - Ø§Ù„Ø¬Ø²Ø§Ø¦Ø±</p>
            </div>
        </div>
    </div>
    <nav class="bg-emerald-700 shadow-lg">
        <div class="max-w-7xl mx-auto px-4 h-12 flex items-center">
            <a href="/" class="text-white/90 hover:text-white text-sm font-semibold flex items-center gap-1">
                <span class="iconify" data-icon="lucide:arrow-right"></span> Ø§Ù„Ø¹ÙˆØ¯Ø© Ù„Ù„Ø±Ø¦ÙŠØ³ÙŠØ©
            </a>
        </div>
    </nav>
    <main class="max-w-4xl mx-auto px-4 py-12">
        <a href="/#news" class="inline-flex items-center gap-2 text-emerald-600 font-bold text-sm mb-8 hover:text-emerald-700">
            <span class="iconify" data-icon="lucide:arrow-right"></span> Ø§Ù„Ø¹ÙˆØ¯Ø© Ù„Ù„Ø£Ø®Ø¨Ø§Ø±
        </a>
        <article class="bg-white rounded-2xl shadow-lg overflow-hidden border border-gray-100">
            ${news.image_url ? `<img src="${news.image_url}" alt="${news.title}" class="w-full h-64 md:h-96 object-cover">` : `
            <div class="h-48 bg-gradient-to-bl from-emerald-500 to-emerald-700 flex items-center justify-center">
                <span class="iconify text-white text-7xl" data-icon="lucide:newspaper"></span>
            </div>`}
            <div class="p-6 md:p-10">
                <div class="flex items-center gap-3 mb-4">
                    <span class="inline-block ${cat.bg} text-xs font-bold px-3 py-1 rounded-full">${cat.label}</span>
                    <span class="text-xs text-gray-400 flex items-center gap-1">
                        <span class="iconify" data-icon="lucide:calendar"></span> ${news.date}
                    </span>
                </div>
                <h1 class="text-2xl md:text-4xl font-extrabold text-gray-900 mb-6 leading-tight">${news.title}</h1>
                <div class="prose prose-lg text-gray-600 leading-loose text-base md:text-lg whitespace-pre-wrap">${news.content}</div>
            </div>
        </article>
    </main>
    <footer class="bg-gray-900 text-white py-8">
        <div class="max-w-7xl mx-auto px-4 text-center">
            <p class="text-xs text-gray-500">Â© 2025 Ø¨Ù„Ø¯ÙŠØ© Ø´Ø·Ø§ÙŠØ¨ÙŠ â€” ÙˆÙ„Ø§ÙŠØ© Ø¹Ù†Ø§Ø¨Ø© â€” Ø§Ù„Ø¬Ù…Ù‡ÙˆØ±ÙŠØ© Ø§Ù„Ø¬Ø²Ø§Ø¦Ø±ÙŠØ© Ø§Ù„Ø¯ÙŠÙ…Ù‚Ø±Ø§Ø·ÙŠØ© Ø§Ù„Ø´Ø¹Ø¨ÙŠØ© ðŸ‡©ðŸ‡¿</p>
        </div>
    </footer>
</body>
</html>`;
        return new Response(html, {
            headers: { 'Content-Type': 'text/html;charset=utf-8' },
        });
    } catch (e) {
        return new Response('Ø­Ø¯Ø« Ø®Ø·Ø£: ' + e.message, { status: 500 });
    }
}
