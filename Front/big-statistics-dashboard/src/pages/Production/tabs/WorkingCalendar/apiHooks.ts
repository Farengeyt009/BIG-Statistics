import { useQuery, UseQueryResult, useMutation, useQueryClient, QueryFunctionContext } from '@tanstack/react-query';
import { API_ENDPOINTS } from '../../../../config/api';

const fetchJson = async <T>(url: string, signal?: AbortSignal): Promise<T> => {
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
};

export const useWorkshopsQuery = () => {
  return useQuery({
    queryKey: ['workshops'],
    queryFn: ({ signal }: QueryFunctionContext) => fetchJson<any>(API_ENDPOINTS.WORKING_CALENDAR.CALENDAR_WORKSHOPS, signal as AbortSignal),
    select: (json: any) => (json?.data ?? []),
  });
};

export const useCalendarQuery = (
  year: number,
  month: number,
  selectedWorkShopIds: string[]
): UseQueryResult<any> => {
  const key = ['calendar', year, month, [...selectedWorkShopIds].sort()];
  return useQuery({
    queryKey: key,
    queryFn: async ({ signal }: QueryFunctionContext) => {
      // Один запрос: без фильтра или с несколькими workShopIds
      const url = selectedWorkShopIds.length > 0
        ? `${API_ENDPOINTS.WORKING_CALENDAR.CALENDAR_DATA}?year=${year}&month=${month}&workShopIds=${encodeURIComponent(selectedWorkShopIds.join(','))}`
        : `${API_ENDPOINTS.WORKING_CALENDAR.CALENDAR_DATA}?year=${year}&month=${month}`;
      const response = await fetchJson<any>(url, signal as AbortSignal);
      return response;
    },
    select: (response: any) => response?.data ?? [],
    // Важно: сохраняем предыдущее значение данных во время рефетча,
    // чтобы сетка календаря не пустела при отменённых запросах
    keepPreviousData: true,
  });
};

export const useAssignDataQuery = (date: string | null, selectedWorkShopIds: string[]) => {
  return useQuery({
    queryKey: ['assign', 'table1', date, [...selectedWorkShopIds].sort()],
    enabled: Boolean(date),
    queryFn: ({ signal }: QueryFunctionContext) => fetchJson<any>(`${API_ENDPOINTS.WORKING_CALENDAR.ASSIGN_WORK_SCHEDULES}?date=${date}`, signal as AbortSignal),
    select: (json: any) => {
      if (!json) return json;
      if (!Array.isArray(selectedWorkShopIds) || selectedWorkShopIds.length === 0) return json;
      const ws = new Set((selectedWorkShopIds || []).map((v) => String(v)));
      return {
        ...json,
        table1: (json.table1 || []).filter((item: any) => ws.has(String(item.WorkShop_CustomWS))),
        table2: (json.table2 || []).filter((s: any) => ws.has(String(s.workshopId || s.workShopId)))
      };
    },
  });
};

export const useSavedRowsByDayQuery = (date: string | null, selectedWorkShopIds?: string[]) => {
  return useQuery({
    queryKey: ['assign', 'saved-rows', date, ...(selectedWorkShopIds ? [['ws', ...[...selectedWorkShopIds].sort()]] : [])],
    enabled: Boolean(date),
    queryFn: ({ signal }: QueryFunctionContext) => fetchJson<any>(`${API_ENDPOINTS.WORKING_CALENDAR.WORK_SCHEDULES_BY_DAY}?date=${date}`, signal as AbortSignal),
    select: (json: any) => {
      const rows = Array.isArray(json?.data) ? json.data : [];
      if (!selectedWorkShopIds || selectedWorkShopIds.length === 0) return rows;
      const ws = new Set((selectedWorkShopIds || []).map((v) => String(v)));
      return rows.filter((r: any) => ws.has(String(r.workShopId)));
    },
  });
};

export const useBulkReplaceMutation = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch(API_ENDPOINTS.WORKING_CALENDAR.WORK_SCHEDULES_BULK_REPLACE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    onSuccess: (_data: any, variables: any) => {
      const date: string = variables?.date;
      if (date) {
        qc.invalidateQueries({ queryKey: ['assign', 'saved-rows', date] });
        qc.invalidateQueries({ queryKey: ['assign', 'table1', date] });
      }
      qc.invalidateQueries({ queryKey: ['calendar'] });
    },
  });
};


