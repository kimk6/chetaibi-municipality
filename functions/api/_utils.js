// ---- JWT Helpers ----
function b64Encode(str) {
    return btoa(unescape(encodeURIComponent(str)));
}
function b64Decode(str) {
    return decodeURIComponent(escape(atob(str)));
}
async function hmacSign(data, secret) {
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
        'raw', enc.encode(secret),
        { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    );
    const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data));
    return btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/=/g, '');
}

export async function createToken(username, secret) {
    const header = b64Encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const payload = b64Encode(JSON.stringify({ sub: username, exp: Date.now() + 86400000 }));
    const data = `${header}.${payload}`;
    const sig = await hmacSign(data, secret);
    return `${data}.${sig}`;
}

export async function verifyToken(token, secret) {
    try {
        const parts = token.split('.');
        if (parts.length !== 3) return null;
        const [header, payload, sig] = parts;
        const data = `${header}.${payload}`;
        const expectedSig = await hmacSign(data, secret);
        if (sig !== expectedSig) return null;
        const decoded = JSON.parse(b64Decode(payload));
        if (decoded.exp < Date.now()) return null;
        return decoded.sub;
    } catch { return null; }
}

export async function verifyAuth(request, env) {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
    const token = authHeader.slice(7);
    return await verifyToken(token, env.JWT_SECRET);
}

export function json(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type,Authorization',
        },
    });
}

export function handleOptions() {
    return new Response(null, {
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type,Authorization',
            'Access-Control-Max-Age': '86400',
        },
    });
}
