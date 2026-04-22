import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertCircle } from 'lucide-react';
import TaskManagerTranslation from '../TaskManagerTranslation.json';

interface PrioritySelectorProps {
  priority: string;
  taskId: number;
  onUpdate: (priority: string) => void;
}

// Кастомные SVG-иконки: 3 столбика, filled = количество активных
const SignalBars: React.FC<{ filled: number }> = ({ filled }) => (
  <svg viewBox="0 0 12 12" fill="currentColor" className="w-full h-full">
    <rect x="0"   y="7.5" width="2.5" height="4.5" rx="0.6" opacity={filled >= 1 ? 1 : 0.2} />
    <rect x="4.5" y="4"   width="2.5" height="8"   rx="0.6" opacity={filled >= 2 ? 1 : 0.2} />
    <rect x="9"   y="0.5" width="2.5" height="11.5" rx="0.6" opacity={filled >= 3 ? 1 : 0.2} />
  </svg>
);

export const priorityConfig = [
  { value: 'low',      label: 'Низкий',      icon: () => <SignalBars filled={1} />, color: '#3b82f6' },
  { value: 'medium',   label: 'Средний',     icon: () => <SignalBars filled={2} />, color: '#eab308' },
  { value: 'high',     label: 'Высокий',     icon: () => <SignalBars filled={3} />, color: '#f97316' },
  { value: 'critical', label: 'Критический', icon: () => <AlertCircle className="w-full h-full" strokeWidth={2.5} />, color: '#ef4444' },
];

// Экспортируемая иконка приоритета для использования в карточках/строках
export const PriorityIcon: React.FC<{
  priority: string;
  className?: string;
  style?: React.CSSProperties;
}> = ({ priority }) => {
  const cfg = priorityConfig.find(p => p.value === priority) ?? priorityConfig[1];
  const Icon = cfg.icon;

  const containerStyle: React.CSSProperties = {
    color: cfg.color,
    borderColor: cfg.color,
    backgroundColor: `${cfg.color}20`,
  };

  return (
    <span
      className="inline-flex items-center justify-center rounded border w-5 h-5 shrink-0"
      style={containerStyle}
      title={cfg.label}
    >
      <span className="w-3 h-3 flex items-center justify-center">
        <Icon />
      </span>
    </span>
  );
};

// Устаревший экспорт — оставляем для обратной совместимости
export const PriorityIcons: Record<string, React.FC<{ className?: string; style?: React.CSSProperties }>> =
  Object.fromEntries(
    priorityConfig.map(({ value }) => [
      value,
      () => <PriorityIcon priority={value} />,
    ])
  );

export const PrioritySelector: React.FC<PrioritySelectorProps> = ({ priority, taskId, onUpdate }) => {
  const { t, i18n } = useTranslation('taskManager');
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const currentLang = i18n.language;
    if (TaskManagerTranslation[currentLang as keyof typeof TaskManagerTranslation]) {
      i18n.addResourceBundle(currentLang, 'taskManager', TaskManagerTranslation[currentLang as keyof typeof TaskManagerTranslation], true, true);
    }
  }, [i18n]);

  const currentPriority = priorityConfig.find(p => p.value === priority) ?? priorityConfig[1];

  const getPriorityLabel = (value: string) => {
    const key = `priority${value.charAt(0).toUpperCase() + value.slice(1)}`;
    return t ? t(key) : priorityConfig.find(p => p.value === value)?.label ?? value;
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const Icon = currentPriority.icon;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}
        className="flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-gray-100 transition-colors"
        title={getPriorityLabel(currentPriority.value)}
      >
        <PriorityIcon priority={currentPriority.value} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-50 min-w-[160px]">
          {priorityConfig.map((p) => (
            <button
              key={p.value}
              onClick={(e) => { e.stopPropagation(); onUpdate(p.value); setIsOpen(false); }}
              className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 transition-colors ${
                p.value === priority ? 'bg-gray-50' : ''
              }`}
            >
              <PriorityIcon priority={p.value} />
              <span className="text-gray-900">{getPriorityLabel(p.value)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
