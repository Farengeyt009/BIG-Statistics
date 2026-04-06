import React from 'react';
import { useQuery } from '@tanstack/react-query';
import PlasticWastesTable from './PlasticWastesTable';

interface Props {
  startDate: Date | null;
  endDate: Date | null;
}

const toYmd = (d: Date) => {
  const y  = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${mo}-${dd}`;
};

const PlasticWastes: React.FC<Props> = ({ startDate, endDate }) => {
  const dateFrom = startDate ? toYmd(startDate) : undefined;
  const dateTo   = endDate   ? toYmd(endDate)   : undefined;

  const { data, isLoading, error } = useQuery({
    queryKey: ['plastic-wastes', dateFrom, dateTo],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (dateFrom) params.set('date_from', dateFrom);
      if (dateTo)   params.set('date_to',   dateTo);
      const res = await fetch(`/api/qc/plastic-wastes?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Unknown error');
      return json.data as any[];
    },
    staleTime: 5 * 60 * 1000,
  });

  return (
    <PlasticWastesTable
      data={data ?? []}
      loading={isLoading}
      error={error ? String(error) : null}
      suppressLocalLoaders={isLoading}
    />
  );
};

export default PlasticWastes;
