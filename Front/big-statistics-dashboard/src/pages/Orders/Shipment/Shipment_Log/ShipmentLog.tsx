import { useEffect, useState } from 'react';
import ShipmentLogTable from './ShipmentLogTable';
import { API_ENDPOINTS } from '../../../../config/api';

function toYmdLocal(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

type Props = { startDate: Date | null; endDate: Date | null; reloadToken?: number; rowsOverride?: any[] };

export default function ShipmentLog({ startDate, endDate, reloadToken, rowsOverride }: Props) {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    if (rowsOverride && Array.isArray(rowsOverride)) {
      setRows(rowsOverride);
      return;
    }
    const fetchData = async () => {
      if (!startDate || !endDate) {
        setRows([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const start = toYmdLocal(startDate);
        const end = toYmdLocal(endDate);
        const res = await fetch(`${API_ENDPOINTS.ORDERS.SHIPMENT}?start_date=${start}&end_date=${end}`);
        const json = await res.json();
        let arr: any[] = [];
        if (Array.isArray(json)) {
          arr = json;
        } else if (json && typeof json === 'object') {
          if (Array.isArray((json as any).data)) arr = (json as any).data;
          else if (Array.isArray((json as any).rows)) arr = (json as any).rows;
          else if (Array.isArray((json as any).items)) arr = (json as any).items;
          else {
            const firstArray = Object.values(json).find((v) => Array.isArray(v)) as any[] | undefined;
            if (firstArray) arr = firstArray;
          }
        }
        setRows(arr);
      } catch (e) {
        setRows([]);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [startDate, endDate, reloadToken, rowsOverride]);

  return (
    <div className="p-2">
      {loading ? (
        <div className="text-center text-gray-500 py-10">Загрузка…</div>
      ) : (
        <ShipmentLogTable rows={rows} suppressLocalLoaders={false} />
      )}
    </div>
  );
}


