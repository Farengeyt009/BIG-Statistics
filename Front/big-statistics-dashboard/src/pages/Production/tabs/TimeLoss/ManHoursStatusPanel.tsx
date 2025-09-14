import React, { useEffect, useState } from 'react';

type Agg = { count: number; sum: number; min: number | null; max: number | null; avg: number };

/**
 * Custom AG Grid status panel: aggregates only the Man-hours column (field: ManHours).
 * For other columns it shows only Count (across all selected cells).
 */
const ManHoursStatusPanel: React.FC<any> = (props) => {
  const api = props?.api as any;
  const [countAll, setCountAll] = useState<number>(0);
  const [agg, setAgg] = useState<Agg>({ count: 0, sum: 0, min: null, max: null, avg: 0 });

  const recalc = () => {
    if (!api?.getCellRanges) { setCountAll(0); setAgg({ count: 0, sum: 0, min: null, max: null, avg: 0 }); return; }
    const ranges: any[] = api.getCellRanges() || [];
    let count = 0;
    let mhCount = 0;
    let sum = 0;
    let min: number | null = null;
    let max: number | null = null;

    for (const r of ranges) {
      const cols: any[] = r?.columns || [];
      const start = r?.startRow?.rowIndex ?? r?.startRowIndex ?? 0;
      const end = r?.endRow?.rowIndex ?? r?.endRowIndex ?? start;
      for (let ri = Math.min(start, end); ri <= Math.max(start, end); ri++) {
        const node = api.getDisplayedRowAtIndex?.(ri);
        if (!node) continue;
        for (const c of cols) {
          count += 1;
          const field = c?.getColDef?.()?.field || c?.colId;
          if (String(field) === 'ManHours') {
            const v = node.data?.ManHours;
            const n = Number(v);
            if (!isNaN(n) && isFinite(n)) {
              mhCount += 1;
              sum += n;
              min = (min == null) ? n : Math.min(min, n);
              max = (max == null) ? n : Math.max(max, n);
            }
          }
        }
      }
    }

    setCountAll(count);
    const avg = mhCount > 0 ? sum / mhCount : 0;
    setAgg({ count: mhCount, sum, min, max, avg });
  };

  useEffect(() => {
    if (!api) return;
    const onRange = recalc;
    const onModel = recalc;
    api.addEventListener?.('rangeSelectionChanged', onRange);
    api.addEventListener?.('modelUpdated', onModel);
    api.addEventListener?.('firstDataRendered', onModel);
    // initial
    recalc();
    return () => {
      api.removeEventListener?.('rangeSelectionChanged', onRange);
      api.removeEventListener?.('modelUpdated', onModel);
      api.removeEventListener?.('firstDataRendered', onModel);
    };
  }, [api]);

  const fmt = (n: number | null) => (n == null ? '' : new Intl.NumberFormat(undefined, { maximumFractionDigits: 3 }).format(n));

  return (
    <div style={{ display: 'flex', gap: 16, alignItems: 'center', padding: '0 8px' }}>
      <div><strong>Count</strong>: {countAll}</div>
      <div style={{ borderLeft: '1px solid #d0d7de', height: 18 }} />
      <div>Sum: {fmt(agg.sum)}</div>
      <div>Min: {fmt(agg.min)}</div>
      <div>Max: {fmt(agg.max)}</div>
      <div>Avg: {fmt(agg.avg)}</div>
    </div>
  );
};

export default ManHoursStatusPanel;



