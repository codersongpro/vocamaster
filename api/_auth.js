import crypto from 'node:crypto';

export const SESSION_COOKIE = 'voca_master_session';

function getSessionSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('SESSION_SECRET is not configured');
  }
  return secret;
}

function encode(value) {
  return Buffer.from(value).toString('base64url');
}

function sign(value) {
  return crypto.createHmac('sha256', getSessionSecret()).update(value).digest('base64url');
}

function safeEqual(left, right) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function verifyPassword(password) {
  const configured = process.env.APP_PASSWORD;
  if (!configured || typeof password !== 'string') return false;
  return safeEqual(password, configured);
}

export function createSessionToken(ttlSeconds = 8 * 60 * 60) {
  const now = Math.floor(Date.now() / 1000);
  const payload = encode(JSON.stringify({
    iat: now,
    exp: now + ttlSeconds,
    nonce: crypto.randomBytes(16).toString('hex'),
  }));
  return `${payload}.${sign(payload)}`;
}

export function verifySessionToken(token) {
  if (typeof token !== 'string') return false;
  const [payload, signature] = token.split('.');
  if (!payload || !signature || !safeEqual(signature, sign(payload))) return false;
  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return Number.isInteger(parsed.exp) && parsed.exp > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

export function getSessionToken(request) {
  const header = request.headers?.cookie || '';
  const pair = header.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${SESSION_COOKIE}=`));
  return pair ? decodeURIComponent(pair.slice(SESSION_COOKIE.length + 1)) : null;
}

export function isAuthenticated(request) {
  try {
    return verifySessionToken(getSessionToken(request));
  } catch {
    return false;
  }
}

export function setSessionCookie(response, token) {
  response.setHeader('Set-Cookie', `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; Max-Age=28800; HttpOnly; Secure; SameSite=Strict`);
}

export function clearSessionCookie(response) {
  response.setHeader('Set-Cookie', `${SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict`);
}

