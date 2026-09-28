import React, { useEffect, useState, useRef } from 'react';
import { extractVocabularyFromFiles, generateSpeechForWord } from './services/geminiService';
import { playPCMData } from './services/audioUtils';
import { compressImageFile } from './services/imageUtils';
import { VocabItem, ProcessingStatus, FilePart, QuizRecord } from './types';
import { loadQuizHistory, clearQuizHistory } from './services/quizStorage';
import LoadingOverlay from './components/LoadingOverlay';
import WorksheetPreview from './components/WorksheetPreview';
import PasswordAuth from './components/PasswordAuth';
import OnlineQuiz from './components/OnlineQuiz';
import QuizHistory from './components/QuizHistory';
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

// 압축 후 전송 용량 한도 (서버 api/_validation.js의 base64 한도에 맞춘 값)
// base64 인코딩 시 용량이 약 1.33배가 되므로 원본 바이트 기준으로 환산했습니다.
const MAX_UPLOAD_FILE_BYTES = 2_000_000;
const MAX_UPLOAD_TOTAL_BYTES = 3_000_000;
// 압축 전 방어선 (브라우저 메모리 보호)
const MAX_ORIGINAL_TOTAL_BYTES = 60_000_000;
// 한 번에 분석할 수 있는 파일 수 (서버 api/_validation.js의 MAX_FILES와 같은 값)
const MAX_FILES = 5;

// 사용자에게 그대로 안내해도 되는 업로드 검증 오류
class UploadError extends Error {}

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  // 단계 상태: upload (업로드) -> verify (검증 및 수정) -> quiz (온라인 테스트) / history (기록)
  const [step, setStep] = useState<'upload' | 'verify' | 'quiz' | 'history'>('upload');
  // 처리 상태: idle | analyzing | generating_audio | error
  const [status, setStatus] = useState<ProcessingStatus>('idle');
  // 추출된 단어 목록
  const [vocabList, setVocabList] = useState<VocabItem[]>([]);
  // 음성 재생 캐시 (동일한 단어 반복 재생 시 재요청 방지)
  const [audioCache, setAudioCache] = useState<Record<string, string>>({});
  // 현재 음성 재생 중인 단어 아이디
  const [playingId, setPlayingId] = useState<string | null>(null);
  // 온라인 테스트에 출제할 단어 세트 (기록에서 재응시하면 그 세트로 바뀝니다)
  const [quizItems, setQuizItems] = useState<VocabItem[]>([]);
  // 브라우저에 저장된 테스트 기록
  const [quizHistory, setQuizHistory] = useState<QuizRecord[]>([]);

  // 분석을 기다리는 사진·파일 목록 (촬영/선택할 때마다 쌓입니다)
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  // 목록에 보여줄 미리보기 URL
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // 대기 목록이 바뀔 때마다 미리보기 URL을 만들고, 교체 시 이전 URL을 해제합니다.
  useEffect(() => {
    const urls = pendingFiles.map((file) =>
      file.type.startsWith('image/') ? URL.createObjectURL(file) : ''
    );
    setPreviewUrls(urls);
    return () => urls.forEach((url) => url && URL.revokeObjectURL(url));
  }, [pendingFiles]);

  useEffect(() => {
    fetch('/api/session', { credentials: 'same-origin' })
      .then((response) => setIsAuthenticated(response.ok))
      .catch(() => setIsAuthenticated(false))
      .finally(() => setIsCheckingAuth(false));
  }, []);

  // 저장된 테스트 기록을 처음 한 번 불러옵니다.
  useEffect(() => {
    setQuizHistory(loadQuizHistory());
  }, []);

  const handleLockScreen = async () => {
    await fetch('/api/logout', { method: 'POST', credentials: 'same-origin' }).catch(() => undefined);
    setIsAuthenticated(false);
  };

  // 파일을 Base64 문자열로 변환하는 도우미 함수
  const readFileAsBase64 = (file: File): Promise<FilePart> => {
    return new Promise((resolve, reject) => {
      if (!(file.type === 'application/pdf' || file.type.startsWith('image/'))) {
        reject(new Error('지원하지 않는 파일 형식입니다.'));
        return;
      }
      if (file.size > MAX_UPLOAD_FILE_BYTES) {
        reject(new UploadError('파일 하나의 용량이 너무 큽니다. 해상도가 낮은 사진으로 다시 시도해주세요.'));
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        // Data URL 접두사(예: "data:image/png;base64,")를 제거하여 순수 base64 데이터만 추출합니다.
        const base64Content = base64String.split(',')[1];
        resolve({
          mimeType: file.type,
          data: base64Content
        });
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // 배열을 무작위로 섞는 셔플 함수 (시험지 제작 시 순서를 섞기 위함)
  const shuffleArray = <T,>(array: T[]): T[] => {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
  };

  /*
    촬영·선택한 파일을 대기 목록에 추가합니다.
    모바일 카메라는 한 번에 한 장만 넘겨주므로, 촬영을 반복해 여러 장을 쌓을 수 있도록
    선택 즉시 분석하지 않고 목록에 모아둡니다.
  */
  const handleAddFiles = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      const incoming = Array.from(files) as File[];
      setPendingFiles((prev) => {
        const room = MAX_FILES - prev.length;
        if (room <= 0) {
          alert(`파일은 최대 ${MAX_FILES}장까지 담을 수 있습니다.`);
          return prev;
        }
        if (incoming.length > room) {
          alert(`파일은 최대 ${MAX_FILES}장까지 담을 수 있어 ${room}장만 추가했습니다.`);
        }
        return [...prev, ...incoming.slice(0, room)];
      });
    }
    // 같은 파일을 다시 선택하거나 같은 장면을 다시 촬영할 수 있도록 입력값을 비웁니다.
    event.target.value = '';
  };

  // 대기 목록에서 한 장을 제거합니다.
  const handleRemovePendingFile = (index: number) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index));
  };

  // 대기 목록의 파일을 분석하여 단어를 추출합니다.
  const handleExtractVocabulary = async () => {
    if (pendingFiles.length === 0) return;
    const selectedFiles = pendingFiles;

    setStatus('analyzing');

    try {
      const originalTotalSize = selectedFiles.reduce((sum, file) => sum + file.size, 0);
      if (originalTotalSize > MAX_ORIGINAL_TOTAL_BYTES) {
        throw new UploadError('전체 파일 크기는 60MB 이하로 업로드해주세요.');
      }

      // 이미지를 업로드 전에 축소·재압축하여 전송 용량을 줄입니다. (PDF 등은 원본을 유지합니다)
      const preparedFiles = await Promise.all(selectedFiles.map((file) => compressImageFile(file)));
      const totalSize = preparedFiles.reduce((sum, file) => sum + file.size, 0);
      if (totalSize > MAX_UPLOAD_TOTAL_BYTES) {
        throw new UploadError('용량을 줄인 뒤에도 전체 크기가 너무 큽니다. 파일 수를 줄여 다시 시도해주세요.');
      }

      // 준비된 파일을 병렬로 Base64 인코딩합니다.
      const filePromises = preparedFiles.map((file) => readFileAsBase64(file));
      const fileParts = await Promise.all(filePromises);

      // Gemini AI를 호출하여 단어와 뜻을 추출합니다.
      const items = await extractVocabularyFromFiles(fileParts);
      
      // 추출된 단어들을 무작위로 섞습니다.
      const shuffledItems = shuffleArray(items);
      
      setVocabList(shuffledItems);
      setStep('verify');
      setStatus('idle');
      // 분석에 성공했으므로 대기 목록을 비웁니다. (실패 시에는 남겨 두어 바로 재시도할 수 있게 합니다)
      setPendingFiles([]);
    } catch (error) {
      setStatus('error');
      alert(error instanceof UploadError
        ? error.message
        : "파일 분석에 실패했습니다. 파일 형식과 크기를 확인한 뒤 다시 시도해주세요.");
    }
  };

  // TTS 발음 듣기 처리 함수
  const handlePlayAudio = async (item: VocabItem) => {
    if (playingId) return; // 이미 재생 중이면 중복 실행 방지
    
    try {
      setPlayingId(item.id);
      let audioData = audioCache[item.word];
      
      // 캐시에 음성 데이터가 없으면 Gemini TTS API를 통해 생성 후 캐시에 저장합니다.
      if (!audioData) {
        audioData = await generateSpeechForWord(item.word);
        setAudioCache(prev => ({ ...prev, [item.word]: audioData }));
      }
      
      // PCM 오디오 재생
      await playPCMData(audioData);
    } catch (err) {
      console.error("Audio error", err);
      alert("오디오 재생에 실패했습니다.");
    } finally {
      setPlayingId(null);
    }
  };

  // PDF 다운로드 처리 함수 (문제지·답안지가 여러 장으로 나뉘어도 모두 담습니다)
  const handleDownloadPDF = async () => {
    // 문제지 전체 → 답안지 전체 순서로 렌더링된 페이지 요소를 그대로 가져옵니다.
    const pageElements = Array.from(
      document.querySelectorAll<HTMLElement>('#hidden-worksheet [data-worksheet-page]')
    );

    if (pageElements.length === 0) {
        alert("PDF 생성 요소를 찾는 중입니다...");
        return;
    }

    try {
        setStatus('generating_audio'); // PDF 생성 스피너 표시

        // A4 가로 모드(Landscape, 'l')로 jsPDF 인스턴스 생성
        const pdf = new jsPDF('l', 'mm', 'a4');
        const pdfWidth = pdf.internal.pageSize.getWidth(); // 297mm
        const pdfHeight = pdf.internal.pageSize.getHeight(); // 210mm

        for (let i = 0; i < pageElements.length; i++) {
            const element = pageElements[i];
            const canvas = await html2canvas(element, {
              scale: 2, // 고해상도 캡처
              logging: false,
              useCORS: true,
              width: element.offsetWidth,
              height: element.offsetHeight,
              backgroundColor: '#ffffff', // 배경색 흰색 보장
            });
            if (i > 0) pdf.addPage();
            pdf.addImage(canvas.toDataURL('image/jpeg', 0.75), 'JPEG', 0, 0, pdfWidth, pdfHeight);
        }

        // PDF 파일 저장
        pdf.save(`voca-master-${new Date().toISOString().split('T')[0]}.pdf`);
        setStatus('idle');
    } catch (error) {
        console.error("PDF Generation failed", error);
        alert("PDF 생성에 실패했습니다.");
        setStatus('idle');
    }
  };

  // 온라인 테스트 시작 (현재 단어 목록 또는 기록에 저장된 세트로)
  const handleStartQuiz = (items: VocabItem[]) => {
    if (items.length === 0) return;
    setQuizItems(items);
    setStep('quiz');
  };

  // 테스트 기록 삭제
  const handleClearHistory = () => {
    clearQuizHistory();
    setQuizHistory([]);
  };

  // 처음으로 돌아가기(초기화) — 저장된 테스트 기록은 유지합니다.
  const handleReset = () => {
    setStep('upload');
    setVocabList([]);
    setAudioCache({});
    setQuizItems([]);
  };

  if (isCheckingAuth) {
    return <LoadingOverlay message="인증 상태를 확인하고 있습니다..." />;
  }

  if (!isAuthenticated) {
    return <PasswordAuth onAuthenticated={() => setIsAuthenticated(true)} />;
  }

  return (
    <div className="min-h-screen relative bg-gray-50">
        {/* 로딩 오버레이 스피너 */}
        {status === 'analyzing' && <LoadingOverlay message="문서를 분석하여 단어를 추출하고 있습니다... 🔍" />}
        {status === 'generating_audio' && <LoadingOverlay message="PDF를 생성하고 있습니다..." />}

        {/* 
            시험지 렌더링 컨테이너:
            화면에서는 보이지 않게 오프스크린(-10000px)에 배치해 두고 html2canvas로 캡처하거나,
            인쇄(Ctrl+P) 시에는 CSS print 미디어 쿼리를 통해 정상 출력됩니다.
        */}
        {vocabList.length > 0 && (
             <div id="hidden-worksheet" className="fixed left-[-10000px] top-0">
                 <WorksheetPreview items={vocabList} date={new Date().toLocaleDateString()} />
             </div>
        )}

        {/* 메인 화면 UI (인쇄 시에는 숨김 처리) */}
        <div className="no-print container mx-auto px-4 py-8 max-w-4xl">
            {/* 상단 네비게이션 헤더 */}
            <header className="flex justify-between items-center mb-12 bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
                <div className="flex items-center gap-3 cursor-pointer" onClick={handleReset}>
                    <span className="text-3xl">🎓</span>
                    <div>
                      <h1 className="text-xl font-bold text-gray-800">Voca Master</h1>
                      <p className="text-xs text-gray-400">단어 시험지 자동 생성기</p>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                  {step !== 'history' && (
                       <button
                          onClick={() => { setQuizHistory(loadQuizHistory()); setStep('history'); }}
                          className="text-sm text-gray-500 hover:text-gray-800 underline transition-colors"
                       >
                          테스트 기록
                       </button>
                  )}
                  {step !== 'upload' && (
                       <button onClick={handleReset} className="text-sm text-gray-500 hover:text-gray-800 underline transition-colors">
                          처음으로
                       </button>
                  )}
                  {/* 보안을 위한 잠금(로그아웃) 버튼 */}
                  <button 
                    onClick={handleLockScreen} 
                    className="flex items-center gap-1.5 text-xs bg-gray-100 hover:bg-red-50 text-gray-600 hover:text-red-600 font-medium py-2 px-3 rounded-lg transition-colors border border-gray-200"
                    title="화면을 잠그고 비밀번호 입력창으로 돌아갑니다."
                  >
                    <span>🔒</span> 화면 잠금
                  </button>
                </div>
            </header>

            {/* 1단계: 파일 업로드 화면 */}
            {step === 'upload' && (
                <div className="bg-white rounded-2xl shadow-xl p-6 sm:p-10 border border-gray-200">
                    <div className="text-center">
                        <span className="text-5xl">📚</span>
                        <h2 className="text-xl sm:text-2xl font-bold text-gray-800 mt-4 mb-2">단어장 사진 또는 PDF를 올려주세요</h2>
                        <p className="text-sm text-gray-500 max-w-md mx-auto">
                            여러 장을 찍어서 모을 수 있습니다. 촬영을 반복해 원하는 만큼 담은 뒤 아래 버튼으로 한 번에 분석하세요.
                            <span className="block text-xs text-blue-500 mt-1">최대 {MAX_FILES}장 · 사진 용량은 자동으로 줄여 전송합니다</span>
                        </p>
                    </div>

                    {/* 카메라 촬영 전용 입력 (모바일에서 카메라가 바로 열립니다) */}
                    <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        ref={cameraInputRef}
                        onChange={handleAddFiles}
                        className="hidden"
                    />
                    {/* 갤러리·파일 선택 입력 */}
                    <input
                        type="file"
                        accept="image/*, application/pdf"
                        multiple
                        ref={fileInputRef}
                        onChange={handleAddFiles}
                        className="hidden"
                    />

                    <div className="flex flex-col sm:flex-row gap-3 justify-center mt-8">
                        <button
                            onClick={() => cameraInputRef.current?.click()}
                            disabled={pendingFiles.length >= MAX_FILES}
                            className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold py-3.5 px-6 rounded-xl shadow-sm transition-colors"
                        >
                            <span className="text-lg">📷</span>
                            {pendingFiles.length > 0 ? '사진 더 찍기' : '사진 찍기'}
                        </button>
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            disabled={pendingFiles.length >= MAX_FILES}
                            className="flex items-center justify-center gap-2 bg-white hover:bg-gray-50 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed text-gray-700 font-semibold py-3.5 px-6 rounded-xl border border-gray-300 transition-colors"
                        >
                            <span className="text-lg">🖼️</span>
                            앨범·파일에서 선택
                        </button>
                    </div>

                    {/* 담아둔 사진 목록 */}
                    {pendingFiles.length > 0 && (
                        <div className="mt-8 border-t border-gray-100 pt-6">
                            <div className="flex items-center justify-between mb-3">
                                <p className="text-sm font-semibold text-gray-700">
                                    담은 파일 <span className="text-blue-600">{pendingFiles.length}</span> / {MAX_FILES}장
                                </p>
                                <button
                                    onClick={() => setPendingFiles([])}
                                    className="text-xs text-gray-500 hover:text-red-600 underline transition-colors"
                                >
                                    전체 비우기
                                </button>
                            </div>

                            <ul className="grid grid-cols-3 sm:grid-cols-5 gap-3">
                                {pendingFiles.map((file, index) => (
                                    <li key={`${file.name}-${index}`} className="relative group">
                                        <div className="aspect-square rounded-lg overflow-hidden bg-gray-100 border border-gray-200 flex items-center justify-center">
                                            {previewUrls[index] ? (
                                                <img src={previewUrls[index]} alt={`${index + 1}번째 사진`} className="w-full h-full object-cover" />
                                            ) : (
                                                <span className="text-3xl">📄</span>
                                            )}
                                        </div>
                                        <span className="absolute top-1 left-1 bg-black/60 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
                                            {index + 1}
                                        </span>
                                        <button
                                            onClick={() => handleRemovePendingFile(index)}
                                            className="absolute -top-1.5 -right-1.5 bg-white text-gray-500 hover:text-red-600 hover:border-red-300 border border-gray-300 rounded-full w-6 h-6 flex items-center justify-center shadow-sm transition-colors"
                                            title={`${index + 1}번째 파일 삭제`}
                                            aria-label={`${index + 1}번째 파일 삭제`}
                                        >
                                            ✕
                                        </button>
                                    </li>
                                ))}
                            </ul>

                            <button
                                onClick={handleExtractVocabulary}
                                className="w-full mt-6 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-4 rounded-xl shadow-sm transition-colors"
                            >
                                담은 {pendingFiles.length}장으로 단어 추출하기
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* 2단계: 단어 검증 및 듣기/PDF 다운로드 화면 */}
            {step === 'verify' && (
                <div className="space-y-6">
                    <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                         <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                            <span>✅</span> 데이터 검증 (Data Verification)
                         </h2>
                         <p className="text-sm text-gray-500 mb-6">
                             AI가 인식한 내용을 <b>무작위로 섞어서</b> 보여줍니다. 인쇄하기 전에 내용이 맞는지 확인하고, 듣기 버튼을 눌러 발음을 확인해보세요.<br/>
                             <span className="text-xs text-gray-400">인쇄물은 <b>문제지에 영어 뜻만</b>, <b>답안지에 한글 해석과 정답</b>이 함께 나옵니다.</span>
                         </p>

                         <div className="overflow-x-auto">
                             <table className="w-full text-left">
                                 <thead className="bg-gray-50 border-b">
                                     <tr>
                                         <th className="p-4 font-semibold text-gray-600 w-16">No.</th>
                                         <th className="p-4 font-semibold text-gray-600">Word</th>
                                         <th className="p-4 font-semibold text-gray-600">Definition</th>
                                         <th className="p-4 font-semibold text-gray-600 w-24">Audio</th>
                                     </tr>
                                 </thead>
                                 <tbody className="divide-y divide-gray-100">
                                     {vocabList.map((item, index) => (
                                         <tr key={item.id} className="hover:bg-gray-50 group">
                                             <td className="p-4 text-gray-400">{index + 1}</td>
                                             <td className="p-4 font-medium text-lg">{item.word}</td>
                                             <td className="p-4 text-gray-700">{item.definition}</td>
                                             <td className="p-4">
                                                 <button 
                                                    onClick={() => handlePlayAudio(item)}
                                                    disabled={!!playingId}
                                                    className={`p-2 rounded-full transition-colors ${playingId === item.id ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-600 hover:bg-blue-100 hover:text-blue-600'}`}
                                                    title="발음 듣기"
                                                 >
                                                     {playingId === item.id ? (
                                                         <span className="animate-pulse">🔊</span>
                                                     ) : (
                                                         <span>🔈</span>
                                                     )}
                                                 </button>
                                             </td>
                                         </tr>
                                     ))}
                                 </tbody>
                             </table>
                         </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <button
                            onClick={handleDownloadPDF}
                            className="bg-red-600 hover:bg-red-700 text-white font-semibold py-4 px-6 rounded-xl shadow-lg flex items-center justify-center gap-3 transition-all"
                        >
                            <span>💾</span> PDF 파일 다운로드
                        </button>
                        <button
                            onClick={() => handleStartQuiz(vocabList)}
                            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-4 px-6 rounded-xl shadow-lg flex items-center justify-center gap-3 transition-all"
                        >
                            <span>📝</span> 온라인으로 바로 테스트하기
                        </button>
                    </div>
                </div>
            )}

            {/* 3단계: 온라인 단어 테스트 */}
            {step === 'quiz' && (
                <OnlineQuiz
                    items={quizItems}
                    onFinished={() => setQuizHistory(loadQuizHistory())}
                    onExit={() => setStep(vocabList.length > 0 ? 'verify' : 'upload')}
                />
            )}

            {/* 테스트 기록 화면 */}
            {step === 'history' && (
                <QuizHistory
                    records={quizHistory}
                    onRetake={handleStartQuiz}
                    onClear={handleClearHistory}
                    onExit={() => setStep(vocabList.length > 0 ? 'verify' : 'upload')}
                />
            )}
        </div>
    </div>
  );
};

export default App;

