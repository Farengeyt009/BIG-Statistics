import { useEffect, useState, useLayoutEffect, useRef } from 'react';
import ShipmentLogTable from './ShipmentLogTable';
import { API_ENDPOINTS } from '../../../../config/api';
import LoadingSpinner from '../../../../components/ui/LoadingSpinner';

function toYmdLocal(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

type Props = { 
  startDate: Date | null; 
  endDate: Date | null; 
  reloadToken?: number; 
  rowsOverride?: any[];
  onOpenFilterModal?: () => void;
};

export default function ShipmentLog({ startDate, endDate, reloadToken, rowsOverride, onOpenFilterModal }: Props) {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true); // Инициализируем как true, чтобы сразу показать спиннер
  const [isReadyToShow, setIsReadyToShow] = useState(false);
  const renderTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (rowsOverride && Array.isArray(rowsOverride)) {
      setRows(rowsOverride);
      setLoading(false);
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
      <div className="p-2">
        <LoadingSpinner overlay="screen" size="xl" />
      </div>
    );
  }

  return (
    <div className="p-2">
      <ShipmentLogTable rows={rows} suppressLocalLoaders={false} onOpenFilterModal={onOpenFilterModal} />
    </div>
  );
}


