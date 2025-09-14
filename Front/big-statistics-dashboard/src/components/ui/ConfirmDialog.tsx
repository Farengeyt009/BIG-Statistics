import React from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';

type Props = {
  open: boolean;
  title?: string;
  message: string | React.ReactNode;
  okText?: string;
  cancelText?: string;
  onOk: () => void;
  onCancel: () => void;
  danger?: boolean;
};

const ConfirmDialog: React.FC<Props> = ({ open, title, message, okText, cancelText, onOk, onCancel, danger }) => {
  const { t } = useTranslation('production');
  if (!open) return null;

  const body = (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onCancel} />
      <div className="relative bg-white border border-gray-300 shadow-2xl rounded px-5 py-4 w-[560px] min-h-[150px] max-w-[92vw] flex flex-col justify-center">
        {title && <div className="text-sm font-medium mb-2 text-gray-900">{title}</div>}
        <div className="text-sm text-gray-800 whitespace-pre-line">{message}</div>
        <div className="mt-4 flex justify-end space-x-2">
          <button
            type="button"
            className="px-2.5 py-1.5 rounded bg-gray-100 text-gray-800 hover:bg-gray-200 text-xs"
            onClick={onCancel}
          >
            {cancelText || (t('cancel') as string) || 'Cancel'}
          </button>
          <button
            type="button"
            className={`px-2.5 py-1 rounded text-white text-xs ${danger ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}`}
            onClick={onOk}
          >
            {okText || 'OK'}
          </button>
        </div>
      </div>
    </div>
  );

  if (typeof document !== 'undefined') {
    return createPortal(body, document.body);
  }
  return body;
};

export default ConfirmDialog;


