import test from 'node:test';
import assert from 'node:assert/strict';
import { countBlankAnswers, gradeQuiz, normalizeAnswer } from '../services/quizGrading.js';

const questions = [
  { word: 'abandon', definition: 'to leave someone', koreanDefinition: '버리다' },
  { word: 'fragile', definition: 'easily broken', koreanDefinition: '깨지기 쉬운' },
  { word: 'give up', definition: 'to stop trying', koreanDefinition: '포기하다' },
];

test('pairs each answer with its own question number, not with the typing order', () => {
  // 2번 문항을 비워 두고 3번을 먼저 쓴 뒤 1번으로 돌아가 고친 상황
  const graded = gradeQuiz(questions, ['abandon', '', 'give up']);
  assert.deepEqual(graded.map((answer) => answer.word), ['abandon', 'fragile', 'give up']);
  assert.deepEqual(graded.map((answer) => answer.isCorrect), [true, false, true]);
});

test('ignores letter case and surrounding spaces when grading', () => {
  const graded = gradeQuiz(questions, ['  ABANDON ', 'Fragile', 'give   up']);
  assert.deepEqual(graded.map((answer) => answer.isCorrect), [true, true, true]);
  assert.equal(graded[0].userAnswer, 'ABANDON');
  assert.equal(normalizeAnswer(' Give   Up '), 'give up');
});

test('treats a skipped question as an empty wrong answer', () => {
  const graded = gradeQuiz(questions, ['abandon']);
  assert.deepEqual(graded.map((answer) => answer.userAnswer), ['abandon', '', '']);
  assert.deepEqual(graded.map((answer) => answer.isCorrect), [true, false, false]);
  assert.equal(countBlankAnswers(graded), 2);
});

test('keeps the question text with the result so it can be reviewed later', () => {
  const [first] = gradeQuiz(questions, ['wrong']);
  assert.equal(first.definition, 'to leave someone');
  assert.equal(first.koreanDefinition, '버리다');
  assert.equal(first.userAnswer, 'wrong');
  assert.equal(first.isCorrect, false);
});
