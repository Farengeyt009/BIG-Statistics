import { BarChart } from "./BarChart";
import { chartData } from "../utils/mockData";

// фирменные оттенки Umami
const COLOR_VISITORS = 'rgba(59,130,246,0.9)'; // blue-500 @ 90 %
const COLOR_VIEWS    = 'rgba(59,130,246,0.35)'; // blue-500 @ 35 %

export const TrendChart = () => {
  const labels = chartData.map(item => item.hour);
  const visitors = chartData.map(item => item.visitors);
  const views = chartData.map(item => item.views);

  return (
    <div className="h-96 w-full rounded-2xl bg-white shadow-sm p-4">
      <BarChart
        labels={labels}
        visitors={visitors}
        views={views}
        height={320}
      />
      
      {/* Легенда */}
      <div className="mt-2 flex gap-6 text-xs">
        <div className="flex items-center gap-1">
          <span className="block h-3 w-3 rounded-sm" style={{ background: COLOR_VIEWS }} />
          views
        </div>
        <div className="flex items-center gap-1">
          <span className="block h-3 w-3 rounded-sm" style={{ background: COLOR_VISITORS }} />
          visitors
        </div>
      </div>
    </div>
  );
}; 