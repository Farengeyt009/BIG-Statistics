import React, { useState, useCallback, useEffect } from "react";
import { ChevronRight, ChevronDown } from "lucide-react";
import { useTranslation } from 'react-i18next';
import { DataTableCustomColumn } from '../../../../components/DataTableCustomColumn/DataTableCustomColumn';
import planFactSummary from "../../../../Test/PlanFactSummary.json";
import { formatNumber, formatPercent, calcPercent, sumBy, makeKeys } from './utils/format';
import { getTree } from './utils/tree';
import ProgressCell from '../../../../components/DataTableCustomColumn/ProgressCell';
import PlanCumulativeChart from './components/PlanCumulativeChart';
import { MetricCard, DonutChart } from '../../../../components/KPICards';
import LoadingSpinner from '../../../../components/ui/LoadingSpinner';

// Компонент-обертка для объединения карточки и диаграммы (только для этой страницы)
interface KPICardWithChartProps {
  label: string;
  value: string;
  changePercent: number;
  isPositiveMetric: boolean;
  chartValue: number;
  chartTotal?: number;
  chartColor?: string;
}

const KPICardWithChart: React.FC<KPICardWithChartProps> = ({
  label,
  value,
  changePercent,
  isPositiveMetric,
  chartValue,
  chartTotal = 100,
  chartColor
}) => (
  <div className="flex items-center gap-0 p-4 bg-white rounded-lg w-fit">
    <MetricCard
      label={label}
      value={value}
      changePercent={changePercent}
      isPositiveMetric={isPositiveMetric}
      hideArrows={true}
      useOrangeColor={true}
      useRussianSeparator={true}
    />
    <DonutChart 
      value={chartValue} 
      total={chartTotal} 
      size={80} 
      strokeWidth={8}
      primaryColor={chartColor}
      className="-ml-11"
    />
  </div>
);

// Универсальный рендерер иерархических ячеек
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

// Трёхуровневая группировка: Market → LargeGroup → GroupName → детали
function getMarketTreeData(data: any[], expandedMarkets: Set<string>, expandedGroups: Set<string>, expandedSubgroups: Set<string>) {
  const planKey = 'PlanQty';
  const factKey = 'FactQty';
  const diffKey = 'DifferentQty';
  const percentKey = 'PercentQty';
  // Группировка по Market → LargeGroup → GroupName
  const tree: Record<string, Record<string, Record<string, any[]>>> = {};
  data.forEach(row => {
    const market = row.Market || '—';
    const group = row.LargeGroup || '—';
    const subgroup = row.GroupName || '—';
    if (!tree[market]) tree[market] = {};
    if (!tree[market][group]) tree[market][group] = {};
    if (!tree[market][group][subgroup]) tree[market][group][subgroup] = [];
    tree[market][group][subgroup].push(row);
  });
  // Формируем плоский массив для таблицы
  const result: any[] = [];
  Object.entries(tree).forEach(([market, groups]) => {
    // Итог по рынку
    let marketPlanQty = 0, marketFactQty = 0, marketDiffQty = 0;
    let marketPlanTime = 0, marketFactTime = 0, marketDiffTime = 0;
    Object.values(groups).forEach(subgroups => {
      Object.values(subgroups).forEach(rows => {
        rows.forEach(r => {
          marketPlanQty += Number(r.PlanQty) || 0;
          marketFactQty += Number(r.FactQty) || 0;
          marketDiffQty += Number(r.DifferentQty) || 0;
          marketPlanTime += Number(r.PlanTime) || 0;
          marketFactTime += Number(r.FactTime) || 0;
          marketDiffTime += Number(r.DifferentTime) || 0;
        });
      });
    });
    // Проценты
    let marketPercentQty = '–';
    if (marketPlanQty === 0 && marketFactQty === 0) marketPercentQty = '0%';
    else if (marketPlanQty === 0 && marketFactQty > 0) marketPercentQty = '100%';
    else if (marketPlanQty !== 0) marketPercentQty = Math.round((marketFactQty / marketPlanQty) * 100) + '%';
    let marketPercentTime = '–';
    if (marketPlanTime === 0 && marketFactTime === 0) marketPercentTime = '0%';
    else if (marketPlanTime === 0 && marketFactTime > 0) marketPercentTime = '100%';
    else if (marketPlanTime !== 0) marketPercentTime = Math.round((marketFactTime / marketPlanTime) * 100) + '%';
    result.push({
      isMarketTotal: true,
      Market: '',
      LargeGroup: market,
      PlanQty: marketPlanQty,
      FactQty: marketFactQty,
      DifferentQty: marketDiffQty,
      PercentQty: marketPercentQty,
      PlanTime: marketPlanTime,
      FactTime: marketFactTime,
      DifferentTime: marketDiffTime,
      PercentTime: marketPercentTime,
      _marketKey: market,
    });
    if (expandedMarkets.has(market)) {
      Object.entries(groups).forEach(([group, subgroups]) => {
        // Итог по группе
        let groupPlanQty = 0, groupFactQty = 0, groupDiffQty = 0;
        let groupPlanTime = 0, groupFactTime = 0, groupDiffTime = 0;
        Object.values(subgroups).forEach(rows => {
          rows.forEach(r => {
            groupPlanQty += Number(r.PlanQty) || 0;
            groupFactQty += Number(r.FactQty) || 0;
            groupDiffQty += Number(r.DifferentQty) || 0;
            groupPlanTime += Number(r.PlanTime) || 0;
            groupFactTime += Number(r.FactTime) || 0;
            groupDiffTime += Number(r.DifferentTime) || 0;
          });
        });
        // Проценты
        let groupPercentQty = '–';
        if (groupPlanQty === 0 && groupFactQty === 0) groupPercentQty = '0%';
        else if (groupPlanQty === 0 && groupFactQty > 0) groupPercentQty = '100%';
        else if (groupPlanQty !== 0) groupPercentQty = Math.round((groupFactQty / groupPlanQty) * 100) + '%';
        let groupPercentTime = '–';
        if (groupPlanTime === 0 && groupFactTime === 0) groupPercentTime = '0%';
        else if (groupPlanTime === 0 && groupFactTime > 0) groupPercentTime = '100%';
        else if (groupPlanTime !== 0) groupPercentTime = Math.round((groupFactTime / groupPlanTime) * 100) + '%';
        result.push({
          isGroupTotal: true,
          Market: '',
          LargeGroup: group,
          PlanQty: groupPlanQty,
          FactQty: groupFactQty,
          DifferentQty: groupDiffQty,
          PercentQty: groupPercentQty,
          PlanTime: groupPlanTime,
          FactTime: groupFactTime,
          DifferentTime: groupDiffTime,
          PercentTime: groupPercentTime,
          _marketKey: market,
          _groupKey: market + '||' + group,
        });
        if (expandedGroups.has(market + '||' + group)) {
          Object.entries(subgroups).forEach(([subgroup, rows]) => {
            // Если в подгруппе только одна строка — сразу выводим как деталь
            if (rows.length === 1) {
              result.push({ ...rows[0], isDetail: true, _marketKey: market, _groupKey: market + '||' + group, _subgroupKey: market + '||' + group + '||' + subgroup });
              return;
            }
            // Итог по подгруппе
            let subPlanQty = 0, subFactQty = 0, subDiffQty = 0;
            let subPlanTime = 0, subFactTime = 0, subDiffTime = 0;
            rows.forEach(r => {
              subPlanQty += Number(r.PlanQty) || 0;
              subFactQty += Number(r.FactQty) || 0;
              subDiffQty += Number(r.DifferentQty) || 0;
              subPlanTime += Number(r.PlanTime) || 0;
              subFactTime += Number(r.FactTime) || 0;
              subDiffTime += Number(r.DifferentTime) || 0;
            });
            // Проценты
            let subPercentQty = '–';
            if (subPlanQty === 0 && subFactQty === 0) subPercentQty = '0%';
            else if (subPlanQty === 0 && subFactQty > 0) subPercentQty = '100%';
            else if (subPlanQty !== 0) subPercentQty = Math.round((subFactQty / subPlanQty) * 100) + '%';
            let subPercentTime = '–';
            if (subPlanTime === 0 && subFactTime === 0) subPercentTime = '0%';
            else if (subPlanTime === 0 && subFactTime > 0) subPercentTime = '100%';
            else if (subPlanTime !== 0) subPercentTime = Math.round((subFactTime / subPlanTime) * 100) + '%';
            result.push({
              isSubgroupTotal: true,
              Market: '',
              LargeGroup: '',
              GroupName: rows[0].GroupName || subgroup,
              PlanQty: subPlanQty,
              FactQty: subFactQty,
              DifferentQty: subDiffQty,
              PercentQty: subPercentQty,
              PlanTime: subPlanTime,
              FactTime: subFactTime,
              DifferentTime: subDiffTime,
              PercentTime: subPercentTime,
              _marketKey: market,
              _groupKey: market + '||' + group,
              _subgroupKey: market + '||' + group + '||' + subgroup,
            });
            if (expandedSubgroups.has(market + '||' + group + '||' + subgroup)) {
              rows.forEach(r => result.push({ ...r, isDetail: true, _marketKey: market, _groupKey: market + '||' + group, _subgroupKey: market + '||' + group + '||' + subgroup }));
            }
          });
        }
      });
    }
  });
  return result;
}

// Двухуровневая группировка для первой таблицы: LargeGroup → GroupName → детали
function getLargeGroupTreeData(data: any[], expandedGroups: Set<string>, expandedSubgroups: Set<string>) {
  const planKey = 'PlanQty';
  const factKey = 'FactQty';
  const diffKey = 'DifferentQty';
  const percentKey = 'PercentQty';
  // Фильтрация: только уникальные пары LargeGroup + GroupName
  const uniqueMap: Record<string, any> = {};
  data.forEach(row => {
    const group = row.LargeGroup || '—';
    const subgroup = row.GroupName || '—';
    const key = group + '||' + subgroup;
    if (!uniqueMap[key]) {
      uniqueMap[key] = row;
    }
  });
  const uniqueData = Object.values(uniqueMap);
  // Группировка по LargeGroup → GroupName
  const tree: Record<string, Record<string, any[]>> = {};
  uniqueData.forEach(row => {
    const group = row.LargeGroup || '—';
    const subgroup = row.GroupName || '—';
    if (!tree[group]) tree[group] = {};
    if (!tree[group][subgroup]) tree[group][subgroup] = [];
    tree[group][subgroup].push(row);
  });
  const result: any[] = [];
  Object.entries(tree).forEach(([group, subgroups]) => {
    // Итог по группе
    let groupPlanQty = 0, groupFactQty = 0, groupDiffQty = 0;
    let groupPlanTime = 0, groupFactTime = 0, groupDiffTime = 0;
    Object.values(subgroups).forEach(rows => {
      rows.forEach(r => {
        groupPlanQty += Number(r.PlanQty) || 0;
        groupFactQty += Number(r.FactQty) || 0;
        groupDiffQty += Number(r.DifferentQty) || 0;
        groupPlanTime += Number(r.PlanTime) || 0;
        groupFactTime += Number(r.FactTime) || 0;
        groupDiffTime += Number(r.DifferentTime) || 0;
      });
    });
    // Проценты
    let groupPercentQty = '–';
    if (groupPlanQty === 0 && groupFactQty === 0) groupPercentQty = '0%';
    else if (groupPlanQty === 0 && groupFactQty > 0) groupPercentQty = '100%';
    else if (groupPlanQty !== 0) groupPercentQty = Math.round((groupFactQty / groupPlanQty) * 100) + '%';
    let groupPercentTime = '–';
    if (groupPlanTime === 0 && groupFactTime === 0) groupPercentTime = '0%';
    else if (groupPlanTime === 0 && groupFactTime > 0) groupPercentTime = '100%';
    else if (groupPlanTime !== 0) groupPercentTime = Math.round((groupFactTime / groupPlanTime) * 100) + '%';
    result.push({
      isGroupTotal: true,
      LargeGroup: group,
      PlanQty: groupPlanQty,
      FactQty: groupFactQty,
      DifferentQty: groupDiffQty,
      PercentQty: groupPercentQty,
      PlanTime: groupPlanTime,
      FactTime: groupFactTime,
      DifferentTime: groupDiffTime,
      PercentTime: groupPercentTime,
      _groupKey: group,
    });
    if (expandedGroups.has(group)) {
      Object.entries(subgroups).forEach(([subgroup, rows]) => {
        // Если в подгруппе только одна строка — сразу выводим как деталь
        if (rows.length === 1) {
          result.push({ ...rows[0], isDetail: true, _groupKey: group, _subgroupKey: group + '||' + subgroup });
          return;
        }
        // Итог по подгруппе
        let subPlanQty = 0, subFactQty = 0, subDiffQty = 0;
        let subPlanTime = 0, subFactTime = 0, subDiffTime = 0;
        rows.forEach(r => {
          subPlanQty += Number(r.PlanQty) || 0;
          subFactQty += Number(r.FactQty) || 0;
          subDiffQty += Number(r.DifferentQty) || 0;
          subPlanTime += Number(r.PlanTime) || 0;
          subFactTime += Number(r.FactTime) || 0;
          subDiffTime += Number(r.DifferentTime) || 0;
        });
        // Проценты
        let subPercentQty = '–';
        if (subPlanQty === 0 && subFactQty === 0) subPercentQty = '0%';
        else if (subPlanQty === 0 && subFactQty > 0) subPercentQty = '100%';
        else if (subPlanQty !== 0) subPercentQty = Math.round((subFactQty / subPlanQty) * 100) + '%';
        let subPercentTime = '–';
        if (subPlanTime === 0 && subFactTime === 0) subPercentTime = '0%';
        else if (subPlanTime === 0 && subFactTime > 0) subPercentTime = '100%';
        else if (subPlanTime !== 0) subPercentTime = Math.round((subFactTime / subPlanTime) * 100) + '%';
        result.push({
          isSubgroupTotal: true,
          LargeGroup: '',
          GroupName: rows[0].GroupName || subgroup,
          PlanQty: subPlanQty,
          FactQty: subFactQty,
          DifferentQty: subDiffQty,
          PercentQty: subPercentQty,
          PlanTime: subPlanTime,
          FactTime: subFactTime,
          DifferentTime: subDiffTime,
          PercentTime: subPercentTime,
          _groupKey: group,
          _subgroupKey: group + '||' + subgroup,
        });
        if (expandedSubgroups.has(group + '||' + subgroup)) {
          rows.forEach(r => result.push({ ...r, isDetail: true, _groupKey: group, _subgroupKey: group + '||' + subgroup }));
        }
      });
    }
  });
  // Добавляем строку Total для первого уровня
  if (result.length) {
    let totalPlanQty = 0, totalFactQty = 0, totalDiffQty = 0;
    let totalPlanTime = 0, totalFactTime = 0, totalDiffTime = 0;
    result.forEach(r => {
      if (typeof r.PlanQty === 'number') totalPlanQty += r.PlanQty;
      if (typeof r.FactQty === 'number') totalFactQty += r.FactQty;
      if (typeof r.DifferentQty === 'number') totalDiffQty += r.DifferentQty;
      if (typeof r.PlanTime === 'number') totalPlanTime += r.PlanTime;
      if (typeof r.FactTime === 'number') totalFactTime += r.FactTime;
      if (typeof r.DifferentTime === 'number') totalDiffTime += r.DifferentTime;
    });
    // Проценты
    let totalPercentQty = '–';
    if (totalPlanQty === 0 && totalFactQty === 0) totalPercentQty = '0%';
    else if (totalPlanQty === 0 && totalFactQty > 0) totalPercentQty = '100%';
    else if (totalPlanQty !== 0) totalPercentQty = Math.round((totalFactQty / totalPlanQty) * 100) + '%';
    let totalPercentTime = '–';
    if (totalPlanTime === 0 && totalFactTime === 0) totalPercentTime = '0%';
    else if (totalPlanTime === 0 && totalFactTime > 0) totalPercentTime = '100%';
    else if (totalPlanTime !== 0) totalPercentTime = Math.round((totalFactTime / totalPlanTime) * 100) + '%';
    result.push({
      isGrandTotal: true,
      LargeGroup: 'Total',
      PlanQty: totalPlanQty,
      FactQty: totalFactQty,
      DifferentQty: totalDiffQty,
      PercentQty: totalPercentQty,
      PlanTime: totalPlanTime,
      FactTime: totalFactTime,
      DifferentTime: totalDiffTime,
      PercentTime: totalPercentTime,
    });
  }
  return result;
}

interface MonthPlanSummaryProps {
  year: number;
  month: number;
  ymPanelRef: React.RefObject<HTMLDivElement | null>;
}

const ALL_KEYS = [
  ...makeKeys('Qty'),
  ...makeKeys('Time')
];

const MonthPlanSummary: React.FC<MonthPlanSummaryProps> = ({ year, month }) => {
  const { t } = useTranslation('planTranslation');
  const [data1, setData1] = useState<any[]>([]);
  const [data2, setData2] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [groupMode, setGroupMode] = useState<'largeGroup' | 'market'>('largeGroup');
  const [expandedMarkets, setExpandedMarkets] = useState<Set<string>>(new Set());
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [expandedSubgroups, setExpandedSubgroups] = useState<Set<string>>(new Set());
  const [expandedLargeGroups, setExpandedLargeGroups] = useState<Set<string>>(new Set());
  const [expandedLargeSubgroups, setExpandedLargeSubgroups] = useState<Set<string>>(new Set());

  // Функция для загрузки данных с API
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/MonthPlanFactSummary?year=${year}&month=${month}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setData1(data.table1 || []);
      setData2(data.table2 || []);
    } catch (err) {
      console.error('Ошибка загрузки данных:', err);
      setError(err instanceof Error ? err.message : 'Ошибка загрузки данных');
      // Fallback к статичным данным при ошибке
      setData1((planFactSummary as any).table1 || []);
      setData2((planFactSummary as any).table2 || []);
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  // Загружаем данные при изменении года или месяца
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Функции для расчета KPI
  const calculateTotalQty = () => {
    const totalPlan = data1.reduce((sum: number, item: any) => sum + (Number(item.PlanQty) || 0), 0);
    const totalFact = data1.reduce((sum: number, item: any) => sum + (Number(item.FactQty) || 0), 0);
    const percentage = totalPlan > 0 ? Math.round((totalFact / totalPlan) * 100) : 0;
    return { plan: totalPlan, fact: totalFact, percentage };
  };

  const calculateTotalTime = () => {
    const totalPlan = data1.reduce((sum: number, item: any) => sum + (Number(item.PlanTime) || 0), 0);
    const totalFact = data1.reduce((sum: number, item: any) => sum + (Number(item.FactTime) || 0), 0);
    const percentage = totalPlan > 0 ? Math.round((totalFact / totalPlan) * 100) : 0;
    return { plan: totalPlan, fact: totalFact, percentage };
  };

  const calculateWaterHeaterQty = () => {
    const waterHeaterData = data1.filter((item: any) => item.LargeGroup === 'Water heater');
    const totalPlan = waterHeaterData.reduce((sum: number, item: any) => sum + (Number(item.PlanQty) || 0), 0);
    const totalFact = waterHeaterData.reduce((sum: number, item: any) => sum + (Number(item.FactQty) || 0), 0);
    const percentage = totalPlan > 0 ? Math.round((totalFact / totalPlan) * 100) : 0;
    return { plan: totalPlan, fact: totalFact, percentage };
  };

  const calculateWaterHeaterTime = () => {
    const waterHeaterData = data1.filter((item: any) => item.LargeGroup === 'Water heater');
    const totalPlan = waterHeaterData.reduce((sum: number, item: any) => sum + (Number(item.PlanTime) || 0), 0);
    const totalFact = waterHeaterData.reduce((sum: number, item: any) => sum + (Number(item.FactTime) || 0), 0);
    const percentage = totalPlan > 0 ? Math.round((totalFact / totalPlan) * 100) : 0;
    return { plan: totalPlan, fact: totalFact, percentage };
  };

  const calculateHeatersQty = () => {
    const heatersData = data1.filter((item: any) => item.LargeGroup !== 'Water heater');
    const totalPlan = heatersData.reduce((sum: number, item: any) => sum + (Number(item.PlanQty) || 0), 0);
    const totalFact = heatersData.reduce((sum: number, item: any) => sum + (Number(item.FactQty) || 0), 0);
    const percentage = totalPlan > 0 ? Math.round((totalFact / totalPlan) * 100) : 0;
    return { plan: totalPlan, fact: totalFact, percentage };
  };

  const calculateHeatersTime = () => {
    const heatersData = data1.filter((item: any) => item.LargeGroup !== 'Water heater');
    const totalPlan = heatersData.reduce((sum: number, item: any) => sum + (Number(item.PlanTime) || 0), 0);
    const totalFact = heatersData.reduce((sum: number, item: any) => sum + (Number(item.FactTime) || 0), 0);
    const percentage = totalPlan > 0 ? Math.round((totalFact / totalPlan) * 100) : 0;
    return { plan: totalPlan, fact: totalFact, percentage };
  };

  // Получаем данные для KPI
  const totalQtyData = calculateTotalQty();
  const totalTimeData = calculateTotalTime();
  const waterHeaterQtyData = calculateWaterHeaterQty();
  const waterHeaterTimeData = calculateWaterHeaterTime();
  const heatersQtyData = calculateHeatersQty();
  const heatersTimeData = calculateHeatersTime();

  const columnsAll = [
    { id: 'LargeGroup', accessorKey: 'LargeGroup', header: () => t('svodTable.LargeGroup') },
    ...ALL_KEYS
  ];

  const groupKeys = groupMode === 'largeGroup' ? ['LargeGroup', 'GroupName'] : ['Market', 'LargeGroup', 'GroupName'];
  const expandedSets = groupMode === 'largeGroup'
    ? [expandedLargeGroups, expandedLargeSubgroups]
    : [expandedMarkets, expandedGroups, expandedSubgroups];
  const treeData = getTree(data1, groupKeys, ...expandedSets);

  // Показываем индикатор загрузки
  if (loading) {
    return (
      <div className="container relative min-h-[70vh]">
        <LoadingSpinner overlay size="xl" />
      </div>
    );
  }

  // Показываем ошибку
  if (error) {
    return (
      <div className="container">
        <div className="flex justify-center items-center h-64">
          <div className="text-lg text-red-600">
            Ошибка загрузки данных: {error}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      {/* KPI карточки горизонтально вверху */}
      <div className="flex flex-wrap gap-14 mb-2">
        <KPICardWithChart
          label="Total, pcs"
          value={`${Math.round(totalQtyData.plan / 1000)}K`}
          changePercent={Math.round(totalQtyData.fact)}
          isPositiveMetric={true}
          chartValue={totalQtyData.percentage}
        />
        <KPICardWithChart
          label="Total, h"
          value={`${Math.round(totalTimeData.plan / 1000)}K`}
          changePercent={Math.round(totalTimeData.fact)}
          isPositiveMetric={false}
          chartValue={totalTimeData.percentage}
        />
        <KPICardWithChart
          label="Heaters, pcs"
          value={`${Math.round(heatersQtyData.plan / 1000)}K`}
          changePercent={Math.round(heatersQtyData.fact)}
          isPositiveMetric={true}
          chartValue={heatersQtyData.percentage}
          chartColor="#15803d"
        />
        <KPICardWithChart
          label="Heaters, h"
          value={`${Math.round(heatersTimeData.plan / 1000)}K`}
          changePercent={Math.round(heatersTimeData.fact)}
          isPositiveMetric={true}
          chartValue={heatersTimeData.percentage}
          chartColor="#15803d"
        />
        <KPICardWithChart
          label="Water heater, pcs"
          value={`${Math.round(waterHeaterQtyData.plan / 1000)}K`}
          changePercent={Math.round(waterHeaterQtyData.fact)}
          isPositiveMetric={true}
          chartValue={waterHeaterQtyData.percentage}
          chartColor="#dc2626"
        />
        <KPICardWithChart
          label="Water heater, h"
          value={`${Math.round(waterHeaterTimeData.plan / 1000)}K`}
          changePercent={Math.round(waterHeaterTimeData.fact)}
          isPositiveMetric={false}
          chartValue={waterHeaterTimeData.percentage}
          chartColor="#dc2626"
        />
      </div>

      {/* Горизонтальная линия на всю ширину */}
      <div className="mt-1 mb-4">
        <hr className="border-gray-300 border-t-2" />
      </div>

      {/* Графики и таблицы внизу */}
      <div className="flex flex-col lg:flex-row gap-4 -mt-4 relative">
        {/* Второй график (существующий) */}
        <div className="flex-1">
          <PlanCumulativeChart table2={data2} year={year} month={month} />
        </div>

        {/* Таблица */}
        <div className="flex-1">
          <div className="bg-white p-4">
            {/* Заголовок и пояснение */}
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-[#0d1c3d] mb-2">
                Monthly Plan Performance – Quantity & Time
              </h3>
              <p className="text-gray-400 text-xs">
                Click the ▸ icon to view details.
              </p>
            </div>
            <div className="flex items-center gap-2 mb-4">
              <span className="text-sm font-semibold text-gray-700">
                Select
              </span>
              <span className="text-gray-400">→</span>
              <button
                type="button"
                onClick={() => setGroupMode('largeGroup')}
                className={`px-2 py-1 text-xs font-medium rounded border transition-colors ${
                  groupMode === 'largeGroup' 
                    ? 'bg-[#0d1c3d] text-white border-[#0d1c3d]' 
                    : 'bg-gray-100 text-gray-700 border-gray-300'
                }`}
              >
                Large Group
              </button>
              <button
                type="button"
                onClick={() => setGroupMode('market')}
                className={`px-2 py-1 text-xs font-medium rounded border transition-colors ${
                  groupMode === 'market' 
                    ? 'bg-[#0d1c3d] text-white border-[#0d1c3d]' 
                    : 'bg-gray-100 text-gray-700 border-gray-300'
                }`}
              >
                Market
              </button>
            </div>
            <DataTableCustomColumn
              data={treeData}
              columns={columnsAll}
              rowClassName={(row: any, rowIndex: number) => {
                if (row.isGrandTotal) return 'font-bold bg-gray-100';
                if (row.isLevel1Total) return 'font-bold bg-gray-50 cursor-pointer';
                if (row.isLevel2Total) return 'font-semibold bg-gray-100 cursor-pointer';
                if (row.isLevel3Total) return 'font-medium bg-gray-50 cursor-pointer';
                if (row.isDetail) return 'bg-white border-t border-slate-200';
                return '';
              }}
              onRowClick={(row: any) => {
                // универсальный обработчик раскрытия
                const level = row._treeLevel;
                const key = row._treeKey;
                if (typeof level === 'number' && key) {
                  const sets = groupMode === 'largeGroup'
                    ? [setExpandedLargeGroups, setExpandedLargeSubgroups]
                    : [setExpandedMarkets, setExpandedGroups, setExpandedSubgroups];
                  const set = sets[level];
                  if (set) {
                    set((prev: Set<string>) => {
                      const next = new Set(prev);
                      if (next.has(key)) next.delete(key);
                      else next.add(key);
                      return next;
                    });
                  }
                }
              }}
              cellRenderers={{
                LargeGroup: (value: any, row: any) => {
                  if (row.isGrandTotal) return <span style={{ color: '#111' }}>Total</span>;
                  if (row._treeLevel != null && row.groupLabel) {
                    const sets = groupMode === 'largeGroup'
                      ? [expandedLargeGroups, expandedLargeSubgroups]
                      : [expandedMarkets, expandedGroups, expandedSubgroups];
                    const isOpen = sets[row._treeLevel]?.has(row._treeKey);
                    // Не показывать стрелку на последнем уровне
                    const isLastLevel = (groupMode === 'largeGroup' && row._treeLevel === 1) || (groupMode === 'market' && row._treeLevel === 2);
                    return renderHierarchyCell(row._treeLevel, !!isOpen, row.groupLabel, isLastLevel ? undefined : (() => {}), isLastLevel);
                  }
                  return value;
                },
                PercentQty: (value: any, row: any) => {
                  if (row.isLevel1Total || row.isLevel2Total || row.isLevel3Total) {
                    return <ProgressCell value={value} />;
                  }
                  if (row.isGrandTotal) return <span style={{ color: '#111' }}>{parseInt(String(value), 10)}%</span>;
                  return <span style={{ color: '#6b7280' }}>{formatPercent(value)}</span>;
                },
                PercentTime: (value: any, row: any) => {
                  if (row.isLevel1Total || row.isLevel2Total || row.isLevel3Total) {
                    return <ProgressCell value={value} />;
                  }
                  if (row.isGrandTotal) return <span style={{ color: '#111' }}>{parseInt(String(value), 10)}%</span>;
                  return <span style={{ color: '#6b7280' }}>{formatPercent(value)}</span>;
                },
                PlanQty: (value: any, row: any) => {
                  if (row.isGrandTotal) return <span style={{ color: '#111' }}>{formatNumber(value)}</span>;
                  return <span style={{ color: '#6b7280' }}>{formatNumber(value)}</span>;
                },
                FactQty: (value: any, row: any) => {
                  if (row.isGrandTotal) return <span style={{ color: '#111' }}>{formatNumber(value)}</span>;
                  return <span style={{ color: '#6b7280' }}>{formatNumber(value)}</span>;
                },
                DifferentQty: (value: any, row: any) => {
                  if (row.isGrandTotal) return <span style={{ color: '#111' }}>{formatNumber(value)}</span>;
                  return <span style={{ color: '#6b7280' }}>{formatNumber(value)}</span>;
                },
                PlanTime: (value: any, row: any) => {
                  if (row.isGrandTotal) return <span style={{ color: '#111' }}>{formatNumber(value)}</span>;
                  return <span style={{ color: '#6b7280' }}>{formatNumber(value)}</span>;
                },
                FactTime: (value: any, row: any) => {
                  if (row.isGrandTotal) return <span style={{ color: '#111' }}>{formatNumber(value)}</span>;
                  return <span style={{ color: '#6b7280' }}>{formatNumber(value)}</span>;
                },
                DifferentTime: (value: any, row: any) => {
                  if (row.isGrandTotal) return <span style={{ color: '#111' }}>{formatNumber(value)}</span>;
                  return <span style={{ color: '#6b7280' }}>{formatNumber(value)}</span>;
                },
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default MonthPlanSummary; 