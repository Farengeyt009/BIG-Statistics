import React from 'react';

type OrdersStatisticsProps = {
  fromDate: Date;
  toDate: Date;
};

const OrdersStatistics: React.FC<OrdersStatisticsProps> = ({ fromDate, toDate }) => {
  return (
    <div className="p-4">
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Статистика заказов клиентов</h2>
        <p className="text-gray-600">
          Период: {fromDate.toLocaleDateString()} - {toDate.toLocaleDateString()}
        </p>
        <p className="text-sm text-gray-500 mt-4">
          Здесь будет отображаться статистика заказов (в разработке)
        </p>
      </div>
    </div>
  );
};

export default OrdersStatistics;

