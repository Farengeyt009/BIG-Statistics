import { saveAs } from 'file-saver';
import * as XLSX from 'xlsx-js-style';
import { useCallback } from 'react';
import { Table } from '@tanstack/react-table';

interface Props<T> {
  table: Table<T> | null;
  fileName?: string; // без расширения
}

export default function ExportButton<T>({
  table,
  fileName = 'table',
}: Props<T>) {
  const handleExport = useCallback(() => {
    if (!table) return;

    /* ---------- 1. шапка ---------- */
    const leafHeaders = table.getHeaderGroups().at(-1)!.headers;
    const headerStyle = {
      fill: { patternType: 'solid', fgColor: { rgb: '002060' } },
      font: { bold: true, color: { rgb: 'FFFFFF' } },
    };

    const headerRow = leafHeaders.map((h) => {
      /* берём красивый текст из meta.excelHeader,
         иначе — строковый header, иначе fallback на id */
      const text =
        (h.column.columnDef.meta as any)?.excelHeader ??
        (typeof h.column.columnDef.header === 'string'
          ? h.column.columnDef.header
          : h.column.id || '');

      return { v: text, t: 's' as const, s: headerStyle };
    });

    /* ---------- 2. тело таблицы ---------- */
    const rows = table.getSortedRowModel().rows;
    if (rows.length === 0) {
      alert('Нет данных для экспорта');
      return;
    }
    const bodyRows = rows.map((row) =>
      row.getVisibleCells().map((c) => c.getValue()),
    );

    /* ---------- 3. вычисляем ширины колонок ---------- */
    const allRows = [
      headerRow.map((c) => (c.v as string) ?? ''),
      ...bodyRows.map((r) => r.map((v) => (v ?? '').toString())),
    ];

    const maxLens: number[] = leafHeaders.map((_, colIdx) =>
      allRows.reduce(
        (m, row) => Math.max(m, row[colIdx]?.length || 0),
        0,
      ),
    );

    const cols = maxLens.map((len) => ({
      wch: Math.max(11, Math.min(len + 2, 50)), // минимальная ширина 11 единиц Excel, +2 — небольшой отступ; 50 — максимум
    }));

    /* ---------- 4. формируем лист ---------- */
    const ws = XLSX.utils.aoa_to_sheet([headerRow, ...bodyRows]);
    ws['!cols'] = cols;

    /* ---------- 5. экспорт ---------- */
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    const buf = XLSX.write(wb, {
      bookType: 'xlsx',
      type: 'array',
      cellStyles: true,
    });
    saveAs(
      new Blob([buf], { type: 'application/octet-stream' }),
      `${fileName}.xlsx`,
    );
  }, [table, fileName]);

  return (
    <button
      onClick={handleExport}
      disabled={!table}
      className={`flex items-center gap-2 rounded-md bg-[#217346] h-8 px-3
        text-sm text-white font-semibold shadow transition-colors
        hover:bg-[#1e633d] ${!table ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="20"
        height="20"
        viewBox="0 0 24 24"
      >
        <path
          fill="currentColor"
          d="M3 6a2 2 0 0 1 2-2h3.172a2 2 0 0 1 1.414.586l1.828 1.828A2 2 0 0 0 12.828 7H19a2 2 0 0 1 2 2v1H3V6Zm0 5v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7H3Zm9 2a1 1 0 0 1 1 1v2.586l.293-.293a1 1 0 1 1 1.414 1.414l-2 2a1 1 0 0 1-1.414 0l-2-2a1 1 0 1 1 1.414-1.414l.293.293V14a1 1 0 0 1 1-1Z"
        />
      </svg>
      Excel
    </button>
  );
}
