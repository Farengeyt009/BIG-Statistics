import { useReactTable, getCoreRowModel, flexRender, ColumnDef } from "@tanstack/react-table";

const columns: ColumnDef<any>[] = [
  { header: "Номер заказа", accessorKey: "Order_No" },
  { header: "Артикул", accessorKey: "Article_number" },
  { header: "Группа продукции", accessorKey: "Prod_Group" },
  { header: "Кол-во в заказе", accessorKey: "Order_QTY" },
  { header: "Невыполнено", accessorKey: "Uncompleted_QTY" },
];

const MainTableTab: React.FC<{ data: any[] }> = ({ data }) => {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <table className="min-w-full border border-gray-300 text-sm">
      <thead className="bg-gray-100">
        {table.getHeaderGroups().map((headerGroup) => (
          <tr key={headerGroup.id}>
            {headerGroup.headers.map((header) => (
              <th key={header.id} className="border px-2 py-1 text-left">
                {flexRender(header.column.columnDef.header, header.getContext())}
              </th>
            ))}
          </tr>
        ))}
      </thead>
      <tbody>
        {table.getRowModel().rows.map((row) => (
          <tr key={row.id}>
            {row.getVisibleCells().map((cell) => (
              <td key={cell.id} className="border px-2 py-1">
                {flexRender(cell.column.columnDef.cell, cell.getContext())}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
};

export default MainTableTab; 