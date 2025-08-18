import React, { useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { enUS, ru, zhCN } from "date-fns/locale";
import { CalendarPlus } from "lucide-react";
import { useTranslation } from 'react-i18next';
import dateRangePickerTranslations from './dateRangePickerTranslation.json';

type Lang = "en" | "ru" | "zh";
const LOCALES: Record<Lang, Locale> = { en: enUS, ru, zh: zhCN };

export interface YearMonthPickerProps {
  startDate: Date | null;
  onApply: (date: Date) => void;
  onCancel?: () => void;
  locale?: Lang;
  minDate?: Date;
  maxDate?: Date;
  placeholder?: string;
  className?: string;
  position?: "left" | "right";
}

const YearMonthPicker: React.FC<YearMonthPickerProps> = ({
  startDate,
  onApply,
  onCancel,
  locale = "en",
  minDate = new Date(2025, 0, 1),
  maxDate = new Date(new Date().getFullYear() + 1, 11, 31),
  placeholder,
  className = "",
  position = "left",
}) => {
  const translations = dateRangePickerTranslations[locale] || dateRangePickerTranslations.en;
  const defaultPlaceholder = placeholder || translations.selectDate;
  
  const [isOpen, setIsOpen] = useState(false);
  const [selectedYear, setSelectedYear] = useState(startDate?.getFullYear() || new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(startDate?.getMonth() || new Date().getMonth());
  
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Click outside handler
  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node))
        setIsOpen(false);
    };
    if (isOpen) document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, [isOpen]);

  // Update state when startDate changes
  useEffect(() => {
    if (startDate) {
      setSelectedYear(startDate.getFullYear());
      setSelectedMonth(startDate.getMonth());
    }
  }, [startDate]);

  // Display string - show only placeholder, not the actual date
  const display = "";

  // Generate years array
  const years = [];
  for (let year = minDate.getFullYear(); year <= maxDate.getFullYear(); year++) {
    years.push(year);
  }

  // Generate months array
  const months = [
    { value: 0, label: locale === 'ru' ? 'Январь' : locale === 'zh' ? '1月' : 'January' },
    { value: 1, label: locale === 'ru' ? 'Февраль' : locale === 'zh' ? '2月' : 'February' },
    { value: 2, label: locale === 'ru' ? 'Март' : locale === 'zh' ? '3月' : 'March' },
    { value: 3, label: locale === 'ru' ? 'Апрель' : locale === 'zh' ? '4月' : 'April' },
    { value: 4, label: locale === 'ru' ? 'Май' : locale === 'zh' ? '5月' : 'May' },
    { value: 5, label: locale === 'ru' ? 'Июнь' : locale === 'zh' ? '6月' : 'June' },
    { value: 6, label: locale === 'ru' ? 'Июль' : locale === 'zh' ? '7月' : 'July' },
    { value: 7, label: locale === 'ru' ? 'Август' : locale === 'zh' ? '8月' : 'August' },
    { value: 8, label: locale === 'ru' ? 'Сентябрь' : locale === 'zh' ? '9月' : 'September' },
    { value: 9, label: locale === 'ru' ? 'Октябрь' : locale === 'zh' ? '10月' : 'October' },
    { value: 10, label: locale === 'ru' ? 'Ноябрь' : locale === 'zh' ? '11月' : 'November' },
    { value: 11, label: locale === 'ru' ? 'Декабрь' : locale === 'zh' ? '12月' : 'December' },
  ];

  const handleApply = () => {
    const selectedDate = new Date(selectedYear, selectedMonth, 1);
    onApply(selectedDate);
    setIsOpen(false);
  };

  const handleCancel = () => {
    if (startDate) {
      setSelectedYear(startDate.getFullYear());
      setSelectedMonth(startDate.getMonth());
    }
    setIsOpen(false);
    onCancel?.();
  };

  return (
    <div ref={wrapperRef} className={`relative ${className}`}>
             {/* Trigger */}
       <div
         onClick={() => setIsOpen((o) => !o)}
         className="cursor-pointer p-1 hover:bg-gray-100 rounded transition-colors"
       >
         <CalendarPlus className="h-5 w-5 text-[#0d1c3d]" />
       </div>

      {isOpen && (
        <div
          className={`absolute top-full z-50 mt-1 ${
            position === "right" ? "right-0" : "left-0"
          }`}
        >
                     <div className="w-80 rounded-lg border bg-white p-3 shadow-lg">
             <div className="space-y-3">
                               {/* Year Selector */}
                <div>
                  <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(Number(e.target.value))}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-[#0d1c3d] focus:ring-1 focus:ring-[#0d1c3d]"
                  >
                    {years.map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>
                </div>

                               {/* Month Grid */}
                <div>
                  <div className="grid grid-cols-3 gap-1">
                    {months.map((month) => (
                      <button
                        key={month.value}
                        onClick={() => setSelectedMonth(month.value)}
                        className={`px-2 py-1.5 text-xs rounded border transition-colors ${
                          selectedMonth === month.value
                            ? 'bg-[#0d1c3d] text-white border-[#0d1c3d]'
                            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50 hover:border-[#0d1c3d]'
                        }`}
                      >
                        {month.label}
                      </button>
                    ))}
                  </div>
                </div>
             </div>

            {/* Buttons */}
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={handleCancel}
                className="rounded-md border px-4 py-2 text-sm"
              >
                {translations.cancel}
              </button>
              <button
                onClick={handleApply}
                className="rounded-md bg-indigo-600 px-5 py-2 text-sm font-medium text-white"
              >
                {translations.apply}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default YearMonthPicker;
