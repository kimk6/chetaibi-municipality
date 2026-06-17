// functions/api/auth.js
// ══════════════════════════════════════════════════════
// المصادقة: تسجيل الدخول + التحقق من الرمز
// ══════════════════════════════════════════════════════
import { createToken, withAuth, ok, err, handleOptions } from './_utils.js';

export async function onRequestOptions() { return handleOptions(); }

// POST /api/auth — تسجيل الدخول
export async function onRequestPost(context) {
  try {
    const { username, password } = await context.request.json();

    const validUser = context.env.ADMIN_USERNAME;
    const validPass = context.env.ADMIN_PASSWORD;
    const secret    = context.env.JWT_SECRET;

    if (!validUser || !validPass || !secret)
      return err('إعداد الخادم غير مكتمل', 500);

    if (username !== validUser || password !== validPass)
      return err('اسم المستخدم أو كلمة المرور غير صحيحة', 401);

    const token = await createToken(username, secret);
    return ok({ token });
  } catch {
    return err('طلب غير صالح', 400);
  }
}

// GET /api/auth — التحقق من صلاحية الرمز
export async function onRequestGet(context) {
  const auth = await withAuth(context);
  if (auth) return err('غير مصرح', 401);
  return ok({ valid: true });
}
