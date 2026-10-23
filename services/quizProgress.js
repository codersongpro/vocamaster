/*
  풀던 온라인 테스트를 브라우저에 임시로 보관하기 위한 모듈입니다.

  '그만하기'로 나가거나 새로고침·앱 종료로 화면이 사라져도
  적어둔 답과 문항 순서를 그대로 되살려 이어서 풀 수 있게 합니다.

  저장된 값은 사용자가 고칠 수 있는 곳(localStorage)에서 오므로
  되살리기 전에 형태를 반드시 확인합니다.
*/

const isVocabItem = (item) =>
  !!item &&
  typeof item.id === 'string' &&
  typeof item.word === 'string' &&
  typeof item.definition === 'string' &&
  typeof item.koreanDefinition === 'string';

/**
 * 저장된 진행 상황이 쓸 수 있는 형태인지 확인합니다.
 * @param {unknown} value localStorage 에서 읽어 JSON 으로 푼 값
 * @returns {{ savedAt: string, index: number, answers: string[], questions: object[] } | null} 쓸 수 없으면 null
 */
export function parseQuizProgress(value) {
  if (!value || typeof value !== 'object') return null;
  const { savedAt, index, answers, questions } = value;

  if (!Array.isArray(questions) || questions.length === 0 || !questions.every(isVocabItem)) return null;
  // 답은 문항 번호와 같은 자리에 들어 있어야 짝이 맞습니다.
  if (!Array.isArray(answers) || answers.length !== questions.length) return null;
  if (!answers.every((answer) => typeof answer === 'string')) return null;
  if (!Number.isInteger(index) || index < 0 || index >= questions.length) return null;
  if (typeof savedAt !== 'string' || savedAt.length === 0) return null;

  // 첫 문항에서 아무것도 쓰지 않았다면 이어서 풀 것이 없습니다.
  if (index === 0 && answers.every((answer) => answer.trim().length === 0)) return null;

  return { savedAt, index, answers, questions };
}

/**
 * 저장된 진행 상황이 지금 풀려는 단어 세트와 같은지 확인합니다.
 * 다른 세트라면 되살리지 않고 새로 시작합니다.
 * @param {{ questions: Array<{ id: string }> } | null} progress
 * @param {Array<{ id: string }>} items
 */
export function matchesItems(progress, items) {
  if (!progress || !Array.isArray(items) || progress.questions.length !== items.length) return false;
  const saved = progress.questions.map((question) => question.id).sort();
  const current = items.map((item) => item.id).sort();
  return saved.every((id, position) => id === current[position]);
}

/**
 * 몇 번째 문항까지 풀었는지 사람이 읽을 수 있게 정리합니다.
 * @param {{ index: number, answers: string[], questions: object[] }} progress
 */
export function describeProgress(progress) {
  const answered = progress.answers.filter((answer) => answer.trim().length > 0).length;
  return { position: progress.index + 1, total: progress.questions.length, answered };
}
