import React, { useEffect, useMemo, useState } from 'react';
import { QuizAnswer, QuizRecord, VocabItem } from '../types';
import { saveQuizRecord } from '../services/quizStorage';
import { countBlankAnswers, gradeQuiz } from '../services/quizGrading.js';
import { maskWord } from '../services/wordMask.js';

interface OnlineQuizProps {
  items: VocabItem[];
  onFinished: (record: QuizRecord) => void;
  onExit: () => void;
}

const shuffle = <T,>(array: T[]): T[] => {
  const next = [...array];
  for (let i = next.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
};

const OnlineQuiz: React.FC<OnlineQuizProps> = ({ items, onFinished, onExit }) => {
  // round가 바뀌면 문제 순서를 새로 섞습니다. (다시 풀기)
  const [round, setRound] = useState(0);
  const questions = useMemo(() => shuffle(items), [items, round]);

  const [index, setIndex] = useState(0);
  /*
    답을 문항 번호 순서대로 보관합니다.
    이전 문항으로 돌아가면 적어둔 답이 그대로 보이고, 고쳐 쓸 수 있습니다.
    채점은 문항을 넘길 때가 아니라 마지막에 제출할 때 한 번에 합니다.
  */
  const [inputs, setInputs] = useState<string[]>(() => questions.map(() => ''));
  const [record, setRecord] = useState<QuizRecord | null>(null);

  // 단어 세트가 바뀌거나 '다시 풀기'로 순서를 새로 섞으면 처음부터 시작합니다.
  useEffect(() => {
    setInputs(questions.map(() => ''));
    setIndex(0);
    setRecord(null);
  }, [questions]);

  const current = questions[index];
  const isLastQuestion = index + 1 === questions.length;
  const answerAt = (position: number) => inputs[position] ?? '';
  const answeredCount = questions.filter((_question, position) => answerAt(position).trim().length > 0).length;

  const handleChange = (value: string) => {
    setInputs((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  };

  const handleBack = () => {
    if (index > 0) setIndex(index - 1);
  };

  // 적어둔 답을 모두 모아 한 번에 채점합니다.
  const handleFinish = () => {
    const graded: QuizAnswer[] = gradeQuiz(questions, inputs);

    const blanks = countBlankAnswers(graded);
    if (blanks > 0 && !window.confirm(`답을 쓰지 않은 문항이 ${blanks}개 있습니다. 그대로 제출할까요?`)) return;

    const finished: QuizRecord = {
      id: `quiz-${Date.now()}`,
      takenAt: new Date().toISOString(),
      total: graded.length,
      correct: graded.filter((answer) => answer.isCorrect).length,
      answers: graded,
      items,
    };
    saveQuizRecord(finished);
    setRecord(finished);
    onFinished(finished);
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!current) return;
    if (isLastQuestion) {
      handleFinish();
      return;
    }
    setIndex(index + 1);
  };

  // 순서를 새로 섞습니다. 나머지 초기화는 questions 변경을 감지하는 위의 useEffect가 맡습니다.
  const handleRetry = () => {
    setRound(round + 1);
  };

  // 결과 화면
  if (record) {
    const rate = Math.round((record.correct / record.total) * 100);
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
          <p className="text-sm text-gray-500 mb-2">테스트 결과</p>
          <p className="text-5xl font-bold text-blue-600 mb-2">
            {record.correct}
            <span className="text-2xl text-gray-400"> / {record.total}</span>
          </p>
          <p className="text-gray-600 mb-6">정답률 {rate}%</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={handleRetry}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-xl shadow transition-colors"
            >
              🔁 다시 풀기
            </button>
            <button
              onClick={onExit}
              className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-3 px-6 rounded-xl transition-colors"
            >
              단어 목록으로
            </button>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <h3 className="px-6 py-4 font-bold text-gray-800 border-b border-gray-100">문항별 결과</h3>
          <ul className="divide-y divide-gray-100">
            {record.answers.map((answer, i) => (
              <li key={`${answer.word}-${i}`} className="px-6 py-4 flex gap-4 items-start">
                <span className={`text-lg shrink-0 ${answer.isCorrect ? 'text-green-500' : 'text-red-500'}`}>
                  {answer.isCorrect ? '⭕' : '❌'}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-gray-800 break-words">{answer.definition}</p>
                  <p className="text-sm text-blue-700 break-words">{answer.koreanDefinition}</p>
                  <p className="text-sm mt-1">
                    <span className="text-gray-500">정답 </span>
                    <b className="text-gray-900">{answer.word}</b>
                    {!answer.isCorrect && (
                      <>
                        <span className="text-gray-400 mx-2">|</span>
                        <span className="text-gray-500">내 답 </span>
                        <span className="text-red-600">{answer.userAnswer || '(무응답)'}</span>
                      </>
                    )}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  if (!current) return null;

  const progress = Math.round((index / questions.length) * 100);

  // 문제 풀이 화면
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-10">
        <div className="flex justify-between items-center text-sm text-gray-500 mb-3">
          <span>
            {index + 1} / {questions.length}
            <span className="text-gray-400 ml-2">· 답 작성 {answeredCount}개</span>
          </span>
          <button onClick={onExit} className="underline hover:text-gray-800 transition-colors">
            그만하기
          </button>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-8">
          <div className="h-full bg-blue-600 transition-all duration-300" style={{ width: `${progress}%` }} />
        </div>

        <p className="text-xs text-gray-400 mb-2">English Definition</p>
        {/* 영어 뜻 안에 정답 단어가 들어 있으면 빈칸으로 가려서 출제합니다. */}
        <p className="text-xl sm:text-2xl font-semibold text-gray-900 leading-relaxed mb-8 break-words">
          {maskWord(current.definition, current.word)}
        </p>

        <form onSubmit={handleSubmit} className="space-y-3">
          {/* key에 문항 번호를 넣어 문항을 넘길 때마다 입력칸에 커서가 잡히게 합니다. */}
          <input
            key={index}
            type="text"
            value={answerAt(index)}
            onChange={(event) => handleChange(event.target.value)}
            autoFocus
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="영어 단어를 입력하세요"
            className="w-full border-2 border-gray-200 focus:border-blue-500 outline-none rounded-xl px-4 py-3 text-lg transition-colors"
          />
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={handleBack}
              disabled={index === 0}
              className="bg-gray-100 hover:bg-gray-200 disabled:bg-gray-50 disabled:text-gray-300 disabled:cursor-not-allowed text-gray-700 font-semibold py-3 px-6 rounded-xl transition-colors"
              title={index === 0 ? '첫 문항입니다.' : '이전 문항으로 돌아갑니다.'}
            >
              ← 이전 문항
            </button>
            <button
              type="submit"
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-8 rounded-xl shadow transition-colors"
            >
              {isLastQuestion ? '제출하고 채점' : '다음'}
            </button>
          </div>
        </form>
        <p className="text-xs text-gray-400 mt-3">
          대소문자와 앞뒤 공백은 채점에 영향을 주지 않습니다.<br />
          이전 문항으로 돌아가 답을 고칠 수 있고, 채점은 마지막에 제출할 때 한 번에 합니다.
        </p>
      </div>
    </div>
  );
};

export default OnlineQuiz;
