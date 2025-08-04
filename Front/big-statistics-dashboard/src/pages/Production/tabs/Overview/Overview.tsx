import React, { useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { DataTableCustomColumn } from '../../../../components/DataTableCustomColumn/DataTableCustomColumn';
import ProgressCell from '../../../../components/DataTableCustomColumn/ProgressCell';
import { ChevronRight, ChevronDown } from "lucide-react";
import { DateRangePicker } from '../../../../components/DatePicker';
import productionTranslations from '../../ProductionTranslation.json';

// Универсальный рендерер иерархических ячеек (точно как в Plan)
function renderHierarchyCell(level: number, isOpen: boolean, label: string, onClick?: () => void, hideChevron?: boolean) {
  const paddings = [0, 18, 36, 54];
  return (
    <span
      style={{ display: 'flex', alignItems: 'center', gap: 2, paddingLeft: paddings[level] || 0, cursor: onClick ? 'pointer' : undefined }}
      onClick={onClick}
    >
      {!hideChevron && typeof isOpen === 'boolean' && (
        isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />
      )}
      {label}
    </span>
  );
}

// Функция для расчета процента выполнения
function calcPercent(plan: number, fact: number): string {
  if ((plan == null || plan === 0) && (fact == null || fact === 0)) return '0%';
  if ((plan == null || plan === 0) && fact > 0) return '100%';
  if (plan > 0) return Math.round((fact / plan) * 100) + '%';
  return '–';
}

// Функция форматирования чисел
function formatNumber(value: any): string {
  if (value == null || value === '') return '–';
  const num = Number(value);
  if (isNaN(num)) return '–';
  return Math.round(num).toLocaleString('ru-RU').replace(/\s/g, '\u00A0');
}

// Функция форматирования процентов
function formatPercent(value: any): string {
  if (value == null || value === '') return '–';
  const num = Number(value);
  if (isNaN(num)) return '–';
  return Math.round(num).toLocaleString('ru-RU').replace(/\s/g, '\u00A0') + '%';
}

// Функция форматирования даты в русский формат
function formatDate(dateString: any): string {
  if (!dateString || dateString === '') return '—';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '—';
    
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    
    return `${day}.${month}.${year}`;
  } catch (error) {
    return '—';
  }
}

// Универсальная функция построения дерева для Production
function getProductionTree(
  data: any[],
  expandedWorkshops: Set<string>,
  expandedWorkCenters: Set<string>,
  expandedDates: Set<string>,
  translateWorkShop: (name: string) => string,
  translateWorkCenter: (name: string) => string
): any[] {
  // Группировка по WorkShopName_CH → WorkCenterGroup_CN → OnlyDate → детали
  const tree: Record<string, Record<string, Record<string, any[]>>> = {};
  
  data.forEach(row => {
    const workshop = row.WorkShopName_CH || '—';
    const workCenter = row.WorkCenterGroup_CN || '—';
    const date = row.OnlyDate || '—';
    
    if (!tree[workshop]) tree[workshop] = {};
    if (!tree[workshop][workCenter]) tree[workshop][workCenter] = {};
    if (!tree[workshop][workCenter][date]) tree[workshop][workCenter][date] = [];
    tree[workshop][workCenter][date].push(row);
  });

  // Определяем порядок цехов
  const workshopOrder = [
    '装配车间',      // 1. 装配车间
    '热水器总装组',   // 2. 热水器总装组
    '注塑车间',      // 3. 注塑车间
    '冲压车间',      // 4. 冲压车间
    '热水器冲压组',   // 5. 热水器冲压组
    '喷粉车间'       // 6. 喷粉车间
  ];

  const result: any[] = [];
  
  // Сначала добавляем цеха в заданном порядке
  workshopOrder.forEach(workshop => {
    if (tree[workshop]) {
      const workCenters = tree[workshop];
      processWorkshop(workshop, workCenters, result, expandedWorkshops, expandedWorkCenters, expandedDates, translateWorkShop, translateWorkCenter);
    }
  });

  // Затем добавляем остальные цеха в алфавитном порядке
  Object.entries(tree).forEach(([workshop, workCenters]) => {
    if (!workshopOrder.includes(workshop)) {
      processWorkshop(workshop, workCenters, result, expandedWorkshops, expandedWorkCenters, expandedDates, translateWorkShop, translateWorkCenter);
    }
  });

  return result;
}

// Вспомогательная функция для обработки цеха
function processWorkshop(
  workshop: string,
  workCenters: Record<string, Record<string, any[]>>,
  result: any[],
  expandedWorkshops: Set<string>,
  expandedWorkCenters: Set<string>,
  expandedDates: Set<string>,
  translateWorkShop: (name: string) => string,
  translateWorkCenter: (name: string) => string
) {
  // Итог по цеху
  let workshopPlanQty = 0, workshopFactQty = 0;
  let workshopPlanTime = 0, workshopFactTime = 0;
  
  Object.values(workCenters).forEach(dates => {
    Object.values(dates).forEach(rows => {
      rows.forEach(r => {
        workshopPlanQty += Number(r.Plan_QTY) || 0;
        workshopFactQty += Number(r.FACT_QTY) || 0;
        workshopPlanTime += Number(r.Plan_TIME) || 0;
        workshopFactTime += Number(r.FACT_TIME) || 0;
      });
    });
  });

  const workshopPercentQty = calcPercent(workshopPlanQty, workshopFactQty);
  const workshopPercentTime = calcPercent(workshopPlanTime, workshopFactTime);
  const workshopDifferQty = workshopFactQty - workshopPlanQty;
  const workshopDifferTime = workshopFactTime - workshopPlanTime;

  result.push({
    isWorkshopTotal: true,
    WorkShopName_CH: translateWorkShop(workshop),
    Plan_QTY: workshopPlanQty,
    FACT_QTY: workshopFactQty,
    DifferQty: workshopDifferQty,
    PercentQty: workshopPercentQty,
    Plan_TIME: workshopPlanTime,
    FACT_TIME: workshopFactTime,
    DifferTime: workshopDifferTime,
    PercentTime: workshopPercentTime,
    _treeKey: workshop,
    _treeLevel: 0,
    groupLabel: translateWorkShop(workshop),
  });

  if (expandedWorkshops.has(workshop)) {
    Object.entries(workCenters).forEach(([workCenter, dates]) => {
      // Итог по рабочему центру
      let workCenterPlanQty = 0, workCenterFactQty = 0;
      let workCenterPlanTime = 0, workCenterFactTime = 0;
      
      Object.values(dates).forEach(rows => {
        rows.forEach(r => {
          workCenterPlanQty += Number(r.Plan_QTY) || 0;
          workCenterFactQty += Number(r.FACT_QTY) || 0;
          workCenterPlanTime += Number(r.Plan_TIME) || 0;
          workCenterFactTime += Number(r.FACT_TIME) || 0;
        });
      });

      const workCenterPercentQty = calcPercent(workCenterPlanQty, workCenterFactQty);
      const workCenterPercentTime = calcPercent(workCenterPlanTime, workCenterFactTime);
      const workCenterDifferQty = workCenterFactQty - workCenterPlanQty;
      const workCenterDifferTime = workCenterFactTime - workCenterPlanTime;

      result.push({
        isWorkCenterTotal: true,
        WorkShopName_CH: translateWorkCenter(workCenter),
        Plan_QTY: workCenterPlanQty,
        FACT_QTY: workCenterFactQty,
        DifferQty: workCenterDifferQty,
        PercentQty: workCenterPercentQty,
        Plan_TIME: workCenterPlanTime,
        FACT_TIME: workCenterFactTime,
        DifferTime: workCenterDifferTime,
        PercentTime: workCenterPercentTime,
        _treeKey: workshop + '||' + workCenter,
        _treeLevel: 1,
        groupLabel: translateWorkCenter(workCenter),
      });

      if (expandedWorkCenters.has(workshop + '||' + workCenter)) {
        Object.entries(dates).forEach(([date, rows]) => {
          // Итог по дате
          let datePlanQty = 0, dateFactQty = 0;
          let datePlanTime = 0, dateFactTime = 0;
          
          rows.forEach(r => {
            datePlanQty += Number(r.Plan_QTY) || 0;
            dateFactQty += Number(r.FACT_QTY) || 0;
            datePlanTime += Number(r.Plan_TIME) || 0;
            dateFactTime += Number(r.FACT_TIME) || 0;
          });

          const datePercentQty = calcPercent(datePlanQty, dateFactQty);
          const datePercentTime = calcPercent(datePlanTime, dateFactTime);
          const dateDifferQty = dateFactQty - datePlanQty;
          const dateDifferTime = dateFactTime - datePlanTime;

          result.push({
            isDateTotal: true,
            WorkShopName_CH: formatDate(date),
            Plan_QTY: datePlanQty,
            FACT_QTY: dateFactQty,
            DifferQty: dateDifferQty,
            PercentQty: datePercentQty,
            Plan_TIME: datePlanTime,
            FACT_TIME: dateFactTime,
            DifferTime: dateDifferTime,
            PercentTime: datePercentTime,
            _treeKey: workshop + '||' + workCenter + '||' + date,
            _treeLevel: 2,
            groupLabel: formatDate(date),
          });

          if (expandedDates.has(workshop + '||' + workCenter + '||' + date)) {
            rows.forEach(r => {
              const differQty = Number(r.FACT_QTY) - Number(r.Plan_QTY);
              const differTime = Number(r.FACT_TIME) - Number(r.Plan_TIME);
              result.push({ 
                ...r, 
                isDetail: true, 
                WorkShopName_CH: '',
                OrderNumber: r.OrderNumber,
                NomenclatureNumber: r.NomenclatureNumber,
                ProductName_CN: r.ProductName_CN,
                DifferQty: differQty,
                DifferTime: differTime,
                _treeKey: workshop + '||' + workCenter + '||' + date + '||' + r.OrderNumber,
                _treeLevel: 3,
              });
            });
          }
        });
      }
    });
  }
}

const Overview: React.FC = () => {
  const { t, i18n } = useTranslation('production');
  const currentLanguage = i18n.language as 'en' | 'zh';
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedWorkshops, setExpandedWorkshops] = useState<Set<string>>(new Set());
  const [expandedWorkCenters, setExpandedWorkCenters] = useState<Set<string>>(new Set());
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());
  const [startDate, setStartDate] = useState<Date | null>(new Date());
  const [endDate, setEndDate] = useState<Date | null>(new Date());

  /** -------------------- функция перевода названий цехов -------------------- */
  const translateWorkShop = (workShopName: string) => {
    const trimmedName = workShopName?.trim();
    const translation = productionTranslations[currentLanguage]?.workshops?.[trimmedName as keyof typeof productionTranslations.en.workshops];
    return translation ? translation : trimmedName;
  };

  /** -------------------- функция перевода названий рабочих центров -------------------- */
  const translateWorkCenter = (workCenterName: string) => {
    const trimmedName = workCenterName?.trim();
    const translation = productionTranslations[currentLanguage]?.workCenters?.[trimmedName as keyof typeof productionTranslations.en.workCenters];
    return translation ? translation : trimmedName;
  };

  // Функция для загрузки данных с API
  const fetchData = useCallback(async (start: Date | null, end: Date | null) => {
    if (!start || !end) return;
    
    setLoading(true);
    setError(null);
    
    try {
      // Форматируем даты для API
      const startFormatted = start.toISOString().split('T')[0];
      const endFormatted = end.toISOString().split('T')[0];
      
      const response = await fetch(`/api/Production/Efficiency?start_date=${startFormatted}&end_date=${endFormatted}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      setData(result.data || []);
    } catch (err) {
      console.error('Ошибка загрузки данных:', err);
      setError(err instanceof Error ? err.message : 'Ошибка загрузки данных');
    } finally {
      setLoading(false);
    }
  }, []);

  // Загрузка данных при изменении дат
  useEffect(() => {
    fetchData(startDate, endDate);
  }, [startDate, endDate, fetchData]);

  // Получаем данные для таблицы с группировкой
  const treeData = getProductionTree(data, expandedWorkshops, expandedWorkCenters, expandedDates, translateWorkShop, translateWorkCenter);

  // Функция для получения только видимых данных (без детальных строк) для расчета ширины колонок
  const getVisibleDataForWidthCalculation = () => {
    return treeData.filter(row => !row.isDetail);
  };

  // Определение колонок (9 полей + 3 детальных поля)
  const columns = [
    {
      id: 'WorkShopName_CH',
      accessorKey: 'WorkShopName_CH',
      header: 'Work Shop',
    },
    {
      id: 'Plan_QTY',
      accessorKey: 'Plan_QTY',
      header: 'PLAN QTY',
    },
    {
      id: 'FACT_QTY',
      accessorKey: 'FACT_QTY',
      header: 'FACT QTY',
    },
    {
      id: 'DifferQty',
      accessorKey: 'DifferQty',
      header: 'DIFFER QTY',
    },
    {
      id: 'PercentQty',
      accessorKey: 'PercentQty',
      header: 'PERCENT QTY',
    },
    {
      id: 'Plan_TIME',
      accessorKey: 'Plan_TIME',
      header: 'PLAN TIME',
    },
    {
      id: 'FACT_TIME',
      accessorKey: 'FACT_TIME',
      header: 'FACT TIME',
    },
    {
      id: 'DifferTime',
      accessorKey: 'DifferTime',
      header: 'DIFFER TIME',
    },
    {
      id: 'PercentTime',
      accessorKey: 'PercentTime',
      header: 'PERCENT TIME',
    },
  ];

  // Добавляем детальные колонки только если есть раскрытые детали
  const hasExpandedDetails = treeData.some(row => row.isDetail);
  const allColumns = hasExpandedDetails ? [
    ...columns.slice(0, 1), // Work Shop
    {
      id: 'OrderNumber',
      accessorKey: 'OrderNumber',
      header: 'Order Number',
    },
    {
      id: 'NomenclatureNumber',
      accessorKey: 'NomenclatureNumber',
      header: 'Nomenclature',
    },
    {
      id: 'ProductName_CN',
      accessorKey: 'ProductName_CN',
      header: 'Product Name',
    },
    ...columns.slice(1), // Остальные колонки
  ] : columns;

  // Показываем индикатор загрузки
  if (loading) {
    return (
      <div className="mt-6">
              <div className="bg-white p-4">
        <div className="flex justify-center items-center h-64">
          <div className="text-lg text-gray-600">Загрузка данных...</div>
        </div>
      </div>
      </div>
    );
  }

  // Показываем ошибку
  if (error) {
    return (
      <div className="mt-6">
              <div className="bg-white p-4">
        <div className="flex justify-center items-center h-64">
          <div className="text-lg text-red-600">
            Ошибка загрузки данных: {error}
          </div>
        </div>
      </div>
      </div>
    );
  }

  return (
    <div className="mt-6">
      <div className="bg-white p-4">
        <div className="mb-3">
          <div className="flex items-center gap-4">
            <div>
              <label className="block font-bold text-lg text-[#0d1c3d] mb-1 text-center">
                Select Date
              </label>
              <DateRangePicker
                startDate={startDate}
                endDate={endDate}
                onStartDateChange={setStartDate}
                onEndDateChange={setEndDate}
                placeholder="Select date range"
                className="w-64"
              />
            </div>
          </div>
        </div>
        
                        <div className="w-fit">
          <DataTableCustomColumn
            data={treeData}
            columns={allColumns}
          rowClassName={(row: any, rowIndex: number) => {
            if (row.isWorkshopTotal) return 'font-bold bg-gray-100';
            if (row.isWorkCenterTotal) return 'font-semibold bg-gray-50 cursor-pointer';
            if (row.isDateTotal) return 'font-medium bg-gray-100 cursor-pointer';
            if (row.isDetail) return 'bg-white border-t border-slate-200';
            return '';
          }}
                     onRowClick={(row: any) => {
             // Универсальный обработчик раскрытия (как в Plan)
             const level = row._treeLevel;
             const key = row._treeKey;
             if (typeof level === 'number' && key) {
               if (level === 0) {
                 setExpandedWorkshops(prev => {
                   const next = new Set(prev);
                   if (next.has(key)) next.delete(key);
                   else next.add(key);
                   return next;
                 });
               } else if (level === 1) {
                 setExpandedWorkCenters(prev => {
                   const next = new Set(prev);
                   if (next.has(key)) next.delete(key);
                   else next.add(key);
                   return next;
                 });
               } else if (level === 2) {
                 setExpandedDates(prev => {
                   const next = new Set(prev);
                   if (next.has(key)) next.delete(key);
                   else next.add(key);
                   return next;
                 });
               }
             }
           }}
                     cellRenderers={{
             WorkShopName_CH: (value: any, row: any) => {
               if (row._treeLevel != null && row.groupLabel) {
                 const sets = [expandedWorkshops, expandedWorkCenters, expandedDates];
                 const isOpen = sets[row._treeLevel]?.has(row._treeKey);
                 // Не показывать стрелку только на детальном уровне
                 const isLastLevel = row._treeLevel === 3;
                 return renderHierarchyCell(row._treeLevel, !!isOpen, row.groupLabel, isLastLevel ? undefined : (() => {}), isLastLevel);
               }
               return value || '—';
             },
             OrderNumber: (value: any, row: any) => {
               return value || '—';
             },
             NomenclatureNumber: (value: any, row: any) => {
               return value || '—';
             },
             ProductName_CN: (value: any, row: any) => {
               if (!value) return '—';
               // Ограничиваем до 34 символов и добавляем многоточие
               const truncatedValue = value.length > 34 ? value.substring(0, 34) + '...' : value;
               return (
                 <span style={{ textAlign: 'left', display: 'block' }}>
                   {truncatedValue}
                 </span>
               );
             },
            PercentQty: (value: any, row: any) => {
              if (row.isWorkshopTotal || row.isWorkCenterTotal || row.isDateTotal) {
                return <ProgressCell value={value} />;
              }
              return <span style={{ color: '#6b7280' }}>{formatPercent(value)}</span>;
            },
            PercentTime: (value: any, row: any) => {
              if (row.isWorkshopTotal || row.isWorkCenterTotal || row.isDateTotal) {
                return <ProgressCell value={value} />;
              }
              return <span style={{ color: '#6b7280' }}>{formatPercent(value)}</span>;
            },
            Plan_QTY: (value: any, row: any) => {
              return <span style={{ color: '#6b7280' }}>{formatNumber(value)}</span>;
            },
                         FACT_QTY: (value: any, row: any) => {
               return <span style={{ color: '#6b7280' }}>{formatNumber(value)}</span>;
             },
             DifferQty: (value: any, row: any) => {
               const numValue = Number(value);
               const color = numValue >= 0 ? '#10b981' : '#ef4444';
               return <span style={{ color }}>{formatNumber(value)}</span>;
             },
             Plan_TIME: (value: any, row: any) => {
               return <span style={{ color: '#6b7280' }}>{formatNumber(value)}</span>;
             },
             FACT_TIME: (value: any, row: any) => {
               return <span style={{ color: '#6b7280' }}>{formatNumber(value)}</span>;
             },
             DifferTime: (value: any, row: any) => {
               const numValue = Number(value);
               const color = numValue >= 0 ? '#10b981' : '#ef4444';
               return <span style={{ color }}>{formatNumber(value)}</span>;
             },
          }}
        />
        </div>
      </div>
    </div>
  );
};

export default Overview;
