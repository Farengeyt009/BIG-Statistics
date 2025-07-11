import { ColumnDef } from '@tanstack/react-table';

/**
 * Генерирует массив ColumnDef для DataTable по списку ключей.
 * Можно передать кастомные свойства для отдельных колонок (например, cell/header).
 */
export function buildColumns<T extends object>(
  keys: (keyof T)[],
  custom?: Partial<ColumnDef<T>>[]
): ColumnDef<T>[] {
  return keys.map((key) => {
    const customCol = custom?.find(col => (col as any).accessorKey === key);
    return {
      id: String(key),
      accessorKey: String(key),
      header: String(key),
      ...customCol,
    };
  });
} 