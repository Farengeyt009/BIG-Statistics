import React from 'react';
import mokLogo from '../../assets/Mok-logo-gray.png';

type LoadingSpinnerProps = {
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'auto';
  text?: string;
  variant?: 'light' | 'dark';
  className?: string;
  /**
   * Режим оверлея:
   * - true | 'content' — прикрывает только родительский контейнер (absolute inset-0)
   * - 'screen' — полноэкранный (fixed inset-0)
   * - undefined/false — без оверлея
   */
  overlay?: boolean | 'content' | 'screen';
  /** Класс фона оверлея (по умолчанию как на макете) */
  overlayBgClass?: string;
  /** Класс z-index оверлея */
  overlayZIndexClass?: string;
};

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ 
  size = 'auto', 
  text, 
  variant = 'light',
  className = '',
  overlay,
  overlayBgClass,
  overlayZIndexClass = 'z-20'
}) => {
  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-12 h-12', 
    lg: 'w-16 h-16',
    xl: 'w-24 h-24',
    auto: 'w-full h-full max-w-16 max-h-16'
  };

  const textSizeClasses = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg', 
    xl: 'text-xl',
    auto: 'text-base'
  };

  const variantClasses = {
    light: 'text-gray-600',
    dark: 'text-gray-300'
  };

  const spinner = (
    <div className={`flex flex-col items-center justify-center gap-3 ${className}`}>
      <div className={`relative ${sizeClasses[size]}`}>
        {/* Shimmer overlay */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer rounded-full" />
        {/* Logo */}
        <img 
          src={mokLogo} 
          alt="Loading..." 
          className="w-full h-full object-contain animate-pulse"
        />
      </div>
      {text && (
        <div className={`${textSizeClasses[size]} ${variantClasses[variant]} font-medium animate-pulse`}>
          {text}
        </div>
      )}
    </div>
  );

  // Оборачивание в оверлей по запросу
  if (overlay) {
    const mode = overlay === 'screen' ? 'screen' : 'content';
    // Для полноэкранного оверлея используем fixed с отступами от сайдбара и шапки
    // Для content используем absolute относительно родителя
    const positionClass = mode === 'screen' 
      ? 'fixed top-[var(--header-height,80px)] left-[var(--sidebar-width,4rem)] right-0 bottom-0' 
      : 'absolute inset-0';
    // Для полноэкранного оверлея используем непрозрачный белый фон по умолчанию
    const defaultBg = mode === 'screen' ? 'bg-white' : 'bg-white/60 backdrop-blur-sm';
    const bgClass = overlayBgClass || defaultBg;
    return (
      <div className={`${positionClass} ${overlayZIndexClass} ${bgClass} flex items-center justify-center`}>
        {spinner}
      </div>
    );
  }

  return spinner;
};

export default LoadingSpinner;
