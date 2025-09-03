import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { DayAssignmentModalProps, DayAssignment, WorkCenterShift } from './types';
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
import { API_ENDPOINTS } from '../../../../config/api';
import { Factory } from 'lucide-react';
import { useAssignDataQuery, useSavedRowsByDayQuery, useBulkReplaceMutation } from './apiHooks';

const DayAssignmentModal: React.FC<DayAssignmentModalProps> = ({
  isOpen,
  onClose,
  selectedDate,
  assignments,
  onSave,
  productionData = [],
  selectedWorkShopIds = [],
  allWorkshops = [],
  onChangeSelectedWorkShopIds
}) => {
  const { t } = useTranslation('production');
  const [localAssignments, setLocalAssignments] = useState<DayAssignment[]>(assignments);
  const [hasChanges, setHasChanges] = useState(false);
  
  // Локальные состояния UI
  const [error, setError] = useState<string | null>(null);
  
  // Кастомный инфо-баннер (замена alert) — только кнопка OK
  const [infoDialog, setInfoDialog] = useState<{ visible: boolean; message: string; onOk?: () => void }>({ visible: false, message: '' });
  const openInfo = (message: string, onOk?: () => void) => setInfoDialog({ visible: true, message, onOk });
  const closeInfo = () => {
    const cb = infoDialog.onOk;
    setInfoDialog({ visible: false, message: '' });
    if (cb) cb();
  };
  
  // Получаем текущий язык из i18n
  const { i18n } = useTranslation();
  const currentLanguage = i18n.language || 'en';

  // Локальный выбор цехов в модалке (по умолчанию из пропсов)
  const [selectedWorkshopIds, setSelectedWorkshopIds] = useState<string[]>(selectedWorkShopIds || []);
  const [isWorkshopPickerOpen, setIsWorkshopPickerOpen] = useState(false);
  const [draftWorkshopIds, setDraftWorkshopIds] = useState<string[]>([]);
  const pickerRef = useRef<HTMLDivElement | null>(null);
  const selectAllRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    // Нормализуем к строкам, чтобы совпадали типы при фильтрации
    setSelectedWorkshopIds(Array.isArray(selectedWorkShopIds) ? selectedWorkShopIds.map(String) : []);
  }, [selectedWorkShopIds, isOpen]);

  // Локальное форматирование даты в YYYY-MM-DD без смещения часового пояса
  const toYmdLocal = (d: Date): string => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  // React Query: данные модалки и сохраненные строки + мутация сохранения
  const dateStr = selectedDate ? toYmdLocal(selectedDate) : null;
  const { data: assignData, isFetching: isAssignFetching, error: assignError } = useAssignDataQuery(dateStr as any, selectedWorkshopIds);
  const { data: savedRowsData = [], isFetching: isSavedFetching, error: savedError } = useSavedRowsByDayQuery(dateStr as any, selectedWorkshopIds);
  const { mutateAsync: bulkReplace } = useBulkReplaceMutation();

  // Ошибка загрузки
  useEffect(() => {
    if (assignError || savedError) {
      setError((assignError as any)?.message || (savedError as any)?.message || 'Failed to load data');
    } else {
      setError(null);
    }
  }, [assignError, savedError]);

  // Вычисляем режимы загрузки для отображения
  const hasData = Boolean(assignData) || (Array.isArray(savedRowsData) && (savedRowsData as any[]).length > 0);
  const isInitialLoading = (isAssignFetching || isSavedFetching) && !hasData;
  const isRefreshing = (isAssignFetching || isSavedFetching) && hasData;

  // Сброс при закрытии, при открытии не очищаем чтобы не потерять данные из кэша
  useEffect(() => {
    if (!isOpen) {
      setLocalAssignments([]);
      setHasChanges(false);
      setError(null);
    }
  }, [isOpen]);

  // Закрываем поповер кликом вне
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

  // Опции цехов: используем полный список из родителя, если передан, иначе строим из apiData
  const workshopOptions = useMemo(() => {
    if (allWorkshops && allWorkshops.length > 0) return allWorkshops.map(w => ({ id: String(w.id), name: w.name }));
    if (!assignData) return [] as Array<{ id: string; name: string }>;
    const map = new Map<string, string>();
    (assignData.table1 || []).forEach((item: any) => {
      const id = String(item.WorkShop_CustomWS);
      const name = (currentLanguage === 'zh' ? item.WorkShopName_ZH : item.WorkShopName_EN) || id;
      if (!map.has(id)) map.set(id, name);
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [allWorkshops, assignData, currentLanguage]);

  const workshopButtonLabel = useMemo(() => {
    if (!selectedWorkshopIds || selectedWorkshopIds.length === 0) return (t('chooseWorkshop') as string) || 'Choose workshop';
    if (selectedWorkshopIds.length === 1) {
      const w = workshopOptions.find(w => w.id === selectedWorkshopIds[0]);
      return w?.name || (t('chooseWorkshop') as string) || 'Choose workshop';
    }
    return (t('multiSelect') as string) || 'Multi-select';
  }, [selectedWorkshopIds, workshopOptions, t]);

  const allSelected = workshopOptions.length > 0 && draftWorkshopIds.length === workshopOptions.length;
  const someSelected = draftWorkshopIds.length > 0 && draftWorkshopIds.length < workshopOptions.length;
  useEffect(() => {
    if (selectAllRef.current) selectAllRef.current.indeterminate = someSelected;
  }, [someSelected, isWorkshopPickerOpen, workshopOptions, draftWorkshopIds]);

  // Кэши для быстрых доступов
  const table1Map = useMemo(() => {
    if (!assignData) return new Map<string, any>();
    const m = new Map<string, any>();
    (assignData.table1 || []).forEach((item: any) => {
      const key = `${item.WorkShop_CustomWS}_${item.WorkCenter_CustomWS}`;
      m.set(key, item);
    });
    return m;
  }, [assignData]);

  const uniqueToPair = useMemo(() => {
    if (!assignData) return new Map<string, { workShopId: string; workCenterId: string }>();
    const m = new Map<string, { workShopId: string; workCenterId: string }>();
    (assignData.table1 || []).forEach((item: any) => {
      const uniqueId = `${item.WorkShop_CustomWS}_${item.WorkCenter_CustomWS}`;
      m.set(uniqueId, { workShopId: item.WorkShop_CustomWS, workCenterId: item.WorkCenter_CustomWS });
    });
    return m;
  }, [assignData]);

  // Создаем назначения на основе сохраненных строк (агрегируем в shifts[]) + дополняем РЦ с производством
   useEffect(() => {
    if (!assignData) return;

    const resultMap = new Map<string, DayAssignment>();

    // 1) Группируем сохраненные строки по РЦ
    for (const row of (savedRowsData as any[])) {
      const key = `${row.workShopId}_${row.workCenterId}`;
      const prod = table1Map.get(key);
      const planQty = Number(prod?.Plan_QTY || 0);
      const factQty = Number(prod?.FACT_QTY || 0);
      const planTime = Number(prod?.Plan_TIME || 0);
      const factTime = Number(prod?.FACT_TIME || 0);
      const shiftTime = Number(prod?.Shift_Time || 0);
      const timeLoss = Number(prod?.Time_Loss || 0);

      const existing = resultMap.get(key);
      const newShift: WorkCenterShift = {
        id: String(row.lineId || Date.now().toString() + Math.random().toString(36).substr(2, 9)),
        scheduleId: String(row.scheduleId || ''),
        peopleCount: typeof row.people === 'number' ? row.people : 0,
      };

      if (!existing) {
        const base: DayAssignment = {
          id: key, // агрегированная строка на РЦ
          date: String(row.onlyDate || ''),
          workCenterId: key,
          scheduleId: newShift.scheduleId, // первая смена (для обратной совместимости)
          peopleCount: newShift.peopleCount,
          notes: '',
          production: prod
            ? {
                planQty,
                factQty,
                completionPercentageQty: planQty > 0 ? (factQty / planQty) * 100 : 0,
                planHours: planTime,
                factHours: factTime,
                completionPercentageHours: planTime > 0 ? (factTime / planTime) * 100 : 0,
              }
            : undefined,
          shiftTime,
          timeLoss,
          different: 0,
          shifts: [newShift],
        };
        resultMap.set(key, base);
      } else {
        existing.shifts = [...(existing.shifts || []), newShift];
        // Актуализируем первую смену для совместимости
        existing.scheduleId = existing.shifts[0]?.scheduleId || '';
        existing.peopleCount = existing.shifts[0]?.peopleCount || 0;
      }
    }

    // 2) Добавляем РЦ с производством, которых нет среди сохраненных
    (assignData.table1 || []).forEach((item: any) => {
      const key = `${item.WorkShop_CustomWS}_${item.WorkCenter_CustomWS}`;
      if (resultMap.has(key)) return;
      
      const planQty = Number(item.Plan_QTY) || 0;
      const factQty = Number(item.FACT_QTY) || 0;
      const planTime = Number(item.Plan_TIME) || 0;
      const factTime = Number(item.FACT_TIME) || 0;
      const shiftTime = Number(item.Shift_Time) || 0;
      const timeLoss = Number(item.Time_Loss) || 0;
      
       const hasProductionData = planQty > 0 || factQty > 0 || planTime > 0 || factTime > 0;
      if (!hasProductionData) return;

      const base: DayAssignment = {
        id: key,
        date: selectedDate ? toYmdLocal(selectedDate) : '',
        workCenterId: key,
        scheduleId: '',
        peopleCount: 0,
           notes: '',
           production: {
          planQty,
          factQty,
          completionPercentageQty: planQty > 0 ? (factQty / planQty) * 100 : 0,
             planHours: planTime,
             factHours: factTime,
          completionPercentageHours: planTime > 0 ? (factTime / planTime) * 100 : 0,
        },
        shiftTime,
        timeLoss,
        different: 0,
        shifts: [],
      };
      resultMap.set(key, base);
    });

    setLocalAssignments(Array.from(resultMap.values()));
  }, [assignData, savedRowsData, table1Map, isOpen]);



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
    if (!assignData) return [];
    return transformApiDataToWorkCenters(assignData, currentLanguage as 'en' | 'zh');
  }, [assignData, currentLanguage]);

  // Группировка назначений по цехам
  const workshopGroups = useMemo(() => {
    console.log('🔍 Группируем назначения - localAssignments:', localAssignments);
    console.log('🔍 Группируем назначения - workCenters:', workCenters);
    const groups: Record<string, DayAssignment[]> = {};
         localAssignments.forEach(assignment => {
       const workCenter = workCenters.find(wc => wc.id === assignment.workCenterId);
      const groupKey = workCenter ? workCenter.workshop : (assignment.workshopHint || 'undefined');
      if (!groups[groupKey]) groups[groupKey] = [];
      groups[groupKey].push(assignment);
    });
    console.log('🔍 Результат группировки:', groups);
    return groups;
  }, [localAssignments, workCenters]);

  // Получение уникальных цехов
  const uniqueWorkshops = useMemo(() => {
    if (!assignData) return [];
    const workshops = getUniqueWorkshops(assignData, currentLanguage as 'en' | 'zh');
    // Добавляем группы из подсказок, если есть строки без выбранного РЦ
    localAssignments.forEach(a => {
      if (!a.workCenterId && a.workshopHint && !workshops.includes(a.workshopHint)) {
        workshops.push(a.workshopHint);
      }
    });
    // Добавляем "undefined" группу, если остались строки без подсказки
    if (localAssignments.some(a => !a.workCenterId && !a.workshopHint)) {
      workshops.push('undefined');
    }
    return workshops;
  }, [assignData, currentLanguage, localAssignments]);



  // Добавление нового назначения в конкретный цех
  const handleAddAssignment = (workshop: string) => {
    const newAssignment: DayAssignment = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      date: selectedDate ? toYmdLocal(selectedDate) : '',
      workCenterId: '', // по умолчанию пусто, пользователь обязан выбрать
      scheduleId: '',
      peopleCount: 0,
      notes: '',
      shifts: [],
      workshopHint: workshop,
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
    setLocalAssignments([]); // Очищаем локальные назначения
    onClose();
  };

  // Сохранение изменений
  const handleSave = async () => {
    try {
      // Блокирующая валидация: пустые РЦ и дубликаты по (цех+РЦ)
      if (emptyWorkCenterIds.size > 0) {
        openInfo('Есть строки без выбранного Work Center. Выберите РЦ или удалите строки.');
        return;
      }
      if (invalidAssignmentIds.size > 0) {
        openInfo(t('duplicateWorkCenterError', {
          defaultValue: {
            en: 'Duplicate Work Center found within the same workshop. Select another Work Center or delete the row.',
            zh: '同一车间内发现重复的工作中心。请选择其他工作中心或删除该行。',
            ru: 'Найден дубликат РЦ в рамках одного цеха. Выберите другой РЦ или удалите строку.'
          }[i18n.language] || 'Найден дубликат РЦ в рамках одного цеха. Выберите другой РЦ или удалите строку.'
        }));
        return;
      }

      // Маппинг id РЦ -> цех
      const wcIdToWorkshop = new Map<string, string>();
      workCenters.forEach(wc => wcIdToWorkshop.set(wc.id, wc.workshop));

      const pairs = localAssignments
        .filter(a => !!a.workCenterId)
        .map(a => `${wcIdToWorkshop.get(a.workCenterId) || ''}|||${a.workCenterId}`);
      const hasDuplicatePairs = pairs.length !== new Set(pairs).size;
      if (hasDuplicatePairs) {
        openInfo(t('assignmentValidation.duplicateAssignment'));
        return;
      }

      if (!assignData || !selectedDate) {
        openInfo('Нет данных API/даты для построения payload');
        return;
      }

      // Отбираем назначения, которые имеют содержимое (хотя бы одну выбранную смену или legacy scheduleId)
      const validAssignments = localAssignments.filter(assignment => {
        if (!assignment) return false;
        const hasShiftWithSchedule = (assignment.shifts || []).some(s => s.scheduleId && s.scheduleId.trim() !== '');
        if (hasShiftWithSchedule) return true;
        if (
          assignment.production &&
            (assignment.production.planQty > 0 || 
             assignment.production.factQty > 0 || 
             assignment.production.planHours > 0 || 
            assignment.production.factHours > 0)
        ) {
          return Boolean(assignment.scheduleId);
        }
        return Boolean(assignment.workCenterId && assignment.scheduleId);
      });

      // Строим маппинг uniqueWorkCenterId -> { workShopId, workCenterId }
      const uniqueToPairMap = uniqueToPair;

      // 1) Текущее целевое состояние из UI
      const targetGroups = new Map<string, { workShopId: string; workCenterId: string; lines: Array<{ scheduleId: string; people: number | null }> }>();
      for (const assignment of validAssignments) {
        const pair = uniqueToPairMap.get(assignment.workCenterId);
        if (!pair) continue; // сохраняем только то, что есть в table1
        const key = `${pair.workShopId}|||${pair.workCenterId}`;
        if (!targetGroups.has(key)) {
          targetGroups.set(key, { workShopId: pair.workShopId, workCenterId: pair.workCenterId, lines: [] });
        }
        const linesFromShifts = (assignment.shifts || [])
          .filter(s => s.scheduleId && s.scheduleId.trim() !== '')
          .map(s => ({ scheduleId: String(s.scheduleId), people: Number.isFinite(s.peopleCount as any) ? Number(s.peopleCount) : null }));
        if (linesFromShifts.length > 0) {
          targetGroups.get(key)!.lines.push(...linesFromShifts);
        } else {
          const scheduleId = String(assignment.scheduleId || '');
          if (scheduleId) {
            const people = Number.isFinite((assignment as any).peopleCount) ? Number(assignment.peopleCount) : null;
            targetGroups.get(key)!.lines.push({ scheduleId, people });
          }
        }
      }

      // 2) Базовое состояние из БД (active rows)
      const baselineGroups = new Map<string, { workShopId: string; workCenterId: string; lines: Array<{ scheduleId: string; people: number | null }> }>();
      (Array.isArray(savedRowsData) ? (savedRowsData as any[]) : []).forEach((r: any) => {
        const pairKey = `${r.workShopId}|||${r.workCenterId}`;
        // учитываем только пары, которые есть в table1
        if (!uniqueToPair.has(`${r.workShopId}_${r.workCenterId}`)) return;
        if (!baselineGroups.has(pairKey)) {
          baselineGroups.set(pairKey, { workShopId: String(r.workShopId), workCenterId: String(r.workCenterId), lines: [] });
        }
        baselineGroups.get(pairKey)!.lines.push({ scheduleId: String(r.scheduleId), people: (r.people === null || r.people === undefined) ? null : Number(r.people) });
      });

      // 3) Сравнение и формирование только изменённых групп
      const normalizeLines = (lines: Array<{ scheduleId: string; people: number | null }>) => {
        return (lines || [])
          .map(l => ({ scheduleId: String(l.scheduleId), people: (l.people === null || l.people === undefined) ? null : Number(l.people) }))
          .sort((a, b) => a.scheduleId.localeCompare(b.scheduleId) || ((a.people ?? -1) - (b.people ?? -1)));
      };

      const allKeys = new Set<string>([...Array.from(targetGroups.keys()), ...Array.from(baselineGroups.keys())]);
      const items: Array<{ workShopId: string; workCenterId: string; lines: Array<{ scheduleId: string; people: number | null }> }> = [];

      for (const key of allKeys) {
        // пропускаем пары вне table1
        const [w, c] = key.split('|||');
        if (!uniqueToPairMap.has(`${w}_${c}`)) continue;
        const target = targetGroups.get(key) || { workShopId: w, workCenterId: c, lines: [] };
        const baseline = baselineGroups.get(key) || { workShopId: w, workCenterId: c, lines: [] };
        const tNorm = normalizeLines(target.lines);
        const bNorm = normalizeLines(baseline.lines);
        const equal = tNorm.length === bNorm.length && tNorm.every((l, idx) => l.scheduleId === bNorm[idx].scheduleId && l.people === bNorm[idx].people);
        if (!equal) {
          items.push({ workShopId: w, workCenterId: c, lines: target.lines });
        }
      }

      if (items.length === 0) {
        openInfo('Изменений нет: ничего не было сохранено');
        setHasChanges(false);
        return;
      }

      const payload = { date: toYmdLocal(selectedDate), items };
      console.log('🔍 Отправляем bulk-replace payload (diff only):', JSON.stringify(payload, null, 2));

      const result = await bulkReplace(payload);
      console.log('✅ bulk-replace результат:', result);
      if (Array.isArray(result?.items)) {
        console.log('🔍 items:', result.items);
      }

      // Сводка по сохраненным строкам с деталями из table2
      const scheduleById = new Map<string, any>();
      (assignData?.table2 || []).forEach((s: any) => {
        scheduleById.set(String(s.scheduleId), s);
      });
      const rows: Array<any> = Array.isArray(result?.rows) ? result.rows : [];
      const lines = rows.map((r: any) => {
        const sched = scheduleById.get(String(r.scheduleId));
        const name = sched?.name || sched?.scheduleName || r.scheduleId;
        const start = sched?.workShift?.start || '-';
        const end = sched?.workShift?.end || '-';
        const people = r.people ?? 0;
        return `${r.workShopId} / ${r.workCenterId}: ${name} (${start}-${end}), people: ${people}`;
      });
      const header = t('savedRowsCount', {
        count: result?.processed ?? rows.length,
        defaultValue: {
          en: `Saved rows: ${result?.processed ?? rows.length}`,
          zh: `已保存行数: ${result?.processed ?? rows.length}`,
          ru: `Сохранено строк: ${result?.processed ?? rows.length}`
        }[i18n.language] || `Сохранено строк: ${result?.processed ?? rows.length}`
      });
      const details = lines.slice(0, 10).join('\n');
      const suffix = lines.length > 10 ? `\n...и ещё ${lines.length - 10}` : '';

      // Добавим ошибки по связкам, если есть
      const errors: string[] = (Array.isArray(result?.items) ? result.items : [])
        .filter((it: any) => it?.error)
        .map((it: any) => `${it.workShopId} / ${it.workCenterId}: ${it.error}`);
      const errBlock = errors.length ? `\n\nОшибки:\n${errors.slice(0, 5).join('\n')}${errors.length > 5 ? `\n...и ещё ${errors.length - 5}` : ''}` : '';

      // Показываем сообщение и закрываем модалку только после нажатия OK
      openInfo(`${header}\n\n${details}${suffix}${errBlock}`, () => {
        setHasChanges(false);
      });

    } catch (error) {
      console.error('Ошибка при сохранении назначений:', error);
      openInfo(`Ошибка при сохранении: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`);
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
  const totalPeople = localAssignments.reduce((sum, assignment) => {
    const sumShifts = (assignment.shifts || []).reduce((acc, s) => acc + (s.peopleCount || 0), 0);
    return sum + (sumShifts || assignment.peopleCount || 0);
  }, 0);

  // Получение статистики дня из API данных
  const dayStatistics = useMemo(() => {
    if (!assignData) return null;
    
    // TODO: Replace with real calculation logic
    let totalPlanQty = 0;
    let totalFactQty = 0;
    let totalPlanTime = 0;
    let totalFactTime = 0;
    let totalShiftTime = 0;
    let tasksWithPlan = 0;
    let tasksWithFact = 0;

    if (assignData.table1) {
      assignData.table1.forEach((item: any) => {
        const planQty = parseFloat(item.Plan_QTY) || 0;
        const factQty = parseFloat(item.FACT_QTY) || 0;
        const planTime = parseFloat(item.Plan_TIME) || 0;
        const factTime = parseFloat(item.FACT_TIME) || 0;
        const shiftTime = parseFloat(item.Shift_Time) || 0;

        if (planQty > 0) {
          totalPlanQty += planQty;
          tasksWithPlan++;
        }
        if (factQty > 0) {
          totalFactQty += factQty;
          tasksWithFact++;
        }
        if (planTime > 0) totalPlanTime += planTime;
        if (factTime > 0) totalFactTime += factTime;
        if (shiftTime > 0) totalShiftTime += shiftTime;
      });
    }

    const planCompletionpcs = totalPlanQty > 0 ? (totalFactQty / totalPlanQty) * 100 : 0;
    const planCompletionh = totalPlanTime > 0 ? (totalFactTime / totalPlanTime) * 100 : 0;
    const efficiency = totalShiftTime > 0 ? (totalFactTime / totalShiftTime) * 100 : 0;

    return {
      planCompletionpcs: Math.round(planCompletionpcs * 100) / 100,
      planCompletionh: Math.round(planCompletionh * 100) / 100,
      efficiency: Math.round(efficiency * 100) / 100,
      totalTasks: tasksWithPlan,
      completedTasks: tasksWithFact,
      totalPlanQty: Math.round(totalPlanQty),
      totalFactQty: Math.round(totalFactQty)
    };
  }, [assignData]);

  // Создание workSchedules из table2
  const workSchedules = useMemo(() => {
    if (!assignData) return [];
    return transformTable2ToWorkSchedules(assignData);
  }, [assignData]);

  // Маппинг id РЦ -> цех для валидации
  const wcIdToWorkshop = useMemo(() => {
    const map = new Map<string, string>();
    workCenters.forEach(wc => map.set(wc.id, wc.workshop));
    return map;
  }, [workCenters]);

  // Подсветка ошибок: пустой РЦ и дубли (цех+РЦ)
  const emptyWorkCenterIds = useMemo(() => {
    return new Set(localAssignments.filter(a => !a.workCenterId).map(a => a.id));
  }, [localAssignments]);

  const invalidAssignmentIds = useMemo(() => {
    const seen = new Set<string>();
    const dupes = new Set<string>();
    localAssignments.forEach(a => {
      if (!a.workCenterId) return;
      const pair = `${wcIdToWorkshop.get(a.workCenterId) || ''}|||${a.workCenterId}`;
      if (seen.has(pair)) {
        dupes.add(a.id);
      } else {
        seen.add(pair);
      }
    });
    return dupes;
  }, [localAssignments, wcIdToWorkshop]);

  // Обновления выполняются через инвалидации React Query; внешний слушатель не требуется

  if (!isOpen || !selectedDate) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 transition-opacity duration-200">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-[1400px] max-h-[90vh] flex flex-col relative transform transition-all duration-200 ease-out">
        {/* Кастомный инфо-баннер */}
        {infoDialog.visible && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="bg-white border border-gray-300 shadow-2xl rounded px-5 py-4 w-[640px] min-h-[120px] flex flex-col justify-center">
              <div className="text-gray-800 text-sm whitespace-pre-line">{infoDialog.message}</div>
              <div className="mt-4 flex justify-end">
                <button
                  className="px-4 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700"
                  onClick={closeInfo}
                >
                  OK
                </button>
              </div>
            </div>
          </div>
        )}
        {/* Заголовок */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex flex-col">
            <h2 className="text-2xl font-bold text-gray-900">
              {t('assignWorkSchedules')}
            </h2>
            <div className="mt-1 flex items-center">
              <p className="text-gray-600">
                {formatDate(selectedDate)}
              </p>
              {isRefreshing && (
                <span className="ml-3 text-xs text-gray-400">Updating…</span>
              )}
              {/* Селектор цехов справа от даты */}
              <div className="ml-4 relative" ref={pickerRef}>
                <div className="flex items-center space-x-2">
                  <Factory className="w-5 h-5 text-gray-600" />
                  <button
                    type="button"
                    onClick={() => { setDraftWorkshopIds(selectedWorkshopIds); setIsWorkshopPickerOpen(v => !v); }}
                    className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
                    title={(t('workshops') as string) || 'Workshops'}
                  >
                    {workshopButtonLabel}
                  </button>
                </div>
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
                              setDraftWorkshopIds(workshopOptions.map(w => w.id));
                            }
                          }}
                        />
                        <span>{(t('selectAll') as string) || 'Select All'}</span>
                      </label>
                      {/* Items */}
                      {workshopOptions.map(w => (
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
                      {workshopOptions.length === 0 && (
                        <div className="text-xs text-gray-500">{(t('loading') as string) || 'Loading...'}</div>
                      )}
                    </div>
                    <div className="px-3 py-2 border-t border-gray-200 flex justify-end space-x-2 bg-gray-50 rounded-b-lg">
                      <button className="px-3 py-1 text-sm rounded bg-gray-100 hover:bg-gray-200" onClick={() => setIsWorkshopPickerOpen(false)}>
                        {t('cancel')}
                      </button>
                      <button
                        className="px-3 py-1 text-sm rounded bg-blue-600 text-white hover:bg-blue-700"
                        onClick={() => {
                          setSelectedWorkshopIds(draftWorkshopIds);
                          setIsWorkshopPickerOpen(false);
                          // двусторонняя синхронизация с основным компонентом
                          onChangeSelectedWorkShopIds && onChangeSelectedWorkShopIds(draftWorkshopIds);
                        }}
                      >
                        OK
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={() => {
              // Закрываем без ручной очистки; очистка выполнится эффектом при смене isOpen
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
        <div className={`${isRefreshing ? 'opacity-60 transition-opacity duration-200' : 'opacity-100 transition-opacity duration-200'}`}>
        <DayStatisticsPanel
          statistics={dayStatistics}
          assignmentsCount={localAssignments.length}
          totalPeople={totalPeople}
        />
        </div>

        {/* Содержимое */}
        <div className={`p-6 overflow-y-auto flex-1 ${isRefreshing ? 'opacity-60 transition-opacity duration-200' : 'opacity-100 transition-opacity duration-200'}`}>
          <div className="space-y-6">
            {/* Отображаем группы цехов */}
            {isInitialLoading ? (
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
                  invalidAssignmentIds={invalidAssignmentIds}
                  emptyWorkCenterIds={emptyWorkCenterIds}
                />
              ))
            )}
          </div>
        </div>

        {/* Кнопки действий */}
        <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-200 bg-white">
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
