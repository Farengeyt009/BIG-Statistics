import { useState, useEffect } from 'react';

interface MonthlyData {
  month: number;
  month_name: string;
  shipment: number;
  production_fact: number;
}

export const useRegionsMonthlyData = (year?: number) => {
  const [data, setData] = useState<MonthlyData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const url = year 
          ? `/api/Dashboard/RegionsMonthlyData?year=${year}`
          : '/api/Dashboard/RegionsMonthlyData';
        
        const response = await fetch(url);
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        setData(result);
      } catch (err) {
        console.error('Error fetching regions monthly data:', err);
        setError(err instanceof Error ? err.message : 'Error loading data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [year]);

  return { data, loading, error };
};

