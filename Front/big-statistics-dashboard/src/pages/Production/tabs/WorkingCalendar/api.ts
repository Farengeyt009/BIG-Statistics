import { WorkCenter, WorkSchedule } from './types';
import { API_ENDPOINTS } from '../../../../config/api';

// Интерфейс для данных из API
export interface AssignWorkSchedulesData {
  table1: Array<{
    WorkShop_CustomWS: string;
    WorkCenter_CustomWS: string;
    WorkShopName_ZH: string;
    WorkShopName_EN: string;
    WorkCenterName_ZH: string;
    WorkCenterName_EN: string;
    Plan_QTY: number;
    FACT_QTY: number;
    Plan_TIME: number;
    FACT_TIME: number;
    Shift_Time: number;
    Time_Loss: number;
    People: number;
  }>;
  table2: Array<{
    scheduleId: number;
    scheduleCode: string;
    workshopId: string;
    workShopId: string;
    name: string;
    scheduleName: string;
    isFavorite: boolean;
    isDeleted: boolean;
    createdAt: string;
    updatedAt: string;
    createdBy: string;
    updatedBy: string;
    workShift: {
      start: string;
      end: string;
    };
    breaks: {
      count: number;
      totalHours: number;
    };
    netWorkTime: {
      minutes: number;
      hours: number;
    };
    // ✅ НОВЫЕ ПОЛЯ: Поддержка ночных смен
    lines?: Array<{
      typeId: string;
      start: string;
      end: string;
      crossesMidnight?: boolean;
      spanMinutes?: number;
    }>;
  }>;
  table3: any[];
  selected_date: string;
  total_records: {
    table1: number;
    table2: number;
    table3: number;
  };
}

// Функция для получения данных из API
export const fetchAssignWorkSchedulesData = async (date: string): Promise<AssignWorkSchedulesData> => {
  try {
    const response = await fetch(`${API_ENDPOINTS.WORKING_CALENDAR.ASSIGN_WORK_SCHEDULES}?date=${date}`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching Assign Work Schedules data:', error);
    throw error;
  }
};

// Функция для преобразования данных API в формат компонентов
export const transformApiDataToWorkCenters = (
  apiData: AssignWorkSchedulesData,
  currentLanguage: 'en' | 'zh' = 'en'
): WorkCenter[] => {
  const workCenters: WorkCenter[] = [];
  const workshopMap = new Map<string, string>();

  apiData.table1.forEach(item => {
    const workshopId = item.WorkShop_CustomWS;
    const workCenterId = item.WorkCenter_CustomWS;
    
    // Создаем уникальный ID для связки цех + рабочий центр
    const uniqueWorkCenterId = `${workshopId}_${workCenterId}`;
    
    // Получаем название цеха на нужном языке
    const workshopName = currentLanguage === 'en' 
      ? item.WorkShopName_EN 
      : item.WorkShopName_ZH;
    
    // Получаем название рабочего центра на нужном языке
    const workCenterName = currentLanguage === 'en'
      ? item.WorkCenterName_EN
      : item.WorkCenterName_ZH;

    // Сохраняем маппинг цех ID -> название цеха
    if (!workshopMap.has(workshopId)) {
      workshopMap.set(workshopId, workshopName);
    }

    workCenters.push({
      id: uniqueWorkCenterId, // Используем уникальный ID
      name: workCenterName,
      workshop: workshopName
    });
  });

  return workCenters;
};

// Функция для получения уникальных цехов
export const getUniqueWorkshops = (
  apiData: AssignWorkSchedulesData,
  currentLanguage: 'en' | 'zh' = 'en'
): string[] => {
  // Создаем маппинг ID цеха -> название цеха
  const workshopIdToName = new Map<string, string>();
  
  apiData.table1.forEach(item => {
    const workshopName = currentLanguage === 'en' 
      ? item.WorkShopName_EN 
      : item.WorkShopName_ZH;
    workshopIdToName.set(item.WorkShop_CustomWS, workshopName);
  });

  // Получаем уникальные ID цехов
  const workshopIds = Array.from(workshopIdToName.keys());
  
  // Кастомная сортировка по ID: 装配车间 первым, 热水器总装组 вторым, остальные по алфавиту
  const sortedWorkshopIds = workshopIds.sort((a, b) => {
    // 装配车间 - первый
    if (a === '装配车间') return -1;
    if (b === '装配车间') return 1;
    
    // 热水器总装组 - второй
    if (a === '热水器总装组') return -1;
    if (b === '热水器总装组') return 1;
    
    // Остальные по алфавиту
    return a.localeCompare(b);
  });
  
  // Возвращаем названия цехов в нужном порядке
  return sortedWorkshopIds.map(id => workshopIdToName.get(id)!);
};

// Функция для группировки рабочих центров по цехам
export const groupWorkCentersByWorkshop = (
  apiData: AssignWorkSchedulesData,
  currentLanguage: 'en' | 'zh' = 'en'
): Record<string, WorkCenter[]> => {
  const groups: Record<string, WorkCenter[]> = {};

  apiData.table1.forEach(item => {
    const workshopName = currentLanguage === 'en' 
      ? item.WorkShopName_EN 
      : item.WorkShopName_ZH;
    
    const workCenterName = currentLanguage === 'en'
      ? item.WorkCenterName_EN
      : item.WorkCenterName_ZH;

    // Создаем уникальный ID для связки цех + рабочий центр
    const uniqueWorkCenterId = `${item.WorkShop_CustomWS}_${item.WorkCenter_CustomWS}`;

    const workCenter: WorkCenter = {
      id: uniqueWorkCenterId, // Используем уникальный ID
      name: workCenterName,
      workshop: workshopName
    };

    if (!groups[workshopName]) {
      groups[workshopName] = [];
    }
    groups[workshopName].push(workCenter);
  });

  return groups;
};

// Функция для преобразования table2 в WorkSchedule[]
export const transformTable2ToWorkSchedules = (
  apiData: AssignWorkSchedulesData,
  selectedWorkshopId?: string
): WorkSchedule[] => {
  const workSchedules: WorkSchedule[] = [];

  apiData.table2.forEach(schedule => {
    // Если указан конкретный цех, фильтруем по нему
    if (selectedWorkshopId && schedule.workshopId !== selectedWorkshopId) {
      return;
    }

    // ✅ ОБНОВЛЕННОЕ ОПРЕДЕЛЕНИЕ ТИПА СМЕНЫ: Используем новые поля
    let shiftType: 'morning' | 'evening' | 'night' | 'custom';
    
    // ✅ Проверяем, есть ли информация о переходе через полночь
    if (schedule.lines && schedule.lines.length > 0) {
      const workshiftLine = schedule.lines.find((line: any) => line.typeId === 'WORKSHIFT');
      if (workshiftLine && workshiftLine.crossesMidnight) {
        // Если есть поле crossesMidnight, используем его
        shiftType = 'night';
      } else {
        // Иначе определяем по времени начала
        const startHour = parseInt(schedule.workShift.start.split(':')[0]);
        if (startHour >= 6 && startHour < 14) {
          shiftType = 'morning';
        } else if (startHour >= 14 && startHour < 20) {
          shiftType = 'evening';
        } else if (startHour >= 20 || startHour < 8) {
          shiftType = 'night';
        } else {
          shiftType = 'custom';
        }
      }
    } else {
      // Fallback на старую логику
      const startHour = parseInt(schedule.workShift.start.split(':')[0]);
      if (startHour >= 6 && startHour < 14) {
        shiftType = 'morning';
      } else if (startHour >= 14 && startHour < 20) {
        shiftType = 'evening';
      } else if (startHour >= 20 || startHour < 8) {
        shiftType = 'night';
      } else {
        shiftType = 'custom';
      }
    }

    // ✅ Получаем информацию о ночной смене из lines
    const workshiftLine = schedule.lines?.find((line: any) => line.typeId === 'WORKSHIFT');
    
    workSchedules.push({
      id: schedule.scheduleId.toString(),
      name: schedule.name,
      startTime: schedule.workShift.start,
      endTime: schedule.workShift.end,
      shiftType: shiftType,
      workshopId: schedule.workshopId,
      breaksCount: schedule.breaks.count,
      breaksTotalHours: schedule.breaks.totalHours,
      netWorkTimeHours: schedule.netWorkTime.hours,
      // ✅ НОВЫЕ ПОЛЯ: Поддержка ночных смен
      crossesMidnight: workshiftLine?.crossesMidnight || false,
      spanMinutes: workshiftLine?.spanMinutes || 0
    });
  });

  // Сортируем: сначала избранные, потом по названию
  return workSchedules.sort((a, b) => {
    const aSchedule = apiData.table2.find(s => s.scheduleId.toString() === a.id);
    const bSchedule = apiData.table2.find(s => s.scheduleId.toString() === b.id);
    
    // Избранные графики первыми
    if (aSchedule?.isFavorite && !bSchedule?.isFavorite) return -1;
    if (!aSchedule?.isFavorite && bSchedule?.isFavorite) return 1;
    
    // Затем по названию
    return a.name.localeCompare(b.name);
  });
};

// Функция для получения графиков для конкретного цеха
export const getWorkSchedulesForWorkshop = (
  apiData: AssignWorkSchedulesData,
  workshopId: string
): WorkSchedule[] => {
  return transformTable2ToWorkSchedules(apiData, workshopId);
};
