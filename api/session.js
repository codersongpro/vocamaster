import { isAuthenticated } from './_auth.js';
import { sendJson } from './_http.js';

export default function handler(request, response) {
  if (request.method !== 'GET') return sendJson(response, 405, { error: '허용되지 않는 요청입니다.' }, { Allow: 'GET' });
  if (!isAuthenticated(request)) return sendJson(response, 401, { authenticated: false });
  return sendJson(response, 200, { authenticated: true });
}

