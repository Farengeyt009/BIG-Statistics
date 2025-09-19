import React from 'react';
import { apiGetOrderTails, OrderTailRow } from '../../../../config/timeloss-api';
import { Bar } from 'react-chartjs-2';
import {
  Chart,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
  type ChartOptions,
} from 'chart.js';
import { COLOR_FACT, COLOR_NOPLAN } from '../../../Home/Production/components/BarChart';
import { useTranslation } from 'react-i18next';
import { SimpleTable } from '../../../TV/components/SimpleTable';

Chart.register(BarElement, CategoryScale, LinearScale, Tooltip, Legend);

function ymKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

type Props = { rows?: OrderTailRow[]; suppressLocalLoaders?: boolean; onLoadingChange?: (l: boolean)=>void; hideTitle?: boolean };

const OrderTailsMonthlyAvgChart: React.FC<Props> = ({ rows, suppressLocalLoaders, onLoadingChange, hideTitle }) => {
  const { t } = useTranslation('production');
  const [labels, setLabels] = React.useState<string[]>([]);
  const [values, setValues] = React.useState<number[]>([]);
  const [hasData, setHasData] = React.useState<boolean[]>([]);
  const [tableRows, setTableRows] = React.useState<(string | number)[][]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    (async () => {
      setLoading(true);
      onLoadingChange?.(true);
      try {
        const apiRows = (rows && rows.length ? rows : await apiGetOrderTails());
        const map = new Map<string, { sum: number; cnt: number }>();
        apiRows.forEach((r: OrderTailRow) => {
          const dt = r.TailStartDate ? new Date(r.TailStartDate) : null;
          if (!dt) return;
          const key = ymKey(dt);
          const cur = map.get(key) || { sum: 0, cnt: 0 };
          cur.sum += Number(r.TailDays) || 0;
          cur.cnt += 1;
          map.set(key, cur);
        });

        const keys = Array.from(map.keys());
        const years = keys
          .map(k => Number(k.split('-')[0]))
          .filter(n => !Number.isNaN(n));
        const baseYear = years.length ? Math.max(...years) : new Date().getFullYear();

        const months = Array.from({ length: 12 }, (_, i) => i + 1);
        const outLabels = months.map(m => new Date(baseYear, m - 1, 1).toLocaleString('en-US', { month: 'short' }));
        const outValues: number[] = [];
        const outHas: boolean[] = [];
        months.forEach(m => {
          const key = `${baseYear}-${String(m).padStart(2, '0')}`;
          const rec = map.get(key);
          if (!rec) { outValues.push(0); outHas.push(false); return; }
          outValues.push(rec.cnt ? rec.sum / rec.cnt : 0);
          outHas.push(true);
        });

        setLabels(outLabels);
        setValues(outValues);
        setHasData(outHas);

        const filtered = apiRows.filter((r: any) => Number(r.Active_Tail) === 1);
        const rowsForTable: (string | number)[][] = filtered.map((r: any) => {
          const totalQty = Math.round(parseFloat(String(r.Total_QTY ?? '0')) || 0);
          const factQty = Math.round(parseFloat(String(r.FactTotal_QTY ?? '0')) || 0);
          const tailDays = Math.round(Number(r.TailDays ?? 0));
          return [
            String(r.OrderNumber ?? '').trim(),
            String(r.NomenclatureNumber ?? ''),
            String(r.GroupName ?? ''),
            totalQty,
            factQty,
            tailDays,
          ];
        });
        setTableRows(rowsForTable);
      } finally {
        setLoading(false);
        onLoadingChange?.(false);
      }
    })();
  }, [rows]);

  const maxVal = Math.max(...values, 0);
  const plotValues = values.map((v, i) => (hasData[i] ? v : maxVal));
  const colors = values.map((_, i) => (hasData[i] ? COLOR_FACT : COLOR_NOPLAN));

  const data = {
    labels,
    datasets: [
      {
        label: 'Avg Tail Days',
        data: plotValues,
        backgroundColor: colors,
      },
    ],
  };

  const options: ChartOptions<'bar'> = {
    maintainAspectRatio: false,
    layout: { padding: { top: 4, right: 8, bottom: 18, left: 8 } },
    plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => {
      const idx = ctx.dataIndex ?? 0;
      const prefix = hasData[idx] ? '' : '(no data) ';
      const v = Number(ctx.parsed.y || 0);
      return prefix + new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(v);
    } } } },
    scales: {
      x: {
        grid: { display: false },
        border: { display: true, color: '#D1D5DB' },
        ticks: {
          callback: (val: any, idx: number) => labels[idx] ?? String(val),
        },
      },
      y: {
        grid: { display: false },
        border: { display: true, color: '#D1D5DB' },
        ticks: { callback: (v: any) => new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(Number(v)) },
      },
    },
  };

  const cols = [
    t('orderTailsTable.orderNo') as string,
    t('orderTailsTable.articleNumber') as string,
    t('orderTailsTable.name') as string,
    t('orderTailsTable.orderQty') as string,
    t('orderTailsTable.complQty') as string,
    t('orderTailsTable.tailDays') as string,
  ];
  const alignOverrides = { 3: 'center', 4: 'center', 5: 'center' } as const;

  if (loading && suppressLocalLoaders) return null;
  if (loading) return null;

  return (
    <div className="bg-white rounded p-3">
      {!hideTitle && (
        <h3 className="text-lg font-semibold text-[#0d1c3d] mb-1">{t('orderTailsStats.chartTitle')}</h3>
      )}
      <div style={{ height: 340 }}>
        <Bar data={data} options={options} />
      </div>
      <div className="mt-4">
        <SimpleTable cols={cols} rows={tableRows} alignOverrides={alignOverrides} isExpanded={true} />
      </div>
    </div>
  );
};

export default OrderTailsMonthlyAvgChart;
