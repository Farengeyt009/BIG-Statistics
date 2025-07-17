// src/pages/Home/Production/components/BarChart.tsx
import {
  Chart,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  type ChartOptions,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import 'chart.js/auto';

Chart.register(BarElement, CategoryScale, LinearScale, Tooltip);

/* ────────────────────────────────
   ПАРАМЕТРЫ КАРТОЧКИ
──────────────────────────────────*/
const CARD_H  = 384;      // h-96  ⇢ 24 rem
const PAD_Y   = 16 * 2;   // p-4   ⇢ 1 rem сверху + снизу
const CHART_H = CARD_H - PAD_Y; // чистое пространство под canvas (352 px)

/* ────────────────────────────────
   ФИРМЕННЫЕ ОТТЕНКИ
──────────────────────────────────*/
const VISITORS = 'rgba(59,130,246,.90)'; // ярче (нижний слой)
const VIEWS    = 'rgba(59,130,246,.35)'; // светлей (верхний слой)

type Props = {
  labels: string[];
  views: number[];
  visitors: number[];
};

export const BarChart = ({ labels, views, visitors }: Props) => {
  const data = {
    labels,
    datasets: [
      {
        label: 'Visitors',
        data: visitors,
        backgroundColor: VISITORS,
        borderWidth: 0,
        stack: 's',
        barPercentage: 0.8,
        categoryPercentage: 1,
      },
      {
        label: 'Views',
        data: views,
        backgroundColor: VIEWS,
        borderWidth: 0,
        stack: 's',
        barPercentage: 0.8,
        categoryPercentage: 1,
      },
    ],
  };

  const options: ChartOptions<'bar'> = {
    maintainAspectRatio: false,
    responsive: true,
    layout: { padding: 0 }, // убираем внутренний padding Chart.js
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(0,0,0,0.8)',
        titleFont: { family: 'Inter' },
        bodyFont:  { family: 'Inter' },
      },
    },
    scales: {
      x: {
        stacked: true,
        grid: { display: false },
        ticks: {
          color: 'var(--base600)',
          font: { family: 'Inter' },
          padding: 0,
        },
      },
      y: {
        stacked: true,
        beginAtZero: true,
        grid: { color: 'rgba(0,0,0,0.06)' },
        border: { display: false }, // корректное скрытие рамки в Chart.js v4
        ticks: {
          stepSize: 90,
          color: 'var(--base600)',
          font: { family: 'Inter' },
          padding: 0,
          callback: (tickValue: string | number) =>
            Number(tickValue) === 0 ? '' : tickValue,
        },
      },
    },
  };

  return (
    <div
      className="relative w-full overflow-hidden"
      style={{ height: CHART_H }}
    >
      <Bar data={data} options={options} height={CHART_H} />
    </div>
  );
};
