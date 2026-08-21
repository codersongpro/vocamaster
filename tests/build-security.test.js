import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

function collectFiles(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    return entry.isDirectory() ? collectFiles(fullPath) : [fullPath];
  });
}

test('production client assets do not contain server secrets or Gemini SDK code', () => {
  const files = collectFiles(path.resolve('dist')).filter((file) => /\.(html|js|css)$/.test(file));
  assert.ok(files.length > 0, 'run the production build before this test');
  const clientCode = files.map((file) => fs.readFileSync(file, 'utf8')).join('\n');
  assert.doesNotMatch(clientCode, /GEMINI_API_KEY|APP_PASSWORD|SESSION_SECRET|GoogleGenAI|x-goog-api-key/);
});

