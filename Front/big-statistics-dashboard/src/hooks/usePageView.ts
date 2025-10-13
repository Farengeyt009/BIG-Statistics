import { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

/**
 * Хук для логирования посещения страницы
 * 
 * @param pageKey - ключ страницы для логирования (например: 'production', 'orders', 'admin')
 * 
 * @example
 * // В компоненте Production:
 * usePageView('production');
 */
export const usePageView = (pageKey: string) => {
  const { isAuthenticated, token } = useAuth();

  useEffect(() => {
    if (isAuthenticated && token && pageKey) {
      // Отправляем запрос на логирование page_view
      fetch('/api/auth/log-page-view', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ page_key: pageKey }),
      }).catch(err => {
        // Игнорируем ошибки логирования (не мешаем работе приложения)
        console.log('Page view logging failed:', err);
      });
    }
  }, [pageKey, isAuthenticated, token]);
};

