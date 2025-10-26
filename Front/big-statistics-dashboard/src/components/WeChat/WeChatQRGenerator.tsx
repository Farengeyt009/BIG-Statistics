import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useWeChatQR } from '../../hooks/useWeChatQR';

interface WeChatQRGeneratorProps {
  onQRGenerated?: (qrData: string) => void;
  onStatusChange?: (status: string) => void;
}

export const WeChatQRGenerator: React.FC<WeChatQRGeneratorProps> = ({
  onQRGenerated,
  onStatusChange,
}) => {
  const { t } = useTranslation('weChat');
  const { qrSession, qrStatus, loading, error, generateQR } = useWeChatQR();

  // Генерируем QR-код при монтировании компонента
  useEffect(() => {
    generateQR();
  }, [generateQR]);

  // Уведомляем родительский компонент о статусе
  useEffect(() => {
    if (qrStatus) {
      onStatusChange?.(qrStatus.status);
    }
  }, [qrStatus, onStatusChange]);

  // Уведомляем родительский компонент о QR-коде
  useEffect(() => {
    if (qrSession?.qr_code_data) {
      onQRGenerated?.(qrSession.qr_code_data);
    }
  }, [qrSession?.qr_code_data, onQRGenerated]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600">{t('generatingQR')}</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center p-4">
        <div className="text-red-600 mb-2">{t('error')} {error}</div>
        <button
          onClick={() => generateQR()}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          {t('tryAgain')}
        </button>
      </div>
    );
  }

  if (!qrSession?.qr_code_data) {
    return (
      <div className="text-center p-4">
        <div className="text-gray-600">{t('qrNotGenerated')}</div>
      </div>
    );
  }

  return (
    <div className="text-center">
      <div className="mb-4">
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          {t('scanQRCode')}
        </h3>
        <p className="text-sm text-gray-600">
          {t('scanInstructions')}
        </p>
      </div>
      
      <div className="flex justify-center mb-4">
        <div className="relative">
          {/* Красивая рамка для QR-кода */}
          <div className="bg-gradient-to-br from-green-50 to-blue-50 p-6 rounded-2xl shadow-lg border-2 border-green-200">
            {/* Иконка WeChat в углу */}
            <div className="absolute -top-2 -right-2 bg-green-500 rounded-full p-2 shadow-md">
              <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8.5 12.5c0-.8-.7-1.5-1.5-1.5s-1.5.7-1.5 1.5.7 1.5 1.5 1.5 1.5-.7 1.5-1.5zm6 0c0-.8-.7-1.5-1.5-1.5s-1.5.7-1.5 1.5.7 1.5 1.5 1.5 1.5-.7 1.5-1.5zm-3-3c0-.8-.7-1.5-1.5-1.5s-1.5.7-1.5 1.5.7 1.5 1.5 1.5 1.5-.7 1.5-1.5zm6 0c0-.8-.7-1.5-1.5-1.5s-1.5.7-1.5 1.5.7 1.5 1.5 1.5 1.5-.7 1.5-1.5z"/>
              </svg>
            </div>
            
            {/* QR-код с улучшенной стилизацией */}
            <div className="bg-white p-4 rounded-xl shadow-inner">
              <img
                src={`data:image/png;base64,${qrSession.qr_code_data}`}
                alt="WeChat QR Code"
                className="w-48 h-48 mx-auto rounded-lg shadow-sm border border-gray-100"
              />
            </div>
            
            {/* Анимированная рамка */}
            <div className="absolute inset-0 rounded-2xl border-2 border-green-400 animate-pulse opacity-30"></div>
          </div>
        </div>
      </div>

      {qrStatus && (
        <div className="text-sm">
          {qrStatus.status === 'pending' && (
            <div className="flex items-center justify-center space-x-2 text-yellow-600 bg-yellow-50 px-4 py-3 rounded-lg border border-yellow-200">
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-yellow-600 border-t-transparent"></div>
              <span className="font-medium">{t('waitingForScan')}</span>
            </div>
          )}
          {qrStatus.status === 'scanned' && (
            <div className="flex items-center justify-center space-x-2 text-blue-600 bg-blue-50 px-4 py-3 rounded-lg border border-blue-200">
              <svg className="w-5 h-5 animate-bounce" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              <span className="font-medium">{t('qrScanned')}</span>
            </div>
          )}
          {qrStatus.status === 'confirmed' && (
            <div className="flex items-center justify-center space-x-2 text-green-600 bg-green-50 px-4 py-3 rounded-lg border border-green-200">
              <svg className="w-5 h-5 animate-pulse" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span className="font-medium">{t('accountLinked')}</span>
            </div>
          )}
          {qrStatus.status === 'expired' && (
            <div className="flex items-center justify-center space-x-2 text-red-600 bg-red-50 px-4 py-3 rounded-lg border border-red-200">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <span className="font-medium">{t('qrExpired')}</span>
            </div>
          )}
        </div>
      )}

      <div className="mt-6">
        <button
          onClick={() => generateQR()}
          className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-green-500 to-blue-500 text-white rounded-lg hover:from-green-600 hover:to-blue-600 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105 mx-auto"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <span className="font-medium">{t('refreshQR')}</span>
        </button>
      </div>
    </div>
  );
};
