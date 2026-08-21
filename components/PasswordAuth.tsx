import React, { useState } from 'react';

interface PasswordAuthProps {
  // 인증이 성공했을 때 부모 컴포넌트에 알리는 콜백 함수입니다.
  onAuthenticated: () => void;
}

/**
 * 앱 접속 시 비밀번호를 확인하는 보안 잠금 화면 컴포넌트입니다.
 * 지정된 비밀번호와 일치해야만 메인 화면으로 진입할 수 있습니다.
 */
const PasswordAuth: React.FC<PasswordAuthProps> = ({ onAuthenticated }) => {
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isShaking, setIsShaking] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ password }),
      });
      if (!response.ok) throw new Error('login failed');
      setErrorMessage('');
      onAuthenticated();
    } catch {
      setErrorMessage('비밀번호가 올바르지 않습니다. 다시 입력해주세요.');
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 500);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className={`bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full border border-gray-100 transition-all ${isShaking ? 'animate-bounce' : ''}`}>
        
        {/* 자물쇠 아이콘 및 타이틀 */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl shadow-inner">
            🔒
          </div>
          <h1 className="text-2xl font-bold text-gray-800">Voca Master</h1>
          <p className="text-sm text-gray-500 mt-2">
            선생님 전용 앱입니다.<br />접속 비밀번호를 입력해주세요.
          </p>
        </div>

        {/* 비밀번호 입력 폼 */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              접속 비밀번호
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (errorMessage) setErrorMessage('');
                }}
                placeholder="비밀번호를 입력하세요"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all pr-16 text-gray-800"
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded"
                title={showPassword ? "비밀번호 숨기기" : "비밀번호 보기"}
              >
                {showPassword ? '숨김' : '보기'}
              </button>
            </div>
            {errorMessage && (
              <p className="text-sm text-red-500 mt-2 flex items-center gap-1 font-medium">
                <span>⚠️</span> {errorMessage}
              </p>
            )}
          </div>

          <button
              type="submit"
            disabled={isSubmitting}
            className="w-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold py-3.5 px-4 rounded-xl shadow-md hover:shadow-lg transition-all duration-200"
          >
            입장하기 (Unlock)
          </button>
        </form>

      </div>
    </div>
  );
};

export default PasswordAuth;

