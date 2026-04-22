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

const SALE_PLAN_YTD_CACHE_TTL_MS = 10000;
const salePlanYtdCache = new Map<string, { data: SalePlanYTDData; ts: number }>();
const salePlanYtdInFlight = new Map<string, Promise<SalePlanYTDData>>();

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
        const cacheKey = `sale_plan_ytd:${token}`;
        const now = Date.now();
        const cached = salePlanYtdCache.get(cacheKey);
        if (cached && now - cached.ts < SALE_PLAN_YTD_CACHE_TTL_MS) {
          setData(cached.data);
          return;
        }

        const inFlight = salePlanYtdInFlight.get(cacheKey);
        if (inFlight) {
          const sharedData = await inFlight;
          setData(sharedData);
          return;
        }

        const requestPromise = fetch('/api/Dashboard/SalePlanYTD', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }).then(async (response) => {
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          return response.json() as Promise<SalePlanYTDData>;
        });

        salePlanYtdInFlight.set(cacheKey, requestPromise);
        const result = await requestPromise;
        salePlanYtdInFlight.delete(cacheKey);
        salePlanYtdCache.set(cacheKey, { data: result, ts: Date.now() });
        setData(result);
      } catch (err) {
        salePlanYtdInFlight.delete(`sale_plan_ytd:${token}`);
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

