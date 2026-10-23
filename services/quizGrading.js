/*
  온라인 테스트 채점 모듈입니다.

  문항을 넘길 때마다 채점하지 않고, 적어둔 답을 모아 제출할 때 한 번에 채점합니다.
  이전 문항으로 돌아가 답을 고칠 수 있기 때문에,
  답은 문항 번호(index)로만 짝지어야 하고 입력한 순서에 기대면 안 됩니다.
*/

// 대소문자, 앞뒤 공백, 중복 공백을 무시하고 채점합니다.
export const normalizeAnswer = (value) => String(value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');

/**
 * 문항과 답을 번호 순서대로 짝지어 채점합니다.
 * @param {Array<{ word: string, definition: string, koreanDefinition: string }>} questions 출제된 문항 (화면에 보인 순서)
 * @param {string[]} inputs 문항 번호와 같은 자리에 적어둔 답
 * @returns {Array<{ word: string, definition: string, koreanDefinition: string, userAnswer: string, isCorrect: boolean }>}
 */
export function gradeQuiz(questions, inputs) {
  const answers = Array.isArray(inputs) ? inputs : [];
  return questions.map((question, position) => {
    // 답을 쓰지 않고 넘긴 문항은 빈 문자열로 두고 오답으로 처리합니다.
    const userAnswer = answers[position] ?? '';
    return {
      word: question.word,
      definition: question.definition,
      koreanDefinition: question.koreanDefinition,
      userAnswer: userAnswer.trim(),
      isCorrect: normalizeAnswer(userAnswer) === normalizeAnswer(question.word),
    };
  });
}

/**
 * 답을 쓰지 않은 문항 수를 셉니다. (제출 전 확인용)
 * @param {Array<{ userAnswer: string }>} answers
 */
export function countBlankAnswers(answers) {
  return answers.filter((answer) => answer.userAnswer.length === 0).length;
}
