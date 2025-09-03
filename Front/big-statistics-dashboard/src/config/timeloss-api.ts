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

export async function apiGetDicts() {
  const r = await fetch(`${BASE_URL}/dicts`);
  if (!r.ok) {
    const error = await r.json();
    throw new Error(error.error || error.message || 'Failed to load dictionaries');
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
