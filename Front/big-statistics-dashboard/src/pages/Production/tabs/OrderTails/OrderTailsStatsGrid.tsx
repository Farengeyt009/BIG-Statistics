import React from 'react';
import { useTranslation } from 'react-i18next';
import { apiGetOrderTails, OrderTailRow } from '../../../../config/timeloss-api';
import { AgGridReact } from '@ag-grid-community/react';
import type { ColDef } from '@ag-grid-community/core';
import '@ag-grid-community/styles/ag-grid.css';
import '@ag-grid-community/styles/ag-theme-quartz.css';
import OrderTailsMonthlyAvgChart from './OrderTailsMonthlyAvgChart';

type LeafRow = {
  id: string;
  LargeGroup: string;
  GroupName: string;
  SumTailDays: number;
  Count: number;
  AvgTailDays: number;
};

type Props = { rows?: OrderTailRow[]; suppressLocalLoaders?: boolean; onLoadingChange?: (l: boolean)=>void };

const OrderTailsStatsGrid: React.FC<Props> = ({ rows: externalRows, suppressLocalLoaders, onLoadingChange }) => {
  const { t } = useTranslation('production');
  const [rows, setRows] = React.useState<LeafRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const gridRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    (async () => {
      setLoading(true);
      onLoadingChange?.(true);
      try {
        const data = (externalRows && externalRows.length ? externalRows : await apiGetOrderTails());

        const map = new Map<string, { lg: string; gn: string; sum: number; cnt: number }>();
        data.forEach((r: OrderTailRow) => {
          const lg = r.LargeGroup || '';
          const gn = r.GroupName || '';
          const key = `${lg}|${gn}`;
          const v = Number(r.TailDays) || 0;
          const cur = map.get(key) || { lg, gn, sum: 0, cnt: 0 };
          cur.sum += v; cur.cnt += 1;
          map.set(key, cur);
        });

        const leaves: LeafRow[] = Array.from(map.values()).map(({ lg, gn, sum, cnt }) => ({
          id: `leaf:${lg}|${gn}`,
          LargeGroup: lg,
          GroupName: gn,
          SumTailDays: sum,
          Count: cnt,
          AvgTailDays: cnt ? sum / cnt : 0,
        }));

        setRows(leaves);
      } finally {
        setLoading(false);
        onLoadingChange?.(false);
      }
    })();
  }, [externalRows]);

  // Грид растягивается по высоте контента (без внутренних вертикальных скроллов)

  // Ограничение длины отображаемых подписей
  const MAX_CHARS_GROUP = 28;
  const MAX_CHARS_LEAF = 36;
  const clip = (s: string, maxLen: number) => {
    const str = String(s ?? '').trim();
    return str.length > maxLen ? str.slice(0, Math.max(0, maxLen - 1)) + '…' : str;
  };

  // Классический групповой столбец с подписями и стрелками
  const autoGroupColumnDef: ColDef<LeafRow> = React.useMemo(() => ({
    headerName: t('orderTailsStats.largeGroup') as string,
    minWidth: 280,
    maxWidth: 320,
    flex: 2,
    cellRendererParams: { suppressCount: true },
    // Показываем название группы (LargeGroup/GroupName) и название листа (GroupName)
    valueGetter: (p) => {
      // Для pinned строки используем поле LargeGroup ("Total" с переводом)
      if (p.node?.rowPinned === 'bottom') return p.data?.LargeGroup || '';
      if (p.node?.group) return clip(p.node.key ?? '', MAX_CHARS_GROUP);
      return clip(p.data?.GroupName ?? '', MAX_CHARS_LEAF);
    },
    tooltipValueGetter: (p) => (p.node?.group ? (p.node.key ?? '') : (p.data?.GroupName ?? '')),
    comparator: (valueA: any, valueB: any, nodeA: any, nodeB: any) => {
      const a = nodeA?.group ? String(nodeA.key ?? '') : String(nodeA?.data?.GroupName ?? '');
      const b = nodeB?.group ? String(nodeB.key ?? '') : String(nodeB?.data?.GroupName ?? '');
      return a.localeCompare(b);
    },
    sort: 'asc',
  }), [t]);

  // Видимая метрика + скрытые суммовые поля для взвешенной агрегации
  const columnDefs: ColDef<LeafRow>[] = React.useMemo(() => ([
    {
      headerName: t('orderTailsStats.avgTailDays') as string,
      field: 'AvgTailDays',
      flex: 1,
      maxWidth: 200,
      cellStyle: { textAlign: 'right' },
      valueGetter: (p) => {
        if (p.node?.group) {
          const sum = (p.node.aggData as any)?.SumTailDays ?? 0;
          const cnt = (p.node.aggData as any)?.Count ?? 0;
          return cnt ? sum / cnt : 0;
        }
        return p.data?.AvgTailDays ?? 0;
      },
      valueFormatter: (p) => {
        const n = Number(p.value);
        if (!isFinite(n)) return '';
        return new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(n);
      },
      suppressAggFuncInHeader: true,
    },
    { field: 'SumTailDays', aggFunc: 'sum', hide: true },
    { field: 'Count',      aggFunc: 'sum', hide: true },
  ]), [t]);

  // Контейнер будет сжиматься под контент, поэтому не используем fitGridWidth

  if (loading && suppressLocalLoaders) {
    return null;
  }

  return (
    <div className="w-full overflow-x-auto">
      {/* Общая строка заголовков для выравнивания */}
      <div className="flex gap-6 items-end mb-2">
        <div style={{ width: 'fit-content', minWidth: 520 }}>
          <h3 className="text-lg font-semibold text-[#0d1c3d]">{t('orderTailsStats.groupChartTitle')}</h3>
        </div>
        <div className="flex-1 min-w-[600px]">
          <h3 className="text-lg font-semibold text-[#0d1c3d]">{t('orderTailsStats.chartTitle')}</h3>
        </div>
      </div>

      <div className="flex gap-6">
        {/* Левый контейнер: только грид с заголовком */}
        <div className="flex flex-col">
          <div
            className="ag-theme-quartz pt-3"
            ref={gridRef}
            style={{ width: 'fit-content', minWidth: 520 }}
          >
            <AgGridReact<LeafRow>
          rowData={rows}
          columnDefs={columnDefs}
          defaultColDef={{ resizable: true, sortable: true, filter: false }}
          treeData={true}
            domLayout={'autoHeight'}
          getDataPath={(r: LeafRow) => [r.LargeGroup || '', r.GroupName || '']}
          getRowId={(p) => p.data.id}
          groupDefaultExpanded={0}
          // ВАЖНО: не используем groupRows — оставляем стандартный групповой столбец
          autoGroupColumnDef={autoGroupColumnDef}
          animateRows={false}
          // Диапазонное выделение ячеек и копирование (как в DPF Overview)
          rowSelection={'multiple'}
          cellSelection={true}
          suppressClipboardPaste={true}
          sendToClipboard={(p: any) => { try { navigator.clipboard?.writeText?.(p.data); } catch {} }}
            // Итоговая строка: средневзвешенная по всем листам
            pinnedBottomRowData={[(() => {
              const totalSum = rows.reduce((acc, r) => acc + (Number(r.SumTailDays) || 0), 0);
              const totalCnt = rows.reduce((acc, r) => acc + (Number(r.Count) || 0), 0);
              const avg = totalCnt ? totalSum / totalCnt : 0;
              return { LargeGroup: (t('orderTailsStats.total') as string) || 'Total', GroupName: '', AvgTailDays: avg } as any;
            })()]}
        />
          </div>
        </div>

        {/* Правый контейнер: только карточка с графиком и таблицей */}
        <div className="flex-1 min-w-[600px]">
          <OrderTailsMonthlyAvgChart rows={externalRows} suppressLocalLoaders={suppressLocalLoaders} onLoadingChange={onLoadingChange} hideTitle={true} />
        </div>
      </div>
    </div>
  );
};

export default OrderTailsStatsGrid;
