import { useState, useMemo, useEffect, useRef } from 'react';
import {
  ColumnDef,
  useReactTable,
  getCoreRowModel,
  flexRender,
  RowData,
  Table,
} from '@tanstack/react-table';
import FilterPopover from './FilterPopover';
import { DndContext, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useVirtualizer } from '@tanstack/react-virtual';

export interface DataTableProps<T extends RowData> {
  data: T[];
  columnsOverrides?: Record<string, Partial<ColumnDef<T>>>;
  columnsOrder?: string[];
  defaultVisible?: string[];
  onTableReady?: (table: Table<T>) => void;
  virtualized?: boolean | { overscan?: number };
}

export function DataTable<T extends Record<string, any>>({
  data,
  columnsOverrides = {},
  columnsOrder,
  defaultVisible,
  onTableReady,
  virtualized = true,
}: DataTableProps<T>) {
  /* -------------------- фильтры -------------------- */
  const [filters, setFilters] = useState<Record<string, string[]>>({});

  // Фильтрация данных
  const filteredData = useMemo(() => {
    if (!data.length) return [];
    return data.filter((row) => {
      return Object.keys(row as Record<string, any>).every((key) => {
        const selectedVals = filters[key];
        if (!selectedVals || selectedVals.length === 0) return true;
        const cellValue = (row as Record<string, any>)[key];
        const cellStr =
          cellValue === undefined || cellValue === null ? '' : String(cellValue);
        return selectedVals.includes(cellStr);
      });
    });
  }, [data, filters]);

  // --- Каскадная фильтрация для фильтров ---
  function getCascadeData(skipKey?: string) {
    return data.filter((row) => {
      return Object.keys(row as Record<string, any>).every((key) => {
        if (key === skipKey) return true;
        const selectedVals = filters[key];
        if (!selectedVals || selectedVals.length === 0) return true;
        const cellValue = (row as Record<string, any>)[key];
        const cellStr = cellValue === undefined || cellValue === null ? '' : String(cellValue);
        return selectedVals.includes(cellStr);
      });
    });
  }

  // Уникальные значения для каждого столбца с учётом каскадных фильтров
  const uniqueValuesByKey = useMemo(() => {
    const res: Record<string, string[]> = {};
    if (!data.length) return res;
    const keys = Object.keys(data[0]);
    keys.forEach(k => {
      const src = getCascadeData(k); // фильтры ≠ k
      const set = new Set(src.map(r => String(r[k] ?? '')));
      res[k] = Array.from(set).sort();
    });
    return res;
  }, [data, filters]);

  // --- Итоговые суммы для числовых колонок ---
  const numericColumns = useMemo(() => {
    if (!filteredData.length) return [];
    const keys = Object.keys(filteredData[0]);
    return keys.filter(key =>
      filteredData.every(row => {
        const val = row[key];
        return val === undefined || val === null || val === '' || !isNaN(Number(val));
      })
    );
  }, [filteredData]);

  const numericSums = useMemo(() => {
    const sums: Record<string, number> = {};
    numericColumns.forEach(key => {
      sums[key] = filteredData.reduce((acc, row) => acc + (Number(row[key]) || 0), 0);
    });
    return sums;
  }, [filteredData, numericColumns]);

  /* -------------------- drag & drop -------------------- */
  const [columnOrder, setColumnOrder] = useState<string[]>([]);

  /* -------------------- колонки -------------------- */
  const columns = useMemo<ColumnDef<T>[]>(() => {
    if (!filteredData.length) return [];
    // 1. база
    const base = Object.keys(filteredData[0] as Record<string, any>).map((key) => ({
      id: key,
      accessorKey: key,
    }));
    // 2. сливаем overrides
    let merged = base.map((col) => ({
      ...col,
      ...(columnsOverrides[col.id as string] ?? {}),
    }));
    // 3. сортировка, если задана
    if (columnsOrder?.length) {
      merged.sort(
        (a, b) =>
          (columnsOrder.indexOf(a.id as string) === -1
            ? Infinity
            : columnsOrder.indexOf(a.id as string)) -
          (columnsOrder.indexOf(b.id as string) === -1
            ? Infinity
            : columnsOrder.indexOf(b.id as string)),
      );
    }
    // 4. header c FilterPopover
    const final = merged.map((col) => ({
      ...col,
      header: () => {
        const label = typeof col.header === 'string' ? col.header : col.id;
        return (
          <>
            {label}
            <FilterPopover
              columnId={col.id as string}
              data={filteredData}
              uniqueValues={uniqueValuesByKey[col.id as string] || []}
              selectedValues={filters[col.id as string] || []}
              onFilterChange={(sel) => setFilters((p) => ({ ...p, [col.id as string]: sel }))}
            />
          </>
        );
      },
    }));
    return final as ColumnDef<T>[];
  }, [filteredData, columnsOverrides, columnsOrder, uniqueValuesByKey, filters]);

  // инициализация columnOrder
  useEffect(() => {
    setColumnOrder(columns.map((c) => c.id as string));
  }, [columns]);

  const [visible] = useState<string[]>(defaultVisible ?? columns.map((c) => c.id as string));

  const overscan = typeof virtualized === 'object' ? virtualized.overscan ?? 10 : 10;
  const parentRef = useRef<HTMLDivElement | null>(null);
  const rowVirtualizer = useVirtualizer({
    count: filteredData.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 34,
    overscan,
  });

  useEffect(() => {
    rowVirtualizer.measure();
  }, [columnOrder, rowVirtualizer]);

  /* -------------------- react‑table -------------------- */
  const table = useReactTable({
    data: filteredData,
    columns,
    state: { columnOrder },
    onColumnOrderChange: setColumnOrder,
    getCoreRowModel: getCoreRowModel(),
  });

  // уведомляем родителя
  useEffect(() => {
    onTableReady?.(table);
  }, [table, onTableReady]);

  /* -------------------- рендер -------------------- */
  return (
    <DndContext
      onDragEnd={({ active, over }: DragEndEvent) => {
        if (!over || active.id === over.id) return;
        setColumnOrder((prev) =>
          arrayMove(prev, prev.indexOf(active.id as string), prev.indexOf(over.id as string)),
        );
      }}
    >
      <div ref={parentRef} data-testid="scroll-area" className="max-h-96 overflow-auto">
      <table className="min-w-max w-full text-sm border table-auto">
          <thead className="bg-gray-100">
            <SortableContext items={columnOrder}>
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id}>
                  {hg.headers.map((h) => (
                    <SortableTh key={h.id} id={h.id}>
                      {flexRender(h.column.columnDef.header, h.getContext())}
                    </SortableTh>
                  ))}
                </tr>
              ))}
            </SortableContext>
          </thead>
          <tbody
            style={{ height: `${rowVirtualizer.getTotalSize()}px`, position: 'relative' }}
          >
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const row = table.getRowModel().rows[virtualRow.index];
              return (
                <tr
                  key={row.id}
                  data-index={virtualRow.index}
                  ref={(el) => rowVirtualizer.measureElement(el)}
                  style={{ position: 'absolute', top: 0, transform: `translateY(${virtualRow.start}px)` }}
                >
                  {row.getVisibleCells().map((cell) => {
                    const key = cell.column.id;
                    const value = cell.getValue();
                    const displayValue = numericColumns.includes(key)
                      ? value !== undefined && value !== null && value !== ''
                        ? Number(value).toLocaleString('ru-RU')
                        : ''
                      : flexRender(cell.column.columnDef.cell, cell.getContext());
                    return (
                      <td key={cell.id} className="border px-2 py-1 h-[34px]">
                        {numericColumns.includes(key)
                          ? displayValue
                          : flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
          {/* Итоговая строка для числовых колонок */}
          {filteredData.length > 0 && numericColumns.length > 0 && (
            <tfoot>
              <tr>
                {Object.keys(filteredData[0]).map(key =>
                  numericColumns.includes(key)
                    ? <td key={key} style={{ color: '#0d1c3d', fontWeight: 'bold' }}>{numericSums[key].toLocaleString('ru-RU')}</td>
                    : <td key={key}></td>
                )}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </DndContext>
  );
}

/* ---------- заголовок‑ячейка, поддерживающий drag ---------- */
function SortableTh({ id, children }: { id: string; children: React.ReactNode }) {
  const { setNodeRef, transform, transition, attributes, listeners } = useSortable({ id });

  return (
    <th
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      className="px-2 py-1 text-left select-none"
    >
      <div className="flex items-center gap-1">
        <span {...listeners} className="cursor-move font-medium">
          {children}
        </span>
      </div>
    </th>
  );
}
