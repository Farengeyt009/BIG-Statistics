import React from 'react';
import { ColumnDef } from '@tanstack/react-table';

export function formatNumber(value: any): string {
  if (value == null || value === '') return '–';
  const num = Number(value);
  if (isNaN(num)) return '–';
  return Math.round(num).toLocaleString('ru-RU').replace(/\s/g, '\u00A0');
}

export function formatPercent(value: any): string {
  if (value == null || value === '') return '–';
  const num = Number(value);
  if (isNaN(num)) return '–';
  return Math.round(num).toLocaleString('ru-RU').replace(/\s/g, '\u00A0') + '%';
}

export function calcPercent(plan: number, fact: number): string {
  if ((plan == null || plan === 0) && (fact == null || fact === 0)) return '0%';
  if ((plan == null || plan === 0) && fact > 0) return '100%';
  if (plan > 0) return Math.round((fact / plan) * 100) + '%';
  return '–';
}

export function sumBy<T>(arr: T[], key: keyof T): number {
  return arr.reduce((sum, item) => sum + (Number(item[key]) || 0), 0);
}

export function makeKeys(type: 'Qty' | 'Time'): ColumnDef<any>[] {
  const kinds = ['Plan', 'Fact', 'Different', 'Percent'] as const;
  return kinds.map(kind => ({
    id: `${kind}${type}`,
    accessorKey: `${kind}${type}`,
    header: () => (
      <span className="text-base font-semibold">{`${kind.toUpperCase()} ${type.toUpperCase()}`}</span>
    ),
    cell: ({ getValue }: any) =>
      kind === 'Percent' ? formatPercent(getValue()) : formatNumber(getValue()),
  }));
} 