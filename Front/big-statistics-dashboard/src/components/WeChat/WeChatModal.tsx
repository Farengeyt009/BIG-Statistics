import React from 'react';
import { useTranslation } from 'react-i18next';
import { WeChatQRGenerator } from './WeChatQRGenerator';

interface WeChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  onQRGenerated: (qrData: string) => void;
  onStatusChange: (status: string) => void;
}

export const WeChatModal: React.FC<WeChatModalProps> = ({
  isOpen,
  onClose,
  onQRGenerated,
  onStatusChange,
}) => {
  const { t } = useTranslation('weChat');
  
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-gray-900">
            {t('modalTitle')}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <WeChatQRGenerator
          onQRGenerated={onQRGenerated}
          onStatusChange={onStatusChange}
        />
      </div>
    </div>
  );
};
