import React from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { registerLocale } from 'react-datepicker';
import { enUS as en } from 'date-fns/locale';
import { zhCN as zh } from 'date-fns/locale';
import { format } from 'date-fns';

// Регистрируем локали
registerLocale('en', en);
registerLocale('zh', zh);

interface CustomDatePickerProps {
  selectedDate: Date | null;
  onChange: (date: Date | null) => void;
  placeholder?: string;
  disabled?: boolean;
  locale?: 'en' | 'zh';
  className?: string;
}

const CustomDatePicker: React.FC<CustomDatePickerProps> = ({
  selectedDate,
  onChange,
  placeholder = 'Выберите дату',
  disabled = false,
  locale = 'en',
  className = ''
}) => {
  // Минимальная дата: 1 января 2025
  const minDate = new Date(2025, 0, 1);
  
  // Максимальная дата: сегодня
  const maxDate = new Date();

  // Форматирование даты для отображения
  const formatDate = (date: Date) => {
    return format(date, 'dd.MM.yyyy');
  };

  // Парсинг даты из строки
  const parseDate = (dateString: string) => {
    const parts = dateString.split('.');
    if (parts.length === 3) {
      const day = parseInt(parts[0]);
      const month = parseInt(parts[1]) - 1; // Месяцы в JS начинаются с 0
      const year = parseInt(parts[2]);
      return new Date(year, month, day);
    }
    return null;
  };

  return (
    <div className={`relative ${className}`}>
      <DatePicker
        selected={selectedDate}
        onChange={onChange}
        dateFormat="dd.MM.yyyy"
        locale={locale}
        minDate={minDate}
        maxDate={maxDate}
        disabled={disabled}
        placeholderText={placeholder}
        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none"
        showYearDropdown
        showMonthDropdown
        dropdownMode="select"
        yearDropdownItemNumber={10}
        scrollableYearDropdown

        customInput={
          <input
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none text-center"
            placeholder={placeholder}
            disabled={disabled}
          />
        }
      />
    </div>
  );
};

export default CustomDatePicker; 