// ═══════════════════════════════════════════════════════
// Worker: حذف ملف من GitHub
// المسار: /api/github-delete
// يُستدعى من لوحة التحكم بعد حذف السجل من قاعدة البيانات
// ═══════════════════════════════════════════════════════

export async function onRequestDelete(context) {
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
    };

    try {
        // التحقق من المصادقة
        const authHeader = context.request.headers.get('Authorization') || '';
        const token = authHeader.replace('Bearer ', '');
        if (!token) {
            return new Response(JSON.stringify({ success: false, error: 'غير مصرح' }), { status: 401, headers: corsHeaders });
        }

        // قراءة بيانات الطلب
        const body = await context.request.json();
        const { image_url } = body;

        if (!image_url || !image_url.includes('jsdelivr.net')) {
            // ليست صورة من GitHub — تجاهل بدون خطأ
            return new Response(JSON.stringify({ success: true, skipped: true }), { headers: corsHeaders });
        }

        // استخراج المسار من رابط jsDelivr
        // مثال: https://cdn.jsdelivr.net/gh/kimk6/chetaibi-assets-v1@main/news/abc.jpg
        // → owner: kimk6, repo: chetaibi-assets-v1, path: news/abc.jpg
        const match = image_url.match(/cdn\.jsdelivr\.net\/gh\/([^/]+)\/([^@]+)@[^/]+\/(.+)/);
        if (!match) {
            return new Response(JSON.stringify({ success: true, skipped: true, reason: 'رابط غير مدعوم' }), { headers: corsHeaders });
        }

        const owner = match[1];
        const repo  = match[2];
        const path  = match[3];

        // جلب الـ sha الحالي للملف (مطلوب من GitHub API للحذف)
        const GITHUB_TOKEN = context.env.GITHUB_TOKEN;
        if (!GITHUB_TOKEN) {
            return new Response(JSON.stringify({ success: false, error: 'GITHUB_TOKEN غير مُعرَّف' }), { status: 500, headers: corsHeaders });
        }

        const getUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
        const getRes = await fetch(getUrl, {
            headers: {
                'Authorization': `token ${GITHUB_TOKEN}`,
                'User-Agent':    'chetaibi-municipality',
                'Accept':        'application/vnd.github.v3+json',
            }
        });

        if (getRes.status === 404) {
            // الملف غير موجود أصلاً — نعتبره محذوفاً
            return new Response(JSON.stringify({ success: true, skipped: true, reason: 'الملف غير موجود في المستودع' }), { headers: corsHeaders });
        }

        if (!getRes.ok) {
            const err = await getRes.text();
            return new Response(JSON.stringify({ success: false, error: `GitHub API error: ${getRes.status}` }), { status: 500, headers: corsHeaders });
        }

        const fileData = await getRes.json();
        const sha = fileData.sha;

        // حذف الملف من GitHub
        const delRes = await fetch(getUrl, {
            method: 'DELETE',
            headers: {
                'Authorization': `token ${GITHUB_TOKEN}`,
                'User-Agent':    'chetaibi-municipality',
                'Accept':        'application/vnd.github.v3+json',
                'Content-Type':  'application/json',
            },
            body: JSON.stringify({
                message: `حذف صورة: ${path}`,
                sha:     sha,
            })
        });

        if (!delRes.ok) {
            const err = await delRes.text();
            return new Response(JSON.stringify({ success: false, error: `فشل حذف الملف: ${delRes.status}` }), { status: 500, headers: corsHeaders });
        }

        return new Response(JSON.stringify({ success: true, deleted: path }), { headers: corsHeaders });

    } catch (e) {
        return new Response(JSON.stringify({ success: false, error: e.message }), { status: 500, headers: corsHeaders });
    }
}

// دعم CORS preflight
export async function onRequestOptions() {
    return new Response(null, {
        headers: {
            'Access-Control-Allow-Origin':  '*',
            'Access-Control-Allow-Methods': 'DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        }
    });
}
