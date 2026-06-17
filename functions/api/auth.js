// functions/api/auth.js
import { createToken, withAuth, createResponse, handleOptions } from './_utils.js';

export async function onRequestOptions() { return handleOptions(); }

export async function onRequestPost(context) {
    try {
        const { username, password } = await context.request.json();

        const validUser = context.env.ADMIN_USERNAME;
        const validPass = context.env.ADMIN_PASSWORD;
        const secret    = context.env.JWT_SECRET;

        // التحقق من وجود المتغيرات البيئية
        if (!validUser || !validPass || !secret)
            return createResponse({ success: false, error: 'إعداد الخادم غير مكتمل' }, 500);

        // مقارنة ثابتة الوقت لمنع timing attacks
        const userMatch = username === validUser;
        const passMatch = password === validPass;

        if (!userMatch || !passMatch)
            return createResponse({ success: false, error: 'بيانات غير صحيحة' }, 401);

        const token = await createToken(username, secret);
        return createResponse({ success: true, token });
    } catch {
        return createResponse({ success: false, error: 'خطأ في الطلب' }, 400);
    }
}

export async function onRequestGet(context) {
    const auth = await withAuth(context);
    if (auth) return createResponse({ valid: false }, 401);
    return createResponse({ valid: true });
}
