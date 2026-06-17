// functions/api/media.js
// ══════════════════════════════════════════════════════
// إدارة الصور عبر GitHub API + jsDelivr CDN
// ══════════════════════════════════════════════════════
import { withAuth, ok, err, handleOptions, getParam } from './_utils.js';

const GH_API  = 'https://api.github.com';
const CDN     = 'https://cdn.jsdelivr.net/gh';

function ghHeaders(token) {
  return {
    'Authorization':        `Bearer ${token}`,
    'Accept':               'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent':           'chetaibi-municipality',
  };
}

function cdnUrl(user, repo, folder, filename) {
  const f = folder ? folder.replace(/^\/|\/$/g, '') + '/' : '';
  return `${CDN}/${user}/${repo}@main/${f}${filename}`;
}

function safeName(original) {
  const base = original
    .replace(/\.[^/.]+$/, '')
    .replace(/[^a-zA-Z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .toLowerCase()
    .slice(0, 80);
  return `${base}-${Date.now()}.webp`;
}

export async function onRequestOptions() { return handleOptions(); }

// GET /api/media?action=repo-size  — حجم المستودع
// GET /api/media?action=list&folder= — قائمة الملفات
export async function onRequestGet(context) {
  const { GITHUB_TOKEN, GITHUB_USERNAME, CURRENT_REPO } = context.env;
  if (!GITHUB_TOKEN || !GITHUB_USERNAME || !CURRENT_REPO)
    return err('متغيرات البيئة ناقصة', 500);

  const action = getParam(context, 'action') || 'repo-size';
  const hdrs   = ghHeaders(GITHUB_TOKEN);

  // ── حجم المستودع ────────────────────────────
  if (action === 'repo-size') {
    try {
      const res  = await fetch(`${GH_API}/repos/${GITHUB_USERNAME}/${CURRENT_REPO}`, { headers: hdrs });
      if (!res.ok) return err(`GitHub ${res.status}`, res.status);
      const data   = await res.json();
      const sizeMB = parseFloat((data.size / 1024).toFixed(2));
      return ok({
        data: {
          repo:       CURRENT_REPO,
          size_kb:    data.size,
          size_mb:    sizeMB,
          max_mb:     1000,
          percentage: parseFloat(((sizeMB / 1000) * 100).toFixed(1)),
          warning:    sizeMB >= 800,
          critical:   sizeMB >= 950,
        },
      });
    } catch (e) { return err(e.message, 500); }
  }

  // ── قائمة الملفات ────────────────────────────
  if (action === 'list') {
    const auth = await withAuth(context); if (auth) return auth;
    const folder = getParam(context, 'folder') || '';
    try {
      const path = folder ? `contents/${folder}` : 'contents';
      const res  = await fetch(`${GH_API}/repos/${GITHUB_USERNAME}/${CURRENT_REPO}/${path}`, { headers: hdrs });
      if (!res.ok) return err(`GitHub ${res.status}`, res.status);
      const items = await res.json();
      const files = (Array.isArray(items) ? items : [])
        .filter(i => i.type === 'file')
        .map(i => ({
          name:    i.name,
          path:    i.path,
          size:    i.size,
          sha:     i.sha,
          cdn_url: cdnUrl(GITHUB_USERNAME, CURRENT_REPO, folder, i.name),
        }));
      return ok({ data: files, folder });
    } catch (e) { return err(e.message, 500); }
  }

  return err('action غير معروف');
}

// POST /api/media — رفع صورة
export async function onRequestPost(context) {
  const auth = await withAuth(context); if (auth) return auth;
  const { GITHUB_TOKEN, GITHUB_USERNAME, CURRENT_REPO } = context.env;
  if (!GITHUB_TOKEN || !GITHUB_USERNAME || !CURRENT_REPO)
    return err('متغيرات البيئة ناقصة', 500);

  let body;
  try { body = await context.request.json(); }
  catch { return err('JSON غير صالح'); }

  const { filename, folder, data: base64 } = body;
  if (!filename || !base64) return err('filename و data مطلوبان');

  const name      = safeName(filename);
  const folderStr = folder ? folder.replace(/^\/|\/$/g, '') : '';
  const filePath  = folderStr ? `${folderStr}/${name}` : name;
  const hdrs      = { ...ghHeaders(GITHUB_TOKEN), 'Content-Type': 'application/json' };

  try {
    // تحقق من وجود الملف للحصول على sha
    let sha = null;
    const chk = await fetch(`${GH_API}/repos/${GITHUB_USERNAME}/${CURRENT_REPO}/contents/${filePath}`, { headers: hdrs });
    if (chk.ok) { const ex = await chk.json(); sha = ex.sha; }

    const uploadBody = { message: `upload ${name}`, content: base64, branch: 'main' };
    if (sha) uploadBody.sha = sha;

    const res = await fetch(
      `${GH_API}/repos/${GITHUB_USERNAME}/${CURRENT_REPO}/contents/${filePath}`,
      { method: 'PUT', headers: hdrs, body: JSON.stringify(uploadBody) }
    );
    if (!res.ok) { const e = await res.json().catch(() => ({})); return err(`GitHub ${res.status}: ${e.message || ''}`, res.status); }

    return ok({
      data: {
        filename: name,
        path:     filePath,
        cdn_url:  cdnUrl(GITHUB_USERNAME, CURRENT_REPO, folderStr, name),
      },
    }, sha ? 200 : 201);
  } catch (e) { return err(e.message, 500); }
}

// DELETE /api/media?path=&sha= — حذف صورة
export async function onRequestDelete(context) {
  const auth = await withAuth(context); if (auth) return auth;
  const { GITHUB_TOKEN, GITHUB_USERNAME, CURRENT_REPO } = context.env;

  const filePath = getParam(context, 'path');
  const sha      = getParam(context, 'sha');
  if (!filePath || !sha) return err('path و sha مطلوبان');

  const hdrs = { ...ghHeaders(GITHUB_TOKEN), 'Content-Type': 'application/json' };
  try {
    const res = await fetch(
      `${GH_API}/repos/${GITHUB_USERNAME}/${CURRENT_REPO}/contents/${filePath}`,
      { method: 'DELETE', headers: hdrs, body: JSON.stringify({ message: `delete ${filePath}`, sha, branch: 'main' }) }
    );
    if (!res.ok) { const e = await res.json().catch(() => ({})); return err(`GitHub ${res.status}: ${e.message || ''}`, res.status); }
    return ok({ deleted: filePath });
  } catch (e) { return err(e.message, 500); }
}
