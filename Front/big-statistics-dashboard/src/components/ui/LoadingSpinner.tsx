import React from 'react';
import mokLogo from '../../assets/Mok-logo-gray.png';

type LoadingSpinnerProps = {
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'auto';
  text?: string;
  variant?: 'light' | 'dark';
  className?: string;
};

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ 
  size = 'auto', 
  text, 
  variant = 'light',
  className = ''
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

  return (
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
};

export default LoadingSpinner;
