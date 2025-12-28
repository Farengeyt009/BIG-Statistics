import React from 'react';

/**
 * PageLayout - главный layout для страниц
 * 
 * Обеспечивает:
 * - Отступы от краёв (p-4)
 * - Центрирование контента
 * - Максимальную ширину контента (1800px)
 * 
 * Используется для оборачивания всей страницы (PageHeader + контент)
 */

interface PageLayoutProps {
  children: React.ReactNode;
  /** Максимальная ширина контента. По умолчанию: 1800px */
  maxWidth?: string;
  /** Внешние отступы. По умолчанию: p-4 */
  padding?: string;
}

export const PageLayout: React.FC<PageLayoutProps> = ({ 
  children, 
  maxWidth = '1800px',
  padding = 'p-2'
}) => {
  return (
    <div className={padding}>
      <div className="w-full flex justify-center">
        <div className="w-full" style={{ maxWidth }}>
          {children}
        </div>
      </div>
    </div>
  );
};

