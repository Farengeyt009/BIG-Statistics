import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { AgGridReact } from '@ag-grid-community/react';
import type { ColDef } from '@ag-grid-community/core';
import '@ag-grid-community/styles/ag-grid.css';
import '@ag-grid-community/styles/ag-theme-quartz.css';
import { ChevronRight, ChevronDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import LoadingSpinner from '../../../../../../components/ui/LoadingSpinner';

// ─── helpers ────────────────────────────────────────────────────────────────

const fmtNum = (v: any) => {
  if (v == null || v === '') return '–';
  const n = Number(v);
  if (isNaN(n)) return '–';
  const fmt = (num: number, dec: number) =>
    num.toLocaleString('ru-RU', { minimumFractionDigits: dec, maximumFractionDigits: dec })
       .replace(/\s/g, '\u00A0');
  return Number.isInteger(n) ? fmt(n, 0) : fmt(n, 1);
};

const fmtPct = (defect: number, prodFact: number): string => {
  if (!prodFact || prodFact === 0) return '–';
  const pct = (defect / prodFact) * 100;
  if (pct === 0) return '0%';
  if (pct < 0.1) return '<0.1%';
  return `${pct.toFixed(1)}%`;
};

const pctBadgeStyle = (defect: number, prodFact: number): React.CSSProperties => {
  if (!prodFact || prodFact === 0) return {};
  const pct = (defect / prodFact) * 100;
  if (pct < 1)  return { background: '#dcfce7', color: '#15803d' };
  if (pct < 2)  return { background: '#ffedd5', color: '#ea580c' };
  return          { background: '#fee2e2', color: '#b91c1c' };
};

// ─── shared dedup helpers ─────────────────────────────────────────────────────

type DedupKey = string;
type DedupAcc = { sum: number; count: number };

const sumAvg = (m: Map<DedupKey, DedupAcc>) => {
  let total = 0;
  m.forEach(({ sum, count }) => { total += count > 0 ? sum / count : 0; });
  return total;
};

const addToMap = (m: Map<DedupKey, DedupAcc>, key: DedupKey, pf: number) => {
  const prev = m.get(key);
  if (prev) { prev.sum += pf; prev.count += 1; }
  else { m.set(key, { sum: pf, count: 1 }); }
};

/**
 * Глобальный предрасчёт среднего Prod_Fact_QTY по ключу Date+ControlTochka+OrderNo.
 * Усредняем по ВСЕМ строкам массива (независимо от DefectType/LargeGroup и т.д.)
 * Это гарантирует что оба дерева покажут одинаковое число для одного и того же заказа.
 */
function computeGlobalProdFact(rows: any[]): Map<DedupKey, number> {
  const acc = new Map<DedupKey, DedupAcc>();
  for (const r of rows) {
    const dk: DedupKey = `${r.Date || ''}|${r.Control_Tochka_Ru || ''}|${r.Prod_Order_No || ''}`;
    addToMap(acc, dk, Number(r.Prod_Fact_QTY) || 0);
  }
  const result = new Map<DedupKey, number>();
  acc.forEach(({ sum, count }, key) => result.set(key, count > 0 ? sum / count : 0));
  return result;
}

// Добавить глобальный средний Prod_Fact_QTY в локальный Set (первый раз)
const addGlobal = (
  seenSet: Set<DedupKey>,
  prodMap: Map<DedupKey, number>,
  dk: DedupKey,
  globalPF: Map<DedupKey, number>,
) => {
  if (!seenSet.has(dk)) {
    seenSet.add(dk);
    prodMap.set(dk, globalPF.get(dk) ?? 0);
  }
};

const sumSet = (m: Map<DedupKey, number>) => {
  let total = 0;
  m.forEach(v => { total += v; });
  return total;
};

/** Сортировка по % брака убыванием: defQty/prodFact desc */
const pctDesc = (dqA: number, pfA: number, dqB: number, pfB: number) => {
  const a = pfA > 0 ? dqA / pfA : 0;
  const b = pfB > 0 ? dqB / pfB : 0;
  return b - a;
};

// ─── TreeRow ──────────────────────────────────────────────────────────────────

interface TreeRow {
  __id: string;
  _level: 0 | 1 | 2 | 3 | 4 | -1;
  _key: string;
  groupLabel: string;
  Prod_Fact_QTY: number;
  Defect_QTY: number;
  Prod_Order_No?: string;
  Article?: string;
  Name?: string;
  /** true когда % = доля от итога (by-defect уровни 0-1), а не % брака */
  _isShare?: boolean;
}

// ─── Вариант 1: LargeGroup → GroupName → DefectType → Problem → Order ────────

function buildTreeByGroup(
  rows: any[], expandedL0: Set<string>, expandedL1: Set<string>,
  expandedL2: Set<string>, expandedL3: Set<string>, lang: string,
  globalPF: Map<DedupKey, number>,
): TreeRow[] {
  type OrderAcc  = { Prod_Order_No: string; Customer_Order_No: string; Article: string; Name: string; defQty: number; seen: Set<DedupKey>; prodMap: Map<DedupKey, number> };
  type ProbAcc   = { defQty: number; seen: Set<DedupKey>; prodMap: Map<DedupKey, number>; orders: Record<string, OrderAcc> };
  type DefectAcc = { defQty: number; seen: Set<DedupKey>; prodMap: Map<DedupKey, number>; problems: Record<string, ProbAcc> };
  type GroupAcc  = { defQty: number; seen: Set<DedupKey>; prodMap: Map<DedupKey, number>; defects: Record<string, DefectAcc> };
  type LgAcc     = { defQty: number; seen: Set<DedupKey>; prodMap: Map<DedupKey, number>; groups: Record<string, GroupAcc> };

  const tree: Record<string, LgAcc> = {};

  for (const r of rows) {
    const lg   = r.LargeGroup || '—';
    const grp  = r.GroupName  || '—';
    const def  = (lang === 'zh' ? r.Defect_Type_Zh : r.Defect_Type_Ru) || '—';
    const prob = r.Problem_Description || '—';
    const ord  = r.Prod_Order_No || '';
    const art  = r.Work_Nomenclature_No || '';
    const name = (lang === 'zh' ? r.Work_Nomenclature_Namezh : r.Work_Nomenclature_NameRU) || '';
    const cust = r.Customer_Order_No || '';
    const ordKey = `${ord}|${art}`;
    const dk: DedupKey = `${r.Date || ''}|${r.Control_Tochka_Ru || ''}|${ord}`;
    const dq = Number(r.Defect_QTY) || 0;

    if (!tree[lg]) tree[lg] = { defQty: 0, seen: new Set(), prodMap: new Map(), groups: {} };
    addGlobal(tree[lg].seen, tree[lg].prodMap, dk, globalPF); tree[lg].defQty += dq;

    const lgN = tree[lg];
    if (!lgN.groups[grp]) lgN.groups[grp] = { defQty: 0, seen: new Set(), prodMap: new Map(), defects: {} };
    addGlobal(lgN.groups[grp].seen, lgN.groups[grp].prodMap, dk, globalPF); lgN.groups[grp].defQty += dq;

    const grpN = lgN.groups[grp];
    if (!grpN.defects[def]) grpN.defects[def] = { defQty: 0, seen: new Set(), prodMap: new Map(), problems: {} };
    addGlobal(grpN.defects[def].seen, grpN.defects[def].prodMap, dk, globalPF); grpN.defects[def].defQty += dq;

    const defN = grpN.defects[def];
    if (!defN.problems[prob]) defN.problems[prob] = { defQty: 0, seen: new Set(), prodMap: new Map(), orders: {} };
    addGlobal(defN.problems[prob].seen, defN.problems[prob].prodMap, dk, globalPF); defN.problems[prob].defQty += dq;

    const probN = defN.problems[prob];
    if (!probN.orders[ordKey]) probN.orders[ordKey] = { Prod_Order_No: ord, Customer_Order_No: cust, Article: art, Name: name, defQty: 0, seen: new Set(), prodMap: new Map() };
    addGlobal(probN.orders[ordKey].seen, probN.orders[ordKey].prodMap, dk, globalPF); probN.orders[ordKey].defQty += dq;
  }

  const result: TreeRow[] = [];
  Object.entries(tree)
    .sort(([,a],[,b]) => pctDesc(a.defQty, sumSet(a.prodMap), b.defQty, sumSet(b.prodMap)))
    .forEach(([lg, lgD]) => {
      const lgKey = lg;
      result.push({ __id: `lg:${lgKey}`, _level: 0, _key: lgKey, groupLabel: lg, Prod_Fact_QTY: sumSet(lgD.prodMap), Defect_QTY: lgD.defQty });
      if (!expandedL0.has(lgKey)) return;

      Object.entries(lgD.groups)
        .sort(([,a],[,b]) => pctDesc(a.defQty, sumSet(a.prodMap), b.defQty, sumSet(b.prodMap)))
        .forEach(([grp, grpD]) => {
          const grpKey = `${lgKey}||${grp}`;
          result.push({ __id: `grp:${grpKey}`, _level: 1, _key: grpKey, groupLabel: grp, Prod_Fact_QTY: sumSet(grpD.prodMap), Defect_QTY: grpD.defQty });
          if (!expandedL1.has(grpKey)) return;

          Object.entries(grpD.defects)
            .sort(([,a],[,b]) => pctDesc(a.defQty, sumSet(a.prodMap), b.defQty, sumSet(b.prodMap)))
            .forEach(([def, defD]) => {
              const defKey = `${grpKey}||${def}`;
              result.push({ __id: `def:${defKey}`, _level: 2, _key: defKey, groupLabel: def, Prod_Fact_QTY: sumSet(defD.prodMap), Defect_QTY: defD.defQty });
              if (!expandedL2.has(defKey)) return;

              Object.entries(defD.problems)
                .sort(([,a],[,b]) => pctDesc(a.defQty, sumSet(a.prodMap), b.defQty, sumSet(b.prodMap)))
                .forEach(([prob, probD]) => {
                  const probKey = `${defKey}||${prob}`;
                  result.push({ __id: `prob:${probKey}`, _level: 3, _key: probKey, groupLabel: prob, Prod_Fact_QTY: sumSet(probD.prodMap), Defect_QTY: probD.defQty });
                  if (!expandedL3.has(probKey)) return;

                  Object.entries(probD.orders)
                    .sort(([,a],[,b]) => pctDesc(a.defQty, sumSet(a.prodMap), b.defQty, sumSet(b.prodMap)))
                    .forEach(([oKey, oD]) => {
                      const ordPF = sumSet(oD.prodMap);
                      result.push({ __id: `ord:${probKey}||${oKey}`, _level: 4, _key: '', groupLabel: oD.Customer_Order_No || oD.Prod_Order_No || '—', Prod_Order_No: oD.Prod_Order_No, Article: oD.Article, Name: oD.Name, Prod_Fact_QTY: ordPF, Defect_QTY: oD.defQty });
                    });
                });
            });
        });
    });
  return result;
}

// ─── Вариант 2: DefectType → Problem → LargeGroup → GroupName → Order ────────
// Уровень 0: QTY = totalDefects (итого всех дефектов), % = доля этого типа
// Уровень 1: QTY = Defect_QTY родителя, % = доля этой проблемы в типе
// Уровень 2+: QTY = Prod_Fact_QTY (факт выпуска), % = обычный % брака

function buildTreeByDefect(
  rows: any[], expandedL0: Set<string>, expandedL1: Set<string>,
  expandedL2: Set<string>, expandedL3: Set<string>, lang: string,
  globalPF: Map<DedupKey, number>,
): { rows: TreeRow[]; totalDefects: number } {
  type OrderAcc = { Prod_Order_No: string; Customer_Order_No: string; Article: string; Name: string; defQty: number; seen: Set<DedupKey>; prodMap: Map<DedupKey, number> };
  type GroupAcc = { defQty: number; seen: Set<DedupKey>; prodMap: Map<DedupKey, number>; orders: Record<string, OrderAcc> };
  type LgAcc    = { defQty: number; seen: Set<DedupKey>; prodMap: Map<DedupKey, number>; groups: Record<string, GroupAcc> };
  type ProbAcc  = { defQty: number; seen: Set<DedupKey>; prodMap: Map<DedupKey, number>; largeGroups: Record<string, LgAcc> };
  type DefAcc   = { defQty: number; seen: Set<DedupKey>; prodMap: Map<DedupKey, number>; problems: Record<string, ProbAcc> };

  const tree: Record<string, DefAcc> = {};
  let totalDefects = 0;

  for (const r of rows) {
    const def  = (lang === 'zh' ? r.Defect_Type_Zh : r.Defect_Type_Ru) || '—';
    const prob = r.Problem_Description || '—';
    const lg   = r.LargeGroup || '—';
    const grp  = r.GroupName  || '—';
    const ord  = r.Prod_Order_No || '';
    const art  = r.Work_Nomenclature_No || '';
    const name = (lang === 'zh' ? r.Work_Nomenclature_Namezh : r.Work_Nomenclature_NameRU) || '';
    const cust = r.Customer_Order_No || '';
    const ordKey = `${ord}|${art}`;
    const dk: DedupKey = `${r.Date || ''}|${r.Control_Tochka_Ru || ''}|${ord}`;
    const dq = Number(r.Defect_QTY) || 0;
    totalDefects += dq;

    if (!tree[def]) tree[def] = { defQty: 0, seen: new Set(), prodMap: new Map(), problems: {} };
    addGlobal(tree[def].seen, tree[def].prodMap, dk, globalPF); tree[def].defQty += dq;

    const defN = tree[def];
    if (!defN.problems[prob]) defN.problems[prob] = { defQty: 0, seen: new Set(), prodMap: new Map(), largeGroups: {} };
    addGlobal(defN.problems[prob].seen, defN.problems[prob].prodMap, dk, globalPF); defN.problems[prob].defQty += dq;

    const probN = defN.problems[prob];
    if (!probN.largeGroups[lg]) probN.largeGroups[lg] = { defQty: 0, seen: new Set(), prodMap: new Map(), groups: {} };
    addGlobal(probN.largeGroups[lg].seen, probN.largeGroups[lg].prodMap, dk, globalPF); probN.largeGroups[lg].defQty += dq;

    const lgN = probN.largeGroups[lg];
    if (!lgN.groups[grp]) lgN.groups[grp] = { defQty: 0, seen: new Set(), prodMap: new Map(), orders: {} };
    addGlobal(lgN.groups[grp].seen, lgN.groups[grp].prodMap, dk, globalPF); lgN.groups[grp].defQty += dq;

    const grpN = lgN.groups[grp];
    if (!grpN.orders[ordKey]) grpN.orders[ordKey] = { Prod_Order_No: ord, Customer_Order_No: cust, Article: art, Name: name, defQty: 0, seen: new Set(), prodMap: new Map() };
    addGlobal(grpN.orders[ordKey].seen, grpN.orders[ordKey].prodMap, dk, globalPF); grpN.orders[ordKey].defQty += dq;
  }

  const result: TreeRow[] = [];
  Object.entries(tree)
    .sort(([,a],[,b]) => pctDesc(a.defQty, totalDefects, b.defQty, totalDefects))
    .forEach(([def, defD]) => {
      // Уровень 0: QTY = totalDefects (общий итог), % — стандартная заливка
      result.push({ __id: `dt:${def}`, _level: 0, _key: def, groupLabel: def, Prod_Fact_QTY: totalDefects, Defect_QTY: defD.defQty });
      if (!expandedL0.has(def)) return;

      Object.entries(defD.problems)
        .sort(([,a],[,b]) => pctDesc(a.defQty, defD.defQty, b.defQty, defD.defQty))
        .forEach(([prob, probD]) => {
          const probKey = `${def}||${prob}`;
          // Уровень 1: QTY = Defect_QTY родителя, % — стандартная заливка
          result.push({ __id: `pr:${probKey}`, _level: 1, _key: probKey, groupLabel: prob, Prod_Fact_QTY: defD.defQty, Defect_QTY: probD.defQty });
          if (!expandedL1.has(probKey)) return;

          Object.entries(probD.largeGroups)
            .sort(([,a],[,b]) => pctDesc(a.defQty, sumSet(a.prodMap), b.defQty, sumSet(b.prodMap)))
            .forEach(([lg, lgD]) => {
              const lgKey = `${probKey}||${lg}`;
              // Уровень 2+: QTY = Prod_Fact_QTY (факт выпуска), % = % брака
              result.push({ __id: `lg2:${lgKey}`, _level: 2, _key: lgKey, groupLabel: lg, Prod_Fact_QTY: sumSet(lgD.prodMap), Defect_QTY: lgD.defQty });
              if (!expandedL2.has(lgKey)) return;

              Object.entries(lgD.groups)
                .sort(([,a],[,b]) => pctDesc(a.defQty, sumSet(a.prodMap), b.defQty, sumSet(b.prodMap)))
                .forEach(([grp, grpD]) => {
                  const grpKey = `${lgKey}||${grp}`;
                  result.push({ __id: `grp2:${grpKey}`, _level: 3, _key: grpKey, groupLabel: grp, Prod_Fact_QTY: sumSet(grpD.prodMap), Defect_QTY: grpD.defQty });
                  if (!expandedL3.has(grpKey)) return;

                  Object.entries(grpD.orders)
                    .sort(([,a],[,b]) => pctDesc(a.defQty, sumSet(a.prodMap), b.defQty, sumSet(b.prodMap)))
                    .forEach(([oKey, oD]) => {
                      const ordPF = sumSet(oD.prodMap);
                      result.push({ __id: `ord2:${grpKey}||${oKey}`, _level: 4, _key: '', groupLabel: oD.Customer_Order_No || oD.Prod_Order_No || '—', Prod_Order_No: oD.Prod_Order_No, Article: oD.Article, Name: oD.Name, Prod_Fact_QTY: ordPF, Defect_QTY: oD.defQty });
                    });
                });
            });
        });
    });
  return { rows: result, totalDefects };
}

// ─── Cell renderer ────────────────────────────────────────────────────────────

const HierarchyCell = (p: any) => {
  const { data, node, expandedL0, expandedL1, expandedL2, expandedL3, setExpandedL0, setExpandedL1, setExpandedL2, setExpandedL3, leafLevel } = p;
  if (!data) return <span>—</span>;
  // Pinned total row — просто жирный лейбл без отступа и стрелки
  if (node?.rowPinned === 'bottom') return <span style={{ fontWeight: 700 }}>{data.groupLabel}</span>;

  const level = data._level as 0 | 1 | 2 | 3 | 4;
  const key   = data._key;
  const pad   = [0, 16, 32, 48, 64][level];
  const isLeaf = level === (leafLevel ?? 4);

  let isExpanded = false;
  if (level === 0) isExpanded = expandedL0?.has(key);
  if (level === 1) isExpanded = expandedL1?.has(key);
  if (level === 2) isExpanded = expandedL2?.has(key);
  if (level === 3) isExpanded = expandedL3?.has(key);

  const toggle = () => {
    if (isLeaf || !key) return;
    const toggleSet = (set: Set<string>, setter: (s: Set<string>) => void) => {
      const next = new Set(set); next.has(key) ? next.delete(key) : next.add(key); setter(next);
    };
    if (level === 0) toggleSet(expandedL0, setExpandedL0);
    if (level === 1) toggleSet(expandedL1, setExpandedL1);
    if (level === 2) toggleSet(expandedL2, setExpandedL2);
    if (level === 3) toggleSet(expandedL3, setExpandedL3);
  };

  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 4, paddingLeft: pad, cursor: isLeaf ? 'default' : 'pointer' }} onClick={toggle}>
      {!isLeaf && (isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />)}
      {isLeaf  && <span style={{ width: 14, display: 'inline-block' }} />}
      <span>{data.groupLabel || '—'}</span>
    </span>
  );
};

// ─── main component ───────────────────────────────────────────────────────────

interface LQCSummaryTableProps {
  data: any[];
  loading: boolean;
  error: string | null;
  variant?: 'by-group' | 'by-defect';
  title?: string;
}

const LQCSummaryTable: React.FC<LQCSummaryTableProps> = ({ data, loading, error, variant = 'by-group', title }) => {
  const { t, i18n } = useTranslation('qc');
  const lang = i18n.language as 'en' | 'zh' | 'ru';

  const [expandedL0, setExpandedL0] = useState<Set<string>>(new Set());
  const [expandedL1, setExpandedL1] = useState<Set<string>>(new Set());
  const [expandedL2, setExpandedL2] = useState<Set<string>>(new Set());
  const [expandedL3, setExpandedL3] = useState<Set<string>>(new Set());

  const apiRef = useRef<any>(null);

  const globalPF = useMemo(() => computeGlobalProdFact(data), [data]);

  const { treeData, totalDefects } = useMemo(() => {
    if (variant === 'by-defect') {
      const { rows, totalDefects } = buildTreeByDefect(data, expandedL0, expandedL1, expandedL2, expandedL3, lang, globalPF);
      return { treeData: rows, totalDefects };
    }
    return { treeData: buildTreeByGroup(data, expandedL0, expandedL1, expandedL2, expandedL3, lang, globalPF), totalDefects: 0 };
  }, [data, variant, expandedL0, expandedL1, expandedL2, expandedL3, lang, globalPF]);

  // Уровень на котором появляются колонки Order/Article/Name (4 для обоих вариантов)
  const detailLevel = 4;
  const hasDetail = treeData.some(row => row._level >= detailLevel);

  // Пересчитываем ширины при изменении видимости колонок (detail уровень)
  useEffect(() => {
    apiRef.current?.sizeColumnsToFit();
  }, [hasDetail]);

  // Итоговая строка
  const pinnedTotalRow = useMemo(() => {
    if (variant === 'by-defect') {
      // Для by-defect: QTY = totalDefects, Defect_QTY = totalDefects, % = 100% (синий)
      return [{ __id: '__total__', _level: -1 as const, _key: '', groupLabel: t('lqc.summary.total'), Prod_Fact_QTY: totalDefects, Defect_QTY: totalDefects, _isShare: true }];
    }
    const top = treeData.filter(r => r._level === 0);
    const totalPF = top.reduce((s, r) => s + (r.Prod_Fact_QTY || 0), 0);
    const totalDQ = top.reduce((s, r) => s + (r.Defect_QTY    || 0), 0);
    return [{ __id: '__total__', _level: -1 as const, _key: '', groupLabel: t('lqc.summary.total'), Prod_Fact_QTY: totalPF, Defect_QTY: totalDQ }];
  }, [treeData, totalDefects, variant, t]);

  const stableRef = useRef({ expandedL0, expandedL1, expandedL2, expandedL3, setExpandedL0, setExpandedL1, setExpandedL2, setExpandedL3 });
  useEffect(() => { stableRef.current = { expandedL0, expandedL1, expandedL2, expandedL3, setExpandedL0, setExpandedL1, setExpandedL2, setExpandedL3 }; });

  // leafLevel: последний уровень (4 для обоих вариантов)
  const leafLevel = 4;

  const hierarchyCellRenderer = useCallback((p: any) => {
    const { expandedL0, expandedL1, expandedL2, expandedL3, setExpandedL0, setExpandedL1, setExpandedL2, setExpandedL3 } = stableRef.current;
    return <HierarchyCell {...p} expandedL0={expandedL0} expandedL1={expandedL1} expandedL2={expandedL2} expandedL3={expandedL3} setExpandedL0={setExpandedL0} setExpandedL1={setExpandedL1} setExpandedL2={setExpandedL2} setExpandedL3={setExpandedL3} leafLevel={leafLevel} />;
  }, []);

  const numCell = useCallback((p: any) => (
    <span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtNum(p.value)}</span>
  ), []);

  const isDefectVariant = variant === 'by-defect';

  const columnDefs: ColDef[] = useMemo(() => [
    {
      colId: 'group', field: 'groupLabel', headerName: t('lqc.summary.group'),
      minWidth: 220, flex: 2, cellRenderer: hierarchyCellRenderer,
    },
    {
      colId: 'article', field: 'Article', headerName: t('columns.article'),
      minWidth: 110, flex: 1, hide: !hasDetail,
      cellRenderer: (p: any) => p.data?._level === detailLevel ? (p.value || '—') : '',
    },
    {
      colId: 'name', field: 'Name', headerName: t('columns.name'),
      minWidth: 180, flex: 2, hide: !hasDetail,
      cellRenderer: (p: any) => p.data?._level === detailLevel ? (p.value || '—') : '',
    },
    {
      colId: 'prodFact', field: 'Prod_Fact_QTY',
      headerName: isDefectVariant ? t('lqc.summary.qty') : t('lqc.prodFactQty'),
      minWidth: 120, flex: 1, cellStyle: { textAlign: 'center' }, cellRenderer: numCell,
    },
    {
      colId: 'defectQty', field: 'Defect_QTY', headerName: t('lqc.defectQty'),
      minWidth: 110, flex: 1, cellStyle: { textAlign: 'center' }, cellRenderer: numCell,
    },
    {
      colId: 'defectPct', headerName: t('lqc.summary.defectPct'),
      minWidth: 90, flex: 0.8, cellStyle: { textAlign: 'center' },
      valueGetter: (p: any) => p.data ? { defect: p.data.Defect_QTY, prodFact: p.data.Prod_Fact_QTY, isShare: p.data._isShare } : null,
      cellRenderer: (p: any) => {
        const v = p.value;
        if (!v) return '–';
        const label = fmtPct(v.defect, v.prodFact);
        if (label === '–') return <span style={{ color: '#9ca3af' }}>–</span>;
        // Для строк "доля" (by-defect уровни 0-1) — нейтральный синий стиль, не красный
        const style: React.CSSProperties = v.isShare
          ? { background: '#dbeafe', color: '#1d4ed8' }
          : pctBadgeStyle(v.defect, v.prodFact);
        return (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <span style={{ padding: '1px 8px', borderRadius: 5, fontSize: 12, fontWeight: 600, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', lineHeight: '18px', ...style }}>
              {label}
            </span>
          </div>
        );
      },
    },
  ], [hasDetail, detailLevel, isDefectVariant, hierarchyCellRenderer, numCell, t]);

  const getRowStyle = useCallback((p: any) => {
    if (p.node?.rowPinned === 'bottom') return { fontWeight: 700, backgroundColor: '#f3f4f6', borderTop: '2px solid #d1d5db' };
    const lvl = p.data?._level;
    if (lvl === 0) return { fontWeight: 700, backgroundColor: expandedL0.has(p.data._key) ? '#f3f4f6' : '#ffffff' };
    if (lvl === 1) return { fontWeight: 600, backgroundColor: expandedL1.has(p.data._key) ? '#f9fafb' : '#ffffff' };
    if (lvl === 2) return { fontWeight: 500, backgroundColor: expandedL2.has(p.data._key) ? '#f0f4ff' : '#ffffff' };
    if (lvl === 3) return { fontWeight: 400, backgroundColor: expandedL3.has(p.data._key) ? '#fef9ec' : '#fafafa', color: '#374151' };
    if (lvl === 4) return { fontWeight: 400, backgroundColor: '#ffffff', color: '#6b7280' };
    return {};
  }, [expandedL0, expandedL1, expandedL2, expandedL3]);

  const defaultColDef: ColDef = { resizable: true, sortable: false, filter: false };

  if (loading) return <div className="flex justify-center items-center h-64"><LoadingSpinner overlay="screen" size="xl" /></div>;
  if (error)   return <div className="flex justify-center items-center h-64 text-red-600 text-lg">Error: {error}</div>;

  return (
    <div style={{ maxWidth: 1100 }}>
      {title && (
        <div className="px-1 py-2 mb-1 text-sm font-semibold text-[#0d1c3d] border-b border-gray-200">
          {title}
        </div>
      )}
      <div className="ag-theme-quartz w-full">
        <AgGridReact
          rowData={treeData}
          columnDefs={columnDefs}
          defaultColDef={defaultColDef}
          getRowId={(p) => p.data.__id}
          getRowStyle={getRowStyle}
          animateRows={false}
          domLayout="autoHeight"
          onGridReady={(p) => { apiRef.current = p.api; p.api.sizeColumnsToFit(); }}
          onFirstDataRendered={(p) => p.api.sizeColumnsToFit()}
          onColumnVisible={(p) => p.api.sizeColumnsToFit()}
          pinnedBottomRowData={pinnedTotalRow}
        />
      </div>
    </div>
  );
};

export default LQCSummaryTable;
