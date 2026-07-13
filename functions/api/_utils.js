// functions/api/_utils.js
// ══════════════════════════════════════════════════════
// أدوات مشتركة: CORS — JWT — Response — Validation
// ══════════════════════════════════════════════════════

// ── CORS Headers ─────────────────────────────────────
const CORS_HEADERS = {
  'Content-Type':                'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods':'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers':'Content-Type, Authorization',
};

// ── Responses ────────────────────────────────────────
export function ok(data = {}, status = 200) {
  return new Response(JSON.stringify({ success: true, ...data }), {
    status, headers: CORS_HEADERS,
  });
}

export function err(message, status = 400) {
  return new Response(JSON.stringify({ success: false, error: message }), {
    status, headers: CORS_HEADERS,
  });
}

export function handleOptions() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

// دعم الأسماء القديمة
export const createResponse = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: CORS_HEADERS });
export const json = createResponse;

// ── JWT — HMAC-SHA256 حقيقي ──────────────────────────
const ENC = new TextEncoder();

function b64url(obj) {
  return btoa(JSON.stringify(obj))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

async function importKey(secret) {
  return crypto.subtle.importKey(
    'raw', ENC.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false, ['sign', 'verify']
  );
}

export async function createToken(username, secret) {
  if (!secret) throw new Error('JWT_SECRET غير مُعرَّف');
  const header  = b64url({ alg: 'HS256', typ: 'JWT' });
  const payload = b64url({
    username,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 86400, // 24 ساعة
  });
  const key = await importKey(secret);
  const sig = await crypto.subtle.sign('HMAC', key, ENC.encode(`${header}.${payload}`));
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  return `${header}.${payload}.${sigB64}`;
}

export async function withAuth(context) {
  const header = context.request.headers.get('Authorization') || '';
  if (!header.startsWith('Bearer ')) return err('غير مصرح', 401);

  const token = header.slice(7);
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return err('رمز غير صالح', 401);

    const payload = JSON.parse(
      atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'))
    );

    if (payload.exp < Date.now() / 1000) return err('انتهت صلاحية الجلسة', 401);

    const secret = context.env.JWT_SECRET;
    if (!secret) return err('إعداد الخادم غير مكتمل', 500);

    const key     = await importKey(secret);
    const sigBytes = Uint8Array.from(
      atob(parts[2].replace(/-/g, '+').replace(/_/g, '/')),
      c => c.charCodeAt(0)
    );
    const valid = await crypto.subtle.verify(
      'HMAC', key, sigBytes, ENC.encode(`${parts[0]}.${parts[1]}`)
    );
    if (!valid) return err('توقيع غير صالح', 401);

    if (payload.username !== (context.env.ADMIN_USERNAME || 'admin'))
      return err('غير مصرح', 401);

    return null; // ✅ مصرح
  } catch {
    return err('رمز غير صالح', 401);
  }
}

export const verifyAuth = withAuth;

// ── Validation Helpers ───────────────────────────────
export function requireFields(obj, fields) {
  const missing = fields.filter(f => !obj[f] && obj[f] !== 0);
  if (missing.length) throw new Error(`الحقول المطلوبة: ${missing.join(', ')}`);
}

export function getId(context) {
  return new URL(context.request.url).searchParams.get('id');
}

export function getParam(context, name) {
  return new URL(context.request.url).searchParams.get(name);
}

export function safeJson(str, fallback = []) {
  try { return JSON.parse(str || ''); } catch { return fallback; }
}
