// functions/api/auth.js
import { createToken, withAuth, createResponse, handleOptions } from './_utils.js';

export async function onRequestOptions() { return handleOptions(); }

export async function onRequestPost(context) {
    try {
        const { username, password } = await context.request.json();
        const secret = context.env.JWT_SECRET;
        if (!secret) {
            return createResponse({ success: false, error: 'إعداد الخادم ناقص: JWT_SECRET غير معرَّف' }, 500);
        }
        if (username === (context.env.ADMIN_USERNAME || 'admin') && password === (context.env.ADMIN_PASSWORD || 'herbillon2310')) {
            const token = await createToken(username, secret);
            return createResponse({ success: true, token });
        }
        return createResponse({ success: false, error: 'بيانات غير صحيحة' }, 401);
    } catch {
        return createResponse({ success: false, error: 'خطأ في الطلب' }, 400);
    }
}

export async function onRequestGet(context) {
    const auth = await withAuth(context);
    if (auth) return createResponse({ valid: false }, 401);
    return createResponse({ valid: true });
}
