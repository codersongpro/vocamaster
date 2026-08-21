import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createSessionToken,
  verifyPassword,
  verifySessionToken,
} from '../api/_auth.js';
import { validateFileParts } from '../api/_validation.js';

process.env.APP_PASSWORD = 'correct-password';
process.env.SESSION_SECRET = '0123456789abcdef0123456789abcdef';

test('accepts the configured password and rejects another password', () => {
  assert.equal(verifyPassword('correct-password'), true);
  assert.equal(verifyPassword('wrong-password'), false);
});

test('signs a session token and rejects a tampered token', () => {
  const token = createSessionToken(60);
  assert.equal(verifySessionToken(token), true);
  assert.equal(verifySessionToken(`${token}tampered`), false);
});

test('rejects expired session tokens', () => {
  const token = createSessionToken(-1);
  assert.equal(verifySessionToken(token), false);
});

test('accepts supported image and PDF parts within limits', () => {
  const files = validateFileParts([
    { mimeType: 'image/png', data: 'aGVsbG8=' },
    { mimeType: 'application/pdf', data: 'd29ybGQ=' },
  ]);
  assert.equal(files.length, 2);
});

test('rejects unsupported file types and oversized payloads', () => {
  assert.throws(
    () => validateFileParts([{ mimeType: 'text/html', data: 'aGVsbG8=' }]),
    /지원하지 않는 파일 형식/,
  );
  assert.throws(
    () => validateFileParts([{ mimeType: 'image/png', data: 'A'.repeat(3_000_004) }]),
    /파일 크기/,
  );
});

