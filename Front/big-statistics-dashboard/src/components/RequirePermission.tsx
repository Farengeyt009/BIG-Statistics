import { ReactNode, useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';

interface RequirePermissionProps {
  children: ReactNode;
  pageKey: string;
  permissionType?: 'view' | 'edit';
}

/**
 * Компонент для защиты маршрутов, требующих специальных прав доступа
 */
export const RequirePermission: React.FC<RequirePermissionProps> = ({ 
  children, 
  pageKey, 
  permissionType = 'view' 
}) => {
  const location = useLocation();
  const { t } = useTranslation('requirePermission');
  const { user, hasPermission, isAuthenticated, isLoading, token } = useAuth();

  // Логируем посещение страницы
  useEffect(() => {
    if (isAuthenticated && hasPermission(pageKey, permissionType) && token) {
      // Отправляем запрос на логирование page_view
      fetch('/api/auth/log-page-view', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ page_key: pageKey }),
      }).catch(err => {
        // Игнорируем ошибки логирования
        console.log('Page view logging failed:', err);
      });
    }
  }, [pageKey, isAuthenticated, token]); // Логируем при смене страницы

  // Показываем загрузку пока данные загружаются
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">{t('loading')}</p>
        </div>
      </div>
    );
  }

  // Если не авторизован - редирект на login
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Проверяем право доступа
  const allowed = hasPermission(pageKey, permissionType);

  if (!allowed) {
    // Нет доступа - редирект на главную с сообщением
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-red-600 mb-4">403</h1>
          <h2 className="text-2xl font-semibold mb-2">{t('accessDenied')}</h2>
          <p className="text-gray-600 mb-4">
            {t('noPermission')}
          </p>
          <a 
            href="/" 
            className="text-blue-600 hover:underline"
          >
            {t('backToHome')}
          </a>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

