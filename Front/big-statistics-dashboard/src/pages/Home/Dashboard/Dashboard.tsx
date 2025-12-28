import React, { useMemo, useState, useEffect, useLayoutEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ContentLayout } from '../../../components/Layout';
import { usePlanSummary } from './hooks/usePlanSummary';
import { useOrdersSummary } from './hooks/useOrdersSummary';
import { useSalePlanYTD } from './hooks/useSalePlanYTD';
import { useShipmentPlan } from './hooks/useShipmentPlan';
import { useTimeLossTopReasons } from './hooks/useTimeLossTopReasons';
import { useRegionsMonthlyData } from './hooks/useRegionsMonthlyData';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';
import { formatNumberK, formatFact } from './utils/formatNumber';
import { DonutChart } from '../../../components/KPICards';
import { Package, Clock, Circle, Lock, Calendar, Factory, Tv, ShoppingCart } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { FlagIcon } from '../../../components/FlagIcon';
import { ShipmentPlanMetricCard } from './components/ShipmentPlanMetricCard';
import { MonthlyPlanCard } from './components/MonthlyPlanCard';

const Dashboard: React.FC = () => {
  const { data, loading, error } = usePlanSummary();
  const { data: ordersData, loading: ordersLoading, error: ordersError } = useOrdersSummary();
  const { data: salePlanData, loading: salePlanLoading, error: salePlanError } = useSalePlanYTD();
  const { data: shipmentPlanData, loading: shipmentPlanLoading, error: shipmentPlanError } = useShipmentPlan();
  const { data: timeLossData, loading: timeLossLoading, error: timeLossError } = useTimeLossTopReasons();
  const { data: regionsMonthlyData, loading: regionsLoading, error: regionsError } = useRegionsMonthlyData();
  
  // Вычисляем накопительный итог, максимум и среднее для Regions
  const regionsStats = useMemo(() => {
    if (!regionsMonthlyData || regionsMonthlyData.length === 0) {
      return { 
        production: { cumulative: 0, max: 0, avg: 0 }, 
        shipment: { cumulative: 0, max: 0, avg: 0 } 
      };
    }
    
    const today = new Date();
    const currentMonth = today.getMonth() + 1; // 1-12
    
    let productionCumulative = 0;
    let shipmentCumulative = 0;
    let productionMax = 0;
    let shipmentMax = 0;
    let productionSum = 0;
    let shipmentSum = 0;
    let productionCount = 0;
    let shipmentCount = 0;
    
    regionsMonthlyData.forEach(item => {
      const itemMonth = item.month;
      const isPastOrCurrentMonth = itemMonth <= currentMonth;
      
      // Cumulative и Max считаем для всех месяцев (как было)
      productionCumulative += item.production_fact || 0;
      shipmentCumulative += item.shipment || 0;
      productionMax = Math.max(productionMax, item.production_fact || 0);
      shipmentMax = Math.max(shipmentMax, item.shipment || 0);
      
      // Для AVG учитываем только месяцы до текущего включительно
      // Не включаем нули для будущих месяцев (месяцев, которые еще не наступили)
      if (isPastOrCurrentMonth) {
        const productionValue = item.production_fact || 0;
        const shipmentValue = item.shipment || 0;
        
        // Считаем все значения для прошедших и текущего месяца (включая нули, если они реальные)
        // Но исключаем нули для будущих месяцев
        // Так как мы уже отфильтровали по isPastOrCurrentMonth, учитываем все значения
        productionSum += productionValue;
        productionCount++;
        shipmentSum += shipmentValue;
        shipmentCount++;
      }
    });
    
    // Рассчитываем среднее (делим на количество месяцев с данными)
    const productionAvg = productionCount > 0 ? productionSum / productionCount : 0;
    const shipmentAvg = shipmentCount > 0 ? shipmentSum / shipmentCount : 0;
    
    return {
      production: { cumulative: productionCumulative, max: productionMax, avg: productionAvg },
      shipment: { cumulative: shipmentCumulative, max: shipmentMax, avg: shipmentAvg }
    };
  }, [regionsMonthlyData]);
  
  // Вычисляем эффективность для кружка
  const timeLossEfficiency = useMemo(() => {
    if (!timeLossData || !timeLossData.reasons || timeLossData.reasons.length === 0) return null;
    
    const totalLoss = timeLossData.reasons.reduce((sum, r) => sum + (r.total_hours || 0), 0);
    const factTime = timeLossData.fact_time || 0;
    
    if (factTime + totalLoss === 0) return null;
    
    return Math.round((factTime / (factTime + totalLoss)) * 100);
  }, [timeLossData]);
  const navigate = useNavigate();

  // Состояние для отслеживания готовности к показу (после рендеринга)
  const [isReadyToShow, setIsReadyToShow] = useState(false);
  const renderTimeoutRef = useRef<number | null>(null);

  // Проверяем, загружены ли все данные
  const allDataLoaded = !loading && !ordersLoading && !salePlanLoading && !shipmentPlanLoading && !timeLossLoading && !regionsLoading;

  // После загрузки всех данных ждем завершения рендеринга
  useLayoutEffect(() => {
    if (!allDataLoaded) {
      setIsReadyToShow(false);
      if (renderTimeoutRef.current) {
        clearTimeout(renderTimeoutRef.current);
      }
      return;
    }

    // Очищаем предыдущий таймаут
    if (renderTimeoutRef.current) {
      clearTimeout(renderTimeoutRef.current);
    }

    // Ждем следующий кадр рендеринга для гарантии, что DOM обновлен
    requestAnimationFrame(() => {
      // Еще один кадр для гарантии, что все размеры рассчитаны
      requestAnimationFrame(() => {
        // Небольшая задержка для завершения всех асинхронных операций рендеринга
        renderTimeoutRef.current = setTimeout(() => {
          setIsReadyToShow(true);
        }, 100); // 100ms задержка для завершения рендеринга таблиц и контейнеров
      });
    });

    return () => {
      if (renderTimeoutRef.current) {
        clearTimeout(renderTimeoutRef.current);
      }
    };
  }, [allDataLoaded]);

  // Показываем спиннер пока данные загружаются или компоненты рендерятся
  if (!allDataLoaded || !isReadyToShow) {
    return (
      <ContentLayout>
        <LoadingSpinner overlay="screen" size="xl" />
      </ContentLayout>
    );
  }

  if (error || ordersError || salePlanError || shipmentPlanError || timeLossError) {
    return (
      <ContentLayout>
        <div className="flex items-center justify-center h-96">
          <p className="text-red-600">Error loading data: {error || ordersError || salePlanError || timeLossError}</p>
        </div>
      </ContentLayout>
    );
  }

  const percentQty = data?.total_qty?.percentage || 0;
  const percentTime = data?.total_time?.percentage || 0;

  // Функция для определения цвета по проценту (как в Production)
  const getColorByPercentage = (percentage: number) => {
    if (percentage < 75) {
      return '#b91c1c'; // red-700
    } else if (percentage < 95) {
      return '#ea580c'; // orange-600
    } else {
      return '#15803d'; // green-700
    }
  };

  // Функция для определения классов бейджа по проценту
  const getBadgeClasses = (percentage: number) => {
    if (percentage < 75) {
      return 'bg-red-100 text-red-700';
    } else if (percentage < 95) {
      return 'bg-orange-100 text-orange-600';
    } else {
      return 'bg-green-100 text-green-700';
    }
  };

  const chartColor = getColorByPercentage(percentQty);
  const qtyBadgeClasses = getBadgeClasses(percentQty);
  const timeBadgeClasses = getBadgeClasses(percentTime);

  // Собираем все карточки в массив для распределения по колонкам
  const allCards = [
    // Карточка 1 - Sale Plan
    <div
      key="sale-plan" 
            className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow cursor-pointer" 
            onClick={() => navigate('/orders?tab=saleplan')}
          >
            {/* Header */}
            <div className="bg-gray-50 px-6 py-3 rounded-t-xl border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-gray-800 leading-none">Sale Plan</h3>
                <div className="flex items-center gap-6">
                  <div className="w-24 text-right text-[11.6px] font-semibold text-gray-500 uppercase tracking-wider leading-none">YTD Plan</div>
                  <div className="w-24 text-right text-[11.6px] font-semibold text-gray-500 uppercase tracking-wider leading-none">YTD Fact</div>
                  <div className="w-24 text-right text-[11.6px] font-semibold text-gray-500 uppercase tracking-wider leading-none">YTD Diff</div>
                </div>
              </div>
            </div>

            {/* Body */}
            <div className="px-6 py-2 divide-y divide-gray-200 tabular-nums">
              {salePlanData?.ytd_by_market && salePlanData.ytd_by_market.length > 0 ? (
                <>
                  {salePlanData.ytd_by_market.map((item, index) => {
                    // Рассчитываем процент размещения
                    const percentage = item.ytd_plan > 0 
                      ? Math.round((item.ytd_fact / item.ytd_plan) * 100) 
                      : (item.ytd_fact > 0 ? 100 : 0);
                    
                    // Цвет круга в зависимости от процента
                    const circleColor = getColorByPercentage(percentage);
                    
                    return (
                      <div 
                        key={item.market} 
                        className="flex items-center justify-between py-3 hover:bg-gray-50"
                      >
                        <div className="flex-1 min-w-0 mr-4">
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2 min-w-0">
                              <FlagIcon market={item.market} />
                              <span className="truncate text-[13px] font-medium text-gray-900">{item.market}</span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <Circle size={10} fill={circleColor} color={circleColor} />
                              <span className="text-[12px] text-gray-500 font-medium">{percentage}%</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-6">
                          <div className="w-24 text-right text-[13px] text-gray-500 font-semibold">
                            {formatFact(item.ytd_plan)}
                          </div>
                          <div className="w-24 text-right text-[13px] font-semibold text-[#0d1c3d]">
                            {formatFact(item.ytd_fact)}
                          </div>
                          <div className="w-24 text-right">
                            <div className={`inline-block text-[12px] font-semibold py-1 px-2 rounded ${getBadgeClasses(percentage)}`}>
                              {formatFact(item.ytd_diff)}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  
                  {/* Total строка */}
                  {(() => {
                    const totalPlan = salePlanData.ytd_by_market.reduce((sum, item) => sum + item.ytd_plan, 0);
                    const totalFact = salePlanData.ytd_by_market.reduce((sum, item) => sum + item.ytd_fact, 0);
                    const totalDiff = salePlanData.ytd_by_market.reduce((sum, item) => sum + item.ytd_diff, 0);
                    const totalPercentage = totalPlan > 0 
                      ? Math.round((totalFact / totalPlan) * 100) 
                      : (totalFact > 0 ? 100 : 0);
                    const totalCircleColor = getColorByPercentage(totalPercentage);
                    
                    return (
                      <div className="flex items-center justify-between py-3 border-t border-gray-300">
                        <div className="flex-1 min-w-0 mr-4">
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-[13px] font-semibold text-gray-900">Total</span>
                            <div className="flex items-center gap-2 shrink-0">
                              <Circle size={10} fill={totalCircleColor} color={totalCircleColor} />
                              <span className="text-[12px] text-gray-500 font-medium">{totalPercentage}%</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-6">
                          <div className="w-24 text-right text-[13px] font-semibold text-gray-500">
                            {formatFact(totalPlan)}
                          </div>
                          <div className="w-24 text-right text-[13px] font-semibold text-[#0d1c3d]">
                            {formatFact(totalFact)}
                          </div>
                          <div className="w-24 text-right">
                            <div className={`inline-block text-[12px] font-semibold py-1 px-2 rounded ${getBadgeClasses(totalPercentage)}`}>
                              {formatFact(totalDiff)}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </>
              ) : (
                <div className="text-center text-gray-400 py-8">
                  No sale plan data
                </div>
              )}
            </div>
          </div>,

    // Карточка 2 - Monthly Plan
    <div key="monthly-plan">
      <MonthlyPlanCard
              title="Monthly Plan"
              rows={
                data?.groups?.map((group) => ({
                  group: group.large_group,
                  plan: group.total_qty.plan,
                  fact: group.total_qty.fact,
                  percent: group.total_qty.percentage,
                })) || []
              }
              onClick={() => navigate('/plan')}
              formatFact={formatFact}
              formatNumberK={formatNumberK}
      />
    </div>,

    // Карточка 3 - Regions (две маленькие + одна большая)
    <div key="regions" className="flex flex-col gap-4">
      {/* Две маленькие плитки в одну строку */}
      <div className="flex gap-6">
        <div 
          className="flex-[2] bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
          onClick={() => navigate('/production?tab=timeLoss')}
        >
          {/* Header */}
          <div className="bg-gray-50 px-6 py-1.5 rounded-t-xl border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-gray-800 leading-none">Time Loss</h3>
              {timeLossEfficiency !== null ? (
                <div 
                  className="w-9 h-9 rounded-full bg-white border-2 border-gray-300 shadow-inner -mr-2 flex items-center justify-center"
                  style={{ borderColor: getColorByPercentage(timeLossEfficiency) }}
                >
                  <span className="text-[10px] font-bold" style={{ color: getColorByPercentage(timeLossEfficiency) }}>
                    {timeLossEfficiency}%
                  </span>
                </div>
              ) : (
                <div className="w-9 h-9 rounded-full bg-white border-2 border-gray-300 shadow-inner -mr-2"></div>
              )}
            </div>
          </div>

          {/* Body */}
          <div className="px-6 py-2 divide-y divide-gray-200 tabular-nums">
            {timeLossData && timeLossData.reasons && timeLossData.reasons.length > 0 ? (
              <>
                {timeLossData.reasons.slice(0, 4).map((reason, index) => (
                  <div 
                    key={`${reason.reason_en || reason.reason_zh}-${index}`} 
                    className="flex items-center justify-between py-3 hover:bg-gray-50"
                  >
                    <div className="flex-1 min-w-0 mr-4">
                      <div className="text-[13px] font-medium text-gray-900">
                        {reason.reason_en || reason.reason_zh}
                      </div>
                    </div>
                    <div className="w-24 text-right text-[13px] font-semibold text-[#0d1c3d]">
                      {formatFact(reason.total_hours)}
                    </div>
                  </div>
                ))}
                {/* Others - сумма остальных причин (если их больше 4) */}
                {timeLossData.reasons.length > 4 && (() => {
                  const othersSum = timeLossData.reasons.slice(4).reduce((sum, r) => sum + (r.total_hours || 0), 0);
                  return (
                    <div className="flex items-center justify-between py-3 border-t border-gray-300 hover:bg-gray-50">
                      <div className="flex-1 min-w-0 mr-4">
                        <div className="text-[13px] font-semibold text-gray-900">Others</div>
                      </div>
                      <div className="w-24 text-right text-[13px] font-semibold text-[#0d1c3d]">
                        {formatFact(othersSum)}
                      </div>
                    </div>
                  );
                })()}
                {/* Total - сумма всех потерь */}
                {(() => {
                  const totalSum = timeLossData.reasons.reduce((sum, r) => sum + (r.total_hours || 0), 0);
                  return (
                    <div className="flex items-center justify-between py-3 border-t border-gray-300 hover:bg-gray-50">
                      <div className="flex-1 min-w-0 mr-4">
                        <div className="text-[13px] font-semibold text-gray-900">Total</div>
                      </div>
                      <div className="w-24 text-right text-[13px] font-semibold text-[#0d1c3d]">
                        {formatFact(totalSum)}
                      </div>
                    </div>
                  );
                })()}
              </>
            ) : (
              <div className="text-center text-gray-400 py-8">
                No time loss data
              </div>
            )}
          </div>
        </div>
        <div className="flex-1 bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
          {/* Header */}
          <div className="bg-gray-50 px-6 py-4 rounded-t-xl border-b border-gray-200">
            <h3 className="text-base font-semibold text-gray-800 leading-none">Navigation</h3>
          </div>
          {/* Body */}
          <div className="flex flex-col">
            {/* Ссылка на Daily Plan-Fact */}
            <button
              onClick={() => navigate('/production?tab=dailyPlanFact')}
              className="flex items-center gap-3 px-6 py-3 hover:bg-gray-50 transition-colors text-left"
            >
              <Factory className="w-5 h-5 text-gray-600" />
              <span className="text-sm font-medium text-gray-700">Daily Plan-Fact</span>
            </button>
            {/* Ссылка на TV */}
            <button
              onClick={() => navigate('/tv')}
              className="flex items-center gap-3 px-6 py-3 hover:bg-gray-50 transition-colors text-left"
            >
              <Tv className="w-5 h-5 text-gray-600" />
              <span className="text-sm font-medium text-gray-700">TV</span>
            </button>
            {/* Ссылка на Customer Orders Order Log */}
            <button
              onClick={() => navigate('/orders?tab=orderdata')}
              className="flex items-center gap-3 px-6 py-3 hover:bg-gray-50 transition-colors text-left"
            >
              <ShoppingCart className="w-5 h-5 text-gray-600" />
              <span className="text-sm font-medium text-gray-700">Customer Orders</span>
            </button>
          </div>
        </div>
      </div>
      {/* Одна большая плитка снизу */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
        {/* Header */}
        <div className="bg-gray-50 px-6 py-4 rounded-t-xl border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-gray-800 leading-none">Yearly Performance</h3>
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-[#10b981]"></div>
                <span className="text-gray-600">Production</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-[#3b82f6]"></div>
                <span className="text-gray-600">Shipment</span>
              </div>
            </div>
          </div>
        </div>
        <div className="h-64 pt-2">
          {regionsError ? (
            <div className="flex items-center justify-center h-full text-red-500">
              Error loading data
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={regionsMonthlyData.map(item => ({
                  month: item.month_name,
                  shipment: item.shipment,
                  production_fact: item.production_fact
                }))}
                margin={{ top: 0, right: 0, left: -20, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis 
                  tick={{ fontSize: 12 }} 
                  tickFormatter={(value) => {
                    if (value >= 1000) {
                      return `${(value / 1000).toFixed(0)}K`;
                    }
                    return value.toString();
                  }}
                />
                <Tooltip 
                  formatter={(value: any, name: string) => {
                    const formattedValue = typeof value === 'number' 
                      ? value.toLocaleString('ru-RU').replace(/\s/g, '\u00A0')
                      : value;
                    const label = name === 'shipment' ? 'Shipment' : name === 'production_fact' ? 'Production' : name;
                    return [formattedValue, label];
                  }}
                />
                <Bar dataKey="shipment" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="production_fact" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
        {/* Статистика под графиком */}
        <div className="border-t border-gray-200">
          {/* Header */}
          <div className="px-6 py-3 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <div className="text-[11.6px] font-semibold text-gray-500 uppercase tracking-wider leading-none">Metric</div>
              </div>
              <div className="flex items-center gap-6">
                <div className="w-24 text-[11.6px] font-semibold text-gray-500 uppercase tracking-wider leading-none text-right">Avg</div>
                <div className="w-24 text-[11.6px] font-semibold text-gray-500 uppercase tracking-wider leading-none text-right">Max</div>
                <div className="w-24 text-[11.6px] font-semibold text-gray-500 uppercase tracking-wider leading-none text-right">Total</div>
              </div>
            </div>
          </div>
          {/* Body */}
          <div className="px-6 py-2 divide-y divide-gray-200 tabular-nums">
            {/* Production row */}
            <div className="flex items-center justify-between py-2.5 hover:bg-gray-50">
              <div className="flex-1 min-w-0 mr-4">
                <div className="text-[12px] font-medium text-gray-900">Production</div>
              </div>
              <div className="flex items-center gap-6">
                <div className="w-24 text-right text-[12px] font-semibold text-[#0d1c3d]">
                  {formatFact(regionsStats.production.avg)}
                </div>
                <div className="w-24 text-right text-[12px] font-semibold text-[#0d1c3d]">
                  {formatFact(regionsStats.production.max)}
                </div>
                <div className="w-24 text-right text-[12px] font-semibold text-[#0d1c3d]">
                  {formatFact(regionsStats.production.cumulative)}
                </div>
              </div>
            </div>
            {/* Shipment row */}
            <div className="flex items-center justify-between py-2.5 hover:bg-gray-50">
              <div className="flex-1 min-w-0 mr-4">
                <div className="text-[12px] font-medium text-gray-900">Shipment</div>
              </div>
              <div className="flex items-center gap-6">
                <div className="w-24 text-right text-[12px] font-semibold text-[#0d1c3d]">
                  {formatFact(regionsStats.shipment.avg)}
                </div>
                <div className="w-24 text-right text-[12px] font-semibold text-[#0d1c3d]">
                  {formatFact(regionsStats.shipment.max)}
                </div>
                <div className="w-24 text-right text-[12px] font-semibold text-[#0d1c3d]">
                  {formatFact(regionsStats.shipment.cumulative)}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>,

    // Карточка 4 - Uncompl. Orders
    <div
      key="uncompl-orders" 
            className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow cursor-pointer" 
            onClick={() => navigate('/orders')}
          >
            {/* Header */}
            <div className="bg-gray-50 px-6 py-3 rounded-t-xl border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-gray-800 leading-none">Uncompl. Orders</h3>
                <div className="flex items-center gap-6">
                  <div className="w-24 text-right text-[11.6px] font-semibold text-gray-500 uppercase tracking-wider leading-none">Total</div>
                  <div className="w-24 text-right text-[11.6px] font-semibold text-gray-500 uppercase tracking-wider leading-none">Plan</div>
                  <div className="w-24 text-right text-[11.6px] font-semibold text-gray-500 uppercase tracking-wider leading-none">Remaining</div>
                </div>
              </div>
            </div>

            {/* Body */}
            <div className="px-6 py-2 divide-y divide-gray-200 tabular-nums">
              {ordersData?.orders_by_market && ordersData.orders_by_market.length > 0 ? (
                <>
                  {ordersData.orders_by_market.map((order, index) => (
                    <div 
                      key={order.market} 
                      className="flex items-center justify-between py-3 hover:bg-gray-50"
                    >
                      <div className="flex-1 min-w-0 mr-4">
                        <div className="flex items-center gap-2 min-w-0">
                          <FlagIcon market={order.market} />
                          <span className="truncate text-[13px] font-medium text-gray-900">{order.market}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-6">
                        <div className="w-24 text-right text-[13px] font-semibold text-gray-500">
                          {formatFact(order.uncompleted_orders)}
                        </div>
                        <div className="w-24 text-right text-[13px] font-semibold text-gray-500">
                          {formatFact(order.plan_remaining)}
                        </div>
                        <div className="w-24 text-right text-[13px] font-semibold text-[#0d1c3d]">
                          {formatFact(order.uncompleted_orders - order.plan_remaining)}
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  {/* Total строка */}
                  <div className="flex items-center justify-between py-3 border-t border-gray-300">
                    <div className="flex-1 min-w-0 mr-4">
                      <span className="text-[13px] font-semibold text-gray-900">Total</span>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="w-24 text-right text-[13px] font-semibold text-gray-500">
                        {formatFact(
                          ordersData.orders_by_market.reduce((sum, order) => sum + order.uncompleted_orders, 0)
                        )}
                      </div>
                      <div className="w-24 text-right text-[13px] font-semibold text-gray-500">
                        {formatFact(
                          ordersData.orders_by_market.reduce((sum, order) => sum + order.plan_remaining, 0)
                        )}
                      </div>
                      <div className="w-24 text-right text-[13px] font-semibold text-[#0d1c3d]">
                        {formatFact(
                          ordersData.orders_by_market.reduce((sum, order) => sum + (order.uncompleted_orders - order.plan_remaining), 0)
                        )}
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center text-gray-400 py-8">
                  No uncompleted orders
                </div>
              )}
            </div>
          </div>,

    // Карточка 5 - Shipment Plan
    <div 
      key="shipment-plan" 
      className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
      onClick={() => navigate('/orders?tab=shipment')}
    >
            {shipmentPlanData?.weeks_data && shipmentPlanData.weeks_data.length > 0 ? (
              (() => {
                // Сортируем недели по номеру
                const weeksSorted = [...(shipmentPlanData.weeks_data || [])]
                  .filter(w => w.week_no !== null && w.week_no !== undefined)
                  .sort((a, b) => (a.week_no ?? 0) - (b.week_no ?? 0));
                
                const totalWeeks = weeksSorted.length;

                // Рассчитываем totals
                const monthPlanSum = weeksSorted.reduce((sum, week) => sum + (week.month_plan || 0), 0);
                const weekPlanSum = weeksSorted.reduce((sum, week) => sum + (week.week_plan || 0), 0);
                const factSum = weeksSorted.reduce((sum, week) => sum + (week.fact || 0), 0);
                
                const execByWeekPlan = monthPlanSum > 0 ? Math.round((factSum / monthPlanSum) * 100) : 0;
                
                const overallBadge = getBadgeClasses(execByWeekPlan);

                return (
                  <>
                    {/* Header */}
                    <div className="bg-gray-50 px-6 py-3 rounded-t-xl border-b border-gray-200">
                      <div className="flex items-center justify-between">
                        <h3 className="text-base font-semibold text-gray-800 leading-none">Shipment Plan</h3>
                        <div className="flex items-center gap-4">
                          {/* Overall block */}
                          <div className="flex items-center gap-3 text-[14px] text-gray-600">
                            <span>
                              <span className="text-gray-500">Month plan:</span>{' '}
                              <span className="font-semibold text-gray-700">{formatNumberK(monthPlanSum)}</span>
                            </span>
                            <span>
                              <span className="text-gray-500">Week plan:</span>{' '}
                              <span className="font-semibold text-gray-700">{formatNumberK(weekPlanSum)}</span>
                            </span>
                            <span>
                              <span className="text-gray-500">Fact:</span>{' '}
                              <span className="font-semibold text-[#0d1c3d]">{formatNumberK(factSum)}</span>
                            </span>
                            <span>
                              <span className={`font-semibold py-0.5 px-1.5 rounded inline-block ${overallBadge}`}>
                                {execByWeekPlan}%
                              </span>
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Body */}
                    <div className="px-6 py-2 divide-y divide-gray-200 tabular-nums">

                      {weeksSorted.map((week, idx) => {
                        const percentWeek = week.week_plan > 0 
                          ? Math.round((week.fact / week.week_plan) * 100) 
                          : 0;
                        const fill = Math.min(Math.max(percentWeek, 0), 100);
                        const color = getColorByPercentage(percentWeek);
                        const badge = getBadgeClasses(percentWeek);
                        const isCurrentWeek = shipmentPlanData?.current_week && week.week_no === shipmentPlanData.current_week;

                        return (
                          <div key={week.week_no || `week-${idx}`} className="py-3 hover:bg-gray-50">
                            <div className="flex items-center gap-4">
                              {/* Week label */}
                              <div className={`w-14 text-[13px] font-medium ${isCurrentWeek ? 'text-orange-600' : 'text-gray-900'}`}>
                                {week.week_no ? `${week.week_no}W` : '-'}
                              </div>

                              {/* Timeline (gantt slots) */}
                              <div className="flex-1">
                                {/* Общая шкала: N равных слотов */}
                                <div 
                                  className="relative h-8 rounded-md bg-white grid items-center"
                                  style={{ gridTemplateColumns: `repeat(${totalWeeks}, minmax(0, 1fr))` }}
                                >
                                  {/* Сетка слотов (вертикальные линии) */}
                                  {Array.from({ length: totalWeeks }).map((_, i) => (
                                    <div
                                      key={`grid-${i}`}
                                      className={`h-full ${i !== 0 ? 'border-l border-gray-200' : ''}`}
                                    />
                                  ))}

                                  {/* Бар текущей недели — кладём в свою колонку */}
                                  <div
                                    className="absolute h-full flex items-center justify-center"
                                    style={{
                                      left: `${(idx / totalWeeks) * 100}%`,
                                      width: `${(1 / totalWeeks) * 100}%`
                                    }}
                                  >
                                    <div className="w-[90%]">
                                      {/* подложка */}
                                      <div className="h-3.5 bg-gray-100 border border-gray-200 rounded overflow-hidden">
                                        {/* fill */}
                                        <div
                                          className="h-full transition-all duration-300"
                                          style={{
                                            width: `${fill}%`,
                                            backgroundColor: color,
                                            opacity: 0.9
                                          }}
                                        />
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                {/* Подписи под шкалой */}
                                <div className="mt-1 flex items-center justify-between">
                                  <div className="text-[12px] text-gray-400">
                                    Month split: {formatFact(week.month_plan)}
                                  </div>
                                  <div className="text-[12px] text-gray-500">
                                    {formatFact(week.fact)} / {formatFact(week.week_plan)}
                                  </div>
                                </div>
                              </div>

                              {/* Percent badge */}
                              <div className="w-16 text-right">
                                <span className={`inline-block text-[11px] font-semibold py-1 px-2 rounded ${badge}`}>
                                  {percentWeek}%
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                );
              })()
            ) : (
              <>
                {/* Header (empty state) */}
                <div className="bg-gray-50 px-6 py-3 rounded-t-xl border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-semibold text-gray-800 leading-none">Shipment Plan</h3>
                    <div className="text-[11.6px] font-semibold text-gray-500 uppercase tracking-wider leading-none">
                      Weekly execution
                    </div>
                  </div>
                </div>
                <div className="text-center text-gray-400 py-8">
                  No shipment plan data
                </div>
              </>
            )}
    </div>
  ];

  // Разделяем карточки на 3 колонки
  const columns: React.ReactNode[][] = [[], [], []];
  allCards.forEach((card, index) => {
    columns[index % 3].push(card);
  });

  return (
    <ContentLayout padding="p-0" minHeight="">
      <div data-dashboard="true" className="relative">
        {/* 3 вертикальные колонки */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {columns.map((columnCards, colIndex) => (
            <div key={colIndex} className="flex flex-col gap-6">
              {columnCards.map((card) => card)}
            </div>
          ))}
        </div>
      </div>
    </ContentLayout>
  );
};

export default Dashboard;

