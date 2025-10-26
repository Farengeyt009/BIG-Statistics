import React, { useState } from 'react';
import { WeChatQRGenerator } from './WeChatQRGenerator';
import { WeChatStatus } from './WeChatStatus';
import { useWeChatBinding } from '../../hooks/useWeChatBinding';

export const WeChatSettings: React.FC = () => {
  const { binding, getBinding } = useWeChatBinding();
  const [showQR, setShowQR] = useState(false);
  const [qrStatus, setQrStatus] = useState<string>('pending');

  const handleQRGenerated = (qrData: string) => {
    setShowQR(true);
  };

  const handleStatusChange = (status: string) => {
    setQrStatus(status);
    
    // Если привязка подтверждена, обновляем данные
    if (status === 'confirmed') {
      setTimeout(() => {
        getBinding();
        setShowQR(false);
      }, 1000);
    }
  };

  const handleUnbind = () => {
    setShowQR(false);
    setQrStatus('pending');
  };

  return (
    <div>
      {binding ? (
        <WeChatStatus onUnbind={handleUnbind} />
      ) : (
        <div className="space-y-4">
          {!showQR ? (
            <div className="text-center p-3 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-100">
              <div className="mb-3">
                <div className="w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center mx-auto mb-2 shadow-sm">
                  <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" />
                  </svg>
                </div>
                <h4 className="text-sm font-semibold text-gray-800 mb-1">
                  WeChat
                </h4>
              </div>
              
              <button
                onClick={() => setShowQR(true)}
                className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-xs font-medium shadow-sm"
              >
                Привязать
              </button>
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
              <WeChatQRGenerator
                onQRGenerated={handleQRGenerated}
                onStatusChange={handleStatusChange}
              />
              
              {qrStatus === 'confirmed' && (
                <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center">
                    <svg className="w-4 h-4 text-green-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    <span className="text-green-800 font-medium text-sm">
                      WeChat аккаунт успешно привязан!
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
