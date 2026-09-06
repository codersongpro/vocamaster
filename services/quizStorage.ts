import { QuizRecord } from '../types';

const STORAGE_KEY = 'voca-master:quiz-history:v1';
// 브라우저 저장 용량 보호를 위해 최근 기록만 유지합니다.
const MAX_RECORDS = 20;

// localStorage 사용 불가 환경(시크릿 모드 등)에서도 앱이 죽지 않도록 모든 접근을 감쌉니다.
export const loadQuizHistory = (): QuizRecord[] => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((record): record is QuizRecord =>
      !!record &&
      typeof record.id === 'string' &&
      typeof record.takenAt === 'string' &&
      typeof record.total === 'number' &&
      typeof record.correct === 'number' &&
      Array.isArray(record.answers) &&
      Array.isArray(record.items)
    );
  } catch {
    return [];
  }
};

export const saveQuizRecord = (record: QuizRecord): QuizRecord[] => {
  const next = [record, ...loadQuizHistory()].slice(0, MAX_RECORDS);
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // 저장에 실패해도 현재 화면의 결과 표시는 그대로 진행합니다.
  }
  return next;
};

export const clearQuizHistory = (): void => {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // 무시
  }
};
