import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import AddWorkingSchedule from './AddWorkingSchedule';
import { API_ENDPOINTS } from '../../../../config/api';

interface WorkCenter {
  id: string;
  nameZH: string;
  nameEN: string;
}

interface WorkingSchedulesProps {
  isOpen: boolean;
  onClose: () => void;
  workCenters: WorkCenter[];
}

const WorkingSchedules: React.FC<WorkingSchedulesProps> = ({ isOpen, onClose, workCenters }) => {
  const { t, i18n } = useTranslation('production');
  const currentLanguage = i18n.language as 'en' | 'zh' | 'ru';
  
  // State for selected work center
  const [selectedWorkCenter, setSelectedWorkCenter] = useState<WorkCenter | null>(null);
  
  // State for managing banner views
  const [showAddSchedule, setShowAddSchedule] = useState(false);
  
  // ✅ НОВОЕ СОСТОЯНИЕ: Для редактирования графика
  const [selectedScheduleForEdit, setSelectedScheduleForEdit] = useState<any>(null);
  
  // ✅ НОВОЕ СОСТОЯНИЕ: Отслеживание избранных смен
  const [favoriteSchedules, setFavoriteSchedules] = useState<Set<string>>(new Set());

  // ✅ НОВЫЕ СОСТОЯНИЯ ДЛЯ ГРАФИКОВ
  const [schedules, setSchedules] = useState<any[]>([]);
  const [loadingSchedules, setLoadingSchedules] = useState(false);
  const [scheduleError, setScheduleError] = useState<string>('');

  // ✅ ЦВЕТА ДЛЯ КАРТОЧЕК (по ТЗ)
  const cardColors = [
    'bg-blue-50 border-blue-200 text-blue-600',      // карточка 1: #2563EB
    'bg-green-50 border-green-200 text-green-600',   // карточка 2: #16A34A
    'bg-violet-50 border-violet-200 text-violet-600', // карточка 3: #9333EA
    'bg-orange-50 border-orange-200 text-orange-600'  // карточка 4: #EA580C
  ];

  // ✅ НОВАЯ ФУНКЦИЯ: Переключение статуса избранного
  const toggleFavorite = (scheduleId: string) => {
    const schedule = schedules.find(s => s.scheduleId === scheduleId);
    if (schedule) {
      handleToggleFavorite(schedule);
    }
  };

  // ✅ НОВАЯ ФУНКЦИЯ: Загрузка графиков
  const loadSchedules = async (workshopId: string) => {
    setLoadingSchedules(true);
    setScheduleError('');
    
    try {
      console.log('🔍 Loading schedules for workshopId:', workshopId);
      
      // ✅ ВРЕМЕННО: Загружаем все графики
      const response = await fetch(`${API_ENDPOINTS.WORKING_CALENDAR.WORK_SCHEDULES}?includeDeleted=false`);
      const data = await response.json();
      
      console.log('🔍 API response:', data);
      
      if (data.success) {
        // ✅ Фильтруем на фронтенде
        const filteredSchedules = data.data.filter((schedule: any) => 
          schedule.workshopId === workshopId || 
          schedule.workshopId === workCenters.find(wc => wc.id === workshopId)?.nameZH ||
          schedule.workshopId === workCenters.find(wc => wc.id === workshopId)?.nameEN
        );
        
        setSchedules(filteredSchedules);
        console.log('🔍 Filtered schedules:', filteredSchedules);
      } else {
        setScheduleError(data.message || 'Failed to load schedules');
      }
    } catch (error) {
      console.error('Error loading schedules:', error);
      setScheduleError('Network error while loading schedules');
    } finally {
      setLoadingSchedules(false);
    }
  };

  // ✅ ФУНКЦИЯ: Получение времени WORKSHIFT с поддержкой ночных смен
  const getWorkshiftTime = (schedule: any) => {
    if (schedule.lines && schedule.lines.length > 0) {
      const workshiftLine = schedule.lines.find((line: any) => line.typeId === 'WORKSHIFT');
      if (workshiftLine) {
        // ✅ Используем новые поля для корректного отображения ночных смен
        const startTime = workshiftLine.start;
        const endTime = workshiftLine.end;
        const crossesMidnight = workshiftLine.crossesMidnight;
        const spanMinutes = workshiftLine.spanMinutes;
        
        // ✅ Если смена переходит через полночь, добавляем индикатор
        if (crossesMidnight) {
          return `${startTime} - ${endTime} (${t('nightShift')})`;
        }
        
        return `${startTime} - ${endTime}`;
      }
    }
    return '08:00 - 16:00'; // ✅ Fallback время
  };

  // ✅ ФУНКЦИЯ: Получение цвета карточки
  const getCardColor = (index: number) => {
    return cardColors[index % cardColors.length];
  };

  // ✅ ОБНОВИТЬ: Выбор цеха
  const handleWorkCenterSelect = (workCenter: WorkCenter) => {
    setSelectedWorkCenter(workCenter);
    loadSchedules(workCenter.id); // ✅ Загружаем графики при выборе цеха
  };

  // ✅ НОВЫЕ ФУНКЦИИ: Редактирование и удаление
  const handleEditSchedule = (schedule: any) => {
    setSelectedScheduleForEdit(schedule);
    setShowAddSchedule(true);
  };

  const handleDeleteSchedule = async (schedule: any) => {
    if (window.confirm(`Are you sure you want to delete schedule "${schedule.name}"?`)) {
      try {
        const response = await fetch(`${API_ENDPOINTS.WORKING_CALENDAR.WORK_SCHEDULES}/${schedule.scheduleId}`, {
          method: 'DELETE'
        });
        
        if (response.ok) {
          // ✅ Обновляем список после удаления
          if (selectedWorkCenter) {
            loadSchedules(selectedWorkCenter.id);
          }
          // TODO: Показать уведомление об успехе
        } else {
          const errorData = await response.json();
          console.error('Delete failed:', errorData);
          // TODO: Показать уведомление об ошибке
        }
      } catch (error) {
        console.error('Error deleting schedule:', error);
        // TODO: Показать уведомление об ошибке
      }
    }
  };

  const handleToggleFavorite = async (schedule: any) => {
    try {
      const updatedSchedule = {
        ...schedule,
        isFavorite: !schedule.isFavorite,
        updatedAt: schedule.updatedAt
      };
      
      const response = await fetch(`${API_ENDPOINTS.WORKING_CALENDAR.WORK_SCHEDULES}/${schedule.scheduleId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updatedSchedule)
      });
      
      if (response.ok) {
        // ✅ Обновляем список после изменения
        if (selectedWorkCenter) {
          loadSchedules(selectedWorkCenter.id);
        }
      } else {
        const errorData = await response.json();
        console.error('Update failed:', errorData);
      }
    } catch (error) {
      console.error('Error updating schedule:', error);
    }
  };

  // Reset states when modal is closed
  const handleClose = () => {
    setShowAddSchedule(false);
    setSelectedWorkCenter(null);
    onClose();
  };

  if (!isOpen) return null;

  // Show AddWorkingSchedule component if showAddSchedule is true
  if (showAddSchedule) {
    return (
      <AddWorkingSchedule
        isOpen={showAddSchedule}
        onClose={() => {
          setShowAddSchedule(false);
          setSelectedScheduleForEdit(null);
        }}
        onBack={() => setShowAddSchedule(false)}
        selectedWorkCenter={selectedWorkCenter}
        workCenters={workCenters}
        editMode={!!selectedScheduleForEdit}
        scheduleToEdit={selectedScheduleForEdit}
        onScheduleUpdated={() => {
          if (selectedWorkCenter) {
            loadSchedules(selectedWorkCenter.id);
          }
          setShowAddSchedule(false);
          setSelectedScheduleForEdit(null);
        }}
      />
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[80vh] overflow-hidden">
                 {/* Header */}
         <div className="flex items-center justify-between p-6 border-b border-gray-200">
           <h2 className="text-2xl font-bold text-[#0d1c3d]">
             {t('workingSchedules')}
           </h2>
                       <button
              onClick={handleClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
             <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
             </svg>
           </button>
         </div>

                          {/* Content */}
         <div className="flex h-full">
           {/* Left side - Work Centers List */}
           <div className="w-1/2 p-6 border-r border-gray-200">
                                          <h3 className="text-lg font-semibold text-gray-800 mb-4">
                 {t('workShop')}
               </h3>
             <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                               {workCenters.map((workCenter) => (
                  <div 
                    key={workCenter.id} 
                    className={`p-3 rounded-lg border transition-colors cursor-pointer ${
                      selectedWorkCenter?.id === workCenter.id
                        ? 'bg-blue-100 border-blue-300 text-blue-800'
                        : 'bg-gray-50 border-gray-200 hover:bg-gray-100 text-gray-800'
                    }`}
                    onClick={() => handleWorkCenterSelect(workCenter)}
                  >
                    <div className="font-medium">
                      {currentLanguage === 'zh' ? workCenter.nameZH : currentLanguage === 'en' ? workCenter.nameEN : workCenter.nameZH}
                    </div>
                  </div>
                ))}
               
                               {workCenters.length === 0 && (
                  <div className="text-center py-8">
                    <p className="text-gray-500">
                      {t('noWorkCentersAvailable')}
                    </p>
                  </div>
                )}
             </div>
           </div>
           
                                   {/* ✅ ОБНОВИТЬ: Правая панель с графиками */}
            <div className="w-1/2 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-800">
                  {t('workingHours')}
                  {selectedWorkCenter && (
                    <span className="text-sm font-normal text-gray-600 ml-2">
                      - {currentLanguage === 'zh' ? selectedWorkCenter.nameZH : currentLanguage === 'en' ? selectedWorkCenter.nameEN : selectedWorkCenter.nameZH}
                    </span>
                  )}
                </h3>
                {selectedWorkCenter && (
                  <button
                    onClick={() => {
                      setShowAddSchedule(true);
                      setSelectedScheduleForEdit(null); // Сбросить режим редактирования
                    }}
                    className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition-colors"
                  >
                    {t('add')}
                  </button>
                )}
              </div>
              
              {selectedWorkCenter ? (
                <div className="space-y-4">
                  {/* ✅ ИНДИКАТОР ЗАГРУЗКИ */}
                  {loadingSchedules && (
                    <div className="flex items-center justify-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                      <span className="ml-2 text-gray-600">Loading schedules...</span>
                    </div>
                  )}
                  
                  {/* ✅ СООБЩЕНИЕ ОБ ОШИБКЕ */}
                  {scheduleError && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                      <div className="flex items-center">
                        <svg className="w-5 h-5 text-red-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="text-red-800 text-sm">{scheduleError}</span>
                      </div>
                    </div>
                  )}
                  
                  {/* ✅ КАРТОЧКИ ПО ТЗ */}
                  {!loadingSchedules && !scheduleError && schedules.length > 0 && (
                    <div className="space-y-6"> {/* ✅ Межкарточный интервал ~24-26px */}
                      {schedules.map((schedule, index) => (
                        <div
                          key={schedule.scheduleId}
                          className={`w-full h-[76px] px-4 py-3 rounded-2xl border cursor-pointer transition-all duration-200 hover:border-opacity-80 hover:bg-opacity-95 ${
                            getCardColor(index)
                          }`}
                          onClick={() => handleEditSchedule(schedule)}
                        >
                          {/* Сетка 2 колонки */}
                          <div className="flex justify-between items-center h-full">
                            {/* Левая колонка */}
                            <div className="flex flex-col justify-center">
                              {/* Заголовок */}
                              <h3 className="text-sm font-semibold mb-2">
                                {schedule.scheduleName}
                              </h3>
                              {/* Иконки под заголовком */}
                              <div className="flex space-x-2">
                                {/* Звездочка для избранного */}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleToggleFavorite(schedule);
                                  }}
                                  className={`p-1 transition-colors ${
                                    schedule.isFavorite
                                      ? 'text-yellow-500'
                                      : 'text-slate-400 hover:text-slate-600'
                                  }`}
                                >
                                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                  </svg>
                                </button>
                                
                                {/* Кнопка редактирования */}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleEditSchedule(schedule);
                                  }}
                                  className="p-1 text-slate-400 hover:text-slate-600 transition-colors"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                  </svg>
                                </button>
                                
                                {/* Кнопка удаления */}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteSchedule(schedule);
                                  }}
                                  className="p-1 text-slate-400 hover:text-red-500 transition-colors"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              </div>
                            </div>
                            
                                                          {/* Правая колонка - время */}
                            <div className="flex items-center">
                              <div className="text-sm font-medium">
                                {getWorkshiftTime(schedule)}
                              </div>
                              {/* ✅ НОВАЯ ИНФОРМАЦИЯ: Длительность смены */}
                              {schedule.lines && schedule.lines.length > 0 && (
                                <div className="ml-2 text-xs text-gray-500">
                                  {schedule.lines.find((line: any) => line.typeId === 'WORKSHIFT')?.spanMinutes 
                                    ? `${Math.round(schedule.lines.find((line: any) => line.typeId === 'WORKSHIFT')?.spanMinutes / 60 * 10) / 10}ч`
                                    : ''
                                  }
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {/* ✅ СООБЩЕНИЕ ОТСУТСТВИЯ ГРАФИКОВ */}
                  {!loadingSchedules && !scheduleError && schedules.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      {loadingSchedules ? (
                        <div className="flex items-center justify-center">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                          <span className="ml-2">Loading schedules...</span>
                        </div>
                      ) : (
                        <div>
                          <p className="text-lg mb-2">No schedules found</p>
                          <p className="text-sm">Create your first working schedule for this workshop</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-center h-[60vh] bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                  <div className="text-center text-gray-500">
                    <svg className="w-16 h-16 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-lg font-medium">
                      {t('pleaseSelectWorkshop')}
                    </p>
                    <p className="text-sm mt-2">
                      {t('selectWorkshopToViewHours')}
                    </p>
                  </div>
                </div>
              )}
            </div>
         </div>
       </div>
     </div>
   );
 };

export default WorkingSchedules;
