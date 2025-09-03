import {
  Chart,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  type ChartOptions,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { useTranslation } from 'react-i18next';

/* ─────────────────── регистрация Chart.js ─────────────────── */
Chart.register(BarElement, CategoryScale, LinearScale, Tooltip);

/* ─────────── размеры карточки ─────────── */
const CARD_H   = 362; // заметно выше (~+50%) для явного эффекта
const PAD_Y    = 16 * 2;
const CANVAS_H = CARD_H - PAD_Y;

/* ─────────── фирменные цвета ─────────── */
export const COLOR_PLAN   = 'rgba(59,130,246,0.35)';
export const COLOR_FACT   = 'rgba(59,130,246,0.90)';
export const COLOR_NOPLAN = 'rgba(209,213,219,0.40)';

/* ─────────── отключаем «овер‑100%» масштабирование ─────────── */

/* ─────────── константа для отступов ─────────── */
export const BRACKET_H = 0; // Убираем скобки, поэтому высота = 0

/* ─────────── плагин удален для упрощения ─────────── */

/* ─────────── основной компонент ─────────── */
type Props = {
  labels: string[];
  factBar?: number[];
  planRemainder?: number[];
  planExists?: boolean[];
  factExists?: boolean[];
  rawData?: any[];
  numericMode?: boolean;
  planValues?: number[];
  factValues?: number[];
};

export const TVBarChart = ({
  labels,
  factBar = [],
  planRemainder = [],
  planExists = [],
  rawData = [],
  numericMode = false,
  planValues = [],
  factValues = [],
}: Props) => {
  const { i18n } = useTranslation();
  const lng = i18n.language as 'en' | 'zh';

  // Управление жизненным циклом графика осуществляет react-chartjs-2

  /* helpers */
  const formatNum = (num: number) =>
    typeof num === 'number'
      ? num.toLocaleString('ru-RU').replace(/,/g, ' ')
      : num;

  const trWorkShop = (n: string) => {
    return n; // Для TV используем оригинальные названия
  };

  /* ─── нормализуем значения 0..100 → 0..1 для процентного режима ─── */
  const to01 = (v: number | null | undefined) => {
    const n = typeof v === 'number' ? v : 0;
    if (!isFinite(n)) return 0;
    return Math.min(Math.max(n, 0), 100) / 100;
  };

  const scaledFact = (factBar || []).map(v => to01(v));
  const scaledPlan = (planExists || []).map(e => (e ? 1 : 0));

  /* данные для Chart.js */
  const data = numericMode
    ? {
        labels: labels || [],
        datasets: [
          {
            label: 'Plan',
            data: planValues,
            backgroundColor: COLOR_PLAN,
            barPercentage: 0.9,
            categoryPercentage: 0.8,
          },
          {
            label: 'Fact',
            data: factValues,
            backgroundColor: COLOR_FACT,
            barPercentage: 0.9,
            categoryPercentage: 0.8,
          },
        ],
      }
    : {
        labels: labels || [],
        datasets: [
          {
            label: 'Plan',
            data: scaledPlan,
            backgroundColor: planExists?.map(e => (e ? COLOR_PLAN : COLOR_NOPLAN)) || [],
            barPercentage: 0.9,
            categoryPercentage: 0.8,
          },
          {
            label: 'Fact',
            data: scaledFact,
            backgroundColor: COLOR_FACT,
            barPercentage: 0.9,
            categoryPercentage: 0.8,
          },
        ],
      };

  const options: ChartOptions<'bar'> = {
    maintainAspectRatio: false,
    responsive: true,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(0,0,0,0.8)',
        displayColors: true,
        callbacks: {
          label: ctx => {
            const label = ctx.dataset.label;
            const i = ctx.dataIndex;
            const row = rawData[i];
            if (!row) return '';
            if (numericMode) {
              const time = row?.HourLabel || labels[i] || '—'; // Используем HourLabel
              const planQty = row?.PlanQty != null ? formatNum(Math.round(Number(row.PlanQty))) : '0';
              const factQty = row?.FactQty != null ? formatNum(Math.round(Number(row.FactQty))) : '0';
              if (label === 'Plan') return [`${time}`, `Plan: ${planQty} шт`];
              if (label === 'Fact') return [`${time}`, `Fact: ${factQty} шт`];
              return '';
            } else {
              const time = row.WorkCenter_Custom_CN || 'Unknown';
              const channel = row.WorkShop_Cn || 'Unknown';
              if (label === 'Plan') {
                const planQty  = row.Plan_QTY  ? formatNum(Math.round(Number(row.Plan_QTY)))  : '0';
                const planTime = row.Plan_TIME ? formatNum(Math.round(Number(row.Plan_TIME))) : '0';
                return [`Time: ${time}`, `Channel: ${channel}`, `Plan Qty: ${planQty}`, `Plan Time: ${planTime}`];
              }
              if (label === 'Fact') {
                const factQty  = row.FACT_QTY  ? formatNum(Math.round(Number(row.FACT_QTY)))  : '0';
                const factTime = row.FACT_TIME ? formatNum(Math.round(Number(row.FACT_TIME))) : '0';
                return [`Time: ${time}`, `Channel: ${channel}`, `Fact Qty: ${factQty}`, `Fact Time: ${factTime}`];
              }
              return '';
            }
          },
          labelColor: ctx => {
            const label = ctx.dataset.label;
            const base  = label === 'Plan' ? COLOR_PLAN
                         : label === 'Fact' ? COLOR_FACT
                         : '#ccc';
            return {
              borderColor: base,
              backgroundColor: base,
              borderWidth: 2,
              borderRadius: 2,
            };
          },
        },
      },
             // workshopBracket: { groups: bracketGroups }, // Удален плагин скобок
    },
    interaction: { mode: 'index', intersect: false },
    scales: {
      x: {
        stacked: false,
        grid: { display: false },
        ticks: {
          callback(v) { return this.getLabelForValue(v as number).split('\n'); },
          color: '#6b7280', // Темно-серый цвет для всех подписей
        },
      },
      y: {
        stacked: false,
        min: 0,
        max: numericMode ? undefined : 1,
        grid: { color: 'rgba(0,0,0,0.06)' },
        ticks: {
          stepSize: numericMode ? undefined : 0.1,
          callback: (value) => {
            const numValue = typeof value === 'number' ? value : 0;
            return numericMode ? formatNum(numValue as number) : `${Math.round(numValue * 100)}`;
          },
          color: '#4B5563',
        },
      },
    },
  };

  return (
    <div className="relative">
      <div
        className="-mx-4 w-[calc(100%+2rem)] relative overflow-visible"
        style={{ height: `${CANVAS_H}px` }}
      >
        <Bar 
          data={data} 
          options={options} 
          height={CANVAS_H}
        />
      </div>
    </div>
  );
};


