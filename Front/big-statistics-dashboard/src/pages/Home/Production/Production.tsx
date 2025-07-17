import { kpiData, pagesTable, refTable } from "./utils/mockData";
import { MetricCard } from "./components/MetricCard";
import { TrendChart } from "./components/TrendChart";
import { MiniTable } from "./components/MiniTable";

export default function Production() {
  return (
    <div className="container space-y-6">
      {/* KPI-карточки */}
      <section className="grid gap-6 [grid-template-columns:repeat(auto-fit,minmax(12.5rem,max-content))]">
        {kpiData.map((kpi) => (
          <MetricCard
            key={kpi.label}
            label={kpi.label}
            value={kpi.value}
            changePercent={kpi.delta}
            isPositiveMetric={kpi.label !== "Bounce rate"}
          />
        ))}
      </section>

      {/* График */}
      <TrendChart />

      {/* Две таблицы под графиком */}
      <section className="flex flex-col lg:flex-row gap-4">
        <MiniTable
          title="Pages"
          cols={["Page", "Views", "Share"]}
          rows={pagesTable.map((r) => [r.page, r.views.toLocaleString(), r.share])}
        />

        <MiniTable
          title="Referrers"
          cols={["Referrer", "Visitors", "Share"]}
          rows={refTable.map((r) => [r.ref, r.visitors.toLocaleString(), r.share])}
        />
      </section>
    </div>
  );
} 