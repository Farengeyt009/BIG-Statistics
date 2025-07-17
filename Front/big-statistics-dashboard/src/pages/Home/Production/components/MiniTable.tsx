interface Props {
  title: string;
  cols: string[];
  rows: (string | number)[][];
}

export const MiniTable = ({ title, cols, rows }: Props) => (
  <div className="bg-white shadow-sm rounded-2xl p-4 flex-1">
    <h3 className="font-medium mb-3">{title}</h3>
    <table className="w-full text-sm">
      <thead>
        <tr className="text-gray-500 border-b">
          {cols.map((c) => (
            <th key={c} className="font-normal text-left py-1">{c}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i} className="border-b last:border-b-0">
            {row.map((cell, j) => (
              <td key={j} className="py-1">{cell}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
); 