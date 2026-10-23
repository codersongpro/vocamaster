import test from 'node:test';
import assert from 'node:assert/strict';
import { describeProgress, matchesItems, parseQuizProgress } from '../services/quizProgress.js';

const questions = [
  { id: 'a', word: 'abandon', definition: 'to leave someone', koreanDefinition: '버리다' },
  { id: 'b', word: 'fragile', definition: 'easily broken', koreanDefinition: '깨지기 쉬운' },
];

const progress = { savedAt: '2026-10-23T00:00:00.000Z', index: 1, answers: ['abandon', ''], questions };

test('restores a saved quiz with its answers and question order', () => {
  assert.deepEqual(parseQuizProgress(progress), progress);
  // 문항 순서가 저장된 그대로여야 답과 짝이 맞습니다.
  assert.deepEqual(parseQuizProgress(progress).questions.map((item) => item.word), ['abandon', 'fragile']);
});

test('refuses saved data that cannot be trusted', () => {
  assert.equal(parseQuizProgress(null), null);
  assert.equal(parseQuizProgress('{}'), null);
  assert.equal(parseQuizProgress({ ...progress, questions: [] }), null);
  assert.equal(parseQuizProgress({ ...progress, questions: [{ word: 'abandon' }] }), null);
  // 답의 개수가 문항 수와 다르면 번호가 밀려 엉뚱한 문항에 붙습니다.
  assert.equal(parseQuizProgress({ ...progress, answers: ['abandon'] }), null);
  assert.equal(parseQuizProgress({ ...progress, answers: [1, 2] }), null);
  assert.equal(parseQuizProgress({ ...progress, index: 2 }), null);
  assert.equal(parseQuizProgress({ ...progress, index: -1 }), null);
  assert.equal(parseQuizProgress({ ...progress, index: 1.5 }), null);
  assert.equal(parseQuizProgress({ ...progress, savedAt: '' }), null);
});

test('ignores a quiz that was never actually started', () => {
  assert.equal(parseQuizProgress({ ...progress, index: 0, answers: ['', ''] }), null);
  assert.equal(parseQuizProgress({ ...progress, index: 0, answers: ['  ', ''] }), null);
  // 첫 문항이라도 답을 썼다면 이어서 풀 수 있습니다.
  assert.notEqual(parseQuizProgress({ ...progress, index: 0, answers: ['abandon', ''] }), null);
});

test('only resumes when the saved set is the set being started', () => {
  assert.equal(matchesItems(progress, questions), true);
  // 순서가 섞여도 같은 세트로 봅니다.
  assert.equal(matchesItems(progress, [questions[1], questions[0]]), true);
  assert.equal(matchesItems(progress, [questions[0]]), false);
  assert.equal(matchesItems(progress, [questions[0], { ...questions[1], id: 'c' }]), false);
  assert.equal(matchesItems(null, questions), false);
});

test('summarizes how far the quiz got', () => {
  assert.deepEqual(describeProgress(progress), { position: 2, total: 2, answered: 1 });
});
