import { GoogleGenAI, Type } from '@google/genai';
import { isAuthenticated } from './_auth.js';
import { clientKey, readJson, sendJson } from './_http.js';
import { allowRequest } from './_rate-limit.js';
import { normalizeVocabularyItem, validateFileParts } from './_validation.js';

const SYSTEM_INSTRUCTION = `
당신은 사용자가 업로드한 여러 장의 이미지 또는 PDF 문서를 분석하여 '단어 학습용 테스트지'를 제작하기 위한 데이터를 추출하는 OCR 전문 AI입니다.
문서에 실제로 보이는 영어 단어와 영어 뜻을 추출하십시오. 중복 단어는 하나로 합치고 JSON 배열만 반환하십시오.

koreanDefinition 작성 규칙:
- 영어 정의를 문장으로 직역하지 말고, 한국 영어 단어장에 실리는 방식의 '단어 뜻'을 쓰십시오.
- 품사에 맞는 우리말 어미로 끝내십시오. 동사는 '~하다', 형용사는 '~한/~인', 명사는 명사형으로 씁니다.
- 뜻이 여러 개면 쉼표로 2~3개까지만 나열하십시오. 가장 자주 쓰이는 뜻을 앞에 둡니다.
- 다음과 같은 번역투 설명문은 절대 쓰지 마십시오.
  금지: '~하는 것을 의미한다', '~인 사람을 가리킨다', '~라는 뜻이다', '~하는 행위', '~되어지다'
- 교과서와 사전에서 실제로 쓰는 표현을 고르고, 초등·중학생이 바로 이해할 수 있는 쉬운 우리말을 씁니다.
- 예시
  abandon (to leave someone or something completely) -> '버리다, 포기하다'
  fragile (easily broken or damaged) -> '깨지기 쉬운, 연약한'
  architect (a person who designs buildings) -> '건축가'
  generous (willing to give money or help) -> '너그러운, 인색하지 않은'
`;

function parseVocabulary(response) {
  const parsed = JSON.parse(response.text || '');
  if (!Array.isArray(parsed) || parsed.length > 200) throw new Error('응답 형식이 올바르지 않습니다.');
  return parsed.map((item) => {
    return normalizeVocabularyItem(item);
  });
}

export default async function handler(request, response) {
  if (request.method !== 'POST') return sendJson(response, 405, { error: '허용되지 않는 요청입니다.' }, { Allow: 'POST' });
  if (!isAuthenticated(request)) return sendJson(response, 401, { error: '인증이 필요합니다.' });
  if (!allowRequest(`extract:${clientKey(request)}`, 20, 10 * 60 * 1000)) return sendJson(response, 429, { error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' });
  if (!process.env.GEMINI_API_KEY) return sendJson(response, 503, { error: 'AI 설정이 완료되지 않았습니다.' });

  try {
    const body = readJson(request);
    const files = validateFileParts(body.files);
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const contents = {
      parts: [
        ...files.map((file) => ({ inlineData: file })),
        { text: "Extract the combined vocabulary list. Return a JSON array where each object has 'word', 'definition' in English, and 'koreanDefinition'. For 'koreanDefinition', write the natural Korean dictionary gloss for the word itself (e.g. '버리다, 포기하다'), not a translated sentence of the English definition." },
      ],
    };
    const config = {
      systemInstruction: SYSTEM_INSTRUCTION,
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: { word: { type: Type.STRING }, definition: { type: Type.STRING }, koreanDefinition: { type: Type.STRING } },
          required: ['word', 'definition', 'koreanDefinition'],
        },
      },
    };
    let result;
    try {
      result = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents, config });
    } catch {
      result = await ai.models.generateContent({ model: 'gemini-1.5-flash', contents, config });
    }
    return sendJson(response, 200, { items: parseVocabulary(result) });
  } catch {
    return sendJson(response, 400, { error: '파일 분석에 실패했습니다.' });
  }
}

