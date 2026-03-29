import React from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, BarChart2, Package, Circle } from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────
interface DeptRow {
  WorkShopID: string;
  WorkShopName_CH: string;
  WorkShop_Ru: string;
  Prod_QTY: number | null;
  Prod_CostTotal: number | null;
  Detection_QTY: number | null;
  Detection_CostTotal: number | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt = (v: number | null | undefined): string => {
  if (v == null || v === 0) return '';
  return Math.round(Number(v)).toLocaleString('ru-RU');
};

const fmtCost = (v: number | null | undefined): string => {
  if (v == null || v === 0) return '';
  return `¥ ${fmt(v)}`;
};

// ── Reusable card shell ───────────────────────────────────────────────────────
interface CardProps {
  title: string;
  icon?: React.ReactNode;
  headerRight?: React.ReactNode;
  children: React.ReactNode;
  minH?: string;
}

const Card: React.FC<CardProps> = ({ title, icon, headerRight, children, minH = 'min-h-[180px]' }) => (
  <div className={`bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow ${minH}`}>
    <div className="bg-gray-50 px-6 py-3 rounded-t-xl border-b border-gray-200">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {icon && <span className="text-gray-400">{icon}</span>}
          <h3 className="text-base font-semibold text-gray-800 leading-none">{title}</h3>
        </div>
        {headerRight}
      </div>
    </div>
    <div className="px-6 py-4">{children}</div>
  </div>
);

// ── Skeleton row ──────────────────────────────────────────────────────────────
const SkeletonRow: React.FC = () => (
  <div className="flex items-center justify-between py-2.5 border-b border-gray-100 last:border-0">
    <div className="h-3.5 w-2/5 rounded bg-gray-200 animate-pulse" />
    <div className="h-3.5 w-1/4 rounded bg-gray-200 animate-pulse" />
  </div>
);


// ── Donut ─────────────────────────────────────────────────────────────────────
const Donut: React.FC<{
  segments: { color: string; pct: number }[];
  center: string;
  sizePx?: number;
  stroke?: number;
  centerSize?: number;
}> = ({ segments, center, sizePx = 80, stroke = 16, centerSize = 10 }) => {
  let offset = 0;
  const r = 50 - stroke / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative flex-shrink-0" style={{ width: sizePx, height: sizePx }}>
      <svg viewBox="0 0 100 100" style={{ width: sizePx, height: sizePx }} className="-rotate-90">
        {segments.map((s, i) => {
          const dash = (s.pct / 100) * c;
          const el = (
            <circle
              key={i}
              cx="50" cy="50" r={r}
              fill="none"
              stroke={s.color}
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={`${dash} ${c - dash}`}
              strokeDashoffset={-offset}
            />
          );
          offset += dash;
          return el;
        })}
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span style={{ fontSize: centerSize }} className="font-bold text-gray-700 text-center leading-tight px-1">{center}</span>
      </div>
    </div>
  );
};

// ═════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═════════════════════════════════════════════════════════════════════════════
interface DefectCardsDashboardProps {
  startDate: Date | null;
  endDate: Date | null;
}


const DEPT_COLORS = [
  '#ef4444', '#f97316', '#a855f7', '#6366f1',
  '#0ea5e9', '#14b8a6', '#84cc16', '#eab308',
  '#ec4899', '#64748b',
];

const DefectCardsDashboard: React.FC<DefectCardsDashboardProps> = ({ startDate, endDate }) => {
  const { t, i18n } = useTranslation('qc');
  const lang = i18n.language as 'en' | 'zh' | 'ru';

  const toLocalDate = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const dateFrom = startDate ? toLocalDate(startDate) : undefined;
  const dateTo   = endDate   ? toLocalDate(endDate)   : undefined;

  const { data, isLoading, isError } = useQuery<DeptRow[]>({
    queryKey: ['production-vs-defects', dateFrom, dateTo],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (dateFrom) params.append('date_from', dateFrom);
      if (dateTo)   params.append('date_to',   dateTo);
      const res = await fetch(`/api/qc/production-vs-defects?${params.toString()}`);
      if (!res.ok) throw new Error('Network error');
      const json = await res.json();
      if (!json.success) throw new Error(json.error ?? 'API error');
      return json.data as DeptRow[];
    },
  });

  const { data: movementSummary } = useQuery<{ QTY: number | null; Total_Cost: number | null }>({
    queryKey: ['defects-movement-summary', dateFrom, dateTo],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (dateFrom) params.append('date_from', dateFrom);
      if (dateTo)   params.append('date_to',   dateTo);
      const res = await fetch(`/api/qc/defects-movement-summary?${params.toString()}`);
      if (!res.ok) throw new Error('Network error');
      const json = await res.json();
      if (!json.success) throw new Error(json.error ?? 'API error');
      return json.data;
    },
  });

  const movementCost = Number(movementSummary?.Total_Cost) || 0;

  const rows = data ?? [];

  // Sort by defect % desc (highest % on top)
  const sortedRows = [...rows].sort((a, b) => {
    const pctA = (Number(a.Detection_CostTotal) || 0) / (Number(a.Prod_CostTotal) || 1);
    const pctB = (Number(b.Detection_CostTotal) || 0) / (Number(b.Prod_CostTotal) || 1);
    return pctB - pctA;
  });

  // Workshop label depending on language
  const deptName = (row: DeptRow): string =>
    lang === 'zh' ? (row.WorkShopName_CH || row.WorkShop_Ru) : (row.WorkShop_Ru || row.WorkShopName_CH);

  // Totals
  const totalProdCost      = rows.reduce((s, r) => s + (Number(r.Prod_CostTotal)  || 0), 0);
  const totalDetectionCost = rows.reduce((s, r) => s + (Number(r.Detection_CostTotal) || 0), 0);

  // Sorted by detection cost desc (for donut)
  const sortedByDefect = [...rows].sort(
    (a, b) => (Number(b.Detection_CostTotal) || 0) - (Number(a.Detection_CostTotal) || 0)
  );

  // Donut: detection cost share by dept
  const donutSegments = sortedByDefect.slice(0, 8).map((r, i) => ({
    color: DEPT_COLORS[i % DEPT_COLORS.length],
    pct: totalDetectionCost > 0
      ? Math.round(((Number(r.Detection_CostTotal) || 0) / totalDetectionCost) * 100)
      : 0,
  }));

  // ── Card: Guilty Department — compact table per workshop ─────────────────
  const COL = {
    name:     'flex-1 min-w-0',
    prodCost: 'w-32 text-right flex-shrink-0',
    defCost:  'w-32 text-right flex-shrink-0',
    pct:      'w-16 text-right flex-shrink-0',
  };

  const defPct = (defCost: number | null, prodCost: number | null): string => {
    const d = Number(defCost)  || 0;
    const p = Number(prodCost) || 0;
    if (d === 0 || p === 0) return '';
    const v = (d / p) * 100;
    return v < 0.1 ? '<0.1%' : `${v.toFixed(1)}%`;
  };

  const defPctBadge = (defCost: number | null, prodCost: number | null): string => {
    const d = Number(defCost)  || 0;
    const p = Number(prodCost) || 0;
    if (d === 0 || p === 0) return '';
    const v = (d / p) * 100;
    if (v < 1)  return 'bg-green-100 text-green-700';
    if (v < 2)  return 'bg-orange-100 text-orange-600';
    return 'bg-red-100 text-red-700';
  };

  const totalDefPct = defPct(totalDetectionCost, totalProdCost);

  const summaryCard = (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow min-h-[180px]">
      {/* Header */}
      <div className="bg-gray-50 px-6 py-3 rounded-t-xl border-b border-gray-200">
        <div className="flex items-center gap-4">
          <div className={`${COL.name} flex items-center gap-2`}>
            <span className="text-gray-400"><BarChart2 size={16} /></span>
            <h3 className="text-base font-semibold text-gray-800 leading-none">{t('dashboard.workshop')}</h3>
          </div>
          <div className={`${COL.prodCost} text-[11.6px] font-semibold text-gray-500 uppercase tracking-wider`}>{t('dashboard.prodCost')}</div>
          <div className={`${COL.defCost}  text-[11.6px] font-semibold text-gray-500 uppercase tracking-wider`}>{t('dashboard.detectionCost')}</div>
          <div className={`${COL.pct}      text-[11.6px] font-semibold text-gray-500 uppercase tracking-wider`}>%</div>
        </div>
      </div>
      {/* Body */}
      <div className="px-6 divide-y divide-gray-200">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
        ) : isError ? (
          <div className="text-[13px] text-red-500 py-4 text-center">Failed to load data</div>
        ) : (
          <>
            {sortedRows.map((row, i) => (
              <div key={row.WorkShopID || i} className="flex items-center gap-4 py-3 hover:bg-gray-50">
                <div className={`${COL.name} text-[13px] font-medium text-gray-800 truncate`}>{deptName(row)}</div>
                <div className={`${COL.prodCost} text-[13px] tabular-nums text-[#0d1c3d]`}>{fmtCost(row.Prod_CostTotal)}</div>
                <div className={`${COL.defCost}  text-[13px] tabular-nums font-semibold text-[#0d1c3d]`}>{fmtCost(row.Detection_CostTotal)}</div>
                <div className={`${COL.pct} flex justify-end`}>
                  {defPct(row.Detection_CostTotal, row.Prod_CostTotal) && (
                    <span className={`inline-block text-[12px] font-semibold py-0.5 px-2 rounded ${defPctBadge(row.Detection_CostTotal, row.Prod_CostTotal)}`}>
                      {defPct(row.Detection_CostTotal, row.Prod_CostTotal)}
                    </span>
                  )}
                </div>
              </div>
            ))}
            {/* Warehouse Return row */}
            {movementCost > 0 && (
              <div className="flex items-center gap-4 py-3 hover:bg-gray-50">
                <div className={`${COL.name} text-[13px] font-medium text-gray-800 truncate`}>
                  {t('dashboard.warehouseReturn')}
                </div>
                <div className={`${COL.prodCost} text-[13px] tabular-nums text-[#0d1c3d]`}></div>
                <div className={`${COL.defCost}  text-[13px] tabular-nums font-semibold text-[#0d1c3d]`}>{fmtCost(movementCost)}</div>
                <div className={`${COL.pct}`}></div>
              </div>
            )}
            {/* Total row */}
            <div className="flex items-center gap-4 py-3 font-semibold">
              <div className={`${COL.name} text-[13px] text-[#0d1c3d]`}>{t('dashboard.total')}</div>
              <div className={`${COL.prodCost} text-[13px] tabular-nums text-[#0d1c3d]`}>{fmtCost(totalProdCost)}</div>
              <div className={`${COL.defCost}  text-[13px] tabular-nums text-[#0d1c3d]`}>{fmtCost(totalDetectionCost)}</div>
              <div className={`${COL.pct} flex justify-end`}>
                {totalDefPct && (
                  <span className={`inline-block text-[12px] font-semibold py-0.5 px-2 rounded ${defPctBadge(totalDetectionCost, totalProdCost)}`}>
                    {totalDefPct}
                  </span>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );

  // ── Card: Defect Cards Summary (Monthly Plan style) ──────────────────────
  const cardsSummaryData = useQuery<{ Cost_Total: number | null; cnt: number | null; cnt_posted: number | null; Cost_Posted: number | null }>({
    queryKey: ['defect-cards-summary', dateFrom, dateTo],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (dateFrom) params.append('date_from', dateFrom);
      if (dateTo)   params.append('date_to',   dateTo);
      const res = await fetch(`/api/qc/defect-cards-summary?${params.toString()}`);
      if (!res.ok) throw new Error('Network error');
      const json = await res.json();
      if (!json.success) throw new Error(json.error ?? 'API error');
      return json.data;
    },
  });

  const cs = cardsSummaryData.data;
  const cntTotal  = Number(cs?.cnt)        || 0;
  const cntPosted = Number(cs?.cnt_posted) || 0;
  const costTotal = Number(cs?.Cost_Total) || 0;
  const costPosted = Number(cs?.Cost_Posted) || 0;

  const cardsPct      = cntTotal  > 0 ? Math.round((cntPosted  / cntTotal)  * 1000) / 10 : 0;
  const cardsExactPct = cntTotal  > 0 ? (cntPosted  / cntTotal)  * 100 : 0;

  const getCardsBadge = (pct: number) => {
    if (pct < 75) return 'bg-red-100 text-red-700';
    if (pct < 95) return 'bg-orange-100 text-orange-600';
    return 'bg-green-100 text-green-700';
  };
  const getCardsColor = (pct: number) => {
    if (pct < 75) return '#b91c1c';
    if (pct < 95) return '#ea580c';
    return '#15803d';
  };
  const getCardsBarBg = (pct: number) => {
    if (pct < 75) return '#FEE2E2';
    if (pct < 95) return '#FFEDD5';
    return '#D1FAE5';
  };

  const cardsRows = [
    { group: t('dashboard.cardsQty'),  plan: cntTotal,  fact: cntPosted,  pct: cardsPct },
    { group: t('dashboard.cardsCost'), plan: costTotal, fact: costPosted, pct: costTotal > 0 ? Math.round((costPosted / costTotal) * 1000) / 10 : 0 },
  ];

  const donutCard = (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="bg-gray-50 px-6 py-3 rounded-t-xl border-b border-gray-200">
        <h3 className="text-base font-semibold text-gray-800 leading-none">{t('dashboard.defectCardsTitle')}</h3>
      </div>
      {/* Body */}
      <div className="px-6 pt-5 pb-4 tabular-nums">
        {cardsSummaryData.isLoading ? (
          <div className="space-y-4">
            <div className="h-6 bg-gray-200 rounded animate-pulse" />
            <div className="h-8 bg-gray-200 rounded animate-pulse" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Main numbers */}
            <div className="text-center">
              <div className="text-[20px] font-bold text-[#0d1c3d] leading-none">
                {cntPosted.toLocaleString('ru-RU')} / {cntTotal.toLocaleString('ru-RU')}
              </div>
            </div>
            {/* Progress bar */}
            <div className="relative">
              <div
                className="w-full h-8 bg-gray-50 rounded-md overflow-hidden"
                style={{ border: `2px solid ${getCardsColor(cardsExactPct)}` }}
              >
                <div
                  className="h-full transition-all duration-1000 ease-out rounded-md"
                  style={{ width: `${Math.min(cardsPct, 100)}%`, backgroundColor: getCardsBarBg(cardsExactPct) }}
                />
              </div>
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <span className="text-[12px] font-semibold" style={{ color: getCardsColor(cardsExactPct) }}>
                  {cardsPct}%
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Rows */}
        <div className="mt-4">
          {/* Column headers */}
          <div className="px-6 py-3 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0 text-[11.6px] font-semibold text-gray-500 uppercase tracking-wider">{t('dashboard.group')}</div>
              <div className="flex items-center gap-6">
                <div className="w-24 text-[11.6px] font-semibold text-gray-500 uppercase tracking-wider">{t('dashboard.planLabel')}</div>
                <div className="w-24 text-[11.6px] font-semibold text-gray-500 uppercase tracking-wider">{t('dashboard.factLabel')}</div>
                <div className="w-20 text-[11.6px] font-semibold text-gray-500 uppercase tracking-wider">%</div>
              </div>
            </div>
          </div>
          <div className="px-6 py-2 divide-y divide-gray-200 tabular-nums">
            {cardsRows.map((r) => {
              const color = getCardsColor(r.pct);
              const isQty = r.group === t('dashboard.cardsQty');
              return (
                <div key={r.group} className="flex items-center justify-between py-3 hover:bg-gray-50">
                  <div className="flex-1 min-w-0 mr-4 text-[13px] font-medium text-gray-900">{r.group}</div>
                  <div className="flex items-center gap-6">
                    <div className="w-24 text-[13px] text-gray-500 font-semibold">
                      {isQty ? r.plan.toLocaleString('ru-RU') : fmtCost(r.plan)}
                    </div>
                    <div className="w-24 text-[13px] font-semibold text-[#0d1c3d]">
                      {isQty ? r.fact.toLocaleString('ru-RU') : fmtCost(r.fact)}
                    </div>
                    <div className="w-20 flex items-center gap-2">
                      <Circle size={10} fill={color} color={color} />
                      <span className="text-[12px] text-gray-500 font-semibold">{Math.round(r.pct)}%</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );

  // ── LQC Summary data ─────────────────────────────────────────────────────
  const { data: lqcSummary, isLoading: lqcLoading } = useQuery<{
    total_prod_qty: number;
    total_defect_qty: number;
    defect_types: { Defect_Type_Ru: string; Defect_Type_Zh: string; Defect_QTY: number }[];
  }>({
    queryKey: ['lqc-summary', dateFrom, dateTo],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (dateFrom) params.append('date_from', dateFrom);
      if (dateTo)   params.append('date_to',   dateTo);
      const res = await fetch(`/api/qc/lqc-summary?${params.toString()}`);
      if (!res.ok) throw new Error('Network error');
      const json = await res.json();
      if (!json.success) throw new Error(json.error ?? 'API error');
      return json.data;
    },
  });

  // ── Card: Defect Type ─────────────────────────────────────────────────────
  const { data: defectTypeData, isLoading: defectTypeLoading } = useQuery<{ Defect_TypeRu: string; Defect_TypeZh: string; Cost_Total: number }[]>({
    queryKey: ['defect-cards-by-type', dateFrom, dateTo],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (dateFrom) params.append('date_from', dateFrom);
      if (dateTo)   params.append('date_to',   dateTo);
      const res = await fetch(`/api/qc/defect-cards-by-type?${params.toString()}`);
      if (!res.ok) throw new Error('Network error');
      const json = await res.json();
      if (!json.success) throw new Error(json.error ?? 'API error');
      return json.data;
    },
  });

  const defectTypeRows = defectTypeData ?? [];
  const defectTypeCostTotal = defectTypeRows.reduce((s, r) => s + (Number(r.Cost_Total) || 0), 0);

  const COL_DT = {
    name:     'flex-1 min-w-0',
    cost:     'w-32 text-right flex-shrink-0',
    pct:      'w-16 text-right flex-shrink-0',
  };

  const detectionQtyCard = (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow min-h-[180px]">
      {/* Header */}
      <div className="bg-gray-50 px-6 py-3 rounded-t-xl border-b border-gray-200">
        <div className="flex items-center gap-4">
          <div className={`${COL_DT.name} flex items-center gap-2`}>
            <span className="text-gray-400"><AlertTriangle size={16} /></span>
            <h3 className="text-base font-semibold text-gray-800 leading-none">{t('dashboard.defectTypeTitle')}</h3>
          </div>
          <div className={`${COL_DT.cost} text-[11.6px] font-semibold text-gray-500 uppercase tracking-wider`}>{t('dashboard.detectionCost')}</div>
          <div className={`${COL_DT.pct}  text-[11.6px] font-semibold text-gray-500 uppercase tracking-wider`}>%</div>
        </div>
      </div>
      {/* Body */}
      <div className="px-6 divide-y divide-gray-200">
        {defectTypeLoading ? (
          Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
        ) : (
          <>
            {(() => {
              const top3 = defectTypeRows.slice(0, 3);
              const rest = defectTypeRows.slice(3);
              const otherCost = rest.reduce((s, r) => s + (Number(r.Cost_Total) || 0), 0);

              const renderRow = (name: string, cost: number, idx: number) => {
                const pctVal = defectTypeCostTotal > 0 ? (cost / defectTypeCostTotal) * 100 : 0;
                const pctStr = cost === 0 ? '' : pctVal < 0.1 ? '<0.1%' : `${pctVal.toFixed(1)}%`;
                return (
                  <div key={idx} className="flex items-center gap-4 py-3 hover:bg-gray-50">
                    <div className={`${COL_DT.name} text-[13px] font-medium text-gray-800 truncate`}>{name}</div>
                    <div className={`${COL_DT.cost} text-[13px] tabular-nums font-semibold text-[#0d1c3d]`}>{fmtCost(cost)}</div>
                    <div className={`${COL_DT.pct} flex justify-end`}>
                      <span className={`inline-block text-[12px] font-semibold py-0.5 px-2 rounded ${defPctBadge(cost, defectTypeCostTotal)}`}>
                        {pctStr}
                      </span>
                    </div>
                  </div>
                );
              };

              return (
                <>
                  {top3.map((row, i) => {
                    const cost = Number(row.Cost_Total) || 0;
                    const name = lang === 'zh'
                      ? (row.Defect_TypeZh || row.Defect_TypeRu || '—')
                      : (row.Defect_TypeRu || row.Defect_TypeZh || '—');
                    return renderRow(name, cost, i);
                  })}
                  {otherCost > 0 && renderRow(t('dashboard.other'), otherCost, 99)}
                </>
              );
            })()}
            {/* Total row */}
            <div className="flex items-center gap-4 py-3 font-semibold border-t border-gray-300">
              <div className={`${COL_DT.name} text-[13px] text-[#0d1c3d]`}>{t('dashboard.total')}</div>
              <div className={`${COL_DT.cost} text-[13px] tabular-nums text-[#0d1c3d]`}>{fmtCost(defectTypeCostTotal)}</div>
              <div className={`${COL_DT.pct}`}></div>
            </div>
          </>
        )}
      </div>
    </div>
  );


  // ── Card: LQC ─────────────────────────────────────────────────────────────
  const lqcProdQty   = lqcSummary?.total_prod_qty   ?? 0;
  const lqcDefectQty = lqcSummary?.total_defect_qty ?? 0;
  const lqcDefectPct = lqcProdQty > 0 ? (lqcDefectQty / lqcProdQty) * 100 : 0;
  const lqcPctLabel  = lqcDefectPct === 0 ? '0%' : lqcDefectPct < 0.1 ? '<0.1%' : `${lqcDefectPct.toFixed(1)}%`;
  const lqcGoodPct   = Math.max(0, 100 - lqcDefectPct);

  const lqcDonutSegments = lqcProdQty > 0
    ? [
        { color: lqcDefectPct < 1 ? '#86efac' : lqcDefectPct < 2 ? '#fdba74' : '#fca5a5', pct: Math.min(lqcDefectPct, 100) },
        { color: '#e5e7eb', pct: lqcGoodPct },
      ]
    : [{ color: '#e5e7eb', pct: 100 }];

  const lqcTypes = lqcSummary?.defect_types ?? [];
  const lqcTypesTotal = lqcTypes.reduce((s, r) => s + (r.Defect_QTY || 0), 0);

  // Топ 3
  const lqcTypeRows = lqcTypes.slice(0, 3).map(r => ({
    name: lang === 'zh' ? (r.Defect_Type_Zh || r.Defect_Type_Ru) : (r.Defect_Type_Ru || r.Defect_Type_Zh) || '—',
    qty: r.Defect_QTY,
  }));

  const lqcCard = (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
      <div className="bg-gray-50 px-6 py-3 rounded-t-xl border-b border-gray-200">
        <div className="flex items-center gap-2">
          <span className="text-gray-400"><Package size={16} /></span>
          <h3 className="text-base font-semibold text-gray-800 leading-none">LQC</h3>
        </div>
      </div>
      <div className="px-5 py-4">
        {lqcLoading ? (
          <div className="flex gap-4">
            <div className="h-20 bg-gray-200 rounded-full w-20 animate-pulse flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-gray-200 rounded animate-pulse" />
              <div className="h-4 bg-gray-200 rounded animate-pulse" />
              <div className="h-4 bg-gray-200 rounded animate-pulse" />
            </div>
          </div>
        ) : (
          /* Двухколоночный layout через grid */
          <div className="grid gap-0" style={{ gridTemplateColumns: '3fr 1px 2fr' }}>

            {/* Левая часть — диаграмма + итоги */}
            <div className="flex flex-col items-center justify-center gap-2 pr-3">
              <Donut segments={lqcDonutSegments} center={lqcPctLabel} sizePx={120} stroke={10} centerSize={14} />
              <div className="text-center tabular-nums space-y-0.5">
                <div className="text-[11px] text-gray-400">
                  {t('dashboard.prodQTY')}:{' '}
                  <span className="font-semibold text-[#0d1c3d]">{fmt(lqcProdQty)}</span>
                </div>
                <div className="text-[11px] text-gray-400">
                  {t('dashboard.detectionQTY')}:{' '}
                  <span className="font-semibold text-[#0d1c3d]">{fmt(lqcDefectQty)}</span>
                </div>
              </div>
            </div>

            {/* Разделитель */}
            <div className="bg-gray-200 self-stretch" />

            {/* Правая часть — топ 3 причины */}
            <div className="flex flex-col gap-2.5 pl-3 min-w-0 overflow-hidden">
              {lqcTypeRows.map((row, i) => {
                const pctVal = lqcTypesTotal > 0 ? (row.qty / lqcTypesTotal) * 100 : 0;
                const pctStr = pctVal < 0.1 ? '<0.1%' : `${pctVal.toFixed(1)}%`;
                return (
                  <div key={i} className="text-right">
                    <div className="text-[13px] text-gray-700 font-medium leading-tight truncate" title={row.name}>
                      {row.name}
                    </div>
                    <div className="flex items-center justify-end gap-1.5 mt-0.5">
                      <span className="text-[13px] font-semibold tabular-nums text-[#0d1c3d]">
                        {fmt(row.qty)}
                      </span>
                      <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded tabular-nums ${defPctBadge(row.qty, lqcTypesTotal)}`}>
                        {pctStr}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-6 pt-2 overflow-auto">
      {/* Row 1: 3 columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {summaryCard}
        <div className="flex flex-col gap-6">
          {donutCard}
          {lqcCard}
        </div>
        {detectionQtyCard}
      </div>
    </div>
  );
};

export default DefectCardsDashboard;
