import React, { useState, useEffect, useRef, memo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { WorkCenterAssignmentRowProps, DayAssignment, WorkCenterRow, WorkCenterShift } from './types';
import { API_ENDPOINTS } from '../../../../config/api';
import { useQueryClient } from '@tanstack/react-query';

const WorkCenterAssignmentRow: React.FC<WorkCenterAssignmentRowProps> = ({
  assignment,
  workCenters,
  workSchedules,
  onUpdate,
  onRemove,
  existingWorkCenterIds,
  showHeader = true,
  isFirstRow = false,
  isDuplicate = false,
  isEmptyWorkCenter = false
}) => {
  // Константы для ширины колонок основной строки
  const MAIN_ROW_COLUMN_WIDTHS = {
    workCenter: 'w-28',
    schedule: 'w-36',
    people: 'w-20',
    planPcs: 'w-24',
    factPcs: 'w-24',
    complPcs: 'w-32',
    planH: 'w-24',
    factH: 'w-24',
    complH: 'w-32',
    shiftTime: 'w-24',
    timeLoss: 'w-24',
    different: 'w-24',
    delete: 'w-16'
  };

  // Константы для ширины колонок подстрок смен
  const SHIFT_ROW_COLUMN_WIDTHS = {
    workCenter: 'w-28',
    schedule: 'w-36',
    people: 'w-20',
    duration: 'w-32',
    breaksCount: 'w-20',
    breaksHours: 'w-24',
    netWorkHours: 'w-24',
    delete: 'w-16'
  };
  
  const { t, i18n } = useTranslation('production');
  const queryClient = useQueryClient();
  const isInternalUpdate = useRef(false); // Флаг для отслеживания внутренних обновлений
  
  // ✅ НОВОЕ СОСТОЯНИЕ: Преобразуем DayAssignment в WorkCenterRow
  const [workCenterRow, setWorkCenterRow] = useState<WorkCenterRow>(() => {
    // Преобразуем старую структуру в новую
    const initialShifts: WorkCenterShift[] = (assignment.shifts && assignment.shifts.length > 0)
      ? assignment.shifts
      : (assignment.scheduleId ? [{
          id: `${assignment.id}_shift_1`,
          scheduleId: assignment.scheduleId,
          peopleCount: assignment.peopleCount,
          notes: assignment.notes
        }] : []);

    return {
      id: assignment.id,
      date: assignment.date,
      workCenterId: assignment.workCenterId,
      shifts: initialShifts,
      production: assignment.production,
      shiftTime: assignment.shiftTime,
      timeLoss: assignment.timeLoss,
      different: assignment.different
    };
  });
  
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isExpanded, setIsExpanded] = useState(false); // Для показа/скрытия подстрок смен
  // Локальный кастомный confirm-баннер
  const [confirmDialog, setConfirmDialog] = useState<{ visible: boolean; message: string; onConfirm?: () => void }>({ visible: false, message: '' });
  const openConfirm = (message: string, onConfirm: () => void) => setConfirmDialog({ visible: true, message, onConfirm });
  const closeConfirm = () => setConfirmDialog({ visible: false, message: '', onConfirm: undefined });

  // ✅ НОВАЯ ЛОГИКА: Автоматическое создание смены для данных о выпуске
  useEffect(() => {
    if (assignment.production && 
        (assignment.production.planQty > 0 || 
         assignment.production.factQty > 0 || 
         assignment.production.planHours > 0 || 
         assignment.production.factHours > 0) &&
        workCenterRow.shifts.length === 0) {
      // Если есть данные о выпуске, но нет смен, создаем смену по умолчанию
      const defaultShift: WorkCenterShift = {
        id: `${assignment.id}_shift_1`,
        scheduleId: assignment.scheduleId || '',
        peopleCount: assignment.peopleCount || 0,
        notes: assignment.notes
      };
      
      const updatedRow = {
        ...workCenterRow,
        shifts: [defaultShift]
      };
      
      setWorkCenterRow(updatedRow);
      
      // Подстроки по умолчанию свернуты
      setIsExpanded(false);
    }
  }, [assignment.production, workCenterRow.shifts.length]);

  // Функция для форматирования чисел с российским разделителем
  const formatNumber = (value: number): string => {
    return Math.round(value).toLocaleString('ru-RU');
  };

  // Обновляем локальное состояние при изменении assignment извне
  useEffect(() => {
    // Игнорируем обновления, если это наше внутреннее обновление
    if (isInternalUpdate.current) {
      return;
    }
    
    // Проверяем, действительно ли изменились данные
    const hasRealChanges = 
      assignment.id !== workCenterRow.id ||
      assignment.date !== workCenterRow.date ||
      assignment.workCenterId !== workCenterRow.workCenterId ||
      assignment.scheduleId !== (workCenterRow.shifts[0]?.scheduleId || '') ||
      assignment.peopleCount !== (workCenterRow.shifts[0]?.peopleCount || 0) ||
      JSON.stringify(assignment.shifts || []) !== JSON.stringify(workCenterRow.shifts || []) ||
      JSON.stringify(assignment.production) !== JSON.stringify(workCenterRow.production) ||
      assignment.shiftTime !== workCenterRow.shiftTime ||
      assignment.timeLoss !== workCenterRow.timeLoss ||
      assignment.different !== workCenterRow.different;

    if (hasRealChanges) {
      const wasExpanded = isExpanded; // Сохраняем текущее состояние раскрытия
      
      const nextShifts: WorkCenterShift[] = (assignment.shifts && assignment.shifts.length > 0)
        ? assignment.shifts
        : (assignment.scheduleId ? [{
            id: `${assignment.id}_shift_1`,
            scheduleId: assignment.scheduleId,
            peopleCount: assignment.peopleCount,
            notes: assignment.notes
          }] : []);

      setWorkCenterRow({
        id: assignment.id,
        date: assignment.date,
        workCenterId: assignment.workCenterId,
        shifts: nextShifts,
        production: assignment.production,
        shiftTime: assignment.shiftTime,
        timeLoss: assignment.timeLoss,
        different: assignment.different
      });
      setErrors({});
      
      // Восстанавливаем состояние раскрытия
      setIsExpanded(wasExpanded);
    }
  }, [assignment]);

  // ✅ НОВАЯ ФУНКЦИЯ: Добавление новой смены
  const addShift = useCallback(() => {
    const newShift: WorkCenterShift = {
      id: `${workCenterRow.id}_shift_${Date.now()}`,
      scheduleId: '',
      peopleCount: 0,
      notes: ''
    };
    
    const updatedRow = {
      ...workCenterRow,
      shifts: [...workCenterRow.shifts, newShift]
    };
    
    setWorkCenterRow(updatedRow);
    updateParentAssignment(updatedRow);
    
    // Автоматически раскрываем подстроки при добавлении первой смены
    if (!isExpanded) {
      setIsExpanded(true);
    }
  }, [workCenterRow, isExpanded]);

  // ✅ Удаление смены немедленно через API (если есть lineId)
  const removeShift = async (shiftId: string) => {
    openConfirm(t('confirmDeleteShift') || 'Delete this shift?', async () => {
      const target = workCenterRow.shifts.find(s => s.id === shiftId);
      // Если сгенерированный id (нет lineId из БД), просто удаляем локально
      const isDbLine = target && /[a-f0-9\-]{36}/i.test(String(target.id));
      try {
        if (isDbLine) {
          await fetch(`${API_ENDPOINTS.WORKING_CALENDAR.WORK_SCHEDULES_LINE_DELETE}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lineId: target!.id })
          });
        }
      } catch (e) {
      }

      const updatedRow = {
        ...workCenterRow,
        shifts: workCenterRow.shifts.filter(shift => shift.id !== shiftId)
      };
      setWorkCenterRow(updatedRow);
      updateParentAssignment(updatedRow);
      closeConfirm();
      // Инвалидации для обновления данных модалки и календаря
      queryClient.invalidateQueries({ queryKey: ['assign'] });
      queryClient.invalidateQueries({ queryKey: ['calendar'] });
    });
  };

  // ✅ НОВАЯ ФУНКЦИЯ: Обновление смены
  const updateShift = (shiftId: string, field: keyof WorkCenterShift, value: any) => {
    const updatedRow = {
      ...workCenterRow,
      shifts: workCenterRow.shifts.map(shift => 
        shift.id === shiftId ? { ...shift, [field]: value } : shift
      )
    };
    
    setWorkCenterRow(updatedRow);
    updateParentAssignment(updatedRow);
  };

  // ✅ НОВАЯ ФУНКЦИЯ: Обновление родительского assignment
  const updateParentAssignment = (row: WorkCenterRow) => {
    isInternalUpdate.current = true; // Устанавливаем флаг внутреннего обновления
    
    // Преобразуем обратно в DayAssignment для совместимости
    const firstShift = row.shifts[0];
    const updatedAssignment: DayAssignment = {
      id: row.id,
      date: row.date,
      workCenterId: row.workCenterId,
      scheduleId: firstShift?.scheduleId || '',
      peopleCount: firstShift?.peopleCount || 0,
      notes: firstShift?.notes,
      production: row.production,
      shiftTime: row.shiftTime,
      timeLoss: row.timeLoss,
      different: row.different,
      shifts: row.shifts
    };
    
    onUpdate(updatedAssignment);
    
    // Сбрасываем флаг после небольшой задержки
    setTimeout(() => {
      isInternalUpdate.current = false;
    }, 0);
  };

  // Валидация
  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Проверяем Work Center только если его можно редактировать
    if (canEditWorkCenter) {
      if (!workCenterRow.workCenterId) {
        newErrors.workCenterId = t('assignmentValidation.workCenterRequired');
      } else if (workCenterRow.workCenterId !== assignment.workCenterId && 
                 existingWorkCenterIds.includes(workCenterRow.workCenterId)) {
        newErrors.workCenterId = t('assignmentValidation.duplicateAssignment');
      }
    }

    // Проверяем, что есть хотя бы одна смена
    if (workCenterRow.shifts.length === 0) {
      newErrors.shifts = t('assignmentValidation.atLeastOneShiftRequired');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Обработчики изменений
  const handleWorkCenterChange = (workCenterId: string) => {
    const updatedRow = { ...workCenterRow, workCenterId };
    setWorkCenterRow(updatedRow);
    // setErrors(prev => ({ ...prev, workCenterId: '' })); // Валидация отключена
    updateParentAssignment(updatedRow);
  };

  // Обработчики потери фокуса для валидации - ОТКЛЮЧЕНО
  const handleWorkCenterBlur = () => {
    // Валидация отключена
  };

  // Получение названий для отображения
  const getWorkCenterName = (id: string) => {
    const workCenter = workCenters.find(wc => wc.id === id);
    return workCenter ? workCenter.name : '';
  };

  const getScheduleName = (id: string) => {
    const schedule = workSchedules.find(ws => ws.id === id);
    return schedule ? schedule.name : '';
  };

  // Проверка, можно ли удалять строку (нельзя удалять строки с данными о выпуске)
  const canDelete = !workCenterRow.production || 
    (workCenterRow.production.planQty === 0 && 
     workCenterRow.production.factQty === 0 && 
     workCenterRow.production.planHours === 0 && 
     workCenterRow.production.factHours === 0);

  // Проверка, можно ли изменять Work Center (нельзя изменять в строках с данными о выпуске)
  const canEditWorkCenter = !workCenterRow.production || 
    (workCenterRow.production.planQty === 0 && 
     workCenterRow.production.factQty === 0 && 
     workCenterRow.production.planHours === 0 && 
     workCenterRow.production.factHours === 0);

  return (
    <div className={`relative border-l border-r border-b ${isFirstRow ? 'border-t' : ''} border-gray-300 text-xs overflow-hidden ${isDuplicate || isEmptyWorkCenter ? 'ring-1 ring-red-400' : ''}`}>
      {/* Локальный confirm-баннер */}
      {confirmDialog.visible && (
        <div className="fixed inset-0 z-40 flex items-center justify-center">
          <div className="bg-white border border-gray-300 shadow-2xl rounded px-5 py-4 w-[560px] min-h-[150px] flex flex-col justify-center">
            <div className="text-gray-900 text-sm font-medium mb-2">
              {t('areYouSureDelete', {
                defaultValue: {
                  en: 'Are you sure you want to delete?',
                  zh: '您确定要删除吗？',
                  ru: 'Вы уверены, что хотите удалить?'
                }[i18n.language] || 'Вы уверены, что хотите удалить?'
              })}
            </div>
            <div className="mt-4 flex justify-end space-x-2">
              <button className="px-3 py-1.5 rounded bg-gray-100 hover:bg-gray-200" onClick={closeConfirm}>Cancel</button>
              <button className="px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700" onClick={() => confirmDialog.onConfirm && confirmDialog.onConfirm()}>OK</button>
            </div>
          </div>
        </div>
      )}
      {/* Основная строка - Рабочий центр */}
      <div className="flex">
        {/* Рабочий центр */}
        <div className={`${MAIN_ROW_COLUMN_WIDTHS.workCenter} border-r border-gray-300`}>
          {showHeader && (
            <div className="px-2 py-1 bg-gray-100 border-b border-gray-300 text-xs font-medium text-gray-700">
              {t('workCenter')}
            </div>
          )}
          <div className="px-2 py-1">
            {canEditWorkCenter ? (
              <select
                value={workCenterRow.workCenterId}
                onChange={(e) => handleWorkCenterChange(e.target.value)}
                onBlur={handleWorkCenterBlur}
                className="w-full px-1 py-1 border-0 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">{t('selectWorkCenter')}</option>
                {workCenters.map((workCenter) => (
                  <option key={workCenter.id} value={workCenter.id}>
                    {workCenter.name}
                  </option>
                ))}
              </select>
            ) : (
              <div className="px-1 py-1 text-gray-600">
                {getWorkCenterName(workCenterRow.workCenterId)}
              </div>
            )}
          </div>
        </div>

        {/* ✅ ИЗМЕНЕНО: Кнопка для управления сменами */}
        <div className={`${MAIN_ROW_COLUMN_WIDTHS.schedule} border-r border-gray-300`}>
          {showHeader && (
            <div className="px-2 py-1 bg-gray-100 border-b border-gray-300 text-xs font-medium text-gray-700">
              {t('schedule')}
            </div>
          )}
          <div className="px-2 py-1">
            <button
              type="button"
              onClick={() => {
                if (workCenterRow.shifts.length > 0 && !isExpanded) {
                  // Если есть смены, но подстроки скрыты, раскрываем их
                  setIsExpanded(true);
                } else {
                  // Иначе переключаем состояние
                  setIsExpanded(!isExpanded);
                }
              }}
              className="w-full px-1 py-1 text-left text-blue-600 hover:text-blue-800 focus:outline-none"
              title={t('clickToManageShifts')}
            >
              {(() => {
                // Подсчитываем только смены с назначенными графиками
                const assignedShifts = workCenterRow.shifts.filter(shift => shift.scheduleId && shift.scheduleId.trim() !== '');
                
                if (assignedShifts.length === 0) {
                  return <span className="text-red-500">{t('nonSchedule')}</span>;
                } else {
                  return <span>{assignedShifts.length} {t('shifts')}</span>;
                }
              })()}
              <span className="ml-1">
                <svg 
                  className="w-3 h-3 inline" 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  {isExpanded ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  )}
                </svg>
              </span>
            </button>
          </div>
        </div>

        {/* Количество людей (сумма по всем сменам) */}
        <div className={`${MAIN_ROW_COLUMN_WIDTHS.people} border-r border-gray-300`}>
          {showHeader && (
            <div className="px-2 py-1 bg-gray-100 border-b border-gray-300 text-xs font-medium text-gray-700 text-center">
              {t('peopleCount')}
            </div>
          )}
          <div className="px-2 py-2 text-center flex items-center justify-center">
            {workCenterRow.shifts.reduce((sum, shift) => sum + shift.peopleCount, 0)}
          </div>
        </div>

        {/* Данные о выпуске - Штуки */}
        <div className={`${MAIN_ROW_COLUMN_WIDTHS.planPcs} border-r border-gray-300`}>
          {showHeader && (
            <div className="px-2 py-1 bg-gray-100 border-b border-gray-300 text-xs font-medium text-gray-700 text-center">
              {t('production.planQty')}
            </div>
          )}
          <div className="px-2 py-2 text-center flex items-center justify-center">
            {formatNumber(workCenterRow.production?.planQty || 0)}
          </div>
        </div>

        <div className={`${MAIN_ROW_COLUMN_WIDTHS.factPcs} border-r border-gray-300`}>
          {showHeader && (
            <div className="px-2 py-1 bg-gray-100 border-b border-gray-300 text-xs font-medium text-gray-700 text-center">
              {t('production.factQty')}
            </div>
          )}
          <div className="px-2 py-2 text-center flex items-center justify-center">
            {formatNumber(workCenterRow.production?.factQty || 0)}
          </div>
        </div>

        <div className={`${MAIN_ROW_COLUMN_WIDTHS.complPcs} border-r border-gray-300`}>
          {showHeader && (
            <div className="px-2 py-1 bg-gray-100 border-b border-gray-300 text-xs font-medium text-gray-700 text-center">
              {t('production.completionPercentagePcs')}
            </div>
          )}
          <div className={`px-2 py-2 text-center flex items-center justify-center ${
            workCenterRow.production?.completionPercentageQty 
              ? workCenterRow.production.completionPercentageQty >= 95 
                ? 'bg-green-50' 
                : workCenterRow.production.completionPercentageQty >= 75 
                  ? 'bg-yellow-50' 
                  : 'bg-red-50'
              : ''
          }`}>
            {workCenterRow.production?.completionPercentageQty?.toFixed(1) || 0}%
          </div>
        </div>

        {/* Данные о выпуске - Часы */}
        <div className={`${MAIN_ROW_COLUMN_WIDTHS.planH} border-r border-gray-300`}>
          {showHeader && (
            <div className="px-2 py-1 bg-gray-100 border-b border-gray-300 text-xs font-medium text-gray-700 text-center">
              {t('production.planHours')}
            </div>
          )}
          <div className="px-2 py-2 text-center flex items-center justify-center">
            {formatNumber(workCenterRow.production?.planHours || 0)}
          </div>
        </div>

        <div className={`${MAIN_ROW_COLUMN_WIDTHS.factH} border-r border-gray-300`}>
          {showHeader && (
            <div className="px-2 py-1 bg-gray-100 border-b border-gray-300 text-xs font-medium text-gray-700 text-center">
              {t('production.factHours')}
            </div>
          )}
          <div className="px-2 py-2 text-center flex items-center justify-center">
            {formatNumber(workCenterRow.production?.factHours || 0)}
          </div>
        </div>

        <div className={`${MAIN_ROW_COLUMN_WIDTHS.complH} border-r border-gray-300`}>
          {showHeader && (
            <div className="px-2 py-1 bg-gray-100 border-b border-gray-300 text-xs font-medium text-gray-700 text-center">
              {t('production.completionPercentageHours')}
            </div>
          )}
          <div className={`px-2 py-2 text-center flex items-center justify-center ${
            workCenterRow.production?.completionPercentageHours 
              ? workCenterRow.production.completionPercentageHours >= 95 
                ? 'bg-green-50' 
                : workCenterRow.production.completionPercentageHours >= 75 
                  ? 'bg-yellow-50' 
                  : 'bg-red-50'
              : ''
          }`}>
            {workCenterRow.production?.completionPercentageHours?.toFixed(1) || 0}%
          </div>
        </div>

        {/* Новые поля */}
        <div className={`${MAIN_ROW_COLUMN_WIDTHS.shiftTime} border-r border-gray-300`}>
          {showHeader && (
            <div className="px-2 py-1 bg-gray-100 border-b border-gray-300 text-xs font-medium text-gray-700 text-center">
              {t('shiftTime')}
            </div>
          )}
          <div className="px-2 py-2 text-center flex items-center justify-center">
            {formatNumber(workCenterRow.shiftTime || 0)}
          </div>
        </div>

        <div className={`${MAIN_ROW_COLUMN_WIDTHS.timeLoss} border-r border-gray-300`}>
          {showHeader && (
            <div className="px-2 py-1 bg-gray-100 border-b border-gray-300 text-xs font-medium text-gray-700 text-center">
              {t('timeLoss')}
            </div>
          )}
          <div className="px-2 py-2 text-center flex items-center justify-center">
            {formatNumber(workCenterRow.timeLoss || 0)}
          </div>
        </div>

        <div className={`${MAIN_ROW_COLUMN_WIDTHS.different} border-r border-gray-300`}>
          {showHeader && (
            <div className="px-2 py-1 bg-gray-100 border-b border-gray-300 text-xs font-medium text-gray-700 text-center">
              {t('different')}
            </div>
          )}
          <div className="px-2 py-2 text-center flex items-center justify-center">
            {formatNumber(workCenterRow.different || 0)}
          </div>
        </div>

        {/* Кнопка удаления */}
        <div className={`${MAIN_ROW_COLUMN_WIDTHS.delete} border-r border-gray-300`}>
          {showHeader && (
            <div className="px-2 py-1 bg-gray-100 border-b border-gray-300 text-xs font-medium text-gray-700 text-center">
              {t('delete')}
            </div>
          )}
          <div className="px-2 py-2 text-center flex items-center justify-center">
            {canDelete && (
              <button
                type="button"
                onClick={() => {
                  openConfirm(t('confirmDeleteRow') || 'Delete this row?', async () => {
                    try {
                      const endpoint = (API_ENDPOINTS.WORKING_CALENDAR as any).WORK_CENTER_ASSIGNMENT_DELETE;
                      if (endpoint) {
                        await fetch(`${endpoint}`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ assignmentId: workCenterRow.id })
                        });
                      }
                      onRemove(workCenterRow.id);
                      closeConfirm();
                      queryClient.invalidateQueries({ queryKey: ['assign'] });
                      queryClient.invalidateQueries({ queryKey: ['calendar'] });
                    } catch (e) {
                      alert(t('errorDeletingAssignment'));
                    }
                  });
                }}
                className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                title={t('removeAssignment')}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ✅ НОВЫЙ БЛОК: Подстроки смен */}
      {isExpanded && (
        <div className="bg-gray-50 border-t border-gray-200">
          {/* Таблица подстрок */}
          <table className="w-full border-collapse">
            {/* Заголовок подстрок */}
            <thead>
              <tr className="bg-gray-100 border-b border-gray-200">
                <th className={`${SHIFT_ROW_COLUMN_WIDTHS.workCenter} px-2 py-1 text-xs font-medium text-gray-700 text-left border-r border-gray-200`}>
                  {t('shift')}
                </th>
                <th className={`${SHIFT_ROW_COLUMN_WIDTHS.schedule} px-2 py-1 text-xs font-medium text-gray-700 text-left border-r border-gray-200`}>
                  {t('schedule')}
                </th>
                <th className={`${SHIFT_ROW_COLUMN_WIDTHS.people} px-2 py-1 text-xs font-medium text-gray-700 text-center border-r border-gray-200`}>
                  {t('peopleCount')}
                </th>
                <th className={`${SHIFT_ROW_COLUMN_WIDTHS.duration} px-2 py-1 text-xs font-medium text-gray-700 text-center border-r border-gray-200`}>
                  {t('duration')}
                </th>
                <th className={`${SHIFT_ROW_COLUMN_WIDTHS.breaksCount} px-2 py-1 text-xs font-medium text-gray-700 text-center border-r border-gray-200`}>
                  {t('breaksCount')}
                </th>
                <th className={`${SHIFT_ROW_COLUMN_WIDTHS.breaksHours} px-2 py-1 text-xs font-medium text-gray-700 text-center border-r border-gray-200`}>
                  {t('breaksHours')}
                </th>
                <th className={`${SHIFT_ROW_COLUMN_WIDTHS.netWorkHours} px-2 py-1 text-xs font-medium text-gray-700 text-center border-r border-gray-200`}>
                  {t('workTime')}
                </th>
                <th className={`${SHIFT_ROW_COLUMN_WIDTHS.delete} px-2 py-1 text-xs font-medium text-gray-700 text-center`}>
                  {t('delete')}
                </th>
              </tr>
            </thead>

            <tbody>
              {/* Список смен */}
              {workCenterRow.shifts.map((shift, index) => {
                // Находим выбранный график для отображения дополнительной информации
                const selectedSchedule = workSchedules.find(schedule => schedule.id === shift.scheduleId);
                
                return (
                  <tr key={shift.id} className="border-b border-gray-200 hover:bg-gray-50">
                    <td className={`${SHIFT_ROW_COLUMN_WIDTHS.workCenter} px-2 py-1 text-xs text-gray-600 border-r border-gray-200`}>
                      {t('shift')} {index + 1}
                    </td>
                    
                    <td className={`${SHIFT_ROW_COLUMN_WIDTHS.schedule} px-2 py-1 border-r border-gray-200`}>
                      <select
                        value={shift.scheduleId}
                        onChange={(e) => updateShift(shift.id, 'scheduleId', e.target.value)}
                        className="w-full px-1 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        <option value="">{t('selectSchedule')}</option>
                        {workSchedules.map((schedule) => (
                          <option key={schedule.id} value={schedule.id}>
                            {schedule.name} ({schedule.startTime}-{schedule.endTime})
                          </option>
                        ))}
                      </select>
                    </td>
                    
                    <td className={`${SHIFT_ROW_COLUMN_WIDTHS.people} px-2 py-1 border-r border-gray-200`}>
                      <input
                        type="number"
                        value={shift.peopleCount}
                        onChange={(e) => updateShift(shift.id, 'peopleCount', parseInt(e.target.value) || 0)}
                        className="w-full px-1 py-1 border border-gray-300 rounded text-xs text-center focus:outline-none focus:ring-1 focus:ring-blue-500"
                        min="0"
                      />
                    </td>
                    
                    <td className={`${SHIFT_ROW_COLUMN_WIDTHS.duration} px-2 py-1 text-xs text-gray-600 text-center border-r border-gray-200`}>
                      {selectedSchedule ? `${selectedSchedule.startTime}-${selectedSchedule.endTime}` : '-'}
                    </td>
                    
                    <td className={`${SHIFT_ROW_COLUMN_WIDTHS.breaksCount} px-2 py-1 text-xs text-gray-600 text-center border-r border-gray-200`}>
                      {selectedSchedule?.breaksCount || '-'}
                    </td>
                    
                    <td className={`${SHIFT_ROW_COLUMN_WIDTHS.breaksHours} px-2 py-1 text-xs text-gray-600 text-center border-r border-gray-200`}>
                      {selectedSchedule?.breaksTotalHours || '-'}
                    </td>
                    
                    <td className={`${SHIFT_ROW_COLUMN_WIDTHS.netWorkHours} px-2 py-1 text-xs text-gray-600 text-center border-r border-gray-200`}>
                      {selectedSchedule?.netWorkTimeHours || '-'}
                    </td>
                    
                    <td className={`${SHIFT_ROW_COLUMN_WIDTHS.delete} px-2 py-1 text-center`}>
                      <button
                        type="button"
                        onClick={() => removeShift(shift.id)}
                        className="p-1 rounded transition-colors text-red-600 hover:bg-red-50"
                        title={t('removeShift')}
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                );
              })}

              {/* Строка для добавления новой смены */}
              <tr className="border-b border-gray-200">
                <td className={`${SHIFT_ROW_COLUMN_WIDTHS.workCenter} px-2 py-1 border-r border-gray-200`}>
                  <button
                    type="button"
                    onClick={addShift}
                    className="w-full px-1 py-1 text-blue-600 hover:text-blue-800 text-xs border border-gray-300 rounded hover:bg-blue-50 transition-colors flex items-center justify-center space-x-1"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    <span>{t('addShift')}</span>
                  </button>
                </td>
                
                <td className={`${SHIFT_ROW_COLUMN_WIDTHS.schedule} px-2 py-1 border-r border-gray-200`}>
                  {/* Пустая ячейка */}
                </td>
                
                <td className={`${SHIFT_ROW_COLUMN_WIDTHS.people} px-2 py-1 border-r border-gray-200`}>
                  {/* Пустая ячейка */}
                </td>
                
                <td className={`${SHIFT_ROW_COLUMN_WIDTHS.duration} px-2 py-1 border-r border-gray-200`}>
                  {/* Пустая ячейка */}
                </td>
                
                <td className={`${SHIFT_ROW_COLUMN_WIDTHS.breaksCount} px-2 py-1 border-r border-gray-200`}>
                  {/* Пустая ячейка */}
                </td>
                
                <td className={`${SHIFT_ROW_COLUMN_WIDTHS.breaksHours} px-2 py-1 border-r border-gray-200`}>
                  {/* Пустая ячейка */}
                </td>
                
                <td className={`${SHIFT_ROW_COLUMN_WIDTHS.netWorkHours} px-2 py-1 border-r border-gray-200`}>
                  {/* Пустая ячейка */}
                </td>
                
                <td className={`${SHIFT_ROW_COLUMN_WIDTHS.delete} px-2 py-1 text-center`}>
                  {/* Пустая ячейка */}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* Отображение ошибок - УБРАНО */}
    </div>
  );
};

export default WorkCenterAssignmentRow;
