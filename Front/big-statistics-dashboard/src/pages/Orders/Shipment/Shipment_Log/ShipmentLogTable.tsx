import React, { useMemo, useRef, useState, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { AgGridReact } from '@ag-grid-community/react';
import type { ColDef } from '@ag-grid-community/core';
import '@ag-grid-community/styles/ag-grid.css';
import '@ag-grid-community/styles/ag-theme-quartz.css';
import AgGridExportButton from '../../../../components/AgGrid/ExportButton';
import FocusModeToggle from '../../../../components/focus/FocusModeToggle';
import { Settings } from 'lucide-react';
import { applyStandardFilters } from '../../../../components/AgGrid/filterUtils';

type ShipmentRow = Record<string, any>;
type Props = { 
  rows?: ShipmentRow[]; 
  suppressLocalLoaders?: boolean;
  onOpenFilterModal?: () => void;
};

/** Стабильный уникальный ключ строки по данным */
function makeRowId(r: ShipmentRow) {
  const a = r?.RealizationDoc ?? '';
  const b = r?.Order_No ?? '';
  const c = r?.Article_number ?? r?.ArticleNo ?? r?.Article_number_CN ?? '';
  const d = r?.SpendingOrder_No ?? '';
  return `${a}|${b}|${c}|${d}`;
}

const ShipmentLogTable: React.FC<Props> = ({ rows: externalRows = [], suppressLocalLoaders, onOpenFilterModal }) => {
  const rows: ShipmentRow[] = externalRows || [];
  const { t, i18n } = useTranslation('ordersTranslation');
  const [gridApi, setGridApi] = useState<any | null>(null);
  const gridRef = useRef<HTMLDivElement | null>(null);

  const defaultColDef: ColDef = useMemo(() => ({ resizable: true, sortable: true, filter: true }), []);

  // Примерные (временные) минимальные ширины колонок — потом можно подправить
  const COL_MIN_WIDTH: Record<string, number> = {
    ShipmentDate_Fact_Svod: 120,
    LargeGroup: 210,
    Market: 140,
    Order_No: 150,
    Article_number: 170,
    GroupName: 170,
    SpendingOrder_QTY: 130,
    CBM_Total: 160,
    Comment: 520,
    Name_CN: 520,
    CBM: 140,
    CI_No: 190,
    ContainerNO_Realization: 190,
    Partner_Name: 350,
    RealizationDate: 180,
    RealizationDoc: 180,
    Recipient_Name: 350,
    ShipmentDate_Fact: 250,
    SpendingOrder_Date: 250,
    SpendingOrder_No: 250,
  };

  // Берём заголовки из i18n, если они есть
  const getHeaderName = (key: string): string => {
    try {
      const dict: any = (t as any)('shipmentLogHeaders', { returnObjects: true });
      if (dict && typeof dict === 'object' && key in dict) return String(dict[key]);
    } catch {}
    return key;
  };

  // Формат даты DD.MM.YYYY для конкретных полей
  const DATE_FIELDS = new Set(['RealizationDate', 'SpendingOrder_Date', 'ShipmentDate_Fact', 'ShipmentDate_Fact_Svod']);
  const formatDDMMYYYY = (v: any): string => {
    if (v == null || v === '') return '';
    const s = String(v).trim();
    const m1 = s.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
    if (m1) return `${m1[1]}.${m1[2]}.${m1[3]}`;
    const m2 = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m2) return `${m2[3]}.${m2[2]}.${m2[1]}`;
    const d = new Date(s);
    if (!isNaN(d.getTime())) {
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const yyyy = d.getFullYear();
      return `${dd}.${mm}.${yyyy}`;
    }
    return s;
  };

  // Формат чисел (визуально): русские разделители тысяч, дробная часть только если есть
  const NUM_FIELDS = new Set(['SpendingOrder_QTY', 'CBM', 'CBM_Total']);
  const formatNumberSmart = (v: any): string => {
    if (v == null || v === '') return '';
    const raw = String(v).trim();
    // Попробуем достать количество знаков после запятой из исходной строки
    const m = raw.match(/^-?\d+(?:[\.,](\d+))?$/);
    const decimalsFromRaw = m ? (m[1] || '').replace(/0+$/,'').length : undefined;
    const n = Number(raw.replace(',', '.'));
    if (!isFinite(n)) return raw;
    const isInt = (decimalsFromRaw !== undefined ? decimalsFromRaw === 0 : Math.abs(n - Math.trunc(n)) < 1e-9);
    if (isInt) return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(Math.trunc(n));
    const dec = Math.min(6, decimalsFromRaw ?? 2);
    return new Intl.NumberFormat('ru-RU', { minimumFractionDigits: dec, maximumFractionDigits: dec }).format(n);
  };

  const normalizeNumberKey = (v: any): string => {
    if (v == null || v === '') return '';
    const s = String(v).replace(/\s+/g, '').replace(',', '.');
    const n = Number(s);
    return Number.isFinite(n) ? String(n) : '';
  };

  // Нормализация даты в ISO YYYY-MM-DD (для фильтров)
  const toIso = (value: any): string => {
    if (value === null || value === undefined || value === '') return '';
    const s = String(value).trim();
    // DD.MM.YYYY -> YYYY-MM-DD
    const m1 = s.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
    if (m1) return `${m1[3]}-${m1[2]}-${m1[1]}`;
    // YYYY-MM-DD (или с временем)
    const m2 = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m2) return `${m2[1]}-${m2[2]}-${m2[3]}`;
    const d = new Date(s);
    return isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
  };

  // Локализованный ярлык месяца
  const monthLabel = (mm: string) => {
    const i = Math.max(0, Math.min(11, parseInt(mm, 10) - 1));
    const lang = (i18n?.language || 'en').startsWith('zh') ? 'zh' : (i18n?.language || 'en').startsWith('ru') ? 'ru' : 'en';
    const names = {
      en: ['January','February','March','April','May','June','July','August','September','October','November','December'],
      ru: ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'],
      zh: ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'],
    } as const;
    return names[lang][i];
  };

  // Сбор значений для фильтра по дате, учитывая другие set-фильтры
  const collectDateValuesIgnoringSelf = (params: any, colId: string) => {
    const api = params.api;
    const model = { ...(api.getFilterModel?.() ?? {}) } as Record<string, any>;
    delete model[colId];

    // Поддерживаем простые set-фильтры по другим колонкам (в т.ч. датам)
    const setFilters: Array<{ colId: string; allowed: Set<string> }> = [];
    for (const [k, m] of Object.entries(model)) {
      if ((m as any)?.filterType === 'set' && Array.isArray((m as any).values)) {
        setFilters.push({ colId: k, allowed: new Set((m as any).values as string[]) });
      }
    }

    const passOtherSetFilters = (row: any) => {
      for (const f of setFilters) {
        const v = DATE_FIELDS.has(f.colId) ? toIso(row?.[f.colId]) : String(row?.[f.colId] ?? '').trim();
        if (f.allowed.size && !f.allowed.has(v)) return false;
      }
      return true;
    };

    const uniq = new Set<string>();
    (rows || []).forEach((r) => {
      if (!passOtherSetFilters(r)) return;
      const iso = toIso(r?.[colId]);
      if (iso) uniq.add(iso);
    });
    const out = Array.from(uniq);
    out.sort();
    params.success(out);
  };

  // Формируем столбцы по объединённому набору полей (не только по первой строке) и задаём желаемый порядок
  const columnDefs: ColDef[] = useMemo(() => {
    if (!rows.length) return [];
    const fields = new Set<string>();
    for (let i = 0; i < Math.min(rows.length, 50); i++) {
      Object.keys(rows[i] ?? {}).forEach((k) => fields.add(k));
    }
    const PRIMARY_ORDER = [
      'ShipmentDate_Fact_Svod',
      'LargeGroup',
      'Market',
      'Order_No',
      'Article_number',
      'GroupName',
      'SpendingOrder_QTY',
      'CBM_Total',
      'Comment',
      'Name_CN',
      'CBM',
    ];
    const SECONDARY_ORDER = [
      'CI_No',
      'ContainerNO_Realization',
      'Partner_Name',
      'RealizationDate',
      'RealizationDoc',
      'Recipient_Name',
      'ShipmentDate_Fact',
      'SpendingOrder_Date',
      'SpendingOrder_No',
    ];
    const fieldsArr = Array.from(fields);
    const orderedKeys = [...PRIMARY_ORDER, ...SECONDARY_ORDER].filter(k => fields.has(k));
    const remaining = fieldsArr.filter(k => !orderedKeys.includes(k));
    const finalOrder = [...orderedKeys, ...remaining];

    return finalOrder.map((key) => {
      const base: ColDef = {
        field: key,
        headerName: getHeaderName(key),
        minWidth: COL_MIN_WIDTH[key] ?? 120,
      };
      if (DATE_FIELDS.has(key)) {
        base.valueFormatter = (p: any) => formatDDMMYYYY(p.value);
        base.filter = 'agSetColumnFilter';
        (base as any).cellDataType = 'date';
        base.filterValueGetter = (p: any) => toIso(p?.data?.[key]);
        (base as any).filterParams = {
          treeList: true as any,
          includeBlanksInFilter: true,
          refreshValuesOnOpen: true,
          values: (params: any) => collectDateValuesIgnoringSelf(params, key),
          treeListPathGetter: (value: any) => {
            const s = String(value ?? '').trim();
            const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
            if (!m) return null;
            const [, y, mm, dd] = m;
            return [y, monthLabel(mm), dd];
          },
          valueFormatter: (p: any) => {
            const s = String(p.value ?? '');
            const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
            return m ? `${m[3]}.${m[2]}.${m[1]}` : s;
          },
        };
      } else if (NUM_FIELDS.has(key)) {
        base.valueFormatter = (p: any) => formatNumberSmart(p.value);
        (base as any).cellDataType = 'number';
        // Убираем явный filter, чтобы applyStandardFilters применил стандартный числовой фильтр
      }
      return base;
    });
  }, [rows, i18n.language]);

  const columnDefsWithStandardFilters = useMemo(() => {
    return applyStandardFilters(columnDefs);
  }, [columnDefs]);

  if (suppressLocalLoaders) return null;
  if (!rows.length) return <div className="text-center text-gray-500 py-10">Нет данных для выбранного периода</div>;

  const actions = (
    <div className="flex items-center gap-2">
      <AgGridExportButton api={gridApi} fileName="shipment_log" variant="icon" />
      <FocusModeToggle variant="dark" />
      {onOpenFilterModal && (
        <button
          className="h-8 w-8 p-2 rounded-md border border-gray-300 bg-white text-slate-700 hover:bg-gray-100 transition flex items-center justify-center"
          title="Filter Settings"
          aria-label="Filter Settings"
          onClick={onOpenFilterModal}
        >
          <Settings className="w-4 h-4" />
        </button>
      )}
    </div>
  );

  const autoSizeStrategy = { type: 'fitGridWidth' as const };

  // Фокус-режим: подгоняем высоту контейнера как в Time Loss
  const [gridHeightPx, setGridHeightPx] = useState<number | null>(null);
  useLayoutEffect(() => {
    const compute = () => {
      const el = gridRef.current;
      if (!el) return;
      const isFocus = typeof document !== 'undefined' && document.body.classList.contains('app-focus');
      if (!isFocus) { setGridHeightPx(null); return; }
      const top = el.getBoundingClientRect().top;
      const h = Math.max(200, Math.floor(window.innerHeight - top - 8));
      setGridHeightPx(h);
    };
    compute();
    window.addEventListener('resize', compute);
    const obs = new MutationObserver(compute);
    if (typeof document !== 'undefined') {
      obs.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    }
    return () => { window.removeEventListener('resize', compute); obs.disconnect(); };
  }, []);

  return (
    <div className="w-full">
      {/* Если есть внешний слот — рендерим иконки туда */}
      {typeof document !== 'undefined' && document.getElementById('shipment-actions-slot')
        ? createPortal(actions, document.getElementById('shipment-actions-slot') as any)
        : <div className="flex items-center gap-2 justify-end w-full px-1 mb-2">{actions}</div>}
      <div ref={gridRef} className="ag-theme-quartz" style={{ width: '100%', height: gridHeightPx != null ? `${gridHeightPx}px` : '78vh' }}>
        <AgGridReact
          key={columnDefs.map(c => String(c.field)).join('|')}
          rowData={rows}
          columnDefs={columnDefsWithStandardFilters}
          defaultColDef={defaultColDef}
          autoSizeStrategy={autoSizeStrategy}
          getRowId={(p: any) => makeRowId(p.data)}
          onGridReady={(p) => { setGridApi(p.api); }}
          animateRows={false}
          rowSelection="multiple"
          cellSelection={true}
          statusBar={{ statusPanels: [{ statusPanel: 'agAggregationComponent', align: 'left' }] }}
          sendToClipboard={() => {
            const api = gridApi;
            if (!api?.getCellRanges) return;
            const ranges = api.getCellRanges?.() || [];
            const clipboard: string[][] = [];
            for (const r of ranges) {
              const cols = r.columns || [];
              const start = Math.min(r.startRow.rowIndex, r.endRow.rowIndex);
              const end = Math.max(r.startRow.rowIndex, r.endRow.rowIndex);
              for (let i = start; i <= end; i++) {
                const node = api.getDisplayedRowAtIndex(i);
                if (!node?.data) continue;
                const row: string[] = [];
                cols.forEach((c: any) => {
                  const def = c.getColDef();
                  const field = def.field;
                  let v: any = node.data[field];
                  // Для числовых колонок возвращаем чистый Number без пробелов и с точкой
                  if (NUM_FIELDS.has(field)) {
                    const txt = String(v ?? '').replace(/\s+/g, '').replace(',', '.');
                    const num = Number(txt);
                    v = Number.isFinite(num) ? num : '';
                  }
                  row.push(String(v ?? ''));
                });
                if (row.length) clipboard.push(row);
              }
            }
            if (clipboard.length) {
              const tsv = clipboard.map(r => r.join('\t')).join('\n');
              try { navigator.clipboard.writeText(tsv); } catch {}
            }
          }}
          onCellKeyDown={(e: any) => {
            const ke = e.event as KeyboardEvent;
            if ((ke.ctrlKey || ke.metaKey) && String(ke.key).toLowerCase() === 'c') {
              const api = gridApi;
              if (!api?.getCellRanges) return;
              const ranges = api.getCellRanges?.() || [];
              const clipboard: string[][] = [];
              for (const r of ranges) {
                const cols = r.columns || [];
                const start = Math.min(r.startRow.rowIndex, r.endRow.rowIndex);
                const end = Math.max(r.startRow.rowIndex, r.endRow.rowIndex);
                for (let i = start; i <= end; i++) {
                  const node = api.getDisplayedRowAtIndex(i);
                  if (!node?.data) continue;
                  const row: string[] = [];
                  cols.forEach((c: any) => {
                    const def = c.getColDef();
                    const field = def.field;
                    let v: any = node.data[field];
                    if (NUM_FIELDS.has(field)) {
                      const txt = String(v ?? '').replace(/\s+/g, '').replace(',', '.');
                      const num = Number(txt);
                      v = Number.isFinite(num) ? num : '';
                    }
                    row.push(String(v ?? ''));
                  });
                  if (row.length) clipboard.push(row);
                }
              }
              if (clipboard.length) {
                const tsv = clipboard.map(r => r.join('\t')).join('\n');
                try { navigator.clipboard.writeText(tsv); } catch {}
              }
              return;
            }
          }}
        />
      </div>
    </div>
  );
};

export default ShipmentLogTable;


