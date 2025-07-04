import React, { useEffect, useRef, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { DataTable } from '../../../components/DataTable/DataTable';
import { NUMERIC_KEYS } from '../utils/CustomTableBuilder/numericFields';

/* ------------------ порядок отображения ------------------ */
const columnsOrder = [
  'OrderDate',
  'OrderConformDay',
  'RunOrderDay',
  'OrderShipmentDay_Svod',
  'Market',
  'Prod_Group',
  'Order_No',
  'Article_number',
  'Name_CN',
  'Order_QTY',
  'FACT_QTY',
  'Uncompleted_QTY',
  'Delay',
];

// Мультиязычные заголовки колонок
function useColumnsOverrides(t: (key: string) => string): Record<string, { header: string }> {
  return useMemo(() => {
    const overrides: Record<string, { header: string }> = {};
    columnsOrder.forEach((key) => {
      overrides[key] = { header: t(`tableHeaders.${key}`) };
    });
    return overrides;
  }, [t]);
}

interface MainTableTabProps {
  data: any[];
  onTableReady?: (table: any) => void;
}

/* --------- подсветка строк, где Delay не пустой --------- */
function highlightRows(container: HTMLElement) {
  const delayIdx = columnsOrder.indexOf('Delay');
  if (delayIdx === -1) return;

  container.querySelectorAll<HTMLTableRowElement>('tbody tr').forEach((tr) => {
    const cell = tr.cells[delayIdx];
    if (!cell) return;

    const txt = cell.textContent?.trim() ?? '';
    tr.style.backgroundColor = txt && txt !== '0' ? '#FEE2E2' : '';
  });
}

const MainTableTab: React.FC<MainTableTabProps> = ({ data, onTableReady }) => {
  const { t } = useTranslation('ordersTranslation');
  const columnsOverrides = useColumnsOverrides(t);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const handleTableReady = useCallback(
    (table: any) => {
      if (wrapperRef.current) highlightRows(wrapperRef.current);
      onTableReady?.(table);
    },
    [onTableReady],
  );

  useEffect(() => {
    const t = setTimeout(() => {
      if (wrapperRef.current) highlightRows(wrapperRef.current);
    }, 0);
    return () => clearTimeout(t);
  }, [data]);

  return (
    <div
      ref={wrapperRef}
      style={{
        zoom: 0.98,
        transform: 'scale(1)',  // fallback для Firefox
        transformOrigin: 'top left',
        width: '105%',
        height: '105%',
      }}
    >
      <DataTable
        data={data}
        columnsOverrides={columnsOverrides}
        columnsOrder={columnsOrder}
        numericKeys={NUMERIC_KEYS}        /* ← передаём список числовых полей */
        onTableReady={handleTableReady}
      />
    </div>
  );
};

export default MainTableTab;
