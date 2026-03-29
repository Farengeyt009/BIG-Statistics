import React from 'react';
import { useQuery } from '@tanstack/react-query';
import MovementTable from './MovementTable';

const toYmdLocal = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

interface DefectsMovementProps {
  startDate: Date | null;
  endDate: Date | null;
}

const DefectsMovement: React.FC<DefectsMovementProps> = ({ startDate, endDate }) => {
  const { data = [], isLoading, isFetching, error } = useQuery<any[]>({
    queryKey: ['qc-defects-movement', startDate ? toYmdLocal(startDate) : null, endDate ? toYmdLocal(endDate) : null],
    enabled: Boolean(startDate && endDate),
    queryFn: async ({ signal }) => {
      const params = new URLSearchParams();
      if (startDate) params.append('date_from', toYmdLocal(startDate));
      if (endDate) params.append('date_to', toYmdLocal(endDate));
      const response = await fetch(`/api/qc/defects-movement?${params.toString()}`, { signal });
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
    <MovementTable
      data={data}
      loading={showLoader}
      error={error ? String((error as any)?.message || error) : null}
      suppressLocalLoaders={showLoader}
    />
  );
};

export default DefectsMovement;
