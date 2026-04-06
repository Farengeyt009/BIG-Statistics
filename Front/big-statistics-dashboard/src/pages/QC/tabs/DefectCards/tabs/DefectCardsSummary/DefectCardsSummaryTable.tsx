import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { AgGridReact } from '@ag-grid-community/react';
import type { ColDef } from '@ag-grid-community/core';
import '@ag-grid-community/styles/ag-grid.css';
import '@ag-grid-community/styles/ag-theme-quartz.css';
import { ChevronRight, ChevronDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import LoadingSpinner from '../../../../../../components/ui/LoadingSpinner';

// ─── helpers ─────────────────────────────────────────────────────────────────

const fmt = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2, minimumFractionDigits: 0 });
const fmtNum = (v: any) => {
  if (v == null || v === '') return '–';
  const n = Number(v);
  if (isNaN(n)) return '–';
  return fmt.format(n);
};

// ─── tree builder ─────────────────────────────────────────────────────────────

interface TreeRow {
  __id: string;
  _level: 0 | 1 | 2 | 3 | -1;
  _key: string;
  groupLabel: string;
  qty: number;
  totalCost: number;
}

function buildTree(
  rows: any[],
  expandedL0: Set<string>,
  expandedL1: Set<string>,
  expandedL2: Set<string>,
  lang: string,
): { treeRows: TreeRow[]; grandQty: number; grandCost: number } {
  type CommentAcc = { qty: number; cost: number };
  type CauseAcc   = { qty: number; cost: number; comments: Record<string, CommentAcc> };
  type TypeAcc    = { qty: number; cost: number; causes: Record<string, CauseAcc> };
  type DeptAcc    = { qty: number; cost: number; label: string; types: Record<string, TypeAcc> };

  const tree: Record<string, DeptAcc> = {};

  for (const r of rows) {
    const dept    = r.VinovnikDep_Ru || '—';  // stable key, language-independent
      const deptLabel = (lang === 'zh' ? r.VinovnikDep_Zh : r.VinovnikDep_Ru) || '—';
    const defType = (lang === 'zh' ? r.Defect_TypeZh  : r.Defect_TypeRu)  || '—';
    const cause   = r.Cause_of_Defect || '—';
    const comment = r.Comment || '—';
    const qty  = Number(r.QCCard_QTY)  || 0;
    const cost = qty * (Number(r.Labor_Cost) || 0);

    if (!tree[dept]) tree[dept] = { qty: 0, cost: 0, label: deptLabel, types: {} };
    tree[dept].qty  += qty;
    tree[dept].cost += cost;
    tree[dept].label = deptLabel; // update label in case language changed

    if (!tree[dept].types[defType]) tree[dept].types[defType] = { qty: 0, cost: 0, causes: {} };
    tree[dept].types[defType].qty  += qty;
    tree[dept].types[defType].cost += cost;

    if (!tree[dept].types[defType].causes[cause]) tree[dept].types[defType].causes[cause] = { qty: 0, cost: 0, comments: {} };
    tree[dept].types[defType].causes[cause].qty  += qty;
    tree[dept].types[defType].causes[cause].cost += cost;

    if (!tree[dept].types[defType].causes[cause].comments[comment]) tree[dept].types[defType].causes[cause].comments[comment] = { qty: 0, cost: 0 };
    tree[dept].types[defType].causes[cause].comments[comment].qty  += qty;
    tree[dept].types[defType].causes[cause].comments[comment].cost += cost;
  }

  let grandQty = 0;
  let grandCost = 0;
  const result: TreeRow[] = [];

  Object.entries(tree)
    .sort(([, a], [, b]) => b.cost - a.cost)
    .forEach(([dept, deptD]) => {
      grandQty  += deptD.qty;
      grandCost += deptD.cost;
      const deptKey = dept;
      result.push({ __id: `d:${deptKey}`, _level: 0, _key: deptKey, groupLabel: deptD.label, qty: deptD.qty, totalCost: deptD.cost });
      if (!expandedL0.has(deptKey)) return;

      Object.entries(deptD.types)
        .sort(([, a], [, b]) => b.cost - a.cost)
        .forEach(([defType, typeD]) => {
          const typeKey = `${deptKey}||${defType}`;
          result.push({ __id: `t:${typeKey}`, _level: 1, _key: typeKey, groupLabel: defType, qty: typeD.qty, totalCost: typeD.cost });
          if (!expandedL1.has(typeKey)) return;

          Object.entries(typeD.causes)
            .sort(([, a], [, b]) => b.cost - a.cost)
            .forEach(([cause, causeD]) => {
              const causeKey = `${typeKey}||${cause}`;
              result.push({ __id: `c:${causeKey}`, _level: 2, _key: causeKey, groupLabel: cause, qty: causeD.qty, totalCost: causeD.cost });
              if (!expandedL2.has(causeKey)) return;

              Object.entries(causeD.comments)
                .sort(([, a], [, b]) => b.cost - a.cost)
                .forEach(([comment, commentD]) => {
                  result.push({ __id: `cm:${causeKey}||${comment}`, _level: 3, _key: '', groupLabel: comment, qty: commentD.qty, totalCost: commentD.cost });
                });
            });
        });
    });

  return { treeRows: result, grandQty, grandCost };
}

// ─── HierarchyCell ────────────────────────────────────────────────────────────

const HierarchyCell = (p: any) => {
  const { data, node, expandedL0, expandedL1, expandedL2, setExpandedL0, setExpandedL1, setExpandedL2 } = p;
  if (!data) return <span>—</span>;
  if (node?.rowPinned === 'bottom') return <span style={{ fontWeight: 700 }}>{data.groupLabel}</span>;

  const level = data._level as 0 | 1 | 2 | 3;
  const key   = data._key;
  const pad   = [0, 16, 32, 48][level];
  const isLeaf = level === 3;

  let isExpanded = false;
  if (level === 0) isExpanded = expandedL0?.has(key);
  if (level === 1) isExpanded = expandedL1?.has(key);
  if (level === 2) isExpanded = expandedL2?.has(key);

  const toggle = () => {
    if (isLeaf || !key) return;
    const toggleSet = (set: Set<string>, setter: (s: Set<string>) => void) => {
      const next = new Set(set);
      next.has(key) ? next.delete(key) : next.add(key);
      setter(next);
    };
    if (level === 0) toggleSet(expandedL0, setExpandedL0);
    if (level === 1) toggleSet(expandedL1, setExpandedL1);
    if (level === 2) toggleSet(expandedL2, setExpandedL2);
  };

  return (
    <span
      style={{ display: 'flex', alignItems: 'center', gap: 4, paddingLeft: pad, cursor: isLeaf ? 'default' : 'pointer' }}
      onClick={toggle}
    >
      {!isLeaf && (isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />)}
      {isLeaf  && <span style={{ width: 14, display: 'inline-block' }} />}
      <span>{data.groupLabel || '—'}</span>
    </span>
  );
};

// ─── main component ───────────────────────────────────────────────────────────

interface Props {
  data: any[];
  loading: boolean;
  error: string | null;
  title?: string;
}

const DefectCardsSummaryTable: React.FC<Props> = ({ data, loading, error, title }) => {
  const { t, i18n } = useTranslation('qc');
  const lang = i18n.language as 'en' | 'zh' | 'ru';

  const [expandedL0, setExpandedL0] = useState<Set<string>>(new Set());
  const [expandedL1, setExpandedL1] = useState<Set<string>>(new Set());
  const [expandedL2, setExpandedL2] = useState<Set<string>>(new Set());

  const apiRef = useRef<any>(null);

  // Исключаем строки с меткой удаления (backend сериализует bytes как hex: '01' = true)
  const activeData = useMemo(
    () => data.filter(r => String(r.Delete_Mark ?? '').toLowerCase() !== '01'),
    [data],
  );

  // Auto-expand all dept (level 0) nodes on first data load using stable Ru keys
  const hasInitialized = useRef(false);
  useEffect(() => {
    if (!hasInitialized.current && activeData.length > 0) {
      hasInitialized.current = true;
      const deptKeys = new Set(activeData.map(r => r.VinovnikDep_Ru || '—'));
      setExpandedL0(deptKeys);
    }
  }, [activeData]);

  const { treeRows, grandQty, grandCost } = useMemo(
    () => buildTree(activeData, expandedL0, expandedL1, expandedL2, lang),
    [activeData, expandedL0, expandedL1, expandedL2, lang],
  );

  useEffect(() => { apiRef.current?.sizeColumnsToFit(); }, [treeRows.length]);

  const pinnedTotal = useMemo(() => ([
    { __id: '__total__', _level: -1, _key: '', groupLabel: t('lqc.summary.total'), qty: grandQty, totalCost: grandCost },
  ]), [grandQty, grandCost, t]);

  const stableRef = useRef({ expandedL0, expandedL1, expandedL2, setExpandedL0, setExpandedL1, setExpandedL2 });
  useEffect(() => {
    stableRef.current = { expandedL0, expandedL1, expandedL2, setExpandedL0, setExpandedL1, setExpandedL2 };
  });

  const hierarchyCellRenderer = useCallback((p: any) => {
    const { expandedL0, expandedL1, expandedL2, setExpandedL0, setExpandedL1, setExpandedL2 } = stableRef.current;
    return <HierarchyCell {...p} expandedL0={expandedL0} expandedL1={expandedL1} expandedL2={expandedL2} setExpandedL0={setExpandedL0} setExpandedL1={setExpandedL1} setExpandedL2={setExpandedL2} />;
  }, []);

  const numCell = useCallback((p: any) => (
    <span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtNum(p.value)}</span>
  ), []);

  const costCell = useCallback((p: any) => (
    <span style={{ fontVariantNumeric: 'tabular-nums' }}>￥{fmtNum(p.value)}</span>
  ), []);

  const columnDefs: ColDef[] = useMemo(() => [
    {
      colId: 'group', field: 'groupLabel',
      headerName: t('lqc.summary.group'),
      minWidth: 220, flex: 3,
      cellRenderer: hierarchyCellRenderer,
    },
    {
      colId: 'qty', field: 'qty',
      headerName: t('lqc.defectQty'),
      minWidth: 100, flex: 1,
      cellStyle: { textAlign: 'center' },
      cellRenderer: numCell,
    },
    {
      colId: 'totalCost', field: 'totalCost',
      headerName: t('columns.totalCost'),
      minWidth: 130, flex: 1,
      cellStyle: { textAlign: 'right' },
      cellRenderer: costCell,
    },
  ], [hierarchyCellRenderer, numCell, costCell, t]);

  const getRowStyle = useCallback((p: any) => {
    if (p.node?.rowPinned === 'bottom') return { fontWeight: 700, backgroundColor: '#f3f4f6', borderTop: '2px solid #d1d5db' };
    const lvl = p.data?._level;
    if (lvl === 0) return { fontWeight: 700, backgroundColor: expandedL0.has(p.data._key) ? '#f3f4f6' : '#ffffff' };
    if (lvl === 1) return { fontWeight: 600, backgroundColor: expandedL1.has(p.data._key) ? '#f9fafb' : '#ffffff' };
    if (lvl === 2) return { fontWeight: 500, backgroundColor: expandedL2.has(p.data._key) ? '#f0f4ff' : '#ffffff' };
    if (lvl === 3) return { fontWeight: 400, backgroundColor: '#fafafa', color: '#6b7280' };
    return {};
  }, [expandedL0, expandedL1, expandedL2]);

  const defaultColDef: ColDef = { resizable: true, sortable: false, filter: false };

  if (loading) return <div className="flex justify-center items-center h-64"><LoadingSpinner overlay="screen" size="xl" /></div>;
  if (error)   return <div className="flex justify-center items-center h-64 text-red-600 text-lg">Error: {error}</div>;

  return (
    <div style={{ maxWidth: 900, minWidth: 900, flexShrink: 0 }}>
      {title && (
        <div className="px-1 py-2 mb-1 text-sm font-semibold text-[#0d1c3d] border-b border-gray-200">
          {title}
        </div>
      )}
      <div className="ag-theme-quartz w-full">
        <AgGridReact
          rowData={treeRows}
          columnDefs={columnDefs}
          defaultColDef={defaultColDef}
          getRowId={(p) => p.data.__id}
          getRowStyle={getRowStyle}
          animateRows={false}
          domLayout="autoHeight"
          onGridReady={(p) => { apiRef.current = p.api; p.api.sizeColumnsToFit(); }}
          onFirstDataRendered={(p) => p.api.sizeColumnsToFit()}
          pinnedBottomRowData={pinnedTotal}
        />
      </div>
    </div>
  );
};

export default DefectCardsSummaryTable;
