// src/pages/Home/Production/Production.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { kpiData, pagesTable, refTable } from './utils/mockData';
import { MetricCard } from '../../../components/KPICards';
import { TrendChart } from './components/TrendChart';
import { MiniTable } from './components/MiniTable';
import { DatePicker as CustomDatePicker } from '../../../components/DatePicker';
import { useTranslation } from 'react-i18next';
import homeTranslations from '../HomeTranslation.json';
import { ProductionProvider } from './ProductionContext';
import { AutoDashboard } from './components/AutoDashboard';

export default function Production() {
  const { i18n } = useTranslation();
  const currentLanguage = i18n.language as 'en' | 'zh';

  /** -------------------- функция перевода названий цехов -------------------- */
  const translateWorkShop = (workShopName: string) => {
    const trimmedName = workShopName?.trim();
    const translation = homeTranslations.workshops[trimmedName as keyof typeof homeTranslations.workshops];
    return translation ? translation[currentLanguage] : trimmedName;
  };

  /** -------------------- состояния -------------------- */
  const [selectedDate, setSelectedDate]     = useState<Date | null>(new Date());
  const [productionData, setProductionData] = useState<any>({});
  const [loading, setLoading]               = useState(false);
  const [hoveredWorkShop, setHoveredWorkShop] = useState<{workShop: string, workCenter: string} | null>(null);
  const [defaultWorkShop, setDefaultWorkShop] = useState<{workShop: string, workCenter: string} | null>(null);

  /** -------------------- обработка данных из table4 totals -------------------- */
  const processTable4Data = useCallback((table4Data: any) => {
    if (!table4Data) return [];
    
    // Проверяем есть ли totals в table4
    const hasTotals = table4Data && typeof table4Data === 'object' && 'totals' in table4Data;
    
    // Используем totals часть для сгруппированных данных
    if (hasTotals && Array.isArray(table4Data.totals)) {
      const processedData = table4Data.totals.map((item: any) => {
        const planQty = parseFloat(item.TOTAL_Plan_QTY) || 0;
        const factQty = parseFloat(item.TOTAL_FACT_QTY) || 0;
        const completed = planQty > 0 ? Math.round((factQty / planQty) * 100) : 0;
        
        return {
          workShop: translateWorkShop(item.WorkShopName_CH || ''),
          workCenter: item.WorkCentor_CN || '',
          planQty: planQty,
          factQty: factQty,
          completed: `${completed}%`
        };
      });
      
      // Устанавливаем первую строку как дефолтную, если она еще не установлена
      if (processedData.length > 0 && !defaultWorkShop) {
        setDefaultWorkShop({
          workShop: processedData[0].workShop,
          workCenter: processedData[0].workCenter
        });
      }
      
      return processedData;
    }
    
    return [];
  }, [defaultWorkShop, translateWorkShop]);

  /** -------------------- обработка данных из table4 details -------------------- */
  const processTable4Details = useCallback((table4Data: any, selectedWorkShop: {workShop: string, workCenter: string} | null = null) => {
    if (!table4Data) return [];
    
    // Проверяем есть ли details в table4
    const hasDetails = table4Data && typeof table4Data === 'object' && 'details' in table4Data;
    
    // Используем details часть для детальных данных
    if (hasDetails && Array.isArray(table4Data.details)) {
      let filteredDetails = table4Data.details;
      
      // Фильтруем по выбранному WorkShop и WorkCenter
      if (selectedWorkShop) {
        filteredDetails = table4Data.details.filter((item: any) => {
          const itemWorkShopTranslated = translateWorkShop(item.WorkShopName_CH || '');
          return itemWorkShopTranslated === selectedWorkShop.workShop && 
                 item.WorkCentor_CN === selectedWorkShop.workCenter;
        });
      }
      
      return filteredDetails.map((item: any) => {
        const planQty = parseFloat(item.Plan_QTY) || 0;
        const factQty = parseFloat(item.FACT_QTY) || 0;
        const completed = planQty > 0 ? Math.round((factQty / planQty) * 100) : 0;
        
        return {
          orderNo: item.OrderNumber || '',
          articleNumber: item.NomenclatureNumber || '',
          name: item.GroupName || '',
          plan: planQty,
          fact: factQty,
          completed: `${completed}%`
        };
      });
    }
    
    return [];
  }, [translateWorkShop]);

  /** -------------------- API‑запрос -------------------- */
  const fetchProductionData = useCallback(async (date: Date | null) => {
    if (!date) return;

    setLoading(true);
    try {
      // Форматируем дату в локальном часовом поясе
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const formatted = `${year}-${month}-${day}`;  // YYYY-MM-DD
      
      const res = await fetch(
        `/api/Home/Production?date=${formatted}`,
      );

      if (!res.ok) throw new Error(res.statusText);
      const data = await res.json();
      
      // Проверяем есть ли totals в корне ответа
      const hasTotalsInRoot = data && typeof data === 'object' && 'totals' in data;
      
      setProductionData(data);
      // Сбрасываем состояния при загрузке новых данных
      setHoveredWorkShop(null);
      setDefaultWorkShop(null);
    } catch (err) {
      console.error('Ошибка загрузки данных:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  /** -------------------- подгружаем при смене даты -------------------- */
  useEffect(() => {
    fetchProductionData(selectedDate);
  }, [selectedDate, fetchProductionData]);

  /** -------------------- верстка -------------------- */
  
  // Подготавливаем данные для контекста
  const workShopRows = processTable4Data(productionData.table4);
  
  return (
    <ProductionProvider value={{
      fetchProductionData,
      setHoveredWorkShop,
      workShopRows,
      selectedDate,
      productionData
    }}>
      <AutoDashboard>
        <div className="container">
             {/* KPI‑карточки + дату выравниваем в одну строку */}
       <section className="flex flex-wrap items-end gap-6 mb-6 mt-4">
        {/* Карточки: растягиваем пространство с помощью flex-1 */}
        <div className="grid flex-1 gap-6 [grid-template-columns:repeat(auto-fit,minmax(12.5rem,max-content))]">
          {kpiData.map((kpi) => {
            // Для "Month. Plan" используем данные из table2
            if (kpi.label === "Month. Plan" && productionData.table2) {
              const { FactQty_MTD, PlanQty_Month, FactQty_Day } = productionData.table2;
              const percentage = PlanQty_Month > 0 ? Math.round((FactQty_MTD / PlanQty_Month) * 100) : 0;
              const dayPercentage = PlanQty_Month > 0 ? Math.round((FactQty_Day / PlanQty_Month) * 100) : 0;
              return (
                <MetricCard
                  key={kpi.label}
                  label={kpi.label}
                  value={`${percentage}%`}
                  changePercent={dayPercentage}
                  isPositiveMetric={true}
                />
              );
            }
            // Для "Time Loss" используем данные из table3
            if (kpi.label === "Time Loss" && productionData.table3) {
              const { TimeLoss_Month, FactTime_MTD, TimeLoss_PrevMonth, FactTime_PrevMonth } = productionData.table3;
              // Преобразуем строки в числа
              const timeLoss = parseFloat(TimeLoss_Month) || 0;
              const factTime = parseFloat(FactTime_MTD) || 0;
              const timeLossPrev = parseFloat(TimeLoss_PrevMonth) || 0;
              const factTimePrev = parseFloat(FactTime_PrevMonth) || 0;
              
              // Расчет процента потерь для текущего месяца
              const totalTime = timeLoss + factTime;
              const timeLossPercentage = totalTime > 0 ? Math.round((1 - factTime / totalTime) * 100) : 0;
              
              // Расчет процента потерь для предыдущего месяца
              const totalTimePrev = timeLossPrev + factTimePrev;
              const timeLossPercentagePrev = totalTimePrev > 0 ? Math.round((1 - factTimePrev / totalTimePrev) * 100) : 0;
              
              // Разность между текущим и предыдущим месяцем
              const changePercent = timeLossPercentage - timeLossPercentagePrev;
              
              return (
                <MetricCard
                  key={kpi.label}
                  label={kpi.label}
                  value={`${timeLossPercentage}%`}
                  changePercent={changePercent}
                  isPositiveMetric={false}
                />
              );
            }
            // Для остальных карточек используем статические данные
            return (
              <MetricCard
                key={kpi.label}
                label={kpi.label}
                value={kpi.value}
                changePercent={kpi.delta}
                isPositiveMetric={kpi.label !== 'Bounce rate'}
              />
            );
          })}
        </div>

                 {/* Блок с пикером ― прижат к правому краю благодаря ml-auto */}
         <div className="ml-auto">
           <CustomDatePicker
             selectedDate={selectedDate}
             onChange={setSelectedDate}
             placeholder=""
             locale="en"
           />
         </div>
      </section>

      {/* График план/факт */}
      <div className="mb-4">
        <TrendChart productionData={productionData.table1 || []} />
      </div>

      {/* ──────────────── разделительная линия ──────────────── */}
      <hr className="border-t border-gray-200 -mx-6 mb-2" />

      {/* Две мини‑таблицы под графиком */}
      <section className="flex flex-col lg:flex-row gap-4 pt-2 relative">
        <MiniTable
          title="WorkShop"
          secondTitle="Plan/Fact"
          secondTitlePosition="mr-24"
          cols={['WorkShop', 'WorkCenter', 'Plan', 'Fact', 'Compl.']}
          rows={processTable4Data(productionData.table4).map((item: any) => [
            item.workShop,
            item.workCenter,
            item.planQty.toLocaleString(),
            item.factQty.toLocaleString(),
            item.completed,
          ])}
          onRowHover={(workShop, workCenter) => {
            setHoveredWorkShop({ workShop, workCenter });
          }}
          onRowLeave={() => {
            setHoveredWorkShop(null);
          }}
        />

        {/* Вертикальная линия‑разделитель */}
        <div className="absolute top-0 bottom-0 left-1/2 w-px bg-gray-200 -translate-x-1/2" />

        <MiniTable
          title="Details"
          secondTitle="Plan/Fact"
          secondTitlePosition="mr-16"
          cols={['Order No', 'Article Number', 'Name', 'Plan', 'Fact', 'Compl.']}
          rows={processTable4Details(productionData.table4, hoveredWorkShop || defaultWorkShop).map((item: any) => [
            item.orderNo,
            item.articleNumber,
            item.name,
            item.plan,
            item.fact,
            item.completed,
          ])}
        />
      </section>


        </div>
      </AutoDashboard>
    </ProductionProvider>
  );
}
