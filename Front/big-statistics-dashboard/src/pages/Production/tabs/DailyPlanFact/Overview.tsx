import React, { useState, useCallback, useEffect, useMemo, useLayoutEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import GroupedGrid from './GroupedGrid';
import ProgressCell from '../../../../components/DataTableCustomColumn/ProgressCell';
import LoadingSpinner from '../../../../components/ui/LoadingSpinner';
import { ContentLayout } from '../../../../components/Layout';
import { ChevronRight, ChevronDown } from "lucide-react";
import type { ColDef } from '@ag-grid-community/core';

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
  
  // Если дата уже в русском формате DD.MM.YYYY, возвращаем как есть
  if (typeof dateString === 'string' && /^\d{1,2}\.\d{1,2}\.\d{4}$/.test(dateString)) {
    return dateString;
  }
  
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
    __id: `ws:${workshop}`, // Стабильный ID для цеха
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

      const wcKey = workshop + '||' + workCenter;
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
        _treeKey: wcKey,
        _treeLevel: 1,
        groupLabel: translateWorkCenter(workCenter),
        __id: `wc:${wcKey}`, // Стабильный ID для рабочего центра
      });

      if (expandedWorkCenters.has(wcKey)) {
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

          const dtKey = wcKey + '||' + date;
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
            _treeKey: dtKey,
            _treeLevel: 2,
            groupLabel: formatDate(date),
            __id: `dt:${dtKey}`, // Стабильный ID для даты
          });

          if (expandedDates.has(dtKey)) {
            rows.forEach((r, i) => {
              const differQty = Number(r.FACT_QTY) - Number(r.Plan_QTY);
              const differTime = Number(r.FACT_TIME) - Number(r.Plan_TIME);
              const detKey = dtKey + '||' + (r.OrderNumber || '') + '||' + (r.NomenclatureNumber || '') + '||' + i;
              result.push({
                ...r,
                isDetail: true,
                WorkShopName_CH: '',
                OrderNumber: r.OrderNumber,
                NomenclatureNumber: r.NomenclatureNumber,
                ProductName_CN: r.ProductName_CN,
                DifferQty: differQty,
                DifferTime: differTime,
                _treeKey: detKey,
                _treeLevel: 3,
                __id: `det:${detKey}`, // Стабильный ID для детали
              });
            });
          }
        });
      }
    });
  }
}

interface OverviewProps {
  data: any[];
  loading: boolean;
  error: string | null;
  suppressLocalLoaders?: boolean;
}

const Overview: React.FC<OverviewProps> = ({ data, loading, error, suppressLocalLoaders }) => {
  const { t, i18n } = useTranslation('production');
  const currentLanguage = i18n.language as 'en' | 'zh';
  const [expandedWorkshops, setExpandedWorkshops] = useState<Set<string>>(new Set());
  const [expandedWorkCenters, setExpandedWorkCenters] = useState<Set<string>>(new Set());
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());
  const [isReadyToShow, setIsReadyToShow] = useState(false);
  const renderTimeoutRef = useRef<number | null>(null);

  // После загрузки всех данных ждем завершения рендеринга
  useLayoutEffect(() => {
    if (loading) {
      setIsReadyToShow(false);
      if (renderTimeoutRef.current) {
        clearTimeout(renderTimeoutRef.current);
      }
      return;
    }

    if (renderTimeoutRef.current) {
      clearTimeout(renderTimeoutRef.current);
    }

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        renderTimeoutRef.current = setTimeout(() => {
          setIsReadyToShow(true);
        }, 100);
      });
    });

    return () => {
      if (renderTimeoutRef.current) {
        clearTimeout(renderTimeoutRef.current);
      }
    };
  }, [loading]);

  /** -------------------- функция перевода названий цехов -------------------- */
  const translateWorkShop = useCallback((workShopName: string) => {
    const trimmedName = workShopName?.trim();
    const translation = productionTranslations[currentLanguage]?.workshops?.[trimmedName as keyof typeof productionTranslations.en.workshops];
    return translation ? translation : trimmedName;
  }, [currentLanguage]);

  /** -------------------- функция перевода названий рабочих центров -------------------- */
  const translateWorkCenter = useCallback((workCenterName: string) => {
    const trimmedName = workCenterName?.trim();
    const translation = productionTranslations[currentLanguage]?.workCenters?.[trimmedName as keyof typeof productionTranslations.en.workCenters];
    return translation ? translation : trimmedName;
  }, [currentLanguage]);

  // Получаем данные для таблицы с группировкой
  const treeData = useMemo(() =>
    getProductionTree(data, expandedWorkshops, expandedWorkCenters, expandedDates, translateWorkShop, translateWorkCenter),
    [data, expandedWorkshops, expandedWorkCenters, expandedDates, translateWorkShop, translateWorkCenter]
  );

  // Функция для получения только видимых данных (без детальных строк) для расчета ширины колонок
  const getVisibleDataForWidthCalculation = () => {
    return treeData.filter(row => !row.isDetail);
  };

  // Функция для получения только видимых колонок для расчета ширины
  const getVisibleColumnsForWidthCalculation = () => {
    return allColumns.filter(col => !(col as any).hide);
  };

  // Определение колонок для AGGrid - стабильный массив с colId
  const hasExpandedDetails = treeData.some(row => row.isDetail);

  const allColumns: ColDef[] = useMemo(() => [
    {
      colId: 'workshop',
      field: 'WorkShopName_CH',
      headerName: t('tableHeaders.workShopCol', 'Work Shop'),
      minWidth: 200,
    },
    // Детальные колонки - скрываем/показываем через hide
    {
      colId: 'orderNumber',
      field: 'OrderNumber',
      headerName: t('tableHeaders.orderNumberCol', 'Order Number'),
      minWidth: 120,
      hide: !hasExpandedDetails,
    },
    {
      colId: 'nomenclatureNumber',
      field: 'NomenclatureNumber',
      headerName: t('tableHeaders.nomenclatureCol', 'Nomenclature'),
      minWidth: 120,
      hide: !hasExpandedDetails,
    },
    {
      colId: 'productNameCN',
      field: 'ProductName_CN',
      headerName: t('tableHeaders.productNameCol', 'Product Name'),
      minWidth: 200,
      hide: !hasExpandedDetails,
    },
    // Базовые метрики - всегда присутствуют (с центрированием числовых значений)
    {
      colId: 'planQty',
      field: 'Plan_QTY',
      headerName: t('tableHeaders.planQtyCol', 'PLAN QTY'),
      minWidth: 100,
      cellStyle: { textAlign: 'center' },
    },
    {
      colId: 'factQty',
      field: 'FACT_QTY',
      headerName: t('tableHeaders.factQtyCol', 'FACT QTY'),
      minWidth: 100,
      cellStyle: { textAlign: 'center' },
    },
    {
      colId: 'differQty',
      field: 'DifferQty',
      headerName: t('tableHeaders.differQtyCol', 'DIFFER QTY'),
      minWidth: 100,
      cellStyle: { textAlign: 'center' },
    },
    {
      colId: 'percentQty',
      field: 'PercentQty',
      headerName: t('tableHeaders.percentQtyCol', 'PERCENT QTY'),
      minWidth: 120,
      cellStyle: { textAlign: 'center' },
    },
    {
      colId: 'planTime',
      field: 'Plan_TIME',
      headerName: t('tableHeaders.planTimeCol', 'PLAN TIME'),
      minWidth: 100,
      cellStyle: { textAlign: 'center' },
    },
    {
      colId: 'factTime',
      field: 'FACT_TIME',
      headerName: t('tableHeaders.factTimeCol', 'FACT TIME'),
      minWidth: 100,
      cellStyle: { textAlign: 'center' },
    },
    {
      colId: 'differTime',
      field: 'DifferTime',
      headerName: t('tableHeaders.differTimeCol', 'DIFFER TIME'),
      minWidth: 100,
      cellStyle: { textAlign: 'center' },
    },
    {
      colId: 'percentTime',
      field: 'PercentTime',
      headerName: t('tableHeaders.percentTimeCol', 'PERCENT TIME'),
      minWidth: 120,
      cellStyle: { textAlign: 'center' },
    },
  ], [hasExpandedDetails, t]);

  // ПЕРВИЧНАЯ ЗАГРУЗКА
  if (loading && suppressLocalLoaders) {
    return (
      <div className="mt-6">
        <div className="bg-white p-4 rounded" style={{ minHeight: 256 }} />
      </div>
    );
  }

  if ((loading || !isReadyToShow) && !suppressLocalLoaders) {
    return (
      <div className="mt-6">
        <div className="bg-white p-4 rounded">
          <div className="flex justify-center items-center h-64">
            <LoadingSpinner overlay="screen" size="xl" />
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
    <ContentLayout spacing="mt-6" minHeight="">
        <GroupedGrid
          rowData={treeData}
          columnDefs={allColumns}
          showTotalRow={true}
          t={t}
          expandedState={{
            workshops: Array.from(expandedWorkshops),
            workCenters: Array.from(expandedWorkCenters),
            dates: Array.from(expandedDates),
          }}
          onExpandedChange={(state: { workshops?: string[]; workCenters?: string[]; dates?: string[] }) => {
            if (state.workshops) {
              setExpandedWorkshops(new Set(state.workshops));
            }
            if (state.workCenters) {
              setExpandedWorkCenters(new Set(state.workCenters));
            }
            if (state.dates) {
              setExpandedDates(new Set(state.dates));
            }
          }}
        />
    </ContentLayout>
  );
};

export default Overview;
