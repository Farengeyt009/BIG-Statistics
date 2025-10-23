import React, { useState, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { usePageView } from '../../hooks/usePageView';

const UserPage: React.FC = () => {
  const { user, token } = useAuth();
  
  // Логируем посещение страницы User Profile
  usePageView('profile');
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [avatarSrc, setAvatarSrc] = useState('/avatar.png');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Загружаем текущую аватарку при монтировании
  React.useEffect(() => {
    const loadAvatar = async () => {
      if (!user?.user_id || !token) return;
      
      try {
        const response = await fetch('/api/users/avatar', {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
        const data = await response.json();
        
        if (data.success && data.filename) {
          setAvatarSrc(`/${data.filename}?t=${Date.now()}`);
        } else {
          // Если у пользователя нет кастомной аватарки, пробуем стандартную
          setAvatarSrc(`/avatar_${user.user_id}.png?t=${Date.now()}`);
        }
      } catch (error) {
        console.error('Ошибка загрузки аватарки:', error);
        setAvatarSrc('/avatar.png');
      }
    };
    
    loadAvatar();
  }, [user?.user_id, token]);

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Валидация на Frontend
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setMessage({ type: 'error', text: 'Недопустимый формат. Разрешены: PNG, JPG, GIF, WEBP' });
      return;
    }

    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      setMessage({ type: 'error', text: 'Файл слишком большой. Максимум 5MB' });
      return;
    }

    setUploadingAvatar(true);
    setMessage(null);

    try {
      const formData = new FormData();
      formData.append('avatar', file);

      const response = await fetch('/api/users/avatar', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      const data = await response.json();

      if (data.success) {
        setMessage({ type: 'success', text: data.message || 'Аватарка загружена успешно!' });
        // Обновляем аватарку с новым timestamp для обхода кеша
        setAvatarSrc(`/${data.filename}?t=${Date.now()}`);
        
        // Перезагружаем страницу через 1 секунду чтобы обновить аватарку везде
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      } else {
        setMessage({ type: 'error', text: data.error || 'Ошибка загрузки аватарки' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Ошибка соединения с сервером' });
    } finally {
      setUploadingAvatar(false);
      // Очищаем input для возможности повторной загрузки того же файла
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setLoading(true);

    try {
      const updateData: { full_name?: string; password?: string } = {};

      // Если имя изменилось
      if (fullName && fullName !== user?.full_name) {
        updateData.full_name = fullName;
      }

      // Если пароль указан
      if (password) {
        if (password !== confirmPassword) {
          setMessage({ type: 'error', text: 'Пароли не совпадают' });
          setLoading(false);
          return;
        }
        if (password.length < 6) {
          setMessage({ type: 'error', text: 'Пароль должен быть минимум 6 символов' });
          setLoading(false);
          return;
        }
        updateData.password = password;
      }

      if (Object.keys(updateData).length === 0) {
        setMessage({ type: 'error', text: 'Нет изменений для сохранения' });
        setLoading(false);
        return;
      }

      const response = await fetch('/api/users/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(updateData),
      });

      const data = await response.json();

      if (data.success) {
        setMessage({ type: 'success', text: 'Профиль обновлен успешно!' });
        
        // Обновляем данные в localStorage
        const storedUser = localStorage.getItem('userData');
        if (storedUser) {
          const userData = JSON.parse(storedUser);
          userData.full_name = data.user.full_name;
          localStorage.setItem('userData', JSON.stringify(userData));
        }

        // Очищаем поля пароля
        setPassword('');
        setConfirmPassword('');

        // Перезагрузим страницу через 1 секунду чтобы обновить данные
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      } else {
        setMessage({ type: 'error', text: data.error || 'Ошибка обновления профиля' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Ошибка соединения с сервером' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-lg p-8">
        {/* Заголовок с аватаркой */}
        <div className="flex items-center gap-6 mb-8 pb-6 border-b">
          <div className="relative group">
            {/* Внешняя граница */}
            <div className="w-24 h-24 rounded-full border-4 border-[#142143] p-0 cursor-pointer" onClick={handleAvatarClick}>
              {/* Внутренний круг с аватаркой */}
              <div className="w-full h-full rounded-full overflow-hidden relative bg-gray-200">
                <img
                  src={avatarSrc}
                  alt="Avatar"
                  className="w-full h-full object-cover"
                  onError={(e) => { e.currentTarget.src = '/avatar.png'; }}
                />
                {/* Overlay при наведении */}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  {uploadingAvatar ? (
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                  ) : (
                    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  )}
                </div>
              </div>
            </div>
            {/* Скрытый input для загрузки файла */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/gif,image/webp"
              onChange={handleAvatarUpload}
              className="hidden"
            />
            <p className="text-xs text-gray-500 text-center mt-2">Нажмите для загрузки</p>
          </div>
          <div>
            <h1 className="text-3xl font-bold text-[#142143]">Профиль пользователя</h1>
            <p className="text-gray-600 mt-1">@{user?.username}</p>
            {user?.is_admin && (
              <span className="inline-block mt-2 px-3 py-1 bg-blue-100 text-blue-800 text-sm font-semibold rounded-full">
                Администратор
              </span>
            )}
          </div>
        </div>

        {/* Сообщение об успехе/ошибке */}
        {message && (
          <div
            className={`mb-6 p-4 rounded-lg ${
              message.type === 'success'
                ? 'bg-green-100 border border-green-400 text-green-700'
                : 'bg-red-100 border border-red-400 text-red-700'
            }`}
          >
            {message.text}
          </div>
        )}

        {/* Форма */}
        <form onSubmit={handleUpdateProfile} className="space-y-6">
          {/* Полное имя */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Полное имя
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Введите ваше полное имя"
            />
          </div>

          {/* Разделитель */}
          <div className="border-t pt-6">
            <h3 className="text-lg font-semibold text-gray-700 mb-4">Изменить пароль</h3>
            
            {/* Новый пароль */}
            <div className="mb-4">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Новый пароль
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Оставьте пустым, если не хотите менять"
              />
            </div>

            {/* Подтверждение пароля */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Подтвердите пароль
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Повторите новый пароль"
                disabled={!password}
              />
            </div>
          </div>

          {/* Кнопка сохранения */}
          <div className="flex gap-4 pt-4">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-[#142143] text-white py-3 rounded-lg font-semibold hover:bg-[#1a295c] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Сохранение...' : 'Сохранить изменения'}
            </button>
            <button
              type="button"
              onClick={() => window.history.back()}
              className="px-6 py-3 border border-gray-300 rounded-lg font-semibold hover:bg-gray-50 transition-colors"
            >
              Назад
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default UserPage;

