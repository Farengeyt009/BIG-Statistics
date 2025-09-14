import { useCallback } from 'react';
import { saveAs } from 'file-saver';
import * as XLSX from 'xlsx-js-style';
import { FileSpreadsheet } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface Props {
  api: any | null;
  fileName?: string; // без расширения
  variant?: 'text' | 'icon';
}

export default function AgGridExportButton({ api, fileName = 'table', variant = 'icon' }: Props) {
  const { t } = useTranslation('production');
  const handleExport = useCallback(() => {
    if (!api) return;

    // 1) Получаем отображаемые колонки (в порядке показа)
    const displayedCols: any[] = api.getAllDisplayedColumns?.() ?? [];
    if (!displayedCols.length) return;

    // Пропускаем служебные колонки без заголовка
    const columns = displayedCols.filter((c: any) => (c?.getColDef?.()?.headerName ?? '').toString().trim() !== '' || (c?.getColDef?.()?.field ?? '').toString().trim() !== '');

    // 2) Заголовок с оформлением
    const headerStyle = {
      fill: { patternType: 'solid', fgColor: { rgb: '002060' } },
      font: { bold: true, color: { rgb: 'FFFFFF' } },
    } as const;

    const headerRow = columns.map((col: any) => {
      const def = col.getColDef?.() || {};
      const text: string = (def.headerName || def.field || '').toString();
      return { v: text, t: 's' as const, s: headerStyle };
    });

    // 3) Данные: проходимся по узлам после фильтра и сортировки
    const body: any[][] = [];
    api.forEachNodeAfterFilterAndSort?.((node: any) => {
      const row = columns.map((col: any) => {
        const def = col.getColDef?.() || {};
        const field = (def.field || '').toString();
        const raw = api.getValue ? api.getValue(col, node) : node?.data?.[field];

        // Для числовых колонок и специально для ManHours — отдаем чистое число
        if (field === 'ManHours') {
          const n = Number(node?.data?.ManHours);
          return Number.isFinite(n) ? n : '';
        }

        if (typeof raw === 'number') {
          return raw;
        }

        // Для остальных колонок применяем valueFormatter, если он есть
        let value = raw;
        if (typeof def.valueFormatter === 'function') {
          try {
            value = def.valueFormatter({ value: raw, data: node?.data, node, colDef: def, column: col, api });
          } catch {}
        }
        if (value == null) return '';
        return typeof value === 'number' ? value : String(value);
      });
      body.push(row);
    });

    if (!body.length) {
      alert('Нет данных для экспорта');
      return;
    }

    // 4) Ширины колонок по максимальной длине содержимого
    const allRowsForWidth = [headerRow.map((c) => (c.v as string) ?? ''), ...body.map(r => r.map(v => (v ?? '').toString()))];
    const maxLens: number[] = columns.map((_: any, colIdx: number) =>
      allRowsForWidth.reduce((m, row) => Math.max(m, row[colIdx]?.length || 0), 0)
    );
    const cols = maxLens.map((len) => ({ wch: Math.max(11, Math.min(len + 2, 50)) }));

    // 5) Собираем лист и сохраняем
    const ws = XLSX.utils.aoa_to_sheet([headerRow, ...body]);
    (ws as any)['!cols'] = cols;
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array', cellStyles: true });
    saveAs(new Blob([buf], { type: 'application/octet-stream' }), `${fileName}.xlsx`);
  }, [api, fileName]);

  const base = !api ? 'opacity-50 cursor-not-allowed' : '';

  if (variant === 'icon') {
    return (
      <button
        onClick={handleExport}
        disabled={!api}
        title={t('timeLossTable.export') as string}
        aria-label={t('timeLossTable.export') as string}
        className={`h-8 w-8 p-2 rounded-md border border-gray-300 bg-white text-slate-700 hover:bg-gray-100 transition flex items-center justify-center ${base}`}
      >
        <FileSpreadsheet className="w-4 h-4" />
      </button>
    );
  }

  return (
    <button
      onClick={handleExport}
      disabled={!api}
      className={`px-3 h-8 rounded-md text-sm font-semibold border border-gray-300 bg-white text-slate-700 hover:bg-gray-100 transition ${base}`}
      title={t('timeLossTable.export') as string}
    >
      <FileSpreadsheet className="w-4 h-4 mr-1" /> {t('timeLossTable.export')}
    </button>
  );
}


