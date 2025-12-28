/**
 * Форматирует число в формат с K (тысячи)
 * Например: 100000 → 100K
 */
export function formatNumberK(value: number): string {
  if (value == null || isNaN(value)) return '0';
  return `${Math.round(value / 1000)}K`;
}

/**
 * Форматирует число с разделителем тысяч (русский формат)
 * Например: 100000 → 100 000 (с неразрывным пробелом)
 */
export function formatNumber(value: number): string {
  if (value == null || isNaN(value)) return '0';
  return Math.round(value).toLocaleString('ru-RU').replace(/\s/g, '\u00A0');
}

/**
 * Форматирует число для Fact значений (без десятичных, с русским разделителем)
 * Например: 85432.7 → 85 433
 */
export function formatFact(value: number): string {
  if (value == null || isNaN(value)) return '0';
  return Math.round(value).toLocaleString('ru-RU').replace(/\s/g, '\u00A0');
}

