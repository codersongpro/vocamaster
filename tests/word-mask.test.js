import test from 'node:test';
import assert from 'node:assert/strict';
import { BLANK, maskWord, revealsWord } from '../services/wordMask.js';

test('hides the word itself regardless of letter case', () => {
  assert.equal(maskWord('An architect designs buildings.', 'architect'), `An ${BLANK} designs buildings.`);
  assert.equal(maskWord('Architect of a plan.', 'architect'), `${BLANK} of a plan.`);
});

test('hides common inflected forms of the word', () => {
  assert.equal(maskWord('to abandon or abandons something', 'abandon'), `to ${BLANK} or ${BLANK} something`);
  assert.equal(maskWord('abandoned and abandoning', 'abandon'), `${BLANK} and ${BLANK}`);
  assert.equal(maskWord('making something by hand', 'make'), `${BLANK} something by hand`);
  assert.equal(maskWord('running very fast', 'run'), `${BLANK} very fast`);
  assert.equal(maskWord('happier than before', 'happy'), `${BLANK} than before`);
  assert.equal(maskWord("the architect's own office", 'architect'), `the ${BLANK} own office`);
});

test('hides a phrasal word and its meaningful parts', () => {
  assert.equal(maskWord('to give up trying', 'give up'), `to ${BLANK} trying`);
  assert.equal(maskWord('he gives up easily', 'give up'), `he ${BLANK} easily`);
  // 전치사만 따로 쓰인 경우는 문장이 무너지지 않도록 남겨 둡니다.
  assert.equal(maskWord('to stand up for a friend', 'give up'), 'to stand up for a friend');
});

test('keeps unrelated words that merely start with the same letters', () => {
  assert.equal(maskWord('a short article about war', 'art'), 'a short article about war');
  assert.equal(maskWord('a long tendency to win', 'ten'), 'a long tendency to win');
  assert.equal(maskWord('easily broken or damaged', 'fragile'), 'easily broken or damaged');
});

test('leaves the text untouched for empty or invalid input', () => {
  assert.equal(maskWord('easily broken', ''), 'easily broken');
  assert.equal(maskWord('', 'fragile'), '');
  assert.equal(maskWord('easily broken', '   '), 'easily broken');
});

test('reports whether a definition would reveal the answer', () => {
  assert.equal(revealsWord('An architect designs buildings.', 'architect'), true);
  assert.equal(revealsWord('a person who designs buildings', 'architect'), false);
});
