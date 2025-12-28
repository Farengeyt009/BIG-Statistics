import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface User {
  user_id: number;
  username: string;
  full_name: string;
  email: string | null;
  is_admin: boolean;
  birthday?: string;
  department?: string;
}

interface Permission {
  page_key: string;
  can_view: boolean;
  can_edit: boolean;
}

interface AuthContextType {
  user: User | null;
  permissions: Permission[];
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  hasPermission: (pageKey: string, permissionType?: 'view' | 'edit') => boolean;
  checkAuthError: (response: Response) => boolean; // Новая функция для проверки ошибок авторизации
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Функция для загрузки полных данных профиля
  const loadFullProfile = async (token: string): Promise<{ user: User | null; isTokenValid: boolean }> => {
    try {
      const response = await fetch('/api/users/profile', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      // Если токен истек или невалиден - возвращаем флаг
      if (response.status === 401) {
        return { user: null, isTokenValid: false };
      }
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          return { user: data.user, isTokenValid: true };
        }
      }
    } catch (error) {
      console.error('Error loading full profile:', error);
    }
    return { user: null, isTokenValid: true }; // Ошибка сети, но токен может быть валидным
  };

  // Загрузка данных из localStorage при инициализации
  useEffect(() => {
    const initializeAuth = async () => {
      const storedToken = localStorage.getItem('authToken');
      const storedUser = localStorage.getItem('userData');
      const storedPermissions = localStorage.getItem('userPermissions');

      if (storedToken && storedUser) {
        // Проверяем валидность токена через запрос профиля
        const { user: fullProfile, isTokenValid } = await loadFullProfile(storedToken);
        
        if (!isTokenValid) {
          // Токен истек - очищаем все данные
          console.log('Token expired, logging out...');
          localStorage.removeItem('authToken');
          localStorage.removeItem('userData');
          localStorage.removeItem('userPermissions');
          localStorage.removeItem('isAuth');
          setUser(null);
          setToken(null);
          setPermissions([]);
          setIsLoading(false);
          return;
        }
        
        // Токен валиден - устанавливаем данные
        setToken(storedToken);
        setPermissions(storedPermissions ? JSON.parse(storedPermissions) : []);
        
        if (fullProfile) {
          setUser(fullProfile);
          localStorage.setItem('userData', JSON.stringify(fullProfile));
        } else {
          // Если профиль не загрузился, используем данные из localStorage
          setUser(JSON.parse(storedUser));
        }
        
        // Логируем начало сессии (Backend проверит дубликаты по времени)
        fetch('/api/auth/session-start', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${storedToken}`,
          },
        }).catch(err => {
          // Игнорируем ошибки логирования
          console.log('Session start logging failed:', err);
        });
      }
      
      setIsLoading(false);
    };

    initializeAuth();
  }, []);

  const login = async (username: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (data.success) {
        // Сохраняем данные
        setToken(data.token);
        setUser(data.user);
        setPermissions(data.permissions || []);

        // Загружаем полные данные профиля
        const { user: fullProfile } = await loadFullProfile(data.token);
        if (fullProfile) {
          setUser(fullProfile);
          localStorage.setItem('userData', JSON.stringify(fullProfile));
        } else {
          localStorage.setItem('userData', JSON.stringify(data.user));
        }

        // Сохраняем в localStorage
        localStorage.setItem('authToken', data.token);
        localStorage.setItem('userPermissions', JSON.stringify(data.permissions || []));
        localStorage.setItem('isAuth', 'true'); // для совместимости с RequireAuth

        return { success: true };
      } else {
        return { success: false, error: data.error || 'Ошибка авторизации' };
      }
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: 'Ошибка соединения с сервером' };
    }
  };

  const logout = () => {
    // Логируем выход перед очисткой данных
    const storedToken = localStorage.getItem('authToken');
    if (storedToken) {
      fetch('/api/auth/logout', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${storedToken}`,
        },
      }).catch(err => {
        // Игнорируем ошибки логирования
        console.log('Logout logging failed:', err);
      });
    }

    setUser(null);
    setToken(null);
    setPermissions([]);

    localStorage.removeItem('authToken');
    localStorage.removeItem('userData');
    localStorage.removeItem('userPermissions');
    localStorage.removeItem('isAuth');
    
    // Перенаправляем на страницу логина
    window.location.href = '/login';
  };

  // Функция для проверки ответа API на ошибки авторизации
  // Возвращает true если это ошибка авторизации (и пользователь разлогинен)
  const checkAuthError = (response: Response): boolean => {
    if (response.status === 401) {
      console.log('401 Unauthorized detected, logging out...');
      logout();
      return true;
    }
    return false;
  };

  const hasPermission = (pageKey: string, permissionType: 'view' | 'edit' = 'view'): boolean => {
    // Админ имеет все права
    if (user?.is_admin) {
      return true;
    }

    // Список страниц, требующих специальных прав (скрытые страницы - требуют CanView)
    const restrictedPages = ['kpi']; // добавляйте сюда новые скрытые страницы

    // Ищем право для данной страницы
    const permission = permissions.find(p => p.page_key === pageKey);

    if (restrictedPages.includes(pageKey)) {
      // Для скрытых страниц требуется явное разрешение
      if (!permission) {
        return false; // Нет записи в правах = нет доступа
      }
      // Проверяем конкретное право
      return permissionType === 'view' ? permission.can_view : permission.can_edit;
    }

    // Для обычных страниц (не скрытых):
    if (!permission) {
      // ИСПРАВЛЕНО: Если проверяем редактирование, по умолчанию запрещено
      if (permissionType === 'edit') {
        return false; // Редактирование требует явного разрешения
      }
      // Просмотр обычных страниц разрешен всем
      return true;
    }

    // Есть запись - проверяем конкретное право
    return permissionType === 'view' ? permission.can_view : permission.can_edit;
  };

  const value: AuthContextType = {
    user,
    permissions,
    token,
    isAuthenticated: !!token && !!user,
    isLoading,
    login,
    logout,
    hasPermission,
    checkAuthError,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

