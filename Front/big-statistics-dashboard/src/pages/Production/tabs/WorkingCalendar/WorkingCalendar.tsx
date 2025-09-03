import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Factory } from 'lucide-react';
import Calendar from './Calendar';
import WorkingSchedules from './WorkingSchedules';
import DayAssignmentModal from './DayAssignmentModal';
import { DayAssignment, WorkCenterProduction, CalendarApiResponse, CalendarDayData } from './types';
import { API_ENDPOINTS } from '../../../../config/api';
import { YearMonthPicker } from '../../../../components/DatePicker';
import { useCalendarQuery } from './apiHooks';

interface WorkCenter {
  id: string;
  nameZH: string;
  nameEN: string;
}

interface WorkshopOption { id: string; name: string; }

const mergeCalendarData = (lists: CalendarDayData[][]): CalendarDayData[] => {
  const map = new Map<string, CalendarDayData>();
  for (const list of lists) {
    for (const row of list) {
      const key = row.OnlyDate;
      const prev = map.get(key);
      if (!prev) {
        // Нормализуем первое попадание в день до чисел
        map.set(key, {
          ...row,
          Prod_Time: Number((row as any).Prod_Time) || 0,
          Shift_Time: Number((row as any).Shift_Time) || 0,
          Time_Loss: Number((row as any).Time_Loss) || 0,
          People: Number((row as any).People) || 0,
        });
      } else {
        map.set(key, {
          OnlyDate: key,
          Prod_Time: Number(prev.Prod_Time ?? 0) + Number((row as any).Prod_Time ?? 0),
          Shift_Time: Number(prev.Shift_Time ?? 0) + Number((row as any).Shift_Time ?? 0),
          Time_Loss: Number(prev.Time_Loss ?? 0) + Number((row as any).Time_Loss ?? 0),
          People: Number(prev.People ?? 0) + Number((row as any).People ?? 0),
        });
      }
    }
  }
  // Вернем отсортированный массив по дате (ДД.ММ.ГГГГ)
  return Array.from(map.values()).sort((a, b) => {
    const [ad, am, ay] = a.OnlyDate.split('.').map(Number);
    const [bd, bm, by] = b.OnlyDate.split('.').map(Number);
    return new Date(ay, am - 1, ad).getTime() - new Date(by, bm - 1, bd).getTime();
  });
};

const WorkingCalendar: React.FC = () => {
  const { t, i18n } = useTranslation('production');
  const currentLanguage = i18n.language as 'en' | 'zh' | 'ru';

  // State for work centers from API
  const [workCenters, setWorkCenters] = useState<WorkCenter[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Workshops list and selection
  const [workshops, setWorkshops] = useState<WorkshopOption[]>([]);
  const [selectedWorkShopIds, setSelectedWorkShopIds] = useState<string[]>([]);
  const [isWorkshopPickerOpen, setIsWorkshopPickerOpen] = useState(false);
  const [draftWorkshopIds, setDraftWorkshopIds] = useState<string[]>([]);
  const pickerRef = useRef<HTMLDivElement | null>(null);
  const selectAllRef = useRef<HTMLInputElement | null>(null);
  
  // State
  const [currentDate, setCurrentDate] = useState(new Date());

  // State for calendar data (React Query)
  const { data: rqCalendarData = [], isLoading: isCalendarLoading, isFetching: isCalendarFetching } = useCalendarQuery(
    currentDate.getFullYear(),
    currentDate.getMonth() + 1,
    selectedWorkShopIds
  );
  const calendarData: CalendarDayData[] = rqCalendarData as any;
  // Показ индикатора загрузки только при первой загрузке, а не при рефетчах
  const calendarLoading = isCalendarLoading && (!calendarData || calendarData.length === 0);
  const [isWorkingSchedulesOpen, setIsWorkingSchedulesOpen] = useState(false);
  const [isAssignmentModalOpen, setIsAssignmentModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedDateAssignments, setSelectedDateAssignments] = useState<DayAssignment[]>([]);
  const [selectedDateProductionData, setSelectedDateProductionData] = useState<WorkCenterProduction[]>([]);

  // Click outside to close picker
  useEffect(() => {
    if (!isWorkshopPickerOpen) return;
    const onClick = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setIsWorkshopPickerOpen(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [isWorkshopPickerOpen]);

  // Fetch workshops (IDs and names) once
  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(API_ENDPOINTS.WORKING_CALENDAR.CALENDAR_WORKSHOPS);
        const json = await res.json();
        const items: WorkshopOption[] = (json?.data || []).map((w: any) => ({
          id: String(w.workShopId || w.WorkShop_CustomWS || w.WorkShopId),
          name: currentLanguage === 'zh' ? (w.WorkShopName_ZH || w.WorkShopName_EN || w.workShopId) : (currentLanguage === 'en' ? (w.WorkShopName_EN || w.WorkShopName_ZH || w.workShopId) : (w.WorkShopName_EN || w.WorkShopName_ZH || w.workShopId))
        }));
        setWorkshops(items);
        // По умолчанию выбираем все цеха
        if (items.length && selectedWorkShopIds.length === 0) {
          setSelectedWorkShopIds(items.map(i => String(i.id)));
        }
      } catch (e) {
        console.warn('Failed to load workshops', e);
      }
    };
    load();
  }, [currentLanguage]);

  // Function to fetch work centers from API (unchanged)
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
      // TODO: Replace with real API call
      console.log('Fetching production data for date:', date);
      return [];
    } catch (error) {
      console.error('Error fetching production data:', error);
      return [];
    }
  };

  // Fetch calendar with optional workshop filter; supports multiple workshops by merging
  const fetchCalendarData = async (year: number, month: number) => {
    // React Query сам дергает; функция оставлена для совместимости навигации
  };

  const handleWorkingSchedulesClick = () => {
    if (workCenters.length === 0) {
      fetchWorkCenters();
    }
    setIsWorkingSchedulesOpen(true);
  };

  const goToPreviousMonth = () => {
    setCurrentDate(prev => {
      const newDate = new Date(prev.getFullYear(), prev.getMonth() - 1, 1);
      fetchCalendarData(newDate.getFullYear(), newDate.getMonth() + 1);
      return newDate;
    });
  };

  const goToNextMonth = () => {
    setCurrentDate(prev => {
      const newDate = new Date(prev.getFullYear(), prev.getMonth() + 1, 1);
      fetchCalendarData(newDate.getFullYear(), newDate.getMonth() + 1);
      return newDate;
    });
  };

  const goToToday = () => {
    const today = new Date();
    setCurrentDate(today);
    fetchCalendarData(today.getFullYear(), today.getMonth() + 1);
  };

  const handleYearMonthChange = (date: Date) => {
    const newDate = new Date(date.getFullYear(), date.getMonth(), 1);
    setCurrentDate(newDate);
    fetchCalendarData(date.getFullYear(), date.getMonth() + 1);
  };

  // React Query сам перезапрашивает данные при изменении selectedWorkShopIds

  const monthYearDisplay = useMemo(() => {
    const options: Intl.DateTimeFormatOptions = { month: 'short', year: 'numeric' };
    if (currentLanguage === 'ru') {
      options.month = 'long';
    } else if (currentLanguage === 'zh') {
      return `${currentDate.getFullYear()}年${currentDate.getMonth() + 1}月`;
    }
    return currentDate.toLocaleDateString(currentLanguage, options);
  }, [currentDate, currentLanguage]);

  const handleDayClick = async (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateString = `${year}-${month}-${day}`;
    // TODO: Replace with real API call for assignments
    const assignments: DayAssignment[] = [];
    const productionData = await fetchProductionData(dateString);
    setSelectedDate(date);
    setSelectedDateAssignments(assignments);
    setSelectedDateProductionData(productionData);
    setIsAssignmentModalOpen(true);
  };

  // Обработчик сохранения назначений из модалки (не закрывает модалку)
  const handleSaveAssignments = (assignments: DayAssignment[]) => {
    if (!selectedDate) return;
    const year = selectedDate.getFullYear();
    const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
    const day = String(selectedDate.getDate()).padStart(2, '0');
    const dateString = `${year}-${month}-${day}`;
    // TODO: Replace with real API call to save assignments
    console.log('Saving assignments for date:', dateString, assignments);
    setSelectedDateAssignments(assignments);
    fetchCalendarData(currentDate.getFullYear(), currentDate.getMonth() + 1);
  };

  // Инвалидации React Query обновят календарь автоматически, от шины событий отказались

  // Первичная загрузка происходит через React Query

  // UI helpers
  const selectedCount = selectedWorkShopIds.length;
  let workshopsButtonLabel = t('chooseWorkshop') as string || 'Выбрать цех';
  if (selectedCount === 1) {
    const w = workshops.find(x => x.id === selectedWorkShopIds[0]);
    workshopsButtonLabel = w?.name || (t('chooseWorkshop') as string) || 'Выбрать цех';
  } else if (selectedCount > 1) {
    workshopsButtonLabel = (t('multiSelect') as string) || 'Мультиселект';
  }
  const allSelected = workshops.length > 0 && draftWorkshopIds.length === workshops.length;
  const someSelected = draftWorkshopIds.length > 0 && draftWorkshopIds.length < workshops.length;
  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someSelected;
    }
  }, [someSelected, isWorkshopPickerOpen, workshops, draftWorkshopIds]);

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
                <button onClick={goToPreviousMonth} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                </button>
                <span className="text-gray-400">•</span>
                <button onClick={goToNextMonth} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                </button>

                                 {/* Workshops picker trigger */}
                 <div className="flex items-center space-x-2">
                   <Factory className="w-5 h-5 text-gray-600" />
                   <div className="relative" ref={pickerRef}>
                     <button
                       type="button"
                       onClick={() => { setDraftWorkshopIds(selectedWorkShopIds); setIsWorkshopPickerOpen(v => !v); }}
                       className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
                       title={t('workshops') || 'Workshops'}
                     >
                       {workshopsButtonLabel}
                     </button>

                  {isWorkshopPickerOpen && (
                    <div className="absolute right-0 mt-2 w-72 bg-white border border-gray-200 rounded-lg shadow-2xl z-50">
                      <div className="p-3 max-h-64 overflow-auto space-y-2">
                        {/* Select all */}
                        <label className="flex items-center space-x-2 text-sm font-medium pb-2 border-b border-gray-100">
                          <input
                            ref={selectAllRef}
                            type="checkbox"
                            checked={allSelected}
                            onChange={() => {
                              if (allSelected) {
                                setDraftWorkshopIds([]);
                              } else {
                                setDraftWorkshopIds(workshops.map(w => w.id));
                              }
                            }}
                          />
                          <span>{t('selectAll') || 'Select All'}</span>
                        </label>
                        {/* Items */}
                        {workshops.map(w => (
                          <label key={w.id} className="flex items-center space-x-2 text-sm">
                            <input
                              type="checkbox"
                              checked={draftWorkshopIds.includes(w.id)}
                              onChange={(e) => {
                                const checked = e.target.checked;
                                setDraftWorkshopIds(prev => checked ? [...prev, w.id] : prev.filter(id => id !== w.id));
                              }}
                            />
                            <span>{w.name}</span>
                          </label>
                        ))}
                        {workshops.length === 0 && (
                          <div className="text-xs text-gray-500">{t('loading') || 'Loading...'}</div>
                        )}
                      </div>
                      <div className="px-3 py-2 border-t border-gray-200 flex justify-end space-x-2 bg-gray-50 rounded-b-lg">
                        <button className="px-3 py-1 text-sm rounded bg-gray-100 hover:bg-gray-200" onClick={() => setIsWorkshopPickerOpen(false)}>
                          {t('cancel')}
                        </button>
                        <button
                          className="px-3 py-1 text-sm rounded bg-blue-600 text-white hover:bg-blue-700"
                          onClick={() => { setSelectedWorkShopIds(draftWorkshopIds); setIsWorkshopPickerOpen(false); }}
                        >
                          OK
                        </button>
                      </div>
                    </div>
                  )}
                   </div>
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <button onClick={goToToday} className="px-3 py-1.5 bg-[#0d1c3d] text-white text-sm rounded-lg hover:bg-[#0a1529] transition-colors">
                {t('today')}
              </button>
              <button onClick={handleWorkingSchedulesClick} className="px-3 py-1.5 bg-[#0d1c3d] text-white text-sm rounded-lg hover:bg-[#0a1529] transition-colors" disabled={loading}>
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
        selectedWorkShopIds={selectedWorkShopIds}
        allWorkshops={workshops}
        onChangeSelectedWorkShopIds={(ids) => setSelectedWorkShopIds(ids)}
      />
    </div>
  );
};

export default WorkingCalendar;
