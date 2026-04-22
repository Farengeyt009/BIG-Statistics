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

const PLAN_SUMMARY_CACHE_TTL_MS = 10000;
const planSummaryCache = new Map<string, { data: PlanSummaryData; ts: number }>();
const planSummaryInFlight = new Map<string, Promise<PlanSummaryData>>();

export const usePlanSummary = () => {
  const [data, setData] = useState<PlanSummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const cacheKey = 'plan_summary';
        const now = Date.now();
        const cached = planSummaryCache.get(cacheKey);
        if (cached && now - cached.ts < PLAN_SUMMARY_CACHE_TTL_MS) {
          setData(cached.data);
          return;
        }

        const inFlight = planSummaryInFlight.get(cacheKey);
        if (inFlight) {
          const sharedData = await inFlight;
          setData(sharedData);
          return;
        }

        const requestPromise = fetch('/api/Dashboard/PlanSummary').then(async (response) => {
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          return response.json() as Promise<PlanSummaryData>;
        });

        planSummaryInFlight.set(cacheKey, requestPromise);
        const result = await requestPromise;
        planSummaryInFlight.delete(cacheKey);
        planSummaryCache.set(cacheKey, { data: result, ts: Date.now() });
        setData(result);
      } catch (err) {
        planSummaryInFlight.delete('plan_summary');
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

