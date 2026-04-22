// functions/api/media.js
import { withAuth, createResponse, handleOptions } from './_utils.js';

const GITHUB_API = 'https://api.github.com';
const CDN_BASE   = 'https://cdn.jsdelivr.net/gh';

function buildCdnUrl(username, repo, folder, filename) {
    const p = folder ? folder.replace(/^\/|\/$/g, '') + '/' : '';
    return `${CDN_BASE}/${username}/${repo}@main/${p}${filename}`;
}

function sanitizeFilename(original) {
    const base = original.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_\-]/g, '-').replace(/-+/g, '-').toLowerCase().slice(0, 80);
    return `${base}-${Date.now()}.webp`;
}

export async function onRequestOptions() { return handleOptions(); }

export async function onRequestGet(context) {
    const url    = new URL(context.request.url);
    const action = url.searchParams.get('action') || 'repo-size';
    const { GITHUB_TOKEN, GITHUB_USERNAME, CURRENT_REPO } = context.env;

    if (!GITHUB_TOKEN || !GITHUB_USERNAME || !CURRENT_REPO)
        return createResponse({ success: false, error: 'متغيرات البيئة ناقصة (GITHUB_TOKEN, GITHUB_USERNAME, CURRENT_REPO)' }, 500);

    const ghHeaders = {
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'Chetaibi-Municipality'
    };

    if (action === 'repo-size') {
        try {
            const res  = await fetch(`${GITHUB_API}/repos/${GITHUB_USERNAME}/${CURRENT_REPO}`, { headers: ghHeaders });
            if (!res.ok) { const e = await res.json().catch(()=>{}); return createResponse({ success: false, error: `GitHub ${res.status}: ${e?.message||''}` }, res.status); }
            const data    = await res.json();
            const sizeKB  = data.size || 0;
            const sizeMB  = parseFloat((sizeKB / 1024).toFixed(2));
            const pct     = parseFloat(((sizeMB / 1000) * 100).toFixed(1));
            const warning = sizeMB >= 800;
            const critical= sizeMB >= 950;
            return createResponse({ success: true, data: { repo: CURRENT_REPO, username: GITHUB_USERNAME, size_kb: sizeKB, size_mb: sizeMB, percentage: pct, max_mb: 1000, warn_mb: 800, warning, critical, message: critical ? `⛔ تجاوزت 95%! أنشئ مستودعاً جديداً` : warning ? `⚠️ اقتربت من الحد. فكّر في مستودع جديد.` : `✅ المساحة كافية (${sizeMB} MB)` } });
        } catch (e) { return createResponse({ success: false, error: e.message }, 500); }
    }

    if (action === 'list') {
        const auth = await withAuth(context); if (auth) return auth;
        const folder = url.searchParams.get('folder') || '';
        try {
            const path = folder ? `contents/${folder}` : 'contents';
            const res  = await fetch(`${GITHUB_API}/repos/${GITHUB_USERNAME}/${CURRENT_REPO}/${path}`, { headers: ghHeaders });
            if (!res.ok) return createResponse({ success: false, error: `GitHub ${res.status}` }, res.status);
            const items = await res.json();
            const files = (Array.isArray(items) ? items : []).filter(i => i.type === 'file').map(i => ({ name: i.name, path: i.path, size: i.size, cdn_url: buildCdnUrl(GITHUB_USERNAME, CURRENT_REPO, folder, i.name), sha: i.sha }));
            return createResponse({ success: true, data: files, folder, repo: CURRENT_REPO });
        } catch (e) { return createResponse({ success: false, error: e.message }, 500); }
    }

    return createResponse({ success: false, error: 'action غير معروف' }, 400);
}

export async function onRequestPost(context) {
    const auth = await withAuth(context); if (auth) return auth;
    const { GITHUB_TOKEN, GITHUB_USERNAME, CURRENT_REPO } = context.env;
    if (!GITHUB_TOKEN || !GITHUB_USERNAME || !CURRENT_REPO)
        return createResponse({ success: false, error: 'متغيرات البيئة ناقصة' }, 500);

    let body;
    try { body = await context.request.json(); } catch { return createResponse({ success: false, error: 'JSON غير صالح' }, 400); }

    const { filename, folder, data: base64Data } = body;
    if (!filename || !base64Data) return createResponse({ success: false, error: 'filename و data مطلوبان' }, 400);

    const safeFilename = sanitizeFilename(filename);
    const folderClean  = folder ? folder.replace(/^\/|\/$/g, '') : '';
    const filePath     = folderClean ? `${folderClean}/${safeFilename}` : safeFilename;

    const ghHeaders = {
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'Chetaibi-Municipality'
    };

    try {
        let existingSha = null;
        const checkRes = await fetch(`${GITHUB_API}/repos/${GITHUB_USERNAME}/${CURRENT_REPO}/contents/${filePath}`, { headers: ghHeaders });
        if (checkRes.ok) { const ex = await checkRes.json(); existingSha = ex.sha; }

        const uploadBody = { message: `upload ${safeFilename}`, content: base64Data, branch: 'main' };
        if (existingSha) uploadBody.sha = existingSha;

        const uploadRes = await fetch(`${GITHUB_API}/repos/${GITHUB_USERNAME}/${CURRENT_REPO}/contents/${filePath}`, { method: 'PUT', headers: ghHeaders, body: JSON.stringify(uploadBody) });
        if (!uploadRes.ok) { const err = await uploadRes.json().catch(()=>{}); return createResponse({ success: false, error: `GitHub ${uploadRes.status}: ${err?.message||''}` }, uploadRes.status); }

        const cdn_url = buildCdnUrl(GITHUB_USERNAME, CURRENT_REPO, folderClean, safeFilename);
        return createResponse({ success: true, data: { filename: safeFilename, path: filePath, folder: folderClean, cdn_url, repo: CURRENT_REPO } }, existingSha ? 200 : 201);
    } catch (e) { return createResponse({ success: false, error: e.message }, 500); }
}

export async function onRequestDelete(context) {
    const auth = await withAuth(context); if (auth) return auth;
    const { GITHUB_TOKEN, GITHUB_USERNAME, CURRENT_REPO } = context.env;
    const url      = new URL(context.request.url);
    const filePath = url.searchParams.get('path');
    const sha      = url.searchParams.get('sha');
    if (!filePath || !sha) return createResponse({ success: false, error: 'path و sha مطلوبان' }, 400);
    try {
        const res = await fetch(`${GITHUB_API}/repos/${GITHUB_USERNAME}/${CURRENT_REPO}/contents/${filePath}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${GITHUB_TOKEN}`, 'Accept': 'application/vnd.github+json', 'Content-Type': 'application/json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'Chetaibi-Municipality' },
            body: JSON.stringify({ message: `delete ${filePath}`, sha, branch: 'main' })
        });
        if (!res.ok) { const err = await res.json().catch(()=>{}); return createResponse({ success: false, error: `GitHub ${res.status}: ${err?.message||''}` }, res.status); }
        return createResponse({ success: true, deleted: filePath });
    } catch (e) { return createResponse({ success: false, error: e.message }, 500); }
}
