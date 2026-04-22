// functions/beaches.js — صفحة /beaches
export async function onRequestGet(context) {
    const { env } = context;
    try {
        const { results: beaches } = await env.DB.prepare('SELECT * FROM beaches ORDER BY id').all();

        const cardsHtml = beaches.map(b => {
            let albums = [];
            try { albums = JSON.parse(b.album_urls || '[]'); } catch(e) {}
            const albumBtn = albums.length > 0
                ? `<button onclick="openBeachModal(${b.id})" class="mt-3 w-full py-2 bg-sky-50 hover:bg-sky-100 text-sky-700 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1 border border-sky-200">
                       <span class="iconify" data-icon="lucide:images"></span> معرض الصور (${albums.length})
                   </button>`
                : '';
            return `
            <div class="beach-card bg-white rounded-2xl overflow-hidden shadow-lg border border-sky-100 hover:shadow-2xl transition-shadow group" data-id="${b.id}" data-albums='${JSON.stringify(albums)}' data-name="${b.name}" data-desc="${(b.description||'').replace(/"/g,'&quot;')}">
                ${b.image_url
                    ? `<div class="relative h-52 overflow-hidden cursor-pointer" onclick="openBeachModal(${b.id})">
                           <img src="${b.image_url}" alt="${b.name}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500">
                           <div class="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent"></div>
                           <div class="absolute bottom-3 right-4 text-white">
                               <h3 class="text-xl font-extrabold drop-shadow">${b.name}</h3>
                           </div>
                           ${b.is_supervised ? `<span class="absolute top-3 left-3 bg-green-500 text-white text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1 shadow"><span class="iconify" data-icon="lucide:shield-check"></span> مراقب رسمياً</span>` : ''}
                       </div>`
                    : `<div class="h-36 bg-gradient-to-bl from-sky-400 to-blue-600 flex items-center justify-center relative cursor-pointer" onclick="openBeachModal(${b.id})">
                           <span class="iconify text-white text-6xl opacity-60" data-icon="lucide:waves"></span>
                           ${b.is_supervised ? `<span class="absolute top-3 left-3 bg-green-500 text-white text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1"><span class="iconify" data-icon="lucide:shield-check"></span> مراقب</span>` : ''}
                           <div class="absolute bottom-3 right-4 text-white"><h3 class="text-xl font-extrabold drop-shadow">${b.name}</h3></div>
                       </div>`
                }
                <div class="p-5">
                    ${b.image_url ? `<h3 class="text-lg font-extrabold text-gray-800 mb-2 cursor-pointer hover:text-sky-700" onclick="openBeachModal(${b.id})">${b.name}</h3>` : ''}
                    <p class="text-sm text-gray-600 leading-relaxed mb-3">${b.description || 'شاطئ مرخص ومراقب رسمياً للسباحة الآمنة.'}</p>
                    <div class="flex flex-wrap gap-2">
                        ${b.is_supervised ? `<span class="text-xs bg-green-100 text-green-700 px-3 py-1 rounded-full font-bold flex items-center gap-1"><span class="iconify" data-icon="lucide:shield-check"></span> سباحة مراقبة</span>` : ''}
                        <span class="text-xs bg-sky-100 text-sky-700 px-3 py-1 rounded-full font-bold flex items-center gap-1"><span class="iconify" data-icon="lucide:sun"></span> ${b.season || 'صيف'}</span>
                    </div>
                    ${albumBtn}
                </div>
            </div>`;
        }).join('');

        const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>شواطئ السباحة المرخصة — بلدية شطايبي</title>
    <link rel="icon" type="image/png" href="https://cdn.jsdelivr.net/gh/kimk6/chetaibi-assets-v1@main/ui/favicon.png">
    <script src="https://cdn.tailwindcss.com"><\/script>
    <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
    <script src="https://code.iconify.design/3/3.1.0/iconify.min.js"><\/script>
    <style>
        * { font-family: 'Cairo', sans-serif; }
        ::-webkit-scrollbar { width: 8px; }
        ::-webkit-scrollbar-thumb { background: #0284c7; border-radius: 4px; }
        .pattern-bg { background-image: url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%230284c7' fill-opacity='0.04'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E"); }
        #beach-modal { backdrop-filter: blur(4px); }
    </style>
</head>
<body class="bg-sky-50 text-gray-800">

    <header class="bg-gradient-to-l from-emerald-800 via-emerald-700 to-emerald-900 text-white py-2 text-center">
        <h1 class="text-sm font-bold">الجمهورية الجزائرية الديمقراطية الشعبية</h1>
        <p class="text-[10px] text-emerald-200">وزارة الداخلية والجماعات المحلية والتهيئة العمرانية</p>
    </header>

    <div class="bg-white border-b border-sky-100 py-4 shadow-sm">
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

    <nav class="bg-sky-700 shadow-lg">
        <div class="max-w-7xl mx-auto px-4 h-12 flex items-center">
            <a href="/" class="text-white/90 hover:text-white text-sm font-semibold flex items-center gap-1">
                <span class="iconify" data-icon="lucide:arrow-right"></span> العودة للرئيسية
            </a>
        </div>
    </nav>

    <div class="bg-gradient-to-bl from-sky-600 via-blue-600 to-sky-800 text-white py-16 pattern-bg">
        <div class="max-w-7xl mx-auto px-4 text-center">
            <span class="inline-block bg-white/15 backdrop-blur-sm text-sm px-5 py-2 rounded-full mb-5 border border-white/20">
                <span class="iconify inline-block ml-1" data-icon="lucide:shield-check"></span>
                معتمد رسمياً — موسم الاصطياف
            </span>
            <h2 class="text-4xl md:text-5xl font-extrabold mb-4">الشواطئ المرخصة للسباحة</h2>
            <p class="text-xl text-sky-100 max-w-2xl mx-auto mb-8">قائمة الشواطئ المراقبة رسمياً والمرخصة للسباحة الآمنة في بلدية شطايبي</p>
            <div class="inline-flex items-center gap-6 bg-white/15 backdrop-blur-sm rounded-2xl px-8 py-4 border border-white/20">
                <div class="text-center"><p class="text-3xl font-extrabold">${beaches.length}</p><p class="text-sky-200 text-xs font-semibold mt-0.5">شاطئ مرخص</p></div>
                <div class="w-px h-10 bg-white/20"></div>
                <div class="text-center"><p class="text-3xl font-extrabold">${beaches.filter(b => b.is_supervised).length}</p><p class="text-sky-200 text-xs font-semibold mt-0.5">مراقب رسمياً</p></div>
                <div class="w-px h-10 bg-white/20"></div>
                <div class="text-center"><p class="text-2xl font-extrabold">🏊</p><p class="text-sky-200 text-xs font-semibold mt-0.5">سباحة آمنة</p></div>
            </div>
        </div>
    </div>

    <div class="max-w-4xl mx-auto px-4 mt-8">
        <div class="bg-amber-50 border border-amber-200 rounded-2xl p-5 flex items-start gap-4">
            <div class="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <span class="iconify text-amber-600 text-xl" data-icon="lucide:alert-triangle"></span>
            </div>
            <div>
                <h4 class="font-extrabold text-amber-800 mb-1">تنبيه السلامة</h4>
                <p class="text-sm text-amber-700 leading-relaxed">يُسمح بالسباحة في الأوقات والمواسم المحددة فقط. يُمنع السباحة عند اشتداد الرياح أو ارتفاع الأمواج. الرجاء الالتزام بتعليمات المراقبين الرسميين.</p>
            </div>
        </div>
    </div>

    <main class="max-w-7xl mx-auto px-4 py-12">
        ${beaches.length
            ? `<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">${cardsHtml}</div>`
            : `<div class="text-center py-20 text-gray-400"><span class="iconify text-6xl block mb-4" data-icon="lucide:waves"></span><p class="text-lg font-semibold">لا توجد شواطئ مضافة بعد</p></div>`
        }
    </main>

    <!-- Modal -->
    <div id="beach-modal" class="fixed inset-0 bg-black/70 z-50 hidden items-center justify-center p-4" onclick="closeBeachModal(event)">
        <div class="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl" onclick="event.stopPropagation()">
            <div class="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between rounded-t-3xl z-10">
                <h3 id="modal-title" class="text-xl font-extrabold text-gray-800"></h3>
                <button onclick="closeBeachModal()" class="w-8 h-8 bg-gray-100 hover:bg-gray-200 rounded-full flex items-center justify-center text-gray-600 font-bold">✕</button>
            </div>
            <div id="modal-body" class="p-6"></div>
        </div>
    </div>
    <!-- Lightbox -->
    <div id="lightbox" class="fixed inset-0 bg-black/90 z-[100] hidden items-center justify-center p-4" onclick="closeLightbox()">
        <img id="lightbox-img" src="" class="max-w-full max-h-[90vh] rounded-xl shadow-2xl">
        <button class="absolute top-4 right-4 text-white text-3xl font-bold bg-black/50 rounded-full w-10 h-10 flex items-center justify-center">✕</button>
    </div>

    <footer class="bg-gray-900 text-white py-8 mt-8">
        <div class="max-w-7xl mx-auto px-4 text-center">
            <p class="text-xs text-gray-500">© <span id="yr"></span> بلدية شطايبي — جميع الحقوق محفوظة 🇩🇿</p>
        </div>
    </footer>

<script>
document.getElementById('yr').textContent = new Date().getFullYear();

const beachesData = ${JSON.stringify(beaches.map(b => {
    let albums = [];
    try { albums = JSON.parse(b.album_urls || '[]'); } catch(e) {}
    return { id: b.id, name: b.name, description: b.description, image_url: b.image_url, is_supervised: b.is_supervised, season: b.season, albums };
}))};

function openBeachModal(id) {
    const b = beachesData.find(x => x.id === id);
    if (!b) return;
    document.getElementById('modal-title').textContent = b.name;
    let html = '';
    if (b.image_url) {
        html += '<img src="' + b.image_url + '" class="w-full h-56 object-cover rounded-2xl mb-4">';
    }
    html += '<div class="flex flex-wrap gap-2 mb-4">';
    if (b.is_supervised) html += '<span class="text-xs bg-green-100 text-green-700 px-3 py-1 rounded-full font-bold">✅ سباحة مراقبة</span>';
    html += '<span class="text-xs bg-sky-100 text-sky-700 px-3 py-1 rounded-full font-bold">☀️ ' + (b.season || 'صيف') + '</span>';
    html += '</div>';
    if (b.description) html += '<p class="text-sm text-gray-600 leading-relaxed mb-4">' + b.description + '</p>';
    if (b.albums && b.albums.length > 0) {
        html += '<h4 class="font-extrabold text-gray-700 mb-3 flex items-center gap-2"><span>🖼️</span> معرض الصور</h4>';
        html += '<div class="grid grid-cols-2 md:grid-cols-3 gap-3">';
        b.albums.forEach(u => {
            html += '<div class="rounded-xl overflow-hidden cursor-pointer shadow" onclick="openLightbox(\'' + u + '\')">';
            html += '<img src="' + u + '" class="w-full h-36 object-cover hover:scale-105 transition-transform duration-300">';
            html += '</div>';
        });
        html += '</div>';
    }
    document.getElementById('modal-body').innerHTML = html;
    const modal = document.getElementById('beach-modal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}
function closeBeachModal(e) {
    if (e && e.target !== document.getElementById('beach-modal')) return;
    document.getElementById('beach-modal').classList.add('hidden');
    document.getElementById('beach-modal').classList.remove('flex');
}
function openLightbox(src) {
    document.getElementById('lightbox-img').src = src;
    const lb = document.getElementById('lightbox');
    lb.classList.remove('hidden'); lb.classList.add('flex');
}
function closeLightbox() {
    const lb = document.getElementById('lightbox');
    lb.classList.add('hidden'); lb.classList.remove('flex');
}
<\/script>
</body>
</html>`;

        return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    } catch (e) {
        return new Response('حدث خطأ: ' + e.message, { status: 500, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    }
}
