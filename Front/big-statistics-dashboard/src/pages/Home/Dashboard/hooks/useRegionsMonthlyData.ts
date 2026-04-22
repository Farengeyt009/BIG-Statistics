import { useState, useEffect } from 'react';

interface MonthlyData {
  month: number;
  month_name: string;
  shipment: number;
  production_fact: number;
}

const REGIONS_MONTHLY_CACHE_TTL_MS = 10000;
const regionsMonthlyCache = new Map<string, { data: MonthlyData[]; ts: number }>();
const regionsMonthlyInFlight = new Map<string, Promise<MonthlyData[]>>();

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

        const cacheKey = `regions_monthly:${year ?? 'default'}`;
        const now = Date.now();
        const cached = regionsMonthlyCache.get(cacheKey);
        if (cached && now - cached.ts < REGIONS_MONTHLY_CACHE_TTL_MS) {
          setData(cached.data);
          return;
        }

        const inFlight = regionsMonthlyInFlight.get(cacheKey);
        if (inFlight) {
          const sharedData = await inFlight;
          setData(sharedData);
          return;
        }

        const requestPromise = fetch(url).then(async (response) => {
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          return response.json() as Promise<MonthlyData[]>;
        });

        regionsMonthlyInFlight.set(cacheKey, requestPromise);
        const result = await requestPromise;
        regionsMonthlyInFlight.delete(cacheKey);
        regionsMonthlyCache.set(cacheKey, { data: result, ts: Date.now() });
        setData(result);
      } catch (err) {
        regionsMonthlyInFlight.delete(`regions_monthly:${year ?? 'default'}`);
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

