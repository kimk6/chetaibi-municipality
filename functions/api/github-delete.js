// functions/api/github-delete.js
// ══════════════════════════════════════════════════════
// حذف صورة من GitHub عبر رابط jsDelivr
// يُستدعى من لوحة التحكم بعد حذف السجل من قاعدة البيانات
// ══════════════════════════════════════════════════════
import { withAuth, ok, err, handleOptions } from './_utils.js';

export async function onRequestOptions() { return handleOptions(); }

// DELETE /api/github-delete  body: { image_url }
export async function onRequestDelete(context) {
  const auth = await withAuth(context); if (auth) return auth;

  try {
    const { image_url } = await context.request.json();

    // تجاهل الروابط غير المستضافة على jsDelivr
    if (!image_url?.includes('jsdelivr.net'))
      return ok({ skipped: true, reason: 'ليس رابط jsDelivr' });

    // استخراج المعلومات من الرابط
    // مثال: https://cdn.jsdelivr.net/gh/kimk6/repo@main/folder/file.jpg
    const match = image_url.match(/cdn\.jsdelivr\.net\/gh\/([^/]+)\/([^@]+)@[^/]+\/(.+)/);
    if (!match) return ok({ skipped: true, reason: 'رابط غير مدعوم' });

    const [, owner, repo, path] = match;
    const token = context.env.GITHUB_TOKEN;
    if (!token) return err('GITHUB_TOKEN غير مُعرَّف', 500);

    const hdrs = {
      'Authorization':        `token ${token}`,
      'Accept':               'application/vnd.github.v3+json',
      'User-Agent':           'chetaibi-municipality',
      'Content-Type':         'application/json',
    };
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;

    // جلب sha الملف
    const getRes = await fetch(url, { headers: hdrs });
    if (getRes.status === 404) return ok({ skipped: true, reason: 'الملف غير موجود' });
    if (!getRes.ok) return err(`GitHub ${getRes.status}`, getRes.status);

    const { sha } = await getRes.json();

    // حذف الملف
    const delRes = await fetch(url, {
      method: 'DELETE',
      headers: hdrs,
      body: JSON.stringify({ message: `حذف: ${path}`, sha }),
    });
    if (!delRes.ok) return err(`فشل الحذف: ${delRes.status}`, delRes.status);

    return ok({ deleted: path });
  } catch (e) { return err(e.message, 500); }
}
