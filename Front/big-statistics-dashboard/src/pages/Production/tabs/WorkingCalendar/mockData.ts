import { WorkCenter, WorkSchedule, DayAssignment, WorkCenterProduction } from './types';

// Мок-данные для РЦ
export const mockWorkCenters: WorkCenter[] = [
  { id: 'wc1', name: '包布车间', workshop: 'Wrapping' },
  { id: 'wc2', name: '冲压车间', workshop: 'Stamping' },
  { id: 'wc3', name: '丝印车间', workshop: 'Silk-Screen' },
  { id: 'wc4', name: '喷粉车间', workshop: 'Coating' },
  { id: 'wc5', name: '激光', workshop: 'Laser' },
  { id: 'wc6', name: '超声', workshop: 'Ultrasonic' },
  { id: 'wc7', name: '热水器冲压组', workshop: 'Stamping WH' },
  { id: 'wc8', name: '热水器总装组', workshop: 'Water-Heater' },
  { id: 'wc9', name: '注塑车间', workshop: 'Injection' },
  { id: 'wc10', name: '线材车间', workshop: 'Wire' },
  { id: 'wc11', name: '装配车间', workshop: 'Heater' }
];

// Мок-данные для графиков работ
export const mockWorkSchedules: WorkSchedule[] = [
  { id: '1', name: 'Утренняя смена', startTime: '08:00', endTime: '16:00', shiftType: 'morning' },
  { id: '2', name: 'Вечерняя смена', startTime: '16:00', endTime: '00:00', shiftType: 'evening' },
  { id: '3', name: 'Ночная смена', startTime: '00:00', endTime: '08:00', shiftType: 'night' },
  { id: '4', name: '8-часовой рабочий день', startTime: '09:00', endTime: '17:00', shiftType: 'custom' },
  { id: '5', name: 'Сверхурочные часы', startTime: '17:00', endTime: '21:00', shiftType: 'custom' }
];

// Мок-данные для назначений на дни
export const mockDayAssignments: Record<string, DayAssignment[]> = {
  '2025-01-15': [
    { id: '1', date: '2025-01-15', workCenterId: 'wc1', scheduleId: '1', peopleCount: 12, notes: 'Полная загрузка' },
    { id: '2', date: '2025-01-15', workCenterId: 'wc2', scheduleId: '2', peopleCount: 8, notes: 'Вечерняя смена' }
  ],
  '2025-01-20': [
    { id: '3', date: '2025-01-20', workCenterId: 'wc3', scheduleId: '1', peopleCount: 15, notes: 'Срочный заказ' }
  ],
  '2025-01-25': [
    { id: '4', date: '2025-01-25', workCenterId: 'wc4', scheduleId: '4', peopleCount: 10, notes: 'Обычный день' },
    { id: '5', date: '2025-01-25', workCenterId: 'wc5', scheduleId: '5', peopleCount: 6, notes: 'Сверхурочные' }
  ]
};

// Функция для получения назначений на конкретную дату
export const getAssignmentsForDate = (date: string): DayAssignment[] => {
  return mockDayAssignments[date] || [];
};

// Функция для сохранения назначений на конкретную дату
export const saveAssignmentsForDate = (date: string, assignments: DayAssignment[]): void => {
  if (assignments.length === 0) {
    delete mockDayAssignments[date];
  } else {
    mockDayAssignments[date] = assignments;
  }
};

// Функция для генерации уникального ID
export const generateId = (): string => {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
};

// Интерфейс для статистики дня
export interface DayStatistics {
  planCompletionpcs: number; // процент выполнения плана по штукам
  planCompletionh: number; // процент выполнения плана по часам
  efficiency: number; // эффективность = (сумма FACT_TIME / Shift_Time) * 100
  totalTasks: number; // количество строк с Plan_QTY > 0
  completedTasks: number; // количество строк с FACT_QTY > 0
  totalPlanQty: number; // суммарный план по штукам
  totalFactQty: number; // суммарный факт по штукам
}

// Функция для расчета статистики из API данных
export const calculateStatisticsFromApiData = (apiData: any): DayStatistics => {
  let totalPlanQty = 0;
  let totalFactQty = 0;
  let totalPlanTime = 0;
  let totalFactTime = 0;
  let totalShiftTime = 0;
  let tasksWithPlan = 0;
  let tasksWithFact = 0;

  apiData.table1.forEach((item: any) => {
    // Парсим строковые значения в числа
    const planQty = parseFloat(item.Plan_QTY) || 0;
    const factQty = parseFloat(item.FACT_QTY) || 0;
    const planTime = parseFloat(item.Plan_TIME) || 0;
    const factTime = parseFloat(item.FACT_TIME) || 0;
    const shiftTime = parseFloat(item.Shift_Time) || 0;

    // Подсчет для выполнения плана по штукам
    if (planQty > 0) {
      totalPlanQty += planQty;
      tasksWithPlan++;
    }
    if (factQty > 0) {
      totalFactQty += factQty;
      tasksWithFact++;
    }

    // Подсчет для выполнения плана по часам
    if (planTime > 0) {
      totalPlanTime += planTime;
    }
    if (factTime > 0) {
      totalFactTime += factTime;
    }

    // Подсчет для эффективности
    if (shiftTime > 0) {
      totalShiftTime += shiftTime;
    }
  });

  // Расчет показателей с проверкой на деление на ноль
  const planCompletionpcs = totalPlanQty > 0 ? (totalFactQty / totalPlanQty) * 100 : 0;
  const planCompletionh = totalPlanTime > 0 ? (totalFactTime / totalPlanTime) * 100 : 0;
  
  // Эффективность: (totalFactTime / totalShiftTime) * 100
  // Если totalShiftTime = 0, то эффективность = 0
  const efficiency = totalShiftTime > 0 
    ? (totalFactTime / totalShiftTime) * 100 
    : 0;

  return {
    planCompletionpcs: Math.round(planCompletionpcs * 100) / 100, // Округляем до 2 знаков
    planCompletionh: Math.round(planCompletionh * 100) / 100,
    efficiency: Math.round(efficiency * 100) / 100,
    totalTasks: tasksWithPlan,
    completedTasks: tasksWithFact,
    totalPlanQty: Math.round(totalPlanQty), // Округляем до целых
    totalFactQty: Math.round(totalFactQty)  // Округляем до целых
  };
};

// Функция для получения статистики дня (оставляем для обратной совместимости)
export const getDayStatistics = (date: string): DayStatistics => {
  const day = new Date(date).getDate();
  
  // Генерируем разные данные для разных дней
  if (day % 3 === 0) {
    return {
      planCompletionpcs: 85,
      planCompletionh: 92,
      efficiency: 78,
      totalTasks: 12,
      completedTasks: 10,
      totalPlanQty: 1000,
      totalFactQty: 850
    };
  } else if (day % 5 === 0) {
    return {
      planCompletionpcs: 45,
      planCompletionh: 78,
      efficiency: 65,
      totalTasks: 8,
      completedTasks: 4,
      totalPlanQty: 500,
      totalFactQty: 200
    };
  } else if (day % 7 === 0) {
    return {
      planCompletionpcs: 98,
      planCompletionh: 96,
      efficiency: 92,
      totalTasks: 15,
      completedTasks: 15,
      totalPlanQty: 2000,
      totalFactQty: 1900
    };
  } else {
    return {
      planCompletionpcs: 72,
      planCompletionh: 85,
      efficiency: 70,
      totalTasks: 10,
      completedTasks: 7,
      totalPlanQty: 800,
      totalFactQty: 560
    };
  }
};

// Мок-данные о выпуске по датам
export const mockProductionData: Record<string, WorkCenterProduction[]> = {
  '2025-01-15': [
    {
      workCenterId: 'wc1',
      workCenterName: '包布车间',
      workshop: 'Wrapping',
      planQty: 100,
      factQty: 85,
      completionPercentageQty: 85,
      planHours: 8,
      factHours: 7.5,
      completionPercentageHours: 93.75
    },
    {
      workCenterId: 'wc2',
      workCenterName: '冲压车间',
      workshop: 'Stamping',
      planQty: 150,
      factQty: 120,
      completionPercentageQty: 80,
      planHours: 10,
      factHours: 8,
      completionPercentageHours: 80
    },
    {
      workCenterId: 'wc3',
      workCenterName: '丝印车间',
      workshop: 'Silk-Screen',
      planQty: 80,
      factQty: 76,
      completionPercentageQty: 95,
      planHours: 6,
      factHours: 5.8,
      completionPercentageHours: 96.67
    }
  ],
  '2025-01-20': [
    {
      workCenterId: 'wc3',
      workCenterName: '丝印车间',
      workshop: 'Silk-Screen',
      planQty: 120,
      factQty: 95,
      completionPercentageQty: 79.17,
      planHours: 8,
      factHours: 6.5,
      completionPercentageHours: 81.25
    },
    {
      workCenterId: 'wc4',
      workCenterName: '喷粉车间',
      workshop: 'Coating',
      planQty: 200,
      factQty: 180,
      completionPercentageQty: 90,
      planHours: 12,
      factHours: 11,
      completionPercentageHours: 91.67
    },
    {
      workCenterId: 'wc5',
      workCenterName: '激光',
      workshop: 'Laser',
      planQty: 60,
      factQty: 58,
      completionPercentageQty: 96.67,
      planHours: 4,
      factHours: 3.9,
      completionPercentageHours: 97.5
    }
  ],
  '2025-01-25': [
    {
      workCenterId: 'wc4',
      workCenterName: '喷粉车间',
      workshop: 'Coating',
      planQty: 180,
      factQty: 160,
      completionPercentageQty: 88.89,
      planHours: 10,
      factHours: 9,
      completionPercentageHours: 90
    },
    {
      workCenterId: 'wc5',
      workCenterName: '激光',
      workshop: 'Laser',
      planQty: 50,
      factQty: 45,
      completionPercentageQty: 90,
      planHours: 3,
      factHours: 2.8,
      completionPercentageHours: 93.33
    },
    {
      workCenterId: 'wc6',
      workCenterName: '超声',
      workshop: 'Ultrasonic',
      planQty: 90,
      factQty: 75,
      completionPercentageQty: 83.33,
      planHours: 6,
      factHours: 5.2,
      completionPercentageHours: 86.67
    }
  ],
  '2025-01-30': [
    {
      workCenterId: 'wc7',
      workCenterName: '热水器冲压组',
      workshop: 'Stamping WH',
      planQty: 300,
      factQty: 280,
      completionPercentageQty: 93.33,
      planHours: 16,
      factHours: 15.5,
      completionPercentageHours: 96.88
    },
    {
      workCenterId: 'wc8',
      workCenterName: '热水器总装组',
      workshop: 'Water-Heater',
      planQty: 250,
      factQty: 220,
      completionPercentageQty: 88,
      planHours: 14,
      factHours: 12.5,
      completionPercentageHours: 89.29
    },
    {
      workCenterId: 'wc9',
      workCenterName: '注塑车间',
      workshop: 'Injection',
      planQty: 400,
      factQty: 380,
      completionPercentageQty: 95,
      planHours: 20,
      factHours: 19.2,
      completionPercentageHours: 96
    }
  ],
  '2025-02-05': [
    {
      workCenterId: 'wc10',
      workCenterName: '线材车间',
      workshop: 'Wire',
      planQty: 150,
      factQty: 135,
      completionPercentageQty: 90,
      planHours: 8,
      factHours: 7.3,
      completionPercentageHours: 91.25
    },
    {
      workCenterId: 'wc11',
      workCenterName: '装配车间',
      workshop: 'Heater',
      planQty: 120,
      factQty: 110,
      completionPercentageQty: 91.67,
      planHours: 10,
      factHours: 9.1,
      completionPercentageHours: 91
    }
  ],
  // Добавляем данные для текущего месяца (январь 2025)
  '2025-01-10': [
    {
      workCenterId: 'wc1',
      workCenterName: '包布车间',
      workshop: 'Wrapping',
      planQty: 120,
      factQty: 115,
      completionPercentageQty: 95.83,
      planHours: 9,
      factHours: 8.7,
      completionPercentageHours: 96.67
    },
    {
      workCenterId: 'wc2',
      workCenterName: '冲压车间',
      workshop: 'Stamping',
      planQty: 180,
      factQty: 165,
      completionPercentageQty: 91.67,
      planHours: 12,
      factHours: 11.2,
      completionPercentageHours: 93.33
    }
  ],
  '2025-01-12': [
    {
      workCenterId: 'wc3',
      workCenterName: '丝印车间',
      workshop: 'Silk-Screen',
      planQty: 100,
      factQty: 88,
      completionPercentageQty: 88,
      planHours: 7,
      factHours: 6.2,
      completionPercentageHours: 88.57
    },
    {
      workCenterId: 'wc4',
      workCenterName: '喷粉车间',
      workshop: 'Coating',
      planQty: 250,
      factQty: 230,
      completionPercentageQty: 92,
      planHours: 15,
      factHours: 14.1,
      completionPercentageHours: 94
    }
  ],
  '2025-01-18': [
    {
      workCenterId: 'wc5',
      workCenterName: '激光',
      workshop: 'Laser',
      planQty: 70,
      factQty: 65,
      completionPercentageQty: 92.86,
      planHours: 5,
      factHours: 4.8,
      completionPercentageHours: 96
    },
    {
      workCenterId: 'wc6',
      workCenterName: '超声',
      workshop: 'Ultrasonic',
      planQty: 110,
      factQty: 95,
      completionPercentageQty: 86.36,
      planHours: 7,
      factHours: 6.1,
      completionPercentageHours: 87.14
    }
  ]
};

// Функция для получения данных о выпуске на конкретную дату
export const getProductionDataForDate = (date: string): WorkCenterProduction[] => {
  return mockProductionData[date] || [];
};

// Функция для восстановления моковых данных
export const restoreMockData = (): void => {
  // Восстанавливаем данные о выпуске
  Object.keys(mockProductionData).forEach(date => {
    if (!mockProductionData[date]) {
      // Если данные были удалены, восстанавливаем их
    }
  });
  
  // Восстанавливаем назначения
  Object.keys(mockDayAssignments).forEach(date => {
    if (!mockDayAssignments[date]) {
      // Если назначения были удалены, восстанавливаем их
    }
  });
};
