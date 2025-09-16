import React, { useState, useCallback, useEffect, useMemo, useRef, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { AgGridReact } from '@ag-grid-community/react';
import type { ColDef, GridApi, GridReadyEvent } from '@ag-grid-community/core';
import '@ag-grid-community/styles/ag-grid.css';
import '@ag-grid-community/styles/ag-theme-quartz.css';
import './ag-grid-overrides.css';
import { useTranslation } from 'react-i18next';
import productionTranslations from '../../ProductionTranslation.json';
import AgGridExportButton from '../../../../components/AgGrid/ExportButton';
import FocusModeToggle from '../../../../components/focus/FocusModeToggle';
import LoadingSpinner from '../../../../components/ui/LoadingSpinner';

// Форматтер для отображения чисел как целых (0 знаков после запятой)
const fmtInt = new Intl.NumberFormat('ru-RU', {
  maximumFractionDigits: 0,
  minimumFractionDigits: 0,
});

interface AgGridTableProps {
  data: any[];
  loading: boolean;
  error: string | null;
  onTableReady?: (api: any) => void;
  suppressLocalLoaders?: boolean;
}

const AgGridTable: React.FC<AgGridTableProps> = ({
  data,
  loading,
  error,
  onTableReady,
  suppressLocalLoaders
}) => {
  const { t, i18n } = useTranslation('production');
  const currentLanguage = i18n.language as 'en' | 'zh';
  const [gridApi, setGridApi] = useState<any | null>(null);
  const gridWrapperRef = useRef<HTMLDivElement | null>(null);
  const [gridHeightPx, setGridHeightPx] = useState<number | null>(null);


  // Refs для работы с копированием
  const apiRef = useRef<any>(null);
  const copied = useRef<Set<string>>(new Set());

  // Helper: ключ ячейки всегда строим по node.id
  const getCellKey = (node: any, field: string) => `${node.id}|${field}`;

  // getRowId просто возвращает __rid из данных
  const getRowId = useCallback((p: any) => p.data.__rid, []);

  // Helper: нормализуем дату в ISO YYYY-MM-DD
  const toIsoYmd = (s: any): string => {
    if (!s) return '';
    const str = String(s).trim();
    // DD.MM.YYYY -> YYYY-MM-DD
    const m1 = str.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
    if (m1) return `${m1[3]}-${m1[2]}-${m1[1]}`;
    // YYYY-MM-DD (ok)
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
    // fallback parse
    const d = new Date(str);
    return isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
  };

  // --- добавим подписи месяцев с локалью
  const monthLabel = useCallback((mm: string) => {
    const i = Math.max(0, Math.min(11, parseInt(mm, 10) - 1));
    const names = {
      en: ['January','February','March','April','May','June','July','August','September','October','November','December'],
      ru: ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'],
      zh: ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'],
    } as const;
    const set = names[currentLanguage] ?? names.en;
    // Только название месяца (без числового префикса)
    return set[i];
  }, [currentLanguage]);

  // Функция для копирования выделенных ячеек в буфер обмена
  const markCopied = useCallback((api: any) => {
    if (!api?.getCellRanges) return;

    const ranges = api.getCellRanges?.() || [];
    const set = new Set<string>();

    // Собираем данные для копирования
    const clipboardData: string[][] = [];

    for (const r of ranges) {
      const cols = r.columns || [];
      const start = Math.min(r.startRow.rowIndex, r.endRow.rowIndex);
      const end = Math.max(r.startRow.rowIndex, r.endRow.rowIndex);

      for (let i = start; i <= end; i++) {
        const node = api.getDisplayedRowAtIndex(i);
        if (!node?.data) continue;

        const rowData: string[] = [];
        cols.forEach((c: any) => {
          const field = c.getColDef().field;
          const value = node.data[field];
          rowData.push(String(value ?? ''));

          // Используем единый ключ по node.id
          set.add(getCellKey(node, field));
        });

        if (rowData.length > 0) {
          clipboardData.push(rowData);
        }
      }
    }

    // Копируем данные в буфер обмена
    if (clipboardData.length > 0) {
      const tsvData = clipboardData.map(row => row.join('\t')).join('\n');

      try {
        navigator.clipboard.writeText(tsvData);
      } catch (error) {
        // Fallback для старых браузеров
        const textArea = document.createElement('textarea');
        textArea.value = tsvData;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
    }

    copied.current = set;
    api.refreshCells?.({ force: true, suppressFlash: true });
  }, []);

  /** -------------------- хелпер для преобразования текста в одну строку -------------------- */
  const toSingleLine = (s: string) =>
    s.replace(/\r?\n/g, ' ').replace(/\s+/g, ' ').trim();

  /** -------------------- функция перевода названий цехов -------------------- */
  const translateWorkShop = (workShopName: string) => {
    if (!workShopName) return workShopName;

    const trimmedName = workShopName.trim();

    // Пытаемся найти точное совпадение
    let translation = productionTranslations[currentLanguage]?.workshops?.[trimmedName as keyof typeof productionTranslations.en.workshops];

    // Если не найдено, ищем без учета регистра
    if (!translation) {
      const workshops = productionTranslations[currentLanguage]?.workshops;
      if (workshops) {
        const key = Object.keys(workshops).find(k => k.toLowerCase() === trimmedName.toLowerCase());
        if (key) {
          translation = workshops[key as keyof typeof workshops];
        }
      }
    }

    return toSingleLine(translation ? translation : trimmedName);
  };

  /** -------------------- функция перевода названий рабочих центров -------------------- */
  const translateWorkCenter = (workCenterName: string) => {
    if (!workCenterName) return workCenterName;

    const trimmedName = workCenterName.trim();

    // Пытаемся найти точное совпадение
    let translation = productionTranslations[currentLanguage]?.workCenters?.[trimmedName as keyof typeof productionTranslations.en.workCenters];

    // Если не найдено, ищем без учета регистра
    if (!translation) {
      const workCenters = productionTranslations[currentLanguage]?.workCenters;
      if (workCenters) {
        const key = Object.keys(workCenters).find(k => k.toLowerCase() === trimmedName.toLowerCase());
        if (key) {
          translation = workCenters[key as keyof typeof workCenters];
        }
      }
    }

    return toSingleLine(translation ? translation : trimmedName);
  };

  // Обработка данных: храним исходные числа, считаем разницы по "сырым" значениям
  const processedData = useMemo(() => {
    const toNum = (v: any) =>
      v === '' || v === null || v === undefined ? null : Number(v);

    return data.map((row, i) => {
      const planQty  = toNum(row.Plan_QTY)  ?? 0;
      const factQty  = toNum(row.FACT_QTY)  ?? 0;
      const planTime = toNum(row.Plan_TIME) ?? 0;
      const factTime = toNum(row.FACT_TIME) ?? 0;
      
      const differentQty = factQty - planQty;
      const differentTime = factTime - planTime;

      // формируем ID только из "сырьевых" полей + индекс, чтобы гарантировать уникальность
      const rawId = [
        row.OnlyDate,
        row.WorkShopName_CH,
        row.WorkCenterGroup_CN,
        row.OrderNumber,
        row.NomenclatureNumber,
        i,                      // гарантирует уникальность даже при полных дублях
      ].map(v => String(v ?? '').replace(/\|/g, '%7C')).join('|');

      const onlyDateISO = toIsoYmd(row.OnlyDate);

      return {
        ...row,
        __rid: rawId,           // <-- уникальный ключ
        OnlyDate: row.OnlyDate,      // как показываем (DD.MM.YYYY)
        OnlyDateISO: onlyDateISO,    // как фильтруем/группируем (YYYY-MM-DD)
        WorkShopName_CH: translateWorkShop(row.WorkShopName_CH),
        WorkCenterGroup_CN: translateWorkCenter(row.WorkCenterGroup_CN),
        ProductName_CN: row.ProductName_CN && row.ProductName_CN.length > 30
          ? row.ProductName_CN.substring(0, 30) + '...'
          : row.ProductName_CN,
        Plan_QTY: planQty,
        FACT_QTY: factQty,
        Plan_TIME: planTime,
        FACT_TIME: factTime,
        Different_QTY: differentQty,
        Different_TIME: differentTime
      };
    });
  }, [data, currentLanguage, toIsoYmd]);

  // После загрузки данных «подтолкнуть» фильтр (только при изменении длины данных)
  useEffect(() => {
    if (!gridApi || !processedData.length) return;
    gridApi.refreshClientSideRowModel('filter'); // пересчитать модель фильтра
    // если когда-то открывали фильтр — закрыть/сбросить его кэш:
    gridApi.getFilterInstance('OnlyDate', (inst: any) => inst?.refreshFilterValues?.());
    gridApi.getFilterInstance('WorkShopName_CH', (inst: any) => inst?.refreshFilterValues?.());
    gridApi.getFilterInstance('WorkCenterGroup_CN', (inst: any) => inst?.refreshFilterValues?.());
  }, [gridApi, processedData.length]); // только при изменении количества строк

  // Авторасчёт высоты в фокус-режиме
  useLayoutEffect(() => {
    const compute = () => {
      const el = gridWrapperRef.current;
      if (!el) return;
      const isFocus = typeof document !== 'undefined' && document.body.classList.contains('app-focus');
      if (!isFocus) { setGridHeightPx(null); return; }        // обычный режим — дефолтная высота
      const top = el.getBoundingClientRect().top;
      const h = Math.max(200, Math.floor(window.innerHeight - top - 8)); // небольшой нижний отступ
      setGridHeightPx(h);
      // подправим колонки, если надо
      try { gridApi?.sizeColumnsToFit?.(); } catch {}
    };

    compute();
    window.addEventListener('resize', compute);

    // отслеживаем переключение класса на body (вкл/выкл фокуса)
    const obs = new MutationObserver(compute);
    if (typeof document !== 'undefined') {
      obs.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    }
    return () => { window.removeEventListener('resize', compute); obs.disconnect(); };
  }, [gridApi]);

  // Передаем ссылку на grid API в родительский компонент
  useEffect(() => {
    if (gridApi && onTableReady) {
      onTableReady(gridApi);
    }
  }, [gridApi, onTableReady]);

  // Определение колонок для AG Grid
  const columnDefs: ColDef[] = useMemo(() => [
    {
      field: 'OnlyDate',                    // показываем DD.MM.YYYY как есть
      headerName: t('tableHeaders.date'),
      minWidth: 90,
      maxWidth: 150,
      cellClass: 'text-center',
      filter: 'agSetColumnFilter',
      filterParams: {
        treeList: true as any,
        includeBlanksInFilter: true,
        refreshValuesOnOpen: true,
        // ключ фильтра = ISO-значение строки
        keyCreator: (p: any) => String(p?.data?.OnlyDateISO ?? ''),
        // значения — из отфильтрованных строк (каскадные фильтры)
        values: (params: any) => {
          const set = new Set<string>();
          params.api.forEachNodeAfterFilter((node: any) => {
            const v = node?.data?.OnlyDateISO;
            if (v) set.add(v);
          });
          params.success(Array.from(set).sort()); // ISO сортируется хронологически
        },
        // путь Год → "Месяц" → День
        treeListPathGetter: (value: any) => {
          const s = String(value ?? '').trim();                 // value = 'YYYY-MM-DD'
          const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
          if (!m) return null;
          const [, y, mm, dd] = m;
          return [y, monthLabel(mm), dd];
        },
        // отображаем подпись листа (день) как DD.MM.YYYY
        valueFormatter: (p: any) => {
          const s = String(p.value ?? '');
          const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
          return m ? `${m[3]}.${m[2]}.${m[1]}` : s;
        },
      },
    },
    {
      field: 'WorkShopName_CH',
      headerName: t('tableHeaders.workShop'),
      minWidth: 90, maxWidth: 200,
      tooltipField: 'WorkShopName_CH',
      filter: 'agSetColumnFilter',
      filterParams: {
        includeBlanksInFilter: true,
        refreshValuesOnOpen: true,
        values: (params: any) => {
          const set = new Set<string>();
          params.api.forEachNodeAfterFilter((node: any) => {
            const v = (node?.data?.WorkShopName_CH || '').trim();
            if (v) set.add(v);
          });
          params.success(Array.from(set).sort((a, b) => a.localeCompare(b)));
        },
      },
    },
    {
      field: 'WorkCenterGroup_CN',
      headerName: t('tableHeaders.workCenterGroup'),
      minWidth: 90, maxWidth: 200,
      tooltipField: 'WorkCenterGroup_CN',
      filter: 'agSetColumnFilter',
      filterParams: {
        includeBlanksInFilter: true,
        refreshValuesOnOpen: true,
        values: (params: any) => {
          const set = new Set<string>();
          params.api.forEachNodeAfterFilter((node: any) => {
            const v = (node?.data?.WorkCenterGroup_CN || '').trim();
            if (v) set.add(v);
          });
          params.success(Array.from(set).sort((a, b) => a.localeCompare(b)));
        },
      },
    },
    {
      field: 'OrderNumber',
      headerName: t('tableHeaders.orderNumber'),
      minWidth: 90,
      maxWidth: 150
    },
    {
      field: 'NomenclatureNumber',
      headerName: t('tableHeaders.nomenclature'),
      minWidth: 90,
      maxWidth: 150
    },
    {
      field: 'ProductName_CN',
      headerName: t('tableHeaders.productName'),
      minWidth: 120,
      maxWidth: 300,
      tooltipValueGetter: (params) => {
        const originalValue = data.find(row => row.ProductName_CN === params.value)?.ProductName_CN || params.value;
        return originalValue;
      }
    },
    {
      field: 'Plan_QTY',
      headerName: t('tableHeaders.planQty'),
      minWidth: 80,
      maxWidth: 120,
      cellClass: 'text-center',
      cellDataType: 'number',
      valueFormatter: (params) => params.value != null ? fmtInt.format(params.value) : ''
    },
    {
      field: 'FACT_QTY',
      headerName: t('tableHeaders.factQty'),
      minWidth: 80,
      maxWidth: 120,
      cellClass: 'text-center',
      cellDataType: 'number',
      valueFormatter: (params) => params.value != null ? fmtInt.format(params.value) : ''
    },
    {
      field: 'Different_QTY',
      headerName: t('tableHeaders.differentQty'),
      minWidth: 80,
      maxWidth: 120,
      cellClass: (params) => {
        const value = params.value;
        if (value > 0) return 'text-green-600 text-center';
        if (value < 0) return 'text-red-600 text-center';
        return 'text-gray-600 text-center';
      },
      cellDataType: 'number',
      valueFormatter: (params) => {
        const value = params.value;
        if (value > 0) return '+' + fmtInt.format(value);
        return value != null ? fmtInt.format(value) : '';
      }
    },
    {
      field: 'Plan_TIME',
      headerName: t('tableHeaders.planTime'),
      minWidth: 100,
      maxWidth: 140,
      cellClass: 'text-center',
      cellDataType: 'number',
      valueFormatter: (params) => {
        const value = params.value;
        return value != null ? fmtInt.format(value) : '';
      }
    },
    {
      field: 'FACT_TIME',
      headerName: t('tableHeaders.factTime'),
      minWidth: 100,
      maxWidth: 140,
      cellClass: 'text-center',
      cellDataType: 'number',
      valueFormatter: (params) => {
        const value = params.value;
        return value != null ? fmtInt.format(value) : '';
      }
    },
    {
      field: 'Different_TIME',
      headerName: t('tableHeaders.differentTime'),
      minWidth: 100,
      maxWidth: 140,
      cellClass: (params) => {
        const value = params.value;
        if (value > 0) return 'text-green-600 text-center';
        if (value < 0) return 'text-red-600 text-center';
        return 'text-gray-600 text-center';
      },
      cellDataType: 'number',
      valueFormatter: (params) => {
        const value = params.value;
        if (value > 0) return '+' + fmtInt.format(value);
        return value != null ? fmtInt.format(value) : '';
      }
    }
  ], [t, monthLabel]);

  // Настройки AG Grid
  const defaultColDef: ColDef = {
    resizable: true,
    sortable: true,
    filter: true,
    cellClassRules: {
      'copied-cell': (params: any) =>
        params?.node && params?.colDef?.field
          ? copied.current.has(getCellKey(params.node, params.colDef.field))
          : false
    }
  };

  const onGridReady = (params: any) => {
    apiRef.current = params.api;
    setGridApi(params.api);
  };

  const onFirstDataRendered = (params: any) => {
    // Автоматическая подгонка ширины столбцов при первой загрузке данных
    params.api.sizeColumnsToFit();
  };

  // Функция для отправки данных в буфер обмена
  const sendToClipboard = useCallback(() => {
    markCopied(apiRef.current);
  }, [markCopied]);

  // Обработчик клавиш для копирования
  const onCellKeyDown = useCallback((e: any) => {
    const ke = e.event as KeyboardEvent;
    if ((ke.ctrlKey || ke.metaKey) && String(ke.key).toLowerCase() === 'c') {
      markCopied(e.api);
      return;
    }
    if (String(ke.key) === 'Escape') {
      if (copied.current.size) {
        copied.current.clear();
        e.api.refreshCells?.({ force: true, suppressFlash: true });
      }
    }
  }, [markCopied]);

  // Обработчик двойного клика для сброса выделения
  const onCellDoubleClicked = useCallback(() => {
    if (copied.current.size) {
      copied.current.clear();
      gridApi?.refreshCells?.({ force: true, suppressFlash: true });
    }
  }, [gridApi]);

  // Стратегия автоматического определения ширины столбцов
  const autoSizeStrategy = {
    type: 'fitGridWidth' as const
  };

  // Обработчик изменения размера окна для автоматической подгонки ширины столбцов
  useEffect(() => {
    const handleResize = () => {
      if (gridApi) {
        gridApi.sizeColumnsToFit();
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [gridApi]);

  // Панель действий (экспорт и полноэкранный режим)
  const actions = (
    <div className="flex items-center gap-2">
      <AgGridExportButton
        api={gridApi}
        fileName="daily_plan_fact"
        variant="icon"
      />
      <FocusModeToggle variant="dark" />
    </div>
  );

  // Слот для рендеринга действий
  const actionsSlot =
    typeof document !== 'undefined'
      ? document.getElementById('dpf-actions-slot')
      : null;

  // ПЕРВИЧНАЯ ЗАГРУЗКА: ничего не показываем, глобальный спиннер уже есть
  if (loading && suppressLocalLoaders) {
    return <div className="ag-theme-quartz" style={{ width: '100%', height: '78vh' }} />;
  }

  // Если хотите оставить локальный спиннер только когда глобальный отключен:
  if (loading && !suppressLocalLoaders) {
    return (
      <div className="flex justify-center items-center h-96 bg-white rounded">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  // Показываем ошибку
  if (error) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-lg text-red-600">
          Ошибка загрузки данных: {error}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Если слот есть — рендерим туда, иначе показываем сверху справа */}
      {actionsSlot
        ? createPortal(actions, actionsSlot)
        : <div className="flex items-center justify-end">{actions}</div>}

      <div
        ref={gridWrapperRef}
        data-grid="daily-plan-fact"
        className="ag-theme-quartz"
        style={{ width: '100%', height: gridHeightPx != null ? `${gridHeightPx}px` : '78vh' }}
      >
        <AgGridReact
          rowData={processedData}
          columnDefs={columnDefs}
          defaultColDef={defaultColDef}
          autoSizeStrategy={autoSizeStrategy}
          onGridReady={onGridReady}
          onFirstDataRendered={onFirstDataRendered}
          onGridSizeChanged={(p) => p.api.sizeColumnsToFit()} // подгоняем колонки при изменении контейнера
          animateRows={false}
          cellSelection={true}
          suppressCopyRowsToClipboard={false}
          rowSelection="multiple"
          getRowId={getRowId}
          sendToClipboard={sendToClipboard}
          onCellKeyDown={onCellKeyDown}
          onCellDoubleClicked={onCellDoubleClicked}
          suppressDragLeaveHidesColumns={true}
          statusBar={{
            statusPanels: [{ statusPanel: 'agAggregationComponent', align: 'left' }],
          }}
          context={{ gridName: 'daily-plan-fact' }}
        />
      </div>
    </div>
  );
};

export default AgGridTable;
