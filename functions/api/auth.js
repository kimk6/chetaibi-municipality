import { createToken, verifyAuth, json, handleOptions } from './_utils.js';

export async function onRequestOptions(context) { return handleOptions(); }

export async function onRequestPost(context) {
    const { request, env } = context;
    try {
        const { username, password } = await request.json();
        if (username === env.ADMIN_USERNAME && password === 'herbillon2310') {
            const token = await createToken(username, env.JWT_SECRET);
            return json({ success: true, token });
        }
        return json({ success: false, error: 'بيانات غير صحيحة' }, 401);
    } catch {
        return json({ success: false, error: 'خطأ في الطلب' }, 400);
    }
}

export async function onRequestGet(context) {
    const user = await verifyAuth(context.request, context.env);
    if (user) return json({ valid: true, user });
    return json({ valid: false }, 401);
}
