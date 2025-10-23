import React from 'react';

interface HealthIndicatorProps {
  completed: number;
  total: number;
  size?: 'sm' | 'md';
}

export const HealthIndicator: React.FC<HealthIndicatorProps> = ({ completed, total, size = 'sm' }) => {
  const percentage = total > 0 ? (completed / total) * 100 : 0;
  
  // Определяем "здоровье" проекта
  const getHealth = () => {
    if (percentage >= 80) {
      return { icon: '●', color: '#10b981', label: 'Отлично' };
    } else if (percentage >= 50) {
      return { icon: '●', color: '#f59e0b', label: 'В процессе' };
    } else if (percentage >= 20) {
      return { icon: '●', color: '#ef4444', label: 'Под угрозой' };
    } else {
      return { icon: '●', color: '#9ca3af', label: 'Начало' };
    }
  };

  const health = getHealth();
  const sizeClass = size === 'sm' ? 'text-sm' : 'text-base';

  return (
    <button
      className="flex items-center gap-1.5 px-2 py-1 rounded hover:bg-gray-50 transition-colors"
      title={`${health.label}: ${completed} из ${total} задач завершено`}
    >
      <span className={sizeClass} style={{ color: health.color }}>
        {health.icon}
      </span>
      <span className={`${sizeClass === 'text-sm' ? 'text-xs' : 'text-sm'} text-gray-700 hidden xl:inline`}>
        {health.label}
      </span>
    </button>
  );
};

