import { useState, useEffect } from 'react';

interface WeekData {
  week_no: number;
  month_plan: number;
  week_plan: number;
  fact: number;
}

interface ShipmentPlanData {
  month_plan: number;
  month_fact: number;
  week_plan: number;
  week_fact: number; // Факт текущей недели
  week_plan_total: number; // Сумма всех недельных планов за месяц
  weeks_data: WeekData[]; // Данные по неделям для графиков
  current_week: number;
  year: number;
  month: number;
}

const SHIPMENT_PLAN_CACHE_TTL_MS = 10000;
const shipmentPlanCache = new Map<string, { data: ShipmentPlanData; ts: number }>();
const shipmentPlanInFlight = new Map<string, Promise<ShipmentPlanData>>();

export const useShipmentPlan = () => {
  const [data, setData] = useState<ShipmentPlanData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const cacheKey = 'shipment_plan';
        const now = Date.now();
        const cached = shipmentPlanCache.get(cacheKey);
        if (cached && now - cached.ts < SHIPMENT_PLAN_CACHE_TTL_MS) {
          setData(cached.data);
          return;
        }

        const inFlight = shipmentPlanInFlight.get(cacheKey);
        if (inFlight) {
          const sharedData = await inFlight;
          setData(sharedData);
          return;
        }

        const requestPromise = fetch('/api/Dashboard/ShipmentPlan').then(async (response) => {
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          return response.json() as Promise<ShipmentPlanData>;
        });

        shipmentPlanInFlight.set(cacheKey, requestPromise);
        const result = await requestPromise;
        shipmentPlanInFlight.delete(cacheKey);
        shipmentPlanCache.set(cacheKey, { data: result, ts: Date.now() });
        setData(result);
      } catch (err) {
        shipmentPlanInFlight.delete('shipment_plan');
        console.error('Error fetching shipment plan:', err);
        setError(err instanceof Error ? err.message : 'Error loading data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  return { data, loading, error };
};

