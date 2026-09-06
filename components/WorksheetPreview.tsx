import React, { useLayoutEffect, useRef, useState } from 'react';
import { VocabItem } from '../types';

interface WorksheetPreviewProps {
  items: VocabItem[];
  date: string;
}

/*
  A4 가로(297mm × 210mm) 인쇄 기준
  - 페이지 높이는 209mm로 잡아 브라우저 인쇄 시 1mm 반올림 오차를 흡수합니다.
  - 한 장에 최대 30단어(2열 × 15행)를 담고, 넘치면 다음 장으로 넘깁니다.
    20단어짜리 시험지는 문제지 1장 + 답안지 1장, 총 2장으로 나옵니다.
  - 내용을 자르지 않고, 표가 지면보다 길면 글자 크기를 자동으로 줄여 맞춥니다.
*/
const ITEMS_PER_PAGE = 30;
const BASE_FONT_PX = 11;
const MIN_FONT_PX = 5;

const paginate = (items: VocabItem[]): VocabItem[][] => {
  const pages: VocabItem[][] = [];
  for (let i = 0; i < items.length; i += ITEMS_PER_PAGE) {
    pages.push(items.slice(i, i + ITEMS_PER_PAGE));
  }
  return pages;
};

/*
  표 영역이 남은 지면보다 길면 글자 크기를 줄여 한 장에 들어가게 맞춥니다.
  내부 여백과 답 쓰는 칸을 em 단위로 잡아 두었기 때문에
  글자 크기만 줄이면 표 전체가 같은 비율로 작아집니다.
*/
const FitToPage: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [fontSize, setFontSize] = useState(BASE_FONT_PX);

  useLayoutEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const available = element.clientHeight;
    const needed = element.scrollHeight;
    // 아직 넘친다면 넘치는 비율만큼 글자를 줄입니다. 맞으면 더 이상 갱신하지 않아 재계산이 멈춥니다.
    if (needed > available && fontSize > MIN_FONT_PX) {
      const next = Math.max(MIN_FONT_PX, fontSize * (available / needed) * 0.98);
      if (next < fontSize - 0.05) setFontSize(next);
    }
  });

  return (
    <div ref={containerRef} className="flex-1 min-h-0 overflow-hidden" style={{ fontSize: `${fontSize}px` }}>
      {children}
    </div>
  );
};

const WorksheetPreview: React.FC<WorksheetPreviewProps> = ({ items, date }) => {
  const pages = paginate(items);

  /*
    fillPage 가 true 면 표가 남은 지면을 채우도록 늘어납니다.
    (행 간격이 벌어져 답 쓰는 칸이 넓어집니다)
  */
  const renderTable = (data: VocabItem[], startIndex: number, isAnswerKey: boolean, fillPage: boolean) => (
    <table className={`w-full border-collapse table-fixed ${fillPage ? 'h-full' : ''}`}>
      <thead>
        <tr className={`border-b-2 ${isAnswerKey ? 'border-red-300 bg-red-50' : 'border-gray-800'}`}>
          <th
            className={`text-left w-[10%] font-bold ${isAnswerKey ? 'text-red-800' : 'text-black'}`}
            style={{ padding: '0.35em 0.5em' }}
          >
            No.
          </th>
          <th
            className={`text-left w-[60%] font-bold ${isAnswerKey ? 'text-red-800' : 'text-black'}`}
            style={{ padding: '0.35em 0.5em' }}
          >
            {isAnswerKey ? 'English Definition / 한글 뜻' : 'English Definition'}
          </th>
          <th
            className={`text-left w-[30%] font-bold ${isAnswerKey ? 'text-red-800' : 'text-black'}`}
            style={{ padding: '0.35em 0.5em' }}
          >
            {isAnswerKey ? 'Answer' : 'Word'}
          </th>
        </tr>
      </thead>
      <tbody>
        {data.map((item, index) => (
          <tr key={item.id} className={`border-b ${isAnswerKey ? 'border-red-100' : 'border-gray-300'}`}>
            <td
              className={`align-middle ${isAnswerKey ? 'text-red-400' : 'text-gray-500'}`}
              style={{ padding: '0.35em 0.5em' }}
            >
              {startIndex + index + 1}
            </td>
            {/* 내용을 자르지 않고 그대로 보여줍니다. 길면 FitToPage 가 글자 크기를 줄입니다. */}
            <td className="align-middle text-gray-900 leading-snug" style={{ padding: '0.35em 0.5em' }}>
              <div className="font-medium break-words">{item.definition}</div>
              {/* 한글 해석은 답안지에만 노출합니다. */}
              {isAnswerKey && <div className="text-blue-700 break-words">{item.koreanDefinition}</div>}
            </td>
            <td
              className={`align-middle ${isAnswerKey ? 'font-bold text-gray-900 break-words' : ''}`}
              style={{ padding: '0.35em 0.5em' }}
            >
              {isAnswerKey ? (
                item.word
              ) : (
                // 답을 쓰는 칸. em 단위라 글자 크기가 줄면 칸도 같은 비율로 줄어듭니다.
                <div className="border-b border-gray-500 w-full" style={{ height: '2.2em' }} />
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  // 한 장(문제지 또는 답안지)을 그립니다.
  const renderPage = (pageItems: VocabItem[], pageIndex: number, isAnswerKey: boolean, isLastPage: boolean) => {
    const startIndex = pageIndex * ITEMS_PER_PAGE;
    const midPoint = Math.ceil(pageItems.length / 2);
    const leftItems = pageItems.slice(0, midPoint);
    const rightItems = pageItems.slice(midPoint);
    const pageId = isAnswerKey ? `page-answer-${pageIndex}` : `page-test-${pageIndex}`;
    /*
      단어가 어느 정도 차 있는 장은 표를 늘려 지면을 채웁니다.
      항목이 몇 개뿐인 마지막 장까지 늘리면 행 하나가 지나치게 커지므로 제외합니다.
    */
    const fillPage = pageItems.length >= ITEMS_PER_PAGE / 2;

    return (
      <div
        key={pageId}
        id={pageId}
        data-worksheet-page={isAnswerKey ? 'answer' : 'test'}
        className="w-[297mm] h-[209mm] p-[12mm] bg-white box-border overflow-hidden flex flex-col"
        // 마지막 장 뒤에는 강제 개행을 넣지 않아 빈 페이지가 인쇄되지 않게 합니다.
        style={isLastPage ? undefined : { breakAfter: 'page', pageBreakAfter: 'always' }}
      >
        <div className="border-b-2 border-black pb-2 mb-3 flex justify-between items-end shrink-0">
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
              Page {pageIndex + 1} / {pages.length}
            </p>
          </div>
        </div>

        <FitToPage>
          <div className={`grid grid-cols-2 gap-10 ${fillPage ? 'h-full' : 'items-start'}`}>
            <div className={fillPage ? 'h-full' : ''}>
              {renderTable(leftItems, startIndex, isAnswerKey, fillPage)}
            </div>
            <div className={fillPage ? 'h-full' : ''}>
              {rightItems.length > 0
                ? renderTable(rightItems, startIndex + midPoint, isAnswerKey, fillPage)
                : null}
            </div>
          </div>
        </FitToPage>
      </div>
    );
  };

  return (
    <div className="w-[297mm] bg-white text-black">
      {pages.map((pageItems, index) => renderPage(pageItems, index, false, false))}
      {pages.map((pageItems, index) => renderPage(pageItems, index, true, index === pages.length - 1))}
    </div>
  );
};

export default WorksheetPreview;
