import React from 'react';

/**
 * ContentLayout - layout для контента внутри вкладок
 * 
 * Обеспечивает:
 * - Внутренние отступы (padding)
 * - Вертикальные отступы между элементами (spacing)
 * - Минимальную высоту
 * - Относительное позиционирование для overlay
 * 
 * Используется внутри компонентов вкладок (DailyPlanFact, TimeLoss и т.д.)
 */

interface ContentLayoutProps {
  children: React.ReactNode;
  /** CSS класс для padding. По умолчанию: p-2 */
  padding?: string;
  /** CSS класс для spacing. По умолчанию: space-y-3 */
  spacing?: string;
  /** Минимальная высота. По умолчанию: min-h-[70vh] */
  minHeight?: string;
  /** Относительное позиционирование для overlay. По умолчанию: true */
  relative?: boolean;
  /** ВРЕМЕННО: показать визуализацию сетки */
  showGrid?: boolean;
}

export const ContentLayout: React.FC<ContentLayoutProps> = ({ 
  children,
  padding = 'p-2',
  spacing = 'space-y-3',
  minHeight = 'min-h-[70vh]',
  relative = true,
  showGrid = false
}) => {
  const baseClasses = relative ? 'relative' : '';
  
  return (
    <div 
      className={`${padding} ${spacing} ${minHeight} ${baseClasses} ${showGrid ? 'border-4 border-green-500 border-dashed bg-green-50/20' : ''}`}
      data-content-layout="true"
    >
      {children}
    </div>
  );
};

