export async function withAuth(context) {
    const authHeader = context.request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return createResponse({ success: false, error: 'غير مصرح' }, 401);
    }
    const token = authHeader.replace('Bearer ', '');
    try {
        const parts = token.split('.');
        if (parts.length !== 3) {
            return createResponse({ success: false, error: 'رمز غير صالح' }, 401);
        }
        const payload = JSON.parse(atob(parts[1]));
        if (payload.exp && payload.exp < Date.now() / 1000) {
            return createResponse({ success: false, error: 'انتهت صلاحية الرمز' }, 401);
        }
        if (payload.username !== (context.env.ADMIN_USERNAME || 'admin')) {
            return createResponse({ success: false, error: 'غير مصرح' }, 401);
        }
        return null;
    } catch {
        return createResponse({ success: false, error: 'رمز غير صالح' }, 401);
    }
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
