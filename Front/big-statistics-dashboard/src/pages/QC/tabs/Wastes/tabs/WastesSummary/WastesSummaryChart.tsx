import React, { useMemo } from 'react';
import { PieChart, Pie, Cell, Tooltip } from 'recharts';
import { useTranslation } from 'react-i18next';

// ─── helpers ──────────────────────────────────────────────────────────────────

const fmt = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 });

const COLORS_STAMPING  = ['#b91c1c', '#c2410c', '#a16207', '#7c3aed', '#065f46'];
const COLORS_INJECTION = ['#1d4ed8', '#6d28d9', '#0e7490', '#047857', '#92400e'];

const CHART_SIZE   = 260;
const INNER_RADIUS = 103;
const OUTER_RADIUS = 120;
const HALF_SHIFT   = 5;

// ─── Tooltip ──────────────────────────────────────────────────────────────────

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const d = payload[0];
  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 12px', fontSize: 12, zIndex: 50 }}>
      <div style={{ fontWeight: 600, color: '#374151', marginBottom: 2 }}>{d.name}</div>
      <div style={{ color: '#6b7280' }}>￥{fmt.format(d.value)}</div>
      <div style={{ color: '#9ca3af' }}>{d.payload.pct}%</div>
    </div>
  );
};

// ─── LegendBlock ──────────────────────────────────────────────────────────────

interface LegendProps {
  title: string;
  segments: { name: string; value: number; pct: string }[];
  colors: string[];
  align: 'left' | 'right';
}

const LegendBlock: React.FC<LegendProps> = ({ segments, colors, align }) => (
  <div style={{ width: 200, textAlign: align === 'left' ? 'right' : 'left' }}>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {segments.map((s, i) => (
        <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: align === 'left' ? 'flex-end' : 'flex-start' }}>
          {/* color dot + type name */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexDirection: align === 'left' ? 'row-reverse' : 'row' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: colors[i % colors.length], flexShrink: 0, display: 'inline-block' }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: '#374151', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 170 }}>{s.name}</span>
          </div>
          {/* cost and pct */}
          <span style={{ fontSize: 11, color: '#6b7280' }}>
            ￥{fmt.format(s.value)} — {s.pct}%
          </span>
        </div>
      ))}
    </div>
  </div>
);

// ─── main component ───────────────────────────────────────────────────────────

interface DeptRow {
  dept_type: 'stamping' | 'injection';
  VinovnikDep_Ru: string;
  VinovnikDep_Zh: string;
  Defect_TypeRu: string;
  Defect_TypeZh: string;
  Defect_Cost: number;
}

interface Props {
  deptData: DeptRow[];
}

const WastesSummaryChart: React.FC<Props> = ({ deptData }) => {
  const { t, i18n } = useTranslation('qc');
  const lang = i18n.language as 'en' | 'zh' | 'ru';

  const { stampingSegments, stampingTotal, injectionSegments, injectionTotal } = useMemo(() => {
    const MAX_SEGMENTS = 4;
    const othersLabel = t('wastes.summary.chartOthers');

    const buildSegments = (rows: DeptRow[], total: number) => {
      // Sort by cost desc, already sorted from backend but ensure it
      const sorted = [...rows].sort((a, b) => (Number(b.Defect_Cost) || 0) - (Number(a.Defect_Cost) || 0));
      const top    = sorted.slice(0, MAX_SEGMENTS);
      const rest   = sorted.slice(MAX_SEGMENTS);

      const segs = top.map(r => {
        const val = Number(r.Defect_Cost) || 0;
        return {
          name:  lang === 'zh' ? r.Defect_TypeZh : r.Defect_TypeRu,
          value: val,
          pct:   total > 0 ? ((val / total) * 100).toFixed(1) : '0',
        };
      });

      if (rest.length > 0) {
        const restVal = rest.reduce((s, r) => s + (Number(r.Defect_Cost) || 0), 0);
        segs.push({
          name:  othersLabel,
          value: restVal,
          pct:   total > 0 ? ((restVal / total) * 100).toFixed(1) : '0',
        });
      }

      return segs;
    };

    const stampRows = deptData.filter(r => r.dept_type === 'stamping');
    const injRows   = deptData.filter(r => r.dept_type === 'injection');

    const sTotal = stampRows.reduce((s, r) => s + (Number(r.Defect_Cost) || 0), 0);
    const iTotal = injRows.reduce((s, r)   => s + (Number(r.Defect_Cost) || 0), 0);

    return {
      stampingSegments:  buildSegments(stampRows, sTotal),
      stampingTotal:     sTotal,
      injectionSegments: buildSegments(injRows,   iTotal),
      injectionTotal:    iTotal,
    };
  }, [deptData, lang, t]);

  const fallback = [{ name: '—', value: 1, pct: '0' }];

  return (
    <div
      className="bg-white rounded-xl border border-gray-200 p-6 flex flex-col items-center"
      style={{ width: 720, flexShrink: 0 }}
    >
      {/* Header row inside card: Stamping left, Injection right */}
      <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#0d1c3d' }}>{t('wastes.tabs.stamping')}</div>
          {stampingTotal > 0 && (
            <div style={{ fontSize: 13, fontWeight: 600, color: '#6b7280', marginTop: 2 }}>￥{fmt.format(stampingTotal)}</div>
          )}
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#0d1c3d' }}>{t('wastes.tabs.injection')}</div>
          {injectionTotal > 0 && (
            <div style={{ fontSize: 13, fontWeight: 600, color: '#6b7280', marginTop: 2 }}>￥{fmt.format(injectionTotal)}</div>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>

        {/* Left legend — Stamping */}
        <LegendBlock
          title={t('wastes.tabs.stamping')}
          segments={stampingSegments}
          colors={COLORS_STAMPING}
          align="left"
        />

        {/* Single PieChart — two Pie halves */}
        <PieChart width={CHART_SIZE} height={CHART_SIZE}>
          {/* Left half — Stamping: shifted left, exact 180° CCW through west */}
          <Pie
            data={stampingSegments.length ? stampingSegments : fallback}
            cx={CHART_SIZE / 2 - HALF_SHIFT}
            cy="50%"
            startAngle={90}
            endAngle={270}
            innerRadius={INNER_RADIUS}
            outerRadius={OUTER_RADIUS}
            paddingAngle={stampingSegments.length > 1 ? 2 : 0}
            dataKey="value"
            strokeWidth={0}
          >
            {(stampingSegments.length ? stampingSegments : fallback).map((_, i) => (
              <Cell key={i} fill={stampingSegments.length ? COLORS_STAMPING[i % COLORS_STAMPING.length] : '#e5e7eb'} />
            ))}
          </Pie>

          {/* Right half — Injection: shifted right, exact 180° CW through east */}
          <Pie
            data={injectionSegments.length ? injectionSegments : fallback}
            cx={CHART_SIZE / 2 + HALF_SHIFT}
            cy="50%"
            startAngle={90}
            endAngle={-90}
            innerRadius={INNER_RADIUS}
            outerRadius={OUTER_RADIUS}
            paddingAngle={injectionSegments.length > 1 ? 2 : 0}
            dataKey="value"
            strokeWidth={0}
          >
            {(injectionSegments.length ? injectionSegments : fallback).map((_, i) => (
              <Cell key={i} fill={injectionSegments.length ? COLORS_INJECTION[i % COLORS_INJECTION.length] : '#e5e7eb'} />
            ))}
          </Pie>

          <Tooltip content={<CustomTooltip />} />
        </PieChart>

        {/* Right legend — Injection */}
        <LegendBlock
          title={t('wastes.tabs.injection')}
          segments={injectionSegments}
          colors={COLORS_INJECTION}
          align="right"
        />
      </div>
    </div>
  );
};

export default WastesSummaryChart;
