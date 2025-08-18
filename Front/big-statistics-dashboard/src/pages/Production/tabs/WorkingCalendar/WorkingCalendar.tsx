import React, { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import Calendar from './Calendar';
import WorkingSchedules from './WorkingSchedules';
import DayAssignmentModal from './DayAssignmentModal';
import { DayAssignment, WorkCenterProduction, CalendarApiResponse, CalendarDayData } from './types';
import { getAssignmentsForDate, saveAssignmentsForDate, getProductionDataForDate } from './mockData';
import { API_ENDPOINTS } from '../../../../config/api';
import { YearMonthPicker } from '../../../../components/DatePicker';

interface WorkCenter {
  id: string;
  nameZH: string;
  nameEN: string;
}

const WorkingCalendar: React.FC = () => {
  const { t, i18n } = useTranslation('production');
  const currentLanguage = i18n.language as 'en' | 'zh' | 'ru';

  // State for work centers from API
  const [workCenters, setWorkCenters] = useState<WorkCenter[]>([]);
  const [loading, setLoading] = useState(false);
  
  // State for calendar data from API
  const [calendarData, setCalendarData] = useState<CalendarDayData[]>([]);
  const [calendarLoading, setCalendarLoading] = useState(false);

  // State
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isWorkingSchedulesOpen, setIsWorkingSchedulesOpen] = useState(false);
  const [isAssignmentModalOpen, setIsAssignmentModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedDateAssignments, setSelectedDateAssignments] = useState<DayAssignment[]>([]);
  const [selectedDateProductionData, setSelectedDateProductionData] = useState<WorkCenterProduction[]>([]);

  // Function to fetch work centers from API
  const fetchWorkCenters = async () => {
    setLoading(true);
    try {
      const response = await fetch(API_ENDPOINTS.WORKING_CALENDAR.WORK_CENTERS);
      const data = await response.json();
      
      if (data.success) {
        setWorkCenters(data.data);
      } else {
        console.error('Failed to fetch work centers:', data.message);
      }
    } catch (error) {
      console.error('Error fetching work centers:', error);
    } finally {
      setLoading(false);
    }
  };

  // Function to fetch production data for a specific date
  const fetchProductionData = async (date: string) => {
    try {
      // Используем моковые данные из mockData.ts
      return getProductionDataForDate(date);
    } catch (error) {
      console.error('Error fetching production data:', error);
      return [];
    }
  };

  // Function to fetch calendar data from API
  const fetchCalendarData = async (year: number, month: number) => {
    setCalendarLoading(true);
    try {
      const response = await fetch(`${API_ENDPOINTS.WORKING_CALENDAR.CALENDAR_DATA}?year=${year}&month=${month}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data: CalendarApiResponse = await response.json();
      setCalendarData(data.data);
      console.log('Calendar data loaded:', data);
    } catch (error) {
      console.error('Error fetching calendar data:', error);
      setCalendarData([]);
    } finally {
      setCalendarLoading(false);
    }
  };

  // Handle Working Schedules button click
  const handleWorkingSchedulesClick = () => {
    // Fetch data only when button is clicked
    if (workCenters.length === 0) {
      fetchWorkCenters();
    }
    setIsWorkingSchedulesOpen(true);
  };



  // Navigation functions
  const goToPreviousMonth = () => {
    setCurrentDate(prev => {
      const newDate = new Date(prev.getFullYear(), prev.getMonth() - 1, 1);
      // Загружаем данные для предыдущего месяца
      fetchCalendarData(newDate.getFullYear(), newDate.getMonth() + 1);
      return newDate;
    });
  };

  const goToNextMonth = () => {
    setCurrentDate(prev => {
      const newDate = new Date(prev.getFullYear(), prev.getMonth() + 1, 1);
      // Загружаем данные для следующего месяца
      fetchCalendarData(newDate.getFullYear(), newDate.getMonth() + 1);
      return newDate;
    });
  };

  const goToToday = () => {
    const today = new Date();
    setCurrentDate(today);
    // Загружаем данные для текущего месяца
    fetchCalendarData(today.getFullYear(), today.getMonth() + 1);
  };

  // Handle year/month picker
  const handleYearMonthChange = (date: Date) => {
    console.log('Year/Month picker changed:', date);
    const newDate = new Date(date.getFullYear(), date.getMonth(), 1);
    setCurrentDate(newDate);
    
    // Загружаем данные для нового месяца
    fetchCalendarData(date.getFullYear(), date.getMonth() + 1);
  };

  // Format month/year for display
  const monthYearDisplay = useMemo(() => {
    const options: Intl.DateTimeFormatOptions = { 
      month: 'short', 
      year: 'numeric' 
    };
    
    if (currentLanguage === 'ru') {
      options.month = 'long';
    } else if (currentLanguage === 'zh') {
      return `${currentDate.getFullYear()}年${currentDate.getMonth() + 1}月`;
    }
    
    return currentDate.toLocaleDateString(currentLanguage, options);
  }, [currentDate, currentLanguage]);

  // Handle day click
  const handleDayClick = async (date: Date) => {
    // Исправляем проблему с часовыми поясами
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateString = `${year}-${month}-${day}`;
    
    // Получаем назначения для выбранной даты
    const assignments = getAssignmentsForDate(dateString);
    
    // Загружаем данные о выпуске для выбранной даты
    const productionData = await fetchProductionData(dateString);
    
    setSelectedDate(date);
    setSelectedDateAssignments(assignments);
    setSelectedDateProductionData(productionData);
    setIsAssignmentModalOpen(true);
  };

  // Handle save assignments
  const handleSaveAssignments = (assignments: DayAssignment[]) => {
    if (selectedDate) {
      const year = selectedDate.getFullYear();
      const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
      const day = String(selectedDate.getDate()).padStart(2, '0');
      const dateString = `${year}-${month}-${day}`;
      
      saveAssignmentsForDate(dateString, assignments);
      setSelectedDateAssignments(assignments);
      setIsAssignmentModalOpen(false);
    }
  };

  // Load calendar data when component mounts or currentDate changes
  useEffect(() => {
    fetchCalendarData(currentDate.getFullYear(), currentDate.getMonth() + 1);
  }, []); // Загружаем только при монтировании компонента



                                               return (
        <div className="p-1">
         <div className="container mx-auto">
          <div className="bg-white p-6">
         {/* Header */}
         <div className="flex items-center justify-between mb-4">
                     <div className="flex items-center space-x-4">
             {/* Year/Month Picker */}
             <div className="w-auto">
               <YearMonthPicker
                 startDate={currentDate}
                 onApply={handleYearMonthChange}
                 locale={currentLanguage}
                 placeholder={t('selectYearMonth')}
                 className="w-auto"
                 minDate={new Date(2025, 0, 1)}
                 maxDate={new Date(new Date().getFullYear() + 1, 11, 31)}
               />
             </div>
             
             <h2 className="text-2xl font-bold text-[#0d1c3d]">
               {monthYearDisplay}
             </h2>
             
             <div className="flex items-center space-x-2">
               <button
                 onClick={goToPreviousMonth}
                 className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
               >
                 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                 </svg>
               </button>
               <span className="text-gray-400">•</span>
               <button
                 onClick={goToNextMonth}
                 className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
               >
                 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                 </svg>
               </button>
             </div>
           </div>
          
                     <div className="flex items-center space-x-3">
             <button
               onClick={goToToday}
               className="px-3 py-1.5 bg-[#0d1c3d] text-white text-sm rounded-lg hover:bg-[#0a1529] transition-colors"
             >
               {t('today')}
             </button>
             
             <button
               onClick={handleWorkingSchedulesClick}
               className="px-3 py-1.5 bg-[#0d1c3d] text-white text-sm rounded-lg hover:bg-[#0a1529] transition-colors"
               disabled={loading}
             >
               {loading ? 'Loading...' : t('workingSchedules')}
             </button>
           </div>
        </div>

        

                                       {/* Calendar Grid */}
           <Calendar 
             currentDate={currentDate}
             onDayClick={handleDayClick}
             calendarData={calendarData}
             loading={calendarLoading}
           />
        </div>
      </div>
      
      {/* Working Schedules Modal */}
      <WorkingSchedules 
        isOpen={isWorkingSchedulesOpen}
        onClose={() => setIsWorkingSchedulesOpen(false)}
        workCenters={workCenters}
      />

      {/* Day Assignment Modal */}
      <DayAssignmentModal
        isOpen={isAssignmentModalOpen}
        onClose={() => setIsAssignmentModalOpen(false)}
        selectedDate={selectedDate}
        assignments={selectedDateAssignments}
        onSave={handleSaveAssignments}
        productionData={selectedDateProductionData}
      />
    </div>
  );
};

export default WorkingCalendar;
