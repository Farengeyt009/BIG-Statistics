// src/pages/Home/Production/components/TrendChart.tsx
import {
  BarChart,
  COLOR_FACT,
  COLOR_PLAN,
  COLOR_NOPLAN,
  BRACKET_H,          // высота скобки
} from './BarChart';
import { useTranslation } from 'react-i18next';
import homeTranslations from '../../HomeTranslation.json';
import homeInterfaceTranslation from '../../homeInterfaceTranslation.json';

interface ProductionData {
  FACT_QTY: string | null;
  FACT_TIME: string | null;
  OnlyDate: string | null;
  Plan_QTY: number | null;
  Plan_TIME: string | null;
  WorkCenter_Custom_CN: string;
  WorkShop_Cn: string;
}
interface TrendChartProps { productionData: ProductionData[]; }

export const TrendChart = ({ productionData }: TrendChartProps) => {
  const { t, i18n } = useTranslation();
  const lng = i18n.language as 'en' | 'zh';

  /* ── кастомная сортировка данных ── */
  const getWorkshopPriority = (workshop: string): number => {
    const priorities: Record<string, number> = {
      '装配车间': 1,        // 1. Первый
      '热水器总装组': 2,    // 2. Второй
      '冲压车间': 3,        // 3. Третий
      '热水器冲压组': 4,    // 4. Четвертый
      '注塑车间': 5,        // 5. Пятый
    };
    return priorities[workshop] || 6; // 6. Остальные цеха
  };

  const sortedData = [...productionData].sort((a, b) => {
    const priorityA = getWorkshopPriority(a.WorkShop_Cn || '');
    const priorityB = getWorkshopPriority(b.WorkShop_Cn || '');
    
    if (priorityA !== priorityB) {
      return priorityA - priorityB; // Сортировка по приоритету
    }
    
    // Если приоритет одинаковый, сортируем по названию центра
    return (a.WorkCenter_Custom_CN || '').localeCompare(b.WorkCenter_Custom_CN || '');
  });

  /* ── подписи оси‑X ── */
  const labels = sortedData.map(i => {
    const key = i.WorkCenter_Custom_CN?.trim();
    const tr  = homeTranslations.workCenters[key as keyof typeof homeTranslations.workCenters];
    return tr ? tr[lng] : key;
  });

  /* ── расчёты процентов ── */
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

  const workShops = sortedData.map(i => i.WorkShop_Cn);

  /* ── рендер ── */
  return (
    <div className="h-[28.125rem] w-full rounded-2xl bg-white p-4 flex flex-col relative">
      {/* график + скобки */}
      <div
        className="-mx-4 relative overflow-visible flex-1"
        style={{ paddingBottom: `${BRACKET_H + 24}px` }}  /* скобка + подписи */
      >
        <BarChart
          labels={labels}
          factBar={factBar}
          planRemainder={planRemainder}
          planExists={planExists}
          factExists={factExists}
          workShops={workShops}
          rawData={sortedData}
        />
      </div>

      {/* легенда — внутри карточки, но "висит" у её низа */}
      <div className="absolute bottom-0 right-4 flex justify-end gap-6 text-xs pointer-events-none">
        <LegendDot
          color={COLOR_PLAN}
          text={homeInterfaceTranslation[lng]?.production?.legend?.plan
            || t('legend.plan', { defaultValue: 'Plan' })}
        />
        <LegendDot
          color={COLOR_FACT}
          text={homeInterfaceTranslation[lng]?.production?.legend?.fact
            || t('legend.fact', { defaultValue: 'Fact' })}
        />
        <LegendDot
          color={COLOR_NOPLAN}
          text={homeInterfaceTranslation[lng]?.production?.legend?.noPlan
            || t('legend.noPlan', { defaultValue: 'No Plan' })}
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