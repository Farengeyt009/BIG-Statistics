import { useEffect, useState } from 'react';
import { API_ENDPOINTS } from '../../../../config/api';
import ShipmentPlanFactTable from './ShipmentPlanFactTable';
import { YearMonthPicker } from '../../../../components/DatePicker';
import { useTranslation } from 'react-i18next';

type Row = Record<string, any>;

type Props = { fromDate: Date; toDate: Date };

export default function ShipmentPlanFact({ fromDate, toDate }: Props) {
  const { i18n } = useTranslation('ordersTranslation');
  const currentLanguage = (i18n.language as 'en' | 'zh' | 'ru') || 'en';
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const y = fromDate.getFullYear();
    const m = fromDate.getMonth() + 1;
    const ty = toDate.getFullYear();
    const tm = toDate.getMonth() + 1;
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${API_ENDPOINTS.ORDERS.SHIPMENT_PLAN_FACT}?year=${y}&month=${m}&to_year=${ty}&to_month=${tm}`);
        const json = await res.json();
        const data = Array.isArray(json?.data) ? json.data : Array.isArray(json) ? json : [];
        setRows(data);
      } catch (e: any) {
        setError(String(e?.message ?? e));
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [fromDate, toDate]);

  return (
    <div className="p-2">
      {/* Контролы выбора вынесены в родителя и стоят в одну линию с табами */}

      {loading && <div className="text-slate-500 text-sm">Loading…</div>}
      {error && <div className="text-red-600 text-sm">{error}</div>}
      {!loading && !error && (
        <ShipmentPlanFactTable year={fromDate.getFullYear()} month={fromDate.getMonth() + 1} toYear={toDate.getFullYear()} toMonth={toDate.getMonth() + 1} />
      )}
    </div>
  );
}


