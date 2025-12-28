import { useState, useEffect } from 'react';

interface TimeLossReason {
  reason_zh: string;
  reason_en: string;
  total_hours: number;
}

interface TimeLossData {
  reasons: TimeLossReason[];
  fact_time: number;
}

export const useTimeLossTopReasons = () => {
  const [data, setData] = useState<TimeLossData>({ reasons: [], fact_time: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const response = await fetch('/api/Dashboard/TimeLossTopReasons');
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        setData(result);
      } catch (err) {
        console.error('Error fetching time loss top reasons:', err);
        setError(err instanceof Error ? err.message : 'Error loading data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  return { data, loading, error };
};


