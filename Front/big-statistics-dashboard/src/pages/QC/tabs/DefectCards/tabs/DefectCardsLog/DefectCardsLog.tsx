import React from 'react';
import { useQuery } from '@tanstack/react-query';
import LogTable from './LogTable';

const toYmdLocal = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

interface DefectCardsLogProps {
  startDate: Date | null;
  endDate: Date | null;
}

const DefectCardsLog: React.FC<DefectCardsLogProps> = ({ startDate, endDate }) => {
  const { data = [], isLoading, isFetching, error } = useQuery<any[]>({
    queryKey: ['qc-defect-cards', startDate ? toYmdLocal(startDate) : null, endDate ? toYmdLocal(endDate) : null],
    enabled: Boolean(startDate && endDate),
    queryFn: async ({ signal }) => {
      const params = new URLSearchParams();
      if (startDate) params.append('date_from', toYmdLocal(startDate));
      if (endDate) params.append('date_to', toYmdLocal(endDate));
      const response = await fetch(`/api/qc/defect-cards?${params.toString()}`, { signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const result = await response.json();
      return result?.data || [];
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const showLoader = isLoading || isFetching;

  return (
    <LogTable
      data={data}
      loading={showLoader}
      error={error ? String((error as any)?.message || error) : null}
      suppressLocalLoaders={showLoader}
    />
  );
};

export default DefectCardsLog;
