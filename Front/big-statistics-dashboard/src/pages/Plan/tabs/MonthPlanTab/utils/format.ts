// formatNumber: форматирует число с разделителем тысяч, null/undefined/пустое — '–'
export function formatNumber(value: any): string {
  if (value == null || value === '') return '–';
  const num = Number(value);
  if (isNaN(num)) return '–';
  return Math.round(num).toLocaleString('ru-RU').replace(/\s/g, '\u00A0');
}

// formatPercent: форматирует процент, null/undefined/пустое — '–'
export function formatPercent(value: any): string {
  if (value == null || value === '') return '–';
  const num = Number(value);
  if (isNaN(num)) return '–';
  return Math.round(num).toLocaleString('ru-RU').replace(/\s/g, '\u00A0') + '%';
}

// calcPercent: универсальный расчет процента
export function calcPercent(plan: number, fact: number): string {
  if ((plan == null || plan === 0) && (fact == null || fact === 0)) return '0%';
  if ((plan == null || plan === 0) && fact > 0) return '100%';
  if (plan > 0) return Math.round((fact / plan) * 100) + '%';
  return '–';
}

// sumBy: суммирует значения по ключу в массиве объектов
export function sumBy<T>(arr: T[], key: keyof T): number {
  return arr.reduce((sum, item) => sum + (Number(item[key]) || 0), 0);
}

// makeKeys: генерация колонок для QTY/TIME
export function makeKeys(type: 'Qty' | 'Time') {
  const kinds = ['Plan', 'Fact', 'Different', 'Percent'] as const;
  return kinds.map(kind => ({
    id: `${kind}${type}`,
    accessorKey: `${kind}${type}`,
    header: () => `${kind.toUpperCase()} ${type.toUpperCase()}`,
    cell: ({ getValue }: any) =>
      kind === 'Percent' ? formatPercent(getValue()) : formatNumber(getValue()),
  }));
} 