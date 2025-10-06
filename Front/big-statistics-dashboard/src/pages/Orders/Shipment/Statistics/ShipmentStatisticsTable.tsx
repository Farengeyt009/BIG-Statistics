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

function colWidth(c: ColDef): number {
  return (typeof c.width === 'number' && c.width > 0)
    ? c.width
    : (typeof c.minWidth === 'number' && c.minWidth > 0)
      ? c.minWidth
      : 150;
}

function totalGridWidth(cols: ColDef[]): number {
  const sum = cols.reduce((acc, c) => acc + colWidth(c), 0);
  return Math.ceil(sum + 8);
}

export default function ShipmentStatisticsTable({ data }: Props) {
  const { t, i18n } = useTranslation('ordersTranslation');
  const gridApiRef = useRef<any>(null);
  const [gridApi, setGridApi] = useState<any | null>(null);

  // 1) Columns (metric + dynamic per week)
  const columnDefs = useMemo<ColDef[]>(() => {
    const cols: ColDef[] = [
      { field: 'metric', headerName: t('shipmentPlanFact.WeekNo') as string || 'Week', pinned: 'left', width: 240,
        cellClass: (p: any) => (p?.data?._boldRow ? 'text-left font-semibold' : 'text-left'),
        tooltipValueGetter: (p: any) => (p?.data?._commentRow ? String(p?.value ?? '') : ''),
      },
    ];
    // Total column right after metric
    cols.push({ field: 'total', headerName: 'Total', width: 200, minWidth: 160,
      cellClass: (p: any) => (p?.data?._boldRow ? 'text-center font-semibold' : 'text-center'),
      tooltipValueGetter: (p: any) => (p?.data?._commentRow ? String(p?.value ?? '') : ''),
      valueFormatter: (p: any) => (typeof p.value === 'number'
        ? new Intl.NumberFormat(undefined, { maximumFractionDigits: 4 }).format(p.value)
        : p.value),
    });
    (data || []).forEach((r, idx) => {
      const field = `c${idx}`;
      const w = r?.WeekNo;
      const header = w != null ? `W${w}` : String(idx + 1);
      const tip = `${fmtDate(r?.WeekStartDay)} - ${fmtDate(r?.WeekFinishDay)}`;
      cols.push({
        field,
        headerName: header,
        width: 200,
        minWidth: 160,
        wrapText: true,
        autoHeight: true,
        cellClass: (p: any) => {
          const base = p?.data?._boldRow ? 'text-center font-semibold' : 'text-center';
          return p?.data?._commentRow ? `${base} comment-cell` : base;
        },
        valueFormatter: (p: any) => (typeof p.value === 'number'
          ? new Intl.NumberFormat(undefined, { maximumFractionDigits: 4 }).format(p.value)
          : p.value),
        tooltipValueGetter: (p: any) => (p?.data?._commentRow ? String(p?.value ?? '') : ''),
      });
    });
    return cols;
  }, [data, i18n.language]);

  const gridPixelWidth = useMemo(() => totalGridWidth(columnDefs), [columnDefs]);

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
    const makeSep = () => {
      const r: any = { metric: '', _separator: true };
      (data || []).forEach((_, idx) => { r[`c${idx}`] = ''; });
      return r;
    };

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
      out.push(row);

      // separators
      if (k === 'FGStockStartWeekPcs') { const s = makeSep(); s.total = ''; out.push(s); }

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
        const s = makeSep(); s.total = ''; out.push(s);
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

      if (k === 'ContainerQty') { const s = makeSep(); s.total = ''; out.push(s); }
    }
    return out;
  }, [data, i18n.language]);

  // 3) Width = min(total columns, parent width); Height = window-based for inner scroll
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [parentWidth, setParentWidth] = useState<number>(0);
  useEffect(() => {
    const el = wrapRef.current?.parentElement;
    if (!el) return;
    const ro = new ResizeObserver(() => setParentWidth(el.clientWidth));
    ro.observe(el);
    setParentWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const gridWidth = useMemo(() => Math.min(gridPixelWidth, parentWidth || gridPixelWidth), [gridPixelWidth, parentWidth]);

  const [gridHeight, setGridHeight] = useState<number>(520);
  useEffect(() => {
    const recalc = () => {
      if (!wrapRef.current) return;
      const top = wrapRef.current.getBoundingClientRect().top;
      const h = Math.max(280, Math.floor(window.innerHeight - top - 24));
      setGridHeight(h);
    };
    recalc();
    window.addEventListener('resize', recalc);
    return () => window.removeEventListener('resize', recalc);
  }, []);

  return (
    <div className="overflow-x-auto" ref={wrapRef}>
      {(() => {
        const actions = (
          <div className="flex items-center gap-2">
            <AgGridExportButton api={gridApi} fileName="shipment_statistics" variant="icon" />
            <FocusModeToggle variant="dark" />
          </div>
        );
        const slot = typeof document !== 'undefined' ? document.getElementById('shipment-actions-slot') : null;
        return slot ? createPortal(actions, slot) : (<div className="flex items-center gap-2">{actions}</div>);
      })()}
      <div className="stats-grid ag-theme-quartz" style={{ width: gridWidth, height: gridHeight }}>
        <AgGridReact
          onGridReady={(p) => { gridApiRef.current = p.api; setGridApi(p.api); }}
          columnDefs={columnDefs}
          rowData={rowData}
          defaultColDef={{
            resizable: true,
            sortable: false,
            filter: false,
            editable: false,
            wrapText: true,
            autoHeight: true,
            tooltipValueGetter: (p: any) => (p?.data?._commentRow ? String(p?.value ?? '') : ''),
          }}
          suppressRowHoverHighlight={true}
          getRowHeight={(p: any) => (p?.data?._separator ? 10 : undefined)}
          getRowClass={(p: any) => (p?.data?._separator ? 'stats-separator' : undefined)}
          tooltipMouseTrack={true}
          tooltipHideDelay={1000000}
          tooltipShowDelay={0}
          // enable range selection + manual copy like on Shipment Log
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
        />
      </div>
    </div>
  );
}


