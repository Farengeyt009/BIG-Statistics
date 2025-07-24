/*  Расширяем типы Chart.js собственными плагинами
    ------------------------------------------------
    Файл автоматически «подхватится» TypeScript‑ом,
    если каталог попадает в include секцию tsconfig.json.
*/

import 'chart.js';
import type { ChartType } from 'chart.js';

declare module 'chart.js' {
  export interface PluginOptionsByType<TType extends ChartType = ChartType> {
    /** Плагин «скобка для групп цехов» */
    workshopBracket?: {
      groups: {
        startIndex: number;
        endIndex:   number;
        label:      string;
      }[];
    };

    /** Плагин «удаляем лишние деления Y» */
    stripExtraYTicks?: {
      /** Список делений, которые нужно оставить */
      ticks: { value: number; label: string }[];
    };
  }
}
