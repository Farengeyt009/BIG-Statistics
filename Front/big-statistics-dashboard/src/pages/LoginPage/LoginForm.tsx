import React, { useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import ForgotPasswordBanner from "./ForgotPasswordBanner";

const LoginForm: React.FC = () => {
  const { t, i18n } = useTranslation('loginPage');
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const formRef = useRef<HTMLFormElement>(null);
  const [showBanner, setShowBanner] = useState(false);
  const { login } = useAuth();
  
  // State для модального окна регистрации
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [employeeData, setEmployeeData] = useState<any>(null);
  const [regUsername, setRegUsername] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regConfirmPassword, setRegConfirmPassword] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regError, setRegError] = useState("");
  const [regLoading, setRegLoading] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [departments, setDepartments] = useState<Array<{ id: number; name: string; name_en?: string | null; name_zh?: string | null; code?: string | null }>>([]);
  const [departmentsLoading, setDepartmentsLoading] = useState(false);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<number | null>(null);
  const [preferredLanguage, setPreferredLanguage] = useState<'en' | 'zh'>(
    i18n.language.startsWith('zh') ? 'zh' : 'en'
  );
  const [registerStep, setRegisterStep] = useState<1 | 2>(1);
  
  // State для аватара
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const redRequired = <span className="text-red-500">*</span>;

  const resetRegisterForm = () => {
    setRegUsername("");
    setRegPassword("");
    setRegConfirmPassword("");
    setRegEmail("");
    setRegError("");
    setUsernameAvailable(null);
    setEmployeeData(null);
    setSelectedDepartmentId(null);
    setPreferredLanguage(i18n.language.startsWith('zh') ? 'zh' : 'en');
    setAvatarFile(null);
    setAvatarPreview(null);
    setRegisterStep(1);
  };

  const closeRegisterDrawer = () => {
    setShowRegisterModal(false);
    resetRegisterForm();
  };

  const handleNextRegisterStep = () => {
    if (!selectedDepartmentId) {
      setRegError(t('departmentRequired'));
      return;
    }
    setRegError("");
    setRegisterStep(2);
  };

  const handleForgotPassword = (e: React.MouseEvent) => {
    e.preventDefault();
    setShowBanner(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessMessage(null);
    
    // ШАГ 1: Обычная попытка входа (проверка Users.Users)
    const result = await login(username, password);
    
    if (result.success) {
      // Пользователь найден и пароль правильный
      setLoading(false);
      navigate("/");
      return;
    }
    
    // ШАГ 2: Вход не удался - проверяем причину
    // Если пароль = "123", возможно это попытка регистрации
    if (password === "123") {
      try {
        const checkResponse = await fetch('/api/auth/check-empcode', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            empcode: username,
            language: i18n.language 
          })
        });
        
        const checkData = await checkResponse.json();
        
        if (checkData.success && checkData.exists_in_users) {
          // Пользователь существует, но пароль неправильный
          setLoading(false);
          setError(t('incorrectPassword'));
          return;
        }
        
        if (checkData.success && checkData.exists_in_skud && !checkData.exists_in_users) {
          // Найден в СКУД, не зарегистрирован - показываем форму регистрации
          setEmployeeData(checkData.employee_data);
          setShowRegisterModal(true);
          setSelectedDepartmentId(null);
          setPreferredLanguage(i18n.language.startsWith('zh') ? 'zh' : 'en');
          setRegError("");
          setRegisterStep(1);
          loadDepartments();
          setLoading(false);
          return;
        }
        
        if (!checkData.success) {
          // Не найден ни в Users, ни в СКУД
          setLoading(false);
          setError(checkData.error || t('employeeNotFound'));
          return;
        }
      } catch (err) {
        console.error('Error checking empcode:', err);
      }
    }
    
    // ШАГ 3: Пароль не "123" или другая ошибка
    setLoading(false);
    
    // Переводим код ошибки
    if (result.error === 'INVALID_CREDENTIALS') {
      setError(t('loginError'));
    } else if (result.error === 'MISSING_CREDENTIALS') {
      setError(t('loginError'));
    } else {
      setError(result.error || t('loginError'));
    }
  };

  // Сброс сообщений при изменении полей
  const handleInputChange = (setter: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setter(e.target.value);
    if (error) setError(null);
    if (successMessage) setSuccessMessage(null);
  };

  // Проверка уникальности username
  const checkUsernameAvailability = async (value: string) => {
    if (!value || value.length < 2) {
      setUsernameAvailable(null);
      return;
    }
    
    setCheckingUsername(true);
    
    try {
      const response = await fetch('/api/auth/check-username', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: value })
      });
      
      const data = await response.json();
      setUsernameAvailable(data.available);
    } catch (err) {
      console.error('Error checking username:', err);
      setUsernameAvailable(null);
    } finally {
      setCheckingUsername(false);
    }
  };

  // Обработчик изменения username в форме регистрации
  const handleRegUsernameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setRegUsername(value);
    setRegError("");
    
    // Проверяем доступность с задержкой (debounce)
    setTimeout(() => {
      if (value === regUsername) { // Проверяем что значение не изменилось
        checkUsernameAvailability(value);
      }
    }, 500);
  };

  const loadDepartments = async () => {
    setDepartmentsLoading(true);
    try {
      const response = await fetch('/api/departments');
      const data = await response.json();
      if (data.success) {
        setDepartments(data.departments || []);
      } else {
        setRegError(data.error || t('departmentsLoadFailed'));
      }
    } catch {
      setRegError(t('departmentsLoadFailed'));
    } finally {
      setDepartmentsLoading(false);
    }
  };

  const departmentLabel = (dep: { name: string; name_en?: string | null; name_zh?: string | null }) => {
    if (i18n.language.startsWith('zh')) return dep.name_zh || dep.name_en || dep.name;
    return dep.name_en || dep.name || dep.name_zh || '';
  };

  // Обработчик выбора аватара
  const handleAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Валидация
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setRegError(t('invalidFormat'));
      return;
    }

    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      setRegError(t('fileTooLarge'));
      return;
    }

    setAvatarFile(file);
    
    // Создаем preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setAvatarPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Регистрация нового пользователя
  const handleRegister = async () => {
    // Валидация
    if (!regUsername || regUsername.length < 2) {
      setRegError(t('usernameTooShort'));
      return;
    }
    
    if (!regPassword || regPassword.length < 6) {
      setRegError(t('passwordTooShort'));
      return;
    }
    
    if (regPassword !== regConfirmPassword) {
      setRegError(t('passwordsDoNotMatch'));
      return;
    }
    
    if (usernameAvailable === false) {
      setRegError(t('usernameTaken'));
      return;
    }

    if (!selectedDepartmentId) {
      setRegError(t('departmentRequired'));
      return;
    }
    
    setRegLoading(true);
    setRegError("");
    
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          empcode: employeeData.empcode,
          username: regUsername,
          password: regPassword,
          email: regEmail,
          department_id: selectedDepartmentId,
          preferred_language: preferredLanguage
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        // Если есть аватар - загружаем его
        if (avatarFile) {
          try {
            const formData = new FormData();
            formData.append('avatar', avatarFile);

            await fetch('/api/users/avatar', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${data.token}`,
              },
              body: formData,
            });
          } catch (avatarErr) {
            console.log('Avatar upload failed, but registration successful');
          }
        }
        
        // Закрываем модальное окно
        closeRegisterDrawer();
        
        // Показываем зеленое сообщение об успехе
        setSuccessMessage(`✅ ${t('registrationSuccess', { username: data.user.username })}`);
        
        // Заполняем поле login новым username для удобства
        setUsername(data.user.username);
        setPassword("");
      } else {
        setRegError(data.error || t('registrationFailed'));
      }
    } catch (err) {
      setRegError(t('connectionError'));
    } finally {
      setRegLoading(false);
    }
  };

  return (
    <div className="relative overflow-visible">
      {/* Всплывающая плашка ошибки */}
      {error && (
        <div
          className="
            absolute left-full
            ml-6
            top-1/2 -translate-y-1/2
            z-50 min-w-[200px]
            bg-red-100 border border-red-400 text-red-700
            px-4 py-3 rounded-lg shadow-lg flex items-center
            animate-fade-in
          "
        >
          <svg
            className="w-5 h-5 mr-2 text-red-500"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v2m0 4h.01M21 12A9 9 0 1 1 3 12a9 9 0 0 1 18 0Z"
            />
          </svg>
          <span>{error}</span>
        </div>
      )}
      
      {/* Всплывающая плашка успеха */}
      {successMessage && (
        <div
          className="
            absolute left-full
            ml-6
            top-1/2 -translate-y-1/2
            z-50 min-w-[250px]
            bg-green-100 border border-green-400 text-green-700
            px-4 py-3 rounded-lg shadow-lg flex items-center
            animate-fade-in
          "
        >
          <svg
            className="w-5 h-5 mr-2 text-green-500"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span>{successMessage}</span>
        </div>
      )}
      <form ref={formRef} onSubmit={handleSubmit} style={{ minWidth: 300, padding: 24, borderRadius: 8, background: "#fff" }}>
        <div style={{ marginBottom: 0 }}>
          <input
            type="text"
            placeholder={t('loginPlaceholder')}
            value={username}
            onChange={handleInputChange(setUsername)}
            style={{ width: "100%", padding: 8 }}
          />
          <div className="h-px bg-gray-200 w-full mt-1 mb-3"></div>
        </div>
        <div style={{ marginBottom: 0 }}>
          <input
            type="password"
            placeholder={t('passwordPlaceholder')}
            value={password}
            onChange={handleInputChange(setPassword)}
            style={{ width: "100%", padding: 8 }}
          />
          <div className="h-px bg-gray-200 w-full mt-1 mb-3"></div>
        </div>
        <button
          type="submit"
          disabled={loading}
          className="h-10 mt-4 bg-[#142143] text-white rounded-md font-semibold transition-colors duration-200 hover:bg-[#1a295c] disabled:opacity-60 w-36 mx-auto block"
        >
          {loading ? t('loginButton') + '...' : t('loginButton')}
        </button>
        <div className="flex justify-between mt-10">
          <button 
            type="button" 
            onClick={() => {
              resetRegisterForm();
              // Подсказка пользователю
              setError(t('registerHint'));
            }}
            className="text-blue-600 hover:underline text-sm"
          >
            {t('register')}
          </button>
          <a href="#" onClick={handleForgotPassword} className="text-blue-600 hover:underline text-sm">{t('forgotPassword')}</a>
        </div>
      </form>
      {showBanner && (
        <ForgotPasswordBanner
          message={t("forgotPasswordBanner")}
          onClose={() => setShowBanner(false)}
        />
      )}

      {/* Модальное окно регистрации */}
      {showRegisterModal && employeeData && (
        <>
          <div className="fixed inset-0 z-40 bg-black/30" onClick={closeRegisterDrawer} />
          <div className="fixed top-0 right-0 h-full w-full max-w-lg bg-white shadow-2xl z-50 flex">
            <div className="flex-1 flex flex-col min-w-0">
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                <div>
                  <span className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-medium text-gray-700">
                    {registerStep}/2
                  </span>
                </div>
                <button
                  onClick={closeRegisterDrawer}
                  className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-6 py-5">
                {regError && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <div className="flex items-center">
                      <svg className="w-5 h-5 text-red-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="text-red-800 text-sm">{regError}</span>
                    </div>
                  </div>
                )}

                {registerStep === 1 && (
                  <div className="space-y-5">
                    <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                      <p className="text-sm font-semibold text-blue-900 mb-2">{t('employeeInfoFromSkud')}</p>
                      <div className="space-y-1">
                        <p className="text-sm text-blue-800">
                          <span className="font-medium">{t('code')}:</span> {employeeData.empcode}
                        </p>
                        <p className="text-sm text-blue-800">
                          <span className="font-medium">{t('name')}:</span> {employeeData.empname}
                        </p>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {t('department')} {redRequired}
                      </label>
                      <select
                        value={selectedDepartmentId ?? ''}
                        onChange={(e) => {
                          const value = Number(e.target.value);
                          setSelectedDepartmentId(Number.isNaN(value) ? null : value);
                          setRegError("");
                        }}
                        disabled={departmentsLoading || regLoading}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                      >
                        <option value="">
                          {departmentsLoading ? t('loadingDepartments') : t('selectDepartment')}
                        </option>
                        {departments.map((dep) => (
                          <option key={dep.id} value={dep.id}>
                            {departmentLabel(dep)}{dep.code ? ` (${dep.code})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {t('preferredLanguage')} {redRequired}
                      </label>
                      <select
                        value={preferredLanguage}
                        onChange={(e) => setPreferredLanguage(e.target.value === 'zh' ? 'zh' : 'en')}
                        disabled={regLoading}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                      >
                        <option value="en">{t('languageEnglish')}</option>
                        <option value="zh">{t('languageChinese')}</option>
                      </select>
                    </div>
                  </div>
                )}

                {registerStep === 2 && (
                  <div className="space-y-4">
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2 text-center">
                        {t('avatar')} ({t('avatarOptional')})
                      </label>
                      <div className="flex flex-col items-center">
                        <div
                          onClick={() => avatarInputRef.current?.click()}
                          className="relative w-24 h-24 rounded-full bg-gray-100 border-2 border-dashed border-gray-300 hover:border-blue-500 cursor-pointer transition-all overflow-hidden group"
                        >
                          {avatarPreview ? (
                            <>
                              <img
                                src={avatarPreview}
                                alt="Avatar preview"
                                className="w-full h-full object-cover"
                              />
                              <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all flex items-center justify-center">
                                <svg className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                              </div>
                            </>
                          ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 group-hover:text-blue-500 transition-colors">
                              <svg className="w-8 h-8 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                              </svg>
                              <span className="text-xs">{t('clickToUpload')}</span>
                            </div>
                          )}
                        </div>
                        <input
                          ref={avatarInputRef}
                          type="file"
                          accept="image/png,image/jpeg,image/jpg,image/gif,image/webp"
                          onChange={handleAvatarSelect}
                          className="hidden"
                        />
                        <p className="text-xs text-gray-500 mt-2">{t('avatarFormats')}</p>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {t('username')} {redRequired}
                        <span className="text-xs text-gray-500 ml-2">({t('usernameHint')})</span>
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          value={regUsername}
                          onChange={handleRegUsernameChange}
                          className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                            usernameAvailable === false ? 'border-red-500' : usernameAvailable === true ? 'border-green-500' : 'border-gray-300'
                          }`}
                          placeholder={t('enterUsername')}
                          autoFocus
                        />
                        {checkingUsername && (
                          <div className="absolute right-3 top-3">
                            <svg className="animate-spin h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                          </div>
                        )}
                        {!checkingUsername && usernameAvailable === false && (
                          <p className="text-xs text-red-600 mt-1">❌ {t('usernameTaken')}</p>
                        )}
                        {!checkingUsername && usernameAvailable === true && (
                          <p className="text-xs text-green-600 mt-1">✅ {t('usernameAvailable')}</p>
                        )}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {t('password')} {redRequired}
                      </label>
                      <input
                        type="password"
                        value={regPassword}
                        onChange={(e) => {
                          setRegPassword(e.target.value);
                          setRegError("");
                        }}
                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                          regPassword && regPassword.length < 6 ? 'border-red-500' : 'border-gray-300'
                        }`}
                        placeholder={t('enterPassword')}
                      />
                      {regPassword && (
                        <div className="mt-1 space-y-1">
                          <p className={`text-xs flex items-center gap-1 ${regPassword.length >= 6 ? 'text-green-600' : 'text-red-600'}`}>
                            {regPassword.length >= 6 ? '✅' : '❌'} {t('passwordMinLength')}
                          </p>
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {t('confirmPassword')} {redRequired}
                      </label>
                      <input
                        type="password"
                        value={regConfirmPassword}
                        onChange={(e) => {
                          setRegConfirmPassword(e.target.value);
                          setRegError("");
                        }}
                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                          regPassword && regConfirmPassword && regPassword !== regConfirmPassword ? 'border-red-500' : 'border-gray-300'
                        }`}
                        placeholder={t('confirmPassword')}
                      />
                      {regPassword && regConfirmPassword && regPassword !== regConfirmPassword && (
                        <p className="text-xs text-red-600 mt-1">❌ {t('passwordsDoNotMatch')}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {t('email')}
                        <span className="text-xs text-gray-500 ml-2">({t('emailOptional')})</span>
                      </label>
                      <input
                        type="email"
                        value={regEmail}
                        onChange={(e) => setRegEmail(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder={t('enterEmail')}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between gap-2">
                <button
                  onClick={closeRegisterDrawer}
                  disabled={regLoading}
                  className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  {t('cancel')}
                </button>

                <div className="flex items-center gap-2">
                  {registerStep === 2 && (
                    <button
                      onClick={() => setRegisterStep(1)}
                      disabled={regLoading}
                      className="px-4 py-2 text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50"
                    >
                      {t('back')}
                    </button>
                  )}

                  {registerStep === 1 ? (
                    <button
                      onClick={handleNextRegisterStep}
                      disabled={regLoading || departmentsLoading}
                      className="px-4 py-2 text-sm font-medium bg-[#142143] text-white hover:bg-[#1a295c] rounded-lg transition-colors disabled:opacity-50"
                    >
                      {t('next')}
                    </button>
                  ) : (
                    <button
                      onClick={handleRegister}
                      disabled={regLoading || !regUsername || !regPassword || !regConfirmPassword || usernameAvailable === false || !selectedDepartmentId}
                      className="px-4 py-2 text-sm font-medium bg-[#142143] text-white hover:bg-[#1a295c] rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      {regLoading ? (
                        <>
                          <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          <span>{t('registering')}</span>
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          <span>{t('registerButton')}</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default LoginForm; 