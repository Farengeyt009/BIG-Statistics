import React from "react";
import LoginForm from "./LoginForm";
import logo from "../../assets/logo_big_statistics.png";
import LanguageSwitcher from "../../components/LanguageSwitcher";

const LoginPage: React.FC = () => {
  return (
    <div className="relative flex items-center justify-center min-h-screen">
      {/* Фоновое изображение */}
      <img
        src="/Layout.png"
        alt="background"
        className="absolute z-0 object-contain opacity-50"
        style={{
          pointerEvents: "none",
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%) scale(1.2)",
          transformOrigin: "center center",
          position: "absolute",
          maxWidth: "100vw",
          maxHeight: "100vh",
          width: "auto",
          height: "auto",
        }}
      />
      {/* Основной контент */}
      <div className="relative z-10 flex rounded-3xl shadow-lg overflow-visible border-2 border-[#142143]" style={{ width: 500, height: 270 }}>
        {/* Левая часть с логотипом */}
        <div className="flex flex-col justify-between items-center bg-[#142143] py-6 h-full rounded-l-3xl" style={{ width: 160 }}>
          <div className="flex-1 flex items-center justify-center w-full">
            <img src={logo} alt="BIG STATISTICS" className="w-32" />
          </div>
          <div className="w-full flex justify-center mt-4">
            <LanguageSwitcher />
          </div>
        </div>
        {/* Правая часть с формой */}
        <div className="flex items-center justify-center bg-white h-full rounded-r-3xl" style={{ width: 340 }}>
          <LoginForm />
        </div>
      </div>
    </div>
  );
};

export default LoginPage; 