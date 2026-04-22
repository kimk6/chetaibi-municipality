// functions/api/_utils.js
// ======== Authentication ========
export async function withAuth(context) {
    const authHeader = context.request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return createResponse({ success: false, error: 'غير مصرح' }, 401);
    }
    const token = authHeader.replace('Bearer ', '');
    try {
        const parts = token.split('.');
        if (parts.length !== 3) return createResponse({ success: false, error: 'رمز غير صالح' }, 401);
        const payload = JSON.parse(atob(parts[1]));
        if (payload.exp && payload.exp < Date.now() / 1000) return createResponse({ success: false, error: 'انتهت صلاحية الرمز' }, 401);
        if (payload.username !== (context.env.ADMIN_USERNAME || 'admin')) return createResponse({ success: false, error: 'غير مصرح' }, 401);
        return null;
    } catch {
        return createResponse({ success: false, error: 'رمز غير صالح' }, 401);
    }
}

export const verifyAuth = withAuth;

export function createToken(username, secret) {
    const header  = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const payload = btoa(JSON.stringify({ username, exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) }));
    const sig     = btoa(secret + '.' + payload);
    return `${header}.${payload}.${sig}`;
}

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
