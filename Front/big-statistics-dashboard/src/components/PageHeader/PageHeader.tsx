import { Separator } from "@radix-ui/react-separator";
import { Tabs, TabsList, TabsTrigger } from "@radix-ui/react-tabs";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

interface TabDef {
  key: string;
  label: string;
}

interface PageHeaderProps {
  title: string;
  view: string;
  onViewChange: (v: string) => void;
  rightSlot?: React.ReactNode;
  tabs: TabDef[];
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  view,
  onViewChange,
  rightSlot,
  tabs,
}) => {
  const headerRef = useRef<HTMLElement | null>(null);
  const [spacerHeight, setSpacerHeight] = useState(0);

  const measureHeights = useCallback(() => {
    const headerEl = headerRef.current;
    if (!headerEl) return;

    const headerHeight = headerEl.offsetHeight || 0;
    const parent = headerEl.parentElement;
    const parentPaddingTop = parent
      ? parseFloat(getComputedStyle(parent).paddingTop || "0")
      : 0;

    const calculatedSpacer = Math.max(headerHeight - parentPaddingTop, 0);
    setSpacerHeight(calculatedSpacer);
  }, []);

  useLayoutEffect(() => {
    measureHeights();
  }, [measureHeights, title, view, rightSlot, tabs]);

  useEffect(() => {
    window.addEventListener("resize", measureHeights);
    return () => window.removeEventListener("resize", measureHeights);
  }, [measureHeights]);

  return (
    <>
      <header
        ref={headerRef}
        className="fixed top-0 [left:var(--sidebar-width,4rem)] right-0 z-30 bg-white/90 backdrop-blur shadow-sm pl-4"
      >
        <div className="flex flex-col gap-3 pr-6">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">{title}</h1>
          </div>
          <div className="flex items-center justify-between">
            <Tabs value={view} onValueChange={onViewChange}>
              <TabsList
                className="flex gap-2 bg-gray-100 rounded-lg border border-gray-300 p-1 w-fit shadow-sm"
              >
                {tabs.map(tab => (
                  <TabsTrigger
                    key={tab.key}
                    value={tab.key}
                    className="data-[state=active]:bg-[#0d1c3d] data-[state=active]:text-white data-[state=active]:shadow data-[state=active]:border data-[state=active]:border-gray-300 data-[state=active]:border-b-white data-[state=active]:z-10 px-4 py-1 rounded-md text-sm font-medium text-gray-600 transition-colors"
                  >
                    {tab.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
            {rightSlot}
          </div>
          <div style={{ marginBottom: 4 }} />
        </div>
        <Separator />
      </header>
      <div style={{ height: spacerHeight }} />
    </>
  );
};
