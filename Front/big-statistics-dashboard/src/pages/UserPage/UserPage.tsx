import React, { useState, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { usePageView } from '../../hooks/usePageView';
import { WeChatModal } from '../../components/WeChat/WeChatModal';
import { useWeChatBinding } from '../../hooks/useWeChatBinding';
import { PageHeader } from '../../components/PageHeader/PageHeader';
import { useTranslation } from 'react-i18next';
import UserPageTranslation from './UserPageTranslation.json';

const UserPage: React.FC = () => {
  const { user, token } = useAuth();
  const { t, i18n } = useTranslation('userPage');
  
  // Логируем посещение страницы User Profile
  usePageView('profile');

  // Загружаем переводы для страницы
  React.useEffect(() => {
    const currentLang = i18n.language;
    if (UserPageTranslation[currentLang as keyof typeof UserPageTranslation]) {
      i18n.addResourceBundle(currentLang, 'userPage', UserPageTranslation[currentLang as keyof typeof UserPageTranslation], true, true);
    }
  }, [i18n]);
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [avatarSrc, setAvatarSrc] = useState('/avatar.png');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editingField, setEditingField] = useState<'name' | 'email' | 'password' | null>(null);
  const [showWeChatModal, setShowWeChatModal] = useState(false);
  const { binding, getBinding, unbindWeChat } = useWeChatBinding();
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
      setMessage({ type: 'error', text: t('connectionError') });
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
      const updateData: { full_name?: string; email?: string; password?: string } = {};

      // Если имя изменилось
      if (fullName && fullName !== user?.full_name) {
        updateData.full_name = fullName;
      }

      // Если email изменился
      if (email !== user?.email) {
        updateData.email = email;
      }

      // Если пароль указан
      if (password) {
        if (password !== confirmPassword) {
          setMessage({ type: 'error', text: t('passwordMismatch') });
          setLoading(false);
          return;
        }
        if (password.length < 6) {
          setMessage({ type: 'error', text: t('passwordTooShort') });
          setLoading(false);
          return;
        }
        updateData.password = password;
      }

      if (Object.keys(updateData).length === 0) {
        setMessage({ type: 'error', text: t('noChanges') });
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
        setMessage({ type: 'success', text: t('profileUpdated') });
        
        // Обновляем данные в localStorage
        const storedUser = localStorage.getItem('userData');
        if (storedUser) {
          const userData = JSON.parse(storedUser);
          userData.full_name = data.user.full_name;
          userData.email = data.user.email;
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
        setMessage({ type: 'error', text: data.error || t('profileUpdateError') });
      }
    } catch (error) {
      setMessage({ type: 'error', text: t('connectionError') });
    } finally {
      setLoading(false);
    }
  };

  const handleFieldEdit = (field: 'name' | 'email' | 'password') => {
    setEditingField(field);
    setEditMode(true);
  };

  const handleCancelEdit = () => {
    setEditingField(null);
    setEditMode(false);
    setPassword('');
    setConfirmPassword('');
  };

  const handleWeChatQRGenerated = (qrData: string) => {
    // QR код сгенерирован
  };

  const handleWeChatStatusChange = (status: string) => {
    if (status === 'confirmed') {
      setTimeout(() => {
        getBinding();
        setShowWeChatModal(false);
      }, 1000);
    }
  };

  const handleWeChatUnbind = async () => {
    try {
      await unbindWeChat();
      setMessage({ type: 'success', text: t('weChatUnlinked') });
    } catch (error) {
      setMessage({ type: 'error', text: t('weChatUnlinkError') });
    }
  };

  return (
    <>
      <PageHeader
        title={t('userPage:pageTitle')}
        view=""
        onViewChange={() => {}}
        tabs={[]}
        hideTabs={true}
      />
      <div className="max-w-2xl p-6">
        <div className="bg-white rounded-lg shadow-lg p-8">
        {/* Информация о пользователе */}
        <div className="flex items-start gap-6 mb-8 pb-6 border-b">
          <div className="relative group">
            {/* Внешняя граница */}
            <div className="w-32 h-32 rounded-full border-4 border-[#142143] p-0 cursor-pointer" onClick={handleAvatarClick}>
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
          </div>
          
          {/* Информация о пользователе */}
          <div className="flex-1">
            <div className="space-y-2">
              <p className="text-base text-gray-500">@{user?.username}</p>
                <p className="text-base text-gray-500">
                  <span className="font-medium">{t('fullName')}:</span> {user?.full_name || t('notSpecified')}
                </p>
                <p className="text-base text-gray-500">
                  <span className="font-medium">{t('email')}:</span> {user?.email || t('notSet')}
                </p>
                {user?.birthday && (
                  <p className="text-base text-gray-500">
                    <span className="font-medium">{t('birthday')}:</span> {new Date(user.birthday).toLocaleDateString('ru-RU')}
                  </p>
                )}
                {user?.department && (
                  <p className="text-base text-gray-500">
                    <span className="font-medium">{t('department')}:</span> {user.department}
                  </p>
                )}
            </div>
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

        {/* Компактная секция настроек */}
        <div className="space-y-4">
          {/* Статус администратора */}
          {user?.is_admin && (
            <div className="flex items-center">
              <span className="inline-block px-3 py-1 bg-blue-100 text-blue-800 text-sm font-semibold rounded-full">
                {t('administrator')}
              </span>
            </div>
          )}

          {/* Изменить имя */}
          <div 
            onClick={() => handleFieldEdit('name')}
            className="flex items-center p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors"
          >
            <div className="flex items-center space-x-3">
              <div className="w-5 h-5 flex items-center justify-center">
                <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <span className="text-sm font-medium text-gray-700">{t('changeName')}</span>
            </div>
          </div>

          {/* Поле редактирования имени */}
          {editingField === 'name' && (
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-center space-x-3">
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder={t('enterNewName')}
                />
                <button
                  onClick={handleUpdateProfile}
                  className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  {t('save')}
                </button>
                <button
                  onClick={handleCancelEdit}
                  className="px-3 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 transition-colors"
                >
                  {t('cancel')}
                </button>
              </div>
            </div>
          )}

          {/* Изменить почту */}
          <div 
            onClick={() => handleFieldEdit('email')}
            className="flex items-center p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors"
          >
            <div className="flex items-center space-x-3">
              <div className="w-5 h-5 flex items-center justify-center">
                <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <span className="text-sm font-medium text-gray-700">{t('changeEmail')}</span>
            </div>
          </div>

          {/* Поле редактирования почты */}
          {editingField === 'email' && (
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-center space-x-3">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder={t('enterNewEmail')}
                />
                <button
                  onClick={handleUpdateProfile}
                  className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  {t('save')}
                </button>
                <button
                  onClick={handleCancelEdit}
                  className="px-3 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 transition-colors"
                >
                  {t('cancel')}
                </button>
              </div>
            </div>
          )}

          {/* Изменить пароль */}
          <div 
            onClick={() => handleFieldEdit('password')}
            className="flex items-center p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors"
          >
            <div className="flex items-center space-x-3">
              <div className="w-5 h-5 flex items-center justify-center">
                <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <span className="text-sm font-medium text-gray-700">{t('changePassword')}</span>
            </div>
          </div>

          {/* Поле редактирования пароля */}
          {editingField === 'password' && (
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
              <div className="space-y-3">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder={t('enterNewPassword')}
                />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder={t('confirmPassword')}
                />
                <div className="flex items-center space-x-3">
                  <button
                    onClick={handleUpdateProfile}
                    className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                  >
                    {t('save')}
                  </button>
                  <button
                    onClick={handleCancelEdit}
                    className="px-3 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 transition-colors"
                  >
                    {t('cancel')}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* WeChat Integration */}
          {binding ? (
            <div 
              onClick={handleWeChatUnbind}
              className="flex items-center p-3 bg-red-50 rounded-lg cursor-pointer hover:bg-red-100 transition-colors"
            >
              <div className="flex items-center space-x-3">
                <div className="w-5 h-5 flex items-center justify-center">
                  <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
                <span className="text-sm font-medium text-red-700">{t('unlinkWeChat')}</span>
              </div>
            </div>
          ) : (
            <div 
              onClick={() => setShowWeChatModal(true)}
              className="flex items-center p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors"
            >
              <div className="flex items-center space-x-3">
                <div className="w-5 h-5 flex items-center justify-center">
                  <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                <span className="text-sm font-medium text-gray-700">{t('linkWeChat')}</span>
              </div>
            </div>
          )}

        </div>

        {/* WeChat Modal */}
        <WeChatModal
          isOpen={showWeChatModal}
          onClose={() => setShowWeChatModal(false)}
          onQRGenerated={handleWeChatQRGenerated}
          onStatusChange={handleWeChatStatusChange}
        />

      </div>
    </div>
    </>
  );
};

export default UserPage;

