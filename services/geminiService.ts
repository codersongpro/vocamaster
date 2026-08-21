import { VocabItem, FilePart } from "../types";

async function request<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof data.error === 'string' ? data.error : '요청에 실패했습니다.');
  return data as T;
}

export const extractVocabularyFromFiles = async (files: FilePart[]): Promise<VocabItem[]> => {
  const result = await request<{ items: Array<{ word: string; definition: string; koreanDefinition: string }> }>('/api/extract', { files });
  return result.items.map((item, index) => ({
    id: `vocab-${index}-${Date.now()}`,
    word: item.word,
    definition: item.definition,
    koreanDefinition: item.koreanDefinition,
  }));
};

export const generateSpeechForWord = async (text: string): Promise<string> => {
  const result = await request<{ audioData: string }>('/api/speech', { text });
  return result.audioData;
};

