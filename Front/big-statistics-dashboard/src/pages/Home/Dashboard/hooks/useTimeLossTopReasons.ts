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

const TIME_LOSS_CACHE_TTL_MS = 10000;
const timeLossCache = new Map<string, { data: TimeLossData; ts: number }>();
const timeLossInFlight = new Map<string, Promise<TimeLossData>>();

export const useTimeLossTopReasons = () => {
  const [data, setData] = useState<TimeLossData>({ reasons: [], fact_time: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const cacheKey = 'time_loss_top_reasons';
        const now = Date.now();
        const cached = timeLossCache.get(cacheKey);
        if (cached && now - cached.ts < TIME_LOSS_CACHE_TTL_MS) {
          setData(cached.data);
          return;
        }

        const inFlight = timeLossInFlight.get(cacheKey);
        if (inFlight) {
          const sharedData = await inFlight;
          setData(sharedData);
          return;
        }

        const requestPromise = fetch('/api/Dashboard/TimeLossTopReasons').then(async (response) => {
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          return response.json() as Promise<TimeLossData>;
        });

        timeLossInFlight.set(cacheKey, requestPromise);
        const result = await requestPromise;
        timeLossInFlight.delete(cacheKey);
        timeLossCache.set(cacheKey, { data: result, ts: Date.now() });
        setData(result);
      } catch (err) {
        timeLossInFlight.delete('time_loss_top_reasons');
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


