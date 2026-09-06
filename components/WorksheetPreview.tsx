import React from 'react';
import { VocabItem } from '../types';

interface WorksheetPreviewProps {
  items: VocabItem[];
  date: string;
}

/*
  A4 가로 기준 지면 계산 (페이지 높이는 209mm로 잡아 인쇄 오차 1mm를 흡수합니다)
  - 페이지 상하 패딩 12mm × 2        = 24mm
  - 제목 헤더 18mm + 아래 여백 3mm   = 21mm
  - 표 머리글                        =  9mm
  - 본문에 남는 높이 209-24-21-9     = 155mm  → 이 안에 들어가도록 행 수를 정합니다.

  답안지는 한글 해석이 한 줄 더 들어가므로 행을 더 높게 잡고 장당 단어 수를 줄입니다.
  번호는 전체 목록 기준이라 문제지와 답안지의 장수가 달라도 서로 대응됩니다.
*/
const LAYOUT = {
  // 12행 × 12mm = 144mm
  test: { rowsPerColumn: 12, rowHeight: '12mm', cellMaxHeight: '9mm' },
  // 9행 × 16mm = 144mm
  answer: { rowsPerColumn: 9, rowHeight: '16mm', cellMaxHeight: '13mm' },
} as const;

const itemsPerPage = (isAnswerKey: boolean) =>
  (isAnswerKey ? LAYOUT.answer.rowsPerColumn : LAYOUT.test.rowsPerColumn) * 2;

// 한글은 영문자의 약 2배 폭을 차지하므로 가중치를 두어 글자 수를 셉니다.
const visualLength = (text: string) =>
  [...text].reduce((sum, char) => sum + (/[가-힣ㄱ-ㅎㅏ-ㅣ]/.test(char) ? 2 : 1), 0);

// 뜻이 길어도 셀 안에서 잘리지 않도록 글자 크기를 단계적으로 줄입니다.
const fontSizeFor = (item: { definition: string; koreanDefinition: string }, isAnswerKey: boolean) => {
  const length = visualLength(item.definition) + (isAnswerKey ? visualLength(item.koreanDefinition) : 0);
  if (length <= 70) return '11px';
  if (length <= 110) return '9.5px';
  return '8px';
};

// 페이지 단위로 단어를 잘라 담습니다.
const paginate = (items: VocabItem[], perPage: number): VocabItem[][] => {
  const pages: VocabItem[][] = [];
  for (let i = 0; i < items.length; i += perPage) {
    pages.push(items.slice(i, i + perPage));
  }
  return pages;
};

const WorksheetPreview: React.FC<WorksheetPreviewProps> = ({ items, date }) => {
  const testPages = paginate(items, itemsPerPage(false));
  const answerPages = paginate(items, itemsPerPage(true));

  const renderTable = (data: VocabItem[], startIndex: number, isAnswerKey: boolean) => {
    const layout = isAnswerKey ? LAYOUT.answer : LAYOUT.test;
    return (
    <table className="w-full border-collapse text-[11px] table-fixed">
      <thead>
        <tr
          className={`border-b-2 ${isAnswerKey ? 'border-red-300 bg-red-50' : 'border-gray-800'}`}
          style={{ height: '9mm' }}
        >
          <th className={`py-1 px-2 text-left w-[10%] font-bold ${isAnswerKey ? 'text-red-800' : 'text-black'}`}>No.</th>
          <th className={`py-1 px-2 text-left w-[60%] font-bold ${isAnswerKey ? 'text-red-800' : 'text-black'}`}>
            {isAnswerKey ? 'English Definition / 한글 뜻' : 'English Definition'}
          </th>
          <th className={`py-1 px-2 text-left w-[30%] font-bold ${isAnswerKey ? 'text-red-800' : 'text-black'}`}>
            {isAnswerKey ? 'Answer' : 'Word'}
          </th>
        </tr>
      </thead>
      <tbody>
        {data.map((item, index) => (
          <tr
            key={item.id}
            className={`border-b ${isAnswerKey ? 'border-red-100' : 'border-gray-300'}`}
            style={{ height: layout.rowHeight }}
          >
            <td className={`py-1 px-2 align-middle ${isAnswerKey ? 'text-red-400' : 'text-gray-500'}`}>
              {startIndex + index + 1}
            </td>
            {/*
              행 높이를 mm로 고정하고 셀 내부를 overflow-hidden으로 막아
              내용이 길어져도 페이지 아래쪽이 밀려 잘리는 일이 없게 합니다.
            */}
            <td className="py-1 px-2 align-middle text-gray-900">
              <div
                className="overflow-hidden leading-tight"
                style={{ maxHeight: layout.cellMaxHeight, fontSize: fontSizeFor(item, isAnswerKey) }}
              >
                <div className="font-medium break-words">{item.definition}</div>
                {/* 한글 해석은 답안지에만 노출합니다. */}
                {isAnswerKey && (
                  <div className="text-blue-700 break-words">{item.koreanDefinition}</div>
                )}
              </div>
            </td>
            <td className={`py-1 px-2 align-middle ${isAnswerKey ? 'font-bold text-gray-900 break-words' : ''}`}>
              {isAnswerKey ? item.word : <div className="border-b border-gray-500 w-full" style={{ height: '7mm' }} />}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
    );
  };

  // 한 장(문제지 또는 답안지)을 그립니다.
  const renderPage = (
    pageItems: VocabItem[],
    pageIndex: number,
    totalPages: number,
    isAnswerKey: boolean,
    isLastPage: boolean
  ) => {
    const startIndex = pageIndex * itemsPerPage(isAnswerKey);
    const midPoint = Math.ceil(pageItems.length / 2);
    const leftItems = pageItems.slice(0, midPoint);
    const rightItems = pageItems.slice(midPoint);
    const pageId = isAnswerKey ? `page-answer-${pageIndex}` : `page-test-${pageIndex}`;

    return (
      // 높이를 209mm(A4 가로 210mm보다 1mm 작게)로 두어 브라우저 인쇄 시
      // 소수점 반올림으로 페이지가 넘어가며 아래쪽이 잘리는 것을 막습니다.
      <div
        key={pageId}
        id={pageId}
        data-worksheet-page={isAnswerKey ? 'answer' : 'test'}
        className="w-[297mm] h-[209mm] p-[12mm] bg-white box-border overflow-hidden flex flex-col"
        // 마지막 장 뒤에는 강제 개행을 넣지 않아 빈 페이지가 인쇄되지 않게 합니다.
        style={isLastPage ? undefined : { breakAfter: 'page', pageBreakAfter: 'always' }}
      >
        <div
          className="border-b-2 border-black pb-2 mb-3 flex justify-between items-end shrink-0"
          style={{ height: '18mm' }}
        >
          <div>
            <h1 className={`text-xl font-bold mb-0.5 ${isAnswerKey ? 'text-red-600' : 'text-black'}`}>
              {isAnswerKey ? '정답지 (Answer Key)' : '나만의 단어 테스트'}
            </h1>
            <p className="text-[10px] text-gray-600">Created by Voca Master</p>
          </div>
          <div className="text-right">
            <p className="text-xs font-medium text-black">Date: {date}</p>
            {!isAnswerKey && <p className="text-xs font-medium text-black">Score: _____ / {items.length}</p>}
            <p className="text-[10px] text-gray-500">
              Page {pageIndex + 1} / {totalPages}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-10">
          <div>{renderTable(leftItems, startIndex, isAnswerKey)}</div>
          <div>{rightItems.length > 0 ? renderTable(rightItems, startIndex + midPoint, isAnswerKey) : null}</div>
        </div>
      </div>
    );
  };

  return (
    <div className="w-[297mm] bg-white text-black">
      {testPages.map((pageItems, index) => renderPage(pageItems, index, testPages.length, false, false))}
      {answerPages.map((pageItems, index) =>
        renderPage(pageItems, index, answerPages.length, true, index === answerPages.length - 1)
      )}
    </div>
  );
};

export default WorksheetPreview;
