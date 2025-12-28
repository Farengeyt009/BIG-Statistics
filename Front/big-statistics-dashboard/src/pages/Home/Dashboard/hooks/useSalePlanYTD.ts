import { useState, useEffect } from 'react';
import { useAuth } from '../../../../context/AuthContext';

interface YTDByMarket {
  market: string;
  ytd_plan: number;
  ytd_fact: number;
  ytd_diff: number;
}

interface SalePlanYTDData {
  ytd_by_market: YTDByMarket[];
}

export const useSalePlanYTD = () => {
  const { token } = useAuth();
  const [data, setData] = useState<SalePlanYTDData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const response = await fetch('/api/Dashboard/SalePlanYTD', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        setData(result);
      } catch (err) {
        console.error('Error fetching sale plan YTD:', err);
        setError(err instanceof Error ? err.message : 'Error loading data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [token]);

  return { data, loading, error };
};

