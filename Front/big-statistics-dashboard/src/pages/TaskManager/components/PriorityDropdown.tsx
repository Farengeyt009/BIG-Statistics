import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, Check } from 'lucide-react';
import { priorityConfig, PriorityIcon } from './PrioritySelector';
import TaskManagerTranslation from '../TaskManagerTranslation.json';

interface PriorityDropdownProps {
  value: string;
  onChange: (value: string) => void;
}

export const PriorityDropdown: React.FC<PriorityDropdownProps> = ({ value, onChange }) => {
  const { t, i18n } = useTranslation('taskManager');
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const currentLang = i18n.language;
    if (TaskManagerTranslation[currentLang as keyof typeof TaskManagerTranslation]) {
      i18n.addResourceBundle(currentLang, 'taskManager', TaskManagerTranslation[currentLang as keyof typeof TaskManagerTranslation], true, true);
    }
  }, [i18n]);

  const currentPriority = priorityConfig.find(p => p.value === value) ?? priorityConfig[1];

  const getPriorityLabel = (priorityValue: string) => {
    const key = `priority${priorityValue.charAt(0).toUpperCase() + priorityValue.slice(1)}`;
    return t ? t(key) : priorityConfig.find(p => p.value === priorityValue)?.label ?? priorityValue;
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

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-2.5 py-1.5 bg-white border border-gray-200 rounded-md hover:border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm transition-colors"
      >
        <div className="flex items-center gap-2">
          <PriorityIcon priority={currentPriority.value} />
          <span style={{ color: currentPriority.color }} className="font-medium">
            {getPriorityLabel(currentPriority.value)}
          </span>
        </div>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-50">
          {priorityConfig.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => { onChange(option.value); setIsOpen(false); }}
              className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 transition-colors ${
                option.value === value ? 'bg-gray-50' : ''
              }`}
            >
              <PriorityIcon priority={option.value} />
              <span style={{ color: option.color }} className="font-medium">
                {getPriorityLabel(option.value)}
              </span>
              {option.value === value && (
                <Check className="w-4 h-4 ml-auto text-blue-600" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
