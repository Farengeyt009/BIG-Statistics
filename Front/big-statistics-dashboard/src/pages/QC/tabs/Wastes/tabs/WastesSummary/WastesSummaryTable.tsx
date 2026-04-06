import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { AgGridReact } from '@ag-grid-community/react';
import type { ColDef } from '@ag-grid-community/core';
import '@ag-grid-community/styles/ag-grid.css';
import '@ag-grid-community/styles/ag-theme-quartz.css';
import { ChevronRight, ChevronDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import LoadingSpinner from '../../../../../../components/ui/LoadingSpinner';

// ─── helpers ──────────────────────────────────────────────────────────────────

const fmt = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2, minimumFractionDigits: 0 });
const fmtNum = (v: any) => {
  if (v == null || v === '' || v === 0) return '';
  const n = Number(v);
  if (isNaN(n) || n === 0) return '';
  return fmt.format(n);
};

// ─── types ────────────────────────────────────────────────────────────────────

interface TreeRow {
  __id: string;
  _level: 0 | 1 | 2 | -1;
  _key: string;
  groupLabel: string;
  name?: string;
  weightFact: number;     // production weight
  weightDefect: number;   // defect/waste weight
  costDefect: number;     // defect/waste cost
}

type ArticleDefectAcc = { weightDefect: number; costDefect: number };
type CatAcc = {
  weightDefect: number;
  costDefect: number;
  articles: Record<string, ArticleDefectAcc>;
};
type WorkshopAcc = {
  cats: Record<string, CatAcc>;
  articleWeights: Record<string, number>; // summed production weight per article
  articleNames: Record<string, string>;
};

// ─── tree builder ─────────────────────────────────────────────────────────────

function buildTree(
  stampingData: any[],
  injectionData: any[],
  expandedL0: Set<string>,
  expandedL1: Set<string>,
  catLabels: { others: string; debugging: string; sprue: string },
  workshopLabels: { stamping: string; injection: string },
): { treeRows: TreeRow[]; grandWeightFact: number; grandWeightDefect: number; grandCostDefect: number } {

  const tree: Record<string, WorkshopAcc> = {};

  const ensureWorkshop = (wsKey: string) => {
    if (!tree[wsKey]) tree[wsKey] = { cats: {}, articleWeights: {}, articleNames: {} };
  };

  const ensureCat = (ws: WorkshopAcc, catKey: string) => {
    if (!ws.cats[catKey]) ws.cats[catKey] = { weightDefect: 0, costDefect: 0, articles: {} };
  };

  const addDefect = (ws: WorkshopAcc, catKey: string, art: string, weightDefect: number, costDefect: number) => {
    ensureCat(ws, catKey);
    ws.cats[catKey].weightDefect += weightDefect;
    ws.cats[catKey].costDefect   += costDefect;
    if (!ws.cats[catKey].articles[art]) ws.cats[catKey].articles[art] = { weightDefect: 0, costDefect: 0 };
    ws.cats[catKey].articles[art].weightDefect += weightDefect;
    ws.cats[catKey].articles[art].costDefect   += costDefect;
  };

  // Stamping rows
  for (const r of stampingData) {
    const wsKey = '__stamping__';
    const art   = r.NomenclatureNumber || '—';
    const name  = r.ProductName_CN || '';
    ensureWorkshop(wsKey);
    const ws = tree[wsKey];
    ws.articleNames[art]    = name;
    ws.articleWeights[art]  = (ws.articleWeights[art] || 0) + (Number(r.Weight_FACT) || 0);

    const othersW = Number(r.Weight_Others)   || 0;
    const othersC = Number(r.Cost_Others)     || 0;
    if (othersW || othersC) addDefect(ws, catLabels.others, art, othersW, othersC);

    const debugW = Number(r.Weight_Debugging) || 0;
    const debugC = Number(r.Cost_Debugging)   || 0;
    if (debugW || debugC) addDefect(ws, catLabels.debugging, art, debugW, debugC);
  }

  // Injection rows
  for (const r of injectionData) {
    const wsKey = '__injection__';
    const art   = r.NomenclatureNumber || '—';
    const name  = r.ProductName_CN || '';
    ensureWorkshop(wsKey);
    const ws = tree[wsKey];
    ws.articleNames[art]   = name;
    ws.articleWeights[art] = (ws.articleWeights[art] || 0) + (Number(r.WeightTotal_FACT) || 0);

    const othersW = Number(r.WeightOthers)     || 0;
    const othersC = Number(r.CostOthers)       || 0;
    if (othersW || othersC) addDefect(ws, catLabels.others, art, othersW, othersC);

    const debugW = Number(r.WeightDebugging)   || 0;
    const debugC = Number(r.CostDebugging)     || 0;
    if (debugW || debugC) addDefect(ws, catLabels.debugging, art, debugW, debugC);

    const sprueW = Number(r.WeightWastes_FACT) || 0;
    const sprueC = Number(r.CostWastes_FACT)   || 0;
    if (sprueW || sprueC) addDefect(ws, catLabels.sprue, art, sprueW, sprueC);
  }

  let grandWeightFact = 0, grandWeightDefect = 0, grandCostDefect = 0;
  const result: TreeRow[] = [];

  for (const [wsKey, wsLabel] of [['__stamping__', workshopLabels.stamping], ['__injection__', workshopLabels.injection]] as [string, string][]) {
    const ws = tree[wsKey];
    if (!ws) continue;

    // Workshop totals
    const wsWeightFact    = Object.values(ws.articleWeights).reduce((s, v) => s + v, 0);
    const wsWeightDefect  = Object.values(ws.cats).reduce((s, c) => s + c.weightDefect, 0);
    const wsCostDefect    = Object.values(ws.cats).reduce((s, c) => s + c.costDefect, 0);

    grandWeightFact   += wsWeightFact;
    grandWeightDefect += wsWeightDefect;
    grandCostDefect   += wsCostDefect;

    result.push({ __id: `ws:${wsKey}`, _level: 0, _key: wsKey, groupLabel: wsLabel, weightFact: wsWeightFact, weightDefect: wsWeightDefect, costDefect: wsCostDefect });
    if (!expandedL0.has(wsKey)) continue;

    Object.entries(ws.cats)
      .sort(([, a], [, b]) => b.costDefect - a.costDefect)
      .forEach(([catKey, catD]) => {
        const l1Key = `${wsKey}||${catKey}`;
        // Level 1: weightFact = workshop total (same context), weightDefect = category sum
        result.push({ __id: `cat:${l1Key}`, _level: 1, _key: l1Key, groupLabel: catKey, weightFact: wsWeightFact, weightDefect: catD.weightDefect, costDefect: catD.costDefect });
        if (!expandedL1.has(l1Key)) return;

        Object.entries(catD.articles)
          .sort(([artA, a], [artB, b]) => {
            const factA = ws.articleWeights[artA] || 0;
            const factB = ws.articleWeights[artB] || 0;
            const pctA  = factA > 0 ? a.weightDefect / factA : 0;
            const pctB  = factB > 0 ? b.weightDefect / factB : 0;
            return pctB - pctA;
          })
          .forEach(([art, artD]) => {
            // Level 2: weightFact = article's own production weight
            result.push({ __id: `art:${l1Key}||${art}`, _level: 2, _key: '', groupLabel: art, name: ws.articleNames[art] || '', weightFact: ws.articleWeights[art] || 0, weightDefect: artD.weightDefect, costDefect: artD.costDefect });
          });
      });
  }

  return { treeRows: result, grandWeightFact, grandWeightDefect, grandCostDefect };
}

// ─── HierarchyCell ────────────────────────────────────────────────────────────

const HierarchyCell = (p: any) => {
  const { data, node, expandedL0, expandedL1, setExpandedL0, setExpandedL1 } = p;
  if (!data) return <span>—</span>;
  if (node?.rowPinned === 'bottom') return <span style={{ fontWeight: 700 }}>{data.groupLabel}</span>;

  const level  = data._level as 0 | 1 | 2;
  const key    = data._key;
  const pad    = [0, 16, 32][level];
  const isLeaf = level === 2;

  let isExpanded = false;
  if (level === 0) isExpanded = expandedL0?.has(key);
  if (level === 1) isExpanded = expandedL1?.has(key);

  const toggle = () => {
    if (isLeaf || !key) return;
    const toggleSet = (set: Set<string>, setter: (s: Set<string>) => void) => {
      const next = new Set(set); next.has(key) ? next.delete(key) : next.add(key); setter(next);
    };
    if (level === 0) toggleSet(expandedL0, setExpandedL0);
    if (level === 1) toggleSet(expandedL1, setExpandedL1);
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

interface Props {
  stampingData: any[];
  injectionData: any[];
  loading: boolean;
  error: string | null;
  title?: string;
}

const WastesSummaryTable: React.FC<Props> = ({ stampingData, injectionData, loading, error, title }) => {
  const { t, i18n } = useTranslation('qc');
  const lang = i18n.language as 'en' | 'zh' | 'ru';

  const [expandedL0, setExpandedL0] = useState<Set<string>>(new Set());
  const [expandedL1, setExpandedL1] = useState<Set<string>>(new Set());

  const apiRef = useRef<any>(null);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const workshopLabels = useMemo(() => ({ stamping: t('wastes.tabs.stamping'), injection: t('wastes.tabs.injection') }), [t, lang]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const catLabels = useMemo(() => ({ others: t('wastes.summary.others'), debugging: t('wastes.summary.debugging'), sprue: t('wastes.summary.sprue') }), [t, lang]);

  // Разворачиваем оба цеха (level 0) при первом открытии — используем стабильные ключи
  const hasInitialized = useRef(false);
  useEffect(() => {
    if (!hasInitialized.current) {
      hasInitialized.current = true;
      setExpandedL0(new Set(['__stamping__', '__injection__']));
    }
  }, []);

  const { treeRows, grandWeightFact, grandWeightDefect, grandCostDefect } = useMemo(
    () => buildTree(stampingData, injectionData, expandedL0, expandedL1, catLabels, workshopLabels),
    [stampingData, injectionData, expandedL0, expandedL1, catLabels, workshopLabels],
  );

  const hasLeaf = treeRows.some(r => r._level === 2);
  useEffect(() => { apiRef.current?.sizeColumnsToFit(); }, [hasLeaf]);

  const pinnedTotal = useMemo(() => ([{
    __id: '__total__', _level: -1, _key: '', groupLabel: t('lqc.summary.total'),
    weightFact: grandWeightFact, weightDefect: grandWeightDefect, costDefect: grandCostDefect,
  }]), [grandWeightFact, grandWeightDefect, grandCostDefect, t]);

  const stableRef = useRef({ expandedL0, expandedL1, setExpandedL0, setExpandedL1 });
  useEffect(() => { stableRef.current = { expandedL0, expandedL1, setExpandedL0, setExpandedL1 }; });

  const hierarchyCellRenderer = useCallback((p: any) => {
    const { expandedL0, expandedL1, setExpandedL0, setExpandedL1 } = stableRef.current;
    return <HierarchyCell {...p} expandedL0={expandedL0} expandedL1={expandedL1} setExpandedL0={setExpandedL0} setExpandedL1={setExpandedL1} />;
  }, []);

  const numCell = useCallback((p: any) => (
    <span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtNum(p.value)}</span>
  ), []);

  const columnDefs: ColDef[] = useMemo(() => [
    {
      colId: 'group', field: 'groupLabel',
      headerName: t('lqc.summary.group'),
      minWidth: 180, flex: 2,
      cellRenderer: hierarchyCellRenderer,
    },
    {
      colId: 'name', field: 'name',
      headerName: t('columns.name'),
      minWidth: 160, flex: 2,
      hide: !hasLeaf,
      cellRenderer: (p: any) => p.data?._level === 2 ? (p.value || '—') : '',
    },
    {
      colId: 'weightFact', field: 'weightFact',
      headerName: t('wastes.columns.weightFact'),
      minWidth: 130, flex: 1,
      cellStyle: { textAlign: 'right' },
      cellRenderer: numCell,
    },
    {
      colId: 'weightDefect', field: 'weightDefect',
      headerName: t('wastes.summary.defectWeight'),
      minWidth: 130, flex: 1,
      cellStyle: { textAlign: 'right' },
      cellRenderer: numCell,
    },
    {
      colId: 'defectPct',
      headerName: t('lqc.summary.defectPct'),
      minWidth: 90, flex: 0.8,
      cellStyle: { textAlign: 'center' },
      valueGetter: (p: any) => p.data ? { defect: p.data.weightDefect, fact: p.data.weightFact } : null,
      cellRenderer: (p: any) => {
        const v = p.value;
        if (!v || !v.fact) return <span style={{ color: '#9ca3af' }}>–</span>;
        const pct = (v.defect / v.fact) * 100;
        if (pct === 0) return <span style={{ color: '#9ca3af' }}>–</span>;
        const label = pct < 0.01 ? '<0.01%' : `${pct.toFixed(2)}%`;
        const style: React.CSSProperties =
          pct < 1  ? { background: '#dcfce7', color: '#15803d' } :
          pct < 5  ? { background: '#ffedd5', color: '#ea580c' } :
                     { background: '#fee2e2', color: '#b91c1c' };
        return (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <span style={{ padding: '1px 8px', borderRadius: 5, fontSize: 12, fontWeight: 600, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', lineHeight: '18px', ...style }}>
              {label}
            </span>
          </div>
        );
      },
    },
    {
      colId: 'costDefect', field: 'costDefect',
      headerName: t('wastes.summary.defectCost'),
      minWidth: 130, flex: 1,
      cellStyle: { textAlign: 'right' },
      cellRenderer: (p: any) => {
        const v = fmtNum(p.value);
        return <span style={{ fontVariantNumeric: 'tabular-nums' }}>{v ? `￥${v}` : ''}</span>;
      },
    },
  ], [hierarchyCellRenderer, numCell, hasLeaf, t]);

  const getRowStyle = useCallback((p: any) => {
    if (p.node?.rowPinned === 'bottom') return { fontWeight: 700, backgroundColor: '#f3f4f6', borderTop: '2px solid #d1d5db' };
    const lvl = p.data?._level;
    if (lvl === 0) return { fontWeight: 700, backgroundColor: expandedL0.has(p.data._key) ? '#f3f4f6' : '#ffffff' };
    if (lvl === 1) return { fontWeight: 500, backgroundColor: expandedL1.has(p.data._key) ? '#f9fafb' : '#ffffff' };
    if (lvl === 2) return { fontWeight: 400, backgroundColor: '#fafafa', color: '#6b7280' };
    return {};
  }, [expandedL0, expandedL1]);

  const defaultColDef: ColDef = { resizable: true, sortable: false, filter: false };

  if (loading) return <div className="flex justify-center items-center h-64"><LoadingSpinner overlay="screen" size="xl" /></div>;
  if (error)   return <div className="flex justify-center items-center h-64 text-red-600 text-lg">Error: {error}</div>;

  return (
    <div style={{ maxWidth: 1000, minWidth: 1000, flexShrink: 0 }}>
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
          onColumnVisible={(p) => p.api.sizeColumnsToFit()}
          pinnedBottomRowData={pinnedTotal}
        />
      </div>
    </div>
  );
};

export default WastesSummaryTable;
