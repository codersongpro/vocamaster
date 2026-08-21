export const MAX_FILES = 5;
export const MAX_FILE_BASE64_LENGTH = 3_000_000;
export const MAX_TOTAL_BASE64_LENGTH = 4_000_000;

function isBase64(value) {
  return typeof value === 'string' && value.length > 0 && value.length % 4 === 0 && /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value);
}

export function validateFileParts(files) {
  if (!Array.isArray(files) || files.length === 0 || files.length > MAX_FILES) {
    throw new Error(`파일은 1개에서 ${MAX_FILES}개까지 업로드할 수 있습니다.`);
  }

  let totalLength = 0;
  const normalized = files.map((file) => {
    if (!file || typeof file.mimeType !== 'string' || typeof file.data !== 'string') {
      throw new Error('파일 데이터 형식이 올바르지 않습니다.');
    }
    const supported = file.mimeType === 'application/pdf' || file.mimeType.startsWith('image/');
    if (!supported) throw new Error('지원하지 않는 파일 형식입니다.');
    if (!isBase64(file.data)) throw new Error('파일 데이터가 올바르지 않습니다.');
    if (file.data.length > MAX_FILE_BASE64_LENGTH) throw new Error('파일 크기가 너무 큽니다.');
    totalLength += file.data.length;
    return { mimeType: file.mimeType, data: file.data };
  });

  if (totalLength > MAX_TOTAL_BASE64_LENGTH) throw new Error('전체 파일 크기가 너무 큽니다.');
  return normalized;
}

export function validateWord(value) {
  if (typeof value !== 'string') throw new Error('단어 형식이 올바르지 않습니다.');
  const word = value.trim();
  if (word.length === 0 || word.length > 200) throw new Error('단어 길이가 올바르지 않습니다.');
  return word;
}

export function normalizeVocabularyItem(item) {
  if (!item || typeof item.word !== 'string' || typeof item.definition !== 'string' || typeof item.koreanDefinition !== 'string') {
    throw new Error('응답 데이터가 올바르지 않습니다.');
  }
  const word = item.word.trim();
  const definition = item.definition.trim();
  const koreanDefinition = item.koreanDefinition.trim();
  if (!word || word.length > 200 || !definition || definition.length > 2_000) {
    throw new Error('응답 데이터 길이가 올바르지 않습니다.');
  }
  if (!koreanDefinition || koreanDefinition.length > 2_000) {
    throw new Error('한글 뜻이 올바르지 않습니다.');
  }
  return { word, definition, koreanDefinition };
}

