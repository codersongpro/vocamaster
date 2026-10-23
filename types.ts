export interface VocabItem {
  id: string;
  word: string;
  definition: string;
  koreanDefinition: string;
}

export type ProcessingStatus = 'idle' | 'analyzing' | 'generating_audio' | 'complete' | 'error';

export interface ExtractedData {
  items: VocabItem[];
}

export interface FilePart {
  mimeType: string;
  data: string; // base64 string
}

// 온라인 테스트에서 문항 하나의 채점 결과
export interface QuizAnswer {
  word: string;
  definition: string;
  koreanDefinition: string;
  userAnswer: string;
  isCorrect: boolean;
}

// 풀다가 멈춘 온라인 테스트 (브라우저 localStorage에 임시 보관)
export interface QuizProgress {
  savedAt: string; // ISO 문자열
  index: number; // 마지막으로 보고 있던 문항 번호 (0부터)
  answers: string[]; // 문항 번호와 같은 자리에 적어둔 답
  questions: VocabItem[]; // 출제된 순서 그대로
}

// 온라인 테스트 1회분 기록 (브라우저 localStorage에 저장)
export interface QuizRecord {
  id: string;
  takenAt: string; // ISO 문자열
  total: number;
  correct: number;
  answers: QuizAnswer[];
  // 같은 단어 세트로 다시 풀 수 있도록 출제 단어를 함께 보관합니다.
  items: VocabItem[];
}

