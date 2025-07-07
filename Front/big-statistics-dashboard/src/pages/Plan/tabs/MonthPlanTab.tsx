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
import testData from "../../../Test/MonthPlanTab.json";
import FilterPopover from "../../../components/DataTable/FilterPopover";

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

const VERTICAL_FACTOR = -0.5;

type ColKey =
  | "group"
  | "order_no"
  | "article"
  | "name"
  | "order_qty"
  | "total_plan"
  | "total_fact";

const MonthPlanTab: React.FC = () => {
  /* ───────── state ───────── */
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [data, setData]  = useState<PlanFactRow[]>([]);
  const [showDetails, setShowDetails] = useState(false);

  /* фильтры */
  const [filters, setFilters] = useState<Record<ColKey, string[]>>({
    group: [],
    order_no: [],
    article: [],
    name: [],
    order_qty: [],
    total_plan: [],
    total_fact: [],
  });

  /* ───────── refs ───────── */
  const containerRef = useRef<HTMLDivElement>(null);
  const sigmaThRef   = useRef<HTMLTableCellElement>(null);
  const ymPanelRef   = useRef<HTMLDivElement>(null);
  const [btnPos, setBtnPos] = useState({ left: 0, top: 0 });

  /* ───────── helpers ───────── */
  const days = useMemo(() => {
    const first = startOfMonth(new Date(year, month - 1));
    const len   = new Date(year, month, 0).getDate();
    return Array.from({ length: len }, (_, i) =>
      format(addDays(first, i), "yyyy-MM-dd"),
    );
  }, [year, month]);

  /* уникальные значения по колонкам */
  const uniques = useMemo(() => {
    const add = (val: any) => (val === "" || val === null ? "" : String(val));
    return {
      group      : Array.from(new Set(data.map(r => add(r.large_group)))),
      order_no   : Array.from(new Set(data.map(r => add(r.order_no)))),
      article    : Array.from(new Set(data.map(r => add(r.article_number)))),
      name       : Array.from(new Set(data.map(r => add(r.name)))),
      order_qty  : Array.from(new Set(data.map(r => add(r.order_qty)))),
      total_plan : Array.from(new Set(data.map(r => add(r.total_plan)))),
      total_fact : Array.from(new Set(data.map(r => add(r.total_fact)))),
    };
  }, [data]);

  /* функция доступа к значению строки по ключу фильтра */
  const cellValue = (row: PlanFactRow, key: ColKey): string => {
    switch (key) {
      case "group":       return String(row.large_group);
      case "order_no":    return String(row.order_no);
      case "article":     return String(row.article_number);
      case "name":        return String(row.name);
      case "order_qty":   return String(row.order_qty);
      case "total_plan":  return String(row.total_plan);
      case "total_fact":  return String(row.total_fact);
    }
  };

  /* строки после фильтрации */
  const visibleRows = useMemo(() => {
    return data.filter((row) =>
      (Object.keys(filters) as ColKey[]).every((k) => {
        const sel = filters[k];
        return sel.length === 0 || sel.includes(cellValue(row, k));
      }),
    );
  }, [data, filters]);

  /* ───────── загрузка данных ───────── */
  useEffect(() => {
    setData(testData.data as PlanFactRow[]);
  }, [year, month]);

  /* ───────── позиция кнопки ───────── */
  const calcBtn = useCallback(() => {
    if (!containerRef.current || !sigmaThRef.current || !ymPanelRef.current)
      return;
    const cont = containerRef.current.getBoundingClientRect();
    const th   = sigmaThRef.current.getBoundingClientRect();
    const ym   = ymPanelRef.current.getBoundingClientRect();
    setBtnPos({
      left: th.left - cont.left + th.width / 2,
      top : ym.bottom - cont.top + (th.top - ym.bottom) * VERTICAL_FACTOR,
    });
  }, []);

  useLayoutEffect(calcBtn, [calcBtn, showDetails, days.length, visibleRows.length]);
  useEffect(() => {
    window.addEventListener("resize", calcBtn);
    window.addEventListener("scroll", calcBtn, true);
    return () => {
      window.removeEventListener("resize", calcBtn);
      window.removeEventListener("scroll", calcBtn, true);
    };
  }, [calcBtn]);

  /* ───────── helpers для popover ───────── */
  const renderFilter = (key: ColKey) => (
    <FilterPopover
      columnId={key}
      uniqueValues={uniques[key]}
      selectedValues={filters[key]}
      onFilterChange={(sel) =>
        setFilters((f) => ({ ...f, [key]: sel }))
      }
      data={[]}
    />
  );

  /* ───────── render ───────── */
  return (
    <div ref={containerRef} className="relative">
      {/* плавающая кнопка */}
      <button
        className="absolute z-50 -translate-x-1/2 flex items-center justify-center w-7 h-7 rounded-full bg-white shadow ring-1 ring-slate-300 hover:bg-slate-100"
        style={btnPos}
        onClick={() => setShowDetails((v) => !v)}
      >
        {showDetails ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
      </button>

      {/* селекторы год/месяц */}
      <div className="sticky top-0 z-20 bg-gray-15 pb-3">
        <div ref={ymPanelRef} className="flex gap-3">
          <select
            value={year}
            onChange={(e) => setYear(+e.target.value)}
            className="h-9 rounded-lg border-slate-300 shadow-sm px-3 focus:ring-2 focus:ring-indigo-600"
          >
            {Array.from({ length: 5 }, (_, i) => (
              <option key={i} value={today.getFullYear() - 2 + i}>
                {today.getFullYear() - 2 + i}
              </option>
            ))}
          </select>
          <select
            value={month}
            onChange={(e) => setMonth(+e.target.value)}
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
        className="overflow-x-auto overflow-y-auto mt-4 rounded-lg shadow ring-1 ring-slate-200"
        style={{ maxHeight: "80vh" }}
      >
        <table className="min-w-max border-separate border-spacing-0">
          {/* header */}
          <thead>
            <tr className="bg-[color:var(--tbl-head-bg)] text-[11px] font-semibold uppercase tracking-wide">
              {/* Group */}
              <th className="sticky top-0 z-10 py-[10px] px-3 border-b border-slate-200 text-left" style={{background:"var(--tbl-head-bg)"}}>
                Group {renderFilter("group")}
              </th>

              {/* Order No */}
              <th className="sticky top-0 z-10 py-[10px] px-3 border-b border-slate-200 text-left" style={{background:"var(--tbl-head-bg)"}}>
                Order No {renderFilter("order_no")}
              </th>

              {/* Article */}
              <th className="sticky top-0 z-10 py-[10px] px-3 border-b border-slate-200 text-left" style={{background:"var(--tbl-head-bg)"}}>
                Article {renderFilter("article")}
              </th>

              {/* Name */}
              <th className="sticky top-0 z-10 py-[10px] px-3 border-b border-slate-200 text-left" style={{background:"var(--tbl-head-bg)"}}>
                Name {renderFilter("name")}
              </th>

              {/* Order QTY */}
              <th className="sticky top-0 z-10 py-[10px] px-3 border-b border-slate-200 text-left" style={{background:"var(--tbl-head-bg)"}}>
                Order&nbsp;QTY {renderFilter("order_qty")}
              </th>

              {/* Σ Plan */}
              <th className="sticky top-0 z-10 py-[10px] px-3 border-b border-slate-200 text-left" style={{background:"var(--tbl-head-bg)"}}>
                Σ&nbsp;Plan {renderFilter("total_plan")}
              </th>

              {/* Σ Fact */}
              <th ref={sigmaThRef} className="sticky top-0 z-10 py-[10px] px-3 border-b border-slate-200 text-left" style={{background:"var(--tbl-head-bg)"}}>
                Σ&nbsp;Fact {renderFilter("total_fact")}
              </th>

              {/* деталка */}
              {showDetails &&
                ["Total Fact QTY", "Plan Start", "Plan End", "Fact Start", "Fact End"].map(h => (
                  <th key={h} className="sticky top-0 z-10 py-[10px] px-3 border-b border-slate-200 text-left" style={{background:"var(--tbl-head-bg)"}}>
                    {h}
                  </th>
                ))}

              {/* дни */}
              {days.map(d => (
                <th key={d} className="sticky top-0 z-10 py-[10px] px-2 border-b border-slate-200 text-center text-[10px]" style={{background:"var(--tbl-head-bg)"}}>
                  {d.slice(8)}
                </th>
              ))}
            </tr>
          </thead>

          {/* body */}
          <tbody className="text-[15px] text-slate-700">
            {visibleRows.map((row) => {
              /* диапазоны план/факт */
              const planIdxs:number[]=[], factIdxs:number[]=[];
              days.forEach((d,i)=>{const v=row.daily[d]; if(v?.plan) planIdxs.push(i); if(v?.fact) factIdxs.push(i);});
              const planStart=planIdxs[0]??-1, planEnd=planIdxs.at(-1)??-1;
              const factStart=factIdxs[0]??-1, factEnd=factIdxs.at(-1)??-1;
              const hasPlan=planStart!==-1, hasFact=factStart!==-1;

              const factOk=row.total_fact===row.total_plan || row.total_fact===row.order_qty;
              const factCls=factOk?"text-emerald-600":"text-red-500/80";

              return (
                <tr key={row.order_no+row.article_number} className="odd:bg-white even:bg-slate-50 hover:bg-indigo-50/40" style={{height:32}}>
                  <td className="py-2 px-3">{row.large_group}</td>
                  <td className="py-2 px-3">{row.order_no}</td>
                  <td className="py-2 px-3">{row.article_number}</td>
                  <td className="py-2 px-3">{row.name}</td>
                  <td className="py-2 px-3 text-right">{row.order_qty.toLocaleString("ru-RU")}</td>
                  <td className="py-2 px-3 text-right font-semibold">{row.total_plan.toLocaleString("ru-RU")}</td>
                  <td className={`py-2 px-3 text-right font-semibold ${factCls}`}>{row.total_fact.toLocaleString("ru-RU")}</td>

                  {showDetails && (
                    <>
                      <td className="py-2 px-3 text-right">{row.total_fact_qty.toLocaleString("ru-RU")}</td>
                      <td className="py-2 px-3">{row.plan_start}</td>
                      <td className="py-2 px-3">{row.plan_finish}</td>
                      <td className="py-2 px-3">{row.fact_start}</td>
                      <td className="py-2 px-3">{row.fact_finish}</td>
                    </>
                  )}

                  {/* дни */}
                  {days.map((d,i)=>{
                    const v=row.daily[d]||{plan:0,fact:0};
                    const isPlan=hasPlan&&i>=planStart&&i<=planEnd;
                    const isFact=hasFact&&i>=factStart&&i<=factEnd;
                    const planCls=["h-4",isPlan?"bg-emerald-300/50 ring-1 ring-emerald-300/40 shadow-sm flex items-center justify-center":"",isPlan&&i===planStart?"rounded-l-full":"",isPlan&&i===planEnd?"rounded-r-full":""].join(" ");
                    const factCls=["h-4",isFact?"bg-indigo-200/60 ring-1 ring-indigo-200/40 shadow-sm flex items-center justify-center":"",isFact&&i===factStart?"rounded-l-full":"",isFact&&i===factEnd?"rounded-r-full":""].join(" ");
                    return (
                      <td key={d} className="p-0 border-y" style={{width:28}}>
                        <div className="flex flex-col h-full">
                          <div className={planCls}>{isPlan&&v.plan?<span className="text-[10px]">{v.plan.toLocaleString("ru-RU")}</span>:null}</div>
                          <div className={factCls}>{isFact&&v.fact?<span className="text-[10px]">{v.fact.toLocaleString("ru-RU")}</span>:null}</div>
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
