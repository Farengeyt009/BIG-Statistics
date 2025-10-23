import React, { useState, useRef, useEffect } from 'react';

export type SortOption = 'created' | 'updated' | 'priority' | 'title' | 'dueDate';

interface SortSelectorProps {
  value: SortOption;
  onChange: (value: SortOption) => void;
}

const sortOptions = [
  { value: 'created' as SortOption, label: 'Дата создания' },
  { value: 'updated' as SortOption, label: 'Дата обновления' },
  { value: 'priority' as SortOption, label: 'Приоритет' },
  { value: 'title' as SortOption, label: 'Название' },
  { value: 'dueDate' as SortOption, label: 'Срок выполнения' },
];

export const SortSelector: React.FC<SortSelectorProps> = ({ value, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentSort = sortOptions.find((opt) => opt.value === value) || sortOptions[0];

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
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
        </svg>
        {currentSort.label}
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-50 min-w-[180px]">
          {sortOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
              className={`w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-gray-50 transition-colors ${
                option.value === value ? 'bg-gray-50 font-medium' : ''
              }`}
            >
              <span className="text-gray-900">{option.label}</span>
              {option.value === value && (
                <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

