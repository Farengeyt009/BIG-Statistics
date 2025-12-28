import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { API_BASE_URL } from '../../../../config/api';
import SimpleGrid from '../../../../components/AgGrid/SimpleGrid';
import { createColumnsFromConfig } from './OverviewColumnConfig';
import type { ColDef } from '@ag-grid-community/core';

// Лёгкий debounce без внешних зависимостей
function debounce<T extends (...args: any[]) => void>(fn: T, wait = 60) {
  let timer: number | undefined;
  return (...args: Parameters<T>) => {
    if (timer) window.clearTimeout(timer);
    timer = window.setTimeout(() => fn(...args), wait) as unknown as number;
  };
}

type Workshop = { key: string; name_zh: string; name_en: string; order: number | null };
type SummaryRow = { workshopKey: string; plan: number; fact: number; loss: number; net: number };
type ReasonRecord = { reason_zh: string; reason_en: string; values: Record<string, number>; total: number };

type Props = {
  startDate?: string; // YYYY-MM-DD
  endDate?: string;   // YYYY-MM-DD
  suppressLocalLoaders?: boolean;
  onLoadingChange?: (loading: boolean) => void;
  isActive?: boolean;
};

const Overview: React.FC<Props> = ({ startDate, endDate, suppressLocalLoaders, onLoadingChange, isActive }) => {
  const { t, i18n } = useTranslation('production');
  const currentLanguage = i18n.language as 'en' | 'zh' | 'ru';

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [workshops, setWorkshops] = useState<Workshop[]>([]);
  const [summary, setSummary] = useState<SummaryRow[]>([]);
  const [reasons, setReasons] = useState<ReasonRecord[]>([]);

  // Визуальное форматирование целых чисел с пробелом как разделителем тысяч
  const formatIntRu = (n: number) => {
    const s = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0, minimumFractionDigits: 0 }).format(Math.round(n));
    // заменяем неразрывный пробел на обычный для единообразия отображения
    return s.replace(/\u00A0/g, ' ');
  };

  // Helper function to get localized name
  const getLocalizedName = (item: { name_zh?: string; name_en?: string; reason_zh?: string; reason_en?: string }): string => {
    const zh = item.name_zh || item.reason_zh;
    const en = item.name_en || item.reason_en;
    if (currentLanguage === 'zh') return zh || '';
    if (currentLanguage === 'en') return en || '';
    // Default to English for Russian and other languages
    return en || zh || '';
  };

  // берём диапазон из URL или за последние 7 дней как дефолт
  const { dateFrom, dateTo } = useMemo(() => {
    if (startDate && endDate) return { dateFrom: startDate, dateTo: endDate };
    const today = new Date();
    const to = today.toISOString().slice(0, 10);
    const fromDate = new Date(today.getTime());
    fromDate.setDate(today.getDate() - 7);
    const from = fromDate.toISOString().slice(0, 10);
    return { dateFrom: from, dateTo: to };
  }, [startDate, endDate]);

  useEffect(() => {
    // Загружаем только если компонент активен
    if (!isActive) return;

    const load = async () => {
      setLoading(true);
      onLoadingChange?.(true);
      setError(null);
      try {
        const url = `${API_BASE_URL}/timeloss/dashboard?date_from=${dateFrom}&date_to=${dateTo}`;
        const res = await fetch(url);
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j?.detail || j?.error || `HTTP ${res.status}`);
        }
        const j = await res.json();
        setWorkshops(j.workshops || []);
        setSummary(j.summary || []);
        setReasons(j.reasons || []);
      } catch (e: any) {
        setError(e.message || 'Load failed');
      } finally {
        setLoading(false);
        onLoadingChange?.(false);
      }
    };
    load();
  }, [dateFrom, dateTo, isActive]);

  // Создаем колонки и данные с учетом языка
  const { columns, rowData, reasonRows, pinnedTopRows, topPerColumn } = useMemo(() => {
    if (!workshops.length || !summary.length) {
      return { columns: [], rowData: [], reasonRows: [], pinnedTopRows: [], topPerColumn: new Set<string>() };
    }

    // Строим колонки: Metric + Total + по цехам
    const centeredCellClass = (p: any) => {
      const metricValue = String(p?.data?.metric || '');
      const isEff = metricValue === t('timeLossOverview.efficiency');
      if (!isEff) return 'ag-center-aligned-cell';
      const valNum = Number(p?.value);
      if (!isFinite(valNum)) return 'ag-center-aligned-cell font-bold';
      // Цвета как в KPI-карточках: ≤85 красный, 85-90 оранжевый, ≥90 зелёный
      const colorClass = valNum < 85
        ? 'bg-red-100 text-red-700'
        : valNum < 90
        ? 'bg-orange-100 text-orange-600'
        : 'bg-green-100 text-green-700';
      return `ag-center-aligned-cell font-bold ${colorClass}`.trim();
    };

    // Создаем колонки на основе справочника
    const columns = createColumnsFromConfig(
      workshops,
      t,
      getLocalizedName,
      centeredCellClass,
      formatIntRu
    );

    // Карта итогов по цехам
    const map = new Map(summary.map(s => [s.workshopKey, s]));
    const buildRow = (metric: 'plan' | 'fact' | 'loss') => {
      const label = metric === 'plan' ? t('timeLossOverview.dailyPlan') : metric === 'fact' ? t('timeLossOverview.productionFact') : t('timeLossOverview.timeLoss');
      const row: any = { __id: metric, metric: label }; // стабильный id
      let total = 0;
      workshops.forEach(w => {
        const s = map.get(w.key);
        const val = s ? (s as any)[metric] ?? 0 : 0;
        row[w.key] = val;
        total += Number(val) || 0;
      });
      row.total = total;
      return row;
    };

    const buildEfficiencyRow = () => {
      const row: any = { __id: 'efficiency', metric: t('timeLossOverview.efficiency') };
      let totalFact = 0, totalLoss = 0;
      workshops.forEach(w => {
        const s = map.get(w.key);
        const fact = s ? (s.fact ?? 0) : 0;
        const loss = s ? (s.loss ?? 0) : 0;
        const eff = fact + loss > 0 ? (fact / (fact + loss)) * 100 : 0;
        row[w.key] = eff;
        totalFact += fact;
        totalLoss += loss;
      });
      row.total = totalFact + totalLoss > 0 ? (totalFact / (totalFact + totalLoss)) * 100 : 0;
      return row;
    };

    const rowData = [buildRow('plan'), buildRow('fact'), buildRow('loss'), buildEfficiencyRow()];

    // Таблица причин (pivot): строки — причины, столбцы — цеха
    const reasonRows = reasons.map(r => {
      const row: any = { __id: r.reason_en || r.reason_zh, metric: getLocalizedName(r) };
      row.total = r.total ?? 0;
      workshops.forEach(w => {
        row[w.key] = r.values && typeof r.values[w.key] === 'number' ? r.values[w.key] : 0;
      });
      return row;
    }).sort((a: any, b: any) => (Number(b.total) || 0) - (Number(a.total) || 0));

    // Подсветка ТОП-3 значений по каждому столбцу в блоке причин
    const topPerColumn = new Set<string>(); // ключ: `${colId}|${rowIndex}`
    
    // Получаем все числовые колонки (total + все цеха)
    const numericColIds = ['total', ...workshops.map(w => w.key)];
    
    numericColIds.forEach(colId => {
      const arr = reasonRows.map((r: any) => Number(r[colId]) || 0);
      const sorted = [...arr].sort((a, b) => b - a);
      const top3 = sorted.slice(0, 3);
      const topIdx: number[] = [];
      
      arr.forEach((val, idx) => {
        if (top3.includes(val) && val > 0) topIdx.push(idx);
      });
      
      topIdx.forEach(i => topPerColumn.add(`${colId}|${i}`));
    });

    return { columns, rowData, reasonRows, pinnedTopRows: rowData, topPerColumn };
  }, [workshops, summary, reasons, currentLanguage, t]);

  return (
    <div>
      <h2 className="text-2xl font-bold text-[#0d1c3d] mb-4">{t('statistics.timeLoss')}</h2>

      {/* Первичная загрузка — без локального спиннера */}
      {loading && suppressLocalLoaders && (
        <div className="bg-white rounded" style={{ minHeight: 256 }} />
      )}
      {loading && !suppressLocalLoaders && (
        <div className="text-gray-600">Loading…</div>
      )}

      {!loading && error && <div className="text-red-600">{error}</div>}
      {!loading && !error && workshops.length > 0 && summary.length > 0 && (
        <div data-grid="timeLoss-overview">
          <SimpleGrid
            gridName="timeLoss-overview"
            rowData={reasonRows}
            pinnedTopRowData={pinnedTopRows}
            columnDefs={(() => {
              // Валидация колонок перед передачей в грид
              if (columns.length < 2) return [];
              
              const validColumns = [
                columns[0],
                {
                  ...(columns[1] as ColDef),
                  cellClass: (p: any) => {
                    if (p.node?.rowPinned === 'top') {
                      const metricValue = String(p?.data?.metric || '');
                      const isEff = metricValue === t('timeLossOverview.efficiency');
                      if (!isEff) return 'ag-center-aligned-cell';
                      const valNum = Number(p?.value);
                      if (!isFinite(valNum)) return 'ag-center-aligned-cell font-bold';
                      const colorClass = valNum < 85
                        ? 'bg-red-100 text-red-700'
                        : valNum < 90
                        ? 'bg-orange-100 text-orange-600'
                        : 'bg-green-100 text-green-700';
                      return `ag-center-aligned-cell font-bold ${colorClass}`.trim();
                    }
                    const isTop = topPerColumn.has(`total|${p.rowIndex}`);
                    return `ag-center-aligned-cell ${isTop ? 'font-bold text-red-600' : ''}`.trim();
                  },
                },
                // Колонки цехов с условным форматированием
                ...columns.slice(2).map((col: ColDef) => ({
                  ...col,
                  cellClass: (p: any) => {
                    if (p.node?.rowPinned === 'top') {
                      const metricValue = String(p?.data?.metric || '');
                      const isEff = metricValue === t('timeLossOverview.efficiency');
                      if (!isEff) return 'ag-center-aligned-cell';
                      const valNum = Number(p?.value);
                      if (!isFinite(valNum)) return 'ag-center-aligned-cell font-bold';
                      const colorClass = valNum < 85
                        ? 'bg-red-100 text-red-700'
                        : valNum < 90
                        ? 'bg-orange-100 text-orange-600'
                        : 'bg-green-100 text-green-700';
                      return `ag-center-aligned-cell font-bold ${colorClass}`.trim();
                    }
                    // Для нижней части таблицы (причины потерь) - выделяем топ-3
                    const isTop = topPerColumn.has(`${col.field}|${p.rowIndex}`);
                    return `ag-center-aligned-cell ${isTop ? 'font-bold text-red-600' : ''}`.trim();
                  },
                } as ColDef)),
              ].filter(c => c && (c.field || c.colId));
              
              return validColumns;
            })()}
            height={560}
            bordered
            defaultColDef={{ resizable: true }}
          />
        </div>
      )}
    </div>
  );
};

export default Overview;