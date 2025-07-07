import { Separator } from "@radix-ui/react-separator";
import { Tabs, TabsList, TabsTrigger } from "@radix-ui/react-tabs";

type View = "month" | "week" | "day";

interface PageHeaderProps {
  title: string;
  view: View;
  onViewChange: (v: View) => void;
  rightSlot?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  view,
  onViewChange,
  rightSlot,
}) => (
  <header className="sticky top-0 z-30 bg-white/90 backdrop-blur shadow-sm">
    {/* убираем max-w, ставим маленький отступ слева, чтобы совпало с таблицей */}
    <div className="flex flex-col gap-3 pr-6">
      <div className="flex items-center justify-between">
        {/* Более жирный заголовок */}
        <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">{title}</h1>
        {rightSlot}
      </div>

      <Tabs value={view} onValueChange={v => onViewChange(v as View)}>
        <TabsList
          className="flex gap-2 bg-gray-100 rounded-lg border border-gray-300 p-1 w-fit shadow-sm"
        >
          <TabsTrigger
            value="month"
            className="data-[state=active]:bg-[#0d1c3d] data-[state=active]:text-white data-[state=active]:shadow data-[state=active]:border data-[state=active]:border-gray-300 data-[state=active]:border-b-white data-[state=active]:z-10 px-4 py-1 rounded-md text-sm font-medium text-gray-600 transition-colors"
          >
            Month Plan
          </TabsTrigger>
          <TabsTrigger
            value="week"
            className="data-[state=active]:bg-[#0d1c3d] data-[state=active]:text-white data-[state=active]:shadow data-[state=active]:border data-[state=active]:border-gray-300 data-[state=active]:border-b-white data-[state=active]:z-10 px-4 py-1 rounded-md text-sm font-medium text-gray-600 transition-colors"
          >
            Weekly Plan
          </TabsTrigger>
          <TabsTrigger
            value="day"
            className="data-[state=active]:bg-[#0d1c3d] data-[state=active]:text-white data-[state=active]:shadow data-[state=active]:border data-[state=active]:border-gray-300 data-[state=active]:border-b-white data-[state=active]:z-10 px-4 py-1 rounded-md text-sm font-medium text-gray-600 transition-colors"
          >
            Daily Plan
          </TabsTrigger>
        </TabsList>
      </Tabs>
    </div>
    <Separator />
  </header>
);
