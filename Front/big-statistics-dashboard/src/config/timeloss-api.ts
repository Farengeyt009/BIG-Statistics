import { API_BASE_URL } from './api';
import { TimeLossRow } from '../pages/Production/tabs/TimeLoss/TimeLossTable';

const BASE_URL = `${API_BASE_URL}/timeloss`;

export async function apiGetRows(date: string): Promise<TimeLossRow[]> {
  const r = await fetch(`${BASE_URL}/entries?date=${encodeURIComponent(date)}`);
  if (!r.ok) {
    const error = await r.json();
    throw new Error(error.error || error.message || 'Failed to load entries');
  }
  return r.json();
}

export async function apiGetRowsRange(startDate: string, endDate: string): Promise<TimeLossRow[]> {
  const params = new URLSearchParams({ startDate, endDate });
  const r = await fetch(`${BASE_URL}/entries?${params.toString()}`);
  if (!r.ok) {
    const error = await r.json();
    throw new Error(error.error || error.message || 'Failed to load entries');
  }
  return r.json();
}

export async function apiGetRowsRangeWithLimit(startDate: string, endDate: string, limit: number, extra?: { workshop?: string; workcenter?: string }): Promise<TimeLossRow[]> {
  const params = new URLSearchParams({ startDate, endDate, limit: String(limit) });
  if (extra?.workshop) params.set('workshop', extra.workshop);
  if (extra?.workcenter) params.set('workcenter', extra.workcenter);
  const r = await fetch(`${BASE_URL}/entries?${params.toString()}`);
  if (!r.ok) {
    const error = await r.json();
    throw new Error(error.error || error.message || 'Failed to load entries');
  }
  return r.json();
}

export async function apiGetDicts() {
  const r = await fetch(`${BASE_URL}/dicts`);
  if (!r.ok) {
    const error = await r.json();
    throw new Error(error.error || error.message || 'Failed to load dictionaries');
  }
  return r.json();
}

// Daily Staffing
export type DailyStaffingRow = {
  OnlyDate: string;
  WorkShopID: string;
  WorkCenterID: string;
  People: number | null;
  WorkHours: number | null;
  PeopleWorkHours: number | null;
  EntryManHours: number | null;
  WorkShopName_ZH?: string | null;
  WorkShopName_EN?: string | null;
  WorkCenterName_ZH?: string | null;
  WorkCenterName_EN?: string | null;
};

export async function apiGetDailyStaffing(dateFrom: string, dateTo: string): Promise<DailyStaffingRow[]> {
  const params = new URLSearchParams({ date_from: dateFrom, date_to: dateTo });
  const r = await fetch(`${API_BASE_URL}/timeloss/daily-staffing?${params.toString()}`);
  if (!r.ok) {
    const error = await r.json().catch(() => ({}));
    throw new Error(error?.detail || error?.error || `Failed to load daily staffing`);
  }
  return r.json();
}

export async function apiPatchCell(id: number, field: keyof TimeLossRow, value: any, rowver?: string) {
  const r = await fetch(`${BASE_URL}/entry/${id}`, {
    method: 'PATCH',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({ field, value, rowver })
  });
  if (!r.ok) {
    const error = await r.json();
    if (r.status === 409) {
      throw new Error('Data was changed by another user. Please refresh and try again.');
    }
    throw new Error(error.error || error.message || 'Failed to update cell');
  }
  return r.json();
}

export async function apiAddRow(payload: Partial<TimeLossRow>): Promise<TimeLossRow> {
  const r = await fetch(`${BASE_URL}/entry`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(payload)
  });
  if (!r.ok) {
    const error = await r.json();
    throw new Error(error.error || error.message || 'Failed to create entry');
  }
  return r.json();
}

export async function apiCopyRow(id: number, newDate?: string, newWorkCenterID?: string): Promise<TimeLossRow> {
  const r = await fetch(`${BASE_URL}/entry/${id}/copy`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({ newDate, newWorkCenterID })
  });
  if (!r.ok) {
    const error = await r.json();
    throw new Error(error.error || error.message || 'Failed to copy entry');
  }
  return r.json();
}

export async function apiSoftDelete(id: number) {
  const r = await fetch(`${BASE_URL}/entry/${id}/delete`, { method: 'POST' });
  if (!r.ok) {
    const error = await r.json();
    throw new Error(error.error || error.message || 'Failed to delete entry');
  }
}

// Order Tails
export type OrderTailRow = {
  WorkShopName_CH: string;
  LargeGroup: string;
  GroupName: string;
  OrderNumber: string;
  NomenclatureNumber: string;
  Total_QTY: string;
  FactTotal_QTY: string;
  TailDays: number;
  TailStartDate?: string | null;
  TailResolvedDate?: string | null;
  Active_Tail?: number | null;
};

export async function apiGetOrderTails(): Promise<OrderTailRow[]> {
  const r = await fetch(`${API_BASE_URL}/order-tails`);
  if (!r.ok) {
    const error = await r.json().catch(() => ({}));
    throw new Error(error?.detail || error?.error || 'Failed to load order tails');
  }
  return r.json();
}
