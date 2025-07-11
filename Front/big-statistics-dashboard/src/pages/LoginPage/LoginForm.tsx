import React, { useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import ForgotPasswordBanner from "./ForgotPasswordBanner";

const mockLogin = async (username: string, password: string) => {
  // Проверка двух тестовых аккаунтов
  return new Promise<{ success: boolean; error?: string }>((resolve) => {
    setTimeout(() => {
      if (
        (username === "GM" && password === "123") ||
        (username === "Umar" && password === "123")
      ) {
        resolve({ success: true });
      } else {
        resolve({ success: false, error: "loginError" });
      }
    }, 1000);
  });
};

const LoginForm: React.FC = () => {
  const { t } = useTranslation('loginPage');
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const formRef = useRef<HTMLFormElement>(null);
  const [showBanner, setShowBanner] = useState(false);

  const handleForgotPassword = (e: React.MouseEvent) => {
    e.preventDefault();
    setShowBanner(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const result = await mockLogin(username, password);
    setLoading(false);
    if (result.success) {
      localStorage.setItem("isAuth", "true");
      localStorage.setItem("user", username); // сохраняем имя пользователя
      navigate("/"); // редирект на главную
    } else {
      setError(t(result.error || 'loginError'));
    }
  };

  // Сброс ошибки при изменении полей
  const handleInputChange = (setter: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setter(e.target.value);
    if (error) setError(null);
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
          <button type="button" className="text-blue-600 hover:underline text-sm">{t('register')}</button>
          <a href="#" onClick={handleForgotPassword} className="text-blue-600 hover:underline text-sm">{t('forgotPassword')}</a>
        </div>
      </form>
      {showBanner && (
        <ForgotPasswordBanner
          message={t("forgotPasswordBanner")}
          onClose={() => setShowBanner(false)}
        />
      )}
    </div>
  );
};

export default LoginForm; 