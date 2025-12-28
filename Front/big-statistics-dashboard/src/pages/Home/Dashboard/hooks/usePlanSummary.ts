import { useState, useEffect } from 'react';

interface GroupData {
  large_group: string;
  total_qty: {
    plan: number;
    fact: number;
    percentage: number;
  };
  total_time: {
    plan: number;
    fact: number;
    percentage: number;
  };
}

interface PlanSummaryData {
  groups?: GroupData[];
  total_qty: {
    plan: number;
    fact: number;
    percentage: number;
  };
  total_time: {
    plan: number;
    fact: number;
    percentage: number;
  };
}

export const usePlanSummary = () => {
  const [data, setData] = useState<PlanSummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const response = await fetch('/api/Dashboard/PlanSummary');
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        setData(result);
      } catch (err) {
        console.error('Error fetching plan summary:', err);
        setError(err instanceof Error ? err.message : 'Error loading data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  return { data, loading, error };
};

