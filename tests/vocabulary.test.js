import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeVocabularyItem } from '../api/_validation.js';

test('keeps the English definition and requires a Korean meaning', () => {
  assert.deepEqual(
    normalizeVocabularyItem({ word: 'apple', definition: 'a fruit', koreanDefinition: '사과' }),
    { word: 'apple', definition: 'a fruit', koreanDefinition: '사과' },
  );
});

test('rejects a vocabulary item without a Korean meaning', () => {
  assert.throws(
    () => normalizeVocabularyItem({ word: 'apple', definition: 'a fruit', koreanDefinition: '' }),
    /한글 뜻/,
  );
});

