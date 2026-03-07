import React from 'react';

export default function RateLimitWidget({ data = {} }) {
  const { usage = {}, limits = {} } = data || {};
  const percentUsed = usage.percentUsed || 0;
  const plan = data?.plan || 'basic';
  
  const getStatusColor = () => {
    if (percentUsed > 90) return 'bg-red-50 border-red-400';
    if (percentUsed > 70) return 'bg-yellow-50 border-yellow-400';
    return 'bg-green-50 border-green-400';
  };

  const getProgressColor = () => {
    if (percentUsed > 90) return 'bg-red-500';
    if (percentUsed > 70) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  return (
    <div className={`bg-white rounded-lg shadow p-6 border-l-4 ${getStatusColor()}`}>
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-sm font-medium text-gray-500">Plan & Usage</h3>
          <p className="mt-2 text-2xl font-bold text-gray-900 capitalize">{plan}</p>
        </div>
        <span className="text-xs font-semibold text-gray-600 bg-gray-200 px-2 py-1 rounded">
          {percentUsed.toFixed(0)}% Used
        </span>
      </div>
      
      <div className="mt-4">
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div 
            className={`h-2 rounded-full ${getProgressColor()}`} 
            style={{ width: `${percentUsed}%` }}
          ></div>
        </div>
      </div>

      {percentUsed > 90 && (
        <p className="mt-3 text-xs text-red-600 font-medium">
          ⚠️ You're using {percentUsed.toFixed(0)}% of your plan limit
        </p>
      )}
      
      <p className="mt-2 text-xs text-gray-500">
        API Calls: {usage.apiCallsThisMonth || 0} / {limits.apiCallsPerMonth || 'unlimited'}
      </p>
    </div>
  );
}
