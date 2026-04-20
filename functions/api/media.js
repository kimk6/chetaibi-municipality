/**
 * ============================================================
 *  Media Manager — Cloudflare Pages Function
 *  ملف: functions/api/media.js
 *
 *  المتغيرات المطلوبة في Cloudflare Dashboard → Settings → Variables:
 *    GITHUB_TOKEN     — Personal Access Token (PAT)
 *    GITHUB_USERNAME  — مثال: kimk6
 *    CURRENT_REPO     — مثال: chetaibi-assets-v1
 *    ADMIN_USERNAME   — اسم مستخدم لوحة التحكم
 *    JWT_SECRET       — مفتاح التوقيع
 * ============================================================
 */

import { withAuth, createResponse, handleOptions } from './_utils.js';

// ─── ثوابت مشتركة ────────────────────────────────────────────
const GITHUB_API   = 'https://api.github.com';
const CDN_BASE     = 'https://cdn.jsdelivr.net/gh';
const REPO_MAX_MB  = 1000;   // الحد الأقصى المقبول (1 GB)
const WARN_MB      = 800;    // حد التحذير (800 MB)

// ─── دالة مساعدة: بناء رابط CDN ─────────────────────────────
function buildCdnUrl(username, repo, folder, filename) {
    const folderPath = folder ? `${folder.replace(/^\/|\/$/g, '')}/` : '';
    return `${CDN_BASE}/${username}/${repo}@main/${folderPath}${filename}`;
}

// ─── دالة مساعدة: تحويل اسم الملف إلى webp آمن ──────────────
function sanitizeFilename(original) {
    const base = original
        .replace(/\.[^/.]+$/, '')           // حذف الامتداد
        .replace(/[^a-zA-Z0-9_\-]/g, '-')  // استبدال الرموز بـ -
        .replace(/-+/g, '-')               // تجميع الشرطات
        .toLowerCase()
        .slice(0, 80);                      // حد أقصى للطول
    const ts = Date.now();
    return `${base}-${ts}.webp`;
}

// ─── CORS preflight ───────────────────────────────────────────
export async function onRequestOptions() {
    return handleOptions();
}

// ═══════════════════════════════════════════════════════════════
//  GET /api/media?action=repo-size
//  GET /api/media?action=list&folder=news
// ═══════════════════════════════════════════════════════════════
export async function onRequestGet(context) {
    const { env, request } = context;
    const url    = new URL(request.url);
    const action = url.searchParams.get('action') || 'repo-size';

    // جلب حجم المستودع
    if (action === 'repo-size') {
        try {
            const { GITHUB_TOKEN, GITHUB_USERNAME, CURRENT_REPO } = env;
            if (!GITHUB_TOKEN || !GITHUB_USERNAME || !CURRENT_REPO) {
                return createResponse({
                    success: false,
                    error: 'متغيرات البيئة غير مكتملة (GITHUB_TOKEN, GITHUB_USERNAME, CURRENT_REPO)'
                }, 500);
            }

            const res = await fetch(
                `${GITHUB_API}/repos/${GITHUB_USERNAME}/${CURRENT_REPO}`,
                {
                    headers: {
                        'Authorization': `Bearer ${GITHUB_TOKEN}`,
                        'Accept': 'application/vnd.github+json',
                        'X-GitHub-Api-Version': '2022-11-28',
                        'User-Agent': 'Chetaibi-Municipality'
                    }
                }
            );

            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                return createResponse({
                    success: false,
                    error: `GitHub API Error ${res.status}: ${err.message || 'Unknown'}`
                }, res.status);
            }

            const data     = await res.json();
            const sizeKB   = data.size || 0;
            const sizeMB   = parseFloat((sizeKB / 1024).toFixed(2));
            const pct      = parseFloat(((sizeMB / REPO_MAX_MB) * 100).toFixed(1));
            const warning  = sizeMB >= WARN_MB;
            const critical = sizeMB >= REPO_MAX_MB * 0.95;

            return createResponse({
                success: true,
                data: {
                    repo:        CURRENT_REPO,
                    username:    GITHUB_USERNAME,
                    size_kb:     sizeKB,
                    size_mb:     sizeMB,
                    percentage:  pct,
                    max_mb:      REPO_MAX_MB,
                    warn_mb:     WARN_MB,
                    warning,
                    critical,
                    message: critical
                        ? `⛔ تجاوزت 95% من سعة المستودع. أنشئ ${CURRENT_REPO.replace(/v\d+$/, '')}v${parseInt(CURRENT_REPO.match(/\d+$/)?.[0] || 1) + 1} فوراً!`
                        : warning
                        ? `⚠️ اقتربت من الحد الأقصى. فكّر في إنشاء مستودع جديد قريباً.`
                        : `✅ المساحة كافية (${sizeMB} MB من ${REPO_MAX_MB} MB)`
                }
            });
        } catch (e) {
            return createResponse({ success: false, error: e.message }, 500);
        }
    }

    // جلب قائمة ملفات مجلد
    if (action === 'list') {
        const auth = await withAuth(context);
        if (auth) return auth;

        const folder = url.searchParams.get('folder') || '';
        const { GITHUB_TOKEN, GITHUB_USERNAME, CURRENT_REPO } = env;

        try {
            const path = folder ? `contents/${folder}` : 'contents';
            const res  = await fetch(
                `${GITHUB_API}/repos/${GITHUB_USERNAME}/${CURRENT_REPO}/${path}`,
                {
                    headers: {
                        'Authorization': `Bearer ${GITHUB_TOKEN}`,
                        'Accept': 'application/vnd.github+json',
                        'X-GitHub-Api-Version': '2022-11-28',
                        'User-Agent': 'Chetaibi-Municipality'
                    }
                }
            );

            if (!res.ok) {
                return createResponse({ success: false, error: `GitHub ${res.status}` }, res.status);
            }

            const items = await res.json();
            const files = (Array.isArray(items) ? items : [])
                .filter(i => i.type === 'file')
                .map(i => ({
                    name:    i.name,
                    path:    i.path,
                    size:    i.size,
                    cdn_url: buildCdnUrl(GITHUB_USERNAME, CURRENT_REPO, folder, i.name),
                    sha:     i.sha
                }));

            return createResponse({ success: true, data: files, folder, repo: CURRENT_REPO });
        } catch (e) {
            return createResponse({ success: false, error: e.message }, 500);
        }
    }

    return createResponse({ success: false, error: 'action غير معروف' }, 400);
}

// ═══════════════════════════════════════════════════════════════
//  POST /api/media
//  Body (JSON):
//    {
//      "filename": "photo.jpg",   // الاسم الأصلي
//      "folder":   "news",        // المجلد المستهدف
//      "data":     "<base64>",    // محتوى الملف base64 (بدون data URI prefix)
//      "mime":     "image/jpeg"   // نوع الملف
//    }
// ═══════════════════════════════════════════════════════════════
export async function onRequestPost(context) {
    // التحقق من المصادقة أولاً
    const auth = await withAuth(context);
    if (auth) return auth;

    const { env } = context;
    const { GITHUB_TOKEN, GITHUB_USERNAME, CURRENT_REPO } = env;

    if (!GITHUB_TOKEN || !GITHUB_USERNAME || !CURRENT_REPO) {
        return createResponse({
            success: false,
            error: 'متغيرات البيئة غير مكتملة'
        }, 500);
    }

    let body;
    try {
        body = await context.request.json();
    } catch {
        return createResponse({ success: false, error: 'JSON غير صالح' }, 400);
    }

    const { filename, folder, data: base64Data, mime } = body;

    if (!filename || !base64Data) {
        return createResponse({ success: false, error: 'filename و data مطلوبان' }, 400);
    }

    // تعقيم اسم الملف
    const safeFilename = sanitizeFilename(filename);
    const folderClean  = folder ? folder.replace(/^\/|\/$/g, '') : '';
    const filePath     = folderClean ? `${folderClean}/${safeFilename}` : safeFilename;

    try {
        // التحقق من وجود الملف مسبقاً (للحصول على SHA في حالة التحديث)
        let existingSha = null;
        const checkRes = await fetch(
            `${GITHUB_API}/repos/${GITHUB_USERNAME}/${CURRENT_REPO}/contents/${filePath}`,
            {
                headers: {
                    'Authorization': `Bearer ${GITHUB_TOKEN}`,
                    'Accept': 'application/vnd.github+json',
                    'X-GitHub-Api-Version': '2022-11-28',
                    'User-Agent': 'Chetaibi-Municipality'
                }
            }
        );
        if (checkRes.ok) {
            const existing = await checkRes.json();
            existingSha = existing.sha;
        }

        // رفع الملف
        const uploadBody = {
            message: `feat(media): upload ${safeFilename} via Municipality Dashboard`,
            content: base64Data,  // GitHub يتوقع base64 نقي
            branch: 'main'
        };
        if (existingSha) uploadBody.sha = existingSha;

        const uploadRes = await fetch(
            `${GITHUB_API}/repos/${GITHUB_USERNAME}/${CURRENT_REPO}/contents/${filePath}`,
            {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${GITHUB_TOKEN}`,
                    'Accept': 'application/vnd.github+json',
                    'Content-Type': 'application/json',
                    'X-GitHub-Api-Version': '2022-11-28',
                    'User-Agent': 'Chetaibi-Municipality'
                },
                body: JSON.stringify(uploadBody)
            }
        );

        if (!uploadRes.ok) {
            const errData = await uploadRes.json().catch(() => ({}));
            return createResponse({
                success: false,
                error: `GitHub Upload Error ${uploadRes.status}: ${errData.message || 'Unknown'}`
            }, uploadRes.status);
        }

        const uploadData = await uploadRes.json();
        const cdn_url    = buildCdnUrl(GITHUB_USERNAME, CURRENT_REPO, folderClean, safeFilename);

        return createResponse({
            success: true,
            data: {
                filename:   safeFilename,
                path:       filePath,
                folder:     folderClean,
                cdn_url,
                repo:       CURRENT_REPO,
                username:   GITHUB_USERNAME,
                sha:        uploadData.content?.sha,
                commit:     uploadData.commit?.html_url
            }
        }, existingSha ? 200 : 201);

    } catch (e) {
        return createResponse({ success: false, error: e.message }, 500);
    }
}

// ═══════════════════════════════════════════════════════════════
//  DELETE /api/media?path=news/image.webp&sha=abc123
// ═══════════════════════════════════════════════════════════════
export async function onRequestDelete(context) {
    const auth = await withAuth(context);
    if (auth) return auth;

    const { env, request } = context;
    const { GITHUB_TOKEN, GITHUB_USERNAME, CURRENT_REPO } = env;
    const url      = new URL(request.url);
    const filePath = url.searchParams.get('path');
    const sha      = url.searchParams.get('sha');

    if (!filePath || !sha) {
        return createResponse({ success: false, error: 'path و sha مطلوبان' }, 400);
    }

    try {
        const res = await fetch(
            `${GITHUB_API}/repos/${GITHUB_USERNAME}/${CURRENT_REPO}/contents/${filePath}`,
            {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${GITHUB_TOKEN}`,
                    'Accept': 'application/vnd.github+json',
                    'Content-Type': 'application/json',
                    'X-GitHub-Api-Version': '2022-11-28',
                    'User-Agent': 'Chetaibi-Municipality'
                },
                body: JSON.stringify({
                    message: `chore(media): delete ${filePath} via Municipality Dashboard`,
                    sha,
                    branch: 'main'
                })
            }
        );

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            return createResponse({
                success: false,
                error: `GitHub Delete Error ${res.status}: ${err.message || 'Unknown'}`
            }, res.status);
        }

        return createResponse({ success: true, deleted: filePath });
    } catch (e) {
        return createResponse({ success: false, error: e.message }, 500);
    }
}
