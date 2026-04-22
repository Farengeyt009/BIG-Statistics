import { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { logPageViewDedup } from '../utils/pageViewLogger';

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
      logPageViewDedup(pageKey, token);
    }
  }, [pageKey, isAuthenticated, token]);
};

