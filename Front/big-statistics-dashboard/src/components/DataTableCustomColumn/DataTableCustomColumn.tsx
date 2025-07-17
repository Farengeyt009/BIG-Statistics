import React, { useRef, useEffect, useMemo } from 'react';
import { ColumnDef, RowData, Table, flexRender, useReactTable, getCoreRowModel } from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';

export interface DataTableCustomColumnProps<T extends RowData> {
  data: T[];
  columns: ColumnDef<T>[];
  onTableReady?: (table: Table<T>) => void;
  virtualized?: boolean | { overscan?: number };
  rowClassName?: (row: T, rowIndex: number) => string;
  onRowClick?: (row: T, rowIndex: number) => void;
  cellRenderers?: { [colId: string]: (value: any, row: T, rowIndex: number) => React.ReactNode };
}

export function DataTableCustomColumn<T extends Record<string, any>>({
  data,
  columns,
  onTableReady,
  virtualized = true,
  rowClassName,
  onRowClick,
  cellRenderers,
}: DataTableCustomColumnProps<T>) {
  // virtualizer
  const rowHeight = 34;
  const overscan = typeof virtualized === 'object' ? virtualized.overscan ?? 10 : 10;
  const parentRef = useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: data.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowHeight,
    overscan,
  });

  // react-table
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  useEffect(() => {
    onTableReady?.(table);
  }, [table, onTableReady]);

  // Форматтеры для числовых и процентных колонок
  function formatNumberAuto(val: any) {
    const num = Number(val);
    if (!num) return '–';
    return Math.round(num).toLocaleString('ru-RU').replace(/\s/g, '\u00A0');
  }
  function formatPercentAuto(val: any) {
    const num = Number(val);
    if (!num) return '–';
    return Math.round(num).toLocaleString('ru-RU').replace(/\s/g, '\u00A0') + '%';
  }
  // colgroup widths
  const columnWidths = useMemo<Record<string, number>>(() => {
    if (!data.length) return {};
    const pxPerChar = 8;
    const basePadding = 8;
    const res: Record<string, number> = {};
    columns.forEach((col) => {
      const colId = col.id as string;
      const headerLen = (col.meta?.excelHeader ?? colId).length;
      const cellLen = data.reduce((m, r) => {
        let val = r[colId];
        let formatted = '';
        if (colId.toLowerCase().includes('percent')) {
          formatted = formatPercentAuto(val);
        } else if (colId.toLowerCase().includes('qty') || colId.toLowerCase().includes('time')) {
          formatted = formatNumberAuto(val);
        } else {
          formatted = String(val ?? '');
        }
        return Math.max(m, formatted.length);
      }, 0);
      const px = Math.min(
        Math.max(Math.max(headerLen, cellLen) * pxPerChar + basePadding, 80),
        400,
      );
      res[colId] = px;
    });
    return res;
  }, [columns, data]);

  // virtual row paddings
  const virtualRows = rowVirtualizer.getVirtualItems();
  const paddingTop = virtualRows[0]?.start ?? 0;
  const paddingBottom = rowVirtualizer.getTotalSize() - (virtualRows.at(-1)?.end ?? 0);

  return (
    <div ref={parentRef} className="max-h-[80vh] overflow-auto rounded-t-lg bg-white border border-slate-200">
      <table className="min-w-max w-max text-sm table-auto bg-white border-collapse -mt-px">
        {/* colgroup */}
        <colgroup>
          {table
            .getHeaderGroups()[0]
            ?.headers.filter((h) => typeof h.id === 'string')
            .map((h) => (
              <col key={h.id} style={{ width: `${columnWidths[h.id as string]}px` }} />
            ))}
        </colgroup>
        {/* thead */}
        <thead className="select-none sticky top-0 z-20 bg-[color:var(--tbl-head-bg)] text-[color:var(--tbl-head-text)] text-[11px] font-semibold uppercase tracking-wide">
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id}>
              {hg.headers.map((h, idx) => (
                <th key={h.id} className={`px-3 py-[10px] text-center whitespace-nowrap first:rounded-tl-lg last:rounded-tr-lg${idx < hg.headers.length - 1 ? ' border-r border-slate-200' : ''}`}>
                  <div className="flex items-center gap-1 justify-center w-full">
                    {flexRender(h.column.columnDef.header, h.getContext())}
                  </div>
                </th>
              ))}
            </tr>
          ))}
        </thead>
        {/* tbody */}
        <tbody>
          {paddingTop > 0 && (
            <tr style={{ height: `${paddingTop}px` }}>
              <td colSpan={columns.length} />
            </tr>
          )}
          {virtualRows.map((vRow) => {
            const row = table.getRowModel().rows[vRow.index];
            return (
              <tr
                key={row.id}
                style={{ height: rowHeight }}
                className={[
                  typeof rowClassName === 'function' ? rowClassName(row.original, vRow.index) : '',
                  vRow.index % 2 ? 'bg-[color:var(--tbl-row-zebra)]' : '',
                  'hover:bg-blue-50 transition-colors'
                ].join(' ')}
                onClick={onRowClick ? () => onRowClick(row.original, vRow.index) : undefined}
              >
                {row.getVisibleCells().map((cell, idx) => (
                  <td
                    key={cell.id}
                    className={`border-t px-3 py-1 whitespace-nowrap overflow-hidden text-ellipsis ${cell.column.id === 'LargeGroup' ? '' : 'text-center'}${idx < row.getVisibleCells().length - 1 ? ' border-r border-slate-200' : ''}`}
                  >
                    {cellRenderers && cellRenderers[cell.column.id]
                      ? cellRenderers[cell.column.id](row.original[cell.column.id], row.original, vRow.index)
                      : flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            );
          })}
          {paddingBottom > 0 && (
            <tr style={{ height: `${paddingBottom}px` }}>
              <td colSpan={columns.length} />
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export default DataTableCustomColumn; 