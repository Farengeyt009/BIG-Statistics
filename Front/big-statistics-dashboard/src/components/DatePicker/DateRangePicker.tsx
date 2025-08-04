import React, { useState } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { registerLocale } from 'react-datepicker';
import { enUS as en } from 'date-fns/locale';
import { zhCN as zh } from 'date-fns/locale';
import { format } from 'date-fns';
import './DatePicker.css';

// Регистрируем локали
registerLocale('en', en);
registerLocale('zh', zh);

interface DateRangePickerProps {
  startDate: Date | null;
  endDate: Date | null;
  onStartDateChange: (date: Date | null) => void;
  onEndDateChange: (date: Date | null) => void;
  placeholder?: string;
  disabled?: boolean;
  locale?: 'en' | 'zh';
  className?: string;
}

const DateRangePicker: React.FC<DateRangePickerProps> = ({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  placeholder = 'Выберите диапазон дат',
  disabled = false,
  locale = 'en',
  className = ''
}) => {
  const [isOpen, setIsOpen] = useState(false);
  
  // Минимальная дата: 1 января 2025
  const minDate = new Date(2025, 0, 1);
  
  // Максимальная дата: сегодня
  const maxDate = new Date();

  // Форматирование даты для отображения
  const formatDate = (date: Date) => {
    return format(date, 'dd.MM.yyyy');
  };

  // Форматирование диапазона дат для отображения
  const formatDateRange = () => {
    if (!startDate && !endDate) return placeholder;
    if (startDate && !endDate) return `${formatDate(startDate)} - ...`;
    if (!startDate && endDate) return `... - ${formatDate(endDate)}`;
    if (startDate && endDate) return `${formatDate(startDate)} - ${formatDate(endDate)}`;
    return placeholder;
  };

  // Обработчик изменения дат
  const handleDateChange = (dates: [Date | null, Date | null]) => {
    const [start, end] = dates;
    onStartDateChange(start);
    onEndDateChange(end);
    
    // Если выбраны обе даты, закрываем попап
    if (start && end) {
      setIsOpen(false);
    }
  };

  return (
    <div className={`relative ${className}`}>
      {/* Поле для отображения диапазона */}
      <div className="flex-1">
        <input
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none text-center cursor-pointer"
          placeholder={placeholder}
          value={formatDateRange()}
          disabled={disabled}
          readOnly
          onClick={() => setIsOpen(!isOpen)}
        />
      </div>

      {/* Скрытый DatePicker для выбора диапазона */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 z-50">
          <DatePicker
            selected={startDate}
            onChange={handleDateChange}
            startDate={startDate}
            endDate={endDate}
            selectsRange={true}
            dateFormat="dd.MM.yyyy"
            locale={locale}
            minDate={minDate}
            maxDate={maxDate}
            disabled={disabled}
            placeholderText="Выберите диапазон дат"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none"
            showYearDropdown
            showMonthDropdown
            dropdownMode="select"
            yearDropdownItemNumber={10}
            scrollableYearDropdown
            inline
            onClickOutside={() => setIsOpen(false)}
          />
        </div>
      )}
    </div>
  );
};

export default DateRangePicker; 