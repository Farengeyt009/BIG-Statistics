import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import TaskManagerTranslation from '../TaskManagerTranslation.json';

interface PriorityDropdownProps {
  value: string;
  onChange: (value: string) => void;
}

const priorityOptions = [
  { value: 'low', icon: '◔', color: '#10b981' },
  { value: 'medium', icon: '◑', color: '#f59e0b' },
  { value: 'high', icon: '◕', color: '#ef4444' },
  { value: 'critical', icon: '●', color: '#7c3aed' },
];

export const PriorityDropdown: React.FC<PriorityDropdownProps> = ({ value, onChange }) => {
  const { t, i18n } = useTranslation('taskManager');
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Load translations for Task Manager
  React.useEffect(() => {
    const currentLang = i18n.language;
    if (TaskManagerTranslation[currentLang as keyof typeof TaskManagerTranslation]) {
      i18n.addResourceBundle(currentLang, 'taskManager', TaskManagerTranslation[currentLang as keyof typeof TaskManagerTranslation], true, true);
    }
  }, [i18n]);

  const currentPriority = priorityOptions.find((p) => p.value === value) || priorityOptions[1];

  // Function to get translated priority label
  const getPriorityLabel = (priorityValue: string) => {
    const priorityKey = `priority${priorityValue.charAt(0).toUpperCase() + priorityValue.slice(1)}`;
    return t ? t(priorityKey) : priorityValue;
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-2.5 py-1.5 bg-white border border-gray-200 rounded-md hover:border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm transition-colors"
      >
        <div className="flex items-center gap-2">
          <span style={{ color: currentPriority.color }} className="font-medium">
            {currentPriority.icon}
          </span>
          <span style={{ color: currentPriority.color }} className="font-medium">
            {getPriorityLabel(currentPriority.value)}
          </span>
        </div>
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-50">
          {priorityOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
              className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 transition-colors ${
                option.value === value ? 'bg-gray-50' : ''
              }`}
            >
              <span style={{ color: option.color }} className="font-medium text-base">
                {option.icon}
              </span>
              <span style={{ color: option.color }} className="font-medium">
                {getPriorityLabel(option.value)}
              </span>
              {option.value === value && (
                <svg className="w-4 h-4 ml-auto text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

