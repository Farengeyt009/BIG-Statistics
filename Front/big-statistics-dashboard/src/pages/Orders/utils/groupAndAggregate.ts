// 📁 src/Orders/utils/groupAndAggregate.ts
import { NUMERIC_KEYS } from "./numericFields";

type Row = Record<string, any>;

export function groupAndAggregate(data: Row[], selectedKeys: string[]): Row[] {
    if (selectedKeys.length === 0) return [];

    // Собираем все ключи из всех строк
    const allKeys = new Set<string>();
    data.forEach(row => {
        Object.keys(row).forEach(k => allKeys.add(k));
    });

    const groupKeys = selectedKeys.filter((key) => !NUMERIC_KEYS.includes(key));
    const numericKeys = selectedKeys.filter((key) => NUMERIC_KEYS.includes(key));

    const grouped = new Map<string, Row>();

    for (const row of data) {
        const groupKey = groupKeys.map((k) => row[k]).join("||");

        if (!grouped.has(groupKey)) {
            const base: Row = {};
            for (const key of Array.from(allKeys)) {
                base[key] = row[key] ?? null;
            }
            for (const k of numericKeys) {
                base[k] = 0;
            }
            grouped.set(groupKey, base);
        }

        for (const k of numericKeys) {
            const val = parseFloat(row[k]);
            if (!isNaN(val)) {
                grouped.get(groupKey)![k] += val;
            }
        }
    }

    const result = Array.from(grouped.values()).map((row) => {
        for (const key of Array.from(allKeys)) {
            if (!(key in row)) row[key] = null;
        }
        return row;
    });

    return result;
}
