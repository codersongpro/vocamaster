import React from 'react';

interface LoadingOverlayProps {
  message: string;
}

const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ message }) => {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex flex-col items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-8 shadow-2xl flex flex-col items-center max-w-sm w-full text-center">
        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-blue-600 mb-6"></div>
        <h3 className="text-xl font-bold text-gray-800 mb-2">Processing</h3>
        <p className="text-gray-600 animate-pulse">{message}</p>
        <p className="text-xs text-gray-400 mt-4">Powered by Gemini 3 Pro with Thinking Mode</p>
      </div>
    </div>
  );
};

export default LoadingOverlay;

