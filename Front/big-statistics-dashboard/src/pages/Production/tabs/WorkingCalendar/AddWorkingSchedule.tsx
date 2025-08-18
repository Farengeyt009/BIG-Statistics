import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { API_ENDPOINTS } from '../../../../config/api';

// ✅ УНИФИЦИРОВАННАЯ ЛОГИКА ВАЛИДАЦИИ:
// - Первая запись всегда должна быть типа WORKSHIFT
// - Первая запись не может быть изменена или удалена (в любом режиме)
// - Должна быть ровно одна запись типа WORKSHIFT
// - Все записи типа BREAKS должны быть внутри интервала WORKSHIFT

interface WorkCenter {
  id: string;
  nameZH: string;
  nameEN: string;
}

interface WorkScheduleType {
  id: string;
  nameEN: string;
  nameZH: string;
}

interface TimeRecord {
  id: string;
  typeId: string;
  startTime: string;
  endTime: string;
}

// ✅ НОВЫЕ ИНТЕРФЕЙСЫ: Структура данных для API
interface ScheduleLine {
  typeId: string;
  start: string;
  end: string;
}

interface WorkingScheduleData {
  workshopId: string;
  name: string;
  isFavorite: boolean;
  lines: ScheduleLine[];
  updatedAt?: string;
  actor?: string;
}

interface AddWorkingScheduleProps {
  isOpen: boolean;
  onClose: () => void;
  onBack: () => void;
  selectedWorkCenter: WorkCenter | null;
  workCenters: WorkCenter[];
  // ✅ НОВЫЕ ПРОПСЫ ДЛЯ РЕДАКТИРОВАНИЯ
  editMode?: boolean;
  scheduleToEdit?: any;
  onScheduleUpdated?: () => void;
}

const AddWorkingSchedule: React.FC<AddWorkingScheduleProps> = ({
  isOpen,
  onClose,
  onBack,
  selectedWorkCenter,
  workCenters,
  editMode = false,
  scheduleToEdit = null,
  onScheduleUpdated
}) => {
  const { t, i18n } = useTranslation('production');
  const currentLanguage = i18n.language as 'en' | 'zh' | 'ru';

  // ✅ НОВОЕ СОСТОЯНИЕ: Режим редактирования
  const [isEditMode, setIsEditMode] = useState(editMode);
  const [editingSchedule, setEditingSchedule] = useState<any>(scheduleToEdit);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    isFavorite: false
  });

  // State for work center selection
  const [currentWorkCenter, setCurrentWorkCenter] = useState<WorkCenter | null>(selectedWorkCenter);

  // State for work schedule types
  const [workScheduleTypes, setWorkScheduleTypes] = useState<WorkScheduleType[]>([]);
  const [loadingTypes, setLoadingTypes] = useState(false);

  // State for time records
  const [timeRecords, setTimeRecords] = useState<TimeRecord[]>([]);
  
  // State for error message
  const [errorMessage, setErrorMessage] = useState<string>('');

  // Initialize with default workshift record when modal opens
  useEffect(() => {
    if (isOpen && timeRecords.length === 0 && !isEditMode) {
      // ✅ Добавляем запись WORKSHIFT по умолчанию только при создании нового графика
      const defaultRecord: TimeRecord = {
        id: 'default_workshift',
        typeId: 'WORKSHIFT', // ✅ Явно указываем тип WORKSHIFT
        startTime: '',
        endTime: ''
      };
      setTimeRecords([defaultRecord]);
    }
  }, [isOpen, timeRecords.length, isEditMode]);

  // ✅ НОВЫЙ useEffect: Обработка изменений пропсов
  useEffect(() => {
    setIsEditMode(editMode);
    setEditingSchedule(scheduleToEdit);
  }, [editMode, scheduleToEdit]);

  // ✅ НОВЫЙ useEffect: Загрузка данных для редактирования
  useEffect(() => {
    if (isEditMode && editingSchedule && isOpen) {
      loadScheduleForEdit(editingSchedule);
    }
  }, [isEditMode, editingSchedule, isOpen]);

  // Update currentWorkCenter when selectedWorkCenter changes
  useEffect(() => {
    setCurrentWorkCenter(selectedWorkCenter);
  }, [selectedWorkCenter]);

  // Load work schedule types on component mount
  useEffect(() => {
    if (isOpen) {
      loadWorkScheduleTypes();
    }
  }, [isOpen]);

  // Listen for language changes
  useEffect(() => {
    const handleLanguageChange = () => {
      // Language changed, component will re-render automatically
    };

    i18n.on('languageChanged', handleLanguageChange);
    
    return () => {
      i18n.off('languageChanged', handleLanguageChange);
    };
  }, [i18n]);

  const loadWorkScheduleTypes = async () => {
    setLoadingTypes(true);
    try {
      const response = await fetch(`${API_ENDPOINTS.WORKING_CALENDAR.WORK_SCHEDULES.replace('/work-schedules', '/work-schedule-types')}`);
      const data = await response.json();
      
      if (data.success) {
        setWorkScheduleTypes(data.data);
        
        // ✅ Устанавливаем тип WORKSHIFT для первой записи только при создании нового графика
        if (!isEditMode && timeRecords.length > 0) {
          const ws = data.data.find((t: WorkScheduleType) =>
            t.nameEN === 'Work Shift' || t.nameZH === '工作班次'
          );
          if (ws) {
            setTimeRecords(prev => prev.map((r, i) => i === 0 ? {...r, typeId: ws.id} : r));
          }
        }
      } else {
        console.error('Failed to load work schedule types:', data.message);
      }
    } catch (error) {
      console.error('Error loading work schedule types:', error);
    } finally {
      setLoadingTypes(false);
    }
  };

  // ✅ helpers to resolve real IDs
  const WORKSHIFT_ID = useMemo(() => {
    const t = workScheduleTypes.find(t =>
      t.nameEN === 'Work Shift' || t.nameZH === '工作班次'
    );
    return t?.id;
  }, [workScheduleTypes]);

  const BREAKS_ID = useMemo(() => {
    const t = workScheduleTypes.find(t =>
      t.nameEN === 'Breaks' || t.nameZH === '休息时间'
    );
    return t?.id;
  }, [workScheduleTypes]);

  // ✅ НОВАЯ ФУНКЦИЯ: Загрузка данных для редактирования
  const loadScheduleForEdit = async (schedule: any) => {
    try {
              const response = await fetch(`${API_ENDPOINTS.WORKING_CALENDAR.WORK_SCHEDULES}/${schedule.scheduleId}`);
      const data = await response.json();
      
      if (data.success) {
        const api = data.data; // НЕ data.data.name!
        if (!api) throw new Error('Empty payload');

        // Нормализация под форму
        const name = api.name ?? api.scheduleName ?? '';
        const lines = (api.lines ?? api.records ?? []).map((x: any) => ({
          typeId: x.typeId ?? x.recordType,
          start: (x.start ?? x.startTime)?.slice(0, 5),
          end: (x.end ?? x.endTime)?.slice(0, 5),
        }));

        // ✅ Заполняем форму данными
        setFormData({
          name: name,
          isFavorite: !!api.isFavorite
        });
        
        // ✅ Устанавливаем выбранный цех
        const workCenter = workCenters.find(wc => wc.id === (api.workshopId ?? api.workShopId));
        if (workCenter) {
          setCurrentWorkCenter(workCenter);
        }
        
        // ✅ Преобразуем lines в timeRecords
        const records = lines.map((line: any, index: number) => ({
          id: `record_${index}`,
          typeId: line.typeId,
          startTime: line.start,
          endTime: line.end
        }));
        
        setTimeRecords(records);
      }
    } catch (error) {
      console.error('Error loading schedule for edit:', error);
    }
  };

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const addTimeRecord = () => {
    if (!BREAKS_ID) {
      console.warn('Break type not found in work schedule types');
      return;
    }
    
    const newRecord: TimeRecord = {
      id: `record_${Date.now()}_${Math.random()}`,
      typeId: BREAKS_ID,
      startTime: '',
      endTime: ''
    };
    
    setTimeRecords(prev => [...prev, newRecord]);
  };

  const removeTimeRecord = (recordId: string) => {
    // ✅ Унифицированная логика: не позволяем удалять первую запись в любом режиме
    if (timeRecords.length > 0 && timeRecords[0].id === recordId) {
      return;
    }
    setTimeRecords(prev => prev.filter(record => record.id !== recordId));
  };

  const updateTimeRecord = (recordId: string, field: keyof TimeRecord, value: string) => {
    setTimeRecords(prev => prev.map(record => {
      if (record.id === recordId) {
        // ✅ Унифицированная логика: не позволяем изменять тип первой записи в любом режиме
        if (field === 'typeId' && timeRecords.length > 0 && timeRecords[0].id === recordId && WORKSHIFT_ID) {
          return record;
        }
        return { ...record, [field]: value };
      }
      return record;
    }));
  };

  // ✅ time helpers (ровно как в SQL-валидации)
  const toMin = (hhmm: string) => {
    const [h, m] = (hhmm || '').split(':').map(Number);
    if (Number.isNaN(h) || Number.isNaN(m)) return null;
    return h * 60 + m; // 0..1439
  };
  
  const span = (s: number, e: number) => {
    const d = e - s;
    return d > 0 ? d : d + 1440; // 1..1440
  };
  
  // нормализованный отрезок в минутах [start, end) в шкале 0..2880
  const norm = (s: number, e: number): [number, number] => {
    const sp = span(s, e);
    return [s, s + sp];
  };

  const validateForm = (): string | null => {
    if (!currentWorkCenter) return getValidationMessage('workshopRequired');
    if (!formData.name.trim()) return getValidationMessage('scheduleNameRequired');
    if (timeRecords.length === 0) return getValidationMessage('timeRecordsRequired');
    
    // Проверка наличия WORKSHIFT_ID
    if (!WORKSHIFT_ID) return getValidationMessage('workShiftTypeNotFound');

    // (а) проверка наличия real WORKSHIFT_ID, если бизнес-правило обязательно
    const workshiftRecords = timeRecords.filter(r => r.typeId === WORKSHIFT_ID);
    if (workshiftRecords.length !== 1) return getValidationMessage('exactlyOneWorkshift');
    if (timeRecords[0].typeId !== WORKSHIFT_ID)
      return getValidationMessage('firstRecordMustBeWorkshift');

    // (b) собрать интервалы в минутах
    type Seg = { id: string; typeId: string; s: number; e: number; sn: number; en: number; };
    const segs: Seg[] = [];
    for (const r of timeRecords) {
      if (!r.typeId) return getValidationMessage('recordTypeRequired');
      if (!r.startTime || !r.endTime) return getValidationMessage('timeRequired');
      const s = toMin(r.startTime); const e = toMin(r.endTime);
      if (s == null || e == null) return getValidationMessage('timeRequired');
      const [sn, en] = norm(s, e);
      const sp = en - sn;
      if (sp <= 0 || sp > 1440) return getValidationMessage('endTimeAfterStart');
      segs.push({ id: r.id, typeId: r.typeId, s, e, sn, en });
    }

    // найдём сегменты
    const workshiftSegment = segs.find(x => x.typeId === WORKSHIFT_ID)!;
    const breaks = segs.filter(x => x.typeId === BREAKS_ID);

    // 1) все BREAKS внутри WORKSHIFT - УБРАНА ВАЛИДАЦИЯ
    // if (workshiftSegment && breaks.length) {
    //   const wsStart = workshiftSegment.sn, wsEnd = workshiftSegment.en;
    //   for (const b of breaks) {
    //     if (b.sn < wsStart || b.en > wsEnd) {
    //       return getValidationMessage('breaksInsideWorkshift');
    //     }
    //   }
    // }

    // 2) перекрытия ТОЛЬКО внутри одного типа (для BREAKS)
    const checkNoOverlap = (arr: typeof segs) => {
      const a = [...arr].sort((x,y) => x.sn - y.sn);
      for (let i = 1; i < a.length; i++) {
        if (a[i-1].en > a[i].sn) return false;
      }
      // защита от «перелёта» внутри типа
      const maxEnd = Math.max(...a.map(x => x.en));
      const minStart = Math.min(...a.map(x => x.sn));
      if (a.length && (maxEnd - 1440) > minStart) return false;
      return true;
    };
    if (!checkNoOverlap(breaks)) return getValidationMessage('noTimeOverlap');

    // 3) (опционально) суммарная длительность перерывов не больше смены
    const breaksTotal = breaks.reduce((acc,x) => acc + (x.en - x.sn), 0);
    const wsSpan = workshiftSegment.en - workshiftSegment.sn;
    if (breaksTotal > wsSpan) return getValidationMessage('noTimeOverlap');

    // 4) дубли
    const seen = new Set<string>();
    for (const x of segs) {
      const key = `${x.typeId}|${x.sn}|${x.en}`;
      if (seen.has(key)) return getValidationMessage('noDuplicates');
      seen.add(key);
    }
    return null;
  };

  // Create validation messages based on current language
  const validationMessages = useMemo(() => {
    const messages = {
      en: {
        workshopRequired: "Workshop selection is required",
        scheduleNameRequired: "Schedule name is required",
        timeRecordsRequired: "At least one time record is required",
        recordTypeRequired: "Record type is required",
        timeRequired: "Start time and end time are required",
        endTimeAfterStart: "End time must be after start time",

        noTimeOverlap: "Time records cannot overlap",
        exactlyOneWorkshift: "Exactly one WORKSHIFT record is required",
        noDuplicates: "Duplicate time records are not allowed",
        firstRecordMustBeWorkshift: "The first record must be a WORKSHIFT",
        workShiftTypeNotFound: "Work Shift type not found in schedule types"
      },
      zh: {
        workshopRequired: "必须选择车间",
        scheduleNameRequired: "必须填写班次名称",
        timeRecordsRequired: "至少需要一条时间记录",
        recordTypeRequired: "必须选择记录类型",
        timeRequired: "必须填写开始时间和结束时间",
        endTimeAfterStart: "结束时间必须晚于开始时间",

        noTimeOverlap: "时间记录不能重叠",
        exactlyOneWorkshift: "必须恰好有一条工作班次记录",
        noDuplicates: "不允许重复的时间记录",
        firstRecordMustBeWorkshift: "第一条记录必须是工作班次",
        workShiftTypeNotFound: "在班次类型中未找到工作班次类型"
      },
             ru: {
         workshopRequired: "Необходимо выбрать цех",
         scheduleNameRequired: "Необходимо указать название графика",
         timeRecordsRequired: "Необходимо добавить хотя бы одну запись времени",
         recordTypeRequired: "Необходимо выбрать тип записи",
         timeRequired: "Необходимо указать время начала и окончания",
         endTimeAfterStart: "Время окончания должно быть позже времени начала",

         noTimeOverlap: "Записи времени не могут пересекаться",
         exactlyOneWorkshift: "Должна быть ровно одна рабочая смена",
         noDuplicates: "Дублирование записей времени не допускается",
         firstRecordMustBeWorkshift: "Первая запись должна быть рабочей смены",
        workShiftTypeNotFound: "Тип рабочей смены не найден в типах графиков"
       }
    };
    
    const selectedLanguage = (i18n.resolvedLanguage || i18n.language) as 'en' | 'zh' | 'ru';
    
    return messages[selectedLanguage] || messages.ru;
  }, [i18n.language]);

  const getValidationMessage = (key: string): string => {
    return (validationMessages as any)[key] || validationMessages.workshopRequired;
  };

  // ✅ НОВАЯ ФУНКЦИЯ: Валидация в реальном времени
  const validateTimeRecord = (record: TimeRecord, allRecords: TimeRecord[]): string[] => {
    const errors: string[] = [];
    
    // ✅ ДОПОЛНИТЕЛЬНАЯ ПРОВЕРКА: Первая запись должна быть WORKSHIFT
    if (allRecords.length > 0 && allRecords[0].id === record.id && WORKSHIFT_ID && record.typeId !== WORKSHIFT_ID) {
      errors.push(getValidationMessage('firstRecordMustBeWorkshift'));
    }
    
    // ✅ Упрощенная проверка времени с использованием минутной логики
    if (record.startTime && record.endTime) {
      const s = toMin(record.startTime);
      const e = toMin(record.endTime);
      if (s == null || e == null) {
        errors.push(getValidationMessage('timeRequired'));
      } else {
        const [sn, en] = norm(s, e);
        const sp = en - sn;
        if (sp <= 0 || sp > 1440) {
          errors.push(getValidationMessage('endTimeAfterStart'));
        }
      }
    }
    
    // ✅ Упрощенная проверка пересечений с учетом типов
    const otherRecords = allRecords.filter(r => r.id !== record.id);
    for (const other of otherRecords) {
      if (record.startTime && record.endTime && other.startTime && other.endTime) {
        const s1 = toMin(record.startTime);
        const e1 = toMin(record.endTime);
        const s2 = toMin(other.startTime);
        const e2 = toMin(other.endTime);
        
        if (s1 != null && e1 != null && s2 != null && e2 != null) {
          const [sn1, en1] = norm(s1, e1);
          const [sn2, en2] = norm(s2, e2);
          
          if (record.typeId === other.typeId) {
            // проверяем пересечение только для одинаковых типов
            if (sn1 < en2 && sn2 < en1) {
              errors.push(getValidationMessage('noTimeOverlap'));
              break;
            }
          } else {
            // если это BREAKS vs WORKSHIFT — проверяем, что BREAKS внутри WORKSHIFT - УБРАНА ВАЛИДАЦИЯ
            // const b = record.typeId === BREAKS_ID ? {sn: sn1, en: en1} : {sn: sn2, en: en2};
            // const ws = record.typeId === WORKSHIFT_ID ? {sn: sn1, en: en1} : {sn: sn2, en: en2};
            // if (record.typeId === BREAKS_ID || other.typeId === BREAKS_ID) {
            //   if (b.sn < ws.sn || b.en > ws.en) {
            //     errors.push(getValidationMessage('breaksInsideWorkshift'));
            //     break;
            //   }
            // }
          }
        }
      }
    }
    
    return errors;
  };

  // ✅ ОБНОВИТЬ: Функцию handleSubmit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    setErrorMessage('');
    
    const validationError = validateForm();
    if (validationError) {
      setErrorMessage(validationError);
      return;
    }
    
    const scheduleData = prepareScheduleData();
    
    // ✅ ДОБАВЛЯЕМ ОТЛАДКУ
    console.log('Schedule data being sent:', scheduleData);
    console.log('Is edit mode:', isEditMode);
    console.log('Editing schedule:', editingSchedule);
    
    try {
      let response;
      
      if (isEditMode && editingSchedule) {
        // ✅ РЕДАКТИРОВАНИЕ: PUT запрос
        response = await fetch(`${API_ENDPOINTS.WORKING_CALENDAR.WORK_SCHEDULES}/${editingSchedule.scheduleId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            ...scheduleData,
            updatedAt: editingSchedule.updatedAt
          })
        });
      } else {
        // ✅ СОЗДАНИЕ: POST запрос
        response = await fetch(API_ENDPOINTS.WORKING_CALENDAR.WORK_SCHEDULES, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(scheduleData)
        });
      }
      
      const result = await response.json();
      
      // ✅ ДОБАВЛЯЕМ ОТЛАДКУ
      console.log('Response status:', response.status);
      console.log('Response result:', result);
      
      if (response.ok) {
        // ✅ Успешное сохранение
        console.log('Schedule saved:', result);
        
        // ✅ Вызываем callback для обновления списка
        if (onScheduleUpdated) {
          onScheduleUpdated();
        }
        
        // ✅ Сбрасываем форму
        resetForm();
        onClose();
      } else {
        // ✅ Обработка ошибок
        if (response.status === 409) {
          setErrorMessage('Schedule was modified by another user. Please refresh and try again.');
        } else {
          setErrorMessage(result.message || `Failed to save schedule (Status: ${response.status})`);
        }
      }
    } catch (error) {
      console.error('Error saving schedule:', error);
      setErrorMessage('Network error while saving schedule');
    }
  };

  // ✅ НОВАЯ ФУНКЦИЯ: Сброс формы
  const resetForm = () => {
    setFormData({
      name: '',
      isFavorite: false
    });
    setTimeRecords([]);
    setErrorMessage('');
    setIsEditMode(false);
    setEditingSchedule(null);
  };

  // ✅ ОБНОВИТЬ: Функцию handleCancel
  const handleCancel = () => {
    resetForm();
    onBack();
  };

  // ✅ НОВАЯ ФУНКЦИЯ: Преобразование в требуемый формат
  const prepareScheduleData = (): WorkingScheduleData => {
    const baseData = {
      workshopId: currentWorkCenter?.id || '',
      name: formData.name,
      isFavorite: formData.isFavorite,
      lines: timeRecords.map(record => ({
        typeId: record.typeId,
        start: record.startTime,    // было: startTime
        end: record.endTime         // было: endTime
      })),
      actor: 'web-user'
    };

    // ✅ Добавляем updatedAt только при редактировании
    if (isEditMode && editingSchedule) {
      return {
        ...baseData,
        updatedAt: editingSchedule.updatedAt
      };
    }

    return baseData;
  };

  const getTypeName = (type: WorkScheduleType) => {
    switch (currentLanguage) {
      case 'zh':
        return type.nameZH;
      case 'en':
        return type.nameEN;
      default:
        return type.nameZH;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <button
              onClick={handleCancel}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h2 className="text-2xl font-bold text-[#0d1c3d]">
              {isEditMode ? t('editWorkingSchedule') : t('addWorkingSchedule')}
            </h2>
          </div>
          <button
            onClick={handleCancel}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          {/* Selected Work Center Info */}
          {currentWorkCenter && (
            <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium text-blue-800 mb-1">
                    {t('selectedWorkCenter')}:
                  </h3>
                  <select
                    value={currentWorkCenter.id}
                    onChange={(e) => {
                      const selected = workCenters.find(wc => wc.id === e.target.value);
                      if (selected) setCurrentWorkCenter(selected);
                    }}
                    className="px-3 py-1.5 text-sm border border-blue-300 rounded-lg bg-white text-blue-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    {workCenters.map((workCenter) => (
                      <option key={workCenter.id} value={workCenter.id}>
                        {currentLanguage === 'zh' ? workCenter.nameZH : 
                         currentLanguage === 'en' ? workCenter.nameEN : 
                         workCenter.nameZH}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

                     {/* Error Message */}
           {errorMessage && (
             <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
               <div className="flex items-center">
                 <svg className="w-5 h-5 text-red-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                 </svg>
                 <span className="text-red-800 text-sm font-medium">{errorMessage}</span>
               </div>
             </div>
           )}

           {/* Form */}
           <div className="space-y-6">
                         {/* Schedule Name */}
             <div>
               <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                 {t('scheduleName')} *
               </label>
                              <input
                  type="text"
                  id="name"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder={t('scheduleNamePlaceholder')}
                />
             </div>

                           {/* ✅ НОВЫЙ БЛОК: Избранное */}
              <div className="flex items-center space-x-3">
                <button
                  type="button"
                  onClick={() => handleInputChange('isFavorite', !formData.isFavorite)}
                  className={`p-1 rounded transition-colors ${
                    formData.isFavorite 
                      ? 'text-yellow-500 hover:text-yellow-600' 
                      : 'text-gray-400 hover:text-yellow-500'
                  }`}
                >
                  <svg className="w-5 h-5" fill={formData.isFavorite ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                  </svg>
                </button>
                <label className="text-sm font-medium text-gray-700">
                  {currentLanguage === 'zh' ? '收藏' : 'Favorite'}
                </label>
              </div>

                         {/* Time Records */}
             <div>
               <h3 className="text-lg font-medium text-gray-900 mb-4">
                 {t('workingHours')}
               </h3>

               {timeRecords.length === 0 ? (
                 <div className="text-center py-8 text-gray-500 border-2 border-dashed border-gray-300 rounded-lg">
                   {t('addRecord')} {t('workingHours').toLowerCase()}
                 </div>
               ) : (
                                   <div className="space-y-4">
                    {timeRecords.map((record, index) => {
                      const recordErrors = validateTimeRecord(record, timeRecords);
                      
                      return (
                        <div key={record.id} className={`flex items-center space-x-4 p-4 border rounded-lg ${
                          recordErrors.length > 0 ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-gray-50'
                        }`}>
                          <div className="flex-1">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              {t('recordType')} *
                            </label>
                            <select
                              value={record.typeId}
                              onChange={(e) => updateTimeRecord(record.id, 'typeId', e.target.value)}
                              className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                                timeRecords.length > 0 && timeRecords[0].id === record.id ? 'bg-gray-100 cursor-not-allowed' : ''
                              }`}
                              disabled={timeRecords.length > 0 && timeRecords[0].id === record.id}
                            >
                             {timeRecords.length > 0 && timeRecords[0].id === record.id ? (
                               <option value="">Select type</option>
                             ) : null}
                             {workScheduleTypes.map((type) => (
                               <option key={type.id} value={type.id}>
                                 {getTypeName(type)}
                               </option>
                             ))}
                           </select>
                          </div>
                         
                         <div className="flex-1">
                           <label className="block text-sm font-medium text-gray-700 mb-2">
                             {t('startTime')} *
                           </label>
                            <input
                              type="time"
                              value={record.startTime}
                              onChange={(e) => updateTimeRecord(record.id, 'startTime', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                         </div>
                         
                         <div className="flex-1">
                           <label className="block text-sm font-medium text-gray-700 mb-2">
                             {t('endTime')} *
                           </label>
                            <input
                              type="time"
                              value={record.endTime}
                              onChange={(e) => updateTimeRecord(record.id, 'endTime', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                         </div>
                         
                         <div className="flex items-end">
                           {!(timeRecords.length > 0 && timeRecords[0].id === record.id) && (
                             <button
                               type="button"
                               onClick={() => removeTimeRecord(record.id)}
                               className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                               title={t('removeRecord')}
                             >
                               <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                               </svg>
                             </button>
                           )}
                         </div>
                         
                         {/* ✅ НОВЫЙ БЛОК: Отображение ошибок */}
                         {recordErrors.length > 0 && (
                           <div className="col-span-full mt-2">
                             {recordErrors.map((error, errorIndex) => (
                               <div key={errorIndex} className="text-red-600 text-sm flex items-center">
                                 <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                 </svg>
                                 {error}
                               </div>
                             ))}
                           </div>
                         )}
                       </div>
                      );
                    })}
                 </div>
               )}

                               {/* Add Record Button - positioned below all records */}
                <button
                  type="button"
                  onClick={addTimeRecord}
                  disabled={loadingTypes || workScheduleTypes.length === 0}
                  className={`px-4 py-2 rounded-lg transition-colors flex items-center space-x-2 mt-4 ${
                    loadingTypes || workScheduleTypes.length === 0
                      ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  <span>{loadingTypes ? 'Loading...' : t('addRecord')}</span>
                </button>
             </div>

            {/* Buttons */}
            <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
              <button
                type="button"
                onClick={handleCancel}
                className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                {t('cancel')}
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                className="px-4 py-2 bg-[#0d1c3d] text-white hover:bg-[#0a1529] rounded-lg transition-colors"
              >
                {isEditMode ? t('saveChanges') : t('save')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddWorkingSchedule;
