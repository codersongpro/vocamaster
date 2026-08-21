import React from 'react';
import { VocabItem } from '../types';

interface WorksheetPreviewProps {
  items: VocabItem[];
  date: string;
}

const WorksheetPreview: React.FC<WorksheetPreviewProps> = ({ items, date }) => {
  // Split items into two columns for Landscape layout
  const midPoint = Math.ceil(items.length / 2);
  const leftItems = items.slice(0, midPoint);
  const rightItems = items.slice(midPoint);

  const renderTable = (data: VocabItem[], startIndex: number, isAnswerKey: boolean) => (
    <table className="w-full h-full border-collapse text-sm table-fixed">
      <thead>
        <tr className={`h-10 border-b-2 ${isAnswerKey ? 'border-red-200 bg-red-50' : 'border-gray-800'}`}>
          <th className={`py-2 px-2 text-left w-[10%] font-bold ${isAnswerKey ? 'text-red-800' : 'text-black'}`}>No.</th>
          <th className={`py-2 px-2 text-left w-[65%] font-bold ${isAnswerKey ? 'text-red-800' : 'text-black'}`}>English Definition / 한글 뜻</th>
          <th className={`py-2 px-2 text-left w-[25%] font-bold ${isAnswerKey ? 'text-red-800' : 'text-black'}`}>
            {isAnswerKey ? 'Answer' : 'Word'}
          </th>
        </tr>
      </thead>
      <tbody>
        {data.map((item, index) => (
          <tr key={item.id} className={`border-b ${isAnswerKey ? 'border-red-100' : 'border-gray-300'}`}>
            <td className={`py-2 px-2 align-middle ${isAnswerKey ? 'text-red-400' : 'text-gray-500'}`}>{startIndex + index + 1}</td>
            <td className="py-2 px-2 font-medium text-gray-900 align-middle break-words whitespace-normal leading-snug">
              <div>{item.definition}</div>
              <div className="text-blue-700 mt-1">{item.koreanDefinition}</div>
            </td>
            <td className={`py-2 px-2 align-middle ${isAnswerKey ? 'font-bold text-gray-900' : ''}`}>
              {isAnswerKey ? (
                item.word
              ) : (
                <div className="border-b-2 border-gray-400 w-full h-8"></div>
              )}
            </td>
          </tr>
        ))}
        {/* 
            If data is shorter than the other column, the table will still stretch h-full, 
            making these rows taller. This ensures both tables visually fill the page.
        */}
      </tbody>
    </table>
  );

  return (
    <div className="w-[297mm] bg-white text-black">
      {/* Test Page - A4 Landscape (297mm x 210mm) */}
      <div id="page-test" className="w-[297mm] h-[210mm] p-[15mm] relative bg-white box-border overflow-hidden flex flex-col">
        {/* Header */}
        <div className="border-b-2 border-black pb-2 mb-4 flex justify-between items-end shrink-0">
          <div>
            <h1 className="text-2xl font-bold mb-1 text-black">나만의 단어 테스트</h1>
            <p className="text-xs text-gray-600">Created by Voca Master</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-medium text-black">Date: {date}</p>
            <p className="text-sm font-medium text-black">Score: _____ / {items.length}</p>
          </div>
        </div>

        {/* 2-Column Grid */}
        <div className="flex-1 grid grid-cols-2 gap-12 h-full">
            <div className="h-full">
                {renderTable(leftItems, 0, false)}
            </div>
            <div className="h-full">
                {renderTable(rightItems, midPoint, false)}
            </div>
        </div>
      </div>

      {/* Answer Key Page - A4 Landscape */}
      <div id="page-answer" className="w-[297mm] h-[210mm] p-[15mm] relative bg-white box-border overflow-hidden flex flex-col" style={{ pageBreakBefore: 'always' }}>
        <div className="border-b-2 border-black pb-2 mb-4 shrink-0">
          <h1 className="text-xl font-bold text-red-600">정답지 (Answer Key)</h1>
          <p className="text-xs text-gray-600">{date}</p>
        </div>

        <div className="flex-1 grid grid-cols-2 gap-12 h-full">
            <div className="h-full">
                {renderTable(leftItems, 0, true)}
            </div>
            <div className="h-full">
                {renderTable(rightItems, midPoint, true)}
            </div>
        </div>
      </div>
    </div>
  );
};

export default WorksheetPreview;

