import { GoogleGenAI, Modality } from '@google/genai';
import { isAuthenticated } from './_auth.js';
import { clientKey, readJson, sendJson } from './_http.js';
import { allowRequest } from './_rate-limit.js';
import { validateWord } from './_validation.js';

export default async function handler(request, response) {
  if (request.method !== 'POST') return sendJson(response, 405, { error: '허용되지 않는 요청입니다.' }, { Allow: 'POST' });
  if (!isAuthenticated(request)) return sendJson(response, 401, { error: '인증이 필요합니다.' });
  if (!allowRequest(`speech:${clientKey(request)}`, 60, 10 * 60 * 1000)) return sendJson(response, 429, { error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' });
  if (!process.env.GEMINI_API_KEY) return sendJson(response, 503, { error: 'AI 설정이 완료되지 않았습니다.' });

  try {
    const text = validateWord(readJson(request).text);
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const result = await ai.models.generateContent({
      model: 'gemini-2.5-flash-preview-tts',
      contents: [{ parts: [{ text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } },
      },
    });
    const audioData = result.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (typeof audioData !== 'string' || audioData.length === 0 || audioData.length > 2_000_000) throw new Error('오디오 응답이 올바르지 않습니다.');
    return sendJson(response, 200, { audioData });
  } catch {
    return sendJson(response, 400, { error: '오디오 생성에 실패했습니다.' });
  }
}

