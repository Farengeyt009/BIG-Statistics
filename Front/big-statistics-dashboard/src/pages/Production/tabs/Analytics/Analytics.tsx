import React from 'react';
import { useTranslation } from 'react-i18next';

const Analytics: React.FC = () => {
  const { t } = useTranslation('production');

  return (
    <div className="mt-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-2xl font-bold text-[#0d1c3d] mb-4">
          Production Analytics
        </h2>
        <p className="text-gray-600 mb-4">
          Advanced analytics and reporting for production performance and trends.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
          <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-200">
            <h3 className="font-semibold text-indigo-800 mb-2">Performance Metrics</h3>
            <p className="text-sm text-indigo-600">Key performance indicators and trends</p>
          </div>
          <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
            <h3 className="font-semibold text-orange-800 mb-2">Efficiency Analysis</h3>
            <p className="text-sm text-orange-600">Production efficiency and optimization</p>
          </div>
          <div className="bg-teal-50 p-4 rounded-lg border border-teal-200">
            <h3 className="font-semibold text-teal-800 mb-2">Predictive Analytics</h3>
            <p className="text-sm text-teal-600">Forecasting and predictive models</p>
          </div>
          <div className="bg-pink-50 p-4 rounded-lg border border-pink-200">
            <h3 className="font-semibold text-pink-800 mb-2">Cost Analysis</h3>
            <p className="text-sm text-pink-600">Production cost analysis and optimization</p>
          </div>
          <div className="bg-cyan-50 p-4 rounded-lg border border-cyan-200">
            <h3 className="font-semibold text-cyan-800 mb-2">Quality Trends</h3>
            <p className="text-sm text-cyan-600">Quality metrics and improvement trends</p>
          </div>
          <div className="bg-amber-50 p-4 rounded-lg border border-amber-200">
            <h3 className="font-semibold text-amber-800 mb-2">Resource Utilization</h3>
            <p className="text-sm text-amber-600">Resource usage and optimization</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Analytics; 