/*
  문항(문제지·온라인 테스트)에서 정답 단어가 노출되지 않게 가리는 모듈입니다.

  단어장에 인쇄된 영어 뜻에는 표제어가 그대로 들어 있는 경우가 많습니다.
  (예: architect - an architect designs buildings)
  AI에게 "뜻에서 단어를 빼라"고 지시하면 뜻 자체가 바뀌므로,
  원문은 그대로 보관하고 문항을 보여주는 순간에만 코드로 가립니다.

  가리는 범위
  - 표제어와 대소문자가 다른 표기
  - 흔한 어형 변화 (-s, -es, -ed, -ing, -er, -est, -ly, -ion, 소유격 등)
  - 어간 변형 (make → making, happy → happier, run → running)
  - 구 단어(give up)는 구 전체와 3글자 이상인 각 낱말
*/

export const BLANK = '______';

// 어간에 붙여서 같은 단어로 볼 접미사 (빈 문자열은 어간 그 자체)
const SUFFIXES = [
  '', 's', 'es', 'ed', 'ing', 'ings', 'er', 'ers', 'est', 'ly',
  'ies', 'ion', 'ions', 'ment', 'ments', 'ness', 'ful', 'able', 'ible', 'al', 'ive', 'y',
];
// 'd'는 e로 끝나는 어간에서만 허용합니다. (live → lived / ten → tend 오탐 방지)
const SUFFIX_SET = new Set(SUFFIXES);
const SUFFIX_SET_WITH_D = new Set([...SUFFIXES, 'd']);

// 어형 변화까지 함께 가리려면 어간이 최소 3글자는 되어야 합니다.
// (be, go 같은 2글자 단어까지 확장하면 엉뚱한 낱말이 가려집니다)
const MIN_INFLECTION_LENGTH = 3;

const letters = (value) => String(value).toLowerCase().replace(/[^a-z]/g, '');

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// 한 낱말에서 어형 변화의 출발점이 되는 어간들을 만듭니다.
function stemsOf(token) {
  const base = letters(token);
  if (!base) return [];
  const stems = new Set([base]);
  if (base.length >= MIN_INFLECTION_LENGTH) {
    // make → mak(ing)
    if (base.endsWith('e')) stems.add(base.slice(0, -1));
    // happy → happi(er)
    if (base.endsWith('y')) stems.add(`${base.slice(0, -1)}i`);
    // run → runn(ing) : 모음·y·w·x로 끝나거나 이미 겹친 자음은 제외
    const last = base[base.length - 1];
    if (!'aeiouywx'.includes(last) && last !== base[base.length - 2]) stems.add(base + last);
  }
  return [...stems];
}

function matchesStems(token, stems, allowInflection) {
  const value = letters(token);
  if (!value) return false;
  return stems.some((stem) => {
    if (value === stem) return true;
    if (!allowInflection || !value.startsWith(stem)) return false;
    const suffixes = stem.endsWith('e') ? SUFFIX_SET_WITH_D : SUFFIX_SET;
    return suffixes.has(value.slice(stem.length));
  });
}

// 구 단어(give up, look after)는 공백·하이픈 표기가 달라도 한 덩어리로 가립니다.
function phrasePattern(tokens) {
  const body = tokens
    .map((token) => {
      const stems = stemsOf(token).sort((a, b) => b.length - a.length).map(escapeRegExp);
      return `(?:${stems.join('|')})(?:${SUFFIXES.filter(Boolean).join('|')}|d)?`;
    })
    .join('[\\s-]+');
  // 앞 경계는 직접 잡아둔 문자로 확인합니다. (lookbehind 미지원 브라우저 대비)
  return new RegExp(`(^|[^A-Za-z])(${body})(?![A-Za-z])`, 'gi');
}

/**
 * 영어 뜻에서 정답 단어를 빈칸으로 바꿉니다.
 * @param {string} text 문항으로 보여줄 영어 뜻
 * @param {string} word 정답 단어
 * @returns {string} 정답 단어가 가려진 문장
 */
export function maskWord(text, word) {
  if (typeof text !== 'string' || text.length === 0) return '';
  if (typeof word !== 'string' || !letters(word)) return text;

  const tokens = word.split(/[\s-]+/).filter((token) => letters(token));
  if (tokens.length === 0) return text;

  let result = text;
  if (tokens.length > 1) result = result.replace(phrasePattern(tokens), (_match, prefix) => `${prefix}${BLANK}`);

  // 구 단어는 의미 있는 낱말(3글자 이상)만 따로 가려서 전치사까지 지워지지 않게 합니다.
  const singles = tokens.length === 1 ? tokens : tokens.filter((token) => letters(token).length >= MIN_INFLECTION_LENGTH);
  const matchers = singles.map((token) => ({
    stems: stemsOf(token),
    allowInflection: letters(token).length >= MIN_INFLECTION_LENGTH,
  }));
  if (matchers.length === 0) return result;

  // 낱말 단위로 끊어서 비교하므로 단어 경계를 따로 계산할 필요가 없습니다.
  return result.replace(/[A-Za-z][A-Za-z'’]*/g, (token) =>
    matchers.some((matcher) => matchesStems(token, matcher.stems, matcher.allowInflection)) ? BLANK : token,
  );
}

/**
 * 영어 뜻 안에 정답 단어가 들어 있는지 확인합니다. (검증 화면 안내용)
 * @param {string} text
 * @param {string} word
 */
export function revealsWord(text, word) {
  return maskWord(text, word) !== text;
}
