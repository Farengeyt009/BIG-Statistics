import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { DataTable } from '../../../../components/DataTable';
import { useTranslation } from 'react-i18next';
import productionTranslations from '../../ProductionTranslation.json';
import type { Table } from '@tanstack/react-table';

interface TableProps {
  data: any[];
  loading: boolean;
  error: string | null;
  onTableReady?: (table: Table<any>) => void;
}

const Table: React.FC<TableProps> = ({ data, loading, error, onTableReady }) => {
  const { t, i18n } = useTranslation('production');
  const currentLanguage = i18n.language as 'en' | 'zh';
  const [table, setTable] = useState<Table<any> | null>(null);

  // Передаем ссылку на таблицу в родительский компонент
  useEffect(() => {
    if (table && onTableReady) {
      onTableReady(table);
    }
  }, [table, onTableReady]);

  /** -------------------- функция перевода названий цехов -------------------- */
  const translateWorkShop = (workShopName: string) => {
    if (!workShopName) return workShopName;
    
    const trimmedName = workShopName.trim();
    
    // Пытаемся найти точное совпадение
    let translation = productionTranslations[currentLanguage]?.workshops?.[trimmedName as keyof typeof productionTranslations.en.workshops];
    
    // Если не найдено, ищем без учета регистра
    if (!translation) {
      const workshops = productionTranslations[currentLanguage]?.workshops;
      if (workshops) {
        const key = Object.keys(workshops).find(k => k.toLowerCase() === trimmedName.toLowerCase());
        if (key) {
          translation = workshops[key as keyof typeof workshops];
        }
      }
    }
    
    return translation ? translation : trimmedName;
  };

  /** -------------------- функция перевода названий рабочих центров -------------------- */
  const translateWorkCenter = (workCenterName: string) => {
    if (!workCenterName) return workCenterName;
    
    const trimmedName = workCenterName.trim();
    
    // Пытаемся найти точное совпадение
    let translation = productionTranslations[currentLanguage]?.workCenters?.[trimmedName as keyof typeof productionTranslations.en.workCenters];
    
    // Если не найдено, ищем без учета регистра
    if (!translation) {
      const workCenters = productionTranslations[currentLanguage]?.workCenters;
      if (workCenters) {
        const key = Object.keys(workCenters).find(k => k.toLowerCase() === trimmedName.toLowerCase());
        if (key) {
          translation = workCenters[key as keyof typeof workCenters];
        }
      }
    }
    
    return translation ? translation : trimmedName;
  };



  // Определение колонок для таблицы
  const columns = [
    { accessorKey: 'OnlyDate', header: t('tableHeaders.date') },
    { accessorKey: 'WorkShopName_CH', header: t('tableHeaders.workShop') },
    { accessorKey: 'WorkCenterGroup_CN', header: t('tableHeaders.workCenterGroup') },
    { accessorKey: 'OrderNumber', header: t('tableHeaders.orderNumber') },
    { accessorKey: 'NomenclatureNumber', header: t('tableHeaders.nomenclature') },
    { accessorKey: 'ProductName_CN', header: t('tableHeaders.productName') },
    { accessorKey: 'Plan_QTY', header: t('tableHeaders.planQty') },
    { accessorKey: 'FACT_QTY', header: t('tableHeaders.factQty') },
    { accessorKey: 'Different_QTY', header: t('tableHeaders.differentQty') },
    { accessorKey: 'Plan_TIME', header: t('tableHeaders.planTime') },
    { accessorKey: 'FACT_TIME', header: t('tableHeaders.factTime') },
    { accessorKey: 'Different_TIME', header: t('tableHeaders.differentTime') },
  ];



  // Обработка данных для перевода и ограничения длины ProductName_CN
  const processedData = useMemo(() => {
    return data.map(row => {
      // Расчет разности количества и времени
      const planQty = Math.round(parseFloat(row.Plan_QTY) || 0);
      const factQty = Math.round(parseFloat(row.FACT_QTY) || 0);
      const planTime = Math.round(parseFloat(row.Plan_TIME) || 0);
      const factTime = Math.round(parseFloat(row.FACT_TIME) || 0);
      
      const differentQty = factQty - planQty;
      const differentTime = factTime - planTime;
      
      return {
        ...row,
        WorkShopName_CH: translateWorkShop(row.WorkShopName_CH),
        WorkCenterGroup_CN: translateWorkCenter(row.WorkCenterGroup_CN),
        ProductName_CN: row.ProductName_CN && row.ProductName_CN.length > 30 
          ? row.ProductName_CN.substring(0, 30) + '...' 
          : row.ProductName_CN,
        Plan_QTY: planQty,
        FACT_QTY: factQty,
        Plan_TIME: planTime,
        FACT_TIME: factTime,
        Different_QTY: differentQty,
        Different_TIME: differentTime
      };
    });
  }, [data, currentLanguage]);

  // Настройки колонок для отображения полного текста в tooltip и заголовков
  const columnsOverrides = useMemo(() => ({
    OnlyDate: {
      header: t('tableHeaders.date'),
      meta: { excelHeader: t('tableHeaders.date'), charWidth: 8 }
    },
    WorkShopName_CH: {
      header: t('tableHeaders.workShop'),
      meta: { excelHeader: t('tableHeaders.workShop'), charWidth: 8 }
    },
    WorkCenterGroup_CN: {
      header: t('tableHeaders.workCenterGroup'),
      meta: { excelHeader: t('tableHeaders.workCenterGroup'), charWidth: 8 }
    },
    OrderNumber: {
      header: t('tableHeaders.orderNumber'),
      meta: { excelHeader: t('tableHeaders.orderNumber'), charWidth: 8 }
    },
    NomenclatureNumber: {
      header: t('tableHeaders.nomenclature'),
      meta: { excelHeader: t('tableHeaders.nomenclature'), charWidth: 8 }
    },
    ProductName_CN: {
      header: t('tableHeaders.productName'),
      meta: { excelHeader: t('tableHeaders.productName'), charWidth: 8 },
      cell: ({ getValue }: any) => {
        const value = getValue();
        const originalValue = data.find(row => row.ProductName_CN === value)?.ProductName_CN || value;
        return (
          <span title={originalValue}>
            {value}
          </span>
        );
      }
    },
    Plan_QTY: {
      header: t('tableHeaders.planQty'),
      meta: { excelHeader: t('tableHeaders.planQty') },
      cell: ({ getValue }: any) => {
        const value = getValue();
        return <span className="text-center block">{value}</span>;
      }
    },
    FACT_QTY: {
      header: t('tableHeaders.factQty'),
      meta: { excelHeader: t('tableHeaders.factQty') },
      cell: ({ getValue }: any) => {
        const value = getValue();
        return <span className="text-center block">{value}</span>;
      }
    },
    Plan_TIME: {
      header: t('tableHeaders.planTime'),
      meta: { excelHeader: t('tableHeaders.planTime') },
      cell: ({ getValue }: any) => {
        const value = getValue();
        return <span className="text-center block">{value.toLocaleString('ru-RU')}</span>;
      }
    },
    FACT_TIME: {
      header: t('tableHeaders.factTime'),
      meta: { excelHeader: t('tableHeaders.factTime') },
      cell: ({ getValue }: any) => {
        const value = getValue();
        return <span className="text-center block">{value.toLocaleString('ru-RU')}</span>;
      }
    },
    Different_QTY: {
      header: t('tableHeaders.differentQty'),
      meta: { excelHeader: t('tableHeaders.differentQty') },
      cell: ({ getValue }: any) => {
        const value = getValue();
        const color = value > 0 ? 'text-green-600' : value < 0 ? 'text-red-600' : 'text-gray-600';
        return (
          <span className={`text-center block ${color}`}>
            {value > 0 ? '+' : ''}{value.toLocaleString('ru-RU')}
          </span>
        );
      }
    },
    Different_TIME: {
      header: t('tableHeaders.differentTime'),
      meta: { excelHeader: t('tableHeaders.differentTime') },
      cell: ({ getValue }: any) => {
        const value = getValue();
        const color = value > 0 ? 'text-green-600' : value < 0 ? 'text-red-600' : 'text-gray-600';
        return (
          <span className={`text-center block ${color}`}>
            {value > 0 ? '+' : ''}{value.toLocaleString('ru-RU')}
          </span>
        );
      }
    }
  }), [data, t]);

  // Показываем индикатор загрузки
  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-lg text-gray-600">Загрузка данных...</div>
      </div>
    );
  }

  // Показываем ошибку
  if (error) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-lg text-red-600">
          Ошибка загрузки данных: {error}
        </div>
      </div>
    );
  }

  return (
    <div>
      <DataTable 
        data={processedData}
        numericKeys={['Plan_QTY', 'FACT_QTY', 'Plan_TIME', 'FACT_TIME']}
        columnsOrder={columns.map(col => col.accessorKey)}
        columnsOverrides={columnsOverrides}
        onTableReady={setTable}
        language={currentLanguage}
      />
    </div>
  );
};

export default Table;
