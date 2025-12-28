import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AgGridReact } from '@ag-grid-community/react';
import '@ag-grid-community/styles/ag-grid.css';
import '@ag-grid-community/styles/ag-theme-quartz.css';
import type { ColDef } from '@ag-grid-community/core';
import { useTranslation } from 'react-i18next';
import AgGridExportButton from '../../../../components/AgGrid/ExportButton';
import FocusModeToggle from '../../../../components/focus/FocusModeToggle';
import { createPortal } from 'react-dom';

type DataRow = Record<string, any>;
type Props = { data: DataRow[] };

function fmtNum(v: any) {
  if (v === null || v === undefined || v === '') return '';
  const n = Number(v);
  if (!isFinite(n)) return String(v);
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 4 }).format(n);
}

function fmtDate(d: any): string {
  const dt = d ? new Date(d) : null;
  if (!dt || isNaN(dt.getTime())) return '';
  const dd = String(dt.getDate()).padStart(2, '0');
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const yyyy = dt.getFullYear();
  return `${dd}.${mm}.${yyyy}`;
}

export default function ShipmentStatisticsTable({ data }: Props) {
  const { t, i18n } = useTranslation('ordersTranslation');
  const gridApiRef = useRef<any>(null);
  const [gridApi, setGridApi] = useState<any | null>(null);

  // 1) Columns (metric + dynamic per week)
  const columnDefs = useMemo<ColDef[]>(() => {
    const cols: ColDef[] = [
      { 
        field: 'metric', 
        headerName: t('shipmentPlanFact.WeekNo') as string || 'Week', 
        pinned: 'left', 
        minWidth: 240,
        cellClass: (p: any) => (p?.data?._boldRow ? 'text-left font-semibold' : 'text-left'),
        tooltipValueGetter: (p: any) => {
          // Для Comment строки показываем полный текст в tooltip
          if (p?.data?._commentRow && p?.value) {
            return String(p.value);
          }
          return '';
        },
      },
    ];
    // Total column right after metric
    cols.push({ 
      field: 'total', 
      headerName: 'Total', 
      minWidth: 160,
      cellClass: (p: any) => {
        // Полужирный шрифт для выделенных строк (Monthly Shipping Plan и Shipped Qty) или для строк с _boldRow
        const isBold = p?.data?._boldRow || p?.data?._highlightRow;
        const base = isBold ? 'text-center font-semibold' : 'text-center';
        return p?.data?._commentRow ? `${base} overflow-hidden text-ellipsis` : base;
      },
      cellStyle: (p: any) => {
        // Для выделенных строк (Monthly Shipping Plan и Shipped Qty) - зеленый фон
        if (p?.data?._highlightRow) {
          return { 
            backgroundColor: '#f0fdf4' // green-50
          } as any;
        }
        // Для остальных строк - светло-синий фон для колонки Total
        return { 
          backgroundColor: '#f0f9ff' // blue-50
        } as any;
      },
      tooltipValueGetter: (p: any) => {
        // Для Comment строки показываем полный текст в tooltip
        if (p?.data?._commentRow && p?.value) {
          return String(p.value);
        }
        return '';
      },
      valueFormatter: (p: any) => (typeof p.value === 'number'
        ? new Intl.NumberFormat(undefined, { maximumFractionDigits: 4 }).format(p.value)
        : p.value),
    });
    (data || []).forEach((r, idx) => {
      const field = `c${idx}`;
      const w = r?.WeekNo;
      const header = w != null ? `W${w}` : String(idx + 1);
      cols.push({
        field,
        headerName: header,
        minWidth: 160,
        wrapText: (p: any) => !p?.data?._commentRow, // Отключаем wrapText для Comment строки
        autoHeight: false, // Отключаем авто-высоту
        cellClass: (p: any) => {
          const base = p?.data?._boldRow ? 'text-center font-semibold' : 'text-center';
          return p?.data?._commentRow ? `${base} overflow-hidden text-ellipsis` : base;
        },
        valueFormatter: (p: any) => (typeof p.value === 'number'
          ? new Intl.NumberFormat(undefined, { maximumFractionDigits: 4 }).format(p.value)
          : p.value),
        tooltipValueGetter: (p: any) => {
          // Для Comment строки показываем полный текст в tooltip
          if (p?.data?._commentRow && p?.value) {
            return String(p.value);
          }
          return '';
        },
      });
    });
    return cols;
  }, [data, i18n.language, t]);

  // 2) Transposed rows with separators
  const rowData = useMemo(() => {
    const keys = [
      'DatePeriod',
      'FGStockStartWeekPcs',
      'MonthPlanPcs_System',
      'FactQty',
      'DiffQty',
      'ShipMonth_PlanPcs',
      'ShipWeek_PlanPcs',
      'ShipQty',
      'ContainerQty',
      'Comment',
    ];

    const label = (k: string): string => {
      if (k === 'DatePeriod') {
        const lp = t('shipmentPlanFact.DatePeriod', { defaultValue: 'Date period' } as any);
        return typeof lp === 'string' && lp ? lp : 'Date period';
      }
      const tr = t(`shipmentPlanFact.${k}` as any, { defaultValue: '' } as any);
      return (typeof tr === 'string' && tr) ? tr : k;
    };

    const out: any[] = [];
    // precompute totals and overall date period
    let minStart: Date | null = null;
    let maxFinish: Date | null = null;
    const sums: Record<string, number> = {};
    (data || []).forEach((r) => {
      const ws = r?.WeekStartDay ? new Date(r.WeekStartDay) : null;
      const we = r?.WeekFinishDay ? new Date(r.WeekFinishDay) : null;
      if (ws && !isNaN(ws.getTime())) minStart = !minStart || ws < minStart ? ws : minStart;
      if (we && !isNaN(we.getTime())) maxFinish = !maxFinish || we > maxFinish ? we : maxFinish;
      ['FGStockStartWeekPcs','MonthPlanPcs_System','FactQty','ShipMonth_PlanPcs','ShipWeek_PlanPcs','ShipQty','ContainerQty']
        .forEach((k) => {
          const n = Number(r?.[k as keyof typeof r]);
          if (isFinite(n)) sums[k] = (sums[k] || 0) + n;
        });
    });
    // Fill rows
    for (const k of keys) {
      const row: any = { metric: label(k) };
      (data || []).forEach((r, idx) => {
        const f = `c${idx}`;
        if (k === 'DatePeriod') {
          row[f] = `${fmtDate(r?.WeekStartDay)} - ${fmtDate(r?.WeekFinishDay)}`;
        } else if (k === 'Comment') {
          row[f] = r?.Comment ?? '';
        } else if (k === 'DiffQty') {
          const a = Number(r?.FactQty);
          const b = Number(r?.MonthPlanPcs_System);
          const diff = (isFinite(a) && isFinite(b)) ? (a - b) : null;
          row[f] = diff == null ? '' : diff;
        } else {
          const n = Number(r?.[k]);
          row[f] = isFinite(n) ? n : (r?.[k] ?? '');
        }
      });
      // set total value
      if (k === 'DatePeriod') {
        row.total = `${fmtDate(minStart)} - ${fmtDate(maxFinish)}`;
      } else if (k === 'Comment') {
        row.total = '';
      } else if (k === 'FGStockStartWeekPcs') {
        // Stock, pcs - ненакопительная единица, Total всегда пусто
        row.total = '';
      } else {
        if (k === 'DiffQty') {
          const a = sums['FactQty'] || 0;
          const b = sums['MonthPlanPcs_System'] || 0;
          row.total = fmtNum(a - b);
        } else {
          row.total = sums[k] ?? null;
        }
      }
      if (k === 'Comment') row._commentRow = true;
      // Выделяем строки Monthly Shipping Plan и Shipped Qty тускло-зеленым
      if (k === 'ShipMonth_PlanPcs' || k === 'ShipQty') {
        row._highlightRow = true;
      }
      // Добавляем флаг для строк с более жирной границей сверху
      if (k === 'MonthPlanPcs_System' || k === 'ShipMonth_PlanPcs' || k === 'Comment') {
        row._thickBorderTop = true;
      }
      out.push(row);

      // Calculated rows like before
      if (k === 'DiffQty') {
        // % Production Plan Compl. = FactQty / MonthPlanPcs_System * 100%
        const percLabel = (t('shipmentPlanFact.ProdPlanComplPct', { defaultValue: '% Production Plan Compl.' } as any) as string) || '% Production Plan Compl.';
        const perc: any = { metric: percLabel, _boldRow: true };
        (data || []).forEach((r, idx) => {
          const a = Number(r?.FactQty);
          const b = Number(r?.MonthPlanPcs_System);
          const val = isFinite(a) && isFinite(b) && b !== 0 ? (a / b) * 100 : null;
          perc[`c${idx}`] = val == null ? '' : `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(val)}%`;
        });
        const sumA = sums['FactQty'] || 0;
        const sumB = sums['MonthPlanPcs_System'] || 0;
        perc.total = sumB ? `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format((sumA / sumB) * 100)}%` : '';
        out.push(perc);
      }

      if (k === 'ShipQty') {
        // Ship. Different Qty = ShipQty - ShipMonth_PlanPcs
        const diffLabel = (t('shipmentPlanFact.ShipDifferentQty', { defaultValue: 'Ship. Different Qty' } as any) as string) || 'Ship. Different Qty';
        const diff: any = { metric: diffLabel };
        (data || []).forEach((r, idx) => {
          const ship = Number(r?.ShipQty);
          const plan = Number(r?.ShipMonth_PlanPcs);
          const val = (isFinite(ship) ? ship : null) != null && (isFinite(plan) ? plan : null) != null ? (ship - plan) : null;
          diff[`c${idx}`] = val == null ? '' : val;
        });
        diff.total = (sums['ShipQty'] || 0) - (sums['ShipMonth_PlanPcs'] || 0);
        out.push(diff);

        // % Shipment Plan Compl. = ShipQty / ShipMonth_PlanPcs * 100%
        const percShipLabel = (t('shipmentPlanFact.ShipmentPlanComplPct', { defaultValue: '% Shipment Plan Compl.' } as any) as string) || '% Shipment Plan Compl.';
        const percS: any = { metric: percShipLabel, _boldRow: true };
        (data || []).forEach((r, idx) => {
          const ship = Number(r?.ShipQty);
          const plan = Number(r?.ShipMonth_PlanPcs);
          const val = isFinite(ship) && isFinite(plan) && plan !== 0 ? (ship / plan) * 100 : null;
          percS[`c${idx}`] = val == null ? '' : `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(val)}%`;
        });
        const sumShip = sums['ShipQty'] || 0;
        const sumPlan = sums['ShipMonth_PlanPcs'] || 0;
        percS.total = sumPlan ? `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format((sumShip / sumPlan) * 100)}%` : '';
        out.push(percS);
      }
    }
    return out;
  }, [data, i18n.language, t]);

  // Адаптивная высота таблицы
  const containerRef = useRef<HTMLDivElement>(null);
  const [gridHeight, setGridHeight] = useState<number>(800); // Начальная высота больше

  useEffect(() => {
    const recalcHeight = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        // Вычисляем доступную высоту: высота окна минус позиция контейнера минус отступы
        if (rect.top > 0) { // Проверяем, что элемент уже отрендерен
          const availableHeight = window.innerHeight - rect.top - 100; // 100px для отступов, панели действий и заголовков
          const newHeight = Math.max(700, availableHeight); // минимум 700px, но используем доступное пространство
          setGridHeight(newHeight);
        }
      }
    };

    // Пересчитываем при монтировании и изменении данных
    const timeoutId1 = setTimeout(recalcHeight, 100);
    const timeoutId2 = setTimeout(recalcHeight, 500); // Дополнительная проверка после полной загрузки
    
    window.addEventListener('resize', recalcHeight);
    
    return () => {
      clearTimeout(timeoutId1);
      clearTimeout(timeoutId2);
      window.removeEventListener('resize', recalcHeight);
    };
  }, [rowData]); // Пересчитываем при изменении данных

  // Автоматическая подгонка колонок при изменении размера окна
  useEffect(() => {
    const handleResize = () => {
      if (gridApiRef.current) {
        try {
          gridApiRef.current.sizeColumnsToFit();
        } catch (e) {
          console.warn('sizeColumnsToFit failed', e);
        }
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div ref={containerRef} className="w-full flex flex-col">
      {(() => {
        const actions = (
          <div className="flex items-center gap-2 mb-2 flex-shrink-0">
            <AgGridExportButton api={gridApi} fileName="shipment_statistics" variant="icon" />
            <FocusModeToggle variant="dark" />
          </div>
        );
        const slot = typeof document !== 'undefined' ? document.getElementById('shipment-actions-slot') : null;
        return slot ? createPortal(actions, slot) : actions;
      })()}
      <div className="ag-theme-quartz" style={{ width: '100%', height: `${gridHeight}px` }}>
        <style>{`
          .ag-theme-quartz .ag-cell.overflow-hidden.text-ellipsis {
            overflow: hidden !important;
            text-overflow: ellipsis !important;
            display: -webkit-box !important;
            -webkit-line-clamp: 3 !important;
            -webkit-box-orient: vertical !important;
            white-space: normal !important;
            line-height: 1.3 !important;
            max-height: 60px !important;
          }
          /* Тускло-зеленый фон для выделенных строк */
          .ag-theme-quartz .ag-row.highlight-row .ag-cell {
            background-color: #f0fdf4 !important; /* green-50 - более тусклый */
          }
          /* При наведении на строки с цветным фоном - показываем стандартное выделение поверх */
          .ag-theme-quartz .ag-row.highlight-row:hover .ag-cell {
            background-color: #f3f4f6 !important; /* gray-100 - стандартный цвет выделения AG Grid */
          }
          /* Для колонки Total с зеленым фоном - тоже меняем цвет при наведении */
          .ag-theme-quartz .ag-row.highlight-row:hover .ag-cell[col-id="total"] {
            background-color: #f3f4f6 !important; /* gray-100 - стандартный цвет выделения AG Grid */
          }
          /* Более жирная граница сверху для разделительных строк */
          .ag-theme-quartz .ag-row.thick-border-top .ag-cell {
            border-top: 2px solid #e5e7eb !important; /* gray-200, более жирная линия */
          }
        `}</style>
        <AgGridReact
          onGridReady={(p) => { 
            gridApiRef.current = p.api; 
            setGridApi(p.api);
            // Автоматически подгоняем колонки под ширину контейнера
            setTimeout(() => {
              try {
                p.api.sizeColumnsToFit();
              } catch (e) {
                console.warn('sizeColumnsToFit failed', e);
              }
            }, 100);
          }}
          columnDefs={columnDefs}
          rowData={rowData}
          defaultColDef={{
            resizable: true,
            sortable: false,
            filter: false,
            editable: false,
            wrapText: true,
            autoHeight: false, // Отключаем авто-высоту для всех строк
            tooltipValueGetter: (p: any) => (p?.data?._commentRow ? String(p?.value ?? '') : ''),
            cellStyle: (p: any) => {
              // Тускло-зеленый фон для выделенных строк (Monthly Shipping Plan и Shipped Qty)
              // Для колонки Total логика обрабатывается в columnDefs
              if (p?.data?._highlightRow && p?.colDef?.field !== 'total') {
                return { backgroundColor: '#f0fdf4' } as any; // green-50 - более тусклый
              }
              return undefined;
            },
          }}
          suppressRowHoverHighlight={false}
          getRowHeight={(p: any) => {
            if (p?.data?._separator) return 10; // Сепараторы - 10px
            if (p?.data?._commentRow) return 60; // Строка Comment - фиксированная высота 60px
            return undefined; // Остальные строки - стандартная высота
          }}
          getRowClass={(p: any) => {
            if (p?.data?._highlightRow) return 'highlight-row';
            if (p?.data?._thickBorderTop) return 'thick-border-top';
            return undefined;
          }}
          tooltipMouseTrack={true}
          tooltipHideDelay={1000000}
          tooltipShowDelay={0}
          cellSelection={true}
          suppressClipboardPaste={true}
          sendToClipboard={(p: any) => {
            const api: any = gridApiRef.current;
            try {
              const ranges: any[] = api?.getCellRanges?.() || [];
              const tsvRows: string[] = [];
              for (const r of ranges) {
                const cols: any[] = r?.columns || [];
                const start = r?.startRow?.rowIndex ?? r?.startRowIndex ?? 0;
                const end = r?.endRow?.rowIndex ?? r?.endRowIndex ?? start;
                for (let ri = Math.min(start, end); ri <= Math.max(start, end); ri++) {
                  const node = api?.getDisplayedRowAtIndex?.(ri);
                  const row: string[] = [];
                  for (const c of cols) {
                    const field = c?.getColDef?.()?.field as string | undefined;
                    const val = field ? node?.data?.[field] : undefined;
                    row.push(String(val ?? ''));
                  }
                  if (row.length) tsvRows.push(row.join('\t'));
                }
              }
              const tsv = tsvRows.join('\n');
              if ((navigator as any)?.clipboard?.writeText) {
                (navigator as any).clipboard.writeText(tsv);
              } else {
                (p as any).data = tsv;
              }
            } catch {
              (p as any).data = String(p?.data ?? '');
            }
          }}
          onFirstDataRendered={(p) => {
            // Подгоняем колонки после загрузки данных
            try {
              p.api.sizeColumnsToFit();
            } catch (e) {
              console.warn('sizeColumnsToFit failed', e);
            }
          }}
        />
      </div>
    </div>
  );
}


