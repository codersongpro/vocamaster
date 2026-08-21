import { allowRequest } from './_rate-limit.js';
import { createSessionToken, setSessionCookie, verifyPassword } from './_auth.js';
import { clientKey, readJson, sendJson } from './_http.js';

export default function handler(request, response) {
  if (request.method !== 'POST') return sendJson(response, 405, { error: '허용되지 않는 요청입니다.' }, { Allow: 'POST' });
  if (!allowRequest(`login:${clientKey(request)}`, 10, 15 * 60 * 1000)) return sendJson(response, 429, { error: '잠시 후 다시 시도해주세요.' });
  if (!process.env.APP_PASSWORD || !process.env.SESSION_SECRET) return sendJson(response, 503, { error: '인증 설정이 완료되지 않았습니다.' });

  let body;
  try {
    body = readJson(request);
  } catch {
    return sendJson(response, 400, { error: '요청 형식이 올바르지 않습니다.' });
  }
  const password = typeof body.password === 'string' ? body.password : '';
  if (password.length > 256 || !verifyPassword(password)) return sendJson(response, 401, { error: '비밀번호가 올바르지 않습니다.' });

  try {
    setSessionCookie(response, createSessionToken());
  } catch {
    return sendJson(response, 503, { error: '인증 설정이 완료되지 않았습니다.' });
  }
  return sendJson(response, 200, { authenticated: true });
}

