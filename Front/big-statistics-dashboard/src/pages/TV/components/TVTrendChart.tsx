import {
  TVBarChart,
  COLOR_FACT,
  COLOR_PLAN,
  COLOR_NOPLAN,
  BRACKET_H,
} from './TVBarChart';
import { useTranslation } from 'react-i18next';

interface HourlyRow {
  WorkShopID: string;
  WorkCenterID: string;
  HourStart: string; // '2025-08-31 08:00:00.000'
  HourLabel: string; // '08:00' - для оси X
  PlanQty: number | string | null; // шт для столбца план
  FactQty: number | string | null; // шт для столбца факт
}

interface TrendChartProps {
  productionData: any[]; // совместимость со старым вызовом
  hourlyData?: HourlyRow[]; // новые данные из API fn_TV_Hourly
  filterWorkCenterId?: string;
}

export const TVTrendChart = ({ productionData, hourlyData, filterWorkCenterId }: TrendChartProps) => {
  const { t, i18n } = useTranslation('tv');
  const lng = i18n.language as 'en' | 'zh';

  // Новый режим: если hourlyData есть — строим числовой график по PlanQty/FactQty
  if (Array.isArray(hourlyData) && hourlyData.length > 0) {
    const filtered = filterWorkCenterId
      ? hourlyData.filter(r => String(r.WorkCenterID || '') === String(filterWorkCenterId))
      : hourlyData;

    // Сортировка по времени HourStart
    const byTime = [...filtered].sort((a, b) => (a.HourStart || '').localeCompare(b.HourStart || ''));
    const labels = byTime.map(r => r.HourLabel || ''); // Используем HourLabel для оси X
    const planValues = byTime.map(r => Math.round(Number(r.PlanQty || 0)));
    const factValues = byTime.map(r => Math.round(Number(r.FactQty || 0)));

    return (
      <div className="w-full rounded-2xl bg-white p-4 flex flex-col min-h-[18rem]">
        <div className="-mx-4 relative overflow-visible" style={{ paddingBottom: `10px` }}>
          <TVBarChart
            labels={labels}
            numericMode={true}
            planValues={planValues}
            factValues={factValues}
            rawData={byTime as any}
          />
        </div>
        <div className="mt-1 flex justify-center gap-4 text-xs pointer-events-none">
          <LegendDot color={COLOR_PLAN} text={t('legend.plan', { defaultValue: 'Plan' })} />
          <LegendDot color={COLOR_FACT} text={t('legend.fact', { defaultValue: 'Fact' })} />
        </div>
      </div>
    );
  }

  // Старый процентный режим — оставляем как fallback
  /* ── кастомная сортировка данных по времени ── */
  const parseTime = (timeStr: string): number => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + (minutes || 0);
  };

  const sortedData = [...productionData].sort((a, b) => {
    const timeA = parseTime(a.WorkCenter_Custom_CN || '');
    const timeB = parseTime(b.WorkCenter_Custom_CN || '');
    return timeA - timeB; // Сортировка по времени
  });

  const labels = sortedData.map(i => {
    const key = i.WorkCenter_Custom_CN?.trim();
    return key || 'Unknown';
  });

  const planTimes = sortedData.map(i => (i.Plan_TIME ? +i.Plan_TIME : null));
  const factTimes = sortedData.map(i => (i.FACT_TIME ? +i.FACT_TIME : null));
  const planExists = planTimes.map(p => !!p && p > 0);
  const factExists = factTimes.map(f => !!f && f > 0);

  const factBar = factTimes.map((fact, i) =>
    planExists[i] ? (fact ? (fact / (planTimes[i] as number)) * 100 : 0)
                  : factExists[i] ? 100 : 0,
  );
  const planRemainder = factBar.map((v, i) =>
    planExists[i] ? (v >= 100 ? 0 : 100 - v)
                  : factExists[i] ? 0 : 100,
  );

  /* ── рендер ── */
  return (
    <div className="w-full rounded-2xl bg-white p-4 flex flex-col min-h-[18rem]">
      {/* график */}
      <div
        className="-mx-4 relative overflow-visible"
        style={{ paddingBottom: `10px` }}
      >
        <TVBarChart
          labels={labels}
          factBar={factBar}
          planRemainder={planRemainder}
          planExists={planExists}
          factExists={factExists}
          rawData={sortedData}
        />
      </div>

      {/* легенда — ниже графика с небольшим отступом */}
      <div className="mt-1 flex justify-center gap-4 text-xs pointer-events-none">
        <LegendDot
          color={COLOR_PLAN}
          text={t('legend.plan', { defaultValue: 'Plan' })}
        />
        <LegendDot
          color={COLOR_FACT}
          text={t('legend.fact', { defaultValue: 'Fact' })}
        />
      </div>
    </div>
  );
};

/* ── точка легенды ── */
const LegendDot = ({ color, text }: { color: string; text: string }) => (
  <div className="flex items-center gap-1">
    <span className="block h-3 w-3 rounded-full" style={{ background: color }} />
    {text}
  </div>
);


