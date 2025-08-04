import React, { useRef, useState, useEffect } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts';
import { scaleBand } from 'd3-scale';

/* ---------- типы ---------- */
interface DataPoint {
  day: string;
  othPlan: number;
  othFact: number | null;
  whPlan: number;
  whFact: number | null;
  pctTotal: number | null;
}

export interface PlanCumulativeChartProps {
  table2: Array<{
    Date: string;
    WaterHeaterPlanTime: number | string;
    OtherPlanTime: number | string;
    WaterHeaterFactTime: number | string;
    OtherFactTime: number | string;
  }>;
  year: number;
  month: number;
}

/* ---------- helpers ---------- */
const toNum = (v: string | number | null | undefined) =>
  v == null ? 0 : Number(String(v).replace(/[\s,]/g, '')) || 0;

const human = (v: number | null | undefined) =>
  v == null ? '—' : `${v.toLocaleString('ru-RU')} ч`;

const pct = (num: number, den: number) =>
  den === 0 ? '—' : `${Math.round((num / den) * 100)} %`;

/* ---------- подготовка данных ---------- */
function buildData(rows: PlanCumulativeChartProps['table2']): DataPoint[] {
  let othP = 0,
    whP = 0,
    othF = 0,
    whF = 0;

  const arr: DataPoint[] = rows.map((row) => {
    const day = new Date(row.Date).getDate().toString().padStart(2, '0');

    othP += toNum(row.OtherPlanTime);
    whP += toNum(row.WaterHeaterPlanTime);
    othF += toNum(row.OtherFactTime);
    whF += toNum(row.WaterHeaterFactTime);

    return {
      day,
      othPlan: othP,
      othFact: othF,
      whPlan: whP,
      whFact: whF,
      pctTotal: null,
    };
  });

  const grandPlan = othP + whP;
  arr.forEach((d) => {
    const factAcc = (d.othFact ?? 0) + (d.whFact ?? 0);
    d.pctTotal = grandPlan ? Math.round((factAcc / grandPlan) * 100) : null;
  });

  return arr;
}

// Для Daily: без накопления, просто значения за каждый день
function buildDataDaily(rows: PlanCumulativeChartProps['table2']): DataPoint[] {
  let arr: DataPoint[] = rows.map((row) => {
    const day = new Date(row.Date).getDate().toString().padStart(2, '0');
    const othPlan = toNum(row.OtherPlanTime);
    const whPlan = toNum(row.WaterHeaterPlanTime);
    const othFact = toNum(row.OtherFactTime);
    const whFact = toNum(row.WaterHeaterFactTime);
    return {
      day,
      othPlan,
      othFact,
      whPlan,
      whFact,
      pctTotal: null,
    };
  });
  arr.forEach((d) => {
    const plan = (d.othPlan ?? 0) + (d.whPlan ?? 0);
    const fact = (d.othFact ?? 0) + (d.whFact ?? 0);
    d.pctTotal = plan ? Math.round((fact / plan) * 100) : null;
  });
  return arr;
}

/* ---------- стили ---------- */
const AXIS_GAP = 22;
const GAP = 24;
const COLOR_PLAN = '#D1D5DB';
const COLOR_FACT = '#6BE69A';
const CURSOR_STYLE = {
  fill: '#EAF3FF',
  fillOpacity: 0.7,
};

/* ---------- Tooltip ---------- */
const CustomTooltip: React.FC<any> = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload as DataPoint;
  const left = payload[0].dataKey.startsWith('oth');
  const plan = left ? d.othPlan : d.whPlan;
  const fact = left ? d.othFact ?? 0 : d.whFact ?? 0;

  return (
    <div style={{ background: '#fff', border: '1px solid #d1d5db', padding: 8, fontSize: 12 }}>
      <strong>Day {label}</strong>
      <br />Plan: {human(plan)}
      <br />Fact: {human(fact)}
      <br />%: {pct(fact, plan)}
    </div>
  );
};

/* ---------- компакт-легенда ---------- */
const LegendInline: React.FC = () => (
  <div style={{ textAlign: 'center', fontSize: 12, marginTop: 8 }}>
    <span style={{ color: COLOR_PLAN }}>■</span> Plan&nbsp;&nbsp;
    <span style={{ color: COLOR_FACT }}>■</span> Fact
  </div>
);

/* ---------- компонент ---------- */
const PlanCumulativeMirrorChart: React.FC<PlanCumulativeChartProps> = ({
  table2,
  year,
  month,
}) => {
  const [chartTab, setChartTab] = useState<'summary' | 'daily'>('summary');
  const preparedSummary = buildData(table2);
  const preparedDaily = buildDataDaily(table2);

  const today =
    year === new Date().getFullYear() && month === new Date().getMonth() + 1
      ? new Date().getDate()
      : month - 1 < new Date().getMonth() || year < new Date().getFullYear()
      ? new Date(year, month, 0).getDate()
      : 0;

  const dataSummary = preparedSummary.map((d) => ({
    ...d,
    othFact: Number(d.day) <= today ? d.othFact : null,
    whFact: Number(d.day) <= today ? d.whFact : null,
  }));
  const dataDaily = preparedDaily.map((d) => ({
    ...d,
    othFact: Number(d.day) <= today ? d.othFact : null,
    whFact: Number(d.day) <= today ? d.whFact : null,
  }));
  const data = chartTab === 'summary' ? dataSummary : dataDaily;
  // Для процентов по центру всегда используем накопительный массив
  const percentLabelsData = dataSummary;

  const maxOth = Math.max(...data.map((d) => Math.max(d.othPlan, d.othFact ?? 0)));
  const maxWH  = Math.max(...data.map((d) => Math.max(d.whPlan, d.whFact ?? 0)));

  /* ---------- наблюдение за размером контейнера ---------- */
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setSize({ width, height });
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // Корректный пересчёт размера контейнера при возврате на Summary
  useEffect(() => {
    if (chartTab === 'summary' && containerRef.current) {
      const { width, height } = containerRef.current.getBoundingClientRect();
      setSize({ width, height });
    }
  }, [chartTab]);

  /* вертикальная шкала для %-меток */
  const yScale = scaleBand<string>()
    .domain(data.map((d) => d.day))
    .range([size.height - AXIS_GAP, 20])
    .paddingInner(0.1);

  // Массив дней для процентов: '07', '14', '21', '28', последний день месяца
  const daysInMonth = new Date(year, month, 0).getDate();
  const percentDays: string[] = [];
  for (let d = 7; d <= daysInMonth; d += 7) percentDays.push(d.toString().padStart(2, '0'));
  if (daysInMonth % 7 !== 0 && !percentDays.includes(daysInMonth.toString().padStart(2, '0')))
    percentDays.push(daysInMonth.toString().padStart(2, '0'));

  const showPct = (idx: number, d: DataPoint) => {
    const dayNum = Number(d.day);
    return percentDays.includes(d.day) && today >= dayNum;
  };

  /* ---------- JSX ---------- */
  return (
    <div className="bg-white p-4">
      {/* ----------- TEXT BLOCK ----------- */}
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-[#0d1c3d] mb-2">
          Monthly Plan Performance by Working-Time Fund
        </h3>
        {/* 4-я строка: проверка на отставание по двум группам */}
        {(() => {
          // Определяем сегодняшнее число (или максимум в данных)
          const today =
            year === new Date().getFullYear() && month === new Date().getMonth() + 1
              ? new Date().getDate()
              : month - 1 < new Date().getMonth() || year < new Date().getFullYear()
              ? new Date(year, month, 0).getDate()
              : 0;
          // Суммируем часы по группам за первые (today-1) дней
          let planHeater = 0, factHeater = 0, planWH = 0, factWH = 0;
          for (let i = 0; i < table2.length && i < today - 1; ++i) {
            const row = table2[i];
            planHeater += toNum(row.OtherPlanTime);
            factHeater += toNum(row.OtherFactTime);
            planWH += toNum(row.WaterHeaterPlanTime);
            factWH += toNum(row.WaterHeaterFactTime);
          }
          const diffHeater = factHeater - planHeater;
          const diffWH = factWH - planWH;
          return (
            <div style={{ color: '#6b7280', fontSize: 14, marginTop: 2, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              Lag as of today:
              <span>
                Heater <span style={{ color: diffHeater < 0 ? '#E57373' : '#8BC34A', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                  {diffHeater.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                  <span style={{ fontSize: '1em', color: diffHeater < 0 ? '#E57373' : '#8BC34A', marginLeft: 2 }}>
                    {diffHeater < 0 ? '\u2193' : '\u2191'}
                  </span>
                </span>
              </span>
              <span>
                Water heater <span style={{ color: diffWH < 0 ? '#E57373' : '#8BC34A', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                  {diffWH.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                  <span style={{ fontSize: '1em', color: diffWH < 0 ? '#E57373' : '#8BC34A', marginLeft: 2 }}>
                    {diffWH < 0 ? '\u2193' : '\u2191'}
                  </span>
                </span>
              </span>
            </div>
          );
        })()}
      </div>

      {/* ----------- ТАБ-ПЕРЕКЛЮЧАТЕЛЬ ----------- */}
      <div className="flex items-center gap-2 mb-2">
        <span className="text-sm font-semibold text-gray-700">
          Select
        </span>
        <span className="text-gray-400">→</span>
        <button
          type="button"
          onClick={() => setChartTab('summary')}
          className={`px-2 py-1 text-xs font-medium rounded border transition-colors ${
            chartTab === 'summary' 
              ? 'bg-[#0d1c3d] text-white border-[#0d1c3d]' 
              : 'bg-gray-100 text-gray-700 border-gray-300'
          }`}
        >
          Summary
        </button>
        <button
          type="button"
          onClick={() => setChartTab('daily')}
          className={`px-2 py-1 text-xs font-medium rounded border transition-colors ${
            chartTab === 'daily' 
              ? 'bg-[#0d1c3d] text-white border-[#0d1c3d]' 
              : 'bg-gray-100 text-gray-700 border-gray-300'
          }`}
        >
          Daily
        </button>
      </div>
      <div style={{ height: 8 }} />

      {/* ----------- CHART SHELL ----------- */}
      <div style={{ position: 'relative' /* ChartShell */ }}>
        <div
          ref={containerRef}
          style={{ position: 'relative', display: 'flex', height: 500, width: '100%' }}
        >
          {/* ------- ЛЕВАЯ ПОЛОВИНА ------- */}
          <ResponsiveContainer width="50%" height="100%">
            <BarChart
              data={data}
              syncId="mirror"
              layout="vertical"
              margin={{ top: 20, right: GAP, left: -20, bottom: AXIS_GAP }}
            >
              <CartesianGrid stroke="#EAEDF5" strokeDasharray="3 3" vertical={false} />
              <XAxis
                type="number"
                domain={[0, maxOth]}
                reversed
                tickFormatter={(v) => (v / 1000).toFixed(1).replace('.', ',')}
                tick={{ fontSize: 12, dy: 6, textAnchor: 'middle', fontWeight: 'bold', fill: '#A3A3A3' }}
                tickLine={false}
                axisLine={{ stroke: '#D1D5DB', strokeWidth: 1 }}
                height={AXIS_GAP}
              />
              <YAxis
                dataKey="day"
                type="category"
                width={50}
                axisLine={{ stroke: '#D1D5DB', strokeWidth: 1 }}
                tick={{
                  fontSize: 12,
                  fill: '#A3A3A3',
                  fontWeight: 'bold',
                  textAnchor: 'end',
                  dx: -6,
                }}
                tickLine={false}
                reversed
              />
              <ReferenceLine x={0} stroke="#D1D5DB" />

              <Bar dataKey="othPlan" fill={COLOR_PLAN} barSize={10} />
              <Bar dataKey="othFact" fill={COLOR_FACT} barSize={10} />

              <Tooltip content={<CustomTooltip />} cursor={CURSOR_STYLE} />
            </BarChart>
          </ResponsiveContainer>

          {/* ------- ПРАВАЯ ПОЛОВИНА ------- */}
          <ResponsiveContainer width="50%" height="100%">
            <BarChart
              data={data}
              syncId="mirror"
              layout="vertical"
              margin={{ top: 20, right: 20, left: GAP, bottom: AXIS_GAP }}
            >
              <CartesianGrid stroke="#EAEDF5" strokeDasharray="3 3" vertical={false} />
              <XAxis
                type="number"
                domain={[0, maxWH]}
                tickFormatter={(v) => (v / 1000).toFixed(1).replace('.', ',')}
                tick={{ fontSize: 12, dy: 6, textAnchor: 'middle', fontWeight: 'bold', fill: '#A3A3A3' }}
                tickLine={false}
                axisLine={{ stroke: '#D1D5DB', strokeWidth: 1 }}
                height={AXIS_GAP}
              />
              <YAxis
                type="category"
                dataKey="day"
                width={0}
                hide
                axisLine={{ stroke: '#D1D5DB', strokeWidth: 1 }}
                tickLine={false}
                reversed
              />
              <ReferenceLine x={0} stroke="#D1D5DB" />

              <Bar dataKey="whPlan" fill={COLOR_PLAN} barSize={10} />
              <Bar dataKey="whFact" fill={COLOR_FACT} barSize={10} />

              <Tooltip content={<CustomTooltip />} cursor={CURSOR_STYLE} />
            </BarChart>
          </ResponsiveContainer>

          {/* ------- %-МЕТКИ ------- */}
          {size.width > 0 && (
            <svg
              width={size.width}
              height={size.height}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                pointerEvents: 'none',
                zIndex: 10,
              }}
            >
              {percentLabelsData.map((d) => {
                if (!showPct(0, d) || d.pctTotal == null) return null;
                const y = yScale(d.day)! + yScale.bandwidth() / 2;
                return (
                  <text
                    key={d.day}
                    x={size.width / 2}
                    y={y}
                    textAnchor="middle"
                    fontSize={12}
                    fill="#A3A3A3"
                    fontWeight="bold"
                    alignmentBaseline="middle"
                  >
                    {d.pctTotal} %
                  </text>
                );
              })}
            </svg>
          )}

          {/* Абсолютные подписи над половинами */}
          <div style={{
            position: 'absolute',
            top: -8,
            left: 0,
            width: '100%',
            display: 'flex',
            pointerEvents: 'none',
            zIndex: 2,
          }}>
            <div style={{ flex: 1, textAlign: 'center', fontWeight: 600, fontSize: 16, color: '#444' }}>
              Heaters
            </div>
            <div style={{ flex: 1, textAlign: 'center', fontWeight: 600, fontSize: 16, color: '#444' }}>
              Water heater
            </div>
          </div>
        </div>

        {/* Легенда под графиком */}
      </div>
    </div>
  );
};

export default PlanCumulativeMirrorChart;
