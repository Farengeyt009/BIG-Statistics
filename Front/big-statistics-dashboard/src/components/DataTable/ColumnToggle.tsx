import React from "react";

interface ColumnToggleProps {
  allColumns: string[];
  visible: string[];
  onChange: (visible: string[]) => void;
}

const ColumnToggle: React.FC<ColumnToggleProps> = ({ allColumns, visible, onChange }) => {
  // TODO: реализовать UI для управления видимостью столбцов
  return (
    <div className="mb-2 flex flex-wrap gap-2">
      {allColumns.map((col) => (
        <label key={col} className="flex items-center gap-1 text-xs">
          <input
            type="checkbox"
            checked={visible.includes(col)}
            onChange={() => {
              if (visible.includes(col)) {
                onChange(visible.filter((v) => v !== col));
              } else {
                onChange([...visible, col]);
              }
            }}
          />
          {col}
        </label>
      ))}
    </div>
  );
};

export default React.memo(ColumnToggle); 