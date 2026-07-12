// functions/api/_utils.js
// ══════════════════════════════════════════════════════
// إصلاح أمني حرج: النسخة السابقة كانت تفكّ تشفير الحمولة
// فقط بدون التحقق من التوقيع إطلاقاً — أي شخص يعرف اسم
// المستخدم (admin) كان يقدر يزوّر توكن صالح. الآن: توقيع
// ═HMAC-SHA256 حقيقي عبر Web Crypto، ويُتحقق منه بالكامل.
// ══════════════════════════════════════════════════════

// ── ترميز/فك ترميز base64url (متوافق مع معيار JWT) ──
function b64urlEncodeBytes(bytes) {
  let str = '';
  bytes.forEach((b) => { str += String.fromCharCode(b); });
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64urlEncodeStr(str) {
  return b64urlEncodeBytes(new TextEncoder().encode(str));
}
function b64urlDecodeToStr(b64url) {
  let b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4) b64 += '=';
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

// ── توقيع HMAC-SHA256 حقيقي عبر Web Crypto (متوفرة في Cloudflare Workers) ──
async function hmacSign(message, secret) {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sigBuf = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return b64urlEncodeBytes(new Uint8Array(sigBuf));
}

// ── مقارنة بزمن ثابت (تخفف من هجمات قياس الزمن على التوقيع) ──
function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
}

// ======== إنشاء توكن حقيقي موقّع ========
export async function createToken(username, secret) {
  const header  = b64urlEncodeStr(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = b64urlEncodeStr(JSON.stringify({
    username,
    exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60),
  }));
  const signingInput = `${header}.${payload}`;
  const sig = await hmacSign(signingInput, secret);
  return `${signingInput}.${sig}`;
}

// ======== التحقق الكامل (توقيع + صلاحية + مستخدم) ========
export async function withAuth(context) {
  const authHeader = context.request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return createResponse({ success: false, error: 'غير مصرح' }, 401);
  }

  // فشل آمن: بدون سر حقيقي مُعرَّف في بيئة الإنتاج، نرفض بدل
  // الاعتماد على قيمة افتراضية معروفة مكتوبة داخل الكود
  const secret = context.env.JWT_SECRET;
  if (!secret) {
    return createResponse({ success: false, error: 'إعداد الخادم ناقص: JWT_SECRET غير معرَّف' }, 500);
  }

  const token = authHeader.replace('Bearer ', '');
  const parts = token.split('.');
  if (parts.length !== 3) return createResponse({ success: false, error: 'رمز غير صالح' }, 401);
  const [header, payload, sig] = parts;

  try {
    const expectedSig = await hmacSign(`${header}.${payload}`, secret);
    if (!timingSafeEqual(sig, expectedSig)) {
      return createResponse({ success: false, error: 'رمز غير صالح' }, 401);
    }
    const payloadObj = JSON.parse(b64urlDecodeToStr(payload));
    if (payloadObj.exp && payloadObj.exp < Date.now() / 1000) {
      return createResponse({ success: false, error: 'انتهت صلاحية الرمز' }, 401);
    }
    if (payloadObj.username !== (context.env.ADMIN_USERNAME || 'admin')) {
      return createResponse({ success: false, error: 'غير مصرح' }, 401);
    }
    return null; // null يعني: التحقق نجح، تابع الطلب
  } catch {
    return createResponse({ success: false, error: 'رمز غير صالح' }, 401);
  }
}

export const verifyAuth = withAuth;

export function createResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
export const json = createResponse;

export function handleOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
