import type { ColDef } from '@ag-grid-community/core';

// Интерфейс для конфигурации колонки
export interface ColumnConfig {
  field: string;
  colId: string;
  headerKey: string; // Key для i18n перевода
  pinned?: 'left' | 'right';
  minWidth?: number;
  maxWidth?: number;
  width?: number; // Фиксированная ширина
  order: number; // Порядок отображения
}

// Интерфейс для конфигурации цеха
export interface WorkshopConfig {
  key: string; // Ключ цеха из API
  name_en: string; // Английское название
  name_zh: string; // Китайское название
  width?: number; // Фиксированная ширина
  minWidth?: number;
  maxWidth?: number;
  order: number; // Порядок отображения
  enabled: boolean; // Показывать ли колонку
}

// Конфигурация основных колонок
export const OVERVIEW_COLUMN_CONFIG: ColumnConfig[] = [
  {
    field: 'metric',
    colId: 'metric',
    headerKey: 'timeLossOverview.metric',
    pinned: 'left',
    width: 190, // Фиксированная ширина для Metric колонки
    order: 1,
  },
  {
    field: 'total',
    colId: 'total',
    headerKey: 'timeLossOverview.total',
    minWidth: 100,
    maxWidth: 150,
    order: 2,
  },
  // Колонки цехов будут добавлены динамически
];

// Кастомный порядок и конфигурация цехов
export const CUSTOM_WORKSHOP_CONFIG: WorkshopConfig[] = [
  {
    key: '装配车间', // Heater Assembly
    name_en: 'Heater Assembly',
    name_zh: '装配车间',
    width: 150,
    order: 3,
    enabled: true,
  },
  {
    key: '热水器总装组', // WaterHeaters
    name_en: 'WaterHeaters',
    name_zh: '热水器装组',
    width: 150,
    order: 4,
    enabled: true,
  },
  {
    key: '喷粉车间', // Powder coating
    name_en: 'Powder coating',
    name_zh: '喷粉车间',
    width: 150,
    order: 5,
    enabled: true,
  },
  {
    key: '冲压车间', // Stamping
    name_en: 'Stamping',
    name_zh: '冲压车间',
    width: 120,
    order: 6,
    enabled: true,
  },
  {
    key: '热水器冲压组', // Stamping WH
    name_en: 'Stamping WH',
    name_zh: '热水器冲压组',
    width: 140,
    order: 7,
    enabled: true,
  },
  {
    key: '注塑车间', // Injection
    name_en: 'Injection',
    name_zh: '注塑车间',
    width: 120,
    order: 8,
    enabled: true,
  },
  // Остальные цеха с автоматическим порядком
  {
    key: '包布车间', // Fabric
    name_en: 'Fabric',
    name_zh: '包布车间',
    width: 100,
    order: 9,
    enabled: true,
  },
  {
    key: '激光', // Laser
    name_en: 'Laser',
    name_zh: '激光车间',
    width: 100,
    order: 10,
    enabled: true,
  },
  {
    key: '丝印车间', // Silkscreen
    name_en: 'Silkscreen',
    name_zh: '丝印车间',
    width: 105,
    order: 11,
    enabled: true,
  },
  {
    key: '线材车间', // Wire
    name_en: 'Wire',
    name_zh: '线材车间',
    width: 100,
    order: 12,
    enabled: true,
  },
  {
    key: '超声', // Ultrasonic
    name_en: 'Ultrasonic',
    name_zh: '超声车间',
    width: 115,
    order: 13,
    enabled: true,
  },
];

// Функция для получения конфигурации цеха по ключу
export const getWorkshopConfig = (workshopKey: string): WorkshopConfig | undefined => {
  return CUSTOM_WORKSHOP_CONFIG.find(config => config.key === workshopKey);
};

// Функция для получения отсортированных и отфильтрованных цехов
export const getOrderedWorkshops = (
  workshops: Array<{ key: string; name_zh?: string; name_en?: string }>
): Array<{ key: string; name_zh?: string; name_en?: string; config: WorkshopConfig }> => {
  const result: Array<{ key: string; name_zh?: string; name_en?: string; config: WorkshopConfig }> = [];
  
  // Сначала добавляем цеха в кастомном порядке
  CUSTOM_WORKSHOP_CONFIG.forEach(customConfig => {
    const workshop = workshops.find(w => w.key === customConfig.key);
    if (workshop && customConfig.enabled) {
      result.push({
        ...workshop,
        config: customConfig
      });
    }
  });
  
  // Затем добавляем остальные цеха, которых нет в кастомной конфигурации
  workshops.forEach(workshop => {
    const existsInCustom = CUSTOM_WORKSHOP_CONFIG.some(c => c.key === workshop.key);
    if (!existsInCustom) {
      // Создаем конфигурацию по умолчанию
      const defaultConfig: WorkshopConfig = {
        key: workshop.key,
        name_en: workshop.name_en || workshop.key,
        name_zh: workshop.name_zh || workshop.key,
        width: 120 + Math.floor(Math.random() * 80), // Случайная ширина 120-200px
        order: 100 + result.length, // Порядок после кастомных
        enabled: true,
      };
      result.push({
        ...workshop,
        config: defaultConfig
      });
    }
  });
  
  return result;
};

// Функция для создания колонок на основе конфигурации
export const createColumnsFromConfig = (
  workshops: Array<{ key: string; name_zh?: string; name_en?: string }>,
  t: (key: string) => string,
  getLocalizedName: (workshop: { name_zh?: string; name_en?: string }) => string,
  centeredCellClass: (p: any) => string,
  formatIntRu: (value: number) => string
): ColDef[] => {
  const columns: ColDef[] = [];
  
  // Создаем основные колонки
  OVERVIEW_COLUMN_CONFIG.forEach(config => {
    const colDef: ColDef = {
      field: config.field,
      colId: config.colId,
      headerName: t(config.headerKey),
      pinned: config.pinned,
      cellClass: config.field === 'metric' ? (p: any) => {
        const v = String(p?.value ?? '');
        const isPinnedTop = (p?.node?.rowPinned === 'top');
        const isEfficiency = v === t('timeLossOverview.efficiency');
        return `${isPinnedTop || isEfficiency ? 'font-bold' : ''}`.trim();
      } : centeredCellClass,
    };

    // Применяем настройки ширины
    if (config.width) {
      colDef.width = config.width;
    } else {
      colDef.minWidth = config.minWidth || 90;
      colDef.maxWidth = config.maxWidth || 320;
    }

    // Специальная логика для колонки Total
    if (config.field === 'total') {
      colDef.valueFormatter = (p: any) => {
        const v = Number(p.value);
        if (!isFinite(v)) return '';
        const metricValue = String(p?.data?.metric || '');
        const isEff = metricValue === t('timeLossOverview.efficiency');
        if (isEff) {
          const iv = Math.round(v);
          return iv === 0 ? '' : `${iv} %`;
        }
        if (v === 0) return '';
        return formatIntRu(v);
      };
    }

    columns.push(colDef);
  });

  // Получаем отсортированные цеха
  const orderedWorkshops = getOrderedWorkshops(workshops);
  
  // Создаем колонки цехов
  orderedWorkshops.forEach(({ key, config }) => {
    const workshopCol: ColDef = {
      field: key,
      colId: key,
      headerName: getLocalizedName({ name_zh: config.name_zh, name_en: config.name_en }),
      cellClass: centeredCellClass,
      valueFormatter: (p: any) => {
        const v = Number(p.value);
        if (!isFinite(v)) return '';
        const metricValue = String(p?.data?.metric || '');
        const isEff = metricValue === t('timeLossOverview.efficiency');
        if (isEff) {
          const iv = Math.round(v);
          return iv === 0 ? '' : `${iv} %`;
        }
        if (v === 0) return '';
        return formatIntRu(v);
      },
    };

    // Применяем настройки ширины из конфигурации
    if (config.width) {
      workshopCol.width = config.width;
    } else {
      workshopCol.minWidth = config.minWidth || 90;
      workshopCol.maxWidth = config.maxWidth || 320;
    }

    columns.push(workshopCol);
  });

  return columns;
};

// Статическая конфигурация - изменения только в коде
