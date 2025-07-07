/**
 * 💄 Стили улучшены — логика и позиционирование НЕ тронуты
 * ▸ селекторы округлённые, с тенью и focus-ring
 * ▸ таблица в «карте»: скругления + тень + тонкая рамка
 * ▸ шапка bg-slate-50, uppercase xs
 * ▸ зебра odd/even + hover-подсветка
 * ▸ Σ Plan (bold) и Σ Fact (bold + indigo-600)
 * ▸ двойная ячейка план/факт — pastel teal / indigo (как было)
 */

import React, {
    useEffect,
    useMemo,
    useRef,
    useState,
    useLayoutEffect,
    useCallback,
  } from "react";
  import { addDays, format, startOfMonth } from "date-fns";
  import testData from "../../../Test/MonthPlanTab.json";
  import { ChevronRight, ChevronLeft } from "lucide-react";
  
  interface PlanFactRow {
    order_no: string;
    article_number: string;
    name: string;
    large_group: string;
    order_qty: number;
    total_fact_qty: number;
    total_plan: number;
    total_fact: number;
    plan_start: string;
    plan_finish: string;
    fact_start: string;
    fact_finish: string;
    daily: Record<string, { plan: number; fact: number } | undefined>;
  }
  
  const VERTICAL_FACTOR = -0.5; // оставляем как есть
  
  const MonthPlanTab = () => {
    /* ---------- state ---------- */
    const today = new Date();
    const [year, setYear] = useState(today.getFullYear());
    const [month, setMonth] = useState(today.getMonth() + 1);
    const [data, setData] = useState<PlanFactRow[]>([]);
    const [showDetails, setShowDetails] = useState(true);
  
    /* ---------- refs ---------- */
    const containerRef = useRef<HTMLDivElement>(null);
    const sigmaThRef = useRef<HTMLTableCellElement>(null);
    const ymPanelRef = useRef<HTMLDivElement>(null);
  
    const [btnPos, setBtnPos] = useState({ left: 0, top: 0 });
  
    /* ---------- helpers ---------- */
    const days = useMemo(() => {
      const first = startOfMonth(new Date(year, month - 1));
      const len = new Date(year, month, 0).getDate();
      return Array.from({ length: len }, (_, i) =>
        format(addDays(first, i), "yyyy-MM-dd")
      );
    }, [year, month]);
  
    /* ---------- mock fetch ---------- */
    useEffect(() => setData(testData.data as PlanFactRow[]), [year, month]);
  
    /* ---------- calc button position ---------- */
    const calcBtn = useCallback(() => {
      if (!containerRef.current || !sigmaThRef.current || !ymPanelRef.current)
        return;
  
      const cont = containerRef.current.getBoundingClientRect();
      const th = sigmaThRef.current.getBoundingClientRect();
      const ym = ymPanelRef.current.getBoundingClientRect();
  
      const left = th.left - cont.left + th.width / 2;
      const gap = th.top - ym.bottom;
      const top = ym.bottom - cont.top + gap * VERTICAL_FACTOR;
  
      setBtnPos({ left, top });
    }, []);
  
    useLayoutEffect(calcBtn, [calcBtn, showDetails, days.length, data.length]);
    useEffect(() => {
      window.addEventListener("resize", calcBtn);
      window.addEventListener("scroll", calcBtn, true);
      return () => {
        window.removeEventListener("resize", calcBtn);
        window.removeEventListener("scroll", calcBtn, true);
      };
    }, [calcBtn]);
  
    /* ---------- render ---------- */
    return (
      <div ref={containerRef} className="relative">
        {/* КНОПКА */}
        <button
          className="absolute z-50 -translate-x-1/2 flex items-center justify-center
                     w-7 h-7 rounded-full bg-white shadow ring-1 ring-slate-300
                     hover:bg-slate-100 transition-colors"
          style={btnPos}
          onClick={() => setShowDetails((v) => !v)}
          title={showDetails ? "Свернуть детали" : "Показать детали"}
        >
          {showDetails ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
        </button>
  
        {/* ТОП-ПАНЕЛЬ */}
        <div className="sticky top-0 z-20 bg-gray-100 pb-3">
          <div ref={ymPanelRef} className="flex gap-3">
            <select
              value={year}
              onChange={(e) => setYear(+e.target.value)}
              className="h-9 rounded-lg border-slate-300 shadow-sm px-3
                         focus:outline-none focus:ring-2 focus:ring-indigo-600"
            >
              {Array.from({ length: 5 }, (_, i) => {
                const y = today.getFullYear() - 2 + i;
                return (
                  <option key={y} value={y}>
                    {y}
                  </option>
                );
              })}
            </select>
            <select
              value={month}
              onChange={(e) => setMonth(+e.target.value)}
              className="h-9 rounded-lg border-slate-300 shadow-sm px-3
                         focus:outline-none focus:ring-2 focus:ring-indigo-600"
            >
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i + 1} value={i + 1}>
                  {i + 1}
                </option>
              ))}
            </select>
          </div>
        </div>
  
        {/* ТАБЛИЦА */}
        <div
          className="overflow-x-auto overflow-y-auto mt-4 rounded-lg shadow
                     ring-1 ring-slate-200"
          style={{ maxHeight: "80vh" }}
        >
          <table className="min-w-max border-separate border-spacing-0">
            <thead>
              <tr className="bg-white text-[11px] uppercase tracking-wide text-slate-600">
                {[
                  "Group",
                  "Order No",
                  "Article",
                  "Name",
                  "Order QTY",
                  "Σ Plan",
                ].map((h) => (
                  <th
                    key={h}
                    className="sticky top-0 z-10 py-2 px-3 border-b border-slate-200 text-left"
                  >
                    {h}
                  </th>
                ))}
                <th
                  ref={sigmaThRef}
                  className="sticky top-0 z-10 py-2 px-3 border-b border-slate-200 text-left"
                >
                  Σ Fact
                </th>
  
                {showDetails &&
                  [
                    "Total Fact QTY",
                    "Plan Start",
                    "Plan End",
                    "Fact Start",
                    "Fact End",
                  ].map((h) => (
                    <th
                      key={h}
                      className="sticky top-0 z-10 py-2 px-3 border-b border-slate-200 text-left"
                    >
                      {h}
                    </th>
                  ))}
  
                {days.map((d) => (
                  <th
                    key={d}
                    className="sticky top-0 z-10 py-1 px-2 border-b border-slate-200 text-center text-[10px]"
                  >
                    {d.slice(8)}
                  </th>
                ))}
              </tr>
            </thead>
  
            <tbody className="text-sm text-slate-700">
              {data.map((row) => (
                <tr
                  key={`${row.order_no}-${row.article_number}`}
                  className="odd:bg-white even:bg-slate-50 hover:bg-indigo-50/40 transition-colors"
                >
                  <td className="py-2 px-3">{row.large_group}</td>
                  <td className="py-2 px-3">{row.order_no}</td>
                  <td className="py-2 px-3">{row.article_number}</td>
                  <td className="py-2 px-3">{row.name}</td>
                  <td className="py-2 px-3 text-right">
                    {row.order_qty.toLocaleString("ru-RU")}
                  </td>
                  <td className="py-2 px-3 text-right font-semibold">
                    {row.total_plan.toLocaleString("ru-RU")}
                  </td>
                  <td className="py-2 px-3 text-right font-semibold text-indigo-600">
                    {row.total_fact.toLocaleString("ru-RU")}
                  </td>
  
                  {showDetails && (
                    <>
                      <td className="py-2 px-3 text-right">
                        {row.total_fact_qty.toLocaleString("ru-RU")}
                      </td>
                      <td className="py-2 px-3">{row.plan_start}</td>
                      <td className="py-2 px-3">{row.plan_finish}</td>
                      <td className="py-2 px-3">{row.fact_start}</td>
                      <td className="py-2 px-3">{row.fact_finish}</td>
                    </>
                  )}
  
                  {days.map((d) => {
                    const v = row.daily[d] || { plan: 0, fact: 0 };
                    return (
                      <td key={d} className="p-0 border-y">
                        <div className="h-5 text-[10px] flex items-center justify-center bg-teal-100/50">
                          {v.plan || ""}
                        </div>
                        <div className="h-5 text-[10px] flex items-center justify-center bg-indigo-100/50">
                          {v.fact || ""}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };
  
  export default MonthPlanTab;
  