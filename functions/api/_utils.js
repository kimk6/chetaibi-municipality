// functions/api/_utils.js
// ======== CORS ========
const CORS = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export function createResponse(data, status = 200) {
    return new Response(JSON.stringify(data), { status, headers: CORS });
}
export const json = createResponse;

export function handleOptions() {
    return new Response(null, { status: 204, headers: CORS });
}

// ======== JWT — HMAC-SHA256 حقيقي ========
async function hmacSign(secret, data) {
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
        'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    );
    const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data));
    return btoa(String.fromCharCode(...new Uint8Array(sig)))
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

async function hmacVerify(secret, data, signature) {
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
        'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']
    );
    const sig = Uint8Array.from(atob(signature.replace(/-/g,'+').replace(/_/g,'/')), c => c.charCodeAt(0));
    return crypto.subtle.verify('HMAC', key, sig, enc.encode(data));
}

function b64url(obj) {
    return btoa(JSON.stringify(obj)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');
}

export async function createToken(username, secret) {
    const header  = b64url({ alg: 'HS256', typ: 'JWT' });
    const payload = b64url({ username, iat: Math.floor(Date.now()/1000), exp: Math.floor(Date.now()/1000) + 86400 });
    const sig     = await hmacSign(secret, `${header}.${payload}`);
    return `${header}.${payload}.${sig}`;
}

export async function withAuth(context) {
    const authHeader = context.request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer '))
        return createResponse({ success: false, error: 'غير مصرح' }, 401);

    const token = authHeader.slice(7);
    try {
        const parts = token.split('.');
        if (parts.length !== 3) return createResponse({ success: false, error: 'رمز غير صالح' }, 401);

        const payload = JSON.parse(atob(parts[1].replace(/-/g,'+').replace(/_/g,'/')));
        if (payload.exp < Date.now() / 1000)
            return createResponse({ success: false, error: 'انتهت صلاحية الرمز' }, 401);

        const secret = context.env.JWT_SECRET;
        if (!secret) return createResponse({ success: false, error: 'إعداد خاطئ' }, 500);

        const valid = await hmacVerify(secret, `${parts[0]}.${parts[1]}`, parts[2]);
        if (!valid) return createResponse({ success: false, error: 'توقيع غير صالح' }, 401);

        if (payload.username !== context.env.ADMIN_USERNAME)
            return createResponse({ success: false, error: 'غير مصرح' }, 401);

        return null; // ✅ مصرح
    } catch {
        return createResponse({ success: false, error: 'رمز غير صالح' }, 401);
    }
}
export const verifyAuth = withAuth;
