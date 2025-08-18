import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { DayAssignmentModalProps, DayAssignment } from './types';
import { generateId, calculateStatisticsFromApiData } from './mockData';
import { 
  fetchAssignWorkSchedulesData, 
  transformApiDataToWorkCenters, 
  getUniqueWorkshops,
  groupWorkCentersByWorkshop,
  AssignWorkSchedulesData,
  transformTable2ToWorkSchedules
} from './api';

import WorkshopGroup from './WorkshopGroup';
import DayStatisticsPanel from './DayStatisticsPanel';

const DayAssignmentModal: React.FC<DayAssignmentModalProps> = ({
  isOpen,
  onClose,
  selectedDate,
  assignments,
  onSave,
  productionData = []
}) => {
  const { t } = useTranslation('production');
  const [localAssignments, setLocalAssignments] = useState<DayAssignment[]>(assignments);
  const [hasChanges, setHasChanges] = useState(false);
  
  // Состояние для API данных
  const [apiData, setApiData] = useState<AssignWorkSchedulesData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Получаем текущий язык из i18n
  const { i18n } = useTranslation();
  const currentLanguage = i18n.language || 'en';

  // Локальное форматирование даты в YYYY-MM-DD без смещения часового пояса
  const toYmdLocal = (d: Date): string => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  // Функция загрузки данных из API
  const loadApiData = async (date: Date) => {
    if (!isOpen) return;
    
    console.log('🔍 Начинаем загрузку API данных для даты:', date);
    setLoading(true);
    setError(null);
    
    try {
      const dateString = toYmdLocal(date); // YYYY-MM-DD (local)
      console.log('🔍 Загружаем данные для даты:', dateString);
      
      const data = await fetchAssignWorkSchedulesData(dateString);
      console.log('🔍 Получены данные из API:', data);
      console.log('🔍 table1 содержит записей:', data?.table1?.length || 0);
      
      if (data?.table1) {
        console.log('🔍 Первые записи table1:', data.table1.slice(0, 3));
      }
      
      setApiData(data);
    } catch (err) {
      console.error('❌ Ошибка загрузки API данных:', err);
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  // Загружаем данные при открытии модального окна
  useEffect(() => {
    if (isOpen && selectedDate) {
      // Сбрасываем состояние при открытии
      setApiData(null);
      setLocalAssignments([]);
      setHasChanges(false);
      setError(null);
      
      loadApiData(selectedDate);
    }
  }, [isOpen, selectedDate]);

     // Создаем назначения только для РЦ с данными о выпуске
   useEffect(() => {
     console.log('🔍 useEffect сработал - apiData:', !!apiData, 'localAssignments.length:', localAssignments.length);
     
     if (!apiData || localAssignments.length > 0) {
       console.log('🔍 Выходим из useEffect - нет apiData или уже есть назначения');
       return;
     }
     
     console.log('🔍 Создаем назначения только для РЦ с данными о выпуске');
    console.log('🔍 apiData.table1:', apiData.table1);
    console.log('🔍 apiData.table1.length:', apiData.table1?.length || 0);
    
    const dateString = selectedDate!.toISOString().split('T')[0];
    const newAssignments: DayAssignment[] = [];
    
    if (!apiData.table1 || apiData.table1.length === 0) {
      console.log('❌ apiData.table1 пуста или не существует!');
      return;
    }
    
    apiData.table1.forEach((item, index) => {
      console.log(`🔍 Обрабатываем запись ${index}:`, item);
      
      const planQty = Number(item.Plan_QTY) || 0;
      const factQty = Number(item.FACT_QTY) || 0;
      const planTime = Number(item.Plan_TIME) || 0;
      const factTime = Number(item.FACT_TIME) || 0;
      const shiftTime = Number(item.Shift_Time) || 0;
      const timeLoss = Number(item.Time_Loss) || 0;
      const people = Number(item.People) || 0;
      
      console.log(`🔍 РЦ ${item.WorkCenter_CustomWS}:`, {
        planQty, factQty, planTime, factTime, shiftTime, timeLoss, people
      });
      
             // Проверяем, есть ли данные о выпуске
       const hasProductionData = planQty > 0 || factQty > 0 || planTime > 0 || factTime > 0;
       console.log(`🔍 РЦ ${item.WorkCenter_CustomWS} имеет данные о выпуске:`, hasProductionData);
       
       // Создаем назначение ТОЛЬКО для РЦ с данными о выпуске
       if (hasProductionData) {
         const assignment: DayAssignment = {
           id: generateId(),
           date: dateString,
           workCenterId: `${item.WorkShop_CustomWS}_${item.WorkCenter_CustomWS}`, // Используем уникальный ID как в workCenters
           scheduleId: '', // Пустой, пользователь выберет
           peopleCount: people,
           notes: '',
           production: {
             planQty: planQty,
             factQty: factQty,
             completionPercentageQty: planQty > 0 ? ((factQty / planQty) * 100) : 0,
             planHours: planTime,
             factHours: factTime,
             completionPercentageHours: planTime > 0 ? ((factTime / planTime) * 100) : 0
           },
           shiftTime: shiftTime,
           timeLoss: timeLoss,
           different: 0
         };
         newAssignments.push(assignment);
         console.log(`🔍 Создано назначение для ${item.WorkCenter_CustomWS}:`, assignment);
       } else {
         console.log(`🔍 Пропускаем РЦ ${item.WorkCenter_CustomWS} - нет данных о выпуске`);
       }
    });
    
    console.log('🔍 Всего создано назначений:', newAssignments.length);
    
    if (newAssignments.length > 0) {
      console.log('🔍 Устанавливаем назначения в состояние:', newAssignments);
      setLocalAssignments(newAssignments);
    } else {
      console.log('❌ Не создано ни одного назначения!');
    }
  }, [apiData, selectedDate]);



  // Функция для форматирования чисел с российским разделителем
  const formatNumber = (value: number): string => {
    return Math.round(value).toLocaleString('ru-RU');
  };



  // Форматирование даты для отображения
  const formatDate = (date: Date) => {
    return date.toLocaleDateString('ru-RU', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  // Получение рабочих центров из API данных
  const workCenters = useMemo(() => {
    if (!apiData) return [];
    return transformApiDataToWorkCenters(apiData, currentLanguage as 'en' | 'zh');
  }, [apiData, currentLanguage]);

  // Группировка назначений по цехам
  const workshopGroups = useMemo(() => {
    console.log('🔍 Группируем назначения - localAssignments:', localAssignments);
    console.log('🔍 Группируем назначения - workCenters:', workCenters);
    
    const groups: Record<string, DayAssignment[]> = {};
    
         localAssignments.forEach(assignment => {
       const workCenter = workCenters.find(wc => wc.id === assignment.workCenterId);
       console.log(`🔍 Назначение ${assignment.workCenterId} -> workCenter:`, workCenter);
       console.log(`🔍 Доступные workCenter IDs:`, workCenters.map(wc => wc.id));
      
      if (workCenter) {
        if (!groups[workCenter.workshop]) {
          groups[workCenter.workshop] = [];
        }
        groups[workCenter.workshop].push(assignment);
      } else if (!assignment.workCenterId) {
        // Если у назначения нет workCenterId, добавляем его в группу "Неопределенные"
        if (!groups['undefined']) {
          groups['undefined'] = [];
        }
        groups['undefined'].push(assignment);
      }
    });
    
    console.log('🔍 Результат группировки:', groups);
    return groups;
  }, [localAssignments, workCenters]);

  // Получение уникальных цехов
  const uniqueWorkshops = useMemo(() => {
    if (!apiData) return [];
    const workshops = getUniqueWorkshops(apiData, currentLanguage as 'en' | 'zh');
    // Добавляем "undefined" группу, если есть назначения без workCenterId
    if (localAssignments.some(a => !a.workCenterId)) {
      workshops.push('undefined');
    }
    return workshops;
  }, [apiData, currentLanguage, localAssignments]);



  // Добавление нового назначения в конкретный цех
  const handleAddAssignment = (workshop: string) => {
    // Находим первый доступный РЦ для этого цеха
    const availableWorkCenter = workCenters.find(wc => wc.workshop === workshop);
    
    if (!availableWorkCenter) {
      console.error(`No work centers found for workshop: ${workshop}`);
      return;
    }

    const newAssignment: DayAssignment = {
      id: generateId(),
      date: selectedDate ? toYmdLocal(selectedDate) : '',
      workCenterId: availableWorkCenter.id, // Используем уникальный ID
      scheduleId: '',
      peopleCount: 0,
      notes: ''
    };
    
    setLocalAssignments([...localAssignments, newAssignment]);
    setHasChanges(true);
  };

  // Обновление назначения
  const handleUpdateAssignment = (updatedAssignment: DayAssignment) => {
    const updated = localAssignments.map(assignment => 
      assignment.id === updatedAssignment.id ? updatedAssignment : assignment
    );
    setLocalAssignments(updated);
    setHasChanges(true);
  };

  // Удаление назначения
  const handleRemoveAssignment = (assignmentId: string) => {
    const filtered = localAssignments.filter(assignment => assignment.id !== assignmentId);
    setLocalAssignments(filtered);
    setHasChanges(true);
  };

  // Отмена изменений
  const handleCancel = () => {
    setLocalAssignments(assignments);
    setHasChanges(false);
    setApiData(null); // Сбрасываем API данные
    setLocalAssignments([]); // Очищаем локальные назначения
    onClose();
  };

  // Сохранение изменений
  const handleSave = async () => {
    try {
      // Валидация всех назначений
      const validAssignments = localAssignments.filter(assignment => {
        // Для назначений с данными о выпуске проверяем только scheduleId
        if (assignment.production && 
            (assignment.production.planQty > 0 || 
             assignment.production.factQty > 0 || 
             assignment.production.planHours > 0 || 
             assignment.production.factHours > 0)) {
          return assignment.scheduleId;
        }
        
        // Для обычных назначений проверяем workCenterId и scheduleId
        return assignment.workCenterId && assignment.scheduleId;
      });

      // Проверка на дублирование РЦ (только для редактируемых назначений)
      const editableAssignments = validAssignments.filter(assignment => {
        if (assignment.production && 
            (assignment.production.planQty > 0 || 
             assignment.production.factQty > 0 || 
             assignment.production.planHours > 0 || 
             assignment.production.factHours > 0)) {
          return false; // Исключаем из проверки дублирования
        }
        return true;
      });
      
      const workCenterIds = editableAssignments.map(a => a.workCenterId);
      const hasDuplicates = workCenterIds.length !== new Set(workCenterIds).size;

      if (hasDuplicates) {
        alert(t('assignmentValidation.duplicateAssignment'));
        return;
      }

             // Просто сохраняем локально (без БД)
       console.log('🔍 Сохраняем назначения локально:', validAssignments);
       onSave(validAssignments);
       setHasChanges(false);
       setApiData(null); // Сбрасываем API данные
       setLocalAssignments([]); // Очищаем локальные назначения
       alert(`Сохранено успешно! Обработано ${validAssignments.length} элементов.`);

    } catch (error) {
      console.error('Ошибка при сохранении назначений:', error);
      alert(`Ошибка при сохранении: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`);
    }
  };

  // Получение списка уже использованных РЦ
  const getExistingWorkCenterIds = (currentAssignmentId: string) => {
    return localAssignments
      .filter(a => {
        // Исключаем текущее назначение
        if (a.id === currentAssignmentId) return false;
        
        // Исключаем назначения без workCenterId
        if (!a.workCenterId) return false;
        
        // Исключаем назначения с данными о выпуске (которые нельзя редактировать)
        if (a.production && 
            (a.production.planQty > 0 || 
             a.production.factQty > 0 || 
             a.production.planHours > 0 || 
             a.production.factHours > 0)) {
          return false;
        }
        
        return true;
      })
      .map(a => a.workCenterId);
  };

  // Подсчет общего количества людей
  const totalPeople = localAssignments.reduce((sum, assignment) => sum + assignment.peopleCount, 0);

  // Получение статистики дня из API данных
  const dayStatistics = useMemo(() => {
    if (!apiData) return null;
    return calculateStatisticsFromApiData(apiData);
  }, [apiData]);

  // Создание workSchedules из table2
  const workSchedules = useMemo(() => {
    if (!apiData) return [];
    return transformTable2ToWorkSchedules(apiData);
  }, [apiData]);

  if (!isOpen || !selectedDate) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-[1400px] max-h-[90vh] overflow-hidden">
        {/* Заголовок */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              {t('assignWorkSchedules')}
            </h2>
            <p className="text-gray-600 mt-1">
              {formatDate(selectedDate)}
            </p>
          </div>
                     <button
             onClick={() => {
               setApiData(null); // Сбрасываем API данные
               setLocalAssignments([]); // Очищаем локальные назначения
               setHasChanges(false);
               onClose();
             }}
             className="text-gray-400 hover:text-gray-600 transition-colors"
           >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Панель статистики */}
        <DayStatisticsPanel
          statistics={dayStatistics}
          assignmentsCount={localAssignments.length}
          totalPeople={totalPeople}
        />

        {/* Содержимое */}
        <div className="p-6 overflow-y-auto max-h-[50vh]">
          <div className="space-y-6">
            {/* Отображаем группы цехов */}
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="text-gray-500">Loading...</div>
              </div>
            ) : error ? (
              <div className="flex items-center justify-center py-8">
                <div className="text-red-500">Error: {error}</div>
              </div>
            ) : (
              uniqueWorkshops.map((workshop) => (
                <WorkshopGroup
                  key={workshop}
                  workshop={workshop}
                  assignments={workshopGroups[workshop] || []}
                  workCenters={workCenters}
                  workSchedules={workSchedules}
                  onAddAssignment={handleAddAssignment}
                  onUpdateAssignment={handleUpdateAssignment}
                  onRemoveAssignment={handleRemoveAssignment}
                  getExistingWorkCenterIds={getExistingWorkCenterIds}
                />
              ))
            )}
          </div>
        </div>

        {/* Кнопки действий */}
        <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-200">
          <button
            onClick={handleCancel}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
          >
            {t('cancel')}
          </button>
          <button
            onClick={handleSave}
            disabled={!hasChanges}
            className={`px-4 py-2 text-white rounded-md transition-colors ${
              hasChanges 
                ? 'bg-blue-600 hover:bg-blue-700' 
                : 'bg-gray-400 cursor-not-allowed'
            }`}
          >
            {t('save')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DayAssignmentModal;
