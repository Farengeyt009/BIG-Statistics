import { useEffect, useState, useLayoutEffect, useRef } from 'react';
import { API_ENDPOINTS } from '../../../../config/api';
import ShipmentStatisticsTable from './ShipmentStatisticsTable';
import LoadingSpinner from '../../../../components/ui/LoadingSpinner';

type Props = { fromDate: Date; toDate: Date };
type Row = Record<string, any>;

export default function Statistics({ fromDate, toDate }: Props) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true); // Инициализируем как true, чтобы сразу показать спиннер
  const [error, setError] = useState<string | null>(null);
  const [isReadyToShow, setIsReadyToShow] = useState(false);
  const renderTimeoutRef = useRef<number | null>(null);

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

  // После загрузки всех данных ждем завершения рендеринга
  useLayoutEffect(() => {
    if (loading) {
      setIsReadyToShow(false);
      if (renderTimeoutRef.current) {
        clearTimeout(renderTimeoutRef.current);
      }
      return;
    }

    if (renderTimeoutRef.current) {
      clearTimeout(renderTimeoutRef.current);
    }

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        renderTimeoutRef.current = setTimeout(() => {
          setIsReadyToShow(true);
        }, 100);
      });
    });

    return () => {
      if (renderTimeoutRef.current) {
        clearTimeout(renderTimeoutRef.current);
      }
    };
  }, [loading]);

  // Показываем только спиннер при загрузке или рендеринге
  if (loading || !isReadyToShow) {
    return (
      <div className="w-full">
        <LoadingSpinner overlay="screen" size="xl" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full">
        <div className="text-sm text-red-600 mt-2">{error}</div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <ShipmentStatisticsTable data={rows} />
    </div>
  );
}


