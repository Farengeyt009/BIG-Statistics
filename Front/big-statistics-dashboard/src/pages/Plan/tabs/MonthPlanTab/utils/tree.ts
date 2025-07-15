import { calcPercent } from './format';

// Универсальная функция построения дерева для сводной таблицы
type Row = Record<string, any>;
export function getTree(
  data: Row[],
  groupKeys: string[],
  expandedSet1?: Set<string>,
  expandedSet2?: Set<string>,
  expandedSet3?: Set<string>
): Row[] {
  // groupKeys: например, ['LargeGroup', 'GroupName'] или ['Market', 'LargeGroup', 'GroupName']
  // expandedSet1, expandedSet2, expandedSet3 — Set для раскрытия уровней (можно передавать null)

  // Рекурсивная функция группировки
  function groupByLevel(
    rows: Row[],
    keys: string[],
    level = 0,
    parentKey = ''
  ): Row[] {
    if (level >= keys.length) return []; // Не добавлять leaf-узлы (детали)
    const key = keys[level];
    const groups: Record<string, Row[]> = {};
    rows.forEach(row => {
      const val = row[key] || '—';
      if (!groups[val]) groups[val] = [];
      groups[val].push(row);
    });
    let result: Row[] = [];
    Object.entries(groups).forEach(([groupVal, groupRows]) => {
      // Суммируем все нужные поля
      const planQty = groupRows.reduce((s, r) => s + (Number(r.PlanQty) || 0), 0);
      const factQty = groupRows.reduce((s, r) => s + (Number(r.FactQty) || 0), 0);
      const diffQty = groupRows.reduce((s, r) => s + (Number(r.DifferentQty) || 0), 0);
      const planTime = groupRows.reduce((s, r) => s + (Number(r.PlanTime) || 0), 0);
      const factTime = groupRows.reduce((s, r) => s + (Number(r.FactTime) || 0), 0);
      const diffTime = groupRows.reduce((s, r) => s + (Number(r.DifferentTime) || 0), 0);
      const percentQty = calcPercent(planQty, factQty);
      const percentTime = calcPercent(planTime, factTime);
      // Ключ для раскрытия
      const thisKey = parentKey ? parentKey + '||' + groupVal : groupVal;
      // Итоговая строка группы
      result.push({
        [`isLevel${level + 1}Total`]: true,
        groupLabel: groupVal,
        PlanQty: planQty,
        FactQty: factQty,
        DifferentQty: diffQty,
        PercentQty: percentQty,
        PlanTime: planTime,
        FactTime: factTime,
        DifferentTime: diffTime,
        PercentTime: percentTime,
        _treeKey: thisKey,
        _treeLevel: level,
      });
      // Если раскрыто — рекурсивно добавляем детей
      const expandedSet = [expandedSet1, expandedSet2, expandedSet3][level];
      if (expandedSet && expandedSet.has(thisKey)) {
        const children = groupByLevel(groupRows, keys, level + 1, thisKey);
        result = result.concat(children);
      }
    });
    return result;
  }
  const result = groupByLevel(data, groupKeys);
  // Добавляем строку Total только для первого уровня (например, LargeGroup)
  if (groupKeys.length === 2 && result.length) {
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
    const percentQty = calcPercent(totalPlanQty, totalFactQty);
    const percentTime = calcPercent(totalPlanTime, totalFactTime);
    result.push({
      isGrandTotal: true,
      groupLabel: 'Total',
      PlanQty: totalPlanQty,
      FactQty: totalFactQty,
      DifferentQty: totalDiffQty,
      PercentQty: percentQty,
      PlanTime: totalPlanTime,
      FactTime: totalFactTime,
      DifferentTime: totalDiffTime,
      PercentTime: percentTime,
      _treeLevel: 0,
    });
  }
  return result;
} 