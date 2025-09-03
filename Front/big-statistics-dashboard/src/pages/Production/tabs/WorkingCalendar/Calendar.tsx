import React, { useMemo, memo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import DayCell from './DayCell';
import { CalendarDayData } from './types';

interface CalendarDay {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  dayNumber: number;
}

interface CalendarProps {
  currentDate: Date;
  onDayClick: (date: Date) => void;
  calendarData: CalendarDayData[];
  loading: boolean;
}

const Calendar: React.FC<CalendarProps> = ({ currentDate, onDayClick, calendarData, loading }) => {
  const { i18n } = useTranslation('production');
  const currentLanguage = i18n.language as 'en' | 'zh' | 'ru';

  // Day names based on locale
  const dayNames = useMemo(() => {
    const days = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
    if (currentLanguage === 'ru') {
      return ['ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ', 'ВС'];
    } else if (currentLanguage === 'zh') {
      return ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
    }
    return days;
  }, [currentLanguage]);

  // Generate calendar grid
  const calendarDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    // First day of the month
    const firstDay = new Date(year, month, 1);
    // Last day of the month
    const lastDay = new Date(year, month + 1, 0);
    
    // Start from Monday of the week containing the first day
    const startDate = new Date(firstDay);
    const dayOfWeek = firstDay.getDay();
    const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Sunday = 0, but we want Monday = 0
    startDate.setDate(firstDay.getDate() - mondayOffset);
    
    // End with Sunday of the week containing the last day
    const endDate = new Date(lastDay);
    const lastDayOfWeek = lastDay.getDay();
    const sundayOffset = lastDayOfWeek === 0 ? 0 : 7 - lastDayOfWeek;
    endDate.setDate(lastDay.getDate() + sundayOffset);
    
    // Ensure we have exactly 6 weeks (42 days)
    const totalDays = 42;
    const days: CalendarDay[] = [];
    
    for (let i = 0; i < totalDays; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      
      const isCurrentMonth = date.getMonth() === month;
      const isToday = date.toDateString() === new Date().toDateString();
      
      days.push({
        date,
        isCurrentMonth,
        isToday,
        dayNumber: date.getDate(),
      });
    }
    
    return days;
  }, [currentDate]);

  const handleDayClick = useCallback((date: Date) => onDayClick(date), [onDayClick]);

  return (
    <div className="grid grid-cols-7 gap-x-10 gap-y-2">
      {/* Day headers */}
      {dayNames.map((day, index) => {
        const today = new Date();
        const isCurrentDayOfWeek = today.getDay() === (index + 1) % 7; // Convert to Sunday=0 format
        
        return (
          <div 
            key={day} 
            className={`p-2 text-left text-sm font-medium ${
              isCurrentDayOfWeek ? 'text-orange-600' : 'text-gray-600'
            }`}
          >
            {day}
          </div>
        );
      })}
      
      {/* Calendar days */}
      {calendarDays.map((day, index) => (
        <DayCell
          key={index}
          date={day.date}
          isCurrentMonth={day.isCurrentMonth}
          isToday={day.isToday}
          onClick={() => handleDayClick(day.date)}
          calendarData={calendarData}
          loading={loading}
        />
      ))}
    </div>
  );
};

export default memo(Calendar);
