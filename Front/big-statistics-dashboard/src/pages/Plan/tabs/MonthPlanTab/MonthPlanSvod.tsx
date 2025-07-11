import React, { useRef } from "react";
import { DataTable } from '../../../../components/DataTable/DataTable';
import planFactSummary from "../../../../Test/PlanFactSummary.json";
import { dashIfZero, percentFmt, numberWithSpaces } from './utils/MonthPlanSvod_formatters';
import { buildColumns } from './utils/buildColumns';
import { ColumnDef } from '@tanstack/react-table';

const keys = [
  'LargeGroup',
  'PlanQty',
  'FactQty',
  'DifferentQty',
  'PercentQty',
  'PlanTime',
  'FactTime',
  'DifferentTime',
  'PercentTime',
];

const columnsTable1: ColumnDef<any>[] = buildColumns(keys, [
  {
    accessorKey: 'PlanQty',
    header: 'PlanQty',
    cell: ({ getValue }) => numberWithSpaces(getValue<number>()),
  },
  {
    accessorKey: 'FactQty',
    header: 'FactQty',
    cell: ({ getValue }) => numberWithSpaces(getValue<number>()),
  },
  {
    accessorKey: 'DifferentQty',
    header: 'Δ Qty',
    cell: ({ getValue }) => numberWithSpaces(getValue<number>()),
  },
  {
    accessorKey: 'PercentQty',
    header: '% Qty',
    cell: ({ getValue }) => percentFmt(getValue<number>()),
  },
  {
    accessorKey: 'PlanTime',
    header: 'PlanTime',
    cell: ({ getValue }) => numberWithSpaces(getValue<number>()),
  },
  {
    accessorKey: 'FactTime',
    header: 'FactTime',
    cell: ({ getValue }) => numberWithSpaces(getValue<number>()),
  },
  {
    accessorKey: 'DifferentTime',
    header: 'Δ Time',
    cell: ({ getValue }) => numberWithSpaces(getValue<number>()),
  },
  {
    accessorKey: 'PercentTime',
    header: '% Time',
    cell: ({ getValue }) => percentFmt(getValue<number>()),
  },
]);

interface MonthPlanSvodProps {
  year: number;
  month: number;
  ymPanelRef: React.RefObject<HTMLDivElement | null>;
}

const MonthPlanSvod: React.FC<MonthPlanSvodProps> = () => {
  const data = (planFactSummary as any).table1 || [];
  const wrapperRef = useRef<HTMLDivElement>(null);

  return (
    <div className="p-4">
      <div
        ref={wrapperRef}
        style={{
          zoom: 0.96,
          transform: 'scale(1)',
          transformOrigin: 'top left',
          width: '105%',
          height: '105%',
        }}
        className="bg-white border border-red-300 rounded-lg shadow-sm p-4 max-w-4xl"
      >
        <h2 className="text-lg font-semibold mb-2">
          Large Group <span className="mx-2">→</span> Plan Performance
        </h2>
        <DataTable
          data={data}
          columns={columnsTable1}
        />
      </div>
    </div>
  );
};

export default MonthPlanSvod; 