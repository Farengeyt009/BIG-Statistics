import { useCallback } from 'react';
import { saveAs } from 'file-saver';
import * as XLSX from 'xlsx-js-style';
import { FileSpreadsheet } from 'lucide-react';

interface Props {
  versionId: number | null;
  fileName?: string;
}

export default function ExportSalePlanButton({ versionId, fileName = 'sale_plan' }: Props) {
  const handleExport = useCallback(async () => {
    if (!versionId) return;

    try {
      // Получаем данные с бэкенда
      const response = await fetch(`/api/orders/saleplan/versions/${versionId}/export`);
      const data = await response.json();

      if (!data.success || !data.data) {
        throw new Error(data.error || 'Ошибка получения данных');
      }

      const rows = data.data;
      if (rows.length === 0) {
        alert('Нет данных для экспорта');
        return;
      }

      // Заголовки (исключаем ID поля)
      const headerStyle = {
        fill: { patternType: 'solid', fgColor: { rgb: '002060' } },
        font: { bold: true, color: { rgb: 'FFFFFF' } },
        alignment: { horizontal: 'center', vertical: 'center' },
      } as const;

      const headers = ['Year', 'Month', 'Market', 'Article_number', 'Name', 'QTY', 'LargeGroup'];
      const headerRow = headers.map(h => ({ v: h, t: 's' as const, s: headerStyle }));

      // Данные
      const bodyRows = rows.map((row: any) => [
        { v: row.YearNum, t: 'n' as const },
        { v: row.MonthNum, t: 'n' as const },
        { v: row.Market || '', t: 's' as const },
        { v: row.Article_number || '', t: 's' as const },
        { v: row.Name || '', t: 's' as const },
        { v: row.QTY, t: 'n' as const, s: { numFmt: '#,##0' } },
        { v: row.LargeGroup || '', t: 's' as const },
      ]);

      // Создаем worksheet
      const ws = XLSX.utils.aoa_to_sheet([headerRow, ...bodyRows]);

      // Настройка ширины колонок
      ws['!cols'] = [
        { wch: 8 },  // Year
        { wch: 8 },  // Month
        { wch: 18 }, // Market
        { wch: 18 }, // Article_number
        { wch: 35 }, // Name
        { wch: 12 }, // QTY
        { wch: 20 }, // LargeGroup
      ];

      // Создаем workbook и сохраняем
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Sale Plan');
      const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array', cellStyles: true });
      saveAs(new Blob([wbout], { type: 'application/octet-stream' }), `${fileName}_v${versionId}.xlsx`);
    } catch (err: any) {
      alert(`Ошибка экспорта: ${err.message}`);
    }
  }, [versionId, fileName]);

  return (
    <button
      onClick={handleExport}
      disabled={!versionId}
      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-30"
      title="Экспорт в Excel"
    >
      <FileSpreadsheet className="w-5 h-5" />
    </button>
  );
}

