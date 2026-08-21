import { clearSessionCookie } from './_auth.js';
import { sendJson } from './_http.js';

export default function handler(request, response) {
  if (request.method !== 'POST') return sendJson(response, 405, { error: '허용되지 않는 요청입니다.' }, { Allow: 'POST' });
  clearSessionCookie(response);
  return sendJson(response, 200, { authenticated: false });
}

