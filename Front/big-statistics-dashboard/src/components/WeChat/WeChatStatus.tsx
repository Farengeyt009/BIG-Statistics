import React from 'react';
import { useWeChatBinding } from '../../hooks/useWeChatBinding';

interface WeChatStatusProps {
  onUnbind?: () => void;
}

export const WeChatStatus: React.FC<WeChatStatusProps> = ({ onUnbind }) => {
  const { binding, loading, error, unbindWeChat } = useWeChatBinding();

  const handleUnbind = async () => {
    if (window.confirm('Вы уверены, что хотите отвязать WeChat аккаунт?')) {
      try {
        await unbindWeChat();
        onUnbind?.();
      } catch (err) {
        console.error('Error unbinding WeChat:', err);
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-4">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600">Загрузка...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center p-4">
        <div className="text-red-600 mb-2">Ошибка: {error}</div>
      </div>
    );
  }

  if (!binding) {
    return (
      <div className="text-center p-4">
        <div className="text-gray-600 mb-4">
          WeChat аккаунт не привязан
        </div>
      </div>
    );
  }

  return (
    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center mr-3">
            <svg className="w-6 h-6 text-green-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          </div>
          <div>
            <div className="font-medium text-green-900">
              WeChat аккаунт привязан
            </div>
            <div className="text-sm text-green-700">
              {binding.nickname || 'Пользователь WeChat'}
            </div>
          </div>
        </div>
        
        <button
          onClick={handleUnbind}
          className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700"
        >
          Отвязать
        </button>
      </div>
      
      {binding.avatar_url && (
        <div className="mt-3">
          <img
            src={binding.avatar_url}
            alt="WeChat Avatar"
            className="w-8 h-8 rounded-full"
          />
        </div>
      )}
    </div>
  );
};
