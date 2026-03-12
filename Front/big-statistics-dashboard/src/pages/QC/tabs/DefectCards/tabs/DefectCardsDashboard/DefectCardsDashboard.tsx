import React from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, TrendingUp, BarChart2, Users, DollarSign, Package } from 'lucide-react';

// ── Skeleton placeholder ──────────────────────────────────────────────────────
const SkeletonRow: React.FC<{ wide?: boolean }> = ({ wide }) => (
  <div className={`h-3.5 rounded bg-gray-200 animate-pulse ${wide ? 'w-3/4' : 'w-1/2'}`} />
);

// ── Reusable card shell (matches Home/Dashboard style) ────────────────────────
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

// ── Mock metric row ───────────────────────────────────────────────────────────
interface MetricRowProps {
  label: string;
  value: string;
  badge?: { label: string; color: string };
}
const MetricRow: React.FC<MetricRowProps> = ({ label, value, badge }) => (
  <div className="flex items-center justify-between py-2.5 border-b border-gray-100 last:border-0 hover:bg-gray-50 -mx-6 px-6">
    <span className="text-[13px] font-medium text-gray-700">{label}</span>
    <div className="flex items-center gap-3">
      {badge && (
        <span className={`text-[11px] font-semibold py-0.5 px-2 rounded ${badge.color}`}>
          {badge.label}
        </span>
      )}
      <span className="text-[13px] font-semibold text-[#0d1c3d] tabular-nums">{value}</span>
    </div>
  </div>
);

// ── Horizontal bar (progress) ─────────────────────────────────────────────────
interface BarRowProps {
  label: string;
  value: number;
  total: number;
  color?: string;
}
const BarRow: React.FC<BarRowProps> = ({ label, value, total, color = '#ef4444' }) => {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="py-2.5 border-b border-gray-100 last:border-0">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[12px] text-gray-700 font-medium truncate max-w-[65%]">{label}</span>
        <span className="text-[12px] tabular-nums font-semibold text-[#0d1c3d]">{value}</span>
      </div>
      <div className="h-2 bg-gray-100 rounded overflow-hidden">
        <div
          className="h-full rounded transition-all duration-300"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
};

// ── Donut mock ────────────────────────────────────────────────────────────────
const MockDonut: React.FC<{ segments: { color: string; pct: number }[] }> = ({ segments }) => {
  let offset = 0;
  const r = 36;
  const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 100 100" className="w-20 h-20 -rotate-90">
      {segments.map((s, i) => {
        const dash = (s.pct / 100) * c;
        const el = (
          <circle
            key={i}
            cx="50" cy="50" r={r}
            fill="none"
            stroke={s.color}
            strokeWidth="16"
            strokeDasharray={`${dash} ${c - dash}`}
            strokeDashoffset={-offset}
          />
        );
        offset += dash;
        return el;
      })}
    </svg>
  );
};

// ═════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═════════════════════════════════════════════════════════════════════════════
interface DefectCardsDashboardProps {
  startDate: Date | null;
  endDate: Date | null;
}

const DefectCardsDashboard: React.FC<DefectCardsDashboardProps> = ({ startDate, endDate }) => {
  const { t } = useTranslation('qc');

  // ── Mock data (to be replaced by API) ────────────────────────────────────
  const mockSummary = [
    { label: 'Total Cards',      value: '148',       badge: null },
    { label: 'Total QTY',        value: '2 340',     badge: null },
    { label: 'Material Cost',    value: '¥ 187 420', badge: null },
    { label: 'Labor Cost',       value: '¥ 23 810',  badge: null },
    { label: 'Total Cost',       value: '¥ 211 230', badge: { label: '↑ 12%', color: 'bg-red-100 text-red-700' } },
  ];

  const mockConclusions = [
    { label: t('conclusion.0'), value: 62,  color: '#ef4444' },
    { label: t('conclusion.1'), value: 31,  color: '#f97316' },
    { label: t('conclusion.2'), value: 24,  color: '#a855f7' },
    { label: t('conclusion.3'), value: 18,  color: '#6366f1' },
    { label: t('conclusion.4'), value: 9,   color: '#0ea5e9' },
    { label: t('conclusion.5'), value: 4,   color: '#14b8a6' },
  ];
  const totalConclusions = mockConclusions.reduce((s, r) => s + r.value, 0);

  const donutSegments = mockConclusions.map(c => ({ color: c.color, pct: Math.round((c.value / totalConclusions) * 100) }));

  const mockDefectTypes = [
    { label: 'Paint peeling',    value: 48,  color: '#ef4444' },
    { label: 'Color mismatch',   value: 35,  color: '#f97316' },
    { label: 'Surface scratch',  value: 29,  color: '#eab308' },
    { label: 'Blister',          value: 21,  color: '#84cc16' },
    { label: 'Others',           value: 15,  color: '#94a3b8' },
  ];
  const totalDefects = mockDefectTypes.reduce((s, r) => s + r.value, 0);

  const mockDepts = [
    { label: 'Paint Shop',       value: 74,  color: '#ef4444' },
    { label: 'Assembly',         value: 38,  color: '#f97316' },
    { label: 'Silkscreen',       value: 22,  color: '#a855f7' },
    { label: 'Packaging',        value: 14,  color: '#0ea5e9' },
  ];
  const totalDepts = mockDepts.reduce((s, r) => s + r.value, 0);

  const mockMonthly = [
    { month: 'Jan', cards: 18, cost: 22400 },
    { month: 'Feb', cards: 24, cost: 31200 },
    { month: 'Mar', cards: 31, cost: 41800 },
    { month: 'Apr', cards: 20, cost: 28600 },
    { month: 'May', cards: 27, cost: 35900 },
    { month: 'Jun', cards: 28, cost: 51330 },
  ];
  const maxCost = Math.max(...mockMonthly.map(m => m.cost));

  const mockTopItems = [
    { article: '8.75.11.001', name: 'Front cover', qty: 320, cost: '¥ 38 400' },
    { article: '8.75.11.002', name: 'Side panel',  qty: 214, cost: '¥ 25 680' },
    { article: '8.75.01.015', name: 'Silk plate',  qty: 180, cost: '¥ 21 600' },
    { article: '8.75.02.008', name: 'Back frame',  qty: 145, cost: '¥ 17 400' },
    { article: '8.75.11.009', name: 'Top cap',     qty: 98,  cost: '¥ 11 760' },
  ];

  // ── Layout: 3 columns, cards distributed evenly ──────────────────────────
  const col1 = (
    <div className="flex flex-col gap-6">
      {/* Card 1: Summary KPIs */}
      <Card title="Guilty Department" icon={<BarChart2 size={16} />}>
        {mockSummary.map(r => (
          <MetricRow key={r.label} label={r.label} value={r.value} badge={r.badge ?? undefined} />
        ))}
      </Card>

      {/* Card 2: Monthly trend (mini bar chart) */}
      <Card title="Defect Type" icon={<TrendingUp size={16} />} minH="min-h-[220px]">
        <div className="flex items-end gap-2 h-32">
          {mockMonthly.map(m => (
            <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
              <div
                className="w-full rounded-t bg-[#0d1c3d] opacity-80 transition-all duration-300"
                style={{ height: `${Math.round((m.cost / maxCost) * 100)}%` }}
                title={`¥ ${m.cost.toLocaleString()}`}
              />
              <span className="text-[10px] text-gray-500">{m.month}</span>
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-4 text-[11px] text-gray-500">
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-[#0d1c3d] opacity-80 inline-block" /> Total Cost (¥)</span>
        </div>
      </Card>
    </div>
  );

  const col2 = (
    <div className="flex flex-col gap-6">
      {/* Card 3: Conclusion breakdown (donut + legend) */}
      <Card
        title="By Conclusion"
        icon={<Package size={16} />}
        headerRight={<span className="text-[12px] text-gray-500">{totalConclusions} cards</span>}
        minH="min-h-[260px]"
      >
        <div className="flex items-center gap-6">
          {/* Donut */}
          <div className="relative flex-shrink-0">
            <MockDonut segments={donutSegments} />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-[11px] font-bold text-gray-700">{totalConclusions}</span>
            </div>
          </div>
          {/* Legend */}
          <div className="flex flex-col gap-1.5 flex-1 min-w-0">
            {mockConclusions.map(c => (
              <div key={c.label} className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: c.color }} />
                  <span className="text-[12px] text-gray-700 truncate">{c.label}</span>
                </div>
                <span className="text-[12px] font-semibold text-[#0d1c3d] tabular-nums flex-shrink-0">{c.value}</span>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* Card 4: Defect types */}
      <Card title="By Defect Type" icon={<AlertTriangle size={16} />}>
        {mockDefectTypes.map(d => (
          <BarRow key={d.label} label={d.label} value={d.value} total={totalDefects} color={d.color} />
        ))}
      </Card>
    </div>
  );

  const col3 = (
    <div className="flex flex-col gap-6">
      {/* Card 5: Guilty dept breakdown */}
      <Card title="By Guilty Dept" icon={<Users size={16} />}>
        {mockDepts.map(d => (
          <BarRow key={d.label} label={d.label} value={d.value} total={totalDepts} color={d.color} />
        ))}
      </Card>

      {/* Card 6: Top items by cost */}
      <Card title="Top Items by Cost" icon={<DollarSign size={16} />}>
        <div className="divide-y divide-gray-100">
          {mockTopItems.map((item, i) => (
            <div key={item.article} className="flex items-center justify-between py-2.5 hover:bg-gray-50 -mx-6 px-6">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-[11px] text-gray-400 w-4 flex-shrink-0">{i + 1}.</span>
                <div className="min-w-0">
                  <div className="text-[12px] font-medium text-gray-800 truncate">{item.name}</div>
                  <div className="text-[11px] text-gray-400">{item.article} · {item.qty} pcs</div>
                </div>
              </div>
              <span className="text-[12px] font-semibold text-[#0d1c3d] tabular-nums flex-shrink-0 ml-3">{item.cost}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-2">
      {col1}
      {col2}
      {col3}
    </div>
  );
};

export default DefectCardsDashboard;
