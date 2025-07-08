import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { addDays, format, startOfMonth } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import testData from "../../../Test/MonthPlanTab.json";
import FilterPopover from "../../../components/DataTable/FilterPopover";

/* ───────── types ───────── */
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
type ColKey =
  | "group"
  | "order_no"
  | "article"
  | "name"
  | "order_qty"
  | "total_plan"
  | "total_fact";

/* ───────── constants ───────── */
const VERTICAL_FACTOR = -0.5;
const DIVIDER_CLS = "border-l border-gray-300";

const LEGEND_VERTICAL_OFFSET = 0; // px, регулирует вертикальное смещение легенды
const BTN_VERTICAL_OFFSET = 13; // px, регулирует вертикальное смещение кнопки

/* ───────── component ───────── */
const MonthPlanTab: React.FC = () => {
  const { t } = useTranslation("planTranslation");

  /* ----- state ----- */
  const today = new Date();
  const [year, setYear]   = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [data, setData]   = useState<PlanFactRow[]>([]);
  const [showDetails, setShowDetails] = useState(false);

  /* filters */
  const [filters, setFilters] = useState<Record<ColKey, string[]>>({
    group: [], order_no: [], article: [], name: [],
    order_qty: [], total_plan: [], total_fact: [],
  });

  /* refs & layout */
  const containerRef   = useRef<HTMLDivElement>(null);
  const sigmaThRef     = useRef<HTMLTableCellElement>(null);
  const firstDayThRef  = useRef<HTMLTableCellElement>(null); // нуж­но для легенды
  const ymPanelRef     = useRef<HTMLDivElement>(null);

  const [btnPos,     setBtnPos]     = useState({ left: 0, top: 0 });
  const [legendLeft, setLegendLeft] = useState(0);

  /* ----- helpers ----- */
  const days = useMemo(() => {
    const first = startOfMonth(new Date(year, month - 1));
    const len   = new Date(year, month, 0).getDate();
    return Array.from({ length: len }, (_, i) =>
      format(addDays(first, i), "yyyy-MM-dd"),
    );
  }, [year, month]);

  const uniques = useMemo(() => {
    const add = (v: any) => (v === "" || v === null ? "" : String(v));
    return {
      group:       Array.from(new Set(data.map(r => add(r.large_group)))),
      order_no:    Array.from(new Set(data.map(r => add(r.order_no)))),
      article:     Array.from(new Set(data.map(r => add(r.article_number)))),
      name:        Array.from(new Set(data.map(r => add(r.name)))),
      order_qty:   Array.from(new Set(data.map(r => add(r.order_qty)))),
      total_plan:  Array.from(new Set(data.map(r => add(r.total_plan)))),
      total_fact:  Array.from(new Set(data.map(r => add(r.total_fact)))),
    };
  }, [data]);

  const cellValue = (row: PlanFactRow, key: ColKey): string => {
    switch (key) {
      case "group":      return String(row.large_group);
      case "order_no":   return String(row.order_no);
      case "article":    return String(row.article_number);
      case "name":       return String(row.name);
      case "order_qty":  return String(row.order_qty);
      case "total_plan": return String(row.total_plan);
      case "total_fact": return String(row.total_fact);
    }
  };

  const visibleRows = useMemo(
    () =>
      data.filter(row =>
        (Object.keys(filters) as ColKey[]).every(k => {
          const sel = filters[k];
          return sel.length === 0 || sel.includes(cellValue(row, k));
        }),
      ),
    [data, filters],
  );

  /* load data */
  useEffect(() => {
    setData(testData.data as PlanFactRow[]);
  }, [year, month]);

  /* расчёт позиций кнопки и легенды */
  const recalc = useCallback(() => {
    if (
      !containerRef.current ||
      !sigmaThRef.current ||
      !ymPanelRef.current ||
      !firstDayThRef.current
    )
      return;

    const cont = containerRef.current.getBoundingClientRect();
    const th   = sigmaThRef.current.getBoundingClientRect();
    const ym   = ymPanelRef.current.getBoundingClientRect();
    const fd   = firstDayThRef.current.getBoundingClientRect();

    setBtnPos({
      left: th.left - cont.left + th.width / 2,
      top:  ym.bottom - cont.top + (th.top - ym.bottom) * VERTICAL_FACTOR + BTN_VERTICAL_OFFSET,
    });

    setLegendLeft(fd.right - cont.left + 8); // +8 px отступ
  }, []);

  useLayoutEffect(recalc, [recalc, showDetails, days.length, visibleRows.length]);
  useEffect(() => {
    window.addEventListener("resize", recalc);
    window.addEventListener("scroll", recalc, true);
    return () => {
      window.removeEventListener("resize", recalc);
      window.removeEventListener("scroll", recalc, true);
    };
  }, [recalc]);

  const renderFilter = (key: ColKey) => (
    <FilterPopover
      columnId={key}
      uniqueValues={uniques[key]}
      selectedValues={filters[key]}
      onFilterChange={sel => setFilters(f => ({ ...f, [key]: sel }))}
      data={[]}
    />
  );

  /* ───────── render ───────── */
  return (
    <div ref={containerRef} className="relative">
      {/* плавающая кнопка */}
      <button
        className="absolute z-50 -translate-x-1/2 flex items-center justify-center w-5 h-5 rounded-full border border-[#0d1c3d] bg-transparent shadow"
        style={btnPos}
        onClick={() => setShowDetails(v => !v)}
      >
        {showDetails ? <ChevronLeft size={18} color="#0d1c3d" /> : <ChevronRight size={18} color="#0d1c3d" />}
      </button>

      {/* ЛЕГЕНДА */}
      <div
        className="absolute z-40 flex gap-5 text-[15px] text-slate-600 font-bold pointer-events-none"
        style={{ left: legendLeft, top: btnPos.top + LEGEND_VERTICAL_OFFSET }}
      >
        <span className="inline-flex items-center gap-1">
          <span className="w-5 h-5 rounded-full bg-emerald-300/50 ring-1 ring-emerald-300/40" />
          Plan
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="w-5 h-5 rounded-full bg-indigo-200/60 ring-1 ring-indigo-200/40" />
          Fact
        </span>
      </div>

      {/* селекторы год / месяц */}
      <div className="sticky top-0 z-20 bg-gray-15 pb-3">
        <div ref={ymPanelRef} className="flex gap-3">
          {/* YEAR */}
          <select
            value={year}
            onChange={e => setYear(+e.target.value)}
            className="h-9 rounded-lg border-slate-300 shadow-sm px-3 focus:ring-2 focus:ring-indigo-600"
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

          {/* MONTH */}
          <select
            value={month}
            onChange={e => setMonth(+e.target.value)}
            className="h-9 rounded-lg border-slate-300 shadow-sm px-3 focus:ring-2 focus:ring-indigo-600"
          >
            {Array.from({ length: 12 }, (_, i) => (
              <option key={i + 1} value={i + 1}>
                {i + 1}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* таблица */}
      <div
        className="overflow-x-auto overflow-y-auto mt-4 rounded-lg shadow ring-1 ring-slate-200 relative"
        style={{ maxHeight: "80vh" }}
      >
        <table className="min-w-max border-separate border-spacing-0">
          {/* header */}
          <thead>
            <tr className="bg-[color:var(--tbl-head-bg)] text-[#0d1c3d] text-[11px] font-semibold uppercase tracking-wide">
              {/* Group */}
              <th className="sticky top-0 z-10 py-[10px] px-3 border-b border-slate-200 text-center"
                  style={{ background: "var(--tbl-head-bg)" }}>
                <div className="flex justify-center items-center gap-1">
                  {t("tableHeaders.group")} {renderFilter("group")}
                </div>
              </th>

              {/* Order No */}
              <th className="sticky top-0 z-10 py-[10px] px-3 border-b border-slate-200 text-center"
                  style={{ background: "var(--tbl-head-bg)" }}>
                <div className="flex justify-center items-center gap-1">
                  {t("tableHeaders.orderNo")} {renderFilter("order_no")}
                </div>
              </th>

              {/* Article */}
              <th className="sticky top-0 z-10 py-[10px] px-3 border-b border-slate-200 text-center"
                  style={{ background: "var(--tbl-head-bg)" }}>
                <div className="flex justify-center items-center gap-1">
                  {t("tableHeaders.article")} {renderFilter("article")}
                </div>
              </th>

              {/* Name */}
              <th className="sticky top-0 z-10 py-[10px] px-3 border-b border-slate-200 text-center"
                  style={{ background: "var(--tbl-head-bg)" }}>
                <div className="flex justify-center items-center gap-1">
                  {t("tableHeaders.name")} {renderFilter("name")}
                </div>
              </th>

              {/* Order QTY */}
              <th className="sticky top-0 z-10 py-[10px] px-3 border-b border-slate-200 text-center"
                  style={{ background: "var(--tbl-head-bg)" }}>
                <div className="flex justify-center items-center gap-1">
                  {t("tableHeaders.orderQty")} {renderFilter("order_qty")}
                </div>
              </th>

              {/* Σ PLAN */}
              <th className="sticky top-0 z-10 py-[10px] px-3 border-b border-slate-200 text-center"
                  style={{ background: "var(--tbl-head-bg)" }}>
                <div className="flex justify-center items-center gap-1">
                  {t("tableHeaders.totalPlan")} {renderFilter("total_plan")}
                </div>
              </th>

              {/* Σ FACT */}
              <th ref={sigmaThRef}
                  className="sticky top-0 z-10 py-[10px] px-3 border-b border-slate-200 text-center"
                  style={{ background: "var(--tbl-head-bg)" }}>
                <div className="flex justify-center items-center gap-1">
                  {t("tableHeaders.totalFact")} {renderFilter("total_fact")}
                </div>
              </th>

              {/* деталка */}
              {showDetails &&
                [
                  t("tableHeaders.totalFactQty"),
                  t("tableHeaders.planStart"),
                  t("tableHeaders.planEnd"),
                  t("tableHeaders.factStart"),
                  t("tableHeaders.factEnd"),
                ].map(h => (
                  <th key={h}
                      className="sticky top-0 z-10 py-[10px] px-3 border-b border-slate-200 text-center"
                      style={{ background: "var(--tbl-head-bg)" }}>
                    <div className="flex justify-center items-center gap-1">
                      {h}
                    </div>
                  </th>
                ))}

              {/* дни */}
              {days.map((d, i) => (
                <th
                  key={d}
                  /* передаём ref только для «01» */
                  ref={i === 0 ? firstDayThRef : undefined}
                  className={`sticky top-0 z-10 py-[10px] px-2 border-b text-center text-[10px] ${
                    i === 0 ? DIVIDER_CLS : ""
                  }`}
                  style={{ background: "var(--tbl-head-bg)" }}
                >
                  {i === 0 && (
                    <span
                      className="absolute -top-4 left-0 w-px h-4 bg-gray-300"
                      aria-hidden
                    />
                  )}
                  {d.slice(8)}
                </th>
              ))}
            </tr>
          </thead>

          {/* body */}
          <tbody className="text-[15px] text-slate-700">
            {visibleRows.map(row => {
              /* диапазоны план/факт */
              const planIdxs: number[] = [];
              const factIdxs: number[] = [];
              days.forEach((d, i) => {
                const v = row.daily[d];
                if (v?.plan) planIdxs.push(i);
                if (v?.fact) factIdxs.push(i);
              });
              const planStart = planIdxs[0] ?? -1;
              const planEnd   = planIdxs.at(-1) ?? -1;
              const factStart = factIdxs[0] ?? -1;
              const factEnd   = factIdxs.at(-1) ?? -1;
              const hasPlan   = planStart !== -1;
              const hasFact   = factStart !== -1;

              const factOk  = row.total_fact === row.total_plan || row.total_fact === row.order_qty;
              const factCls = factOk ? "text-emerald-600" : "text-red-500/80";

              return (
                <tr key={row.order_no + row.article_number}
                    className="odd:bg-white even:bg-slate-50 hover:bg-indigo-50/40"
                    style={{ height: 32 }}>
                  {/* обычные ячейки */}
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
                  <td className={`py-2 px-3 text-right font-semibold ${factCls}`}>
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

                  {/* дни */}
                  {days.map((d, i) => {
                    const v = row.daily[d] || { plan: 0, fact: 0 };
                    const isPlan = hasPlan && i >= planStart && i <= planEnd;
                    const isFact = hasFact && i >= factStart && i <= factEnd;

                    const planBarCls = [
                      "h-4",
                      isPlan
                        ? "bg-emerald-300/50 ring-1 ring-emerald-300/40 shadow-sm flex items-center justify-center"
                        : "",
                      isPlan && i === planStart ? "rounded-l-full" : "",
                      isPlan && i === planEnd ? "rounded-r-full" : "",
                    ].join(" ");

                    const factBarCls = [
                      "h-4",
                      isFact
                        ? "bg-indigo-200/60 ring-1 ring-indigo-200/40 shadow-sm flex items-center justify-center"
                        : "",
                      isFact && i === factStart ? "rounded-l-full" : "",
                      isFact && i === factEnd ? "rounded-r-full" : "",
                    ].join(" ");

                    return (
                      <td
                        key={d}
                        className={`p-0 border-y ${i === 0 ? DIVIDER_CLS : ""}`}
                        style={{ width: 28 }}
                      >
                        <div className="flex flex-col h-full">
                          <div className={planBarCls}>
                            {isPlan && v.plan ? (
                              <span className="text-[10px]">
                                {v.plan.toLocaleString("ru-RU")}
                              </span>
                            ) : null}
                          </div>
                          <div className={factBarCls}>
                            {isFact && v.fact ? (
                              <span className="text-[10px]">
                                {v.fact.toLocaleString("ru-RU")}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default MonthPlanTab;
