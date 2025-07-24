import {
  Chart,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  type ChartOptions,
  type Plugin,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { useTranslation } from 'react-i18next';
import homeTranslations from '../../HomeTranslation.json';

/* ─────────────────── регистрация Chart.js ─────────────────── */
Chart.register(BarElement, CategoryScale, LinearScale, Tooltip);

/* ─────────── размеры карточки ─────────── */
const CARD_H   = 482;
const PAD_Y    = 16 * 2;
const CANVAS_H = CARD_H - PAD_Y;

/* ─────────── фирменные цвета ─────────── */
export const COLOR_PLAN   = 'rgba(59,130,246,0.35)';
export const COLOR_FACT   = 'rgba(59,130,246,0.90)';
export const COLOR_NOPLAN = 'rgba(209,213,219,0.40)';

/* ─────────── «перелом» шкалы ─────────── */
const CUT_OFF        = 100;   // где заканчивается «нормальный» участок
const OVERFLOW_AREA  = 0.20;  // 20 % вертикали отдаём «овер‑плану»

/** перевод реального процента в диапазон 0‑1 с «коридором» наверху */
const compress = (v: number, max: number) => {
  if (max <= CUT_OFF) return v / CUT_OFF;            // всё < 100 %
  if (v <= CUT_OFF)    return (v / CUT_OFF) * (1 - OVERFLOW_AREA);
  // остальное «сминаем» в OVERFLOW_AREA
  return (1 - OVERFLOW_AREA) +
         ((v - CUT_OFF) / (max - CUT_OFF)) * OVERFLOW_AREA;
};

/* ─────────── плагин скобок ─────────── */
export const BRACKET_H = 45;
const MARGIN_OUT  = 4;

type GroupOpt = { startIndex: number; endIndex: number; label: string };

const workshopBracket: Plugin<'bar', { groups: GroupOpt[] }> = {
  id: 'workshopBracket',
  beforeLayout(chart) {
    const raw = chart.options.layout?.padding as Partial<
      Record<'top' | 'right' | 'bottom' | 'left', number>
    > | undefined;
    const newBottom = Math.max(raw?.bottom ?? 0, BRACKET_H + 8);
    chart.options.layout = { ...chart.options.layout, padding: { ...raw, bottom: newBottom } };
  },
  afterDraw(chart, _args, opts) {
    const { ctx } = chart;
    const meta = chart.getDatasetMeta(0);
    const y    = chart.chartArea.bottom + 4;

    ctx.save();
    ctx.strokeStyle = '#6b7280';
    ctx.lineWidth   = 0.2;
    ctx.font        = 'bold 12px Inter';
    ctx.fillStyle   = '#6b7280'; // Темно-серый цвет для всех подписей
    ctx.textAlign   = 'center';
    ctx.textBaseline = 'top';

    opts.groups.forEach(g => {
      const start = meta.data[g.startIndex] as any;
      const end   = meta.data[g.endIndex]   as any;
      if (!start || !end) return;

      const x1 = start.x - start.width / 2 - MARGIN_OUT;
      const x2 = end.x   + end.width   / 2 + MARGIN_OUT;

      ctx.beginPath();
      ctx.moveTo(x1, y);
      ctx.lineTo(x1, y + BRACKET_H);
      ctx.lineTo(x2, y + BRACKET_H);
      ctx.lineTo(x2, y);
      ctx.stroke();

      ctx.fillText(g.label, (x1 + x2) / 2, y + BRACKET_H + 10);
    });

    ctx.restore();
  },
};
Chart.register(workshopBracket);

/* ─────────── плагин: оставляем только наши тики ─────────── */
const stripExtraYTicks: Plugin<'bar', { ticks: { value: number; label: string }[] }> = {
  id: 'stripExtraYTicks',
  afterBuildTicks(chart, _args, opts) {
    const y = chart.scales.y;
    y.ticks = opts.ticks.map(t => ({ ...t, major: false }));
  },
};
Chart.register(stripExtraYTicks);

/* ─────────── основной компонент ─────────── */
type Props = {
  labels: string[];
  factBar: number[];
  planRemainder: number[];
  planExists: boolean[];
  factExists: boolean[];
  workShops?: string[];
  rawData?: any[];
};

export const BarChart = ({
  labels, factBar, planRemainder, planExists, workShops, rawData = [],
}: Props) => {
  const { i18n } = useTranslation();
  const lng = i18n.language as 'en' | 'zh';

  /* helpers */
  const formatNum = (num: number) =>
    typeof num === 'number'
      ? num.toLocaleString('ru-RU').replace(/,/g, ' ')
      : num;

  const trWorkShop = (n: string) => {
    const key = n.trim() as keyof typeof homeTranslations.workshops;
    return homeTranslations.workshops[key]?.[lng] ?? n;
  };

  /* группы для скобок */
  const groupsRec: Record<string, { start: number; end: number }> = {};
  workShops?.forEach((ws, i) => {
    if (!groupsRec[ws]) groupsRec[ws] = { start: i, end: i };
    groupsRec[ws].end = i;
  });
  const bracketGroups = Object.entries(groupsRec)
    .filter(([, g]) => g.end - g.start >= 2)
    .map(([ws, g]) => ({ startIndex: g.start, endIndex: g.end, label: trWorkShop(ws) }));

  /* ─── «сжимаем» значения и формируем датасеты ─── */
  const totals   = labels.map((_, i) => factBar[i] + planRemainder[i]);
  const rawMax   = Math.max(...totals, CUT_OFF);
  const niceMax  = Math.ceil(rawMax / 10) * 10;          // ← 110, 120, 300 …

  const scaleFor = (total: number) =>
    compress(total, niceMax) / (total || 1);             // helper

  const scaledFact = labels.map((_, i) => factBar[i]      * scaleFor(totals[i]));
  const scaledPlan = labels.map((_, i) => planRemainder[i] * scaleFor(totals[i]));

  /* список тиков: 0‑100 + niceMax */
  const baseTicks   = Array.from({ length: 11 }, (_, i) => i * 10);
  const tickVals    = niceMax > CUT_OFF ? [...baseTicks, niceMax] : baseTicks;
  const customTicks = tickVals.map(v => ({
    value: compress(v, niceMax),
    label: `${v}`,
  }));

  /* данные для Chart.js */
  const data = {
    labels,
    datasets: [
      {
        label: 'Факт',
        data: scaledFact,
        backgroundColor: COLOR_FACT,
        stack: 'stack',
        barPercentage: 0.8,
        categoryPercentage: 1.0,
      },
      {
        label: 'План',
        data: scaledPlan,
        backgroundColor: planExists.map(e => (e ? COLOR_PLAN : COLOR_NOPLAN)),
        stack: 'stack',
        barPercentage: 0.8,
        categoryPercentage: 1.0,
      },
    ],
  };

  const options: ChartOptions<'bar'> = {
    maintainAspectRatio: false,
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

            if (label === 'План' || label === 'Plan') {
              const planQty  = row.Plan_QTY  ? formatNum(Math.round(Number(row.Plan_QTY)))  : '0';
              const planTime = row.Plan_TIME ? formatNum(Math.round(Number(row.Plan_TIME))) : '0';
              return [` Plan Qty: ${planQty}`, ` Plan Time: ${planTime}`];
            }

            if (label === 'Факт' || label === 'Fact') {
              const factQty  = row.FACT_QTY  ? formatNum(Math.round(Number(row.FACT_QTY)))  : '0';
              const factTime = row.FACT_TIME ? formatNum(Math.round(Number(row.FACT_TIME))) : '0';
              return [` Fact Qty: ${factQty}`, ` Fact Time: ${factTime}`, ''];
            }
            return '';
          },
          labelColor: ctx => {
            const label = ctx.dataset.label;
            const base  = label === 'План' ? COLOR_PLAN
                         : label === 'Факт' ? COLOR_FACT
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
      workshopBracket: { groups: bracketGroups },
      stripExtraYTicks: { ticks: customTicks },
    },
    interaction: { mode: 'index', intersect: false },
    scales: {
      x: {
        stacked: true,
        grid: { display: false },
        ticks: {
          callback(v) { return this.getLabelForValue(v as number).split('\n'); },
          color: '#6b7280', // Темно-серый цвет для всех подписей
        },
      },
      y: {
        stacked: true,
        min: 0,
        max: 1,
        grid: { color: 'rgba(0,0,0,0.06)' },
        ticks: {
          stepSize: 0.1,                          // 10 % «сырой» шаг
          callback: (_v, i, arr) => {
            // @ts-ignore label хранится в customTicks
            const l: string | undefined = arr[i]?.label;
            return l ? `${l}%` : '';
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
        style={{ height: CANVAS_H }}
      >
        <Bar data={data} options={options} height={CANVAS_H} />
      </div>
    </div>
  );
};
