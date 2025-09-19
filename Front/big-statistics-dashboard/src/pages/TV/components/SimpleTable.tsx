// src/pages/TV/components/SimpleTable.tsx
import React from 'react';

type SimpleTableProps = {
	cols: string[];
	rows: (string | number)[][];
	isExpanded?: boolean;
	alignOverrides?: Record<number, 'left' | 'center' | 'right'>;
};

export const SimpleTable: React.FC<SimpleTableProps> = ({ cols, rows, isExpanded, alignOverrides }) => {
	// Единая схема минимальных ширин по колонкам (можете подстроить числа)
	const minWidthClasses = [
		'min-w-[150px]', // 0 Time Slot
		'min-w-[150px]', // 1 Order No
		'min-w-[150px]', // 2 Article Number
		'min-w-[150px]', // 3 Name
		'min-w-[100px]', // 4 Total Plan (NEW)
		'min-w-[80px]',  // 5 Plan
		'min-w-[12px] w-[12px]', // 6 /
		'min-w-[80px]',  // 7 Fact
		'min-w-[150px]', // 8 Compl.
		'min-w-[150px]', // 9 Different
		'min-w-[150px]', // 10 Takt time
		'min-w-[100px]', // 11 LQC Qty
		'min-w-[100px]', // 12 LQC %
	];

	// Выравнивание по колонкам: Total Plan — влево, Plan — вправо, '/' — по центру, Fact — влево
	const defaultAlign = [
		'text-left', 'text-left', 'text-left', 'text-left', // 0..3
		'text-left', // 4 Total Plan (align left)
		'text-right', // 5 Plan
		'text-center', // 6 /
		'text-left', // 7 Fact
		'text-left', // 8 Compl.
		'text-left', // 9 Different
		'text-left', // 10 Takt time
		'text-left', // 11 Lqc Qty
		'text-left', // 12 Lqc %
	];

	const getAlignClass = (idx: number) => {
		const ov = alignOverrides?.[idx];
		if (ov === 'left') return 'text-left';
		if (ov === 'center') return 'text-center';
		if (ov === 'right') return 'text-right';
		return defaultAlign[idx] ?? 'text-left';
	};

	const parsePercent = (value: unknown): number => {
		const m = String(value).match(/([0-9]+(?:\.[0-9]+)?)/);
		const num = m ? parseFloat(m[1]) : 0;
		if (Number.isNaN(num)) return 0;
		return Math.max(0, Math.min(100, num));
	};

	return (
		<div className="w-full overflow-x-auto">
			{/* Контейнер с максимальной высотой и вертикальной прокруткой */}
			<div className={`${isExpanded ? '' : 'max-h-[268px] overflow-y-auto'}`}>
				{/* Растягиваем таблицу на всю ширину контейнера */}
				<table className="table-auto w-full text-sm">
				<thead>
					<tr className="border-b border-gray-200">
						{cols.map((col, i) => (
							<th
								key={i}
								className={`whitespace-nowrap py-2 font-semibold text-base text-gray-900 pl-4 pr-2 ${getAlignClass(i)} ${minWidthClasses[i] ?? ''} px-2`}
							>
								{col}
							</th>
						))}
					</tr>
				</thead>
				<tbody>
					{rows.map((row, rIdx) => (
						<tr key={rIdx} className="hover:bg-gray-50 border-b border-gray-200">
							{row.map((cell, cIdx) => {
								const alignClass = getAlignClass(cIdx);
								const baseTd = `whitespace-nowrap pl-4 pr-2 py-2 ${alignClass} ${minWidthClasses[cIdx] ?? ''} px-2 text-[15px]`;
								// Узкая разделительная колонка '/'
								if (cIdx === 6) {
									const hasPlan = row[5] !== '' && row[5] !== undefined && row[5] !== null && String(row[5]).length > 0;
									const hasFact = row[7] !== '' && row[7] !== undefined && row[7] !== null && String(row[7]).length > 0;
									return (
										<td key={cIdx} className={baseTd}>
											{hasPlan || hasFact ? '/' : ''}
										</td>
									);
								}

								// Столбец Fact — значения полужирным
								if (cIdx === 7) {
									return (
										<td key={cIdx} className={`${baseTd} font-semibold`}>
											{cell}
										</td>
									);
								}
								if (cIdx === 8) {
									// Compl. — прогресс‑бар + одиночная ось слева
									const p = parsePercent(cell);
									return (
										<td key={cIdx} className={`relative ${baseTd}`}>
											{/* вертикальная ось в начале бара */}
											<span className="absolute inset-y-1 left-0 w-[1px] bg-gray-400 z-20" />
											{/* сам прогресс */}
											<span className="absolute inset-y-1 left-0 bg-blue-200/60" style={{ width: `${p}%` }} />
											<span className="relative z-30 pl-2">{cell}</span>
										</td>
									);
								}
								// Different — красный текст, если значение < 0 (цвет как в KPI: text-red-700)
								if (cIdx === 9) {
									const num = typeof cell === 'number' ? cell : parseFloat(String(cell).replace(/[^0-9.-]/g, ''));
									const isNegative = !Number.isNaN(num) && num < 0;
									return (
										<td key={cIdx} className={`${baseTd} ${isNegative ? 'text-red-700' : ''}`}>
											{cell}
										</td>
									);
								}
								return (
									<td key={cIdx} className={baseTd}>
										{cell}
									</td>
								);
							})}
						</tr>
					))}
				</tbody>
			</table>
			</div>
		</div>
	);
};


