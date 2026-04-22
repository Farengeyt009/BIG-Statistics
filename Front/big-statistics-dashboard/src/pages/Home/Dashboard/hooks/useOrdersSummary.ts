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

const ORDERS_SUMMARY_CACHE_TTL_MS = 10000;
const ordersSummaryCache = new Map<string, { data: OrdersSummaryData; ts: number }>();
const ordersSummaryInFlight = new Map<string, Promise<OrdersSummaryData>>();

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
        const cacheKey = `orders_summary:${token}`;
        const now = Date.now();
        const cached = ordersSummaryCache.get(cacheKey);
        if (cached && now - cached.ts < ORDERS_SUMMARY_CACHE_TTL_MS) {
          setData(cached.data);
          return;
        }

        const inFlight = ordersSummaryInFlight.get(cacheKey);
        if (inFlight) {
          const sharedData = await inFlight;
          setData(sharedData);
          return;
        }

        const requestPromise = fetch('/api/Dashboard/OrdersSummary', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }).then(async (response) => {
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          return response.json() as Promise<OrdersSummaryData>;
        });

        ordersSummaryInFlight.set(cacheKey, requestPromise);
        const result = await requestPromise;
        ordersSummaryInFlight.delete(cacheKey);
        ordersSummaryCache.set(cacheKey, { data: result, ts: Date.now() });
        setData(result);
      } catch (err) {
        ordersSummaryInFlight.delete(`orders_summary:${token}`);
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

