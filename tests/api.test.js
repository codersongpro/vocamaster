import test from 'node:test';
import assert from 'node:assert/strict';
import login from '../api/login.js';

function mockResponse() {
  return {
    statusCode: 200,
    headers: {},
    body: '',
    status(code) { this.statusCode = code; return this; },
    setHeader(name, value) { this.headers[name] = value; return this; },
    end(body) { this.body = body; },
  };
}

test('returns a configuration error instead of a function crash for a short session secret', () => {
  process.env.APP_PASSWORD = 'test-password';
  process.env.SESSION_SECRET = 'too-short';
  const response = mockResponse();
  login({ method: 'POST', headers: {}, body: { password: 'test-password' } }, response);
  assert.equal(response.statusCode, 503);
  assert.match(response.body, /인증 설정/);
});

