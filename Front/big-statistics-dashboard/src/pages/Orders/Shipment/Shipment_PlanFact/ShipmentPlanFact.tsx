import ShipmentPlanFactTable from './ShipmentPlanFactTable';

type Props = { fromDate: Date; toDate: Date };

export default function ShipmentPlanFact({ fromDate, toDate }: Props) {
  // Убрали дублирующую загрузку - теперь загрузка происходит только в ShipmentPlanFactTable
  return (
    <div className="p-2">
      <ShipmentPlanFactTable year={fromDate.getFullYear()} month={fromDate.getMonth() + 1} toYear={toDate.getFullYear()} toMonth={toDate.getMonth() + 1} />
    </div>
  );
}


