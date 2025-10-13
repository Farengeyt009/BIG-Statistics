import React from 'react';
import OrdersLogTable from './OrdersLogTable';

interface OrdersLogProps {
  selectedReportId: number | null;
  setSelectedReportId: (id: number | null) => void;
  isManagerOpen: boolean;
  setIsManagerOpen: (open: boolean) => void;
}

const OrdersLog: React.FC<OrdersLogProps> = ({ 
  selectedReportId, 
  setSelectedReportId,
  isManagerOpen,
  setIsManagerOpen 
}) => {
  return (
    <OrdersLogTable 
      selectedReportId={selectedReportId}
      setSelectedReportId={setSelectedReportId}
      isManagerOpen={isManagerOpen}
      setIsManagerOpen={setIsManagerOpen}
    />
  );
};

export default OrdersLog;

