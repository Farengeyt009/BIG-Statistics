import { useEffect, useState } from 'react';
import { API_ENDPOINTS } from '../../../../config/api';
import ShipmentStatisticsTable from './ShipmentStatisticsTable';

type Props = { fromDate: Date; toDate: Date };
type Row = Record<string, any>;

export default function Statistics({ fromDate, toDate }: Props) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const y = fromDate.getFullYear();
    const m = fromDate.getMonth() + 1;
    const ty = toDate.getFullYear();
    const tm = toDate.getMonth() + 1;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${API_ENDPOINTS.ORDERS.SHIPMENT_PLAN_FACT}?year=${y}&month=${m}&to_year=${ty}&to_month=${tm}`);
        const json = await res.json();
        const data: any[] = Array.isArray(json?.data) ? json.data : (Array.isArray(json) ? json : []);
        setRows(data);
      } catch (e: any) {
        setError(String(e?.message ?? e));
      } finally { setLoading(false); }
    };
    load();
  }, [fromDate, toDate]);

  return (
    <div className="p-2">
      <div>
        {loading && <div className="text-sm text-slate-500 mt-2">Loading…</div>}
        {error && <div className="text-sm text-red-600 mt-2">{error}</div>}
        {!loading && !error && (
          <ShipmentStatisticsTable data={rows} />
        )}
      </div>
    </div>
  );
}


