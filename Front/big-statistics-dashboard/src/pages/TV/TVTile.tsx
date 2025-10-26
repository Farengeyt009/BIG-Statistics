// src/pages/TV/TVTile.tsx
import React, { useState, useEffect, useCallback, useMemo, useRef, forwardRef, useImperativeHandle } from 'react';

import { MetricCard } from '../../components/KPICards';
import { TVTrendChart } from './components/TVTrendChart';
import { SimpleTable } from './components/SimpleTable';
import { DateRangePickerPro } from '../../components/DatePicker';
import { useTranslation } from 'react-i18next';
import { TVProvider } from './TVContext';
import { useAutoDashboard } from './components/AutoDashboard';
import { Factory } from 'lucide-react';
import { API_ENDPOINTS } from '../../config/api';
import { WorkCenterSelector } from './components/WorkCenterSelector';
import mockLogoGray from '../../assets/Mok-logo-gray.png';

type TvRuntimeStatus = 'Working' | 'Downtime' | 'Break' | 'Finished' | null;

interface TVProps {
  tileId?: 'Tv1' | 'Tv2' | 'Tv3' | 'Tv4';
  isExpanded?: boolean;
  onStatusChange?: (status: TvRuntimeStatus) => void;
}

export interface TVTileRef {
  refresh: () => void;
}

const TV = forwardRef<TVTileRef, TVProps>(({ tileId, isExpanded, onStatusChange }, ref) => {
  const { t, i18n } = useTranslation('tv');
  const { isAutoMode } = useAutoDashboard();
  const onStatusChangeRef = useRef<typeof onStatusChange | null>(onStatusChange);
  useEffect(() => { onStatusChangeRef.current = onStatusChange || null; }, [onStatusChange]);

  // Формат YYYY-MM-DD в локальном часовом поясе без UTC-смещений
  const formatYMD = useCallback((d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
  }, []);

  /** -------------------- состояния -------------------- */
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [tvData, setTvData] = useState<any>({});
  const [hourlyData, setHourlyData] = useState<any[]>([]);
  const [kpi, setKpi] = useState<any>(null);
  const [schedule, setSchedule] = useState<any>(null);
  const [orderRows, setOrderRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true); // Флаг первой загрузки
  const hasLoadedOnce = useRef(false); // Флаг завершения первой загрузки
  const [hoveredWorkShop, setHoveredWorkShop] = useState<{workShop: string, workCenter: string} | null>(null);
  const [defaultWorkShop, setDefaultWorkShop] = useState<{workShop: string, workCenter: string} | null>(null);
  const [selectedWorkCenter, setSelectedWorkCenter] = useState<string>('');
  const [workshopsRaw, setWorkshopsRaw] = useState<any[]>([]);
  const [noData, setNoData] = useState(false); // Изначально не показываем МОК
  const reqRef = useRef(0);
  const isLoadingRef = useRef(false); // Флаг загрузки для предотвращения дублирования
  const [downtime, setDowntime] = useState<{ minutes: number; gaps: number; status: string } | null>(null);



  /** -------------------- загрузка списка цехов для селектора -------------------- */
  useEffect(() => {
    const fetchWorkshops = async () => {
      try {
        const res = await fetch(API_ENDPOINTS.TV.WORKSHOPS, { method: 'GET' });
        const json = await res.json();
        const items: any[] = Array.isArray(json?.data) ? json.data : [];
        
        // Определяем рабочий центр по умолчанию ДО установки состояния
        let defaultWorkCenterId = '';
        
        if (!selectedWorkCenter && items.length > 0) {
          if (tileId) {
            // Ищем рабочий центр по умолчанию в зависимости от tileId
            const defaultWorkCenter = items.find(item => {
              const workCenterId = item.WorkCenter_CustomWS || '';
              
              switch (tileId) {
                case 'Tv1':
                  return workCenterId === '组装A线';
                case 'Tv2':
                  return workCenterId === '组装B线';
                case 'Tv3':
                  return workCenterId === '组装C线';
                case 'Tv4':
                  return workCenterId === '热水器总装组';
                default:
                  return false;
              }
            });
            
            if (defaultWorkCenter) {
              defaultWorkCenterId = defaultWorkCenter.WorkCenter_CustomWS || '';
            }
          }
          
          // Если не нашли нужный рабочий центр, берем первый
          if (!defaultWorkCenterId && items.length > 0) {
            defaultWorkCenterId = items[0]?.WorkCenter_CustomWS || '';
          }
        }
        
        // Устанавливаем оба состояния одновременно, чтобы избежать двойного ре-рендера
        setWorkshopsRaw(items);
        if (defaultWorkCenterId) {
          setSelectedWorkCenter(defaultWorkCenterId);
        }
      } catch (e) {
        console.error('Failed to load TV workshops:', e);
        setInitialLoading(false); // Убираем загрузку даже при ошибке
      }
    };
    fetchWorkshops();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** -------------------- группировка РЦ по цехам -------------------- */
  const workshopsGrouped = useMemo(() => {
    const workshopMap = new Map<string, {
      id: string;
      name: string;
      workCenters: Array<{
        id: string;
        name: string;
        workshopId: string;
        workshopName: string;
      }>;
    }>();

    for (const item of workshopsRaw) {
      const workshopId = item.WorkShop_CustomWS as string;
      const workCenterId = item.WorkCenter_CustomWS as string;
      
      if (!workshopId || !workCenterId) continue;

      const workshopName = i18n.language === 'zh' 
        ? (item.WorkShopName_ZH || item.WorkShopName_EN)
        : (item.WorkShopName_EN || item.WorkShopName_ZH);
      
      const workCenterName = i18n.language === 'zh'
        ? (item.WorkCenterName_ZH || item.WorkCenterName_EN)
        : (item.WorkCenterName_EN || item.WorkCenterName_ZH);

      if (!workshopMap.has(workshopId)) {
        workshopMap.set(workshopId, {
          id: workshopId,
          name: workshopName || workshopId,
          workCenters: []
        });
      }

      const workshop = workshopMap.get(workshopId)!;
      const existingWorkCenter = workshop.workCenters.find(wc => wc.id === workCenterId);
      
      if (!existingWorkCenter) {
        workshop.workCenters.push({
          id: workCenterId,
          name: workCenterName || workCenterId,
          workshopId: workshopId,
          workshopName: workshopName || workshopId
        });
      }
    }

    return Array.from(workshopMap.values());
  }, [workshopsRaw, i18n.language]);

  /** -------------------- отображаемые названия с учётом языка (для обратной совместимости) -------------------- */
  const workCenterOptions = useMemo(() => {
    // Уникальный список по WorkCenter_CustomWS
    const map = new Map<string, { id: string; name: string }>();
    for (const it of workshopsRaw) {
      const id = it.WorkCenter_CustomWS as string;
      if (!id) continue;
      const name = i18n.language === 'zh' ? (it.WorkCenterName_ZH || it.WorkCenterName_EN)
                                          : (it.WorkCenterName_EN || it.WorkCenterName_ZH);
      if (!map.has(id)) map.set(id, { id, name: name || String(id) });
    }
    return Array.from(map.values());
  }, [workshopsRaw, i18n.language]);

  /** -------------------- обработка данных из table4 totals -------------------- */
  const processTable4Data = useCallback((table4Data: any) => {
    if (!table4Data) return [];
    
    // Проверяем есть ли totals в table4
    const hasTotals = table4Data && typeof table4Data === 'object' && 'totals' in table4Data;
    
    // Используем totals часть для сгруппированных данных
    if (hasTotals && Array.isArray(table4Data.totals)) {
      const processedData = table4Data.totals.map((item: any) => {
        const planQty = parseFloat(item.TOTAL_Plan_QTY) || 0;
        const factQty = parseFloat(item.TOTAL_FACT_QTY) || 0;
        const completed = planQty > 0 ? Math.round((factQty / planQty) * 100) : 0;
        
        return {
          workShop: item.WorkShopName_CH || '',
          workCenter: item.WorkCentor_CN || '',
          planQty: planQty,
          factQty: factQty,
          completed: `${completed}%`
        };
      });
      
      // Устанавливаем первую строку как дефолтную, если она еще не установлена
      if (processedData.length > 0 && !defaultWorkShop) {
        setDefaultWorkShop({
          workShop: processedData[0].workShop,
          workCenter: processedData[0].workCenter
        });
      }
      
      return processedData;
    }
    
    return [];
  }, [defaultWorkShop]);

  /** -------------------- обработка данных из table4 details -------------------- */
  const processTable4Details = useCallback((table4Data: any, selectedWorkShop: {workShop: string, workCenter: string} | null = null) => {
    if (!table4Data) return [];
    
    // Проверяем есть ли details в table4
    const hasDetails = table4Data && typeof table4Data === 'object' && 'details' in table4Data;
    
    // Используем details часть для детальных данных
    if (hasDetails && Array.isArray(table4Data.details)) {
      let filteredDetails = table4Data.details;
      
      // Фильтруем по выбранному WorkShop и WorkCenter
      if (selectedWorkShop) {
        filteredDetails = table4Data.details.filter((item: any) => {
          return item.WorkShopName_CH === selectedWorkShop.workShop && 
                 item.WorkCentor_CN === selectedWorkShop.workCenter;
        });
      }
      
      return filteredDetails.map((item: any) => {
        const planQty = parseFloat(item.Plan_QTY) || 0;
        const factQty = parseFloat(item.FACT_QTY) || 0;
        const completed = planQty > 0 ? Math.round((factQty / planQty) * 100) : 0;
        
        return {
          orderNo: item.OrderNumber || '',
          articleNumber: item.NomenclatureNumber || '',
          name: item.GroupName || '',
          plan: planQty,
          fact: factQty,
          completed: `${completed}%`
        };
      });
    }
    
    return [];
  }, [workshopsRaw, selectedWorkCenter]);

  /** -------------------- вычисление ID рабочего центра для фильтрации -------------------- */
  const getFilterWorkCenterId = useCallback(() => selectedWorkCenter, [selectedWorkCenter]);

  /** -------------------- API‑запросы -------------------- */
  const fetchTVData = useCallback(async (date: Date | null, silent: boolean = false) => {
    if (!date || !selectedWorkCenter) return;
    
    // Предотвращаем множественные одновременные запросы
    if (isLoadingRef.current) {
      console.log('⏭️ Skipping fetch - already loading');
      return;
    }

    const myReq = ++reqRef.current;
    isLoadingRef.current = true;
    
    if (!silent) {
      setLoading(true);
      setNoData(false); // Сбрасываем флаг только при обычной загрузке
    }
    // При silent обновлении НЕ сбрасываем noData, чтобы избежать мерцания
    
    console.log(`📡 Fetching TV data (silent: ${silent}, tileId: ${tileId || 'unknown'})`);
    
    try {


      // 2) реальные данные для графика HourlyPlanFact
      const day = formatYMD(date);

      // Найдем запись выбранного РЦ
      const selectedWorkshopData = workshopsRaw.find(w => w.WorkCenter_CustomWS === selectedWorkCenter);
      // Отправляем в API идентификаторы (ID), а не имена
      const workshopId = selectedWorkshopData?.WorkShop_CustomWS || '';
      const workcenterId = selectedWorkshopData?.WorkCenter_CustomWS || '';

      const cacheBust = `&_ts=${Date.now()}`;
      const url =
        `${API_ENDPOINTS.TV.HOURLY_PLANFACT}?date=${encodeURIComponent(day)}` +
        `&workshop_id=${encodeURIComponent(workshopId)}` +
        `&workcenter_id=${encodeURIComponent(workcenterId)}` +
        cacheBust;
      const finalUrl = `${API_ENDPOINTS.TV.FINAL}?date=${encodeURIComponent(day)}${cacheBust}`;

      const [res1, res2] = await Promise.all([
        fetch(url, { cache: 'no-store' }),
        fetch(finalUrl, { cache: 'no-store' })
      ]);
      const [json1, json2] = await Promise.all([res1.json(), res2.json()]);

      if (reqRef.current !== myReq) return; // устаревший ответ — игнорируем

      const hourly = Array.isArray(json1?.hourly)
        ? json1.hourly
        : (Array.isArray(json1?.data) ? json1.data : []);
      setHourlyData(hourly);
      setKpi(json1?.kpi || null);
      setSchedule(json1?.schedule || null);

      const finalArr = Array.isArray(json2?.data) ? json2.data : [];
      setOrderRows(finalArr);

      // Проверяем наличие данных для выбранного рабочего центра
      const hasKpiData = json1?.kpi && Object.keys(json1.kpi).length > 0 && 
        (Number(json1.kpi.compl_pct) > 0 || Number(json1.kpi.left_qty) > 0 || Number(json1.kpi.people) > 0 ||
         Number(json1.kpi.fact_total) > 0 || Number(json1.kpi.plan_total) > 0);
      
      // Проверяем почасовые данные для выбранного РЦ
      const hasHourlyDataForSelectedWC = hourly.some((item: any) => 
        String(item.WorkCenterID || item.IDWorkCenter || '') === String(selectedWorkCenter) &&
        (item.FACT_QTY || item.Plan_QTY || item.FACT_TIME || item.Plan_TIME)
      );
      
      // Проверяем данные заказов для выбранного РЦ
      const hasOrderDataForSelectedWC = finalArr.some((item: any) => 
        String(item.WorkCenterID || item.IDWorkCenter || '') === String(selectedWorkCenter) &&
        (item['Total Plan'] || item.TotalPlan || item['Plan'] || item.Plan || item['Fact'] || item.Fact)
      );
      
      // Если нет данных для выбранного РЦ, устанавливаем флаг
      const shouldShowNoData = !hasKpiData && !hasHourlyDataForSelectedWC && !hasOrderDataForSelectedWC;
      
      // При silent обновлении обновляем noData только если состояние изменилось
      // Это предотвращает мерцание: noData=true → false → true
      if (!silent || shouldShowNoData !== noData) {
        setNoData(shouldShowNoData);
      }
      
      

      // Сбрасываем состояния при загрузке новых данных
      setHoveredWorkShop(null);
      setDefaultWorkShop(null);
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        console.error('Ошибка загрузки данных:', err);
        // При silent обновлении не показываем МОК при ошибке (избегаем мерцания)
        if (!silent) {
          setNoData(true);
        }
      }
    } finally {
      if (reqRef.current === myReq) {
        isLoadingRef.current = false; // Сбрасываем флаг загрузки
        
        if (!silent) {
          setLoading(false);
        }
        // Сбрасываем флаг первой загрузки только после завершения первого запроса
        if (!hasLoadedOnce.current) {
          hasLoadedOnce.current = true;
          setInitialLoading(false);
        }
        
        console.log(`✅ TV data fetched successfully (tileId: ${tileId || 'unknown'})`);
      }
    }
  }, [workshopsRaw, selectedWorkCenter]);

  /** -------------------- подгружаем при смене даты -------------------- */
  useEffect(() => {
    if (!selectedDate || !selectedWorkCenter) {
      // Не показываем МОК при инициализации, только после первой загрузки
      if (!initialLoading) {
        setNoData(true);
      }
      return;
    }
    
    console.log('📅 Date or WorkCenter changed, fetching data...', { selectedDate, selectedWorkCenter });
    fetchTVData(selectedDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, selectedWorkCenter]); // Убрали fetchTVData и initialLoading из зависимостей

  /** -------------------- загрузка статуса простоя РЦ для окраски рамки плитки -------------------- */
  const loadDowntimeStatus = useCallback(async () => {
    if (!selectedDate || !selectedWorkCenter) {
      onStatusChangeRef.current && onStatusChangeRef.current(null);
      setDowntime(null);
      return;
    }
    try {
      const day = formatYMD(selectedDate);
      const res = await fetch(`${API_ENDPOINTS.TV.WORKCENTER_DOWNTIME_DAY}?date=${encodeURIComponent(day)}&_ts=${Date.now()}`, { cache: 'no-store' });
      const json = await res.json();
      const arr: any[] = Array.isArray(json?.data) ? json.data : [];
      const row = arr.find((it) => String(it.WorkCenter_CN) === String(selectedWorkCenter));
      const status: TvRuntimeStatus = row?.CurrentStatus ?? null;
      onStatusChangeRef.current && onStatusChangeRef.current(status);
      setDowntime(row ? {
        minutes: Number(row.DowntimeMinutes || 0),
        gaps: Number(row.GapsCount || 0),
        status: String(row.CurrentStatus || '')
      } : null);
    } catch (e) {
      onStatusChangeRef.current && onStatusChangeRef.current(null);
      setDowntime(null);
    }
  }, [selectedDate, selectedWorkCenter]);

  useEffect(() => {
    loadDowntimeStatus();
  }, [loadDowntimeStatus]);

  /** -------------------- Expose refresh method через ref -------------------- */
  useImperativeHandle(ref, () => ({
    refresh: () => {
      console.log(`🔄 [TVTile ${tileId}] Refresh method called`);
      if (selectedDate) {
        console.log(`📡 [TVTile ${tileId}] Fetching data (silent mode)`);
        fetchTVData(selectedDate, true); // silent = true для тихого обновления
        loadDowntimeStatus();
      } else {
        console.warn(`⚠️ [TVTile ${tileId}] No selectedDate, skipping refresh`);
      }
    }
  }), []); // Пустой массив - используем актуальные значения из замыкания

     /** -------------------- верстка -------------------- */
   
       // Отладочная информация удалена
   
  // Подготавливаем данные для контекста
  const workShopRows = processTable4Data(tvData.table4);
  
  // KPI метки
  const kpiLabels = [
    'Daily Plan Compl.%',
    'Uncompleted QTY',
    'Downtime',
    'Next break',
    'End of Work Time',
    'People'
  ];
  
  // Переводы KPI ярлыков
  const translateKpiLabel = (label: string): string => {
    switch (label) {
      case 'Daily Plan Compl.%':
        return t('kpi.dailyPlanCompl', { defaultValue: label });
      case 'Uncompleted QTY':
        return t('kpi.uncompletedQty', { defaultValue: label });
      case 'Downtime':
        return t('kpi.downtime', { defaultValue: 'Downtime' });
      case 'Next break':
        return t('kpi.nextBreak', { defaultValue: label });
      case 'End of Work Time':
        return t('kpi.endOfWorkTime', { defaultValue: label });
      case 'People':
        return t('kpi.people', { defaultValue: label });
      default:
        return label;
    }
  };
 
  return (
    <TVProvider value={{
      fetchTVData,
      setHoveredWorkShop,
      workShopRows,
      selectedDate,
      tvData
    }}>
      <div className="container">
          {/* Индикатор загрузки при первой загрузке или обычной загрузке */}
          {(initialLoading || loading) && (
            <div className="flex items-center justify-center min-h-[60vh]">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          )}

          {/* KPI‑карточки и селекторы - показываем только если не загружается */}
          {!initialLoading && !loading && (
            <section className="flex flex-wrap items-end gap-6 mb-6 mt-4">
              {/* Карточки: растягиваем пространство с помощью flex-1 */}
              <div className="grid flex-1 gap-6 [grid-template-columns:repeat(auto-fit,minmax(12.5rem,max-content))]">
                {/* Показываем KPI карточки только если есть данные */}
                {!noData && kpiLabels.map((label) => {
            // 1) Daily Plan Compl.%
            if (label === 'Daily Plan Compl.%') {
              const complPct = Number(kpi?.compl_pct ?? 0);
              const complement = Math.max(0, 100 - complPct);
              
              // Новая логика цветовой индикации
              let badgeColor: 'green' | 'orange' | 'red' = 'green';
              if (complement <= 5) {
                badgeColor = 'green';
              } else if (complement > 5 && complement <= 25) {
                badgeColor = 'orange';
              } else {
                badgeColor = 'red';
              }
              
              return (
                <MetricCard
                  key={label}
                  label={translateKpiLabel(label)}
                  value={`${complPct}%`}
                  changePercent={complement}
                  isPositiveMetric={true}
                  badgeColor={badgeColor}
                  forceArrowDown={true}
                />
              );
            }

            // 2) Downtime
            if (label === 'Downtime') {
              const minutes = downtime?.minutes ?? 0;
              const gaps = downtime?.gaps ?? 0;
              const statusNow = downtime?.status ?? '';
              let color: 'green' | 'orange' | 'red' = 'green';
              if (gaps === 0) color = 'green';
              else if (gaps >= 1 && gaps <= 3) color = 'orange';
              else if (gaps > 3) color = 'red';

              return (
                <MetricCard
                  key={label}
                  label={translateKpiLabel(label)}
                  value={`${minutes.toLocaleString('ru-RU')}`}
                  changePercent={gaps}
                  hideArrows={false}
                  forceArrowUp={statusNow === 'Downtime'}
                  forceDash={statusNow !== 'Downtime'}
                  badgeIsNumber={true}
                  badgeColor={color}
                  useRussianSeparator={true}
                />
              );
            }

            // 3) Uncompleted QTY (сдвинулось после добавления Downtime)
            if (label === 'Uncompleted QTY') {
              const uncompleted = Number(kpi?.left_qty ?? 0);
              const produced = Number(kpi?.fact_total ?? 0);
              const complPct = Number(kpi?.compl_pct ?? 0);
              const complement = Math.max(0, 100 - complPct);
              
              // Та же логика цветовой индикации, что и для Daily Plan Compl.%
              let badgeColor: 'green' | 'orange' | 'red' = 'green';
              if (complement <= 5) {
                badgeColor = 'green';
              } else if (complement > 5 && complement <= 25) {
                badgeColor = 'orange';
              } else {
                badgeColor = 'red';
              }
              
              return (
                <MetricCard
                  key={label}
                  label={translateKpiLabel(label)}
                  value={`${uncompleted.toLocaleString('ru-RU')}`}
                  changePercent={produced}
                  hideArrows={false}
                  forceArrowUp={true}
                  isPositiveMetric={true}
                  badgeColor={badgeColor}
                  useRussianSeparator={true}
                  badgeIsNumber={true}
                />
              );
            }

            // 3) Next break
            if (label === 'Next break') {
              const nb = schedule?.next_break || { status: 'none', from: '', to: '', dur_min: 0, remain_min: 0 };
              let valueStr = '';
              let minutesValue = 0;
              let arrowDown = false;
              let badgeColor: 'green' | 'orange' | 'red' = 'green';

              if (nb.status === 'ongoing') {
                valueStr = nb.from || '';
                minutesValue = Math.max(0, Number(nb.remain_min || 0));
                arrowDown = true;
                badgeColor = minutesValue <= 2 ? 'red' : 'orange';
              } else if (nb.status === 'upcoming') {
                valueStr = nb.from || '';
                minutesValue = Math.max(0, Number(nb.dur_min || 0));
                arrowDown = false;
                badgeColor = 'green';
              } else {
                valueStr = '-';
                minutesValue = 0;
                arrowDown = false;
              }

              return (
                <MetricCard
                  key={label}
                  label={t('kpi.nextBreak', { defaultValue: 'Next break' })}
                  value={valueStr}
                  changePercent={minutesValue}
                  hideArrows={false}
                  forceArrowDown={arrowDown}
                  forceDash={nb.status === 'upcoming' || (!arrowDown && !minutesValue)}
                  badgeIsNumber={true}
                  badgeSuffix={` ${t('units.min', { defaultValue: 'мин.' })}`}
                  badgeColor={badgeColor}
                  useRussianSeparator={true}
                />
              );
            }

            // 4) End of Work Time
            if (label === 'End of Work Time') {
              const end = schedule?.end_of_work || '';      // ВСЕГДА показываем время
              const endRemainMin = Math.max(0, schedule?.end_remain_min ?? 0);
              const remainingHours = Math.max(0, Math.ceil(endRemainMin / 60));

              // определяем started как раньше: стрелка вниз при начавшейся или завершённой смене
              const parse = (hhmm: string) => {
                const [h,m] = (hhmm||'').split(':').map(Number);
                return (isFinite(h)&&isFinite(m)) ? h*60+m : null;
              };
              const startM = parse(schedule?.first_start || '');
              const now = new Date(); const nowM = now.getHours()*60 + now.getMinutes();
              const started = startM != null ? (nowM >= startM) : false;

              // цвет бейджа по доле остатка как было
              const durationMin = (() => {
                const s = parse(schedule?.first_start || '');
                const e = parse(schedule?.end_of_work || '');
                return (s!=null && e!=null) ? Math.max(0, e - s) : 0;
              })();
              const remainPct = durationMin > 0 ? (endRemainMin / durationMin) * 100 : 0;
              let badgeColor: 'green' | 'orange' | 'red' = 'green';
              if (remainPct <= 10) badgeColor = 'red';
              else if (remainPct <= 50) badgeColor = 'orange';

              return (
                <MetricCard
                  key={label}
                  label={t('kpi.endOfWorkTime', { defaultValue: 'End of Work Time' })}
                  value={end}                                // ← время всегда видно
                  changePercent={remainingHours}             // 0 часов, если прошло
                  hideArrows={false}
                  forceArrowDown={started}
                  forceDash={!started}
                  badgeIsNumber={true}
                  badgeSuffix={` ${t('units.hours', { defaultValue: 'часов' })}`}
                  badgeColor={badgeColor}
                  useRussianSeparator={true}
                />
              );
            }

            // 5) People
            if (label === 'People' && kpi) {
              return (
                <MetricCard
                  key={label}
                  label={t('kpi.people', { defaultValue: 'People' })}
                  value={`${Number(kpi?.people ?? 0).toLocaleString('ru-RU')}`}
                  changePercent={0}
                  hideBadge={true}
                  hideArrows={true}
                />
              );
            }

            // Для остальных карточек используем статические данные
            return (
              <MetricCard
                key={label}
                label={translateKpiLabel(label)}
                value="0"
                changePercent={0}
                isPositiveMetric={true}
                hideBadge={label === 'People'}
                hideArrows={label === 'People'}
              />
            );
          })}
        </div>
        <div className="ml-auto flex flex-col gap-2 items-end w-[260px]">
          <label className="sr-only">Work Center</label>
          <WorkCenterSelector
            workshops={workshopsGrouped}
            selectedWorkCenter={selectedWorkCenter}
            onWorkCenterChange={setSelectedWorkCenter}
          />
          <div className="w-full interactive-element" onClick={(e) => e.stopPropagation()}>
            <DateRangePickerPro
              mode="single"
              startDate={selectedDate}
              onApply={(date) => setSelectedDate(date)}
              placeholder=""
              locale="en"
              position="right"
            />
          </div>
        </div>
      </section>
          )}

          {/* Показываем МОК фото когда нет данных (после первой загрузки) */}
          {!initialLoading && !loading && noData && (
            <div className="flex items-center justify-center min-h-[60vh] w-full">
              <img 
                src={mockLogoGray} 
                alt="No Data Available" 
                className="max-w-md max-h-96 object-contain opacity-60"
              />
            </div>
          )}

          {/* Показываем график и таблицу только если есть данные */}
          {!initialLoading && !noData && !loading && (
            <>
             {/* График план/факт */}
      <div className="mb-4">
        <TVTrendChart
          productionData={tvData.table1 || []}
          hourlyData={hourlyData}
          filterWorkCenterId={getFilterWorkCenterId()}
        />
      </div>

      {/* ──────────────── разделительная линия ──────────────── */}
      <hr className="border-t border-gray-200 -mx-6 mb-2" />

      {/* Простая таблица: добавлена тонкая колонка "/" между Plan и Fact */}
      <section className="pt-2 w-full flex justify-end">
        <SimpleTable
          isExpanded={isExpanded}
          cols={[
            t('tableHeaders.timeSlot', { defaultValue: 'Time Slot' }),
            t('tableHeaders.orderNo', { defaultValue: 'Order No' }),
            t('tableHeaders.articleNumber', { defaultValue: 'Article Number' }),
            t('tableHeaders.name', { defaultValue: 'Name' }),
            t('tableHeaders.totalPlan', { defaultValue: 'Total Plan' }),
            t('tableHeaders.plan', { defaultValue: 'Plan' }),
            '/',
            t('tableHeaders.fact', { defaultValue: 'Fact' }),
            t('tableHeaders.compl', { defaultValue: 'Compl.' }),
            t('tableHeaders.different', { defaultValue: 'Different' }),
            t('tableHeaders.taktTime', { defaultValue: 'Takt time' }),
            t('tableHeaders.lqcQty', { defaultValue: 'Lqc Qty' }),
            t('tableHeaders.lqcPct', { defaultValue: 'Lqc %' }),
          ]}
          rows={(orderRows || [])
            .filter((r: any) => !selectedWorkCenter || String(r.WorkCenterID || r.IDWorkCenter || '') === String(selectedWorkCenter))
            .map((r: any) => {
              // Time Slot уже в формате "HH:MM-HH:MM"
              const timeSlot = r.TimeSlot || '';
              const totalPlan = Math.round(Number(r['Total Plan'] ?? r.TotalPlan ?? r.Total_Plan ?? 0));
              const plan = Math.round(Number(r['Plan'] ?? r.Plan ?? 0));
              const fact = Math.round(Number(r['Fact'] ?? r.Fact ?? 0));
              const compl = totalPlan > 0 ? Math.round((fact / totalPlan) * 100) : 0;
              const different = fact - plan;
              const planTakt = Math.round(Number(r.TaktPlanSec ?? r.PlanTakt_Sec ?? 0));
              const factTakt = Math.round(Number(r.TaktFactSec ?? r.FactTakt_Sec ?? 0));
              const takt = `${planTakt}/${factTakt}`;
              return [
                timeSlot,
                r['Order No'] ?? r.OrderNumber ?? '',
                r['Article Number'] ?? r.NomenclatureNumber ?? '',
                r['Name'] ?? r.DisplayName ?? '',
                totalPlan,
                plan,
                '',
                fact,
                `${compl}%`,
                different,
                takt,
                '',
                '',
              ];
            })}
        />
      </section>
            </>
          )}
      </div>
    </TVProvider>
  );
});

TV.displayName = 'TV';

export default TV;
