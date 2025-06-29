import { saveAs } from "file-saver";
import * as XLSX from "xlsx-js-style";
import { Table } from "@tanstack/react-table";

interface Props<T> {
  table: Table<T> | null;
  fileName?: string;
}

export default function ExportButton<T>({ table, fileName = "table.xlsx" }: Props<T>) {
  const handleExport = () => {
    if (!table) return;
    // 1. получаем заголовки (локализованные)
    const leafColumns = table.getVisibleLeafColumns();
    const headerRow = leafColumns.map((col, idx) => {
      // Получаем context для колонки через первый headerGroup
      const headerGroups = table.getHeaderGroups();
      const headerObj = headerGroups[0]?.headers[idx];
      return typeof col.columnDef.header === 'function'
        ? col.columnDef.header(headerObj?.getContext?.() ?? {})
        : col.columnDef.header ?? col.id;
    });

    // 2. получаем строки данных
    const bodyRows = table.getRowModel().rows.map(row =>
      row.getVisibleCells().map(c => c.getValue())
    );

    // 3. создаём AOA-массив и лист
    const ws = XLSX.utils.aoa_to_sheet([headerRow, ...bodyRows]);

    // 4. стилизуем шапку
    headerRow.forEach((_, idx) => {
      const cell = ws[XLSX.utils.encode_cell({ c: idx, r: 0 })];
      if (cell) {
        cell.s = {
          fill: { fgColor: { rgb: "002060" } },
          font: { bold: true, color: { rgb: "FFFFFF" } },
        };
      }
    });

    // 5. создаём книгу и скачиваем
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    const buf = XLSX.write(wb, {
      bookType: "xlsx",
      type: "array",
      cellStyles: true,
    });
    saveAs(new Blob([buf], { type: "application/octet-stream" }), fileName);
  };

  return (
    <button
      onClick={handleExport}
      disabled={!table}
      className={
        "flex items-center gap-2 rounded-md bg-[#217346] h-8 px-3 text-sm text-white font-semibold shadow hover:bg-[#1e633d] transition-colors" +
        (!table ? " opacity-50 cursor-not-allowed" : "")
      }
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="20"
        height="20"
        fill="none"
        viewBox="0 0 24 24"
        className="inline-block"
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
