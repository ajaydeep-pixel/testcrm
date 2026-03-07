import React from 'react';

export default function SalesWidget({ todaysSales }) {
  return (
    <div className="bg-white rounded-lg shadow p-6 border-l-4 border-blue-500">
      <h3 className="text-sm font-medium text-gray-500">Sales Today</h3>
      <div className="mt-2 flex items-baseline">
        <span className="text-3xl font-bold text-gray-900">
          ${todaysSales.toFixed(2)}
        </span>
        <span className="ml-2 text-sm text-gray-500">
          <span className="text-green-600">↑ 2.5%</span> from yesterday
        </span>
      </div>
      <div className="mt-4">
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div 
            className="bg-blue-500 h-2 rounded-full" 
            style={{ width: '65%' }}
          ></div>
        </div>
        <p className="text-xs text-gray-500 mt-1">Target: $1000/day</p>
      </div>
    </div>
  );
}
