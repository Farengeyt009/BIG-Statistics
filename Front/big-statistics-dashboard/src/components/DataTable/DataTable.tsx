// Front/big-statistics-dashboard/src/components/DataTable.tsx
import { useState, useMemo, useEffect } from "react";
import {
  ColumnDef,
  Table,
  useReactTable,
  getCoreRowModel,
  flexRender,
  RowData,
} from "@tanstack/react-table";
import FilterPopover from "./FilterPopover";
import { DndContext, DragEndEvent } from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

/** ---------- props ---------- */
export interface DataTableProps<T extends RowData> {
  /** данные для отображения */
  data: T[];
  /** точечная пере‑настройка колонок */
  columnsOverrides?: Record<string, Partial<ColumnDef<T>>>;
  /** жёсткий порядок колонок (по id) */
  columnsOrder?: string[];
  /** изначально видимые колонки */
  defaultVisible?: string[];
  /** callback ↑ — отдаём наружу готовый экземпляр таблицы */
  onTableInit?: (table: Table<T>) => void;
}

/** ---------- компонент ---------- */
export function DataTable<T extends Record<string, any>>({
  data,
  columnsOverrides = {},
  columnsOrder,
  defaultVisible,
  onTableInit,
}: DataTableProps<T>) {
  /* ------------ фильтрация ------------ */
  const [filters, setFilters] = useState<Record<string, string[]>>({});

  const uniqueValuesByKey = useMemo(() => {
    const result: Record<string, string[]> = {};
    if (!data.length) return result;
    Object.keys(data[0]).forEach((key) => {
      const values = new Set<string>();
      data.forEach((row) => {
        const val = (row as Record<string, any>)[key];
        values.add(val === undefined || val === null ? "" : String(val));
      });
      result[key] = Array.from(values).sort();
    });
    return result;
  }, [data]);

  const filteredData = useMemo(() => {
    if (!data.length) return [];
    return data.filter((row) =>
      Object.keys(row).every((key) => {
        const selected = filters[key];
        if (!selected?.length) return true;
        const cell = (row as Record<string, any>)[key];
        const str = cell === undefined || cell === null ? "" : String(cell);
        return selected.includes(str);
      })
    );
  }, [data, filters]);

  /* ------------ порядок колонок (DnD) ------------ */
  const [columnOrder, setColumnOrder] = useState<string[]>([]);

  const columns = useMemo<ColumnDef<T>[]>(() => {
    if (!filteredData.length) return [];
    // 1. базовые колонки
    const base = Object.keys(filteredData[0]).map((k) => ({
      id: k,
      accessorKey: k,
    }));
    // 2. merge overrides
    let merged = base.map((c) => ({ ...c, ...(columnsOverrides[c.id] ?? {}) }));
    // 3. сортировка по columnsOrder
    if (columnsOrder?.length) {
      merged.sort(
        (a, b) =>
          (columnsOrder.indexOf(a.id) === -1
            ? Infinity
            : columnsOrder.indexOf(a.id)) -
          (columnsOrder.indexOf(b.id) === -1
            ? Infinity
            : columnsOrder.indexOf(b.id))
      );
    }
    // 4. добавляем header‑фильтр
    return merged.map((col) => ({
      ...col,
      header: () => {
        const label = typeof col.header === "string" ? col.header : col.id;
        return (
          <>
            {label}
            <FilterPopover
              columnId={col.id}
              data={filteredData}
              uniqueValues={uniqueValuesByKey[col.id] || []}
              selectedValues={filters[col.id] || []}
              onFilterChange={(sel) =>
                setFilters((prev) => ({ ...prev, [col.id]: sel }))
              }
            />
          </>
        );
      },
    })) as ColumnDef<T>[];
  }, [filteredData, columnsOverrides, columnsOrder, uniqueValuesByKey, filters]);

  /* ------------ columnOrder init ------------ */
  useEffect(() => setColumnOrder(columns.map((c) => c.id!).filter(Boolean)), [columns]);

  /* ------------ create table ------------ */
  const table = useReactTable({
    data: filteredData,
    columns,
    state: { columnOrder },
    onColumnOrderChange: setColumnOrder,
    getCoreRowModel: getCoreRowModel(),
  });

  /* ----- отдаём экземпляр вверх, когда он готов ----- */
  useEffect(() => {
    onTableInit?.(table);
  }, [table, onTableInit]);

  /* ------------ (не использовано, но оставлено на будущее) ------------ */
  const [visible, setVisible] = useState<string[]>(
    defaultVisible ?? columns.map((c) => c.id!).filter(Boolean)
  );
  /* -------------------------------------------------------------------- */

  return (
    <table className="min-w-full text-sm border">
      {/* ---------- шапка ---------- */}
      <thead className="bg-gray-100">
        <DndContext
          onDragEnd={({ active, over }: DragEndEvent) => {
            if (!over || active.id === over.id) return;
            setColumnOrder((prev) =>
              arrayMove(
                prev,
                prev.indexOf(active.id as string),
                prev.indexOf(over.id as string)
              )
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

      {/* ---------- данные ---------- */}
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
  );
}

/* ---------------------------- util ---------------------------- */
function SortableTh({
  id,
  children,
}: {
  id: string;
  children: React.ReactNode;
}) {
  const { setNodeRef, transform, transition, attributes, listeners } =
    useSortable({ id });

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
