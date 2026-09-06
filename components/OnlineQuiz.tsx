import React, { useMemo, useState } from 'react';
import { QuizAnswer, QuizRecord, VocabItem } from '../types';
import { saveQuizRecord } from '../services/quizStorage';

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

// 대소문자, 앞뒤 공백, 중복 공백을 무시하고 채점합니다.
const normalize = (value: string) => value.trim().toLowerCase().replace(/\s+/g, ' ');

const OnlineQuiz: React.FC<OnlineQuizProps> = ({ items, onFinished, onExit }) => {
  // round가 바뀌면 문제 순서를 새로 섞습니다. (다시 풀기)
  const [round, setRound] = useState(0);
  const questions = useMemo(() => shuffle(items), [items, round]);

  const [index, setIndex] = useState(0);
  const [input, setInput] = useState('');
  const [answers, setAnswers] = useState<QuizAnswer[]>([]);
  const [record, setRecord] = useState<QuizRecord | null>(null);

  const current = questions[index];

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!current) return;

    const answer: QuizAnswer = {
      word: current.word,
      definition: current.definition,
      koreanDefinition: current.koreanDefinition,
      userAnswer: input.trim(),
      isCorrect: normalize(input) === normalize(current.word),
    };
    const nextAnswers = [...answers, answer];
    setAnswers(nextAnswers);
    setInput('');

    if (index + 1 < questions.length) {
      setIndex(index + 1);
      return;
    }

    const finished: QuizRecord = {
      id: `quiz-${Date.now()}`,
      takenAt: new Date().toISOString(),
      total: nextAnswers.length,
      correct: nextAnswers.filter((item) => item.isCorrect).length,
      answers: nextAnswers,
      items,
    };
    saveQuizRecord(finished);
    setRecord(finished);
    onFinished(finished);
  };

  const handleRetry = () => {
    setRound(round + 1);
    setIndex(0);
    setInput('');
    setAnswers([]);
    setRecord(null);
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
          </span>
          <button onClick={onExit} className="underline hover:text-gray-800 transition-colors">
            그만하기
          </button>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-8">
          <div className="h-full bg-blue-600 transition-all duration-300" style={{ width: `${progress}%` }} />
        </div>

        <p className="text-xs text-gray-400 mb-2">English Definition</p>
        <p className="text-xl sm:text-2xl font-semibold text-gray-900 leading-relaxed mb-8 break-words">
          {current.definition}
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            autoFocus
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="영어 단어를 입력하세요"
            className="flex-1 border-2 border-gray-200 focus:border-blue-500 outline-none rounded-xl px-4 py-3 text-lg transition-colors"
          />
          <button
            type="submit"
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-8 rounded-xl shadow transition-colors"
          >
            {index + 1 === questions.length ? '제출하고 채점' : '다음'}
          </button>
        </form>
        <p className="text-xs text-gray-400 mt-3">대소문자와 앞뒤 공백은 채점에 영향을 주지 않습니다.</p>
      </div>
    </div>
  );
};

export default OnlineQuiz;
