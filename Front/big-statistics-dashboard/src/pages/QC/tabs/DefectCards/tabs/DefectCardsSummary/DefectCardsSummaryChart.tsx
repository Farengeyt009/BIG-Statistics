import React, { useMemo } from 'react';
import { Treemap, Tooltip } from 'recharts';
import { useTranslation } from 'react-i18next';

const fmt = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 });

const DEPT_COLORS = [
  '#1d4ed8', '#b91c1c', '#047857', '#7c3aed',
  '#b45309', '#0e7490', '#9d174d', '#374151',
];
const TYPE_COLORS = [
  '#0284c7', '#dc2626', '#16a34a', '#9333ea',
  '#d97706', '#0891b2', '#db2777', '#4b5563',
];

const CHART_W = 400;
const CHART_H = 420;

interface Props {
  data: any[];
  loading: boolean;
}

// Stable tree data — does NOT depend on language, so Recharts won't re-animate on lang change
function buildStableData(data: any[]) {
  const active = data.filter(r => String(r.Delete_Mark ?? '').toLowerCase() !== '01');

  const deptMap: Record<string, number> = {};
  const typeMap: Record<string, number> = {};

  for (const r of active) {
    const deptKey = r.VinovnikDep_Ru || '—';
    const typeKey = r.Defect_TypeRu  || '—';
    const cost = (Number(r.QCCard_QTY) || 0) * (Number(r.Labor_Cost) || 0);
    deptMap[deptKey] = (deptMap[deptKey] || 0) + cost;
    typeMap[typeKey] = (typeMap[typeKey] || 0) + cost;
  }

  const toItems = (map: Record<string, number>) =>
    Object.entries(map)
      .sort(([, a], [, b]) => b - a)
      .map(([key, cost]) => ({ name: key, size: cost }));

  return { deptData: toItems(deptMap), typeData: toItems(typeMap) };
}

// Translation maps — depend on language, used only in content/tooltip functions
function buildLabels(data: any[], lang: string) {
  const deptLabels: Record<string, string> = {};
  const typeLabels: Record<string, string> = {};

  for (const r of data) {
    const deptKey = r.VinovnikDep_Ru || '—';
    const typeKey = r.Defect_TypeRu  || '—';
    deptLabels[deptKey] = (lang === 'zh' ? r.VinovnikDep_Zh : r.VinovnikDep_Ru) || deptKey;
    typeLabels[typeKey] = (lang === 'zh' ? r.Defect_TypeZh  : r.Defect_TypeRu)  || typeKey;
  }

  return { deptLabels, typeLabels };
}

const makeTooltip = (header: string, labelsMap: Record<string, string>, total: number) =>
  ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const d = payload[0]?.payload;
    if (!d) return null;
    const pct = total > 0 ? ((d.size / total) * 100).toFixed(1) : '0';
    return (
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 12px', fontSize: 12, zIndex: 50 }}>
        <div style={{ fontSize: 10, color: '#9ca3af', marginBottom: 2 }}>{header}</div>
        <div style={{ fontWeight: 600, color: '#374151', marginBottom: 2 }}>{labelsMap[d.name] ?? d.name}</div>
        <div style={{ color: '#6b7280' }}>￥{fmt.format(d.size ?? 0)} · {pct}%</div>
      </div>
    );
  };

const makeContent = (colors: string[], labelsMap: Record<string, string>, total: number) => (props: any) => {
  const { x, y, width, height, name, index, size } = props;
  if (!width || !height || width < 4 || height < 4) return <g />;

  const color    = colors[index % colors.length];
  const label    = labelsMap[name] ?? name;
  const pct      = total > 0 ? ((size / total) * 100).toFixed(1) : '0';
  const showName = width > 45 && height > 24;
  const showVal  = width > 70 && height > 44;

  return (
    <g>
      <rect
        x={x + 1} y={y + 1}
        width={Math.max(0, width - 2)}
        height={Math.max(0, height - 2)}
        fill={color} stroke="#fff" strokeWidth={1} rx={4}
      />
      {showName && (
        <text
          x={x + width / 2} y={y + height / 2 - (showVal ? 12 : 0)}
          textAnchor="middle" dominantBaseline="middle"
          fill="#fff" fontSize={Math.min(13, Math.max(9, width / 8))} fontWeight={600}
          style={{ pointerEvents: 'none' }}
        >
          {label.length > 20 ? label.slice(0, 18) + '…' : label}
        </text>
      )}
      {showVal && (
        <text
          x={x + width / 2} y={y + height / 2 + 8}
          textAnchor="middle" dominantBaseline="middle"
          fill="rgba(255,255,255,0.85)" fontSize={Math.min(11, Math.max(8, width / 10))}
          style={{ pointerEvents: 'none' }}
        >
          ￥{fmt.format(size)} · {pct}%
        </text>
      )}
    </g>
  );
};

const DefectCardsSummaryChart: React.FC<Props> = ({ data, loading }) => {
  const { i18n } = useTranslation('qc');
  const lang = i18n.language as 'en' | 'zh' | 'ru';

  // Stable data: only recomputes when data changes, NOT on language change → no re-animation
  const { deptData, typeData } = useMemo(() => {
    if (!data.length) return { deptData: [], typeData: [] };
    return buildStableData(data);
  }, [data]);

  // Labels: recompute on language change, used only in content/tooltip closures
  const { deptLabels, typeLabels } = useMemo(
    () => buildLabels(data, lang),
    [data, lang],
  );

  if (loading || !deptData.length) return null;

  const deptHeader = lang === 'zh' ? '按部门'     : lang === 'ru' ? 'По цехам'            : 'By Department';
  const typeHeader = lang === 'zh' ? '按缺陷类型' : lang === 'ru' ? 'По типам дефектов'   : 'By Defect Type';
  const deptHint   = lang === 'zh' ? '责任部门'   : lang === 'ru' ? 'Виновный цех'        : 'Guilty Dept';
  const typeHint   = lang === 'zh' ? '缺陷类型'   : lang === 'ru' ? 'Тип дефекта'         : 'Defect Type';

  const deptTotal = deptData.reduce((s, d) => s + (d.size ?? 0), 0);
  const typeTotal = typeData.reduce((s, d) => s + (d.size ?? 0), 0);

  return (
    <div
      className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col"
      style={{ width: 860, flexShrink: 0 }}
    >
      <div style={{ display: 'flex', gap: 12 }}>

        {/* Left — by department */}
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 6, textAlign: 'center' }}>
            {deptHeader}
          </div>
          <Treemap
            width={CHART_W} height={CHART_H}
            data={deptData} dataKey="size"
            content={makeContent(DEPT_COLORS, deptLabels, deptTotal)}
          >
            <Tooltip content={makeTooltip(deptHint, deptLabels, deptTotal)} />
          </Treemap>
        </div>

        {/* Divider */}
        <div style={{ width: 1, background: '#e5e7eb', alignSelf: 'stretch', margin: '20px 0' }} />

        {/* Right — by defect type */}
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 6, textAlign: 'center' }}>
            {typeHeader}
          </div>
          <Treemap
            width={CHART_W} height={CHART_H}
            data={typeData} dataKey="size"
            content={makeContent(TYPE_COLORS, typeLabels, typeTotal)}
          >
            <Tooltip content={makeTooltip(typeHint, typeLabels, typeTotal)} />
          </Treemap>
        </div>

      </div>
    </div>
  );
};

export default DefectCardsSummaryChart;
