import { useState, useEffect } from 'react';
import { useAuth } from '../../../../context/AuthContext';

interface OrderByMarket {
  market: string;
  uncompleted_orders: number;
  plan_remaining: number;
}

interface OrdersSummaryData {
  orders_by_market: OrderByMarket[];
}

export const useOrdersSummary = () => {
  const { token } = useAuth();
  const [data, setData] = useState<OrdersSummaryData | null>(null);
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
        const response = await fetch('/api/Dashboard/OrdersSummary', {
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
        console.error('Error fetching orders summary:', err);
        setError(err instanceof Error ? err.message : 'Error loading data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [token]);

  return { data, loading, error };
};

