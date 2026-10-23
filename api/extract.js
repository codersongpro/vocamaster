import { GoogleGenAI, Type } from '@google/genai';
import { isAuthenticated } from './_auth.js';
import { clientKey, readJson, sendJson } from './_http.js';
import { allowRequest } from './_rate-limit.js';
import { normalizeVocabularyItem, validateFileParts } from './_validation.js';

const SYSTEM_INSTRUCTION = `
당신은 사용자가 업로드한 여러 장의 이미지 또는 PDF 문서를 분석하여 '단어 학습용 테스트지'를 제작하기 위한 데이터를 추출하는 OCR 전문 AI입니다.
문서에 실제로 보이는 영어 단어와 영어 뜻을 추출하십시오. 중복 단어는 하나로 합치고 JSON 배열만 반환하십시오.

definition 규칙 (가장 중요, 예외 없음):
- definition 은 '문서에 인쇄된 영어 뜻을 그대로 옮긴 문자열'입니다. 당신이 쓰는 문장이 아닙니다.
- 다시 쓰기, 요약, 보충, 동의어 교체, 어순 변경, 관사 추가·삭제, 문법·철자 교정, 대소문자 변경을 모두 금지합니다.
- 줄바꿈으로 끊어진 한 문장을 공백 하나로 이어 붙이는 것만 허용합니다. 그 외에는 글자를 더하거나 빼지 마십시오.
- 영어 뜻이 문서에 보이지 않는 단어는 결과에서 제외하십시오. 영어 뜻을 새로 지어내지 마십시오.
- 영어 뜻 안에 표제어가 들어 있어도 지우거나 다른 말로 바꾸지 말고 문서 그대로 두십시오.
  문항에서 표제어를 가리는 처리는 앱이 직접 합니다.
- 글자를 알아볼 수 없어 추측해야 하는 단어는 넣지 마십시오.

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
        { text: "Extract the combined vocabulary list. Return a JSON array where each object has 'word', 'definition' in English, and 'koreanDefinition'. Copy 'definition' verbatim from the document: transcribe the printed English definition character for character and never rewrite, shorten, expand, correct or invent it. Join a definition split across lines with a single space. Skip any word whose English definition is not printed in the document. Keep the headword even if it appears inside its own definition. For 'koreanDefinition', write the natural Korean dictionary gloss for the word itself (e.g. '버리다, 포기하다'), not a translated sentence of the English definition." },
      ],
    };
    const config = {
      systemInstruction: SYSTEM_INSTRUCTION,
      // 영어 뜻을 문서 그대로 옮기게 하려고 창작 여지를 없앱니다. (같은 사진이면 같은 결과)
      temperature: 0,
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

