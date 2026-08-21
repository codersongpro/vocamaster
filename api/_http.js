export function sendJson(response, status, body, extraHeaders = {}) {
  response.status(status).setHeader('Content-Type', 'application/json; charset=utf-8');
  for (const [name, value] of Object.entries(extraHeaders)) response.setHeader(name, value);
  response.end(JSON.stringify(body));
}

export function readJson(request) {
  if (request.body && typeof request.body === 'object') return request.body;
  if (typeof request.body === 'string') return JSON.parse(request.body);
  return {};
}

export function clientKey(request) {
  return request.headers?.['x-forwarded-for']?.split(',')[0]?.trim() || request.socket?.remoteAddress || 'unknown';
}

