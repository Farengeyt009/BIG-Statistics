import React, { useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Dot, Area, AreaChart,
} from 'recharts';

interface Props {
  data: any[];
  startDate: Date | null;
  endDate: Date | null;
  metric: 'defect' | 'pct';
}

interface ChartPoint {
  label:  string;
  key:    string;
  defect: number;
  prod:   number;
  value:  number;
  isBell?: boolean;
}

const CustomTooltip = ({ active, payload, metric }: any) => {
  if (!active || !payload?.length) return null;
  const pt: ChartPoint = payload[0]?.payload;
  // For bell curve — only show tooltip at the peak (real data)
  if (pt?.isBell && pt.label === '') return null;
  return (
    <div style={{
      background: '#fff', border: '1px solid #e5e7eb',
      borderRadius: 6, padding: '6px 12px', fontSize: 12,
      boxShadow: '0 2px 8px rgba(0,0,0,0.10)',
    }}>
      <div style={{ color: '#6b7280', marginBottom: 2 }}>{pt?.key}</div>
      {metric === 'defect' ? (
        <div style={{ color: '#0d1c3d', fontWeight: 600 }}>
          Defect: {pt?.defect?.toLocaleString('ru-RU')}
        </div>
      ) : (
        <>
          <div style={{ color: '#0d1c3d', fontWeight: 600 }}>
            Defect %: {pt?.value != null ? `${pt.value.toFixed(1)}%` : '—'}
          </div>
          <div style={{ color: '#6b7280', fontSize: 11 }}>
            {pt?.defect?.toLocaleString('ru-RU')} / {pt?.prod?.toLocaleString('ru-RU')}
          </div>
        </>
      )}
    </div>
  );
};

const diffDays = (a: Date, b: Date) =>
  Math.round(Math.abs(b.getTime() - a.getTime()) / 86_400_000);

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// Generate a bell curve with N points for a single real value at the peak
const buildBellCurve = (peak: number, defect: number, prod: number, dateKey: string, dateLabel: string): ChartPoint[] => {
  const N = 40;
  const mu = N / 2;
  const sigma = N / 6;
  return Array.from({ length: N + 1 }, (_, i) => {
    const isPeak = i === Math.round(mu);
    const y = peak * Math.exp(-Math.pow(i - mu, 2) / (2 * sigma * sigma));
    return {
      label: isPeak ? dateLabel : '',
      key:   dateKey,
      defect: isPeak ? defect : 0,
      prod,
      value:  y,
      isBell: true,
    };
  });
};

const LQCDefectChart: React.FC<Props> = ({ data, startDate, endDate, metric }) => {
  const { chartData, mode, isBell } = useMemo(() => {
    if (!startDate || !endDate) return { chartData: [] as ChartPoint[], mode: 'day' as const, isBell: false };

    const days = diffDays(startDate, endDate);
    const mode: 'day' | 'month' | 'year' =
      days <= 31 ? 'day' : days <= 365 ? 'month' : 'year';

    // Шаг 1: глобальная дедупликация Prod_Fact_QTY
    const pfAcc = new Map<string, { sum: number; count: number }>();
    for (const r of data) {
      const dateStr = r.Date ? String(r.Date).slice(0, 10) : null;
      if (!dateStr) continue;
      const dk = `${dateStr}|${r.Control_Tochka_Ru || ''}|${r.Prod_Order_No || ''}`;
      const pf = Number(r.Prod_Fact_QTY) || 0;
      const prev = pfAcc.get(dk);
      if (prev) { prev.sum += pf; prev.count += 1; }
      else { pfAcc.set(dk, { sum: pf, count: 1 }); }
    }
    const globalPF = new Map<string, number>();
    pfAcc.forEach(({ sum, count }, k) => globalPF.set(k, count > 0 ? sum / count : 0));

    // Шаг 2: агрегация по периоду
    const defectByKey = new Map<string, number>();
    const prodByKey   = new Map<string, Map<string, number>>();

    for (const r of data) {
      const dateStr = r.Date ? String(r.Date).slice(0, 10) : null;
      if (!dateStr) continue;
      const periodKey =
        mode === 'day'   ? dateStr :
        mode === 'month' ? dateStr.slice(0, 7) :
                           dateStr.slice(0, 4);
      const dk = `${dateStr}|${r.Control_Tochka_Ru || ''}|${r.Prod_Order_No || ''}`;
      defectByKey.set(periodKey, (defectByKey.get(periodKey) ?? 0) + (Number(r.Defect_QTY) || 0));
      if (!prodByKey.has(periodKey)) prodByKey.set(periodKey, new Map());
      const seenMap = prodByKey.get(periodKey)!;
      if (!seenMap.has(dk)) seenMap.set(dk, globalPF.get(dk) ?? 0);
    }

    const getProd = (key: string) => {
      let total = 0;
      prodByKey.get(key)?.forEach(v => { total += v; });
      return total;
    };

    const points: ChartPoint[] = [];

    if (mode === 'day') {
      const cur = new Date(startDate); cur.setHours(0, 0, 0, 0);
      const end = new Date(endDate);   end.setHours(0, 0, 0, 0);
      while (cur <= end) {
        const y  = cur.getFullYear();
        const mo = String(cur.getMonth() + 1).padStart(2, '0');
        const dd = String(cur.getDate()).padStart(2, '0');
        const key = `${y}-${mo}-${dd}`;
        const defect = defectByKey.get(key) ?? 0;
        const prod   = getProd(key);
        points.push({ key, label: dd, defect, prod, value: metric === 'defect' ? defect : (prod > 0 ? (defect / prod) * 100 : 0) });
        cur.setDate(cur.getDate() + 1);
      }
    } else if (mode === 'month') {
      const cur = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
      const end = new Date(endDate.getFullYear(),   endDate.getMonth(),   1);
      while (cur <= end) {
        const y  = cur.getFullYear();
        const mo = String(cur.getMonth() + 1).padStart(2, '0');
        const key = `${y}-${mo}`;
        const defect = defectByKey.get(key) ?? 0;
        const prod   = getProd(key);
        points.push({ key, label: MONTHS[cur.getMonth()], defect, prod, value: metric === 'defect' ? defect : (prod > 0 ? (defect / prod) * 100 : 0) });
        cur.setMonth(cur.getMonth() + 1);
      }
    } else {
      const startY = startDate.getFullYear();
      const endY   = endDate.getFullYear();
      for (let y = startY; y <= endY; y++) {
        const key    = String(y);
        const defect = defectByKey.get(key) ?? 0;
        const prod   = getProd(key);
        points.push({ key, label: key, defect, prod, value: metric === 'defect' ? defect : (prod > 0 ? (defect / prod) * 100 : 0) });
      }
    }

    // Single point → generate bell curve
    if (points.length === 1) {
      const p = points[0];
      return {
        chartData: buildBellCurve(p.value, p.defect, p.prod, p.key, p.label),
        mode,
        isBell: true,
      };
    }

    return { chartData: points, mode, isBell: false };
  }, [data, startDate, endDate, metric]);

  if (!chartData.length) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 text-sm">
        No data
      </div>
    );
  }

  if (isBell) {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
          <defs>
            <linearGradient id="bellGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#0d1c3d" stopOpacity={0.15} />
              <stop offset="95%" stopColor="#0d1c3d" stopOpacity={0.01} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fill: '#6b7280' }}
            axisLine={{ stroke: '#e5e7eb' }}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 10, fill: '#6b7280' }}
            axisLine={false}
            tickLine={false}
            width={metric === 'pct' ? 38 : 32}
            tickFormatter={(v) =>
              metric === 'pct'
                ? `${v.toFixed(0)}%`
                : v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(Math.round(v))
            }
          />
          <Tooltip content={<CustomTooltip metric={metric} />} />
          <Area
            type="monotone"
            dataKey="value"
            stroke="#0d1c3d"
            strokeWidth={2}
            fill="url(#bellGrad)"
            dot={(props: any) => {
              const pt: ChartPoint = props.payload;
              if (!pt.isBell || pt.label === '') return <g key={props.key} />;
              return <Dot key={props.key} {...props} r={4} fill="#0d1c3d" strokeWidth={0} />;
            }}
            activeDot={{ r: 5, fill: '#dc2626' }}
          />
        </AreaChart>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 10, fill: '#6b7280' }}
          axisLine={{ stroke: '#e5e7eb' }}
          tickLine={false}
          interval={mode === 'day' && chartData.length > 20 ? 1 : 0}
        />
        <YAxis
          tick={{ fontSize: 10, fill: '#6b7280' }}
          axisLine={false}
          tickLine={false}
          width={metric === 'pct' ? 38 : 32}
          tickFormatter={(v) =>
            metric === 'pct'
              ? `${v.toFixed(0)}%`
              : v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v)
          }
        />
        <Tooltip content={<CustomTooltip metric={metric} />} />
        <Line
          type="monotone"
          dataKey="value"
          stroke="#0d1c3d"
          strokeWidth={2}
          dot={<Dot r={3} fill="#0d1c3d" strokeWidth={0} />}
          activeDot={{ r: 5, fill: '#dc2626' }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
};

export default LQCDefectChart;
