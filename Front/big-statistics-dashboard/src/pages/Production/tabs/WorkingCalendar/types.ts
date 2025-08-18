// Интерфейс для рабочего центра (РЦ)
export interface WorkCenter {
  id: string;
  name: string;
  workshop: string;
}

// Интерфейс для данных о выпуске по РЦ
export interface WorkCenterProduction {
  workCenterId: string;
  workCenterName: string;
  workshop: string;
  // Данные в штуках
  planQty: number;
  factQty: number;
  completionPercentageQty: number;
  // Данные в часах
  planHours: number;
  factHours: number;
  completionPercentageHours: number;
}

// Интерфейс для рабочего графика
export interface WorkSchedule {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  shiftType: 'morning' | 'evening' | 'night' | 'custom';
  workshopId?: string; // ID цеха для фильтрации
  breaksCount?: number; // Количество перерывов
  breaksTotalHours?: number; // Общее время перерывов в часах
  netWorkTimeHours?: number; // Чистое рабочее время в часах
  // ✅ НОВЫЕ ПОЛЯ: Поддержка ночных смен
  crossesMidnight?: boolean; // Переходит ли смена через полночь
  spanMinutes?: number; // Длительность смены в минутах
}

// ✅ НОВЫЙ ИНТЕРФЕЙС: Смена для рабочего центра
export interface WorkCenterShift {
  id: string;
  scheduleId: string;
  peopleCount: number;
  notes?: string;
}

// ✅ НОВЫЙ ИНТЕРФЕЙС: Строка рабочего центра с несколькими сменами
export interface WorkCenterRow {
  id: string;
  date: string; // YYYY-MM-DD
  workCenterId: string;
  shifts: WorkCenterShift[]; // Массив смен
  // Данные о выпуске (если есть)
  production?: {
    planQty: number;
    factQty: number;
    completionPercentageQty: number;
    planHours: number;
    factHours: number;
    completionPercentageHours: number;
  };
  // Новые поля
  shiftTime?: number; // Время смены в часах
  timeLoss?: number; // Потери времени в часах
  different?: number; // Разница в часах
}

// Интерфейс для назначения графика на день (ОСТАВЛЯЕМ ДЛЯ ОБРАТНОЙ СОВМЕСТИМОСТИ)
export interface DayAssignment {
  id: string;
  date: string; // YYYY-MM-DD
  workCenterId: string;
  scheduleId: string;
  peopleCount: number;
  notes?: string;
  // Новые поля
  shiftTime?: number; // Время смены в часах
  timeLoss?: number; // Потери времени в часах
  different?: number; // Разница в часах
  // Данные о выпуске (если есть)
  production?: {
    planQty: number;
    factQty: number;
    completionPercentageQty: number;
    planHours: number;
    factHours: number;
    completionPercentageHours: number;
  };
}



// Интерфейс для данных ячейки календаря
export interface DayCellData {
  date: string;
  assignments: DayAssignment[];
  totalPeople: number;
}

// Интерфейс для пропсов модального окна
export interface DayAssignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDate: Date | null;
  assignments: DayAssignment[];
  onSave: (assignments: DayAssignment[]) => void;
  // Данные о выпуске по РЦ для выбранной даты
  productionData?: WorkCenterProduction[];
}

// Интерфейс для группировки назначений по цеху
export interface WorkshopGroup {
  workshop: string;
  assignments: DayAssignment[];
}

// Интерфейс для пропсов строки назначения
export interface WorkCenterAssignmentRowProps {
  assignment: DayAssignment;
  workCenters: WorkCenter[];
  workSchedules: WorkSchedule[];
  onUpdate: (assignment: DayAssignment) => void;
  onRemove: (assignmentId: string) => void;
  existingWorkCenterIds: string[];
  showHeader?: boolean;
  isFirstRow?: boolean;
}

// Интерфейс для пропсов группы цеха
export interface WorkshopGroupProps {
  workshop: string;
  assignments: DayAssignment[];
  workCenters: WorkCenter[];
  workSchedules: WorkSchedule[];
  onAddAssignment: (workshop: string) => void;
  onUpdateAssignment: (assignment: DayAssignment) => void;
  onRemoveAssignment: (assignmentId: string) => void;
  getExistingWorkCenterIds: (currentAssignmentId: string) => string[];
}

// Новый интерфейс для данных календаря из API
export interface CalendarDayData {
  OnlyDate: string; // формат DD.MM.YYYY
  Prod_Time: number;
  Shift_Time: number;
  Time_Loss: number;
  People: number;
}

export interface CalendarApiResponse {
  data: CalendarDayData[];
  year: number;
  month: number;
  total_records: number;
}
