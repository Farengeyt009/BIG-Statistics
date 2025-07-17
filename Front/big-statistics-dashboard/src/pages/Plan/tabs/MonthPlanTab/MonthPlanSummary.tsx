import React, { useState } from "react";
import { ChevronRight, ChevronDown } from "lucide-react";
import { useTranslation } from 'react-i18next';
import { DataTableCustomColumn } from '../../../../components/DataTableCustomColumn/DataTableCustomColumn';
import planFactSummary from "../../../../Test/PlanFactSummary.json";
import { formatNumber, formatPercent, calcPercent, sumBy, makeKeys } from './utils/format';
import { getTree } from './utils/tree';
import ProgressCell from './components/ProgressCell';
import PlanCumulativeChart from './components/PlanCumulativeChart';
import StatisticalCardContainer from './components/StatisticalCardContainer';

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
  const data1 = (planFactSummary as any).table1 || [];
  const data2 = (planFactSummary as any).table2 || [];
  const [groupMode, setGroupMode] = useState<'largeGroup' | 'market'>('largeGroup');
  const [expandedMarkets, setExpandedMarkets] = useState<Set<string>>(new Set());
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [expandedSubgroups, setExpandedSubgroups] = useState<Set<string>>(new Set());
  const [expandedLargeGroups, setExpandedLargeGroups] = useState<Set<string>>(new Set());
  const [expandedLargeSubgroups, setExpandedLargeSubgroups] = useState<Set<string>>(new Set());
  const [cardViewMode, setCardViewMode] = useState<'quantity' | 'time'>('quantity');

  // Подготовка данных для карточек в зависимости от режима
  const rawDataForQuantityCard = data1.map((item: any) => ({
    day: 1,
    plan: cardViewMode === 'quantity' ? Number(item.PlanQty) || 0 : Number(item.PlanTime) || 0,
    fact: cardViewMode === 'quantity' ? Number(item.FactQty) || 0 : Number(item.FactTime) || 0
  }));

  // Подготовка данных для второй карточки (Water heater)
  const rawDataForWaterHeaterCard = data1
    .filter((item: any) => item.LargeGroup === 'Water heater')
    .map((item: any) => ({
      day: 1,
      plan: cardViewMode === 'quantity' ? Number(item.PlanQty) || 0 : Number(item.PlanTime) || 0,
      fact: cardViewMode === 'quantity' ? Number(item.FactQty) || 0 : Number(item.FactTime) || 0
    }));

  // Расчёт для первой карточки
  const totalFactQty = rawDataForQuantityCard.reduce((sum: number, item: any) => sum + item.fact, 0);
  const totalPlanQty = rawDataForQuantityCard.reduce((sum: number, item: any) => sum + item.plan, 0);
  const completionPercentageQty = totalPlanQty > 0 ? Math.round((totalFactQty / totalPlanQty) * 100) : 0;

  // Расчёт для второй карточки (Water heater)
  const totalFactWaterHeater = rawDataForWaterHeaterCard.reduce((sum: number, item: any) => sum + item.fact, 0);
  const totalPlanWaterHeater = rawDataForWaterHeaterCard.reduce((sum: number, item: any) => sum + item.plan, 0);
  const completionPercentageWaterHeater = totalPlanWaterHeater > 0 ? Math.round((totalFactWaterHeater / totalPlanWaterHeater) * 100) : 0;

  // Подготовка данных для третьей карточки (прочее - все кроме Water heater)
  const rawDataForOtherCard = data1
    .filter((item: any) => item.LargeGroup !== 'Water heater')
    .map((item: any) => ({
      day: 1,
      plan: cardViewMode === 'quantity' ? Number(item.PlanQty) || 0 : Number(item.PlanTime) || 0,
      fact: cardViewMode === 'quantity' ? Number(item.FactQty) || 0 : Number(item.FactTime) || 0
    }));

  // Расчёт для третьей карточки (прочее)
  const totalFactOther = rawDataForOtherCard.reduce((sum: number, item: any) => sum + item.fact, 0);
  const totalPlanOther = rawDataForOtherCard.reduce((sum: number, item: any) => sum + item.plan, 0);
  const completionPercentageOther = totalPlanOther > 0 ? Math.round((totalFactOther / totalPlanOther) * 100) : 0;

  const columnsAll = [
    { id: 'LargeGroup', accessorKey: 'LargeGroup', header: () => t('svodTable.LargeGroup') },
    ...ALL_KEYS
  ];

  const groupKeys = groupMode === 'largeGroup' ? ['LargeGroup', 'GroupName'] : ['Market', 'LargeGroup', 'GroupName'];
  const expandedSets = groupMode === 'largeGroup'
    ? [expandedLargeGroups, expandedLargeSubgroups]
    : [expandedMarkets, expandedGroups, expandedSubgroups];
  const treeData = getTree(data1, groupKeys, ...expandedSets);

  return (
    <div className="p-4">
      <div style={{ display: 'flex', flexDirection: 'row', gap: 12, justifyContent: 'center' }}>
        {/* Карточки статистики */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
          {/* Заголовок и селектор */}
          <div style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'flex-start', 
            width: '100%'
          }}>
            <div style={{ 
              fontWeight: 600, 
              fontSize: 20, 
              marginBottom: 4,
              textAlign: 'left'
            }}>
              Plan Snapshot
            </div>
            <div style={{ 
              color: '#6b7280', 
              fontSize: 14, 
              lineHeight: 1.5, 
              marginBottom: 2,
              textAlign: 'left'
            }}>
              At‑a‑glance view of<br/>
              monthly plan totals,<br/>
              actual outputs, and<br/>
              overall completion %.
            </div>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: 0, 
              minHeight: 36 
            }}>
              <span style={{ 
                color: '#374151', 
                fontSize: 14, 
                fontWeight: 600, 
                marginRight: 6, 
                userSelect: 'none', 
                whiteSpace: 'nowrap', 
                letterSpacing: 0.2 
              }}>
                Select
              </span>
              <span style={{ 
                color: '#a3a3a3', 
                fontSize: 18, 
                marginRight: 10, 
                marginLeft: 2, 
                userSelect: 'none' 
              }}>→</span>
              <button
                type="button"
                onClick={() => setCardViewMode('quantity')}
                style={{
                  padding: '1px 8px',
                  fontSize: 11,
                  borderRadius: 5,
                  fontWeight: 500,
                  border: '1px solid',
                  borderColor: cardViewMode === 'quantity' ? '#0d1c3d' : '#d1d5db',
                  background: cardViewMode === 'quantity' ? '#0d1c3d' : '#f3f4f6',
                  color: cardViewMode === 'quantity' ? '#fff' : '#374151',
                  marginRight: 3,
                  transition: 'all 0.15s',
                  outline: 'none',
                  cursor: 'pointer',
                }}
              >
                Quantity
              </button>
              <button
                type="button"
                onClick={() => setCardViewMode('time')}
                style={{
                  padding: '1px 8px',
                  fontSize: 11,
                  borderRadius: 5,
                  fontWeight: 500,
                  border: '1px solid',
                  borderColor: cardViewMode === 'time' ? '#0d1c3d' : '#d1d5db',
                  background: cardViewMode === 'time' ? '#0d1c3d' : '#f3f4f6',
                  color: cardViewMode === 'time' ? '#fff' : '#374151',
                  marginLeft: 3,
                  transition: 'all 0.15s',
                  outline: 'none',
                  cursor: 'pointer',
                }}
              >
                Time
              </button>
            </div>
          </div>
          <div style={{ height: 12 }} />
          {/* Первая карточка */}
          <StatisticalCardContainer
            rawData={rawDataForQuantityCard}
            headline={`${completionPercentageQty}%`}
            subtext={`Total plan, ${cardViewMode === 'quantity' ? 'psc' : 'hrs'}`}
          />
          <div style={{ height: 12 }} />
          {/* Вторая карточка (прочее - все кроме Water heater) */}
          <StatisticalCardContainer
            rawData={rawDataForOtherCard}
            headline={`${completionPercentageOther}%`}
            subtext={`Heater, ${cardViewMode === 'quantity' ? 'psc' : 'hrs'}`}
          />
          <div style={{ height: 12 }} />
          {/* Третья карточка (Water heater) */}
          <StatisticalCardContainer
            rawData={rawDataForWaterHeaterCard}
            headline={`${completionPercentageWaterHeater}%`}
            subtext={`Water heater, ${cardViewMode === 'quantity' ? 'psc' : 'hrs'}`}
          />
        </div>
        {/* Вертикальная разделительная линия между карточками и графиком */}
        <div style={{ width: 0, borderLeft: '1px solid #D1D5DB', margin: '0 8px', alignSelf: 'stretch', minHeight: 420 }} />
        {/* Второй график (существующий) */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <PlanCumulativeChart table2={data2} year={year} month={month} />
        </div>
        {/* Вертикальная разделительная линия */}
        <div style={{ width: 0, borderLeft: '1px solid #D1D5DB', margin: '0 12px', alignSelf: 'stretch', minHeight: 420 }} />
        {/* Таблица */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div
            className="bg-white p-4"
            style={{
              display: 'inline-block',
              zoom: 0.96,
              transform: 'scale(1)',
              transformOrigin: 'top left'
            }}
          >
            {/* Заголовок и пояснение */}
            <div style={{ marginLeft: 0, marginTop: -18, marginBottom: 18 }}>
              <div style={{ fontWeight: 600, fontSize: 20, marginBottom: 4 }}>
                Monthly Plan Performance – Quantity & Time
              </div>
              <div style={{ color: '#6b7280', fontSize: 14, lineHeight: 1.5, marginBottom: 2 }}>
                Analyze plan fulfillment in the following breakdowns:<br/>
                • Large Group → Model (en)<br/>
                • Market → Large Group → Model (en)
              </div>
              <div style={{ color: '#a3a3a3', fontSize: 13, marginTop: 2 }}>
                Click the ▸ icon to view details.
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 14, minHeight: 36 }}>
              <span style={{ color: '#374151', fontSize: 14, fontWeight: 600, marginRight: 6, userSelect: 'none', whiteSpace: 'nowrap', letterSpacing: 0.2 }}>
                Select
              </span>
              <span style={{ color: '#a3a3a3', fontSize: 18, marginRight: 10, marginLeft: 2, userSelect: 'none' }}>→</span>
              <button
                type="button"
                onClick={() => setGroupMode('largeGroup')}
                style={{
                  padding: '1px 8px',
                  fontSize: 11,
                  borderRadius: 5,
                  fontWeight: 500,
                  border: '1px solid',
                  borderColor: groupMode === 'largeGroup' ? '#0d1c3d' : '#d1d5db',
                  background: groupMode === 'largeGroup' ? '#0d1c3d' : '#f3f4f6',
                  color: groupMode === 'largeGroup' ? '#fff' : '#374151',
                  marginRight: 3,
                  transition: 'all 0.15s',
                  outline: 'none',
                  cursor: 'pointer',
                }}
              >
                Large Group
              </button>
              <button
                type="button"
                onClick={() => setGroupMode('market')}
                style={{
                  padding: '1px 8px',
                  fontSize: 11,
                  borderRadius: 5,
                  fontWeight: 500,
                  border: '1px solid',
                  borderColor: groupMode === 'market' ? '#0d1c3d' : '#d1d5db',
                  background: groupMode === 'market' ? '#0d1c3d' : '#f3f4f6',
                  color: groupMode === 'market' ? '#fff' : '#374151',
                  marginLeft: 3,
                  transition: 'all 0.15s',
                  outline: 'none',
                  cursor: 'pointer',
                }}
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