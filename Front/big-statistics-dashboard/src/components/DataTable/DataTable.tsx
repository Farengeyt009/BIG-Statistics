import { useState, useMemo, useEffect } from "react";
import {
  ColumnDef, useReactTable, getCoreRowModel, flexRender, RowData,
} from "@tanstack/react-table";
import FilterPopover from "./FilterPopover";
import { DndContext, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

export interface DataTableProps<T extends RowData> {
  data: T[];
  columnsOverrides?: Record<string, Partial<ColumnDef<T>>>;
  columnsOrder?: string[];
  defaultVisible?: string[];
}

export function DataTable<T extends Record<string, any>>({
  data,
  columnsOverrides = {},
  columnsOrder,
  defaultVisible,
}: DataTableProps<T>) {
  const [filters, setFilters] = useState<Record<string, string[]>>({});

  // Вычисляем уникальные значения для каждого столбца
  const uniqueValuesByKey = useMemo(() => {
    const result: Record<string, string[]> = {};
    if (!data.length) return result;
    
    const keys = Object.keys(data[0]);
    keys.forEach(key => {
      const values = new Set<string>();
      data.forEach(row => {
        const val = (row as Record<string, any>)[key];
        values.add(val === undefined || val === null ? '' : String(val));
      });
      result[key] = Array.from(values).sort();
    });
    return result;
  }, [data]);

  // Фильтрация данных
  const filteredData = useMemo(() => {
    if (!data.length) return [];
    return data.filter(row => {
      return Object.keys(row as Record<string, any>).every(key => {
        const selectedVals = filters[key];
        if (!selectedVals || selectedVals.length === 0) return true;
        const cellValue = (row as Record<string, any>)[key];
        const cellStr = cellValue === undefined || cellValue === null ? '' : String(cellValue);
        return selectedVals.includes(cellStr);
      });
    });
  }, [data, filters]);

  // DRAG & DROP: порядок колонок
  const [columnOrder, setColumnOrder] = useState<string[]>([]);

  const columns = useMemo<ColumnDef<T>[]>(() => {
    if (!filteredData.length) return [];
    // 1. База без header
    const base = Object.keys(filteredData[0] as Record<string, any>)
      .map((key) => ({
        id: key,
        accessorKey: key,
      }));
    // 2. Сливаем overrides
    let merged = base.map((col) => ({
      ...col,
      ...(columnsOverrides[col.id as string] ?? {}),
    }));
    // 3. Сортировка, если нужно
    if (columnsOrder?.length) {
      merged.sort((a, b) =>
        (columnsOrder.indexOf(a.id as string) === -1 ? Infinity : columnsOrder.indexOf(a.id as string)) -
        (columnsOrder.indexOf(b.id as string) === -1 ? Infinity : columnsOrder.indexOf(b.id as string))
      );
    }
    // 4. Добавляем header с фильтром
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
              onFilterChange={(sel) =>
                setFilters((p) => ({ ...p, [col.id as string]: sel }))
              }
            />
          </>
        );
      },
    }));
    return final as ColumnDef<T>[];
  }, [filteredData, columnsOverrides, columnsOrder, uniqueValuesByKey, filters]);

  // DRAG & DROP: инициализация columnOrder после columns
  useEffect(() => {
    setColumnOrder(columns.map(c => c.id as string));
  }, [columns]);

  const [visible, setVisible] = useState<string[]>(
    defaultVisible ?? columns.map((c) => c.id as string)
  );

  const table = useReactTable({
    data: filteredData,
    columns,
    state: { columnOrder },
    onColumnOrderChange: setColumnOrder,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <>
      <table className="min-w-full text-sm border">
        <thead className="bg-gray-100">
          <DndContext
            onDragEnd={({ active, over }: DragEndEvent) => {
              if (!over || active.id === over.id) return;
              setColumnOrder((prev) =>
                arrayMove(prev, prev.indexOf(active.id as string), prev.indexOf(over.id as string))
              );
            }}
          >
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
          </DndContext>
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id}>
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id} className="border px-2 py-1">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

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