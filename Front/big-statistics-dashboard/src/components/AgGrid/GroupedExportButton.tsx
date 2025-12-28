import { useCallback } from 'react';
import { saveAs } from 'file-saver';
import * as XLSX from 'xlsx-js-style';
import { FileSpreadsheet } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface Props {
  api: any | null;
  fileName?: string;
  variant?: 'text' | 'icon';
}

export default function AgGridGroupedExportButton({ api, fileName = 'table', variant = 'icon' }: Props) {
  const { t } = useTranslation();

  const handleExport = useCallback(() => {
    if (!api) return;

    // 1) Получаем отображаемые колонки (в порядке показа)
    const displayedCols: any[] = api.getAllDisplayedColumns?.() ?? [];
    if (!displayedCols.length) return;

    // Пропускаем авто-колонку группировки (она обрабатывается отдельно)
    const dataColumns = displayedCols.filter((c: any) => {
      const colId = c?.getColId?.() ?? '';
      return colId !== 'ag-Grid-AutoColumn';
    });

    // 2) Стили для заголовка
    const headerStyle = {
      fill: { patternType: 'solid', fgColor: { rgb: '002060' } },
      font: { bold: true, color: { rgb: 'FFFFFF' } },
      alignment: { horizontal: 'center', vertical: 'center' },
    } as const;

    // 3) Формируем заголовок
    const headerRow = [
      { v: 'Group', t: 's' as const, s: headerStyle }, // Колонка для группировки
      ...dataColumns.map((col: any) => {
        const def = col.getColDef?.() || {};
        const text: string = (def.headerName || def.field || '').toString();
        return { v: text, t: 's' as const, s: headerStyle };
      })
    ];

    // 4) Обрабатываем данные с учетом группировки
    const body: any[][] = [];
    const processedNodes = new Set<string>(); // Чтобы избежать дублирования

    api.forEachNodeAfterFilterAndSort?.((node: any) => {
      // Пропускаем, если уже обработали (защита от дублирования)
      const nodeId = node.id || Math.random().toString();
      if (processedNodes.has(nodeId)) return;
      processedNodes.add(nodeId);

      // Пропускаем pinned bottom rows (итоговые строки обработаем отдельно)
      if (node.rowPinned === 'bottom') return;

      const row: any[] = [];
      const isGroup = node.group === true;
      const groupLevel = node.level ?? 0;
      
      // Стили для разных уровней группировки
      let rowStyle: any = {};
      
      if (isGroup) {
        // Стили для групповых строк
        if (groupLevel === 0) {
          // Уровень 1 (Market или Large Group)
          rowStyle = {
            fill: { patternType: 'solid', fgColor: { rgb: 'D9E1F2' } },
            font: { bold: true },
          };
        } else if (groupLevel === 1) {
          // Уровень 2 (Large Group или Group)
          rowStyle = {
            fill: { patternType: 'solid', fgColor: { rgb: 'E9EDF5' } },
            font: { bold: true },
          };
        } else {
          // Уровень 3+ (Group)
          rowStyle = {
            fill: { patternType: 'solid', fgColor: { rgb: 'F2F4F8' } },
            font: { bold: false },
          };
        }
      }

      // Первая колонка - название группы или GroupName для leaf nodes
      const indent = '  '.repeat(groupLevel); // Отступ для визуализации иерархии
      const groupName = isGroup ? (node.key || '') : (node.data?.GroupName ?? '');
      
      row.push({
        v: indent + groupName,
        t: 's' as const,
        s: rowStyle,
      });

      // Остальные колонки - данные
      dataColumns.forEach((col: any) => {
        const colId = col.getColId?.() ?? '';
        let value: any = null;

        if (isGroup) {
          // Для групповых строк берем агрегированное значение
          value = node.aggData?.[colId] ?? null;
        } else {
          // Для обычных строк берем значение из data
          value = node.data?.[colId] ?? null;
        }

        // Определяем тип ячейки
        if (value === null || value === undefined || value === '') {
          row.push({ v: '', t: 's' as const, s: rowStyle });
        } else if (typeof value === 'number') {
          row.push({ 
            v: value, 
            t: 'n' as const, 
            s: { ...rowStyle, numFmt: '#,##0' },
          });
        } else {
          row.push({ 
            v: String(value), 
            t: 's' as const, 
            s: rowStyle,
          });
        }
      });

      body.push(row);
    });

    // 5) Обрабатываем pinned bottom rows (итоговые строки)
    const pinnedBottomNodes: any[] = [];
    api.forEachNode?.((node: any) => {
      if (node.rowPinned === 'bottom') {
        pinnedBottomNodes.push(node);
      }
    });

    if (pinnedBottomNodes.length > 0) {
      const totalStyle = {
        fill: { patternType: 'solid', fgColor: { rgb: 'FFF2CC' } },
        font: { bold: true },
        border: {
          top: { style: 'medium', color: { rgb: '000000' } },
        },
      } as const;

      pinnedBottomNodes.forEach(node => {
        const row: any[] = [];
        
        // Первая колонка - название (например, "Grand Total")
        const groupName = node.data?.Market || node.data?.LargeGroup || node.data?.GroupName || 'Total';
        row.push({
          v: groupName,
          t: 's' as const,
          s: totalStyle,
        });

        // Остальные колонки
        dataColumns.forEach((col: any) => {
          const colId = col.getColId?.() ?? '';
          const value = node.data?.[colId] ?? null;

          if (value === null || value === undefined || value === '') {
            row.push({ v: '', t: 's' as const, s: totalStyle });
          } else if (typeof value === 'number') {
            row.push({ 
              v: value, 
              t: 'n' as const, 
              s: { ...totalStyle, numFmt: '#,##0' },
            });
          } else {
            row.push({ 
              v: String(value), 
              t: 's' as const, 
              s: totalStyle,
            });
          }
        });

        body.push(row);
      });
    }

    // 6) Создаем первый worksheet (с группировкой)
    const wsGrouped = XLSX.utils.aoa_to_sheet([headerRow, ...body]);

    // 7) Настройка ширины колонок для первого листа
    const colWidths: any[] = [
      { wch: 35 }, // Колонка группировки - широкая
      ...dataColumns.map(() => ({ wch: 12 })), // Остальные колонки
    ];
    wsGrouped['!cols'] = colWidths;

    // 8) Создаем второй worksheet (плоская таблица)
    // Находим все скрытые колонки (группировки и обычные)
    const allColumns = api.getAllGridColumns?.() ?? [];
    const hiddenColumns = allColumns.filter((col: any) => {
      const def = col.getColDef?.() || {};
      const colId = col.getColId?.() ?? '';
      // Берем все скрытые колонки, кроме autoGroupColumn
      return def.hide === true && colId !== 'ag-Grid-AutoColumn';
    });

    const flatHeaderRow = [
      // Добавляем заголовки для всех скрытых колонок (группировки)
      ...hiddenColumns.map((col: any) => {
        const def = col.getColDef?.() || {};
        const text: string = (def.headerName || def.field || '').toString();
        return { v: text, t: 's' as const, s: headerStyle };
      }),
      // Добавляем остальные колонки (кроме autoGroupColumn)
      ...dataColumns.map((col: any) => {
        const def = col.getColDef?.() || {};
        const text: string = (def.headerName || def.field || '').toString();
        return { v: text, t: 's' as const, s: headerStyle };
      })
    ];

    const flatBody: any[][] = [];
    api.forEachNodeAfterFilterAndSort?.((node: any) => {
      if (node.rowPinned === 'bottom') return;
      if (node.group) return; // Пропускаем групповые строки
      
      const row: any[] = [];
      
      // Добавляем значения для всех скрытых колонок (Market, LargeGroup, GroupName)
      hiddenColumns.forEach((col: any) => {
        const field = col.getColDef?.()?.field ?? '';
        const value = node.data?.[field] ?? '';
        row.push({
          v: value,
          t: 's' as const,
        });
      });

      // Остальные колонки (без autoGroupColumn)
      dataColumns.forEach((col: any) => {
        const colId = col.getColId?.() ?? '';
        const value = node.data?.[colId] ?? null;

        if (value === null || value === undefined || value === '') {
          row.push({ v: '', t: 's' as const });
        } else if (typeof value === 'number') {
          row.push({ v: value, t: 'n' as const, s: { numFmt: '#,##0' } });
        } else {
          row.push({ v: String(value), t: 's' as const });
        }
      });

      flatBody.push(row);
    });

    // Добавляем итоговую строку в плоскую таблицу
    if (pinnedBottomNodes.length > 0) {
      const totalRow: any[] = [];
      const totalNode = pinnedBottomNodes[0];
      
      // Первая колонка - TOTAL, остальные скрытые колонки - пусто
      totalRow.push({
        v: 'TOTAL',
        t: 's' as const,
        s: { font: { bold: true }, fill: { patternType: 'solid', fgColor: { rgb: 'FFF2CC' } } },
      });
      // Остальные скрытые колонки - пусто
      for (let i = 1; i < hiddenColumns.length; i++) {
        totalRow.push({ v: '', t: 's' as const });
      }

      dataColumns.forEach((col: any) => {
        const colId = col.getColId?.() ?? '';
        const value = totalNode.data?.[colId] ?? null;

        if (value === null || value === undefined || value === '') {
          totalRow.push({ v: '', t: 's' as const });
        } else if (typeof value === 'number') {
          totalRow.push({ 
            v: value, 
            t: 'n' as const, 
            s: { font: { bold: true }, numFmt: '#,##0', fill: { patternType: 'solid', fgColor: { rgb: 'FFF2CC' } } },
          });
        } else {
          totalRow.push({ v: String(value), t: 's' as const });
        }
      });

      flatBody.push(totalRow);
    }

    const wsFlat = XLSX.utils.aoa_to_sheet([flatHeaderRow, ...flatBody]);
    wsFlat['!cols'] = [
      // Скрытые колонки
      ...hiddenColumns.map(() => ({ wch: 22 })),
      // Остальные колонки
      ...dataColumns.map(() => ({ wch: 12 })),
    ];

    // 9) Создаем workbook с двумя листами
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, wsGrouped, 'Grouped');
    XLSX.utils.book_append_sheet(wb, wsFlat, 'Flat');
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array', cellStyles: true });
    saveAs(new Blob([wbout], { type: 'application/octet-stream' }), `${fileName}.xlsx`);
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

