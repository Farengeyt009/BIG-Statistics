/**
 * Утилиты для унификации фильтров AG Grid
 * 
 * Стандартное поведение: Фильтры применяются сразу, без кнопок Apply/Clear/Reset
 * для текстовых, числовых и дата фильтров.
 */

import type { ColDef } from '@ag-grid-community/core';

/**
 * Локализованный ярлык месяца
 * @param mm - Номер месяца (01-12) в виде строки
 * @param language - Язык интерфейса ('en', 'ru', 'zh' или строка, начинающаяся с одного из них)
 * @returns Название месяца на указанном языке
 */
export function getMonthLabel(mm: string, language?: string): string {
  const i = Math.max(0, Math.min(11, parseInt(mm, 10) - 1));
  const lang = language?.startsWith('zh') ? 'zh' : language?.startsWith('ru') ? 'ru' : 'en';
  const names = {
    en: ['January','February','March','April','May','June','July','August','September','October','November','December'],
    ru: ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'],
    zh: ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'],
  } as const;
  return names[lang][i];
}

/**
 * Нормализация даты в ISO формат YYYY-MM-DD (для фильтров)
 * @param value - Значение даты (строка DD.MM.YYYY, YYYY-MM-DD или Date объект)
 * @returns Строка в формате YYYY-MM-DD или пустая строка
 */
export function toIsoDate(value: any): string {
  if (value === null || value === undefined || value === '') return '';
  const s = String(value).trim();
  // DD.MM.YYYY -> YYYY-MM-DD
  const m1 = s.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (m1) return `${m1[3]}-${m1[2]}-${m1[1]}`;
  // YYYY-MM-DD (или с временем)
  const m2 = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m2) return `${m2[1]}-${m2[2]}-${m2[3]}`;
  const d = new Date(s);
  return isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
}

/**
 * Тип фильтра AG Grid
 */
type FilterType = 'text' | 'number' | 'date' | 'set' | 'none';

/**
 * Определяет тип фильтра для колонки
 */
function getFilterType(colDef: ColDef): FilterType {
  // Если фильтр явно отключен
  if (colDef.filter === false) {
    return 'none';
  }

  // Если явно указан Set фильтр
  if (colDef.filter === 'agSetColumnFilter' || colDef.filter === 'set') {
    return 'set';
  }

  // Если явно указан числовой фильтр
  if (colDef.filter === 'agNumberColumnFilter' || colDef.filter === 'number') {
    return 'number';
  }

  // Если явно указан фильтр дат
  if (colDef.filter === 'agDateColumnFilter' || colDef.filter === 'date') {
    return 'date';
  }

  // Если явно указан текстовый фильтр
  if (colDef.filter === 'agTextColumnFilter' || colDef.filter === 'text') {
    return 'text';
  }

  // Определяем по cellDataType
  const cellDataType = (colDef as any).cellDataType;
  if (cellDataType === 'number') {
    return 'number';
  }
  if (cellDataType === 'date') {
    return 'date';
  }

  // Если filter: true или не указан - по умолчанию текстовый
  if (colDef.filter === true || colDef.filter === undefined) {
    return 'text';
  }

  // По умолчанию - текстовый
  return 'text';
}

/**
 * Создает стандартные filterParams для текстового фильтра
 * Без кнопок - фильтр применяется сразу
 */
function createTextFilterParams(existingParams?: any): any {
  return {
    ...(existingParams || {}),
    // Убрали кнопки - фильтр применяется сразу
  };
}

/**
 * Создает стандартные filterParams для числового фильтра
 * Без кнопок - фильтр применяется сразу
 */
function createNumberFilterParams(existingParams?: any): any {
  // Сохраняем существующий valueFormatter, если он есть
  const existingValueFormatter = existingParams?.valueFormatter;
  
  return {
    ...(existingParams || {}),
    // Убрали кнопки - фильтр применяется сразу
    allowedCharPattern: '\\d\\-\\.,', // Разрешаем цифры, минус, точки и запятые
    // Форматируем числа с разделителем тысяч для отображения в фильтре
    valueFormatter: existingValueFormatter || ((params: any) => {
      if (params.value == null || params.value === '') return '';
      const num = typeof params.value === 'number' ? params.value : Number(params.value);
      if (!isFinite(num)) return String(params.value ?? '');
      return num.toLocaleString('ru-RU');
    }),
  };
}

/**
 * Специальное значение для blank значений в фильтрах дат
 */
export const BLANK_VALUE = '__BLANK__';

/**
 * Создает стандартные filterParams для фильтра дат
 * Без кнопок - фильтр применяется сразу
 * Сохраняет существующие настройки (например, treeList)
 * Автоматически добавляет поддержку blank значений для treeList фильтров
 */
function createDateFilterParams(existingParams?: any, language?: string): any {
  const params = {
    ...(existingParams || {}),
    // Убрали кнопки - фильтр применяется сразу
  };

  // Если используется treeList (иерархический фильтр дат), добавляем поддержку blank
  if (params.treeList) {
    // Сохраняем существующие функции, если они есть
    const existingTreeListPathGetter = params.treeListPathGetter;
    const existingValueFormatter = params.valueFormatter;
    const existingFilterValueGetter = params.filterValueGetter;

    // Обновляем treeListPathGetter для поддержки blank
    params.treeListPathGetter = (value: any) => {
      // Сначала обрабатываем специальное значение для blank
      if (value === BLANK_VALUE || value === '' || value == null) {
        return ['(Blanks)'];
      }
      // Если есть существующая функция, используем её для не-blank значений
      if (existingTreeListPathGetter) {
        return existingTreeListPathGetter(value);
      }
      // Стандартная обработка дат с иерархией: год -> месяц -> день
      const s = String(value ?? '').trim();
      const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (!m) return null;
      const [, y, mm, dd] = m;
      return [y, getMonthLabel(mm, language), dd];
    };

    // Обновляем valueFormatter для поддержки blank
    // Примечание: valueFormatter в filterParams используется для отображения в фильтре
    params.valueFormatter = (p: any) => {
      // Обрабатываем специальное значение для blank
      if (p.value === BLANK_VALUE || p.value === '' || p.value == null) {
        return '(Blanks)';
      }
      // Если есть существующая функция, используем её
      if (existingValueFormatter) {
        return existingValueFormatter(p);
      }
      // Стандартная обработка дат: YYYY-MM-DD -> DD.MM.YYYY
      const s = String(p.value ?? '');
      const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      return m ? `${m[3]}.${m[2]}.${m[1]}` : s;
    };

    // filterValueGetter должен быть установлен на уровне colDef, а не в filterParams
    // Поэтому мы не устанавливаем его здесь, а вернемся к этому в applyStandardFilterParams

    // Включаем поддержку blank в фильтре
    params.includeBlanksInFilter = true;
  }

  return params;
}

/**
 * Применяет стандартные настройки фильтров к одной колонке
 * 
 * @param colDef - Определение колонки AG Grid
 * @param options - Опциональные параметры (например, language для локализации)
 * @returns Обновленное определение колонки с стандартными filterParams
 */
export function applyStandardFilterParams<T = any>(colDef: ColDef<T>, options?: { language?: string }): ColDef<T> {
  // Если фильтр отключен, возвращаем как есть
  if (colDef.filter === false) {
    return colDef;
  }

  const filterType = getFilterType(colDef);
  const existingParams = colDef.filterParams || {};

  // Для Set фильтров с treeList (иерархические фильтры дат) - применяем обработку blank
  // Если есть treeList, скорее всего это иерархический фильтр дат
  if (filterType === 'set' && existingParams.treeList) {
    // Применяем обработку blank для иерархических фильтров дат
    const newFilterParams = createDateFilterParams(existingParams, options?.language);
    
    // filterValueGetter должен быть на уровне colDef, а не в filterParams
    const existingFilterValueGetter = (colDef as any).filterValueGetter;
    const field = colDef.field;
    
    // Создаем новый colDef с filterValueGetter на правильном уровне
    const newColDef: any = {
      ...colDef,
      filterParams: newFilterParams,
    };
    
    // Устанавливаем filterValueGetter на уровне colDef
    if (!existingFilterValueGetter && field) {
      newColDef.filterValueGetter = (params: any) => {
        const iso = toIsoDate(params.data?.[field]);
        // Если iso пустая строка, возвращаем BLANK_VALUE, иначе возвращаем iso
        return iso === '' ? BLANK_VALUE : iso;
      };
    } else if (existingFilterValueGetter) {
      // Обертываем существующую функцию
      newColDef.filterValueGetter = (params: any) => {
        const result = existingFilterValueGetter(params);
        // Если результат пустой (null, undefined, или пустая строка), преобразуем в BLANK_VALUE
        if (result === null || result === undefined || result === '') {
          return BLANK_VALUE;
        }
        return result;
      };
    }
    
    return newColDef;
  }

  // Для остальных типов - применяем стандартные настройки (без кнопок, фильтр применяется сразу)
  let newFilterParams: any;

  switch (filterType) {
    case 'number':
      newFilterParams = createNumberFilterParams(existingParams);
      break;
    case 'date':
      newFilterParams = createDateFilterParams(existingParams, options?.language);
      break;
    case 'text':
    default:
      newFilterParams = createTextFilterParams(existingParams);
      break;
  }

  // Объединяем с существующими настройками
  return {
    ...colDef,
    filterParams: newFilterParams,
  };
}

/**
 * Применяет стандартные настройки фильтров к массиву определений колонок
 * 
 * @param columnDefs - Массив определений колонок
 * @param options - Опциональные параметры (например, language для локализации)
 * @returns Массив обновленных определений колонок
 */
export function applyStandardFilters<T = any>(columnDefs: ColDef<T>[], options?: { language?: string }): ColDef<T>[] {
  return columnDefs.map(colDef => applyStandardFilterParams(colDef, options));
}

