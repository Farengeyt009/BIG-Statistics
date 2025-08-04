import React from 'react';
import { useTranslation } from 'react-i18next';

const Details: React.FC = () => {
  const { t } = useTranslation('production');

  return (
    <div className="mt-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-2xl font-bold text-[#0d1c3d] mb-4">
          Production Details
        </h2>
        <p className="text-gray-600 mb-4">
          Detailed view of production processes, orders, and manufacturing data.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
          <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
            <h3 className="font-semibold text-gray-800 mb-2">Production Orders</h3>
            <p className="text-sm text-gray-600">View and manage production orders</p>
          </div>
          <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
            <h3 className="font-semibold text-gray-800 mb-2">Work Centers</h3>
            <p className="text-sm text-gray-600">Monitor work center performance</p>
          </div>
          <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
            <h3 className="font-semibold text-gray-800 mb-2">Materials</h3>
            <p className="text-sm text-gray-600">Track material consumption</p>
          </div>
          <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
            <h3 className="font-semibold text-gray-800 mb-2">Quality Reports</h3>
            <p className="text-sm text-gray-600">Quality control reports and metrics</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Details; 