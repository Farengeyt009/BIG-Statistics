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

export const useShipmentPlan = () => {
  const [data, setData] = useState<ShipmentPlanData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const response = await fetch('/api/Dashboard/ShipmentPlan');
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        setData(result);
      } catch (err) {
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

