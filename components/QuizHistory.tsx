import React from 'react';
import { QuizRecord, VocabItem } from '../types';

interface QuizHistoryProps {
  records: QuizRecord[];
  onRetake: (items: VocabItem[]) => void;
  onClear: () => void;
  onExit: () => void;
}

const formatDate = (iso: string) => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const QuizHistory: React.FC<QuizHistoryProps> = ({ records, onRetake, onClear, onExit }) => {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <div className="flex flex-wrap justify-between items-center gap-3 mb-2">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <span>📈</span> 테스트 기록
          </h2>
          <div className="flex gap-2">
            <button
              onClick={onExit}
              className="text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-2 px-4 rounded-lg transition-colors"
            >
              돌아가기
            </button>
            {records.length > 0 && (
              <button
                onClick={() => {
                  if (window.confirm('저장된 테스트 기록을 모두 삭제할까요?')) onClear();
                }}
                className="text-sm bg-gray-100 hover:bg-red-50 text-gray-600 hover:text-red-600 font-medium py-2 px-4 rounded-lg transition-colors"
              >
                기록 전체 삭제
              </button>
            )}
          </div>
        </div>
        <p className="text-sm text-gray-500">
          기록은 이 브라우저에만 저장되며 최근 20회까지 보관됩니다. 기록의 단어 세트로 언제든 다시 응시할 수 있습니다.
        </p>
      </div>

      {records.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center text-gray-500">
          아직 저장된 테스트 기록이 없습니다.
        </div>
      ) : (
        <ul className="space-y-3">
          {records.map((record) => {
            const rate = Math.round((record.correct / record.total) * 100);
            const wrongWords = record.answers.filter((answer) => !answer.isCorrect).map((answer) => answer.word);
            return (
              <li key={record.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                <div className="flex flex-wrap justify-between items-start gap-4">
                  <div className="min-w-0">
                    <p className="text-sm text-gray-500 mb-1">{formatDate(record.takenAt)}</p>
                    <p className="text-lg font-bold text-gray-900">
                      {record.correct} / {record.total}
                      <span className={`ml-2 text-sm font-semibold ${rate >= 80 ? 'text-green-600' : 'text-orange-500'}`}>
                        정답률 {rate}%
                      </span>
                    </p>
                    {wrongWords.length > 0 && (
                      <p className="text-sm text-gray-500 mt-2 break-words">
                        <span className="text-red-500 font-medium">틀린 단어 </span>
                        {wrongWords.join(', ')}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => onRetake(record.items)}
                    className="shrink-0 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold py-2 px-4 rounded-lg shadow-sm transition-colors"
                  >
                    이 세트 다시 풀기
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default QuizHistory;
