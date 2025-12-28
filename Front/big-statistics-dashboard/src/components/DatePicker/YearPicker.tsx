import React, { useState, useRef, useEffect } from 'react';
import { Calendar, ChevronDown } from 'lucide-react';

interface Props {
  selectedYear: number | null;
  onChange: (year: number | null) => void;
  availableYears: number[];
  placeholder?: string;
}

export default function YearPicker({ selectedYear, onChange, availableYears, placeholder = 'Select year' }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Закрытие при клике вне компонента
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleSelect = (year: number) => {
    onChange(year);
    setIsOpen(false);
  };

  // Сортируем года по убыванию (новые вверху)
  const sortedYears = [...availableYears].sort((a, b) => b - a);

  return (
    <div ref={dropdownRef} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-md bg-white hover:bg-gray-50 transition min-w-[150px]"
      >
        <Calendar className="w-4 h-4 text-gray-500" />
        <span className="flex-1 text-left text-sm">
          {selectedYear || placeholder}
        </span>
        <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-300 rounded-md shadow-lg max-h-64 overflow-y-auto">
          {/* Список годов */}
          {sortedYears.map((year) => (
            <button
              key={year}
              onClick={() => handleSelect(year)}
              className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-50 transition ${
                selectedYear === year ? 'bg-blue-50 text-blue-600 font-medium' : 'text-gray-700'
              }`}
            >
              {year}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

